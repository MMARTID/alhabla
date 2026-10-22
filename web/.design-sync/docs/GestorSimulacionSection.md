---
category: Marketing
---
«Y cuando algo cambia, se lo dices por WhatsApp»: el Gestor en acción, en la
portada y en las cinco landings de sector. A la derecha, un iPhone con el
WhatsApp del dueño hablando con Alhabla; detrás, el MacBook 3D con el panel
(agenda, horario, servicios…) reaccionando a cada cambio. La conversación se
reproduce sola en cuanto el teléfono se ve: el dueño teclea en tiempo real, el
Gestor PROPONE el cambio («¿Confirmas? …» con Confirmar · Cancelar), el dueño
confirma y el cambio aterriza en el panel con un aviso, un destello y un aro
en lo que ha cambiado. Encadena tres situaciones (una vuelta, ~30 s); arriba
se puede saltar a cualquiera, pausar o volver a verla, y se pausa con el
ratón sobre el teléfono.

Lo que dice es lo que el Gestor hace de verdad: nada cambia sin pulsar
Confirmar, una propuesta cada vez, y tras mover una cita pregunta si avisa al
cliente. No inventes acciones ni respuestas que no estén en los guiones.

Props: `data` (un `OwnerAssistant`: badge, título, descripción y los tres
ejemplos; `generalOwnerAssistant` en la portada,
`nicheLandings.<sector>.ownerAssistant` en cada sector), `guion` (un
`GuionGestor`: `GUION_GESTOR_GENERAL` o `GUIONES_GESTOR.<sector>`, con los
nombres, servicios y situaciones de cada oficio), `accent` opcional (el color
del sector; el panel sigue en morado porque es la app) y `masInfoHref`
opcional (el enlace a la página del Gestor, `/agenda-por-whatsapp`).

Es ancho completo. El portátil 3D solo se monta en escritorio (≥1024 px) y al
acercarse la sección; en móvil manda el teléfono y lo que cambia se resume en
chips debajo. Con `prefers-reduced-motion`, sin cronómetro: cada situación se
enseña entera. El crédito del modelo 3D (CC BY 4.0, jackbaeten) lo exige su
licencia: no lo quites.
