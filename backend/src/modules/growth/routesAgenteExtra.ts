import type { FastifyPluginAsync } from "fastify";
import {
  AbrirEjecucionBody,
  CerrarEjecucionBody,
  EvaluarBorradorBody,
  IdParams,
  ListadoDeOportunidadesDelAgenteQuery,
  RevisionLlmBody,
} from "./esquemas.js";
import { abrirEjecucion, cerrarEjecucion } from "./ejecuciones.js";
import { guardiaDePausa } from "./service.js";
import {
  CalificacionRutaBody,
  calificarOportunidad,
  evaluarBorradorSinGuardar,
  listarOportunidadesDelAgente,
  registrarRevisionDelModelo,
  verOportunidadDelAgente,
} from "./servicioAgente.js";

/**
 * Rutas del agente que completan a `routesAgente.ts`: listar y ver
 * oportunidades, calificar, evaluar un borrador, la revisión del modelo y
 * las ejecuciones.
 *
 * Cada escritura lleva `preHandler: guardiaDePausa` (con la pausa activa
 * responde 409 `pausa`), salvo cerrar una ejecución, que sigue permitida.
 * Evaluar un borrador no escribe, así que tampoco se detiene en pausa.
 *
 * El agente no aprueba nada: ninguna de estas rutas cambia una oportunidad a
 * `aprobada` ni toca la decisión del fundador.
 */
export const growthRoutesAgenteExtra: FastifyPluginAsync = async (fastify) => {
  const leer = { onRequest: fastify.autenticarAgenteGrowth("leer") };
  const escribir = {
    onRequest: fastify.autenticarAgenteGrowth("escribir"),
    preHandler: guardiaDePausa,
  };

  // ── Lecturas ───────────────────────────────────────────────────────────

  // GET /growth/agente/conocimiento NO se registra aquí: lo registra
  // routesConocimiento.ts (el sincronizador). Registrarlo en los dos sitios es
  // un error de arranque («Method 'GET' already declared»).

  fastify.get("/growth/agente/oportunidades", leer, async (request) =>
    listarOportunidadesDelAgente(
      ListadoDeOportunidadesDelAgenteQuery.parse(request.query ?? {})
    )
  );

  fastify.get("/growth/agente/oportunidades/:id", leer, async (request) => {
    const { id } = IdParams.parse(request.params);
    return verOportunidadDelAgente(id);
  });

  // ── Calificar ──────────────────────────────────────────────────────────

  fastify.post(
    "/growth/agente/oportunidades/:id/calificacion",
    escribir,
    async (request) => {
      const { id } = IdParams.parse(request.params);
      const body = CalificacionRutaBody.parse(request.body ?? {});
      return calificarOportunidad(id, body, request.growthAgente!);
    }
  );

  // ── Borradores: evaluar sin guardar y revisión del modelo ──────────────

  // Alcance `leer` y sin guardia de pausa: no escribe nada.
  fastify.post("/growth/agente/borradores/evaluar", leer, async (request) => {
    const body = EvaluarBorradorBody.parse(request.body ?? {});
    return evaluarBorradorSinGuardar(body);
  });

  fastify.post(
    "/growth/agente/borradores/:id/revision",
    escribir,
    async (request, reply) => {
      const { id } = IdParams.parse(request.params);
      const body = RevisionLlmBody.parse(request.body ?? {});
      const resultado = await registrarRevisionDelModelo(id, body);
      return reply.status(201).send(resultado);
    }
  );

  // ── Ejecuciones ────────────────────────────────────────────────────────

  fastify.post(
    "/growth/agente/ejecuciones",
    escribir,
    async (request, reply) => {
      const body = AbrirEjecucionBody.parse(request.body ?? {});
      const ejecucion = await abrirEjecucion(body);
      // 200 si era la misma apertura que otra de hace unos segundos (un
      // reintento o dos sesiones a la vez): no se creó nada.
      return reply.status(ejecucion.reutilizada ? 200 : 201).send(ejecucion);
    }
  );

  // Cerrar sigue permitido con la pausa activa: una ejecución abierta tiene
  // que poder acabar.
  fastify.post(
    "/growth/agente/ejecuciones/:id/cierre",
    { onRequest: fastify.autenticarAgenteGrowth("escribir") },
    async (request) => {
      const { id } = IdParams.parse(request.params);
      const body = CerrarEjecucionBody.parse(request.body ?? {});
      return cerrarEjecucion(id, body);
    }
  );
};
