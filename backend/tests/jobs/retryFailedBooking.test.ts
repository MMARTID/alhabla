import { describe, it, expect, beforeEach, vi } from "vitest";
import { filaDeConexion } from "../helpers/conexionDeCalendario.js";
import {
  enqueueCopiaDeLaCitaJob,
  enqueueEmailJob,
  enqueueRetryBookingJob,
} from "../../src/lib/cloudTasks.js";
import {
  avisarCitaRecuperada,
  avisarReintentosAgotados,
  avisarReservaPerdida,
} from "../../src/modules/whatsapp/avisosNegocio.js";
import { processRetryFailedBookingJob } from "../../src/jobs/retryFailedBooking.js";
import { prisma } from "../../src/lib/prisma.js";
import { calendarService } from "../../src/modules/calendar/service.js";
import {
  checkBusinessHours,
  checkBookingRestrictions,
} from "../../src/lib/businessSchedule.js";
import { checkAvailability } from "../../src/lib/availability.js";
import {
  acquireBookingLock,
  releaseBookingLock,
} from "../../src/lib/bookingLock.js";
import { buildCalendarIdempotencyKey } from "../../src/lib/calendarIdempotency.js";
import { programarMensajesAlCliente } from "../../src/modules/whatsapp/mensajesCliente.js";
import { whatsappAdapter } from "../../src/adapters/whatsapp/WhatsAppAdapter.js";
import {
  almacenEnMemoria,
  reiniciarAlmacenEnMemoria,
} from "../helpers/almacenEnMemoria.js";
import { anularLaCitaCambiada } from "../../src/modules/bookings/reservaModificada.js";

vi.mock("../../src/lib/cloudTasks.js", () => ({
  enqueueRetryBookingJob: vi.fn(),
  enqueueEmailJob: vi.fn(),
  // La copia de la cita (calendar/copiaDeLaCita.ts, real aquí) y el
  // recordatorio que programa la alerta de calendario desconectado.
  enqueueCopiaDeLaCitaJob: vi.fn(),
  enqueueVolcadoDeLaAgendaJob: vi.fn(),
  enqueueRecordatorioDeCalendarioJob: vi.fn(),
}));
vi.mock("../../src/modules/whatsapp/avisosNegocio.js", () => ({
  avisarCitaRecuperada: vi.fn().mockResolvedValue({ via: "interactivo" }),
  avisarReservaPerdida: vi.fn().mockResolvedValue({ via: "interactivo" }),
  avisarReintentosAgotados: vi.fn().mockResolvedValue({ via: "interactivo" }),
  // La alerta de calendario desconectado (marcarCalendarioDesconectado).
  avisarAlerta: vi.fn().mockResolvedValue({ via: "interactivo" }),
}));
vi.mock("../../src/modules/whatsapp/mensajesCliente.js", () => ({
  programarMensajesAlCliente: vi
    .fn()
    .mockResolvedValue({ confirmacion: "programada" }),
}));
vi.mock("../../src/adapters/whatsapp/WhatsAppAdapter.js", () => ({
  whatsappAdapter: { isConfigured: vi.fn().mockReturnValue(true) },
}));
// La anulación de la cita que se cambia tiene sus tests en
// reservaModificada.test.ts.
vi.mock("../../src/modules/bookings/reservaModificada.js", () => ({
  anularLaCitaCambiada: vi.fn().mockResolvedValue("anulada"),
}));
vi.mock("../../src/lib/prisma.js", () => ({
  prisma: {
    lead: { findUnique: vi.fn(), update: vi.fn() },
    call: { findUnique: vi.fn() },
    business: { findUnique: vi.fn(), update: vi.fn() },
    calendarConnection: { updateMany: vi.fn() },
    service: { findMany: vi.fn() },
    professional: { findFirst: vi.fn() },
    booking: { findUnique: vi.fn(), findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("../../src/modules/calendar/service.js", () => ({
  calendarService: { bookAppointment: vi.fn(), getBusyIntervals: vi.fn() },
}));

vi.mock("../../src/lib/businessSchedule.js", () => ({
  checkBusinessHours: vi.fn(),
  checkBookingRestrictions: vi.fn(),
}));

vi.mock("../../src/lib/availability.js", () => ({
  checkAvailability: vi.fn(),
  computeAvailabilityLookaheadMs: vi.fn(
    (durationMinutes: number) => 4 * 60 * 60_000 + durationMinutes * 60_000
  ),
}));

vi.mock("../../src/lib/bookingLock.js", () => ({
  acquireBookingLock: vi.fn(),
  releaseBookingLock: vi.fn(),
}));

// La caché de voz vive en el almacén temporal de Postgres: aquí, su
// versión en memoria, para mirar la clave exacta que se borra.
vi.mock(
  "../../src/lib/almacenTemporal.js",
  async () => (await import("../helpers/almacenEnMemoria.js")).almacenEnMemoria
);

const mockedLeadFindUnique = vi.mocked(prisma.lead.findUnique);
const mockedEnqueueRetryBookingJob = vi.mocked(enqueueRetryBookingJob);
const mockedEnqueueCopia = vi.mocked(enqueueCopiaDeLaCitaJob);
const mockedAvisarCitaRecuperada = vi.mocked(avisarCitaRecuperada);
const mockedLeadUpdate = vi.mocked(prisma.lead.update);
const mockedCallFindUnique = vi.mocked(prisma.call.findUnique);
const mockedBusinessFindUnique = vi.mocked(prisma.business.findUnique);
const mockedBusinessUpdate = vi.mocked(prisma.business.update);
const mockedServiceFindMany = vi.mocked(prisma.service.findMany);
const mockedProfessionalFindFirst = vi.mocked(prisma.professional.findFirst);
const mockedBookingFindUnique = vi.mocked(prisma.booking.findUnique);
const mockedBookingFindFirst = vi.mocked(prisma.booking.findFirst);
const mockedAnularLaCitaCambiada = vi.mocked(anularLaCitaCambiada);
const mockedTransaction = vi.mocked(prisma.$transaction);
const mockedBookAppointment = vi.mocked(calendarService.bookAppointment);
const mockedGetBusyIntervals = vi.mocked(calendarService.getBusyIntervals);
const mockedCheckBusinessHours = vi.mocked(checkBusinessHours);
const mockedCheckBookingRestrictions = vi.mocked(checkBookingRestrictions);
const mockedCheckAvailability = vi.mocked(checkAvailability);
const mockedAcquireBookingLock = vi.mocked(acquireBookingLock);
const mockedReleaseBookingLock = vi.mocked(releaseBookingLock);
const mockedProgramarMensajes = vi.mocked(programarMensajesAlCliente);
const mockedWhatsappConfigurado = vi.mocked(whatsappAdapter.isConfigured);

const leadId = "lead_1";
const pendingBookingData = {
  clientName: "Ana García",
  clientEmail: "ana@example.com",
  clientPhone: "+34600123456",
  startDateTime: "2026-09-10T10:00:00Z",
  durationMinutes: 30,
  serviceIds: ["service_1"],
  professionalId: "pro_1",
};

function buildLead(overrides: Record<string, unknown> = {}) {
  return {
    id: leadId,
    callId: "call_1",
    resolvedAt: null,
    data: pendingBookingData,
    ...overrides,
  };
}

function buildBusiness(overrides: Record<string, unknown> = {}) {
  return {
    id: "biz_1",
    calendarProvider: "google",
    calendarConnections: [
      filaDeConexion("google", { refreshToken: "google_refresh_token" }),
    ],
    ...overrides,
  };
}

describe("processRetryFailedBookingJob", () => {
  let mockUpsert: ReturnType<typeof vi.fn>;
  let mockLeadUpdate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsert = vi.fn().mockResolvedValue({ id: "booking_1" });
    mockedWhatsappConfigurado.mockReturnValue(true);
    mockedProgramarMensajes.mockResolvedValue({ confirmacion: "programada" });
    mockLeadUpdate = vi.fn().mockResolvedValue({});
    mockedTransaction.mockImplementation(async (callback: any) =>
      callback({
        booking: { upsert: mockUpsert },
        lead: { update: mockLeadUpdate },
      })
    );
    mockedBookAppointment.mockResolvedValue({
      id: "gcal_event_1",
      htmlLink: "https://calendar.google.com/event/1",
    } as any);
    mockedServiceFindMany.mockResolvedValue([
      { id: "service_1", name: "Corte" },
    ] as any);
    mockedProfessionalFindFirst.mockResolvedValue({
      id: "pro_1",
      name: "Montse",
    } as any);
    mockedBookingFindUnique.mockResolvedValue(null);
    mockedCheckBusinessHours.mockReturnValue({
      success: true,
      isOpen: true,
    } as any);
    mockedCheckBookingRestrictions.mockReturnValue({ success: true } as any);
    mockedCheckAvailability.mockResolvedValue({
      available: true,
      message: "",
      capacityUsed: 0,
      capacityTotal: 1,
      availableProfessionals: [{ id: "pro_1", name: "Montse" }],
    } as any);
    mockedAcquireBookingLock.mockResolvedValue("lock-token");
    mockedGetBusyIntervals.mockResolvedValue({
      intervals: [],
      calendarAvailabilityKnown: true,
    });
    mockedReleaseBookingLock.mockResolvedValue(undefined);
    reiniciarAlmacenEnMemoria();
    mockedBusinessUpdate.mockResolvedValue({} as any);
    mockedLeadUpdate.mockResolvedValue({} as any);
  });

  it("no hace nada si el lead ya no existe", async () => {
    mockedLeadFindUnique.mockResolvedValue(null);

    await processRetryFailedBookingJob({ leadId });

    expect(mockedCallFindUnique).not.toHaveBeenCalled();
    expect(mockedBookAppointment).not.toHaveBeenCalled();
  });

  it("no hace nada si el lead ya está resuelto", async () => {
    mockedLeadFindUnique.mockResolvedValue(
      buildLead({ resolvedAt: new Date() }) as any
    );

    await processRetryFailedBookingJob({ leadId });

    expect(mockedBookAppointment).not.toHaveBeenCalled();
  });

  it("lanza si la llamada asociada al lead no existe", async () => {
    mockedLeadFindUnique.mockResolvedValue(buildLead() as any);
    mockedCallFindUnique.mockResolvedValue(null);

    await expect(processRetryFailedBookingJob({ leadId })).rejects.toThrow(
      "Call call_1 no existe"
    );
  });

  it("lanza si el negocio de la llamada no existe", async () => {
    mockedLeadFindUnique.mockResolvedValue(buildLead() as any);
    mockedCallFindUnique.mockResolvedValue({ businessId: "biz_1" } as any);
    mockedBusinessFindUnique.mockResolvedValue(null);

    await expect(processRetryFailedBookingJob({ leadId })).rejects.toThrow(
      "Business biz_1 no existe"
    );
  });

  // PLAN-AGENDA-PRINCIPAL.md: el calendario conectado ya no decide si se
  // reserva. Antes, con Google desconectado, el job se reprogramaba cada 6 h
  // y a los dos días avisaba de reintentos agotados; ahora la cita entra en
  // la agenda de Alhabla y su copia espera a que el dueño reconecte.
  it("con Google desconectado ya no reprograma a 6 h: reserva con la copia pendiente, sin llamar al calendario", async () => {
    mockedLeadFindUnique.mockResolvedValue(buildLead() as any);
    mockedCallFindUnique.mockResolvedValue({ businessId: "biz_1" } as any);
    mockedBusinessFindUnique.mockResolvedValue(
      buildBusiness({
        calendarConnections: [
          filaDeConexion("google", { refreshToken: null, connected: false }),
        ],
      }) as any
    );

    await expect(
      processRetryFailedBookingJob({ leadId })
    ).resolves.toBeUndefined();

    expect(mockedBookAppointment).not.toHaveBeenCalled();
    expect(mockedEnqueueRetryBookingJob).not.toHaveBeenCalled();
    const { create, update } = mockUpsert.mock.calls[0][0];
    expect(create).toEqual(
      expect.objectContaining({
        callId: "call_1",
        externalEventId: undefined,
        copiaEnCalendario: "pendiente",
        copiaError: "calendario desconectado",
        copiaIntentos: 0,
        externalCalendarProvider: null,
        externalCalendarId: null,
      })
    );
    expect(update).toEqual(
      expect.objectContaining({
        externalEventId: null,
        copiaEnCalendario: "pendiente",
        copiaIntentos: 0,
      })
    );
    expect(mockLeadUpdate).toHaveBeenCalledWith({
      where: { id: leadId },
      data: { resolvedAt: expect.any(Date) },
    });
    // Con la conexión caducada no se gasta ningún intento de copia: la hace
    // el volcado al reconectar.
    expect(mockedEnqueueCopia).not.toHaveBeenCalled();
    expect(mockedAvisarCitaRecuperada).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: "biz_1", leadId })
    );
  });

  it("un reintento viejo (attempt 8) con el calendario desconectado ya no avisa de reintentos agotados: reserva", async () => {
    mockedLeadFindUnique.mockResolvedValue(buildLead() as any);
    mockedCallFindUnique.mockResolvedValue({ businessId: "biz_1" } as any);
    mockedBusinessFindUnique.mockResolvedValue(
      buildBusiness({
        calendarConnections: [filaDeConexion("google", { refreshToken: null })],
      }) as any
    );

    await processRetryFailedBookingJob({ leadId, attempt: 8 });

    expect(vi.mocked(avisarReintentosAgotados)).not.toHaveBeenCalled();
    expect(mockedEnqueueRetryBookingJob).not.toHaveBeenCalled();
    expect(mockedBookAppointment).not.toHaveBeenCalled();
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ copiaEnCalendario: "pendiente" }),
      })
    );
    expect(mockLeadUpdate).toHaveBeenCalledWith({
      where: { id: leadId },
      data: { resolvedAt: expect.any(Date) },
    });
  });

  it("con Outlook desconectado tampoco reprograma: reserva con la copia pendiente", async () => {
    mockedLeadFindUnique.mockResolvedValue(buildLead() as any);
    mockedCallFindUnique.mockResolvedValue({ businessId: "biz_1" } as any);
    mockedBusinessFindUnique.mockResolvedValue(
      buildBusiness({
        calendarProvider: "outlook",
        calendarConnections: [
          filaDeConexion("outlook", { refreshToken: null }),
        ],
      }) as any
    );

    await processRetryFailedBookingJob({ leadId });

    expect(mockedEnqueueRetryBookingJob).not.toHaveBeenCalled();
    expect(mockedBookAppointment).not.toHaveBeenCalled();
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ copiaEnCalendario: "pendiente" }),
      })
    );
    expect(mockLeadUpdate).toHaveBeenCalled();
  });

  it("sin ningún calendario conectado reserva sin copia (copiaEnCalendario null)", async () => {
    mockedLeadFindUnique.mockResolvedValue(buildLead() as any);
    mockedCallFindUnique.mockResolvedValue({ businessId: "biz_1" } as any);
    mockedBusinessFindUnique.mockResolvedValue(
      buildBusiness({ calendarConnections: [] }) as any
    );

    await processRetryFailedBookingJob({ leadId });

    expect(mockedBookAppointment).not.toHaveBeenCalled();
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          externalEventId: undefined,
          copiaEnCalendario: null,
          copiaError: null,
          externalCalendarProvider: null,
        }),
      })
    );
    expect(mockLeadUpdate).toHaveBeenCalled();
    expect(mockedEnqueueCopia).not.toHaveBeenCalled();
  });

  it("reserva con Google, guarda la reserva y marca el lead como resuelto", async () => {
    mockedLeadFindUnique.mockResolvedValue(buildLead() as any);
    mockedCallFindUnique.mockResolvedValue({ businessId: "biz_1" } as any);
    mockedBusinessFindUnique.mockResolvedValue(buildBusiness() as any);

    await processRetryFailedBookingJob({ leadId });

    expect(mockedBookAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        clientName: "Ana García",
        clientEmail: "ana@example.com",
        clientPhone: "+34600123456",
        serviceNames: ["Corte"],
        professionalName: "Montse",
        conexion: expect.objectContaining({
          provider: "google",
          credentials: {
            provider: "google",
            refreshToken: "google_refresh_token",
          },
        }),
      })
    );
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { callId: "call_1" },
        create: expect.objectContaining({
          callId: "call_1",
          durationMinutes: 30,
          professionalId: "pro_1",
          serviceIds: ["service_1"],
          // Sin el nombre, la cita recuperada salía anónima en el panel.
          clientName: "Ana García",
        }),
        update: expect.objectContaining({ clientName: "Ana García" }),
      })
    );
    // Con el calendario operativo la copia sale en el momento, como antes.
    expect(mockUpsert.mock.calls[0][0].create).toEqual(
      expect.objectContaining({
        externalEventId: "gcal_event_1",
        copiaEnCalendario: "hecha",
        copiaError: null,
        copiaIntentos: 0,
        externalCalendarProvider: "google",
        externalCalendarId: "primary",
      })
    );
    expect(mockUpsert.mock.calls[0][0].update).toEqual(
      expect.objectContaining({
        externalEventId: "gcal_event_1",
        copiaEnCalendario: "hecha",
      })
    );
    expect(mockLeadUpdate).toHaveBeenCalledWith({
      where: { id: leadId },
      data: { resolvedAt: expect.any(Date) },
    });
    expect(mockedEnqueueCopia).not.toHaveBeenCalled();
  });

  it("reserva con Outlook cuando el negocio usa ese proveedor", async () => {
    mockedLeadFindUnique.mockResolvedValue(buildLead() as any);
    mockedCallFindUnique.mockResolvedValue({ businessId: "biz_1" } as any);
    mockedBusinessFindUnique.mockResolvedValue(
      buildBusiness({
        calendarProvider: "outlook",
        calendarConnections: [
          filaDeConexion("outlook", {
            refreshToken: "outlook_refresh_token",
            calendarId: "calendar_1",
          }),
        ],
      }) as any
    );

    await processRetryFailedBookingJob({ leadId });

    expect(mockedBookAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        conexion: expect.objectContaining({
          provider: "outlook",
          credentials: {
            provider: "outlook",
            refreshToken: "outlook_refresh_token",
          },
        }),
      })
    );
  });

  it("con el calendario ilegible ya no lanza: decide la agenda de Alhabla y reserva", async () => {
    mockedLeadFindUnique.mockResolvedValue(buildLead() as any);
    mockedCallFindUnique.mockResolvedValue({ businessId: "biz_1" } as any);
    mockedBusinessFindUnique.mockResolvedValue(buildBusiness() as any);
    // Así contesta getBusyIntervals cuando Google da un error al leer.
    mockedGetBusyIntervals.mockResolvedValue({
      intervals: [],
      calendarAvailabilityKnown: false,
    } as any);

    await expect(
      processRetryFailedBookingJob({ leadId })
    ).resolves.toBeUndefined();

    expect(mockedCheckAvailability).toHaveBeenCalledWith(
      expect.objectContaining({ calendarAvailabilityKnown: false })
    );
    // La copia se intenta igual: leer y escribir son llamadas distintas.
    expect(mockedBookAppointment).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ copiaEnCalendario: "hecha" }),
      })
    );
    expect(mockLeadUpdate).toHaveBeenCalledWith({
      where: { id: leadId },
      data: { resolvedAt: expect.any(Date) },
    });
    expect(mockedReleaseBookingLock).toHaveBeenCalledWith(
      "biz_1",
      "lock-token"
    );
  });

  it("si el calendario no acepta el evento, la cita queda reservada con la copia pendiente, el lead se resuelve y se encola la copia", async () => {
    mockedLeadFindUnique.mockResolvedValue(buildLead() as any);
    mockedCallFindUnique.mockResolvedValue({ businessId: "biz_1" } as any);
    mockedBusinessFindUnique.mockResolvedValue(buildBusiness() as any);
    mockedBookAppointment.mockRejectedValue(
      new Error("Calendario de Google no responde")
    );

    // Antes el error se propagaba y el lead seguía pendiente.
    await expect(
      processRetryFailedBookingJob({ leadId })
    ).resolves.toBeUndefined();

    const { create, update } = mockUpsert.mock.calls[0][0];
    expect(create).toEqual(
      expect.objectContaining({
        externalEventId: undefined,
        copiaEnCalendario: "pendiente",
        copiaError: "Calendario de Google no responde",
        copiaIntentos: 0,
        externalCalendarProvider: null,
      })
    );
    expect(update).toEqual(
      expect.objectContaining({
        externalEventId: null,
        copiaEnCalendario: "pendiente",
      })
    );
    expect(mockLeadUpdate).toHaveBeenCalledWith({
      where: { id: leadId },
      data: { resolvedAt: expect.any(Date) },
    });
    // La copia se encola con el id del Booking ya guardado.
    expect(mockedEnqueueCopia).toHaveBeenCalledTimes(1);
    const [payload, taskId, scheduleTime] = mockedEnqueueCopia.mock.calls[0];
    expect(payload).toEqual({ bookingId: "booking_1", attempt: 1 });
    expect(taskId).toMatch(/^copia-de-la-cita-booking_1-1-\d+$/);
    expect((scheduleTime as Date).getTime()).toBeGreaterThan(Date.now());
    expect(mockedEnqueueCopia.mock.invocationCallOrder[0]).toBeGreaterThan(
      mockedTransaction.mock.invocationCallOrder[0]
    );
    expect(mockedEnqueueRetryBookingJob).not.toHaveBeenCalled();
    expect(mockedAvisarCitaRecuperada).toHaveBeenCalled();
  });

  it("filtra service/professional por businessId al resolver nombres — el Lead puede traer ids sin verificar", async () => {
    mockedLeadFindUnique.mockResolvedValue(buildLead() as any);
    mockedCallFindUnique.mockResolvedValue({ businessId: "biz_1" } as any);
    mockedBusinessFindUnique.mockResolvedValue(buildBusiness() as any);

    await processRetryFailedBookingJob({ leadId });

    expect(mockedServiceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ businessId: "biz_1" }),
      })
    );
    expect(mockedProfessionalFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ businessId: "biz_1" }),
      })
    );
  });

  it("usa Call.fromNumber como teléfono de la reserva guardada cuando el lead no dio uno explícito (regresión post-auditoría)", async () => {
    mockedLeadFindUnique.mockResolvedValue(
      buildLead({ data: { ...pendingBookingData, clientPhone: null } }) as any
    );
    mockedCallFindUnique.mockResolvedValue({
      businessId: "biz_1",
      fromNumber: "+34611222333",
    } as any);
    mockedBusinessFindUnique.mockResolvedValue(buildBusiness() as any);

    await processRetryFailedBookingJob({ leadId });

    // El evento de calendario ya llevaba este fallback antes de este fix —
    // lo que faltaba era propagarlo también a la fila Booking guardada en
    // Postgres, que se quedaba con clientPhone: null en este caso.
    expect(mockedBookAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ clientPhone: "+34611222333" })
    );
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ clientPhone: "+34611222333" }),
        update: expect.objectContaining({ clientPhone: "+34611222333" }),
      })
    );
  });

  it("copia al Booking el consentimiento y el canal del lead (chat del cliente) y programa la confirmación al cliente", async () => {
    mockedLeadFindUnique.mockResolvedValue(
      buildLead({
        data: {
          ...pendingBookingData,
          smsConsent: true,
          createdVia: "client_chat",
        },
      }) as any
    );
    mockedCallFindUnique.mockResolvedValue({ businessId: "biz_1" } as any);
    mockedBusinessFindUnique.mockResolvedValue(buildBusiness() as any);

    await processRetryFailedBookingJob({ leadId });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          smsConsent: true,
          createdVia: "client_chat",
        }),
        update: expect.objectContaining({ smsConsent: true }),
      })
    );
    expect(mockedProgramarMensajes).toHaveBeenCalledWith({
      bookingId: "booking_1",
      etiqueta: `retry-failed-booking ${leadId}`,
    });

    // Lead de antes del arreglo (sin los campos): sin permiso y por voz;
    // sin WhatsApp configurado no se programa nada.
    vi.clearAllMocks();
    mockUpsert.mockResolvedValue({ id: "booking_1" });
    mockedWhatsappConfigurado.mockReturnValue(false);
    mockedLeadFindUnique.mockResolvedValue(buildLead() as any);
    mockedCallFindUnique.mockResolvedValue({ businessId: "biz_1" } as any);
    mockedBusinessFindUnique.mockResolvedValue(buildBusiness() as any);
    mockedAcquireBookingLock.mockResolvedValue("lock-token");

    await processRetryFailedBookingJob({ leadId });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          smsConsent: false,
          createdVia: "voice",
        }),
      })
    );
    expect(mockedProgramarMensajes).not.toHaveBeenCalled();
  });

  it("la reserva recuperada nace con createdVia voice, resetea la cancelación en update y usa buildCalendarIdempotencyKey de lib/calendarIdempotency", async () => {
    mockedLeadFindUnique.mockResolvedValue(buildLead() as any);
    mockedCallFindUnique.mockResolvedValue({ businessId: "biz_1" } as any);
    mockedBusinessFindUnique.mockResolvedValue(buildBusiness() as any);

    await processRetryFailedBookingJob({ leadId });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ createdVia: "voice" }),
        update: expect.objectContaining({
          isCancelled: false,
          cancelledAt: null,
          cancelledBy: null,
        }),
      })
    );
    expect(mockUpsert.mock.calls[0][0].update).not.toHaveProperty("createdVia");
    expect(mockedBookAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: buildCalendarIdempotencyKey({
          callId: "call_1",
          startDateTime: pendingBookingData.startDateTime,
          durationMinutes: 30,
        }),
      })
    );
  });

  // Contrato del cerrojo (plan de corte de Redis, §6.1): sin la agenda del
  // negocio el job falla para que Cloud Tasks lo reintente, sin haber
  // tocado el calendario ni la reserva.
  it("sin el cerrojo de reserva lanza y no toca el calendario, la reserva ni el lead", async () => {
    mockedLeadFindUnique.mockResolvedValue(buildLead() as any);
    mockedCallFindUnique.mockResolvedValue({ businessId: "biz_1" } as any);
    mockedBusinessFindUnique.mockResolvedValue(buildBusiness() as any);
    mockedAcquireBookingLock.mockResolvedValue(null);

    await expect(processRetryFailedBookingJob({ leadId })).rejects.toThrow(
      "No se pudo adquirir el lock de reserva de biz_1"
    );

    expect(mockedAcquireBookingLock).toHaveBeenCalledWith("biz_1");
    expect(mockedGetBusyIntervals).not.toHaveBeenCalled();
    expect(mockedCheckAvailability).not.toHaveBeenCalled();
    expect(mockedBookAppointment).not.toHaveBeenCalled();
    expect(mockedTransaction).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockedLeadUpdate).not.toHaveBeenCalled();
    expect(mockedReleaseBookingLock).not.toHaveBeenCalled();
    // Lanzar es lo que hace que Cloud Tasks lo reintente: no se reprograma
    // a mano encima.
    expect(mockedEnqueueRetryBookingJob).not.toHaveBeenCalled();
  });

  it("comprueba si ya existe una reserva DESPUÉS de adquirir el lock, no antes (regresión post-auditoría)", async () => {
    mockedLeadFindUnique.mockResolvedValue(buildLead() as any);
    mockedCallFindUnique.mockResolvedValue({ businessId: "biz_1" } as any);
    mockedBusinessFindUnique.mockResolvedValue(buildBusiness() as any);

    await processRetryFailedBookingJob({ leadId });

    // Si la comprobación de idempotencia corriera ANTES del lock, dos
    // entregas concurrentes de Cloud Tasks para el mismo lead podrían
    // ambas verla vacía, serializarse en el lock, y la segunda —que ya no
    // vuelve a comprobar tras conseguirlo— duplicaría la reserva.
    const lockOrder = mockedAcquireBookingLock.mock.invocationCallOrder[0];
    const idempotencyCheckOrder =
      mockedBookingFindUnique.mock.invocationCallOrder[0];
    expect(lockOrder).toBeLessThan(idempotencyCheckOrder);
  });

  it("marca el calendario como desconectado y reserva con la copia pendiente si bookAppointment falla por reconexión requerida", async () => {
    mockedLeadFindUnique.mockResolvedValue(buildLead() as any);
    mockedCallFindUnique.mockResolvedValue({ businessId: "biz_1" } as any);
    mockedBusinessFindUnique.mockResolvedValue(buildBusiness() as any);
    mockedBookAppointment.mockRejectedValue(
      Object.assign(
        new Error("La conexión con Google ha sido revocada o expiró."),
        {
          name: "CalendarBusinessError",
          code: "GOOGLE_CALENDAR_RECONNECT_REQUIRED",
        }
      )
    );

    // La conexión rechazada se marca desconectada (intentarCopiaDeLaCita) y
    // la cita entra igual en la agenda de Alhabla.
    await expect(
      processRetryFailedBookingJob({ leadId })
    ).resolves.toBeUndefined();

    // Modo "revocar": la fila de calendar_connections queda sin
    // credenciales y desconectada.
    expect(
      vi.mocked(prisma.calendarConnection.updateMany)
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { businessId: "biz_1", provider: "google" },
        data: expect.objectContaining({
          connected: false,
          lastError: "invalid_grant",
        }),
      })
    );
    expect(almacenEnMemoria.borrarClave).toHaveBeenCalledWith(
      "voice_config:biz_1"
    );
    // Antes la cita esperaba con reintentos cada 6 h: ahora queda reservada
    // y la copia la hace el volcado al reconectar (no se encola).
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          externalEventId: undefined,
          copiaEnCalendario: "pendiente",
          copiaError: "calendario desconectado",
        }),
      })
    );
    expect(mockLeadUpdate).toHaveBeenCalledWith({
      where: { id: leadId },
      data: { resolvedAt: expect.any(Date) },
    });
    expect(mockedEnqueueRetryBookingJob).not.toHaveBeenCalled();
    expect(mockedEnqueueCopia).not.toHaveBeenCalled();
    expect(vi.mocked(avisarReservaPerdida)).not.toHaveBeenCalled();
  });

  describe("cuando la cita ya no se puede hacer", () => {
    beforeEach(() => {
      mockedLeadFindUnique.mockResolvedValue(buildLead() as any);
      mockedCallFindUnique.mockResolvedValue({ businessId: "biz_1" } as any);
      mockedBusinessFindUnique.mockResolvedValue(
        buildBusiness({
          name: "Peluquería Ana",
          timezone: "Europe/Madrid",
        }) as any
      );
    });

    it("hueco ocupado: cierra el lead y avisa al dueño con el teléfono del cliente", async () => {
      mockedCheckAvailability.mockResolvedValue({
        available: false,
        code: "NO_CAPACITY",
        message: "",
      } as any);

      await processRetryFailedBookingJob({ leadId });

      expect(mockedBookAppointment).not.toHaveBeenCalled();
      expect(mockedLeadUpdate).toHaveBeenCalledWith({
        where: { id: leadId },
        data: { resolvedAt: expect.any(Date) },
      });
      expect(vi.mocked(avisarReservaPerdida)).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: "biz_1",
          businessName: "Peluquería Ana",
          leadId,
          clientName: "Ana García",
          clientPhone: "+34600123456",
          motivo: "ese hueco se ha ocupado mientras tanto",
        })
      );
    });

    it("fuera de horario o con la hora ya pasada: lo dice con palabras", async () => {
      mockedCheckBusinessHours.mockReturnValueOnce({
        success: true,
        isOpen: false,
      } as any);
      await processRetryFailedBookingJob({ leadId });
      expect(vi.mocked(avisarReservaPerdida)).toHaveBeenLastCalledWith(
        expect.objectContaining({
          motivo: "esa hora ya queda fuera de tu horario",
        })
      );

      mockedCheckBookingRestrictions.mockReturnValueOnce({
        success: false,
        code: "APPOINTMENT_IN_PAST",
      } as any);
      await processRetryFailedBookingJob({ leadId });
      expect(vi.mocked(avisarReservaPerdida)).toHaveBeenLastCalledWith(
        expect.objectContaining({ motivo: "la hora ya ha pasado" })
      );
    });

    it("el respaldo por email va al correo del dueño", async () => {
      mockedCheckAvailability.mockResolvedValue({
        available: false,
        code: "NO_CAPACITY",
        message: "",
      } as any);
      await processRetryFailedBookingJob({ leadId });
      const { email } = vi.mocked(avisarReservaPerdida).mock.calls[0][0];

      mockedBusinessFindUnique.mockResolvedValue({
        users: [{ email: "dueno@peluqueria.es" }],
      } as any);
      await email!();

      expect(vi.mocked(enqueueEmailJob)).toHaveBeenCalledWith(
        expect.objectContaining({
          toAddress: "dueno@peluqueria.es",
          subject: expect.stringContaining(
            "no ha podido entrar en tu calendario"
          ),
        }),
        `reserva-perdida-${leadId}`
      );
    });

    it("si ya había una reserva para esa llamada no es una pérdida: no avisa", async () => {
      mockedBookingFindUnique.mockResolvedValue({
        externalEventId: "evt_1",
        programedAt: new Date(pendingBookingData.startDateTime),
        durationMinutes: 30,
      } as any);

      await processRetryFailedBookingJob({ leadId });

      expect(vi.mocked(avisarReservaPerdida)).not.toHaveBeenCalled();
    });
  });

  // Auditoría del 16-10: con número oculto el evento decía «Teléfono:
  // anonymous», y el teléfono dictado se guardaba tal cual.
  it("con número oculto la reserva recuperada queda sin teléfono, no con «anonymous»", async () => {
    mockedLeadFindUnique.mockResolvedValue(
      buildLead({ data: { ...pendingBookingData, clientPhone: null } }) as any
    );
    mockedCallFindUnique.mockResolvedValue({
      businessId: "biz_1",
      fromNumber: "anonymous",
    } as any);
    mockedBusinessFindUnique.mockResolvedValue(buildBusiness() as any);

    await processRetryFailedBookingJob({ leadId });

    expect(mockedBookAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ clientPhone: undefined })
    );
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ clientPhone: undefined }),
      })
    );
  });

  it("normaliza el teléfono de un lead guardado antes de normalizarlos", async () => {
    mockedLeadFindUnique.mockResolvedValue(
      buildLead({
        data: { ...pendingBookingData, clientPhone: "612 34 56 78" },
      }) as any
    );
    mockedCallFindUnique.mockResolvedValue({
      businessId: "biz_1",
      fromNumber: "+34611222333",
    } as any);
    mockedBusinessFindUnique.mockResolvedValue(buildBusiness() as any);

    await processRetryFailedBookingJob({ leadId });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ clientPhone: "+34612345678" }),
      })
    );
  });

  describe("cambio de cita (replacesBookingId)", () => {
    beforeEach(() => {
      mockedLeadFindUnique.mockResolvedValue(
        buildLead({
          data: { ...pendingBookingData, replacesBookingId: "booking_vieja" },
        }) as any
      );
      mockedCallFindUnique.mockResolvedValue({
        businessId: "biz_1",
        fromNumber: "+34611222333",
        voiceProvider: "telnyx",
      } as any);
      mockedBusinessFindUnique.mockResolvedValue(buildBusiness() as any);
      mockedBookingFindFirst.mockResolvedValue({
        id: "booking_vieja",
        externalEventId: "evt_viejo",
      } as any);
      mockUpsert.mockResolvedValue({ id: "booking_nueva" });
    });

    it("no cuenta la vieja como ocupada y la anula cuando la nueva entra", async () => {
      await processRetryFailedBookingJob({ leadId });

      expect(mockedBookingFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: "booking_vieja",
            call: { businessId: "biz_1" },
            isCancelled: false,
          },
        })
      );
      expect(mockedCheckAvailability).toHaveBeenCalledWith(
        expect.objectContaining({
          excluir: { bookingId: "booking_vieja", externalEventId: "evt_viejo" },
        })
      );
      expect(mockedAnularLaCitaCambiada).toHaveBeenCalledWith({
        businessId: "biz_1",
        citaAnteriorId: "booking_vieja",
        nuevaReservaId: "booking_nueva",
        cancelledBy: "client_voice",
        etiqueta: `lead ${leadId}`,
      });
    });

    it("desde un chat de WhatsApp la anula con client_chat", async () => {
      mockedCallFindUnique.mockResolvedValue({
        businessId: "biz_1",
        fromNumber: "+34611222333",
        voiceProvider: "whatsapp",
      } as any);

      await processRetryFailedBookingJob({ leadId });

      expect(mockedAnularLaCitaCambiada).toHaveBeenCalledWith(
        expect.objectContaining({ cancelledBy: "client_chat" })
      );
    });

    it("si el hueco ya no está libre, la vieja sigue en pie", async () => {
      mockedCheckAvailability.mockResolvedValue({
        available: false,
        code: "NO_CAPACITY",
        message: "",
      } as any);

      await processRetryFailedBookingJob({ leadId });

      expect(mockedBookAppointment).not.toHaveBeenCalled();
      expect(mockedAnularLaCitaCambiada).not.toHaveBeenCalled();
    });

    it("si la vieja ya no está activa, reserva la nueva sin anular nada", async () => {
      mockedBookingFindFirst.mockResolvedValue(null);

      await processRetryFailedBookingJob({ leadId });

      expect(mockedBookAppointment).toHaveBeenCalled();
      expect(mockedCheckAvailability).toHaveBeenCalledWith(
        expect.not.objectContaining({ excluir: expect.anything() })
      );
      expect(mockedAnularLaCitaCambiada).not.toHaveBeenCalled();
    });
  });
});
