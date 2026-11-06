import { beforeEach, describe, expect, it, vi } from "vitest";

const adapter = vi.hoisted(() => ({
  conversacionesDeLaLlamada: vi.fn(),
  listConversationMessages: vi.fn(),
  stopAssistantOnCall: vi.fn(),
  startAssistantOnCall: vi.fn(),
}));

vi.mock("../../src/adapters/telnyx/TelnyxAiAdapter.js", () => ({
  telnyxAiAdapter: adapter,
}));

import {
  assistantDeDestino,
  cambiarDeAssistantPorIdioma,
  esIdiomaConCambio,
} from "../../src/lib/cambioDeIdioma.js";

const CA = "assistant-f5762fa8-869a-43c5-9432-d9acca1d3c50";
const UE = "assistant-1bf9435e-7afd-4a2b-9e27-3df790a78d80";

describe("cambioDeIdioma", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    adapter.conversacionesDeLaLlamada.mockResolvedValue([{ id: "conv-1", assistantId: UE, createdAt: "2026-11-06T10:00:00Z" }]);
    adapter.listConversationMessages.mockResolvedValue([
      { role: "user", text: "Bon dia, voldria hora", sentAt: "2026-11-06T10:00:05Z" },
      { role: "assistant", text: "Peluquería Mallorca, ¿en qué te ayudo?", sentAt: "2026-11-06T10:00:01Z" },
      { role: "tool", text: "{}", sentAt: "2026-11-06T10:00:06Z" },
      { role: "assistant", text: "", sentAt: "2026-11-06T10:00:07Z" },
    ]);
    adapter.stopAssistantOnCall.mockResolvedValue(undefined);
    adapter.startAssistantOnCall.mockResolvedValue(undefined);
  });

  it("solo acepta las lenguas que necesitan cambio y destinos con forma de assistant", () => {
    expect(esIdiomaConCambio("ca-ES")).toBe(true);
    expect(esIdiomaConCambio("en-GB")).toBe(false);
    expect(assistantDeDestino({ "ca-ES": CA }, "ca-ES")).toBe(CA);
    expect(assistantDeDestino({ "ca-ES": "https://otro.sitio" }, "ca-ES")).toBeNull();
    expect(assistantDeDestino({}, "gl-ES")).toBeNull();
  });

  it("para el de la UE y arranca el de la lengua con lo hablado, en orden y sin tools", async () => {
    await cambiarDeAssistantPorIdioma({
      callControlId: "v3:abc",
      businessId: "negocio-1",
      idioma: "ca-ES",
      assistantDestino: CA,
      assistantDeVuelta: UE,
    });
    expect(adapter.stopAssistantOnCall).toHaveBeenCalledWith("v3:abc");
    expect(adapter.startAssistantOnCall).toHaveBeenCalledTimes(1);
    const [llamada, destino, opciones] = adapter.startAssistantOnCall.mock.calls[0];
    expect(llamada).toBe("v3:abc");
    expect(destino).toBe(CA);
    expect(opciones.greeting).toBe("Cap problema, et parlo en català.");
    expect(opciones.messageHistory).toEqual([
      { role: "assistant", content: "Peluquería Mallorca, ¿en qué te ayudo?" },
      { role: "user", content: "Bon dia, voldria hora" },
    ]);
    expect(adapter.stopAssistantOnCall.mock.invocationCallOrder[0]).toBeLessThan(
      adapter.startAssistantOnCall.mock.invocationCallOrder[0]
    );
  });

  it("si no arranca el de la lengua, vuelve el de la UE con lo hablado", async () => {
    adapter.startAssistantOnCall.mockRejectedValueOnce(new Error("422")).mockResolvedValueOnce(undefined);
    await cambiarDeAssistantPorIdioma({
      callControlId: "v3:abc",
      businessId: "negocio-1",
      idioma: "gl-ES",
      assistantDestino: CA,
      assistantDeVuelta: UE,
    });
    expect(adapter.startAssistantOnCall).toHaveBeenCalledTimes(2);
    expect(adapter.startAssistantOnCall.mock.calls[1][1]).toBe(UE);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("no se pudo arrancar el assistant de gl-ES"));
  });

  it("si no se puede parar, no arranca otro encima", async () => {
    adapter.stopAssistantOnCall.mockRejectedValue(new Error("90018"));
    await cambiarDeAssistantPorIdioma({
      callControlId: "v3:abc",
      businessId: "negocio-1",
      idioma: "eu-ES",
      assistantDestino: CA,
      assistantDeVuelta: UE,
    });
    expect(adapter.startAssistantOnCall).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("no se pudo parar"));
  });
});
