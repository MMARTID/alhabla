import { readFileSync } from "node:fs";
import { describe, it, expect, vi } from "vitest";
import { comprobarSalud, conMemoria } from "../../src/lib/salud.js";

const bien = () => Promise.resolve("ok");
const mal = () => Promise.reject(new Error("caído"));

describe("comprobarSalud (GET /health)", () => {
  it("con todo bien, sale sano y lista cada dependencia", async () => {
    const resultado = await comprobarSalud({
      criticas: { postgres: bien, redis: bien },
      informativas: { telnyx: bien, retell: bien },
    });

    expect(resultado).toEqual({
      healthy: true,
      dependencies: { postgres: "ok", redis: "ok", telnyx: "ok", retell: "ok" },
    });
  });

  it("si cae Telnyx o Retell lo dice, pero sigue sano: el deploy no debe revertir por ellos", async () => {
    const resultado = await comprobarSalud({
      criticas: { postgres: bien, redis: bien },
      informativas: { telnyx: mal, retell: mal },
    });

    expect(resultado.healthy).toBe(true);
    expect(resultado.dependencies).toMatchObject({
      telnyx: "unhealthy",
      retell: "unhealthy",
    });
  });

  it.each(["postgres", "redis"])("si cae %s, no está sano", async (critica) => {
    const resultado = await comprobarSalud({
      criticas: { postgres: bien, redis: bien, [critica]: mal },
      informativas: { telnyx: bien },
    });

    expect(resultado.healthy).toBe(false);
    expect(resultado.dependencies[critica]).toBe("unhealthy");
  });

  it("sin claves de proveedores, solo salen las críticas", async () => {
    const resultado = await comprobarSalud({
      criticas: { postgres: bien, redis: bien },
      informativas: {},
    });

    expect(resultado.dependencies).toEqual({ postgres: "ok", redis: "ok" });
  });
});

describe("conMemoria (Telnyx y Retell en /health)", () => {
  function reloj() {
    let ms = 1_000_000;
    return { ahora: () => ms, avanzar: (delta: number) => (ms += delta) };
  }

  it("si fue bien, no vuelve a preguntar hasta pasado el minuto", async () => {
    const r = reloj();
    const comprobar = vi.fn(() => Promise.resolve("ok"));
    const conCache = conMemoria(comprobar, { ahora: r.ahora });

    await conCache();
    r.avanzar(30_000);
    await conCache();
    r.avanzar(29_999);
    await conCache();
    expect(comprobar).toHaveBeenCalledTimes(1);

    r.avanzar(1);
    await conCache();
    expect(comprobar).toHaveBeenCalledTimes(2);
  });

  it("si falló, lo repite el fallo y vuelve a preguntar a los 15 s", async () => {
    const r = reloj();
    const comprobar = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(new Error("caído"))
      .mockResolvedValue("ok");
    const conCache = conMemoria(comprobar, { ahora: r.ahora });

    await expect(conCache()).rejects.toThrow("caído");
    r.avanzar(14_999);
    await expect(conCache()).rejects.toThrow("caído");
    expect(comprobar).toHaveBeenCalledTimes(1);

    r.avanzar(1);
    await expect(conCache()).resolves.toBeUndefined();
    expect(comprobar).toHaveBeenCalledTimes(2);
  });

  it("las consultas que llegan a la vez comparten una sola comprobación", async () => {
    let resolver!: () => void;
    const comprobar = vi.fn(() => new Promise<void>((ok) => (resolver = ok)));
    const conCache = conMemoria(comprobar);

    const consultas = [conCache(), conCache(), conCache()];
    resolver();
    await Promise.all(consultas);
    expect(comprobar).toHaveBeenCalledTimes(1);
  });

  it("comprobarSalud la ve como «unhealthy» mientras dura el fallo guardado", async () => {
    const r = reloj();
    const conCache = conMemoria(() => Promise.reject(new Error("caído")), {
      ahora: r.ahora,
    });
    await conCache().catch(() => {});

    const resultado = await comprobarSalud({
      criticas: { postgres: bien, redis: bien },
      informativas: { telnyx: conCache },
    });
    expect(resultado).toEqual({
      healthy: true,
      dependencies: { postgres: "ok", redis: "ok", telnyx: "unhealthy" },
    });
  });

  it("GET /health pregunta a Telnyx y a Retell con memoria, y a Postgres y Redis en cada consulta", () => {
    const servidor = readFileSync(
      new URL("../../src/server.ts", import.meta.url),
      "utf8"
    );
    expect(servidor).toContain("conMemoria(() => telnyxAdapter.checkHealth())");
    expect(servidor).toContain("conMemoria(() => retellAdapter.checkHealth())");
    expect(servidor).not.toMatch(/informativas\.\w+ = \(\) =>/);
    expect(servidor).toContain("postgres: () => prisma.$queryRaw`SELECT 1`");
  });
});
