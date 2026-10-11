import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import * as procesoA from "../../../src/lib/limitesDePeticiones.js";
import { resetDb } from "../helpers/db.js";
import { leerContador } from "../helpers/contadores.js";

// Dos «instancias de Cloud Run» (dos copias del módulo, como en
// limitesDePeticiones.test.ts) contra el Postgres real. Solo la conexión del
// limitador de la instancia A pasa por un proxy TCP: se corta para abrir su
// cortacircuitos, Postgres vuelve y sigue sano, y pasan más de 30 s sin
// tráfico en A. La primera ráfaga de después es la que importa: la primera
// petición de A sale como sonda y las que llegan detrás tienen que esperarla
// y contar en Postgres, no decidirse con la cuenta local.

const { proxy, urlReal, urlViaProxy } = await vi.hoisted(async () => {
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
  return { proxy, urlReal: real.toString(), urlViaProxy: via.toString() };
});

type ModuloDeLimites = typeof procesoA;
const procesoB =
  (await import("../../../src/lib/limitesDePeticiones.js?proceso=b")) as ModuloDeLimites;

const IP = "203.0.113.90";
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function crearInstancia(
  modulo: ModuloDeLimites
): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    store: modulo.AlmacenDeLimites,
    skipOnError: true,
  });
  app.get("/ping", async () => ({ ok: true }));
  app.post(
    "/tres",
    { config: { rateLimit: { max: 3, timeWindow: "1 minute" } } },
    async () => ({ ok: true })
  );
  await app.ready();
  return app;
}

async function rafaga(app: FastifyInstance, n: number): Promise<number> {
  const respuestas = await Promise.all(
    Array.from({ length: n }, () =>
      app.inject({ method: "POST", url: "/tres", remoteAddress: IP })
    )
  );
  return respuestas.filter((r) => r.statusCode === 200).length;
}

describe("límite de peticiones: la primera ráfaga tras la sonda del cortacircuitos (Postgres real, dos instancias)", () => {
  const abiertas: FastifyInstance[] = [];
  const avisos: string[] = [];

  beforeAll(async () => {
    await resetDb();
    for (const m of [procesoA, procesoB]) {
      await m.cerrarConexionDelLimitador();
      m.reiniciarEstadoDeLimitesParaTests();
    }
    for (const nivel of ["warn", "error"] as const) {
      vi.spyOn(console, nivel).mockImplementation((texto: unknown) => {
        avisos.push(String(texto));
      });
    }
  });
  afterAll(async () => {
    await Promise.all(abiertas.splice(0).map((a) => a.close()));
    proxy.reanudar();
    for (const m of [procesoA, procesoB]) {
      const limite = Date.now() + 5_000;
      while (m.consultasDeLimitesEnVueloParaTests() > 0) {
        if (Date.now() > limite) break;
        await esperar(5);
      }
      await m.cerrarConexionDelLimitador();
    }
    process.env.DATABASE_URL = urlReal;
    vi.restoreAllMocks();
    await proxy.cerrar();
  });

  it("con Postgres ya sano, la ráfaga que llega con la sonda en vuelo la espera y cuenta en Postgres: entre las dos instancias pasan exactamente max", async () => {
    // B abre su conexión del limitador directa; A, a través del proxy (cada
    // instancia la abre con su primera sentencia, con la DATABASE_URL de ese
    // momento).
    const b = await crearInstancia(procesoB);
    abiertas.push(b);
    process.env.DATABASE_URL = urlReal;
    await b.inject({
      method: "GET",
      url: "/ping",
      remoteAddress: "198.18.5.1",
    });
    const a = await crearInstancia(procesoA);
    abiertas.push(a);
    process.env.DATABASE_URL = urlViaProxy;
    await a.inject({
      method: "GET",
      url: "/ping",
      remoteAddress: "198.18.5.2",
    });
    expect(await leerContador("ratelimit:198.18.5.2")).toBe(1);

    // Tres sentencias seguidas de A que fallan: se abre su cortacircuitos.
    proxy.cortar();
    for (let i = 0; i < 3; i += 1) {
      await a.inject({
        method: "GET",
        url: "/ping",
        remoteAddress: `198.18.6.${i}`,
      });
    }
    expect(
      avisos.some((t) => t.includes("Cortacircuitos abierto tras 3 fallos"))
    ).toBe(true);
    proxy.reanudar();

    // Pasan más de 30 s sin tráfico en A, con Postgres sano (el reloj de las
    // dos instancias avanza; el de Postgres no hace falta).
    const ahoraReal = Date.now.bind(Date);
    vi.spyOn(Date, "now").mockImplementation(() => ahoraReal() + 31_000);

    // La misma ráfaga en las dos instancias a la vez.
    const [enA, enB] = await Promise.all([rafaga(a, 12), rafaga(b, 12)]);

    expect(
      avisos.some((t) => t.includes("se prueba Postgres con una sonda"))
    ).toBe(true);
    expect(avisos.some((t) => t.includes("Cortacircuitos cerrado"))).toBe(true);
    // Es lo que distingue esperar a la sonda de decidir en local lo que
    // llega detrás de ella: A decidiría esas sin ver las de B, y entre las
    // dos instancias pasarían más de 3 (medido: 5). Ninguna de A se decidió
    // con la cuenta local. El contador no lo distingue: según en qué orden
    // ejecute Postgres las sentencias de A y de B, las de A que esperaban
    // detrás de la sonda salen o encuentran la clave ya bloqueada y
    // responden 429 sin mandarse.
    expect(enA + enB).toBe(3);
    expect(
      avisos.filter((t) => t.includes("se decide con la cuenta local"))
    ).toEqual([]);
  }, 30_000);
});
