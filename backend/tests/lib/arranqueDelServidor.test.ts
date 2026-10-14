import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import Fastify from "fastify";

// Cliente ioredis falso para el Redis de compatibilidad: decide cuándo llega
// a «ready». El Redis principal y R2 se mockean enteros.
const { creados, ajustes, FalsoRedis } = await vi.hoisted(async () => {
  const creados: Array<{
    url: string;
    cliente: InstanceType<typeof FalsoRedis>;
  }> = [];
  /** Milisegundos hasta «ready» del próximo cliente. */
  const ajustes = { msHastaListo: 0 };
  const { EventEmitter: Emisor } = await import("node:events");
  class FalsoRedis extends Emisor {
    status = "wait";
    quit = vi.fn().mockResolvedValue("OK");
    disconnect = vi.fn();
    connect = vi.fn(async () => {
      setTimeout(() => {
        this.status = "ready";
        this.emit("ready");
      }, ajustes.msHastaListo);
    });
    constructor(url: string) {
      super();
      creados.push({ url, cliente: this });
    }
  }
  return { creados, ajustes, FalsoRedis };
});

vi.mock("ioredis", () => ({ default: FalsoRedis }));
vi.mock("../../src/lib/storage.js", () => ({ initStorage: vi.fn() }));
vi.mock("../../src/lib/almacenTemporal.js", () => ({
  incrementarContadores: vi.fn(),
}));

import {
  iniciarServiciosExternos,
  registrarLimiteDePeticiones,
} from "../../src/lib/arranqueDelServidor.js";
import {
  cerrarRedisDeCompatibilidad,
  compatibilidadActiva,
} from "../../src/lib/redisDeCompatibilidad.js";
import { reiniciarEstadoDeLimitesParaTests } from "../../src/lib/limitesDePeticiones.js";
import { initStorage } from "../../src/lib/storage.js";
import {
  incrementarContadores,
  type Incremento,
} from "../../src/lib/almacenTemporal.js";

/** Postgres falso: cada clave que llega devuelve `valor` y `ttlMs`. */
function contestarCon(valor: number, ttlMs: number) {
  vi.mocked(incrementarContadores).mockImplementation(
    async (incrementos: readonly Incremento[]) =>
      new Map(incrementos.map((i) => [i.clave, { valor, ttlMs }]))
  );
}

const URL_ORIGINAL = process.env.REDIS_URL;

/** El código sin comentarios de bloque ni de línea (los de línea, solo los
 * que ocupan la línea entera o van tras `;`, `{` o `}`: una URL dentro de
 * un string no se toca). */
function sinComentarios(codigo: string): string {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "")
    .replace(/([;{}])[ \t]*\/\/.*$/gm, "$1");
}

/** Dónde está cada paso del arranque en el texto de server.ts: sin
 * comentarios y solo como sentencia propia del try de start() (sangría de
 * 4, la de `await fastify.listen`); -1 si no está así. */
function posicionesDelArranque(codigo: string) {
  const texto = sinComentarios(codigo);
  const posicion = (sentencia: string) =>
    texto.search(
      new RegExp(
        `^ {4}${sentencia.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        "m"
      )
    );
  return {
    iniciar: posicion("await iniciarServiciosExternos();"),
    limitador: posicion("await registrarLimiteDePeticiones(fastify);"),
    escuchar: posicion("await fastify.listen({ port: PORT, host: HOST });"),
  };
}

function textoDeServer(): string {
  return readFileSync(new URL("../../src/server.ts", import.meta.url), "utf8");
}

describe("arranque del servidor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    creados.length = 0;
    ajustes.msHastaListo = 0;
    reiniciarEstadoDeLimitesParaTests();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(async () => {
    await cerrarRedisDeCompatibilidad();
    vi.useRealTimers();
    vi.restoreAllMocks();
    if (URL_ORIGINAL === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = URL_ORIGINAL;
  });

  describe("iniciarServiciosExternos", () => {
    it("con REDIS_URL deja activo el doble cerrojo y no termina hasta que el Redis de compatibilidad está listo", async () => {
      vi.useFakeTimers();
      process.env.REDIS_URL = "redis://redis.interno:6379/0";
      ajustes.msHastaListo = 200;

      let terminado = false;
      const promesa = iniciarServiciosExternos().then(() => {
        terminado = true;
      });
      await vi.advanceTimersByTimeAsync(150);
      // server.ts lo espera antes de `listen`: sin «ready» aún no hay tráfico.
      expect(terminado).toBe(false);
      await vi.advanceTimersByTimeAsync(100);
      await promesa;

      expect(terminado).toBe(true);
      expect(compatibilidadActiva()).toBe(true);
      expect(creados.map((c) => c.url)).toEqual([
        "redis://redis.interno:6379/0",
      ]);
      expect(creados[0].cliente.status).toBe("ready");
      expect(initStorage).toHaveBeenCalledTimes(1);
    });

    it("sin REDIS_URL los cerrojos van solo por Postgres", async () => {
      delete process.env.REDIS_URL;

      await iniciarServiciosExternos();

      expect(compatibilidadActiva()).toBe(false);
      expect(creados).toHaveLength(0);
    });
  });

  describe("registrarLimiteDePeticiones", () => {
    it("usa AlmacenDeLimites (Postgres) con 100/min por IP para todas las rutas", async () => {
      contestarCon(1, 60_000);
      const app = Fastify();
      await registrarLimiteDePeticiones(app);
      app.get("/ping", async () => ({ ok: true }));
      app.post("/webhooks/telnyx/prueba", async () => ({ received: true }));

      const ping = await app.inject({
        method: "GET",
        url: "/ping",
        remoteAddress: "203.0.113.9",
      });
      const webhook = await app.inject({
        method: "POST",
        url: "/webhooks/telnyx/prueba",
        remoteAddress: "203.0.113.9",
      });

      expect(ping.statusCode).toBe(200);
      expect(ping.headers["x-ratelimit-limit"]).toBe("100");
      expect(webhook.statusCode).toBe(200);
      // Las dos, contadas en Postgres en la clave global de la IP.
      expect(
        vi.mocked(incrementarContadores).mock.calls.map((c) => c[0])
      ).toEqual([
        [{ clave: "ratelimit:203.0.113.9", ventanaMs: 60_000, cantidad: 1 }],
        [{ clave: "ratelimit:203.0.113.9", ventanaMs: 60_000, cantidad: 1 }],
      ]);
      await app.close();
    });

    it("al pasarse responde 429 con el formato de siempre", async () => {
      contestarCon(101, 30_000);
      const app = Fastify();
      await registrarLimiteDePeticiones(app);
      app.get("/ping", async () => ({ ok: true }));

      const r = await app.inject({ method: "GET", url: "/ping" });

      expect(r.statusCode).toBe(429);
      expect(r.json()).toMatchObject({
        statusCode: 429,
        error: "Too Many Requests",
      });
      expect(r.json().message).toMatch(/^Rate limit exceeded\. Retry in /);
      await app.close();
    });
  });

  // server.ts arranca al importarlo, así que no se puede cargar en un test:
  // se comprueba en su texto que usa estas dos piezas y en qué orden. Sin
  // comentarios, y cada llamada como sentencia propia del try de start() (a
  // su sangría, la de `await fastify.listen`): una llamada comentada, detrás
  // de un `if` o dentro de un bloque no cuenta.
  it("server.ts inicia los servicios antes de listen y registra este limitador", () => {
    const servidor = textoDeServer();
    const { iniciar, limitador, escuchar } = posicionesDelArranque(servidor);

    expect(iniciar).toBeGreaterThan(-1);
    expect(limitador).toBeGreaterThan(iniciar);
    expect(escuchar).toBeGreaterThan(limitador);
    // Ningún otro registro de @fastify/rate-limit que lo pise.
    expect(servidor).not.toContain("@fastify/rate-limit");
  });

  // Cerrarlo deja la revisión en «solo Postgres»: una adquisición que
  // estuviera reintentando se concedería sin la clave de Redis, y una
  // revisión anterior al PR A podría tener esa misma clave (dos poseedores).
  // process.exit suelta el socket igualmente.
  it("el apagado de server.ts no cierra el Redis de compatibilidad de los cerrojos", () => {
    expect(sinComentarios(textoDeServer())).not.toContain(
      "cerrarRedisDeCompatibilidad"
    );
  });

  it("la comprobación de server.ts no se deja engañar por una llamada comentada, condicionada o en un bloque", () => {
    const original = textoDeServer();
    const variantes = [
      original.replace(
        "    await iniciarServiciosExternos();",
        "    // await iniciarServiciosExternos();"
      ),
      original.replace(
        "    await registrarLimiteDePeticiones(fastify);",
        '    if (process.env.LIMITE === "1") await registrarLimiteDePeticiones(fastify);'
      ),
      original.replace(
        "    await iniciarServiciosExternos();",
        "    if (process.env.X) {\n      await iniciarServiciosExternos();\n    }"
      ),
    ];
    for (const variante of variantes) {
      expect(variante).not.toBe(original);
      const { iniciar, limitador } = posicionesDelArranque(variante);
      expect(Math.min(iniciar, limitador)).toBe(-1);
    }
  });
});
