import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createBusinessAgent,
  syncAgentNameWithBusinessType,
} from "../../src/lib/agentBootstrap.js";
import { prisma } from "../../src/lib/prisma.js";
import { componerSaludo } from "../../src/lib/idiomas/catalogo.js";
import { telnyxAiAdapter } from "../../src/adapters/telnyx/TelnyxAiAdapter.js";

vi.mock("../../src/lib/prisma.js", () => ({
  prisma: {
    business: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    service: {
      findMany: vi.fn(),
    },
    professional: {
      findMany: vi.fn(),
    },
    agent: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("../../src/adapters/telnyx/TelnyxAiAdapter.js", () => ({
  telnyxAiAdapter: {
    createAssistant: vi.fn(),
    updateAssistant: vi.fn(),
    listVoices: vi.fn(),
  },
}));

// Gate de la frase de la lista de espera en el prompt (PR 4): aprobada por
// defecto para que la salida de estos tests no cambie.
vi.mock("../../src/modules/whatsapp/service.js", () => ({
  listaDeEsperaDisponible: vi.fn().mockResolvedValue(true),
}));

const mockedBusinessFindUnique = vi.mocked(prisma.business.findUnique);
const mockedServiceFindMany = vi.mocked(prisma.service.findMany);
const mockedProfessionalFindMany = vi.mocked(prisma.professional.findMany);
const mockedAgentFindMany = vi.mocked(prisma.agent.findMany);
const mockedAgentUpdate = vi.mocked(prisma.agent.update);
const mockedAgentCreate = vi.mocked(prisma.agent.create);
const mockedAgentFindUnique = vi.mocked(prisma.agent.findUnique);
const mockedBusinessUpdate = vi.mocked(prisma.business.update);
const mockedTelnyxCreateAssistant = vi.mocked(telnyxAiAdapter.createAssistant);
const mockedTelnyxListVoices = vi.mocked(telnyxAiAdapter.listVoices);

// Desde el 17-10 no hay Retell (docs/historico/PLAN-RETIRAR-RETELL.md): el alta crea la
// fila Agent y el assistant de Telnyx, siempre.
describe("createBusinessAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedBusinessFindUnique.mockResolvedValue({
      businessType: "peluqueria",
      name: "Peluquería de prueba",
    } as any);
    mockedServiceFindMany.mockResolvedValue([]);
    mockedProfessionalFindMany.mockResolvedValue([]);
    mockedAgentCreate.mockResolvedValue({ id: "agent_db_1" } as any);
    mockedAgentFindUnique.mockResolvedValue({
      id: "agent_db_1",
      systemPrompt: "prompt gestionado",
      promptManuallyEdited: false,
    } as any);
    mockedAgentUpdate.mockResolvedValue({ id: "agent_db_1" } as any);
    mockedBusinessUpdate.mockResolvedValue({} as any);
    mockedTelnyxListVoices.mockResolvedValue([
      { id: "Telnyx.Ultra.isabel", language: "es-ES", gender: "Female" },
    ]);
    mockedTelnyxCreateAssistant.mockResolvedValue({
      id: "telnyx_assistant_1",
      name: "alhabla-biz_new-agent_db_1",
      instructions: "i",
    });
  });

  it("crea el agente y su assistant de Telnyx, y apunta que el negocio es elegible", async () => {
    const result = await createBusinessAgent({
      businessId: "biz_new",
      name: "Nuevo negocio",
    });

    expect(result).toEqual(expect.objectContaining({ id: "agent_db_1" }));
    expect(mockedTelnyxCreateAssistant).toHaveBeenCalledTimes(1);
    expect(mockedAgentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "agent_db_1" },
        data: expect.objectContaining({
          telnyxAssistantId: "telnyx_assistant_1",
        }),
      })
    );
    // Ya no hay promoción a Telnyx-primary: todo negocio es de Telnyx.
    expect(mockedBusinessUpdate).toHaveBeenCalledWith({
      where: { id: "biz_new" },
      data: {
        telnyxEligibilityStatus: "eligible",
        telnyxEligibilityReason: null,
      },
    });
  });

  it("si Telnyx falla, devuelve el agente y deja el motivo en el negocio y en el log", async () => {
    mockedTelnyxCreateAssistant.mockRejectedValue(new Error("Telnyx down"));
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const result = await createBusinessAgent({
      businessId: "biz_new",
      name: "Nuevo negocio",
    });

    expect(result).toEqual(expect.objectContaining({ id: "agent_db_1" }));
    expect(mockedBusinessUpdate).toHaveBeenCalledWith({
      where: { id: "biz_new" },
      data: {
        telnyxEligibilityStatus: "ineligible",
        telnyxEligibilityReason: "Telnyx down",
      },
    });
    expect(errorSpy).toHaveBeenCalledWith(
      "[Agent] El negocio se queda sin assistant Telnyx:",
      { businessId: "biz_new", agentId: "agent_db_1", motivo: "Telnyx down" }
    );
    errorSpy.mockRestore();
  });

  it("marca el negocio como no elegible (sin llamar a Telnyx) si no hay voz compatible", async () => {
    mockedTelnyxListVoices.mockResolvedValue([]);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await createBusinessAgent({ businessId: "biz_new", name: "Nuevo negocio" });

    expect(mockedTelnyxCreateAssistant).not.toHaveBeenCalled();
    expect(mockedBusinessUpdate).toHaveBeenCalledWith({
      where: { id: "biz_new" },
      data: {
        telnyxEligibilityStatus: "ineligible",
        telnyxEligibilityReason: expect.stringMatching(/voz Telnyx compatible/),
      },
    });
  });

  // Regresión (encontrado 2026-09-14 con una llamada real a Barbería El
  // Corte Clásico): el assistant nacía solo con `hangup` y dependía de una
  // segunda sincronización para poder reservar.
  it("crea el assistant Telnyx ya con las tools de voz", async () => {
    await createBusinessAgent({ businessId: "biz_new", name: "Nuevo negocio" });

    const payload = mockedTelnyxCreateAssistant.mock.calls[0][0];
    const nombres = payload.tools!.map((tool) =>
      tool.type === "webhook" ? tool.webhook.name : tool.type
    );
    expect(nombres).toEqual(
      expect.arrayContaining([
        "get_catalog",
        "check_availability",
        "book_appointment",
        "hangup",
      ])
    );
  });
});

describe("syncAgentNameWithBusinessType", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renombra el agente con el tipo de negocio", async () => {
    mockedBusinessFindUnique.mockResolvedValue({ name: "Ana" } as any);
    mockedAgentFindMany.mockResolvedValue([{ id: "agent_1" }] as any);

    await syncAgentNameWithBusinessType({
      businessId: "biz_1",
      businessType: "peluqueria",
    });

    expect(mockedAgentUpdate).toHaveBeenCalledWith({
      where: { id: "agent_1" },
      data: { name: expect.stringMatching(/^Ana · /) },
    });
  });

  it("no hace nada si el negocio no tiene agente", async () => {
    mockedBusinessFindUnique.mockResolvedValue({ name: "Ana" } as any);
    mockedAgentFindMany.mockResolvedValue([]);

    await syncAgentNameWithBusinessType({
      businessId: "biz_1",
      businessType: "peluqueria",
    });

    expect(mockedAgentUpdate).not.toHaveBeenCalled();
  });
});

describe("componerSaludo", () => {
  it("saluda en el idioma principal", () => {
    expect(componerSaludo("es-ES", "Peluquería Ana")).toBe(
      "Peluquería Ana, te atiende su recepcionista de IA. ¿En qué te ayudo?"
    );
    expect(componerSaludo("en-GB", "Ana's Salon")).toBe(
      "Ana's Salon, you're speaking with an AI receptionist. How can I help?"
    );
    expect(componerSaludo("fr-FR", "Salon Anne")).toBe(
      "Salon Anne, vous êtes en ligne avec une intelligence artificielle. Comment puis-je vous aider ?"
    );
    expect(componerSaludo("ca-ES", "Perruqueria Anna")).toBe(
      "Perruqueria Anna, t'atén una intel·ligència artificial. En què et puc ajudar?"
    );
    expect(componerSaludo("eu-ES", "Ana ile-apaindegia")).toBe(
      "Kaixo, Ana ile-apaindegia. Adimen artifizial bat naiz. Zertan lagun zaitzaket?"
    );
    expect(componerSaludo("gl-ES", "Perruquería Ana")).toBe(
      "Perruquería Ana, atendete unha intelixencia artificial. En que te axudo?"
    );
  });
});
