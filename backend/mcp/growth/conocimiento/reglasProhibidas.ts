import {
  LONGITUD_MINIMA_DE_TERMINO_PROHIBIDO,
  motivoDeTerminoProhibidoInvalido,
} from "../../../src/modules/growth/conocimiento/terminos.js";
import { slugDeAncla } from "./productMd.js";

/**
 * Parser de `growth/agentes/reglas/afirmaciones-prohibidas.md`, la fuente de
 * las afirmaciones `prohibida.*`. Lee dos tablas por el título de su sección:
 *
 * - «Reglas aplicadas»: `| Clave | Términos | Palabra entera | Motivo | Fuente |`
 *   (términos separados por `;`). Cada fila es una afirmación.
 * - «Descartados (no se emiten)»: `| Término | Por qué no se emite |`.
 *
 * PURO y estricto: una tabla que no tiene las columnas esperadas, una celda
 * vacía o un término de menos de tres caracteres hacen fallar la extracción.
 */

export type ReglaProhibida = {
  /** `proveedores` → la clave será `prohibida.proveedores`. */
  clave: string;
  terminos: string[];
  palabrasEnteras: boolean;
  motivo: string;
  fuente: string;
};

export type TerminoDescartado = { termino: string; motivo: string };

export type ReglasProhibidas = {
  reglas: ReglaProhibida[];
  descartados: TerminoDescartado[];
};

const CABECERA_DE_REGLAS = [
  "clave",
  "terminos",
  "palabra entera",
  "motivo",
  "fuente",
];
const CABECERA_DE_DESCARTADOS = ["termino", "por que no se emite"];

function celdas(linea: string): string[] {
  return linea
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

function sinAcentos(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

/** Las filas de la primera tabla que hay bajo un `## <titulo>`. */
function tablaDe(
  lineas: string[],
  titulo: string,
  cabecera: string[]
): string[][] {
  const objetivo = slugDeAncla(titulo);
  const inicio = lineas.findIndex(
    (l) => /^##\s/.test(l) && slugDeAncla(l.replace(/^##\s+/, "")) === objetivo
  );
  if (inicio === -1) {
    throw new Error(
      `[Conocimiento] afirmaciones-prohibidas.md no tiene la sección «${titulo}».`
    );
  }
  const filas: string[][] = [];
  let dentro = false;
  for (let i = inicio + 1; i < lineas.length; i++) {
    const linea = lineas[i];
    if (/^##\s/.test(linea)) break;
    if (!linea.trim().startsWith("|")) {
      if (dentro) break;
      continue;
    }
    const c = celdas(linea);
    if (!dentro) {
      const esperada = cabecera.join("|");
      if (c.map(sinAcentos).join("|") !== esperada) {
        throw new Error(
          `[Conocimiento] La tabla de «${titulo}» debe tener las columnas ${cabecera.join(" | ")}; tiene ${c.join(" | ")}.`
        );
      }
      dentro = true;
      continue;
    }
    if (c.every((x) => /^:?-{3,}:?$/.test(x))) continue;
    if (c.length !== cabecera.length || c.some((x) => x === "")) {
      throw new Error(
        `[Conocimiento] Fila mal formada en «${titulo}»: «${linea.trim()}».`
      );
    }
    filas.push(c);
  }
  if (filas.length === 0) {
    throw new Error(`[Conocimiento] La tabla de «${titulo}» no tiene filas.`);
  }
  return filas;
}

export function parsearReglasProhibidas(contenido: string): ReglasProhibidas {
  const lineas = contenido.split(/\r?\n/);

  const reglas = tablaDe(lineas, "Reglas aplicadas", CABECERA_DE_REGLAS).map(
    ([clave, terminos, entera, motivo, fuente]): ReglaProhibida => {
      if (!/^[a-z0-9_]+$/.test(clave)) {
        throw new Error(
          `[Conocimiento] Clave de regla prohibida no válida: «${clave}» (minúsculas, números y _).`
        );
      }
      const lista = terminos
        .split(";")
        .map((t) => t.trim())
        .filter(Boolean);
      if (lista.length === 0) {
        throw new Error(
          `[Conocimiento] La regla «${clave}» no tiene términos.`
        );
      }
      for (const termino of lista) {
        // La misma comprobación que hace el servidor al sincronizar: un
        // término que no serviría se ve aquí, en CI, y no al aplicar.
        const motivo = motivoDeTerminoProhibidoInvalido(termino);
        if (motivo) {
          throw new Error(
            `[Conocimiento] El término «${termino}» de la regla «${clave}» no sirve: ${motivo} (mínimo ${LONGITUD_MINIMA_DE_TERMINO_PROHIBIDO} caracteres útiles).`
          );
        }
      }
      const respuesta = sinAcentos(entera);
      if (respuesta !== "si" && respuesta !== "no") {
        throw new Error(
          `[Conocimiento] «Palabra entera» de la regla «${clave}» debe ser «sí» o «no», no «${entera}».`
        );
      }
      return {
        clave,
        terminos: lista,
        palabrasEnteras: respuesta === "si",
        motivo,
        fuente,
      };
    }
  );

  const claves = reglas.map((r) => r.clave);
  const repetida = claves.find((c, i) => claves.indexOf(c) !== i);
  if (repetida) {
    throw new Error(`[Conocimiento] La regla «${repetida}» está repetida.`);
  }

  const descartados = tablaDe(
    lineas,
    "Descartados (no se emiten)",
    CABECERA_DE_DESCARTADOS
  ).map(([termino, motivo]): TerminoDescartado => ({ termino, motivo }));

  return { reglas, descartados };
}

/**
 * Los términos del párrafo «Nunca» de PRODUCT.md (y los proveedores) que ni
 * están en una regla aplicada ni en la lista de descartados: lo que el repo
 * prohíbe y este fichero ignora en silencio.
 */
export function terminosSinCubrir(
  reglas: ReglasProhibidas,
  terminosDeProduct: readonly string[]
): string[] {
  const cubiertos = new Set(
    [
      ...reglas.reglas.flatMap((r) => r.terminos),
      ...reglas.descartados.map((d) => d.termino),
    ].map(sinAcentos)
  );
  return terminosDeProduct.filter((t) => !cubiertos.has(sinAcentos(t)));
}
