import { describe, it, expect } from "vitest";
import {
  IDIOMAS_DEL_EQUIPO,
  hablaElIdioma,
  idiomaDelEquipoPorNombre,
  idiomaParaElReparto,
  idiomasDelEquipoParaElPanel,
  idiomasDelProfesional,
  idiomasEnPalabras,
  seDiceAlConfirmar,
} from "../../src/lib/idiomasDelEquipo.js";
import { CODIGOS_DE_IDIOMA } from "../../src/lib/idiomas/catalogo.js";

describe("idiomas del equipo", () => {
  it("se marcan todos los del catálogo menos el castellano, en su orden", () => {
    expect(IDIOMAS_DEL_EQUIPO).toEqual(
      CODIGOS_DE_IDIOMA.filter((codigo) => codigo !== "es-ES")
    );
    expect(idiomasDelEquipoParaElPanel()[0]).toEqual({
      codigo: "en-GB",
      etiqueta: "Inglés",
    });
  });

  it("lo guardado sale limpio: sin repetidos, sin retirados y en el orden del catálogo", () => {
    expect(
      idiomasDelProfesional(["ca-ES", "en-GB", "ca-ES", "xx-XX", "es-ES"])
    ).toEqual(["en-GB", "ca-ES"]);
    expect(idiomasDelProfesional(null)).toEqual([]);
    expect(idiomasDelProfesional(undefined)).toEqual([]);
  });

  it("el castellano, un código desconocido o ningún idioma no cuentan para el reparto", () => {
    expect(idiomaParaElReparto("es-ES")).toBeNull();
    expect(idiomaParaElReparto("xx-XX")).toBeNull();
    expect(idiomaParaElReparto(undefined)).toBeNull();
    expect(idiomaParaElReparto("eu-ES")).toBe("eu-ES");
  });

  it("sin idioma que contar, todos lo hablan; con uno, solo quien lo tiene", () => {
    expect(hablaElIdioma([], "es-ES")).toBe(true);
    expect(hablaElIdioma(undefined, null)).toBe(true);
    expect(hablaElIdioma(["en-GB"], "en-GB")).toBe(true);
    expect(hablaElIdioma(["en-GB"], "ca-ES")).toBe(false);
    expect(hablaElIdioma(null, "ca-ES")).toBe(false);
  });

  it("los dice en español, con «e» delante de un sonido de i", () => {
    expect(idiomasEnPalabras([])).toBe("");
    expect(idiomasEnPalabras(["ca-ES"])).toBe("catalán");
    expect(idiomasEnPalabras(["ca-ES", "en-GB"])).toBe("catalán e inglés");
    expect(idiomasEnPalabras(["fr-FR", "it-IT"])).toBe("francés e italiano");
    expect(idiomasEnPalabras(["en-GB", "fr-FR", "ru-RU"])).toBe(
      "inglés, francés y ruso"
    );
  });

  it("al confirmar solo se dice con los extranjeros", () => {
    expect(seDiceAlConfirmar("en-GB")).toBe(true);
    expect(seDiceAlConfirmar("ru-RU")).toBe(true);
    expect(seDiceAlConfirmar("ca-ES")).toBe(false);
    expect(seDiceAlConfirmar("gl-ES")).toBe(false);
    expect(seDiceAlConfirmar("eu-ES")).toBe(false);
    expect(seDiceAlConfirmar(null)).toBe(false);
  });

  it("entiende cómo los dice el dueño", () => {
    expect(idiomaDelEquipoPorNombre("Catalán")).toBe("ca-ES");
    expect(idiomaDelEquipoPorNombre(" catala ")).toBe("ca-ES");
    expect(idiomaDelEquipoPorNombre("valenciano")).toBe("ca-ES");
    expect(idiomaDelEquipoPorNombre("INGLÉS")).toBe("en-GB");
    expect(idiomaDelEquipoPorNombre("en")).toBe("en-GB");
    expect(idiomaDelEquipoPorNombre("pt-PT")).toBe("pt-PT");
    expect(idiomaDelEquipoPorNombre("vasco")).toBe("eu-ES");
    expect(idiomaDelEquipoPorNombre("Español")).toBe("castellano");
    expect(idiomaDelEquipoPorNombre("chino")).toBeNull();
  });
});
