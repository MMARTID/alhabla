import { createHash } from "node:crypto";

/**
 * Parser de PRODUCT.md para el extractor de conocimiento. PURO (recibe el
 * texto, no lee ficheros) y estricto: si el documento no tiene la forma que
 * el mapa espera, falla en vez de devolver menos cosas y dejar que el
 * sincronizador cierre afirmaciones que siguen siendo ciertas.
 *
 * Qué entiende de PRODUCT.md:
 *  - Los H2 (`## Capabilities and Constraints`) son identificadores de esquema.
 *  - Dentro de un H2, las líneas que SOLO contienen negrita
 *    (`**Capacidades confirmadas**`, `**Terminología del producto** (visible
 *    al usuario)`) abren un grupo.
 *  - Una lista es una serie de `- ` en columna 0; las continuaciones llevan
 *    dos espacios de sangría. Un bullet acaba en línea en blanco, otro `- `,
 *    un encabezado o una negrita-encabezado.
 *  - Lo demás es un párrafo del grupo (la terminología es un párrafo).
 *
 * No se ingieren Positioning, Users, Operating Context ni Product Principles
 * (llevan costes de proveedor y competidores): este parser los lee, pero el
 * mapa solo mira las secciones que decide.
 */

export type BulletDeProduct = {
  /** `Capabilities and Constraints`, `Brand Commitments`… (texto del H2). */
  seccion: string;
  /** Texto de la negrita-encabezado, sin paréntesis: `Capacidades confirmadas`. */
  grupo: string | null;
  /** Línea (1-based) donde empieza. Solo para mensajes de error: NO va a ninguna afirmación. */
  linea: number;
  /** Texto del bullet con las continuaciones unidas por un espacio. */
  texto: string;
};

export type ParrafoDeProduct = {
  seccion: string;
  grupo: string | null;
  linea: number;
  texto: string;
};

export type ProductMdParseado = {
  bullets: BulletDeProduct[];
  parrafos: ParrafoDeProduct[];
  /** Los H2 que existen, en orden. */
  secciones: string[];
};

const H2 = /^##\s+(.+?)\s*$/;
const ENCABEZADO = /^#{1,6}\s/;
const NEGRITA_ENCABEZADO = /^\*\*([^*]+)\*\*(?:\s*\(([^)]*)\))?\s*$/;
const BULLET = /^-\s+(.*)$/;
const CONTINUACION = /^ {2,}\S/;

/** Minúsculas, sin tildes, no alfanumérico a guion: la forma del ancla. */
export function slugDeAncla(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parsearProductMd(contenido: string): ProductMdParseado {
  const lineas = contenido.split(/\r?\n/);
  const resultado: ProductMdParseado = {
    bullets: [],
    parrafos: [],
    secciones: [],
  };

  let seccion: string | null = null;
  let grupo: string | null = null;
  let bullet: BulletDeProduct | null = null;
  let parrafo: ParrafoDeProduct | null = null;

  const cerrar = () => {
    if (bullet) resultado.bullets.push(bullet);
    if (parrafo) resultado.parrafos.push(parrafo);
    bullet = null;
    parrafo = null;
  };

  lineas.forEach((linea, indice) => {
    const numero = indice + 1;
    const h2 = H2.exec(linea);
    if (h2) {
      cerrar();
      seccion = h2[1];
      grupo = null;
      resultado.secciones.push(seccion);
      return;
    }
    if (ENCABEZADO.test(linea)) {
      cerrar();
      grupo = null;
      return;
    }
    if (seccion === null) return;

    const negrita = NEGRITA_ENCABEZADO.exec(linea);
    if (negrita) {
      cerrar();
      grupo = negrita[1].trim();
      return;
    }
    if (linea.trim() === "") {
      cerrar();
      return;
    }
    const item = BULLET.exec(linea);
    if (item) {
      cerrar();
      bullet = { seccion, grupo, linea: numero, texto: item[1].trim() };
      return;
    }
    if (bullet && CONTINUACION.test(linea)) {
      bullet.texto = `${bullet.texto} ${linea.trim()}`;
      return;
    }
    // Un párrafo (o la continuación de uno).
    if (parrafo) {
      parrafo.texto = `${parrafo.texto} ${linea.trim()}`;
    } else {
      cerrar();
      parrafo = { seccion, grupo, linea: numero, texto: linea.trim() };
    }
  });
  cerrar();
  return resultado;
}

/** Los bullets de un grupo de una sección, o un error si no hay ninguno. */
export function bulletsDe(
  parseado: ProductMdParseado,
  seccion: string,
  grupo: string | null
): BulletDeProduct[] {
  const bullets = parseado.bullets.filter(
    (b) => b.seccion === seccion && b.grupo === grupo
  );
  if (bullets.length === 0) {
    throw new Error(
      `[Conocimiento] PRODUCT.md ya no tiene bullets en «${seccion}» › «${grupo ?? "(sin grupo)"}». ¿Se renombró el encabezado? Actualiza mcp/growth/conocimiento/mapa.ts.`
    );
  }
  return bullets;
}

export function parrafosDe(
  parseado: ProductMdParseado,
  seccion: string,
  grupo: string | null
): ParrafoDeProduct[] {
  return parseado.parrafos.filter(
    (p) => p.seccion === seccion && p.grupo === grupo
  );
}

/**
 * Huella corta del bullet normalizado: si el texto del bullet cambia, cambia
 * el `valor` de la afirmación aunque su texto revisado no cambie, y los
 * borradores que la citan se bloquean hasta que alguien la mire.
 */
export function huellaDe(texto: string): string {
  const normalizado = texto.replace(/\s+/g, " ").trim().toLowerCase();
  return createHash("sha256").update(normalizado).digest("hex").slice(0, 12);
}

/** Quita el énfasis `**` y las comillas latinas ya están bien; deja el resto tal cual. */
export function sinNegritas(texto: string): string {
  return texto.replace(/\*\*/g, "");
}

/**
 * Los términos que PRODUCT.md dice que «nunca» se usan: lo que va entre
 * «comillas latinas» después de «Nunca» en el párrafo de terminología, más
 * «el nombre de ningún proveedor (Telnyx…)».
 */
export function terminosNuncaDe(parrafo: string): {
  terminos: string[];
  proveedores: string[];
} {
  const posicion = parrafo.indexOf("Nunca");
  if (posicion === -1) {
    throw new Error(
      "[Conocimiento] El párrafo de terminología de PRODUCT.md ya no contiene «Nunca»: no se pueden extraer los términos que no se dicen."
    );
  }
  const cola = parrafo.slice(posicion);
  const terminos = [...cola.matchAll(/«([^»]+)»/g)].map((m) => m[1].trim());
  const proveedores = [
    ...(/nombre de ningún proveedor\s*\(([^)]*)\)/i.exec(cola)?.[1] ?? "")
      .split(",")
      .map((p) => p.replace(/[….]/g, "").trim())
      .filter(Boolean),
  ];
  if (terminos.length === 0) {
    throw new Error(
      "[Conocimiento] No se encontró ningún término entre «» tras «Nunca» en PRODUCT.md."
    );
  }
  return { terminos, proveedores };
}
