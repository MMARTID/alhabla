import { describe, it, expect, vi, beforeEach } from "vitest";
import { TelnyxAiAdapter } from "../../../src/adapters/telnyx/TelnyxAiAdapter.js";

// Lo que añadió el laboratorio de prompt (scripts/laboratorioDePrompt.ts) al
// adaptador: las tools de cada mensaje, el borrado de conversaciones y la
// inferencia pública para el juez.
const mockMessagesList = vi.fn();
const mockConversationsDelete = vi.fn();
const mockCreateCompletion = vi.fn();

vi.mock("../../../src/lib/telnyx.js", () => ({
  getTelnyxClient: vi.fn(() => ({
    ai: {
      conversations: {
        messages: { list: mockMessagesList },
        delete: mockConversationsDelete,
      },
      openai: { chat: { createCompletion: mockCreateCompletion } },
    },
  })),
}));

function asyncIterableOf<T>(items: T[]) {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const item of items) yield item;
    },
  };
}

describe("TelnyxAiAdapter (laboratorio de prompt)", () => {
  let adapter: TelnyxAiAdapter;

  beforeEach(() => {
    adapter = new TelnyxAiAdapter();
    vi.clearAllMocks();
  });

  it("listConversationMessages devuelve las tools que llamó el assistant", async () => {
    mockMessagesList.mockReturnValue(
      asyncIterableOf([
        {
          role: "assistant",
          text: "",
          tool_calls: [
            {
              id: "call_1",
              type: "function",
              function: { name: "get_catalog", arguments: "{}" },
            },
          ],
        },
        { role: "tool", text: '{"services":[]}' },
      ])
    );

    const mensajes = await adapter.listConversationMessages("conv_1");

    expect(mensajes[0]!.toolCalls).toEqual([
      { id: "call_1", nombre: "get_catalog", argumentos: "{}" },
    ]);
    expect(mensajes[1]).not.toHaveProperty("toolCalls");
  });

  it("deleteConversation borra la conversación", async () => {
    mockConversationsDelete.mockResolvedValue(undefined);

    await adapter.deleteConversation("conv_9");

    expect(mockConversationsDelete).toHaveBeenCalledWith("conv_9");
  });

  it("completarChat devuelve el texto de la primera respuesta", async () => {
    mockCreateCompletion.mockResolvedValue({
      choices: [{ message: { content: '{"respuestas":[]}' } }],
    });

    const texto = await adapter.completarChat({
      modelo: "moonshotai/Kimi-K2.6",
      mensajes: [{ role: "user", content: "hola" }],
    });

    expect(texto).toBe('{"respuestas":[]}');
    expect(mockCreateCompletion).toHaveBeenCalledWith(
      {
        model: "moonshotai/Kimi-K2.6",
        messages: [{ role: "user", content: "hola" }],
        temperature: 0,
      },
      { timeout: 60_000 }
    );
  });

  it("completarChat devuelve vacío si Telnyx no trae texto", async () => {
    mockCreateCompletion.mockResolvedValue({ choices: [] });

    expect(await adapter.completarChat({ modelo: "m", mensajes: [] })).toBe("");
  });
});
