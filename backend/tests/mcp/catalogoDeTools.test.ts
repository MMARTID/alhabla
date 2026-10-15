import { describe, expect, it } from "vitest";
import {
  avisosDeCuerpo,
  catalogoDeToolsDeVoz,
} from "../../mcp/catalogoDeTools.js";

describe("catalogoDeToolsDeVoz", () => {
  it("lista las tools reales con ruta, obligatorios y un ejemplo", () => {
    const catalogo = catalogoDeToolsDeVoz();
    const disponibilidad = catalogo.find(
      (tool) => tool.nombre === "check_availability"
    );
    expect(disponibilidad).toMatchObject({
      ruta: "/webhooks/telnyx/tools/check_availability",
      obligatorios: ["startDateTime", "durationMinutes"],
    });
    // El ejemplo trae lo obligatorio y la fecha con offset local.
    expect(disponibilidad?.ejemplo).toEqual({
      startDateTime: "2026-10-20T10:00:00+02:00",
      durationMinutes: 30,
    });
    expect(catalogo.map((tool) => tool.nombre)).toEqual(
      expect.arrayContaining(["get_catalog", "book_appointment", "cancel_appointment"])
    );
  });
});

describe("avisosDeCuerpo", () => {
  const ruta = "/webhooks/telnyx/tools/check_availability";

  it("no avisa de un cuerpo correcto", () => {
    expect(
      avisosDeCuerpo(ruta, {
        startDateTime: "2026-10-20T10:00:00+02:00",
        durationMinutes: 30,
      })
    ).toEqual([]);
  });

  it("avisa de lo que faltaba el día de «fecha» en vez de startDateTime", () => {
    const avisos = avisosDeCuerpo(ruta, { fecha: "2026-10-20" });
    expect(avisos).toEqual(
      expect.arrayContaining([
        "Falta el argumento obligatorio «startDateTime».",
        "Falta el argumento obligatorio «durationMinutes».",
        expect.stringContaining("«fecha» no es un argumento de check_availability"),
      ])
    );
  });

  it("avisa de un tipo equivocado", () => {
    expect(
      avisosDeCuerpo(ruta, {
        startDateTime: "2026-10-20T10:00:00+02:00",
        durationMinutes: "30",
      })
    ).toEqual(["«durationMinutes» debería ser number y es string."]);
  });

  it("calla con rutas que no son tools de voz", () => {
    expect(avisosDeCuerpo("/webhooks/telnyx/call", { lo: "que sea" })).toEqual([]);
  });
});
