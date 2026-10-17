# Plan: contestador de Telnyx como respaldo y retirada de Retell

Versión 1 (2026-10-17). Pedido por el usuario el 16-10: dejar de usar Retell como respaldo y
cubrir la caída de la recepcionista con un contestador de Telnyx sin IA. El contestador
ofrece un WhatsApp al número de la llamada (pulsa 1) o un mensaje de voz (pulsa 2), y solo
pide teclear el número cuando la llamada llega con número oculto.

Dos fases, en este orden: primero el contestador en producción y probado; después, en otra PR,
la retirada de Retell.

## Por qué

Comprobado el 16-10 contra el código y la BD de producción:

- **Retell nunca ha cogido una llamada en producción.** Hay 0 filas `calls` con
  `voiceProvider = 'retell'` en los dos negocios, y los dos tienen `voiceRoutingTarget = telnyx`.
- **El failover automático está apagado** (`VOICE_FAILOVER_ENABLED` no es `true`) y, aunque se
  encendiera, no sabría qué vigilar. `jobs/telnyxHealthCheck.ts` solo mira la página de estado de
  Telnyx, que no tiene ningún componente de «AI Assistants» (`TELNYX_STATUS_COMPONENT_IDS` vacío;
  lo avisa el log de cada arranque).
- **Retell solo cubre una caída de la IA de Telnyx, no de su telefonía.** El número es de Telnyx
  y el failover solo cambia su `connection_id` a la SIP Connection que apunta a
  `sip:sip.retellai.com` (`TelnyxAiAdapter.setPhoneNumberConnectionId`). Si cae la red de
  Telnyx, Retell se queda también sin llamadas. Un contestador dentro de Telnyx cubre lo mismo.
- **El hueco real de hoy no lo cubre nadie.** En `handleCallInitiated`
  (`adapters/telnyx/webhookHandlers.ts`), si `answerCallWithAssistant` falla la función devuelve
  `success: false`, la ruta responde 404 y la llamada se queda sonando sin que nadie conteste.
- **Mantener Retell cuesta.** Son unas 3.000 líneas solo de Retell en `backend/src`, otras ~1.000
  mezcladas en ficheros compartidos (`agentBootstrap.ts`, `calendar/service.ts`,
  `phone/service.ts`, `idiomas/`), ~800 de scripts y ~2.000 de tests. Cada cambio de prompt hay
  que subirlo a mano con `syncManagedAgentPrompts.ts`, y la cuenta compartida entre dev y
  producción ya ha costado agentes borrados (AGENTS.md § Cleaning the Retell account).

## Lo que no cubre

- **Una caída de Telnyx entero.** Telefonía, números y WhatsApp van por Telnyx (es el BSP de
  Meta): si cae, no queda ni recepcionista ni contestador ni WhatsApp. Hoy pasa lo mismo con
  Retell. Evitarlo exigiría un segundo operador, y queda fuera de este plan.
- **El chat de clientes cae con la voz.** La recepcionista del chat es el mismo assistant de
  Telnyx (`chatCliente.ts` → `client.ai.assistants.chat`). Si el cliente responde al WhatsApp
  durante la caída, recibe `mensajes.chatNoDisponible`. Por eso el WhatsApp no promete un bot:
  promete que el negocio le atiende, y el dueño recibe el recado en paralelo.
- **Un fallo de la IA a mitad de llamada** (el assistant contesta y luego se queda mudo). Telnyx
  no avisa de eso con un evento de Call Control conocido. Hay que investigarlo en la fase 0.

## Fase 0: comprobaciones antes de escribir código

Medio día, en dev, contra el Call Control App de dev (`alhabla-platform`, id
`3046870077287696179`, webhook `https://dev-api.alhabla.ai/webhooks/telnyx`):

1. **`answer` sin assistant y `gather_using_audio` con un MP3 nuestro.** Contestar con
   `client.calls.actions.answer(id, { client_state })`, reproducir un MP3 servido desde el
   backend o R2 y recibir `call.gather.ended` con `digits` y `status` (`valid`, `invalid`,
   `timeout`, `call_hangup`…). Medir el retardo desde `call.initiated` hasta que suena el audio.
2. **`gather_using_speak` con voz.** Probar `Azure.es-ES-ElviraNeural` /
   `Azure.es-ES-AlvaroNeural` y una de las Ultra del negocio con formato `Telnyx.<modelo>.<id>`.
   El SDK 7.24 documenta Azure, AWS Polly, ElevenLabs y Telnyx (`ActionSpeakParams.voice`).
3. **`record_start` para el mensaje de voz.** Con `play_beep: true`, `max_length: 120`,
   `timeout_secs: 5` (silencio que lo corta), `recording_track: "inbound"`, formato mp3 y canal
   single. Comprobar que llega `call.recording.saved` con `call_leg_id` y que
   `listRecordingsByCallLegId` resuelve el `call_control_id`, como en las llamadas de hoy.
4. **Cómo falla de verdad el assistant.** Contestar con un `assistant.id` inexistente o borrado y
   anotar qué lanza el SDK (código, mensaje), para que el disparador solo salte en fallos del
   assistant y no en uno de la llamada (ya colgada, id caducado). Buscar también si Telnyx manda
   algún evento cuando el assistant deja de responder a mitad de llamada.
5. **DTMF en una llamada desviada.** Los clientes llegan por el desvío del móvil o del fijo del
   negocio: confirmar con una llamada real desviada que los tonos llegan (RFC 2833 / in-band).

Hecho cuando las cinco tengan respuesta escrita en este plan.

## Fase 1: el contestador

### Cuándo entra

1. **Automático, llamada a llamada.** En `handleCallInitiated`, si `answerCallWithAssistant`
   lanza un error del assistant (fase 0, punto 4), se contesta con el contestador en vez de
   devolver `success: false`. Hoy esa llamada se pierde. El reintento sin voz que ya existe se
   mantiene antes del contestador.
2. **Manual, para una caída larga.** Un interruptor que manda todas las llamadas al contestador
   sin intentar el assistant, para no hacer esperar a cada cliente el fallo del assistant. Se
   reutiliza `Business.voiceRoutingTarget` con un valor nuevo, `"contestador"`, y
   `scripts/telnyxFailoverControl.ts` pasa a cambiar entre `telnyx` y `contestador`. El número no
   cambia de `connection_id`: el contestador vive en el mismo Call Control App.
3. **No entra** en las llamadas que hoy se cuelgan a propósito: negocio suspendido
   (`callsSuspendedAt`, impago vencido) o sin agente. Decisión pendiente (ver al final).

### El guion

Todo con `client_state` en base64, tipo `{ tipo: "contestador", businessId, paso, intentos }`,
para no chocar con el de la comprobación de desvío (`comprobacionDesvio.ts`, tipo
`comprobacion_desvio`). Textos en el idioma principal del negocio (`resolverIdiomas`); en la
primera versión, español, y el resto de idiomas cuando estén sus audios.

1. **Menú** (`gather_using_audio`, `valid_digits: "12"`, `maximum_digits: 1`, `timeout_millis:
   8000`, `maximum_tries: 2`):
   > «Has llamado a {negocio}. Ahora mismo no podemos atenderte. Si quieres que te escribamos
   > por WhatsApp para pedir o cambiar tu cita, pulsa 1. Para dejar un mensaje de voz al
   > negocio, pulsa 2 o espera a la señal.»
2. **Pulsa 1, con número visible** (`fromNumber` en E.164 y móvil: `normalizarTelefono` y
   prefijo 6/7):
   - Se encola la plantilla al cliente (abajo) a ese número y se crea el recado al dueño.
   - Audio: «Te acabamos de escribir por WhatsApp. Gracias por llamar.» y `hangup`.
   - Si el número es un fijo, no se puede mandar WhatsApp: «Desde un fijo no podemos
     escribirte. Deja tu mensaje después de la señal.» y se pasa al paso 4.
3. **Pulsa 1, con número oculto** (el `from` no es un teléfono, igual que `esNumeroOculto` en
   `voiceTools/service.ts`):
   - `gather_using_audio` con `minimum_digits: 9`, `maximum_digits: 12`, `terminating_digit:
     "#"`: «Teclea tu móvil y pulsa almohadilla.»
   - `normalizarTelefono` sobre lo tecleado. Si no es un móvil válido, se repite una vez y
     después se pasa al mensaje de voz.
   - Confirmación con `gather_using_speak` (el número no se puede pregrabar): «Te escribiremos
     al seis uno dos, tres cuatro cinco, seis siete ocho. Si es correcto, pulsa 1; para
     teclearlo otra vez, pulsa 2.» Las cifras en grupos de tres, como la recepcionista.
   - Con el 1, sigue como en el paso 2.
4. **Pulsa 2 o no pulsa nada** → mensaje de voz:
   - Audio: «Deja tu mensaje después de la señal. Lo grabaremos para que lo escuche el
     negocio.» Ese aviso es el permiso de grabación; la `Call` se crea con
     `grabacionPermitida: true`.
   - `record_start` (fase 0, punto 3) y, al colgar o al acabar `max_length`, `hangup`.
   - El audio entra por el circuito de siempre: `handleCallRecordingSaved` → `Recording` →
     `process-recording` → R2. El dueño lo escucha en el detalle de la llamada (`<Reproductor>`).
5. **Cuelga sin pulsar ni hablar**: la llamada se queda como perdida, con aviso al dueño si
   el número es visible («llamada sin atender de {teléfono}»).

### Audios pregrabados

En una caída de la IA, el TTS de Telnyx (`textToSpeech.generateSpeech`) puede estar caído
también. Por eso los audios fijos se generan antes y el contestador solo reproduce:

- Por negocio y por idioma: el menú (lleva el nombre del negocio) y los mensajes comunes,
  generados con `telnyxAiAdapter.sintetizarVoz` con la voz del negocio y guardados en R2
  (`contestador/<businessId>/<idioma>/<clave>.mp3`).
- Se regeneran cuando cambian el nombre, la voz o el idioma principal (los mismos ganchos que
  resincronizan el assistant), y el reconciliador diario crea los que falten.
- Si falta un audio en la llamada, `gather_using_speak` con la voz Azure de la fase 0 como
  respaldo. La confirmación del número oculto va siempre con `speak`.

### Datos

- La `Call` de siempre (`voiceProvider: "telnyx"`) con un campo nuevo, aditivo:
  `contestador String?` = `whatsapp` | `mensaje_de_voz` | `sin_respuesta`. Lo leen el panel
  («La atendió el contestador») y el informe de salud. Migración solo aditiva.
- Recado al dueño: el `Lead` `type: "message"` de siempre (`crearLeadYAvisar` en
  `recados.ts`), con `data.via = "contestador"` y un motivo ya escrito:
  - WhatsApp: «No pudimos atender su llamada; le hemos escrito por WhatsApp para su cita.»
  - Mensaje de voz: «Le ha dejado un mensaje de voz: escúchalo en la llamada del panel.»
- El aviso usa `avisarRecado` y la plantilla del dueño `recado_negocio`, que ya existe: no hace
  falta plantilla nueva para el dueño.
- Pulsar 1 es el consentimiento para escribirle por WhatsApp a ese número. Queda en el
  `SentMessage` del envío y en el recado.

### El WhatsApp al cliente

- **Propósito nuevo** `contestador` en el envío por propósito: enum Zod de
  `/internal/jobs/send-whatsapp` (`modules/internal/routes.ts`), `lib/jobTypes.ts`,
  `elegirPlantillaCliente` y `jobs/sendWhatsapp.ts`, con `callbackData`
  `cliente:contestador:<callId>`. P1 del 16-10 enseñó que ese enum hay que tocarlo junto con
  el test de la ruta.
- **Botones** (`botonesCliente.ts`, `TIPOS_DE_ENVIO`/`ACCIONES_POR_TIPO`):
  - «Pedir cita» abre la conversación con la recepcionista (`conversarConRecepcionista`) como si
    el cliente hubiera escrito «quiero pedir cita».
  - «Que me llamen» completa el recado del dueño con `quiereQueLeLlamen: true` y responde
    «Hecho: el negocio te llamará».
- **Texto libre.** Una respuesta escrita sin citar el mensaje no lleva `context.id`, y
  `resolverNegocioDelCliente` (`tenantDelCliente.ts`) solo saca candidatos de las reservas: un
  cliente nuevo quedaría como `unknown`. Hay que añadir un paso: el último envío al cliente
  (`SentMessage`, `audience: client`, mismo `toNumber`, de los últimos 7 días) decide el
  negocio.
- **Límite de Meta.** El número de clientes sigue en TIER_250 (250 conversaciones iniciadas por
  la empresa cada 24 h). Una caída larga en hora punta podría llegar al tope. Si se llega, el
  contestador deja de ofrecer el 1 y va al mensaje de voz.

### La plantilla que hay que pedir a Meta

Se añade a `backend/scripts/manual/plantillasWhatsapp/plantillas.json`, con el mismo estilo de
cabecera, negritas y emojis que las `_v3`, y se manda con
`solicitar.mts --nombre llamada_contestador --idioma es --enviar` cuando el usuario apruebe el
texto. Categoría UTILITY: es la respuesta a una petición del cliente (pulsó 1), no publicidad.
Meta puede reclasificarla como MARKETING, y entonces se ajusta el texto.

```json
{
  "name": "llamada_contestador",
  "language": "es",
  "category": "UTILITY",
  "audiencia": "cliente",
  "parameter_format": "NAMED",
  "components": [
    { "type": "HEADER", "format": "TEXT", "text": "Hemos recibido tu llamada" },
    {
      "type": "BODY",
      "text": "Has llamado a *{{negocio_nombre}}* y no hemos podido atenderte por teléfono 📞\n\nEscríbenos por aquí qué necesitas y te ayudamos con tu cita.\n\n_Si prefieres que te llamen, pulsa el botón._",
      "example": {
        "body_text_named_params": [
          { "param_name": "negocio_nombre", "example": "Peluquería Ana" }
        ]
      }
    },
    {
      "type": "BUTTONS",
      "buttons": [
        { "type": "QUICK_REPLY", "text": "Pedir cita" },
        { "type": "QUICK_REPLY", "text": "Que me llamen" }
      ]
    }
  ]
}
```

El catalán y el resto de idiomas, después, con la tanda de traducciones pendiente (42
plantillas sin enviar, auditoría del 16-10).

### Pruebas y verificación

- **Unitarios.** La máquina de estados del guion (cada `call.gather.ended` según `paso` y
  `status`), el disparador (qué errores del assistant lo activan y cuáles no), el número oculto
  (tecleado válido, inválido y confirmación) y el propósito nuevo en la ruta de jobs, con su
  forma exacta (la lección de P1).
- **Webhooks simulados.** Secuencias completas con `simular_webhook_telnyx` del MCP contra el
  backend de dev o `backend-sim`.
- **Llamada real en dev.** Un negocio de dev en `voiceRoutingTarget = "contestador"`: probar
  1 (WhatsApp recibido y botones), 2 (audio en el panel y recado al dueño), número oculto
  (`#31#` delante del número en España) y una llamada desviada desde un móvil.
- **Producción.** Primero el modo manual en una cuenta de prueba; después el automático.

### Coste

Contestador sin IA: minutos de Call Control (~0,002 $/min con la grabación, facturación del
03-10) y una conversación de WhatsApp de utilidad por cada «pulsa 1». No hay minutos de
assistant (0,05 $/min). La regeneración de audios es TTS por carácter, una vez por cambio.

## Fase 2: retirar Retell

Solo cuando la fase 1 lleve una semana en producción sin incidencias. PR aparte y dos
despliegues, porque `cloudbuild` migra antes de cambiar el tráfico y el CI «Cambios —
migraciones y orden de despliegue» bloquea los `DROP COLUMN` sin la etiqueta
`migracion-contract`.

### Despliegue 1: dejar de usar Retell

- **Alta y sincronización.**
  - Fuera la rama Retell de `createBusinessAgent` (`agentBootstrap.ts`), `syncAgentToRetell`,
    `publishRetellAgentUpdate`, `buildRetellLlmPayload`/`AgentPayload`,
    `buildPostCallAnalysisData*`, `buildInboundCallDynamicVariables` y
    `syncAgentNameWithBusinessType`.
  - Fuera sus llamadas en `businesses/routes.ts` y `businesses/horario.ts`.
- **Tools.** Fuera `buildRetellCalendarTools` y la rama Retell de `syncCalendarToolsToAgents`
  (`calendar/service.ts`).
- **Números.** Fuera el `importPhoneNumber` de Retell tras comprar el número
  (`phone/service.ts`) y el borrado en Retell de `auth/accountService.ts`.
- **Módulos enteros.** `adapters/retell/`, `modules/webhooksRetell/`, `plugins/firmaRetell.ts`,
  `modules/retellSimulation/`, `modules/phone/retellInbound.ts` y `lib/voiceOrchestrator.ts`
  (si solo decide entre los dos), con sus tests.
- **Failover.** Fuera `jobs/telnyxHealthCheck.ts`, `lib/telnyxStatusPage.ts` y
  `lib/saludTelnyx.ts`, la ruta `/internal/jobs/telnyx-health-check` y el job de Cloud Scheduler
  `telnyx-health-check` (cada 2 min; se borra a mano, no hay IaC). `telnyxFailoverControl.ts`
  queda solo para el modo contestador.
- **Idiomas.** Fuera `ajustesParaRetell` (`idiomas/resolver.ts`) y el campo `retell` de
  `idiomas/catalogo.ts`.
- **Prompt.** `adaptManagedPromptForTelnyx` traduce las variables de Retell (`{{user_number}}`,
  `{{current_time_…}}`): el prompt pasa a escribirse ya con las de Telnyx, y se actualizan las
  instantáneas y los tests que exigen `{{user_number}}` (`managedAgentPrompt.test.ts`).
- **Scripts y MCP.** Fuera `retellSimulation.ts`, `inventarioAgentesRetell.ts` y
  `borrarAgentesRetell.ts` (después de usarlos en la limpieza), `cutoverToTelnyx.ts`,
  `syncManagedAgentPrompts.ts` en su parte Retell, y `simular_webhook_retell` del MCP
  (`backend/mcp/webhooks.ts`, `firmas.ts`).
- **Variables de entorno.** Fuera `RETELL_API_KEY`, `RETELL_BASE_URL`,
  `RETELL_SIP_TERMINATION_URI`, `RETELL_SIP_TRUNK_AUTH_USERNAME`/`PASSWORD`, `VOICE_FAILOVER_*`,
  `TELNYX_STATUS_COMPONENT_IDS` y `TELNYX_SIP_CONNECTION_ID`, de `.env.example`,
  `docker-compose.yml`, Cloud Run y Secret Manager.
- **Docs.**
  - CLAUDE.md: la regla de los adaptadores y la de firmas pierden Retell, y fuera «Retell.ai de
    respaldo».
  - AGENTS.md: § Voice Orchestrators, Retell Configuration, Retell Dynamic Variables y
    Propagating….
  - La web pública: `web/src/app/legal/privacidad/page.tsx`, donde Retell figura como encargado
    con transferencias fuera del EEE. La política se cambia el mismo día que deja de usarse.
- **Frontend.** Solo comentarios y el tipo `voiceProvider: "telnyx" | "retell" | "whatsapp"`
  (`frontend/src/lib/types.ts`); se queda `"retell"` mientras haya llamadas antiguas en dev.

### Despliegue 2: limpiar datos y cuentas

- **Migración contract** (etiqueta `migracion-contract`):
  - `Business`: `retellPhoneNumberId`, `retellPhoneNumber`, `voiceFailoverActive`,
    `voiceFailoverReason`, `orchestrator`, y el default de `voiceRoutingTarget` pasa a
    `"telnyx"`.
  - `Agent`: `retellAgentId` (y su índice) y `retellLlmId`.
  - Los campos de voz al estilo Retell de `Agent` (`voiceProvider`, `voiceId`, `voiceModel`,
    `llmModel/Provider`, `sttModel/Provider`) solo si nada de Telnyx los lee. Hay que mirarlo
    antes.
  - `Call.voiceProvider` se queda: tiene valores históricos y `whatsapp`.
- **Cuenta de Retell.** Inventario (`inventarioAgentesRetell.ts`), borrado de los 5 agentes de
  respaldo, de los números importados y de la SIP Connection de Telnyx que apunta a Retell. La
  demo de la landing ya va por Telnyx (`alhabla-demo-*`), así que no queda nada que proteger.
  Confirmarlo en el inventario.
- **Contrato con Retell.** Darse de baja y revocar la API key, cuando el usuario lo decida.

## Decisiones pendientes del usuario

Con la recomendación primero:

1. **Negocio suspendido por impago o sin agente.** (a) Se cuelga, como hoy (recomendado: el
   contestador es para las caídas, no para dar servicio sin pagar); (b) contestador con mensaje
   de voz.
2. **Si no pulsa nada.** (a) Mensaje de voz (recomendado: mucha gente no pulsa y sí habla);
   (b) colgar.
3. **Texto de la plantilla `llamada_contestador`.** El de arriba, o cambios antes de mandarla a
   Meta.
4. **El contestador en dev.** Probarlo en el negocio de dev (Peluquería Alhambra) con
   `voiceRoutingTarget = "contestador"` (recomendado), o en una cuenta de prueba de producción.
5. **Cuándo retirar Retell.** Una semana después de la fase 1 sin incidencias (recomendado), o
   en cuanto la fase 1 esté desplegada.
