import type { Prisma } from "@prisma/client";
import { DIAS_PARA_CADUCAR_UN_ANALISIS } from "./esquemas.js";

/**
 * Piezas puras de la competencia que comparten las reglas duras, la API del
 * administrador y la del agente. Sin acceso a la base de datos ni a
 * `service.ts`: lo importan los dos (evita un ciclo de imports).
 */

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Los competidores que APLICAN reglas duras: la puerta «es un competidor» al
 * calificar, la regla 3 de cumplimiento (`comparativa_con_fuente`) y la lista
 * de competidores del contexto del agente. Un `propuesto` (lo sugiere el
 * agente tras leer una página ajena) no cuenta hasta que el administrador lo
 * acepta: así una página hostil no puede hacer que el agente declare
 * «competidor» a un dominio legítimo y se descarte lo que viene de él.
 *
 * TODO sitio que lea `growthCompetidor` para aplicar una regla pasa por aquí.
 */
export const COMPETIDOR_CONFIRMADO = {
  estado: { not: "propuesto" },
} satisfies Prisma.GrowthCompetidorWhereInput;

/** ¿Aplica reglas duras un competidor en este estado? */
export function aplicaReglasDuras(estado: string): boolean {
  return estado !== "propuesto";
}

/** Un análisis más antiguo de 90 días cuenta como caducado (se calcula, no se guarda). */
export function analisisCaducado(creadoEn: Date, ahora: Date): boolean {
  return (
    ahora.getTime() - creadoEn.getTime() >
    DIAS_PARA_CADUCAR_UN_ANALISIS * MS_POR_DIA
  );
}

export type MotivoDeAnalisis = "por_analizar" | "caducado";

/**
 * ¿Tiene que analizarlo el agente? Un `propuesto` nunca (hasta que se
 * acepta); un `por_analizar` siempre; un `analizado` o `revisado` solo si su
 * último análisis ya caducó (o, por una fila incoherente, no tiene ninguno).
 */
export function motivoDeAnalisis(
  competidor: { estado: string },
  ultimoAnalisisCreadoEn: Date | null,
  ahora: Date
): MotivoDeAnalisis | null {
  if (competidor.estado === "propuesto") return null;
  if (competidor.estado === "por_analizar") return "por_analizar";
  if (!ultimoAnalisisCreadoEn) return "por_analizar";
  return analisisCaducado(ultimoAnalisisCreadoEn, ahora) ? "caducado" : null;
}

/** El número de datos de un análisis, sea lo que sea que haya en el JSON. */
export function numeroDeDatos(datos: Prisma.JsonValue | null): number {
  return Array.isArray(datos) ? datos.length : 0;
}

/** «heydiga.ai» → «Heydiga»: el nombre por defecto de un competidor dado de alta por URL. */
export function nombrePorDefectoDeDominio(dominio: string): string {
  const etiqueta = dominio.split(".")[0] ?? dominio;
  return etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1);
}

const COLACION = new Intl.Collator("es", { sensitivity: "base" });

/**
 * Por nombre, sin distinguir mayúsculas ni tildes («fonio» antes que «HeyDiga»).
 * El `ORDER BY` de Postgres depende de la colación de la base (en una imagen
 * Alpine ordena por bytes y en Cloud SQL no), así que el orden final se fija
 * aquí.
 */
export function porNombre<T extends { nombre: string; id: string }>(
  filas: readonly T[]
): T[] {
  return [...filas].sort(
    (a, b) =>
      COLACION.compare(a.nombre, b.nombre) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}
