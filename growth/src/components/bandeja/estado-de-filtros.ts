import { ESTADOS_DE_LA_BANDEJA } from "@/lib/etiquetas";
import {
  ESTADOS_DE_OPORTUNIDAD,
  OBJETIVOS,
  TIPOS_DE_DESTINO,
  type EstadoDeOportunidad,
  type FiltrosDeOportunidades,
  type Objetivo,
  type OrdenDeOportunidades,
  type TipoDeDestino,
} from "@/lib/types";

/**
 * «bandeja» = lo que merece tu tiempo (los estados de `ESTADOS_DE_LA_BANDEJA`);
 * «todas» = sin filtrar por estado; o un estado concreto.
 */
export type EstadoElegido = "bandeja" | "todas" | EstadoDeOportunidad;

export type FiltrosDeBandeja = {
  estado: EstadoElegido;
  /** Vacío = todos los objetivos. */
  objetivo: Objetivo | "";
  /** Slug del nicho; vacío = todos. */
  nicho: string;
  /** Vacío = todos los tipos. */
  tipoDestino: TipoDeDestino | "";
  /** Dominio de un competidor al que la página menciona; vacío = cualquiera. */
  menciona: string;
  orden: OrdenDeOportunidades;
  /** Empieza en 1. */
  pagina: number;
};

export const FILTROS_POR_DEFECTO: FiltrosDeBandeja = {
  estado: "bandeja",
  objetivo: "",
  nicho: "",
  tipoDestino: "",
  menciona: "",
  orden: "puntuacion",
  pagina: 1,
};

/**
 * Un dominio de `?menciona=` o de la memoria de la pestaña, o `""` si no lo
 * parece: minúsculas, sin `www.`, solo letras, cifras, puntos y guiones.
 */
export function normalizarMenciona(valor: unknown): string {
  if (typeof valor !== "string") return "";
  const dominio = valor
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
  return dominio.length <= 253 &&
    /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(dominio)
    ? dominio
    : "";
}

/** Tarjetas por página: pocas, para que el móvil no sea una lista eterna. */
export const LIMITE_DE_PAGINA = 20;

/** ¿Hay algún filtro distinto del de por defecto? (La página y el orden no cuentan.) */
export function hayFiltrosActivos(filtros: FiltrosDeBandeja): boolean {
  return (
    filtros.estado !== FILTROS_POR_DEFECTO.estado ||
    filtros.objetivo !== "" ||
    filtros.nicho !== "" ||
    filtros.tipoDestino !== "" ||
    filtros.menciona !== ""
  );
}

/** Los filtros de la pantalla, traducidos a la consulta de la API. */
export function aFiltrosDeApi(
  filtros: FiltrosDeBandeja
): FiltrosDeOportunidades {
  const estado =
    filtros.estado === "bandeja"
      ? ESTADOS_DE_LA_BANDEJA
      : filtros.estado === "todas"
        ? undefined
        : [filtros.estado];
  return {
    ...(estado ? { estado } : {}),
    ...(filtros.objetivo ? { objetivo: filtros.objetivo } : {}),
    ...(filtros.nicho ? { nicho: filtros.nicho } : {}),
    ...(filtros.tipoDestino ? { tipoDestino: filtros.tipoDestino } : {}),
    ...(filtros.menciona ? { menciona: filtros.menciona } : {}),
    orden: filtros.orden,
    pagina: filtros.pagina,
    limite: LIMITE_DE_PAGINA,
  };
}

// ---------------------------------------------------------------------------
// Memoria de la pestaña
// ---------------------------------------------------------------------------

/**
 * Los filtros se recuerdan mientras dure la pestaña (`sessionStorage`) para que
 * volver de una Revisión no obligue a empezar de cero. Es una comodidad: con el
 * almacenamiento roto o un valor corrupto, se vuelve a los de por defecto.
 */
export const CLAVE_DE_FILTROS = "alhabla-growth:filtros-bandeja";

const ORDENES: readonly OrdenDeOportunidades[] = [
  "puntuacion",
  "recientes",
  "caducan",
];

export function leerFiltrosGuardados(): FiltrosDeBandeja {
  if (typeof window === "undefined") return FILTROS_POR_DEFECTO;
  try {
    const crudo = window.sessionStorage.getItem(CLAVE_DE_FILTROS);
    if (!crudo) return FILTROS_POR_DEFECTO;
    const dato: unknown = JSON.parse(crudo);
    if (dato === null || typeof dato !== "object") return FILTROS_POR_DEFECTO;
    const d = dato as Record<string, unknown>;
    const estado = d.estado;
    const objetivo = d.objetivo;
    const tipo = d.tipoDestino;
    const orden = d.orden;
    return {
      estado:
        estado === "bandeja" ||
        estado === "todas" ||
        (typeof estado === "string" &&
          (ESTADOS_DE_OPORTUNIDAD as readonly string[]).includes(estado))
          ? (estado as EstadoElegido)
          : FILTROS_POR_DEFECTO.estado,
      objetivo:
        typeof objetivo === "string" &&
        (OBJETIVOS as readonly string[]).includes(objetivo)
          ? (objetivo as Objetivo)
          : "",
      nicho: typeof d.nicho === "string" && d.nicho.length <= 80 ? d.nicho : "",
      tipoDestino:
        typeof tipo === "string" &&
        (TIPOS_DE_DESTINO as readonly string[]).includes(tipo)
          ? (tipo as TipoDeDestino)
          : "",
      menciona: normalizarMenciona(d.menciona),
      orden:
        typeof orden === "string" &&
        (ORDENES as readonly string[]).includes(orden)
          ? (orden as OrdenDeOportunidades)
          : FILTROS_POR_DEFECTO.orden,
      // La página no se recuerda: los datos cambian y la 3 de ayer puede no existir.
      pagina: 1,
    };
  } catch {
    return FILTROS_POR_DEFECTO;
  }
}

/**
 * Los filtros con los que abre la Bandeja: los recordados de la pestaña y, si
 * viene `?menciona=<dominio>` (el enlace de «N menciones» en Competencia), ese
 * competidor con todos los estados, para que la lista cuente las mismas
 * oportunidades que el número del que vienes. Se recuerda como cualquier otro
 * filtro.
 */
export function filtrosIniciales(mencionaDeLaUrl?: string): FiltrosDeBandeja {
  const guardados = leerFiltrosGuardados();
  const menciona = normalizarMenciona(mencionaDeLaUrl);
  if (!menciona) return guardados;
  const filtros: FiltrosDeBandeja = {
    ...guardados,
    menciona,
    estado: "todas",
    pagina: 1,
  };
  guardarFiltros(filtros);
  return filtros;
}

export function guardarFiltros(filtros: FiltrosDeBandeja) {
  try {
    window.sessionStorage.setItem(CLAVE_DE_FILTROS, JSON.stringify(filtros));
  } catch {
    // Sin almacenamiento: los filtros viven solo mientras la vista esté abierta.
  }
}
