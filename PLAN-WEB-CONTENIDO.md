# Plan: contenido, textos y sitemap de la web pública (alhabla.ai)

Abierto el 2026-10-29, tras la conversación de producto con el fundador (ver `PRODUCT.md` ›
Product Purpose › «Visión del fundador»). Rama `web/nueva-imagen-y-sitemap`.

## Por qué

La web contaba el producto con palabras de folleto y en el orden equivocado. Las landings de
sector tenían 15 bloques y ~3.300 palabras (unas 25 pantallas en el móvil); el asistente por
WhatsApp, que es lo que diferencia, salía en el sexto bloque. Las comparativas peleaban en precio
con HeyDiga y fonio, donde se pierde, y no tuvieron ni una visita. El fundador lo resume así:

1. **Que nadie pierda ninguna llamada.** Va primero, siempre.
2. **Tu asistente por WhatsApp** («la que trabaja para mí») es el «flipa»: va justo después.
3. **Alhabla concilia y el negocio confirma.** Con tus clientes manda Alhabla; con tu agenda
   mandas tú.
4. **El negocio se adapta al cliente**: teléfono y WhatsApp, nada de apps.

## Vocabulario (vale para toda la web)

| Se dice | No se dice |
|---|---|
| «recepcionista de IA» (titulares, H1, metatítulos), «la recepcionista» en el cuerpo | «recepcionista virtual», «recepcionista de voz», «agente de voz» aplicado a Alhabla |
| «tu asistente» (femenino: «ella te dice…») | «el Gestor», «tu gestor», «Agente» para el papel del dueño |
| «tu agenda», «tu calendario» | «agenda real», «calendario real» |
| «minutos incluidos», «ausencia» (de alguien del equipo) | «ausencias» para clientes que no vienen: «cuando no vienen» |
| lo que cambia en el día de la dueña | «competitividad», «productividad», «ventaja competitiva», «24/7» |
| «IA» sin complejos | jerga técnica, nombres de proveedores (**Telnyx nunca**) |

«Agentes de voz» solo vale como nombre de la categoría de Retell, Vapi y compañía.

**Verdad del producto (no prometer de más):** cuando alguien del equipo falta, tu asistente marca
la ausencia, te dice qué citas tenía y te ayuda a recolocarlas una a una (busca dónde caben) y a
avisar a cada cliente; **tú dices a quién pasarlas**. No elige sola «al más cualificado» (ver
Pendientes). Conectar un calendario es opcional desde el 28-10: si no usas Google, Outlook ni
iCloud, la cita entra en la agenda de Alhabla.

## Sitemap nuevo (74 URLs → 74)

Sale la familia de comparativas contra HeyDiga, fonio y personas (6) y entra la familia contra
plataformas para montar tu propio agente de voz (6). El resto se queda, más corto.

| Familia | Rutas | Intención (qué viene a resolver quien llega) | Qué cambia |
|---|---|---|---|
| Portada | `/` | Entender en 10 s qué es y verlo funcionar | Diseño cerrado: solo textos y orden. Hero con la frase de calle; el asistente sube justo detrás del relato llamada→panel; FAQ de 10 a 6; fuera «llenar la agenda» |
| Planes | `/planes` | Elegir plan sin dudas | Fuera la entradilla de folleto, las tarjetas de beneficios y las comparativas viejas; «Antes de decidir» con calculadora, desvío y comparativas nuevas |
| Sectores (8) | `/peluqueria` `/barberia` `/centro-de-estetica` `/salon-de-unas` `/fisioterapia` `/pestanas-y-cejas` `/spa-y-masajes` `/peluqueria-canina` | «¿Esto sirve para MI negocio?» | **Plantilla nueva común a las 8** (abajo): de ~3.300 a ~800 palabras |
| Tu asistente | `/agenda-por-whatsapp` | Ver el «flipa»: una baja a mediodía resuelta por WhatsApp | Se rehace corta: demo arriba, regla de confianza, 4 cosas que se le piden, 5 preguntas |
| Idiomas (3) | `/recepcionista-ia-en-catalan` `…-euskera` `…-gallego` | «¿Atiende en mi lengua?» | Respuesta en la primera línea, la conversación arriba; fuera cifras y ley; ~350–450 palabras |
| Integraciones (5) | `/integraciones` + google-calendar, outlook, icloud, whatsapp | «¿Tengo que cambiar de agenda?» → no | Agenda de Alhabla como opción; guías de pasos cortas; WhatsApp con el ángulo «tus clientes no se bajan nada» |
| Desvío (16) | `/desvio-de-llamadas` + 14 operadores + iPhone/Android | Poner en marcha la promesa 1 | Fuera FAQ duplicadas y lo común repetido; el código del operador arriba |
| Comparativas (6) | `/comparativa` + `alhabla-vs-retell-ai`, `-vapi`, `-bland-ai`, `-synthflow`, `-elevenlabs` | Quien pregunta a una IA «cómo automatizo las llamadas de mi negocio» y le salen esos nombres | **Nuevas** (abajo). Vuelven al sitemap |
| Herramientas (6) | `/herramientas` + calculadora, plantillas, guion, contestador, política | Un recurso útil y gratis | Índice corto; la herramienta arriba y la explicación plegada; cierre con la promesa |
| Guías (2) | `/guias/ley-y-recepcionista-de-ia`, `/glosario` | «¿Es legal?» / qué significa X | Ley a la mitad y con WhatsApp; glosario sin enlaces a comparativas viejas y con «agente de voz con IA» |
| Empresa (3) | `/sobre-alhabla`, `/prensa`, `/novedades` | Confianza y referencia | Sobre: la frase del fundador y la regla; prensa con la frase de calle; novedades con la agenda de Alhabla |
| Otras | `/blog`, `/contacto`, `/register`, legal (2) | — | Entradillas; el artículo de precio sin HeyDiga, fonio, Habla ni IONOS |

Cabecera: «Preguntas» → «Tu asistente» (`/agenda-por-whatsapp`). Un solo texto para la acción de
probar en toda la web: **«Probar 7 días gratis»**; cierre: «Empezar ahora».

## Plantilla de landing de sector: «Las preguntas de la dueña»

Elegida por el fundador el 29-10 (contrato de dirección en
`.impeccable/surfaces/web-src-components-site-landing-tsx.md`). Mundo visual de `DESIGN.md`, sin
cambios. Unas 700–900 palabras visibles; ningún párrafo de más de 40 palabras; un acento.

1. **Hero** (≤35 palabras): H1 «Recepcionista de IA para {sector}» + una frase de calle del
   oficio; CTA «Escuchar una llamada» (demo del sector) y «Probar 7 días gratis»; dos marcas:
   «Tu número de siempre» · «Sin permanencia». Sin badge de estadística.
2. **«¿Y si suena mientras {trabajo}?»** — 2 líneas + la llamada de ejemplo del oficio
   transcrita (pide → mira tu agenda → reserva con quien toca → WhatsApp a la clienta).
3. **«¿Y si a mediodía falta alguien?»** — 2 líneas + el chat con tu asistente (ausencia →
   recolocar → avisar, con «Confirmar») + la regla «Con tus clientes manda Alhabla. Con tu agenda
   mandas tú».
4. **«¿Mis clientas tienen que bajarse algo?»** — No: teléfono y WhatsApp. 2 líneas + la
   confirmación por WhatsApp que recibe la clienta (cambiar o cancelar contestando).
5. **«¿Sabe cómo funciona una {peluquería}?»** — 3 llamadas típicas del oficio en una línea
   cada una (lo que piden → lo que hace) y el reparto por especialidad en una frase. En
   fisioterapia, además, el bloque corto de salud (≤50 palabras).
6. **«¿Cuánto cuesta?»** — 3 planes compactos (precio, minutos, una línea), prueba y fundador.
7. **Más preguntas** — 5 del oficio, plegadas.
8. **Cierre** negro con una frase del oficio y «Empezar ahora».

Sale de las landings: datos de sector y citas de prensa, ciudades, reparto como sección, la
guía de 1.300 palabras, beneficios, el relato iPhone→portátil (sigue en la portada), la
calculadora (vive en `/herramientas/calculadora-de-llamadas-perdidas`, que se enlaza), la tabla
de WhatsApp y los artículos. Los datos se parten en un fichero por sector (`web/src/lib/sectores/`)
y se borran los campos muertos.

## Comparativas nuevas: «Alhabla frente a montarte tu agente de voz»

Eje: **plataforma para construir tu agente** frente a **recepcionista ya hecha para tu negocio**
— quién la monta, qué hay que programar (instrucciones, herramientas, calendario, número, aviso
de IA, RGPD), qué cuesta de verdad (en dólares, por piezas) y qué no trae (WhatsApp con el
cliente, tu asistente). No se pelea el precio por minuto.

- `/comparativa`: índice «Alhabla frente a plataformas de agentes de voz», con una tabla corta
  de las cinco y una fila para PolyAI y Voiceflow (para grandes empresas: sin página propia).
- Una página por plataforma, por este orden de búsquedas: **Retell AI**, **Vapi**, **Bland AI**,
  **Synthflow** (desde junio de 2026 solo contrato Enterprise desde 30.000 $/año) y **ElevenLabs**
  (ElevenAgents y su recepcionista «Reception»).
- Cada una: veredicto en dos líneas, tabla de 8–10 filas con datos publicados y fuente, «Lo que
  te toca montar con X», «Cuándo elegir X» (honesto), «Cuándo elegir Alhabla», 4–5 preguntas,
  Fuentes con fecha y la nota de la Ley 3/1991, art. 10. Lo que no publican: «No consta en su
  web». Datos verificados el 29-10-2026 contra su web oficial.
- **Nunca se nombra a Telnyx**: ni en tablas, ni en preguntas, ni en fuentes, ni en comentarios
  que acaben en el HTML. Tampoco «Alhabla usó Retell».

Redirecciones (en `web/next.config.mjs`): `alhabla-vs-heydiga` y `alhabla-vs-fonio` → `/planes`;
`recepcionista-de-ia-vs-recepcionista-humana` → `/blog/cuanto-cuesta-una-recepcionista-de-ia`;
`…-vs-secretaria-telefonica` y `…-vs-centralita-virtual` →
`/blog/contestador-automatico-vs-recepcionista-virtual`. `/comparativa` no se redirige: se rehace.
Nunca un comodín `/comparativa/:path*`.

## Plantilla de páginas de guía (`PaginaGuia`)

La usan ~30 páginas. Cambios comunes: CTA de cabecera «Probar 7 días gratis», FAQ con 5 como
mucho, «Sigue leyendo» con 3 enlaces como mucho, y la foto de banco opcional para que las páginas
de producto puedan enseñar el producto en su lugar.

## Reparto del trabajo (una rama, ficheros sin solaparse)

1. **Sectores**: `site-landing.tsx`, `landing-hero.tsx`, `components/sector/*`, `lib/sectores/*`,
   `niche-landings.ts`, `niche-accents.ts` y las 8 rutas de sector.
2. **Comparativas**: `app/comparativa/**`, redirecciones, registro y sitemap, `llms.txt`, tests,
   pie, `/planes` y glosario.
3. **Portada y piezas compartidas**: `main-landing.tsx`, relato, simulación del asistente,
   guiones, `home-faqs.ts`, cabecera, registro, contacto, sobre, prensa, novedades, blog.
4. **Funciones e integraciones**: `/agenda-por-whatsapp`, idiomas, integraciones, `PaginaGuia`.
5. **Desvío, herramientas y guías**: las 16 de desvío, las 6 de herramientas, ley, artículo de
   precio.
6. **Integración**: build, lint, tests, `seo:similitud`, capturas, revisión de diseño, docs
   (`AGENTS.md`, `DESIGN.md`, `README.md`) y fechas `actualizado` del registro.

## Verificación

`npm run lint`, `npm run test` y `npm run build` en `web/`; `npm run seo:similitud` (umbral 0,50);
grep de vocabulario prohibido y de «Telnyx» en `web/src` y `web/content`; capturas de escritorio y
móvil de cada página del sitemap; revisión de diseño de Impeccable sobre las landings de sector.

## Pendientes y decisiones abiertas

- **Producto**: que tu asistente proponga sola a quién pasar cada cita de una ausencia (por
  especialidad y hueco). Hoy lo decide el dueño. Hasta que exista, la web no lo promete.
- **Nombre**: la recepcionista saluda como «su asistente de inteligencia artificial» (aviso legal
  del backend, `lib/idiomas/catalogo.ts`), y la web reserva «tu asistente» para el papel del
  dueño. Valorar cambiar el saludo a «la recepcionista de inteligencia artificial».
- **Nombre propio** para tu asistente: aplazado.
- **Riesgo competitivo**: Fresha (AI Concierge) y Treatwell (AI Receptionist, Reino Unido) meten
  una recepcionista dentro del programa de reservas. Comprobar si llegan a España.
- Tras desplegar: IndexNow con las rutas cambiadas y Search Console para las comparativas nuevas.
