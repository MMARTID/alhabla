import * as React from "react";
import {
  GestorSimulacionSection,
  GUION_GESTOR_GENERAL,
  GUIONES_GESTOR,
  generalOwnerAssistant,
  nicheLandings,
} from "alhabla-web-ui";

/**
 * Sin `_sin-movimiento` a propósito, como «En tu bolsillo»: con movimiento
 * reducido la conversación sale entera y quieta, sin el tecleo ni el cambio
 * aterrizando en el panel, que es lo que hay que ver. La reproducción arranca
 * sola en cuanto el teléfono está a la vista.
 */

/** La portada: guion general (peluquería) en morado de marca. */
export function Portada() {
  return <GestorSimulacionSection data={generalOwnerAssistant} guion={GUION_GESTOR_GENERAL} />;
}

/**
 * Una landing de sector: su copy, su guion (nombres, servicios y las dos
 * situaciones de su oficio) y su color, con el enlace a la página del Gestor.
 */
export function Fisioterapia() {
  const fisio = nicheLandings.fisioterapia;
  return (
    <GestorSimulacionSection
      data={fisio.ownerAssistant}
      guion={GUIONES_GESTOR.fisioterapia}
      accent={fisio.accent}
      masInfoHref="/agenda-por-whatsapp"
    />
  );
}
