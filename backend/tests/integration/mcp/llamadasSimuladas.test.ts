import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../../src/lib/prisma.js";
import { resetDb } from "../helpers/db.js";
import { createTestBusiness, createTestCall } from "../helpers/fixtures.js";
import {
  borrarLlamadasSimuladas,
  crearLlamadaSimulada,
} from "../../../mcp/llamadasSimuladas.js";

const url = process.env.DATABASE_URL!;

beforeEach(async () => {
  await resetDb();
});

async function citaPara(
  callId: string,
  datos: { isCancelled?: boolean; externalEventId?: string | null } = {}
) {
  const llamada = await prisma.call.findUniqueOrThrow({ where: { callId } });
  return prisma.booking.create({
    data: {
      callId: llamada.id,
      programedAt: new Date("2026-10-20T09:00:00Z"),
      durationMinutes: 30,
      numberPeople: 1,
      isCancelled: datos.isCancelled ?? false,
      externalEventId: datos.externalEventId === undefined ? "evento-1" : datos.externalEventId,
    },
  });
}

describe("crearLlamadaSimulada", () => {
  it("crea una llamada nueva en cada simulación, de Telnyx y del negocio", async () => {
    const negocio = await createTestBusiness();
    const primera = await crearLlamadaSimulada(url, negocio.id, "+34600111222");
    const segunda = await crearLlamadaSimulada(url, negocio.id, "+34600111222");

    expect(primera).not.toBe(segunda);
    const llamadas = await prisma.call.findMany({
      where: { businessId: negocio.id },
      orderBy: { createdAt: "asc" },
    });
    expect(llamadas.map((l) => l.callId).sort()).toEqual([primera, segunda].sort());
    expect(llamadas.every((l) => l.voiceProvider === "telnyx")).toBe(true);
    expect(llamadas.every((l) => l.fromNumber === "+34600111222")).toBe(true);
  });

  it("dos citas de prueba ya no chocan: cada una tiene su llamada", async () => {
    const negocio = await createTestBusiness();
    await citaPara(await crearLlamadaSimulada(url, negocio.id));
    await expect(
      citaPara(await crearLlamadaSimulada(url, negocio.id))
    ).resolves.toBeDefined();
  });

  it("falla con un negocio que no existe, sin dejar filas", async () => {
    await expect(crearLlamadaSimulada(url, "no-existe")).rejects.toThrow(
      /No existe el negocio no-existe/
    );
    expect(await prisma.call.count()).toBe(0);
  });
});

describe("borrarLlamadasSimuladas", () => {
  it("borra las simuladas y deja las reales", async () => {
    const negocio = await createTestBusiness();
    const real = await createTestCall(negocio.id);
    await crearLlamadaSimulada(url, negocio.id);
    await crearLlamadaSimulada(url, negocio.id);

    const resultado = await borrarLlamadasSimuladas(url);
    expect(resultado).toEqual({ borradas: 2, conservadas: [] });
    expect((await prisma.call.findMany()).map((l) => l.id)).toEqual([real.id]);
  });

  it("conserva la que tiene una cita viva en el calendario y la devuelve", async () => {
    const negocio = await createTestBusiness();
    const conCita = await crearLlamadaSimulada(url, negocio.id);
    const cita = await citaPara(conCita);
    const cancelada = await crearLlamadaSimulada(url, negocio.id);
    await citaPara(cancelada, { isCancelled: true });
    const sinEvento = await crearLlamadaSimulada(url, negocio.id);
    await citaPara(sinEvento, { externalEventId: null });

    const resultado = await borrarLlamadasSimuladas(url);
    expect(resultado.borradas).toBe(2);
    expect(resultado.conservadas).toEqual([
      { callId: conCita, bookingId: cita.id, programedAt: "2026-10-20T09:00:00.000Z" },
    ]);
    expect((await prisma.call.findMany()).map((l) => l.callId)).toEqual([conCita]);
    // La cita borrada con su llamada se va en cascada; la viva sigue.
    expect((await prisma.booking.findMany()).map((b) => b.id)).toEqual([cita.id]);
  });

  it("con businessId solo toca ese negocio", async () => {
    const uno = await createTestBusiness();
    const otro = await createTestBusiness({ name: "Barbería" });
    await crearLlamadaSimulada(url, uno.id);
    const delOtro = await crearLlamadaSimulada(url, otro.id);

    expect(await borrarLlamadasSimuladas(url, uno.id)).toEqual({
      borradas: 1,
      conservadas: [],
    });
    expect((await prisma.call.findMany()).map((l) => l.callId)).toEqual([delOtro]);
  });
});
