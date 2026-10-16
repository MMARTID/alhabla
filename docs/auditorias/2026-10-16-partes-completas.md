# Auditoría de las partes «terminadas» (16-10-2026)

Se eligieron las cuatro partes del backend que se dan por más hechas y completas: llevan semanas en
producción, tienen las baterías de tests más grandes y su documentación da el trabajo por cerrado.

| Parte | Código | Por qué se eligió |
|-------|--------|-------------------|
| Adaptadores de calendario | `adapters/calendar/` (Google, Outlook, CalDAV), `modules/calendar/`, `lib/microsoftGraph.ts` | Ciclo expand/contract cerrado (#75–#82), credenciales cifradas, CalDAV vivo en producción |
| Reserva por voz | `modules/voiceTools/service.ts` (`check_availability`, `book_appointment`), `lib/availability.ts`, `lib/bookingLock.ts` | El núcleo del producto; 3.600 líneas de tests solo del servicio |
| Ciclo de vida de una llamada Telnyx | `modules/webhooksTelnyx/`, `adapters/telnyx/webhookHandlers.ts`, `lib/voiceWebhookIdempotency.ts`, `jobs/cleanupZombieCalls.ts` | Firma única, idempotencia «una vez con éxito», todos los negocios en Telnyx |
| Estado temporal en Postgres | `lib/cerrojos.ts`, `lib/almacenTemporal.ts`, `lib/limitesDePeticiones.ts` | Recién migrado desde Redis (#277, #292) y vigilado 72 h |

Todo lo de producción se comprobó con datos reales (BD de solo lectura, Cloud Logging, peticiones).
**No se ha cambiado nada del backend**: cada hallazgo lleva su arreglo propuesto.

## Hallazgos

Severidad: **media** = puede dar un resultado equivocado a un cliente o perder datos; **baja** = caso
raro, mensaje engañoso o falta de rastro; **info** = deuda o nota para quien toque esto.

### Calendario

1. **Media, sin verificar en real. Outlook podría crear las citas 1-2 h antes.**
   `createMicrosoftCalendarEvent` (`lib/microsoftGraph.ts:366` y `:370`) manda la hora como ISO en UTC
   (`…T08:00:00.000Z`) **y** `timeZone: "Europe/Madrid"`. Microsoft no documenta qué hace Graph con esa
   mezcla y hay casos publicados de doble conversión; si toma la hora como de pared en Madrid, la cita
   queda desplazada. Nunca se ha ejercitado: hay 0 conexiones de Outlook en producción (1 CalDAV) y en
   dev (1 Google). Arreglo: `timeZone: "UTC"` (la hora ya va en UTC) y una prueba con una cuenta real.
2. **Baja. Lecturas de ocupación sin paginar.** Google pide `maxResults: 2500`
   (`GoogleCalendarProvider.ts:279`) y Outlook `$top=1000` (`microsoftGraph.ts:278`) sin seguir la página
   siguiente. Si se truncaran, `availability.ts` da por canceladas las citas locales cuyo evento no
   aparece (la reconciliación) y deja reservar encima. Con una ventana de ~4 h más la duración es
   improbable, pero la regla «si no está en lo leído, se canceló» exige leerlo entero.
3. **Baja. Google: un 404 al borrar depende del cuerpo del error.** `borrarEvento` mira `err.code`
   (`GoogleCalendarProvider.ts:423`). En gaxios 7 `code` sale del JSON de error de Google; un 404/410 sin
   ese cuerpo caería a `CANCEL_APPOINTMENT_FAILED`. Arreglo: `err.status ?? err.response?.status`.
4. **Baja. CalDAV registra zonas horarias en un registro global.**
   `ICAL.TimezoneService.register` (`caldav/ics.ts:156`) guarda cada `VTIMEZONE` en el proceso, compartido
   entre negocios: un objeto sin `VTIMEZONE` usaría la última zona con ese nombre que registró otro
   calendario. iCloud siempre la manda, así que el riesgo real es bajo.
5. **Info.** La guarda anti-SSRF dice que fijar el socket a la IP validada «con `fetch` no se puede»;
   con el `dispatcher` de undici (`connect.lookup`) sí, y cerraría el DNS rebinding.
6. **Info.** La normalización `Array.isArray(result) ? { intervals: result, calendarAvailabilityKnown:
   false } : result` está copiada en `voiceTools/service.ts:398`, `gestor/accionesAgenda.ts:409`,
   `whatsapp/listaDeEspera.ts:228` (y en otra forma en `gestor/buscarHueco.ts:93`).

### Reserva por voz

7. **Baja-media. Sin fila de llamada, `book_appointment` confirma una cita que no guarda.** Si no se
   resuelve la `Call` (`modules/voiceTools/service.ts`, bloques `if (call)` en `:1812` y `:1883`), crea el
   evento en el calendario, no guarda `Booking`, no pasa clave de idempotencia (un reintento duplica el
   evento) y responde «Cita agendada correctamente». Solo puede pasar con Retell (respaldo): con Telnyx la
   ruta responde 404 antes si no hay `Call`. En producción, 0 veces en 30 días (`no encontró la fila
   Call` / `no hay ninguna llamada asociada`). Arreglo: sin `call`, guardar como reserva pendiente en vez
   de crear el evento.
8. **Baja. Mensaje engañoso sin calendario.** Un negocio que nunca conectó calendario recibe
   `GOOGLE_CALENDAR_RECONNECT_REQUIRED` y «El negocio debe reconectar Google Calendar» (`:1544`), porque el
   proveedor se normaliza a Google. Hoy afecta a un negocio de producción sin número todavía.
9. **Baja. El cerrojo de reserva se mantiene durante los avisos.** Se libera en `:2198`, después del aviso
   al dueño por WhatsApp, el SMS de respaldo, los mensajes al cliente y el borrado del evento anterior.
   Mientras tanto, otra reserva del mismo negocio espera con un presupuesto de 6 s y, si no le llega,
   acaba en `BOOKING_LOCK_TIMEOUT` (reserva pendiente). Medido en producción (30 días, 20 reservas):
   `book_appointment` p50 2,0 s, p95 2,8 s, máximo 6,2 s. Arreglo: soltar el cerrojo en cuanto la reserva
   y el evento quedan guardados.

Lo que está bien hecho y se comprobó: la hora del borrador no se renormaliza (#271), la reserva vuelve
a comprobar todo sin fiarse de `check_availability`, el negocio sale siempre de la `Call` y nunca del
LLM, un calendario ilegible deja la reserva pendiente en vez de confirmarla a ciegas, y el evento
huérfano se deshace si falla el guardado.

### Ciclo de vida de una llamada

10. **Media. La transcripción se pierde en silencio si Telnyx aún no tiene los mensajes.**
    `handleCallConversationEnded` solo guarda si `messages.length > 0`
    (`adapters/telnyx/webhookHandlers.ts:629`). Con 0 mensajes no guarda nada, no deja log y el evento
    queda en `success`: nadie lo reintenta. Caso real encontrado con `salud_llamadas` + `traza_llamada`: la
    llamada `cmufcsz4b0006s601kncxcf5m` del 24-09 (34 s, `LEAD_CAPTURED`, conversación cerrada,
    grabación copiada) no tiene transcripción. 1 de 51 llamadas en 30 días. Arreglo: con 0 mensajes,
    log ruidoso y reintento diferido (un job o devolver error para que Telnyx reentregue).
11. **Baja. Fallos sin rastro en la idempotencia.** `completeVoiceWebhookEvent` traga su propio error
    (`lib/voiceWebhookIdempotency.ts:102`, `.catch(() => {})`), y cuando un handler devuelve
    `success: false` la fila queda en `error` **sin `lastError`**: los 6 eventos en error de producción
    no dicen por qué.
12. **Baja. `voice_webhook_events` no se puede cruzar con las llamadas ni se purga.** `callId` nunca se
    rellena para Telnyx, y la tabla no tiene purga (3.289 filas en 34 días con dos negocios; buena parte
    son tipos que ni se procesan, como `call.conversation.messages_added` o `call.playback.*`).
13. **Info.** La firma Ed25519 cubre el cuerpo y el timestamp, no las cabeceras
    `X-Alhabla-Call-Control-Id` / `X-Alhabla-Business`, que deciden el negocio. Explotarlo exige una
    petición firmada válida dentro del plazo, así que es teórico; conviene saberlo si se cambia el
    diseño.

### Estado temporal en Postgres

Sin hallazgos. Es la parte mejor documentada y probada: cada caso de fallo de conexión (P1017,
P2024, respuesta tardía) está pensado y medido, y la caché de voz guarda el sobre cifrado de las
credenciales, nunca el texto en claro.

## Qué costó auditar y qué se añadió al MCP

| Lo que costó | Herramienta nueva |
|--------------|-------------------|
| `ver_peticiones_prod` devolvió 176 filas (unos 25.000 tokens) cuando la pregunta era «¿cuánto tardan las tools?»: había que calcular percentiles a ojo | `latencias_prod`: peticiones agregadas por método y ruta (ids → `:id`), con estados y p50/p95/máx; `porRevision` compara antes y después de un deploy |
| La «salud» de las llamadas (transcripción, conversación, coste, grabación, zombis, webhooks en error, reservas pendientes) exigió escribir varias consultas con joins a mano | `salud_llamadas`: por día y en hora de Madrid, cuántas llamadas se quedaron sin cada pieza, con leyenda y ejemplos; ya descarta las que colgaron antes de contestar (coste 0) |
| Saber qué rama tomó una llamada obligaba a leer las 900 líneas de `executeBookAppointment` y adivinar el texto exacto de los logs para buscarlo | `traza_llamada`: fila, cita (calendario, profesional, servicios), reservas pendientes con su código, transcripción, grabación, llamadas solapadas, logs de la ventana y las peticiones a las tools mientras duró (prod: Cloud Logging; dev: `docker logs`, avisando si el contenedor es más nuevo que la llamada) |
| `bookings` y `leads` no tienen `businessId` (cuelgan de `calls`): la primera consulta falló, y saber qué proveedor de calendario usa cada negocio llevó tres consultas | `resumen_negocio`: suscripción, número, WhatsApp del dueño, calendarios (sin credenciales), agentes y su sincronización, equipo y actividad de 30 días; sin negocio, la lista |

Lo que no se puede resolver con el MCP: comprobar cómo responde de verdad un proveedor (el 404 de
Google, la zona horaria de Graph) exige una cuenta real de ese proveedor, y el worktree de cada sesión
no tiene `node_modules` hasta que se instala (para leer cómo construye gaxios sus errores hubo que ir
al checkout principal).
