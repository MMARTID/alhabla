import { mencionaPalabra, type TerminoProhibido } from "../cumplimiento.js";

/**
 * Lo que se afirma de Alhabla no puede decir lo que Alhabla no dice. PURO (sin
 * Prisma): lo usan el servidor al sincronizar y el extractor del repo al
 * comprobar, con la misma función, para que ninguno de los dos deje pasar lo
 * que el otro rechazaría.
 */

/**
 * Tipos cuyo texto se lee como una afirmación de Alhabla. Las `limite` quedan
 * fuera a propósito (citan categorías como «testimonios» para decir que no
 * existen) y las `prohibida` son la propia lista.
 */
export const TIPOS_QUE_NO_PUEDEN_USAR_TERMINOS_PROHIBIDOS: readonly string[] = [
  "precio",
  "funcion",
  "sector",
  "comparativa",
  "pagina",
];

/** Una URL o una ruta no es una frase de Alhabla: puede llevar «prompt» o «api» sin decirlo. */
const ENLACE_O_RUTA = /^(?:[a-z][a-z0-9+.-]*:\/\/|\/)\S*$/i;
const PROFUNDIDAD_MAXIMA_DEL_VALOR = 8;

/**
 * Todo el texto que cuelga de un `valor`: las cadenas (salvo URL y rutas) y
 * los nombres de las claves, a cualquier profundidad. Un `valor` es JSON que
 * el agente de redacción también lee, así que decir ahí lo que no se dice es
 * decirlo.
 */
export function textosDelValor(valor: unknown, profundidad = 0): string[] {
  if (typeof valor === "string") {
    return ENLACE_O_RUTA.test(valor.trim()) ? [] : [valor];
  }
  if (profundidad >= PROFUNDIDAD_MAXIMA_DEL_VALOR) return [];
  if (Array.isArray(valor)) {
    return valor.flatMap((v) => textosDelValor(v, profundidad + 1));
  }
  if (valor && typeof valor === "object") {
    return Object.entries(valor as Record<string, unknown>).flatMap(
      ([clave, v]) => [clave, ...textosDelValor(v, profundidad + 1)]
    );
  }
  return [];
}

export function afirmacionesConTerminosProhibidos(
  afirmaciones: readonly {
    clave: string;
    tipo: string;
    texto: string;
    valor?: unknown;
  }[],
  terminos: readonly TerminoProhibido[]
): { clave: string; terminos: string[] }[] {
  const infracciones: { clave: string; terminos: string[] }[] = [];
  for (const a of afirmaciones) {
    if (!TIPOS_QUE_NO_PUEDEN_USAR_TERMINOS_PROHIBIDOS.includes(a.tipo))
      continue;
    const fragmentos = [a.texto, ...textosDelValor(a.valor)];
    const usados = terminos
      .filter((t) =>
        fragmentos.some((fragmento) =>
          mencionaPalabra(fragmento, t.termino, {
            palabraEntera: t.palabraEntera,
          })
        )
      )
      .map((t) => t.termino);
    if (usados.length > 0) {
      infracciones.push({ clave: a.clave, terminos: [...new Set(usados)] });
    }
  }
  return infracciones;
}

// ── Términos de la lista ─────────────────────────────────────────────────

/** Menos de tres caracteres casan con medio diccionario: el backend no los aplica. */
export const LONGITUD_MINIMA_DE_TERMINO_PROHIBIDO = 3;

/**
 * El término tal como se compara entre dos versiones de la misma regla, y tal
 * como lo busca el backend: NFKC, sin caracteres invisibles, en minúsculas,
 * sin acentos y con los espacios colapsados. «Telnyx», «TELNYX», «Télnyx» y
 * «Ｔｅｌｎｙｘ» son el mismo término: cambiar de uno a otro no debilita nada.
 */
export function normalizarTermino(termino: string): string {
  return termino
    .normalize("NFKC")
    .replace(/\p{Cf}/gu, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Por qué un término de la lista de prohibidos no serviría, o `null` si vale.
 * Un término ineficaz es peor que ninguno: la regla parece cubrir algo que no
 * cubre. Sirve para el servidor (400) y para el extractor (`--comprobar`).
 */
export function motivoDeTerminoProhibidoInvalido(
  termino: string
): string | null {
  if (/\p{Cf}/u.test(termino)) {
    return "lleva caracteres invisibles (ancho cero, marcas de dirección…) y no casaría con el texto";
  }
  const efectivo = normalizarTermino(termino);
  if (efectivo.length < LONGITUD_MINIMA_DE_TERMINO_PROHIBIDO) {
    return `tras normalizarlo (NFKC, sin invisibles ni acentos) queda con menos de ${LONGITUD_MINIMA_DE_TERMINO_PROHIBIDO} caracteres y el backend no lo aplicaría`;
  }
  if (!/[\p{L}\p{N}]/u.test(efectivo)) {
    return "no tiene letras ni números (solo marcas o signos)";
  }
  return null;
}

/** Los términos no válidos de una lista, con su motivo. */
export function terminosProhibidosInvalidos(
  terminos: readonly string[]
): { termino: string; motivo: string }[] {
  return terminos.flatMap((termino) => {
    const motivo = motivoDeTerminoProhibidoInvalido(termino);
    return motivo ? [{ termino, motivo }] : [];
  });
}
