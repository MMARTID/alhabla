import type { FastifyPluginAsync } from "fastify";
import {
  AltaDeTareaBody,
  CambioDeTareaBody,
  IdParams,
  TareaDescartadaBody,
  TareaHechaBody,
} from "./esquemas.js";
import { fichaDeAlhabla } from "./fichaDeAlhabla.js";
import {
  borrarTarea,
  crearTarea,
  descartarTarea,
  editarTarea,
  listarTareas,
  marcarTareaHecha,
  reabrirTarea,
} from "./servicioTareas.js";

/**
 * El panel útil: las tareas a mano del fundador y la Ficha de Alhabla. Cuelga
 * de `growthRoutes` (routes.ts): ya tiene `Cache-Control: no-store` y el
 * manejador de errores.
 *
 * Todo es del administrador (`autenticarAdminGrowth`, ID token de Google): un
 * token de agente no abre NINGUNA de estas rutas. Ni el agente ni el MCP leen
 * las tareas, y el backend no llama a ningún modelo ni hace peticiones
 * salientes a las URL que guarda.
 *
 * Los logs llevan ids, nunca títulos, URL ni notas.
 */
export const growthRoutesTareas: FastifyPluginAsync = async (fastify) => {
  const admin = { onRequest: fastify.autenticarAdminGrowth };

  fastify.get("/growth/admin/ficha-de-alhabla", admin, async () =>
    fichaDeAlhabla()
  );

  fastify.get("/growth/admin/tareas", admin, async () => listarTareas());

  fastify.post("/growth/admin/tareas", admin, async (request, reply) => {
    const body = AltaDeTareaBody.parse(request.body ?? {});
    const tarea = await crearTarea(body);
    request.log.info(
      { tareaId: tarea.id },
      "[Growth] Tarea a mano añadida por el administrador"
    );
    return reply.status(201).send(tarea);
  });

  fastify.patch("/growth/admin/tareas/:id", admin, async (request) => {
    const { id } = IdParams.parse(request.params);
    const body = CambioDeTareaBody.parse(request.body ?? {});
    return editarTarea(id, body);
  });

  fastify.post("/growth/admin/tareas/:id/hecha", admin, async (request) => {
    const { id } = IdParams.parse(request.params);
    const body = TareaHechaBody.parse(request.body ?? {});
    const tarea = await marcarTareaHecha(id, body);
    request.log.info(
      { tareaId: id, resultado: tarea.resultado },
      "[Growth] Tarea a mano marcada como hecha"
    );
    return tarea;
  });

  fastify.post("/growth/admin/tareas/:id/descartar", admin, async (request) => {
    const { id } = IdParams.parse(request.params);
    const body = TareaDescartadaBody.parse(request.body ?? {});
    const tarea = await descartarTarea(id, body);
    request.log.info({ tareaId: id }, "[Growth] Tarea a mano descartada");
    return tarea;
  });

  fastify.post("/growth/admin/tareas/:id/reabrir", admin, async (request) => {
    const { id } = IdParams.parse(request.params);
    const tarea = await reabrirTarea(id);
    request.log.info({ tareaId: id }, "[Growth] Tarea a mano reabierta");
    return tarea;
  });

  fastify.delete("/growth/admin/tareas/:id", admin, async (request, reply) => {
    const { id } = IdParams.parse(request.params);
    await borrarTarea(id);
    request.log.info({ tareaId: id }, "[Growth] Tarea a mano borrada");
    return reply.status(204).send();
  });
};
