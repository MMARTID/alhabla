import {
  FRASES_DECLARADAS,
  MAPA_DE_PRODUCT,
  SECCION_CAPACIDADES,
} from "./mapa.js";
import { huellaDe, type ProductMdParseado } from "./productMd.js";

/**
 * Las huellas del mapa (`Destino.huella`): qué debería poner cada texto
 * revisado a mano, para ATARLO al bullet de PRODUCT.md del que sale. Lo usan
 * `--huellas` (ver) y `--actualizar-huellas` (reescribir `mapa.ts`) del CLI, y
 * son PURAS: reciben PRODUCT.md ya parseado y el código de `mapa.ts` como
 * texto.
 *
 * Regenerar las huellas es el gesto de «he releído el bullet y el texto sigue
 * siendo cierto»: el comando no lo comprueba, así que antes hay que mirar qué
 * cambió (`git diff PRODUCT.md`) y retocar el texto del mapa si hace falta.
 */

export type HuellaActual = {
  clave: string;
  /** La que tiene escrita `mapa.ts`. */
  esperada: string;
  /** La de hoy; `null` si el bullet o la frase ya no se encuentran. */
  actual: string | null;
};

/** Cuántos elementos casan: el bullet de una entrada se identifica por su principio. */
function textoDelElemento(
  parseado: ProductMdParseado,
  seccion: string,
  grupo: string | null,
  empiezaPor: RegExp
): string | null {
  const elementos = [...parseado.bullets, ...parseado.parrafos].filter(
    (e) =>
      e.seccion === seccion && e.grupo === grupo && empiezaPor.test(e.texto)
  );
  return elementos.length === 1 ? elementos[0].texto : null;
}

export function huellasActuales(parseado: ProductMdParseado): HuellaActual[] {
  const huellas: HuellaActual[] = [];

  for (const entrada of MAPA_DE_PRODUCT) {
    if (!("destino" in entrada)) continue;
    const texto = textoDelElemento(
      parseado,
      entrada.seccion,
      entrada.grupo,
      entrada.empiezaPor
    );
    huellas.push({
      clave: entrada.destino.clave,
      esperada: entrada.destino.huella,
      actual: texto === null ? null : huellaDe(texto),
    });
  }

  for (const declarada of FRASES_DECLARADAS) {
    const bullet = parseado.bullets.find(
      (b) =>
        b.seccion === SECCION_CAPACIDADES &&
        b.grupo === declarada.grupo &&
        declarada.dentroDe.test(b.texto)
    );
    const encontrada = bullet ? declarada.frase.exec(bullet.texto) : null;
    const oracion =
      bullet && encontrada
        ? (bullet.texto
            .split(/(?<=\.)\s+/)
            .find((o) => o.includes(encontrada[0])) ?? encontrada[0])
        : null;
    huellas.push({
      clave: declarada.destino.clave,
      esperada: declarada.destino.huella,
      actual: oracion === null ? null : huellaDe(oracion),
    });
  }
  return huellas;
}

const HUELLA = /^[0-9a-f]{12}$/;

/**
 * `mapa.ts` con la huella de cada clave al día. Cada `Destino` lleva la huella
 * justo debajo de su `clave:` (`clave: "…",` y `huella: "…",` en líneas
 * seguidas): esa forma es la que se reescribe, y si una clave no la tiene así
 * se falla en lugar de dejarla sin tocar.
 */
export function reescribirHuellas(
  codigoDelMapa: string,
  huellas: readonly HuellaActual[]
): string {
  let resultado = codigoDelMapa;
  for (const h of huellas) {
    if (h.actual === null) {
      throw new Error(
        `[Conocimiento] La clave ${h.clave} ya no encuentra su origen en PRODUCT.md: no se puede calcular su huella. Arregla primero eso (--comprobar dice qué).`
      );
    }
    if (!HUELLA.test(h.actual)) {
      throw new Error(`[Conocimiento] Huella no válida para ${h.clave}.`);
    }
    const clave = h.clave.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const forma = new RegExp(
      `(clave: "${clave}",\\s*huella: ")[0-9a-f]{12}(")`
    );
    if (!forma.test(resultado)) {
      throw new Error(
        `[Conocimiento] No encuentro \`clave: "${h.clave}",\` seguida de \`huella: "…"\` en mapa.ts.`
      );
    }
    resultado = resultado.replace(forma, `$1${h.actual}$2`);
  }
  return resultado;
}
