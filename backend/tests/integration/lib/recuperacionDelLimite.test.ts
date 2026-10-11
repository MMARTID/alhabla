import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { prisma } from "../../../src/lib/prisma.js";
import {
  AlmacenDeLimites,
  cerrarConexionDelLimitador,
  consultasDeLimitesEnVueloParaTests,
  reiniciarEstadoDeLimitesParaTests,
} from "../../../src/lib/limitesDePeticiones.js";
import { resetDb } from "../helpers/db.js";

// El limitador contra el Postgres real a través de un proxy TCP que retiene
// lo que manda Prisma: una consulta se queda colgada 1,5 s y luego se ejecuta
// tarde, como con el pool agotado o un Cloud SQL que tarda en responder.
// Mientras tanto decide la cuenta local, y lo que decide no se manda después
// a Postgres: no puede gastar el cupo de la ventana que esa consulta abre al
// ejecutarse. Un cliente que va por debajo del límite (y al que Redis nunca
// habría rechazado) no recibe ningún 429.

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
  return { proxy, urlViaProxy: via.toString() };
});

// Todo lo de este fichero (la conexión propia del limitador, resetDb y las
// lecturas) pasa por el proxy.
vi.mock("../../../src/lib/prisma.js", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { conUnaConexion } = await vi.importActual<
    typeof import("../../../src/lib/prisma.js")
  >("../../../src/lib/prisma.js");
  return {
    prisma: new PrismaClient({ datasourceUrl: urlViaProxy }),
    crearClienteDeUnaConexion: () =>
      new PrismaClient({ datasourceUrl: conUnaConexion(urlViaProxy) }),
  };
});

const IP = "198.18.78.1";
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("límite de peticiones: recuperación tras una consulta colgada (Postgres real)", () => {
  beforeAll(async () => {
    await resetDb();
    reiniciarEstadoDeLimitesParaTests();
  });
  afterAll(async () => {
    proxy.reanudar();
    const limite = Date.now() + 5_000;
    while (consultasDeLimitesEnVueloParaTests() > 0 && Date.now() < limite) {
      await esperar(5);
    }
    await cerrarConexionDelLimitador();
    await prisma.$disconnect();
    await proxy.cerrar();
  });

  it("un cliente a 8 por ventana con max 10 no recibe ningún 429 aunque una consulta cuelgue 1,5 s", async () => {
    const avisos = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errores = vi.spyOn(console, "error").mockImplementation(() => {});
    const app = Fastify();
    await app.register(rateLimit, {
      max: 100,
      timeWindow: "1 minute",
      store: AlmacenDeLimites,
      skipOnError: true,
    });
    app.post(
      "/ventana-corta",
      { config: { rateLimit: { max: 10, timeWindow: 1_000 } } },
      async () => ({ ok: true })
    );
    await app.ready();

    // Una petición cada 125 ms durante 6 s: 8 por ventana de 1 s.
    const inicio = Date.now();
    const respuestas: Array<{ t: number; codigo: number }> = [];
    const enCurso: Promise<void>[] = [];
    setTimeout(() => proxy.retener(), 1_300);
    setTimeout(() => proxy.reanudar(), 2_800);
    for (let t = 0; t < 6_000; t += 125) {
      await esperar(Math.max(0, t - (Date.now() - inicio)));
      enCurso.push(
        app
          .inject({
            method: "POST",
            url: "/ventana-corta",
            remoteAddress: IP,
          })
          .then((r) => {
            respuestas.push({ t, codigo: r.statusCode });
          })
      );
    }
    await Promise.all(enCurso);
    await app.close();
    const textos = [...avisos.mock.calls, ...errores.mock.calls].map((c) =>
      String(c[0])
    );
    vi.restoreAllMocks();

    expect(respuestas).toHaveLength(48);
    // La consulta colgó de verdad y, mientras tanto, se decidió en local.
    expect(textos.some((t) => t.includes("plazo de 500 ms vencido"))).toBe(
      true
    );
    expect(textos.some((t) => t.includes("en vuelo sin volver"))).toBe(true);
    expect(respuestas.filter((r) => r.codigo === 429)).toEqual([]);
  });
});
