import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  BILLING_PLANS,
  getAllFounderPriceIds,
  getFounderPriceId,
  getPlanByPriceId,
  getPreviousPriceIds,
  isFounderPriceId,
} from "../../../src/modules/billing/catalog.js";

describe("BILLING_PLANS", () => {
  // Tabla del 2026-10-16. Los minutos incluidos TIENEN que coincidir con el
  // tramo gratis de los precios medidos de Stripe (STRIPE_PRICE_EXTRA_*).
  it("mantiene los minutos incluidos aprobados", () => {
    expect(BILLING_PLANS.inicio.includedMinutes).toBe(200);
    expect(BILLING_PLANS.pro.includedMinutes).toBe(600);
    expect(BILLING_PLANS.scale.includedMinutes).toBe(1500);
  });

  it("mantiene los precios de minutos extra aprobados", () => {
    expect(BILLING_PLANS.inicio.extraMinuteCents).toBe(30);
    expect(BILLING_PLANS.pro.extraMinuteCents).toBe(25);
    expect(BILLING_PLANS.scale.extraMinuteCents).toBe(20);
  });
});

// Al cambiar de tabla, quien sigue en un precio anterior tiene que seguir
// resolviendo a su plan aunque STRIPE_PRICE_INICIO ya apunte al nuevo — si
// no, getBillingSummary le devolvería plan/minutos/features a null.
describe("getPlanByPriceId", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env.STRIPE_PRICE_INICIO = "price_inicio_nuevo";
    process.env.STRIPE_PRICE_INICIO_FOUNDER = "price_inicio_fundador";
    process.env.STRIPE_PRICES_ANTERIORES_INICIO =
      "price_inicio_79, price_inicio_fundador_69";
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("reconoce el precio nuevo", () => {
    expect(getPlanByPriceId("price_inicio_nuevo")?.id).toBe("inicio");
  });

  it("reconoce el precio de fundador", () => {
    expect(getPlanByPriceId("price_inicio_fundador")?.id).toBe("inicio");
  });

  it("sigue reconociendo los precios de tablas anteriores", () => {
    expect(getPlanByPriceId("price_inicio_79")?.id).toBe("inicio");
    expect(getPlanByPriceId("price_inicio_fundador_69")?.id).toBe("inicio");
  });

  it("no reconoce un precio que no es de ningún plan", () => {
    expect(getPlanByPriceId("price_de_otra_cosa")).toBeUndefined();
  });
});

describe("getPreviousPriceIds", () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("sin la variable no hay precios anteriores", () => {
    delete process.env.STRIPE_PRICES_ANTERIORES_PRO;
    expect(getPreviousPriceIds("pro")).toEqual([]);
  });

  it("ignora espacios y comas sobrantes", () => {
    process.env.STRIPE_PRICES_ANTERIORES_PRO = " price_a ,, price_b ,";
    expect(getPreviousPriceIds("pro")).toEqual(["price_a", "price_b"]);
  });
});

describe("precio de fundador", () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("getFounderPriceId devuelve undefined si no hay precio de fundador configurado", () => {
    delete process.env.STRIPE_PRICE_INICIO_FOUNDER;
    expect(getFounderPriceId("inicio")).toBeUndefined();
  });

  it("getAllFounderPriceIds solo incluye los planes con precio de fundador configurado", () => {
    process.env.STRIPE_PRICE_INICIO_FOUNDER = "price_fundador_inicio";
    delete process.env.STRIPE_PRICE_PRO_FOUNDER;
    delete process.env.STRIPE_PRICE_SCALE_FOUNDER;

    expect(getAllFounderPriceIds()).toEqual(["price_fundador_inicio"]);
  });

  it("un precio de fundador anterior ya no cuenta como fundador", () => {
    process.env.STRIPE_PRICE_PRO_FOUNDER = "price_fundador_pro_99";
    process.env.STRIPE_PRICES_ANTERIORES_PRO = "price_fundador_pro_149";

    expect(isFounderPriceId("price_fundador_pro_99")).toBe(true);
    expect(isFounderPriceId("price_fundador_pro_149")).toBe(false);
    expect(isFounderPriceId(null)).toBe(false);
  });
});
