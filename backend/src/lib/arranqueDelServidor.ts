import type { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { initRedis } from "./redis.js";
import { initStorage } from "./storage.js";
import { conectarRedisDeCompatibilidad } from "./redisDeCompatibilidad.js";
import { AlmacenDeLimites } from "./limitesDePeticiones.js";

/**
 * Piezas del arranque de server.ts que deciden cómo se excluyen los cerrojos
 * y cómo se cuenta el límite de peticiones. Viven aquí y no en server.ts
 * porque server.ts arranca el servidor al importarlo y ningún test puede
 * cargarlo (tests/lib/arranqueDelServidor.test.ts).
 */

/**
 * Servicios externos que se inician ANTES de aceptar tráfico (server.ts lo
 * espera antes de `listen`).
 *
 * Mientras la revisión tenga REDIS_URL, los cerrojos se toman también en
 * Redis para excluir a las revisiones anteriores al corte (que solo conocen
 * Redis). Se espera hasta 3 s a que el cliente esté listo; si no llega, se
 * arranca igual y los cerrojos fallan cerrados hasta que conecte, nunca se
 * quedan en «solo Postgres» (lib/redisDeCompatibilidad.ts).
 */
export async function iniciarServiciosExternos(): Promise<void> {
  initRedis();
  initStorage();
  await conectarRedisDeCompatibilidad();
}

/**
 * Límite global de 100 peticiones por minuto y IP, y el de cada ruta que
 * lleve `config.rateLimit`.
 *
 * Sin store compartido el contador vive en la memoria de cada instancia: se
 * reinicia en cada arranque en frío y se multiplica por el número de
 * instancias de Cloud Run, así que el límite real era muchas veces el
 * configurado. El contador global vive en Postgres (tabla UNLOGGED
 * `contadores`, lib/limitesDePeticiones.ts), con las mismas claves que tenía
 * en Redis, para todas las rutas, también las de /webhooks/*, de forma
 * síncrona: cada petición espera a que Postgres la cuente. Solo si Postgres
 * falla o no responde a tiempo decide la cuenta local de la instancia: nunca
 * un 500 en toda la API por el limitador. `skipOnError` se mantiene como red
 * por si el almacén llegara a devolver un error.
 */
export async function registrarLimiteDePeticiones(
  fastify: FastifyInstance
): Promise<void> {
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    store: AlmacenDeLimites,
    skipOnError: true,
    errorResponseBuilder: (_req, context) => ({
      statusCode: 429,
      error: "Too Many Requests",
      message: `Rate limit exceeded. Retry in ${context.after}`,
    }),
  });
}
