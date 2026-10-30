import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BILLING_PLANS } from "../../../src/modules/billing/catalog.js";
import { PLAN_FEATURES } from "../../../src/lib/planFeatures.js";
import { cargarDatosDeWeb } from "./cargarWeb.js";
import type { EntradaDeConocimiento } from "./construir.js";
import { articuloDeBlog } from "./frontmatter.js";
import { parsearProductMd } from "./productMd.js";
import { parsearReglasProhibidas } from "./reglasProhibidas.js";

/**
 * Lee del disco todo lo que el extractor necesita: PRODUCT.md, el
 * frontmatter del blog, la tabla de términos prohibidos, el nombre de cada
 * sector y (en un proceso hijo) los módulos de `web/`. Sin git ni red: así
 * `--comprobar` corre igual en CI que en el Mac.
 */

/** La raíz del repo: cuatro carpetas por encima de este fichero. */
export function raizPorDefecto(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
}

const CARPETA_DEL_BLOG = "web/content/blog";
const FICHERO_DE_REGLAS = "growth/agentes/reglas/afirmaciones-prohibidas.md";

async function leer(raiz: string, ruta: string): Promise<string> {
  try {
    return await readFile(join(raiz, ruta), "utf8");
  } catch (error) {
    throw new Error(
      `[Conocimiento] No se pudo leer ${ruta} desde ${raiz}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
}

/** `export const centroDeEstetica: SectorLanding` → `centroDeEstetica`. */
export function nombreExportadoDeSector(fuente: string): string | null {
  return /export const (\w+)\s*:\s*SectorLanding\b/.exec(fuente)?.[1] ?? null;
}

/** Solo PRODUCT.md parseado (para las huellas del mapa): sin cargar `web/`. */
export async function cargarProductMd(raiz: string = raizPorDefecto()) {
  return parsearProductMd(await leer(raiz, "PRODUCT.md"));
}

export async function cargarEntrada(
  raiz: string = raizPorDefecto()
): Promise<EntradaDeConocimiento> {
  const web = await cargarDatosDeWeb(raiz);

  const nombresDeArticulos = (await readdir(join(raiz, CARPETA_DEL_BLOG)))
    .filter((f) => f.endsWith(".mdx"))
    .sort();
  const articulos = await Promise.all(
    nombresDeArticulos.map(async (nombre) =>
      articuloDeBlog(
        nombre.replace(/\.mdx$/, ""),
        await leer(raiz, `${CARPETA_DEL_BLOG}/${nombre}`)
      )
    )
  );

  const exportsDeSectores: Record<string, string> = {};
  for (const sector of web.sectores) {
    const nombre = nombreExportadoDeSector(
      await leer(raiz, `web/src/lib/sectores/${sector.slug}.ts`)
    );
    if (nombre) exportsDeSectores[sector.slug] = nombre;
  }

  return {
    web,
    productMd: parsearProductMd(await leer(raiz, "PRODUCT.md")),
    articulos,
    reglas: parsearReglasProhibidas(await leer(raiz, FICHERO_DE_REGLAS)),
    planFeatures: PLAN_FEATURES,
    billing: BILLING_PLANS,
    exportsDeSectores,
  };
}
