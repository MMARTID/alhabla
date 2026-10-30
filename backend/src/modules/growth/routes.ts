import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { z } from "zod";
import growthAuthPlugin from "../../plugins/growthAuth.js";
import {
  ErrorDeGrowth,
  contextoParaElAgente,
  crearBorrador,
  crearOportunidad,
  decidir,
  detalleDeOportunidad,
  guardarInvestigacion,
  listarOportunidades,
  transicionarComoAgente,
} from "./service.js";

const OBJETIVOS = ["TRAFICO_MARCA", "LEADS", "BACKLINKS"] as const;
const ESTADOS = [
  "detectada",
  "calificada",
  "investigada",
  "con_borrador",
  "pendiente_aprobacion",
  "aprobada",
  "gestionada",
  "conseguida",
  "sin_respuesta",
  "devuelta",
  "bloqueada",
  "descartada",
  "caducada",
] as const;

const puntuacion = z.number().int().min(0).max(100);
const json = z.record(z.unknown());

const OportunidadBody = z.object({
  fuenteId: z.string().min(1),
  nichoId: z.string().min(1).optional(),
  url: z.string().url().max(2000),
  titulo: z.string().trim().min(1).max(300),
  extracto: z.string().trim().min(1).max(2000),
  idioma: z.string().min(2).max(10).optional(),
  objetivoPrincipal: z.enum(OBJETIVOS),
  puntTrafico: puntuacion.optional(),
  puntLeads: puntuacion.optional(),
  puntBacklinks: puntuacion.optional(),
  datos: json.optional(),
  expiraEn: z.coerce.date().optional(),
  ejecucionId: z.string().min(1).optional(),
});

const EstadoBody = z.object({
  // El resto de cambios los hace el backend (al evaluar un borrador) o el
  // administrador: el agente no aprueba nada.
  a: z.enum(["calificada", "investigada", "descartada"]),
  motivo: z.string().trim().min(1).max(500).optional(),
});

const InvestigacionBody = z.object({
  resumen: z.string().trim().min(1).max(8000),
  quienEdita: z.string().trim().max(300).optional(),
  viaDeContacto: z
    .enum(["formulario", "email_editorial", "alta_directorio"])
    .optional(),
  competidoresEnlazados: z.array(z.string().max(200)).max(50).optional(),
  contexto: json.optional(),
});

const BorradorBody = z.object({
  tipo: z.enum(["email", "formulario", "ficha_directorio", "texto_invitado"]),
  asunto: z.string().trim().max(300).optional(),
  texto: z.string().trim().min(1).max(10000),
  enlaceUrl: z.string().url().max(2000).optional(),
  utm: json.optional(),
  afirmaciones: z.array(z.string().min(1).max(200)).max(50).default([]),
});

const ListadoQuery = z.object({
  estado: z.enum(ESTADOS).optional(),
  objetivo: z.enum(OBJETIVOS).optional(),
  limite: z.coerce.number().int().min(1).max(200).default(50),
});

const DecisionBody = z.discriminatedUnion("accion", [
  z.object({ accion: z.literal("aprobar"), borradorId: z.string().min(1) }),
  z.object({
    accion: z.literal("devolver"),
    motivo: z.string().trim().min(1).max(500),
  }),
  z.object({
    accion: z.literal("descartar"),
    motivo: z.string().trim().min(1).max(500),
  }),
  z.object({
    accion: z.literal("marcar_gestionado"),
    canal: z.enum(["email", "formulario", "alta_directorio", "otro"]),
    hechaEn: z.coerce.date().optional(),
    notas: z.string().trim().max(1000).optional(),
  }),
  z.object({
    accion: z.literal("conseguido"),
    urlConseguida: z.string().url().max(2000),
  }),
  z.object({
    accion: z.literal("sin_respuesta"),
    notas: z.string().trim().max(1000).optional(),
  }),
]);

const IdParams = z.object({ id: z.string().min(1) });

function responderError(reply: FastifyReply, error: unknown) {
  if (error instanceof ErrorDeGrowth) {
    return reply.status(error.status).send({ error: error.message });
  }
  throw error;
}

/**
 * Alhabla Growth (PLAN-GROWTH.md). Sin `businessId`: no es de ningún negocio.
 *
 * - `/growth/agente/*`: la sesión programada, con token de agente. Escribe
 *   oportunidades, investigaciones y borradores; no aprueba nada.
 * - `/growth/admin/*`: el fundador, con su sesión de Google. Aprueba,
 *   devuelve, descarta y registra lo que hace a mano.
 */
export const growthRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(growthAuthPlugin);

  // ── Agente ────────────────────────────────────────────────────────────

  fastify.get(
    "/growth/agente/contexto",
    { onRequest: fastify.autenticarAgenteGrowth("leer") },
    async () => contextoParaElAgente()
  );

  fastify.post(
    "/growth/agente/oportunidades",
    { onRequest: fastify.autenticarAgenteGrowth("escribir") },
    async (request, reply) => {
      const parsed = OportunidadBody.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.errors });
      }
      try {
        const resultado = await crearOportunidad({
          ...parsed.data,
          datos: parsed.data.datos as never,
        });
        return reply.status(resultado.creada ? 201 : 200).send(resultado);
      } catch (error) {
        return responderError(reply, error);
      }
    }
  );

  fastify.post(
    "/growth/agente/oportunidades/:id/estado",
    { onRequest: fastify.autenticarAgenteGrowth("escribir") },
    async (request, reply) => {
      const params = IdParams.safeParse(request.params);
      const body = EstadoBody.safeParse(request.body ?? {});
      if (!params.success || !body.success) {
        return reply.status(400).send({
          error: [
            ...(params.success ? [] : params.error.errors),
            ...(body.success ? [] : body.error.errors),
          ],
        });
      }
      try {
        return await transicionarComoAgente(
          params.data.id,
          body.data.a,
          body.data.motivo
        );
      } catch (error) {
        return responderError(reply, error);
      }
    }
  );

  fastify.put(
    "/growth/agente/oportunidades/:id/investigacion",
    { onRequest: fastify.autenticarAgenteGrowth("escribir") },
    async (request, reply) => {
      const params = IdParams.safeParse(request.params);
      const body = InvestigacionBody.safeParse(request.body ?? {});
      if (!params.success || !body.success) {
        return reply.status(400).send({
          error: [
            ...(params.success ? [] : params.error.errors),
            ...(body.success ? [] : body.error.errors),
          ],
        });
      }
      try {
        return await guardarInvestigacion(params.data.id, {
          ...body.data,
          competidoresEnlazados: body.data.competidoresEnlazados,
          contexto: body.data.contexto as never,
        });
      } catch (error) {
        return responderError(reply, error);
      }
    }
  );

  fastify.post(
    "/growth/agente/oportunidades/:id/borradores",
    { onRequest: fastify.autenticarAgenteGrowth("escribir") },
    async (request, reply) => {
      const params = IdParams.safeParse(request.params);
      const body = BorradorBody.safeParse(request.body ?? {});
      if (!params.success || !body.success) {
        return reply.status(400).send({
          error: [
            ...(params.success ? [] : params.error.errors),
            ...(body.success ? [] : body.error.errors),
          ],
        });
      }
      try {
        const resultado = await crearBorrador(params.data.id, {
          ...body.data,
          utm: body.data.utm as never,
        });
        // 201 aunque quede bloqueado: el borrador existe, con su motivo.
        return reply.status(201).send(resultado);
      } catch (error) {
        return responderError(reply, error);
      }
    }
  );

  // ── Administrador ─────────────────────────────────────────────────────

  fastify.get(
    "/growth/admin/oportunidades",
    { onRequest: fastify.autenticarAdminGrowth },
    async (request, reply) => {
      const query = ListadoQuery.safeParse(request.query ?? {});
      if (!query.success) {
        return reply.status(400).send({ error: query.error.errors });
      }
      return listarOportunidades(query.data);
    }
  );

  fastify.get(
    "/growth/admin/oportunidades/:id",
    { onRequest: fastify.autenticarAdminGrowth },
    async (request, reply) => {
      const params = IdParams.safeParse(request.params);
      if (!params.success) {
        return reply.status(400).send({ error: params.error.errors });
      }
      try {
        return await detalleDeOportunidad(params.data.id);
      } catch (error) {
        return responderError(reply, error);
      }
    }
  );

  fastify.post(
    "/growth/admin/oportunidades/:id/decision",
    { onRequest: fastify.autenticarAdminGrowth },
    async (request, reply) => {
      const params = IdParams.safeParse(request.params);
      const body = DecisionBody.safeParse(request.body ?? {});
      if (!params.success || !body.success) {
        return reply.status(400).send({
          error: [
            ...(params.success ? [] : params.error.errors),
            ...(body.success ? [] : body.error.errors),
          ],
        });
      }
      try {
        return await decidir(
          params.data.id,
          body.data,
          request.growthAdmin!.email
        );
      } catch (error) {
        return responderError(reply, error);
      }
    }
  );
};
