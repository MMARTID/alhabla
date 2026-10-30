import { describe, it, expect } from "vitest";
import type { GrowthEstadoOportunidad as Estado } from "@prisma/client";
import {
  esTerminal,
  puedeTransicionar,
  transicionesPosibles,
} from "../../../src/modules/growth/estados.js";

describe("estados de una oportunidad de Growth", () => {
  it("el agente avanza por el camino de descubrimiento", () => {
    expect(puedeTransicionar("detectada", "calificada", "agente")).toBe(true);
    expect(puedeTransicionar("calificada", "investigada", "agente")).toBe(true);
    expect(puedeTransicionar("investigada", "con_borrador", "agente")).toBe(
      true
    );
  });

  it("el agente no aprueba, devuelve ni da nada por gestionado", () => {
    expect(
      puedeTransicionar("pendiente_aprobacion", "aprobada", "agente")
    ).toBe(false);
    expect(
      puedeTransicionar("pendiente_aprobacion", "devuelta", "agente")
    ).toBe(false);
    expect(puedeTransicionar("aprobada", "gestionada", "agente")).toBe(false);
    expect(puedeTransicionar("gestionada", "conseguida", "agente")).toBe(false);
  });

  it("solo el administrador aprueba, devuelve y registra lo gestionado", () => {
    expect(puedeTransicionar("pendiente_aprobacion", "aprobada", "admin")).toBe(
      true
    );
    expect(puedeTransicionar("pendiente_aprobacion", "devuelta", "admin")).toBe(
      true
    );
    expect(puedeTransicionar("aprobada", "gestionada", "admin")).toBe(true);
    expect(puedeTransicionar("gestionada", "conseguida", "admin")).toBe(true);
    expect(puedeTransicionar("gestionada", "sin_respuesta", "admin")).toBe(
      true
    );
  });

  it("solo el sistema decide si un borrador pasa o queda bloqueado", () => {
    expect(
      puedeTransicionar("con_borrador", "pendiente_aprobacion", "sistema")
    ).toBe(true);
    expect(puedeTransicionar("con_borrador", "bloqueada", "sistema")).toBe(
      true
    );
    expect(
      puedeTransicionar("con_borrador", "pendiente_aprobacion", "agente")
    ).toBe(false);
    expect(
      puedeTransicionar("con_borrador", "pendiente_aprobacion", "admin")
    ).toBe(false);
  });

  it("no se salta pasos: no se aprueba lo que no se ha revisado", () => {
    expect(puedeTransicionar("detectada", "aprobada", "admin")).toBe(false);
    expect(
      puedeTransicionar("investigada", "pendiente_aprobacion", "sistema")
    ).toBe(false);
    expect(puedeTransicionar("aprobada", "conseguida", "admin")).toBe(false);
  });

  it("tras un bloqueo o una devolución el agente puede redactar otro borrador", () => {
    expect(puedeTransicionar("bloqueada", "con_borrador", "agente")).toBe(true);
    expect(puedeTransicionar("devuelta", "con_borrador", "agente")).toBe(true);
  });

  it("el agente solo descarta en las primeras etapas", () => {
    expect(puedeTransicionar("detectada", "descartada", "agente")).toBe(true);
    expect(puedeTransicionar("investigada", "descartada", "agente")).toBe(true);
    expect(
      puedeTransicionar("pendiente_aprobacion", "descartada", "agente")
    ).toBe(false);
    expect(puedeTransicionar("aprobada", "descartada", "agente")).toBe(false);
  });

  it("una aprobada que no se gestiona caduca por el sistema", () => {
    expect(puedeTransicionar("aprobada", "caducada", "sistema")).toBe(true);
    expect(puedeTransicionar("aprobada", "caducada", "agente")).toBe(false);
  });

  it("los estados finales no tienen salida", () => {
    const finales: Estado[] = [
      "conseguida",
      "sin_respuesta",
      "descartada",
      "caducada",
    ];
    for (const estado of finales) {
      expect(esTerminal(estado)).toBe(true);
      for (const actor of ["agente", "admin", "sistema"] as const) {
        expect(transicionesPosibles(estado, actor)).toEqual([]);
      }
    }
    expect(esTerminal("detectada")).toBe(false);
  });

  it("enumera lo que puede hacer el administrador con una pendiente", () => {
    expect(
      transicionesPosibles("pendiente_aprobacion", "admin").sort()
    ).toEqual(["aprobada", "descartada", "devuelta"]);
  });
});
