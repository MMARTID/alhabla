---
version: 1
slug: "web-src-components-escenas-de-oficio-tsx"
primary_target: "web/src/components/escenas-de-oficio.tsx"
related_targets: ["web/src/lib/escenas-de-oficio.ts","web/src/components/herramientas/calculadora-compacta.tsx","web/src/components/main-landing.tsx"]
---

# Escenas del oficio (portada, #sectores) y calculadora compacta (portada y sectores)

Modo: Persuade. Pieza dentro de un mundo hecho: DESIGN.md y el relato de la portada (burbujas,
filas de agenda, la cita nueva en el color del sector). No se reinventa nada.

Visitante: la dueña que ya ha visto la llamada y a su asistente en la portada y busca su oficio,
o llega a una landing de sector y quiere saber si le sale a cuenta. Acción: entrar en la landing
de su oficio; después, «Probar 7 días gratis» con el plan que le cabe.

Prueba disponible: el producto dibujado (la frase de quien llama, la cita con su profesional) y
la cuenta con sus propios números. Nada de fotos, testimonios ni cifras de sector.

Decisiones del fundador (29/30-10): fuera las fotos; ocho escenas, una por oficio, en el orden
del menú; horas distintas, siempre jueves; «¿Cuántos sois?» en la calculadora para que el plan
propuesto quepa de verdad.

## Direction contract

THESIS: Cada tarjeta es el segundo en que suena el teléfono en ese oficio y la cita que sale de
él: producto dibujado, no una tarjeta de icono, título y texto. Rechaza el acordeón de fotos de
banco y la rejilla de beneficios. La calculadora es la misma cuenta de /herramientas, en pequeño:
sus números, sus supuestos a la vista, nunca «pierdes X».

OWN-WORLD: blanco plano, tinta, Geist font-black, tarjetas rounded-3xl con borde linea; dentro,
la burbuja gris de quien llama, un hilo fino y la ficha de la agenda que pasa de hueco
discontinuo a cita rellena en el `soft`/`deep` de su sector, con el check en `strong`. Juntas,
las ocho fichas son un jueves de agenda con ocho colores («Un jueves de ejemplo, con nombres
inventados.» debajo). La calculadora: un panel partido, sin tarjeta dentro de tarjeta, con los
deslizadores del sistema a la izquierda y la cuenta a sangre en `oscuro`, cifra blanca en números
tabulares.

STORY: Ve a su oficio con las manos ocupadas, lee lo que diría su clienta, ve la cita ya hecha
con su profesional; al pasar el ratón o al quedarse en pantalla, una cosa que Alhabla hace en su
oficio y el enlace. Después pone sus llamadas y su precio y ve qué plan se paga con cuántas citas.

FIRST VIEWPORT: la sección llega tras «Puesta en marcha»: titular «Elige tu oficio y mira la
llamada que entra.» a la izquierda, y debajo la rejilla 4×2 desde lg (2 columnas de md a lg,
carrusel nativo con anclaje por debajo de md). Cada tarjeta: oficio arriba con el timbre en su
azulejo, «Suena y estás…», la burbuja, el hilo y la cita abajo. El CTA de la sección es la
tarjeta entera; el «Probar 7 días gratis» vive en la calculadora, justo debajo.

FORM: extensión de una superficie hecha (portada y landing de sector): sin tirada de conceptos,
la forma la fijó el fundador. Movimiento único, «el timbre que se vuelve cita»: el azulejo suena
dos veces, la frase entra, el hilo baja y la ficha se rellena (clip-path, salida exponencial),
una vez por tarjeta; el cajón sube como un chat que avanza, lo justo: el hilo se acorta primero y
la frase sube lo que el hilo no absorbe. Seed: ninguno (extensión).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Decisiones abiertas
- Detalle de peluquería canina: probarlo con `simular_conversacion` antes de darlo por cierto.
