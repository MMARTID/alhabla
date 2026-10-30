// F1 de PLAN-PROMPT-DINAMICO.md: las respuestas de las tools de voz llevan
// las instrucciones del paso siguiente (siguiente_paso, como_decirlo,
// si_no_le_vale, di_al_cliente, pautas, abierto_ahora y la regla de
// precios completa). Durante esta fase la regla sigue también en el
// prompt: aquí se comprueba solo lo que añaden las respuestas.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { filaDeConexion } from "../../helpers/conexionDeCalendario.js";
import {
  executeVoiceTool,
  MAX_CARACTERES_POR_INSTRUCCION,
} from "../../../src/modules/voiceTools/service.js";
import { prisma } from "../../../src/lib/prisma.js";
import { reiniciarAlmacenEnMemoria } from "../../helpers/almacenEnMemoria.js";
import { checkBusinessHours } from "../../../src/lib/businessSchedule.js";
import { checkAvailability } from "../../../src/lib/availability.js";
import { calendarService } from "../../../src/modules/calendar/service.js";
import { programarMensajesAlCliente } from "../../../src/modules/whatsapp/mensajesCliente.js";
import { listaDeEsperaDisponible } from "../../../src/modules/whatsapp/service.js";
import { adquirirCerrojoDeReserva } from "../../../src/lib/bookingLock.js";
import { cancelarReserva } from "../../../src/modules/bookings/cancelacion.js";
import { invalidarCacheDeVoz } from "../../../src/lib/voiceConfigCache.js";

vi.mock("../../../src/lib/prisma.js", () => ({
  prisma: {
    business: { findUnique: vi.fn() },
    call: { findUnique: vi.fn(), findFirst: vi.fn() },
    booking: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    professional: { findFirst: vi.fn(), findMany: vi.fn() },
    professionalAbsence: { findMany: vi.fn().mockResolvedValue([]) },
    service: { findFirst: vi.fn(), findMany: vi.fn() },
    lead: { create: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  },
}));

vi.mock(
  "../../../src/lib/almacenTemporal.js",
  async () =>
    (await import("../../helpers/almacenEnMemoria.js")).almacenEnMemoria
);

vi.mock("../../../src/lib/bookingLock.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/bookingLock.js")>()),
  adquirirCerrojoDeReserva: vi.fn(async () => ({
    estado: "adquirido" as const,
    token: "token",
  })),
  releaseBookingLock: vi.fn(async () => undefined),
}));

// checkBusinessHours es la real salvo que el test diga otra cosa: abierto_ahora
// se comprueba con un horario de verdad y la hora fijada.
vi.mock("../../../src/lib/businessSchedule.js", async (importOriginal) => {
  const real =
    await importOriginal<
      typeof import("../../../src/lib/businessSchedule.js")
    >();
  return {
    ...real,
    checkBusinessHours: vi.fn(real.checkBusinessHours),
    checkBookingRestrictions: vi.fn(() => ({ success: true })),
  };
});

vi.mock("../../../src/lib/availability.js", async (importActual) => ({
  checkAvailability: vi.fn(),
  computeAvailabilityLookaheadMs: vi.fn(
    (durationMinutes: number) => 4 * 60 * 60_000 + durationMinutes * 60_000
  ),
  inicioDeBusquedaHaciaAtras: (
    await importActual<typeof import("../../../src/lib/availability.js")>()
  ).inicioDeBusquedaHaciaAtras,
}));

vi.mock("../../../src/modules/calendar/service.js", () => ({
  calendarService: {
    bookAppointment: vi.fn(),
    getBusyIntervals: vi.fn(),
    cancelAppointment: vi.fn(),
  },
}));

vi.mock("../../../src/lib/intentoDeReserva.js", () => ({
  guardarIntentoDeReservaFallido: vi.fn(),
}));

vi.mock("../../../src/lib/cloudTasks.js", () => ({
  enqueueRetryBookingJob: vi.fn(),
  enqueueSmsJob: vi.fn(),
  enqueueWhatsappJob: vi.fn(),
  enqueueEmailJob: vi.fn(),
}));

vi.mock("../../../src/modules/whatsapp/avisosNegocio.js", () => ({
  avisarNuevaReserva: vi.fn().mockResolvedValue({ via: "interactivo" }),
  avisarCitaPendiente: vi.fn().mockResolvedValue({ via: "interactivo" }),
  avisarCancelacion: vi.fn().mockResolvedValue({ via: "interactivo" }),
  nombreDeServicios: vi.fn().mockResolvedValue([]),
}));

vi.mock(
  "../../../src/modules/whatsapp/mensajesCliente.js",
  async (importActual) => ({
    ...(await importActual<
      typeof import("../../../src/modules/whatsapp/mensajesCliente.js")
    >()),
    programarMensajesAlCliente: vi
      .fn()
      .mockResolvedValue({ confirmacion: "programada" }),
  })
);

vi.mock("../../../src/modules/whatsapp/service.js", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../../../src/modules/whatsapp/service.js")
  >()),
  listaDeEsperaDisponible: vi.fn().mockResolvedValue(false),
}));

vi.mock("../../../src/lib/grabacion.js", () => ({
  guardarPreferenciaDeGrabacion: vi.fn(),
  tocaPreguntarPorGrabar: vi.fn().mockResolvedValue(false),
}));

vi.mock("../../../src/modules/bookings/cancelacion.js", () => ({
  cancelarReserva: vi.fn().mockResolvedValue({ resultado: "cancelada" }),
}));

const mockedBusinessFindUnique = vi.mocked(prisma.business.findUnique);
const mockedCallFindUnique = vi.mocked(prisma.call.findUnique);
const mockedBookingFindUnique = vi.mocked(prisma.booking.findUnique);
const mockedBookingFindFirst = vi.mocked(prisma.booking.findFirst);
const mockedBookingUpsert = vi.mocked(prisma.booking.upsert);
const mockedServiceFindMany = vi.mocked(prisma.service.findMany);
const mockedProfessionalFindFirst = vi.mocked(prisma.professional.findFirst);
const mockedProfessionalFindMany = vi.mocked(prisma.professional.findMany);
const mockedCheckBusinessHours = vi.mocked(checkBusinessHours);
const mockedCheckAvailability = vi.mocked(checkAvailability);
const mockedBookAppointment = vi.mocked(calendarService.bookAppointment);
const mockedGetBusyIntervals = vi.mocked(calendarService.getBusyIntervals);
const mockedProgramarMensajes = vi.mocked(programarMensajesAlCliente);
const mockedListaDeEspera = vi.mocked(listaDeEsperaDisponible);
const mockedAdquirirCerrojo = vi.mocked(adquirirCerrojoDeReserva);
const mockedCancelarReserva = vi.mocked(cancelarReserva);
const mockedLeadCreate = vi.mocked(prisma.lead.create);

const HORA_PEDIDA = "2026-11-20T17:30:00+01:00";
// Un id con la forma de los de Prisma (cuid), para medir los textos que lo
// llevan escrito.
const ID_DE_CITA = "cmh3x9k2a0001qz8l7v5w4t3s";

/** Un horario de lunes a viernes de 09:00 a 18:00, en la forma real. */
const HORARIO = {
  version: 1,
  week: {
    monday: { enabled: true, intervals: [{ start: "09:00", end: "18:00" }] },
    tuesday: { enabled: true, intervals: [{ start: "09:00", end: "18:00" }] },
    wednesday: { enabled: true, intervals: [{ start: "09:00", end: "18:00" }] },
    thursday: { enabled: true, intervals: [{ start: "09:00", end: "18:00" }] },
    friday: { enabled: true, intervals: [{ start: "09:00", end: "18:00" }] },
    saturday: { enabled: false, intervals: [] },
    sunday: { enabled: false, intervals: [] },
  },
  exceptions: [],
};

function buildBusiness(overrides: Record<string, unknown> = {}) {
  return {
    id: "business_123",
    name: "Peluquería Lola",
    schedule: HORARIO,
    timezone: "Europe/Madrid",
    bookingCapacity: 1,
    calendarProvider: "google",
    calendarConnections: [
      filaDeConexion("google", { refreshToken: "refresh_token" }),
    ],
    phone: "+34600111222",
    telnyxPhoneNumber: "+34911222333",
    plan: "pro",
    stripePriceId: null,
    minAdvanceBookingMinutes: null,
    maxAppointmentDurationMinutes: null,
    ...overrides,
  };
}

/** Todos los campos nuevos de instrucciones caben en el tope. */
function expectCamposCortos(result: Record<string, unknown> | undefined) {
  for (const campo of [
    "siguiente_paso",
    "como_decirlo",
    "si_no_le_vale",
    "di_al_cliente",
    "pautas",
  ]) {
    const valor = result?.[campo];
    if (valor === undefined) continue;
    expect(typeof valor).toBe("string");
    expect((valor as string).length).toBeLessThanOrEqual(
      MAX_CARACTERES_POR_INSTRUCCION
    );
  }
}

function llamadaDe(fromNumber = "+34600999888") {
  return {
    id: "call_row_1",
    fromNumber,
    businessId: "business_123",
    startedAt: new Date(),
  };
}

function comprobar(params: Record<string, unknown> = {}, callId = "call_1") {
  return executeVoiceTool({
    businessId: "business_123",
    toolName: "check_availability",
    callId,
    params: { startDateTime: HORA_PEDIDA, durationMinutes: 30, ...params },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  reiniciarAlmacenEnMemoria();
  mockedBusinessFindUnique.mockResolvedValue(buildBusiness() as any);
  mockedCallFindUnique.mockResolvedValue(llamadaDe() as any);
  mockedBookingFindUnique.mockResolvedValue(null);
  mockedBookingFindFirst.mockResolvedValue(null);
  mockedServiceFindMany.mockResolvedValue([]);
  mockedProfessionalFindFirst.mockResolvedValue({
    id: "prof_ana",
    name: "Ana",
  } as any);
  mockedProfessionalFindMany.mockResolvedValue([]);
  mockedGetBusyIntervals.mockResolvedValue({
    intervals: [],
    calendarAvailabilityKnown: true,
  } as any);
  mockedCheckAvailability.mockResolvedValue({
    available: true,
    message: "",
    capacityUsed: 0,
    capacityTotal: 1,
    availableProfessionals: [{ id: "prof_ana", name: "Ana" }],
  } as any);
  mockedListaDeEspera.mockResolvedValue(false);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("get_catalog: precios, pautas y abierto_ahora", () => {
  const SERVICIOS = [
    { id: "svc_color", name: "Color", durationMinutes: 90, priceCents: 4500 },
    { id: "svc_corte", name: "Corte", durationMinutes: 30, priceCents: 1800 },
    { id: "svc_barba", name: "Barba", durationMinutes: 20, priceCents: null },
  ];

  async function catalogo(overrides: Record<string, unknown> = {}) {
    mockedBusinessFindUnique.mockResolvedValue(buildBusiness(overrides) as any);
    mockedServiceFindMany.mockResolvedValue(SERVICIOS as any);
    const { result } = await executeVoiceTool({
      businessId: "business_123",
      toolName: "get_catalog",
      params: {},
    });
    return result as Record<string, unknown> & {
      precios: string;
      pautas: string;
    };
  }

  it("«Siempre»: la regla completa (suma exacta, euros a la española, «desde», sin precio)", async () => {
    const r = await catalogo({ agentSettings: { darPrecios: "siempre" } });

    expect(r.precios).toContain(
      "la primera vez que lo ofrezcas o lo confirmes"
    );
    expect(r.precios).toContain("la suma exacta de sus precios");
    expect(r.precios).toContain("«dieciocho euros»");
    expect(r.precios).toContain("«doce euros con cincuenta»");
    expect(r.precios).toContain("«desde» o «con presupuesto»");
    expect(r.precios).toContain("«sin precio», no lo inventes");
    expect(r.precios).toContain(
      "Vale el de aquí aunque la información del negocio diga otro."
    );
    expectCamposCortos(r);
  });

  it("«Si se lo preguntan»: la misma regla, pero solo cuando pregunte", async () => {
    const r = await catalogo({ agentSettings: { darPrecios: "si_preguntan" } });

    expect(r.precios).toMatch(
      /^Di el precio de un servicio solo si el cliente pregunta cuánto cuesta\./
    );
    expect(r.precios).toContain("la suma exacta de sus precios");
    expect(r.precios).not.toContain("la primera vez");
  });

  it("«Nunca»: no da ninguno y ofrece lo que diga su forma de escalar", async () => {
    const recado = await catalogo({
      agentSettings: { darPrecios: "nunca", escalation: "take_message" },
    });
    expect(recado.precios).toContain(
      "ofrécele dejar un recado para que se lo confirmen"
    );
    expect(recado.precios).toContain(
      "ni aproximado ni de la información del negocio"
    );
    expect(recado.precios).not.toContain("suma exacta");
    expect(recado.services).not.toContain("€");

    reiniciarAlmacenEnMemoria();
    const llamada = await catalogo({
      agentSettings: { darPrecios: "nunca", escalation: "request_callback" },
    });
    expect(llamada.precios).toContain(
      "ofrécele que le llamen para confirmárselo"
    );
  });

  it("la regla de precios es la única que pasa del tope, y no por mucho", async () => {
    for (const darPrecios of ["siempre", "si_preguntan", "nunca"]) {
      reiniciarAlmacenEnMemoria();
      const r = await catalogo({ agentSettings: { darPrecios } });
      expect(r.precios.length).toBeLessThanOrEqual(
        2 * MAX_CARACTERES_POR_INSTRUCCION
      );
    }
  });

  it("pautas: el umbral de la duración y el servicio más corto, con su nombre", async () => {
    const r = await catalogo();

    expect(r.pautas).toContain(
      "Di la duración solo si pasa de 80 minutos o te la preguntan."
    );
    expect(r.pautas).toContain("del más corto (Barba, 20 min)");
    expect(r.pautas).not.toContain("antelación");
    expectCamposCortos(r);
  });

  it("pautas: las restricciones del negocio, dichas como en el prompt", async () => {
    const r = await catalogo({
      minAdvanceBookingMinutes: 120,
      maxAppointmentDurationMinutes: 240,
    });

    expect(r.pautas).toContain(
      "No ofrezcas citas con menos de 2 horas de antelación."
    );
    expect(r.pautas).toContain("Ninguna cita puede durar más de 240 minutos.");
    expectCamposCortos(r);
  });

  it("pautas: un servicio más corto con un nombre muy largo no pasa del tope", async () => {
    mockedBusinessFindUnique.mockResolvedValue(
      buildBusiness({
        minAdvanceBookingMinutes: 90,
        maxAppointmentDurationMinutes: 240,
      }) as any
    );
    mockedServiceFindMany.mockResolvedValue([
      {
        id: "svc_largo",
        name: "Tratamiento facial hidratante con ácido hialurónico y masaje relajante de cuello y hombros",
        durationMinutes: 15,
        priceCents: 3000,
      },
    ] as any);
    const { result } = await executeVoiceTool({
      businessId: "business_123",
      toolName: "get_catalog",
      params: {},
    });

    expect(result!.pautas).toContain(
      "comprueba con la duración del más corto y aclara"
    );
    expect(result!.pautas).toContain("90 minutos de antelación");
    expectCamposCortos(result);
  });

  it("abierto_ahora: true dentro del horario, en la zona del negocio", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // Jueves 29-10-2026 a las 09:30 en Madrid (08:30 UTC).
    vi.setSystemTime(new Date("2026-10-29T08:30:00Z"));

    const r = await catalogo();

    expect(r.abierto_ahora).toBe(true);
    expect(mockedCheckBusinessHours).toHaveBeenCalledWith(
      HORARIO,
      "Europe/Madrid",
      "2026-10-29T08:30:00.000Z",
      0
    );
  });

  it("abierto_ahora: false fuera del horario: antes de abrir y en un día cerrado", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // Jueves a las 08:30 en Madrid: aún cerrado.
    vi.setSystemTime(new Date("2026-10-29T07:30:00Z"));
    expect((await catalogo()).abierto_ahora).toBe(false);

    // Sábado a mediodía: cerrado todo el día.
    reiniciarAlmacenEnMemoria();
    vi.setSystemTime(new Date("2026-10-31T11:00:00Z"));
    expect((await catalogo()).abierto_ahora).toBe(false);
  });

  it("abierto_ahora: no aparece si el negocio no tiene horario estructurado", async () => {
    const r = await catalogo({ schedule: {} });

    expect(r).not.toHaveProperty("abierto_ahora");
  });

  it("abierto_ahora: no aparece en el chat, donde caducaría (la conversación dura días)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-29T08:30:00Z"));
    mockedBusinessFindUnique.mockResolvedValue(buildBusiness() as any);
    mockedServiceFindMany.mockResolvedValue(SERVICIOS as any);

    const { result } = await executeVoiceTool({
      businessId: "business_123",
      toolName: "get_catalog",
      callId: "whatsapp:chat:conv_1",
      params: {},
    });

    expect(result).not.toHaveProperty("abierto_ahora");
    expect(result!.schedule).toEqual(expect.any(String));
  });
});

describe("check_availability: siguiente_paso según el caso", () => {
  it("con hueco por voz: guarda el token y el resumen del paso 3, sin confirmaciones sueltas", async () => {
    const { result } = await comprobar();

    expect(result!.available).toBe(true);
    expect(result!.availabilityToken).toEqual(expect.any(String));
    expect(result!.siguiente_paso).toContain("Guarda el availabilityToken.");
    expect(result!.siguiente_paso).toContain("en un solo turno");
    expect(result!.siguiente_paso).toContain(
      "la pregunta del paso 3 de Reserva"
    );
    expect(result!.siguiente_paso).toContain("«¿te viene bien esa hora?»");
    expect(result).not.toHaveProperty("si_no_le_vale");
    expect(mockedListaDeEspera).not.toHaveBeenCalled();
    expectCamposCortos(result);
  });

  it("con hueco en el chat: pregunta solo si lo reserva (sin la pregunta del WhatsApp)", async () => {
    const { result } = await comprobar({}, "whatsapp:chat:conv_1");

    expect(result!.siguiente_paso).toContain("pregunta solo si lo reservas");
    expect(result!.siguiente_paso).not.toContain("WhatsApp");
    // El nombre se pregunta aunque el perfil muestre uno, como en el prompt.
    expect(result!.siguiente_paso).toContain(
      "Pídele su nombre aunque veas el de su perfil"
    );
    expectCamposCortos(result);
  });

  it("con hueco en el chat y una recomendación: también cabe en el tope", async () => {
    mockedCheckAvailability.mockResolvedValue({
      available: true,
      message: "",
      capacityUsed: 0,
      capacityTotal: 1,
      availableProfessionals: [{ id: "prof_ana", name: "Ana" }],
      recommendation: {
        professionalId: "prof_eva",
        professionalName: "Eva",
        isSpecialist: true,
      },
    } as any);

    const { result } = await comprobar({}, "whatsapp:chat:conv_1");

    expect(result!.siguiente_paso).toContain(
      "Pídele su nombre aunque veas el de su perfil"
    );
    expectCamposCortos(result);
  });

  it("con una alternativa ya comprobada: ofrécela con su token, sin volver a comprobar", async () => {
    mockedCheckAvailability.mockResolvedValue({
      available: false,
      code: "CAPACITY_REACHED",
      message: "No hay hueco a esa hora.",
      suggestedNextSlot: {
        startDateTime: "2026-11-20T18:00:00+01:00",
        availableProfessionals: [{ id: "prof_ana", name: "Ana" }],
      },
    } as any);

    const { result } = await comprobar();

    expect(result!.suggestedNextSlot).toMatchObject({
      availabilityToken: expect.any(String),
    });
    expect(result!.siguiente_paso).toContain(
      "La de suggestedNextSlot ya está comprobada"
    );
    expect(result!.siguiente_paso).toContain("sin volver a comprobarla");
    expect(result!.si_no_le_vale).toContain("No prometas avisos por WhatsApp");
    expectCamposCortos(result);
  });

  it("sin hueco y sin lista de espera: pide otra franja e invita a volver a llamar", async () => {
    mockedCheckAvailability.mockResolvedValue({
      available: false,
      code: "ALL_PROFESSIONALS_BUSY",
      message: "Todos ocupados.",
      suggestedNextSlot: null,
    } as any);

    const { result } = await comprobar();

    expect(result!.siguiente_paso).toContain("pídele otro día o franja");
    expect(result!.siguiente_paso).toContain(
      "No propongas horas por tu cuenta"
    );
    expect(result!.si_no_le_vale).toContain(
      "invítale a volver a llamar más adelante"
    );
    expect(result!.si_no_le_vale).toContain("ni uses notify_when_available");
    expectCamposCortos(result);
  });

  it("sin hueco y en el chat sin lista de espera: le invita a escribir más adelante", async () => {
    mockedCheckAvailability.mockResolvedValue({
      available: false,
      code: "CAPACITY_REACHED",
      message: "No hay hueco.",
    } as any);

    const { result } = await comprobar({}, "whatsapp:chat:conv_1");

    expect(result!.si_no_le_vale).toContain("invítale a escribir más adelante");
  });

  it("sin hueco y con lista de espera: ofrece el aviso con la hora ORIGINAL, no con la alternativa", async () => {
    mockedListaDeEspera.mockResolvedValue(true);
    mockedCheckAvailability.mockResolvedValue({
      available: false,
      code: "CAPACITY_REACHED",
      message: "No hay hueco a esa hora.",
      suggestedNextSlot: {
        startDateTime: "2026-11-20T18:00:00+01:00",
        availableProfessionals: [{ id: "prof_ana", name: "Ana" }],
      },
    } as any);

    const { result } = await comprobar();

    expect(result!.si_no_le_vale).toContain(
      "«si quieres, te aviso por WhatsApp si se libera esa hora»"
    );
    expect(result!.si_no_le_vale).toContain(
      `notify_when_available con la hora que pidió (startDateTime ${HORA_PEDIDA}), no con la alternativa`
    );
    expect(result!.si_no_le_vale).not.toContain("18:00");
    expectCamposCortos(result);
  });

  it("un «no» que no se arregla con otra hora (sin nadie que lo haga) no lleva siguiente_paso", async () => {
    mockedCheckAvailability.mockResolvedValue({
      available: false,
      code: "NO_AVAILABLE_PROFESSIONAL",
      message: "No hay profesionales activos configurados en el negocio.",
    } as any);

    const { result } = await comprobar();

    expect(result).not.toHaveProperty("siguiente_paso");
    expect(result).not.toHaveProperty("si_no_le_vale");
    expect(mockedListaDeEspera).not.toHaveBeenCalled();
  });

  it("con una recomendación: primero sus instructions, después el resumen", async () => {
    mockedProfessionalFindFirst.mockResolvedValue({
      id: "prof_marta",
      name: "Marta",
    } as any);
    mockedCheckAvailability.mockResolvedValue({
      available: true,
      message: "",
      capacityUsed: 0,
      capacityTotal: 1,
      availableProfessionals: [{ id: "prof_marta", name: "Marta" }],
      recommendedProfessional: {
        professional: { id: "prof_laura", name: "Laura" },
        isSpecialist: true,
      },
    } as any);

    const { result } = await comprobar({ professionalId: "prof_marta" });

    expect(result!.recommendation).toBeDefined();
    expect(result!.siguiente_paso).toMatch(
      /^Primero sigue recommendation\. Guarda el availabilityToken\./
    );
    expectCamposCortos(result);
  });
});

describe("check_availability: como_decirlo del especialista", () => {
  beforeEach(() => {
    mockedServiceFindMany.mockResolvedValue([
      { id: "svc_mechas", name: "Mechas" },
    ] as any);
  });

  it("con el servicio ya escrito cuando la cita queda con un especialista", async () => {
    mockedCheckAvailability.mockResolvedValue({
      available: true,
      message: "",
      capacityUsed: 0,
      capacityTotal: 1,
      availableProfessionals: [{ id: "prof_laura", name: "Laura" }],
      specialistIds: ["prof_laura"],
    } as any);

    const { result } = await comprobar({ serviceIds: ["svc_mechas"] });

    expect(result!.assignedProfessional).toMatchObject({ isSpecialist: true });
    expect(result!.como_decirlo).toContain("«Laura es especialista en Mechas»");
    expectCamposCortos(result);
  });

  it("sin especialista, o con un nombre provisional, no hay como_decirlo", async () => {
    mockedCheckAvailability.mockResolvedValue({
      available: true,
      message: "",
      capacityUsed: 0,
      capacityTotal: 1,
      availableProfessionals: [{ id: "prof_ana", name: "Ana" }],
      specialistIds: [],
    } as any);
    const { result: normal } = await comprobar({ serviceIds: ["svc_mechas"] });
    expect(normal).not.toHaveProperty("como_decirlo");

    mockedCheckAvailability.mockResolvedValue({
      available: true,
      message: "",
      capacityUsed: 0,
      capacityTotal: 1,
      availableProfessionals: [{ id: "prof_1", name: "Profesional 1" }],
      specialistIds: ["prof_1"],
    } as any);
    const { result: provisional } = await comprobar({
      serviceIds: ["svc_mechas"],
    });
    expect(provisional).not.toHaveProperty("como_decirlo");
  });

  it("si el cliente pidió a alguien por su nombre, no se habla de especialidades", async () => {
    mockedProfessionalFindFirst.mockResolvedValue({
      id: "prof_laura",
      name: "Laura",
    } as any);
    mockedCheckAvailability.mockResolvedValue({
      available: true,
      message: "",
      capacityUsed: 0,
      capacityTotal: 1,
      availableProfessionals: [{ id: "prof_laura", name: "Laura" }],
      specialistIds: ["prof_laura"],
    } as any);

    const { result } = await comprobar({
      serviceIds: ["svc_mechas"],
      professionalId: "prof_laura",
    });

    expect(result).not.toHaveProperty("como_decirlo");
  });
});

describe("check_availability: YA_HAY_CITA_EN_ESTA_LLAMADA adelantado", () => {
  const reservaDeLaLlamada = {
    id: "booking_1",
    isCancelled: false,
    programedAt: new Date("2026-11-20T10:00:00+01:00"),
    durationMinutes: 30,
    clientName: "Lucía",
  };

  beforeEach(() => {
    mockedBookingFindUnique.mockResolvedValue(reservaDeLaLlamada as any);
  });

  it("por voz: no comprueba nada y dice que vuelva a llamar, con el bookingId para cambiarla", async () => {
    const { result } = await comprobar();

    expect(result).toMatchObject({
      available: false,
      success: false,
      code: "YA_HAY_CITA_EN_ESTA_LLAMADA",
      bookingId: "booking_1",
    });
    expect(result!.message).toContain(
      "Esta llamada ya tiene una cita reservada"
    );
    expect(result!.message).toContain("replacesBookingId = booking_1");
    expect(result!.message).toContain(
      "que vuelva a llamar cuando termine esta llamada"
    );
    expect(result).not.toHaveProperty("availabilityToken");
    expect(mockedCheckAvailability).not.toHaveBeenCalled();
    expect(mockedBookingFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { callId: "call_row_1" } })
    );
  });

  it("en el chat: el mismo message que da book_appointment, con el teléfono del negocio", async () => {
    const { result } = await comprobar({}, "whatsapp:chat:conv_1");

    expect(result!.code).toBe("YA_HAY_CITA_EN_ESTA_LLAMADA");
    expect(result!.message).toContain(
      "Esta conversación ya tiene una cita reservada"
    );
    expect(result!.message).toContain("que llame al negocio al +34600111222");

    // El mismo texto que book_appointment para la misma situación.
    const reserva = await executeVoiceTool({
      businessId: "business_123",
      toolName: "book_appointment",
      callId: "whatsapp:chat:conv_1",
      params: {
        clientName: "Marta",
        startDateTime: HORA_PEDIDA,
        durationMinutes: 30,
      },
    });
    expect(reserva.result!.message).toBe(result!.message);
  });

  it("en el chat de un negocio que oculta su número, sin teléfono", async () => {
    mockedBusinessFindUnique.mockResolvedValue(
      buildBusiness({ hideOwnerNumberFromClients: true }) as any
    );

    const { result } = await comprobar({}, "whatsapp:chat:conv_1");

    expect(result!.message).toContain("que llame al negocio");
    expect(result!.message).not.toContain("+34600111222");
  });

  it("cambiar la cita de esta llamada (replacesBookingId = su id) sí se comprueba", async () => {
    mockedBookingFindFirst.mockResolvedValue({
      id: "booking_1",
      callId: "call_row_1",
      clientPhone: null,
      externalEventId: "evt_1",
      call: { fromNumber: "+34600999888" },
    } as any);

    const { result } = await comprobar({ replacesBookingId: "booking_1" });

    expect(result!.available).toBe(true);
    expect(result!.availabilityToken).toEqual(expect.any(String));
  });

  it("volver a comprobar la hora de la cita reservada con otra duración no es otra cita: manda la suma de los servicios", async () => {
    // Se reservó Corte + Tinte (45 + 60 = 105 min) y el modelo vuelve a
    // comprobar esa hora con 90: book_appointment la guardó con la suma.
    mockedBookingFindUnique.mockResolvedValue({
      ...reservaDeLaLlamada,
      programedAt: new Date(HORA_PEDIDA),
      durationMinutes: 105,
    } as any);
    mockedServiceFindMany.mockResolvedValue([
      { id: "svc_corte", name: "Corte", durationMinutes: 45 },
      { id: "svc_tinte", name: "Tinte", durationMinutes: 60 },
    ] as any);

    const { result } = await comprobar({
      durationMinutes: 90,
      serviceIds: ["svc_corte", "svc_tinte"],
    });

    expect(result!.code).not.toBe("YA_HAY_CITA_EN_ESTA_LLAMADA");
    expect(result!.available).toBe(true);
  });

  it("una cita cancelada en esta llamada no cuenta", async () => {
    mockedBookingFindUnique.mockResolvedValue({
      ...reservaDeLaLlamada,
      isCancelled: true,
    } as any);

    const { result } = await comprobar();

    expect(result!.available).toBe(true);
  });
});

describe("book_appointment: di_al_cliente", () => {
  beforeEach(() => {
    mockedCheckBusinessHours.mockReturnValue({
      success: true,
      isOpen: true,
    } as any);
    mockedBookAppointment.mockResolvedValue({
      htmlLink: "https://calendar.google.com/event/1",
    } as any);
    mockedBookingUpsert.mockResolvedValue({ id: "booking_nueva" } as any);
  });

  // WhatsApp configurado (whatsappAdapter.isConfigured) solo en los tests
  // que lo piden; el resto, con el .env de quien los ejecute, no.
  const ENV_DE_WHATSAPP = [
    "WHATSAPP_TELNYX_FROM_NUMBER",
    "TELNYX_API_KEY",
    "TELNYX_MESSAGING_PROFILE_ID",
  ] as const;
  const envAntes: Partial<Record<string, string | undefined>> = {};
  beforeEach(() => {
    for (const clave of ENV_DE_WHATSAPP) {
      envAntes[clave] = process.env[clave];
      delete process.env[clave];
    }
  });
  afterEach(() => {
    for (const clave of ENV_DE_WHATSAPP) {
      if (envAntes[clave] === undefined) delete process.env[clave];
      else process.env[clave] = envAntes[clave];
    }
  });

  function conWhatsapp() {
    process.env.WHATSAPP_TELNYX_FROM_NUMBER = "+34900000001";
    process.env.TELNYX_API_KEY = "test_key";
    process.env.TELNYX_MESSAGING_PROFILE_ID = "profile_test";
    mockedProgramarMensajes.mockResolvedValue({
      confirmacion: "programada",
    } as any);
  }

  function reservar(callId = "call_1", params: Record<string, unknown> = {}) {
    return executeVoiceTool({
      businessId: "business_123",
      toolName: "book_appointment",
      callId,
      params: {
        clientName: "Lucía",
        startDateTime: HORA_PEDIDA,
        durationMinutes: 30,
        smsConsent: true,
        ...params,
      },
    });
  }

  it("con el WhatsApp programado: la frase del WhatsApp de Alhabla, en la misma frase", async () => {
    conWhatsapp();

    const { result } = await reservar();

    expect(result!.success).toBe(true);
    expect(result!.mensajeCliente).toBe("whatsapp");
    expect(result!.di_al_cliente).toContain("Dile que la cita queda reservada");
    expect(result!.di_al_cliente).toContain(
      "«te llegará un WhatsApp de Alhabla con la confirmación de la cita»"
    );
    expect(result!.di_al_cliente).toContain(result!.cuando as string);
    expectCamposCortos(result);
  });

  it("en el chat con el WhatsApp programado: la confirmación le llega por aquí", async () => {
    conWhatsapp();

    const { result } = await reservar("whatsapp:chat:conv_1");

    expect(result!.di_al_cliente).toContain(
      "«te llega la confirmación por este chat»"
    );
    expect(result!.di_al_cliente).not.toContain("Alhabla");
  });

  it("sin WhatsApp (mensajeCliente = ninguno): no menciona ningún mensaje", async () => {
    const { result } = await reservar();

    expect(result!.success).toBe(true);
    expect(result!.mensajeCliente).toBe("ninguno");
    expect(result!.di_al_cliente).toContain(
      "No menciones ningún mensaje ni WhatsApp."
    );
    expect(result!.di_al_cliente).not.toContain("Alhabla");
    expectCamposCortos(result);
  });

  it("un fallo de una reserva nueva (no un cambio) no lleva di_al_cliente", async () => {
    mockedCheckBusinessHours.mockReturnValue({
      success: false,
      code: "OUTSIDE_BUSINESS_HOURS",
      message: "Fuera del horario.",
    } as any);

    const { result } = await reservar();

    expect(result!.success).toBe(false);
    expect(result).not.toHaveProperty("di_al_cliente");
  });

  describe("cambio de cita (replacesBookingId)", () => {
    beforeEach(() => {
      // La cita que cambia es suya: la reservó desde este número en otra
      // llamada.
      mockedBookingFindFirst.mockResolvedValue({
        id: ID_DE_CITA,
        callId: "call_row_antigua",
        clientPhone: null,
        externalEventId: "evt_viejo",
        call: { fromNumber: "+34600999888" },
      } as any);
    });

    async function tokenDelCambio() {
      const { result } = await comprobar({ replacesBookingId: ID_DE_CITA });
      expect(result!.available).toBe(true);
      return result!.availabilityToken as string;
    }

    it("si la nueva no se puede reservar, la que tenía sigue en pie", async () => {
      const availabilityToken = await tokenDelCambio();
      mockedCheckBusinessHours.mockReturnValue({
        success: false,
        code: "OUTSIDE_BUSINESS_HOURS",
        message: "Fuera del horario.",
      } as any);

      const { result } = await reservar("call_1", { availabilityToken });

      expect(result!.success).toBe(false);
      expect(result!.di_al_cliente).toContain("la cita que tenía sigue en pie");
      expect(result!.di_al_cliente).toContain(
        "«tu cita de antes sigue como estaba»"
      );
      expectCamposCortos(result);
    });

    it("si la nueva entra pero la anterior no se anula: que la anule antes de despedirse", async () => {
      const availabilityToken = await tokenDelCambio();
      mockedCancelarReserva.mockRejectedValueOnce(
        new Error("calendario caído")
      );
      vi.spyOn(console, "error").mockImplementation(() => undefined);

      const { result } = await reservar("call_1", { availabilityToken });

      expect(result!.success).toBe(true);
      expect(result!.citaAnterior).toBe("sigue_reservada");
      expect(result!.di_al_cliente).toContain(
        "Anula la anterior con cancel_appointment antes de despedirte"
      );
      expect(result!.di_al_cliente).toContain("la nueva queda reservada");
      expect(result!.di_al_cliente).not.toContain("su cita queda cambiada");
      expectCamposCortos(result);
    });

    it("con el WhatsApp programado y la anterior sin anular, cabe en el tope", async () => {
      conWhatsapp();
      const availabilityToken = await tokenDelCambio();
      mockedCancelarReserva.mockRejectedValueOnce(
        new Error("calendario caído")
      );
      vi.spyOn(console, "error").mockImplementation(() => undefined);

      const { result } = await reservar("call_1", { availabilityToken });

      expect(result!.citaAnterior).toBe("sigue_reservada");
      expect(result!.di_al_cliente).toContain("WhatsApp de Alhabla");
      expectCamposCortos(result);
    });

    describe("si la petición queda pendiente, el reintento puede anular la anterior", () => {
      beforeEach(() => {
        mockedLeadCreate.mockResolvedValue({ id: "lead_1" } as any);
        vi.spyOn(console, "error").mockImplementation(() => undefined);
      });

      function expectPendiente(result: Record<string, unknown> | undefined) {
        expect(result!.success).toBe(false);
        expect(result!.di_al_cliente).toContain(
          "hasta que se confirme la nueva"
        );
        expect(result!.di_al_cliente).not.toContain("sigue como estaba");
        expect(mockedLeadCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              data: expect.objectContaining({ replacesBookingId: ID_DE_CITA }),
            }),
          })
        );
        expectCamposCortos(result);
      }

      it("CALENDAR_UNAVAILABLE (el calendario no se pudo leer)", async () => {
        const availabilityToken = await tokenDelCambio();
        mockedGetBusyIntervals.mockResolvedValue({
          intervals: [],
          calendarAvailabilityKnown: false,
        } as any);

        const { result } = await reservar("call_1", { availabilityToken });

        expect(result!.code).toBe("CALENDAR_UNAVAILABLE");
        expectPendiente(result);
      });

      it("BOOKING_LOCK_TIMEOUT (otra reserva tenía el cerrojo)", async () => {
        const availabilityToken = await tokenDelCambio();
        mockedAdquirirCerrojo.mockResolvedValueOnce({
          estado: "ocupado",
        } as any);

        const { result } = await reservar("call_1", { availabilityToken });

        expect(result!.code).toBe("BOOKING_LOCK_TIMEOUT");
        expectPendiente(result);
      });

      it("BOOKING_LOCK_ERROR (el almacén del cerrojo falló)", async () => {
        const availabilityToken = await tokenDelCambio();
        mockedAdquirirCerrojo.mockResolvedValueOnce({
          estado: "error",
          motivo: "almacén caído",
        } as any);

        const { result } = await reservar("call_1", { availabilityToken });

        expect(result!.code).toBe("BOOKING_LOCK_ERROR");
        expectPendiente(result);
      });

      it("CALENDAR_NOT_CONNECTED (sin calendario operativo)", async () => {
        const availabilityToken = await tokenDelCambio();
        // El calendario se desconecta entre la comprobación y la reserva.
        mockedBusinessFindUnique.mockResolvedValue(
          buildBusiness({ calendarConnections: [] }) as any
        );
        await invalidarCacheDeVoz("business_123", "[Test]");

        const { result } = await reservar("call_1", { availabilityToken });

        expect(result!.code).toBe("CALENDAR_NOT_CONNECTED");
        expectPendiente(result);
      });

      it("un fallo del calendario al crear el evento (se reintenta solo)", async () => {
        const availabilityToken = await tokenDelCambio();
        mockedBookAppointment.mockRejectedValue(new Error("timeout"));

        const { result } = await reservar("call_1", { availabilityToken });

        expect(result!.code).toBe("BOOK_APPOINTMENT_UNEXPECTED_ERROR");
        expectPendiente(result);
      });
    });

    it("si la cita que cambia ya no está activa al reservar, un fallo no dice que sigue en pie", async () => {
      const availabilityToken = await tokenDelCambio();
      // El negocio la anuló desde la app entre la comprobación y la reserva.
      mockedBookingFindFirst.mockResolvedValue(null);
      mockedCheckBusinessHours.mockReturnValue({
        success: false,
        code: "OUTSIDE_BUSINESS_HOURS",
        message: "Fuera del horario.",
      } as any);

      const { result } = await reservar("call_1", { availabilityToken });

      expect(result!.success).toBe(false);
      expect(result).not.toHaveProperty("di_al_cliente");
    });

    it("si solo falta un dato (el nombre), no: se pide y se reintenta", async () => {
      const availabilityToken = await tokenDelCambio();

      const { result } = await reservar("call_1", {
        availabilityToken,
        clientName: "",
      });

      expect(result!.code).toBe("CLIENT_NAME_REQUIRED");
      expect(result).not.toHaveProperty("di_al_cliente");
    });
  });
});

describe("find_my_appointment: siguiente_paso", () => {
  it("con la cita: confirmarla, anular con cancel_appointment o cambiar con replacesBookingId sin anularla", async () => {
    mockedBookingFindFirst.mockResolvedValue({
      id: ID_DE_CITA,
      programedAt: new Date("2026-11-20T10:00:00+01:00"),
      serviceIds: [],
      clientName: "Lucía",
      professional: null,
    } as any);

    const { result } = await executeVoiceTool({
      businessId: "business_123",
      toolName: "find_my_appointment",
      callId: "call_1",
      params: {},
    });

    expect(result!.bookingId).toBe(ID_DE_CITA);
    const paso = result!.siguiente_paso as string;
    expect(paso).toContain("Confírmasela antes de tocarla.");
    expect(paso).toContain("Anular: cancel_appointment, tras su sí claro.");
    expect(paso).toContain(
      `no la anules; comprueba la nueva con replacesBookingId = ${ID_DE_CITA}`
    );
    expect(paso).toContain("si la nueva falla, sigue en pie");
    expect(paso).toContain("usa su clientName");
    expectCamposCortos(result);
  });

  it("sin clientName en la cita: pregunta el nombre si es al mismo", async () => {
    mockedBookingFindFirst.mockResolvedValue({
      id: ID_DE_CITA,
      programedAt: new Date("2026-11-20T10:00:00+01:00"),
      serviceIds: [],
      clientName: null,
      professional: null,
    } as any);

    const { result } = await executeVoiceTool({
      businessId: "business_123",
      toolName: "find_my_appointment",
      callId: "call_1",
      params: {},
    });

    expect(result!.siguiente_paso).toContain("pregúntaselo");
    expectCamposCortos(result);
  });

  it("sin cita: APPOINTMENT_NOT_FOUND sin insinuar citas de otras personas", async () => {
    const { result } = await executeVoiceTool({
      businessId: "business_123",
      toolName: "find_my_appointment",
      callId: "call_1",
      params: {},
    });

    expect(result).toMatchObject({
      success: false,
      code: "APPOINTMENT_NOT_FOUND",
    });
    expect(result!.message).toContain(
      "«no encuentro ninguna cita con este número»"
    );
    expect(result!.message).not.toContain("nombre con el que reservaste");
    expect(result!.siguiente_paso).toContain(
      "No des a entender que pueda haber una cita a otro nombre ni de otra persona"
    );
    expect(result!.siguiente_paso).toContain(
      "no prometas cambiar ni anular ninguna"
    );
    expectCamposCortos(result);
  });
});
