import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import {
  AgentSettingsSchema,
  buildManagedAgentPrompt as buildManagedAgentPromptEnJson,
  DEFAULT_AGENT_SETTINGS,
  parseAgentSettings,
} from "../../src/lib/managedAgentPrompt.js";
import {
  componerPrompt,
  SECCIONES_DEL_PROMPT,
} from "../../src/lib/seccionesDelPrompt.js";
import { SECCIONES_DEL_PROMPT_V3 } from "../../src/lib/seccionesDelPromptV3.js";
import { syncAgentToTelnyx } from "../../src/lib/telnyxAgentSync.js";
import { businessesRoutes } from "../../src/modules/businesses/routes.js";
import { prisma } from "../../src/lib/prisma.js";
import { telnyxAiAdapter } from "../../src/adapters/telnyx/TelnyxAiAdapter.js";
/** Estas reglas se leen en Markdown («## Sección»); que el JSON de
 * producción lleve exactamente los mismos párrafos lo comprueba
 * managedAgentPrompt.test.ts («el JSON lleva los mismos párrafos…»). */
const buildManagedAgentPrompt = (
  input: Parameters<typeof buildManagedAgentPromptEnJson>[0]
) => buildManagedAgentPromptEnJson({ ...input, formato: "texto" });

vi.mock("../../src/lib/prisma.js", () => ({
  prisma: {
    business: {
      findUnique: vi.fn(),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    service: { findMany: vi.fn() },
    professional: { findMany: vi.fn() },
    agent: { findMany: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("../../src/adapters/telnyx/TelnyxAiAdapter.js", () => ({
  telnyxAiAdapter: {
    createAssistant: vi.fn(),
    updateAssistant: vi.fn(),
    listVoices: vi.fn(),
  },
}));
vi.mock("../../src/modules/whatsapp/service.js", () => ({
  listaDeEsperaDisponible: vi.fn().mockResolvedValue(true),
}));
vi.mock("../../src/modules/calendar/service.js", () => ({
  calendarService: {},
}));
vi.mock("../../src/lib/agentBootstrap.js", () => ({
  syncAgentNameWithBusinessType: vi.fn(),
  syncAgentToRetell: vi.fn(),
}));

const mockedBusinessFindUnique = vi.mocked(prisma.business.findUnique);
const mockedBusinessUpdate = vi.mocked(prisma.business.update);
const mockedBusinessFindUniqueOrThrow = vi.mocked(
  prisma.business.findUniqueOrThrow
);
const mockedServiceFindMany = vi.mocked(prisma.service.findMany);
const mockedProfessionalFindMany = vi.mocked(prisma.professional.findMany);
const mockedAgentFindMany = vi.mocked(prisma.agent.findMany);
const mockedAgentUpdate = vi.mocked(prisma.agent.update);
const mockedUpdateAssistant = vi.mocked(telnyxAiAdapter.updateAssistant);
const mockedListVoices = vi.mocked(telnyxAiAdapter.listVoices);

/** Los ajustes que ya hay en BD en los negocios de hoy: sin el campo. */
const AJUSTES_SIN_CAMPO = {
  version: 1,
  tone: "professional",
  primaryGoal: "bookings",
  responseStyle: "balanced",
  escalation: "take_message",
  voiceGender: "femenina",
  languages: ["es-ES"],
  voiceLanguage: "es-ES",
  darPrecios: "si_preguntan",
};

describe("agentSettings.versionDelPrompt", () => {
  it("por defecto es «v1», también en DEFAULT_AGENT_SETTINGS", () => {
    expect(DEFAULT_AGENT_SETTINGS.versionDelPrompt).toBe("v1");
    expect(AgentSettingsSchema.parse(AJUSTES_SIN_CAMPO).versionDelPrompt).toBe(
      "v1"
    );
  });

  it("un valor ausente en BD se lee como «v1» y conserva el resto de ajustes", () => {
    const leidos = parseAgentSettings(AJUSTES_SIN_CAMPO);
    expect(leidos.versionDelPrompt).toBe("v1");
    expect(leidos.tone).toBe("professional");
    expect(leidos.responseStyle).toBe("balanced");
    expect(parseAgentSettings(null).versionDelPrompt).toBe("v1");
  });

  it("un valor desconocido se lee como «v1» sin borrar tono ni estilo", () => {
    const leidos = parseAgentSettings({
      ...AJUSTES_SIN_CAMPO,
      versionDelPrompt: "v9",
    });
    expect(leidos.versionDelPrompt).toBe("v1");
    expect(leidos.tone).toBe("professional");
    expect(leidos.responseStyle).toBe("balanced");
  });

  it("«v1» explícito se conserva", () => {
    expect(
      parseAgentSettings({ ...AJUSTES_SIN_CAMPO, versionDelPrompt: "v1" })
        .versionDelPrompt
    ).toBe("v1");
  });

  it("«v3» se conserva", () => {
    expect(
      parseAgentSettings({ ...AJUSTES_SIN_CAMPO, versionDelPrompt: "v3" })
        .versionDelPrompt
    ).toBe("v3");
  });
});

describe("el prompt con «v3»", () => {
  const ENTRADA = {
    businessName: "Peluquería Ana",
    businessType: "peluqueria" as const,
    timezone: "Europe/Madrid",
  };
  const conV3 = buildManagedAgentPrompt({
    ...ENTRADA,
    settings: { ...AJUSTES_SIN_CAMPO, versionDelPrompt: "v3" },
  });

  it("usa SECCIONES_DEL_PROMPT_V3: los principios detrás de Rol y el repaso antes de Idioma", () => {
    const contexto = {
      settings: parseAgentSettings({
        ...AJUSTES_SIN_CAMPO,
        versionDelPrompt: "v3",
      }),
      idioma: { instruccion: "Habla en español.", recordatorio: null },
      timezone: "Europe/Madrid",
      listaDeEspera: true,
      recordatorioPorWhatsapp: true,
      ocultarNumero: false,
    };
    const esperado = SECCIONES_DEL_PROMPT_V3.flatMap((seccion) =>
      seccion(contexto)
    )
      .filter(Boolean)
      .join("\n\n");
    expect(componerPrompt(contexto, "texto")).toBe(esperado);
    const titulos = conV3.match(/^## .+$/gm) ?? [];
    expect(titulos.slice(0, 2)).toEqual(["## Rol", "## Principios"]);
    expect(titulos.slice(-2)).toEqual(["## Antes de responder", "## Idioma"]);
  });

  it("no deja condiciones ni plantillas sin resolver", () => {
    expect(conV3).not.toMatch(/\[SI |\$\{|undefined|\bnull\b/);
  });

  it("no cambia el prompt de «v1»", () => {
    const sinCampo = buildManagedAgentPrompt({
      ...ENTRADA,
      settings: AJUSTES_SIN_CAMPO,
    });
    expect(conV3).not.toBe(sinCampo);
    expect(sinCampo).not.toContain("## Principios");
  });
});

describe("el prompt con «v1» es el de siempre", () => {
  const ENTRADA = {
    businessName: "Peluquería Ana",
    businessType: "peluqueria" as const,
    timezone: "Europe/Madrid",
  };

  it("sin el campo, con «v1» y con un valor desconocido sale el mismo prompt, byte a byte", () => {
    const sinCampo = buildManagedAgentPrompt({
      ...ENTRADA,
      settings: AJUSTES_SIN_CAMPO,
    });
    const conV1 = buildManagedAgentPrompt({
      ...ENTRADA,
      settings: { ...AJUSTES_SIN_CAMPO, versionDelPrompt: "v1" },
    });
    const desconocido = buildManagedAgentPrompt({
      ...ENTRADA,
      settings: { ...AJUSTES_SIN_CAMPO, versionDelPrompt: "v9" },
    });
    expect(conV1).toBe(sinCampo);
    expect(desconocido).toBe(sinCampo);
  });

  it("componerPrompt con «v1» usa SECCIONES_DEL_PROMPT sin cambios", () => {
    const contexto = {
      settings: parseAgentSettings(AJUSTES_SIN_CAMPO),
      idioma: { instruccion: "Habla en español.", recordatorio: null },
      timezone: "Europe/Madrid",
      listaDeEspera: true,
      recordatorioPorWhatsapp: true,
      ocultarNumero: false,
    };
    const esperado = SECCIONES_DEL_PROMPT.flatMap((seccion) =>
      seccion(contexto)
    )
      .filter(Boolean)
      .join("\n\n");
    expect(componerPrompt(contexto, "texto")).toBe(esperado);
  });
});

describe("el payload y el hash de un assistant no cambian con el campo", () => {
  const NEGOCIO = {
    name: "Peluquería Ejemplo",
    businessDetails: null,
    businessType: "peluqueria",
    minAdvanceBookingMinutes: null,
    maxAppointmentDurationMinutes: null,
  };

  /** Sincroniza un agente con hash viejo y devuelve lo que se manda a
   * Telnyx y el hash que se guarda. */
  async function sincronizarCon(agentSettings: unknown) {
    mockedBusinessFindUnique.mockResolvedValue({
      ...NEGOCIO,
      agentSettings,
    } as any);
    mockedAgentFindMany.mockResolvedValue([
      {
        id: "agent1",
        telnyxAssistantId: "assistant_1",
        telnyxConfigHash: "hash-vieja",
        systemPrompt: "prompt guardado",
        promptManuallyEdited: false,
      },
    ] as any);
    mockedUpdateAssistant.mockClear();
    mockedAgentUpdate.mockClear();
    await syncAgentToTelnyx("biz1");
    expect(mockedUpdateAssistant).toHaveBeenCalledTimes(1);
    const payload = mockedUpdateAssistant.mock.calls[0][1];
    const datos = mockedAgentUpdate.mock.calls[0][0].data as {
      telnyxConfigHash: string;
    };
    return { payload, hash: datos.telnyxConfigHash };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockedServiceFindMany.mockResolvedValue([]);
    mockedProfessionalFindMany.mockResolvedValue([]);
    mockedListVoices.mockResolvedValue([
      { id: "Telnyx.Ultra.isabel", language: "es-ES", gender: "Female" },
    ]);
  });

  it("agentSettings sin el campo, con «v1» y con un valor desconocido dan el mismo payload y el mismo telnyxConfigHash", async () => {
    const sinCampo = await sincronizarCon(AJUSTES_SIN_CAMPO);
    const conV1 = await sincronizarCon({
      ...AJUSTES_SIN_CAMPO,
      versionDelPrompt: "v1",
    });
    const desconocido = await sincronizarCon({
      ...AJUSTES_SIN_CAMPO,
      versionDelPrompt: "v9",
    });

    expect(sinCampo.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(conV1.hash).toBe(sinCampo.hash);
    expect(desconocido.hash).toBe(sinCampo.hash);
    expect(JSON.stringify(conV1.payload)).toBe(
      JSON.stringify(sinCampo.payload)
    );
    // El campo no viaja a Telnyx: ni en el payload ni en el prompt.
    expect(JSON.stringify(sinCampo.payload)).not.toContain("versionDelPrompt");
  });

  it("agentSettings nulo (negocio nuevo) y el de por defecto dan el mismo hash", async () => {
    const nulo = await sincronizarCon(null);
    const porDefecto = await sincronizarCon(DEFAULT_AGENT_SETTINGS);
    const sinCampoDelTodo = await sincronizarCon({
      ...DEFAULT_AGENT_SETTINGS,
      versionDelPrompt: undefined,
    });
    expect(porDefecto.hash).toBe(nulo.hash);
    expect(sinCampoDelTodo.hash).toBe(nulo.hash);
  });
});

describe("PATCH /business/me y versionDelPrompt", () => {
  async function patch(body: unknown) {
    const fastify = Fastify();
    fastify.decorate("authenticate", async (request: any) => {
      request.user = { businessId: "biz_1" };
    });
    await fastify.register(businessesRoutes);
    return fastify.inject({
      method: "PATCH",
      url: "/business/me",
      payload: body as any,
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockedBusinessFindUnique.mockResolvedValue({
      name: "Peluquería Test",
      businessDetails: null,
      agentSettings: { ...AJUSTES_SIN_CAMPO, versionDelPrompt: "v1" },
      timezone: "Europe/Madrid",
    } as any);
    mockedBusinessUpdate.mockResolvedValue({} as any);
    mockedAgentFindMany.mockResolvedValue([]);
    mockedBusinessFindUniqueOrThrow.mockResolvedValue({
      id: "biz_1",
      name: "Peluquería Test",
      calendarProvider: "google",
      agents: [],
      services: [],
      professionals: [],
      calendarConnections: [],
      agentSettings: { ...AJUSTES_SIN_CAMPO, versionDelPrompt: "v1" },
    } as any);
  });

  it("guardar los ajustes sin el campo conserva el que ya tenía el negocio", async () => {
    // Lo guardado es «v3» y el body no la trae: la ruta usa la guardada y
    // no el .default («v1») del body.
    mockedBusinessFindUnique.mockResolvedValue({
      name: "Peluquería Test",
      businessDetails: null,
      agentSettings: { ...AJUSTES_SIN_CAMPO, versionDelPrompt: "v3" },
      timezone: "Europe/Madrid",
    } as any);

    const respuesta = await patch({
      agentSettings: { ...AJUSTES_SIN_CAMPO, tone: "direct" },
    });

    expect(respuesta.statusCode).toBe(200);
    expect(mockedBusinessFindUnique).toHaveBeenCalledWith({
      where: { id: "biz_1" },
      select: { agentSettings: true },
    });
    const datos = mockedBusinessUpdate.mock.calls[0][0].data as Record<
      string,
      unknown
    >;
    expect(datos.agentSettings).toMatchObject({
      tone: "direct",
      versionDelPrompt: "v3",
    });
  });

  it("guardar otros ajustes del negocio no toca agentSettings", async () => {
    const respuesta = await patch({ name: "Peluquería Nueva" });

    expect(respuesta.statusCode).toBe(200);
    const datos = mockedBusinessUpdate.mock.calls[0][0].data as Record<
      string,
      unknown
    >;
    expect(datos).not.toHaveProperty("agentSettings");
  });
});
