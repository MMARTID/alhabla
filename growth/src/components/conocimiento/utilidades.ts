import type {
  Afirmacion,
  RespuestaDeConocimiento,
  TipoDeAfirmacion,
} from "@/lib/types";

/**
 * Las piezas puras de la vista de Conocimiento: búsqueda, términos
 * prohibidos, valores y cambios recientes.
 */

/**
 * En qué orden se enseñan los grupos: primero lo que no se puede decir y lo
 * que Alhabla no hace, que es lo que más importa al revisar un borrador.
 */
export const ORDEN_DE_TIPOS: readonly TipoDeAfirmacion[] = [
  "prohibida",
  "limite",
  "precio",
  "funcion",
  "sector",
  "comparativa",
  "pagina",
];

/** Días sin sincronizar a partir de los cuales el conocimiento se da por viejo. */
export const DIAS_PARA_DAR_POR_OBSOLETO = 8;

export const HORAS_PARA_DAR_POR_OBSOLETO = DIAS_PARA_DAR_POR_OBSOLETO * 24;

/** Minúsculas y sin acentos: «Peluquería» coincide con «peluqueria». */
export function normalizarParaBuscar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/**
 * ¿Coincide la afirmación con lo que se busca? Mira la clave, el texto, la
 * fuente y, en las prohibidas, los términos. `consulta` ya va normalizada.
 */
export function coincideConLaBusqueda(
  afirmacion: Afirmacion,
  consulta: string
): boolean {
  if (consulta === "") return true;
  const terminos = terminosProhibidos(afirmacion.valor)?.terminos ?? [];
  const pajar = normalizarParaBuscar(
    [afirmacion.clave, afirmacion.texto, afirmacion.fuente, ...terminos].join(
      "\n"
    )
  );
  return pajar.includes(consulta);
}

/**
 * La lista de una afirmación `prohibida`: `valor.terminos` y si se buscan como
 * palabra entera (`valor.palabrasEnteras`, que por defecto sí). `null` si el
 * valor no trae una lista de textos: entonces solo cuenta la frase entera.
 */
export function terminosProhibidos(
  valor: unknown
): { terminos: string[]; palabrasEnteras: boolean } | null {
  if (valor === null || typeof valor !== "object" || Array.isArray(valor)) {
    return null;
  }
  const { terminos, palabrasEnteras } = valor as Record<string, unknown>;
  if (!Array.isArray(terminos)) return null;
  const textos = terminos.filter(
    (t): t is string => typeof t === "string" && t.trim() !== ""
  );
  if (textos.length === 0) return null;
  return { terminos: textos, palabrasEnteras: palabrasEnteras !== false };
}

/**
 * El `valor` de una afirmación como texto para leerlo, o `null` si no hay.
 * Es dato, no código: se pinta dentro de un `<pre>`. Se recorta si es enorme.
 */
export function valorComoTexto(valor: unknown, maximo = 2000): string | null {
  if (valor === null || valor === undefined) return null;
  let texto: string;
  try {
    texto = typeof valor === "string" ? valor : JSON.stringify(valor, null, 2);
  } catch {
    return null;
  }
  if (texto === undefined || texto === "{}" || texto === "[]") return null;
  return texto.length > maximo ? `${texto.slice(0, maximo)}…` : texto;
}

export type CambioReciente =
  RespuestaDeConocimiento["cambiosRecientes"][number];

export type CambioAgrupado = Omit<CambioReciente, "cambio"> & {
  cambio: "alta" | "cierre" | "modificada";
};

/** Un cierre y un alta de la misma clave tan juntos son una modificación. */
const VENTANA_DE_MODIFICACION_MS = 60_000;

/**
 * El backend cuenta una modificación como un cierre y un alta de la misma
 * clave. Aquí se juntan en una sola línea («Modificada») para que se lea como
 * lo que pasó. El resultado va del más reciente al más antiguo.
 */
export function agruparCambios(
  cambios: readonly CambioReciente[]
): CambioAgrupado[] {
  const ordenados = [...cambios].sort(
    (a, b) => Date.parse(b.en) - Date.parse(a.en)
  );
  const usados = new Set<number>();
  const agrupados: CambioAgrupado[] = [];
  ordenados.forEach((cambio, indice) => {
    if (usados.has(indice)) return;
    usados.add(indice);
    const opuesto = cambio.cambio === "alta" ? "cierre" : "alta";
    const pareja = ordenados.findIndex(
      (otro, k) =>
        !usados.has(k) &&
        otro.clave === cambio.clave &&
        otro.cambio === opuesto &&
        Math.abs(Date.parse(otro.en) - Date.parse(cambio.en)) <=
          VENTANA_DE_MODIFICACION_MS
    );
    if (pareja === -1) {
      agrupados.push(cambio);
      return;
    }
    usados.add(pareja);
    // Se cuenta con los datos de la versión nueva (el alta).
    const alta = cambio.cambio === "alta" ? cambio : ordenados[pareja];
    agrupados.push({ ...alta, cambio: "modificada" });
  });
  return agrupados;
}
