# Plan: Agenda de Alhabla (reservar sin calendario externo)

Estado: **en curso** (28-10-2026; fase 0 hecha). Origen:
`docs/auditorias/2026-10-28-auditoria-de-producto.md` (hallazgo 2 y §3). Revisado contra el código el
28-10 (PR de la fase 0): las correcciones van marcadas con **[rev]**.

## Por qué

Hoy un negocio sin Google Calendar, Outlook ni iCloud conectado **no puede reservar**, y no se entera:

1. El alta deja saltarse el calendario sin avisar (`frontend/src/app/bienvenida/calendar/page.tsx:175`).
2. La recepcionista comprueba el hueco solo con la base de datos y ofrece la hora (`check_availability` funciona: `calendar/service.ts:517-523`, `lib/availability.ts`).
3. El cliente dice que sí, y `book_appointment` corta en `voiceTools/service.ts:1762`: no hay conexión operativa.
4. El cliente oye «El negocio debe reconectar Google Calendar» y la cita queda como `Lead` pendiente.
5. El dueño recibe «tu calendario estaba caducado».

La agenda (`/agenda`, por profesional, día, semana y lista) y el motor de huecos ya funcionan solo con
`Booking`. Lo que lo impide es una comprobación deliberada, «nunca reservar a ciegas», repetida en siete
sitios. Muchos salones apuntan en libreta, en Booksy o en Treatwell (sin API para nosotros), y no
quieren o no pueden conectar un calendario.

## Objetivo

Que un negocio pueda elegir **«Usar la agenda de Alhabla»** y, con eso:

- la recepcionista y el Gestor reservan, mueven y cancelan en nuestra base de datos;
- el dueño crea citas y bloqueos desde el panel o por WhatsApp;
- el dueño puede ver la agenda en el calendario de su móvil con un enlace de solo lectura;
- todo ello sin romper la regla de no reservar a ciegas para quien sí tiene un calendario externo.

## Lo que no es

- **No sincroniza en dos sentidos.** El feed iCal solo se lee; lo que el dueño apunte en su móvil no
  vuelve a Alhabla.
- **No importa calendarios ajenos** (Booksy, Treatwell). Eso queda como idea para después.
- **No es un programa de reservas online para el cliente final**: no hay página web de reservas.

## Principio de diseño: el modo se elige, no se deduce

`Business.modoDeAgenda` con tres valores:

| Valor | Significado | Quién lo pone |
|---|---|---|
| `sin_elegir` | Comportamiento actual con mensajes veraces (fase 0) | Por defecto en negocios sin calendario conectado |
| `alhabla` | Reserva solo en Alhabla | El dueño, en el alta o en `/agente` › Calendario |
| `externo` | Reserva en Google, Outlook o iCloud, con la regla de siempre | Automático al conectar un calendario |

Nunca se pasa a `alhabla` porque una conexión caduque. Un calendario caducado sigue bloqueando la
reserva, que es la regla de la auditoría de septiembre.

En la migración, los negocios con una `CalendarConnection` con credenciales pasan a `externo` y el
resto a `sin_elegir`.

## Fases

### Fase 0: que no engañe — HECHA (28-10)

- **`calendar/conexion.ts`:** `nuncaConectoCalendario(business)` (ninguna fila con credenciales ni
  rastro de `connected`, `disconnectedAt` o `lastError`) y `codigoDeCalendarioNoOperativo`, que
  devuelve `CALENDAR_NOT_CONNECTED` si nunca lo hubo y el `<P>_CALENDAR_RECONNECT_REQUIRED` del
  proveedor si caducó. **[rev]** La fase 0 no puede mirar `modoDeAgenda`, que no existe hasta la
  fase 1; y «sin fila» no bastaba: un Outlook a medias tiene fila con credenciales y una conexión
  revocada tiene fila sin ellas pero con `disconnectedAt`.
- **`voiceTools/service.ts`:**
  - `check_availability` **no ofrece hora** si no hay conexión operativa, ni nunca conectada ni
    caducada: devuelve `available: false` con ese código y una instrucción para que la recepcionista
    diga que toma nota, pida nombre y teléfono y **llame igualmente a `book_appointment`** sin
    `availabilityToken`. **[rev]** Sin esa llamada no habría `Lead` ni aviso al dueño: es
    `book_appointment` quien los crea (`capturePendingBookingLead`).
  - `book_appointment` guarda el `Lead` con ese mismo código y responde con un mensaje neutro («He
    tomado nota de la petición: el negocio se pondrá en contacto para confirmar la cita»), sin nombrar a
    Google ni a ningún calendario.
- **`whatsapp/avisosNegocio.ts`:** no hacía falta tocarlo: `motivoDeFallo` ya traducía
  `CALENDAR_NOT_CONNECTED` a «no tienes ningún calendario conectado»; lo que faltaba era que alguien lo
  escribiera. En la app, `lib/llamadas.ts` (`motivoDeCitaPendiente`) también lo distingue.
- **`frontend/src/app/bienvenida/calendar/page.tsx`:** tercera tarjeta «Apple / iCloud» con el
  formulario `AppleCalendarConnect` desplegado debajo, y el aviso bajo «Configurar calendario después»:
  «Sin calendario, tu recepcionista atiende y toma nota de las peticiones, pero no reserva citas».
- **`operational-status.tsx`:** la recepcionista pasa a «Atiende, pero no reserva» (aviso, con
  «Conectar agenda» o «Reconectar agenda») cuando no hay calendario conectado. Los estados más graves
  (impago, sin plan, inactiva) siguen mandando.
- **Web:** la FAQ «¿Qué pasa si se desconecta el calendario?» de `/integraciones` cuenta ahora el
  comportamiento real (toma nota con nombre y teléfono) y que pasa lo mismo sin calendario.
- **Tests:** `conexion.test.ts` (los dos predicados) y `voiceTools/service.test.ts` (los cinco casos:
  `check_availability` nunca conectado, caducado y conectado; `book_appointment` nunca conectado y
  caducado).
- **Sin efecto en la demo de la landing:** sus assistants `alhabla-demo-*` no tienen tools.

### Fase 1: el modo «Agenda de Alhabla» (5–7 días) **[rev: antes 3–4]**

**Datos**
- Migración aditiva: `Business.modoDeAgenda String @default("sin_elegir")`, con el relleno descrito
  arriba.
- **Opcional:** `Business.icalToken String? @unique` en la misma migración, para la fase 3.

**Backend**
- **`backend/src/lib/modoDeAgenda.ts` (nuevo):**
  - `reservaEnAlhabla(business)`;
  - `puedeReservar(business, conexion) = reservaEnAlhabla(business) || conexionOperativa(conexion)`;
  - `escribeEnCalendarioExterno(business, conexion) = !reservaEnAlhabla(business) &&
    usaCalendarioExterno(conexion)`. **[rev]** En modo `alhabla` la conexión que pudiera quedar de
    antes **se ignora del todo** para leer ocupación y crear eventos; si no, un negocio que pasa de
    `externo` a `alhabla` seguiría leyendo y escribiendo en Google, porque `usaCalendarioExterno` y
    `getBusyIntervals` solo miran la conexión. Cancelar o mover una cita antigua que sí tiene
    `externalEventId` sigue borrando su evento (ya está guardado por ese campo): lo que había en Google
    se limpia, lo nuevo no va a Google.

  Un único sitio con la regla. Los predicados de `calendar/conexion.ts` no cambian.
- **Sustituir `conexionOperativa` por `puedeReservar` donde decide si se puede reservar:**
  - `modules/voiceTools/service.ts` (`check_availability` de la fase 0 y `book_appointment`);
  - `modules/gestor/accionesAgenda.ts:387` (`añadir_cita` y `mover_cita`);
  - `modules/gestor/tools.ts:247` (contexto del Gestor). **[rev]** No basta con el predicado: el
    contexto tiene que decirle al Gestor que el negocio reserva en la agenda de Alhabla, o seguirá
    pidiendo al dueño que conecte el calendario;
  - `modules/gestor/buscarHueco.ts:84`;
  - `modules/whatsapp/listaDeEspera.ts:641`;
  - `jobs/retryFailedBooking.ts:293`;
  - `modules/bookings/citasDelPanel.ts` (mover desde el panel; `TEXTO_SIN_CALENDARIO` solo si el modo no
    es `alhabla`).
- **Crear la cita sin evento externo. [rev] Es el grueso de la fase, no una comprobación.** Los cinco
  caminos que reservan llaman a `calendarService.bookAppointment` **antes** de escribir el `Booking` y
  sin ninguna guarda; esa función empieza por `exigirConexionActiva(…, "reservar")`
  (`calendar/service.ts:559`) y lanza `<P>_CALENDAR_RECONNECT_REQUIRED` sin credenciales. Hay que
  desdoblar cada uno para que, con `escribeEnCalendarioExterno` en falso, guarden el `Booking` sin
  evento y con `externalEventId`, `externalCalendarProvider` y `externalCalendarId` a `null` (hoy
  `externalCalendarProvider` se rellena con el proveedor por defecto, «google», aunque no haya
  conexión):
  - `voiceTools/service.ts:2141` (y la lectura de ocupación de `:2036`);
  - `gestor/accionesAgenda.ts:642` (`añadir_cita`) y `:1035` (`mover_cita`);
  - `whatsapp/listaDeEspera.ts:728`;
  - `jobs/retryFailedBooking.ts:514` (y `:468`).
  Cancelar (`bookings/cancelacion.ts:126`) y la reconciliación de `lib/availability.ts:667` ya saltan
  las citas sin `externalEventId`: no hay que tocarlas.
- **`calendar/conexion.ts`:** al guardar una conexión nueva (`guardarConexionDeCalendario`), poner
  `modoDeAgenda = "externo"`. Ver la decisión D2 sobre las citas que ya existían. **[rev]** Un negocio
  `externo` cuya conexión se revoca sigue siendo `externo` (caducado, bloquea la reserva): nunca vuelve
  a `sin_elegir` ni pasa a `alhabla` solo.
- **`PATCH /business/me/agenda/modo`** (`preValidation: [fastify.authenticate]`, Zod,
  `request.user.businessId`):
  - pasar a `alhabla`, con confirmación de que se entiende el riesgo de doble reserva;
  - volver a `externo` solo si hay una conexión operativa.
- **Leads pendientes al cambiar de modo. [rev]** `retryFailedBooking` solo se encola para fallos
  transitorios (`enqueueRetryFailedBooking`), nunca para «sin calendario»: cambiar a `alhabla` **no**
  reserva solo las peticiones anotadas antes. Se quedan como citas pendientes en el panel para que el
  dueño las confirme (`pending-bookings/:id/resolver`). Conviene que el aviso de cita pendiente al
  dueño lleve el botón «Usar la agenda de Alhabla» (ver riesgo de `sin_elegir`).
- **`onboarding/routes.ts:191`. [rev]** El paso `calendar` del checklist se marca con
  `marcadaComoConectada`: en modo `alhabla` tiene que darse por hecho, o el checklist nunca termina.
- **`serializarBusiness`. [rev]** Debe exponer `modoDeAgenda` a la app (la usa `calendar-state.ts`).
- **Prompt y Telnyx:** no hace falta tocarlos. Las tools ya son genéricas
  (`backend/src/lib/telnyxAssistantPayload.ts:202`, `check_availability`) y no hay que volver a
  sincronizar los assistants. **[rev]** Aun así, medir con la receta de assistants temporales que la
  recepcionista sigue la instrucción de «toma nota» de la fase 0 y llama a `book_appointment`.

**Frontend (la app)**
- **Alta, paso del calendario:** una tercera tarjeta, «Usar la agenda de Alhabla», con el aviso «Tu
  recepcionista solo ve las citas que hay en Alhabla. Si apuntas citas en otro sitio, añádelas aquí o
  bloquea esas horas».
- **`frontend/src/lib/calendar-state.ts`:** estado `alhabla` (ni error ni aviso). Hay que ajustar con
  él:
  - la tarjeta «Conecta tu agenda» del panel (`escritorio/panel-escritorio.tsx:160-170`,
    `movil/inicio-movil.tsx:179-189`);
  - `operational-status.tsx`.
- **`/agente` › Calendario** (`movil/agente/calendario-movil.tsx`, también en escritorio): el modo
  actual, cambiar de modo y conectar un calendario externo.
- **Agenda** (`frontend/src/components/escritorio/agenda/`, **[rev]** no `components/agenda/`):
  - habilitar «Mover» en modo `alhabla` (`detalle-de-cita.tsx:157-177`, arrastrar en
    `agenda-escritorio.tsx:279-289`);
  - cambiar el texto «Solo las citas reservadas con Alhabla» (`agenda-escritorio.tsx:258`).
- **Alta:** la tarjeta «Usar la agenda de Alhabla» convive con las tres de la fase 0 (Google, Outlook,
  Apple). El aviso de «toma nota pero no reserva» se queda solo para «Configurar calendario después».

**Tests**
- Hay 44 referencias a `*_CALENDAR_RECONNECT_REQUIRED` en 10 ficheros.
- Añadir los casos del modo `alhabla` en voz, chat, Gestor, lista de espera y reintentos, más los de
  integración contra Postgres.
- Casos que tienen que fallar:
  - un negocio `externo` con el calendario caducado sigue sin reservar;
  - un negocio `alhabla` nunca llama a un adaptador de calendario.

### Fase 2: crear desde el panel (2–3 días; «Nueva cita» y «Bloquear» entran en el MVP)

Sin «Nueva cita», el modo `alhabla` acaba en dobles reservas: el dueño necesita apuntar lo que entra
por otros canales.

- **`POST /business/me/bookings`** en `modules/bookings/citasDelPanel.ts`:
  - reutiliza `prepararCita`, `comprobarHueco` y la `Call` sintética del Gestor
    (`gestor/accionesAgenda.ts:497-560`; hace falta porque `Booking.callId` es obligatorio y único);
  - prefijo propio en `lib/citasDelDueno.ts` y `createdVia: "owner_panel"`;
  - valida el profesional, el servicio y el hueco con el mismo motor;
  - **sin aviso al cliente en el MVP. [rev]** La confirmación sale por la plantilla `confirmacion_cita`
    (hoy reclasificada como marketing, número en el nivel de 250 conversaciones), y una cita que
    apunta el dueño es para alguien que no ha hablado con Alhabla ni ha dado permiso. Solo si existe
    `ClienteDelNegocio` con permiso previo; si no, nada.
- **Bloquear franja y marcar ausencia desde el panel:**
  - `POST` que reutilicen las comprobaciones de `bloquear_franja` y `marcarAusencia`;
  - hoy las ausencias solo se ven y se borran desde el panel (`bookings/routes.ts:305, 327`).
- **Interfaz:**
  - botón «Nueva cita» en la agenda;
  - crear pulsando un hueco vacío de la cuadrícula (`semana.tsx` y la vista Día);
  - hoja «Nueva cita» en el móvil (`movil/agenda-movil.tsx`).
- Funciona **en cualquier modo**: en `externo` también escribe el evento en el calendario.

### Fase 3: feed iCal de solo lectura (1,5–2 días)

- **`Business.icalToken`**, creado al activarlo y que se pueda cambiar.
- **`GET /agenda/:token.ics`:**
  - público, sin JWT y con límite de peticiones;
  - busca el negocio **solo por el token**, nunca por un `businessId` en la URL;
  - ventana de −30 a +120 días;
  - UID estable `${booking.id}@alhabla.ai`, y las canceladas recientes con `STATUS:CANCELLED`;
  - `?pro=<id>` para un feed por profesional (**[rev]** filtrado también por `businessId`: un id de
    otro negocio devuelve el feed vacío, nunca sus citas);
  - datos mínimos: servicio y nombre del cliente, **sin teléfono**;
  - **[rev]** las ausencias y bloqueos (`ProfessionalAbsence`) salen como «Bloqueado»; las canceladas,
    solo las de los últimos 30 días; el token tiene 32 bytes aleatorios y se compara tal cual por el
    índice único; el límite de peticiones es el `strictRateLimit` de las rutas públicas de `auth`;
  - cabeceras `noindex` y `Cache-Control` corto.
- **Generador:** ampliar `adapters/calendar/caldav/ics.ts` (`construirIcs`) a un VCALENDAR con varios
  eventos.
- **Interfaz en `/agente` › Calendario:**
  - «Ver tu agenda en el móvil»;
  - copiar el enlace, `webcal://` para el iPhone, instrucciones de «Añadir por URL» en Google;
  - «Cambiar enlace».
- **Límite a explicar:** Google refresca los calendarios suscritos cada varias horas, y no se puede
  forzar.

### Fase 4: textos y web (0,5 día)

- **Planes y portada:** «Reserva en Google, Outlook, iCloud **o en la agenda de Alhabla**»
  (`web/src/lib/plans.ts:35`, `components/planes-detalle.tsx:26`, `lib/home-faqs.ts:30-31`). `plans.ts`
  es una copia compartida: hay que cambiarla en las dos webs.
- **FAQ nueva** en las páginas de sector y en `/integraciones`: «¿Necesito conectar un calendario?».
- **`AGENTS.md`:** sección de calendarios y modo de agenda. Actualizar la memoria de las tools, que
  está obsoleta.

## MVP y orden

| Orden | Qué | Días |
|---|---|---|
| 1 | Fase 0 completa (fusionada sola) | hecha |
| 2 | Fase 1 | 5–7 |
| 3 | «Nueva cita» y «Bloquear» de la fase 2 | 1,5–2 |
| 4 | Fase 3 | 1,5–2 |
| 5 | Fase 4 | 0,5 |
| | **MVP** | **≈ 9–11** **[rev: antes 7–8]** |
| Después | Resto de la fase 2 (ausencias desde el panel, hoja del móvil completa) y extras | 2–4 |

**Extras para después:**
- al conectar Google o Outlook, volcar las citas futuras de la agenda propia (≈ 1 día);
- importar un `.ics` ajeno como horas ocupadas (1,5–2 días; falta comprobar qué programas lo exportan).

## Cómo se comprueba

- **Unitarios e integración:** los de cada fase, con la suite de integración sin otra a la vez (ver la
  memoria de la infra de tests).
- **De punta a punta en dev:**
  1. Negocio de prueba en modo `alhabla`, sin conexión de calendario.
  2. Llamada simulada (`simular_webhook_telnyx` del MCP alhabla-dev) que reserve, mueva y cancele.
  3. `añadir_cita` por el Gestor, y «Nueva cita» y «Mover» en el panel.
  4. El feed suscrito en Google Calendar y en el iPhone.
- **Regresión:** negocio `externo` con el token revocado; tiene que seguir guardando el `Lead` y no
  reservar.

## Riesgos

- **Dobles reservas:** la IA solo ve lo que hay en Alhabla. Se mitiga con:
  - el aviso al elegir el modo;
  - «Nueva cita» y «Bloquear» a un toque;
  - «apunta a Javier el viernes a las 7» por WhatsApp al Gestor, que ya existe.
- **Cambiar de modo:**
  - de `alhabla` a `externo`, las citas antiguas no están en Google (ver el extra del volcado);
  - de `externo` a `alhabla`, se pierden las horas ocupadas de lo que no reservó Alhabla.
- **Privacidad del feed:**
  - la URL equivale a una contraseña, lleva nombres de clientes y Google la copia a sus servidores;
  - se mitiga con datos mínimos, un enlace que se puede cambiar y el aviso en la interfaz;
  - mencionarlo en la política de privacidad.
- **Producto:** Alhabla se acerca a ser un programa de reservas. Hay que decidir el mensaje
  comercial.
- **`sin_elegir` como estado permanente. [rev]** Quien se salta el paso del alta se queda en «atiende,
  pero no reserva» indefinidamente y nada vuelve a preguntárselo. Mitigación: el estado operativo del
  panel (fase 0), la tarjeta del alta (D1) y, en la fase 1, el botón «Usar la agenda de Alhabla» en el
  aviso de cita pendiente al dueño.

## Decisiones abiertas (con recomendación)

| # | Decisión | Recomendación |
|---|---|---|
| D1 | ¿Ofrecer la agenda de Alhabla en el alta, o solo después en `/agente`? | En el alta, como tercera tarjeta: es donde se abandona |
| D2 | Al conectar un calendario estando en `alhabla`, ¿volcar las citas futuras al calendario? | Sí, pero en una segunda entrega; mientras tanto, avisar |
| D3 | ¿Feed iCal dentro del MVP? | Sí: es lo que hace que el dueño no eche de menos su calendario |
| D4 | ¿La «Nueva cita» del panel avisa al cliente por WhatsApp? | **[rev]** No en el MVP: solo si existe `ClienteDelNegocio` con permiso previo (plantilla de marketing, nivel 250, sin consentimiento) |
| D5 | ¿Feed por profesional? | Sí (`?pro=`), cuesta poco y cada trabajador ve lo suyo |
| D6 | Nombre visible del modo | «Agenda de Alhabla» |
