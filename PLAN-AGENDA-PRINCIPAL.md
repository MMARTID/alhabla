# Plan: la agenda de Alhabla como agenda principal

Estado: **fases 1 a 3 en curso** (backend, rama `feat/agenda-principal-backend`, 06-11-2026). Las
correcciones al implementarlo van marcadas con **[rev]**. Sustituye el «principio de diseño» y los tres modos de
`PLAN-AGENDA-ALHABLA.md`; lo que ese plan construyó (crear citas desde el panel, bloqueos, ausencias, feed
iCal) se queda tal cual y pasa a ser de todos los negocios.

## Por qué

Hoy la agenda de Alhabla es una opción más entre Google, Outlook y Apple: el dueño elige un **modo**
(`sin_elegir`, `alhabla` o `externo`, `backend/src/lib/modoDeAgenda.ts`) y la conducta cambia mucho según
lo que elija. Por dentro, sin embargo, Alhabla ya es la agenda de todos:

- **Toda cita es un `Booking` en Postgres**, también en modo `externo`; Google recibe una copia del evento.
- **La ocupación ya suma las dos cosas**: las citas de Alhabla y lo ocupado del calendario externo
  (`lib/availability.ts`, `calendarService.getBusyIntervals`).

Lo que sobra es la elección, y cuesta caro:

1. **El alta para en un paso que no hace falta.** Quien no elige se queda en `sin_elegir`: atiende pero
   no reserva, a veces para siempre (riesgo apuntado en `PLAN-AGENDA-ALHABLA.md`).
2. **Una contraseña caducada cuesta citas.** En `externo`, si Google caduca o no responde, la recepcionista
   deja de reservar y todo queda como `Lead` pendiente hasta que el dueño reconecta.
3. **En `alhabla`, un Google conectado se ignora del todo**: ni copia ni bloqueo.
4. **El relato no se entiende**: «¿llevo la agenda en Alhabla o en Google?» es una pregunta que el dueño no
   debería tener que contestar.

## Decisiones tomadas (06-11-2026, con el fundador)

| # | Pregunta | Decisión |
|---|---|---|
| D1 | ¿Agenda principal? | **La de Alhabla.** Google, Outlook y Apple son complementos de ella |
| D2 | Conexión caducada | **Sigue reservando** en Alhabla y avisa al dueño por WhatsApp de que no ve lo que apunte en su calendario hasta que reconecte |
| D3 | Caída breve (Google caído o lento, no caducado) | **Reserva igual y copia después**: la copia se reintenta sola |
| D4 | Alta sin calendario | **Reserva desde el primer día.** Desaparece `sin_elegir`; el alta pregunta «¿llevas la agenda en otro sitio?» |
| D5 | Cambios hechos en Google | **No vuelven a Alhabla.** Lo que se apunte allí solo ocupa el hueco; las citas se cambian en Alhabla (panel o WhatsApp) |
| D6 | Título de `/integraciones` | **«La agenda viene incluida. Tu Google Calendar, si lo usas, también.»** |
| D7 | Punto fuerte que sustituye a «no reserva a ciegas» | **«Siempre disponible, hagas lo que hagas»**, con la escena de las manos ocupadas |
| D8 | Paso 2 de «Así se pone en marcha» | **«Tu agenda ya viene puesta»** |
| D9 | Pastilla de la portada | **«Tu agenda en WhatsApp»** |
| D10 | FAQ de la portada y de los sectores | **«¿Dónde veo mis citas?»**, en lugar de «¿Necesito conectar un calendario?» |
| D11 | Google, Outlook y Apple en las páginas de venta | **Una franja de iconos con subtítulo**, al estilo de otras plataformas; nunca título, FAQ ni fila propia |
| D12 | Tono | **Fase de marketing con toque humano** (fase 5): a quien viene a quitarse faena no se le habla de si Google se cae; se venden funciones, con la agenda por WhatsApp delante |

D2 y D3 revierten a propósito la regla de la auditoría de septiembre («nunca reservar a ciegas», ver
`docs/auditorias/` y AGENTS.md § Modo de agenda). Lo que no cambia: cada hueco se sigue comprobando contra el
horario, los festivos, las ausencias, la capacidad y las citas de Alhabla, bajo el cerrojo por negocio. Lo
que se acepta es no ver, durante un rato, lo que el dueño apunte a mano en su calendario.

## El modelo nuevo, en cinco reglas

1. **Siempre se puede reservar.** `puedeReservar` deja de depender del calendario. Solo lo paran lo de
   siempre: plan, pago, horario, ausencias, capacidad y hueco ocupado.
2. **La ocupación son las citas de Alhabla, más lo ocupado del calendario si se puede leer.** Si no se puede
   leer (caducado o caído), se reserva con lo que se sabe y el aviso al dueño lo cuenta (regla 5).
3. **Primero la cita, después la copia.** En los cinco caminos que reservan (voz y chat, tu asistente, lista
   de espera, reintento y panel) se escribe el `Booking` y **después** se crea el evento en el calendario.
   Si la copia falla, la cita está confirmada igual y la copia queda pendiente y se reintenta. Mover y
   cancelar siguen el mismo orden: Alhabla primero; el evento, después.
   **[rev]** Implementado como «la copia se intenta dentro de la reserva, pero nunca la para»
   (`intentarCopiaDeLaCita`, que no lanza): el orden de escritura de cada camino se queda como estaba (evento
   y luego `Booking`), así se conservan la idempotencia y la limpieza del evento si el `Booking` no se guarda.
   Lo que cambia es que un fallo del calendario ya no deja la reserva pendiente: el `Booking` se guarda
   siempre. Una cita que se mueve y cuya copia nueva no entra conserva su evento viejo con la copia
   `pendiente`, y el job lo sustituye.
4. **Un solo sentido.** Lo que el dueño apunte en Google ocupa el hueco. Las citas de Alhabla que el dueño
   borre o mueva en Google **siguen en Alhabla, a su hora**: la cita de Alhabla bloquea siempre su hueco, y el
   evento movido bloquea además el sitio nuevo. Así nunca se libera un hueco por error. El evento lleva una
   línea que lo explica: «Esta cita la gestiona Alhabla: muévela o cancélala desde el panel o por WhatsApp».
5. **El dueño se entera, una vez y sin ruido.** Al detectar que el calendario se ha desconectado, sale la
   alerta por WhatsApp (ya existe, una vez al día, `alertarCalendarioDesconectado`) con texto nuevo; el
   panel lo enseña en el estado de la recepcionista y en Calendario. Las caídas breves no avisan: solo si
   una copia lleva más de una hora pendiente.
   **[rev]** El aviso de copias pendientes sale al cuarto intento (≈ 36 min), una vez al día por negocio.

## Lo que no es

- **No sincroniza en dos sentidos** (D5). Detectar en Google una cita de Alhabla movida o borrada y preguntar
  al dueño queda para «Después».
- **No importa calendarios ajenos** (Booksy, Treatwell, Fresha: sin API). Siguen las ideas de importar un
  `.ics` como horas ocupadas, para después.
- **No es una página de reservas online** para el cliente final.

## Fases

### Fase 1: reservar siempre (backend, el grueso)

**Conexión resuelta** (`modules/calendar/conexion.ts`):
- `resolverConexionDeCalendario` deja de mirar `modoDeAgenda`: desaparece `agendaPropia` y las credenciales
  de la conexión se usan siempre que existan.
- `puedeReservar(c)` pasa a ser verdadero siempre (y se quita en cuanto no quede quien la llame);
  `conexionOperativa` queda para decidir **si se copia y si se lee ocupación**, que es su sentido.
- `codigoDeCalendarioNoOperativo` y `nuncaConectoCalendario` dejan de decidir reservas; siguen sirviendo para
  el texto del aviso.
- `guardarConexionDeCalendario` deja de escribir `modoDeAgenda`; `cambiarModoDeAgenda` y
  `PATCH /business/me/agenda/modo` desaparecen (`businesses/routes.ts`).

**Reservar** (los cinco caminos de `PLAN-AGENDA-ALHABLA.md`, reordenados según la regla 3):
- `modules/voiceTools/service.ts`:
  - `check_availability` (`:783`): fuera la salida «toma nota» de la fase 0; ofrece hora siempre que el
    hueco esté libre.
  - `book_appointment` (`:2348`, `:2696`, `:2806`, `:3140`):
    - fuera los tres caminos que hoy guardan un `Lead` por el calendario: sin conexión, `CALENDAR_UNAVAILABLE`
      y error al crear el evento;
    - el `Booking` se escribe dentro del cerrojo y la copia se encola después;
    - el `Lead` pendiente queda solo para los fallos que no son del calendario (cerrojo, error inesperado
      antes de escribir la cita).
  - La caché de voz (`:460`) acepta la entrada siempre.
- `modules/gestor/accionesAgenda.ts`: `añadir_cita` (`:388`, `:643`) y `mover_cita` (`:1080`). El «Hecho» deja
  de distinguir agenda propia (`:787`).
- `modules/whatsapp/listaDeEspera.ts` (`:642`, `:729`).
- `modules/bookings/citasDelPanel.ts`: fuera `TEXTO_SIN_CALENDARIO`.
- `jobs/retryFailedBooking.ts`: queda para los `Lead` que ya existen; deja de esperar al calendario
  (`esperarAlCalendario`) porque ya no hace falta.

**Ocupación** (`lib/availability.ts`, la reconciliación de `reconciledLocalBookings`):
- Hoy una cita de Alhabla cuyo evento desaparece de Google **se libera**, y una movida en Google bloquea a la
  hora nueva en lugar de a la suya.
- Pasa a la regla 4: la cita de Alhabla bloquea siempre a su hora. El evento externo con su
  `externalEventId` se descarta solo si coincide en hora; si no, bloquea también.
- Las canceladas siguen sirviendo para descartar sus restos en Google, como hoy.

**Contexto de tu asistente** (`modules/gestor/tools.ts:251`): siempre «agenda de Alhabla», más el estado del
calendario conectado («copia en Google Calendar, al día» o «sin ver Google Calendar desde el martes»).

**Alta** (`modules/onboarding/routes.ts:198`): el paso `calendar` del checklist se da siempre por hecho.

**Datos:** `Business.modoDeAgenda` deja de leerse en esta fase (`@ignore`) y se borra en la fase 7, con
otro deploy (receta de la retirada de Retell: el deploy migra antes del cambio de tráfico).
**[rev]** Sin `@ignore` todavía: la columna se sigue leyendo y escribiendo solo para que la app anterior no
cambie de cara entre el despliegue del backend y el de la fase 4, y lo mismo `PATCH /business/me/agenda/modo`.
Ninguno decide ya nada. Se quitan en la fase 7. `checkAvailability` conserva `calendarAvailabilityKnown` y
`calendarOrigin` como parámetros sin efecto, por la misma razón (fase 7).

### Fase 2: la copia en el calendario

**Datos** (migración aditiva en `Booking`):
- `copiaEnCalendario String?`:
  - `null`: no había calendario al reservar;
  - `pendiente`, `hecha` o `fallida`.
- `copiaIntentos Int @default(0)` y `copiaError String?`.

**Job `copiarCitaAlCalendario`** (`jobs/`, por Cloud Tasks en producción y en línea en dev).
**[rev]** Vive en `modules/calendar/copiaDeLaCita.ts` (`sincronizarCopiaDeLaCita`, ruta
`/internal/jobs/copiar-cita-al-calendario`), y va con el volcado (`/volcar-agenda-al-calendario`) y el
recordatorio (`/recordar-calendario-desconectado`) por la cola existente `retry-failed-booking`: los tres
programan sus propios reintentos con `scheduleTime`, así que no hace falta cola ni Scheduler nuevos.
- Crea, mueve o borra el evento de una cita, con la idempotencia que ya tiene `crearEvento` (clave por
  `booking.id`).
- Reintentos con espera creciente durante 48 h.
- Con la conexión caducada no gasta intentos: espera a que vuelva.
- Al agotarse, deja `fallida` con un `console.error` con todos los identificadores (regla de log ruidoso).

**Volcado al conectar** (antes era un extra; ahora es parte del MVP):
- Al conectar o reconectar un calendario, se copian las citas futuras de Alhabla que no tengan evento en
  ese calendario, `pendiente` incluidas. **[rev]** También las `fallida`. Las que ya tienen evento en otro
  calendario (el negocio cambió de proveedor) se quedan donde están. 150 por pasada; si hay más, se encola
  otra.
- Así, conectar Google enseña la agenda entera, y reconectar pone al día lo que entró mientras no se veía.

**Texto del evento** (`adapters/calendar/eventoDeCalendario.ts`): la línea de la regla 4, con el enlace a
la cita en el panel.

**Reconciliador:** un pase del Scheduler (cada hora, o el `telnyxReconciler` existente si encaja) busca
copias pendientes de más de una hora y avisa al dueño una vez (regla 5).
**[rev]** No hace falta: avisa el propio job de copia en su cuarto intento.

### Fase 3: avisos al dueño

- **Alerta de calendario desconectado** (`whatsapp/mensajes.ts:577`, `alertaCalendario`). Hoy dice «las
  citas se guardan como pendientes y no entran en tu agenda», que deja de ser verdad. El texto nuevo sigue
  el tono de la fase 5 (ver «Textos de la app»).
- **Recordatorio a los 7 días sin reconectar:** pregunta si sigue usando ese calendario, con dos botones,
  «Reconectar» y «Ya no lo uso». El segundo quita la conexión y deja de avisar.
  **[rev]** Sin botones: sale por la misma alerta operativa (plantilla `alerta_operativa_negocio`, que solo
  lleva el botón «Ir a Ajustes»), y el texto le dice que, si ya no lo usa, lo quite en Agente › Calendario.
  Lo programa la propia alerta de desconexión como una tarea diferida de 7 días, y no dice nada si para
  entonces reconectó o se volvió a caer en otro momento.
- `avisosNegocio.motivoDeFallo` conserva los códigos de calendario para los `Lead` antiguos; ningún camino
  nuevo los escribe.
- La plantilla de WhatsApp de esta alerta (si la hay aprobada en Meta) necesita texto nuevo y una nueva
  aprobación: revisarlo antes de desplegar. **[rev]** No hace falta: `alerta_operativa_negocio` recibe el
  texto como parámetro.

### Fase 4: la app

- **`frontend/src/lib/calendar-state.ts`:**
  - fuera `mode` y `alhabla`; `bookable` siempre verdadero;
  - nuevo estado del **complemento**: `ninguno`, `al_dia`, `sin_ver` (caducado) o `copias_pendientes`.
  - Lo usan `operational-status.tsx`, `escritorio/panel-escritorio.tsx`, `movil/inicio-movil.tsx`,
    `escritorio/agente/agente-escritorio.tsx`, `movil/agente-movil.tsx`, `movil/agenda-movil.tsx`,
    `movil/hoja-cita.tsx` y `escritorio/agenda/*`.
- **Alta, paso del calendario** (`app/bienvenida/calendar/page.tsx`). En vez de «¿dónde llevas tu agenda?»
  con cuatro tarjetas, el paso pregunta si ya hay citas apuntadas en otro sitio, con tres salidas (textos en
  la fase 5):
  - en Google Calendar, Outlook o el iPhone → conectar (las tres tarjetas de hoy);
  - en papel o en otro programa → abre «Nueva cita» y «Bloquear horas» para apuntar lo que ya tiene, con
    la sugerencia de bloquear los días llenos;
  - no, empieza con Alhabla → siguiente paso.
- **`/agente › Calendario`** (`movil/agente/calendario-movil.tsx` y su versión de escritorio):
  - arriba, «Tu agenda: Agenda de Alhabla» (fija, sin botón de cambiar);
  - debajo, «Tu calendario conectado» con su estado y acciones (conectar, cambiar de calendario,
    reconectar, quitar);
  - al pie, el feed «Ver tu agenda en el móvil», como hoy. Fuera la confirmación de cambio de modo.
- **Estado de la recepcionista:** fuera «Atiende, pero no reserva». Con el calendario sin ver, un aviso suave
  con «Reconectar» (texto en la fase 5).
- **Agenda:**
  - «Mover», arrastrar y «Nueva cita», siempre;
  - fuera el texto «Solo las citas reservadas con Alhabla» (`agenda-escritorio.tsx`);
  - en el detalle de una cita, una línea discreta cuando la copia está pendiente o falló.
- **`lib/api.ts` y `lib/types.ts`:** fuera la llamada de cambiar modo y el campo.

### Fase 5: marketing con toque humano

**Por qué es una fase aparte.** Las primeras propuestas (las del fundador y las mías) contaban la técnica:
«si tu calendario se desconecta», «caduque tu contraseña», «conectado a tu Google, Outlook o iCloud». Quien
llega a la web viene a quitarse faena, no a pensar en qué pasa si Google se cae. Esta fase reescribe todos
los textos visibles del cambio, en la web y en la app, con cuatro reglas.

**Las cuatro reglas del tono**

1. **Se vende la faena que se quita, nunca la técnica.** En las páginas de venta no se habla de caídas,
   contraseñas, conexiones ni «si falla». Eso existe y se cuenta con honestidad, pero en su sitio: en
   `/integraciones` y en las guías de cada calendario, para quien lo busca.
2. **La agenda se enseña en WhatsApp**, con frases que diría la dueña: «¿qué tengo mañana?», «apúntame a
   Javier el viernes a las siete», «bloquea el jueves por la tarde», «mañana falta Marta». La agenda no es una
   pantalla más: es algo que lleva en el bolsillo y a lo que habla.
3. **Funciones antes que compatibilidad.** En la portada, los sectores y los planes, Google Calendar,
   Outlook y Apple solo aparecen en una franja de iconos con subtítulo (abajo), nunca como título, FAQ ni
   fila propia.
4. **Escenas, no promesas.** Las manos ocupadas, la cabina, la camilla, la hora de comer. Sin cifras
   inventadas ni prueba social (PRODUCT.md § Evidence on Hand).

**De dónde sale la franja de iconos** (revisado el 06-11-2026 en las webs de cada uno):
- **Calendly:** casi al final, «Connect Calendly with your favorite tools», un subtítulo de una línea y una
  rejilla de logos, cada uno enlazado a su página de integración, con «View all integrations».
- **Setmore:** «It's all about connecting», con cada logo acompañado de una línea de lo que ganas.
- **Cal.com:** ni siquiera tiene sección: una viñeta, «All your favorite apps», dentro de las funciones.
- **Fresha:** no enseña integraciones en su página de ventas. Vende el «calendario inteligente» como
  función propia, que es justo lo que pasa a ser la agenda de Alhabla.

Lo que se toma: una franja discreta, logos enlazados a su guía, un subtítulo humano y un «Ver
integraciones» para quien quiera más.

**La franja «Funciona con lo que ya usas»** (componente nuevo en `web/src/components/`):
- **Subtítulo:** «Tu número de siempre, tu WhatsApp y tu calendario, si llevas uno. No tienes que cambiar
  nada.»
- **Cinco iconos con etiqueta corta, cada uno enlazado:**
  - «Tu operador» → `/desvio-de-llamadas`;
  - WhatsApp → `/agenda-por-whatsapp`;
  - Google Calendar, Outlook y Calendario de Apple → sus guías.
- Al final, «Ver integraciones» → `/integraciones`.
- **Dónde:**
  - en la portada, justo después de «Así se pone en marcha»;
  - en las landings de sector, en el mismo sitio;
  - en `/planes`, bajo las tarjetas, sin título y con «En todos los planes».
- **Iconos:** se mueven de `app/integraciones/iconos-de-calendario.tsx` a `components/` y se añade el de
  WhatsApp. Cada enlace lleva `data-evento="clic_franja_integraciones"` para medir si alguien los usa.
- Nunca Telnyx ni ningún proveedor interno.

**Páginas de venta**

| Sitio | Hoy | Nuevo | Estado |
|---|---|---|---|
| Portada, pastilla (`main-landing.tsx:95`) | «Con tu calendario o sin él» | **«Tu agenda en WhatsApp»** | elegido |
| Punto fuerte (`puntos-fuertes-section.tsx:28`) | «Si tu calendario falla, no reserva a ciegas» | **«Siempre disponible, hagas lo que hagas»**: «Estés cortando, con alguien en la camilla o comiendo: ella coge el teléfono, da la hora y te deja la cita apuntada. Tú lo miras en WhatsApp cuando tengas un hueco.» Icono: un reloj o un teléfono en lugar de `CalendarX2` | elegido |
| FAQ de la portada (`home-faqs.ts:19`) y de los ocho sectores (`lib/sectores/*.ts`) | «¿Necesito conectar un calendario?» | **«¿Dónde veo mis citas?»**: «En WhatsApp: pregúntale “¿qué tengo mañana?” y te lo dice, o “apúntame a Javier el viernes a las siete” y lo apunta. También en el panel y en el calendario de tu móvil. Y si ya usas Google Calendar, Outlook o el iPhone, también aparecen ahí.» | elegido |
| Paso 2 de «Así se pone en marcha» (`en-marcha-section.tsx:20`) | «Eliges dónde van las citas» | **«Tu agenda ya viene puesta»**: «Desde la primera llamada, cada cita queda apuntada. La ves en el panel, en el calendario del móvil y en WhatsApp, donde también se la pides: “apúntame a Javier el viernes a las siete”.» | título elegido; texto propuesto |
| Planes, línea (`plans.ts:34`, las dos copias) | «Reservas en tu calendario de Google, Outlook o iCloud, o en la agenda de Alhabla si no usas ninguno» | «Tu agenda en WhatsApp, en el panel y en el móvil» | propuesto |
| Planes, resumen (`plans.ts:30`) | «… · reservas en tu calendario o en la agenda de Alhabla · …» | «3 profesionales · tu agenda en WhatsApp · 200 minutos incluidos» | propuesto |
| Tabla de planes (`planes-detalle.tsx:28`) | «Reserva en Google, Outlook, iCloud o en la agenda de Alhabla» | «Tu agenda en WhatsApp, el panel y el móvil»; la compatibilidad, en la franja bajo la tabla | propuesto |
| Maqueta del panel (`en-tu-negocio.tsx:442`) | «Agenda · Google Calendar» | «Agenda · 6 citas hoy» | propuesto |
| `/agenda-por-whatsapp` | La agenda es una petición más | «Lo que le puedes pedir» empieza por la agenda (las cuatro frases de la regla 2), y la tarjeta relacionada «¿Tengo que cambiar de agenda?» pasa a «Funciona con lo que ya usas» → `/integraciones` | propuesto |
| `/sobre-alhabla:90` | «Nunca reserva a ciegas: si no puede comprobar tu agenda, no da la hora» | «Nunca se inventa un hueco: mira tu horario, tu equipo y tus citas antes de dar una hora» | propuesto |
| `/novedades` | — | «Tu agenda, desde la primera llamada»: «Ya no hay que elegir dónde van las citas. Entran en tu agenda desde el primer día y la llevas por WhatsApp. Si usas Google Calendar, Outlook o el iPhone, también las ves ahí.» | propuesto |

**Páginas de compatibilidad** (`/integraciones` y las tres guías). Aquí sí se explica todo, con el mismo tono
y sin dramatizar:
- **Título** (D6, elegido): «La agenda viene incluida. Tu Google Calendar, si lo usas, también.»
- **Descripción:** «Tu recepcionista reserva en tu agenda de Alhabla desde el primer día. Si llevas las
  citas en Google Calendar, Outlook o el iPhone, conéctalo y las verás también ahí.»
- **Entradilla:** «¿Tienes que cambiar de agenda? No, y tampoco tienes que elegir. Tu agenda viene puesta; tu
  Google Calendar, Outlook o el calendario del iPhone se conectan a ella: reciben cada cita y le cuentan a
  la recepcionista lo que apuntas tú, para que no lo pise.»
- **La pieza** «¿Dónde llevas tu agenda?» se redibuja: en el centro, tu agenda; debajo, «Conectada a…» con
  Google, Outlook y Apple.
- **FAQ:**
  - «¿Puedo conectar o quitar mi calendario después?» → «Cuando quieras, desde el panel. Tus citas no se
    mueven: viven en tu agenda.»
  - «¿Y si el calendario se desconecta?» → «Tus citas siguen entrando en tu agenda y te avisamos por
    WhatsApp. Mientras no lo reconectes, lo que apuntes en tu calendario no lo vemos; al reconectar,
    copiamos ahí las citas que hayan entrado.»
  - Nueva, «¿Y si muevo una cita en Google?» → «Las citas se mueven en Alhabla: desde el panel o
    diciéndoselo a tu asistente por WhatsApp, que avisa al cliente. En Google la verás siempre al día.»
- **Guías:**
  - el texto de desconexión (`google-calendar/page.tsx:129`: «deja de dar horas, toma nota»), con la misma
    idea que la FAQ;
  - las descripciones («Reserva en tu Google Calendar…» → «Tus citas, también en tu Google Calendar»),
    también en `lib/paginas.ts`.

**Textos de la app**, con la misma voz: la asistente que trabaja para la dueña, en primera persona, como los
avisos de hoy («te aviso aquí de cada reserva»):
- **Alerta de calendario desconectado** (WhatsApp): «he perdido la conexión con tu Google Calendar. Tus
  citas siguen entrando en tu agenda, así que no te pierdes ninguna. Cuando tengas un momento, reconéctalo
  desde el panel y así veré también lo que apuntes ahí.»
- **Recordatorio a los 7 días:** «¿Sigues usando Google Calendar? Si quieres que vea lo que apuntas ahí,
  reconéctalo; si ya no lo usas, lo quito y no te molesto más.» Botones «Reconectar» y «Ya no lo uso».
- **Alta:** «Tu agenda ya está lista» + «¿Tienes ya citas apuntadas en otro sitio?», con «En Google, Outlook
  o el iPhone», «En papel o en otro programa» y «No, empiezo aquí».
- **Estado de la recepcionista**, con el calendario sin ver: «Reservando · sin ver tu Google Calendar»,
  con «Reconectar».
- **`/agente › Calendario`:** «Tu agenda» arriba y «También en…» para el calendario conectado.

**Blog:** solo lo que contradice el modelo nuevo (`whatsapp-business-google-calendar.mdx:86`,
`ia-que-contesta-llamadas.mdx:109`, y lo que salga de `grep -rn "a ciegas\|toma nota" web/content`), con
estas reglas. **`llms.txt:73`:** puede ser más técnico (lo leen las IAs), pero tiene que decir el modelo
nuevo. **`/legal/privacidad`:** revisar que «Tu calendario» siga siendo verdad: se lee ocupación y se escribe
una copia. No debería cambiar.

**Cómo se cierra:** todo lo «propuesto» se enseña al fundador con capturas de cada superficie, en móvil y
escritorio, antes de publicar. Pasa también la auditoría de parecido entre páginas de CI.

### Fase 6: documentación

- `AGENTS.md`: reescribir § Modo de agenda como «Agenda de Alhabla y calendarios conectados», y la
  descripción de `book_appointment` en § Calendar Integration.
- `CLAUDE.md`: la frase de la cabecera («reservan citas en el calendario de Google, Outlook o
  Apple/iCloud»).
- `PLAN-AGENDA-ALHABLA.md`: a `docs/historico/` cuando esto esté hecho.
- `PRODUCT.md`: actualizado con la decisión el 06-11 (§ Product Purpose, Positioning y los principios).

### Fase 7: limpieza

- `DROP COLUMN` de `Business.modoDeAgenda` (segundo deploy) y borrar `lib/modoDeAgenda.ts`.
- Quitar `puedeReservar` y los tests de `sin_elegir` y `alhabla`.

## Tests

- **Unitarios:**
  - con la conexión caducada, `check_availability` ofrece hora y `book_appointment` reserva y encola la
    copia;
  - con Google caído (lectura de ocupación fallida), reserva;
  - con el error al crear el evento, la cita queda confirmada y la copia `pendiente`;
  - una cita de Alhabla cuyo evento se borró en Google sigue bloqueando;
  - una movida en Google bloquea en los dos sitios;
  - el volcado al conectar no duplica eventos (idempotencia);
  - el contexto de tu asistente con y sin calendario.
- **Los que cambian de sentido:** los 44 usos de `*_CALENDAR_RECONNECT_REQUIRED` en 10 ficheros de tests, y
  los de `sin_elegir` y `alhabla` de `conexion.test.ts`, `service.test.ts`, `accionesAgenda.test.ts` y
  `siguientePaso.test.ts`.
- **Integración contra Postgres:** reservar por voz sin calendario, con calendario caducado y con
  calendario caído, y el job de copia.

## Cómo se comprueba

En dev, con `simular_webhook_telnyx` y `simular_conversacion` del MCP alhabla-dev:

1. Negocio nuevo sin calendario: reserva en la primera llamada.
2. Conectar Google: aparecen en él las citas futuras.
3. Revocar el token: la siguiente llamada reserva, llega la alerta nueva y el panel lo enseña.
4. Reconectar: se copian las citas que entraron.
5. Borrar en Google una cita de Alhabla: el hueco sigue ocupado.

Antes de la fase 1, medir con assistants temporales (receta de `reproducir-prompt-por-chat`) que la
recepcionista deja de decir «tomo nota» cuando ya no recibe esa instrucción.

## Riesgos

- **Doble reserva mientras no se ve el calendario** (D2, D3). Es el precio aceptado. Se mitiga con:
  - la alerta inmediata y el recordatorio a los 7 días;
  - el volcado al reconectar;
  - «Nueva cita» y «Bloquear» a un toque;
  - el texto del evento en Google.
- **El dueño mueve o borra en Google y espera que valga** (D5). La cita sigue en Alhabla y el cliente viene
  a la hora de siempre. Se mitiga con la línea del evento y la FAQ nueva. Si pasa a menudo, adelantar la
  detección de «Después».
- **Negocios en `sin_elegir` que pasan a reservar.** En producción solo hay cuentas de prueba (memoria
  `produccion-solo-cuentas-de-prueba`); aun así, avisar a cada una en el despliegue.
- **Los `Lead` pendientes antiguos** no se convierten solos en citas: siguen en el panel para que el dueño
  los confirme, como hoy.
- **Plantilla de la alerta en Meta:** si cambia el texto, hay que volver a aprobarla; mientras, sale por la
  ventana de 24 h o por email.

## Después

- Detectar en Google una cita de Alhabla movida o borrada y preguntar al dueño «¿La muevo también aquí?» /
  «¿La cancelo?», con el aviso al cliente detrás. Es el término medio entre D5 y la sincronización completa,
  y cumple «Alhabla concilia y el negocio confirma».
- Importar un `.ics` ajeno (Booksy, Treatwell) como horas ocupadas.
- Crear una cita pulsando un hueco vacío de la cuadrícula.

## Orden y estimación

| Orden | Qué | Días |
|---|---|---|
| 1 | Fase 1: reservar siempre | 3–4 |
| 2 | Fase 2: copia, volcado y reconciliador | 2–3 |
| 3 | Fase 3: avisos | 1 |
| 4 | Fase 4: la app | 2–3 |
| 5 | Fase 5: marketing con toque humano (franja de iconos, textos de web y app, capturas para el visto bueno) | 2–2,5 |
| 6 | Fase 6: documentación | 0,5 |
| 7 | Fase 7: limpieza, en otro deploy | 0,5 |
| | **Total** | **≈ 11–14** |

Las fases 1 y 2 van juntas en producción: sin la copia, la fase 1 dejaría de escribir en Google. Se
pueden hacer en dos PRs, pero se fusionan seguidas. La fase 5 sale con ellas o justo después: la web no
puede contar «tu agenda ya viene puesta» antes de que lo sea, ni seguir contando «no reserva a ciegas»
cuando ya no es así.
