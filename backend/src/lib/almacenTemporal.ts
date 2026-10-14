import type { PrismaClient } from "@prisma/client";
import { prisma } from "./prisma.js";

/**
 * Estado temporal en Postgres, en lugar de Memorystore (Redis): contadores de
 * ventana fija (PR A) y clave-valor con caducidad (PR B), que sustituyen a
 * SET EX [NX] / GET / GETDEL / DEL / INCR + EXPIRE / HSET / HGETALL / HSETNX.
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

// ─── Clave-valor con caducidad (tabla `claves_temporales`) ──────────────────
//
// Los valores son texto, como en Redis: cada llamador conserva su
// JSON.stringify/JSON.parse. Se guardan como un JSON de tipo string en la
// columna `valor` (Json); los «hashes» (campos) como un objeto JSON de texto.
// Una clave caducada no existe para ninguna lectura, aunque su fila siga ahí
// hasta la purga. `businessId` (opcional) ata la clave a su negocio: al
// borrarse el negocio se borran sus claves (ON DELETE CASCADE).

type OpcionesDeClave = { businessId?: string | null };

function caducidad(ttlMs: number): number {
  return Math.max(1, Math.floor(ttlMs));
}

/** SET clave valor PX ttl: crea o sustituye (valor y caducidad). */
export async function guardarClave(
  clave: string,
  valor: string,
  ttlMs: number,
  opciones: OpcionesDeClave = {}
): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO "claves_temporales" ("clave", "valor", "businessId", "expiraEn")
    VALUES (${clave}, to_jsonb(${valor}::text), ${opciones.businessId ?? null},
      now() + ${caducidad(ttlMs)} * interval '1 millisecond')
    ON CONFLICT ("clave") DO UPDATE SET
      "valor" = EXCLUDED."valor",
      "businessId" = EXCLUDED."businessId",
      "expiraEn" = EXCLUDED."expiraEn"`;
}

/** SET clave valor PX ttl NX: solo si no hay una viva. true si la guardó. */
export async function guardarClaveSiNoExiste(
  clave: string,
  valor: string,
  ttlMs: number,
  opciones: OpcionesDeClave = {}
): Promise<boolean> {
  const filas = await prisma.$queryRaw<{ clave: string }[]>`
    INSERT INTO "claves_temporales" AS t ("clave", "valor", "businessId", "expiraEn")
    VALUES (${clave}, to_jsonb(${valor}::text), ${opciones.businessId ?? null},
      now() + ${caducidad(ttlMs)} * interval '1 millisecond')
    ON CONFLICT ("clave") DO UPDATE SET
      "valor" = EXCLUDED."valor",
      "businessId" = EXCLUDED."businessId",
      "expiraEn" = EXCLUDED."expiraEn"
    WHERE t."expiraEn" <= now()
    RETURNING t."clave"`;
  return filas.length > 0;
}

/** GET: el texto guardado, o null si no hay o ya caducó. */
export async function leerClave(clave: string): Promise<string | null> {
  const filas = await prisma.$queryRaw<{ valor: string | null }[]>`
    SELECT "valor" #>> '{}' AS "valor" FROM "claves_temporales"
    WHERE "clave" = ${clave} AND "expiraEn" > now()`;
  return filas[0]?.valor ?? null;
}

/** GETDEL: lee y borra en la misma sentencia (lo de un solo uso). null si no
 * había o había caducado; una caducada se borra igual. */
export async function consumirClave(clave: string): Promise<string | null> {
  const filas = await prisma.$queryRaw<
    { valor: string | null; viva: boolean }[]
  >`
    DELETE FROM "claves_temporales" WHERE "clave" = ${clave}
    RETURNING "valor" #>> '{}' AS "valor", "expiraEn" > now() AS "viva"`;
  const fila = filas[0];
  return fila?.viva ? (fila.valor ?? null) : null;
}

/** DEL. */
export async function borrarClave(clave: string): Promise<void> {
  await prisma.$executeRaw`
    DELETE FROM "claves_temporales" WHERE "clave" = ${clave}`;
}

/** HSET + EXPIRE: añade (o sustituye) campos y fija la caducidad. Si la clave
 * no existía o había caducado, empieza de cero. */
export async function guardarCampos(
  clave: string,
  campos: Record<string, string>,
  ttlMs: number,
  opciones: OpcionesDeClave = {}
): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO "claves_temporales" AS t ("clave", "valor", "businessId", "expiraEn")
    VALUES (${clave}, ${JSON.stringify(campos)}::jsonb, ${opciones.businessId ?? null},
      now() + ${caducidad(ttlMs)} * interval '1 millisecond')
    ON CONFLICT ("clave") DO UPDATE SET
      "valor" = CASE WHEN t."expiraEn" > now() AND jsonb_typeof(t."valor") = 'object'
        THEN t."valor" || EXCLUDED."valor" ELSE EXCLUDED."valor" END,
      "businessId" = EXCLUDED."businessId",
      "expiraEn" = EXCLUDED."expiraEn"`;
}

/** HSET de un campo en una clave viva, sin tocar su caducidad. A diferencia
 * de Redis, en una clave que no existe (o caducó) no crea nada: un hash sin
 * caducidad no lo quiere ningún llamador. true si lo escribió. */
export async function fijarCampo(
  clave: string,
  campo: string,
  valor: string
): Promise<boolean> {
  const filas = await prisma.$queryRaw<{ clave: string }[]>`
    UPDATE "claves_temporales"
    SET "valor" = "valor" || jsonb_build_object(${campo}::text, ${valor}::text)
    WHERE "clave" = ${clave} AND "expiraEn" > now()
      AND jsonb_typeof("valor") = 'object'
    RETURNING "clave"`;
  return filas.length > 0;
}

/** HSETNX de un campo en una clave viva: solo si el campo no está. true si
 * lo escribió (atómico: dos a la vez, solo uno gana). */
export async function fijarCampoSiNoExiste(
  clave: string,
  campo: string,
  valor: string
): Promise<boolean> {
  const filas = await prisma.$queryRaw<{ clave: string }[]>`
    UPDATE "claves_temporales"
    SET "valor" = "valor" || jsonb_build_object(${campo}::text, ${valor}::text)
    WHERE "clave" = ${clave} AND "expiraEn" > now()
      AND jsonb_typeof("valor") = 'object' AND NOT ("valor" ? ${campo}::text)
    RETURNING "clave"`;
  return filas.length > 0;
}

/** HGETALL: los campos de una clave viva, o null si no hay (o no es un hash). */
export async function leerCampos(
  clave: string
): Promise<Record<string, string> | null> {
  const filas = await prisma.$queryRaw<{ valor: unknown }[]>`
    SELECT "valor" FROM "claves_temporales"
    WHERE "clave" = ${clave} AND "expiraEn" > now()`;
  const valor = filas[0]?.valor;
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;
  return Object.fromEntries(
    Object.entries(valor as Record<string, unknown>).map(([campo, dato]) => [
      campo,
      String(dato),
    ])
  );
}

// ─── Contadores sueltos (tabla `contadores`) ────────────────────────────────

/** INCR + EXPIRE en el primero: suma 1 en una ventana fija de `ventanaMs`
 * que empieza con el primer incremento. Devuelve el valor tras sumar. */
export async function incrementarContador(
  clave: string,
  ventanaMs: number
): Promise<number> {
  const resultado = await incrementarContadores([
    { clave, ventanaMs, cantidad: 1 },
  ]);
  return resultado.get(clave)?.valor ?? 1;
}

/** GET de un contador: su valor en la ventana viva, o 0. */
export async function leerContador(clave: string): Promise<number> {
  const filas = await prisma.$queryRaw<{ valor: number }[]>`
    SELECT "valor" FROM "contadores"
    WHERE "clave" = ${clave} AND "expiraEn" > now()`;
  return Number(filas[0]?.valor ?? 0);
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
