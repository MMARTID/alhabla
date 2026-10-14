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
    expect(codigoPostal("Polígono 12345 Nave 3, 46001 Valencia")).toBe("46001");
  });

  // Cifras sueltas del texto libre de businessDetails.
  it("solo si le sigue el nombre del lugar", () => {
    expect(codigoPostal("Más de 15000 clientes atendidos")).toBeNull();
    expect(codigoPostal("Llevamos 15000 años")).toBeNull();
  });

  // La bienvenida ofrece otros países: sus códigos de cinco cifras se
  // confundirían con provincias españolas (revisión del 2026-10-14).
  it.each([
    "Via Dante, 5, 20123 Milano MI, Italia",
    "Jungfernstieg 1, 20095 Hamburg, Deutschland",
    "Prager Str. 2, 01069 Dresden, Alemania",
    "Cours Napoléon, 20000 Ajaccio, Francia",
    "Av. Insurgentes 1, 03940 Ciudad de México, CDMX, México",
    "100 Main St, 32801 Orlando, FL, Estados Unidos",
    "Ringstraße 1, 01010 Wien, Österreich",
  ])("fuera de España, null: %s", (direccion) => {
    expect(codigoPostal(direccion)).toBeNull();
  });

  it("el país de otra línea no anula la de la dirección", () => {
    expect(
      codigoPostal(
        "Peluquería con clientes de Francia\nCarrer Major 5, 08440 Cardedeu, Barcelona, España"
      )
    ).toBe("08440");
  });
});

describe("cooficialDeLaZona", () => {
  it.each([
    ["08440 Cardedeu", "ca-ES"],
    ["17001 Girona", "ca-ES"],
    ["25001 Lleida", "ca-ES"],
    ["43001 Tarragona", "ca-ES"],
    ["07001 Palma", "ca-ES"],
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

  // Decisión del usuario del 2026-10-14: ni la Comunitat Valenciana (buena
  // parte habla castellano, como Torrevieja) ni Navarra.
  it.each([
    "28013 Madrid",
    "31001 Pamplona",
    "46001 València",
    "12001 Castelló",
    "03182 Torrevieja",
  ])("fuera de esas provincias, null: %s", (address) => {
    expect(cooficialDeLaZona({ address })).toBeNull();
  });

  it("sin dirección ni detalles, null", () => {
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
