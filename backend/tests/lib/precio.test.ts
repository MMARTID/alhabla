import { describe, it, expect } from "vitest";
import { precioParaDecir } from "../../src/lib/precio.js";

describe("precioParaDecir", () => {
  it("escribe el precio como en España: sin «EUR» y sin «,00»", () => {
    expect(precioParaDecir(1800)).toBe("18 €");
    expect(precioParaDecir(1250)).toBe("12,50 €");
    expect(precioParaDecir(1999)).toBe("19,99 €");
    expect(precioParaDecir(5)).toBe("0,05 €");
    expect(precioParaDecir(0)).toBe("0 €");
  });

  it("los miles, como la RAE: sin punto en cuatro cifras, con él desde cinco", () => {
    expect(precioParaDecir(150_000)).toBe("1500 €");
    expect(precioParaDecir(1_500_050)).toBe("15.000,50 €");
  });

  it("un espacio normal antes del €, no el de no separación", () => {
    expect(precioParaDecir(1800)).not.toContain(" ");
  });

  it("sin precio, null: quien lo usa decide qué decir", () => {
    expect(precioParaDecir(null)).toBeNull();
    expect(precioParaDecir(undefined)).toBeNull();
    expect(precioParaDecir(Number.NaN)).toBeNull();
  });
});
