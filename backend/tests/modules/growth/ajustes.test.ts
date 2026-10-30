import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify from "fastify";
import { growthRoutes } from "../../../src/modules/growth/routes.js";
import type { PrismaMock } from "./ayudas.js";
import { ADMIN, comoAdmin } from "./ayudas.js";

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

type Fila = { clave: string; valor: unknown; actualizadoEn: Date };

describe("ajustes de Alhabla Growth", () => {
  let fastify: ReturnType<typeof Fastify>;
  /** Un `growth_ajustes` de verdad, en memoria: así se ve lo que devuelve el PUT. */
  let almacen: Map<string, Fila>;

  function ver() {
    return fastify.inject({
      method: "GET",
      url: "/growth/admin/ajustes",
      headers: comoAdmin(),
    });
  }

  function guardar(payload: unknown) {
    return fastify.inject({
      method: "PUT",
      url: "/growth/admin/ajustes",
      headers: comoAdmin(),
      payload: payload as object,
    });
  }

  beforeEach(async () => {
    vi.resetAllMocks();
    process.env.GROWTH_GOOGLE_CLIENT_ID =
      "cliente-growth.apps.googleusercontent.com";
    process.env.GROWTH_ADMIN_EMAILS = ADMIN;

    almacen = new Map();
    mock.growthAjuste.findMany.mockImplementation(
      async ({ where }: { where: { clave: { in: string[] } } }) =>
        [...almacen.values()].filter((f) => where.clave.in.includes(f.clave))
    );
    mock.growthAjuste.upsert.mockImplementation(
      async ({
        where,
        create,
        update,
      }: {
        where: { clave: string };
        create: { clave: string; valor: unknown };
        update: { valor: unknown };
      }) => {
        const fila: Fila = {
          clave: where.clave,
          valor: almacen.has(where.clave) ? update.valor : create.valor,
          actualizadoEn: new Date(),
        };
        almacen.set(where.clave, fila);
        return fila;
      }
    );
    mock.growthDecision.create.mockResolvedValue({});
    mock.$transaction.mockImplementation(
      async (cb: (tx: typeof prismaMock) => unknown) => cb(prismaMock)
    );
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ email: ADMIN, email_verified: true }),
    });

    fastify = Fastify();
    await fastify.register(growthRoutes);
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe("GET", () => {
    it("sin nada guardado enseña los valores por defecto, los límites y lo que no se edita", async () => {
      const response = await ver();

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        valores: {
          topeSemanal: 5,
          umbralDeSimilitud: 0.6,
          umbralesPorObjetivo: { TRAFICO_MARCA: 60, LEADS: 60, BACKLINKS: 60 },
          pausa: false,
        },
        porDefecto: {
          topeSemanal: 5,
          umbralDeSimilitud: 0.6,
          umbralesPorObjetivo: { TRAFICO_MARCA: 60, LEADS: 60, BACKLINKS: 60 },
          pausa: false,
        },
        actualizadoEn: {
          topeSemanal: null,
          umbralDeSimilitud: null,
          umbralesPorObjetivo: null,
          pausa: null,
        },
        limites: {
          topeSemanal: [0, 20],
          umbralDeSimilitud: [0.4, 0.9],
          umbralesPorObjetivo: [0, 100],
        },
        soloLectura: {
          retencionDias: 180,
          diasEntreContactosAlMismoDominio: 90,
        },
      });
    });

    it("mezcla lo guardado con los valores por defecto y dice cuándo se guardó cada cosa", async () => {
      const cuando = new Date("2026-10-20T10:00:00.000Z");
      almacen.set("topeSemanal", {
        clave: "topeSemanal",
        valor: 8,
        actualizadoEn: cuando,
      });
      almacen.set("pausa", {
        clave: "pausa",
        valor: true,
        actualizadoEn: cuando,
      });
      const cuerpo = (await ver()).json();

      expect(cuerpo.valores).toMatchObject({
        topeSemanal: 8,
        umbralDeSimilitud: 0.6,
        pausa: true,
      });
      expect(cuerpo.actualizadoEn.topeSemanal).toBe(cuando.toISOString());
      expect(cuerpo.actualizadoEn.umbralDeSimilitud).toBeNull();
      // Los valores por defecto no se mueven aunque haya algo guardado.
      expect(cuerpo.porDefecto.topeSemanal).toBe(5);
    });

    it("un valor guardado fuera de rango (alguien tocó la base) no se aplica: se enseña el de por defecto", async () => {
      const aviso = vi.spyOn(console, "error").mockImplementation(() => {});
      almacen.set("topeSemanal", {
        clave: "topeSemanal",
        valor: 500,
        actualizadoEn: new Date(),
      });
      almacen.set("umbralDeSimilitud", {
        clave: "umbralDeSimilitud",
        valor: 1,
        actualizadoEn: new Date(),
      });
      const cuerpo = (await ver()).json();

      expect(cuerpo.valores.topeSemanal).toBe(5);
      expect(cuerpo.valores.umbralDeSimilitud).toBe(0.6);
      aviso.mockRestore();
    });

    it("nunca enseña las claves del sistema (el snapshot del conocimiento)", async () => {
      almacen.set("sistema.conocimiento", {
        clave: "sistema.conocimiento",
        valor: { commitSha: "abc1234" },
        actualizadoEn: new Date(),
      });
      const texto = JSON.stringify((await ver()).json());
      expect(texto).not.toContain("sistema.conocimiento");
      expect(texto).not.toContain("abc1234");
      const claves =
        mock.growthAjuste.findMany.mock.calls[0]![0].where.clave.in;
      expect(claves).toEqual([
        "topeSemanal",
        "umbralDeSimilitud",
        "umbralesPorObjetivo",
        "pausa",
      ]);
    });
  });

  describe("PUT", () => {
    it("guarda lo que viene y devuelve los ajustes ya actualizados", async () => {
      const response = await guardar({
        topeSemanal: 8,
        umbralDeSimilitud: 0.75,
        umbralesPorObjetivo: { TRAFICO_MARCA: 50, LEADS: 65, BACKLINKS: 70 },
        pausa: true,
      });

      expect(response.statusCode).toBe(200);
      const cuerpo = response.json();
      expect(cuerpo.valores).toEqual({
        topeSemanal: 8,
        umbralDeSimilitud: 0.75,
        umbralesPorObjetivo: { TRAFICO_MARCA: 50, LEADS: 65, BACKLINKS: 70 },
        pausa: true,
      });
      expect(cuerpo.actualizadoEn.topeSemanal).toBeTruthy();
      expect(almacen.get("topeSemanal")!.valor).toBe(8);
      expect(almacen.get("pausa")!.valor).toBe(true);
    });

    it("solo toca las claves que vienen: las demás conservan lo que tenían", async () => {
      almacen.set("topeSemanal", {
        clave: "topeSemanal",
        valor: 3,
        actualizadoEn: new Date(),
      });
      await guardar({ pausa: true });

      expect(almacen.get("topeSemanal")!.valor).toBe(3);
      expect(mock.growthAjuste.upsert).toHaveBeenCalledOnce();
      expect(mock.growthAjuste.upsert.mock.calls[0]![0].where).toEqual({
        clave: "pausa",
      });
    });

    it("cada cambio deja UNA fila en el historial con «clave: antes -> después», firmada con tu correo", async () => {
      await guardar({ topeSemanal: 8, pausa: true });

      expect(mock.growthDecision.create).toHaveBeenCalledOnce();
      const { data } = mock.growthDecision.create.mock.calls[0]![0];
      expect(data).toEqual({
        accion: "ajustes",
        motivo: "topeSemanal: 5 -> 8; pausa: false -> true",
        por: ADMIN,
      });
      // Los ajustes no cuelgan de ninguna oportunidad.
      expect(data.oportunidadId).toBeUndefined();
    });

    it("el «antes» del historial es lo que valía de verdad (lo guardado, no el valor por defecto)", async () => {
      almacen.set("topeSemanal", {
        clave: "topeSemanal",
        valor: 3,
        actualizadoEn: new Date(),
      });
      await guardar({ topeSemanal: 12 });
      expect(mock.growthDecision.create.mock.calls[0]![0].data.motivo).toBe(
        "topeSemanal: 3 -> 12"
      );
    });

    it("los umbrales por objetivo se escriben siempre con las claves en el mismo orden", async () => {
      await guardar({
        umbralesPorObjetivo: { BACKLINKS: 70, LEADS: 65, TRAFICO_MARCA: 50 },
      });
      expect(
        Object.keys(almacen.get("umbralesPorObjetivo")!.valor as object)
      ).toEqual(["TRAFICO_MARCA", "LEADS", "BACKLINKS"]);
      expect(mock.growthDecision.create.mock.calls[0]![0].data.motivo).toBe(
        'umbralesPorObjetivo: {"TRAFICO_MARCA":60,"LEADS":60,"BACKLINKS":60} -> {"TRAFICO_MARCA":50,"LEADS":65,"BACKLINKS":70}'
      );
    });

    it("repetir lo mismo no ensucia el historial ni reescribe la fila (idempotente)", async () => {
      await guardar({ topeSemanal: 8 });
      mock.growthDecision.create.mockClear();
      mock.growthAjuste.upsert.mockClear();

      const otra = await guardar({ topeSemanal: 8 });

      expect(otra.statusCode).toBe(200);
      expect(otra.json().valores.topeSemanal).toBe(8);
      expect(mock.growthAjuste.upsert).not.toHaveBeenCalled();
      expect(mock.growthDecision.create).not.toHaveBeenCalled();
    });

    it("si solo cambia una de dos claves, solo esa queda en el historial", async () => {
      await guardar({ topeSemanal: 8, pausa: false });
      // `pausa: false` valía lo mismo que por defecto, pero no había fila: se guarda.
      expect(
        mock.growthDecision.create.mock.calls[0]![0].data.motivo
      ).toContain("topeSemanal: 5 -> 8");
      mock.growthDecision.create.mockClear();

      await guardar({ topeSemanal: 8, pausa: true });
      expect(mock.growthDecision.create.mock.calls[0]![0].data.motivo).toBe(
        "pausa: false -> true"
      );
    });

    it("un valor corrupto guardado se sustituye aunque el nuevo valor sea el de por defecto", async () => {
      const aviso = vi.spyOn(console, "error").mockImplementation(() => {});
      almacen.set("topeSemanal", {
        clave: "topeSemanal",
        valor: "muchos",
        actualizadoEn: new Date(),
      });
      await guardar({ topeSemanal: 5 });
      expect(almacen.get("topeSemanal")!.valor).toBe(5);
      aviso.mockRestore();
    });

    it("todo ocurre en una transacción", async () => {
      await guardar({ topeSemanal: 8, pausa: true });
      expect(mock.$transaction).toHaveBeenCalledOnce();
    });

    describe("rechaza lo que no es un ajuste", () => {
      const casos: [string, unknown][] = [
        ["cuerpo vacío", {}],
        ["una clave desconocida", { colorFavorito: "morado" }],
        [
          "una clave del sistema",
          { "sistema.conocimiento": { commitSha: "x" } },
        ],
        [
          "una clave del sistema junto a una válida",
          { topeSemanal: 6, "sistema.otra": 1 },
        ],
        ["tope por encima del máximo", { topeSemanal: 21 }],
        ["tope negativo", { topeSemanal: -1 }],
        ["tope decimal", { topeSemanal: 2.5 }],
        ["tope como texto", { topeSemanal: "8" }],
        ["similitud por debajo del aviso (0,4)", { umbralDeSimilitud: 0.39 }],
        ["similitud 1 (desactivaría la regla)", { umbralDeSimilitud: 1 }],
        ["umbrales a medias", { umbralesPorObjetivo: { LEADS: 60 } }],
        [
          "umbral fuera de 0-100",
          {
            umbralesPorObjetivo: {
              TRAFICO_MARCA: 101,
              LEADS: 60,
              BACKLINKS: 60,
            },
          },
        ],
        [
          "un objetivo que no existe",
          {
            umbralesPorObjetivo: {
              TRAFICO_MARCA: 60,
              LEADS: 60,
              BACKLINKS: 60,
              FAMA: 60,
            },
          },
        ],
        ["pausa que no es booleano", { pausa: "si" }],
      ];

      for (const [nombre, cuerpo] of casos) {
        it(`${nombre}: 400 y no escribe nada`, async () => {
          const response = await guardar(cuerpo);
          expect(response.statusCode).toBe(400);
          expect(Array.isArray(response.json().error)).toBe(true);
          expect(mock.growthAjuste.upsert).not.toHaveBeenCalled();
          expect(mock.growthDecision.create).not.toHaveBeenCalled();
        });
      }

      it("los extremos permitidos sí valen", async () => {
        for (const cuerpo of [
          { topeSemanal: 0 },
          { topeSemanal: 20 },
          { umbralDeSimilitud: 0.4 },
          { umbralDeSimilitud: 0.9 },
          {
            umbralesPorObjetivo: {
              TRAFICO_MARCA: 0,
              LEADS: 100,
              BACKLINKS: 50,
            },
          },
        ]) {
          const response = await guardar(cuerpo);
          expect(response.statusCode, JSON.stringify(cuerpo)).toBe(200);
        }
      });
    });

    it("el mensaje de una clave del sistema dice que no se edita", async () => {
      const response = await guardar({ "sistema.conocimiento": 1 });
      expect(JSON.stringify(response.json())).toContain("clave del sistema");
    });
  });

  describe("acceso", () => {
    it("un token de agente no cambia los ajustes (ni la pausa): solo el administrador", async () => {
      mockVerifyIdToken.mockRejectedValue(
        new Error("Wrong number of segments")
      );
      const response = await fastify.inject({
        method: "PUT",
        url: "/growth/admin/ajustes",
        headers: { authorization: "Bearer gta_token-de-agente" },
        payload: { pausa: false },
      });
      expect(response.statusCode).toBe(401);
      expect(mock.growthAjuste.upsert).not.toHaveBeenCalled();
    });

    it("un correo fuera de la lista da 403 en GET y PUT", async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({ email: "otro@ejemplo.com", email_verified: true }),
      });
      for (const metodo of ["GET", "PUT"] as const) {
        const response = await fastify.inject({
          method: metodo,
          url: "/growth/admin/ajustes",
          headers: comoAdmin(),
          payload: metodo === "PUT" ? { pausa: true } : undefined,
        });
        expect(response.statusCode, metodo).toBe(403);
      }
      expect(mock.growthAjuste.upsert).not.toHaveBeenCalled();
    });
  });
});
