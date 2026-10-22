import "./_sin-movimiento";
import * as React from "react";
import { SiteLanding, nicheLandings } from "alhabla-web-ui";

/**
 * Las cinco landings de sector enteras, cada una con su copy, su guion del
 * relato y su color (`nicheLandings`), como las montan `app/<sector>/page.tsx`.
 * La tarjeta enseña el primer viewport; el resto de la página va en el
 * bundle. Con `_sin-movimiento` por lo mismo que la portada (ver
 * MainLanding.tsx).
 */
export function Peluqueria() {
  return <SiteLanding content={nicheLandings.peluqueria} />;
}

export function Barberia() {
  return <SiteLanding content={nicheLandings.barberia} />;
}

export function SalonDeUnas() {
  return <SiteLanding content={nicheLandings["salon-de-unas"]} />;
}

export function CentroDeEstetica() {
  return <SiteLanding content={nicheLandings["centro-de-estetica"]} />;
}

export function Fisioterapia() {
  return <SiteLanding content={nicheLandings.fisioterapia} />;
}
