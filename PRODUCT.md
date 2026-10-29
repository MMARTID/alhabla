# Product

<!-- impeccable:product-schema 1 -->

> Los encabezados de sección se mantienen en inglés porque son identificadores de esquema que
> las herramientas de Impeccable parsean. Todo el contenido va en español, como el resto del
> proyecto.

## Platform

web

## Users

**Usuario principal (cliente de pago):** dueño o gerente de un pequeño negocio de servicios en
España — peluquería, barbería, salón de uñas, centro de estética o clínica de fisioterapia.
Negocios de 1 a 20 empleados. Perfil no técnico, con baja tolerancia a la jerga y a la fricción.

Su situación real es la que define el producto: trabaja de cara al público con las manos
ocupadas — cortando, en cabina, en camilla — y el teléfono suena mientras atiende. No puede
cogerlo. El trabajo que quiere resuelto es que **ninguna llamada se pierda y que las citas
entren solas en su agenda**, configurándolo una vez y olvidándose. Lo que gana, según el fundador:
deja de elegir entre coger el teléfono, y dejar a su cliente a medias, o no cogerlo; cuando un
imprevisto cambia el día (un trabajador que se va a mediodía), sus citas se reorganizan al momento;
y deja de educar a sus clientes para que descarguen apps o escriban por un canal concreto.

Una cuenta equivale a un negocio y a una persona: el modelo `User` no tiene roles ni
multiusuario (`backend/prisma/schema.prisma:391`). Quien se registra es quien administra. No existe hoy
la figura de empleado con acceso limitado al panel.

**Usuario secundario (quien llama):** el cliente final del negocio, que marca el número y habla
con la recepcionista. Habla español, espera una respuesta natural y rápida y no debería notar
que habla con una IA torpe. No es usuario de la interfaz — su experiencia entera ocurre por
teléfono — pero es quien juzga si el producto funciona.

## Product Purpose

La promesa va primero: **que ningún negocio pierda una llamada**. Alhabla es un asistente de IA
para negocios con cita, con dos papeles. **La recepcionista** atiende a los clientes del negocio
por teléfono y WhatsApp, responde sus preguntas y reserva la cita en su agenda (la Agenda de
Alhabla o su Google, Outlook o Apple/iCloud). **Tu asistente** trabaja para el dueño: él le habla
por WhatsApp o desde el panel web, y ella se encarga.

Existe porque en estos sectores **llamada perdida = cita perdida = ingreso perdido**, y el dueño
no tiene ni recepcionista ni forma de contestar mientras trabaja.

El éxito se mide en citas que antes se caían y ahora entran, no en minutos hablados ni en
conversaciones mantenidas. De ahí que la web lleve una calculadora de llamadas perdidas
(`/herramientas/calculadora-de-llamadas-perdidas`, `web/src/components/herramientas/`) y precios
argumentados por ROI en `/planes`.

### Visión del fundador (29-10-2026)

Orden de la promesa, en palabras del fundador: primero que nadie pierda una llamada; después, el
asistente por WhatsApp, que es lo que provoca el «flipa» y lo que diferencia. A largo plazo podría
existir la opción de gestionarlo solo por WhatsApp, pero hoy el teléfono es la puerta de entrada:
los negocios no quitan su teléfono mientras sus clientes no se acostumbren a escribir por WhatsApp.

Su pitch, literal: «Alhabla es un asistente de IA para tu negocio que atiende tus llamadas y
lo gestionas por WhatsApp o el panel web.» Y enseña el móvil: «Flipa: hasta puedes dar de baja a un
trabajador si te falla y te reorganiza las citas avisando a los clientes por WhatsApp.»

Lo que cambia en el día de la dueña, casi en sus palabras:

1. Deja de decidir entre coger el teléfono y dejar a su cliente a medias, o no cogerlo.
2. Resuelve los cambios de cita al momento: si a mediodía un trabajador se va por una emergencia,
   sus citas se reorganizan con el profesional más cualificado disponible. Tu asistente marca la
   ausencia, dice qué citas tenía y propone pasar cada una, a la misma hora, a quien mejor hace
   ese servicio de los que están libres (el especialista y, entre iguales, quien tenga menos
   citas ese día: la misma regla con la que reserva la recepcionista). El dueño confirma y avisa
   al cliente con un botón; si dice otro nombre, manda el suyo.
3. Deja de educar a sus clientes para que descarguen aplicaciones de terceros o escriban o llamen
   por un canal concreto: todo el mundo usa WhatsApp. El negocio se adapta al cliente, no al revés.

«Llenar el día» (captar clientes, mensajes proactivos) está aparcado: nada de spam por WhatsApp.
«Solo no perder llamadas, pero con todo lo que conlleva.»

## Positioning

Lo que un producto vecino no podría copiar honestamente:

- **Reserva verificada, no conversación simpática.** El agente tiene prohibido inventar datos: el
  prompt le obliga a consultar `get_catalog` y a comprobar el hueco con `check_availability`
  (horario, capacidad, ausencias y calendario), y `book_appointment` vuelve a comprobarlo bajo un
  cerrojo por negocio, así que dos llamadas por el mismo hueco dejan una sola cita. Ojo: el
  `availabilityToken` solo lo exige el esquema de la tool, no el servidor. Si el calendario no
  responde, la cita queda pendiente, el dueño recibe un WhatsApp con botones («La apunté yo»,
  «Reintentar», «Reconectar») y se reintenta cada 6 h durante 48 h: nunca se reserva a ciegas. La
  agenda del negocio es la fuente de verdad, no una promesa que luego hay que repasar a mano.
- **Vertical, no constructor genérico de agentes.** Cinco nichos españoles con plantillas de
  servicios, instrucciones por sector y textos de onboarding propios
  (`backend/src/lib/businessType.ts`). Una peluquería y una clínica de fisioterapia no leen ni
  configuran lo mismo. La web tiene ocho landings de sector (`web/src/lib/sectores/`, un
  fichero por oficio, con sus guiones en `lib/relato-guiones.ts` y `lib/gestor-guiones.ts`):
  las cinco y pestañas y cejas, spa y masajes y peluquería canina, que en el backend son «otros»
  (servicios genéricos en el alta).
- **Reparto por especialidad, no cola ciega.** Cada profesional tiene un nivel por servicio
  (especialista / lo hace / no sugerir). El agente recomienda al especialista una vez y reserva
  igualmente si el cliente insiste; nunca dice que alguien «no se le da bien».
- **Tu asistente: el negocio entero se administra por WhatsApp, no solo la agenda.** En código es
  el módulo `gestor` («el Gestor»). El dueño cambia un precio, fija el horario semanal, cierra un
  día, da de alta o de baja a un profesional, o añade/mueve/cancela una cita — hablando con
  Alhabla por WhatsApp, sin entrar al panel. Tu asistente propone la acción y solo la ejecuta
  tras un «Confirmar» explícito — nunca de forma autónoma. (Reabrir un día ya cerrado todavía
  exige el panel web, no WhatsApp.) Está en todos los planes. **No es exclusivo:** a 20-10-2026
  no consta en HeyDiga ni en fonio, pero mims (mims.studio, Barcelona, desde 79 €) publica un
  asistente por WhatsApp para el dueño, con texto y audios, que mueve citas, cambia precios y
  horarios y cierra días; no publica que pida confirmación antes ni que resuelva ausencias.
  Recepio (recepio.ai) cambia horario y precios a través de su equipo humano. Lo que diferencia
  a tu asistente es el «Confirmar» en cada cambio, que vaya en el plan de entrada y la ausencia
  de punta a punta (abajo).
- **«Mañana falta Marta»: la ausencia se resuelve entera por WhatsApp, avisos incluidos.** El
  dueño escribe que alguien del equipo no viene y tu asistente encadena tres pasos, cada uno con su
  «Confirmar» (`backend/src/modules/gestor/accionesAgenda.ts`):
  1. `marcar_ausencia` bloquea a esa persona en ese tramo (hasta 62 días), la recepcionista deja
     de reservarle ahí, y tu asistente cuenta cuántas citas tenía y ofrece pasarlas, a la misma
     hora, a quien mejor hace el servicio de los que están libres.
  2. `mover_cita` pasa cada cita a otra hora o a otro profesional, comprobando la disponibilidad y
     actualizando el calendario conectado. Si el dueño no dice a quién y quien la tenía falta,
     propone al especialista libre (entre iguales, a quien tenga menos citas ese día);
     o `cancelar_cita` si no hay sitio.
  3. Tras cada «Hecho», tu asistente pregunta «¿Le aviso a Lucía por WhatsApp de la nueva hora?» con
     dos botones, «Sí, avísale» o «Le llamo yo», y `avisar_cliente` le manda el cambio o la
     cancelación por WhatsApp. Nada sale al cliente sin ese sí, y no se escribe a quien pidió no
     recibir mensajes.

  Ningún competidor revisado el 20-10-2026 publica la cadena entera (HeyDiga, fonio, Habla,
  Primer Tono, mims, Recepio, OfiVoice, Fulminatia, Arsys, safina.ai, y la IA de Treatwell, Fresha,
  Booksy y Koibox); lo más cercano es Recepio, que reasigna y avisa al equipo, no al cliente, en
  su plan de 249 €. Es el ejemplo que mejor explica tu asistente en una demo o en la web, porque es
  un problema que el dueño tiene cada semana.
- **Voz diseñada para no sonar a robot, no solo "voz de IA".** El dueño elige la voz
  escuchándola. En Pro y Scale, entre todas: en español, las 29 voces Ultra de Telnyx con acento
  de España, cada una con una descripción de cómo suena y las de atención al cliente a la vista;
  si su idioma principal es inglés, francés, alemán, italiano, portugués o neerlandés, entre las
  Ultra nativas de ese idioma; y con catalán, euskera o gallego de principal, entre Marta y Sergio
  de Soniox, las voces que hablan esas lenguas. En Inicio elige mujer u hombre y atiende la voz
  por defecto de ese género (Blanca o Marcos en español), que también se escucha antes. Matiz emocional automático (`expressive_mode`, solo en Ultra) y un fondo sutil de
  oficina para que la llamada no suene artificialmente silenciosa. La detección de turno de
  palabra corre en Deepgram Flux (Soniox con catalán, euskera o gallego, ajustado con llamadas
  reales), pensado para interrumpir y ser interrumpido de forma natural en vez de esperar un
  silencio largo.
- **Un solo proveedor de voz, con respaldo dentro de la llamada.** Telnyx orquesta las llamadas
  reales y la demo pública; Retell se retiró el 17-10-2026 (no llegó a coger ninguna llamada).
  Si el assistant falla, la llamada pasa al teléfono del negocio cuando el dueño tiene activada
  la transferencia, y la transcripción tiene modelos de respaldo.
- **Coste por minuto que deja competir con los grandes en precio.** Lo que paga Alhabla a Telnyx
  (facturación del 03-10-2026, en dólares como factura Telnyx): el assistant 0,05 $ por minuto
  empezado, con el modelo, la transcripción y la voz Ultra dentro; la telefonía ~0,002 $/min; la
  grabación ~0,002 $/min, y solo si el cliente la permite. Unos **0,054 $ por minuto facturado**;
  con catalán, euskera o gallego la voz suma de 0,002 a 0,014 $/min. Ojo con el redondeo: Telnyx
  cobra cada llamada por minuto empezado y Alhabla descuenta del plan la suma de segundos. Con las
  llamadas de producción de los últimos 60 días (52, todas de prueba, de 70 s de media) se pagaron
  94 minutos por 60,6 hablados, así que el minuto real salió a ~0,08 $. Con llamadas más largas
  baja hacia 0,054. En cifras redondas, **unos 0,06 $ por minuto**, sin contar el número, los
  WhatsApp, Stripe ni la infraestructura.

  El minuto incluido más barato de Alhabla (Scale, 269 € / 1.500 min ≈ 0,18 €) sigue por encima
  del doble del peor caso medido. Eso da margen para igualar a fonio, que es el más barato
  revisado (0,12 € por minuto incluido en Solo, 0,10 € en Team; minuto extra a 0,15 €), y a
  HeyDiga (de 0,25 € en Lite a 0,19 € en Pro), si la venta lo pide. El precio de hoy no está
  atado al coste: es una decisión comercial (ver «Operating Context»).

Desde el 29-10-2026 la web no se compara con HeyDiga, fonio ni con personas: las comparativas son
contra plataformas para montar tu propio agente de voz (Retell, Vapi y parecidas), y nunca nombran
a Telnyx.

## Operating Context

- **Alta guiada:** el registro empieza en la web pública (`alhabla.ai/register`) y entra en la
  app con un pase de un solo uso; dentro de la app sigue Google Places → nicho → servicios →
  equipo → calendario → checkout de Stripe. Los pasos intermedios se pueden saltar y completar
  después en `/agente`. El checkout es obligatorio para terminar el registro.
- **Escena de configuración:** a menudo desde el móvil o un portátil, de pie, entre cliente y
  cliente. El tiempo disponible es corto y interrumpible.
- **Uso diario:** poco y breve. Se entra al panel a mirar llamadas, transcripciones, resultados
  y próximas citas. No es una herramienta de uso continuo ni un puesto de trabajo.
- **Herramientas que el negocio ya tiene:** Google Calendar, Outlook o Apple/iCloud como agenda,
  su número de teléfono actual, y el teléfono como canal principal de reserva.
- **Evaluación antes de comprar:** demo de voz pública en el navegador (requiere micrófono y
  WebRTC, vía Telnyx) y la calculadora de llamadas perdidas.
- **Comercial:** prueba de 7 días y suscripción Stripe, precios sin IVA (desde el 2026-10-16).
  `inicio` 59 € + IVA/mes (200 min, 0,30 €/min extra), `pro` 139 € + IVA/mes (600 min, 0,25 €/min
  extra, plan destacado), `scale` 269 € + IVA/mes (1.500 min, 0,20 €/min extra). Precio de fundador
  39/99/199 € + IVA para los 15 primeros negocios.

## Capabilities and Constraints

**Capacidades confirmadas**

- Recepcionista de cada negocio con tono (`warm` / `professional` / `direct`), objetivo
  (`bookings` / `customer_service` / `lead_capture`), estilo de respuesta
  (`concise` / `balanced`) y escalado (`take_message` / `request_callback`) configurables.
- Idioma principal y voz del agente, seleccionables desde `/agente`. El dueño solo elige el
  idioma principal (desde el 05-10-2026): en él saluda y de él salen la voz y los idiomas que
  habla, sin casillas. Con español o uno extranjero (inglés, francés, alemán, italiano, portugués
  o neerlandés, para negocios de clientela extranjera) habla ocho: esos siete y el ruso (desde el
  14-10-2026; el ruso no puede ser principal); con catalán, euskera o gallego, también esa lengua
  (nueve). La cooficial también se activa sola por el código postal (Cataluña y Baleares,
  Euskadi, Galicia). Después del saludo sigue en el idioma de quien llama, y el panel lo dice:
  «Habla en 8 idiomas: … Saluda en español y sigue en el idioma de quien llama.»
  Con una lengua cooficial de principal atienden Marta o Sergio y contesta entre 1,4 y 2 segundos
  en vez de ~0,9 (medido con llamadas reales, también con clientes que hablan castellano), y el
  panel lo avisa. El idioma principal, catalán, euskera y gallego incluidos, se elige en todos los
  planes (desde el 07-10-2026: en Cataluña atender en catalán es obligatorio). La voz se elige
  escuchando una muestra de cada una: en Pro y Scale, entre todas las del principal; en Inicio,
  mujer u hombre con la voz por defecto de cada uno, y el resto se ve como «Elegir entre las N
  voces: planes Pro y Scale» con candado y enlace a facturación. La API rechaza otra voz en Inicio
  con 403; un negocio que ya la tenía elegida la conserva si baja de plan.
- Número de España (Telnyx) aprovisionado automáticamente tras el checkout.
- Registro de llamadas con transcripción, grabación y clasificación de resultado.
- Horario de negocio, catálogo de servicios, profesionales y capacidad de reserva.
- Integración de calendario con Google, Outlook y Apple/iCloud (CalDAV), incluido el aviso de
  reconexión cuando el refresh token o la contraseña de aplicación caduca.
- Reparto de citas por especialidad: cada profesional tiene un nivel por servicio (especialista /
  lo hace / no sugerir) que el agente usa para recomendar una vez, sin descartar al resto.
- Tu asistente: el dueño administra por WhatsApp servicios y precios (crear, cambiar, retirar),
  horario semanal, cierres de un día, tramos bloqueados, altas/bajas de profesionales y su
  especialidad, ausencias de una persona del equipo, la información del negocio que usa la
  recepcionista y las reservas (añadir, mover, cancelar), y avisa al cliente del cambio por
  WhatsApp. También responde preguntas: la agenda, el resumen de llamadas, dónde hay hueco, quién
  es un cliente y qué preguntaron que la recepcionista no supo contestar. Patrón de proponer y
  confirmar: nunca ejecuta sin que el dueño pulse «Confirmar». En todos los planes; se para solo
  si el pago está suspendido. Reabrir un día ya cerrado no está aún en WhatsApp (requiere el
  panel).
- Confirmación y recordatorio de cita por WhatsApp al cliente final, y lista de espera cuando no
  hay hueco disponible.
- Número de teléfono principal del negocio configurable desde ajustes.
- Facturación: checkout embebido, portal de cliente y resumen de suscripción.

**Terminología del producto** (visible al usuario)

Se dice «recepcionista» o «recepcionista de IA» (en los titulares, siempre «de IA»), «tu asistente»,
«llamadas», «citas», «servicios», «profesionales», «horario», «minutos incluidos», «ausencia» y
«lista de espera». Nunca «recepcionista virtual», «recepcionista de voz», «agente de voz», «el
Gestor» (solo en código), «agenda real», «competitividad», «productividad», «LLM», «modelo»,
«prompt», «orquestador», «webhook», «API» ni el nombre de ningún proveedor (Telnyx…).

**Restricciones duras**

- Idioma del agente `es-ES` y zona horaria `Europe/Madrid` por defecto.
- Sin roles ni acceso multiusuario por negocio.
- Duración de servicios 5–480 min; capacidad de reserva 1–50 (validación de backend). El alta
  permite hasta 20 profesionales por interfaz, pero el tope real que aplica el backend es por
  plan: 3 en inicio, 10 en pro, sin límite en scale.
- Horario: 7 días, máximo 3 intervalos no solapados por día, formato `HH:mm`.
- La completitud del onboarding se calcula en vivo desde los datos del negocio; solo
  `dismissedAt` y `completedAt` se persisten.
- La demo de voz necesita navegador moderno con WebRTC y permiso de micrófono; no hay
  alternativa sin audio.

**Decisiones abiertas — no inventar una respuesta**

- No hay objetivos numéricos de rendimiento ni matriz de navegadores soportados definidos.
  `next/core-web-vitals` es hoy el único listón automatizado.
- No hay decisión sobre multiusuario/roles por negocio.

## Brand Commitments

- **Nombre:** Alhabla.
- **Idioma:** español de España, siempre, con tuteo en la interfaz.
- **Registro:** confianza tranquila y profesional. Cercano pero serio. Ni corporativo
  acartonado ni startup con emojis.
- **Concreto sobre abstracto:** el copy se apoya en números y resultados verificables — minutos,
  euros por minuto, citas recuperadas, ROI.
- **Enfocado al dolor, sin alarmismo:** se nombra el problema y se cuantifica la solución; no se
  exagera.
- **IA sin complejos, sin jerga técnica:** se dice «IA» («recepcionista de IA», «asistente de IA»),
  pero sin términos técnicos; se habla como habla el dueño, no como un folleto.
- **Vender enseñando:** la prueba es el producto funcionando (la llamada, el WhatsApp, el
  «Confirmar»), no la explicación.
- **Errores:** en español, accionables y sin culpar al usuario. Los 5xx genéricos del backend
  deben traducirse a algo humano en la interfaz.
- **Estética comprometida:** SaaS conservadora y profesional para negocios tradicionales
  españoles; explícitamente no el look genérico de startup ni de app de consumo. El sistema
  visual concreto vive fuera de este archivo.
- **Voz del agente telefónico:** cálida y eficiente, con matiz emocional automático
  (`expressive_mode`) y detección de turno de palabra en Deepgram Flux para interrupciones
  naturales — no una voz robótica que espera silencio. Saludo (lo compone el backend,
  `lib/idiomas/catalogo.ts`, en 11 idiomas): «{negocio}, te atiende su asistente de inteligencia
  artificial. ¿En qué te ayudo?» — el aviso de IA del art. 50 del Reglamento de IA no se puede
  quitar.

## Evidence on Hand

**Lo que existe y es real**

- Más de quince estadísticas de sector con fuente citada (El Confidencial Digital, Estética
  Magazine, Zenoti, STANPA / El Periódico, Doctoralia, safina.ai, heilo.io, entre otras) y citas
  textuales de profesionales recogidas en prensa (Excelsior Barber Studio en Diario de Mallorca,
  David Aranda de Estetical en Crónica Global). Salieron de la web el 29-10-2026 con las landings
  cortas; siguen en el historial (`git show 34d2573:web/src/lib/niche-landings.ts`).
  **Hablan del problema, no de Alhabla.** No son testimonios de cliente y no deben presentarse
  como tales.
- Producto funcional y demostrable: demo de voz pública en el navegador.

**Ausencias que ningún trabajo futuro debe rellenar inventando**

Alhabla está en **prelanzamiento: no hay clientes de pago**. Por tanto **no existen**, y no se
pueden fabricar ni insinuar:

- testimonios ni casos de éxito de clientes de Alhabla;
- logos de clientes ni recuentos del tipo «X negocios ya confían»;
- métricas propias del producto (llamadas gestionadas, citas recuperadas, tasa de acierto,
  valoraciones);
- premios, apariciones en prensa sobre Alhabla o cifras de facturación.

Toda cifra publicada debe llevar una fuente externa verificable, como ya hacen las landings de
nicho. Cuando haga falta prueba en una superficie y no la haya, la salida correcta es enseñar el
producto funcionando (demo, transcripción real, la calculadora), no fabricar prueba social.

## Product Principles

1. **Que nadie pierda una llamada.** Es la promesa y va primero, siempre: antes que el asistente o
   cualquier función nueva. Todo se argumenta y se mide contra ingresos recuperados,
   no contra funcionalidades.
2. **Configurar una vez y olvidarse.** Cada pantalla debe acercar al usuario al «ya está»,
   nunca convertirlo en operador de su propio software. La configuración operativa de la
   recepcionista vive en `/agente`; la identidad, seguridad y administración de la cuenta viven
   en `/ajustes`. No mezclar ambos mundos: separar «cómo atiende mi recepcionista» de «cómo
   protejo y gestiono mi cuenta» reduce la carga cognitiva.
3. **La agenda del negocio manda.** El producto nunca inventa disponibilidad ni promete un hueco
   que no existe; verificar antes de reservar es innegociable.
4. **Vender lo que cambia en el día de la dueña, no la tecnología.** El vocabulario, la prueba y las
   expectativas se plantean en términos del negocio, no de la tecnología.
5. **España primero, sin cerrarse la puerta.** Se optimiza sin reservas para español de España,
   euros y `Europe/Madrid`, pero se evitan decisiones estructurales que impidan LATAM o el resto
   de la UE más adelante.
6. **Alhabla concilia y el negocio confirma.** Alhabla hace el trabajo (ve quién puede, qué hueco
   hay, a quién avisar) y el negocio da el visto bueno. Sin preguntar, Alhabla solo atiende a los
   clientes: reservar, cambiar o cancelar su propia cita cuando lo pide por llamada o WhatsApp.
   Todo lo que toca el negocio (crear citas desde el panel o WhatsApp, mover, eliminar, cambiar
   precios, horarios…) pide «Confirmar». En una frase: con los clientes manda Alhabla; con tu
   agenda mandas tú.
7. **El negocio se adapta al cliente.** Sin apps ni canales nuevos: teléfono y WhatsApp, que ya usa
   todo el mundo. No se educa a los clientes para que descarguen nada ni escriban por un canal
   concreto.

## Accessibility & Inclusion

Listón comprometido: **WCAG 2.1 nivel AA**, aplicado con prioridad a las superficies públicas y
de conversión — landing, landings de nicho, registro, planes y checkout — por la European
Accessibility Act, vigente para servicios vendidos online en la UE desde junio de 2025.

Necesidades específicas conocidas de esta audiencia:

- Se configura desde el móvil, con frecuencia de pie y con prisa: objetivos táctiles amplios y
  formularios que toleren la interrupción.
- Usuarios no técnicos y de edades variadas: contraste y tamaños de texto cómodos, sin depender
  del color como único portador de significado.
- La demo de voz depende de audio y micrófono. No hay alternativa accesible equivalente hoy; si
  se mantiene como prueba principal, necesita una vía paralela no auditiva para entender qué
  hace el producto.
