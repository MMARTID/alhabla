import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  avisarDeLlamadasSinResultado,
  cleanupZombieCallsJob,
} from "../../src/jobs/cleanupZombieCalls.js";
import { prisma } from "../../src/lib/prisma.js";

vi.mock("../../src/lib/prisma.js", () => ({
  prisma: {
    call: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

const mockedFindMany = vi.mocked(prisma.call.findMany);
const mockedUpdateMany = vi.mocked(prisma.call.updateMany);

describe("cleanupZombieCallsJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no actualiza nada si no hay llamadas zombie", async () => {
    mockedFindMany.mockResolvedValue([]);

    await cleanupZombieCallsJob();

    expect(mockedUpdateMany).not.toHaveBeenCalled();
  });

  it("busca llamadas IN_PROGRESS con más de 20 minutos sin actualizar", async () => {
    mockedFindMany.mockResolvedValue([]);

    await cleanupZombieCallsJob();

    const query = mockedFindMany.mock.calls[0][0] as any;
    expect(query.where.status).toBe("IN_PROGRESS");
    const thresholdMs = Date.now() - query.where.updatedAt.lt.getTime();
    // 20 minutos: el agente cuelga solo a los 10, así que una llamada más
    // antigua que esto ya no puede ser la que está en curso.
    expect(thresholdMs).toBeGreaterThanOrEqual(20 * 60 * 1000);
    expect(thresholdMs).toBeLessThan(20 * 60 * 1000 + 5000);
  });

  it("marca como TIMED_OUT las llamadas zombie encontradas", async () => {
    mockedFindMany.mockResolvedValue([
      { id: "call_1" },
      { id: "call_2" },
    ] as any);
    mockedUpdateMany.mockResolvedValue({ count: 2 } as any);

    await cleanupZombieCallsJob();

    const update = mockedUpdateMany.mock.calls[0][0] as any;
    expect(update.where.id).toEqual({ in: ["call_1", "call_2"] });
    expect(update.data).toEqual({ status: "TIMED_OUT" });
    // El predicado se repite en el update: si entre la búsqueda y la
    // escritura llega el webhook call_ended, la llamada ya está COMPLETED y
    // no debe degradarse a TIMED_OUT.
    expect(update.where.status).toBe("IN_PROGRESS");
    expect(update.where.updatedAt.lt).toBeInstanceOf(Date);
  });
});

// docs/historico/PLAN-RETIRAR-RETELL.md, PR 5: lo vigila la alerta de voz por su «[Salud]».
describe("avisarDeLlamadasSinResultado", () => {
  const ahora = new Date("2026-10-17T12:00:00Z");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("busca las de Telnyx acabadas sin resultado en la ventana del barrido, sin las de coste 0", async () => {
    mockedFindMany.mockResolvedValue([]);

    await avisarDeLlamadasSinResultado(ahora);

    const { where } = mockedFindMany.mock.calls[0][0] as any;
    expect(where).toMatchObject({
      voiceProvider: "telnyx",
      status: "COMPLETED",
      outcome: null,
      OR: [{ providerCostCents: null }, { providerCostCents: { not: 0 } }],
    });
    // De hace 25 a hace 10 minutos: 10 de margen para los insights y 15 de
    // ventana, la cadencia del barrido, para avisar de cada una una vez.
    expect(where.endedAt.gte).toEqual(new Date("2026-10-17T11:35:00Z"));
    expect(where.endedAt.lt).toEqual(new Date("2026-10-17T11:50:00Z"));
  });

  it("si hay alguna, deja un error con «[Salud]» y cada llamada con su negocio", async () => {
    mockedFindMany.mockResolvedValue([
      { id: "call_1", businessId: "biz_1" },
    ] as any);
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    await avisarDeLlamadasSinResultado(ahora);

    expect(errorLog).toHaveBeenCalledWith(
      "[Salud] 1 llamada de Telnyx acabó hace más de 10 min sin resultado (no llegaron los insights de la conversación): call_1 (negocio biz_1)"
    );
    errorLog.mockRestore();
  });

  it("si no hay ninguna, no escribe nada", async () => {
    mockedFindMany.mockResolvedValue([]);
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    await avisarDeLlamadasSinResultado(ahora);

    expect(errorLog).not.toHaveBeenCalled();
    errorLog.mockRestore();
  });

  it("nunca lanza: si la consulta falla lo dice en el log", async () => {
    mockedFindMany.mockRejectedValue(new Error("BD caída"));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(avisarDeLlamadasSinResultado(ahora)).resolves.toBeUndefined();
    expect(errorLog).toHaveBeenCalledWith(
      expect.stringContaining(
        "[Salud] No se pudo comprobar si hay llamadas sin resultado: BD caída"
      )
    );
    errorLog.mockRestore();
  });
});
