import { describe, it, expect } from "vitest";
import { buildOperationalStatus } from "@/components/operational-status";
import type { ActiveCalendar, Business, SubscriptionStatus } from "@/lib/types";

const CALENDARIO_CONECTADO: ActiveCalendar = {
  provider: "google",
  connected: true,
  calendarId: "primary",
  accountEmail: "ana@gmail.com",
  disconnectedAt: null,
  lastError: null,
};

function recepcionista(cambios: Partial<Business>) {
  const business = {
    id: "biz1",
    name: "Peluquería Ana",
    active: true,
    subscriptionStatus: "ACTIVE",
    callsSuspendedAt: null,
    activeCalendar: CALENDARIO_CONECTADO,
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

// Sin calendario operativo la recepcionista toma nota pero no reserva
// (voiceTools: check_availability y book_appointment). «Atendiendo llamadas»
// a secas escondía que el negocio no estaba recibiendo citas.
describe("buildOperationalStatus — recepcionista sin calendario", () => {
  it("sin ningún calendario conectado dice que atiende pero no reserva, y manda a conectarlo", () => {
    const item = recepcionista({ activeCalendar: null });

    expect(item?.value).toBe("Atiende, pero no reserva");
    expect(item?.tone).toBe("warning");
    expect(item?.action).toMatchObject({
      label: "Conectar agenda",
      href: "/agente?section=calendar-section",
    });
  });

  it("con el calendario caducado manda a reconectarlo", () => {
    const item = recepcionista({
      activeCalendar: {
        ...CALENDARIO_CONECTADO,
        connected: false,
        disconnectedAt: "2026-10-20T10:00:00Z",
        lastError: "invalid_grant",
      },
    });

    expect(item?.value).toBe("Atiende, pero no reserva");
    expect(item?.action).toMatchObject({ label: "Reconectar agenda" });
  });

  it("los estados más graves (impago, sin plan, inactiva) mandan sobre el calendario", () => {
    expect(
      recepcionista({ activeCalendar: null, subscriptionStatus: "CANCELED" })?.value
    ).toBe("No contesta: sin plan activo");
    expect(recepcionista({ activeCalendar: null, active: false })?.value).toBe(
      "Inactiva"
    );
  });
});
