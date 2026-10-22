import "./_sin-movimiento";
import * as React from "react";
import { MainLanding } from "alhabla-web-ui";

/**
 * La portada entera (`/`), tal cual la monta `app/page.tsx`. Es una página,
 * no una pieza: la tarjeta enseña su primer viewport (cabecera y hero con los
 * hilos de voz) y el resto vive en el código del bundle, para que el agente de
 * diseño componga y proponga cambios sobre la portada real.
 *
 * Con `_sin-movimiento`: la tarjeta es una captura estática y, sin él, el
 * titular del hero (`Reveal`) saldría a mitad de aparecer. Las secciones con
 * escenario fijo («En tu bolsillo», «En tu negocio») pasan por eso a su
 * versión quieta; sus tarjetas propias (`LlamadaScroll`, `EnTuNegocioScroll`)
 * enseñan la animación.
 */
export function Portada() {
  return <MainLanding />;
}
