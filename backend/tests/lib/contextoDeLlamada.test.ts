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
        "Peluquería Ana, te atiende su recepcionista de IA. ¿En qué te ayudo?",
      grabar: false,
      voz: null,
      variables: {
        nombre_cliente: "",
        ultimo_servicio: "",
      },
    });
    // Solo los datos de ese negocio y ese teléfono.
    expect(mockedClienteFindUnique).toHaveBeenCalledWith({
      where: {
        businessId_telefono: { businessId: "biz_1", telefono: "+34600111222" },
      },
      select: { grabacionAceptada: true, idioma: true },
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
      "Peluquería Ana, te atiende su nueva recepcionista de IA. ¿En qué te ayudo?"
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

    expect(contexto.saludo).toContain("su nueva recepcionista");
  });

  it("a un cliente de peluquería que deja grabar: su nombre, su servicio, el aviso y se graba", async () => {
    mockedClienteFindUnique.mockResolvedValue({
      grabacionAceptada: true,
    } as any);
    mockedBookingFindFirst.mockResolvedValue({
      clientName: " Lucía ",
      serviceIds: ["srv_1"],
    } as any);
    mockedServiceFindMany.mockResolvedValue([{ name: "Corte" }] as any);

    const contexto = await resolverContextoDeLlamada({
      business: negocio(),
      telefono: "+34600111222",
      ahora: AHORA,
    });

    expect(contexto).toEqual({
      saludo:
        "Hola, Lucía, soy la recepcionista de IA de Peluquería Ana. La llamada se graba; si prefieres que no, dímelo. ¿Quieres repetir Corte o prefieres algo nuevo?",
      grabar: true,
      voz: null,
      variables: {
        nombre_cliente: "Lucía",
        ultimo_servicio: "Corte",
      },
    });
    // Solo servicios activos de ese negocio.
    expect(mockedServiceFindMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["srv_1"] },
        businessId: "biz_1",
        active: true,
        deletedAt: null,
      },
      select: { name: true },
    });
  });

  // Llamada de producción del 14-10: «¿Quieres repetir Coloración y
  // Hidratación profunda y Peinado…?» se hacía largo.
  it("con varios servicios, el saludo dice «lo de la última vez» y el prompt los tiene todos", async () => {
    mockedBookingFindFirst.mockResolvedValue({
      clientName: "Lucía",
      serviceIds: ["srv_1", "srv_2", "srv_3"],
    } as any);
    mockedServiceFindMany.mockResolvedValue([
      { name: "Coloración" },
      { name: "Hidratación profunda" },
      { name: "Peinado" },
    ] as any);

    const contexto = await resolverContextoDeLlamada({
      business: negocio(),
      telefono: "+34600111222",
      ahora: AHORA,
    });

    expect(contexto.saludo).toContain("¿Quieres repetir lo de la última vez");
    expect(contexto.variables.ultimo_servicio).toBe(
      "Coloración, Hidratación profunda y Peinado"
    );
  });

  // Los nombres del catálogo suelen estar en castellano: dentro de un
  // saludo en catalán sonaban raros («Vols repetir Peinado…?»).
  it("si no saluda en castellano, no nombra el servicio", async () => {
    mockedBookingFindFirst.mockResolvedValue({
      clientName: "Lucía",
      serviceIds: ["srv_1"],
    } as any);
    mockedServiceFindMany.mockResolvedValue([{ name: "Peinado" }] as any);

    const contexto = await resolverContextoDeLlamada({
      business: negocio({
        agentSettings: { ...DEFAULT_AGENT_SETTINGS, voiceLanguage: "ca-ES" },
      }),
      telefono: "+34600111222",
      ahora: AHORA,
    });

    expect(contexto.saludo).toBe(
      "Hola, Lucía, sóc la intel·ligència artificial de Peluquería Ana. Vols repetir el de l'última vegada o prefereixes una altra cosa?"
    );
    expect(contexto.variables.ultimo_servicio).toBe("Peinado");
  });

  describe("en el idioma en que habló la última vez", () => {
    const lucia = () => {
      mockedBookingFindFirst.mockResolvedValue({
        clientName: "Lucía",
        serviceIds: ["srv_1"],
      } as any);
      mockedServiceFindMany.mockResolvedValue([{ name: "Peinado" }] as any);
    };

    it("en inglés: le saluda en inglés con la voz del assistant y sin nombrar el servicio", async () => {
      lucia();
      mockedClienteFindUnique.mockResolvedValue({ idioma: "en-GB" } as any);

      const contexto = await resolverContextoDeLlamada({
        business: negocio(),
        telefono: "+34600111222",
        ahora: AHORA,
      });

      expect(contexto.saludo).toBe(
        "Hi Lucía, this is the AI receptionist at Peluquería Ana. Would you like the same as last time, or something new?"
      );
      expect(contexto.voz).toBeNull();
      expect(contexto.variables.ultimo_servicio).toBe("Peinado");
    });

    it("en la cooficial de la zona: le saluda en ella y ya con la voz de Soniox", async () => {
      lucia();
      mockedClienteFindUnique.mockResolvedValue({ idioma: "ca-ES" } as any);

      const contexto = await resolverContextoDeLlamada({
        business: negocio({
          address: "Carrer de Mallorca 1, 08001 Barcelona, Spain",
        }),
        telefono: "+34600111222",
        ahora: AHORA,
      });

      expect(contexto.saludo).toBe(
        "Hola, Lucía, sóc la intel·ligència artificial de Peluquería Ana. Vols repetir el de l'última vegada o prefereixes una altra cosa?"
      );
      expect(contexto.voz).toEqual(
        expect.objectContaining({
          voice: expect.stringMatching(/^Soniox\./),
          language: "ca",
          expressive_mode: false,
        })
      );
    });

    it("en una cooficial que el negocio no habla (otra zona): en el principal", async () => {
      lucia();
      mockedClienteFindUnique.mockResolvedValue({ idioma: "ca-ES" } as any);

      const contexto = await resolverContextoDeLlamada({
        business: negocio({ address: "Calle Mayor 1, 28013 Madrid, Spain" }),
        telefono: "+34600111222",
        ahora: AHORA,
      });

      expect(contexto.saludo).toContain("¿Quieres repetir Peinado");
      expect(contexto.voz).toBeNull();
    });

    it("con un idioma que no está en el catálogo, en el principal", async () => {
      lucia();
      mockedClienteFindUnique.mockResolvedValue({ idioma: "xx-XX" } as any);

      const contexto = await resolverContextoDeLlamada({
        business: negocio(),
        telefono: "+34600111222",
        ahora: AHORA,
      });

      expect(contexto.saludo).toContain("¿Quieres repetir Peinado");
      expect(contexto.voz).toBeNull();
    });

    it("a quien aún no ha reservado también le saluda en su idioma", async () => {
      mockedClienteFindUnique.mockResolvedValue({ idioma: "en-GB" } as any);

      const contexto = await resolverContextoDeLlamada({
        business: negocio(),
        telefono: "+34600111222",
        ahora: AHORA,
      });

      expect(contexto.saludo).toMatch(/^Peluquería Ana/);
      expect(contexto.saludo).toContain("AI receptionist");
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
    expect(contexto.saludo).not.toContain("se graba");
  });

  it("con voz masculina, «el recepcionista»", async () => {
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
      "Hola, Lucía, soy el recepcionista de IA de Peluquería Ana. ¿Quieres repetir lo de la última vez o prefieres algo nuevo?"
    );
  });

  it("si llama desde un teléfono del propio negocio, no lo trata como cliente", async () => {
    const contexto = await resolverContextoDeLlamada({
      business: negocio({ phone: "+34930000001" }),
      telefono: "+34930000001",
      ahora: AHORA,
    });

    expect(mockedClienteFindUnique).not.toHaveBeenCalled();
    expect(mockedBookingFindFirst).not.toHaveBeenCalled();
    expect(contexto.variables.nombre_cliente).toBe("");
  });

  it("con número oculto no busca al cliente", async () => {
    const contexto = await resolverContextoDeLlamada({
      business: negocio(),
      telefono: "anonymous",
      ahora: AHORA,
    });

    expect(mockedClienteFindUnique).not.toHaveBeenCalled();
    expect(mockedBookingFindFirst).not.toHaveBeenCalled();
    expect(contexto.grabar).toBe(false);
  });
});
