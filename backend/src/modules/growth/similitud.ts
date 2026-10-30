/**
 * Parecido entre dos textos, de 0 (nada en común) a 1 (idénticos), para que
 * Growth no mande el mismo mensaje con otro nombre. Compara grupos de tres
 * palabras (Jaccard): ignora mayúsculas, acentos y signos, y no se deja
 * engañar por cambiar una palabra suelta, pero sí por reordenar frases.
 */

const PALABRAS_POR_GRUPO = 3;

function palabras(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function grupos(lista: string[]): Set<string> {
  // Un texto de menos de tres palabras no tiene grupos: se compara por
  // palabras sueltas para no dar siempre 0.
  if (lista.length < PALABRAS_POR_GRUPO) return new Set(lista);
  const resultado = new Set<string>();
  for (let i = 0; i <= lista.length - PALABRAS_POR_GRUPO; i += 1) {
    resultado.add(lista.slice(i, i + PALABRAS_POR_GRUPO).join(" "));
  }
  return resultado;
}

export function similitud(a: string, b: string): number {
  const ga = grupos(palabras(a));
  const gb = grupos(palabras(b));
  if (ga.size === 0 || gb.size === 0) return 0;

  let comunes = 0;
  for (const g of ga) if (gb.has(g)) comunes += 1;
  return comunes / (ga.size + gb.size - comunes);
}

/** El mayor parecido del texto con cualquiera de los anteriores. */
export function maximaSimilitud(
  texto: string,
  anteriores: readonly string[]
): number {
  let maxima = 0;
  for (const anterior of anteriores) {
    maxima = Math.max(maxima, similitud(texto, anterior));
  }
  return maxima;
}
