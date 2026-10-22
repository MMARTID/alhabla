---
category: Marketing
---
«En tu bolsillo», la sección que cuenta una llamada de principio a fin (ancla
`#como-funciona`, a la que apunta el menú), en la portada y en las landings de
sector. Es scroll-driven: la sección es alta (510vh,
`lib/transicion-bolsillo-negocio.ts`) y el escenario se queda pegado (sticky)
mientras el scroll recorre tres pasos —«Contesta», «Busca hueco» y
«Confirma»—. A la izquierda, el texto de cada paso suma sus detalles; a la
derecha, un iPhone (render frontal) se balancea y se acerca mientras la
conversación y la agenda se rellenan en su pantalla. El riel de pasos lleva a
cada uno al pulsarlo.

Al acabar el tercer paso el teléfono se tumba (−90°) y se apaga, y después se
zambulle: se va al centro y se viene hacia la cámara hasta que su pantalla
negra cubre el escenario entero. En ese negro lo releva «En tu negocio»
(`EnTuNegocioScroll`), que solapa el final de esta sección: la cámara sale de
la pantalla del portátil y descubre el MacBook 3D. Las dos van siempre juntas
y en este orden.

Props opcionales: `guion` (un `GuionRelato` de `lib/relato-guiones.ts`: quién
llama, el servicio, el equipo, «tu clienta» o «tu paciente»; por defecto el
general de la portada) y `acento` (el `accent` del sector, para antetítulo,
riel e iconos; por defecto morado). Es ancho completo: va directamente en la
página, nunca dentro de una columna ni de una tarjeta. Por debajo de 1024 px el
movimiento es más contenido. Con `prefers-reduced-motion` se cambia por una
versión quieta con los tres pasos en tres tarjetas. Mientras está en pantalla
marca `data-relato` en `<html>`, que esconde el botón «Configurar cookies».

La tarjeta de este sistema enseña el escenario al llegar a la sección (paso 1).
