import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { telnyxReconcilerJob } from "../../src/jobs/telnyxReconciler.js";
import { prisma } from "../../src/lib/prisma.js";
import { telnyxAiAdapter } from "../../src/adapters/telnyx/TelnyxAiAdapter.js";
import {
  crearAssistantYPromocionar,
  syncAgentToTelnyx,
} from "../../src/lib/telnyxAgentSync.js";
import { acquireLock, releaseLock } from "../../src/lib/bookingLock.js";
import { sendZohoMail } from "../../src/lib/zohoMail.js";
import {
  incorporarPlantillasNuevas,
  refrescarPlantillasConClave,
} from "../../src/modules/whatsapp/service.js";

vi.mock("../../src/lib/prisma.js", () => ({
  prisma: {
    agent: { findMany: vi.fn(), findUnique: vi.fn() },
    business: { findMany: vi.fn() },
  },
}));

vi.mock("../../src/adapters/telnyx/TelnyxAiAdapter.js", () => ({
  telnyxAiAdapter: { getAssistant: vi.fn() },
}));

vi.mock("../../src/lib/telnyxAgentSync.js", () => ({
  syncAgentToTelnyx: vi.fn(),
  crearAssistantYPromocionar: vi.fn(),
}));

vi.mock("../../src/lib/bookingLock.js", () => ({
  acquireLock: vi.fn(),
  releaseLock: vi.fn(),
}));

vi.mock("../../src/lib/zohoMail.js", () => ({
  sendZohoMail: vi.fn(),
}));

vi.mock("../../src/modules/whatsapp/service.js", () => ({
  incorporarPlantillasNuevas: vi.fn().mockResolvedValue(0),
  refrescarPlantillasConClave: vi.fn(),
}));

// El Gestor (fase 2) se sincroniza en su propio módulo (gestorSync.test.ts);
// aquí solo importa que el reconciliador lo llame y siga si falla.
vi.mock("../../src/lib/gestorSync.js", () => ({
  sincronizarGestor: vi.fn(async () => ({ estado: "sin_id" })),
}));

const mockedAgentFindMany = vi.mocked(prisma.agent.findMany);
const mockedBusinessFindMany = vi.mocked(prisma.business.findMany);
const mockedGetAssistant = vi.mocked(telnyxAiAdapter.getAssistant);
const mockedSync = vi.mocked(syncAgentToTelnyx);
const mockedSendMail = vi.mocked(sendZohoMail);
const mockedRefrescarPlantillas = vi.mocked(refrescarPlantillasConClave);
const mockedAgentFindUnique = vi.mocked(prisma.agent.findUnique);
const mockedCrearAssistant = vi.mocked(crearAssistantYPromocionar);
const mockedAcquireLock = vi.mocked(acquireLock);
const mockedReleaseLock = vi.mocked(releaseLock);

const ORIGINAL_ALERT_EMAIL = process.env.TELNYX_ALERT_EMAIL;
const ORIGINAL_ROLLOUT = process.env.VOICE_TELNYX_ROLLOUT;

beforeEach(() => {
  vi.clearAllMocks();
  mockedSync.mockResolvedValue(undefined);
  mockedRefrescarPlantillas.mockResolvedValue(undefined);
  mockedBusinessFindMany.mockResolvedValue([]);
  mockedAcquireLock.mockResolvedValue("token_1");
  mockedReleaseLock.mockResolvedValue(undefined);
  mockedAgentFindUnique.mockResolvedValue({ telnyxAssistantId: null } as any);
  process.env.TELNYX_ALERT_EMAIL = "ops@alhabla.ai";
  // Apagado salvo en los tests de assistants que faltan, para que el resto
  // no dependa del entorno.
  delete process.env.VOICE_TELNYX_ROLLOUT;
});

afterEach(() => {
  if (ORIGINAL_ALERT_EMAIL === undefined) delete process.env.TELNYX_ALERT_EMAIL;
  else process.env.TELNYX_ALERT_EMAIL = ORIGINAL_ALERT_EMAIL;
  if (ORIGINAL_ROLLOUT === undefined) delete process.env.VOICE_TELNYX_ROLLOUT;
  else process.env.VOICE_TELNYX_ROLLOUT = ORIGINAL_ROLLOUT;
});

describe("telnyxReconcilerJob", () => {
  it("el reconciler llama a refrescarPlantillasConClave antes de sincronizar y un fallo suyo no aborta la reconciliación", async () => {
    mockedAgentFindMany
      .mockResolvedValueOnce([
        {
          id: "a1",
          businessId: "b1",
          telnyxAssistantId: "as1",
          telnyxSyncError: null,
        },
      ] as any)
      .mockResolvedValueOnce([
        { id: "a1", businessId: "b1", telnyxSyncError: null },
      ] as any);
    mockedGetAssistant.mockResolvedValue({
      id: "as1",
      name: "alhabla-b1-a1",
      instructions: "",
    } as any);
    mockedRefrescarPlantillas.mockRejectedValue(new Error("WABA caído"));
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const result = await telnyxReconcilerJob();

    expect(mockedRefrescarPlantillas).toHaveBeenCalledTimes(1);
    // Antes de refrescar, se dan de alta las plantillas nuevas del WABA.
    expect(vi.mocked(incorporarPlantillasNuevas)).toHaveBeenCalledTimes(1);
    expect(mockedRefrescarPlantillas.mock.invocationCallOrder[0]).toBeLessThan(
      mockedSync.mock.invocationCallOrder[0]
    );
    expect(mockedSync).toHaveBeenCalledWith("b1");
    expect(result.agentsChecked).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("refrescarPlantillasConClave")
    );
    errorSpy.mockRestore();
  });

  it("no encuentra nada que revisar y no envía correo si no hay agentes con assistant Telnyx", async () => {
    mockedAgentFindMany.mockResolvedValue([]);

    const result = await telnyxReconcilerJob();

    expect(result.agentsChecked).toBe(0);
    expect(mockedSync).not.toHaveBeenCalled();
    expect(mockedSendMail).not.toHaveBeenCalled();
  });

  it("llama a syncAgentToTelnyx una vez por negocio, no por agente", async () => {
    mockedAgentFindMany
      .mockResolvedValueOnce([
        {
          id: "agent1",
          businessId: "biz1",
          telnyxAssistantId: "asst_1",
          telnyxSyncError: null,
        },
        {
          id: "agent2",
          businessId: "biz1",
          telnyxAssistantId: "asst_2",
          telnyxSyncError: null,
        },
      ] as any)
      .mockResolvedValueOnce([
        { id: "agent1", businessId: "biz1", telnyxSyncError: null },
        { id: "agent2", businessId: "biz1", telnyxSyncError: null },
      ] as any);
    mockedGetAssistant.mockResolvedValue({
      id: "asst_1",
      name: "alhabla-biz1-agent1",
      instructions: "i",
    } as any);

    await telnyxReconcilerJob();

    expect(mockedSync).toHaveBeenCalledTimes(1);
    expect(mockedSync).toHaveBeenCalledWith("biz1");
  });

  it("cuenta un agente como resincronizado si su telnyxSyncError desaparece tras el sync", async () => {
    mockedAgentFindMany
      .mockResolvedValueOnce([
        {
          id: "agent1",
          businessId: "biz1",
          telnyxAssistantId: "asst_1",
          telnyxSyncError: "fallo previo",
        },
      ] as any)
      .mockResolvedValueOnce([
        { id: "agent1", businessId: "biz1", telnyxSyncError: null },
      ] as any);
    mockedGetAssistant.mockResolvedValue({
      id: "asst_1",
      name: "alhabla-biz1-agent1",
      instructions: "i",
    } as any);

    const result = await telnyxReconcilerJob();

    expect(result.agentsResynced).toBe(1);
    expect(result.businessesWithSyncError).toEqual([]);
  });

  it("deja constancia si el error de sincronización persiste tras el sync", async () => {
    mockedAgentFindMany
      .mockResolvedValueOnce([
        {
          id: "agent1",
          businessId: "biz1",
          telnyxAssistantId: "asst_1",
          telnyxSyncError: "fallo previo",
        },
      ] as any)
      .mockResolvedValueOnce([
        { id: "agent1", businessId: "biz1", telnyxSyncError: "sigue fallando" },
      ] as any);
    mockedGetAssistant.mockResolvedValue({
      id: "asst_1",
      name: "alhabla-biz1-agent1",
      instructions: "i",
    } as any);

    const result = await telnyxReconcilerJob();

    expect(result.agentsResynced).toBe(0);
    expect(result.businessesWithSyncError).toEqual(["biz1"]);
    expect(mockedSendMail).toHaveBeenCalled();
  });

  it("detecta un assistant que ya no existe en Telnyx", async () => {
    mockedAgentFindMany
      .mockResolvedValueOnce([
        {
          id: "agent1",
          businessId: "biz1",
          telnyxAssistantId: "asst_missing",
          telnyxSyncError: null,
        },
      ] as any)
      .mockResolvedValueOnce([
        { id: "agent1", businessId: "biz1", telnyxSyncError: null },
      ] as any);
    mockedGetAssistant.mockRejectedValue(new Error("Not found"));

    const result = await telnyxReconcilerJob();

    expect(result.assistantsMissingOnTelnyx).toHaveLength(1);
    expect(result.assistantsMissingOnTelnyx[0]).toContain("biz1/agent1");
    expect(mockedSendMail).toHaveBeenCalled();
  });

  it("detecta un assistant remoto con nombre distinto al determinista esperado", async () => {
    mockedAgentFindMany
      .mockResolvedValueOnce([
        {
          id: "agent1",
          businessId: "biz1",
          telnyxAssistantId: "asst_1",
          telnyxSyncError: null,
        },
      ] as any)
      .mockResolvedValueOnce([
        { id: "agent1", businessId: "biz1", telnyxSyncError: null },
      ] as any);
    mockedGetAssistant.mockResolvedValue({
      id: "asst_1",
      name: "otro-nombre-inesperado",
      instructions: "i",
    } as any);

    const result = await telnyxReconcilerJob();

    expect(result.assistantsWithUnexpectedName).toHaveLength(1);
    expect(mockedSendMail).toHaveBeenCalled();
  });

  it("detecta un negocio con número activo pero sin telnyxPhoneNumberId", async () => {
    mockedAgentFindMany.mockResolvedValue([]);
    mockedBusinessFindMany.mockResolvedValue([
      {
        id: "biz1",
        voiceRoutingTarget: "telnyx",
        voiceFailoverActive: false,
        telnyxPhoneNumberId: null,
        telnyxPhoneNumber: "+34930000001",
        phoneNumberStatus: "active",
      },
    ] as any);

    const result = await telnyxReconcilerJob();

    expect(result.businessesWithRoutingInconsistency).toEqual([
      "biz1: orchestrator=telnyx sin telnyxPhoneNumberId",
    ]);
  });

  it("no avisa de un negocio que aún no ha comprado número (registrado sin plan)", async () => {
    mockedAgentFindMany.mockResolvedValue([]);
    mockedBusinessFindMany.mockResolvedValue([
      {
        id: "biz_sin_numero",
        voiceRoutingTarget: "telnyx",
        voiceFailoverActive: false,
        telnyxPhoneNumberId: null,
        telnyxPhoneNumber: null,
        phoneNumberStatus: "pending",
      },
    ] as any);

    const result = await telnyxReconcilerJob();

    expect(result.businessesWithRoutingInconsistency).toEqual([]);
    expect(mockedSendMail).not.toHaveBeenCalled();
  });

  it("detecta voiceRoutingTarget desalineado con voiceFailoverActive", async () => {
    mockedAgentFindMany.mockResolvedValue([]);
    mockedBusinessFindMany.mockResolvedValue([
      {
        id: "biz1",
        voiceRoutingTarget: "telnyx",
        voiceFailoverActive: true,
        telnyxPhoneNumberId: "pn_1",
      },
    ] as any);

    const result = await telnyxReconcilerJob();

    expect(result.businessesWithRoutingInconsistency).toHaveLength(1);
  });

  it("no marca inconsistencia cuando el enrutamiento es coherente", async () => {
    mockedAgentFindMany.mockResolvedValue([]);
    mockedBusinessFindMany.mockResolvedValue([
      {
        id: "biz1",
        voiceRoutingTarget: "telnyx",
        voiceFailoverActive: false,
        telnyxPhoneNumberId: "pn_1",
      },
    ] as any);

    const result = await telnyxReconcilerJob();

    expect(result.businessesWithRoutingInconsistency).toEqual([]);
    expect(mockedSendMail).not.toHaveBeenCalled();
  });

  it("no envía correo si TELNYX_ALERT_EMAIL no está configurado, aunque haya hallazgos", async () => {
    delete process.env.TELNYX_ALERT_EMAIL;
    mockedAgentFindMany.mockResolvedValue([]);
    mockedBusinessFindMany.mockResolvedValue([
      {
        id: "biz1",
        voiceRoutingTarget: "retell",
        voiceFailoverActive: false,
        telnyxPhoneNumberId: "pn_1",
      },
    ] as any);

    await telnyxReconcilerJob();

    expect(mockedSendMail).not.toHaveBeenCalled();
  });

  it("no lanza si el envío de correo de alerta falla", async () => {
    mockedAgentFindMany.mockResolvedValue([]);
    mockedBusinessFindMany.mockResolvedValue([
      {
        id: "biz1",
        voiceRoutingTarget: "telnyx",
        voiceFailoverActive: false,
        telnyxPhoneNumberId: null,
      },
    ] as any);
    mockedSendMail.mockRejectedValue(new Error("Zoho caído"));

    await expect(telnyxReconcilerJob()).resolves.toBeDefined();
  });
});

// Un negocio cuyo registro no llegó a crear el assistant (antes bastaba con
// que Retell lanzara) no tiene quien conteste en Telnyx, y el resto del
// reconciliador no lo ve: solo revisa agentes que ya tienen uno.
describe("telnyxReconcilerJob — assistants que faltan", () => {
  const NEGOCIO_SIN_ASSISTANT = {
    id: "biz_sin",
    agents: [{ id: "agent_sin" }],
  };

  beforeEach(() => {
    process.env.VOICE_TELNYX_ROLLOUT = "all";
    mockedAgentFindMany.mockResolvedValue([]);
    mockedBusinessFindMany
      .mockResolvedValueOnce([NEGOCIO_SIN_ASSISTANT] as any)
      .mockResolvedValue([]);
  });

  it("crea el assistant del primer agente activo, promociona el negocio y avisa por correo", async () => {
    mockedCrearAssistant.mockResolvedValue({
      eligible: true,
      reason: null,
      promocion: "hecha",
    });
    const warnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    const result = await telnyxReconcilerJob();

    expect(mockedCrearAssistant).toHaveBeenCalledWith({
      agentId: "agent_sin",
      businessId: "biz_sin",
    });
    expect(result.assistantsCreados).toEqual([
      "biz_sin/agent_sin: creado y promocionado a Telnyx-primary",
    ]);
    expect(result.assistantsSinCrear).toEqual([]);
    // Solo negocios sin NINGÚN agente activo con assistant, y con agentes
    // de hace un rato (no uno que createBusinessAgent está creando ahora).
    const consulta = mockedBusinessFindMany.mock.calls[0][0] as any;
    expect(consulta.where.agents.none).toEqual({
      active: true,
      deletedAt: null,
      telnyxAssistantId: { not: null },
    });
    expect(consulta.where.agents.some.createdAt.lt).toBeInstanceOf(Date);
    expect(consulta.where.agents.some.createdAt.lt.getTime()).toBeLessThan(
      Date.now() - 10 * 60 * 1000
    );
    expect(consulta.select.agents).toEqual(
      expect.objectContaining({
        where: { active: true, deletedAt: null },
        orderBy: { createdAt: "asc" },
        take: 1,
      })
    );
    // Antes de la revisión de assistants: el nuevo entra ya en ella.
    expect(mockedCrearAssistant.mock.invocationCallOrder[0]).toBeLessThan(
      mockedAgentFindMany.mock.invocationCallOrder[0]
    );
    expect(mockedReleaseLock).toHaveBeenCalledWith(
      "telnyx_assistant_nuevo:biz_sin",
      "token_1"
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("biz_sin/agent_sin")
    );
    expect(mockedSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("Assistants creados porque faltaban"),
      })
    );
    warnSpy.mockRestore();
  });

  it("deja constancia del negocio que sigue sin assistant, con el motivo", async () => {
    mockedCrearAssistant.mockResolvedValue({
      eligible: false,
      reason: "Telnyx down",
      promocion: null,
    });

    const result = await telnyxReconcilerJob();

    expect(result.assistantsCreados).toEqual([]);
    expect(result.assistantsSinCrear).toEqual([
      "biz_sin/agent_sin: Telnyx down",
    ]);
    expect(mockedSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("Negocios que siguen sin assistant"),
      })
    );
  });

  it("con número ya comprado, lo crea pero señala que falta el cutover", async () => {
    mockedCrearAssistant.mockResolvedValue({
      eligible: true,
      reason: null,
      promocion: "falta_cutover",
    });

    const result = await telnyxReconcilerJob();

    expect(result.assistantsCreados).toEqual([
      "biz_sin/agent_sin: creado, pero ya tiene número: falta el cutover (scripts/cutoverToTelnyx.ts)",
    ]);
  });

  it("no crea nada con el rollout de Telnyx apagado", async () => {
    delete process.env.VOICE_TELNYX_ROLLOUT;
    mockedBusinessFindMany.mockReset();
    mockedBusinessFindMany.mockResolvedValue([]);

    const result = await telnyxReconcilerJob();

    expect(mockedCrearAssistant).not.toHaveBeenCalled();
    // Solo la consulta de enrutamiento.
    expect(mockedBusinessFindMany).toHaveBeenCalledTimes(1);
    expect(result.assistantsCreados).toEqual([]);
  });

  it("no crea el assistant si otra pasada tiene el cerrojo del negocio", async () => {
    mockedAcquireLock.mockResolvedValue(null);
    const warnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    const result = await telnyxReconcilerJob();

    expect(mockedCrearAssistant).not.toHaveBeenCalled();
    expect(mockedReleaseLock).not.toHaveBeenCalled();
    expect(result.assistantsCreados).toEqual([]);
    warnSpy.mockRestore();
  });

  it("no lo crea si, releído dentro del cerrojo, el agente ya tiene assistant", async () => {
    mockedAgentFindUnique.mockResolvedValue({
      telnyxAssistantId: "asst_de_otra_pasada",
    } as any);

    const result = await telnyxReconcilerJob();

    expect(mockedCrearAssistant).not.toHaveBeenCalled();
    expect(mockedReleaseLock).toHaveBeenCalledWith(
      "telnyx_assistant_nuevo:biz_sin",
      "token_1"
    );
    expect(result.assistantsCreados).toEqual([]);
  });

  it("un fallo al buscar negocios sin assistant no aborta la reconciliación", async () => {
    mockedBusinessFindMany.mockReset();
    mockedBusinessFindMany
      .mockRejectedValueOnce(new Error("Postgres caído"))
      .mockResolvedValue([]);
    mockedAgentFindMany
      .mockResolvedValueOnce([
        {
          id: "a1",
          businessId: "b1",
          telnyxAssistantId: "as1",
          telnyxSyncError: null,
        },
      ] as any)
      .mockResolvedValueOnce([
        { id: "a1", businessId: "b1", telnyxSyncError: null },
      ] as any);
    mockedGetAssistant.mockResolvedValue({
      id: "as1",
      name: "alhabla-b1-a1",
      instructions: "",
    } as any);
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const result = await telnyxReconcilerJob();

    expect(mockedSync).toHaveBeenCalledWith("b1");
    expect(result.agentsChecked).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("crearAssistantsQueFaltan")
    );
    errorSpy.mockRestore();
  });
});
