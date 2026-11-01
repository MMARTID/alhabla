import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify from "fastify";
import { growthRoutes } from "../../../src/modules/growth/routes.js";
import { COMPETIDOR_CONFIRMADO } from "../../../src/modules/growth/competidores.js";
import { datosComparables } from "../../../src/modules/growth/comparadorDePrecios.js";
import type { PrismaMock } from "./ayudas.js";
import {
  ADMIN,
  comoAdmin,
  comoAgente,
  hace,
  registroDeToken,
} from "./ayudas.js";

const { prismaMock, mockVerifyIdToken } = await vi.hoisted(async () => {
  const { crearPrismaMock } = await import("./ayudas.js");
  return { prismaMock: crearPrismaMock(), mockVerifyIdToken: vi.fn() };
});

vi.mock("../../../src/lib/prisma.js", () => ({ prisma: prismaMock }));

vi.mock("google-auth-library", () => ({
  OAuth2Client: vi.fn(function OAuth2ClientMock() {
    return { verifyIdToken: mockVerifyIdToken };
  }),
}));

const mock = prismaMock as PrismaMock;

/**
 * Panel útil — el comparador de precios con Prisma de mentira: la forma de la
 * respuesta, qué datos se comparan, que un `propuesto` queda fuera, que no hay
 * una consulta por competidor y que solo entra el administrador. Lo que
 * depende de Postgres está en tests/integration/growth/f3a-panel-util.test.ts.
 */

type Fila = Record<string, unknown>;

function dato(cambios: Fila = {}) {
  return {
    tipo: "precio",
    etiqueta: "Plan Pro",
    texto: "99 € al mes con 500 minutos",
    valor: { importe: 99, moneda: "EUR", periodo: "mes", ivaIncluido: false },
    urlFuente: "https://competidor.ejemplo.com/precios",
    consultadoEn: new Date().toISOString(),
    ...cambios,
  };
}

function filaDeAnalisis(cambios: Fila = {}) {
  return {
    id: "a1",
    version: 1,
    creadoEn: hace(2),
    revisadoEn: null,
    datos: [dato()],
    ...cambios,
  };
}

function filaDeCompetidor(cambios: Fila = {}) {
  return {
    id: "c1",
    nombre: "Fonio",
    dominio: "fonio.ai",
    url: "https://fonio.ai/precios",
    origen: "repo",
    estado: "analizado",
    analisis: [filaDeAnalisis()] as Fila[],
    ...cambios,
  };
}

describe("panel útil: comparador de precios (Prisma de mentira)", () => {
  let fastify: ReturnType<typeof Fastify>;

  const pide = (headers: Record<string, string> = comoAdmin()) =>
    fastify.inject({
      method: "GET",
      url: "/growth/admin/competidores/comparador",
      headers,
    });

  beforeEach(async () => {
    vi.resetAllMocks();
    process.env.GROWTH_GOOGLE_CLIENT_ID =
      "cliente-growth.apps.googleusercontent.com";
    process.env.GROWTH_ADMIN_EMAILS = ADMIN;
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ email: ADMIN, email_verified: true }),
    });
    mock.growthTokenAgente.findUnique.mockResolvedValue(registroDeToken());
    mock.growthCompetidor.findMany.mockResolvedValue([]);
    fastify = Fastify();
    await fastify.register(growthRoutes);
  });

  afterEach(async () => {
    await fastify.close();
    vi.restoreAllMocks();
  });

  it("sin competidores: { data: [], generadoEn } y sin caché", async () => {
    const r = await pide();
    expect(r.statusCode).toBe(200);
    expect(r.headers["cache-control"]).toBe("no-store");
    expect(r.json()).toEqual({ data: [], generadoEn: expect.any(String) });
    expect(Number.isNaN(Date.parse(r.json().generadoEn))).toBe(false);
  });

  it("cada fila lleva lo del contrato, con las fechas en ISO y sin campos de más", async () => {
    mock.growthCompetidor.findMany.mockResolvedValue([
      filaDeCompetidor({
        analisis: [
          filaDeAnalisis({
            id: "a7",
            version: 3,
            creadoEn: new Date("2026-10-20T10:00:00.000Z"),
            revisadoEn: new Date("2026-10-21T08:00:00.000Z"),
          }),
        ],
        estado: "revisado",
      }),
    ]);
    const r = await pide();
    const [fila] = r.json().data;
    expect(Object.keys(fila).sort()).toEqual([
      "analisis",
      "competidorId",
      "datos",
      "dominio",
      "estado",
      "nombre",
      "origen",
      "url",
    ]);
    expect(fila).toMatchObject({
      competidorId: "c1",
      nombre: "Fonio",
      dominio: "fonio.ai",
      url: "https://fonio.ai/precios",
      origen: "repo",
      estado: "revisado",
      analisis: {
        id: "a7",
        version: 3,
        creadoEn: "2026-10-20T10:00:00.000Z",
        revisadoEn: "2026-10-21T08:00:00.000Z",
        caducado: false,
      },
    });
    expect(Object.keys(fila.analisis).sort()).toEqual([
      "caducado",
      "creadoEn",
      "id",
      "revisadoEn",
      "version",
    ]);
    expect(fila.datos).toHaveLength(1);
    expect(fila.datos[0]).toMatchObject({
      tipo: "precio",
      urlFuente: "https://competidor.ejemplo.com/precios",
      valor: { importe: 99, moneda: "EUR", periodo: "mes" },
    });
  });

  it("un análisis de más de 90 días está caducado; uno de 89 no", async () => {
    mock.growthCompetidor.findMany.mockResolvedValue([
      filaDeCompetidor({
        id: "c1",
        nombre: "Viejo",
        analisis: [filaDeAnalisis({ creadoEn: hace(91) })],
      }),
      filaDeCompetidor({
        id: "c2",
        nombre: "Justo",
        analisis: [filaDeAnalisis({ creadoEn: hace(89) })],
      }),
    ]);
    const filas = (await pide()).json().data;
    expect(
      filas.find((f: Fila) => f.nombre === "Viejo").analisis.caducado
    ).toBe(true);
    expect(
      filas.find((f: Fila) => f.nombre === "Justo").analisis.caducado
    ).toBe(false);
  });

  it("sin análisis: analisis null y datos []", async () => {
    mock.growthCompetidor.findMany.mockResolvedValue([
      filaDeCompetidor({ estado: "por_analizar", analisis: [], url: null }),
    ]);
    const [fila] = (await pide()).json().data;
    expect(fila).toMatchObject({
      estado: "por_analizar",
      url: null,
      analisis: null,
      datos: [],
    });
  });

  it("solo salen los datos que se comparan; lo demás (producto, servicio, diferencia…) se queda fuera", async () => {
    const tipos = [
      "producto",
      "servicio",
      "precio",
      "plan",
      "integracion",
      "sector",
      "idioma",
      "canal",
      "limite",
      "diferencia",
      "otro",
    ];
    mock.growthCompetidor.findMany.mockResolvedValue([
      filaDeCompetidor({
        analisis: [
          filaDeAnalisis({
            datos: tipos.map((tipo) =>
              dato({ tipo, valor: undefined, etiqueta: tipo })
            ),
          }),
        ],
      }),
    ]);
    const [fila] = (await pide()).json().data;
    expect(fila.datos.map((d: Fila) => d.tipo)).toEqual([
      "precio",
      "plan",
      "integracion",
      "idioma",
      "canal",
      "limite",
    ]);
  });

  it("un dato viejo (consultado hace más de 30 días) no se vuelve a validar ni se descarta", async () => {
    const viejo = dato({
      consultadoEn: new Date(Date.now() - 200 * 86_400_000).toISOString(),
    });
    mock.growthCompetidor.findMany.mockResolvedValue([
      filaDeCompetidor({ analisis: [filaDeAnalisis({ datos: [viejo] })] }),
    ]);
    const [fila] = (await pide()).json().data;
    expect(fila.datos).toEqual([viejo]);
  });

  it("datosComparables aguanta un JSON que no es lo que debería: nunca un 500", () => {
    expect(datosComparables(null)).toEqual([]);
    expect(datosComparables({ tipo: "precio" })).toEqual([]);
    expect(datosComparables("precio")).toEqual([]);
    expect(
      datosComparables([null, 3, "x", [], {}, { tipo: "inventado" }, dato()])
    ).toEqual([dato()]);
  });

  it("ordena por nombre sin distinguir mayúsculas ni tildes", async () => {
    mock.growthCompetidor.findMany.mockResolvedValue([
      filaDeCompetidor({ id: "c3", nombre: "Retell", dominio: "retell.com" }),
      filaDeCompetidor({ id: "c1", nombre: "HeyDiga", dominio: "heydiga.com" }),
      filaDeCompetidor({ id: "c2", nombre: "fonio", dominio: "fonio.ai" }),
      filaDeCompetidor({ id: "c4", nombre: "Álvaro", dominio: "alvaro.es" }),
    ]);
    const nombres = (await pide()).json().data.map((f: Fila) => f.nombre);
    expect(nombres).toEqual(["Álvaro", "fonio", "HeyDiga", "Retell"]);
  });

  it("un propuesto queda fuera: la consulta pide solo los confirmados", async () => {
    await pide();
    expect(mock.growthCompetidor.findMany).toHaveBeenCalledTimes(1);
    const [args] = mock.growthCompetidor.findMany.mock.calls[0];
    expect(args.where).toEqual(COMPETIDOR_CONFIRMADO);
    expect(args.where).toEqual({ estado: { not: "propuesto" } });
  });

  it("no hay una consulta por competidor: 25 competidores, una sola llamada a la base", async () => {
    mock.growthCompetidor.findMany.mockResolvedValue(
      Array.from({ length: 25 }, (_, i) =>
        filaDeCompetidor({
          id: `c${i}`,
          nombre: `Competidor ${String(i).padStart(2, "0")}`,
          dominio: `competidor${i}.com`,
        })
      )
    );
    const r = await pide();
    expect(r.json().data).toHaveLength(25);
    expect(mock.growthCompetidor.findMany).toHaveBeenCalledTimes(1);
    expect(mock.growthCompetidor.findUnique).not.toHaveBeenCalled();
    expect(mock.growthCompetidorAnalisis.findMany).not.toHaveBeenCalled();
    expect(mock.growthCompetidorAnalisis.findFirst).not.toHaveBeenCalled();
    expect(mock.growthCompetidorAnalisis.groupBy).not.toHaveBeenCalled();
    expect(mock.growthOportunidad.count).not.toHaveBeenCalled();
    // Solo el último análisis de cada uno.
    expect(
      mock.growthCompetidor.findMany.mock.calls[0][0].select.analisis
    ).toMatchObject({ orderBy: { version: "desc" }, take: 1 });
  });

  it("no es el detalle de un competidor llamado «comparador»: la ruta fija gana a /:id", async () => {
    const r = await pide();
    expect(r.statusCode).toBe(200);
    expect(mock.growthCompetidor.findUnique).not.toHaveBeenCalled();
  });

  describe("solo el administrador", () => {
    it("sin sesión: 401", async () => {
      const r = await pide({});
      expect(r.statusCode).toBe(401);
      expect(mock.growthCompetidor.findMany).not.toHaveBeenCalled();
    });

    it("con un token de agente: 401, aunque tenga todos los alcances", async () => {
      mockVerifyIdToken.mockRejectedValue(
        new Error("Wrong number of segments")
      );
      const r = await pide(comoAgente());
      expect(r.statusCode).toBe(401);
      expect(mock.growthCompetidor.findMany).not.toHaveBeenCalled();
    });

    it("con un correo que no es de administrador: 403", async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({ email: "otra@persona.es", email_verified: true }),
      });
      const r = await pide();
      expect(r.statusCode).toBe(403);
      expect(mock.growthCompetidor.findMany).not.toHaveBeenCalled();
    });
  });
});
