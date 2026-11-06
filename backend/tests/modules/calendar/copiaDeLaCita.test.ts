import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "../../../src/lib/prisma.js";
import { calendarService } from "../../../src/modules/calendar/service.js";
import {
  marcarCalendarioDesconectado,
  resolverConexionDeCalendario,
} from "../../../src/modules/calendar/conexion.js";
import { CalendarBusinessError } from "../../../src/adapters/calendar/errors.js";
import {
  enqueueCopiaDeLaCitaJob,
  enqueueVolcadoDeLaAgendaJob,
} from "../../../src/lib/cloudTasks.js";
import {
  ESPERAS_ENTRE_COPIAS_MINUTOS,
  camposDeLaCopia,
  encolarCopiaDeLaCita,
  intentarCopiaDeLaCita,
  sincronizarCopiaDeLaCita,
  volcarAgendaAlCalendario,
} from "../../../src/modules/calendar/copiaDeLaCita.js";
import {
  filaDeConexion,
  negocioConConexiones,
} from "../../helpers/conexionDeCalendario.js";

// PLAN-AGENDA-PRINCIPAL.md, reglas 3 y 5: la copia de una cita en el
// calendario conectado nunca impide reservar, y lo que no entra se reintenta.

vi.mock("../../../src/lib/prisma.js", () => ({
  prisma: {
    booking: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    business: { findUnique: vi.fn() },
    service: { findMany: vi.fn() },
  },
}));

vi.mock("../../../src/modules/calendar/service.js", () => ({
  calendarService: {
    bookAppointment: vi.fn(),
    cancelAppointment: vi.fn(),
  },
}));

vi.mock("../../../src/modules/calendar/conexion.js", async (importOriginal) => {
  const real =
    await importOriginal<
      typeof import("../../../src/modules/calendar/conexion.js")
    >();
  return { ...real, marcarCalendarioDesconectado: vi.fn() };
});

vi.mock("../../../src/lib/cloudTasks.js", () => ({
  enqueueCopiaDeLaCitaJob: vi.fn(),
  enqueueVolcadoDeLaAgendaJob: vi.fn(),
}));

vi.mock("../../../src/modules/whatsapp/alertas.js", () => ({
  alertarCopiasPendientes: vi.fn().mockResolvedValue({ via: "interactivo" }),
}));

const mockedBookAppointment = vi.mocked(calendarService.bookAppointment);
const mockedCancelAppointment = vi.mocked(calendarService.cancelAppointment);
const mockedMarcar = vi.mocked(marcarCalendarioDesconectado);
const mockedBookingFindUnique = vi.mocked(prisma.booking.findUnique);
const mockedBookingUpdate = vi.mocked(prisma.booking.update);
const mockedBookingFindMany = vi.mocked(prisma.booking.findMany);
const mockedBookingUpdateMany = vi.mocked(prisma.booking.updateMany);
const mockedBusinessFindUnique = vi.mocked(prisma.business.findUnique);
const mockedServiceFindMany = vi.mocked(prisma.service.findMany);
const mockedEnqueueCopia = vi.mocked(enqueueCopiaDeLaCitaJob);

const conGoogle = negocioConConexiones("google", [filaDeConexion("google")]);
const conGoogleCaducado = negocioConConexiones("google", [
  filaDeConexion("google", {
    refreshToken: null,
    connected: false,
    disconnectedAt: new Date("2026-11-01T10:00:00Z"),
  }),
]);
const sinCalendario = negocioConConexiones("google", []);

const evento = {
  clientName: "Lucía",
  startDateTime: "2026-12-10T10:00:00Z",
  durationMinutes: 45,
};
const log = { prefijo: "[Test]", etiqueta: "prueba" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  mockedBookingUpdate.mockResolvedValue({} as never);
  mockedServiceFindMany.mockResolvedValue([] as never);
});

describe("intentarCopiaDeLaCita", () => {
  it("sin calendario conectado no llama a nadie y no hay copia", async () => {
    const copia = await intentarCopiaDeLaCita({
      conexion: resolverConexionDeCalendario(sinCalendario),
      businessId: "biz_1",
      log,
      evento,
    });

    expect(copia.copiaEnCalendario).toBeNull();
    expect(copia.reintentar).toBe(false);
    expect(mockedBookAppointment).not.toHaveBeenCalled();
  });

  it("con el calendario caducado deja la copia pendiente sin gastar un intento", async () => {
    const copia = await intentarCopiaDeLaCita({
      conexion: resolverConexionDeCalendario(conGoogleCaducado),
      businessId: "biz_1",
      log,
      evento,
    });

    expect(copia.copiaEnCalendario).toBe("pendiente");
    expect(copia.reintentar).toBe(false);
    expect(copia.externalEventId).toBeNull();
    expect(mockedBookAppointment).not.toHaveBeenCalled();
  });

  it("con el calendario operativo crea el evento: copia hecha con su origen", async () => {
    mockedBookAppointment.mockResolvedValue({
      id: "evento_1",
      htmlLink: "https://cal/1",
    });

    const copia = await intentarCopiaDeLaCita({
      conexion: resolverConexionDeCalendario(conGoogle),
      businessId: "biz_1",
      log,
      evento,
    });

    expect(copia).toEqual({
      externalEventId: "evento_1",
      htmlLink: "https://cal/1",
      copiaEnCalendario: "hecha",
      externalCalendarProvider: "google",
      externalCalendarId: "primary",
      reintentar: false,
      copiaError: null,
    });
    expect(camposDeLaCopia(copia)).toEqual({
      copiaEnCalendario: "hecha",
      copiaError: null,
      copiaIntentos: 0,
      externalCalendarProvider: "google",
      externalCalendarId: "primary",
    });
  });

  it("si el calendario no acepta el evento, nunca lanza: pendiente y a reintentar", async () => {
    mockedBookAppointment.mockRejectedValue(new Error("Google 503"));

    const copia = await intentarCopiaDeLaCita({
      conexion: resolverConexionDeCalendario(conGoogle),
      businessId: "biz_1",
      log,
      evento,
    });

    expect(copia.copiaEnCalendario).toBe("pendiente");
    expect(copia.reintentar).toBe(true);
    expect(copia.copiaError).toContain("Google 503");
    expect(console.error).toHaveBeenCalled();
  });

  it("con la conexión rechazada la marca desconectada y espera a la reconexión", async () => {
    mockedBookAppointment.mockRejectedValue(
      new CalendarBusinessError(
        "GOOGLE_CALENDAR_RECONNECT_REQUIRED",
        "invalid_grant",
        "google"
      )
    );

    const copia = await intentarCopiaDeLaCita({
      conexion: resolverConexionDeCalendario(conGoogle),
      businessId: "biz_1",
      log,
      evento,
    });

    expect(copia.copiaEnCalendario).toBe("pendiente");
    expect(copia.reintentar).toBe(false);
    expect(mockedMarcar).toHaveBeenCalledWith(
      "biz_1",
      "google",
      { modo: "revocar" },
      { prefijo: "[Test]" }
    );
  });
});

describe("encolarCopiaDeLaCita", () => {
  it("programa el intento con la espera que le toca y nunca lanza", async () => {
    const ahora = Date.now();
    await encolarCopiaDeLaCita("cita_1", 3);
    const [payload, , cuando] = mockedEnqueueCopia.mock.calls[0];
    expect(payload).toEqual({ bookingId: "cita_1", attempt: 3 });
    expect((cuando as Date).getTime()).toBeGreaterThanOrEqual(
      ahora + ESPERAS_ENTRE_COPIAS_MINUTOS[2] * 60_000
    );

    mockedEnqueueCopia.mockRejectedValueOnce(new Error("Cloud Tasks caído"));
    await expect(encolarCopiaDeLaCita("cita_1", 4)).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});

function citaPendiente(extra: Record<string, unknown> = {}) {
  return {
    id: "cita_1",
    programedAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    durationMinutes: 45,
    clientName: "Lucía",
    clientPhone: null,
    serviceIds: [],
    isCancelled: false,
    externalEventId: null,
    externalCalendarProvider: null,
    externalCalendarId: null,
    copiaEnCalendario: "pendiente",
    copiaIntentos: 0,
    professional: { name: "Laura" },
    call: { businessId: "biz_1", fromNumber: "+34600111222" },
    ...extra,
  };
}

describe("sincronizarCopiaDeLaCita (job)", () => {
  it("copia una cita pendiente y la deja hecha", async () => {
    mockedBookingFindUnique.mockResolvedValue(citaPendiente() as never);
    mockedBusinessFindUnique.mockResolvedValue(conGoogle as never);
    mockedBookAppointment.mockResolvedValue({ id: "evento_9", htmlLink: null });

    const r = await sincronizarCopiaDeLaCita({ bookingId: "cita_1" });

    expect(r).toBe("hecha");
    expect(mockedBookAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        clientName: "Lucía",
        clientPhone: "+34600111222",
        professionalName: "Laura",
        idempotencyKey: expect.stringContaining("copia:cita_1:"),
      })
    );
    expect(mockedBookingUpdate).toHaveBeenCalledWith({
      where: { id: "cita_1" },
      data: {
        externalEventId: "evento_9",
        externalCalendarProvider: "google",
        externalCalendarId: "primary",
        copiaEnCalendario: "hecha",
        copiaError: null,
      },
    });
  });

  it("una cita movida con su evento viejo: lo borra antes de crear el nuevo", async () => {
    mockedBookingFindUnique.mockResolvedValue(
      citaPendiente({
        externalEventId: "evento_viejo",
        externalCalendarProvider: "google",
        externalCalendarId: "primary",
      }) as never
    );
    mockedBusinessFindUnique.mockResolvedValue(conGoogle as never);
    mockedCancelAppointment.mockResolvedValue({ resultado: "borrado" } as never);
    mockedBookAppointment.mockResolvedValue({ id: "evento_nuevo", htmlLink: null });

    const r = await sincronizarCopiaDeLaCita({ bookingId: "cita_1" });

    expect(r).toBe("hecha");
    expect(mockedCancelAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: "evento_viejo" })
    );
    expect(mockedCancelAppointment.mock.invocationCallOrder[0]).toBeLessThan(
      mockedBookAppointment.mock.invocationCallOrder[0]
    );
  });

  it("con el calendario caducado no gasta intento ni programa otro", async () => {
    mockedBookingFindUnique.mockResolvedValue(citaPendiente() as never);
    mockedBusinessFindUnique.mockResolvedValue(conGoogleCaducado as never);

    const r = await sincronizarCopiaDeLaCita({ bookingId: "cita_1", attempt: 2 });

    expect(r).toBe("esperando_reconexion");
    expect(mockedBookAppointment).not.toHaveBeenCalled();
    expect(mockedBookingUpdate).not.toHaveBeenCalled();
    expect(mockedEnqueueCopia).not.toHaveBeenCalled();
  });

  it("si falla, cuenta el intento y programa el siguiente; al cuarto avisa al dueño", async () => {
    mockedBookingFindUnique.mockResolvedValue(citaPendiente() as never);
    mockedBusinessFindUnique.mockResolvedValue(conGoogle as never);
    mockedBookAppointment.mockRejectedValue(new Error("timeout"));
    const { alertarCopiasPendientes } = await import(
      "../../../src/modules/whatsapp/alertas.js"
    );

    expect(await sincronizarCopiaDeLaCita({ bookingId: "cita_1", attempt: 1 })).toBe(
      "reintentando"
    );
    expect(mockedBookingUpdate).toHaveBeenCalledWith({
      where: { id: "cita_1" },
      data: { copiaIntentos: { increment: 1 }, copiaError: "timeout" },
    });
    expect(mockedEnqueueCopia).toHaveBeenCalledWith(
      { bookingId: "cita_1", attempt: 2 },
      expect.any(String),
      expect.any(Date)
    );
    expect(alertarCopiasPendientes).not.toHaveBeenCalled();

    await sincronizarCopiaDeLaCita({ bookingId: "cita_1", attempt: 4 });
    expect(alertarCopiasPendientes).toHaveBeenCalledWith({
      businessId: "biz_1",
      proveedor: "Google Calendar",
    });
  });

  it("agotados los intentos la deja fallida, con log ruidoso, sin programar más", async () => {
    mockedBookingFindUnique.mockResolvedValue(citaPendiente() as never);
    mockedBusinessFindUnique.mockResolvedValue(conGoogle as never);
    mockedBookAppointment.mockRejectedValue(new Error("Google 500"));

    const r = await sincronizarCopiaDeLaCita({
      bookingId: "cita_1",
      attempt: ESPERAS_ENTRE_COPIAS_MINUTOS.length,
    });

    expect(r).toBe("fallida");
    expect(mockedBookingUpdate).toHaveBeenCalledWith({
      where: { id: "cita_1" },
      data: {
        copiaIntentos: { increment: 1 },
        copiaError: "Google 500",
        copiaEnCalendario: "fallida",
      },
    });
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("COPIA FALLIDA")
    );
    expect(mockedEnqueueCopia).not.toHaveBeenCalled();
  });

  it("una cita cancelada o ya copiada no se toca", async () => {
    mockedBookingFindUnique.mockResolvedValue(
      citaPendiente({ copiaEnCalendario: "hecha" }) as never
    );
    expect(await sincronizarCopiaDeLaCita({ bookingId: "cita_1" })).toBe(
      "ya_estaba"
    );

    mockedBookingFindUnique.mockResolvedValue(
      citaPendiente({ isCancelled: true }) as never
    );
    expect(await sincronizarCopiaDeLaCita({ bookingId: "cita_1" })).toBe(
      "descartada"
    );
    expect(mockedBookAppointment).not.toHaveBeenCalled();
  });

  it("una cita que ya pasó sin copiarse se deja fallida", async () => {
    mockedBookingFindUnique.mockResolvedValue(
      citaPendiente({ programedAt: new Date(Date.now() - 3 * 60 * 60 * 1000) }) as never
    );

    expect(await sincronizarCopiaDeLaCita({ bookingId: "cita_1" })).toBe(
      "fallida"
    );
    expect(mockedBookAppointment).not.toHaveBeenCalled();
  });

  it("si el negocio quitó el calendario, la cita deja de esperar copia", async () => {
    mockedBookingFindUnique.mockResolvedValue(citaPendiente() as never);
    mockedBusinessFindUnique.mockResolvedValue(sinCalendario as never);

    expect(await sincronizarCopiaDeLaCita({ bookingId: "cita_1" })).toBe(
      "sin_calendario"
    );
    expect(mockedBookingUpdate).toHaveBeenCalledWith({
      where: { id: "cita_1" },
      data: { copiaEnCalendario: null, copiaError: null },
    });
  });
});

describe("volcarAgendaAlCalendario (job)", () => {
  it("copia las citas futuras que el calendario aún no tiene", async () => {
    mockedBusinessFindUnique.mockResolvedValue(conGoogle as never);
    mockedBookingFindMany.mockResolvedValue([{ id: "cita_1" }, { id: "cita_2" }] as never);
    mockedBookingUpdateMany.mockResolvedValue({ count: 2 } as never);
    mockedBookingFindUnique.mockImplementation((async (args: {
      where: { id: string };
    }) => citaPendiente({ id: args.where.id })) as never);
    mockedBookAppointment.mockResolvedValue({ id: "evento", htmlLink: null });

    const r = await volcarAgendaAlCalendario({ businessId: "biz_1" });

    expect(r).toEqual({ copiadas: 2, pendientes: 0, quedan: false });
    expect(mockedBookingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          call: { businessId: "biz_1" },
          isCancelled: false,
        }),
      })
    );
    expect(mockedBookingUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ["cita_1", "cita_2"] } },
      data: { copiaEnCalendario: "pendiente", copiaIntentos: 0 },
    });
    expect(enqueueVolcadoDeLaAgendaJob).not.toHaveBeenCalled();
  });

  it("sin conexión operativa no hace nada", async () => {
    mockedBusinessFindUnique.mockResolvedValue(conGoogleCaducado as never);

    const r = await volcarAgendaAlCalendario({ businessId: "biz_1" });

    expect(r).toEqual({ copiadas: 0, pendientes: 0, quedan: false });
    expect(mockedBookingFindMany).not.toHaveBeenCalled();
  });
});
