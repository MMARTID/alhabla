import { describe, it, expect } from "vitest";
import {
  codigoPostal,
  cooficialDeLaZona,
} from "../../../src/lib/idiomas/zona.js";

describe("codigoPostal", () => {
  it("lo saca de las direcciones de Google Places", () => {
    expect(
      codigoPostal("Av. Rei en Jaume, 231, 08440 Cardedeu, Barcelona, Spain")
    ).toBe("08440");
    expect(
      codigoPostal("C. Caballero de Rodas, 101, 03182 Torrevieja, Alicante, Spain")
    ).toBe("03182");
  });

  it("sin código postal, o con números que no lo son, null", () => {
    expect(codigoPostal("Calle Anselm Clavé, 14")).toBeNull();
    // Teléfono pegado (9 cifras) y una «provincia» que no existe (99).
    expect(codigoPostal("Llámanos al 930453219, local 99123")).toBeNull();
    expect(codigoPostal(null)).toBeNull();
    expect(codigoPostal("")).toBeNull();
  });

  it("con varios, el último: el código postal va detrás del número de la calle", () => {
    expect(codigoPostal("Polígono 12345, nave 3, 46001 Valencia")).toBe("46001");
  });
});

describe("cooficialDeLaZona", () => {
  it.each([
    ["08440 Cardedeu", "ca-ES"],
    ["17001 Girona", "ca-ES"],
    ["25001 Lleida", "ca-ES"],
    ["43001 Tarragona", "ca-ES"],
    ["07001 Palma", "ca-ES"],
    ["46001 València", "ca-ES"],
    ["12001 Castelló", "ca-ES"],
    ["03182 Torrevieja", "ca-ES"],
    ["48001 Bilbao", "eu-ES"],
    ["20001 Donostia", "eu-ES"],
    ["01001 Vitoria-Gasteiz", "eu-ES"],
    ["15001 A Coruña", "gl-ES"],
    ["27001 Lugo", "gl-ES"],
    ["32001 Ourense", "gl-ES"],
    ["36201 Vigo", "gl-ES"],
  ])("%s → %s", (address, cooficial) => {
    expect(cooficialDeLaZona({ address })).toBe(cooficial);
  });

  it("fuera de esas provincias (Navarra incluida), null", () => {
    expect(cooficialDeLaZona({ address: "28013 Madrid" })).toBeNull();
    expect(cooficialDeLaZona({ address: "31001 Pamplona" })).toBeNull();
    expect(cooficialDeLaZona({})).toBeNull();
  });

  // INFINITY en producción: la dirección se guardó a mano sin código
  // postal, pero la bienvenida dejó la de Places en businessDetails.
  it("si la dirección no lo lleva, el de businessDetails", () => {
    expect(
      cooficialDeLaZona({
        address: "Calle Anselm Clavé, 14",
        businessDetails:
          "INFINITY Hair Salon\nAv. Rei en Jaume, 231, 08440 Cardedeu, Barcelona, Spain",
      })
    ).toBe("ca-ES");
  });

  it("si la dirección lo lleva, manda la dirección", () => {
    expect(
      cooficialDeLaZona({
        address: "Calle Mayor 1, 28013 Madrid",
        businessDetails: "Antes en 08440 Cardedeu",
      })
    ).toBeNull();
  });
});
