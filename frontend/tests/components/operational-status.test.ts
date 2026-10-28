import { describe, it, expect } from "vitest";
import { buildOperationalStatus } from "@/components/operational-status";
import type { Business, SubscriptionStatus } from "@/lib/types";

const abierto = { enabled: true, intervals: [{ start: "09:00", end: "14:00" }] };
const cerrado = { enabled: false, intervals: [] };
const HORARIO = {
  version: 1,
  week: {
    monday: abierto,
    tuesday: abierto,
    wednesday: abierto,
    thursday: abierto,
    friday: abierto,
    saturday: cerrado,
    sunday: cerrado,
  },
  exceptions: [],
};
const AGENDA_CONECTADA = {
  calendarProvider: "google",
  activeCalendar: {
    provider: "google",
    connected: true,
    calendarId: "primary",
    accountEmail: null,
    disconnectedAt: null,
    lastError: null,
  },
} as Partial<Business>;

function senales(cambios: Partial<Business>) {
  const business = {
    id: "biz1",
    name: "Peluquería Ana",
    active: true,
    subscriptionStatus: "ACTIVE",
    callsSuspendedAt: null,
    schedule: HORARIO,
    ...AGENDA_CONECTADA,
    ...cambios,
  } as Business;
  return buildOperationalStatus({
    business,
    agentActive: true,
    phone: undefined,
    forwardingStatus: null,
  });
}

function recepcionista(cambios: Partial<Business>) {
  return senales(cambios).find((item) => item.key === "agent");
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

describe("buildOperationalStatus — atiende pero no reserva", () => {
  it("sin horario (el `{}` del registro) no dice «Atendiendo llamadas»", () => {
    const item = recepcionista({ schedule: {} });

    expect(item?.value).toBe("Atiende pero no reserva: falta el horario");
    expect(item?.tone).toBe("warning");
    expect(item?.action).toMatchObject({ href: "/agente?section=business-hours" });
    // Ninguna otra señal habla del horario: este aviso cuenta.
    expect(item?.cubiertoPor).toBeUndefined();
  });

  it("con todos los días cerrados tampoco reserva", () => {
    const item = recepcionista({
      schedule: { ...HORARIO, week: { ...HORARIO.week, monday: cerrado, tuesday: cerrado, wednesday: cerrado, thursday: cerrado, friday: cerrado } },
    });

    expect(item?.value).toBe("Atiende pero no reserva: falta el horario");
  });

  it("sin agenda conectada lo dice, y el aviso lo cubre la señal «Agenda»", () => {
    const items = senales({ activeCalendar: { ...AGENDA_CONECTADA.activeCalendar!, connected: false } });
    const item = items.find((señal) => señal.key === "agent");

    expect(item?.value).toBe("Atiende pero no reserva: falta conectar la agenda");
    expect(item?.cubiertoPor).toBe("calendar");
    expect(items.find((señal) => señal.key === "calendar")?.tone).toBe("warning");
  });

  it("con la agenda caducada pide reconectarla", () => {
    const item = recepcionista({
      activeCalendar: { ...AGENDA_CONECTADA.activeCalendar!, connected: false, disconnectedAt: "2026-10-20T00:00:00Z" },
    });

    expect(item?.value).toBe("Atiende pero no reserva: la agenda se desconectó");
    expect(item?.action).toMatchObject({ label: "Reconectar", href: "/agente?section=calendar-section" });
  });

  it("sin horario ni agenda, nombra las dos y manda primero al horario", () => {
    const item = recepcionista({ schedule: {}, activeCalendar: null });

    expect(item?.value).toBe("Atiende pero no reserva: faltan el horario y la agenda");
    expect(item?.action).toMatchObject({ href: "/agente?section=business-hours" });
  });

  it("la suspensión por impago manda sobre la falta de horario", () => {
    expect(recepcionista({ schedule: {}, callsSuspendedAt: "2026-10-01T00:00:00Z" })?.value).toBe(
      "Suspendida por impago"
    );
  });
});
