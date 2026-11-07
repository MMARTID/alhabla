/**
 * Los idiomas que habla cada profesional del equipo además del castellano
 * (`Professional.idiomas`). Decisión del usuario del 2026-11-07: la cita va
 * primero a quien habla el idioma de quien llama, después al especialista y
 * después a quien tenga el día más despejado (lib/availability.ts).
 *
 * Es lo que ayuda al negocio a estar «en condicions de poder atendre» a
 * quien le habla en catalán (Llei 1/1998 de política lingüística, art.
 * 32.1, y Codi de consum de Catalunya, art. 128-1). Es un deber del
 * establecimiento, no de cada empleado (STC 88/2017): basta con
 * organizarse para que le atienda alguien que lo habla. La ley estatal de
 * atención a la clientela (Ley 10/2025) solo obliga a empresas grandes.
 *
 * Los idiomas son los del catálogo de la recepcionista
 * (lib/idiomas/catalogo.ts): el de quien llama llega en el `idioma` de
 * check_availability y solo puede ser uno de ellos. Módulo puro.
 */
import {
  CODIGOS_DE_IDIOMA,
  IDIOMAS,
  esCodigoDeIdioma,
  esCooficial,
  type CodigoDeIdioma,
} from "./idiomas/catalogo.js";

/** Un idioma que se puede marcar en un profesional: cualquiera del
 * catálogo menos el castellano, que se da por hecho. */
export type IdiomaDelEquipo = Exclude<CodigoDeIdioma, "es-ES">;

/** Los que se pueden marcar, en el orden del catálogo. */
export const IDIOMAS_DEL_EQUIPO: readonly IdiomaDelEquipo[] =
  CODIGOS_DE_IDIOMA.filter(
    (codigo): codigo is IdiomaDelEquipo => codigo !== "es-ES"
  );

export function esIdiomaDelEquipo(valor: unknown): valor is IdiomaDelEquipo {
  return esCodigoDeIdioma(valor) && valor !== "es-ES";
}

/** Lo guardado, limpio: solo los que siguen en el catálogo, sin repetir y
 * en su orden. Un idioma retirado del catálogo deja de contar sin tocar la
 * BD. */
export function idiomasDelProfesional(
  guardados: readonly string[] | null | undefined
): IdiomaDelEquipo[] {
  const marcados = new Set(guardados ?? []);
  return IDIOMAS_DEL_EQUIPO.filter((codigo) => marcados.has(codigo));
}

/** El idioma de quien llama que cuenta para el reparto. Con el castellano o
 * sin idioma, ninguno: todo el equipo lo habla. */
export function idiomaParaElReparto(
  idioma: string | null | undefined
): IdiomaDelEquipo | null {
  return esIdiomaDelEquipo(idioma) ? idioma : null;
}

/** Si un profesional habla el idioma de quien llama. Sin idioma que contar
 * (castellano o ninguno), todos. */
export function hablaElIdioma(
  idiomasDelPro: readonly string[] | null | undefined,
  idioma: string | null | undefined
): boolean {
  const delReparto = idiomaParaElReparto(idioma);
  return delReparto === null || (idiomasDelPro ?? []).includes(delReparto);
}

/** Cómo se dice el idioma en una frase en español: «inglés», «catalán». */
export function nombreDelIdioma(idioma: IdiomaDelEquipo): string {
  return IDIOMAS[idioma].nombreEnPrompt;
}

/** «catalán», «catalán e inglés», «francés, alemán y ruso»: con «e» delante
 * de un sonido de i («e inglés», «e italiano»). */
export function idiomasEnPalabras(idiomas: readonly IdiomaDelEquipo[]): string {
  const nombres = idiomas.map(nombreDelIdioma);
  if (nombres.length <= 1) return nombres[0] ?? "";
  const ultimo = nombres[nombres.length - 1];
  const conjuncion = /^h?i(?![aeiouáéó])/i.test(ultimo) ? "e" : "y";
  return `${nombres.slice(0, -1).join(", ")} ${conjuncion} ${ultimo}`;
}

/**
 * Si al confirmar la recepcionista dice que esa persona le atenderá en su
 * idioma. Solo con los extranjeros (decisión del usuario del 2026-11-07):
 * con el catalán, el gallego o el euskera, en su zona, suena a obviedad.
 */
export function seDiceAlConfirmar(idioma: IdiomaDelEquipo | null): boolean {
  return idioma !== null && !esCooficial(idioma);
}

/** Lo que enseña el panel en la ficha del profesional. */
export function idiomasDelEquipoParaElPanel(): Array<{
  codigo: IdiomaDelEquipo;
  etiqueta: string;
}> {
  return IDIOMAS_DEL_EQUIPO.map((codigo) => ({
    codigo,
    etiqueta: IDIOMAS[codigo].etiqueta,
  }));
}

/** Quita tildes y mayúsculas para comparar lo que escribe el dueño. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/** Otras formas de decir los idiomas que el dueño puede usar con el Gestor.
 * Las que no están aquí se reconocen por el nombre del catálogo. */
const OTROS_NOMBRES: Record<string, IdiomaDelEquipo> = {
  valenciano: "ca-ES",
  valencia: "ca-ES",
  balear: "ca-ES",
  mallorquin: "ca-ES",
  catala: "ca-ES",
  vasco: "eu-ES",
  euskara: "eu-ES",
  galego: "gl-ES",
  english: "en-GB",
  frances: "fr-FR",
  aleman: "de-DE",
  holandes: "nl-NL",
};

/** Los nombres del castellano, que no se marcan: se da por hecho. */
const NOMBRES_DEL_CASTELLANO = new Set(["castellano", "espanol", "es-es", "es"]);

/**
 * Un idioma dicho por el dueño («catalán», «Inglés», «ca-ES», «valenciano»)
 * como código del equipo. `"castellano"` si nombra el castellano (no se
 * marca) y null si no es ninguno del catálogo.
 */
export function idiomaDelEquipoPorNombre(
  dicho: string
): IdiomaDelEquipo | "castellano" | null {
  const limpio = normalizar(dicho);
  if (NOMBRES_DEL_CASTELLANO.has(limpio)) return "castellano";
  for (const codigo of IDIOMAS_DEL_EQUIPO) {
    if (
      limpio === codigo.toLowerCase() ||
      limpio === IDIOMAS[codigo].iso ||
      limpio === normalizar(IDIOMAS[codigo].nombreEnPrompt) ||
      limpio === normalizar(IDIOMAS[codigo].etiqueta)
    ) {
      return codigo;
    }
  }
  return OTROS_NOMBRES[limpio] ?? null;
}
