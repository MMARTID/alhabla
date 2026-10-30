import fp from "fastify-plugin";
import { OAuth2Client } from "google-auth-library";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../lib/prisma.js";
import {
  PREFIJO_DE_TOKEN,
  administradoresDeGrowth,
  hashDeToken,
} from "../modules/growth/tokens.js";

export type AlcanceDeAgente = "leer" | "escribir";

declare module "fastify" {
  interface FastifyRequest {
    growthAdmin?: { email: string };
    growthAgente?: { id: string; nombre: string; alcances: string[] };
  }
  interface FastifyInstance {
    // `any` a propósito, igual que `authenticate`: se usa como hook en rutas
    // con genéricos propios.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    autenticarAdminGrowth: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    autenticarAgenteGrowth: (alcance: AlcanceDeAgente) => any;
  }
}

const oauthClient = new OAuth2Client();

/** Cada cuánto se anota el último uso de un token: una escritura por petición sobraría. */
const MS_ENTRE_ANOTACIONES_DE_USO = 5 * 60 * 1000;

function bearer(request: FastifyRequest): string | null {
  const cabecera = request.headers.authorization;
  if (!cabecera || !cabecera.startsWith("Bearer ")) return null;
  return cabecera.slice("Bearer ".length).trim() || null;
}

/**
 * Autenticación de /growth/*. Alhabla Growth no es de ningún negocio, así que
 * NO usa `authenticate` (el JWT de cliente): un token de cliente jamás abre
 * estas rutas. Hay dos puertas distintas:
 *
 * - Administrador: un ID token de Google cuyo correo está en la lista blanca
 *   GROWTH_ADMIN_EMAILS. Es el único que aprueba, descarta o da algo por hecho.
 * - Agente: un token de servicio (`gta_…`) cuyo SHA-256 está en
 *   `growth_tokens_agente`, con alcances `leer` y/o `escribir`.
 */
const growthAuthPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate(
    "autenticarAdminGrowth",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const clientId = process.env.GROWTH_GOOGLE_CLIENT_ID;
      const administradores = administradoresDeGrowth();
      // Como en internalAuth: con la configuración a medias se rechaza, no se
      // acepta con menos garantías (verifyIdToken se salta la audience si
      // recibe undefined).
      if (!clientId || administradores.length === 0) {
        request.log.error(
          "[Growth] Falta GROWTH_GOOGLE_CLIENT_ID o GROWTH_ADMIN_EMAILS: se rechazan las peticiones de administrador"
        );
        return reply.status(503).send({ error: "Growth no está configurado." });
      }

      const idToken = bearer(request);
      if (!idToken) {
        return reply
          .status(401)
          .send({ error: "Inicia sesión para continuar." });
      }

      let correo: string | undefined;
      let verificado: boolean | undefined;
      try {
        const ticket = await oauthClient.verifyIdToken({
          idToken,
          audience: clientId,
        });
        const payload = ticket.getPayload();
        correo = payload?.email?.toLowerCase();
        verificado = payload?.email_verified;
      } catch (error) {
        request.log.warn(
          { err: error },
          "[Growth] ID token de administrador no verificado"
        );
        return reply
          .status(401)
          .send({ error: "Tu sesión ha caducado. Vuelve a iniciar sesión." });
      }

      if (!correo || !verificado || !administradores.includes(correo)) {
        request.log.warn(
          { correo },
          "[Growth] Correo sin permiso de administrador"
        );
        return reply.status(403).send({ error: "No tienes acceso." });
      }

      request.growthAdmin = { email: correo };
    }
  );

  fastify.decorate(
    "autenticarAgenteGrowth",
    (alcance: AlcanceDeAgente) =>
      async (request: FastifyRequest, reply: FastifyReply) => {
        const token = bearer(request);
        // Sin el prefijo ni se consulta la base de datos: así un JWT de
        // cliente se descarta al instante.
        if (!token || !token.startsWith(PREFIJO_DE_TOKEN)) {
          return reply
            .status(401)
            .send({ error: "Token de agente no válido." });
        }

        const registro = await prisma.growthTokenAgente.findUnique({
          where: { hashToken: hashDeToken(token) },
        });
        if (!registro || registro.revocadoEn) {
          return reply
            .status(401)
            .send({ error: "Token de agente no válido." });
        }
        if (!registro.alcances.includes(alcance)) {
          return reply
            .status(403)
            .send({ error: `El token no tiene el alcance «${alcance}».` });
        }

        request.growthAgente = {
          id: registro.id,
          nombre: registro.nombre,
          alcances: registro.alcances,
        };

        const ultimo = registro.ultimoUso?.getTime() ?? 0;
        if (Date.now() - ultimo > MS_ENTRE_ANOTACIONES_DE_USO) {
          // Anotar el uso no debe tumbar la petición, pero un fallo aquí se
          // oiría: sin esto no sabríamos qué token se está usando.
          prisma.growthTokenAgente
            .update({
              where: { id: registro.id },
              data: { ultimoUso: new Date() },
            })
            .catch((error: unknown) => {
              request.log.error(
                { err: error, tokenId: registro.id },
                "[Growth] No se pudo anotar el último uso del token de agente"
              );
            });
        }
      }
  );
};

export default fp(growthAuthPlugin);
