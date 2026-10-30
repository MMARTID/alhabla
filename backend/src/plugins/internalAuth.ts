import fp from "fastify-plugin";
import { OAuth2Client } from "google-auth-library";
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    // `any` a propósito: se usa como hook en rutas con genéricos propios
    // (Body, Querystring…), y un tipo FastifyRequest concreto rompe la
    // inferencia de esas rutas.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    verifyCloudTasks: any;
    // Lo mismo para las acciones del panel de desarrollo (/internal/panel/*):
    // otra cuenta de servicio, que no puede lanzar jobs.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    verifyPanel: any;
  }
}

const oauthClient = new OAuth2Client();

// Las rutas /internal/* no son de ningún negocio: las llaman Cloud Tasks,
// Cloud Scheduler y el panel de desarrollo, cada uno con su cuenta de
// servicio, y cada ruta acepta solo la suya.
const internalAuthPlugin: FastifyPluginAsync = async (fastify) => {
  /**
   * Token OIDC firmado por Google, con la audience de este servicio y
   * emitido para la cuenta de servicio que dice `variableDeLaCuenta`.
   */
  const verificarCuenta =
    (variableDeLaCuenta: string, quien: string) =>
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return reply
            .status(401)
            .send({ error: "Unauthorized: Missing OIDC token" });
        }

        // Las dos variables son obligatorias: google-auth-library se salta la
        // comprobación de audience cuando se le pasa undefined, así que con la
        // configuración a medias la verificación se debilita en silencio.
        // Mejor rechazar la petición que aceptarla con menos garantías.
        const expectedAudience = process.env.INTERNAL_JOBS_BASE_URL;
        const expectedServiceAccount = process.env[variableDeLaCuenta];
        if (!expectedAudience || !expectedServiceAccount) {
          fastify.log.error(
            `[InternalAuth] Falta INTERNAL_JOBS_BASE_URL o ${variableDeLaCuenta}: se rechazan las peticiones de ${quien}`
          );
          return reply
            .status(503)
            .send({ error: "Internal auth is not configured" });
        }

        const idToken = authHeader.slice("Bearer ".length);
        const ticket = await oauthClient.verifyIdToken({
          idToken,
          audience: expectedAudience,
        });

        const payload = ticket.getPayload();

        if (
          !payload?.email ||
          !payload.email_verified ||
          payload.email !== expectedServiceAccount
        ) {
          return reply
            .status(403)
            .send({ error: "Forbidden: Unexpected token issuer" });
        }
      } catch (error) {
        fastify.log.warn(
          { err: error },
          `[InternalAuth] OIDC de ${quien} no verificado`
        );
        return reply
          .status(401)
          .send({ error: "Unauthorized: Invalid OIDC token" });
      }
    };

  // Cloud Tasks y Cloud Scheduler: sin esto, cualquiera podría hacer POST a
  // /internal/jobs/* y disparar un job arbitrario.
  fastify.decorate(
    "verifyCloudTasks",
    verificarCuenta("CLOUD_TASKS_INVOKER_SERVICE_ACCOUNT", "Cloud Tasks")
  );
  // El panel de desarrollo (backend/mcp/panel/) firma con su propia cuenta de
  // servicio, sin roles en el proyecto, que solo puede usar admin@alhabla.ai.
  fastify.decorate(
    "verifyPanel",
    verificarCuenta("PANEL_INVOKER_SERVICE_ACCOUNT", "el panel")
  );
};

export default fp(internalAuthPlugin);
