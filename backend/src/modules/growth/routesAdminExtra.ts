import type { FastifyPluginAsync } from "fastify";
import { guardarAjustes, leerAjustesParaElAdministrador } from "./ajustes.js";
import { detalleDeEjecucion, listarEjecuciones } from "./ejecuciones.js";
import {
  AjustesPutBody,
  ClaveParams,
  ConocimientoDelAdministradorQuery,
  IdParams,
  ListadoDeBorradoresQuery,
  ListadoDeDecisionesQuery,
  ListadoDeEjecucionesQuery,
  ListadoDeGestionesQuery,
  OportunidadManualBody,
  PatchBorradorBody,
} from "./esquemas.js";
import { crearOportunidadManual } from "./service.js";
import {
  conocimientoParaElAdministrador,
  detalleDeBorrador,
  editarBorrador,
  historialDeAfirmacion,
  listarBorradores,
  listarDecisiones,
  listarGestiones,
  resumenDelAdministrador,
} from "./servicioAdmin.js";

/**
 * Rutas de administración que completan a `routesAdmin.ts` (Bandeja y
 * Revisión): sesión, resumen, alta manual de URL, borradores, historial,
 * conocimiento, ejecuciones y ajustes.
 *
 * Cuelga de `growthRoutes` (routes.ts): ya tiene `Cache-Control: no-store` y
 * el manejador de errores. Todas pasan por `autenticarAdminGrowth`: el
 * administrador es el único que ve el correo de quien decidió.
 */
export const growthRoutesAdminExtra: FastifyPluginAsync = async (fastify) => {
  const admin = { onRequest: fastify.autenticarAdminGrowth };

  // ── Sesión y resumen ───────────────────────────────────────────────────

  // El dashboard lo llama justo tras iniciar sesión con Google para saber si
  // la sesión vale (401), si el correo no tiene permiso (403) o si Growth no
  // está configurado (503) antes de pintar nada.
  fastify.get("/growth/admin/yo", admin, async (request) => ({
    email: request.growthAdmin!.email,
  }));

  fastify.get("/growth/admin/resumen", admin, async () =>
    resumenDelAdministrador()
  );

  // ── Añadir una URL a mano ──────────────────────────────────────────────

  fastify.post("/growth/admin/oportunidades", admin, async (request, reply) => {
    const body = OportunidadManualBody.parse(request.body ?? {});
    const resultado = await crearOportunidadManual(
      body,
      request.growthAdmin!.email
    );
    return reply.status(resultado.creada ? 201 : 200).send(resultado);
  });

  // ── Borradores ─────────────────────────────────────────────────────────

  fastify.get("/growth/admin/borradores", admin, async (request) =>
    listarBorradores(ListadoDeBorradoresQuery.parse(request.query ?? {}))
  );

  fastify.get("/growth/admin/borradores/:id", admin, async (request) => {
    const { id } = IdParams.parse(request.params);
    return detalleDeBorrador(id);
  });

  fastify.patch("/growth/admin/borradores/:id", admin, async (request) => {
    const { id } = IdParams.parse(request.params);
    const body = PatchBorradorBody.parse(request.body ?? {});
    return editarBorrador(id, body, request.growthAdmin!.email);
  });

  // ── Historial ──────────────────────────────────────────────────────────

  fastify.get("/growth/admin/decisiones", admin, async (request) =>
    listarDecisiones(ListadoDeDecisionesQuery.parse(request.query ?? {}))
  );

  fastify.get("/growth/admin/gestiones", admin, async (request) =>
    listarGestiones(ListadoDeGestionesQuery.parse(request.query ?? {}))
  );

  // ── Conocimiento ───────────────────────────────────────────────────────

  fastify.get("/growth/admin/conocimiento", admin, async (request) =>
    conocimientoParaElAdministrador(
      ConocimientoDelAdministradorQuery.parse(request.query ?? {})
    )
  );

  fastify.get(
    "/growth/admin/conocimiento/:clave/historial",
    admin,
    async (request) => {
      const { clave } = ClaveParams.parse(request.params);
      return historialDeAfirmacion(clave);
    }
  );

  // ── Ejecuciones ────────────────────────────────────────────────────────

  fastify.get("/growth/admin/ejecuciones", admin, async (request) =>
    listarEjecuciones(ListadoDeEjecucionesQuery.parse(request.query ?? {}))
  );

  fastify.get("/growth/admin/ejecuciones/:id", admin, async (request) => {
    const { id } = IdParams.parse(request.params);
    return detalleDeEjecucion(id);
  });

  // ── Ajustes ────────────────────────────────────────────────────────────

  fastify.get("/growth/admin/ajustes", admin, async () =>
    leerAjustesParaElAdministrador()
  );

  fastify.put("/growth/admin/ajustes", admin, async (request) => {
    const body = AjustesPutBody.parse(request.body ?? {});
    return guardarAjustes(body, request.growthAdmin!.email);
  });

  // Los competidores (listar, alta por URL, edición, baja y el ciclo de
  // análisis) viven en routesCompetencia.ts.
};
