import { describe, expect, it } from "vitest";
import {
  ARTICULOS_PARA_TODOS,
  articulosParaSector,
  articulosRelacionados,
  esRamaDePrevisualizacion,
  minutosDeLectura,
  type ArticuloMeta,
} from "@/lib/blog";
import { GUIAS_POR_SECTOR, SIGUE_LEYENDO } from "@/lib/blog-enlaces";

function meta(
  slug: string,
  sector?: string,
  fecha = "2026-09-01"
): ArticuloMeta {
  return {
    slug,
    titulo: slug,
    resumen: "",
    fecha,
    autor: "Equipo de Alhabla",
    sector,
    minutosDeLectura: 1,
    idioma: "es",
    origen: "propio",
  };
}

describe("blog", () => {
  it("solo acepta la rama principal o ramas creadas por Keystatic", () => {
    expect(esRamaDePrevisualizacion("main")).toBe(true);
    expect(esRamaDePrevisualizacion("blog/agenda-para-spa")).toBe(true);
    expect(esRamaDePrevisualizacion("feature/otro-cambio")).toBe(false);
    expect(esRamaDePrevisualizacion("blog/../main")).toBe(false);
  });

  it("estima los minutos de lectura a 200 palabras por minuto, mínimo 1", () => {
    expect(minutosDeLectura("hola")).toBe(1);
    expect(minutosDeLectura(Array(450).fill("palabra").join(" "))).toBe(2);
    // La sintaxis de Markdown no cuenta como palabras.
    expect(minutosDeLectura("## Título\n\n- **negrita** _cursiva_")).toBe(1);
  });

  it("«Sigue leyendo»: primero el mismo sector, luego el resto, nunca el propio", () => {
    const todos = [
      meta("a", "barberia", "2026-09-05"),
      meta("b", "peluqueria", "2026-09-04"),
      meta("c", "barberia", "2026-09-03"),
      meta("d", undefined, "2026-09-02"),
      meta("e", "fisioterapia", "2026-09-01"),
    ];
    expect(
      articulosRelacionados(meta("a", "barberia"), todos, 3).map((a) => a.slug)
    ).toEqual(["c", "b", "d"]);
    expect(
      articulosRelacionados(meta("d"), todos, 2).map((a) => a.slug)
    ).toEqual(["a", "b"]);
    // Sin tope, enseña hasta ENLACES_DE_SIGUE_LEYENDO (cuatro).
    expect(
      articulosRelacionados(meta("a", "barberia"), todos).map((a) => a.slug)
    ).toEqual(["c", "b", "d", "e"]);
  });

  it("«Sigue leyendo»: lo escrito a mano va primero, aunque sea de otro sector y más viejo", () => {
    const [primero, segundo, tercero, cuarto] =
      SIGUE_LEYENDO["agenda-para-spa"];
    const todos = [
      meta("nuevo", undefined, "2026-10-30"),
      meta("agenda-para-spa", undefined, "2026-09-22"),
      meta(cuarto, "salon-de-unas", "2026-09-01"),
      meta(tercero, undefined, "2026-09-02"),
      meta("otro-del-mismo-sector", "spa", "2026-10-29"),
      meta(segundo, "peluqueria", "2026-09-03"),
      meta(primero, "centro-de-estetica", "2026-09-04"),
    ];
    expect(
      articulosRelacionados(meta("agenda-para-spa", "spa"), todos).map(
        (a) => a.slug
      )
    ).toEqual([primero, segundo, tercero, cuarto]);
    // Con menos hueco, se queda con los primeros de la lista a mano.
    expect(
      articulosRelacionados(meta("agenda-para-spa", "spa"), todos, 2).map(
        (a) => a.slug
      )
    ).toEqual([primero, segundo]);
    // Si uno de los escritos a mano no existe (borrador, retirado), se rellena.
    const sinUno = todos.filter((a) => a.slug !== segundo);
    expect(
      articulosRelacionados(meta("agenda-para-spa", "spa"), sinUno).map(
        (a) => a.slug
      )
    ).toEqual([primero, tercero, cuarto, "otro-del-mismo-sector"]);
  });

  it("guías de un sector: las escritas a mano para su oficio van antes que las de la ficha", () => {
    const [primera, segunda, tercera] = GUIAS_POR_SECTOR.barberia;
    const todos = [
      meta("de-ficha", "barberia", "2026-10-30"),
      meta(tercera),
      meta(ARTICULOS_PARA_TODOS[0]),
      meta(primera),
      meta(segunda),
    ];
    expect(articulosParaSector("barberia", todos).map((a) => a.slug)).toEqual([
      primera,
      segunda,
      tercera,
    ]);
    // Con solo una escrita a mano disponible, rellena por ficha y luego generales.
    expect(
      articulosParaSector("barberia", [todos[0], todos[2], todos[3]]).map(
        (a) => a.slug
      )
    ).toEqual([primera, "de-ficha", ARTICULOS_PARA_TODOS[0]]);
  });

  it("guías de un sector: primero las suyas y luego las generales, sin repetir", () => {
    const [primero, segundo, tercero] = ARTICULOS_PARA_TODOS;
    const todos = [
      meta("b1", "barberia", "2026-09-05"),
      meta(segundo),
      meta("p1", "peluqueria", "2026-09-04"),
      meta(primero),
      meta("b2", "barberia", "2026-09-03"),
      meta(tercero),
    ];
    expect(articulosParaSector("barberia", todos).map((a) => a.slug)).toEqual(["b1", "b2", primero]);
    expect(articulosParaSector("fisioterapia", todos).map((a) => a.slug)).toEqual([primero, segundo, tercero]);
    // Un artículo general que además es del sector no sale dos veces.
    const conSector = [meta(primero, "salon-de-unas"), meta(segundo)];
    expect(articulosParaSector("salon-de-unas", conSector).map((a) => a.slug)).toEqual([primero, segundo]);
  });
});
