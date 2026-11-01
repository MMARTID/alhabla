import { describe, it, expect } from "vitest";
import {
  BUSINESS_TYPES,
  BUSINESS_TYPE_LABELS,
  detectBusinessTypeFromPlace,
  detectBusinessTypeFromPlaceTypes,
  isBusinessType,
  normalizeBusinessType,
} from "../../src/lib/businessType.js";
import { PERFILES_DE_SECTOR } from "../../src/lib/sectores/perfiles.js";

describe("businessType", () => {
  describe("isBusinessType", () => {
    it("acepta valores válidos", () => {
      expect(isBusinessType("peluqueria")).toBe(true);
      expect(isBusinessType("other")).toBe(true);
    });

    it("rechaza valores inválidos", () => {
      expect(isBusinessType("invalid")).toBe(false);
      expect(isBusinessType(null)).toBe(false);
      expect(isBusinessType(123)).toBe(false);
    });
  });

  describe("normalizeBusinessType", () => {
    it("normaliza slugs de landing", () => {
      expect(normalizeBusinessType("peluqueria")).toBe("peluqueria");
      expect(normalizeBusinessType("centro-de-estetica")).toBe("centro-de-estetica");
    });

    it("devuelve other para valores desconocidos", () => {
      expect(normalizeBusinessType("unknown")).toBe("other");
    });
  });

  describe("detectBusinessTypeFromPlaceTypes", () => {
    it("detecta fisioterapia", () => {
      expect(
        detectBusinessTypeFromPlaceTypes([
          "physiotherapist",
          "health",
          "point_of_interest",
          "establishment",
        ])
      ).toBe("fisioterapia");
    });

    it("detecta peluquería", () => {
      expect(
        detectBusinessTypeFromPlaceTypes([
          "hair_care",
          "point_of_interest",
          "establishment",
        ])
      ).toBe("peluqueria");
    });

    it("detecta barbería", () => {
      expect(
        detectBusinessTypeFromPlaceTypes(["barber_shop", "establishment"])
      ).toBe("barberia");
    });

    it("detecta centro de estética", () => {
      expect(
        detectBusinessTypeFromPlaceTypes(["beauty_salon", "spa", "establishment"])
      ).toBe("centro-de-estetica");
    });

    it("detecta salón de uñas", () => {
      expect(
        detectBusinessTypeFromPlaceTypes(["nail_salon", "establishment"])
      ).toBe("salon-de-unas");
    });

    it("devuelve other cuando no hay coincidencia", () => {
      expect(
        detectBusinessTypeFromPlaceTypes([
          "restaurant",
          "point_of_interest",
          "establishment",
        ])
      ).toBe("other");
    });

    it("devuelve other para arrays vacíos o nulos", () => {
      expect(detectBusinessTypeFromPlaceTypes([])).toBe("other");
      expect(detectBusinessTypeFromPlaceTypes(null)).toBe("other");
      expect(detectBusinessTypeFromPlaceTypes(undefined)).toBe("other");
    });
  });
});

describe("detectBusinessTypeFromPlace", () => {
  it("manda el primaryType sobre types: una peluquería que también hace uñas es peluquería", () => {
    // Ficha real de Google ("Peluqueria Madrid - Ananda Ferdi"): con solo
    // `types` salía «Salón de uñas» y la demo de la landing era la que no era.
    expect(
      detectBusinessTypeFromPlace({
        primaryType: "hair_salon",
        types: ["hair_salon", "nail_salon", "massage_spa", "spa", "beauty_salon"],
      })
    ).toBe("peluqueria");
  });

  it("una barbería con primaryType barber_shop no se confunde con peluquería", () => {
    expect(
      detectBusinessTypeFromPlace({
        primaryType: "barber_shop",
        types: ["barber_shop", "hair_salon", "hair_care"],
      })
    ).toBe("barberia");
  });

  it("sin primaryType (o con uno genérico) cae en types", () => {
    expect(
      detectBusinessTypeFromPlace({ types: ["nail_salon", "establishment"] })
    ).toBe("salon-de-unas");
    expect(
      detectBusinessTypeFromPlace({
        primaryType: "establishment",
        types: ["physiotherapist"],
      })
    ).toBe("fisioterapia");
  });

  it("sin señales devuelve other", () => {
    expect(detectBusinessTypeFromPlace({ primaryType: null, types: [] })).toBe("other");
  });
});

describe("sectores nuevos (perfiles de sector, F4)", () => {
  it("pestañas y cejas, spa y masajes y peluquería canina son tipos de negocio con su etiqueta", () => {
    expect(BUSINESS_TYPE_LABELS["pestanas-y-cejas"]).toBe("Pestañas y cejas");
    expect(BUSINESS_TYPE_LABELS["spa-y-masajes"]).toBe("Spa y masajes");
    expect(BUSINESS_TYPE_LABELS["peluqueria-canina"]).toBe("Peluquería canina");
    // El registro desde su landing ya no los manda a «Otros».
    expect(normalizeBusinessType("spa-y-masajes")).toBe("spa-y-masajes");
  });

  it("todos los tipos tienen perfil y «other» va el último", () => {
    for (const tipo of BUSINESS_TYPES) {
      expect(PERFILES_DE_SECTOR[tipo].etiqueta, tipo).toBeTruthy();
      expect(PERFILES_DE_SECTOR[tipo].pautas.length, tipo).toBeGreaterThan(80);
    }
    expect(BUSINESS_TYPES.at(-1)).toBe("other");
  });

  it("un spa entra por su primaryType; una ficha con beauty_salon y spa sigue siendo estética", () => {
    expect(
      detectBusinessTypeFromPlace({
        primaryType: "spa",
        types: ["spa", "beauty_salon", "establishment"],
      })
    ).toBe("spa-y-masajes");
    expect(detectBusinessTypeFromPlaceTypes(["massage", "establishment"])).toBe(
      "spa-y-masajes"
    );
  });

  it("una peluquería canina se detecta por pet_care", () => {
    expect(
      detectBusinessTypeFromPlace({
        primaryType: "pet_care",
        types: ["pet_care", "point_of_interest"],
      })
    ).toBe("peluqueria-canina");
  });

  it("un dentista ya no sale fisioterapia (sin la palabra «health»)", () => {
    expect(
      detectBusinessTypeFromPlace({
        primaryType: "dentist",
        types: ["dentist", "health", "point_of_interest"],
      })
    ).toBe("other");
  });
});
