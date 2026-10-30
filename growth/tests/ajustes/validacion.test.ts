import { describe, expect, it } from "vitest";
import {
  cambiosDe,
  camposDe,
  hayEdiciones,
  leerEntero,
  leerPorcentaje,
  textoDePorcentaje,
  validarCampos,
  type CamposDeAjustes,
} from "@/components/ajustes/validacion-de-ajustes";
import { ajustes } from "../helpers/d2-datos";

const LIMITES = ajustes().limites;
const VALORES = ajustes().valores;

function campos(cambios: Partial<CamposDeAjustes> = {}): CamposDeAjustes {
  return { ...camposDe(VALORES), ...cambios };
}

describe("leerEntero", () => {
  it.each([
    ["0", 0],
    ["7", 7],
    [" 20 ", 20],
    ["060", 60],
  ])("%j → %j", (texto, esperado) => {
    expect(leerEntero(texto)).toBe(esperado);
  });

  it.each([
    "",
    " ",
    "-1",
    "1.5",
    "1,5",
    "1e3",
    "abc",
    "+3",
    "12345678901",
    "٣",
  ])("%j no es un entero", (texto) => {
    expect(leerEntero(texto)).toBeNull();
  });
});

describe("leerPorcentaje", () => {
  it.each([
    ["60", 0.6],
    ["60 %", 0.6],
    ["62,5", 0.625],
    ["62.5", 0.625],
    ["40", 0.4],
    ["90", 0.9],
    ["7", 0.07],
    ["33,33", 0.3333],
  ])("%j → %j (sin ruido de coma flotante)", (texto, esperado) => {
    expect(leerPorcentaje(texto)).toBe(esperado);
  });

  it.each(["", "abc", "-5", "1,234", "1000", "5 5", "%", "0,6 %%"])(
    "%j no es un porcentaje",
    (texto) => {
      expect(leerPorcentaje(texto)).toBeNull();
    }
  );
});

describe("textoDePorcentaje", () => {
  it.each([
    [0.6, "60"],
    [0.4, "40"],
    [0.655, "65,5"],
    [0.07, "7"],
    [0.9, "90"],
  ])("%j → %j", (proporcion, esperado) => {
    expect(textoDePorcentaje(proporcion)).toBe(esperado);
  });

  it("ida y vuelta: lo que se enseña se vuelve a leer igual", () => {
    for (const p of [0.4, 0.45, 0.6, 0.655, 0.9]) {
      expect(leerPorcentaje(textoDePorcentaje(p))).toBe(p);
    }
  });
});

describe("validarCampos", () => {
  it("los valores iniciales son válidos", () => {
    expect(validarCampos(campos(), LIMITES)).toEqual({});
  });

  it.each([
    ["0", undefined],
    ["20", undefined],
    ["21", "Entre 0 y 20."],
    ["-1", "Debe ser un número entero, sin decimales."],
    ["3,5", "Debe ser un número entero, sin decimales."],
    ["", "Escribe cuántos contactos por semana."],
    ["muchos", "Debe ser un número entero, sin decimales."],
  ])("tope semanal %j → %j", (texto, error) => {
    expect(
      validarCampos(campos({ topeSemanal: texto }), LIMITES).topeSemanal
    ).toBe(error);
  });

  it.each([
    ["40", undefined],
    ["90", undefined],
    ["62,5", undefined],
    ["39", "Entre 40 y 90 %."],
    ["91", "Entre 40 y 90 %."],
    ["39,9", "Entre 40 y 90 %."],
    ["0", "Entre 40 y 90 %."],
    ["", "Escribe un porcentaje, por ejemplo 60."],
    ["mucho", "Debe ser un porcentaje, por ejemplo 60."],
  ])("similitud %j → %j", (texto, error) => {
    expect(
      validarCampos(campos({ umbralDeSimilitud: texto }), LIMITES)
        .umbralDeSimilitud
    ).toBe(error);
  });

  it.each([
    ["0", undefined],
    ["100", undefined],
    ["101", "Entre 0 y 100."],
    ["-3", "Debe ser un número entero, sin decimales."],
    ["", "Escribe una puntuación mínima."],
    ["70,5", "Debe ser un número entero, sin decimales."],
  ])("umbral por objetivo %j → %j", (texto, error) => {
    const errores = validarCampos(campos({ LEADS: texto }), LIMITES);
    expect(errores.LEADS).toBe(error);
    // Los otros dos objetivos siguen bien.
    expect(errores.BACKLINKS).toBeUndefined();
    expect(errores.TRAFICO_MARCA).toBeUndefined();
  });

  it("usa los límites que manda la API, no unos propios", () => {
    const estrechos = {
      ...LIMITES,
      topeSemanal: [1, 3] as [number, number],
      umbralDeSimilitud: [0.5, 0.7] as [number, number],
    };
    const errores = validarCampos(
      campos({ topeSemanal: "5", umbralDeSimilitud: "80" }),
      estrechos
    );
    expect(errores.topeSemanal).toBe("Entre 1 y 3.");
    expect(errores.umbralDeSimilitud).toBe("Entre 50 y 70 %.");
  });
});

describe("cambiosDe", () => {
  it("sin tocar nada no hay cambios", () => {
    expect(cambiosDe(VALORES, campos())).toEqual({});
  });

  it("manda solo lo que cambia, ya convertido", () => {
    expect(
      cambiosDe(VALORES, campos({ topeSemanal: "8", umbralDeSimilitud: "65" }))
    ).toEqual({ topeSemanal: 8, umbralDeSimilitud: 0.65 });
  });

  it("«060» es lo mismo que 60: no es un cambio", () => {
    expect(
      cambiosDe(VALORES, campos({ TRAFICO_MARCA: "060", topeSemanal: "05" }))
    ).toEqual({});
  });

  it("si cambia un umbral por objetivo manda los tres, como exige la API", () => {
    expect(cambiosDe(VALORES, campos({ BACKLINKS: "75" }))).toEqual({
      umbralesPorObjetivo: { TRAFICO_MARCA: 60, LEADS: 60, BACKLINKS: 75 },
    });
  });

  it("un campo inválido no entra en lo que se manda", () => {
    expect(
      cambiosDe(VALORES, campos({ topeSemanal: "abc", LEADS: "x" }))
    ).toEqual({});
    expect(
      cambiosDe(
        VALORES,
        campos({ topeSemanal: "9", LEADS: "x", BACKLINKS: "70" })
      )
    ).toEqual({ topeSemanal: 9 });
  });

  it("nunca incluye la pausa ni claves del sistema", () => {
    const cambios = cambiosDe(
      { ...VALORES, pausa: true },
      campos({ topeSemanal: "9", umbralDeSimilitud: "50", LEADS: "10" })
    );
    expect(Object.keys(cambios).sort()).toEqual([
      "topeSemanal",
      "umbralDeSimilitud",
      "umbralesPorObjetivo",
    ]);
    expect(Object.keys(cambios).some((k) => k.startsWith("sistema"))).toBe(
      false
    );
  });
});

describe("hayEdiciones", () => {
  it("detecta cualquier diferencia de texto", () => {
    expect(hayEdiciones(campos(), campos())).toBe(false);
    expect(hayEdiciones(campos(), campos({ LEADS: "61" }))).toBe(true);
    expect(hayEdiciones(campos(), campos({ topeSemanal: "05" }))).toBe(true);
  });
});
