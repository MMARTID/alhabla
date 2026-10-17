// src/modules/agents/routes.ts

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import {
  LLM_PROVIDERS,
  STT_PROVIDERS,
  VOICE_PROVIDERS,
} from "../../config/voiceAgent.js";
import { createBusinessAgent } from "../../lib/agentBootstrap.js";
import { syncAgentToTelnyx } from "../../lib/telnyxAgentSync.js";

type VoiceId = string;

const CreateAgentSchema = z.object({
  name: z.string().min(1).optional(),
});

const UpdateAgentSchema = z.object({
  name: z.string().optional(),
  voice: z.string().optional(),
  voiceId: z.string().optional(),
  voiceProvider: z.enum(VOICE_PROVIDERS).optional(),
  voiceModel: z.string().optional(),
  language: z.string().optional(),
  systemPrompt: z.string().optional(),
  llmProvider: z.enum(LLM_PROVIDERS).optional(),
  llmModel: z.string().optional(),
  llmTemperature: z.number().min(0).max(2).optional(),
  sttProvider: z.enum(STT_PROVIDERS).optional(),
  sttModel: z.string().optional(),
  active: z.boolean().optional(),
  firstMessage: z.string().optional(),
  firstMessageMode: z
    .enum(["assistant-speaks-first", "assistant-waits-for-user"])
    .optional(),
  integrations: z.record(z.any()).optional(),
});

export async function agentsRoutes(fastify: FastifyInstance) {
  // Create agent
  fastify.post<{ Body: z.infer<typeof CreateAgentSchema> }>(
    "/agents",
    { preValidation: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = CreateAgentSchema.parse(request.body);
        const businessId = request.user!.businessId;

        const business = await prisma.business.findUnique({
          where: { id: businessId },
        });

        if (!business) {
          return reply.status(404).send({ error: "Negocio no encontrado" });
        }

        const agent = await createBusinessAgent({
          businessId: business.id,
          name: data.name || business.name,
        });

        return reply.status(201).send(agent);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: error.errors });
        }
        fastify.log.error({ err: error }, "[Agent] Failed to create agent");
        return reply.status(500).send({ error: "Failed to create agent" });
      }
    }
  );

  // Get agents for the authenticated business
  fastify.get(
    "/business/me/agents",
    { preValidation: [fastify.authenticate] },
    async (request: FastifyRequest, reply) => {
      try {
        const agents = await prisma.agent.findMany({
          where: {
            businessId: request.user!.businessId,
            deletedAt: null,
          },
        });
        return reply.send(agents);
      } catch (error) {
        fastify.log.error({ err: error }, "[Agent] Failed to fetch agents");
        return reply.status(500).send({ error: "Failed to fetch agents" });
      }
    }
  );

  // Get agent by ID
  fastify.get<{ Params: { id: string } }>(
    "/agents/:id",
    { preValidation: [fastify.authenticate] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      try {
        const agent = await prisma.agent.findFirst({
          where: {
            id: request.params.id,
            businessId: request.user!.businessId,
            deletedAt: null,
          },
          include: {
            calls: { take: 5, orderBy: { createdAt: "desc" } },
          },
        });

        if (!agent) {
          return reply
            .status(404)
            .send({ error: "Recepcionista no encontrada" });
        }

        return reply.send(agent);
      } catch (error) {
        fastify.log.error({ err: error }, "[Agent] Failed to fetch agent");
        return reply.status(500).send({ error: "Failed to fetch agent" });
      }
    }
  );

  // Update agent
  fastify.patch<{
    Params: { id: string };
    Body: z.infer<typeof UpdateAgentSchema>;
  }>(
    "/agents/:id",
    { preValidation: [fastify.authenticate] },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: z.infer<typeof UpdateAgentSchema>;
      }>,
      reply
    ) => {
      try {
        const data = UpdateAgentSchema.parse(request.body);
        const agent = await prisma.agent.findFirst({
          where: {
            id: request.params.id,
            businessId: request.user!.businessId,
            deletedAt: null,
          },
        });

        if (!agent) {
          return reply
            .status(404)
            .send({ error: "Recepcionista no encontrada" });
        }

        const agentWithConfig = agent as typeof agent & {
          voiceId?: string | null;
          voice?: string | null;
          voiceProvider?: string | null;
          voiceModel?: string | null;
          llmProvider?: string | null;
          llmModel?: string | null;
          llmTemperature?: number | null;
          sttProvider?: string | null;
          sttModel?: string | null;
          firstMessage?: string | null;
          firstMessageMode?: string | null;
        };

        const voiceId = (data.voiceId ||
          data.voice ||
          agentWithConfig.voiceId ||
          agentWithConfig.voice ||
          "538a8872-3799-4df5-b373-b78493b766c6") as VoiceId;
        const agentUpdateData = {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.voiceId !== undefined || data.voice !== undefined
            ? { voiceId }
            : {}),
          ...(data.voiceProvider !== undefined
            ? { voiceProvider: data.voiceProvider }
            : {}),
          ...(data.voiceModel !== undefined
            ? { voiceModel: data.voiceModel }
            : {}),
          ...(data.language !== undefined ? { language: data.language } : {}),
          ...(data.systemPrompt !== undefined
            ? // Marca este agente como editado a mano — syncAgentToTelnyx lo
              // usa para dejar de reconstruir y sobrescribir el prompt aquí
              // cuando cambien servicios/profesionales/ajustes del negocio
              // (hallazgo #27 de la auditoría: la propia función afirmaba
              // en su comentario que ya hacía esto, pero nunca estaba
              // implementado).
              { systemPrompt: data.systemPrompt, promptManuallyEdited: true }
            : {}),
          ...(data.llmProvider !== undefined
            ? { llmProvider: data.llmProvider }
            : {}),
          ...(data.llmModel !== undefined ? { llmModel: data.llmModel } : {}),
          ...(data.llmTemperature !== undefined
            ? { llmTemperature: data.llmTemperature }
            : {}),
          ...(data.sttProvider !== undefined
            ? { sttProvider: data.sttProvider }
            : {}),
          ...(data.sttModel !== undefined ? { sttModel: data.sttModel } : {}),
          ...(data.active !== undefined ? { active: data.active } : {}),
          ...(data.firstMessage !== undefined
            ? { firstMessage: data.firstMessage }
            : {}),
          ...(data.firstMessageMode !== undefined
            ? { firstMessageMode: data.firstMessageMode }
            : {}),
        };

        const updated = await prisma.agent.update({
          where: { id: request.params.id },
          data: agentUpdateData,
        });

        // El prompt editado a mano llega al assistant de Telnyx tal cual
        // (promptManuallyEdited). El nombre, el saludo y la voz del agente no
        // cambian el assistant: su saludo (con el aviso de IA) y su voz salen
        // de los ajustes del negocio. Hasta el 17-10 esta ruta solo
        // sincronizaba Retell, y el prompt esperaba al siguiente
        // syncAgentToTelnyx o al reconciliador. syncAgentToTelnyx nunca lanza.
        if (data.systemPrompt !== undefined) {
          await syncAgentToTelnyx(agent.businessId);
        }

        return reply.send(updated);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: error.errors });
        }
        fastify.log.error({ err: error }, "[Agent] Failed to update agent");
        return reply.status(500).send({ error: "Failed to update agent" });
      }
    }
  );

  // Retiramos el agente sin borrar llamadas ni la configuración remota. Así
  // se preserva la trazabilidad y las llamadas históricas siguen resolviendo
  // su agente original; el webhook entrante solo selecciona agentes activos.
  fastify.delete<{ Params: { id: string } }>(
    "/agents/:id",
    { preValidation: [fastify.authenticate] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      try {
        const agent = await prisma.agent.findFirst({
          where: {
            id: request.params.id,
            businessId: request.user!.businessId,
            deletedAt: null,
          },
        });

        if (!agent) {
          return reply
            .status(404)
            .send({ error: "Recepcionista no encontrada" });
        }

        await prisma.agent.update({
          where: { id: agent.id },
          data: { active: false, deletedAt: new Date() },
        });

        return reply.status(204).send();
      } catch (error) {
        fastify.log.error({ err: error }, "[Agent] Failed to delete agent");
        return reply.status(500).send({ error: "Failed to delete agent" });
      }
    }
  );
}
