import { describe, it, expect } from "vitest";
import { datosPorCompletar, listaDeNombres } from "@/lib/datos-por-completar";
import type { BookingProfessional, BookingService } from "@/lib/types";

const profesional = (name: string, active = true): BookingProfessional => ({
  id: name,
  name,
  active,
  serviceIds: [],
  serviceLevels: {},
  createdAt: "",
  updatedAt: "",
});
const servicio = (name: string, priceCents: number | null, active = true): BookingService => ({
  id: name,
  name,
  durationMinutes: 30,
  priceCents,
  active,
  createdAt: "",
  updatedAt: "",
});

describe("datosPorCompletar", () => {
  it("encuentra a los profesionales activos con el nombre del alta", () => {
    const { profesionalesSinNombre } = datosPorCompletar({
      professionals: [
        profesional("Profesional 1"),
        profesional("Profesional 12"),
        profesional("Marta"),
        profesional("Profesional 3", false),
        profesional("Profesional Ana"),
      ],
      services: [],
    });

    expect(profesionalesSinNombre.map((p) => p.name)).toEqual(["Profesional 1", "Profesional 12"]);
  });

  it("encuentra los servicios activos sin precio, salvo con «Dar precios: nunca»", () => {
    const ajustes = {
      professionals: [],
      services: [servicio("Corte", null), servicio("Tinte", 0), servicio("Peinado", null, false)],
    };

    expect(datosPorCompletar(ajustes).serviciosSinPrecio.map((s) => s.name)).toEqual(["Corte"]);
    expect(datosPorCompletar(ajustes, "si_preguntan").serviciosSinPrecio).toHaveLength(1);
    expect(datosPorCompletar(ajustes, "nunca").serviciosSinPrecio).toEqual([]);
  });
});

describe("listaDeNombres", () => {
  it("enumera hasta tres y resume el resto", () => {
    expect(listaDeNombres(["Profesional 1"])).toBe("«Profesional 1»");
    expect(listaDeNombres(["A", "B", "C"])).toBe("«A», «B» y «C»");
    expect(listaDeNombres(["A", "B", "C", "D", "E"])).toBe("«A», «B» y 3 más");
  });
});
