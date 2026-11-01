import { describe, it, expect } from "vitest";
import { precioEnLaInformacion } from "../../src/lib/precioEnLaInformacion.js";

describe("precioEnLaInformacion", () => {
  it("la frase que habla del precio del servicio, tal cual (E5b)", () => {
    expect(
      precioEnLaInformacion(
        "Tinte",
        "Peluquería de barrio. Tintes desde 30 €. Hay aparcamiento en la calle."
      )
    ).toBe("Tintes desde 30 €");
  });

  it("corta por comas, pero no por la coma decimal", () => {
    expect(
      precioEnLaInformacion(
        "Tinte",
        "Corte de mujer 18 €, tintes desde 32,50 €, se paga con tarjeta."
      )
    ).toBe("tintes desde 32,50 €");
  });

  it("sin tildes ni mayúsculas, y la raíz del nombre casa con el plural", () => {
    expect(
      precioEnLaInformacion(
        "Lifting de pestañas",
        "LIFTING DE PESTAÑAS: CON PRESUPUESTO"
      )
    ).toBe("LIFTING DE PESTAÑAS: CON PRESUPUESTO");
  });

  it("nada si la frase no habla de precio", () => {
    expect(
      precioEnLaInformacion("Tinte", "Usamos tintes sin amoniaco.")
    ).toBeNull();
  });

  it("nada si la frase es de otro servicio", () => {
    expect(precioEnLaInformacion("Corte", "Tintes desde 30 €.")).toBeNull();
  });

  it("las palabras cortas del nombre no casan con cualquier cosa", () => {
    expect(precioEnLaInformacion("Uñas", "Precios desde 10 €.")).toBeNull();
  });

  it("nada sin información", () => {
    expect(precioEnLaInformacion("Tinte", null)).toBeNull();
    expect(precioEnLaInformacion("Tinte", "  ")).toBeNull();
  });

  it("como mucho dos trozos y 200 caracteres", () => {
    const largo = `Tintes desde 30 € ${"y más ".repeat(60)}`;
    const texto = precioEnLaInformacion(
      "Tinte",
      `Tintes cortos 30 €. Tintes largos 40 €. Tintes con mechas 50 €. ${largo}`
    );
    expect(texto).toBe("Tintes cortos 30 €; Tintes largos 40 €");
    expect(precioEnLaInformacion("Tinte", largo)!.length).toBeLessThanOrEqual(
      200
    );
  });
});
