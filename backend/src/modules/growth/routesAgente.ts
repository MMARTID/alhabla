import type { FastifyPluginAsync } from "fastify";
import {
  BorradorBody,
  ContextoQuery,
  EstadoBody,
  IdParams,
  InvestigacionBody,
  OportunidadBody,
} from "./esquemas.js";
import {
  crearBorrador,
  crearOportunidad,
  guardarInvestigacion,
  guardiaDePausa,
  transicionarComoAgente,
} from "./service.js";
import { contextoCompactoParaElAgente } from "./servicioAgente.js";

/**
 * Las rutas del agente sobre oportunidades. Toda escritura pasa por
 * `guardiaDePausa` (con la pausa activa responde 409 `pausa`). El agente no
 * aprueba nada: ni el estado `aprobada` se acepta.
 */
export const growthRoutesAgente: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/growth/agente/contexto",
    { onRequest: fastify.autenticarAgenteGrowth("leer") },
    async (request) => {
      // El contexto es siempre compacto: sin el texto de las afirmaciones, que
      // se leen aparte con GET /growth/agente/conocimiento. `sinAfirmaciones`
      // sigue aceptándose (se valida) por si un cliente antiguo lo manda.
      ContextoQuery.parse(request.query ?? {});
      return contextoCompactoParaElAgente();
    }
  );

  fastify.post(
    "/growth/agente/oportunidades",
    {
      onRequest: fastify.autenticarAgenteGrowth("escribir"),
      preHandler: guardiaDePausa,
    },
    async (request, reply) => {
      const body = OportunidadBody.parse(request.body ?? {});
      const resultado = await crearOportunidad(body);
      return reply.status(resultado.creada ? 201 : 200).send(resultado);
    }
  );

  fastify.post(
    "/growth/agente/oportunidades/:id/estado",
    {
      onRequest: fastify.autenticarAgenteGrowth("escribir"),
      preHandler: guardiaDePausa,
    },
    async (request) => {
      const { id } = IdParams.parse(request.params);
      const body = EstadoBody.parse(request.body ?? {});
      return transicionarComoAgente(id, body, request.growthAgente!);
    }
  );

  fastify.put(
    "/growth/agente/oportunidades/:id/investigacion",
    {
      onRequest: fastify.autenticarAgenteGrowth("escribir"),
      preHandler: guardiaDePausa,
    },
    async (request) => {
      const { id } = IdParams.parse(request.params);
      const body = InvestigacionBody.parse(request.body ?? {});
      return guardarInvestigacion(id, body);
    }
  );

  fastify.post(
    "/growth/agente/oportunidades/:id/borradores",
    {
      onRequest: fastify.autenticarAgenteGrowth("escribir"),
      preHandler: guardiaDePausa,
    },
    async (request, reply) => {
      const { id } = IdParams.parse(request.params);
      const body = BorradorBody.parse(request.body ?? {});
      const resultado = await crearBorrador(id, body, request.growthAgente!);
      // 201 aunque quede bloqueado: el borrador existe, con su motivo.
      return reply.status(201).send(resultado);
    }
  );
};
