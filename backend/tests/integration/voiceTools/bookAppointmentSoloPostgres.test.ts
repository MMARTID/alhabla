import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";
import { prisma } from "../../../src/lib/prisma.js";
import { executeVoiceTool } from "../../../src/modules/voiceTools/service.js";
import { calendarService } from "../../../src/modules/calendar/service.js";
import {
  cerrarRedisDeCompatibilidad,
  compatibilidadActiva,
  conectarRedisDeCompatibilidad,
} from "../../../src/lib/redisDeCompatibilidad.js";
import { resetDb } from "../helpers/db.js";
import {
  createTestBusiness,
  createTestCall,
  createTestProfessional,
  nextOpenSlot,
} from "../helpers/fixtures.js";

// El contrato de la fase 0 «dos book_appointment a la vez… dejan una sola
// reserva» (bookAppointment.test.ts) corre en modo compatibilidad, como toda
// la suite (setup.ts), y ahí el SET NX de Redis bastaría para excluir aunque
// el cerrojo de Postgres estuviera roto. Esta variante lo repite sin
// REDIS_URL, con solo el cerrojo de Postgres, como correrá desde la fase 2.

const eventoFalso = { htmlLink: "https://calendar.google.com/fake-event" };

vi.mock("../../../src/modules/calendar/service.js", () => ({
  calendarService: {
    bookAppointment: vi.fn(),
    getBusyIntervals: vi.fn().mockResolvedValue({
      intervals: [],
      calendarAvailabilityKnown: true,
    }),
  },
}));

describe("book_appointment — el cerrojo de reserva sin Redis (solo Postgres, integración)", () => {
  beforeAll(async () => {
    await cerrarRedisDeCompatibilidad();
  });
  beforeEach(async () => {
    await resetDb();
  });
  afterAll(async () => {
    // Se deja el proceso como lo dejó setup.ts.
    await conectarRedisDeCompatibilidad();
  });

  it("dos book_appointment a la vez del mismo negocio, mismo hueco y capacidad 1 dejan una sola reserva también sin Redis", async () => {
    expect(compatibilidadActiva()).toBe(false);
    const business = await createTestBusiness({ bookingCapacity: 1 });
    await createTestProfessional(business.id);
    const slot = nextOpenSlot();
    const llamadaA = await createTestCall(business.id);
    const llamadaB = await createTestCall(business.id);

    // El calendario tarda como uno real: así la sección crítica es lo
    // bastante ancha para que, sin cerrojo, las dos vean el hueco libre.
    vi.mocked(calendarService.bookAppointment).mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
      return eventoFalso as never;
    });

    const reservar = (callId: string, clientName: string) =>
      executeVoiceTool({
        businessId: business.id,
        toolName: "book_appointment",
        callId,
        params: { clientName, startDateTime: slot.iso, durationMinutes: 30 },
      });

    const resultados = await Promise.all([
      reservar(llamadaA.callId, "Cliente A"),
      reservar(llamadaB.callId, "Cliente B"),
    ]);

    const reservas = await prisma.booking.findMany({
      where: { call: { businessId: business.id }, isCancelled: false },
    });
    expect(reservas).toHaveLength(1);
    expect(reservas[0].programedAt.toISOString()).toBe(slot.date.toISOString());
    const perdedoras = resultados.filter((r) => r.result?.success === false);
    expect(perdedoras).toHaveLength(1);
    // La segunda esperó su turno y vio el hueco ya ocupado.
    expect(["CAPACITY_REACHED", "ALL_PROFESSIONALS_BUSY"]).toContain(
      perdedoras[0].result?.code
    );
    expect(calendarService.bookAppointment).toHaveBeenCalledTimes(1);
  });
});
