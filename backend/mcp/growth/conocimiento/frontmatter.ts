/**
 * Parser mínimo del frontmatter de los artículos del blog
 * (`web/content/blog/*.mdx`). No hay gray-matter ni yaml en el backend, y
 * añadir una dependencia para 18 ficheros no compensa: se entiende solo lo
 * que usan los artículos y se FALLA ante cualquier otra forma, en lugar de
 * interpretarla mal y publicar un resumen truncado.
 *
 * Formas que entiende, una por clave:
 *   clave: valor sin comillas
 *   clave: "valor entre comillas dobles"   (con \" y \\)
 *   clave: 'valor entre comillas simples'  (con '' para la comilla)
 *   clave: >-                               (escalar plegado: las líneas
 *     sangradas siguientes se unen con un espacio)
 *   clave: true | false                     (booleano)
 *
 * Con `soloClaves`, las claves que NO están en esa lista se saltan enteras
 * (valor en una línea, lista YAML, mapa, bloque…): la web (gray-matter) las
 * acepta, y que un artículo lleve `etiquetas:` en lista no debe romper una
 * sincronización que no las usa. Las claves que sí se usan siguen siendo
 * estrictas.
 */

export type ValorDeFrontmatter = string | boolean;

const CLAVE = /^([A-Za-z_][A-Za-z0-9_]*):(?:\s+(.*))?$/;
const PLEGADO = /^[>|][-+]?$/;

function error(linea: number, motivo: string): never {
  throw new Error(
    `[Conocimiento] Frontmatter no soportado (línea ${linea}): ${motivo}`
  );
}

function entrecomillado(valor: string, numero: number): string | null {
  const comilla = valor[0];
  if (comilla !== '"' && comilla !== "'") return null;
  if (valor.length < 2 || valor[valor.length - 1] !== comilla) {
    error(numero, `comilla sin cerrar en «${valor}»`);
  }
  const interior = valor.slice(1, -1);
  if (comilla === "'") {
    if (/'(?!')/.test(interior.replace(/''/g, ""))) {
      error(numero, `comilla simple sin duplicar en «${valor}»`);
    }
    return interior.replace(/''/g, "'");
  }
  let resultado = "";
  for (let i = 0; i < interior.length; i++) {
    const c = interior[i];
    if (c === '"') error(numero, `comilla doble sin escapar en «${valor}»`);
    if (c !== "\\") {
      resultado += c;
      continue;
    }
    const siguiente = interior[++i];
    if (siguiente === '"' || siguiente === "\\") resultado += siguiente;
    else error(numero, `escape «\\${siguiente ?? ""}» no soportado`);
  }
  return resultado;
}

/** ¿Es la línea una continuación del valor de la clave anterior (sangrada, `- item` o en blanco)? */
function esContinuacion(linea: string): boolean {
  return linea.trim() === "" || /^\s/.test(linea) || /^-(\s|$)/.test(linea);
}

/** `contenido` es el fichero entero; devuelve solo el bloque entre los `---`. */
export function parsearFrontmatter(
  contenido: string,
  opciones: { soloClaves?: ReadonlySet<string> } = {}
): Record<string, ValorDeFrontmatter> {
  const lineas = contenido.replace(/^\uFEFF/, "").split(/\r?\n/);
  if (lineas[0]?.trim() !== "---") {
    error(1, "el fichero no empieza por «---»");
  }
  const fin = lineas.findIndex((l, i) => i > 0 && l.trim() === "---");
  if (fin === -1) error(1, "el frontmatter no se cierra con «---»");

  const resultado: Record<string, ValorDeFrontmatter> = {};
  for (let i = 1; i < fin; i++) {
    const linea = lineas[i];
    const numero = i + 1;
    if (linea.trim() === "") continue;
    if (/^\s*#/.test(linea)) continue;
    const ignorada = opciones.soloClaves ? CLAVE.exec(linea)?.[1] : undefined;
    if (
      ignorada !== undefined &&
      opciones.soloClaves &&
      !opciones.soloClaves.has(ignorada)
    ) {
      // Una clave que no se usa: se salta con todo lo que cuelga de ella.
      while (i + 1 < fin && esContinuacion(lineas[i + 1])) i++;
      continue;
    }
    if (/^\s/.test(linea) || linea.includes("\t")) {
      error(
        numero,
        `línea sangrada fuera de un bloque plegado: «${linea.trim()}»`
      );
    }
    const coincide = CLAVE.exec(linea);
    if (!coincide) error(numero, `no es «clave: valor»: «${linea.trim()}»`);
    const [, clave, crudo = ""] = coincide;
    if (clave in resultado) error(numero, `la clave «${clave}» está repetida`);
    const valor = crudo.trim();

    if (PLEGADO.test(valor)) {
      const partes: string[] = [];
      while (i + 1 < fin && /^\s+\S/.test(lineas[i + 1])) {
        partes.push(lineas[++i].trim());
      }
      if (partes.length === 0)
        error(numero, `«${clave}» abre un bloque sin contenido`);
      resultado[clave] = partes.join(" ");
      continue;
    }
    if (valor === "") {
      error(
        numero,
        i + 1 < fin && /^(\s+\S|-\s)/.test(lineas[i + 1])
          ? `«${clave}» es una lista o un mapa y aquí se espera un texto`
          : `«${clave}» sin valor`
      );
    }
    const comillas = entrecomillado(valor, numero);
    if (comillas !== null) {
      resultado[clave] = comillas;
      continue;
    }
    if (/^[[{|>&*!%@`]/.test(valor)) {
      error(numero, `valor no soportado en «${clave}»: «${valor}»`);
    }
    if (/\s#/.test(valor)) {
      error(numero, `comentario al final de «${clave}»: ponlo entre comillas`);
    }
    resultado[clave] =
      valor === "true" ? true : valor === "false" ? false : valor;
  }
  return resultado;
}

export type ArticuloDeBlog = {
  slug: string;
  titulo: string;
  resumen: string;
  fecha: string;
  actualizado: string | null;
  autor: string | null;
  /** Slug del sector o cadena vacía. */
  sector: string;
  idioma: string | null;
  borrador: boolean;
};

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Las claves que lee el extractor; las demás se saltan sin interpretarlas. */
const CLAVES_DEL_ARTICULO: ReadonlySet<string> = new Set([
  "titulo",
  "resumen",
  "fecha",
  "actualizado",
  "autor",
  "sector",
  "idioma",
  "borrador",
]);

/** `2026-09-21T10:00:00Z` también vale como fecha, como en la web (que toma el día del Date que YAML entrega). */
function soloElDia(valor: string | null): string | null {
  return valor !== null && /^\d{4}-\d{2}-\d{2}[T ]/.test(valor)
    ? valor.slice(0, 10)
    : valor;
}

function texto(
  datos: Record<string, ValorDeFrontmatter>,
  clave: string,
  slug: string,
  opcional = false
): string | null {
  const valor = datos[clave];
  if (valor === undefined) {
    if (opcional) return null;
    throw new Error(
      `[Conocimiento] El artículo ${slug} no tiene «${clave}» en el frontmatter.`
    );
  }
  if (typeof valor !== "string") {
    throw new Error(
      `[Conocimiento] «${clave}» del artículo ${slug} no es un texto.`
    );
  }
  return valor;
}

/** El frontmatter de un artículo, con los campos que usa la base de conocimiento. */
export function articuloDeBlog(
  slug: string,
  contenido: string
): ArticuloDeBlog {
  const datos = parsearFrontmatter(contenido, {
    soloClaves: CLAVES_DEL_ARTICULO,
  });
  const fecha = soloElDia(texto(datos, "fecha", slug))!;
  const actualizado = soloElDia(texto(datos, "actualizado", slug, true));
  for (const [clave, valor] of [
    ["fecha", fecha],
    ["actualizado", actualizado],
  ] as const) {
    if (valor !== null && !FECHA.test(valor)) {
      throw new Error(
        `[Conocimiento] «${clave}» del artículo ${slug} no es AAAA-MM-DD: «${valor}».`
      );
    }
  }
  const borrador = datos.borrador;
  if (borrador !== undefined && typeof borrador !== "boolean") {
    throw new Error(
      `[Conocimiento] «borrador» del artículo ${slug} no es true ni false.`
    );
  }
  return {
    slug,
    titulo: texto(datos, "titulo", slug)!,
    // Como la web: sin resumen o sin sector el artículo existe igual.
    resumen: texto(datos, "resumen", slug, true) ?? "",
    fecha,
    actualizado,
    autor: texto(datos, "autor", slug, true),
    sector: texto(datos, "sector", slug, true) ?? "",
    idioma: texto(datos, "idioma", slug, true),
    borrador: borrador === true,
  };
}
