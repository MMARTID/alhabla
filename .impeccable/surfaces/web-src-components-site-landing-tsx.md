---
version: 1
slug: "web-src-components-site-landing-tsx"
primary_target: "web/src/components/site-landing.tsx"
related_targets: []
---

---
version: 1
slug: "web-src-components-site-landing-tsx"
primary_target: "web/src/components/site-landing.tsx"
related_targets: ["web/src/lib/niche-landings.ts","web/src/components/landing-hero.tsx"]
---

# Landing de sector (alhabla.ai/peluqueria, /barberia… — 8 sectores)

Modo: Persuade. Mundo visual: el de DESIGN.md (se hereda, no se reinventa).

Visitante: dueña o dueño de un negocio con cita de ese oficio, llega desde Google, desde la
respuesta de una IA o desde el menú «Sectores» de la portada. Pregunta que trae: «¿esto sirve
para MI negocio?». Acción: «Empezar» (7 días de prueba) o escuchar una llamada.

Prueba disponible: el producto funcionando (llamada transcrita, WhatsApp de la clienta, chat con
tu asistente con «Confirmar», sus servicios con duración y quién los hace). Nada de testimonios
ni cifras propias (no hay clientes). Cifras de sector solo con fuente, y como mucho una.

Vocabulario: «recepcionista de IA» en titulares; «tu asistente» (nunca «el Gestor»); nunca
«virtual», «de voz», «agenda real», «competitividad». Regla de confianza visible: «Con tus
clientes manda Alhabla; con tu agenda mandas tú».

## Direction contract

THESIS: La landing de sector es la conversación de la dueña consigo misma: cinco preguntas que se
hace antes de probar, cada una contestada en dos líneas y demostrada con una pieza real del
producto. Rechaza la landing-folleto de quince secciones (datos de sector, ciudades, guía de 1.300
palabras, relato 3D, calculadora, tabla de WhatsApp) que hoy suma ~3.800 palabras.

OWN-WORLD: DESIGN.md tal cual: blanco plano, tinta #0a0a0a, Geist con titulares font-black, borde
de 1 px, paneles rounded-3xl, botones de 10 px y un único acento por página, el `accent.strong`
del sector. Las pruebas son piezas de producto dibujadas (burbujas de WhatsApp, transcripción en
el panel oscuro, filas de agenda con profesional), nunca tarjetas de icono + título + texto.

STORY: En un pantallazo entiende qué es y que contesta mientras ella trabaja. Baja por sus propias
preguntas (¿y si suena mientras trabajo?, ¿y si falta alguien?, ¿mis clientes tienen que bajarse
algo?, ¿sabe de mi oficio?, ¿cuánto cuesta?). Cree porque lo ve hacer, no porque se lo cuentan.
Termina en los planes y en «Empezar».

FIRST VIEWPORT: El hero actual (LandingHero con los hilos y el acento del sector): H1 «Recepcionista
de IA para {sector}», una frase en palabras del fundador, CTA negro «Probar 7 días gratis» (la
regla de vocabulario de PLAN-WEB-CONTENIDO.md para toda la web, 29-10; el cierre negro dice
«Empezar ahora») y secundario «Escuchar una llamada» (la demo). Al pie del viewport asoma la
primera pregunta.

FORM: «Las preguntas de la dueña», posición 4 de 7 en la lista ordenada (1 la llamada de principio
a fin, 2 tres cambios tres pruebas, 3 el día de la dueña, 4 las preguntas, 5 la ficha del oficio,
6 escúchala primero, 7 antes/después). Elegida por el fundador el 29-10-2026. Seed 4cc50b3b.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Decisiones abiertas
- Nombre propio para tu asistente: aplazado (hoy «tu asistente»).
- «Llenar el día» y captación: aparcado por el fundador.
