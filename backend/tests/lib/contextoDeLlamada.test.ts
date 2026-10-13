import { describe, it, expect, beforeEach, vi } from "vitest";
import { resolverContextoDeLlamada } from "../../src/lib/contextoDeLlamada.js";
import { prisma } from "../../src/lib/prisma.js";
import { DEFAULT_AGENT_SETTINGS } from "../../src/lib/managedAgentPrompt.js";

vi.mock("../../src/lib/prisma.js", () => ({
  prisma: {
    call: { findFirst: vi.fn() },
    clienteDelNegocio: { findUnique: vi.fn() },
    booking: { findFirst: vi.fn() },
    service: { findMany: vi.fn() },
  },
}));

const mockedCallFindFirst = vi.mocked(prisma.call.findFirst);
const mockedClienteFindUnique = vi.mocked(prisma.clienteDelNegocio.findUnique);
const mockedBookingFindFirst = vi.mocked(prisma.booking.findFirst);
const mockedServiceFindMany = vi.mocked(prisma.service.findMany);

const AHORA = new Date("2026-10-13T10:00:00Z");
const HACE_UN_MES = new Date("2026-09-13T10:00:00Z");

const negocio = (campos: Record<string, unknown> = {}) => ({
  id: "biz_1",
  name: "Peluquería Ana",
  agentSettings: DEFAULT_AGENT_SETTINGS,
  businessType: "peluqueria",
  ...campos,
});

describe("resolverContextoDeLlamada", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCallFindFirst.mockResolvedValue({ startedAt: HACE_UN_MES } as any);
    mockedClienteFindUnique.mockResolvedValue(null);
    mockedBookingFindFirst.mockResolvedValue(null);
    mockedServiceFindMany.mockResolvedValue([]);
  });

  it("a quien no se conoce: el saludo fijo, sin grabar y las variables vacías", async () => {
    const contexto = await resolverContextoDeLlamada({
      business: negocio(),
      telefono: "+34600111222",
      ahora: AHORA,
    });

    expect(contexto).toEqual({
      saludo:
        "Peluquería Ana, te atiende su asistente de inteligencia artificial. ¿En qué te ayudo?",
      grabar: false,
      variables: {
        nombre_cliente: "",
        ultimo_servicio: "",
        grabacion: "sin_preguntar",
      },
    });
    // Solo los datos de ese negocio y ese teléfono.
    expect(mockedClienteFindUnique).toHaveBeenCalledWith({
      where: {
        businessId_telefono: { businessId: "biz_1", telefono: "+34600111222" },
      },
      select: { grabacionAceptada: true },
    });
    expect(mockedBookingFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          clientName: { not: null },
          OR: [
            { call: { businessId: "biz_1", fromNumber: "+34600111222" } },
            { clientPhone: "+34600111222", call: { businessId: "biz_1" } },
          ],
        },
      })
    );
  });

  it("la primera semana desde la primera llamada del negocio dice «nueva»", async () => {
    mockedCallFindFirst.mockResolvedValue({
      startedAt: new Date("2026-10-10T10:00:00Z"),
    } as any);

    const contexto = await resolverContextoDeLlamada({
      business: negocio(),
      telefono: "+34600111222",
      ahora: AHORA,
    });

    expect(contexto.saludo).toBe(
      "Peluquería Ana, te atiende su nueva asistente de inteligencia artificial. ¿En qué te ayudo?"
    );
    // Los chats de WhatsApp no cuentan como primera llamada.
    expect(mockedCallFindFirst).toHaveBeenCalledWith({
      where: { businessId: "biz_1", voiceProvider: { not: "whatsapp" } },
      orderBy: { startedAt: "asc" },
      select: { startedAt: true },
    });
  });

  it("sin ninguna llamada anterior, esta es la primera: «nueva»", async () => {
    mockedCallFindFirst.mockResolvedValue(null);

    const contexto = await resolverContextoDeLlamada({
      business: negocio(),
      telefono: null,
      ahora: AHORA,
    });

    expect(contexto.saludo).toContain("su nueva asistente");
  });

  it("a un cliente de peluquería que deja grabar: su nombre, su servicio, el aviso y se graba", async () => {
    mockedClienteFindUnique.mockResolvedValue({
      grabacionAceptada: true,
    } as any);
    mockedBookingFindFirst.mockResolvedValue({
      clientName: " Lucía ",
      serviceIds: ["srv_1", "srv_2"],
    } as any);
    mockedServiceFindMany.mockResolvedValue([
      { name: "Corte" },
      { name: "Mechas" },
    ] as any);

    const contexto = await resolverContextoDeLlamada({
      business: negocio(),
      telefono: "+34600111222",
      ahora: AHORA,
    });

    expect(contexto).toEqual({
      saludo:
        "Hola, Lucía, soy la asistente de inteligencia artificial de Peluquería Ana. La llamada se graba; si prefieres que no, dímelo. ¿Quieres repetir Corte y Mechas o prefieres algo nuevo?",
      grabar: true,
      variables: {
        nombre_cliente: "Lucía",
        ultimo_servicio: "Corte y Mechas",
        grabacion: "aceptada",
      },
    });
    // Solo servicios activos de ese negocio.
    expect(mockedServiceFindMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["srv_1", "srv_2"] },
        businessId: "biz_1",
        active: true,
        deletedAt: null,
      },
      select: { name: true },
    });
  });

  it.each(["fisioterapia", "centro-de-estetica", "other"])(
    "en %s el saludo no nombra el servicio, pero el prompt lo tiene",
    async (businessType) => {
      mockedBookingFindFirst.mockResolvedValue({
        clientName: "Lucía",
        serviceIds: ["srv_1"],
      } as any);
      mockedServiceFindMany.mockResolvedValue([
        { name: "Punción seca" },
      ] as any);

      const contexto = await resolverContextoDeLlamada({
        business: negocio({ businessType }),
        telefono: "+34600111222",
        ahora: AHORA,
      });

      expect(contexto.saludo).not.toContain("Punción seca");
      expect(contexto.saludo).toContain("lo de la última vez");
      expect(contexto.variables.ultimo_servicio).toBe("Punción seca");
    }
  );

  it("si dijo que no a grabar, ni se graba ni se avisa", async () => {
    mockedClienteFindUnique.mockResolvedValue({
      grabacionAceptada: false,
    } as any);

    const contexto = await resolverContextoDeLlamada({
      business: negocio(),
      telefono: "+34600111222",
      ahora: AHORA,
    });

    expect(contexto.grabar).toBe(false);
    expect(contexto.variables.grabacion).toBe("rechazada");
    expect(contexto.saludo).not.toContain("se graba");
  });

  it("con voz masculina, «el asistente»", async () => {
    mockedBookingFindFirst.mockResolvedValue({
      clientName: "Lucía",
      serviceIds: [],
    } as any);

    const contexto = await resolverContextoDeLlamada({
      business: negocio({
        agentSettings: { ...DEFAULT_AGENT_SETTINGS, voiceGender: "masculina" },
      }),
      telefono: "+34600111222",
      ahora: AHORA,
    });

    expect(contexto.saludo).toBe(
      "Hola, Lucía, soy el asistente de inteligencia artificial de Peluquería Ana. ¿Quieres repetir lo de la última vez o prefieres algo nuevo?"
    );
  });

  it("con número oculto no busca al cliente", async () => {
    const contexto = await resolverContextoDeLlamada({
      business: negocio(),
      telefono: "anonymous",
      ahora: AHORA,
    });

    expect(mockedClienteFindUnique).not.toHaveBeenCalled();
    expect(mockedBookingFindFirst).not.toHaveBeenCalled();
    expect(contexto.variables.grabacion).toBe("sin_preguntar");
  });
});
