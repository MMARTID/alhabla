import type { FastifyError, FastifyPluginAsync } from "fastify";
import { ZodError } from "zod";
import growthAuthPlugin from "../../plugins/growthAuth.js";
import { growthRoutesAdmin } from "./routesAdmin.js";
import { growthRoutesAdminExtra } from "./routesAdminExtra.js";
import { growthRoutesAgente } from "./routesAgente.js";
import { growthRoutesAgenteExtra } from "./routesAgenteExtra.js";
import { growthRoutesCompetencia } from "./routesCompetencia.js";
import { growthRoutesConocimiento } from "./routesConocimiento.js";
import { ErrorDeGrowth } from "./service.js";

/** Lo que se le dice a quien llama cuando el fallo es de Fastify (JSON mal formado, 413, 415…). */
const MENSAJES_POR_ESTADO: Record<number, string> = {
  400: "La petición no es válida.",
  401: "Inicia sesión para continuar.",
  403: "No tienes acceso.",
  404: "No existe.",
  413: "La petición es demasiado grande.",
  415: "El tipo de contenido no es compatible.",
  429: "Demasiadas peticiones: espera un momento y vuelve a intentarlo.",
};

/**
 * ¿Es un choque entre transacciones que se arregla repitiendo? Un deadlock
 * (SQLSTATE 40P01), un fallo de serialización (40001), el `P2034` de Prisma
 * (conflicto de escritura o deadlock) y `P2028` (la transacción no llegó a
 * tiempo, por ejemplo esperando un cerrojo). Es un 409 `conflicto`, no un 500.
 */
export function esConflictoDeConcurrencia(error: unknown): boolean {
  const e = error as {
    code?: unknown;
    meta?: { code?: unknown; message?: unknown } | null;
    message?: unknown;
  } | null;
  if (!e || typeof e !== "object") return false;
  if (e.code === "P2034" || e.code === "P2028") return true;
  if (e.code === "40P01" || e.code === "40001") return true;
  if (e.meta?.code === "40P01" || e.meta?.code === "40001") return true;
  const mensaje = `${typeof e.message === "string" ? e.message : ""} ${
    typeof e.meta?.message === "string" ? e.meta.message : ""
  }`;
  return /\b40P01\b|deadlock detected|could not serialize access/i.test(
    mensaje
  );
}

/**
 * Alhabla Growth (PLAN-GROWTH.md). Sin `businessId`: no es de ningún negocio.
 *
 * - `/growth/agente/*`: la sesión programada, con token de agente. Escribe
 *   oportunidades, investigaciones y borradores; no aprueba nada.
 * - `/growth/admin/*`: el fundador, con su sesión de Google. Aprueba,
 *   devuelve, descarta y registra lo que hace a mano.
 *
 * Este fichero es el ÍNDICE: pone lo que vale para todas las rutas de
 * /growth/* (sin caché, un único formato de error) y registra los ficheros de
 * rutas. El plugin va encapsulado (sin `fp`): nada de esto sale de /growth/*.
 */
export const growthRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(growthAuthPlugin);

  // Nada de lo que sale de aquí se cachea: son datos privados y cambian
  // cada vez que se decide algo. (Los hooks y el manejador de errores se
  // declaran ANTES de registrar las rutas: solo las heredan las que van
  // después.)
  fastify.addHook("onSend", async (_request, reply, payload) => {
    reply.header("Cache-Control", "no-store");
    return payload;
  });

  // Un solo formato de error: `{ error: string }` (con `codigo` y, si hace
  // falta, más campos) o `{ error: ZodIssue[] }` en un 400 de validación. Los
  // 500 no filtran mensajes.
  fastify.setErrorHandler(
    (error: FastifyError | ErrorDeGrowth | ZodError, request, reply) => {
      if (error instanceof ErrorDeGrowth) {
        return reply.status(error.status).send({
          error: error.message,
          ...(error.codigo ? { codigo: error.codigo } : {}),
          ...(error.extra ?? {}),
        });
      }
      if (error instanceof ZodError) {
        return reply.status(400).send({ error: error.errors });
      }
      if (esConflictoDeConcurrencia(error)) {
        request.log.warn(
          { codigo: (error as { code?: unknown }).code },
          "[Growth] Choque entre transacciones: se pide repetir"
        );
        return reply.status(409).send({
          error:
            "Otra operación estaba cambiando lo mismo. Vuelve a cargarlo y repítelo.",
          codigo: "conflicto",
        });
      }
      const estado =
        "statusCode" in error && typeof error.statusCode === "number"
          ? error.statusCode
          : 500;
      if (estado >= 400 && estado < 500) {
        return reply.status(estado).send({
          error: MENSAJES_POR_ESTADO[estado] ?? MENSAJES_POR_ESTADO[400],
        });
      }
      request.log.error({ err: error }, "[Growth] Error no controlado");
      return reply.status(500).send({ error: "Error interno." });
    }
  );

  await fastify.register(growthRoutesAgente);
  await fastify.register(growthRoutesAgenteExtra);
  await fastify.register(growthRoutesConocimiento);
  await fastify.register(growthRoutesAdmin);
  await fastify.register(growthRoutesAdminExtra);
  await fastify.register(growthRoutesCompetencia);
};
