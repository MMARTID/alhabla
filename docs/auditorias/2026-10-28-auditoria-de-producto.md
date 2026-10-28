# Auditoría de producto (28-10-2026)

Recorrido del producto entero sobre main (`bed0a93`), leyendo código y no documentación, más cuatro
preguntas del dueño:

- ¿qué pasa si alguien no quiere conectar su calendario?;
- ¿cómo meteríamos el alta de WhatsApp de Telnyx en el onboarding?;
- ¿Facebook tiene calendario?;
- ¿puede la IA estar en un grupo de WhatsApp?

No se ha tocado producción, Telnyx, Meta ni Stripe. Lo que depende de ellos va marcado **por
confirmar**. Lo que ya estaba en `2026-10-16-*` y `2026-10-27-*` y sigue abierto se cita como
pendiente.

## Resumen

El núcleo está bien hecho: reserva comprobada con cerrojo, el Gestor, avisos con respaldo por correo,
idempotencia y alertas. Los problemas gordos están en otro sitio:

1. **El alta deja negocios que parecen funcionar pero no reservan.** Saltarse el negocio, el horario o
   el calendario no se avisa, y el panel dice «Atendiendo llamadas» igualmente.
2. **Varios estados del panel no dicen la verdad:** el desvío sale «activo» sin estarlo, y la
   recepcionista sale «operativa» sin poder reservar.
3. **Hay caminos en los que se pierde una cita o una llamada sin que nadie se entere:** dos citas en
   la misma llamada, cuelgues por impago, números pendientes.

## Respuestas a las cuatro preguntas

| Pregunta | Respuesta corta |
|---|---|
| ¿Y si no quiere conectar su calendario? | Hoy **no puede reservar**. El alta deja saltarse el paso. La recepcionista ofrece la hora y, cuando el cliente dice que sí, la reserva falla («El negocio debe reconectar Google Calendar»). La agenda y el motor de huecos ya funcionan solo con nuestra base de datos: lo que lo impide es una comprobación deliberada repetida en 5 sitios. Propuesta: modo «Agenda de Alhabla» explícito (§3). |
| ¿Cómo meter el alta de WhatsApp (Embedded Signup) por Telnyx? | **No en `/bienvenida`**, sino como bloque opcional en Ajustes › Teléfono («WhatsApp de tus clientes»), tras pagar, con interruptor y piloto. Flujo propio con `FB.login` y la solución de Telnyx (`solutionID`) en modo coexistencia, registro en Telnyx y seguimiento hasta `active`. Fase 1, unos 12 días (§4). |
| ¿Facebook tiene calendario? | **No hay nada que integrar.** La herramienta de Citas de Meta se recortó a mediados de julio de 2024 y no tiene API. El botón «Reservar» de Facebook e Instagram lleva al sistema de un partner (Booksy, Fresha, Treatwell…) (§5). |
| ¿La IA puede estar en el grupo del equipo? | **Con Telnyx, no.** Con la Cloud API de Meta, sí, pero con condiciones: cuenta oficial (OBA), máximo 8 personas, el grupo lo crea la IA (no puede unirse al que ya existe) y cada mensaje se cobra por miembro. Diseño alternativo que da casi lo mismo: un chat 1 a 1 de cada trabajador con el Gestor, con rol limitado (§6). |

## 1. Hallazgos

### Impacto alto

**1. Alta sin negocio ni horario: la recepcionista saluda con el email y no reserva.**
- El registro crea `name: "Negocio de <email>"` y `schedule: {}` (`backend/src/modules/auth/routes.ts:206-208`).
- «No encontré mi negocio» (`frontend/src/app/bienvenida/page.tsx:530-556`) solo guarda la telefonía, y el alta no tiene paso de horario.
- El saludo de voz usa el nombre sin sanear (`backend/src/lib/telnyxAgentSync.ts:202`); WhatsApp sí lo sanea (`mensajesCliente.ts:105`).
- Con el horario vacío no hay disponibilidad (`BUSINESS_HOURS_NOT_CONFIGURED`), pero el panel dice «Atendiendo llamadas» (`frontend/src/components/operational-status.tsx:80`).

**Qué hacer:** pedir nombre y horario en ese camino, con el `business-hours-editor` que ya existe; sanear el saludo; estado «Atiende pero no reserva».

**2. Sin calendario no se reserva nunca, y el alta no lo avisa.**
- El paso se puede saltar sin aviso (`bienvenida/calendar/page.tsx:175`).
- `book_appointment` corta en `voiceTools/service.ts:1819`. El cliente oye un mensaje de reconexión y el dueño recibe «tu calendario estaba caducado».
- El texto correcto (`CALENDAR_NOT_CONNECTED`, `whatsapp/avisosNegocio.ts:425-427`) no lo usa nadie.
- Es el hallazgo 8 de la auditoría del 16-10, todavía abierto. Ver §3.

**3. Por confirmar: el OAuth de Google estaría en revisión, solo con cuentas de prueba.**
- Lo dicen los comentarios del propio código (`frontend/src/components/google-auth-button.tsx:57-58`) y la pastilla «Beta» de Google Calendar en el alta.
- El scope `calendar.events` es sensible.
- Si se confirma, ningún dueño real puede conectar Google Calendar y, por el punto 2, no habría reservas.
- Facebook Login está igual (`facebook-auth-button.tsx:55-56`).

**Qué hacer:** mirar el estado de publicación en Cloud Console y priorizar la verificación.

**4. Llamadas colgadas sin alternativa.**
- Con impago vencido, suscripción cancelada o sin assistant operativo, la llamada se corta (`backend/src/adapters/telnyx/webhookHandlers.ts:418-425`).
- Nadie avisa el día que entra el corte: `jobs/suspendOverdueCalls.ts` solo marca la fecha.
- Si el número de Alhabla es el principal del negocio, muere su único teléfono público.

**Qué hacer:** antes de colgar, transferir al móvil del dueño o leer un mensaje con el teléfono del negocio; avisar por WhatsApp 24 h antes y el día del corte.

**5. El desvío sale «Activo» sin estarlo.** Confirmado.
- `backend/src/modules/onboarding/routes.ts:143-158` lo da por hecho si existe cualquier fila `Call`.
- Eso incluye los chats de WhatsApp y las acciones del Gestor, que crean `Call` sintéticas.
- El job del recordatorio sí las excluye (`jobs/recordarDesvioSinComprobar.ts`).
- Esconde la causa más probable de «no me llegan llamadas».

**Qué hacer:** el mismo filtro que usa el job.

**6. Quien viene a por Pro o Scale queda bloqueado a 3 profesionales en el alta.**
- `Business.plan` vale `"basic"` por defecto, y el paso del equipo va antes del pago.
- Con 4 o más profesionales sale «Tu plan incluye hasta 3», aunque llegue con `?plan=pro` (`frontend/src/app/bienvenida/team/page.tsx`, `backend/src/modules/bookings/service.ts:260-280`).

**Qué hacer:** sin suscripción, aplicar el plan elegido o ningún límite.

**7. Una segunda cita en la misma llamada borra la primera sin avisar.** Confirmado.
- `Booking.callId` es `@unique` y `book_appointment` hace un upsert por `callId` (`voiceTools/service.ts:2172`), borrando el evento anterior del calendario.
- «Y otra para mi hija»: el cliente oye dos confirmaciones y solo queda la última.

**Qué hacer:** error `YA_HAY_CITA_EN_ESTA_LLAMADA` salvo cambio explícito, más una regla en el prompt. A largo plazo, reservas múltiples.

**8. Cambiar o cancelar: solo por el número que llama y solo la próxima cita.**
- `find_my_appointment` no tiene parámetros y devuelve una sola cita (`voiceTools/service.ts:2566-2588`).
- Si no la encuentra pide el nombre, pero no hay ninguna tool para buscar por nombre.
- Suma el riesgo de identidad por caller ID, pendiente del 16-10.

### Impacto medio

| # | Hallazgo | Evidencia | Qué hacer |
|---|---|---|---|
| 9 | Servicios en el alta: mínimo de 4 obligatorio, sin precio ni servicio propio. Pestañas, spa y peluquería canina reciben plantillas de «Consulta inicial» o «Recogida o entrega». | `bienvenida/services/page.tsx:15,117-121`; `frontend/src/lib/service-templates.ts:227-246` | Permitir menos de 4, servicio propio con precio y plantillas para esos sectores |
| 10 | El alta no ofrece iCloud (solo en `/agente`), aunque la web lo vende en todos los planes. | `bienvenida/calendar/page.tsx:126,147` | Añadir iCloud al paso |
| 11 | Después de pagar, el botón lleva a `/agente` y no al desvío. | `frontend/src/app/checkout/resultado/page.tsx:97-103` | Llevar al desvío y luego a «haz una llamada de prueba» |
| 12 | Sin plan preelegido, el alta sale a la web (301) y vuelve: dos saltos de dominio. | `bienvenida/calendar/page.tsx:65`, `frontend/next.config.mjs:37` | Selector de plan dentro de la app |
| 13 | Un cliente nuevo no puede pedir cita por WhatsApp: el número es compartido y le contesta «llama al negocio». | `whatsapp/tenantDelCliente.ts:110`, `mensajes.ts:218-219` | Corregir el texto de la web ya; número propio del negocio en §4 |
| 14 | La lista de espera existe, pero depende de la plantilla `hueco_libre` (de MARKETING), solo para la hora exacta, solo si se cancela desde Alhabla, y no hay vista para el dueño. | `whatsapp/service.ts:425-449`, `bookings/cancelacion.ts:177-198` | Vista en el panel; dispararla también desde la reconciliación del calendario; comprobar si la plantilla está aprobada (por confirmar) |
| 15 | Todos los números son de Barcelona (`TELNYX_SPAIN_LOCALITY` único): un salón de Sevilla que usa el de Alhabla publica un 93. | `backend/src/modules/phone/service.ts:161` | Comprar en la provincia del negocio |
| 16 | Los pedidos de número «pending» no se reanudan (pendiente del 16-10). | `jobs/telnyxReconciler.ts:209` | Reconciliar también los pendientes |
| 17 | Las plantillas al cliente solo salen en español, aunque se guarde su idioma (pendiente del 16-10). | `whatsapp/service.ts:131-145` | Elegir la plantilla por `ClienteDelNegocio.idioma` |
| 18 | El panel no deja crear citas a mano. | sin ruta en `bookings/` | Botón «Nueva cita» que reutilice `añadir_cita` del Gestor |
| 19 | Profesionales con nombre «Profesional 1…N» y ningún aviso para renombrarlos: no funcionan ni «con Marta» ni la especialidad. | `team/page.tsx:95` | Aviso en el panel |

### Impacto bajo y operación

- **20.** La prueba gratis se puede repetir cancelando y volviendo a contratar (`billing/service.ts:272-275, 400`). Bajar de plan no recorta profesionales.
- **21.** Las alertas van a un solo Gmail. La alerta de voz mezcla las suspensiones legítimas. Un negocio sin assistant puede pasar hasta 24 h colgando llamadas, por el reconciliador diario. Telnyx es proveedor único de voz, números, WhatsApp y transcripción.
- **22.** Residencia en la UE y privacidad, pendientes del 16-10 y del 27-10:
  - el modelo de lenguaje es de OpenAI;
  - `data_retention: true`;
  - las grabaciones no se borran en Telnyx tras copiarlas;
  - no hay forma de borrar los datos de un cliente final.
- **23.** La pregunta «¿Tus clientes son de la UE?» del registro no se usa.
- **24.** Scale anuncia «Varios números para más de una sede (próximamente)», que no existe.

## 2. Lo que la web promete y el producto no cumple del todo

| Frase de la web | Realidad |
|---|---|
| «Puede reservar o mover su cita hablando por WhatsApp con la recepcionista» (`whatsapp-benefits-table.tsx:15`) | Solo si ya tiene una cita con ese negocio (hallazgo 13) |
| «Lista de espera por WhatsApp» en todos los planes | Existe, con las condiciones del hallazgo 14 |
| «Reserva en Google, Outlook o iCloud» | Sí, pero el alta no ofrece iCloud y Google estaría en revisión (hallazgos 3 y 10) |
| «Habla en 8 idiomas» | Por voz, sí. Los WhatsApp al cliente salen en español (hallazgo 17) |
| «Varios números para más de una sede (próximamente)» | No existe |
| «Da el precio de tu catálogo» | Sí, pero el alta crea los servicios sin precio |
| Uñas: «añade tiempo cuando corresponde» en retiradas | Pregunta por la retirada, pero no añade tiempo |
| «Cada llamada termina en una sola cita» | La web es honesta, pero el producto no lo impone (hallazgo 7) |
| «Comprobar desvío con una llamada real» | Existe, pero el estado «Activo» puede ser falso (hallazgo 5) |
| «Atención 24 h con tu número de siempre» | Salvo en los cuelgues del hallazgo 4 |
| «La recepcionista no da horas que no puede comprobar» (FAQ de `/integraciones`) | Sin calendario sí las da, y falla al reservar |

Confirmado en el código:
- el Gestor: ausencias, mover y avisar, cierres y vacaciones;
- el reparto por especialidad;
- el aviso de IA en la primera frase;
- los recordatorios con botones en Pro;
- el resumen semanal y la analítica;
- el cambio de cita sin cancelar antes;
- la transferencia al dueño;
- el aviso al 80 % de los minutos.

## 3. Sin calendario: propuesta

**Estado actual:**
- `check_availability` funciona solo con la base de datos (`calendar/service.ts:517-523`, `lib/availability.ts`).
- Las tools se registran siempre (`agentBootstrap.ts:221-227`, `telnyxAgentSync.ts:261-278`). La memoria antigua de «tools solo al guardar horario o calendario» está obsoleta.
- Lo que bloquea es la comprobación de conexión. Está en:
  - `book_appointment` (`voiceTools/service.ts:1819`);
  - las acciones `añadir_cita` y `mover_cita` del Gestor (`gestor/accionesAgenda.ts:366-395`);
  - el botón «Mover» del panel (`bookings/citasDelPanel.ts:47`);
  - la lista de espera (`whatsapp/listaDeEspera.ts:640`);
  - los reintentos (`jobs/retryFailedBooking.ts:293`).
- Sin calendario sí funcionan: cancelar, ausencias, bloqueos y recordatorios.

**Opciones:**

0. **Que no engañe (0,5–1 día, hacerlo ya):**
   - si nunca hubo conexión, no ofrecer hora, o avisar de que se toma nota;
   - usar `CALENDAR_NOT_CONNECTED` con un mensaje veraz;
   - avisar de la consecuencia en el paso del alta;
   - corregir la FAQ de `/integraciones`.
1. **Modo «Agenda de Alhabla» explícito (3–4 días):**
   - `Business.modoDeAgenda "alhabla" | "externo"`. **Tiene que elegirse, no deducirse** de que no haya conexión: un calendario caducado nunca debe pasar a reservar a ciegas.
   - Saltar la comprobación solo en ese modo, en los 5 sitios, y crear el evento externo solo si hay calendario.
   - Tercera opción en el alta («Usar la agenda de Alhabla»).
   - Que el panel no lo trate como error.
   - Telnyx no se toca.
2. **Panel de agenda (2–3 días):** «Nueva cita» con `POST /business/me/bookings` reutilizando `prepararCita`, `comprobarHueco` y la `Call` sintética del Gestor; crear cita pulsando un hueco vacío; ausencias desde el panel.
3. **Feed iCal de solo lectura (1,5–2 días):**
   - `Business.icalToken` y `GET /agenda/:token.ics`, sin JWT y con límite de peticiones;
   - UID estable y datos mínimos (servicio y nombre, sin teléfono);
   - enlace que se pueda cambiar, y `webcal://` para el iPhone.
   - Reutiliza `adapters/calendar/caldav/ics.ts`.
   - Sirve para ver las citas en el móvil, no para sincronizar.

**Riesgo principal:** dobles reservas con las citas apuntadas en papel, Booksy o Instagram. Se mitiga con un aviso claro al elegir el modo y con «Nueva cita» y «Bloquear» a un toque, en el panel o por WhatsApp al Gestor.

**MVP recomendado:** opciones 0 + 1 + «Nueva cita» y «Bloquear» + 3, unos **7–8 días**.

**Decisión de producto pendiente:** Alhabla se acerca a ser un programa de reservas, y la web tendría que decir «o en la agenda de Alhabla».

## 4. Alta de WhatsApp del negocio (Embedded Signup por Telnyx)

### Novedades frente a `PLAN-WHATSAPP-COEXISTENCIA.md`

- **La página alojada de Telnyx ya soporta coexistencia:** `POST /v2/whatsapp/hosted_signups` con `signup_type: "coexistence"`. Sirve para la prueba de la fase 0 sin escribir frontend. No sirve para producción: abre otro dominio y no admite `customer_id`.
- **Versiones del alta de Meta:** la v2 y la v3 se retiraron el 15-10-2026, y la v5 salió el 20-10 (coexistencia por defecto, el evento llega como `FINISH` con `is_on_biz_app`). Telnyx documenta la v4. Recomendación: fijarse en la v4 y normalizar también la forma de la v5.
- **Límite de altas de Meta:** 200 negocios nuevos por semana con la solución verificada; 10 sin verificación ni revisión.
- **Pago:** la solución comparte la línea de crédito de Telnyx con cada WABA. El negocio no pone tarjeta.
  - Riesgo: falla en el cierre de mes, y con la cuenta de prepago, quedarse sin saldo tumba el WhatsApp de todos los negocios.
- **La revisión de Meta tiene salida:** acepta grabar el envío y las plantillas hechos con la integración del Solution Partner (Alhabla por Telnyx).
- **Telnyx no da dos cosas:**
  - Los webhooks del WABA y el perfil de mensajería del número los configuramos nosotros. Sin perfil no llega `message.echo`.
  - **Por confirmar:** si se puede asignar un perfil a un número español propio. `AGENTS.md` recoge el error 40323 con números de Telnyx.

### Flujo

1. El dueño abre Ajustes › Teléfono › «WhatsApp de tus clientes».
2. `GET /business/me/whatsapp/propio` devuelve `appId`, `configId` y `solutionId` (los da el backend, sin variables `NEXT_PUBLIC_*`).
3. `FB.login` con `config_id`, `extras.setup.solutionID`, `featureType: "whatsapp_business_app_onboarding"` y `sessionInfoVersion: "3"`. Hay que llamarlo de forma síncrona en el clic.
4. Se escucha el `postMessage` `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING`, que trae `waba_id` y `phone_number_id`. También hay que tratar `CANCEL` y `ERROR`.
5. `POST /business/me/whatsapp/propio/registro`:
   - **primero guarda la fila y después llama a Telnyx** (`POST /v2/whatsapp/business_accounts/tech_provider` con `customer_id = "<entorno>:<businessId>"`);
   - responde 409 si ese número ya es de otro negocio.
6. Una tarea de Cloud Tasks hace el seguimiento con espera creciente:
   1. sesión de alta en `SUCCESS`;
   2. busca el WABA en Telnyx y configura sus webhooks;
   3. asigna el número a un perfil de mensajería;
   4. espera a que `coexistence_state` llegue a `active` (como mucho 24 h).
7. En `/webhooks/telnyx`, con la firma Ed25519 de siempre, se reciben `whatsapp.account.update`, `message.echo` y las ediciones o borrados de `message.received`.

**Estados de la interfaz:** `sin_conectar`, `abriendo`, `cancelado`, `error_meta`, `registrando`, `fallo_alta`, `sincronizando`, `preparando_plantillas`, `conectado`, `reconectando`, `caducado` y `desconectado`.

**Modelo de datos:** `WhatsappNumeroNegocio`, con dos máquinas de estado separadas:
- el alta en Telnyx: `estadoAlta`, `pasoAlta` y `erroresAlta`;
- la coexistencia de Meta: `coexistenceState`, `syncDeadline` y `syncProgress`.

Y además `metaPhoneNumberId @unique`, `operativoDesde` y `modoChat` (por defecto `solo_avisos`).

**Esfuerzo:**

| Fase | Qué | Días |
|---|---|---|
| 0 | Sin código: `foreign_apps`, crear la Configuration de Meta, prueba con la página alojada y con una página mínima | — |
| 1 | Alta completa con interruptor y piloto: sigue enviando desde «Alhabla Reservas» | ≈ 12 |
| 2 | Enviar desde su número (plantillas por WABA) | 5–7 |
| 3 | La recepcionista contesta en su chat | 3–4 |
| 4 | Panel y textos legales | 1–2 |

**Decisiones pendientes:**
- flujo propio (recomendado) o alojado;
- v4 o v5;
- solo coexistencia en la v1;
- intercambiar el `code` con `META_APP_SECRET` contra la suplantación, o bastan las restricciones `@unique`;
- vía de entrada de los mensajes: `whatsapp.messages` o `message.received`;
- un perfil de mensajería por entorno;
- tabla de plantillas por negocio;
- exigir plan activo;
- dueño como tester mientras no haya acceso avanzado;
- contrato de encargado del tratamiento.

## 5. ¿Facebook tiene calendario?

**No hay nada que integrar.**

- **Citas de Meta:** Meta avisó de que algunas funciones de su herramienta de Citas dejaban de estar disponibles «a partir de mediados de julio de 2024» ([ayuda de Meta](https://www.facebook.com/business/help/2170097176392356)). No tiene API: los webhooks de página actuales no traen citas.
- **Botón «Reservar» de Facebook e Instagram:** lo dan partners (Booksy, Fresha, Treatwell, Shore, SimplyBook.me…) a través de Facebook Business Extension, y abre su widget. Ser partner solo serviría para poner un botón hacia una página de reservas web, que Alhabla no tiene.
- **La app WhatsApp Business** no tiene calendario.
- **Meta Business Agent** (3-6-2026) reserva citas «a través de tus propias APIs». Es competencia, no una integración, y excluye el sector salud.

**Lo aprovechable:** el botón de WhatsApp en la página de Facebook y en el perfil de Instagram, y los anuncios Click-to-WhatsApp, que llevan al chat de la recepcionista.

## 6. ¿La IA puede estar en el grupo de WhatsApp del equipo?

### Groups API de Meta (desde el 6-10-2025; abierta a cuentas oficiales, OBA)

- Permite crear grupos, invitar por enlace, enviar y recibir mensajes y moderar.
- Límites:
  - **máximo 8 participantes**;
  - **el grupo lo crea el número de la empresa**: no hay forma de unirse a un grupo existente, así que **no puede ser el grupo que ya tiene la barbería**;
  - sin botones interactivos.
- Coste: cada mensaje se cobra por destinatario.
- Requisitos: cuenta oficial (Meta la concede a su criterio) y número en Cloud API.
- **No funciona con números en coexistencia.** Fuente: [Groups API](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/).

### Telnyx

No lo soporta. Ni la documentación ni el SDK 7.28.0 tienen grupos de WhatsApp: `to` solo acepta un número E.164 o un BSUID.

### Atajos con APIs no oficiales (WhatsApp Web, Baileys)

Violan los términos y llevan al bloqueo. **Descartado.**

### Alternativa recomendada, que da casi lo mismo con lo que ya hay

1. Cada trabajador tiene su propio chat 1 a 1 con el Gestor, con un rol limitado:
   - puede preguntar «¿qué tengo hoy?», solo de su agenda;
   - y avisar «no vengo mañana», que queda pendiente de confirmar por el dueño o se aplica directamente, según se configure.

   Hay que añadir el teléfono a `Professional`, con opt-in.
2. El dueño sigue con su Gestor completo.
3. Resumen diario por persona con una plantilla de tipo utility.
4. Cuando algo cambia («las citas de Marta pasan a Luis»), aviso 1 a 1 a cada afectado.

Así no hace falta cuenta oficial, no hay límite de 8, funciona por Telnyx, admite botones y cada uno ve solo lo suyo.

## 7. Prioridades

1. **Esta semana (quick wins, menos de 1 día cada uno):**
   - el filtro del desvío (5);
   - nombre, horario y saludo saneado (1);
   - el límite de profesionales en el alta (6);
   - una cita por llamada (7);
   - el estado «Atiende pero no reserva» y el mensaje sin calendario (2, opción 0);
   - iCloud y el aviso en el paso del calendario (10);
   - después del checkout, llevar al desvío (11);
   - prueba gratis una sola vez (20);
   - textos de la web (§2);
   - avisos de «Profesional N» y de servicios sin precio (19).
2. **Confirmar:** la publicación del OAuth de Google y Facebook (3), y que `hueco_libre` esté aprobada (14).
3. **Siguiente bloque:**
   - Agenda de Alhabla, MVP de 7–8 días (§3);
   - qué hacer antes de colgar y aviso de corte (4);
   - buscar la cita por nombre o fecha (8).
4. **Después:**
   - fase 0 y fase 1 del WhatsApp del negocio (§4);
   - «prueba tu recepcionista» dentro de la app antes de pagar;
   - trabajadores con su chat del Gestor (§6).
5. **Apuestas:**
   - residencia en la UE (modelo alojado en Telnyx, anclaje en Frankfurt);
   - números locales por provincia y portabilidad;
   - reservas múltiples;
   - ficha de cliente;
   - varios usuarios y sedes.
