/**
 * Modo de agenda del negocio (PLAN-AGENDA-ALHABLA.md): dónde se reservan las
 * citas. El modo se ELIGE, no se deduce: una conexión caducada nunca pasa
 * el negocio a `alhabla`, y conectar un calendario lo pasa a `externo`.
 *
 * - `sin_elegir`: sin calendario. La recepcionista atiende y toma nota, pero
 *   no da hora ni reserva (fase 0).
 * - `alhabla`: reserva solo en nuestra base de datos. La conexión externa que
 *   pudiera quedar se ignora (calendar/conexion.ts, `agendaPropia`).
 * - `externo`: reserva en Google, Outlook o iCloud, con la regla de siempre
 *   (nunca a ciegas: sin conexión operativa no se reserva).
 *
 * La regla de «¿se puede reservar?» vive en `puedeReservar` de
 * calendar/conexion.ts, porque necesita la conexión resuelta.
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
