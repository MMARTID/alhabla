import { describe, it, expect, beforeEach, vi } from "vitest";
import Fastify from "fastify";
import { agentsRoutes } from "../../../src/modules/agents/routes.js";
import { prisma } from "../../../src/lib/prisma.js";
import { syncAgentToTelnyx } from "../../../src/lib/telnyxAgentSync.js";

vi.mock("../../../src/lib/prisma.js", () => ({
  prisma: {
    agent: {
      findFirst: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    business: {
      findUnique: vi.fn(),
    },
    service: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock("../../../src/lib/telnyxAgentSync.js", () => ({
  syncAgentToTelnyx: vi.fn(),
}));

const mockedAgentFindFirst = vi.mocked(prisma.agent.findFirst);
const mockedAgentUpdate = vi.mocked(prisma.agent.update);
const mockedSyncAgentToTelnyx = vi.mocked(syncAgentToTelnyx);

const FEMENINA = "538a8872-3799-4df5-b373-b78493b766c6";
const MASCULINA = "13ff5deb-2591-42ad-a356-63a04e524411";

describe("PATCH /agents/:id — conserva la voz elegida (hallazgo #26 de la auditoría)", () => {
  let fastify: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    fastify = Fastify();
    fastify.decorate("authenticate", async (request: any) => {
      request.user = { businessId: "biz_1" };
    });
    await fastify.register(agentsRoutes);
    mockedAgentUpdate.mockResolvedValue({ id: "agent_1" } as any);
    mockedSyncAgentToTelnyx.mockResolvedValue(undefined as any);
  });

  function agenteConVoz(voiceId: string) {
    mockedAgentFindFirst.mockResolvedValue({
      id: "agent_1",
      businessId: "biz_1",
      name: "Asistente",
      systemPrompt: "prompt actual",
      voiceId,
    } as any);
  }

  it("no resetea la voz masculina a la femenina por defecto al editar solo el saludo", async () => {
    agenteConVoz(MASCULINA);

    const response = await fastify.inject({
      method: "PATCH",
      url: "/agents/agent_1",
      // Solo se edita el saludo — el negocio nunca tocó la voz en este PATCH.
      payload: { firstMessage: "Hola, gracias por llamar" },
    });

    expect(response.statusCode).toBe(200);
    const { data } = mockedAgentUpdate.mock.calls[0][0] as any;
    expect(data).toMatchObject({ firstMessage: "Hola, gracias por llamar" });
    expect(data).not.toHaveProperty("voiceId");
  });

  it("sí cambia la voz cuando el PATCH la indica explícitamente", async () => {
    agenteConVoz(FEMENINA);

    const response = await fastify.inject({
      method: "PATCH",
      url: "/agents/agent_1",
      payload: { voiceId: MASCULINA },
    });

    expect(response.statusCode).toBe(200);
    expect(mockedAgentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "agent_1" },
        data: expect.objectContaining({ voiceId: MASCULINA }),
      })
    );
  });
});

describe("PATCH /agents/:id — el prompt llega al assistant de Telnyx", () => {
  let fastify: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    fastify = Fastify();
    fastify.decorate("authenticate", async (request: any) => {
      request.user = { businessId: "biz_1" };
    });
    await fastify.register(agentsRoutes);
    mockedAgentFindFirst.mockResolvedValue({
      id: "agent_1",
      businessId: "biz_1",
      name: "Asistente",
      systemPrompt: "prompt actual",
      voiceId: FEMENINA,
    } as any);
    mockedAgentUpdate.mockResolvedValue({ id: "agent_1" } as any);
    mockedSyncAgentToTelnyx.mockResolvedValue(undefined as any);
  });

  it("un prompt editado a mano queda marcado y se sincroniza con Telnyx", async () => {
    const response = await fastify.inject({
      method: "PATCH",
      url: "/agents/agent_1",
      payload: { systemPrompt: "Prompt a mano" },
    });

    expect(response.statusCode).toBe(200);
    expect(mockedAgentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          systemPrompt: "Prompt a mano",
          promptManuallyEdited: true,
        }),
      })
    );
    expect(mockedSyncAgentToTelnyx).toHaveBeenCalledWith("biz_1");
    // Primero se guarda y después se sincroniza: el assistant lee la fila.
    expect(mockedAgentUpdate.mock.invocationCallOrder[0]).toBeLessThan(
      mockedSyncAgentToTelnyx.mock.invocationCallOrder[0]
    );
  });

  it("el saludo, el nombre o la voz no tocan el assistant: salen de los ajustes del negocio", async () => {
    for (const payload of [
      { firstMessage: "Hola" },
      { name: "Recepción" },
      { voiceId: MASCULINA },
    ]) {
      const response = await fastify.inject({
        method: "PATCH",
        url: "/agents/agent_1",
        payload,
      });
      expect(response.statusCode).toBe(200);
    }

    expect(mockedSyncAgentToTelnyx).not.toHaveBeenCalled();
  });
});

describe("DELETE /agents/:id", () => {
  let fastify: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    fastify = Fastify();
    fastify.decorate("authenticate", async (request: any) => {
      request.user = { businessId: "biz_1" };
    });
    await fastify.register(agentsRoutes);
  });

  it("retira un agente de forma lógica", async () => {
    mockedAgentFindFirst.mockResolvedValue({
      id: "agent_1",
      businessId: "biz_1",
      active: true,
    } as any);
    mockedAgentUpdate.mockResolvedValue({ id: "agent_1" } as any);

    const response = await fastify.inject({
      method: "DELETE",
      url: "/agents/agent_1",
    });

    expect(response.statusCode).toBe(204);
    expect(mockedAgentFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          businessId: "biz_1",
          deletedAt: null,
        }),
      })
    );
    expect(mockedAgentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "agent_1" },
        data: expect.objectContaining({ active: false, deletedAt: expect.any(Date) }),
      })
    );
  });
});
