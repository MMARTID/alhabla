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
function senales(cambios: Partial<Business>) {
  const business = {
    id: "biz1",
    name: "Peluquería Ana",
    active: true,
    subscriptionStatus: "ACTIVE",
    callsSuspendedAt: null,
    schedule: HORARIO,
    activeCalendar: CALENDARIO_CONECTADO,
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

// PLAN-AGENDA-PRINCIPAL.md: la agenda de Alhabla viene puesta y reserva
// aunque no haya calendario conectado o este no se vea. La señal «Agenda»
// solo avisa si un calendario conectado dejó de verse.
describe("buildOperationalStatus — la agenda de Alhabla y el calendario conectado", () => {
  it("sin ningún calendario conectado atiende y reserva, y la señal Agenda dice la agenda de Alhabla", () => {
    const items = senales({ activeCalendar: null });

    expect(items.find((item) => item.key === "agent")).toMatchObject({
      value: "Atendiendo llamadas",
      tone: "ok",
    });
    expect(items.find((item) => item.key === "calendar")).toMatchObject({
      value: "Agenda de Alhabla",
      tone: "ok",
    });
  });

  it("con un calendario conectado lo nombra junto a la agenda", () => {
    expect(
      senales({ activeCalendar: CALENDARIO_CONECTADO }).find((item) => item.key === "calendar")
    ).toMatchObject({ value: "Agenda de Alhabla · con Google Calendar", tone: "ok" });
  });

  it("con el calendario caducado sigue reservando y pide reconectarlo, sin alarma", () => {
    const items = senales({
      activeCalendar: {
        ...CALENDARIO_CONECTADO,
        connected: false,
        disconnectedAt: "2026-10-20T10:00:00Z",
        lastError: "invalid_grant",
      },
    });

    expect(items.find((item) => item.key === "agent")?.value).toBe("Atendiendo llamadas");
    expect(items.find((item) => item.key === "calendar")).toMatchObject({
      value: "Reservando · sin ver Google Calendar",
      tone: "warning",
      action: { label: "Reconectar", href: "/agente?section=calendar-section" },
    });
  });

  it("el modo antiguo ya no cambia nada", () => {
    expect(
      recepcionista({ activeCalendar: null, modoDeAgenda: "externo" })?.value
    ).toBe("Atendiendo llamadas");
  });

  it("los estados más graves (impago, sin plan, inactiva) siguen mandando", () => {
    expect(
      recepcionista({ activeCalendar: null, subscriptionStatus: "CANCELED" })?.value
    ).toBe("No contesta: sin plan activo");
    expect(recepcionista({ activeCalendar: null, active: false })?.value).toBe(
      "Inactiva"
    );
  });
});

describe("buildOperationalStatus — recepcionista sin horario", () => {
  it("sin horario (el `{}` del registro) no dice «Atendiendo llamadas»", () => {
    const item = recepcionista({ schedule: {} });

    expect(item?.value).toBe("Atiende, pero no reserva: falta el horario");
    expect(item?.tone).toBe("warning");
    expect(item?.action).toMatchObject({ href: "/agente?section=business-hours" });
    // Ninguna otra señal habla del horario: este aviso cuenta.
    expect(item?.cubiertoPor).toBeUndefined();
  });

  it("con todos los días cerrados tampoco reserva", () => {
    const item = recepcionista({
      schedule: { ...HORARIO, week: { ...HORARIO.week, monday: cerrado, tuesday: cerrado, wednesday: cerrado, thursday: cerrado, friday: cerrado } },
    });

    expect(item?.value).toBe("Atiende, pero no reserva: falta el horario");
  });

  // La agenda de Alhabla también necesita el horario para ofrecer huecos.
  it("sin horario y sin calendario, solo falta el horario", () => {
    const item = recepcionista({ schedule: {}, activeCalendar: null });

    expect(item?.value).toBe("Atiende, pero no reserva: falta el horario");
    expect(item?.action).toMatchObject({ href: "/agente?section=business-hours" });
  });

  it("la suspensión por impago manda sobre la falta de horario", () => {
    expect(recepcionista({ schedule: {}, callsSuspendedAt: "2026-10-01T00:00:00Z" })?.value).toBe(
      "Suspendida por impago"
    );
  });
});
