import type { PrismaClient } from "@prisma/client";
import { prisma } from "./prisma.js";

/**
 * Estado temporal en Postgres, en lugar de Memorystore (Redis). En el PR A
 * solo están los contadores de ventana fija y la purga; el resto (clave-valor
 * con caducidad) llega en el PR B.
 *
 * Cada sentencia va en autocommit y compara la caducidad con `now()` de la
 * BD, nunca con el reloj de una instancia. Las funciones LANZAN ante un
 * error de BD, igual que lanzaba ioredis: cada llamador
 * conserva su try/catch y su comportamiento (lo best-effort sigue siendo
 * best-effort y lo que falla cerrado sigue fallando cerrado).
 */

export type Incremento = { clave: string; ventanaMs: number; cantidad: number };

/**
 * Contadores de ventana fija, varias claves en UNA sentencia: a cada clave le
 * suma su `cantidad` y, si su ventana ya caducó (o no había fila), la reinicia
 * a `ventanaMs` desde ahora. Hace lo mismo que el INCR + PEXPIRE (en el
 * primero) del Lua del RedisStore de @fastify/rate-limit, en una sola
 * sentencia. Devuelve, por clave, el valor tras sumar y lo que le queda a la
 * ventana, en ms redondeados hacia abajo como el PTTL de Redis: `expiraEn` se
 * guarda con precisión de milisegundo y `now()` la tiene de microsegundo, así
 * que con CEIL una ventana recién abierta de 60 000 ms diría 60 001.
 *
 * Una clave repetida se suma una sola vez (GROUP BY: un ON CONFLICT no puede
 * tocar la misma fila dos veces), y las filas se bloquean en orden de clave
 * (ORDER BY): dos instancias que cuentan las mismas claves a la vez se
 * esperan, nunca se interbloquean.
 *
 * `cliente`: el limitador pasa el suyo, con una conexión propia
 * (`crearClienteDeUnaConexion`).
 */
export async function incrementarContadores(
  incrementos: readonly Incremento[],
  cliente: PrismaClient = prisma
): Promise<Map<string, { valor: number; ttlMs: number }>> {
  if (incrementos.length === 0) return new Map();
  const claves = incrementos.map((i) => i.clave);
  const cantidades = incrementos.map((i) => Math.floor(i.cantidad));
  const ventanas = incrementos.map((i) => Math.floor(i.ventanaMs));
  const filas = await cliente.$queryRaw<
    { clave: string; valor: number; ttlMs: number }[]
  >`
    INSERT INTO "contadores" AS c ("clave", "valor", "expiraEn")
    SELECT t."clave", sum(t."cantidad")::int,
      now() + max(t."ventanaMs") * interval '1 millisecond'
    FROM unnest(${claves}::text[], ${cantidades}::int[], ${ventanas}::int[])
      AS t("clave", "cantidad", "ventanaMs")
    GROUP BY t."clave"
    ORDER BY t."clave"
    ON CONFLICT ("clave") DO UPDATE SET
      "valor" = CASE WHEN c."expiraEn" > now()
        THEN c."valor" + EXCLUDED."valor" ELSE EXCLUDED."valor" END,
      "expiraEn" = CASE WHEN c."expiraEn" > now()
        THEN c."expiraEn" ELSE EXCLUDED."expiraEn" END
    RETURNING "clave", "valor",
      GREATEST(0, FLOOR(EXTRACT(EPOCH FROM ("expiraEn" - now())) * 1000))::int
        AS "ttlMs"`;
  return new Map(
    filas.map((f) => [
      f.clave,
      { valor: Number(f.valor), ttlMs: Number(f.ttlMs) },
    ])
  );
}

/**
 * Borrado físico de lo caducado hace más de 10 minutos (el margen deja ver un
 * cerrojo colgado al depurar). La corrección nunca depende de esto: toda
 * lectura filtra por `expiraEn`, los cerrojos sobrescriben una fila caducada
 * y los contadores reinician la ventana en la misma sentencia. Lo llama
 * /internal/jobs/cleanup-zombie-calls cada 15 min.
 */
export async function purgarCaducados(): Promise<{
  claves: number;
  contadores: number;
  cerrojos: number;
}> {
  const claves = await prisma.$executeRaw`
    DELETE FROM "claves_temporales"
    WHERE "expiraEn" < now() - interval '10 minutes'`;
  const contadores = await prisma.$executeRaw`
    DELETE FROM "contadores" WHERE "expiraEn" < now() - interval '10 minutes'`;
  const cerrojos = await prisma.$executeRaw`
    DELETE FROM "cerrojos" WHERE "expiraEn" < now() - interval '10 minutes'`;
  return { claves, contadores, cerrojos };
}
