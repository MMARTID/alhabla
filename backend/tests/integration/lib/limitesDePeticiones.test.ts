import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { prisma } from "../../../src/lib/prisma.js";
import * as procesoA from "../../../src/lib/limitesDePeticiones.js";
import { resetDb } from "../helpers/db.js";
import { leerContador } from "../helpers/contadores.js";

// @fastify/rate-limit real con el almacén de Postgres y las mismas opciones
// que server.ts (100/min global, skipOnError y el mismo errorResponseBuilder).
// La sentencia en vuelo, la cola, las cuentas y el cortacircuitos son estado
// del módulo (uno por proceso), así que cada «instancia de Cloud Run» de estos
// tests es una aplicación Fastify sobre su PROPIA copia del módulo: la
// segunda se carga con otra URL (`?proceso=b`), con su propia conexión del
// limitador, como en producción. Las dos solo comparten la tabla
// `contadores`.
type ModuloDeLimites = typeof procesoA;
const procesoB =
  (await import("../../../src/lib/limitesDePeticiones.js?proceso=b")) as ModuloDeLimites;
const procesos = [procesoA, procesoB];

const IP = "203.0.113.7";

async function crearInstancia(
  modulo: ModuloDeLimites
): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    store: modulo.AlmacenDeLimites,
    skipOnError: true,
    errorResponseBuilder: (_req, context) => ({
      statusCode: 429,
      error: "Too Many Requests",
      message: `Rate limit exceeded. Retry in ${context.after}`,
    }),
  });
  app.get("/ping", async () => ({ ok: true }));
  app.post(
    "/ruta",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async () => ({ ok: true })
  );
  app.post(
    "/corta",
    { config: { rateLimit: { max: 2, timeWindow: 300 } } },
    async () => ({ ok: true })
  );
  app.post(
    "/tres",
    { config: { rateLimit: { max: 3, timeWindow: "1 minute" } } },
    async () => ({ ok: true })
  );
  // Como /webhooks/telnyx y /webhooks/retell (300/min), con un máximo bajo.
  app.post(
    "/webhooks/telnyx-prueba",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async () => ({ received: true })
  );
  app.post("/interna", { config: { rateLimit: false } }, async () => ({
    ok: true,
  }));
  await app.ready();
  return app;
}

function pedir(
  app: FastifyInstance,
  method: "GET" | "POST",
  url: string,
  ip = IP
) {
  return app.inject({ method, url, remoteAddress: ip });
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Espera a que el limitador no tenga ninguna sentencia en vuelo en ninguno
 * de los dos procesos (una que venció su plazo puede seguir escribiendo). */
async function enReposo(): Promise<void> {
  const limite = Date.now() + 5_000;
  const enVuelo = () =>
    procesos.reduce((n, m) => n + m.consultasDeLimitesEnVueloParaTests(), 0);
  while (enVuelo() > 0) {
    if (Date.now() > limite) throw new Error("el limitador no queda en reposo");
    await esperar(5);
  }
}

/** `n` peticiones a la vez (un cliente con muchas conexiones). */
async function rafaga(
  app: FastifyInstance,
  method: "GET" | "POST",
  url: string,
  n: number,
  ip = IP
): Promise<number> {
  const respuestas = await Promise.all(
    Array.from({ length: n }, () => pedir(app, method, url, ip))
  );
  return respuestas.filter((r) => r.statusCode === 200).length;
}

describe("límite de peticiones sobre Postgres (Fastify real)", () => {
  const abiertas: FastifyInstance[] = [];
  /** Una instancia de Cloud Run: por defecto en el proceso A; la otra de
   * cada test con dos va en el B. */
  const instancia = async (modulo: ModuloDeLimites = procesoA) => {
    const app = await crearInstancia(modulo);
    abiertas.push(app);
    return app;
  };

  beforeEach(async () => {
    await resetDb();
    for (const m of procesos) m.reiniciarEstadoDeLimitesParaTests();
  });
  afterEach(async () => {
    // Que ningún vaciado de este test escriba en `contadores` ya en el
    // siguiente, después de su resetDb.
    await enReposo();
    await Promise.all(abiertas.splice(0).map((a) => a.close()));
  });
  afterAll(async () => {
    // Cada «instancia» abrió su conexión propia del limitador.
    for (const m of procesos) await m.cerrarConexionDelLimitador();
  });

  it("las dos «instancias» son dos copias del módulo, con su propio estado", () => {
    expect(procesoB.AlmacenDeLimites).not.toBe(procesoA.AlmacenDeLimites);
  });

  it("la petición 101 del límite global da 429 con las cabeceras x-ratelimit-*", async () => {
    const app = await instancia();

    for (let i = 1; i <= 100; i += 1) {
      const r = await pedir(app, "GET", "/ping");
      expect(r.statusCode, `petición ${i}`).toBe(200);
      expect(r.headers["x-ratelimit-limit"]).toBe("100");
      expect(r.headers["x-ratelimit-remaining"]).toBe(String(100 - i));
    }
    const pasada = await pedir(app, "GET", "/ping");

    expect(pasada.statusCode).toBe(429);
    expect(pasada.json()).toMatchObject({
      statusCode: 429,
      error: "Too Many Requests",
    });
    expect(pasada.json().message).toMatch(/^Rate limit exceeded\. Retry in /);
    expect(pasada.headers["x-ratelimit-remaining"]).toBe("0");
    expect(Number(pasada.headers["retry-after"])).toBeGreaterThan(0);
    // La 101 también se cuenta (como el INCR de Redis) y deja la clave
    // bloqueada en local hasta que acabe la ventana.
    expect(await leerContador(`ratelimit:${IP}`)).toBe(101);
  });

  it("una ruta con max 10 corta en la 11 y cuenta en ratelimit:POST/ruta-<ip>", async () => {
    const app = await instancia();

    const codigos = [];
    for (let i = 0; i < 11; i += 1) {
      codigos.push((await pedir(app, "POST", "/ruta")).statusCode);
    }

    expect(codigos).toEqual([...Array(10).fill(200), 429]);
    // Las once, contadas en la BD: la 11 es la que dijo «pasado».
    expect(await leerContador(`ratelimit:POST/ruta-${IP}`)).toBe(11);
    // El límite de la ruta no cuenta en el global.
    expect(await leerContador(`ratelimit:${IP}`)).toBe(0);
  });

  it("dos instancias comparten el contador: el límite es global, no por instancia", async () => {
    const a = await instancia();
    const b = await instancia(procesoB);

    const codigos = [];
    for (let i = 0; i < 10; i += 1) {
      codigos.push(
        (await pedir(i % 2 === 0 ? a : b, "POST", "/ruta")).statusCode
      );
    }
    // Cada instancia solo ha visto 5: en memoria las dos dejarían pasar más.
    expect(codigos).toEqual(Array(10).fill(200));
    expect((await pedir(a, "POST", "/ruta")).statusCode).toBe(429);
    expect((await pedir(b, "POST", "/ruta")).statusCode).toBe(429);
    expect(await leerContador(`ratelimit:POST/ruta-${IP}`)).toBe(12);

    // Otra IP no comparte cubo.
    expect((await pedir(a, "POST", "/ruta", "198.51.100.1")).statusCode).toBe(
      200
    );
  });

  it("con una ventana de 300 ms el contador se reinicia al caducar", async () => {
    const app = await instancia();

    const antes = [];
    for (let i = 0; i < 3; i += 1) {
      antes.push((await pedir(app, "POST", "/corta")).statusCode);
    }
    expect(antes).toEqual([200, 200, 429]);

    await esperar(400);
    expect((await pedir(app, "POST", "/corta")).statusCode).toBe(200);
    expect(await leerContador(`ratelimit:POST/corta-${IP}`)).toBe(1);
  });

  it("una ruta de /webhooks/* también limita de forma síncrona y global (D2): cada petición ya está contada al responder", async () => {
    const a = await instancia();
    const b = await instancia(procesoB);
    const clave = `ratelimit:POST/webhooks/telnyx-prueba-${IP}`;

    for (let i = 1; i <= 5; i += 1) {
      const r = await pedir(
        i % 2 === 0 ? b : a,
        "POST",
        "/webhooks/telnyx-prueba"
      );
      expect(r.statusCode, `petición ${i}`).toBe(200);
      // Síncrono: el contador global ya incluye esta petición al responder.
      expect(await leerContador(clave)).toBe(i);
      expect(r.headers["x-ratelimit-remaining"]).toBe(String(5 - i));
    }

    // La sexta, sin esperar a ningún vaciado, en cualquiera de las dos.
    expect((await pedir(b, "POST", "/webhooks/telnyx-prueba")).statusCode).toBe(
      429
    );
    expect((await pedir(a, "POST", "/webhooks/telnyx-prueba")).statusCode).toBe(
      429
    );
  });

  it("ráfagas concurrentes en una instancia: 30 ráfagas de 20 contra una ruta de max 10 dejan pasar exactamente 10", async () => {
    const app = await instancia();

    let pasan = 0;
    for (let i = 0; i < 30; i += 1) {
      pasan += await rafaga(app, "POST", "/ruta", 20);
    }

    expect(pasan).toBe(10);
    await enReposo();
    // La primera fue sola y las de detrás en lote: todas contadas en
    // Postgres hasta que la clave quedó bloqueada.
    expect(await leerContador(`ratelimit:POST/ruta-${IP}`)).toBeGreaterThan(10);
  });

  it("ráfagas concurrentes en el límite global: 20 ráfagas de 150 dejan pasar exactamente 100", async () => {
    const app = await instancia();

    let pasan = 0;
    for (let i = 0; i < 20; i += 1) {
      pasan += await rafaga(app, "GET", "/ping", 150);
    }

    expect(pasan).toBe(100);
  });

  it("una ráfaga en una instancia queda contada en Postgres: la otra ya no deja pasar ninguna", async () => {
    const a = await instancia();
    const b = await instancia(procesoB);
    const clave = `ratelimit:POST/ruta-${IP}`;

    expect(await rafaga(a, "POST", "/ruta", 20)).toBe(10);
    await enReposo();
    // Ninguna se decidió en local: todas están en el global.
    expect(await leerContador(clave)).toBeGreaterThan(10);

    for (let i = 0; i < 5; i += 1) {
      expect((await pedir(b, "POST", "/ruta")).statusCode).toBe(429);
    }
    expect(await rafaga(b, "POST", "/ruta", 10)).toBe(0);
  });

  it("dos instancias con ráfagas alternas: en total pasan exactamente max", async () => {
    const a = await instancia();
    const b = await instancia(procesoB);

    let pasan = 0;
    for (let i = 0; i < 10; i += 1) {
      pasan += await rafaga(i % 2 === 0 ? a : b, "POST", "/ruta", 5);
      await enReposo();
    }

    expect(pasan).toBe(10);
  });

  it("dos instancias con ráfagas simultáneas: entre las dos pasan exactamente max", async () => {
    const a = await instancia();
    const b = await instancia(procesoB);
    const clave = `ratelimit:POST/ruta-${IP}`;

    const [enA, enB] = await Promise.all([
      rafaga(a, "POST", "/ruta", 15),
      rafaga(b, "POST", "/ruta", 15),
    ]);
    await enReposo();

    // Cada petición recibe su posición en el global (D2): ninguna instancia
    // decide a ciegas lo que la otra ya ha dejado pasar.
    expect(enA + enB).toBe(10);
    expect(await leerContador(clave)).toBeGreaterThan(10);
    expect((await pedir(a, "POST", "/ruta")).statusCode).toBe(429);
    expect((await pedir(b, "POST", "/ruta")).statusCode).toBe(429);
  });

  it("dos instancias y 40 IPs a la vez: con max 3 pasan exactamente 3 por IP (ninguna se decide en local con la sentencia de otra clave en vuelo)", async () => {
    const a = await instancia();
    const b = await instancia(procesoB);
    const ips = Array.from({ length: 40 }, (_, i) => `198.51.100.${i + 10}`);

    const pasadas = await Promise.all(
      ips.map(async (ip) => {
        const [enA, enB] = await Promise.all([
          rafaga(a, "POST", "/tres", 3, ip),
          rafaga(b, "POST", "/tres", 3, ip),
        ]);
        return enA + enB;
      })
    );
    await enReposo();

    expect(pasadas).toEqual(ips.map(() => 3));
  });

  it("con la sentencia en vuelo esperando un bloqueo de fila de otra clave, la ráfaga de detrás espera y cuenta en Postgres: entre las dos instancias pasan exactamente max", async () => {
    const a = await instancia();
    const b = await instancia(procesoB);
    const otra = "192.0.2.200";
    await pedir(a, "POST", "/webhooks/telnyx-prueba", otra); // crea su fila

    // Una transacción bloquea la fila de la otra IP 150 ms (menos que el
    // plazo): la sentencia de A que la cuenta se queda esperando.
    const bloqueo = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT 1 FROM "contadores"
        WHERE "clave" = ${`ratelimit:POST/webhooks/telnyx-prueba-${otra}`}
        FOR UPDATE`;
      await esperar(150);
    });
    await esperar(20);
    const enVuelo = pedir(a, "POST", "/webhooks/telnyx-prueba", otra);
    await esperar(20);
    const [enA, enB] = await Promise.all([
      rafaga(a, "POST", "/webhooks/telnyx-prueba", 5),
      (async () => {
        await esperar(25);
        return rafaga(b, "POST", "/webhooks/telnyx-prueba", 5);
      })(),
    ]);
    await bloqueo;
    expect((await enVuelo).statusCode).toBe(200);
    await enReposo();

    expect(enA + enB).toBe(5);
  });

  it("una ruta con rateLimit: false (las de /internal/jobs) no cuenta nada", async () => {
    const app = await instancia();

    for (let i = 0; i < 3; i += 1) {
      expect((await pedir(app, "POST", "/interna")).statusCode).toBe(200);
    }
    const filas = await prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS "n" FROM "contadores"`;
    expect(filas[0].n).toBe(0);
  });
});
