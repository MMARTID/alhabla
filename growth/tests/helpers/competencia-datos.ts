import type {
  AnalisisDeCompetidor,
  CompetidorDetalle,
  DatoDeCompetidor,
} from "@/lib/types";
import { competidor } from "./d2-datos";

/**
 * Fábricas de datos para los tests de la competencia. El resumen es
 * `competidor()` de `d2-datos`; aquí están el dato, el análisis y el detalle.
 */

export function datoDeCompetidor(
  cambios: Partial<DatoDeCompetidor> = {}
): DatoDeCompetidor {
  return {
    tipo: "producto",
    etiqueta: "Recepcionista telefónica",
    texto: "Contesta las llamadas del negocio.",
    urlFuente: "https://rival.example/producto",
    consultadoEn: "2026-10-28T09:00:00.000Z",
    ...cambios,
  };
}

export function analisisDeCompetidor(
  cambios: Partial<AnalisisDeCompetidor> = {}
): AnalisisDeCompetidor {
  return {
    id: "an-1",
    version: 1,
    resumen: "Una recepcionista de IA para pymes.",
    datos: [datoDeCompetidor()],
    creadoEn: "2026-10-28T09:00:00.000Z",
    creadoPor: "agente-de-pruebas",
    revisadoEn: null,
    notaDeRevision: null,
    ...cambios,
  };
}

/** Un detalle coherente: el resumen sale del último análisis y las versiones de todos. */
export function detalleDeCompetidor(
  cambios: Partial<CompetidorDetalle> = {},
  analisis: readonly AnalisisDeCompetidor[] = []
): CompetidorDetalle {
  const ultimo = analisis[analisis.length - 1] ?? null;
  return {
    ...competidor({
      id: "co-1",
      nombre: "Rival",
      dominio: "rival.example",
      url: "https://rival.example/",
      origen: "manual",
      estado: ultimo ? "analizado" : "por_analizar",
      oportunidades: 0,
      menciones: 0,
      analisis: ultimo
        ? {
            id: ultimo.id,
            version: ultimo.version,
            creadoEn: ultimo.creadoEn,
            revisadoEn: ultimo.revisadoEn,
            numDatos: ultimo.datos.length,
            caducado: false,
          }
        : null,
    }),
    ultimoAnalisis: ultimo,
    versiones: [...analisis]
      .sort((a, b) => b.version - a.version)
      .map((a) => ({
        id: a.id,
        version: a.version,
        creadoEn: a.creadoEn,
        revisadoEn: a.revisadoEn,
        numDatos: a.datos.length,
      })),
    ...cambios,
  };
}
