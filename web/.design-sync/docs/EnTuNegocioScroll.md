---
category: Marketing
---
«En tu negocio», la sección que va justo después de «En tu bolsillo»
(`LlamadaScroll`) y enseña el otro lado: lo que ve el dueño. Misma mecánica: la
sección es alta (470vh, `lib/transicion-bolsillo-negocio.ts`) con el escenario
pegado (sticky) y el scroll recorre tres pasos —«Tu panel», «Llamadas» y
«Gestor»—. El protagonista es un MacBook en 3D (three.js); en su pantalla, en
HTML proyectado sobre la tapa (nítido a cualquier distancia), pasan el panel,
el detalle de una llamada y el Gestor.

La sección solapa el final de «En tu bolsillo» (130vh de margen negativo). Su
entrada es la salida de una zambullida: el teléfono de la sección anterior se
ha venido a cámara hasta cubrirlo todo de negro, y en ese negro la cámara está
dentro de la pantalla del portátil, bloqueada. Se aleja deprisa y frena,
descubriendo el portátil; en la pantalla aparecen la hora y el aviso de
WhatsApp de la cita que se acaba de reservar, se desbloquea al panel y el
portátil se aparta a su sitio mientras entra el título.

Props opcionales: `guion` y `acento`, los mismos que `LlamadaScroll` (pásale
los mismos a las dos). Es ancho completo: va directamente en la página.
three.js y el modelo (`public/modelos/macbook.glb`) se cargan al acercarse la
sección. Con `prefers-reduced-motion`, sin WebGL o si el modelo no llega, se
cambia por una versión quieta con los tres pasos en tres tarjetas (y el
teléfono de «En tu bolsillo» no se zambulle). El crédito del modelo al pie (CC
BY 4.0, jackbaeten) lo exige su licencia: no lo quites.

La tarjeta de este sistema enseña el escenario al llegar a la sección (paso 1).
