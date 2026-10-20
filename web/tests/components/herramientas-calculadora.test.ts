import { describe, expect, it } from "vitest";
import { calcular, estadoInicial, SEMANAS_POR_MES } from "@/components/herramientas/calculo-de-llamadas-perdidas";
import { plans } from "@/lib/plans";

/**
 * La cuenta que explica /herramientas/calculadora-de-llamadas-perdidas en
 * su apartado «El método»: si cambia una fórmula, la página miente.
 */
describe("calculadora de llamadas perdidas", () => {
  it("con los valores de partida de peluquería da la cuenta del método", () => {
    const r = calcular(estadoInicial("peluqueria"));
    const citas = 10 * SEMANAS_POR_MES * 0.6 * 0.3;
    expect(r.citasAlMes).toBeCloseTo(citas, 5);
    expect(r.perdidaAlMes).toBeCloseTo(citas * 45, 5);
    expect(r.perdidaAlAno).toBeCloseTo(citas * 45 * 12, 5);
  });

  it("la recurrencia suma solo las visitas siguientes de quien no vuelve", () => {
    const estado = { ...estadoInicial("barberia"), recurrencia: true };
    const r = calcular(estado);
    const citasAlAno = 10 * SEMANAS_POR_MES * 0.6 * 0.3 * 12;
    expect(r.perdidaConRecurrencia - r.perdidaAlAno).toBeCloseTo(citasAlAno * 0.25 * (12 - 1) * 25, 5);
  });

  it("elige el plan más barato contando los minutos extra", () => {
    const r = calcular(estadoInicial("peluqueria"));
    // 10 llamadas × 4,33 × 3 min ≈ 130 min: cabe en el primer plan.
    expect(r.recomendado?.plan.id).toBe(plans[0].id);
    expect(r.recomendado?.minutosExtra).toBe(0);
  });

  it("con más profesionales de los que admite un plan, salta al siguiente", () => {
    const r = calcular({ ...estadoInicial("peluqueria"), profesionales: "5" });
    expect(r.recomendado?.plan.id).not.toBe("inicio");
  });

  it("no divide por cero con un ticket vacío", () => {
    const r = calcular({ ...estadoInicial("peluqueria"), ticket: "" });
    expect(Number.isFinite(r.citasParaCubrirlo ?? 0)).toBe(true);
  });
});
