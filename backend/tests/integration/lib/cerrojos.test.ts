import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import Redis from "ioredis";
import { prisma } from "../../../src/lib/prisma.js";
import {
  adquirirCerrojo,
  liberarCerrojo,
  type ResultadoDeCerrojo,
} from "../../../src/lib/cerrojos.js";
import {
  cerrarRedisDeCompatibilidad,
  compatibilidadActiva,
  conectarRedisDeCompatibilidad,
} from "../../../src/lib/redisDeCompatibilidad.js";
import { resetDb } from "../helpers/db.js";

// Cerrojos contra Postgres real, en los dos modos en que puede correr una
// revisión: «solo Postgres» (sin REDIS_URL, a partir de la fase 2 del corte)
// y «Postgres + Redis» (modo compatibilidad, mientras exista REDIS_URL).

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function filaDe(clave: string) {
  const filas = await prisma.$queryRaw<
    { token: string; restanteMs: number }[]
  >`SELECT "token",
      (EXTRACT(EPOCH FROM ("expiraEn" - now())) * 1000)::int AS "restanteMs"
    FROM "cerrojos" WHERE "clave" = ${clave}`;
  return filas[0] ?? null;
}

function tokenDe(resultado: ResultadoDeCerrojo): string {
  if (resultado.estado !== "adquirido") {
    throw new Error(`se esperaba «adquirido» y fue «${resultado.estado}»`);
  }
  return resultado.token;
}

const modos = [
  {
    nombre: "solo Postgres",
    preparar: () => cerrarRedisDeCompatibilidad(),
    conRedis: false,
  },
  {
    nombre: "Postgres + Redis (compatibilidad)",
    preparar: () => conectarRedisDeCompatibilidad(),
    conRedis: true,
  },
];

describe.each(modos)("cerrojos ($nombre)", ({ preparar, conRedis }) => {
  // Para mirar qué hay en Redis sin pasar por el código probado.
  let redis: Redis;

  beforeAll(async () => {
    await preparar();
    redis = new Redis(process.env.REDIS_URL as string);
  });
  afterAll(async () => {
    await redis.quit();
    // Se deja el proceso como lo dejó setup.ts: en modo compatibilidad.
    await conectarRedisDeCompatibilidad();
  });
  beforeEach(async () => {
    await resetDb();
  });

  it("está en el modo que dice", () => {
    expect(compatibilidadActiva()).toBe(conRedis);
  });

  it("50 rondas de dos adquisiciones concurrentes de la misma clave: siempre gana exactamente una", async () => {
    for (let ronda = 0; ronda < 50; ronda += 1) {
      const clave = `prueba:carrera:${ronda}`;
      const resultados = await Promise.all([
        adquirirCerrojo(clave, 10_000, 0),
        adquirirCerrojo(clave, 10_000, 0),
      ]);
      const ganadores = resultados.filter((r) => r.estado === "adquirido");
      const perdedores = resultados.filter((r) => r.estado === "ocupado");
      expect(ganadores, `ronda ${ronda}`).toHaveLength(1);
      expect(perdedores, `ronda ${ronda}`).toHaveLength(1);

      // El token que quedó en el almacén es el del ganador.
      const token = tokenDe(ganadores[0]);
      expect((await filaDe(clave))?.token).toBe(token);
      if (conRedis) expect(await redis.get(clave)).toBe(token);
    }
  });

  it("cinco a la vez con reintentos: se turnan sin solaparse nunca", async () => {
    const clave = "prueba:turnos";
    let dentro = 0;
    let maximoDentro = 0;
    const trabajo = async () => {
      const r = await adquirirCerrojo(clave, 10_000, 8_000);
      const token = tokenDe(r);
      dentro += 1;
      maximoDentro = Math.max(maximoDentro, dentro);
      await esperar(40);
      dentro -= 1;
      await liberarCerrojo(clave, token);
    };

    await Promise.all(Array.from({ length: 5 }, trabajo));

    expect(maximoDentro).toBe(1);
    expect(await filaDe(clave)).toBeNull();
  });

  it("un cerrojo caducado se reclama, y el poseedor viejo ya no puede liberar el nuevo", async () => {
    const clave = "prueba:caducado";
    const viejo = tokenDe(await adquirirCerrojo(clave, 200, 0));
    expect((await adquirirCerrojo(clave, 200, 0)).estado).toBe("ocupado");

    await esperar(300);
    const nuevo = tokenDe(await adquirirCerrojo(clave, 10_000, 0));
    expect(nuevo).not.toBe(viejo);

    await liberarCerrojo(clave, viejo);
    expect((await filaDe(clave))?.token).toBe(nuevo);
    if (conRedis) expect(await redis.get(clave)).toBe(nuevo);
    expect((await adquirirCerrojo(clave, 10_000, 0)).estado).toBe("ocupado");
  });

  it("un token ajeno no libera (compare-and-delete); el propio sí, en los dos almacenes", async () => {
    const clave = "prueba:ajeno";
    const token = tokenDe(await adquirirCerrojo(clave, 10_000, 0));

    await liberarCerrojo(clave, "token-de-otro");
    expect((await filaDe(clave))?.token).toBe(token);
    if (conRedis) expect(await redis.get(clave)).toBe(token);

    await liberarCerrojo(clave, token);
    expect(await filaDe(clave)).toBeNull();
    expect(await redis.get(clave)).toBeNull();
    expect((await adquirirCerrojo(clave, 10_000, 0)).estado).toBe("adquirido");
  });
});
