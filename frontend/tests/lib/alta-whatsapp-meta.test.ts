import { describe, it, expect, vi } from "vitest";
import {
  abrirAltaEnCoexistencia,
  leerEventoDelAlta,
} from "@/lib/alta-whatsapp-meta";

const META = "https://www.facebook.com";

describe("leerEventoDelAlta", () => {
  it("ignora mensajes que no vienen de Meta", () => {
    expect(
      leerEventoDelAlta("https://malo.example", {
        type: "WA_EMBEDDED_SIGNUP",
        event: "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING",
        data: { waba_id: "1", phone_number_id: "2" },
      })
    ).toBeNull();
  });

  it("ignora mensajes de Meta que no son del alta", () => {
    expect(leerEventoDelAlta(META, { type: "OTRA_COSA" })).toBeNull();
    expect(leerEventoDelAlta(META, "no es json")).toBeNull();
  });

  it("lee el fin del alta en coexistencia, también como texto JSON", () => {
    const evento = {
      type: "WA_EMBEDDED_SIGNUP",
      event: "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING",
      data: { waba_id: "123", phone_number_id: "456" },
    };
    const esperado = { tipo: "terminada", wabaId: "123", phoneNumberId: "456" };
    expect(leerEventoDelAlta(META, evento)).toEqual(esperado);
    expect(
      leerEventoDelAlta("https://web.facebook.com", JSON.stringify(evento))
    ).toEqual(esperado);
  });

  it("sin phone_number_id es un error, no un alta", () => {
    expect(
      leerEventoDelAlta(META, {
        type: "WA_EMBEDDED_SIGNUP",
        event: "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING",
        data: { waba_id: "123" },
      })
    ).toEqual({ tipo: "error", mensaje: "Meta no devolvió el número" });
  });

  it("distingue el alta normal, la cancelación y el error", () => {
    expect(
      leerEventoDelAlta(META, {
        type: "WA_EMBEDDED_SIGNUP",
        event: "FINISH",
        data: { waba_id: "1" },
      })
    ).toEqual({ tipo: "sin_coexistencia" });
    expect(
      leerEventoDelAlta(META, {
        type: "WA_EMBEDDED_SIGNUP",
        event: "CANCEL",
        data: { current_step: "PHONE_NUMBER_SETUP" },
      })
    ).toEqual({ tipo: "cancelada", paso: "PHONE_NUMBER_SETUP" });
    expect(
      leerEventoDelAlta(META, {
        type: "WA_EMBEDDED_SIGNUP",
        event: "ERROR",
        data: { error_message: "x" },
      })
    ).toEqual({ tipo: "error", mensaje: "x" });
  });
});

describe("abrirAltaEnCoexistencia", () => {
  it("abre FB.login con la configuración, la solución y el modo coexistencia", () => {
    const login = vi.fn();
    const alCerrar = vi.fn();
    abrirAltaEnCoexistencia(
      { init: vi.fn(), login },
      { configId: "cfg", solutionId: "sol" },
      alCerrar
    );
    expect(login).toHaveBeenCalledWith(expect.any(Function), {
      config_id: "cfg",
      response_type: "code",
      override_default_response_type: true,
      extras: {
        setup: { solutionID: "sol" },
        featureType: "whatsapp_business_app_onboarding",
        sessionInfoVersion: "3",
      },
    });
    login.mock.calls[0][0]({ authResponse: null });
    expect(alCerrar).toHaveBeenCalledWith(true);
  });
});
