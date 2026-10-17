import { describe, it, expect } from "vitest";
import {
  plans,
  starterPlan,
  formatPlanPrice,
  formatPriceWithVat,
  formatExtraMinute,
  formatIncludedMinutes,
  PRECIO_DESDE,
} from "@/lib/plans";

describe("plans", () => {
  it("starterPlan es el primer plan de la lista (inicio)", () => {
    expect(starterPlan.id).toBe("inicio");
    expect(starterPlan).toBe(plans[0]);
  });

  it("solo un plan está marcado como featured", () => {
    expect(plans.filter((plan) => plan.featured)).toHaveLength(1);
  });

  // Tabla del 2026-10-16, sin IVA. Minutos y extras tienen que coincidir con
  // backend/src/modules/billing/catalog.ts y con los precios de Stripe.
  it("muestra la tabla de precios aprobada", () => {
    expect(plans.map(({ id, price, founderPrice, minutes, extraPerMinute }) => ({ id, price, founderPrice, minutes, extraPerMinute }))).toEqual([
      { id: "inicio", price: 59, founderPrice: 39, minutes: 200, extraPerMinute: 0.3 },
      { id: "pro", price: 139, founderPrice: 99, minutes: 600, extraPerMinute: 0.25 },
      { id: "scale", price: 269, founderPrice: 199, minutes: 1500, extraPerMinute: 0.2 },
    ]);
  });

  it("anuncia el precio desde el plan más barato, sin IVA", () => {
    expect(PRECIO_DESDE).toBe("Desde 59 € + IVA/mes");
  });
});

describe("formatPlanPrice", () => {
  it("añade el símbolo de euro sin decimales", () => {
    expect(formatPlanPrice(149)).toBe("149 €");
  });
});

describe("formatPriceWithVat", () => {
  it("suma el 21 % de IVA con coma decimal", () => {
    expect(formatPriceWithVat(59)).toBe("71,39 € con IVA");
    expect(formatPriceWithVat(139)).toBe("168,19 € con IVA");
    expect(formatPriceWithVat(269)).toBe("325,49 € con IVA");
    expect(formatPriceWithVat(99)).toBe("119,79 € con IVA");
  });
});

describe("formatExtraMinute", () => {
  it("usa coma decimal y añade la etiqueta por minuto", () => {
    expect(formatExtraMinute(0.6)).toBe("0,60 €/min adicional + IVA");
  });

  it("redondea a dos decimales", () => {
    expect(formatExtraMinute(0.456)).toBe("0,46 €/min adicional + IVA");
  });
});

describe("formatIncludedMinutes", () => {
  it("formatea miles con separador español", () => {
    expect(formatIncludedMinutes(1000)).toBe("1000");
    expect(formatIncludedMinutes(100)).toBe("100");
  });
});
