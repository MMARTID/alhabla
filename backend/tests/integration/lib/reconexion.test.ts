import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
  vi,
} from "vitest";
import Redis from "ioredis";
import { prisma } from "../../../src/lib/prisma.js";
import { acquireLock, releaseLock } from "../../../src/lib/bookingLock.js";
import {
  cerrarRedisDeCompatibilidad,
  conectarRedisDeCompatibilidad,
  redisDeCompatibilidadListo,
} from "../../../src/lib/redisDeCompatibilidad.js";
import { resetDb } from "../helpers/db.js";
import {
  crearProxyTcp,
  destinoDe,
  urlAtravesDelProxy,
} from "../helpers/proxyTcp.js";

// Un corte breve de la conexión con el Redis de compatibilidad (el cliente
// reconecta en 200-600 ms). Las revisiones viejas lo aguantan sin errores
// gracias a su cola offline; la nueva, sin cola, tiene que aguantarlo por su
// cuenta: reintentando dentro del presupuesto al coger y reenviando el
// compare-and-delete al reconectar al soltar. Redis real detrás de un proxy
// TCP que corta de verdad las dos patas.

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("cerrojos en modo compatibilidad ante un corte breve de Redis (Redis real)", () => {
  const URL_REAL = process.env.REDIS_URL as string;
  let viejo: Redis;
  let proxy: ReturnType<typeof crearProxyTcp>;

  beforeAll(async () => {
    viejo = new Redis(URL_REAL);
  });
  afterAll(async () => {
    await viejo.quit();
  });
  beforeEach(async () => {
    await resetDb();
    vi.spyOn(console, "error").mockImplementation(() => {});
    proxy = crearProxyTcp(destinoDe(URL_REAL));
    const puerto = await proxy.escuchar();
    await cerrarRedisDeCompatibilidad();
    process.env.REDIS_URL = urlAtravesDelProxy(URL_REAL, puerto);
    await conectarRedisDeCompatibilidad();
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    // Se deja el proceso como lo dejó setup.ts.
    await cerrarRedisDeCompatibilidad();
    process.env.REDIS_URL = URL_REAL;
    await conectarRedisDeCompatibilidad();
    await proxy.cerrar();
  });

  it("acquireLock con 6 s de presupuesto lo consigue aunque Redis se corte justo antes: reintenta hasta que reconecta", async () => {
    const clave = "booking_lock:corte-al-coger";
    proxy.cortar();
    await esperar(20);
    expect(redisDeCompatibilidadListo()).toBe(false);
    setTimeout(() => proxy.reanudar(), 250);

    const inicio = Date.now();
    const token = await acquireLock(clave, 45_000, 6_000);

    expect(token).not.toBeNull();
    expect(Date.now() - inicio).toBeLessThan(6_000);
    // Cogido de verdad en Redis: una revisión vieja no entraría.
    expect(await viejo.get(clave)).toBe(token);
    expect(await viejo.set(clave, "revision-vieja", "PX", 45_000, "NX")).toBe(
      null
    );
    await releaseLock(clave, token as string);
    expect(await viejo.get(clave)).toBeNull();
  });

  it("un releaseLock durante el corte no deja la clave en Redis: el compare-and-delete sale al reconectar", async () => {
    const clave = "booking_lock:corte-al-soltar";
    const token = await acquireLock(clave, 45_000, 0);
    expect(token).not.toBeNull();
    proxy.cortar();
    await esperar(20);

    await releaseLock(clave, token as string);
    // Durante el corte la clave sigue en Redis con nuestro token…
    expect(await viejo.get(clave)).toBe(token);

    proxy.reanudar();
    const limite = Date.now() + 5_000;
    while ((await viejo.get(clave)) !== null && Date.now() < limite) {
      await esperar(25);
    }
    // …y en cuanto el cliente reconecta desaparece, sin esperar a sus 45 s.
    expect(await viejo.get(clave)).toBeNull();
    const siguiente = await acquireLock(clave, 45_000, 0);
    expect(siguiente).not.toBeNull();
    await releaseLock(clave, siguiente as string);
  });

  it("con presupuesto 0 y Redis cortado falla cerrado en el acto, sin dejar nada en ningún almacén", async () => {
    const clave = "booking_lock:corte-sin-presupuesto";
    proxy.cortar();
    await esperar(20);

    expect(await acquireLock(clave, 45_000, 0)).toBeNull();
    expect(await viejo.get(clave)).toBeNull();
    const filas = await prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS "n" FROM "cerrojos" WHERE "clave" = ${clave}`;
    expect(filas[0].n).toBe(0);
  });
});
