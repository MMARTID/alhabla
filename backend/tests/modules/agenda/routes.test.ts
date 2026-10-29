import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify from "fastify";
import { agendaFeedRoutes, enlacesDelFeed } from "../../../src/modules/agenda/routes.js";
import { prisma } from "../../../src/lib/prisma.js";
import { listarAusencias } from "../../../src/modules/bookings/ausencias.js";

vi.mock("../../../src/lib/prisma.js", () => ({
  prisma: {
    business: { findUnique: vi.fn(), update: vi.fn() },
    booking: { findMany: vi.fn() },
    service: { findMany: vi.fn() },
    professional: { findFirst: vi.fn() },
  },
}));
vi.mock("../../../src/modules/bookings/ausencias.js", () => ({
  listarAusencias: vi.fn(),
}));

const mockedBusinessFindUnique = vi.mocked(prisma.business.findUnique);
const mockedBusinessUpdate = vi.mocked(prisma.business.update);
const mockedBookingFindMany = vi.mocked(prisma.booking.findMany);
const mockedServiceFindMany = vi.mocked(prisma.service.findMany);
const mockedProfessionalFindFirst = vi.mocked(prisma.professional.findFirst);
const mockedListarAusencias = vi.mocked(listarAusencias);

const TOKEN = "a".repeat(64);

async function servidor() {
  const fastify = Fastify();
  fastify.decorate("authenticate", async (request: any) => {
    request.user = { businessId: "biz_1" };
  });
  await fastify.register(agendaFeedRoutes);
  return fastify;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.BASE_URL = "https://api.alhabla.ai";
  mockedServiceFindMany.mockResolvedValue([{ id: "svc_1", name: "Corte" }] as never);
  mockedListarAusencias.mockResolvedValue([]);
});
afterEach(() => {
  delete process.env.BASE_URL;
});

describe("GET /agenda/:token.ics (público)", () => {
  it("devuelve el calendario del negocio del token, con cabeceras de no indexar", async () => {
    const fastify = await servidor();
    mockedBusinessFindUnique.mockResolvedValue({ id: "biz_1", name: "Peluquería Ana" } as never);
    mockedBookingFindMany.mockResolvedValue([
      {
        id: "bk_1",
        programedAt: new Date("2026-11-05T16:00:00Z"),
        durationMinutes: 45,
        clientName: "Marta",
        serviceIds: ["svc_1"],
        isCancelled: false,
        cancelledAt: null,
        createdAt: new Date("2026-10-20T10:00:00Z"),
        professional: { name: "Laura" },
      },
    ] as never);

    const r = await fastify.inject({ method: "GET", url: `/agenda/${TOKEN}.ics` });

    expect(r.statusCode).toBe(200);
    expect(r.headers["content-type"]).toContain("text/calendar");
    expect(r.headers["x-robots-tag"]).toContain("noindex");
    expect(r.headers["cache-control"]).toContain("max-age=300");
    expect(r.body).toContain("X-WR-CALNAME:Agenda de Peluquería Ana");
    expect(r.body).toContain("SUMMARY:Corte · Marta");
    // Se busca SOLO por el token, nunca por un id.
    expect(mockedBusinessFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { icalToken: TOKEN } })
    );
    // Ventana de −30 a +120 días, con las canceladas recientes.
    const where = mockedBookingFindMany.mock.calls[0][0]!.where as any;
    expect(where.call).toEqual({ businessId: "biz_1" });
    expect(where.OR).toEqual([{ isCancelled: false }, { cancelledAt: { gte: expect.any(Date) } }]);
    const dias = (where.programedAt.lt.getTime() - where.programedAt.gte.getTime()) / 86_400_000;
    expect(Math.round(dias)).toBe(150);
  });

  it("un token que no existe o mal formado es 404, sin distinguir", async () => {
    const fastify = await servidor();
    mockedBusinessFindUnique.mockResolvedValue(null);

    expect((await fastify.inject({ method: "GET", url: `/agenda/${TOKEN}.ics` })).statusCode).toBe(404);
    expect((await fastify.inject({ method: "GET", url: "/agenda/corto.ics" })).statusCode).toBe(404);
    expect(mockedBusinessFindUnique).toHaveBeenCalledTimes(1);
  });

  it("?pro= filtra por profesional del negocio; el de otro negocio da el feed vacío", async () => {
    const fastify = await servidor();
    mockedBusinessFindUnique.mockResolvedValue({ id: "biz_1", name: "Peluquería Ana" } as never);
    mockedProfessionalFindFirst.mockResolvedValueOnce({ id: "pro_1" } as never);
    mockedBookingFindMany.mockResolvedValue([] as never);

    const propio = await fastify.inject({ method: "GET", url: `/agenda/${TOKEN}.ics?pro=pro_1` });
    expect(propio.statusCode).toBe(200);
    expect(mockedProfessionalFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "pro_1", businessId: "biz_1" } })
    );
    expect((mockedBookingFindMany.mock.calls[0][0]!.where as any).professionalId).toBe("pro_1");
    expect(mockedListarAusencias).toHaveBeenCalledWith("biz_1", expect.objectContaining({ profesionalId: "pro_1" }));

    mockedProfessionalFindFirst.mockResolvedValueOnce(null);
    const ajeno = await fastify.inject({ method: "GET", url: `/agenda/${TOKEN}.ics?pro=pro_de_otro` });
    expect(ajeno.statusCode).toBe(200);
    expect(ajeno.body).not.toContain("BEGIN:VEVENT");
    expect(mockedBookingFindMany).toHaveBeenCalledTimes(1);
  });
});

describe("/business/me/agenda/feed (panel)", () => {
  it("GET dice si está activo y da los enlaces https y webcal", async () => {
    const fastify = await servidor();
    mockedBusinessFindUnique.mockResolvedValue({ icalToken: TOKEN } as never);

    const r = await fastify.inject({ method: "GET", url: "/business/me/agenda/feed" });

    expect(r.json()).toEqual({
      activo: true,
      url: `https://api.alhabla.ai/agenda/${TOKEN}.ics`,
      webcal: `webcal://api.alhabla.ai/agenda/${TOKEN}.ics`,
    });
  });

  it("POST crea un token de 32 bytes la primera vez y lo conserva después; con renovar lo cambia", async () => {
    const fastify = await servidor();
    mockedBusinessFindUnique.mockResolvedValueOnce({ icalToken: null } as never);

    const primero = await fastify.inject({ method: "POST", url: "/business/me/agenda/feed", payload: {} });
    expect(primero.statusCode).toBe(200);
    const token = (mockedBusinessUpdate.mock.calls[0][0] as any).data.icalToken as string;
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(primero.json().url).toBe(`https://api.alhabla.ai/agenda/${token}.ics`);

    mockedBusinessFindUnique.mockResolvedValueOnce({ icalToken: token } as never);
    const segundo = await fastify.inject({ method: "POST", url: "/business/me/agenda/feed", payload: {} });
    expect(segundo.json().url).toBe(primero.json().url);
    expect(mockedBusinessUpdate).toHaveBeenCalledTimes(1);

    mockedBusinessFindUnique.mockResolvedValueOnce({ icalToken: token } as never);
    const renovado = await fastify.inject({
      method: "POST",
      url: "/business/me/agenda/feed",
      payload: { renovar: true },
    });
    expect(renovado.json().url).not.toBe(primero.json().url);
    expect(mockedBusinessUpdate).toHaveBeenCalledTimes(2);
  });

  it("DELETE desactiva el enlace", async () => {
    const fastify = await servidor();
    const r = await fastify.inject({ method: "DELETE", url: "/business/me/agenda/feed" });
    expect(r.json()).toEqual({ activo: false, url: null, webcal: null });
    expect(mockedBusinessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "biz_1" }, data: { icalToken: null } })
    );
  });

  it("sin BASE_URL no inventa enlaces", () => {
    delete process.env.BASE_URL;
    expect(enlacesDelFeed(TOKEN)).toEqual({ activo: true, url: null, webcal: null });
  });
});
