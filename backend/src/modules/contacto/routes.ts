import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { enqueueEmailJob } from "../../lib/cloudTasks.js";
import { solicitudDeContactoEmail } from "../../lib/emailTemplates.js";

/** Buzón del equipo: el mismo que la web publica como contacto. */
export const BUZON_DE_CONTACTO = "hola@alhabla.ai";

/**
 * Lo que puede tardar una persona en escribir y reenviar si se equivoca,
 * pero no lo que aguanta un bot que rellena formularios en bucle: cada envío
 * es un correo al buzón del equipo.
 */
const contactoRateLimit = {
  max: 5,
  timeWindow: "10 minutes",
};

/** Lo mismo que ofrece el selector de la web, con la etiqueta del correo. */
export const SEDES = {
  "1": "1 sede",
  "2-4": "2–4 sedes",
  "5+": "5 o más sedes",
  franquicia: "Franquicia",
} as const;

type ValorDeSedes = keyof typeof SEDES;

const VALORES_DE_SEDES = Object.keys(SEDES) as [ValorDeSedes, ...ValorDeSedes[]];

/** Vacío (o solo espacios) cuenta como no escrito. */
const opcional = <T extends z.ZodTypeAny>(esquema: T) =>
  z.preprocess(
    (valor) =>
      typeof valor === "string" && valor.trim() === "" ? undefined : valor,
    esquema.optional()
  );

export const ContactoBodySchema = z.object({
  nombre: z
    .string({ required_error: "Escribe tu nombre." })
    .trim()
    .min(2, "Escribe tu nombre.")
    .max(100, "El nombre es demasiado largo."),
  email: z
    .string({ required_error: "Escribe tu email." })
    .trim()
    .toLowerCase()
    .max(254, "El email es demasiado largo.")
    .email("Escribe un email válido."),
  telefono: opcional(
    z
      .string()
      .trim()
      .max(30, "Escribe un teléfono válido.")
      .regex(/^[+()\d\s.-]+$/, "Escribe un teléfono válido.")
      .refine(
        (telefono) => telefono.replace(/\D/g, "").length >= 9,
        "Escribe un teléfono válido."
      )
  ),
  negocio: z
    .string({ required_error: "Dinos cómo se llama tu negocio." })
    .trim()
    .min(2, "Dinos cómo se llama tu negocio.")
    .max(120, "El nombre del negocio es demasiado largo."),
  sedes: z.enum(VALORES_DE_SEDES, {
    errorMap: () => ({ message: "Indica cuántas sedes tenéis." }),
  }),
  mensaje: opcional(
    z
      .string()
      .trim()
      .max(2000, "El mensaje es demasiado largo (máximo 2.000 caracteres).")
  ),
  // Trampa para bots: la web lo pinta fuera de la vista y una persona lo
  // deja vacío. Si llega relleno, se contesta como si hubiera ido bien y no
  // se manda nada.
  sitioWeb: z.string().max(500).optional(),
});

/**
 * Formulario «Hablar con nosotros» de la web pública (alhabla.ai/contacto).
 * Sin sesión: lo usa cualquier visitante antes de pagar. No guarda nada en la
 * base de datos; avisa por correo al equipo. Los logs no llevan nombre,
 * email, teléfono ni mensaje: solo cuántas sedes, que es lo que sirve para
 * contar solicitudes.
 */
export const contactoRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/contacto",
    { config: { rateLimit: contactoRateLimit } },
    async (request, reply) => {
      const parsed = ContactoBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.errors });
      }
      const { sitioWeb, ...datos } = parsed.data;

      if (sitioWeb) {
        fastify.log.warn("[Contacto] Solicitud descartada: trampa anti-bots rellena");
        return reply.send({ ok: true });
      }

      const { subject, html } = solicitudDeContactoEmail({
        ...datos,
        sedes: SEDES[datos.sedes],
      });
      try {
        // El id de la tarea es también la clave de envío único: una segunda
        // entrega de Cloud Tasks no repite el correo.
        await enqueueEmailJob(
          { fromAlias: "support", toAddress: BUZON_DE_CONTACTO, subject, html },
          `contacto-${randomUUID()}`
        );
      } catch (error) {
        fastify.log.error(
          { err: error, sedes: datos.sedes },
          "[Contacto] No se pudo encolar el aviso al equipo"
        );
        return reply.status(502).send({
          error: `No hemos podido enviar tu mensaje. Escríbenos a ${BUZON_DE_CONTACTO}.`,
        });
      }

      fastify.log.info({ sedes: datos.sedes }, "[Contacto] Solicitud recibida");
      return reply.send({ ok: true });
    }
  );
};
