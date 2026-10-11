import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import Redis from "ioredis";
import { prisma } from "../../../src/lib/prisma.js";
import { acquireLock, releaseLock } from "../../../src/lib/bookingLock.js";
import {
  cerrarRedisDeCompatibilidad,
  compatibilidadActiva,
  conectarRedisDeCompatibilidad,
} from "../../../src/lib/redisDeCompatibilidad.js";
import { resetDb } from "../helpers/db.js";
import {
  crearProxyTcp,
  destinoDe,
  urlAtravesDelProxy,
} from "../helpers/proxyTcp.js";

// Convivencia durante el despliegue del PR A: la revisión vieja (N-1) solo
// conoce Redis y coge los cerrojos con SET NX PX y los suelta con el Lua de
// compare-and-delete de la lib/bookingLock.ts de antes; la nueva los coge en
// Postgres y, en modo compatibilidad, también en Redis con la misma clave.
// Aquí la revisión vieja es un cliente ioredis aparte contra el mismo Redis
// real, con exactamente los comandos que mandaba.

const LUA_SOLTAR_VIEJO = `if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end`;

/** Lo que hacía `acquireLock` en la revisión vieja (un solo intento). */
async function cogerComoRevisionVieja(
  viejo: Redis,
  clave: string,
  token: string,
  ttlMs = 45_000
): Promise<boolean> {
  return (await viejo.set(clave, token, "PX", ttlMs, "NX")) === "OK";
}

async function soltarComoRevisionVieja(
  viejo: Redis,
  clave: string,
  token: string
): Promise<void> {
  await viejo.eval(LUA_SOLTAR_VIEJO, 1, clave, token);
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function filasEnPostgres(clave: string): Promise<number> {
  const filas = await prisma.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS "n" FROM "cerrojos" WHERE "clave" = ${clave}`;
  return filas[0].n;
}

describe("convivencia con una revisión vieja que solo usa Redis", () => {
  let viejo: Redis;

  beforeAll(async () => {
    await conectarRedisDeCompatibilidad();
    viejo = new Redis(process.env.REDIS_URL as string);
  });
  afterAll(async () => {
    await viejo.quit();
  });
  beforeEach(async () => {
    await resetDb();
  });

  it("corre en modo compatibilidad (REDIS_URL presente)", () => {
    expect(compatibilidadActiva()).toBe(true);
  });

  it("con el cerrojo cogido por la revisión vieja, la nueva no entra (y no deja fila en Postgres)", async () => {
    expect(
      await cogerComoRevisionVieja(viejo, "booking_lock:biz", "viejo")
    ).toBe(true);

    const token = await acquireLock("booking_lock:biz", 45_000, 600);

    expect(token).toBeNull();
    expect(await viejo.get("booking_lock:biz")).toBe("viejo");
    expect(await filasEnPostgres("booking_lock:biz")).toBe(0);
  });

  it("en cuanto la revisión vieja suelta, la nueva entra dentro de su presupuesto", async () => {
    await cogerComoRevisionVieja(viejo, "booking_lock:biz", "viejo");
    setTimeout(
      () => void soltarComoRevisionVieja(viejo, "booking_lock:biz", "viejo"),
      400
    );

    const token = await acquireLock("booking_lock:biz", 45_000, 3_000);

    expect(token).not.toBeNull();
    expect(await viejo.get("booking_lock:biz")).toBe(token);
    expect(await filasEnPostgres("booking_lock:biz")).toBe(1);
  });

  it("al revés: con el cerrojo nuevo cogido, el SET NX de la vieja da null; al liberar, la clave desaparece de los dos almacenes", async () => {
    const token = await acquireLock("booking_lock:biz", 45_000, 0);
    expect(token).not.toBeNull();

    expect(
      await cogerComoRevisionVieja(viejo, "booking_lock:biz", "viejo")
    ).toBe(false);
    // La vieja tampoco puede soltar un cerrojo que no es suyo.
    await soltarComoRevisionVieja(viejo, "booking_lock:biz", "viejo");
    expect(await viejo.get("booking_lock:biz")).toBe(token);

    await releaseLock("booking_lock:biz", token as string);

    expect(await viejo.get("booking_lock:biz")).toBeNull();
    expect(await filasEnPostgres("booking_lock:biz")).toBe(0);
    expect(
      await cogerComoRevisionVieja(viejo, "booking_lock:biz", "viejo")
    ).toBe(true);
  });

  it("el TTL que pone la nueva en Redis es el del cerrojo, para que la vieja no quede fuera para siempre si la nueva muere", async () => {
    const token = await acquireLock("phone_provision_lock:biz", 60_000, 0);
    expect(token).not.toBeNull();

    const pttl = await viejo.pttl("phone_provision_lock:biz");
    expect(pttl).toBeGreaterThan(55_000);
    expect(pttl).toBeLessThanOrEqual(60_000);
  });

  it("60 rondas de una revisión vieja y una nueva compitiendo por la misma clave: nunca entran las dos y cada una gana alguna vez", async () => {
    // La nueva pasa primero por Postgres y llega a Redis un viaje más tarde.
    // Con el SET de la vieja enviado en el acto gana la vieja; con 40 ms de
    // retraso, la nueva; y con 1 a 8 ms, lo que salga de la carrera.
    const desfasesMs = [null, 1, 2, 3, null, 4, 5, 6, null, 8, 40, 40];
    let ganoLaVieja = 0;
    let ganoLaNueva = 0;
    for (let ronda = 0; ronda < 60; ronda += 1) {
      const clave = `booking_lock:carrera-${ronda}`;
      const desfase = desfasesMs[ronda % desfasesMs.length];
      const coger = () =>
        cogerComoRevisionVieja(viejo, clave, `viejo-${ronda}`);
      const [vieja, nueva] = await Promise.all([
        desfase === null ? coger() : esperar(desfase).then(coger),
        acquireLock(clave, 45_000, 0),
      ]);
      expect(
        [vieja, nueva !== null].filter(Boolean),
        `ronda ${ronda} (desfase ${desfase ?? 0} ms)`
      ).toHaveLength(1);
      if (vieja) {
        ganoLaVieja += 1;
        // Si ganó la vieja, la nueva no deja su fila en Postgres.
        expect(await filasEnPostgres(clave), `ronda ${ronda}`).toBe(0);
        expect(await viejo.get(clave)).toBe(`viejo-${ronda}`);
      } else {
        ganoLaNueva += 1;
        expect(await viejo.get(clave)).toBe(nueva);
        expect(await filasEnPostgres(clave), `ronda ${ronda}`).toBe(1);
      }
    }
    expect(ganoLaVieja + ganoLaNueva).toBe(60);
    // Las dos ramas se han ejercitado de verdad.
    expect(ganoLaVieja).toBeGreaterThan(0);
    expect(ganoLaNueva).toBeGreaterThan(0);
  });

  it("la vieja coge Redis cuando la nueva ya tiene la fila de Postgres (Redis lento): la nueva se retira y borra su fila", async () => {
    // El hueco peligroso: la nueva ya ganó en Postgres y su SET va de camino
    // a Redis. Con 150 ms de retraso entre el cliente de compatibilidad y
    // Redis, la vieja entra justo en ese hueco, siempre.
    const URL_REAL = process.env.REDIS_URL as string;
    const proxy = crearProxyTcp(destinoDe(URL_REAL));
    const puerto = await proxy.escuchar();
    await cerrarRedisDeCompatibilidad();
    process.env.REDIS_URL = urlAtravesDelProxy(URL_REAL, puerto);
    try {
      await conectarRedisDeCompatibilidad();
      proxy.retrasar(150);

      for (let ronda = 0; ronda < 5; ronda += 1) {
        const clave = `booking_lock:hueco-${ronda}`;
        const nueva = acquireLock(clave, 45_000, 0);
        const limite = Date.now() + 2_000;
        while ((await filasEnPostgres(clave)) === 0) {
          if (Date.now() > limite)
            throw new Error("la nueva no llegó a Postgres");
          await esperar(2);
        }
        expect(
          await cogerComoRevisionVieja(viejo, clave, `viejo-${ronda}`),
          `ronda ${ronda}`
        ).toBe(true);

        expect(await nueva, `ronda ${ronda}`).toBeNull();
        expect(await filasEnPostgres(clave), `ronda ${ronda}`).toBe(0);
        expect(await viejo.get(clave)).toBe(`viejo-${ronda}`);
      }
    } finally {
      await cerrarRedisDeCompatibilidad();
      process.env.REDIS_URL = URL_REAL;
      await conectarRedisDeCompatibilidad();
      await proxy.cerrar();
    }
  });
});
