import { prisma } from "./prisma.js";

/**
 * Rachas del health-check de Telnyx (`jobs/telnyxHealthCheck.ts`) en una sola
 * fila de `salud_telnyx` (antes dos contadores de Redis con caducidad).
 *
 * Cloud Scheduler entrega al menos una vez: la misma lectura puede llegar
 * dos veces, incluso a la vez en dos instancias, y con dos lecturas malas
 * seguidas se mueve todo el tráfico a Retell. Por eso cada lectura lleva su
 * tick (la hora programada del Scheduler, igual en todas las entregas de esa
 * ejecución) y solo cuenta si es posterior al último contado. Todo va en una
 * sentencia: la fila queda bloqueada mientras se decide, así que de dos
 * entregas simultáneas solo una cuenta.
 */

/** Una racha cuya última lectura es más vieja que esto no sigue: empieza de
 * nuevo. Algo más que dos ticks del Scheduler (cada 2 minutos). */
export const VIDA_DE_LA_RACHA_MINUTOS = 30;

const CADENCIA_DEL_SCHEDULER_SEGUNDOS = 120;

export type RachasDeSalud = { malas: number; buenas: number };

/**
 * Tick de la lectura en segundos desde 1970: la cabecera
 * `X-CloudScheduler-ScheduleTime` si viene (RFC 3339), y si no (llamada a
 * mano, dev) el tramo de 2 minutos en curso.
 */
export function tickDeLaLectura(
  horaProgramada: string | undefined,
  ahoraMs = Date.now()
): bigint {
  const programadaMs = horaProgramada ? Date.parse(horaProgramada) : NaN;
  if (Number.isFinite(programadaMs)) {
    return BigInt(Math.floor(programadaMs / 1000));
  }
  const tramo = Math.floor(ahoraMs / 1000 / CADENCIA_DEL_SCHEDULER_SEGUNDOS);
  return BigInt(tramo * CADENCIA_DEL_SCHEDULER_SEGUNDOS);
}

/** Anota una lectura: sana suma a la racha buena y pone a cero la mala, y al
 * revés. Devuelve las rachas tras anotarla, o null si el tick ya estaba
 * contado (entrega repetida o atrasada): entonces no cambia nada. */
export async function anotarLecturaDeSalud(
  sana: boolean,
  tick: bigint
): Promise<RachasDeSalud | null> {
  // Con el WHERE del ON CONFLICT, un tick ya contado no actualiza la fila y
  // no devuelve nada; la segunda de dos entregas simultáneas espera al
  // bloqueo de la primera y luego ve su tick.
  const filas = await prisma.$queryRaw<RachasDeSalud[]>`
    INSERT INTO "salud_telnyx" AS s ("id", "malas", "buenas", "ultimoTick", "actualizadoEn")
    VALUES ('telnyx', ${sana ? 0 : 1}, ${sana ? 1 : 0}, ${tick}, now())
    ON CONFLICT ("id") DO UPDATE SET
      "malas" = CASE
        WHEN ${sana}::boolean THEN 0
        WHEN s."actualizadoEn" <= now() - make_interval(mins => ${VIDA_DE_LA_RACHA_MINUTOS}::int) THEN 1
        ELSE s."malas" + 1
      END,
      "buenas" = CASE
        WHEN NOT ${sana}::boolean THEN 0
        WHEN s."actualizadoEn" <= now() - make_interval(mins => ${VIDA_DE_LA_RACHA_MINUTOS}::int) THEN 1
        ELSE s."buenas" + 1
      END,
      "ultimoTick" = EXCLUDED."ultimoTick",
      "actualizadoEn" = now()
    WHERE s."ultimoTick" < EXCLUDED."ultimoTick"
    RETURNING "malas", "buenas"
  `;
  return filas[0] ?? null;
}

/** Pone a cero la racha buena tras el failback, para que los ticks
 * siguientes no lo repitan. */
export async function reiniciarRachaBuena(): Promise<void> {
  await prisma.$executeRaw`UPDATE "salud_telnyx" SET "buenas" = 0 WHERE "id" = 'telnyx'`;
}
