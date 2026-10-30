import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { caducarAprobadasDeGrowthJob } from "../../src/jobs/caducarAprobadasDeGrowth.js";
import { puedeTransicionar } from "../../src/modules/growth/estados.js";

const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    growthOportunidad: { findMany: vi.fn(), updateMany: vi.fn() },
    growthBorrador: { findFirst: vi.fn(), updateMany: vi.fn() },
    growthDecision: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  return { prismaMock };
});

vi.mock("../../src/lib/prisma.js", () => ({ prisma: prismaMock }));

const AHORA = new Date("2026-10-30T05:20:00.000Z");
const ESTADOS_ABIERTOS = [
  "borrador",
  "bloqueado",
  "pendiente_aprobacion",
  "aprobado",
];

function vencida(id: string, expiraEn = "2026-10-20T12:00:00.000Z") {
  return { id, dominio: `${id}.example.com`, expiraEn: new Date(expiraEn) };
}

describe("caducarAprobadasDeGrowthJob", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(AHORA);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    prismaMock.$transaction.mockImplementation(
      async (cb: (tx: typeof prismaMock) => unknown) => cb(prismaMock)
    );
    prismaMock.growthOportunidad.findMany.mockResolvedValue([]);
    prismaMock.growthOportunidad.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.growthBorrador.findFirst.mockResolvedValue({ id: "bor_ok" });
    prismaMock.growthBorrador.updateMany.mockResolvedValue({ count: 2 });
    prismaMock.growthDecision.create.mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sin vencidas no abre ninguna transacción", async () => {
    const r = await caducarAprobadasDeGrowthJob();
    expect(r).toEqual({ caducadas: 0, borradoresDescartados: 0, fallidas: 0 });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("solo mira las aprobadas con fecha vencida, las más viejas primero, de 50 en 50", async () => {
    await caducarAprobadasDeGrowthJob();
    expect(prismaMock.growthOportunidad.findMany).toHaveBeenCalledWith({
      where: { estado: "aprobada", expiraEn: { lt: AHORA } },
      select: { id: true, dominio: true, expiraEn: true },
      orderBy: { expiraEn: "asc" },
      take: 50,
    });
  });

  it("caduca la oportunidad, descarta sus borradores abiertos y deja una decisión, todo en una transacción", async () => {
    prismaMock.growthOportunidad.findMany.mockResolvedValueOnce([
      vencida("op1"),
    ]);

    const r = await caducarAprobadasDeGrowthJob();

    expect(r).toEqual({ caducadas: 1, borradoresDescartados: 2, fallidas: 0 });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.growthOportunidad.updateMany).toHaveBeenCalledWith({
      where: { id: "op1", estado: "aprobada", expiraEn: { lt: AHORA } },
      data: { estado: "caducada" },
    });
    expect(prismaMock.growthBorrador.updateMany).toHaveBeenCalledWith({
      where: { oportunidadId: "op1", estado: { in: ESTADOS_ABIERTOS } },
      data: { estado: "descartado" },
    });
    expect(prismaMock.growthDecision.create).toHaveBeenCalledWith({
      data: {
        oportunidadId: "op1",
        borradorId: "bor_ok",
        accion: "caducar",
        motivo: "Venció el 2026-10-20 sin gestionarse",
        por: "sistema",
      },
    });
  });

  it("el borrador aprobado se busca ANTES de descartarlo, para enlazar la decisión", async () => {
    prismaMock.growthOportunidad.findMany.mockResolvedValueOnce([
      vencida("op1"),
    ]);
    await caducarAprobadasDeGrowthJob();
    expect(prismaMock.growthBorrador.findFirst).toHaveBeenCalledWith({
      where: { oportunidadId: "op1", estado: "aprobado" },
      select: { id: true },
    });
    expect(
      prismaMock.growthBorrador.findFirst.mock.invocationCallOrder[0]
    ).toBeLessThan(
      prismaMock.growthBorrador.updateMany.mock.invocationCallOrder[0]
    );
  });

  it("si no hay borrador aprobado, la decisión se escribe igualmente sin borrador", async () => {
    prismaMock.growthOportunidad.findMany.mockResolvedValueOnce([
      vencida("op1"),
    ]);
    prismaMock.growthBorrador.findFirst.mockResolvedValue(null);
    await caducarAprobadasDeGrowthJob();
    expect(
      prismaMock.growthDecision.create.mock.calls[0][0].data.borradorId
    ).toBeUndefined();
  });

  it("carrera: si el fundador movió la oportunidad entre la lectura y la caducidad, no se toca nada más", async () => {
    prismaMock.growthOportunidad.findMany.mockResolvedValueOnce([
      vencida("op1"),
    ]);
    prismaMock.growthOportunidad.updateMany.mockResolvedValue({ count: 0 });

    const r = await caducarAprobadasDeGrowthJob();

    expect(r).toEqual({ caducadas: 0, borradoresDescartados: 0, fallidas: 0 });
    expect(prismaMock.growthBorrador.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.growthDecision.create).not.toHaveBeenCalled();
  });

  it("un fallo en una oportunidad se registra y se sigue con las demás", async () => {
    prismaMock.growthOportunidad.findMany.mockResolvedValueOnce([
      vencida("mala"),
      vencida("buena"),
    ]);
    prismaMock.growthDecision.create
      .mockRejectedValueOnce(new Error("violación de clave"))
      .mockResolvedValueOnce({});

    const r = await caducarAprobadasDeGrowthJob();

    expect(r).toEqual({ caducadas: 1, borradoresDescartados: 2, fallidas: 1 });
    expect(console.error).toHaveBeenCalledWith(
      expect.stringMatching(
        /^\[Growth\] No se pudo caducar la oportunidad mala \(mala\.example\.com\): violación de clave/
      )
    );
    // Un lote corto es el último: no hace falta otra consulta.
    expect(prismaMock.growthOportunidad.findMany).toHaveBeenCalledTimes(1);
  });

  it("con un lote lleno pide otro, excluyendo las que fallaron, y para al llegar uno corto", async () => {
    const lleno = Array.from({ length: 50 }, (_, i) => vencida(`op${i}`));
    prismaMock.growthOportunidad.findMany
      .mockResolvedValueOnce(lleno)
      .mockResolvedValueOnce([vencida("ultima")]);
    // La primera del primer lote falla.
    prismaMock.growthDecision.create.mockRejectedValueOnce(new Error("x"));

    const r = await caducarAprobadasDeGrowthJob();

    expect(prismaMock.growthOportunidad.findMany).toHaveBeenCalledTimes(2);
    expect(
      prismaMock.growthOportunidad.findMany.mock.calls[1][0].where
    ).toEqual({
      estado: "aprobada",
      expiraEn: { lt: AHORA },
      id: { notIn: ["op0"] },
    });
    expect(r).toEqual({
      caducadas: 50,
      borradoresDescartados: 100,
      fallidas: 1,
    });
  });

  it("un lote lleno que luego viene vacío termina sin bucle infinito", async () => {
    const lleno = Array.from({ length: 50 }, (_, i) => vencida(`op${i}`));
    prismaMock.growthOportunidad.findMany
      .mockResolvedValueOnce(lleno)
      .mockResolvedValueOnce([]);
    await caducarAprobadasDeGrowthJob();
    expect(prismaMock.growthOportunidad.findMany).toHaveBeenCalledTimes(2);
  });

  it("las transacciones van en serie, una a una", async () => {
    prismaMock.growthOportunidad.findMany.mockResolvedValueOnce([
      vencida("a"),
      vencida("b"),
      vencida("c"),
    ]);
    let abiertas = 0;
    let maximo = 0;
    prismaMock.$transaction.mockImplementation(
      async (cb: (tx: typeof prismaMock) => unknown) => {
        abiertas += 1;
        maximo = Math.max(maximo, abiertas);
        await Promise.resolve();
        const r = await cb(prismaMock);
        abiertas -= 1;
        return r;
      }
    );
    await caducarAprobadasDeGrowthJob();
    expect(maximo).toBe(1);
  });

  it("si falla la consulta (la BD), el job lanza para que Scheduler repita", async () => {
    prismaMock.growthOportunidad.findMany.mockRejectedValue(
      new Error("BD caída")
    );
    await expect(caducarAprobadasDeGrowthJob()).rejects.toThrow("BD caída");
  });

  it("usa la hora que se le pasa, no la del reloj", async () => {
    const otra = new Date("2027-01-01T00:00:00.000Z");
    await caducarAprobadasDeGrowthJob(otra);
    expect(
      prismaMock.growthOportunidad.findMany.mock.calls[0][0].where.expiraEn
    ).toEqual({
      lt: otra,
    });
  });

  it("depende de estados.ts: la transición aprobada → caducada la hace el sistema", () => {
    expect(puedeTransicionar("aprobada", "caducada", "sistema")).toBe(true);
    // Y solo el sistema, solo desde aprobada.
    expect(puedeTransicionar("aprobada", "caducada", "admin")).toBe(false);
    expect(
      puedeTransicionar("pendiente_aprobacion", "caducada", "sistema")
    ).toBe(false);
  });
});
