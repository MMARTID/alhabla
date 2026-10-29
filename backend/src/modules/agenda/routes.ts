import { randomBytes } from "node:crypto";
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { getPublicWebhookBaseUrl } from "../../lib/serverUrl.js";
import { construirFeedIcs } from "../../lib/feedIcal.js";
import { listarAusencias } from "../bookings/ausencias.js";

/**
 * Feed iCal de solo lectura de la agenda (PLAN-AGENDA-ALHABLA.md, fase 3).
 *
 * `GET /agenda/:token.ics` es público: lo descargan Apple Calendar y Google
 * Calendar sin ninguna sesión, así que el negocio se busca SOLO por el token
 * (32 bytes aleatorios, índice único), nunca por un id en la URL. Las rutas
 * de `/business/me/agenda/feed` crean, renuevan y desactivan ese token desde
 * el panel. El token no viaja en el Business serializado: solo aquí.
 */

const DIAS_ATRAS = 30;
const DIAS_ADELANTE = 120;
const MAX_CITAS = 2000;

// Un calendario suscrito refresca cada pocos minutos como mucho; 30 por
// minuto deja margen a varios dispositivos y corta un barrido de tokens.
const LIMITE_DEL_FEED = { max: 30, timeWindow: "1 minute" };

const FeedParamsSchema = z.object({
  token: z.string().regex(/^[0-9a-f]{64}$/),
});
const FeedQuerySchema = z.object({
  pro: z.string().trim().min(1).max(80).optional(),
});
const ActivarBodySchema = z
  .object({ renovar: z.boolean().optional() })
  .optional();

function nuevoToken(): string {
  return randomBytes(32).toString("hex");
}

/** Enlaces del feed para el panel: https para copiar y webcal para que el
 * iPhone abra directamente «Suscribirse». Sin BASE_URL (tests) van a null. */
export function enlacesDelFeed(token: string | null) {
  const base = getPublicWebhookBaseUrl();
  if (!token || !base) return { activo: Boolean(token), url: null, webcal: null };
  const url = `${base.replace(/\/$/, "")}/agenda/${token}.ics`;
  return { activo: true, url, webcal: url.replace(/^https?:\/\//, "webcal://") };
}

export async function agendaFeedRoutes(fastify: FastifyInstance) {
  fastify.get<{
    Params: z.infer<typeof FeedParamsSchema>;
    Querystring: z.infer<typeof FeedQuerySchema>;
  }>(
    "/agenda/:token.ics",
    { config: { rateLimit: LIMITE_DEL_FEED } },
    async (request, reply) => {
      const params = FeedParamsSchema.safeParse(request.params);
      const query = FeedQuerySchema.safeParse(request.query);
      // Mismo 404 para un token mal formado y para uno que no existe: a quien
      // prueba tokens no se le dice nada.
      if (!params.success || !query.success) {
        return reply.status(404).send({ error: "No encontrado" });
      }
      const business = await prisma.business.findUnique({
        where: { icalToken: params.data.token },
        select: { id: true, name: true },
      });
      if (!business) {
        return reply.status(404).send({ error: "No encontrado" });
      }

      const ahora = new Date();
      const desde = new Date(ahora.getTime() - DIAS_ATRAS * 24 * 60 * 60_000);
      const hasta = new Date(ahora.getTime() + DIAS_ADELANTE * 24 * 60 * 60_000);
      // `?pro=` filtrado también por negocio: el id de un profesional de otro
      // negocio devuelve el feed vacío, nunca sus citas.
      const profesional = query.data.pro
        ? await prisma.professional.findFirst({
            where: { id: query.data.pro, businessId: business.id },
            select: { id: true },
          })
        : null;
      if (query.data.pro && !profesional) {
        reply.header("Content-Type", "text/calendar; charset=utf-8");
        return reply.send(
          construirFeedIcs({ nombreDelNegocio: business.name, citas: [], ausencias: [], ahora })
        );
      }

      const filas = await prisma.booking.findMany({
        where: {
          call: { businessId: business.id },
          programedAt: { gte: desde, lt: hasta },
          ...(profesional ? { professionalId: profesional.id } : {}),
          // Las canceladas solo si se cancelaron hace poco: así el calendario
          // suscrito las retira, y las antiguas no engordan el feed.
          OR: [{ isCancelled: false }, { cancelledAt: { gte: desde } }],
        },
        orderBy: { programedAt: "asc" },
        take: MAX_CITAS,
        select: {
          id: true,
          programedAt: true,
          durationMinutes: true,
          clientName: true,
          serviceIds: true,
          isCancelled: true,
          cancelledAt: true,
          createdAt: true,
          professional: { select: { name: true } },
        },
      });
      const serviceIds = [...new Set(filas.flatMap((fila) => fila.serviceIds))];
      const servicios = serviceIds.length
        ? await prisma.service.findMany({
            where: { id: { in: serviceIds }, businessId: business.id },
            select: { id: true, name: true },
          })
        : [];
      const nombreDeServicio = new Map(servicios.map((s) => [s.id, s.name]));
      const ausencias = await listarAusencias(business.id, {
        desde,
        hasta,
        profesionalId: profesional?.id,
      });

      const ics = construirFeedIcs({
        nombreDelNegocio: business.name,
        ahora,
        citas: filas.map((fila) => ({
          id: fila.id,
          programedAt: fila.programedAt,
          durationMinutes: fila.durationMinutes,
          clientName: fila.clientName,
          serviceNames: fila.serviceIds
            .map((id) => nombreDeServicio.get(id))
            .filter((nombre): nombre is string => Boolean(nombre)),
          professionalName: fila.professional?.name ?? null,
          isCancelled: fila.isCancelled,
          updatedAt: fila.cancelledAt ?? fila.createdAt,
        })),
        ausencias: ausencias.map((a) => ({
          id: a.id,
          professionalName: a.professionalName,
          startsAt: new Date(a.startsAt),
          endsAt: new Date(a.endsAt),
          reason: a.reason,
        })),
      });

      reply.header("Content-Type", "text/calendar; charset=utf-8");
      reply.header("Content-Disposition", 'inline; filename="agenda-alhabla.ics"');
      reply.header("Cache-Control", "private, max-age=300");
      reply.header("X-Robots-Tag", "noindex, nofollow");
      return reply.send(ics);
    }
  );

  fastify.get(
    "/business/me/agenda/feed",
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      const business = await prisma.business.findUnique({
        where: { id: request.user!.businessId },
        select: { icalToken: true },
      });
      return reply.send(enlacesDelFeed(business?.icalToken ?? null));
    }
  );

  // Activar (crea el token si no lo hay) o renovar (`renovar: true`: el
  // enlace anterior deja de valer, por si se compartió donde no debía).
  fastify.post<{ Body: z.infer<typeof ActivarBodySchema> }>(
    "/business/me/agenda/feed",
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const body = ActivarBodySchema.parse(request.body ?? undefined);
        const businessId = request.user!.businessId;
        const actual = await prisma.business.findUnique({
          where: { id: businessId },
          select: { icalToken: true },
        });
        const token =
          actual?.icalToken && !body?.renovar ? actual.icalToken : nuevoToken();
        if (token !== actual?.icalToken) {
          await prisma.business.update({
            where: { id: businessId },
            data: { icalToken: token },
          });
          fastify.log.info(
            `[Agenda] Feed iCal ${actual?.icalToken ? "renovado" : "activado"} para el negocio ${businessId}`
          );
        }
        return reply.send(enlacesDelFeed(token));
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: error.errors });
        }
        fastify.log.error({ err: error }, "[Agenda] No se pudo activar el feed iCal");
        return reply.status(500).send({ error: "No se pudo activar el enlace" });
      }
    }
  );

  fastify.delete(
    "/business/me/agenda/feed",
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      const businessId = request.user!.businessId;
      await prisma.business.update({
        where: { id: businessId },
        data: { icalToken: null },
      });
      fastify.log.info(`[Agenda] Feed iCal desactivado para el negocio ${businessId}`);
      return reply.send(enlacesDelFeed(null));
    }
  );
}
