import type { FastifyPluginAsync } from "fastify";
import {
  DecisionBody,
  IdParams,
  ListadoDeOportunidadesQuery,
} from "./esquemas.js";
import {
  decidir,
  detalleDeOportunidad,
  listarOportunidades,
} from "./service.js";

/**
 * Las rutas del administrador sobre oportunidades: la Bandeja (listado), la
 * Revisión (detalle) y las decisiones. Cuelgan de `growthRoutes`, que ya
 * pone `Cache-Control: no-store` y el formato de error.
 */
export const growthRoutesAdmin: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/growth/admin/oportunidades",
    { onRequest: fastify.autenticarAdminGrowth },
    async (request) => {
      const query = ListadoDeOportunidadesQuery.parse(request.query ?? {});
      return listarOportunidades(query);
    }
  );

  fastify.get(
    "/growth/admin/oportunidades/:id",
    { onRequest: fastify.autenticarAdminGrowth },
    async (request) => {
      const { id } = IdParams.parse(request.params);
      return detalleDeOportunidad(id);
    }
  );

  fastify.post(
    "/growth/admin/oportunidades/:id/decision",
    { onRequest: fastify.autenticarAdminGrowth },
    async (request) => {
      const { id } = IdParams.parse(request.params);
      const decision = DecisionBody.parse(request.body ?? {});
      return decidir(id, decision, request.growthAdmin!.email);
    }
  );
};
