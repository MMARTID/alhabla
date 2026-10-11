import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { prisma } from "../../../src/lib/prisma.js";
import {
  AlmacenDeLimites,
  cerrarConexionDelLimitador,
  consultasDeLimitesEnVueloParaTests,
  reiniciarEstadoDeLimitesParaTests,
} from "../../../src/lib/limitesDePeticiones.js";
import { resetDb } from "../helpers/db.js";
import { leerContador } from "../helpers/contadores.js";

// El limitador contra el Postgres real con su conexión propia, como en
// producción: el pool de `prisma` con `connection_limit=2` y la conexión del
// limitador aparte, con sus plazos. En los tests de fallos, solo la conexión
// del limitador pasa por un proxy TCP (o lleva otro `socket_timeout`); las
// lecturas del test van directas.

const {
  proxy,
  urlReal,
  urlDirecta,
  urlViaProxy,
  urlDelLimitador,
  clienteDelTest,
} = await vi.hoisted(async () => {
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
  via.searchParams.set("connection_limit", "1");
  const directa = new URL(real.toString());
  directa.searchParams.set("connection_limit", "2");
  return {
    proxy,
    urlReal: real.toString(),
    urlDirecta: directa.toString(),
    urlViaProxy: via.toString(),
    /** La URL de la conexión del limitador en el test en curso, tal cual;
     * sin ella, la de producción (`crearClienteDeUnaConexion` de verdad,
     * con sus plazos, sobre DATABASE_URL). */
    urlDelLimitador: { valor: undefined as string | undefined },
    /** Un cliente ya conectado que el test da como la próxima conexión
     * del limitador (una sola vez). */
    clienteDelTest: { valor: undefined as unknown },
  };
});

vi.mock("../../../src/lib/prisma.js", async () => {
  const real = await vi.importActual<
    typeof import("../../../src/lib/prisma.js")
  >("../../../src/lib/prisma.js");
  const { PrismaClient } = await import("@prisma/client");
  return {
    ...real,
    prisma: new PrismaClient({ datasourceUrl: urlDirecta }),
    crearClienteDeUnaConexion: (parametros?: Record<string, string>) => {
      const delTest = clienteDelTest.valor as
        InstanceType<typeof PrismaClient> | undefined;
      if (delTest) {
        clienteDelTest.valor = undefined;
        return delTest;
      }
      return urlDelLimitador.valor
        ? new PrismaClient({ datasourceUrl: urlDelLimitador.valor })
        : real.crearClienteDeUnaConexion(parametros);
    },
  };
});

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const IP = "203.0.113.50";

async function crearInstancia(): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    store: AlmacenDeLimites,
    skipOnError: true,
  });
  app.get("/ping", async () => ({ ok: true }));
  app.post(
    "/cinco",
    { config: { rateLimit: { max: 5, timeWindow: "2 minutes" } } },
    async () => ({ ok: true })
  );
  app.post(
    "/diez",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async () => ({ ok: true })
  );
  await app.ready();
  return app;
}

/** Espera a que el limitador vuelva a contar en Postgres: pings con otra IP
 * hasta que su fila sube. */
async function esperarAPostgres(app: FastifyInstance): Promise<void> {
  const clave = "ratelimit:198.18.0.9";
  const limite = Date.now() + 40_000;
  while (Date.now() < limite) {
    const antes = await leerContador(clave);
    await app.inject({
      method: "GET",
      url: "/ping",
      remoteAddress: "198.18.0.9",
    });
    if ((await leerContador(clave)) > antes) return;
    await esperar(200);
  }
  throw new Error("el limitador no volvió a contar en Postgres");
}

async function enReposo(): Promise<void> {
  const limite = Date.now() + 10_000;
  while (consultasDeLimitesEnVueloParaTests() > 0 && Date.now() < limite) {
    await esperar(5);
  }
}

describe("límite de peticiones con conexión propia (Postgres real)", () => {
  let app: FastifyInstance | undefined;
  let avisos: string[] = [];

  beforeEach(async () => {
    await app?.close();
    app = undefined;
    await enReposo();
    proxy.retrasarRespuestas(0);
    proxy.reanudar();
    await cerrarConexionDelLimitador();
    reiniciarEstadoDeLimitesParaTests();
    urlDelLimitador.valor = undefined;
    clienteDelTest.valor = undefined;
    process.env.DATABASE_URL = urlReal;
    await resetDb();
    avisos = [];
    vi.restoreAllMocks();
    for (const nivel of ["warn", "error"] as const) {
      vi.spyOn(console, nivel).mockImplementation((texto: unknown) => {
        avisos.push(String(texto));
      });
    }
  });
  afterAll(async () => {
    await app?.close();
    await enReposo();
    vi.restoreAllMocks();
    proxy.reanudar();
    await cerrarConexionDelLimitador();
    process.env.DATABASE_URL = urlReal;
    await prisma.$disconnect();
    await proxy.cerrar();
  });

  it("con el pool de prisma lleno de consultas de los handlers, el limitador sigue contando en Postgres a tiempo (no espera turno detrás de ellas)", async () => {
    app = await crearInstancia();
    await app.inject({
      method: "GET",
      url: "/ping",
      remoteAddress: "198.18.0.1",
    });

    // Cuatro «handlers» con una consulta de 1 s: las dos conexiones del pool
    // ocupadas y otras dos consultas esperando turno (`then` las lanza: una
    // consulta de Prisma no sale hasta que alguien la espera).
    const handlers = Array.from({ length: 4 }, () =>
      prisma.$queryRaw`SELECT pg_sleep(1)::text AS "fin"`.then(() => {})
    );
    await esperar(100);
    const codigos: number[] = [];
    const tiempos: number[] = [];
    for (let i = 0; i < 12; i += 1) {
      const t0 = Date.now();
      const r = await app.inject({
        method: "POST",
        url: "/diez",
        remoteAddress: IP,
      });
      tiempos.push(Date.now() - t0);
      codigos.push(r.statusCode);
    }
    await Promise.all(handlers);

    expect(codigos).toEqual([...Array(10).fill(200), 429, 429]);
    // Contadas en Postgres sin esperar a los handlers: hasta la 11.ª, que
    // dejó la clave bloqueada (la 12.ª ya no consulta, como con Postgres
    // libre).
    expect(await leerContador(`ratelimit:POST/diez-${IP}`)).toBe(11);
    expect(Math.max(...tiempos)).toBeLessThan(400);
    expect(avisos.filter((t) => t.includes("[Límite]"))).toEqual([]);
  });

  it.each([
    { como: "antes del plazo", retrasoMs: 400, corteMs: 150 },
    { como: "después del plazo", retrasoMs: 1_500, corteMs: 800 },
  ])(
    "si Postgres confirma la sentencia y la conexión se cierra $como (P1017), no la cuenta dos veces: la 5.ª de 5 pasa",
    async ({ retrasoMs, corteMs }) => {
      urlDelLimitador.valor = urlViaProxy;
      app = await crearInstancia();
      const clave = `ratelimit:POST/cinco-${IP}`;
      const codigos: number[] = [];
      const pedir = async () =>
        codigos.push(
          (
            await app!.inject({
              method: "POST",
              url: "/cinco",
              remoteAddress: IP,
            })
          ).statusCode
        );
      for (let i = 0; i < 3; i += 1) await pedir();

      // La 4.ª: Postgres la ejecuta y la confirma; la respuesta se retrasa y
      // la conexión se corta antes de que llegue.
      proxy.retrasarRespuestas(retrasoMs);
      const cuarta = pedir();
      await esperar(corteMs);
      expect(await leerContador(clave)).toBe(4);
      proxy.cortar();
      await cuarta;
      proxy.retrasarRespuestas(0);
      proxy.reanudar();
      expect(
        avisos.some(
          (t) =>
            t.includes("Server has closed the connection") ||
            t.includes("plazo de 500 ms vencido")
        )
      ).toBe(true);

      await esperarAPostgres(app);
      await pedir();

      // Con INCR, las cinco pasan; si la 4.ª contara en la fila y otra vez
      // en la cuenta local, la 5.ª daría 429.
      expect(codigos).toEqual([200, 200, 200, 200, 200]);
      expect(await leerContador(clave)).toBe(5);
    },
    60_000
  );

  it("con socket_timeout, una sentencia que espera un bloqueo de fila más que el timeout falla en el cliente y Postgres la confirma después: no la cuenta dos veces", async () => {
    const conTimeout = new URL(urlDirecta);
    conTimeout.searchParams.set("connection_limit", "1");
    conTimeout.searchParams.set("socket_timeout", "1");
    urlDelLimitador.valor = conTimeout.toString();
    app = await crearInstancia();
    const clave = `ratelimit:POST/cinco-${IP}`;
    const codigos: number[] = [];
    const pedir = async () =>
      codigos.push(
        (
          await app!.inject({
            method: "POST",
            url: "/cinco",
            remoteAddress: IP,
          })
        ).statusCode
      );
    for (let i = 0; i < 3; i += 1) await pedir();

    // Otra transacción (otra instancia, la purga…) retiene la fila 2 s.
    const bloqueo = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM "contadores" WHERE "clave" = ${clave} FOR UPDATE`;
        await esperar(2_000);
      },
      { timeout: 10_000 }
    );
    await esperar(50);
    await pedir();
    await bloqueo;
    await enReposo();
    await esperar(100);
    // La 4.ª se decidió en local al vencer el plazo; el socket_timeout cortó
    // la sentencia en el cliente, pero Postgres la ejecutó al soltarse el
    // bloqueo.
    expect(avisos.some((t) => t.includes("plazo de 500 ms vencido"))).toBe(
      true
    );
    expect(await leerContador(clave)).toBe(4);

    await esperarAPostgres(app);
    await pedir();

    expect(codigos).toEqual([200, 200, 200, 200, 200]);
    expect(await leerContador(clave)).toBe(5);
  }, 60_000);

  it("con su conexión medio abierta (Postgres sano), la desecha a los 5 s y vuelve a contar en Postgres por una nueva: el límite vuelve a ser global", async () => {
    // La conexión de producción (con sus plazos), solo que por el proxy.
    process.env.DATABASE_URL = urlViaProxy;
    app = await crearInstancia();
    await app.inject({
      method: "GET",
      url: "/ping",
      remoteAddress: "198.18.0.2",
    });
    // Solo la conexión del limitador pasa por el proxy: se queda medio
    // abierta; las nuevas pasan.
    expect(proxy.congelarLasAbiertas()).toBe(1);

    const t0 = Date.now();
    await esperarAPostgres(app);
    const recuperacionMs = Date.now() - t0;
    // La primera sentencia da P2010 a los 5 s (socket_timeout) y la
    // siguiente sale por otra conexión. Sin desecharla, Prisma seguiría
    // usando la conexión muerta y nunca volvería.
    expect(recuperacionMs).toBeGreaterThan(4_500);
    expect(recuperacionMs).toBeLessThan(8_000);
    expect(
      avisos.some((t) =>
        t.includes(
          "Se desecha la conexión del limitador tras un error de su sentencia"
        )
      )
    ).toBe(true);

    const codigos: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      const r = await app.inject({
        method: "POST",
        url: "/cinco",
        remoteAddress: IP,
      });
      codigos.push(r.statusCode);
    }
    expect(codigos).toEqual([200, 200, 200, 200, 200, 429]);
    expect(await leerContador(`ratelimit:POST/cinco-${IP}`)).toBe(6);
  }, 30_000);

  // El tope de conexiones desechadas se fía del texto del P2010 de Prisma
  // («Timed out during query execution»): si una versión nueva lo cambiara,
  // cada episodio sumaría otra conexión abierta en Postgres sin tope.
  it("el P2010 real del socket_timeout cuenta como conexión desechada por un plazo: tras dos episodios no abre otra y decide en local", async () => {
    // Fuera las conexiones que hayan dejado otros tests en el proxy.
    proxy.cortar();
    proxy.reanudar();
    process.env.DATABASE_URL = urlViaProxy;
    app = await crearInstancia();
    await app.inject({
      method: "GET",
      url: "/ping",
      remoteAddress: "198.18.0.3",
    });

    // Primer episodio: la desecha a los 5 s y vuelve por otra conexión.
    expect(proxy.congelarLasAbiertas()).toBe(1);
    await esperarAPostgres(app);
    expect(
      avisos.some(
        (t) =>
          t.includes("Timed out during query execution") &&
          t.includes("desechadas por un plazo en los últimos 15 min: 1;")
      )
    ).toBe(true);

    // Segundo episodio, en la conexión nueva: con dos desechadas que pueden
    // seguir abiertas no abre una tercera.
    proxy.congelarLasAbiertas();
    const limite = Date.now() + 15_000;
    const sinConexion = () =>
      avisos.some((t) =>
        t.includes(
          "2 conexiones del limitador desechadas por un plazo en los últimos 15 min pueden seguir abiertas en Postgres; no se abre otra hasta"
        )
      );
    while (!sinConexion() && Date.now() < limite) {
      await app.inject({
        method: "GET",
        url: "/ping",
        remoteAddress: "198.18.0.4",
      });
      await esperar(200);
    }
    expect(sinConexion()).toBe(true);

    // Postgres sano, pero la instancia decide en local: no cuenta.
    proxy.reanudar();
    const r = await app.inject({
      method: "GET",
      url: "/ping",
      remoteAddress: "198.18.0.5",
    });
    expect(r.statusCode).toBe(200);
    expect(await leerContador("ratelimit:198.18.0.5")).toBe(0);
  }, 40_000);

  it("Postgres cancela a los 2 s una sentencia del limitador que espera un bloqueo de fila (statement_timeout): no se ejecuta después", async () => {
    app = await crearInstancia();
    const clave = `ratelimit:POST/cinco-${IP}`;
    const codigos: number[] = [];
    const pedir = async () =>
      codigos.push(
        (
          await app!.inject({
            method: "POST",
            url: "/cinco",
            remoteAddress: IP,
          })
        ).statusCode
      );
    for (let i = 0; i < 3; i += 1) await pedir();

    // Otra transacción retiene la fila 3 s, más que el statement_timeout.
    const bloqueo = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM "contadores" WHERE "clave" = ${clave} FOR UPDATE`;
        await esperar(3_000);
      },
      { timeout: 10_000 }
    );
    await esperar(50);
    await pedir();
    await bloqueo;
    await enReposo();
    await esperar(100);
    // La 4.ª se decidió en local al vencer el plazo; Postgres la canceló y
    // no la ejecutó al soltarse el bloqueo (con solo socket_timeout, sí).
    expect(
      avisos.some((t) =>
        t.includes("canceling statement due to statement timeout")
      )
    ).toBe(true);
    expect(await leerContador(clave)).toBe(3);

    await esperarAPostgres(app);
    await pedir();
    expect(codigos).toEqual([200, 200, 200, 200, 200]);
    expect(await leerContador(clave)).toBe(4);
  }, 30_000);

  it("si la primera sentencia de una conexión nueva se queda colgada (el socket_timeout de Prisma no acota su PREPARE), la da por perdida a los 6 s y vuelve a contar en Postgres por otra", async () => {
    // Fuera las conexiones que hayan dejado otros tests en el proxy.
    proxy.cortar();
    proxy.reanudar();
    process.env.DATABASE_URL = urlViaProxy;
    const { conUnaConexion } = await vi.importActual<
      typeof import("../../../src/lib/prisma.js")
    >("../../../src/lib/prisma.js");
    const { PrismaClient } = await import("@prisma/client");
    // La conexión del limitador, con sus plazos de producción, ya abierta
    // pero sin ninguna sentencia preparada; luego, medio abierta.
    const conectada = new PrismaClient({
      datasourceUrl: conUnaConexion(urlViaProxy, {
        socket_timeout: "5",
        options: "-c statement_timeout=2000",
      }),
    });
    await conectada.$connect();
    expect(proxy.congelarLasAbiertas()).toBe(1);
    clienteDelTest.valor = conectada;
    app = await crearInstancia();

    const t0 = Date.now();
    await esperarAPostgres(app);
    const recuperacionMs = Date.now() - t0;
    expect(recuperacionMs).toBeGreaterThan(5_500);
    expect(recuperacionMs).toBeLessThan(9_000);
    expect(
      avisos.some((t) =>
        t.includes("la sentencia no volvió en 6 s y se da por perdida")
      )
    ).toBe(true);

    const codigos: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      const r = await app.inject({
        method: "POST",
        url: "/cinco",
        remoteAddress: IP,
      });
      codigos.push(r.statusCode);
    }
    expect(codigos).toEqual([200, 200, 200, 200, 200, 429]);
    expect(await leerContador(`ratelimit:POST/cinco-${IP}`)).toBe(6);
  }, 30_000);
});
