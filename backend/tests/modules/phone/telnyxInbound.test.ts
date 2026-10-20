import { describe, it, expect } from "vitest";
import { selectTelnyxInboundAgent } from "../../../src/modules/phone/telnyxInbound.js";

const AGENT = { id: "agent1", telnyxAssistantId: "assistant_1" };

describe("selectTelnyxInboundAgent", () => {
  it("devuelve el primer agente con assistant Telnyx operativo", () => {
    const result = selectTelnyxInboundAgent({
      subscriptionStatus: "ACTIVE",
      callsSuspendedAt: null,
      paymentFailureSuspensionAt: null,
      agents: [AGENT],
    });

    expect(result).toEqual(AGENT);
  });

  it("devuelve null si el negocio está suspendido manualmente", () => {
    const result = selectTelnyxInboundAgent({
      subscriptionStatus: "ACTIVE",
      callsSuspendedAt: new Date("2020-01-01"),
      paymentFailureSuspensionAt: null,
      agents: [AGENT],
    });

    expect(result).toBeNull();
  });

  it("devuelve null si la suspensión por impago ya venció", () => {
    const result = selectTelnyxInboundAgent(
      {
        subscriptionStatus: "ACTIVE",
      callsSuspendedAt: null,
        paymentFailureSuspensionAt: new Date("2024-01-01"),
        agents: [AGENT],
      },
      new Date("2024-06-01")
    );

    expect(result).toBeNull();
  });

  it("ignora una suspensión por impago futura (aviso todavía no efectivo)", () => {
    const result = selectTelnyxInboundAgent(
      {
        subscriptionStatus: "ACTIVE",
      callsSuspendedAt: null,
        paymentFailureSuspensionAt: new Date("2024-06-01"),
        agents: [AGENT],
      },
      new Date("2024-01-01")
    );

    expect(result).toEqual(AGENT);
  });

  // La auditoría del 20-10-2026: con la suscripción cancelada la
  // recepcionista seguía contestando (y luego no podía reservar).
  it.each(["CANCELED", "UNPAID", "INCOMPLETE_EXPIRED"])(
    "devuelve null si la suscripción está en %s",
    (subscriptionStatus) => {
      const result = selectTelnyxInboundAgent({
        subscriptionStatus,
        callsSuspendedAt: null,
        paymentFailureSuspensionAt: null,
        agents: [AGENT],
      });

      expect(result).toBeNull();
    }
  );

  it.each(["PAST_DUE", "TRIALING", "INCOMPLETE", null])(
    "atiende si la suscripción está en %s (gracia, prueba o sin Stripe)",
    (subscriptionStatus) => {
      const result = selectTelnyxInboundAgent({
        subscriptionStatus,
        callsSuspendedAt: null,
        paymentFailureSuspensionAt: null,
        agents: [AGENT],
      });

      expect(result).toEqual(AGENT);
    }
  );

  it("devuelve null si no hay ningún agente con telnyxAssistantId", () => {
    const result = selectTelnyxInboundAgent({
      subscriptionStatus: "ACTIVE",
      callsSuspendedAt: null,
      paymentFailureSuspensionAt: null,
      agents: [],
    });

    expect(result).toBeNull();
  });
});
