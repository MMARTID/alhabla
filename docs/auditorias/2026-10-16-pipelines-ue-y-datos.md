# Pipelines, residencia en la UE y datos del cliente (16-10-2026)

Segunda auditoría del día. Continúa la de las partes «terminadas»
(`2026-10-16-partes-completas.md`) con tres preguntas:

1. ¿Son sólidos el resto de pipelines (grabaciones, jobs, WhatsApp, Stripe, informe final, alta)?
2. ¿Pasa todo por la UE?
3. ¿Cómo pide y guarda la recepcionista los datos de los clientes?

Todo se contrastó con producción: BD de solo lectura, Cloud Logging, peticiones, `gcloud` y las
APIs de Telnyx en solo lectura. Producción solo tiene cuentas de prueba (2 negocios, 19 reservas).

Severidad: **alta** = incumple lo que prometemos o expone datos de un cliente a otro;
**media** = da un resultado equivocado a un cliente o al dueño, o pierde datos;
**baja** = caso raro, mensaje engañoso o falta de rastro.

## Arreglado en este PR

| # | Qué pasaba | Arreglo |
|---|------------|---------|
| P1 | **Los avisos de cambio y de cancelación al cliente no salían nunca.** El botón «Avisar» del panel y `avisar_cliente` del Gestor contestaban «Le aviso a X», pero el esquema de `/internal/jobs/send-whatsapp` no admitía `cambio` ni `cancelacion`. Respondía 400 y Cloud Tasks lo repetía 4 veces sin dejar log. Fallaron los 5 avisos que hay en producción (25-09, 05-10 y tres el 13-10). En dev funcionaba, porque el job corre en el mismo proceso sin pasar por Zod. | El enum admite los cinco propósitos. `programedAtMs` es obligatorio salvo en la cancelación. Test de la ruta con las dos formas exactas que encola `programarAvisoAlCliente`. |
| P6 | Un payload que no pasa el esquema en `/internal/jobs/*` respondía 400 **sin log**. Por eso P1 pasó desapercibido tres semanas. | `payloadInvalido()` deja un `error` con la ruta, los errores de Zod y las claves recibidas (sin valores, que llevan teléfonos). Cubre las 9 rutas. |
| P2 | **El resumen semanal resumía la semana que empieza.** Se lanza el lunes a las 08:00 y la ventana iba de ese lunes al siguiente, así que solo cubría 8 horas. Salió a ceros y se omitió el 05-10 y el 12-10, con 20 llamadas la semana anterior en «El petit salo». Nunca se ha enviado un resumen. | `resolverSemanaDelResumen()` da `[lunes anterior, lunes actual)`. Se calcula con fechas civiles, así que la semana del cambio de hora dura 167 o 169 h. La marca `weeklySummarySentAt` y el id de la tarea siguen usando el lunes actual. El asunto acaba en el domingo. |
| P3 | **El reintento de una reserva pendiente podía reservar a ciegas.** Si el calendario seguía sin poder leerse, `getBusyIntervals` devolvía la ocupación como desconocida y `checkAvailability` la ignoraba: la cita podía entrar encima de una apuntada a mano. La reserva en vivo y la lista de espera ya lo evitaban. | Con un calendario externo ilegible, el job lanza un error (Cloud Tasks reintenta) y no reserva. |
| P5 | La cita recuperada en segundo plano se guardaba **sin nombre** (salía anónima en el panel). | `clientName` del lead pasa al `Booking`. |

## Pipelines: arreglado después (PR siguiente)

Los cinco pendientes y tres de los cuatro de «Info», comprobados en el código antes de tocarlos.
Ninguno había ocurrido en producción.

| # | Qué pasaba | Arreglo |
|---|------------|---------|
| 1 | **La clave de la confirmación y del recordatorio no llevaba el número de destino.** Corregir el teléfono y volver a reservar a la misma hora chocaba con `ALREADY_EXISTS` y la tarea vieja se descartaba con `DESTINO_CAMBIADO`: no le llegaba nada a nadie. El reenvío desde el Gestor daba «ya enviado». | `booking-<id>-<propósito>-<epoch>-<huella>`: 8 hex del sha256 del E.164 (`lib/clavesDeMensajes.ts`). El Gestor añade `-g<accionId>` a la confirmación. El respaldo de la v2 parte de la clave de la fila. |
| 2 | **La cita recuperada no guardaba el consentimiento ni el canal**, así que el cliente nunca recibía la confirmación, y `createdVia` era siempre `voice`. | El lead guarda `smsConsent` y `createdVia`; el job los copia al `Booking` y programa la confirmación con `programarMensajesAlCliente`. |
| 3 | **Grabaciones sin tope de reintentos** («Recording exceeds the maximum accepted size» volvía 30 días) y **timeout de descarga de 5 min** con Cloud Tasks cortando a los 180 s. | Tamaño y URL no permitida: irrecuperables (`PermanentJobError`). Plazo único de 150 s para la descarga y la subida. Tope de 96 reencolados (24 h) en `retry-stuck-recordings`. Además, un corte a mitad de la descarga ya no tumba el proceso: `pipeline` en vez de `pipe`, y el error aborta el PUT a R2. |
| 4 | **El barrido de WhatsApp entrante sin enrutar no tenía tope.** | Como mucho 3 reintentos por fila, contados en el `handler` del reclamo (`reintento:en-curso:<n>`). Después la fila se cierra con `reintento:agotado`, su último error y un `console.error`. |
| 5 | **Un recado se perdía si fallaba `lead.create`.** | Un lead `message` por llamada, creado con un cerrojo de transacción. Si falla, se programa la revisión diferida. `completarInforme` y `revisarEscaladaSinRecado` recuperan el recado del informe que no tiene lead. |
| Info | `delivery_unconfirmed` no reconocido; correos sin `taskId`; las dos purgas en serie. | `delivery_unconfirmed` cuenta como `sent` (guarda el coste). Todos los correos llevan `taskId`. Cada purga va en su propio `try` y el endpoint responde 500 si falla alguna. |

Sigue pendiente: un pedido de número `pending` no tiene ningún job que lo reanude.

Comprobado y bien:

- Idempotencia de los envíos (`reclamarEnvio`).
- Los SMS con 4xx se marcan como permanentes.
- Grabaciones: 24 de 24 con 2xx.
- Stripe: firma, cerrojo por evento, orden de eventos; 15 de 15 eventos bien.
- Minutos medidos: 270 de 270.
- WhatsApp entrante: firma, deduplicación y tenant.
- El job de mensajes al cliente relee la reserva antes de enviar.
- La lista de espera no reserva a ciegas.
- Los 9 jobs del Scheduler sin fallos.

## ¿Pasa todo por la UE? No

Lo que guarda datos está en la UE:

- Cloud Run y Cloud Tasks: `europe-west1`.
- Cloud SQL: `europe-west1-b`, con las copias de seguridad en `eu`.
- R2: jurisdicción UE (endpoint `.eu`).
- Grabaciones de Telnyx: S3 `eu-central-1`.

Lo que sale o puede salir del EEE:

| Gravedad | Qué | Evidencia | Arreglo propuesto |
|----------|-----|-----------|-------------------|
| **Alta** | **Todas las conversaciones van a OpenAI.** El LLM de las recepcionistas, el Gestor y las demos es `openai/gpt-5.6-luna`, que Telnyx no aloja. El comentario de `telnyxAssistantPayload.ts:739` dice lo contrario. | `GET /v2/ai/models`: `owned_by: "openai"`. Kimi-K2.6 da `"Telnyx"`. | **Decisión tuya.** Pasar a `moonshotai/Kimi-K2.6` (alojado por Telnyx y ya probado como respaldo; el coste es igual) o declarar OpenAI como subencargado con transferencia internacional. |
| **Alta** | **Telnyx no tiene anclaje en la UE.** Las apps de voz están en `anchorsite_override: "Latency"`, la API se llama por `api.telnyx.com` y la «Data Locality» de la cuenta no se ha mirado (no tiene API). | `list_texml_applications` y `list_call_control_applications`. | Anclar en Frankfurt la app de Call Control y las `ai-assistant-*` (también al crearlas y en el reconciliador). Mirar «Data Locality» en el portal. Probar `api.telnyx.eu`. Confirmación por escrito (issue #13). |
| **Alta** | **Soniox** (STT y voz de catalán, euskera y gallego) es un tercero sin región fijada, y ya atiende llamadas en producción. | `ver_assistant_telnyx`: `region: null`. | Pedir a Soniox la región UE, o documentarlo como transferencia. |
| Media | Los **logs** de producción están en el bucket `_Default`, que es `global`, y llevan teléfonos completos. | `gcloud logging buckets list`. | Bucket `europe-west1` y redirigir el sink `_Default`. Enmascarar los teléfonos en los logs. |
| Media | Las **funciones de Vercel** están en `iad1` (Washington). Solo pasan metadatos: IP, user-agent y cookies. | `vercel inspect`. | Región `fra1` o `cdg1` en los dos proyectos. |
| Media | **Retell** sigue recibiendo la configuración de cada negocio, en EE. UU. | 2 agentes con `retellAgentId`. | Retirarlo o documentarlo como respaldo. |
| Media | El registro pregunta «¿Tus clientes son de la UE?» y la respuesta no se usa (`voiceOrchestrator.ts:16`), aunque la web dice que es para la RGPD. | Código. | Quitar la frase o darle uso. |
| Baja | Secret Manager con replicación automática; `pii_redaction: disabled`; las notas de voz de WhatsApp las transcribe Whisper en `api.telnyx.com`. | `gcloud` y código. | Con lo anterior. |

## Datos del cliente en las llamadas

Cómo funciona hoy:

- La recepcionista pide servicio, día, hora y nombre. No pide correo.
- El teléfono lo toma del identificador de llamada.
- Hace un solo resumen y en él pregunta a la vez si reserva y si puede mandar el WhatsApp.
- Saluda por su nombre a quien llama desde un número conocido.

| Gravedad | Qué | Evidencia | Arreglo propuesto |
|----------|-----|-----------|-------------------|
| **Alta** | **La identidad depende solo del identificador de llamada, que Telnyx no verifica.** Con un número conocido (o falseado), el saludo dice el nombre y el último servicio, `find_my_appointment` da la próxima cita y `cancel_appointment` la cancela. El titular no recibe ningún aviso. Un teléfono compartido expone a otra persona. | `telnyx_end_user_target_verified: false` en las 6 conversaciones revisadas. `service.ts:2249`. Un número de prueba tiene 5 nombres distintos en sus reservas. | `find_my_appointment` con `nombre` obligatorio, que solo devuelve la cita si coincide. Aviso al titular cuando cancela la recepcionista. Ningún servicio en el saludo hasta que confirme quién es. |
| **Alta** | **Telnyx guarda más de lo que dice la política de privacidad** (audio 30 días, texto 90). Hay 588 grabaciones en Telnyx desde el 11-09 y las conversaciones con `data_retention: true`. Solo se borran las grabaciones que el cliente rechazó (`grabacion.ts:314`). `purgeOldRecordings.ts` dice que Telnyx aplica el mismo plazo, y no es así. | `GET /v2/recordings`: 588 resultados (cuenta entera, dev y prod). | Borrar la grabación en Telnyx en cuanto se copia a R2 (`processRecording.ts`), más una limpieza única de lo antiguo. Conversaciones: averiguar si la API las borra. Si no, ajustar la política. |
| Media-alta | **Datos sin plazo**: `Lead.data` (recados, que pueden llevar salud), `ClienteDelNegocio`, `ClientConversation` y `SentMessage.toNumber`. `SentMessage` e `InboundMessage` no tienen clave foránea al negocio y sobreviven al borrado de la cuenta. | `purgarTextoDeLlamadas.ts`, `schema.prisma`. | Ampliar la purga de 90 días y el `deleteAccount`. |
| Media-alta | **El derecho de supresión del cliente final no tiene mecanismo.** El prompt le dice que el negocio puede borrarle sus datos, pero ni el panel ni la API pueden. | `seccionesDelPrompt.ts:211`. | `DELETE /clientes/:telefono` en el panel y en el Gestor. |
| Media | El teléfono que dicta el cliente se guarda **sin validar ni normalizar**: el WhatsApp no sale y nadie lo vuelve a reconocer. | `service.ts:1895`. | Normalizar a E.164 (como el de los recados). Si no es válido, `CLIENT_PHONE_INVALID` y que la recepcionista lo repita en grupos de tres. |
| Media | Con **número oculto**, la cita queda sin teléfono y el calendario dice «Teléfono: anonymous». A los **fijos** se les promete un WhatsApp. | `webhookHandlers.ts:445`, `mensajesCliente.ts:689`. | Calcular el tipo de línea en el contexto de la llamada y adaptar el prompt. |
| Media | **Para cambiar una cita se cancela antes de reservar.** Si la reserva nueva falla, el cliente se queda sin ninguna. Pasó en un chat real el 13-10. | `seccionesDelPrompt.ts:285` y `:377`. | Reservar la nueva primero y cancelar después. |
| Media | **Salud** (fisioterapia, estética): el motivo acaba en la transcripción, el resumen y el recado, y `find_my_appointment` devuelve el servicio. | `seccionesDelPrompt.ts:86`. | En esos nichos, «consulta sobre su tratamiento» en recados y resúmenes. |
| Media-baja | Teléfonos completos en Cloud Logging. | `chatCliente.ts`, `sendWhatsapp.ts`, `sendSms.ts`, `router.ts`. | `enmascararTelefono()` en `logUtils.ts`. |
| Baja | El permiso de grabar es por teléfono, no por persona. No hay regla para menores. `clientEmail` sigue en la tool aunque el prompt no lo pide. La descripción de `find_my_appointment` está desfasada. | Código. | Limpieza. |

## Plantillas de WhatsApp en otros idiomas

`backend/scripts/manual/plantillasWhatsapp/` contiene:

- `traducciones.json`: las 42 traducciones. Las 5 plantillas al cliente van en `ca`, `en`, `fr`,
  `de`, `it`, `pt_PT` y `nl`; las 7 al dueño, solo en `ca`.
- `solicitar.mts`: el script que las solicita. Sin `--enviar` solo dice lo que haría.

Nada se ha enviado a Meta:

- **Telnyx no tiene borradores.** `POST /v2/whatsapp/message_templates` manda la plantilla a
  revisión de Meta en el acto, y una plantilla `PENDING` no se puede editar.
- **Meta no admite euskera ni gallego** en plantillas.

El backend aún no elige la plantilla por idioma, aunque ya guarda el idioma del cliente en
`ClienteDelNegocio.idioma`. Tampoco formatea `{{cita}}` en otro idioma ni reconoce los botones
traducidos. Sin ese cambio, las plantillas aprobadas no se usarían.
