# Plan: retirar Retell y cubrir los fallos reales de Telnyx

Versión 3 (2026-10-17), documento técnico.
- La v1 proponía un contestador de Telnyx sin IA como respaldo de Retell.
- La v2 midió los fallos de Telnyx y lo cambió por retirar Retell y añadir protecciones baratas.
- Esta versión baja la v2 a PRs concretas, con el inventario de código verificado con grep y
  lectura sobre `main` (aa44daa) el 17-10.

## Resumen

- **Qué.** Quitar Retell del todo: código, datos, cuenta, secretos y documentación legal.
  Añadir cuatro protecciones:
  - reintento de `answer`;
  - `fallback_destination` de Telnyx;
  - STT de respaldo;
  - alertas de los fallos de voz que hoy nadie ve.
- **Por qué.** Retell no ha cogido ninguna llamada en producción y su failover está apagado. Solo
  cubriría una caída de la IA de Telnyx, que no ha pasado en tres meses de historial público ni
  en nuestras 112 llamadas. Los fallos que sí pasan (audio, 5xx de la API v2, grabaciones) no los
  arregla. Mantenerlo cuesta unas 6.800 líneas entre código, scripts y tests.
- **Riesgo principal.** Hoy Telnyx está acoplado a Retell en dos sitios del alta (sección 2).
  Quitar Retell sin desacoplarlo antes dejaría a los negocios nuevos sin assistant y sin número
  activo. Por eso la PR 1 desacopla y no borra nada.

## 1. Lo medido

Fuentes:
- Historial público de `status.telnyx.com`, del 20-07 al 17-10. La página es de abril de 2026;
  su API solo da las 25 últimas incidencias.
- Producción: `voice_webhook_events`, `salud_llamadas`, `sent_messages` y Cloud Logging, del
  14-09 al 16-10.
- Dev: 135 llamadas.

El volumen es pequeño: 0 fallos quiere decir «no visto», no «imposible».

| Servicio de Telnyx | Uso | Incidencias públicas | Visto por nosotros |
|---|---|---|---|
| Telefonía entrante (números de España, `sip.telnyx.eu`) | Que la llamada llegue | 10-08: audio cortado, llamadas caídas. 10/11-09: audio degradado 9,7 h. 7 y 11-08: salientes en Europa | Ningún fallo |
| Call Control API v2 | `answer` con el assistant, `hangup`, `record_*`, `transfer` | 28-07: 503 en configuración de números y SIP. 6-08: errores de API. 23-09: 5xx intermitentes 2 h. 13-10: webhooks con retraso | `call.initiated` 112 de 112 bien desde el 14-09; 0 respuestas 5xx nuestras a `/webhooks/telnyx` en 30 días |
| AI Assistants de voz | La recepcionista | Ninguna en Europa. 19-08: data locality en Australia. 27-08: Ultra no disponible al crear o actualizar | 106 contestadas, 104 conversaciones, 101 con resultado; 1 transcripción con 404 (24-09) |
| STT (Deepgram Flux, Soniox) | Entender al cliente | 10-08: latencia de Flux | Ningún fallo |
| LLM (`openai/gpt-5.6-luna` a través de Telnyx) | La respuesta | 14-09: endpoints compatibles con OpenAI 0,1 h | Ningún fallo. Ya hay respaldo: `fallback_config.model = "moonshotai/Kimi-K2.6"` |
| Grabaciones | Audio en el panel | 10-08 y 9/10-09 (25 h) | Solo bugs nuestros, ya arreglados (PR #61/#62) |
| WhatsApp (Telnyx como BSP) | Avisos, confirmaciones, chat | Ninguna de WhatsApp | 175 envíos, 1 fallido (40008) |
| `ai.assistants.chat` | Chat de clientes, Gestor | Ninguna | Ningún fallo |

Conclusiones que guían el diseño:

1. **Retell no aporta disponibilidad.** Las llamadas le llegan por un SIP trunk de Telnyx
   (`TelnyxAiAdapter.setPhoneNumberConnectionId`), así que comparte con Telnyx la red, los números
   y la API.
2. **Lo que nos ha tocado o puede tocarnos es transitorio y de la API**, como el 5xx del 23-09.
   La protección proporcionada es reintentar, no un segundo proveedor.
3. **Un fallo de voz hoy es invisible.** Si falla `handleCallInitiated`, la ruta responde **404,
   no 5xx** (`webhooksTelnyx/routes.ts:147`), así que la alerta de 5xx que existe no lo ve.
   Ninguna alerta mira los logs `[Telnyx]`.

## 2. Estado actual: cómo está acoplado Telnyx a Retell

| Flujo | Hoy | Problema al quitar Retell |
|---|---|---|
| Alta del negocio | `auth/routes.ts:205,1016` escribe `orchestrator = detectVoiceOrchestrator()`, que devuelve siempre `"retell"` (`lib/voiceOrchestrator.ts:16`). `createBusinessAgent` (`lib/agentBootstrap.ts:576-735`) crea el agente de Retell dentro de `if (orchestrator === "retell")` (638), y **solo dentro de esa rama** llama a `crearAssistantYPromocionar` (723-729), que crea el assistant de Telnyx y pone `orchestrator = voiceRoutingTarget = "telnyx"` (`lib/telnyxAgentSync.ts:351-381`) | Sin la rama, ningún negocio nuevo tendría assistant de Telnyx |
| Compra del número | El `connection_id` se elige con `orchestrator` (`phone/service.ts:213-216`: si es `"telnyx"`, `TELNYX_CALL_CONTROL_APP_ID`; si no, el trunk de Retell). Después se importa en Retell (386-436) y **solo ahí** se escribe `phoneNumberStatus = "active"` (429-436). Sin `retellAgentId` devuelve `"purchased"`; sin `RETELL_SIP_*` lanza y acaba en `"failed"` | Sin el import, ningún número pasaría a `"active"`. Lo exigen `comprobacionDesvio.ts:278`, `recordarDesvioSinComprobar.ts:79`, `telnyxReconciler.ts:225`, `gestor/tools.ts:259,277`, `onboarding/routes.ts:152` y el atajo de `phone/service.ts:65,133` |
| Sincronización | `PATCH /business/me`, `horario.ts`, `informacion.ts`, `bookings/service.ts:181` y `calendar/service.ts` llaman a `syncAgentToTelnyx` y después a `syncAgentToRetell`. `syncCalendarToolsToAgents` mezcla las dos ramas (Retell 687-777, Telnyx 780-819). `PATCH /agents/:id` solo sincroniza Retell (`agents/routes.ts:284-346`) | `syncCalendarToolsToAgents` no se puede borrar entera. `PATCH /agents/:id` se queda sin sincronizar hasta el siguiente `syncAgentToTelnyx` o el reconciliador |
| Condiciones con `voiceRoutingTarget` | `comprobacionDesvio.ts:314` y `recordarDesvioSinComprobar.ts:84` filtran `voiceRoutingTarget === "telnyx"`. Hoy dejan fuera a los negocios que se quedaron en el default `"retell"` (no elegibles o pendientes de cutover) | Si se borra la columna, esas condiciones desaparecen y pasan para todos. Hay que sustituirlas por la condición real: assistant de Telnyx y número en el Call Control App |
| Failover | `jobs/telnyxHealthCheck.ts` (cada 2 min, Cloud Scheduler `telnyx-health-check`), `lib/saludTelnyx.ts`, `lib/telnyxStatusPage.ts`, `scripts/telnyxFailoverControl.ts`, la tabla `salud_telnyx` | Se borra todo. El job de Scheduler se borra **antes** de quitar su ruta, para que no dé 404 cada 2 min |
| Salud | `server.ts:184-192` comprueba Retell en `/health` (informativo). `tests/lib/salud.test.ts:129` fija ese texto literal | Editar los dos |

Datos de producción el 17-10: 2 negocios, los dos con agente de Retell y assistant de Telnyx;
uno con número `active` importado en Retell y otro `pending` sin número. Ninguno está afectado
hoy. El acoplamiento rompería cualquier alta nueva en cuanto Retell falle: sin crédito, según lo
anotado el 22-09.

## 3. Diseño

**Invariante nueva:** todo negocio es de Telnyx. «Puede recibir llamadas» pasa a ser una
condición sobre datos que ya existen, no un campo de enrutamiento:

```ts
// lib/telefoniaDelNegocio.ts (nuevo)
export function recibeLlamadasPorTelnyx(b: {
  telnyxPhoneNumberId: string | null;
  phoneNumberStatus: string | null;
}): boolean {
  return Boolean(b.telnyxPhoneNumberId) && b.phoneNumberStatus === "active";
}
```

Sustituye a `voiceRoutingTarget === "telnyx"` en `comprobacionDesvio.ts:314` y
`recordarDesvioSinComprobar.ts:84`. El assistant ya se comprueba aparte
(`selectTelnyxInboundAgent`).

**Campos que desaparecen** (contract en la PR 3):
- `Business`: `orchestrator`, `voiceRoutingTarget`, `voiceFailoverActive`, `voiceFailoverReason`,
  `voiceRoutingChangedAt`, `retellPhoneNumber`, `retellPhoneNumberId`.
- `Agent`: `retellAgentId` (con su índice) y `retellLlmId`.
- La tabla `salud_telnyx`.

Los campos de voz al estilo Retell de `Agent` (`voiceProvider`, `voiceId`, `voiceModel`,
`llm*`, `stt*`) **se quedan**. El camino de Telnyx no los lee (usa `eligibility.voiceId`), pero
los escriben `buildAgentPersistencePayload` y `PATCH /agents/:id`, y los leen `calls/routes.ts`
(`agent.voice`) y las respuestas de la API. Retirarlos es otra limpieza, con el contrato de la
API delante.

**`Call.voiceProvider`** se queda (valores históricos y `whatsapp`). Su default pasa de
`"retell"` a `"telnyx"` en la PR 2. Ningún código de producción depende del default: todos los
`create` lo pasan. Sí depende `tests/integration/helpers/fixtures.ts:59-70` (`createTestCall`),
que pasará a crear llamadas `telnyx`. Hay que revisar
`tests/integration/mcp/diagnostico.test.ts:74-76,146-184`, que filtra por `'telnyx'`.

**El prompt** deja de escribirse con las variables de Retell. `adaptManagedPromptForTelnyx`
(`telnyxAssistantPayload.ts:481-498`) se queda en la PR 2: no cuesta nada y quitarlo cambia el
hash de todos los assistants por un cambio de texto nulo. Se retira en una PR propia de prompt,
fuera de este plan, que escriba `{{telnyx_end_user_target}}` y `{{telnyx_current_time_<zona>}}`
directamente y actualice las dos instantáneas. Así no se mezcla la retirada con un cambio de
prompt.

## 4. PRs

Orden y dependencias:

```
PR 1 desacoplar ──► PR 2 cortar Retell ──► (estable 1 semana) ──► PR 3 contract
PR 4 reintento de answer     (independiente; puede ir primero)
PR 5 alertas                 (independiente; puede ir primero)
PR 6 fallback_destination    (tras un experimento en dev)
PR 7 STT de respaldo         (tras investigar; puede no salir)
PR W web: política de privacidad (mismo día que se despliega la PR 2)
```

Cada PR es solo de backend (salvo la W, solo de web): el CI avisa si se mezclan.

### PR 1. Telnyx no depende de Retell (sin borrar nada)

Objetivo: que un fallo o la ausencia de Retell no afecte a Telnyx. No cambia el comportamiento
cuando Retell funciona.

- **`lib/agentBootstrap.ts` › `createBusinessAgent`.** Sacar `crearAssistantYPromocionar` de la
  rama `orchestrator === "retell"` y llamarlo siempre que `isVoiceTelnyxRolloutEnabled()`. La rama
  de Retell queda como best-effort, con su try/catch y log ruidoso (negocio, motivo, error).
- **`auth/routes.ts:205,1016`.** Escribir `orchestrator: "telnyx"` al crear el negocio cuando el
  rollout está activo, en lugar de `detectVoiceOrchestrator()`. `crearAssistantYPromocionar`
  sigue fijando `voiceRoutingTarget`; su rama `"ya_estaba"` no debe saltarse la creación del
  assistant, solo la promoción. Revisar `telnyxAgentSync.ts:351-381` con ese caso.
- **`phone/service.ts`.**
  - `connection_id` siempre al Call Control App (`TELNYX_CALL_CONTROL_APP_ID`), sin mirar
    `orchestrator` (213-216).
  - `phoneNumberStatus = "active"` en cuanto el número está comprado y asignado al Call Control
    App, antes del import en Retell, y en la misma escritura que `telnyxPhoneNumber` e `Id`.
  - El import en Retell (386-436) pasa a best-effort: si falla o falta `retellAgentId`, se loguea
    y no cambia el estado.
- **Tests.**
  - `tests/lib/agentBootstrap.test.ts`: el assistant se crea aunque Retell lance o no haya
    crédito.
  - `tests/modules/phone/service.test.ts`: `active` sin `retellAgentId` y con el import en Retell
    fallando; `connection_id` siempre el del Call Control App.
  - `tests/lib/telnyxAgentSync.test.ts`: el caso `"ya_estaba"` crea el assistant.
- **Verificación en dev.** Alta nueva con `RETELL_API_KEY` vacía en `backend-dev`: assistant
  creado, número `active`, comprobación de desvío disponible. Después, `ver_en_dev main`.
- **Rollback.** Revertir la PR. No hay migración.
- **Hecho cuando** un alta y una compra de número completas funcionen sin Retell en dev, y los
  dos negocios de producción sigan igual (`resumen_negocio`).

### PR 2. Cortar Retell (código y config; las columnas se quedan sin uso)

Requiere la PR 1 en producción. Pasos de operación **antes** de desplegar:
- Borrar el job de Cloud Scheduler `telnyx-health-check`: hoy no hace nada y su ruta desaparece
  en esta PR.
- Ejecutar `scripts/inventarioAgentesRetell.ts` contra producción y contra dev (la cuenta de
  Retell es compartida) y guardar la salida para la PR 3.

**Se borra entero:**
- `adapters/retell/`, `modules/webhooksRetell/`, `plugins/firmaRetell.ts`,
  `modules/retellSimulation/`, `modules/phone/retellInbound.ts` y `lib/voiceOrchestrator.ts`.
- `jobs/telnyxHealthCheck.ts`, `lib/saludTelnyx.ts`, `lib/telnyxStatusPage.ts` y la ruta
  `/internal/jobs/telnyx-health-check` (`internal/routes.ts:21,558-593`).
- Scripts: `retellSimulation.ts`, `syncManagedAgentPrompts.ts`, `telnyxFailoverControl.ts` y
  `cutoverToTelnyx.ts`.
  - `inventarioAgentesRetell.ts` y `borrarAgentesRetell.ts` se quedan hasta la PR 3.
  - En `package.json` salen los scripts `sim` y `agents:sync-prompts`, y la dependencia
    `retell-sdk`. Sale también `backend/cloudbuild.sync-agent-prompts.yaml`.
- Sus tests:
  - `tests/adapters/retell/*`, `tests/modules/webhooksRetell/*`, `tests/modules/phone/retellInbound.test.ts`
    y `tests/modules/retellSimulation/*`.
  - `tests/jobs/telnyxHealthCheck.test.ts`, `tests/lib/telnyxStatusPage.test.ts` y
    `tests/integration/lib/saludTelnyx.test.ts`.

**Se edita:**
- **`lib/agentBootstrap.ts`.**
  - Fuera todo lo de Retell: `DEFAULT_RETELL_AGENT_CONFIG`, `RETELL_VOICE_*`,
    `publishRetellAgentUpdate`, `getRetellEditableDraft`, `resolveRetellVoiceProfile`,
    `buildRetellLlmPayload/AgentPayload`, `buildPostCallAnalysisData*`,
    `buildInboundCallDynamicVariables` y `syncAgentToRetell`.
  - Fuera la rama Retell de `createBusinessAgent` y de `syncAgentNameWithBusinessType`. El
    renombrado en BD (772-775) se queda.
  - `syncAgentToRetell` también escribía `Agent.systemPrompt`, la copia que enseña el panel
    (973-987). La escribe ya `telnyxAgentSync.ts:221-223`, pero solo para agentes con assistant
    elegible. Comprobar que el panel no se queda con un prompt viejo en algún caso sin assistant.
- **Llamadas a `syncAgentToRetell`.** Fuera en `businesses/routes.ts:753-762`,
  `businesses/horario.ts:36`, `businesses/informacion.ts:40` y `bookings/service.ts:181`.
- **`calendar/service.ts`.** Fuera `buildRetellCalendarTools` (413-658) y la rama Retell de
  `syncCalendarToolsToAgents` (687-777). La rama Telnyx (780-819) se queda.
- **`agents/routes.ts`.**
  - Fuera las ramas `orchestrator === "retell"` (172-229, 284-346).
  - `PATCH /agents/:id` pasa a llamar a `syncAgentToTelnyx` tras guardar, para que una edición
    del prompt llegue al assistant. Hoy esa ruta solo sincronizaba Retell.
- **`phone/service.ts`.** Fuera el import en Retell, `RETELL_SIP_*` y el log de `orchestrator`.
  `getPhoneNumberStatus` deja de devolver `orchestrator` y `retellPhoneNumberId`; el frontend no
  los lee (`PhoneNumberInfo`).
- **`auth/accountService.ts`.** Fuera el borrado en Retell (183-248). **`auth/routes.ts`**: fuera
  `orchestrator` en los `create`.
- **`telnyxAgentSync.ts` › `crearAssistantYPromocionar`.** Fuera la escritura de `orchestrator`,
  `voiceRoutingTarget` y `voiceRoutingChangedAt`, y el tipo `PromocionATelnyx`. La función pasa a
  llamarse `crearAssistantDelNegocio`.
- **`telnyxReconciler.ts:207-241`.**
  - Fuera la comprobación `voiceRoutingTarget`/`voiceFailoverActive`.
  - El hallazgo «sin `telnyxPhoneNumberId`» pasa a aplicarse a todos los negocios con número
    activo.
- **`comprobacionDesvio.ts:270,314`, `recordarDesvioSinComprobar.ts:84`.** Pasan a usar
  `recibeLlamadasPorTelnyx` (sección 3).
- **`lib/idiomas/catalogo.ts`, `resolver.ts`.** Fuera `IdiomaDeRetell`, el campo `retell` de
  cada idioma, `ajustesParaRetell`, `idiomaDeRetell` y `usaVozMultilingueEnRetell`.
- **`lib/tiposDeAsistente.ts:38,64,70`.** Fuera `respaldo: "retell"`.
- **`server.ts:30-31,184-192,217`.** Fuera la ruta y la comprobación de Retell en `/health`.
- **Esquema (migración solo aditiva).**
  - Default de `Call.voiceProvider` a `"telnyx"`.
  - Default de `Business.orchestrator` y `voiceRoutingTarget` a `"telnyx"`, mientras existan.
  - `ALTER COLUMN … SET DEFAULT` no lo bloquea el CI de contract.
- **MCP.**
  - `firmas.ts`, `webhooks.ts`, `servidorDev.ts`: fuera `simular_webhook_retell`, `BASE_RETELL_DEV`
    y `retell-sdk`.
  - `resumenDeNegocio.ts`: fuera las columnas de Retell y de failover del SQL.
  - `jobsDeProd.ts:39-40`: fuera `telnyx-health-check`.
  - `trazaDeLlamada.ts:108,351`: fuera la regex `retell/tools`.
- **Config.** Fuera `RETELL_*`, `TELNYX_SIP_CONNECTION_ID`, `TELNYX_STATUS_COMPONENT_IDS` y
  `VOICE_FAILOVER_ENABLED` de `.env.example` (7-9, 122, 133-136, 164-178) y de `docker-compose.yml`
  (`backend` 18-19, 67, 79-81, 86, 101; `backend-dev` 149-150, 198, 210-212, 217, 232).
  `VOICE_TELNYX_ROLLOUT` se queda: sigue decidiendo la elegibilidad.
- **CI.** `.github/workflows/deploy-backend.yml:230-236,261`: fuera el aviso de
  `syncManagedAgentPrompts`.
- **Tests que se editan** (lista del inventario, 17-10):
  - `agentBootstrap` (87 coincidencias), `phone/service` (49), `calendar/service` (39) y
    `agents/routes` (24).
  - `idiomas/resolver`, `telnyxReconciler`, `telnyxAgentSync` y `internal/routes`.
  - `comprobacionDesvio` (unitario y de integración) y `recordarDesvioSinComprobar`.
  - `salud.test.ts:129`, `managedAgentPrompt*`, `mcp/firmas`, `mcp/webhooks` y
    `mcp/diagnosticoDeLlamadas`.
  - Los mocks de `syncAgentToRetell` en `businesses/{horario,informacion,me,agenda}` y
    `bookings/routes`.
  - Los datos `retellLlmId` en `calls/routes` y `recordings/routes`.
  - El censo de tests antes y después va en la descripción de la PR: solo bajan los ficheros
    borrados y los casos de Retell.
- **Docs, en la misma PR.**
  - CLAUDE.md: la intro (16-17), las reglas (43-51), la estructura (155-161) y la documentación
    (187-190).
  - AGENTS.md: se reescriben «Voice Orchestrators» (1985-2044), «Orchestrator Field» (1648-1655),
    «Phone provisioning» (2161), «Retell Dynamic Variables» (2642-2651) y «Propagating…»
    (3616-3693); se repasan unas 25 menciones sueltas.

**Después de desplegar:**
- Quitar `RETELL_*`, `TELNYX_SIP_CONNECTION_ID` y `VOICE_FAILOVER_ENABLED` de Cloud Run y de
  Secret Manager.
- Desplegar la PR W.

**Verificación:**
- En dev: alta, compra de número, llamada real, cambio de horario (el reconciliador no da
  hallazgos), «Comprobar desvío» y borrado de cuenta.
- En producción: `estado_prod`, una llamada de prueba a «El petit salo» y el reconciliador a
  mano (`lanzar_job_prod telnyx-reconciler`) con `telnyxSyncError` en null.

**Rollback:** revertir la PR. Las columnas siguen ahí y el código anterior las vuelve a leer.
Los secretos no se borran hasta que la PR lleve unos días estable.

**Hecho cuando** `grep -ri retell backend/src` solo encuentre comentarios históricos, y la suite
y la integración pasen.

### PR W. Política de privacidad (solo `web/`)

- `web/src/app/legal/privacidad/page.tsx`: fuera la viñeta de Retell (204-216) y su mención en
  las transferencias internacionales (256-257).
- `updatedAt` (30) con la fecha del despliegue.
- La viñeta de Telnyx (217-238) dice solo «telefonía, mensajería y WhatsApp». Ahora procesa
  también la voz con IA: transcripción, LLM a través de OpenAI fuera del EEE (auditoría del
  16-10) y síntesis. Hay que añadirlo.
- Va el mismo día que la PR 2: la política no puede nombrar un encargado que ya no tratamos ni
  callar uno que sí.

### PR 3. Contract (tras una semana estable)

- Migración con la etiqueta `migracion-contract`:
  - `Business`: `DROP COLUMN` de `orchestrator`, `voiceRoutingTarget`, `voiceFailoverActive`,
    `voiceFailoverReason`, `voiceRoutingChangedAt`, `retellPhoneNumber`, `retellPhoneNumberId`
    (con sus `@unique`).
  - `Agent`: `retellAgentId` (con `@unique` y `@@index`) y `retellLlmId`.
  - `DROP TABLE salud_telnyx`.
- `schema.prisma` y los selects que aún nombren esos campos. Tras la PR 2 no debería quedar
  ninguno: `tsc` lo comprueba.
- **Operación (manual, con permiso del usuario):**
  - Con la salida guardada del inventario, `borrarAgentesRetell.ts --ids … --confirm` para los
    agentes, LLMs y números importados.
  - Borrar en el portal de Telnyx la SIP Connection que apunta a `sip.retellai.com`.
  - Borrar después los dos scripts de inventario y su test.
- **Cuenta de Retell.** Baja y revocación de la clave cuando el usuario lo decida.
- **Rollback.** No hay vuelta atrás de los datos: por eso va una semana después de la PR 2, y
  esos valores ya no los lee nadie.

### PR 4. Reintentar el `answer`

El fallo realista: un 5xx o un timeout de la API v2, como el del 23-09.

**Hoy** (`adapters/telnyx/webhookHandlers.ts:461-480`):
- Cualquier error en `answerCallWithAssistant` acaba en el catch externo, que loguea
  `[Telnyx] Error procesando inicio de llamada …` y devuelve `success: false`.
- La ruta responde 404 y marca el evento `result: "error"`. El cliente oye tonos hasta que
  cuelga.
- El reintento sin voz que existe salta con **cualquier** error, si había `contexto.voz`.
- El cliente de Telnyx tiene `maxRetries: 0` y `timeout: 10_000` (`lib/telnyx.ts`).

**Diseño:**

```ts
// adapters/telnyx/reintentos.ts (nuevo)
export function esFalloTransitorioDeTelnyx(error: unknown): boolean {
  if (error instanceof Telnyx.APIConnectionError) return true; // incluye el timeout
  if (error instanceof Telnyx.APIError)
    return error.status === 429 || (error.status ?? 0) >= 500;
  return false;
}
```

- En `handleCallInitiated`:
  1. Intento 1 con todas las opciones.
  2. Si el error es transitorio: hasta dos reintentos con las mismas opciones, tras 300 y
     800 ms.
  3. Si el error es un 4xx y había `contexto.voz`: el reintento sin voz de siempre, una vez.
- **Presupuesto total de unos 6 s.** Cada reintento lleva `{ timeout: 2500 }` en las opciones de
  la petición del SDK. Un `answer` que tarda más que eso deja al cliente esperando de todos modos.
- **Si se agota** el presupuesto: log nuevo
  `[Telnyx] No se pudo contestar llamada <id> del negocio <id> tras N intentos (<status> <código>): <mensaje>`,
  y `hangupCall` best-effort. Así el cliente oye que se corta en vez de tonos sin fin, y puede
  volver a llamar.
- **No cambia** la respuesta HTTP de la ruta (404 con `success: false`). La visibilidad la da la
  alerta de la PR 5, no el código de estado.
- **A comprobar en dev:** si Telnyx reenvía `call.initiated` tras un 404. Si lo hace, el lease
  de `claimVoiceWebhookEvent` (5 min) permite reclamarlo y reintentaría otra vez, lo que está
  bien mientras la llamada siga viva.
- **Tests:**
  - 503 → reintento → éxito.
  - `APIConnectionTimeoutError` → reintento.
  - 422 con voz → reintento sin voz, sin reintentos transitorios.
  - 404 o 422 sin voz → sin reintentos.
  - Presupuesto agotado → `hangupCall` y el log nuevo.
  - Ningún reintento tras colgar (comprobar `call.hangup` si llega entre medias: el `answer`
    devolverá 422 «already ended», que es un 4xx y corta).
- **Hecho cuando** pasen los tests y una prueba en dev con el adaptador forzado a 503 una vez
  conteste la llamada.

### PR 5. Alertas de voz (sobre todo operación; código mínimo)

Lo que ya existe, comprobado el 17-10 en `project-84381467-a606-4b71-a6e`:
- Uptime check de `/health` cada 60 s y su alerta.
- Alerta de más de 10 respuestas 5xx en 5 minutos.
- Alertas de cerrojos, de la cola de Cloud Tasks y del limitador local.
- Todas al canal `notificationChannels/3301523917747931516`.
- No hay métricas de logs creadas por nosotros.

**Métricas de logs nuevas** (`gcloud logging metrics create`):

| Métrica | Filtro (textPayload) | Alerta |
|---|---|---|
| `voz_contestar_fallido` | `"[Telnyx] No se pudo contestar"` (PR 4) OR `"[Telnyx] Error procesando inicio de"` | ≥ 1 en 10 min |
| `voz_webhook_fallido` | `"[Telnyx] No se pudo procesar el evento"` OR `"[Telnyx] Error procesando call."` | ≥ 3 en 10 min |
| `voz_negocio_sin_assistant` | `"sin assistant Telnyx operativo o suspendido"` (`console.warn`, webhookHandlers.ts:415) | ≥ 1 en 1 h, solo aviso: puede ser un impago legítimo |
| `whatsapp_entrega_fallida` | el `console.error` de `aplicarEfectosDeEntrega` (plantilla, negocio, destino, código) | ≥ 3 en 1 h |

- **Código mínimo:** un log `console.warn` en `cleanupZombieCalls` (cada 15 min) cuando haya
  llamadas `COMPLETED` de más de 30 min sin `outcome`, que es la señal de que no llegan los
  insights. Más su métrica `voz_sin_resultado` (≥ 2 en 1 h).
- Los comandos exactos van a AGENTS.md § Alertas (3553-3584), junto a los existentes: no hay
  IaC, y así se pueden repetir.
- **Fuera del código:** suscripción por email a `status.telnyx.com` para Europe
  (`sip.telnyx.eu`), API V2 y la voz de Europa. La hace el usuario, porque es su cuenta de correo.
- **Hecho cuando** cada alerta se haya disparado una vez a propósito en producción:
  `simular_webhook_telnyx` contra un número inexistente, para la de `call.initiated`, y los
  correos lleguen.

### PR 6. `fallback_destination`

Qué es: `TelephonySettings.fallback_destination` (SDK 7.24, `assistants.d.ts:2384-2392`). Es un
número o URI SIP al que Telnyx transfiere la llamada si la conversación con la IA acaba de forma
anómala. Según la documentación, no salta si el cliente cuelga, si el assistant termina
normalmente, si se detecta buzón o si ya se transfirió.

**Experimento previo en dev** (medio día, con un assistant temporal copiado del de dev y
borrado al acabar, según la regla de qué debe existir en Telnyx):
1. Provocar un fin anómalo, con un LLM inválido en un nodo, por ejemplo. Comprobar que transfiere
   y con qué caller ID sale la pata: el de Alhabla o el del cliente.
2. Comprobar que `end_call`, que cuelgue el cliente y una transferencia normal no la disparan.
3. Ver qué eventos llegan a nuestro webhook. ¿Llega `call.bridged`? ¿Cambia algo en
   `call.conversation.ended`? Así se adapta el informe de la llamada.

**Cambio:**
- En `lib/telnyxAssistantPayload.ts:866-900`, `telephonySettings.fallback_destination` toma
  `transferencia.destino` cuando la regla lo permita. `transferencia` es lo que ya resuelve
  `loadManagedAssistantConfig` (`telnyxAgentSync.ts:75-78`) y llega a `construirPayloadDeRecepcionista`.
- `destinoDeTransferencia` ya garantiza tres cosas: es un móvil o fijo español, nunca es la línea
  desviada a Alhabla (evita el bucle) y nunca es el número de Alhabla.
- Regla, decisión del usuario 2: por defecto, solo con `transferencia.modo !== "nunca"`.
- El tipo `TelephonySettingsInput` ya lo admite (hereda de `TelephonySettings`).

**Tests:**
- Instantánea del payload con y sin destino.
- Negocio con `pasarLlamadas = nunca` → sin el campo.
- Destino que sería la línea desviada → sin el campo.

**Despliegue:** el hash cambia y el reconciliador lo sube; después,
`lanzar_job_prod telnyx-reconciler` y `ver_assistant_telnyx` para confirmarlo.

**Hecho cuando** el experimento esté anotado aquí y los assistants de producción lo lleven.

### PR 7. STT de respaldo (puede no salir)

- El `GET` del assistant devuelve `transcription.fallback_models: null`, pero el SDK 7.24 no lo
  tipa.
- Hay que buscar en la documentación de Telnyx si existe para assistants y con qué valores (por
  ejemplo `["deepgram/nova-3"]` detrás de `deepgram/flux`, y qué respaldo admite Soniox).
  Después, probarlo con un `PATCH` sobre un assistant temporal de dev.
- Si se acepta, va al payload, con un cast tipado mientras el SDK no lo tenga.
- Si no se acepta, se anota aquí y se cierra.
- Del LLM de respaldo (Kimi-K2.6) hay que averiguar si deja rastro cuando salta, en
  `call.conversation.ended` o en los insights, para contarlo en `salud_llamadas`.

## 5. Riesgos

| Riesgo | Mitigación |
|---|---|
| Un alta nueva sin assistant o sin número activo entre la PR 1 y la PR 2 | La PR 1 lo arregla antes de tocar Retell. Comprobarlo con un alta real en dev sin `RETELL_API_KEY` |
| `comprobacionDesvio` o `recordarDesvioSinComprobar` pasan a incluir negocios que antes excluía el default `"retell"` | `recibeLlamadasPorTelnyx` exige número de Telnyx y `active`: es la condición que el default aproximaba. Un test por caso |
| El panel enseña un `systemPrompt` viejo al dejar de escribirlo `syncAgentToRetell` | Revisarlo en la PR 2. `syncAgentToTelnyx` lo escribe para todo agente con assistant |
| `PATCH /agents/:id` deja de propagar ediciones | La PR 2 añade `syncAgentToTelnyx` a esa ruta |
| Los reintentos del `answer` alargan la espera del cliente | Presupuesto de unos 6 s y timeout de 2,5 s por intento. Sin reintentos ante 4xx |
| `fallback_destination` llama al dueño cuando no lo espera | Solo con `pasarLlamadas ≠ nunca`, tras el experimento |
| Borrar en Retell algo que aún sirve (demo de la landing) | El inventario se cruza con producción y dev antes. La demo ya va por Telnyx (`alhabla-demo-*`) |

## 6. Esfuerzo estimado

| PR | Tamaño | Notas |
|---|---|---|
| 1 | S (½ día) | + prueba de alta en dev |
| 2 | L (2-3 días) | Unas 3.000 líneas fuera, ~1.000 editadas y la reescritura de AGENTS.md |
| W | XS | |
| 3 | S | + operación en Retell con permiso |
| 4 | S (½ día) | |
| 5 | S (½ día) | Sobre todo `gcloud` y AGENTS.md |
| 6 | M (1 día) | Medio día de experimento |
| 7 | XS-S | Puede quedarse en investigación |

## 7. Decisiones pendientes del usuario

Con la recomendación primero:

1. **Orden.** (a) PR 4 y PR 5 primero, porque protegen ya y no dependen de nada; después PR 1 →
   PR 2 + W → PR 3; la PR 6 y la PR 7 en paralelo cuando haya hueco (recomendado). (b) Retell
   primero.
2. **`fallback_destination`.** (a) Solo si el dueño aceptó que le pasen llamadas (recomendado);
   (b) siempre que haya un móvil válido.
3. **Cuenta de Retell.** (a) Baja tras la PR 3 (recomendado); (b) un mes más sin uso.
4. **Ruta de `answer` agotada.** (a) Colgar, para que el cliente note el corte y vuelva a llamar
   (recomendado); (b) dejarla sonar como hoy.

## Apéndice: el contestador, aparcado

La v1 proponía un contestador de Call Control sin IA: pulsa 1 WhatsApp, pulsa 2 o silencio para
mensaje de voz, y teclear el móvil solo con número oculto. Queda aparcado porque:
- cubre un fallo que no se ha visto;
- depende de la misma API de Call Control que falla en las incidencias reales;
- el chat al que derivaría usa el mismo assistant;
- `fallback_destination` cubre el caso parecido de la IA que falla a mitad de llamada.

Se retoma si las alertas de la PR 5 enseñan `answer` fallidos que la PR 4 no resuelve. El diseño
completo (gather con audios pregrabados en R2, `record_start`, el propósito de WhatsApp
`contestador` y la plantilla `llamada_contestador`) está en la v1 de este fichero, en el
historial de git (`PLAN-CONTESTADOR-TELNYX.md`, commit 930fc08).
