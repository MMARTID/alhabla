import { describe, it, expect } from "vitest";
import { buildOperationalStatus } from "@/components/operational-status";
import type { Business, SubscriptionStatus } from "@/lib/types";

function recepcionista(cambios: Partial<Business>) {
  const business = {
    id: "biz1",
    name: "Peluquería Ana",
    active: true,
    subscriptionStatus: "ACTIVE",
    callsSuspendedAt: null,
    ...cambios,
  } as Business;
  return buildOperationalStatus({
    business,
    agentActive: true,
    phone: undefined,
    forwardingStatus: null,
  }).find((item) => item.key === "agent");
}

describe("buildOperationalStatus — recepcionista y suscripción", () => {
  // El backend cuelga las llamadas de una suscripción sin cobro posible
  // (phone/telnyxInbound.ts): la app no puede decir «Atendiendo llamadas».
  it.each<SubscriptionStatus>(["CANCELED", "UNPAID", "INCOMPLETE_EXPIRED"])(
    "con la suscripción en %s dice que no contesta",
    (subscriptionStatus) => {
      const item = recepcionista({ subscriptionStatus });

      expect(item?.value).toBe("No contesta: sin plan activo");
      expect(item?.tone).toBe("error");
      expect(item?.action).toMatchObject({ href: "/ajustes/facturacion" });
    }
  );

  it("el impago vencido conserva su propio texto", () => {
    const item = recepcionista({
      subscriptionStatus: "UNPAID",
      callsSuspendedAt: "2026-10-01T00:00:00Z",
    });

    expect(item?.value).toBe("Suspendida por impago");
  });

  it.each<SubscriptionStatus | null>(["ACTIVE", "TRIALING", "PAST_DUE", null])(
    "con la suscripción en %s sigue atendiendo",
    (subscriptionStatus) => {
      expect(recepcionista({ subscriptionStatus })?.value).toBe(
        "Atendiendo llamadas"
      );
    }
  );
});
