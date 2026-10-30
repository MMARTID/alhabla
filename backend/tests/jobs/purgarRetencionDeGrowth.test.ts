import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { purgarRetencionDeGrowthJob } from "../../src/jobs/purgarRetencionDeGrowth.js";

// Solo estos dos modelos: si el job tocara growth_decisiones, growth_gestiones
// o los borradores, el acceso lanzaría un TypeError y el test fallaría.
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    growthOportunidad: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
    growthInvestigacion: { updateMany: vi.fn() },
  },
}));

vi.mock("../../src/lib/prisma.js", () => ({ prisma: prismaMock }));

const AHORA = new Date("2026-10-30T05:20:00.000Z");

const SIN_HISTORIAL = {
  decisiones: { none: {} },
  enlaces: { none: {} },
  // Una gestión o una decisión (aunque cuelgue solo del borrador) es historial.
  borradores: {
    none: { OR: [{ gestion: { isNot: null } }, { decisiones: { some: {} } }] },
  },
};

function filas(n: number, estado = "descartada", prefijo = "op") {
  return Array.from({ length: n }, (_, i) => ({
    id: `${prefijo}${i}`,
    estado,
  }));
}

describe("purgarRetencionDeGrowthJob", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(AHORA);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    prismaMock.growthOportunidad.findMany.mockResolvedValue([]);
    prismaMock.growthOportunidad.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.growthOportunidad.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.growthInvestigacion.updateMany.mockResolvedValue({ count: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sin nada vencido no borra nada y devuelve ceros", async () => {
    const r = await purgarRetencionDeGrowthJob();
    expect(r).toEqual({
      filasBorradas: 0,
      extractosVaciados: 0,
      investigacionesSinNombre: 0,
    });
    expect(prismaMock.growthOportunidad.deleteMany).not.toHaveBeenCalled();
  });

  it("borra solo lo vencido que no tiene decisiones, enlaces ni gestión", async () => {
    prismaMock.growthOportunidad.findMany.mockResolvedValueOnce(filas(2));
    prismaMock.growthOportunidad.deleteMany.mockResolvedValue({ count: 2 });

    await purgarRetencionDeGrowthJob();

    expect(prismaMock.growthOportunidad.findMany).toHaveBeenCalledWith({
      where: { retencionHasta: { lt: AHORA }, ...SIN_HISTORIAL },
      select: { id: true, estado: true },
      orderBy: { retencionHasta: "asc" },
      take: 200,
    });
  });

  it("al borrar repite los filtros: lo que el fundador decidió entre la lectura y el borrado se salva", async () => {
    prismaMock.growthOportunidad.findMany.mockResolvedValueOnce(filas(2));
    prismaMock.growthOportunidad.deleteMany.mockResolvedValue({ count: 1 });

    const r = await purgarRetencionDeGrowthJob();

    expect(prismaMock.growthOportunidad.deleteMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["op0", "op1"] },
        retencionHasta: { lt: AHORA },
        ...SIN_HISTORIAL,
      },
    });
    expect(r.filasBorradas).toBe(1);
  });

  it("vacía el extracto de lo vencido que se conserva, con cadena vacía y solo si aún tiene texto", async () => {
    prismaMock.growthOportunidad.updateMany.mockResolvedValue({ count: 7 });

    const r = await purgarRetencionDeGrowthJob();

    expect(prismaMock.growthOportunidad.updateMany).toHaveBeenCalledWith({
      where: { retencionHasta: { lt: AHORA }, extracto: { not: "" } },
      data: { extracto: "" },
    });
    expect(r.extractosVaciados).toBe(7);
  });

  it("quita el nombre de quien edita en las investigaciones de lo vencido (paso C)", async () => {
    prismaMock.growthInvestigacion.updateMany.mockResolvedValue({ count: 3 });

    const r = await purgarRetencionDeGrowthJob();

    expect(prismaMock.growthInvestigacion.updateMany).toHaveBeenCalledWith({
      where: {
        quienEdita: { not: null },
        oportunidad: { is: { retencionHasta: { lt: AHORA } } },
      },
      data: { quienEdita: null },
    });
    expect(r.investigacionesSinNombre).toBe(3);
  });

  it("primero borra y después vacía: lo borrado no se vacía para nada", async () => {
    prismaMock.growthOportunidad.findMany.mockResolvedValueOnce(filas(1));
    prismaMock.growthOportunidad.deleteMany.mockResolvedValue({ count: 1 });
    await purgarRetencionDeGrowthJob();
    expect(
      prismaMock.growthOportunidad.deleteMany.mock.invocationCallOrder[0]
    ).toBeLessThan(
      prismaMock.growthOportunidad.updateMany.mock.invocationCallOrder[0]
    );
  });

  it("con un lote lleno pide otro y para al llegar uno corto", async () => {
    prismaMock.growthOportunidad.findMany
      .mockResolvedValueOnce(filas(200))
      .mockResolvedValueOnce(filas(5, "descartada", "b"));
    prismaMock.growthOportunidad.deleteMany
      .mockResolvedValueOnce({ count: 200 })
      .mockResolvedValueOnce({ count: 5 });

    const r = await purgarRetencionDeGrowthJob();

    expect(prismaMock.growthOportunidad.findMany).toHaveBeenCalledTimes(2);
    expect(r.filasBorradas).toBe(205);
  });

  it("si un lote lleno no borra nada (carrera con el fundador), corta en lugar de repetir para siempre", async () => {
    prismaMock.growthOportunidad.findMany.mockResolvedValue(filas(200));
    prismaMock.growthOportunidad.deleteMany.mockResolvedValue({ count: 0 });

    await purgarRetencionDeGrowthJob();

    expect(prismaMock.growthOportunidad.findMany).toHaveBeenCalledTimes(1);
  });

  it("si agota su plazo, avisa y deja lo que quede para la siguiente pasada", async () => {
    prismaMock.growthOportunidad.findMany.mockResolvedValue(filas(200));
    prismaMock.growthOportunidad.deleteMany.mockImplementation(async () => {
      vi.advanceTimersByTime(121_000);
      return { count: 200 };
    });

    const r = await purgarRetencionDeGrowthJob();

    expect(prismaMock.growthOportunidad.findMany).toHaveBeenCalledTimes(1);
    expect(r.filasBorradas).toBe(200);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("queda trabajo para la siguiente pasada")
    );
  });

  it("avisa cuando entre lo borrado había trabajo que el fundador nunca revisó", async () => {
    prismaMock.growthOportunidad.findMany.mockResolvedValueOnce([
      ...filas(1, "pendiente_aprobacion"),
      ...filas(1, "descartada", "d"),
    ]);
    prismaMock.growthOportunidad.deleteMany.mockResolvedValue({ count: 2 });

    await purgarRetencionDeGrowthJob();

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringMatching(
        /2 filas borradas.*pendiente_aprobacion 1.*descartada 1.*nadie llegó a revisar/
      )
    );
  });

  it("si solo se borró lo ya descartado, no hay advertencia", async () => {
    prismaMock.growthOportunidad.findMany.mockResolvedValueOnce(filas(2));
    prismaMock.growthOportunidad.deleteMany.mockResolvedValue({ count: 2 });
    await purgarRetencionDeGrowthJob();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("si falla un paso, hace los demás y lanza al final para que Scheduler repita", async () => {
    prismaMock.growthOportunidad.findMany.mockRejectedValue(
      new Error("BD caída")
    );
    prismaMock.growthOportunidad.updateMany.mockResolvedValue({ count: 4 });
    prismaMock.growthInvestigacion.updateMany.mockResolvedValue({ count: 1 });

    await expect(purgarRetencionDeGrowthJob()).rejects.toThrow("BD caída");

    expect(prismaMock.growthOportunidad.updateMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.growthInvestigacion.updateMany).toHaveBeenCalledTimes(1);
  });

  it("si falla el vaciado del extracto, el paso C corre igual", async () => {
    prismaMock.growthOportunidad.updateMany.mockRejectedValue(new Error("x"));
    await expect(purgarRetencionDeGrowthJob()).rejects.toThrow("x");
    expect(prismaMock.growthInvestigacion.updateMany).toHaveBeenCalledTimes(1);
  });

  it("usa la hora que se le pasa para decidir qué está vencido", async () => {
    const otra = new Date("2027-06-01T00:00:00.000Z");
    await purgarRetencionDeGrowthJob(otra);
    expect(
      prismaMock.growthOportunidad.updateMany.mock.calls[0][0].where
        .retencionHasta
    ).toEqual({ lt: otra });
  });
});
