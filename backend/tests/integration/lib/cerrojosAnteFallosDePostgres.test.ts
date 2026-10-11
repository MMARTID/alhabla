import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  afterEach,
} from "vitest";
import { PrismaClient } from "@prisma/client";
import { prisma } from "../../../src/lib/prisma.js";
import {
  acquireBookingLock,
  acquireLock,
  releaseBookingLock,
  releaseLock,
} from "../../../src/lib/bookingLock.js";
import {
  cerrarRedisDeCompatibilidad,
  conectarRedisDeCompatibilidad,
} from "../../../src/lib/redisDeCompatibilidad.js";
import { resetDb } from "../helpers/db.js";

// Cerrojos en modo «solo Postgres» (el de la fase 2, sin REDIS_URL) contra el
// Postgres real a través de un proxy TCP: un corte de las conexiones del pool
// y respuestas que llegan tarde, con `connection_limit=2` como producción.

const { proxy, urlViaProxy } = await vi.hoisted(async () => {
  const { crearProxyTcp } = await import("../helpers/proxyTcp.js");
  const real = new URL(process.env.DATABASE_URL as string);
  const proxy = crearProxyTcp({
    host: real.hostname,
    port: Number(real.port || 5432),
  });
  const puerto = await proxy.escuchar();
  const via = new URL(real.toString());
  via.hostname = "127.0.0.1";
  via.port = String(puerto);
  via.searchParams.set("connection_limit", "2");
  return { proxy, urlViaProxy: via.toString() };
});

vi.mock("../../../src/lib/prisma.js", async () => {
  const { PrismaClient } = await import("@prisma/client");
  return { prisma: new PrismaClient({ datasourceUrl: urlViaProxy }) };
});

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Para mirar la tabla sin pasar por el proxy.
const directo = new PrismaClient();

async function tokensDe(clave: string): Promise<string[]> {
  const filas = await directo.$queryRaw<{ token: string }[]>`
    SELECT "token" FROM "cerrojos" WHERE "clave" = ${clave}`;
  return filas.map((f) => f.token);
}

describe("cerrojos ante fallos de Postgres (solo Postgres, Postgres real)", () => {
  beforeAll(async () => {
    await resetDb();
    await cerrarRedisDeCompatibilidad();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    proxy.retrasarRespuestas(0);
    proxy.reanudar();
  });
  afterAll(async () => {
    await prisma.$disconnect();
    await directo.$disconnect();
    await proxy.cerrar();
    // Se deja el proceso como lo dejó setup.ts.
    await conectarRedisDeCompatibilidad();
  });

  it("con Postgres inalcanzable un momento, acquireBookingLock reintenta dentro de su presupuesto y lo consigue", async () => {
    const errores = vi.spyOn(console, "error").mockImplementation(() => {});
    // Sin conexiones abiertas: la primera hay que abrirla y el proxy la corta
    // durante 100 ms (Cloud SQL reiniciándose).
    await prisma.$disconnect();
    proxy.cortar();
    setTimeout(() => proxy.reanudar(), 100);

    const inicio = Date.now();
    const token = await acquireBookingLock("biz-corte");

    expect(token).not.toBeNull();
    // El primer intento falló y el bueno salió tras la espera de 300 ms.
    expect(Date.now() - inicio).toBeGreaterThanOrEqual(250);
    expect(Date.now() - inicio).toBeLessThan(2_000);
    const filas = await prisma.$queryRaw<{ token: string }[]>`
      SELECT "token" FROM "cerrojos" WHERE "clave" = 'booking_lock:biz-corte'`;
    expect(filas).toEqual([{ token }]);
    expect(errores).not.toHaveBeenCalledWith(
      expect.stringContaining("No se pudo coger")
    );
    await releaseBookingLock("biz-corte", token!);
  });

  it("una respuesta que llega con medio TTL gastado no da el cerrojo y no deja la fila", async () => {
    const errores = vi.spyOn(console, "error").mockImplementation(() => {});
    proxy.retrasarRespuestas(600);

    const token = await acquireLock("lock:respuesta-lenta", 1_000, 0);

    expect(token).toBeNull();
    expect(errores).toHaveBeenCalledWith(
      expect.stringContaining("Postgres tardó")
    );
    proxy.retrasarRespuestas(0);
    const filas = await prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS "n" FROM "cerrojos"
      WHERE "clave" = 'lock:respuesta-lenta'`;
    expect(filas[0].n).toBe(0);
    // Y con respuestas a tiempo se coge al momento.
    await esperar(10);
    expect(await acquireLock("lock:respuesta-lenta", 1_000, 0)).not.toBeNull();
  });

  // Con medio TTL como único tope, una reserva (45 s) concedida a los 12,5 s
  // tendría 32,5 s, y su sección crítica dura hasta ~32 s con Outlook. Con el
  // tope de 12 s, quien recibe el cerrojo tiene al menos 33 s.
  it("con un TTL de 45 s, una respuesta que tarda más de 12 s no da el cerrojo y no deja la fila", async () => {
    const errores = vi.spyOn(console, "error").mockImplementation(() => {});
    const clave = "booking_lock:biz-respuesta-de-12-s";
    // Las dos conexiones del pool abiertas y con la sentencia ya preparada:
    // con las respuestas retrasadas, una preparación nueva haría dos viajes.
    for (let i = 0; i < 3; i += 1) {
      const tokens = await Promise.all([
        acquireLock(`${clave}:a`, 1_000, 0),
        acquireLock(`${clave}:b`, 1_000, 0),
      ]);
      await releaseLock(`${clave}:a`, tokens[0]!);
      await releaseLock(`${clave}:b`, tokens[1]!);
    }
    proxy.retrasarRespuestas(12_500);

    const promesa = acquireLock(clave, 45_000, 0);
    // El INSERT ya se confirmó en Postgres y su respuesta espera en el
    // proxy; el DELETE de la fila propia ya no se retrasa.
    const limite = Date.now() + 5_000;
    while ((await tokensDe(clave)).length === 0 && Date.now() < limite) {
      await esperar(50);
    }
    expect(await tokensDe(clave)).toHaveLength(1);
    proxy.retrasarRespuestas(0);
    const token = await promesa;

    expect(token).toBeNull();
    expect(errores).toHaveBeenCalledWith(
      expect.stringContaining("en confirmar un arrendamiento de 45000 ms")
    );
    expect(await tokensDe(clave)).toEqual([]);
  }, 30_000);

  // Un P1017 puede llegar con el INSERT ya confirmado: Postgres lo ejecuta y
  // la conexión se cierra antes de que llegue la respuesta. Sin borrar esa
  // fila, el cerrojo quedaba a nombre de un token que nadie tiene y los
  // reintentos daban «ocupado» hasta que caducara (45 s en las reservas).
  it("si Postgres confirma el INSERT y la conexión se cierra antes de la respuesta (P1017), borra esa fila y lo consigue al reintentar", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const clave = "lock:p1017-confirmado";
    // Las dos conexiones del pool abiertas y con la sentencia ya preparada:
    // con las respuestas retrasadas, una conexión o una preparación nuevas no
    // llegarían a ejecutar el INSERT antes del corte.
    for (let i = 0; i < 3; i += 1) {
      const tokens = await Promise.all([
        acquireLock(`${clave}:a`, 1_000, 0),
        acquireLock(`${clave}:b`, 1_000, 0),
      ]);
      await releaseLock(`${clave}:a`, tokens[0]!);
      await releaseLock(`${clave}:b`, tokens[1]!);
    }
    proxy.retrasarRespuestas(1_500);

    const promesa = acquireLock(clave, 45_000, 2_000);
    await esperar(300);
    // Confirmado en Postgres aunque la respuesta aún no ha llegado.
    const antes = await tokensDe(clave);
    expect(antes).toHaveLength(1);
    proxy.cortar();
    await esperar(50);
    proxy.retrasarRespuestas(0);
    proxy.reanudar();
    const token = await promesa;

    expect(token).not.toBeNull();
    expect(token).not.toBe(antes[0]);
    expect(await tokensDe(clave)).toEqual([token]);
    await releaseLock(clave, token!);
  });
});
