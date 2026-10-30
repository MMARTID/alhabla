import type { GrowthEstadoOportunidad as EstadoOportunidad } from "@prisma/client";

/**
 * Máquina de estados de una oportunidad de Alhabla Growth
 * (PLAN-GROWTH.md § 4). Es la única fuente de verdad de qué cambios de
 * estado existen y quién los puede provocar:
 *
 * - `agente`: la sesión programada, con su token. Descubre, califica,
 *   investiga y redacta; nunca aprueba ni da nada por hecho.
 * - `admin`: el fundador, desde el dashboard. Aprueba, devuelve, descarta y
 *   registra lo que ha hecho a mano.
 * - `sistema`: el propio backend, tras evaluar las reglas duras o al vencer
 *   una fecha.
 */
export type Actor = "agente" | "admin" | "sistema";

type Transiciones = Record<
  EstadoOportunidad,
  Partial<Record<EstadoOportunidad, readonly Actor[]>>
>;

const TRANSICIONES: Transiciones = {
  detectada: {
    calificada: ["agente"],
    descartada: ["agente", "admin"],
  },
  calificada: {
    investigada: ["agente"],
    descartada: ["agente", "admin"],
  },
  investigada: {
    con_borrador: ["agente"],
    descartada: ["agente", "admin"],
  },
  // Estado de paso: el backend evalúa las reglas duras en la misma petición
  // que crea el borrador y lo deja en `pendiente_aprobacion` o `bloqueada`.
  con_borrador: {
    pendiente_aprobacion: ["sistema"],
    bloqueada: ["sistema"],
    descartada: ["admin"],
  },
  bloqueada: {
    con_borrador: ["agente"],
    descartada: ["admin"],
  },
  pendiente_aprobacion: {
    aprobada: ["admin"],
    devuelta: ["admin"],
    descartada: ["admin"],
  },
  devuelta: {
    con_borrador: ["agente"],
    descartada: ["admin"],
  },
  aprobada: {
    gestionada: ["admin"],
    caducada: ["sistema"],
    descartada: ["admin"],
  },
  gestionada: {
    conseguida: ["admin"],
    sin_respuesta: ["admin"],
  },
  conseguida: {},
  sin_respuesta: {},
  descartada: {},
  caducada: {},
};

export function puedeTransicionar(
  desde: EstadoOportunidad,
  hasta: EstadoOportunidad,
  actor: Actor
): boolean {
  return TRANSICIONES[desde][hasta]?.includes(actor) ?? false;
}

/** A qué estados puede llevar esa oportunidad un actor concreto. */
export function transicionesPosibles(
  desde: EstadoOportunidad,
  actor: Actor
): EstadoOportunidad[] {
  return (
    Object.entries(TRANSICIONES[desde]) as [
      EstadoOportunidad,
      readonly Actor[],
    ][]
  )
    .filter(([, actores]) => actores.includes(actor))
    .map(([estado]) => estado);
}

export function esTerminal(estado: EstadoOportunidad): boolean {
  return Object.keys(TRANSICIONES[estado]).length === 0;
}
