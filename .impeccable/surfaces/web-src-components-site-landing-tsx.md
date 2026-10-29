---
version: 1
slug: "web-src-components-site-landing-tsx"
primary_target: "web/src/components/site-landing.tsx"
related_targets: ["web/src/lib/sectores/tipos.ts","web/src/lib/relato-guiones.ts","web/src/lib/gestor-guiones.ts"]
---

# Landing de sector (alhabla.ai/peluqueria, /barberia… — 8 sectores)

Modo: Persuade. Mundo visual: el de DESIGN.md más el 3D de la portada (se hereda, no se reinventa).

Visitante: dueña o dueño de un negocio con cita de ese oficio, llega desde Google, desde la
respuesta de una IA o desde el menú «Sectores» de la portada. Pregunta que trae: «¿esto sirve
para MI negocio?». Acción: «Probar 7 días gratis» o escuchar una llamada.

Prueba disponible: el producto funcionando (la llamada en el iPhone que pasa al panel del
portátil, tu asistente por WhatsApp con el panel reaccionando, el WhatsApp de la clienta, sus
servicios con quién los hace). Nada de testimonios ni cifras propias (no hay clientes).

Vocabulario: «recepcionista de IA» en titulares; «tu asistente» (nunca «el Gestor»); nunca
«virtual», «de voz», «agenda real», «competitividad». Regla de confianza visible: «Con tus
clientes manda Alhabla; con tu agenda mandas tú».

## Direction contract

THESIS: Texto y 3D compensados. Las preguntas de la dueña siguen siendo el hilo, pero las dos
grandes se contestan con escenas de la portada movidas por el guion del oficio (la llamada que
pasa del iPhone al panel del portátil; la ausencia resuelta por WhatsApp con el panel al lado),
y el resto con dos líneas y una pieza plana. Rechaza el folleto de quince secciones y también el
muro de texto de la v1 del 29-10 («demasiado texto junto», palabras del fundador).

OWN-WORLD: DESIGN.md tal cual (blanco plano, tinta, Geist font-black, paneles rounded-3xl, un
acento por página: el `accent.strong` del sector) más el mundo 3D de la portada: el render del
iPhone y el MacBook glTF (three.js) con el panel de Alhabla, teñidos con el acento del sector.

STORY: Entiende qué es en el hero. Lee su primera pregunta en dos líneas y la ve pasar: suena,
contesta, busca hueco, reserva, la cita llega al panel. Ve que la clienta no se baja nada. Ve a su
asistente resolver una ausencia con «Confirmar». Comprueba que sabe de su oficio, ve el precio,
resuelve dudas y empieza.

FIRST VIEWPORT: LandingHero sin cambios (H1 «Recepcionista de IA para {sector}», frase del
fundador, CTA negro «Probar 7 días gratis», secundario «Escuchar una llamada», hilos con el
acento). Al pie asoma la primera pregunta, centrada y corta, que abre la escena del iPhone.

FORM: «Las preguntas de la dueña» fusionada con «la llamada de principio a fin» (posiciones 4 y 1
de la lista del 29-10). Sin tirada nueva: la fijó el fundador el 29-10 por la tarde, con sus
palabras «me gustaría utilizar la animación 3D que tengo en la general» y «quiero que haya texto y
3d compensados». Ritmo: texto → escena → texto y pieza → escena → tabla → precio → preguntas →
cierre. Seed de la v1 de esa mañana, la que esta forma sustituye: 4cc50b3b.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Decisiones abiertas
- Nombre propio para tu asistente: aplazado (hoy «tu asistente»).
- «Llenar el día» y captación: aparcado por el fundador.
