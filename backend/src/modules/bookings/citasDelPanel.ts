import { randomUUID } from "node:crypto";
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { cancelarReserva } from "./cancelacion.js";
import {
  ACCIONES_DE_AGENDA,
  MOTIVO_CALENDARIO_ILEGIBLE,
  MOTIVO_SIN_CALENDARIO,
  PREFIJO_DE_CALL_DEL_GESTOR,
  instanteLocal,
  moverReserva,
  type FalloAlMover,
} from "../gestor/accionesAgenda.js";
import { formatearCita } from "../whatsapp/avisosNegocio.js";

/**
 * Mover, cancelar y avisar al cliente desde la agenda del panel. Son las
 * mismas operaciones que el dueño hace con el Gestor (mover_cita,
 * cancelar_cita, avisar_cliente): hueco real bajo el candado de la agenda,
 * calendario externo al día y lista de espera avisada al liberar un hueco.
 * Cambian las palabras: el Gestor habla en primera persona y a veces le
 * habla al modelo; aquí el resultado lo lee el dueño en un aviso del panel.
 */

const CitaParamsSchema = z.object({ id: z.string().trim().min(1).max(80) });

const MoverBodySchema = z.object({
  // Hora de pared en la zona del negocio, como la pinta la agenda.
  fechaHora: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/,
      'Fecha y hora en formato "AAAA-MM-DDTHH:MM"'
    ),
  profesionalId: z.string().trim().min(1).max(80).optional(),
  // Solo comprueba el hueco (al soltar la cita en la cuadrícula, antes de
  // pedir confirmación). No toca nada.
  soloComprobar: z.boolean().optional(),
});

const AvisarBodySchema = z.object({
  tipo: z.enum(["cambio", "cancelacion"]),
});

const TEXTO_SIN_CALENDARIO =
  "Para apuntar o mover citas desde aquí, elige la agenda de Alhabla o conecta tu calendario.";
const TEXTO_CALENDARIO_ILEGIBLE =
  "Ahora mismo no se puede leer tu calendario. Inténtalo en un rato.";

/** Los motivos del Gestor que no sirven tal cual en el panel. */
function enPalabrasDelPanel(motivo: string): string {
  if (motivo === MOTIVO_SIN_CALENDARIO) return TEXTO_SIN_CALENDARIO;
  if (motivo === MOTIVO_CALENDARIO_ILEGIBLE) return TEXTO_CALENDARIO_ILEGIBLE;
  return motivo;
}

const TEXTOS_DE_FALLO: Record<
  Exclude<FalloAlMover["motivo"], "negocio" | "profesional" | "sin_hueco">,
  { status: number; texto: string }
> = {
  no_existe: { status: 404, texto: "No existe esa cita en tu negocio." },
  cancelada: { status: 409, texto: "Esa cita está cancelada." },
  pasada: { status: 409, texto: "Esa hora ya ha pasado." },
  agenda_ocupada: {
    status: 409,
    texto:
      "La agenda está guardando otra reserva en este momento. Vuelve a intentarlo en unos segundos.",
  },
  calendario_desconectado: {
    status: 409,
    texto:
      "Tu calendario ha dejado de responder y hay que volver a conectarlo. La cita sigue como estaba.",
  },
  calendario_rechaza: {
    status: 502,
    texto:
      "Tu calendario no ha aceptado la nueva hora. La cita sigue como estaba; inténtalo en un rato.",
  },
  cancelada_entre_medias: {
    status: 409,
    texto: "La cita se canceló mientras la movías. No se ha cambiado nada.",
  },
  error_interno: {
    status: 500,
    texto: "No se ha podido mover la cita. Inténtalo en un rato.",
  },
};

async function zonaDelNegocio(businessId: string): Promise<string> {
  const negocio = await prisma.business.findUnique({
    where: { id: businessId },
    select: { timezone: true },
  });
  return negocio?.timezone || "Europe/Madrid";
}

/** «Tu calendario ya está al día» solo tiene sentido con calendario externo;
 * en la agenda de Alhabla (PLAN-AGENDA-ALHABLA.md) la cita vive aquí. */
async function dondeQuedaLaCita(businessId: string): Promise<string> {
  const negocio = await prisma.business.findUnique({
    where: { id: businessId },
    select: { modoDeAgenda: true },
  });
  return negocio?.modoDeAgenda === "alhabla"
    ? "Tu agenda ya está al día."
    : "Tu calendario ya está al día.";
}

/**
 * Si se le puede mandar al cliente el aviso del cambio o de la cancelación
 * por WhatsApp: hay móvil, el negocio tiene número y el cliente no pidió la
 * baja. Lo decide la misma comprobación que usa el Gestor antes de
 * preguntar «¿le aviso?».
 */
async function avisoPosible(
  businessId: string,
  timezone: string,
  citaId: string,
  tipo: "cambio" | "cancelacion"
): Promise<{ telefono: string; cliente: string | null } | null> {
  const accion = ACCIONES_DE_AGENDA.avisar_cliente;
  const comprobacion = await accion.comprobar(
    { businessId, timezone },
    accion.schema.parse({ cita: citaId, tipo })
  );
  if (!comprobacion.ok) return null;
  const parametros = comprobacion.parametros as
    { telefono?: string } | undefined;
  if (!parametros?.telefono) return null;
  const cita = await prisma.booking.findFirst({
    where: { id: citaId, call: { businessId } },
    select: { clientName: true },
  });
  return { telefono: parametros.telefono, cliente: cita?.clientName ?? null };
}

export async function citasDelPanelRoutes(fastify: FastifyInstance) {
  fastify.post<{
    Params: z.infer<typeof CitaParamsSchema>;
    Body: z.infer<typeof MoverBodySchema>;
  }>(
    "/business/me/bookings/:id/mover",
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const { id } = CitaParamsSchema.parse(request.params);
        const { fechaHora, profesionalId, soloComprobar } =
          MoverBodySchema.parse(request.body);
        const businessId = request.user!.businessId;
        const timezone = await zonaDelNegocio(businessId);

        if (soloComprobar) {
          const accion = ACCIONES_DE_AGENDA.mover_cita;
          const r = await accion.comprobar(
            { businessId, timezone },
            accion.schema.parse({
              cita: id,
              fechaHora,
              ...(profesionalId ? { profesional: profesionalId } : {}),
            })
          );
          if (r.ok) return reply.send({ ok: true });
          if (r.motivo.startsWith("No encuentro esa cita")) {
            return reply
              .status(404)
              .send({ error: TEXTOS_DE_FALLO.no_existe.texto });
          }
          return reply
            .status(409)
            .send({ ok: false, error: enPalabrasDelPanel(r.motivo) });
        }

        const accionId = randomUUID();
        const r = await moverReserva({
          businessId,
          timezone,
          citaId: id,
          start: instanteLocal(
            timezone,
            ...(fechaHora.split("T") as [string, string])
          ),
          profesional: profesionalId ?? null,
          etiqueta: `panel mover ${accionId}`,
          prefijoDeLog: "[Booking]",
          idempotencia: {
            callId: `panel:${accionId}`,
            distintivo: accionId,
          },
        });
        if (!r.ok) {
          if (
            r.motivo === "negocio" ||
            r.motivo === "profesional" ||
            r.motivo === "sin_hueco"
          ) {
            return reply
              .status(409)
              .send({ error: enPalabrasDelPanel(r.detalle) });
          }
          const { status, texto } = TEXTOS_DE_FALLO[r.motivo];
          return reply.status(status).send({ error: texto });
        }

        const con = r.asignado ? ` con ${r.asignado.name}` : "";
        return reply.send({
          ok: true,
          mensaje: `Cita movida al ${formatearCita(r.start, timezone)}${con}. ${await dondeQuedaLaCita(businessId)}`,
          cita: {
            id: r.cita.id,
            programedAt: r.start.toISOString(),
            professional: r.asignado,
          },
          avisoAlCliente: await avisoPosible(
            businessId,
            timezone,
            r.cita.id,
            "cambio"
          ),
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: error.errors });
        }
        fastify.log.error(
          { err: error },
          "[Booking] No se pudo mover la cita desde el panel"
        );
        return reply
          .status(500)
          .send({ error: TEXTOS_DE_FALLO.error_interno.texto });
      }
    }
  );

  fastify.post<{ Params: z.infer<typeof CitaParamsSchema> }>(
    "/business/me/bookings/:id/cancelar",
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const { id } = CitaParamsSchema.parse(request.params);
        const businessId = request.user!.businessId;
        const r = await cancelarReserva({
          bookingId: id,
          businessId,
          cancelledBy: "owner_panel",
          etiqueta: "panel",
        });
        if (r.resultado === "no_encontrada") {
          return reply
            .status(404)
            .send({ error: TEXTOS_DE_FALLO.no_existe.texto });
        }
        const timezone = await zonaDelNegocio(businessId);
        return reply.send({
          ok: true,
          yaCancelada: r.resultado === "ya_cancelada",
          mensaje:
            r.resultado === "ya_cancelada"
              ? "Esa cita ya estaba cancelada."
              : (await dondeQuedaLaCita(businessId)).startsWith("Tu agenda")
                ? "Cita cancelada."
                : "Cita cancelada y quitada de tu calendario.",
          avisoAlCliente:
            r.resultado === "cancelada"
              ? await avisoPosible(businessId, timezone, id, "cancelacion")
              : null,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: error.errors });
        }
        fastify.log.error(
          { err: error },
          "[Booking] No se pudo cancelar la cita desde el panel"
        );
        return reply
          .status(500)
          .send({
            error: "No se ha podido cancelar la cita. Inténtalo en un rato.",
          });
      }
    }
  );

  // «Avisar por WhatsApp» tras mover o cancelar: lo autoriza el dueño al
  // pulsarlo, como el botón «Sí, avísale» del Gestor.
  fastify.post<{
    Params: z.infer<typeof CitaParamsSchema>;
    Body: z.infer<typeof AvisarBodySchema>;
  }>(
    "/business/me/bookings/:id/avisar",
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const { id } = CitaParamsSchema.parse(request.params);
        const { tipo } = AvisarBodySchema.parse(request.body);
        const businessId = request.user!.businessId;
        const timezone = await zonaDelNegocio(businessId);
        const ctx = { businessId, timezone };
        const accion = ACCIONES_DE_AGENDA.avisar_cliente;

        const comprobacion = await accion.comprobar(
          ctx,
          accion.schema.parse({ cita: id, tipo })
        );
        if (!comprobacion.ok) {
          if (comprobacion.motivo.startsWith("No encuentro esa cita")) {
            return reply
              .status(404)
              .send({ error: TEXTOS_DE_FALLO.no_existe.texto });
          }
          fastify.log.info(
            `[Booking] Aviso de ${tipo} de la cita ${id} (negocio ${businessId}) no disponible: ${comprobacion.motivo}`
          );
          return reply.status(409).send({
            error:
              "No se le puede escribir por WhatsApp a este cliente. Llámale tú.",
          });
        }

        const accionId = randomUUID();
        const r = await accion.ejecutar(
          ctx,
          comprobacion.parametros ?? accion.schema.parse({ cita: id, tipo }),
          {
            accionId,
            inboundMessageId: `panel:${accionId}`,
          }
        );
        if (!r.ok) {
          fastify.log.warn(
            `[Booking] Aviso de ${tipo} de la cita ${id} (negocio ${businessId}) no enviado: ${r.nota ?? r.mensaje}`
          );
          return reply.status(409).send({
            error: "No se ha podido mandar el aviso por WhatsApp. Llámale tú.",
          });
        }
        return reply.send({
          ok: true,
          mensaje: "Le estamos mandando el aviso por WhatsApp.",
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: error.errors });
        }
        fastify.log.error(
          { err: error },
          "[Booking] No se pudo avisar al cliente desde el panel"
        );
        return reply.status(500).send({
          error: "No se ha podido mandar el aviso por WhatsApp. Llámale tú.",
        });
      }
    }
  );

  // -------------------------------------------------------------------------
  // Crear desde el panel (PLAN-AGENDA-ALHABLA.md, fase 2): «Nueva cita»,
  // «Bloquear horas» y «Marcar ausencia». Son las acciones añadir_cita,
  // bloquear_franja y marcar_ausencia del Gestor, con `origen: "panel"`:
  // mismas comprobaciones (hueco bajo el candado, horario, calendario externo
  // cuando lo hay) y misma Call sintética para la cita, que no cuenta como
  // llamada. `soloComprobar` valida sin tocar nada (el formulario avisa antes
  // de pedir confirmación).
  // -------------------------------------------------------------------------

  fastify.post<{ Body: z.infer<typeof NuevaCitaBodySchema> }>(
    "/business/me/bookings",
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const { soloComprobar, ...body } = NuevaCitaBodySchema.parse(
          request.body
        );
        const businessId = request.user!.businessId;
        const timezone = await zonaDelNegocio(businessId);
        const ctx = { businessId, timezone };
        const accion = ACCIONES_DE_AGENDA.añadir_cita;
        const params = accion.schema.parse({
          cliente: body.cliente,
          ...(body.telefono ? { telefono: body.telefono } : {}),
          fechaHora: body.fechaHora,
          servicios: body.servicios,
          ...(body.profesionalId ? { profesional: body.profesionalId } : {}),
          ...(body.duracionMinutos
            ? { duracionMinutos: body.duracionMinutos }
            : {}),
        });

        const comprobacion = await accion.comprobar(ctx, params);
        if (!comprobacion.ok) {
          return reply
            .status(409)
            .send({ ok: false, error: enPalabrasDelPanel(comprobacion.motivo) });
        }
        if (soloComprobar) {
          return reply.send({ ok: true, descripcion: comprobacion.descripcion });
        }

        const accionId = randomUUID();
        const r = await accion.ejecutar(ctx, comprobacion.parametros ?? params, {
          accionId,
          inboundMessageId: `panel:${accionId}`,
          origen: "panel",
        });
        if (!r.ok) {
          fastify.log.warn(
            `[Booking] Nueva cita desde el panel (negocio ${businessId}) rechazada: ${r.nota ?? r.mensaje}`
          );
          return reply
            .status(409)
            .send({ error: enPalabrasDelPanel(r.mensaje) });
        }
        // La acción cuelga la cita de la Call sintética de esta acción.
        const cita = await prisma.booking.findFirst({
          where: {
            call: {
              businessId,
              callId: `${PREFIJO_DE_CALL_DEL_GESTOR}${accionId}`,
            },
          },
          select: {
            id: true,
            programedAt: true,
            clientName: true,
            clientPhone: true,
            professional: { select: { id: true, name: true } },
          },
        });
        fastify.log.info(
          `[Booking] Nueva cita ${cita?.id ?? "?"} apuntada desde el panel (negocio ${businessId})`
        );
        return reply.status(201).send({
          ok: true,
          mensaje: cita
            ? `Cita apuntada: ${cita.clientName ?? "cliente"} el ${formatearCita(cita.programedAt, timezone)}${cita.professional ? ` con ${cita.professional.name}` : ""}.`
            : "Cita apuntada.",
          cita: cita
            ? {
                id: cita.id,
                programedAt: cita.programedAt.toISOString(),
                professional: cita.professional,
              }
            : null,
          // El aviso al cliente desde «Nueva cita» no se ofrece en el MVP
          // (decisión D4 del plan): la confirmación solo es posible con un
          // permiso previo del cliente, que el panel no puede dar por hecho.
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: error.errors });
        }
        fastify.log.error(
          { err: error },
          "[Booking] No se pudo apuntar la cita desde el panel"
        );
        return reply
          .status(500)
          .send({ error: "No se ha podido apuntar la cita. Inténtalo en un rato." });
      }
    }
  );

  fastify.post<{ Body: z.infer<typeof BloquearBodySchema> }>(
    "/business/me/bloqueos",
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const { soloComprobar, ...body } = BloquearBodySchema.parse(
          request.body
        );
        const businessId = request.user!.businessId;
        const timezone = await zonaDelNegocio(businessId);
        const ctx = { businessId, timezone };
        const accion = ACCIONES_DE_AGENDA.bloquear_franja;
        const params = accion.schema.parse(body);

        const comprobacion = await accion.comprobar(ctx, params);
        if (!comprobacion.ok) {
          return reply
            .status(409)
            .send({ ok: false, error: comprobacion.motivo });
        }
        if (soloComprobar) {
          return reply.send({ ok: true, descripcion: comprobacion.descripcion });
        }

        const accionId = randomUUID();
        const r = await accion.ejecutar(ctx, comprobacion.parametros ?? params, {
          accionId,
          inboundMessageId: `panel:${accionId}`,
          origen: "panel",
        });
        if (!r.ok) {
          return reply.status(409).send({ error: r.mensaje });
        }
        fastify.log.info(
          `[Booking] Tramo bloqueado desde el panel (negocio ${businessId}): ${body.fecha} ${body.desde}-${body.hasta}`
        );
        return reply.send({
          ok: true,
          // El Gestor habla en primera persona («Hecho: …»); aquí vale igual
          // porque el texto describe el horario que queda y el aviso sobre
          // las citas ya reservadas.
          mensaje: r.mensaje.replace(/^Hecho: /, ""),
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: error.errors });
        }
        fastify.log.error(
          { err: error },
          "[Booking] No se pudo bloquear el tramo desde el panel"
        );
        return reply
          .status(500)
          .send({ error: "No se ha podido bloquear ese tramo. Inténtalo en un rato." });
      }
    }
  );

  fastify.post<{ Body: z.infer<typeof AusenciaBodySchema> }>(
    "/business/me/absences",
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const { soloComprobar, ...body } = AusenciaBodySchema.parse(
          request.body
        );
        const businessId = request.user!.businessId;
        const timezone = await zonaDelNegocio(businessId);
        const ctx = { businessId, timezone };
        const accion = ACCIONES_DE_AGENDA.marcar_ausencia;
        const params = accion.schema.parse({
          profesional: body.profesionalId,
          desde: body.desde,
          ...(body.hasta ? { hasta: body.hasta } : {}),
          ...(body.horaInicio ? { horaInicio: body.horaInicio } : {}),
          ...(body.horaFin ? { horaFin: body.horaFin } : {}),
          ...(body.motivo ? { motivo: body.motivo } : {}),
        });

        const comprobacion = await accion.comprobar(ctx, params);
        if (!comprobacion.ok) {
          return reply
            .status(409)
            .send({ ok: false, error: comprobacion.motivo });
        }
        if (soloComprobar) {
          return reply.send({ ok: true, descripcion: comprobacion.descripcion });
        }

        const accionId = randomUUID();
        const r = await accion.ejecutar(ctx, comprobacion.parametros ?? params, {
          accionId,
          inboundMessageId: `panel:${accionId}`,
          origen: "panel",
        });
        if (!r.ok) {
          return reply.status(409).send({ error: r.mensaje });
        }
        fastify.log.info(
          `[Booking] Ausencia marcada desde el panel (negocio ${businessId}): ${body.profesionalId} ${body.desde}${body.hasta ? `→${body.hasta}` : ""}`
        );
        return reply.status(201).send({
          ok: true,
          mensaje: r.mensaje.replace(/^Hecho: /, ""),
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: error.errors });
        }
        fastify.log.error(
          { err: error },
          "[Booking] No se pudo marcar la ausencia desde el panel"
        );
        return reply
          .status(500)
          .send({ error: "No se ha podido marcar la ausencia. Inténtalo en un rato." });
      }
    }
  );
}

// Cuerpos de las rutas de creación. Los límites son los de las acciones del
// Gestor (sus esquemas vuelven a validar); aquí solo se nombran los campos
// como los manda el formulario del panel.
const FechaHoraLocalSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/,
    'Fecha y hora en formato "AAAA-MM-DDTHH:MM"'
  );
const FechaSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha en formato "AAAA-MM-DD"');
const HoraSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora en formato "HH:MM"');

const NuevaCitaBodySchema = z.object({
  cliente: z.string().trim().min(1).max(80),
  telefono: z.string().trim().min(1).max(32).optional(),
  fechaHora: FechaHoraLocalSchema,
  servicios: z.array(z.string().trim().min(1).max(80)).min(1).max(5),
  profesionalId: z.string().trim().min(1).max(80).optional(),
  duracionMinutos: z.number().int().positive().max(24 * 60).optional(),
  soloComprobar: z.boolean().optional(),
});

const BloquearBodySchema = z.object({
  fecha: FechaSchema,
  desde: HoraSchema,
  hasta: HoraSchema,
  motivo: z.string().trim().max(60).optional(),
  soloComprobar: z.boolean().optional(),
});

const AusenciaBodySchema = z.object({
  profesionalId: z.string().trim().min(1).max(80),
  desde: FechaSchema,
  hasta: FechaSchema.optional(),
  horaInicio: HoraSchema.optional(),
  horaFin: HoraSchema.optional(),
  motivo: z.string().trim().max(60).optional(),
  soloComprobar: z.boolean().optional(),
});
