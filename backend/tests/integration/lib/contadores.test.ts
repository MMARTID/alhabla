import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../../../src/lib/prisma.js";
import {
  incrementarContadores,
  purgarCaducados,
} from "../../../src/lib/almacenTemporal.js";
import { resetDb } from "../helpers/db.js";
import { leerContador } from "../helpers/contadores.js";

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Una sola clave en la sentencia de varias. */
async function incrementarContador(
  clave: string,
  ventanaMs: number,
  cantidad = 1
): Promise<{ valor: number; ttlMs: number }> {
  const fila = (
    await incrementarContadores([{ clave, ventanaMs, cantidad }])
  ).get(clave);
  expect(fila).toBeDefined();
  return fila!;
}

describe("contadores de ventana fija (Postgres real)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("la tabla es UNLOGGED con fillfactor 70 y autovacuum agresivo (la migración lo fija; Prisma no lo representa)", async () => {
    const filas = await prisma.$queryRaw<
      { relname: string; relpersistence: string; reloptions: string[] | null }[]
    >`SELECT relname, relpersistence::text AS relpersistence, reloptions
      FROM pg_class
      WHERE relname IN ('cerrojos', 'claves_temporales', 'contadores', 'salud_telnyx')
        AND relnamespace = current_schema()::regnamespace
      ORDER BY relname`;

    expect(filas).toEqual([
      { relname: "cerrojos", relpersistence: "p", reloptions: null },
      { relname: "claves_temporales", relpersistence: "p", reloptions: null },
      {
        relname: "contadores",
        relpersistence: "u",
        reloptions: ["fillfactor=70", "autovacuum_vacuum_scale_factor=0.05"],
      },
      { relname: "salud_telnyx", relpersistence: "p", reloptions: null },
    ]);
  });

  it("50 incrementos concurrentes de la misma clave dan 1..50, sin repetir ninguno", async () => {
    const resultados = await Promise.all(
      Array.from({ length: 50 }, () =>
        incrementarContador("prueba:concurrente", 60_000)
      )
    );

    const valores = resultados.map((r) => r.valor).sort((a, b) => a - b);
    expect(valores).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
    expect(await leerContador("prueba:concurrente")).toBe(50);
    for (const r of resultados) {
      expect(r.ttlMs).toBeGreaterThan(0);
      expect(r.ttlMs).toBeLessThanOrEqual(60_000);
    }
  });

  it("la ventana es fija: no se alarga con cada incremento y se reinicia al caducar", async () => {
    const primero = await incrementarContador("prueba:ventana", 300);
    expect(primero.valor).toBe(1);
    await esperar(100);
    const segundo = await incrementarContador("prueba:ventana", 300);
    expect(segundo.valor).toBe(2);
    // El ttl sigue contando desde el primero.
    expect(segundo.ttlMs).toBeLessThan(primero.ttlMs);

    await esperar(300);
    expect(await leerContador("prueba:ventana")).toBe(0);
    const tercero = await incrementarContador("prueba:ventana", 300);
    expect(tercero.valor).toBe(1);
    expect(tercero.ttlMs).toBeGreaterThan(200);
  });

  it("incrementa en n y suma sobre lo que ya había", async () => {
    expect((await incrementarContador("prueba:n", 60_000, 5)).valor).toBe(5);
    expect((await incrementarContador("prueba:n", 60_000, 3)).valor).toBe(8);
    expect(await leerContador("prueba:n")).toBe(8);
  });

  it("varias claves en una sola sentencia: cada una con su valor y su ventana, y una clave repetida se suma una vez", async () => {
    await prisma.$executeRaw`
      INSERT INTO "contadores" ("clave", "valor", "expiraEn") VALUES
        ('l:viva', 4, now() + interval '30 seconds'),
        ('l:caducada', 9, now() - interval '1 second')`;

    const r = await incrementarContadores([
      { clave: "l:viva", ventanaMs: 60_000, cantidad: 3 },
      { clave: "l:nueva", ventanaMs: 1_000, cantidad: 2 },
      { clave: "l:caducada", ventanaMs: 60_000, cantidad: 1 },
      { clave: "l:nueva", ventanaMs: 1_000, cantidad: 1 },
    ]);

    expect(r.get("l:viva")?.valor).toBe(7);
    expect(r.get("l:viva")?.ttlMs).toBeGreaterThan(29_000);
    expect(r.get("l:viva")?.ttlMs).toBeLessThanOrEqual(30_000);
    expect(r.get("l:nueva")).toEqual({ valor: 3, ttlMs: expect.any(Number) });
    expect(r.get("l:nueva")?.ttlMs).toBeLessThanOrEqual(1_000);
    expect(r.get("l:caducada")?.valor).toBe(1);
    expect(r.get("l:caducada")?.ttlMs).toBeGreaterThan(59_000);
    expect(r.size).toBe(3);
  });

  it("sentencias concurrentes con las mismas claves en distinto orden no se interbloquean y no pierden ningún incremento", async () => {
    const claves = Array.from({ length: 20 }, (_, i) => `l:cruce-${i}`);
    const lote = (orden: string[]) =>
      incrementarContadores(
        orden.map((clave) => ({ clave, ventanaMs: 60_000, cantidad: 1 }))
      );

    await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        lote(i % 2 === 0 ? claves : [...claves].reverse())
      )
    );

    for (const clave of claves) expect(await leerContador(clave)).toBe(30);
  });

  it("sin claves no manda nada", async () => {
    expect((await incrementarContadores([])).size).toBe(0);
  });

  it("leer una clave que no existe da 0", async () => {
    expect(await leerContador("prueba:no-existe")).toBe(0);
  });

  it("la purga borra solo lo caducado hace más de 10 minutos, en las tres tablas", async () => {
    await prisma.$executeRaw`
      INSERT INTO "cerrojos" ("clave", "token", "expiraEn") VALUES
        ('c:vieja', 't', now() - interval '11 minutes'),
        ('c:reciente', 't', now() - interval '9 minutes'),
        ('c:viva', 't', now() + interval '1 minute')`;
    await prisma.$executeRaw`
      INSERT INTO "contadores" ("clave", "valor", "expiraEn") VALUES
        ('n:vieja', 1, now() - interval '11 minutes'),
        ('n:reciente', 1, now() - interval '9 minutes'),
        ('n:viva', 1, now() + interval '1 minute')`;
    await prisma.$executeRaw`
      INSERT INTO "claves_temporales" ("clave", "valor", "expiraEn") VALUES
        ('k:vieja', '{}'::jsonb, now() - interval '11 minutes'),
        ('k:reciente', '{}'::jsonb, now() - interval '9 minutes'),
        ('k:viva', '{}'::jsonb, now() + interval '1 minute')`;

    const purga = await purgarCaducados();

    expect(purga).toEqual({ claves: 1, contadores: 1, cerrojos: 1 });
    const quedan = await prisma.$queryRaw<{ clave: string }[]>`
      SELECT "clave" FROM "cerrojos"
      UNION ALL SELECT "clave" FROM "contadores"
      UNION ALL SELECT "clave" FROM "claves_temporales"
      ORDER BY 1`;
    expect(quedan.map((f) => f.clave)).toEqual([
      "c:reciente",
      "c:viva",
      "k:reciente",
      "k:viva",
      "n:reciente",
      "n:viva",
    ]);
  });
});
