import type { AccionDeDecision, EstadoDeOportunidad } from "../types";

/**
 * La máquina de estados de una oportunidad, COPIADA de
 * backend/src/modules/growth/estados.ts (`TRANSICIONES`): la demostración
 * aplica las mismas reglas que el backend para que se pueda recorrer
 * Bandeja → Revisión → Aprobar → Historial sin sorpresas. Un test
 * (tests/lib/paridad-de-estados.test.ts) lee el fichero del backend y falla
 * si las dos tablas se separan.
 */
export type Actor = "agente" | "admin" | "sistema";

export const TRANSICIONES: Record<
  EstadoDeOportunidad,
  Partial<Record<EstadoDeOportunidad, readonly Actor[]>>
> = {
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
  con_borrador: {
    pendiente_aprobacion: ["sistema"],
    bloqueada: ["sistema"],
    descartada: ["admin"],
  },
  bloqueada: {
    con_borrador: ["agente"],
    pendiente_aprobacion: ["sistema"],
    descartada: ["admin"],
  },
  pendiente_aprobacion: {
    aprobada: ["admin"],
    devuelta: ["admin"],
    descartada: ["admin"],
    bloqueada: ["sistema"],
  },
  devuelta: {
    con_borrador: ["agente"],
    descartada: ["admin"],
  },
  aprobada: {
    gestionada: ["admin"],
    caducada: ["sistema"],
    descartada: ["admin"],
    bloqueada: ["sistema"],
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
  desde: EstadoDeOportunidad,
  hasta: EstadoDeOportunidad,
  actor: Actor
): boolean {
  return TRANSICIONES[desde][hasta]?.includes(actor) ?? false;
}

/** A qué estados puede llevar esa oportunidad un actor concreto. */
export function transicionesPosibles(
  desde: EstadoDeOportunidad,
  actor: Actor
): EstadoDeOportunidad[] {
  return (
    Object.entries(TRANSICIONES[desde]) as [
      EstadoDeOportunidad,
      readonly Actor[],
    ][]
  )
    .filter(([, actores]) => actores.includes(actor))
    .map(([estado]) => estado);
}

/**
 * A qué estado lleva cada decisión del administrador (copia de
 * `ESTADO_POR_ACCION` de service.ts). Que el destino diga que no
 * (`rechazado`) deja la oportunidad en `sin_respuesta`: en la interfaz se
 * llama «Cerrada sin éxito».
 */
export const ESTADO_POR_ACCION: Record<AccionDeDecision, EstadoDeOportunidad> =
  {
    aprobar: "aprobada",
    devolver: "devuelta",
    descartar: "descartada",
    marcar_gestionado: "gestionada",
    conseguido: "conseguida",
    sin_respuesta: "sin_respuesta",
    rechazado: "sin_respuesta",
  };
