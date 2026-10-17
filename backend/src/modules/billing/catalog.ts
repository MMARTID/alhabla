export const PLAN_IDS = ["inicio", "pro", "scale"] as const;

export type PlanId = (typeof PLAN_IDS)[number];

type BillingPlan = {
  id: PlanId;
  databasePlan: string;
  includedMinutes: number;
  extraMinuteCents: number;
  /** El precio con el que se abre un checkout NUEVO. */
  priceEnvironmentVariable: string;
  /**
   * El precio de fundador vigente: lo cobra el checkout mientras quedan
   * plazas del cupo (billing/service.ts). Opcional.
   */
  founderPriceEnvironmentVariable: string;
  /**
   * Lista separada por comas de precios que ya no se ofrecen a nadie nuevo
   * (vigentes y de fundador de tablas anteriores) pero que se siguen
   * reconociendo para este plan. Sin ella, `getPlanByPriceId` dejaría de
   * reconocer a quien siga en un precio antiguo (plan/minutos/features a
   * null). Opcional. Un precio de fundador antiguo NO cuenta para el cupo:
   * al cambiar la tabla, migrar a los fundadores al precio de fundador nuevo.
   */
  previousPricesEnvironmentVariable: string;
  usagePriceEnvironmentVariable: string;
};

export const BILLING_PLANS: Record<PlanId, BillingPlan> = {
  inicio: {
    id: "inicio",
    databasePlan: "basic",
    includedMinutes: 200,
    extraMinuteCents: 30,
    priceEnvironmentVariable: "STRIPE_PRICE_INICIO",
    founderPriceEnvironmentVariable: "STRIPE_PRICE_INICIO_FOUNDER",
    previousPricesEnvironmentVariable: "STRIPE_PRICES_ANTERIORES_INICIO",
    usagePriceEnvironmentVariable: "STRIPE_PRICE_EXTRA_INICIO",
  },
  pro: {
    id: "pro",
    databasePlan: "pro",
    includedMinutes: 600,
    extraMinuteCents: 25,
    priceEnvironmentVariable: "STRIPE_PRICE_PRO",
    founderPriceEnvironmentVariable: "STRIPE_PRICE_PRO_FOUNDER",
    previousPricesEnvironmentVariable: "STRIPE_PRICES_ANTERIORES_PRO",
    usagePriceEnvironmentVariable: "STRIPE_PRICE_EXTRA_PRO",
  },
  scale: {
    id: "scale",
    databasePlan: "enterprise",
    includedMinutes: 1500,
    extraMinuteCents: 20,
    priceEnvironmentVariable: "STRIPE_PRICE_SCALE",
    founderPriceEnvironmentVariable: "STRIPE_PRICE_SCALE_FOUNDER",
    previousPricesEnvironmentVariable: "STRIPE_PRICES_ANTERIORES_SCALE",
    usagePriceEnvironmentVariable: "STRIPE_PRICE_EXTRA_SCALE",
  },
};

export function getBillingPlan(planId: PlanId) {
  return BILLING_PLANS[planId];
}

export function getPriceId(planId: PlanId) {
  const plan = getBillingPlan(planId);
  const priceId = process.env[plan.priceEnvironmentVariable];

  if (!priceId) {
    throw new Error(`${plan.priceEnvironmentVariable} is not configured`);
  }

  return priceId;
}

export function getUsagePriceId(planId: PlanId) {
  const plan = getBillingPlan(planId);
  const priceId = process.env[plan.usagePriceEnvironmentVariable];
  if (!priceId) {
    throw new Error(`${plan.usagePriceEnvironmentVariable} is not configured`);
  }
  return priceId;
}

/** El precio de fundador de este plan, si hay uno configurado. */
export function getFounderPriceId(planId: PlanId) {
  return process.env[getBillingPlan(planId).founderPriceEnvironmentVariable] || undefined;
}

/** Los precios de tablas anteriores que se siguen reconociendo para el plan. */
export function getPreviousPriceIds(planId: PlanId): string[] {
  const valor =
    process.env[getBillingPlan(planId).previousPricesEnvironmentVariable] ?? "";
  return valor
    .split(",")
    .map((priceId) => priceId.trim())
    .filter(Boolean);
}

/** Todos los precios de fundador configurados, de cualquier plan. */
export function getAllFounderPriceIds(): string[] {
  return Object.values(BILLING_PLANS)
    .map((plan) => getFounderPriceId(plan.id))
    .filter((value): value is string => Boolean(value));
}

export function getPlanByPriceId(priceId: string) {
  return Object.values(BILLING_PLANS).find((plan) => {
    if (process.env[plan.priceEnvironmentVariable] === priceId) return true;
    if (getFounderPriceId(plan.id) === priceId) return true;
    return getPreviousPriceIds(plan.id).includes(priceId);
  });
}

/** Si el precio es el de fundador vigente de algún plan. */
export function isFounderPriceId(priceId: string | null | undefined) {
  return Boolean(priceId && getAllFounderPriceIds().includes(priceId));
}
