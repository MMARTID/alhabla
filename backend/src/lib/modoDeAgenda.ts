/**
 * Modo de agenda del negocio (PLAN-AGENDA-ALHABLA.md, 28-10-2026). Desde
 * PLAN-AGENDA-PRINCIPAL.md (06-11-2026) YA NO DECIDE NADA: la agenda de
 * Alhabla es la de todos los negocios y el calendario conectado, un
 * complemento que recibe una copia de cada cita (calendar/copiaDeLaCita.ts).
 * La columna `Business.modoDeAgenda` y este fichero se mantienen solo para la
 * app anterior y se borran en la fase 7 del plan.
 *
 * Valores históricos: `sin_elegir`, `alhabla`, `externo`.
 */

export const MODOS_DE_AGENDA = ["sin_elegir", "alhabla", "externo"] as const;
export type ModoDeAgenda = (typeof MODOS_DE_AGENDA)[number];

/** Nombre visible del modo `alhabla` (decisión D6 del plan). */
export const NOMBRE_AGENDA_DE_ALHABLA = "Agenda de Alhabla";

export function normalizarModoDeAgenda(
  valor: string | null | undefined
): ModoDeAgenda {
  return (MODOS_DE_AGENDA as readonly string[]).includes(valor ?? "")
    ? (valor as ModoDeAgenda)
    : "sin_elegir";
}

/** El negocio reserva en la agenda de Alhabla. Acepta cualquier objeto con
 * `modoDeAgenda` (Business de Prisma, la fila de la caché de voz, un
 * negocio serializado) y, sin el campo, responde que no. */
export function reservaEnAlhabla(
  business: { modoDeAgenda?: string | null } | null | undefined
): boolean {
  return normalizarModoDeAgenda(business?.modoDeAgenda) === "alhabla";
}
