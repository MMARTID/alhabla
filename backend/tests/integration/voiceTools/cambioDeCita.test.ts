import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "../../../src/lib/prisma.js";
import { executeVoiceTool } from "../../../src/modules/voiceTools/service.js";
import { calendarService } from "../../../src/modules/calendar/service.js";
import { resetDb } from "../helpers/db.js";
import {
  createTestBusiness,
  createTestCall,
  createTestProfessional,
  nextOpenSlot,
} from "../helpers/fixtures.js";

// Auditoría del 16-10: para cambiar una cita la recepcionista cancelaba y
// luego reservaba, y si la reserva fallaba el cliente se quedaba sin
// ninguna (chat real del 13-10). Ahora reserva primero la nueva
// (check_availability con replacesBookingId) y la vieja se anula solo si la
// nueva entra. Contra Postgres real: la vieja no puede bloquear a la nueva
// en un negocio de una sola persona aunque se solapen, y las dos quedan
// enlazadas para el panel. Google es lo único falso.
vi.mock("../../../src/modules/calendar/service.js", () => ({
  calendarService: {
    bookAppointment: vi.fn(),
    getBusyIntervals: vi.fn(),
    cancelAppointment: vi.fn(),
  },
}));

const MOVIL = "+34600111222";

describe("cambio de cita por la recepcionista (integración)", () => {
  beforeEach(async () => {
    await resetDb();
    vi.mocked(calendarService.bookAppointment).mockReset();
    vi.mocked(calendarService.bookAppointment).mockResolvedValue({
      id: "evt_nuevo",
    } as never);
    vi.mocked(calendarService.cancelAppointment).mockReset();
    vi.mocked(calendarService.cancelAppointment).mockResolvedValue({
      resultado: "borrado",
    } as never);
  });

  async function preparar() {
    const business = await createTestBusiness({ bookingCapacity: 1 });
    const profesional = await createTestProfessional(business.id);
    const slot = nextOpenSlot();
    const llamadaAnterior = await createTestCall(business.id, {
      fromNumber: MOVIL,
      status: "COMPLETED",
      startedAt: new Date(Date.now() - 2 * 24 * 60 * 60_000),
    });
    const vieja = await prisma.booking.create({
      data: {
        callId: llamadaAnterior.id,
        programedAt: slot.date,
        durationMinutes: 30,
        numberPeople: 1,
        professionalId: profesional.id,
        clientName: "María",
        externalEventId: "evt_viejo",
        externalCalendarProvider: "google",
        externalCalendarId: "primary",
      },
    });
    // El evento de la cita vieja también está en el Google del negocio.
    vi.mocked(calendarService.getBusyIntervals).mockResolvedValue({
      intervals: [
        {
          externalEventId: "evt_viejo",
          start: slot.date,
          end: new Date(slot.date.getTime() + 30 * 60_000),
        },
      ],
      calendarAvailabilityKnown: true,
    } as never);
    const llamada = await createTestCall(business.id, { fromNumber: MOVIL });
    // Un cuarto de hora después: se solapa con la vieja (12:00-12:30 →
    // 12:15-12:45). En hora local con su offset, como la escribe el modelo.
    const nuevaHora = {
      iso: slot.iso.replace("T12:00:00", "T12:15:00"),
      date: new Date(slot.date.getTime() + 15 * 60_000),
    };
    return { business, vieja, llamada, nuevaHora };
  }

  function comprobar(
    businessId: string,
    callId: string,
    startDateTime: { iso: string },
    replacesBookingId?: string
  ) {
    return executeVoiceTool({
      businessId,
      toolName: "check_availability",
      callId,
      params: {
        startDateTime: startDateTime.iso,
        durationMinutes: 30,
        ...(replacesBookingId ? { replacesBookingId } : {}),
      },
    });
  }

  it("la vieja no bloquea a la nueva; al reservar, la vieja queda anulada y enlazada", async () => {
    const { business, vieja, llamada, nuevaHora } = await preparar();

    // Sin decir qué cita cambia, la propia cita vieja ocupa el hueco.
    const sinCambio = await comprobar(business.id, llamada.callId, nuevaHora);
    expect(sinCambio.result?.available).toBe(false);

    const comprobacion = await comprobar(
      business.id,
      llamada.callId,
      nuevaHora,
      vieja.id
    );
    expect(comprobacion.result?.available).toBe(true);

    const reserva = await executeVoiceTool({
      businessId: business.id,
      toolName: "book_appointment",
      callId: llamada.callId,
      params: {
        clientName: "María",
        availabilityToken: comprobacion.result?.availabilityToken,
      },
    });
    expect(reserva.result).toMatchObject({
      success: true,
      citaAnterior: "anulada",
    });

    const nueva = await prisma.booking.findUnique({
      where: { callId: llamada.id },
    });
    expect(nueva?.programedAt.toISOString()).toBe(nuevaHora.date.toISOString());
    expect(nueva?.isCancelled).toBe(false);

    const anulada = await prisma.booking.findUnique({
      where: { id: vieja.id },
    });
    expect(anulada).toMatchObject({
      isCancelled: true,
      cancelledBy: "client_voice",
      rescheduledToId: nueva?.id,
    });
    expect(calendarService.cancelAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: "evt_viejo" })
    );
  });

  it("si la nueva no entra en el calendario, la vieja sigue activa", async () => {
    const { business, vieja, llamada, nuevaHora } = await preparar();
    vi.mocked(calendarService.bookAppointment).mockRejectedValue(
      new Error("Google 503")
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    const comprobacion = await comprobar(
      business.id,
      llamada.callId,
      nuevaHora,
      vieja.id
    );
    const reserva = await executeVoiceTool({
      businessId: business.id,
      toolName: "book_appointment",
      callId: llamada.callId,
      params: {
        clientName: "María",
        availabilityToken: comprobacion.result?.availabilityToken,
      },
    });

    expect(reserva.result?.success).toBe(false);
    const sigue = await prisma.booking.findUnique({ where: { id: vieja.id } });
    expect(sigue).toMatchObject({ isCancelled: false, rescheduledToId: null });
    // La reserva pendiente recuerda qué cita anular si acaba entrando.
    const pendiente = await prisma.lead.findFirst({
      where: { callId: llamada.id, type: "pending_booking" },
    });
    expect(pendiente?.data).toMatchObject({ replacesBookingId: vieja.id });
  });

  it("no deja cambiar la cita de otro número", async () => {
    const { business, vieja, nuevaHora } = await preparar();
    const otra = await createTestCall(business.id, {
      fromNumber: "+34699000111",
    });

    const comprobacion = await comprobar(
      business.id,
      otra.callId,
      nuevaHora,
      vieja.id
    );

    expect(comprobacion.result).toMatchObject({
      available: false,
      code: "APPOINTMENT_TO_CHANGE_NOT_FOUND",
    });
  });
});
