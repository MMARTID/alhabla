import type { Tono } from "@/lib/etiquetas";
import type {
  DisparadorDeEjecucion,
  EjecucionBase,
  ModuloDeEjecucion,
} from "@/lib/types";

/**
 * Las piezas puras de la vista de Ejecuciones. `resumen` y `modulos` son JSON
 * que escribe el agente (y, al cerrar, el servidor): aquí se leen sin fiarse
 * de su forma, para que un dato raro no tumbe la pantalla.
 */

export const ETIQUETA_DE_DISPARADOR: Record<DisparadorDeEjecucion, string> = {
  programada: "Programada",
  manual: "Manual",
};

type EstadoDeModulo = ModuloDeEjecucion["estado"];

const ESTADOS_DE_MODULO: readonly EstadoDeModulo[] = [
  "en_curso",
  "ok",
  "parcial",
  "error",
  "omitido",
];

export const ETIQUETA_DE_ESTADO_DE_MODULO: Record<EstadoDeModulo, string> = {
  en_curso: "En curso",
  ok: "Correcto",
  parcial: "Parcial",
  error: "Con error",
  omitido: "Omitido",
};

export const TONO_DE_ESTADO_DE_MODULO: Record<EstadoDeModulo, Tono> = {
  en_curso: "morado",
  ok: "exito",
  parcial: "aviso",
  error: "error",
  omitido: "neutro",
};

/** Los nombres de módulo que escribe el agente, en castellano para la persona. */
const ETIQUETA_DE_MODULO = new Map<string, string>([
  ["discovery", "Descubrimiento"],
  ["descubrimiento", "Descubrimiento"],
  ["calificacion", "Calificación"],
  ["qualification", "Calificación"],
  ["investigacion", "Investigación"],
  ["research", "Investigación"],
  ["conocimiento", "Conocimiento"],
  ["knowledge", "Conocimiento"],
  ["redaccion", "Redacción"],
  ["response", "Redacción"],
  ["cumplimiento", "Cumplimiento"],
  ["compliance", "Cumplimiento"],
]);

/**
 * El nombre legible de un módulo. Las claves de `modulos` las escribe el
 * agente: las que no conocemos salen tal cual, sin guiones bajos.
 */
export function etiquetaDeModulo(clave: string): string {
  const conocida = ETIQUETA_DE_MODULO.get(clave.toLowerCase());
  if (conocida) return conocida;
  const texto = clave.replace(/[_-]+/g, " ").trim();
  return texto === "" ? clave : texto.charAt(0).toUpperCase() + texto.slice(1);
}

function comoObjeto(valor: unknown): Record<string, unknown> | null {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : null;
}

function comoTexto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() !== "" ? valor : null;
}

function comoNumero(valor: unknown): number | null {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

// --- Módulos ----------------------------------------------------------------

export type ModuloLeido = {
  clave: string;
  /** `null` si el agente no dio un estado conocido: sale como «Sin estado». */
  estado: EstadoDeModulo | null;
  /** Segundos, si declaró inicio y fin válidos. */
  duracion: number | null;
  error: string | null;
  notas: string | null;
};

function duracionEntre(inicio: unknown, fin: unknown): number | null {
  const desde = comoTexto(inicio);
  const hasta = comoTexto(fin);
  if (!desde || !hasta) return null;
  const ms = Date.parse(hasta) - Date.parse(desde);
  return Number.isFinite(ms) && ms >= 0 ? Math.round(ms / 1000) : null;
}

/** Los módulos de una ejecución, tal como se pueden pintar sin riesgo. */
export function leerModulos(modulos: unknown): ModuloLeido[] {
  const objeto = comoObjeto(modulos);
  if (!objeto) return [];
  return Object.entries(objeto).map(([clave, valor]) => {
    const modulo = comoObjeto(valor);
    const estado = modulo?.estado;
    return {
      clave,
      estado: ESTADOS_DE_MODULO.find((e) => e === estado) ?? null,
      duracion: modulo ? duracionEntre(modulo.inicio, modulo.fin) : null,
      error: modulo ? comoTexto(modulo.error) : null,
      notas: modulo ? comoTexto(modulo.notas) : null,
    };
  });
}

// --- Resumen ------------------------------------------------------------------

export type ContadorLeido = { clave: string; n: number; texto: string };

const CONTADORES: ReadonlyArray<{
  clave: string;
  singular: string;
  plural: string;
}> = [
  { clave: "candidatas", singular: "candidata", plural: "candidatas" },
  { clave: "calificadas", singular: "calificada", plural: "calificadas" },
  { clave: "descartadas", singular: "descartada", plural: "descartadas" },
  { clave: "borradores", singular: "borrador", plural: "borradores" },
  { clave: "bloqueadas", singular: "bloqueada", plural: "bloqueadas" },
];

function contadoresDe(objeto: Record<string, unknown> | null): ContadorLeido[] {
  if (!objeto) return [];
  return CONTADORES.flatMap(({ clave, singular, plural }) => {
    const n = comoNumero(objeto[clave]);
    return n === null ? [] : [{ clave, n, texto: n === 1 ? singular : plural }];
  });
}

export type ResumenLeido = {
  contadores: ContadorLeido[];
  /** Descartes por código, con al menos uno. */
  motivos: Array<{ codigo: string; n: number }>;
  notas: string | null;
  /**
   * Lo que declaró el agente al cerrar, aparte de lo que midió el servidor
   * (`declaradoPorElAgente`). `null` si no hay.
   */
  declarado: ContadorLeido[] | null;
};

export function leerResumen(resumen: unknown): ResumenLeido {
  const objeto = comoObjeto(resumen);
  const motivos = Object.entries(comoObjeto(objeto?.descartesPorMotivo) ?? {})
    .flatMap(([codigo, valor]) => {
      const n = comoNumero(valor);
      return n !== null && n > 0 ? [{ codigo, n }] : [];
    })
    .sort((a, b) => b.n - a.n);
  const declarado = contadoresDe(comoObjeto(objeto?.declaradoPorElAgente));
  return {
    contadores: contadoresDe(objeto),
    motivos,
    notas: comoTexto(objeto?.notas),
    declarado: declarado.length > 0 ? declarado : null,
  };
}

/** Un número que el backend añadió al detalle y los tipos compartidos aún no recogen. */
export function numeroOpcional(origen: object, clave: string): number | null {
  return comoNumero((origen as Record<string, unknown>)[clave]);
}

// --- Ejecuciones colgadas ---------------------------------------------------

/** Una ejecución `en_curso` más allá de esto se da por interrumpida. */
export const HORAS_PARA_DAR_POR_COLGADA = 6;

export function estaColgada(
  ejecucion: Pick<EjecucionBase, "estado" | "inicio">,
  ahora: Date = new Date()
): boolean {
  if (ejecucion.estado !== "en_curso") return false;
  const inicio = Date.parse(ejecucion.inicio);
  return (
    Number.isFinite(inicio) &&
    ahora.getTime() - inicio > HORAS_PARA_DAR_POR_COLGADA * 3_600_000
  );
}
