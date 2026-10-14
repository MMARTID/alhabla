import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTelnyxClient } from "../../src/lib/telnyx.js";
import { WhatsAppAdapter } from "../../src/adapters/whatsapp/WhatsAppAdapter.js";
import { TelnyxAdapter } from "../../src/adapters/telnyx/TelnyxAdapter.js";
import { sendZohoMail } from "../../src/lib/zohoMail.js";
import { enviosSimulados } from "../../src/lib/enviosSimulados.js";

vi.mock("../../src/lib/telnyx.js", () => ({
  getTelnyxClient: vi.fn(),
  getTelnyxWhatsappClient: vi.fn(),
}));

const enviarWhatsapp = vi.fn();
const enviarSms = vi.fn();
const fetchMock = vi.fn();
const entornoOriginal = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.TELNYX_API_KEY = "KEY";
  process.env.WHATSAPP_TELNYX_FROM_NUMBER = "+34930453218";
  process.env.TELNYX_MESSAGING_PROFILE_ID = "perfil-1";
  process.env.ZOHO_DEV_ALLOWED_RECIPIENTS = "*";
  vi.mocked(getTelnyxClient).mockReturnValue({
    messages: { whatsapp: enviarWhatsapp, send: enviarSms },
  } as never);
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  process.env = { ...entornoOriginal };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("enviosSimulados", () => {
  it("solo con ENVIOS_SIMULADOS=1 y fuera de producción", () => {
    process.env.NODE_ENV = "development";
    delete process.env.ENVIOS_SIMULADOS;
    expect(enviosSimulados()).toBe(false);
    process.env.ENVIOS_SIMULADOS = "true";
    expect(enviosSimulados()).toBe(false);
    process.env.ENVIOS_SIMULADOS = "1";
    expect(enviosSimulados()).toBe(true);
    process.env.NODE_ENV = "production";
    expect(enviosSimulados()).toBe(false);
  });
});

describe("con ENVIOS_SIMULADOS=1 no sale nada", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "development";
    process.env.ENVIOS_SIMULADOS = "1";
  });

  it("WhatsApp: no llama a Telnyx y devuelve un id simulado", async () => {
    const resultado = await new WhatsAppAdapter().sendText({
      to: "+34600111222",
      body: "Tu cita es mañana",
    });
    expect(enviarWhatsapp).not.toHaveBeenCalled();
    expect(resultado.messageId).toMatch(/^simulado-/);
    expect(resultado.status).toBe("simulado");
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringMatching(/\[WhatsApp\] ENVÍO SIMULADO.*destino=\+34600111222/)
    );
  });

  it("SMS: no llama a Telnyx", async () => {
    await new TelnyxAdapter().sendSms({
      from: "Alhabla",
      to: "+34600111222",
      text: "Recordatorio",
    });
    expect(enviarSms).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringMatching(/\[SMS\] ENVÍO SIMULADO.*destino=\+34600111222/)
    );
  });

  it("Correo: no pide token ni envía a Zoho", async () => {
    await sendZohoMail({
      fromAddress: "welcome@alhabla.ai",
      toAddress: "dueno@example.com",
      subject: "Bienvenida",
      html: "<p>Hola</p>",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringMatching(/\[Correo\] ENVÍO SIMULADO.*destino=dueno@example\.com/)
    );
  });
});

describe("en producción ENVIOS_SIMULADOS se ignora", () => {
  it("el WhatsApp sale aunque esté puesto", async () => {
    process.env.NODE_ENV = "production";
    process.env.ENVIOS_SIMULADOS = "1";
    enviarWhatsapp.mockResolvedValue({
      data: { id: "msg-1", to: [{ status: "queued" }] },
    });
    const resultado = await new WhatsAppAdapter().sendText({
      to: "+34600111222",
      body: "Tu cita es mañana",
    });
    expect(enviarWhatsapp).toHaveBeenCalledTimes(1);
    expect(resultado.messageId).toBe("msg-1");
  });
});
