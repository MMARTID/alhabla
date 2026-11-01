import { prisma } from "../../lib/prisma.js";
import {
  COMPETIDOR_CONFIRMADO,
  analisisCaducado,
  porNombre,
} from "./competidores.js";
import type {
  DatoDeCompetidor,
  OrigenDeCompetidor,
  TipoDeDatoDeCompetidor,
} from "./esquemas.js";

/**
 * El comparador de precios (`GET /growth/admin/competidores/comparador`): lo
 * que ya dicen los análisis guardados de cada competidor, en una sola lectura,
 * para ponerlo al lado de Alhabla. Es INTELIGENCIA INTERNA, como el análisis
 * del que sale: no se cita en un borrador. No llama a ningún modelo ni hace
 * ninguna petición saliente.
 *
 * Los `propuesto` no salen: los sugiere un agente que ha leído una página
 * ajena y nadie los ha confirmado (`COMPETIDOR_CONFIRMADO`).
 */

// ── Formas de respuesta (contrato del panel útil) ────────────────────────

export type FilaDelComparador = {
  competidorId: string;
  nombre: string;
  dominio: string;
  url: string | null;
  origen: OrigenDeCompetidor;
  estado: "por_analizar" | "analizado" | "revisado";
  /** El ÚLTIMO análisis; null si aún no tiene ninguno. */
  analisis: null | {
    id: string;
    version: number;
    creadoEn: string;
    revisadoEn: string | null;
    caducado: boolean;
  };
  /** Del último análisis, solo los tipos que se comparan. */
  datos: DatoDeCompetidor[];
};

export type RespuestaDelComparador = {
  data: FilaDelComparador[];
  generadoEn: string;
};

/** Los datos que se comparan frente a Alhabla; el resto (producto, diferencias…) no. */
export const TIPOS_DE_DATO_COMPARABLES: ReadonlySet<TipoDeDatoDeCompetidor> =
  new Set(["precio", "plan", "integracion", "idioma", "canal", "limite"]);

/**
 * Del JSON guardado, solo los datos comparables. Se validó con Zod al
 * guardarlo, pero NO se vuelve a validar: la fecha de consulta tiene un
 * plazo que un análisis viejo ya no cumpliría. Si una fila no es lo que
 * debería, se descarta ese elemento, nunca un 500.
 */
export function datosComparables(datos: unknown): DatoDeCompetidor[] {
  if (!Array.isArray(datos)) return [];
  return datos.filter(
    (d): d is DatoDeCompetidor =>
      d !== null &&
      typeof d === "object" &&
      TIPOS_DE_DATO_COMPARABLES.has(
        (d as { tipo?: TipoDeDatoDeCompetidor }).tipo as TipoDeDatoDeCompetidor
      )
  );
}

/**
 * `GET /growth/admin/competidores/comparador`: todos los competidores
 * confirmados por nombre, cada uno con su último análisis. Una sola llamada a
 * Prisma (los competidores y su último análisis a la vez): el número de
 * consultas no crece con el de competidores. Como mucho hay 10 versiones por
 * competidor (el agente poda el resto al guardar).
 */
export async function comparadorDePrecios(): Promise<RespuestaDelComparador> {
  const ahora = new Date();
  const competidores = await prisma.growthCompetidor.findMany({
    where: COMPETIDOR_CONFIRMADO,
    select: {
      id: true,
      nombre: true,
      dominio: true,
      url: true,
      origen: true,
      estado: true,
      analisis: {
        orderBy: { version: "desc" },
        take: 1,
        select: {
          id: true,
          version: true,
          creadoEn: true,
          revisadoEn: true,
          datos: true,
        },
      },
    },
  });

  return {
    data: porNombre(competidores).map((c) => {
      const ultimo = c.analisis[0] ?? null;
      return {
        competidorId: c.id,
        nombre: c.nombre,
        dominio: c.dominio,
        url: c.url,
        origen: c.origen as OrigenDeCompetidor,
        estado: c.estado as FilaDelComparador["estado"],
        analisis: ultimo
          ? {
              id: ultimo.id,
              version: ultimo.version,
              creadoEn: ultimo.creadoEn.toISOString(),
              revisadoEn: ultimo.revisadoEn?.toISOString() ?? null,
              caducado: analisisCaducado(ultimo.creadoEn, ahora),
            }
          : null,
        datos: ultimo ? datosComparables(ultimo.datos) : [],
      };
    }),
    generadoEn: ahora.toISOString(),
  };
}
