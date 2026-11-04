import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  idsDeToolsCompartidas,
  nombreDeToolCompartida,
  olvidarBibliotecaDeTools,
} from "../../src/lib/toolsCompartidas.js";
import {
  telnyxAiAdapter,
  type TelnyxWebhookTool,
} from "../../src/adapters/telnyx/TelnyxAiAdapter.js";
import { acquireLock, releaseLock } from "../../src/lib/bookingLock.js";
import {
  buildTelnyxChatTools,
  buildTelnyxVoiceTools,
  toTelnyxWebhookTool,
} from "../../src/lib/telnyxAssistantPayload.js";

vi.mock("../../src/adapters/telnyx/TelnyxAiAdapter.js", () => ({
  telnyxAiAdapter: {
    listSharedTools: vi.fn(),
    createSharedWebhookTool: vi.fn(),
  },
}));
vi.mock("../../src/lib/bookingLock.js", () => ({
  acquireLock: vi.fn().mockResolvedValue("token"),
  releaseLock: vi.fn().mockResolvedValue(undefined),
}));

const mockedList = vi.mocked(telnyxAiAdapter.listSharedTools);
const mockedCreate = vi.mocked(telnyxAiAdapter.createSharedWebhookTool);

function tool(nombre: string, url = "https://api.alhabla.ai"): TelnyxWebhookTool {
  return toTelnyxWebhookTool({
    name: nombre,
    description: `La tool ${nombre}`,
    url: `${url}/webhooks/telnyx/tools/${nombre}`,
    properties: {},
    timeoutMs: 20000,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  olvidarBibliotecaDeTools();
  vi.mocked(acquireLock).mockResolvedValue("token");
  let siguiente = 0;
  mockedCreate.mockImplementation(async () => ({ id: `tool-nueva-${++siguiente}` }));
});

describe("nombreDeToolCompartida", () => {
  it("lleva el host del backend, el nombre de la tool y un hash de su definición", () => {
    const nombre = nombreDeToolCompartida(tool("get_catalog"));
    expect(nombre).toMatch(/^alhabla api\.alhabla\.ai get_catalog [0-9a-f]{12}$/);
  });

  it("dev y producción no comparten tool aunque compartan cuenta de Telnyx", () => {
    expect(nombreDeToolCompartida(tool("get_catalog"))).not.toBe(
      nombreDeToolCompartida(tool("get_catalog", "https://dev-api.alhabla.ai"))
    );
  });

  it("una definición distinta es otra tool (no se toca la que llevan los assistants de antes)", () => {
    const antes = tool("get_catalog");
    const despues = {
      ...antes,
      webhook: { ...antes.webhook, description: "Otra descripción" },
    };
    expect(nombreDeToolCompartida(antes)).not.toBe(nombreDeToolCompartida(despues));
  });

  it("las tools comunes de voz y chat tienen el mismo nombre: son la misma tool", () => {
    const voz = buildTelnyxVoiceTools("https://api.alhabla.ai").map(toTelnyxWebhookTool);
    const chat = buildTelnyxChatTools("https://api.alhabla.ai").map(toTelnyxWebhookTool);
    const deVoz = new Set(voz.map(nombreDeToolCompartida));
    const comunes = chat.filter((t) => deVoz.has(nombreDeToolCompartida(t)));
    expect(comunes.map((t) => t.webhook.name)).toEqual([
      "get_catalog",
      "check_availability",
      "book_appointment",
      "find_my_appointment",
      "cancel_appointment",
      "notify_when_available",
    ]);
  });
});

describe("idsDeToolsCompartidas", () => {
  it("con todas en la biblioteca, devuelve sus ids en orden sin crear nada ni tomar el cerrojo", async () => {
    const tools = [tool("get_catalog"), tool("book_appointment")];
    mockedList.mockResolvedValue([
      { id: "tool-b", displayName: nombreDeToolCompartida(tools[1]!), type: "webhook" },
      { id: "tool-a", displayName: nombreDeToolCompartida(tools[0]!), type: "webhook" },
      { id: "tool-ajena", displayName: "Default hangup", type: "hangup" },
    ]);

    expect(await idsDeToolsCompartidas(tools)).toEqual(["tool-a", "tool-b"]);
    expect(mockedCreate).not.toHaveBeenCalled();
    expect(acquireLock).not.toHaveBeenCalled();
  });

  it("crea solo las que faltan, con el cerrojo, y vuelve a leer la biblioteca antes de crear", async () => {
    const tools = [tool("get_catalog"), tool("book_appointment")];
    mockedList.mockResolvedValue([
      { id: "tool-a", displayName: nombreDeToolCompartida(tools[0]!), type: "webhook" },
    ]);
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    expect(await idsDeToolsCompartidas(tools)).toEqual(["tool-a", "tool-nueva-1"]);
    expect(mockedCreate).toHaveBeenCalledTimes(1);
    expect(mockedCreate).toHaveBeenCalledWith({
      displayName: nombreDeToolCompartida(tools[1]!),
      tool: tools[1],
    });
    // Una lectura antes del cerrojo y otra dentro.
    expect(mockedList).toHaveBeenCalledTimes(2);
    expect(releaseLock).toHaveBeenCalledWith(
      "lock:telnyx:biblioteca-de-tools",
      "token"
    );
  });

  it("recuerda la biblioteca: la segunda sincronización no vuelve a pedirla", async () => {
    const tools = [tool("get_catalog")];
    mockedList.mockResolvedValue([
      { id: "tool-a", displayName: nombreDeToolCompartida(tools[0]!), type: "webhook" },
    ]);
    await idsDeToolsCompartidas(tools);
    await idsDeToolsCompartidas(tools);
    expect(mockedList).toHaveBeenCalledTimes(1);
  });

  it("si otra instancia la creó mientras se esperaba el cerrojo, no la duplica", async () => {
    const tools = [tool("get_catalog")];
    mockedList
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: "tool-de-la-otra", displayName: nombreDeToolCompartida(tools[0]!), type: "webhook" },
      ]);
    expect(await idsDeToolsCompartidas(tools)).toEqual(["tool-de-la-otra"]);
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("sin cerrojo lanza, y quien sincroniza guarda el error", async () => {
    mockedList.mockResolvedValue([]);
    vi.mocked(acquireLock).mockResolvedValue(null);
    await expect(idsDeToolsCompartidas([tool("get_catalog")])).rejects.toThrow(
      /cerrojo de la biblioteca de tools/
    );
    expect(mockedCreate).not.toHaveBeenCalled();
  });
});
