import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../../../src/lib/prisma.js";
import {
  HORAS_PARA_DAR_POR_INTERRUMPIDA,
  VENTANA_DE_APERTURAS_SIMULTANEAS_MS,
  abrirEjecucion,
} from "../../../src/modules/growth/ejecuciones.js";
import { limpiarGrowth } from "./ayudas.js";

/**
 * Abrir ejecuciones contra Postgres real: dos peticiones a la vez no se ven
 * entre sí con mocks, así que la carrera solo se prueba aquí.
 */

const enCurso = () =>
  prisma.growthEjecucion.count({ where: { estado: "en_curso" } });

describe("abrir ejecuciones a la vez (Postgres real)", () => {
  beforeEach(limpiarGrowth);
  afterAll(limpiarGrowth);

  it("dos aperturas a la vez dejan UNA sola ejecución en curso y las dos reciben la misma", async () => {
    const [a, b] = await Promise.all([
      abrirEjecucion({ disparador: "programada" }),
      abrirEjecucion({ disparador: "manual" }),
    ]);

    expect(a.id).toBe(b.id);
    // Una creó y la otra la reutilizó (no importa cuál llegó antes).
    expect([a.reutilizada, b.reutilizada].sort()).toEqual([false, true]);
    expect(await enCurso()).toBe(1);
    expect(await prisma.growthEjecucion.count()).toBe(1);
  });

  it("diez aperturas a la vez, igual: una ejecución y diez respuestas con el mismo id", async () => {
    const respuestas = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        abrirEjecucion({ disparador: i % 2 === 0 ? "programada" : "manual" })
      )
    );

    expect(new Set(respuestas.map((r) => r.id)).size).toBe(1);
    expect(respuestas.filter((r) => !r.reutilizada)).toHaveLength(1);
    expect(await enCurso()).toBe(1);
  });

  it("repetido muchas veces no se cuela ninguna carrera", async () => {
    for (let ronda = 0; ronda < 8; ronda++) {
      await limpiarGrowth();
      await Promise.all([
        abrirEjecucion({ disparador: "programada" }),
        abrirEjecucion({ disparador: "manual" }),
        abrirEjecucion({ disparador: "manual" }),
      ]);
      expect(await enCurso(), `ronda ${ronda}`).toBe(1);
    }
  });

  it("pasada la ventana, una ejecución sin cerrar convive con la nueva (se cierran solas a las 6 h)", async () => {
    const primera = await abrirEjecucion({ disparador: "programada" });
    await prisma.growthEjecucion.update({
      where: { id: primera.id },
      data: {
        inicio: new Date(
          Date.now() - VENTANA_DE_APERTURAS_SIMULTANEAS_MS - 60_000
        ),
      },
    });

    const segunda = await abrirEjecucion({ disparador: "programada" });

    expect(segunda.id).not.toBe(primera.id);
    expect(segunda.reutilizada).toBe(false);
    expect(await enCurso()).toBe(2);
  });

  it("cerrar la primera y abrir otra enseguida crea otra: lo reutilizado es solo lo que sigue en curso", async () => {
    const primera = await abrirEjecucion({ disparador: "manual" });
    await prisma.growthEjecucion.update({
      where: { id: primera.id },
      data: { estado: "ok", fin: new Date() },
    });

    const segunda = await abrirEjecucion({ disparador: "manual" });

    expect(segunda.id).not.toBe(primera.id);
    expect(segunda.reutilizada).toBe(false);
  });

  it("una ejecución de más de 6 h se cierra como interrumpida y la nueva se crea aparte", async () => {
    const vieja = await prisma.growthEjecucion.create({
      data: {
        disparador: "programada",
        estado: "en_curso",
        inicio: new Date(
          Date.now() - (HORAS_PARA_DAR_POR_INTERRUMPIDA + 1) * 60 * 60 * 1000
        ),
      },
    });

    const nueva = await abrirEjecucion({ disparador: "programada" });

    expect(nueva.id).not.toBe(vieja.id);
    expect(nueva.interrumpidasCerradas).toBe(1);
    const cerrada = await prisma.growthEjecucion.findUnique({
      where: { id: vieja.id },
    });
    expect(cerrada).toMatchObject({ estado: "error", fin: expect.any(Date) });
    expect(cerrada?.error).toContain("interrumpida");
    expect(await enCurso()).toBe(1);
  });

  it("una ejecución interrumpida y una apertura simultánea: las dos peticiones ven una sola nueva", async () => {
    await prisma.growthEjecucion.create({
      data: {
        disparador: "programada",
        estado: "en_curso",
        inicio: new Date(
          Date.now() - (HORAS_PARA_DAR_POR_INTERRUMPIDA + 2) * 60 * 60 * 1000
        ),
      },
    });

    const [a, b] = await Promise.all([
      abrirEjecucion({ disparador: "programada" }),
      abrirEjecucion({ disparador: "programada" }),
    ]);

    expect(a.id).toBe(b.id);
    expect(await enCurso()).toBe(1);
    expect(
      await prisma.growthEjecucion.count({ where: { estado: "error" } })
    ).toBe(1);
  });

  it("los módulos y la versión de los prompts se guardan en la ejecución que se crea", async () => {
    const abierta = await abrirEjecucion({
      disparador: "programada",
      versionPrompts: "abcdef1234567",
      modulos: { discovery: { estado: "en_curso" } },
    });
    const fila = await prisma.growthEjecucion.findUnique({
      where: { id: abierta.id },
    });
    expect(fila).toMatchObject({
      versionPrompts: "abcdef1234567",
      modulos: { discovery: { estado: "en_curso" } },
    });
  });
});
