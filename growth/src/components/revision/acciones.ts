import type { AccionDeDecision, AccionDisponible } from "@/lib/types";

/** El orden en el que se ofrecen las acciones en la Revisión. */
export const ORDEN_DE_ACCIONES: readonly AccionDeDecision[] = [
  "aprobar",
  "devolver",
  "descartar",
  "marcar_gestionado",
  "conseguido",
  "sin_respuesta",
  "rechazado",
];

/**
 * El contrato antiguo mandaba SIEMPRE las siete acciones y las que no tocaban
 * en ese estado iban apagadas con un motivo genérico («Una oportunidad
 * pendiente_aprobacion no admite esta acción»), con el identificador interno
 * del estado a la vista. Eso no es una regla que explicar, es una acción que
 * no toca: no se pinta.
 */
const MOTIVO_DE_ACCION_QUE_NO_TOCA = /no admite/i;

/**
 * Las acciones que la Revisión pinta: UNA por cada acción alcanzable que manda
 * el backend, en el orden de siempre.
 *
 * - Se ignora lo que no es una acción conocida (no se pinta un identificador
 *   crudo) y las repetidas (gana la primera).
 * - Una acción apagada se queda solo si trae un motivo que explique qué regla
 *   la impide; sin motivo se le pone uno genérico al pintarla.
 * - Una acción apagada con el motivo genérico del contrato antiguo no se
 *   pinta (ver arriba).
 */
export function accionesVisibles(
  acciones: readonly AccionDisponible[]
): AccionDisponible[] {
  const vistas = new Map<AccionDeDecision, AccionDisponible>();
  for (const accion of acciones) {
    if (!ORDEN_DE_ACCIONES.includes(accion.accion)) continue;
    if (vistas.has(accion.accion)) continue;
    if (
      !accion.habilitada &&
      accion.motivo &&
      MOTIVO_DE_ACCION_QUE_NO_TOCA.test(accion.motivo)
    ) {
      continue;
    }
    vistas.set(accion.accion, accion);
  }
  return ORDEN_DE_ACCIONES.flatMap((nombre) => {
    const encontrada = vistas.get(nombre);
    return encontrada ? [encontrada] : [];
  });
}
