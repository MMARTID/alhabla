import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../src/lib/prisma.js";
import { cancelarReserva } from "../../../src/modules/bookings/cancelacion.js";
import {
  anularLaCitaCambiada,
  enlazarConLaReservaNueva,
  enlazarReservaModificada,
} from "../../../src/modules/bookings/reservaModificada.js";

vi.mock("../../../src/lib/prisma.js", () => ({
  prisma: {
    booking: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

// La cancelación (BD, evento, aviso #4, lista de espera) tiene sus tests en
// cancelacion.test.ts.
vi.mock("../../../src/modules/bookings/cancelacion.js", () => ({
  cancelarReserva: vi.fn(),
}));

const findFirst = vi.mocked(prisma.booking.findFirst);
const findUnique = vi.mocked(prisma.booking.findUnique);
const update = vi.mocked(prisma.booking.update);
const updateMany = vi.mocked(prisma.booking.updateMany);
const mockedCancelarReserva = vi.mocked(cancelarReserva);

const conversacion = {
  id: "call_chat",
  startedAt: new Date("2026-09-21T12:50:00Z"),
  fromNumber: "+34691325557",
};

describe("enlazarReservaModificada", () => {
  beforeEach(() => vi.clearAllMocks());

  it("enlaza la cita que el mismo cliente canceló en esta conversación", async () => {
    findFirst.mockResolvedValue({ id: "booking_vieja" } as any);
    update.mockResolvedValue({} as any);

    const enlazada = await enlazarReservaModificada({
      businessId: "biz_1",
      nuevaReservaId: "booking_nueva",
      conversacion,
    });

    expect(enlazada).toBe("booking_vieja");
    const where = findFirst.mock.calls[0][0]?.where as any;
    expect(where.isCancelled).toBe(true);
    expect(where.cancelledBy).toEqual({ in: ["client_voice", "client_chat"] });
    expect(where.cancelledAt).toEqual({ gte: conversacion.startedAt });
    expect(where.rescheduledToId).toBeNull();
    expect(where.id).toEqual({ not: "booking_nueva" });
    expect(update).toHaveBeenCalledWith({
      where: { id: "booking_vieja" },
      data: { rescheduledToId: "booking_nueva" },
    });
  });

  it("no enlaza nada si no hay cancelación reciente del cliente", async () => {
    findFirst.mockResolvedValue(null);

    const enlazada = await enlazarReservaModificada({
      businessId: "biz_1",
      nuevaReservaId: "booking_nueva",
      conversacion,
    });

    expect(enlazada).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it("sin ningún teléfono con el que identificar al cliente no busca siquiera", async () => {
    const enlazada = await enlazarReservaModificada({
      businessId: "biz_1",
      nuevaReservaId: "booking_nueva",
      conversacion: { ...conversacion, fromNumber: null },
    });

    expect(enlazada).toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });
});

describe("enlazarConLaReservaNueva", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateMany.mockResolvedValue({ count: 1 } as any);
  });

  it("enlaza la cancelada con la reserva activa de esta conversación", async () => {
    findUnique.mockResolvedValue({
      id: "booking_nueva",
      isCancelled: false,
    } as any);

    const enlazada = await enlazarConLaReservaNueva({
      canceladaId: "booking_vieja",
      conversacion: { id: "call_chat" },
    });

    expect(enlazada).toBe("booking_nueva");
    expect(findUnique).toHaveBeenCalledWith({
      where: { callId: "call_chat" },
      select: { id: true, isCancelled: true },
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "booking_vieja", rescheduledToId: null },
      data: { rescheduledToId: "booking_nueva" },
    });
  });

  it.each([
    ["sin reserva en la conversación", null],
    [
      "con la reserva de la conversación cancelada",
      { id: "booking_nueva", isCancelled: true },
    ],
    [
      "si la cancelada es la propia reserva de la conversación",
      { id: "booking_vieja", isCancelled: false },
    ],
  ])("no enlaza nada %s", async (_caso, reserva) => {
    findUnique.mockResolvedValue(reserva as any);

    const enlazada = await enlazarConLaReservaNueva({
      canceladaId: "booking_vieja",
      conversacion: { id: "call_chat" },
    });

    expect(enlazada).toBeNull();
    expect(updateMany).not.toHaveBeenCalled();
  });
});

describe("anularLaCitaCambiada", () => {
  const entrada = {
    businessId: "biz_1",
    citaAnteriorId: "booking_vieja",
    nuevaReservaId: "booking_nueva",
    cancelledBy: "client_voice" as const,
    etiqueta: "llamada call_1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    updateMany.mockResolvedValue({ count: 1 } as any);
    mockedCancelarReserva.mockResolvedValue({ resultado: "cancelada" });
  });

  it("cancela la vieja (aviso y lista de espera incluidos) y la enlaza con la nueva", async () => {
    expect(await anularLaCitaCambiada(entrada)).toBe("anulada");

    expect(mockedCancelarReserva).toHaveBeenCalledWith({
      bookingId: "booking_vieja",
      businessId: "biz_1",
      cancelledBy: "client_voice",
      etiqueta: "llamada call_1",
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "booking_vieja", rescheduledToId: null },
      data: { rescheduledToId: "booking_nueva" },
    });
  });

  it("si es la misma fila (movida de hora en esta conversación) no cancela nada", async () => {
    expect(
      await anularLaCitaCambiada({
        ...entrada,
        citaAnteriorId: "booking_nueva",
      })
    ).toBe("anulada");
    expect(mockedCancelarReserva).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("si ya estaba cancelada, la enlaza igual", async () => {
    mockedCancelarReserva.mockResolvedValue({ resultado: "ya_cancelada" });

    expect(await anularLaCitaCambiada(entrada)).toBe("anulada");
    expect(updateMany).toHaveBeenCalled();
  });

  it("si ya no existe, no hay nada que enlazar", async () => {
    mockedCancelarReserva.mockResolvedValue({ resultado: "no_encontrada" });
    vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(await anularLaCitaCambiada(entrada)).toBe("anulada");
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("si la cancelación falla devuelve error y lo dice en el log, sin lanzar", async () => {
    mockedCancelarReserva.mockRejectedValue(new Error("BD caída"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await anularLaCitaCambiada(entrada)).toBe("error");
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("el cliente tiene las dos")
    );
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("si solo falla el enlace, la vieja sigue anulada", async () => {
    updateMany.mockRejectedValue(new Error("BD caída"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await anularLaCitaCambiada(entrada)).toBe("anulada");
  });
});
