import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  crearAssistantDelNegocio,
  createTelnyxAssistantForAgent,
  promptManualConSuRegla,
  syncAgentToTelnyx,
} from "../../src/lib/telnyxAgentSync.js";
import { prisma } from "../../src/lib/prisma.js";
import { telnyxAiAdapter } from "../../src/adapters/telnyx/TelnyxAiAdapter.js";
import { DEFAULT_AGENT_SETTINGS } from "../../src/lib/managedAgentPrompt.js";
import { listaDeEsperaDisponible } from "../../src/modules/whatsapp/service.js";

vi.mock("../../src/lib/prisma.js", () => ({
  prisma: {
    business: { findUnique: vi.fn(), update: vi.fn() },
    service: { findMany: vi.fn() },
    professional: { findMany: vi.fn() },
    agent: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("../../src/adapters/telnyx/TelnyxAiAdapter.js", () => ({
  telnyxAiAdapter: {
    createAssistant: vi.fn(),
    updateAssistant: vi.fn(),
    listVoices: vi.fn(),
  },
}));

// Gate de la frase de la lista de espera en el prompt (PR 4): por defecto
// aprobada, para que la salida de estos tests no cambie.
vi.mock("../../src/modules/whatsapp/service.js", () => ({
  listaDeEsperaDisponible: vi.fn().mockResolvedValue(true),
}));

const mockedBusinessFindUnique = vi.mocked(prisma.business.findUnique);
const mockedBusinessUpdate = vi.mocked(prisma.business.update);
const mockedServiceFindMany = vi.mocked(prisma.service.findMany);
const mockedProfessionalFindMany = vi.mocked(prisma.professional.findMany);
const mockedAgentFindMany = vi.mocked(prisma.agent.findMany);
const mockedAgentUpdate = vi.mocked(prisma.agent.update);
const mockedAgentFindUnique = vi.mocked(prisma.agent.findUnique);
const mockedCreateAssistant = vi.mocked(telnyxAiAdapter.createAssistant);
const mockedUpdateAssistant = vi.mocked(telnyxAiAdapter.updateAssistant);
const mockedListVoices = vi.mocked(telnyxAiAdapter.listVoices);

const ELIGIBLE_VOICES = [
  { id: "Telnyx.Ultra.isabel", language: "es-ES", gender: "Female" },
];

const BASE_BUSINESS = {
  name: "Peluquería Ejemplo",
  businessDetails: null,
  businessType: "peluqueria",
  agentSettings: null,
  minAdvanceBookingMinutes: null,
  maxAppointmentDurationMinutes: null,
};

// Alhabla como número principal con móvil del dueño (fase 4): la
// transferencia se activa sola («si el cliente lo pide»).
const NUMERO_DE_ALHABLA = "+34930453218";
const MOVIL_DEL_DUENO = "+34600111222";
const BUSINESS_PRINCIPAL = {
  ...BASE_BUSINESS,
  customerLineType: "alhabla",
  phone: NUMERO_DE_ALHABLA,
  telnyxPhoneNumber: NUMERO_DE_ALHABLA,
  ownerWhatsappNumber: MOVIL_DEL_DUENO,
  ownerPhoneIsCustomerLine: false,
};
const TOOL_TRANSFER_ESPERADA = {
  type: "transfer",
  transfer: {
    from: NUMERO_DE_ALHABLA,
    targets: [{ name: "Responsable del negocio", to: MOVIL_DEL_DUENO }],
    warm_transfer_instructions: expect.stringContaining(
      "recepcionista de Peluquería Ejemplo"
    ),
    voicemail_detection: {
      detection_mode: "premium",
      on_voicemail_detected: { action: "stop_transfer" },
    },
  },
};

function agenteSincronizable() {
  return [
    {
      id: "agent1",
      telnyxAssistantId: "assistant_1",
      telnyxConfigHash: "hash-vieja",
      systemPrompt: "prompt guardado",
      promptManuallyEdited: false,
    },
  ] as any;
}

const mockedListaDeEspera = vi.mocked(listaDeEsperaDisponible);

const AGENTE_NUEVO = {
  id: "agent1",
  systemPrompt: "prompt guardado",
  promptManuallyEdited: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedAgentFindUnique.mockResolvedValue(AGENTE_NUEVO as any);
  mockedServiceFindMany.mockResolvedValue([]);
  mockedProfessionalFindMany.mockResolvedValue([]);
  mockedListVoices.mockResolvedValue(ELIGIBLE_VOICES);
  mockedListaDeEspera.mockResolvedValue(true);
});

describe("createTelnyxAssistantForAgent", () => {
  it("pasa listaDeEspera al prompt según listaDeEsperaDisponible (true con hueco_libre aprobada, false si no)", async () => {
    mockedBusinessFindUnique.mockResolvedValue(BASE_BUSINESS as any);
    mockedCreateAssistant.mockResolvedValue({
      id: "assistant_1",
      name: "alhabla-biz1-agent1",
      instructions: "i",
    });

    await createTelnyxAssistantForAgent({
      agentId: "agent1",
      businessId: "biz1",
    });
    const conOferta = mockedCreateAssistant.mock.calls[0][0].instructions;
    expect(conOferta).toContain("te aviso por WhatsApp si se libera esa hora");

    mockedListaDeEspera.mockResolvedValue(false);
    await createTelnyxAssistantForAgent({
      agentId: "agent1",
      businessId: "biz1",
    });
    const sinOferta = mockedCreateAssistant.mock.calls[1][0].instructions;
    expect(sinOferta).not.toContain("te aviso por WhatsApp");
    expect(sinOferta).toContain("no uses notify_when_available");
    expect(mockedListaDeEspera).toHaveBeenCalledTimes(2);
  });

  // En Inicio el recordatorio por WhatsApp no sale (recordatorios_cita es
  // de Pro y Scale): la recepcionista no lo ofrece.
  it("ofrece el recordatorio por WhatsApp solo si el plan lo manda", async () => {
    mockedCreateAssistant.mockResolvedValue({
      id: "assistant_1",
      name: "alhabla-biz1-agent1",
      instructions: "i",
    });

    mockedBusinessFindUnique.mockResolvedValue({
      ...BASE_BUSINESS,
      plan: "pro",
      stripePriceId: null,
    } as any);
    await createTelnyxAssistantForAgent({ agentId: "agent1", businessId: "biz1" });
    expect(mockedCreateAssistant.mock.calls[0][0].instructions).toContain(
      "le envías la confirmación y un recordatorio por WhatsApp"
    );

    mockedBusinessFindUnique.mockResolvedValue({
      ...BASE_BUSINESS,
      plan: "basic",
      stripePriceId: null,
    } as any);
    await createTelnyxAssistantForAgent({ agentId: "agent1", businessId: "biz1" });
    const enInicio = mockedCreateAssistant.mock.calls[1][0].instructions;
    expect(enInicio).toContain("le envías la confirmación por WhatsApp");
    expect(enInicio).not.toContain("un recordatorio por WhatsApp");
    expect(mockedBusinessFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ plan: true, stripePriceId: true }),
      })
    );
  });

  it("lleva la regla de «Dar precios» del negocio al prompt", async () => {
    mockedCreateAssistant.mockResolvedValue({
      id: "assistant_1",
      name: "alhabla-biz1-agent1",
      instructions: "i",
    });
    mockedBusinessFindUnique.mockResolvedValue({
      ...BASE_BUSINESS,
      agentSettings: { ...DEFAULT_AGENT_SETTINGS, darPrecios: "nunca" },
    } as any);

    await createTelnyxAssistantForAgent({ agentId: "agent1", businessId: "biz1" });

    const instrucciones = mockedCreateAssistant.mock.calls[0][0].instructions;
    expect(instrucciones).toContain("## Precios");
    expect(instrucciones).toContain("No des precios");
  });

  it("crea el assistant y persiste su id cuando el negocio es elegible", async () => {
    mockedBusinessFindUnique.mockResolvedValue(BASE_BUSINESS as any);
    mockedCreateAssistant.mockResolvedValue({
      id: "assistant_1",
      name: "alhabla-biz1-agent1",
      instructions: "i",
    });

    const result = await createTelnyxAssistantForAgent({
      agentId: "agent1",
      businessId: "biz1",
    });

    expect(result).toEqual({ eligible: true, reason: null });
    expect(mockedCreateAssistant).toHaveBeenCalledTimes(1);
    expect(mockedAgentUpdate).toHaveBeenCalledWith({
      where: { id: "agent1" },
      data: expect.objectContaining({
        telnyxAssistantId: "assistant_1",
        telnyxSyncError: null,
      }),
    });
  });

  it("no crea nada si el negocio no es elegible (sin voz en la cuenta)", async () => {
    mockedBusinessFindUnique.mockResolvedValue(BASE_BUSINESS as any);
    mockedListVoices.mockResolvedValue([]);

    const result = await createTelnyxAssistantForAgent({
      agentId: "agent1",
      businessId: "biz1",
    });

    expect(result.eligible).toBe(false);
    expect(result.reason).toMatch(/Sin voz Telnyx/);
    expect(mockedCreateAssistant).not.toHaveBeenCalled();
    expect(mockedAgentUpdate).not.toHaveBeenCalled();
  });

  it("con catalán principal crea el assistant con voz y transcripción de Soniox, y saluda en catalán", async () => {
    mockedBusinessFindUnique.mockResolvedValue({
      ...BASE_BUSINESS,
      agentSettings: {
        ...DEFAULT_AGENT_SETTINGS,
        languages: ["es-ES", "ca-ES"],
        voiceLanguage: "ca-ES",
      },
    } as any);
    mockedListVoices.mockResolvedValue([
      { id: "Soniox.tts-rt-v2.Marta", language: "en", gender: "female" },
    ]);
    mockedCreateAssistant.mockResolvedValue({
      id: "assistant_1",
      name: "alhabla-biz1-agent1",
      instructions: "i",
    });

    const result = await createTelnyxAssistantForAgent({
      agentId: "agent1",
      businessId: "biz1",
    });

    expect(result.eligible).toBe(true);
    expect(mockedListVoices).toHaveBeenCalledWith("soniox");
    expect(mockedCreateAssistant.mock.calls[0][0]).toMatchObject({
      greeting:
        "Peluquería Ejemplo, t'atén una intel·ligència artificial. En què et puc ajudar?",
      voiceSettings: { voice: "Soniox.tts-rt-v2.Marta", language: "ca" },
      // Desde el 2026-10-05 con catalán habla ocho idiomas; Soniox lleva
      // las pistas del catalán y del español (con las ocho iba peor).
      transcription: {
        model: "soniox/stt-rt-v5",
        settings: {
          language_hints: ["es", "ca"],
        },
      },
    });
  });

  // Hallazgo 1 de la auditoría del 28-10: el registro crea «Negocio de
  // <email>» y el saludo del assistant decía el email del dueño.
  it("con el nombre provisional del registro, el saludo del assistant no dice el email", async () => {
    mockedBusinessFindUnique.mockResolvedValue({
      ...BASE_BUSINESS,
      name: "Negocio de ana@example.com",
      agentSettings: {
        ...DEFAULT_AGENT_SETTINGS,
        languages: ["es-ES", "ca-ES"],
        voiceLanguage: "ca-ES",
      },
    } as any);
    mockedListVoices.mockResolvedValue([
      { id: "Soniox.tts-rt-v2.Marta", language: "en", gender: "female" },
    ]);
    mockedCreateAssistant.mockResolvedValue({
      id: "assistant_1",
      name: "alhabla-biz1-agent1",
      instructions: "i",
    });

    await createTelnyxAssistantForAgent({
      agentId: "agent1",
      businessId: "biz1",
    });

    const payload = mockedCreateAssistant.mock.calls[0][0];
    expect(payload.greeting).toBe(
      "Hola, t'atén una intel·ligència artificial. En què et puc ajudar?"
    );
  });

  // Ajustes guardados con reglas anteriores (catalán en `languages` y
  // saludo en español): la cooficial guardada pasa a ser el principal, así
  // que saluda en catalán, como hacía en producción.
  it("con ajustes anteriores de catalán activo y saludo en español, saluda en catalán con Marta y Soniox", async () => {
    mockedBusinessFindUnique.mockResolvedValue({
      ...BASE_BUSINESS,
      agentSettings: {
        ...DEFAULT_AGENT_SETTINGS,
        languages: ["es-ES", "ca-ES"],
      },
    } as any);
    mockedListVoices.mockResolvedValue([
      { id: "Soniox.tts-rt-v2.Marta", language: "en", gender: "female" },
    ]);
    mockedCreateAssistant.mockResolvedValue({
      id: "assistant_1",
      name: "alhabla-biz1-agent1",
      instructions: "i",
    });

    await createTelnyxAssistantForAgent({
      agentId: "agent1",
      businessId: "biz1",
    });

    const payload = mockedCreateAssistant.mock.calls[0][0];
    expect(payload.greeting).toBe(
      "Peluquería Ejemplo, t'atén una intel·ligència artificial. En què et puc ajudar?"
    );
    expect(payload.voiceSettings).toMatchObject({
      voice: "Soniox.tts-rt-v2.Marta",
      language: "ca",
    });
    expect(payload.transcription?.model).toBe("soniox/stt-rt-v5");
  });

  it("con saludo en alemán crea el assistant con la voz alemana de la cuenta, flux y saludo en alemán", async () => {
    mockedBusinessFindUnique.mockResolvedValue({
      ...BASE_BUSINESS,
      agentSettings: {
        ...DEFAULT_AGENT_SETTINGS,
        languages: ["es-ES", "de-DE"],
        voiceLanguage: "de-DE",
      },
    } as any);
    mockedListVoices.mockResolvedValue([
      {
        id: "Telnyx.Ultra.38aabb6a-f52b-4fb0-a3d1-988518f4dc06",
        language: "de",
        gender: "Female",
      },
    ]);
    mockedCreateAssistant.mockResolvedValue({
      id: "assistant_1",
      name: "alhabla-biz1-agent1",
      instructions: "i",
    });

    const result = await createTelnyxAssistantForAgent({
      agentId: "agent1",
      businessId: "biz1",
    });

    expect(result.eligible).toBe(true);
    const payload = mockedCreateAssistant.mock.calls[0][0];
    expect(payload.greeting).toBe(
      "Peluquería Ejemplo, Sie sprechen mit einer künstlichen Intelligenz. Wie kann ich Ihnen helfen?"
    );
    expect(payload.voiceSettings).toMatchObject({
      voice: "Telnyx.Ultra.38aabb6a-f52b-4fb0-a3d1-988518f4dc06",
      expressive_mode: true,
    });
    expect(payload.voiceSettings).not.toHaveProperty("language");
    expect(payload.transcription).toMatchObject({
      model: "deepgram/flux",
      language: "multi",
    });
  });

  // La cooficial de donde está el negocio (lib/idiomas/zona.ts, decisión
  // del 2026-10-14): con el código postal de Cardedeu, Soniox entiende el
  // catalán desde el principio, atiende la voz Ultra del principal y un nodo
  // cambia a Marta.
  it("en Cataluña y saludando en español: Soniox con catalán, la voz Ultra, el nodo de Marta y el catalán en el prompt", async () => {
    mockedBusinessFindUnique.mockResolvedValue({
      ...BASE_BUSINESS,
      address: "Calle Anselm Clavé, 14",
      businessDetails:
        "INFINITY Hair Salon\nAv. Rei en Jaume, 231, 08440 Cardedeu, Barcelona, Spain",
      agentSettings: DEFAULT_AGENT_SETTINGS,
    } as any);
    mockedCreateAssistant.mockResolvedValue({
      id: "assistant_1",
      name: "alhabla-biz1-agent1",
      instructions: "i",
    });

    const result = await createTelnyxAssistantForAgent({
      agentId: "agent1",
      businessId: "biz1",
    });

    expect(result.eligible).toBe(true);
    const payload = mockedCreateAssistant.mock.calls[0][0];
    expect(payload.greeting).toBe(
      "Peluquería Ejemplo, te atiende su asistente de inteligencia artificial. ¿En qué te ayudo?"
    );
    expect(payload.voiceSettings).toMatchObject({
      voice: "Telnyx.Ultra.isabel",
      expressive_mode: true,
    });
    expect(payload.transcription).toMatchObject({
      model: "soniox/stt-rt-v5",
      settings: { language_hints: ["es", "ca"] },
    });
    expect(payload.conversationFlow?.nodes[1]).toMatchObject({
      id: "cooficial",
      voice_settings: { voice: "Soniox.tts-rt-v2.Marta", language: "ca" },
    });
    expect(payload.instructions).toContain("catalán");
    expect(mockedAgentUpdate.mock.calls[0][0].data.systemPrompt).toContain(
      "catalán"
    );
  });

  it("fuera de una zona cooficial, sin nodo (null para borrar uno anterior)", async () => {
    mockedBusinessFindUnique.mockResolvedValue({
      ...BASE_BUSINESS,
      address: "Calle Mayor 1, 28013 Madrid, Spain",
      agentSettings: DEFAULT_AGENT_SETTINGS,
    } as any);
    mockedCreateAssistant.mockResolvedValue({
      id: "assistant_1",
      name: "alhabla-biz1-agent1",
      instructions: "i",
    });

    await createTelnyxAssistantForAgent({ agentId: "agent1", businessId: "biz1" });

    const payload = mockedCreateAssistant.mock.calls[0][0];
    expect(payload.conversationFlow).toBeNull();
    expect(payload.transcription).toMatchObject({ model: "deepgram/flux" });
  });

  it("no lanza si Telnyx falla al crear — devuelve el motivo en vez de propagar el error", async () => {
    mockedBusinessFindUnique.mockResolvedValue(BASE_BUSINESS as any);
    mockedCreateAssistant.mockRejectedValue(new Error("Telnyx 500"));

    const result = await createTelnyxAssistantForAgent({
      agentId: "agent1",
      businessId: "biz1",
    });

    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("Telnyx 500");
  });

  it('fija transcription.language según los idiomas activados, no un "es" fijo', async () => {
    mockedBusinessFindUnique.mockResolvedValue({
      ...BASE_BUSINESS,
      agentSettings: {
        ...DEFAULT_AGENT_SETTINGS,
        languages: ["es-ES", "en-GB"],
      },
    } as any);
    mockedCreateAssistant.mockResolvedValue({
      id: "assistant_1",
      name: "alhabla-biz1-agent1",
      instructions: "i",
    });

    await createTelnyxAssistantForAgent({
      agentId: "agent1",
      businessId: "biz1",
    });

    expect(mockedCreateAssistant.mock.calls[0][0]).toMatchObject({
      transcription: { language: "multi" },
    });
  });

  it("devuelve no elegible si el negocio no existe", async () => {
    mockedBusinessFindUnique.mockResolvedValue(null);

    const result = await createTelnyxAssistantForAgent({
      agentId: "agent1",
      businessId: "biz_missing",
    });

    expect(result).toEqual({
      eligible: false,
      reason: "Negocio no encontrado.",
    });
  });

  it("crea el assistant con las tools de voz y las palabras clave desde el primer momento", async () => {
    mockedBusinessFindUnique.mockResolvedValue(BASE_BUSINESS as any);
    mockedServiceFindMany.mockResolvedValue([{ name: "Corte" }] as any);
    mockedProfessionalFindMany.mockResolvedValue([{ name: "Montse" }] as any);
    mockedCreateAssistant.mockResolvedValue({
      id: "assistant_1",
      name: "alhabla-biz1-agent1",
      instructions: "i",
    });

    await createTelnyxAssistantForAgent({
      agentId: "agent1",
      businessId: "biz1",
    });

    const payload = mockedCreateAssistant.mock.calls[0][0];
    const nombres = payload.tools!.map((tool) =>
      tool.type === "webhook" ? tool.webhook.name : tool.type
    );
    expect(nombres).toEqual(
      expect.arrayContaining([
        "get_catalog",
        "check_availability",
        "book_appointment",
        "find_my_appointment",
        "cancel_appointment",
        "hangup",
      ])
    );
    expect(payload.transcription?.settings).toMatchObject({
      keyterm: "Corte,Montse",
    });
  });

  it("guarda el mismo hash que calcula la sincronización: la primera sincronización tras crear no llama a Telnyx", async () => {
    mockedBusinessFindUnique.mockResolvedValue(BASE_BUSINESS as any);
    mockedCreateAssistant.mockResolvedValue({
      id: "assistant_1",
      name: "alhabla-biz1-agent1",
      instructions: "i",
    });

    await createTelnyxAssistantForAgent({
      agentId: "agent1",
      businessId: "biz1",
    });
    const datos = (mockedAgentUpdate.mock.calls[0][0] as any).data;
    expect(datos.telnyxConfigHash).toEqual(expect.any(String));
    // La copia del panel queda igual que la que dejaría la sincronización.
    expect(datos.systemPrompt).toEqual(expect.any(String));
    mockedAgentUpdate.mockClear();

    mockedAgentFindMany.mockResolvedValue([
      {
        ...AGENTE_NUEVO,
        telnyxAssistantId: "assistant_1",
        telnyxConfigHash: datos.telnyxConfigHash,
      },
    ] as any);
    await syncAgentToTelnyx("biz1");

    expect(mockedUpdateAssistant).not.toHaveBeenCalled();
    expect(mockedAgentUpdate).toHaveBeenCalledTimes(1);
  });

  it("sin BASE_URL no crea el assistant: una recepcionista sin tools no puede reservar", async () => {
    const baseUrlOriginal = process.env.BASE_URL;
    delete process.env.BASE_URL;
    mockedBusinessFindUnique.mockResolvedValue(BASE_BUSINESS as any);

    try {
      const result = await createTelnyxAssistantForAgent({
        agentId: "agent1",
        businessId: "biz1",
      });

      expect(result.eligible).toBe(false);
      expect(result.reason).toMatch(/BASE_URL/);
      expect(mockedCreateAssistant).not.toHaveBeenCalled();
      expect(mockedAgentUpdate).not.toHaveBeenCalled();
    } finally {
      if (baseUrlOriginal === undefined) delete process.env.BASE_URL;
      else process.env.BASE_URL = baseUrlOriginal;
    }
  });

  it("un agente con el prompt editado a mano nace con su prompt y sin tocar la copia del panel", async () => {
    mockedBusinessFindUnique.mockResolvedValue(BASE_BUSINESS as any);
    mockedAgentFindUnique.mockResolvedValue({
      id: "agent1",
      systemPrompt: "Eres la recepcionista de Lola. Sé breve.",
      promptManuallyEdited: true,
    } as any);
    mockedCreateAssistant.mockResolvedValue({
      id: "assistant_1",
      name: "alhabla-biz1-agent1",
      instructions: "i",
    });

    await createTelnyxAssistantForAgent({
      agentId: "agent1",
      businessId: "biz1",
    });

    expect(mockedCreateAssistant.mock.calls[0][0].instructions).toBe(
      "Eres la recepcionista de Lola. Sé breve."
    );
    const datos = (mockedAgentUpdate.mock.calls[0][0] as any).data;
    expect(datos).not.toHaveProperty("systemPrompt");
  });

  it("devuelve no elegible si el agente no existe", async () => {
    mockedBusinessFindUnique.mockResolvedValue(BASE_BUSINESS as any);
    mockedAgentFindUnique.mockResolvedValue(null);

    const result = await createTelnyxAssistantForAgent({
      agentId: "agent_missing",
      businessId: "biz1",
    });

    expect(result).toEqual({
      eligible: false,
      reason: "Agente no encontrado.",
    });
    expect(mockedCreateAssistant).not.toHaveBeenCalled();
  });
});

// Desde el 17-10 no hay promoción a Telnyx-primary (docs/historico/PLAN-RETIRAR-RETELL.md):
// todo negocio es de Telnyx; solo se crea el assistant y se apunta la
// elegibilidad.
describe("crearAssistantDelNegocio", () => {
  beforeEach(() => {
    mockedCreateAssistant.mockResolvedValue({
      id: "assistant_1",
      name: "alhabla-biz1-agent1",
      instructions: "i",
    });
    mockedBusinessUpdate.mockResolvedValue({} as any);
  });

  it("crea el assistant y apunta que el negocio es elegible, sin tocar el enrutamiento", async () => {
    mockedBusinessFindUnique.mockResolvedValue(BASE_BUSINESS as any);

    const result = await crearAssistantDelNegocio({
      agentId: "agent1",
      businessId: "biz1",
    });

    expect(result).toEqual({ eligible: true, reason: null });
    expect(mockedCreateAssistant).toHaveBeenCalledTimes(1);
    expect(mockedBusinessUpdate).toHaveBeenCalledWith({
      where: { id: "biz1" },
      data: {
        telnyxEligibilityStatus: "eligible",
        telnyxEligibilityReason: null,
      },
    });
  });

  it("si no hay assistant, guarda el motivo en el negocio y lo loguea con negocio, agente y motivo", async () => {
    mockedBusinessFindUnique.mockResolvedValue(BASE_BUSINESS as any);
    mockedListVoices.mockResolvedValue([]);
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const result = await crearAssistantDelNegocio({
      agentId: "agent1",
      businessId: "biz1",
    });

    expect(result.eligible).toBe(false);
    expect(mockedBusinessUpdate).toHaveBeenCalledWith({
      where: { id: "biz1" },
      data: {
        telnyxEligibilityStatus: "ineligible",
        telnyxEligibilityReason: expect.stringMatching(/Sin voz Telnyx/),
      },
    });
    expect(errorSpy).toHaveBeenCalledWith(
      "[Agent] El negocio se queda sin assistant Telnyx:",
      {
        businessId: "biz1",
        agentId: "agent1",
        motivo: expect.stringMatching(/Sin voz Telnyx/),
      }
    );
    errorSpy.mockRestore();
  });

  it("no lanza si falla la escritura del negocio: el assistant ya existe y queda en el log", async () => {
    mockedBusinessFindUnique.mockResolvedValue(BASE_BUSINESS as any);
    mockedBusinessUpdate.mockRejectedValueOnce(new Error("Postgres caído"));
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const result = await crearAssistantDelNegocio({
      agentId: "agent1",
      businessId: "biz1",
    });

    expect(result).toEqual({ eligible: true, reason: null });
    expect(errorSpy).toHaveBeenCalledWith(
      "[Agent] No se pudo guardar la elegibilidad Telnyx del negocio:",
      { businessId: "biz1", agentId: "agent1", message: "Postgres caído" }
    );
    errorSpy.mockRestore();
  });
});

describe("syncAgentToTelnyx", () => {
  it("no hace nada si ningún agente tiene telnyxAssistantId todavía", async () => {
    mockedBusinessFindUnique.mockResolvedValue(BASE_BUSINESS as any);
    mockedAgentFindMany.mockResolvedValue([]);

    await syncAgentToTelnyx("biz1");

    expect(mockedUpdateAssistant).not.toHaveBeenCalled();
    expect(mockedAgentUpdate).not.toHaveBeenCalled();
  });

  it("actualiza el assistant cuando la configuración cambió", async () => {
    mockedBusinessFindUnique.mockResolvedValue(BASE_BUSINESS as any);
    mockedAgentFindMany.mockResolvedValue([
      {
        id: "agent1",
        telnyxAssistantId: "assistant_1",
        telnyxConfigHash: "hash-vieja",
        systemPrompt: "prompt guardado",
        promptManuallyEdited: false,
      },
    ] as any);

    await syncAgentToTelnyx("biz1");

    expect(mockedUpdateAssistant).toHaveBeenCalledTimes(1);
    expect(mockedUpdateAssistant.mock.calls[0][0]).toBe("assistant_1");
    expect(mockedAgentUpdate).toHaveBeenCalledWith({
      where: { id: "agent1" },
      data: expect.objectContaining({ telnyxSyncError: null }),
    });
  });

  it("no llama a Telnyx si el hash de configuración no cambió", async () => {
    mockedBusinessFindUnique.mockResolvedValue(BASE_BUSINESS as any);
    mockedAgentFindMany.mockResolvedValue([
      {
        id: "agent1",
        telnyxAssistantId: "assistant_1",
        // Se calcula en el propio test tras una primera pasada para no
        // acoplarse al hash exacto que produce buildTelnyxAssistantPayload.
        telnyxConfigHash: "PENDIENTE",
        systemPrompt: "prompt guardado",
        promptManuallyEdited: false,
      },
    ] as any);

    // Primera pasada: calienta el hash real.
    await syncAgentToTelnyx("biz1");
    const [firstCallArg] = mockedAgentUpdate.mock.calls[0];
    const realHash = (firstCallArg as any).data.telnyxConfigHash;
    mockedUpdateAssistant.mockClear();
    mockedAgentUpdate.mockClear();

    mockedAgentFindMany.mockResolvedValue([
      {
        id: "agent1",
        telnyxAssistantId: "assistant_1",
        telnyxConfigHash: realHash,
        systemPrompt: "prompt guardado",
        promptManuallyEdited: false,
      },
    ] as any);

    await syncAgentToTelnyx("biz1");

    expect(mockedUpdateAssistant).not.toHaveBeenCalled();
    // Sigue refrescando telnyxSyncedAt aunque no haya cambiado nada remoto.
    expect(mockedAgentUpdate).toHaveBeenCalledTimes(1);
  });

  it("salta los agentes editados a mano cuando onlyManagedPrompts es true", async () => {
    mockedBusinessFindUnique.mockResolvedValue(BASE_BUSINESS as any);
    mockedAgentFindMany.mockResolvedValue([
      {
        id: "agent_manual",
        telnyxAssistantId: "assistant_1",
        telnyxConfigHash: null,
        systemPrompt: "prompt manual",
        promptManuallyEdited: true,
      },
    ] as any);

    await syncAgentToTelnyx("biz1", prisma, { onlyManagedPrompts: true });

    expect(mockedUpdateAssistant).not.toHaveBeenCalled();
    expect(mockedAgentUpdate).not.toHaveBeenCalled();
  });

  it("registra telnyxSyncError sin lanzar cuando el negocio deja de ser elegible", async () => {
    mockedBusinessFindUnique.mockResolvedValue(BASE_BUSINESS as any);
    mockedListVoices.mockResolvedValue([]);
    mockedAgentFindMany.mockResolvedValue([
      {
        id: "agent1",
        telnyxAssistantId: "assistant_1",
        telnyxConfigHash: null,
        systemPrompt: "prompt guardado",
        promptManuallyEdited: false,
      },
    ] as any);

    await expect(syncAgentToTelnyx("biz1")).resolves.toBeUndefined();

    expect(mockedUpdateAssistant).not.toHaveBeenCalled();
    expect(mockedAgentUpdate).toHaveBeenCalledWith({
      where: { id: "agent1" },
      data: { telnyxSyncError: expect.stringMatching(/voz Telnyx compatible/) },
    });
  });

  it("no lanza si prisma falla al buscar el negocio", async () => {
    mockedBusinessFindUnique.mockRejectedValue(new Error("DB caída"));

    await expect(syncAgentToTelnyx("biz1")).resolves.toBeUndefined();
  });
});

describe("transferencia al dueño (fase 4)", () => {
  it("con Alhabla como principal y móvil del dueño registra la tool transfer con el formato exacto y el bloque del prompt", async () => {
    mockedBusinessFindUnique.mockResolvedValue(BUSINESS_PRINCIPAL as any);
    mockedAgentFindMany.mockResolvedValue(agenteSincronizable());

    await syncAgentToTelnyx("biz1");

    expect(mockedUpdateAssistant).toHaveBeenCalledTimes(1);
    const payload = mockedUpdateAssistant.mock.calls[0][1];
    const transfer = payload.tools!.filter((tool) => tool.type === "transfer");
    expect(transfer).toHaveLength(1);
    expect(transfer[0]).toEqual(TOOL_TRANSFER_ESPERADA);
    // Las tools de voz y hangup siguen ahí: la de transferencia se añade,
    // no sustituye.
    expect(payload.tools!.map((tool) => tool.type)).toEqual(
      expect.arrayContaining(["webhook", "hangup", "transfer"])
    );
    expect(payload.instructions).toContain("## Pasar la llamada");
    expect(payload.instructions).toContain("Pásala solo si el cliente pide");
    // Si la IA falla a mitad de llamada, Telnyx la pasa al mismo móvil
    // (fallback_destination, regla (a) de la PR 6).
    expect(payload.telephonySettings?.fallback_destination).toBe(
      MOVIL_DEL_DUENO
    );
  });

  it("con el ajuste «nunca» no registra la tool ni el bloque, aunque haya destino", async () => {
    mockedBusinessFindUnique.mockResolvedValue({
      ...BUSINESS_PRINCIPAL,
      agentSettings: { ...DEFAULT_AGENT_SETTINGS, pasarLlamadas: "nunca" },
    } as any);
    mockedAgentFindMany.mockResolvedValue(agenteSincronizable());

    await syncAgentToTelnyx("biz1");

    const payload = mockedUpdateAssistant.mock.calls[0][1];
    expect(payload.tools!.some((tool) => tool.type === "transfer")).toBe(false);
    expect(payload.instructions).not.toContain("## Pasar la llamada");
    // `null` y no ausente: Telnyx mezcla telephony_settings y solo `null`
    // borra el destino de un dueño que antes aceptaba llamadas.
    expect(payload.telephonySettings).toHaveProperty(
      "fallback_destination",
      null
    );
  });

  it("sin móvil del dueño no registra la tool aunque el ajuste sea «siempre»", async () => {
    mockedBusinessFindUnique.mockResolvedValue({
      ...BUSINESS_PRINCIPAL,
      ownerWhatsappNumber: null,
      agentSettings: { ...DEFAULT_AGENT_SETTINGS, pasarLlamadas: "siempre" },
    } as any);
    mockedAgentFindMany.mockResolvedValue(agenteSincronizable());

    await syncAgentToTelnyx("biz1");

    const payload = mockedUpdateAssistant.mock.calls[0][1];
    expect(payload.tools!.some((tool) => tool.type === "transfer")).toBe(false);
    expect(payload.instructions).not.toContain("## Pasar la llamada");
    expect(payload.telephonySettings).toHaveProperty(
      "fallback_destination",
      null
    );
  });

  it("nunca pasa la llamada de respaldo a la línea desviada a Alhabla: volvería a entrar como otra llamada", async () => {
    // Caso C: los avisos van a la línea de clientes, que está desviada a
    // Alhabla. destinoDeTransferencia la descarta y no hay respaldo.
    mockedBusinessFindUnique.mockResolvedValue({
      ...BUSINESS_PRINCIPAL,
      customerLineType: "fijo",
      phone: "+34931112233",
      ownerWhatsappNumber: null,
      ownerPhoneIsCustomerLine: true,
      agentSettings: { ...DEFAULT_AGENT_SETTINGS, pasarLlamadas: "siempre" },
    } as any);
    mockedAgentFindMany.mockResolvedValue(agenteSincronizable());

    await syncAgentToTelnyx("biz1");

    const payload = mockedUpdateAssistant.mock.calls[0][1];
    expect(payload.tools!.some((tool) => tool.type === "transfer")).toBe(false);
    expect(payload.telephonySettings).toHaveProperty(
      "fallback_destination",
      null
    );
  });

  it("con desvío (fijo) no se activa por defecto, pero sí con el ajuste explícito y el modo «siempre» cambia la regla", async () => {
    const conDesvio = {
      ...BUSINESS_PRINCIPAL,
      customerLineType: "fijo",
      phone: "+34931112233",
    };
    mockedBusinessFindUnique.mockResolvedValue(conDesvio as any);
    mockedAgentFindMany.mockResolvedValue(agenteSincronizable());
    await syncAgentToTelnyx("biz1");
    expect(
      mockedUpdateAssistant.mock.calls[0][1].tools!.some(
        (tool) => tool.type === "transfer"
      )
    ).toBe(false);

    mockedUpdateAssistant.mockClear();
    mockedBusinessFindUnique.mockResolvedValue({
      ...conDesvio,
      agentSettings: { ...DEFAULT_AGENT_SETTINGS, pasarLlamadas: "siempre" },
    } as any);
    await syncAgentToTelnyx("biz1");
    const payload = mockedUpdateAssistant.mock.calls[0][1];
    expect(payload.tools!.some((tool) => tool.type === "transfer")).toBe(true);
    expect(payload.instructions).toContain(
      "Solo dentro del horario de apertura"
    );
  });

  it("la tool transfer va detrás de las tools de voz y antes de hangup", async () => {
    mockedBusinessFindUnique.mockResolvedValue(BUSINESS_PRINCIPAL as any);
    mockedAgentFindMany.mockResolvedValue(agenteSincronizable());

    await syncAgentToTelnyx("biz1");

    const tipos = mockedUpdateAssistant.mock.calls[0][1].tools!.map(
      (tool) => tool.type
    );
    expect(tipos.slice(-2)).toEqual(["transfer", "hangup"]);
    expect(tipos.slice(0, -2).every((tipo) => tipo === "webhook")).toBe(true);
  });

  it("al crear el assistant también lleva la tool cuando procede", async () => {
    mockedBusinessFindUnique.mockResolvedValue(BUSINESS_PRINCIPAL as any);
    mockedCreateAssistant.mockResolvedValue({
      id: "assistant_1",
      name: "alhabla-biz1-agent1",
      instructions: "i",
    });

    await createTelnyxAssistantForAgent({
      agentId: "agent1",
      businessId: "biz1",
    });

    const payload = mockedCreateAssistant.mock.calls[0][0];
    expect(payload.tools!.filter((tool) => tool.type === "transfer")).toEqual([
      TOOL_TRANSFER_ESPERADA,
    ]);
    expect(payload.instructions).toContain("## Pasar la llamada");
    expect(payload.telephonySettings?.fallback_destination).toBe(
      MOVIL_DEL_DUENO
    );
  });
});

describe("transferencia al dueño — prompts editados a mano y copia del panel", () => {
  const BLOQUE = "## Pasar la llamada\nPuedes pasar la llamada…";

  it("promptManualConSuRegla añade el bloque al final solo si falta y hay tool", () => {
    expect(promptManualConSuRegla("Mi prompt.\n", BLOQUE)).toBe(
      `Mi prompt.\n\n${BLOQUE}`
    );
    // Sin tool no se toca ni una coma.
    expect(promptManualConSuRegla("Mi prompt.\n", null)).toBe("Mi prompt.\n");
    // El dueño ya escribió su propia regla: se respeta.
    const conRegla = "Mi prompt.\n\n## Pasar la llamada\nNunca la pases.";
    expect(promptManualConSuRegla(conRegla, BLOQUE)).toBe(conRegla);
  });

  it("un prompt editado a mano viaja a Telnyx con el bloque cuando se registra la tool transfer, y sin tocar Agent.systemPrompt", async () => {
    mockedBusinessFindUnique.mockResolvedValue(BUSINESS_PRINCIPAL as any);
    mockedAgentFindMany.mockResolvedValue([
      {
        id: "agent_manual",
        telnyxAssistantId: "assistant_1",
        telnyxConfigHash: null,
        systemPrompt: "Eres la recepcionista de Lola. Sé breve.",
        promptManuallyEdited: true,
      },
    ] as any);

    await syncAgentToTelnyx("biz1");

    const payload = mockedUpdateAssistant.mock.calls[0][1];
    expect(payload.tools!.some((tool) => tool.type === "transfer")).toBe(true);
    expect(
      payload.instructions.startsWith("Eres la recepcionista de Lola.")
    ).toBe(true);
    expect(payload.instructions).toContain("## Pasar la llamada");
    expect(payload.instructions).toContain("Pásala solo si el cliente pide");
    // La copia del panel de un prompt manual no se pisa.
    const data = (mockedAgentUpdate.mock.calls[0][0] as any).data;
    expect(data).not.toHaveProperty("systemPrompt");
  });

  it("un prompt editado a mano no recibe el bloque si la tool no se registra", async () => {
    mockedBusinessFindUnique.mockResolvedValue({
      ...BUSINESS_PRINCIPAL,
      agentSettings: { ...DEFAULT_AGENT_SETTINGS, pasarLlamadas: "nunca" },
    } as any);
    mockedAgentFindMany.mockResolvedValue([
      {
        id: "agent_manual",
        telnyxAssistantId: "assistant_1",
        telnyxConfigHash: null,
        systemPrompt: "Eres la recepcionista de Lola. Sé breve.",
        promptManuallyEdited: true,
      },
    ] as any);

    await syncAgentToTelnyx("biz1");

    const payload = mockedUpdateAssistant.mock.calls[0][1];
    expect(payload.tools!.some((tool) => tool.type === "transfer")).toBe(false);
    expect(payload.instructions).toBe(
      "Eres la recepcionista de Lola. Sé breve."
    );
  });

  it("en un agente gestionado guarda en Agent.systemPrompt la copia del panel con el bloque, la misma regla que manda a Telnyx", async () => {
    mockedBusinessFindUnique.mockResolvedValue(BUSINESS_PRINCIPAL as any);
    mockedAgentFindMany.mockResolvedValue(agenteSincronizable());

    await syncAgentToTelnyx("biz1");

    const payload = mockedUpdateAssistant.mock.calls[0][1];
    expect(payload.instructions).toContain("## Pasar la llamada");
    const data = (mockedAgentUpdate.mock.calls[0][0] as any).data;
    expect(data.telnyxSyncError).toBeNull();
    expect(data.systemPrompt).toContain("## Pasar la llamada");
    expect(data.systemPrompt).toContain("Pásala solo si el cliente pide");
    // Es la copia del panel (variables genéricas, como escribe PATCH
    // /business/me), no la reescritura para Telnyx que hace
    // buildTelnyxAssistantPayload ({{telnyx_current_time_…}}).
    expect(data.systemPrompt).toContain("{{current_time_Europe/Madrid}}");
    expect(data.systemPrompt).not.toContain("{{telnyx_");
  });
});
