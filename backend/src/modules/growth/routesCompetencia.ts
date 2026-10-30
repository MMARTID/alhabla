import type { FastifyPluginAsync } from "fastify";
import {
  AltaDeCompetidorBody,
  AnalisisDeCompetidorBody,
  AnalisisDeCompetidorParams,
  CambioDeCompetidorBody,
  IdParams,
  PropuestaDeCompetidorBody,
  RevisionDeAnalisisBody,
} from "./esquemas.js";
import { guardiaDePausa } from "./service.js";
import {
  aceptarCompetidor,
  darDeAltaUnCompetidor,
  detalleDeAnalisis,
  detalleDeCompetidor,
  editarCompetidor,
  listarCompetidores,
  quitarCompetidor,
  reanalizarCompetidor,
  revisarAnalisis,
} from "./servicioCompetenciaAdmin.js";
import {
  guardarAnalisisDeCompetidor,
  listarCompetidoresParaElAgente,
  proponerCompetidor,
} from "./servicioCompetenciaAgente.js";

/**
 * La competencia (Fase 2a). Cuelga de `growthRoutes` (routes.ts): ya tiene
 * `Cache-Control: no-store` y el manejador de errores.
 *
 * - `/growth/admin/competidores/*`: el administrador da de alta por URL,
 *   edita, quita, acepta lo que propone el agente, pide volver a analizar y
 *   revisa. Pasa por `autenticarAdminGrowth` (ID token de Google): un token de
 *   agente no abre NINGUNA de estas rutas, así que el agente no puede
 *   aceptar, quitar ni revisar.
 * - `/growth/agente/competidores/*`: el agente lee la lista, propone y guarda
 *   análisis. Escribir pasa por `guardiaDePausa`.
 *
 * Los logs llevan ids y dominios, nunca el texto de un análisis ni las notas
 * (texto de terceros).
 */
export const growthRoutesCompetencia: FastifyPluginAsync = async (fastify) => {
  const admin = { onRequest: fastify.autenticarAdminGrowth };
  const leer = { onRequest: fastify.autenticarAgenteGrowth("leer") };
  const escribir = {
    onRequest: fastify.autenticarAgenteGrowth("escribir"),
    preHandler: guardiaDePausa,
  };

  // ── Administrador ──────────────────────────────────────────────────────

  fastify.get("/growth/admin/competidores", admin, async () =>
    listarCompetidores()
  );

  fastify.post("/growth/admin/competidores", admin, async (request, reply) => {
    const body = AltaDeCompetidorBody.parse(request.body ?? {});
    const competidor = await darDeAltaUnCompetidor(body);
    request.log.info(
      { competidorId: competidor.id, dominio: competidor.dominio },
      "[Growth] Competidor dado de alta por el administrador"
    );
    return reply.status(201).send(competidor);
  });

  fastify.get("/growth/admin/competidores/:id", admin, async (request) => {
    const { id } = IdParams.parse(request.params);
    return detalleDeCompetidor(id);
  });

  fastify.patch("/growth/admin/competidores/:id", admin, async (request) => {
    const { id } = IdParams.parse(request.params);
    const body = CambioDeCompetidorBody.parse(request.body ?? {});
    return editarCompetidor(id, body);
  });

  fastify.delete(
    "/growth/admin/competidores/:id",
    admin,
    async (request, reply) => {
      const { id } = IdParams.parse(request.params);
      await quitarCompetidor(id);
      request.log.info(
        { competidorId: id },
        "[Growth] Competidor quitado por el administrador"
      );
      return reply.status(204).send();
    }
  );

  fastify.post(
    "/growth/admin/competidores/:id/aceptar",
    admin,
    async (request) => {
      const { id } = IdParams.parse(request.params);
      const competidor = await aceptarCompetidor(id);
      request.log.info(
        { competidorId: id, dominio: competidor.dominio },
        "[Growth] Competidor propuesto aceptado: desde ahora aplica reglas duras"
      );
      return competidor;
    }
  );

  fastify.post(
    "/growth/admin/competidores/:id/reanalizar",
    admin,
    async (request) => {
      const { id } = IdParams.parse(request.params);
      return reanalizarCompetidor(id);
    }
  );

  fastify.get(
    "/growth/admin/competidores/:id/analisis/:analisisId",
    admin,
    async (request) => {
      const { id, analisisId } = AnalisisDeCompetidorParams.parse(
        request.params
      );
      return detalleDeAnalisis(id, analisisId);
    }
  );

  fastify.post(
    "/growth/admin/competidores/:id/analisis/:analisisId/revisar",
    admin,
    async (request) => {
      const { id, analisisId } = AnalisisDeCompetidorParams.parse(
        request.params
      );
      const body = RevisionDeAnalisisBody.parse(request.body ?? {});
      return revisarAnalisis(id, analisisId, body);
    }
  );

  // ── Agente ─────────────────────────────────────────────────────────────

  fastify.get("/growth/agente/competidores", leer, async () =>
    listarCompetidoresParaElAgente()
  );

  fastify.post(
    "/growth/agente/competidores",
    escribir,
    async (request, reply) => {
      const body = PropuestaDeCompetidorBody.parse(request.body ?? {});
      const resultado = await proponerCompetidor(body);
      if (resultado.creado) {
        request.log.info(
          { competidorId: resultado.id, agente: request.growthAgente?.nombre },
          "[Growth] El agente propone un competidor"
        );
        return reply.status(201).send({
          id: resultado.id,
          estado: resultado.estado,
          existente: false,
        });
      }
      return reply
        .status(200)
        .send({ id: resultado.id, estado: resultado.estado, existente: true });
    }
  );

  fastify.post(
    "/growth/agente/competidores/:id/analisis",
    escribir,
    async (request, reply) => {
      const { id } = IdParams.parse(request.params);
      const body = AnalisisDeCompetidorBody.parse(request.body ?? {});
      const resultado = await guardarAnalisisDeCompetidor(
        id,
        body,
        request.growthAgente!
      );
      request.log.info(
        {
          competidorId: id,
          version: resultado.version,
          agente: request.growthAgente?.nombre,
        },
        "[Growth] El agente guarda un análisis de competidor"
      );
      return reply.status(201).send(resultado);
    }
  );
};
