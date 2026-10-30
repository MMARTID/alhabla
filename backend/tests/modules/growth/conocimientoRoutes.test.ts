import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify from "fastify";
import { growthRoutes } from "../../../src/modules/growth/routes.js";
import { ErrorDeGrowth } from "../../../src/modules/growth/service.js";
import type { PrismaMock } from "./ayudas.js";
import { TOKEN, comoAgente, registroDeToken } from "./ayudas.js";

const { prismaMock, sincronizarMock } = await vi.hoisted(async () => {
  const { crearPrismaMock } = await import("./ayudas.js");
  const { vi } = await import("vitest");
  return { prismaMock: crearPrismaMock(), sincronizarMock: vi.fn() };
});

vi.mock("../../../src/lib/prisma.js", () => ({ prisma: prismaMock }));
vi.mock("../../../src/modules/growth/conocimiento/sincronizar.js", () => ({
  sincronizarConocimiento: sincronizarMock,
}));

const mock = prismaMock as PrismaMock;

const RUTA = "/growth/agente/conocimiento/sincronizar";
const COMMIT = "a".repeat(40);

function cuerpoValido(cambios: Record<string, unknown> = {}) {
  return {
    commitSha: COMMIT,
    tipos: ["precio", "prohibida"],
    afirmaciones: [
      {
        clave: "precio.plan.pro",
        tipo: "precio",
        texto: "Plan Pro: 139 € + IVA al mes.",
        valor: { cuotaEur: 139 },
        fuente: "web/src/lib/plans.ts#plans-pro",
      },
      {
        clave: "prohibida.proveedores",
        tipo: "prohibida",
        texto: "No se nombra a ningún proveedor.",
        valor: { terminos: ["Telnyx"], palabrasEnteras: true },
        fuente: "growth/agentes/reglas/afirmaciones-prohibidas.md#proveedores",
      },
    ],
    ...cambios,
  };
}

function conAlcances(alcances: string[]) {
  mock.growthTokenAgente.findUnique.mockResolvedValue(
    registroDeToken({ alcances })
  );
}

describe("rutas del conocimiento de Alhabla Growth", () => {
  let fastify: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.resetAllMocks();
    process.env.GROWTH_GOOGLE_CLIENT_ID = "cliente.apps.googleusercontent.com";
    process.env.GROWTH_ADMIN_EMAILS = "admin@alhabla.ai";
    mock.growthTokenAgente.update.mockResolvedValue({});
    mock.growthAjuste.findUnique.mockResolvedValue(null);
    mock.growthAjuste.findMany.mockResolvedValue([]);
    conAlcances(["conocimiento"]);
    sincronizarMock.mockResolvedValue({ sinCambios: true, commitSha: COMMIT });

    fastify = Fastify();
    await fastify.register(growthRoutes);
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe("POST /growth/agente/conocimiento/sincronizar", () => {
    function enviar(
      cuerpo: unknown = cuerpoValido(),
      opciones: { query?: string; headers?: Record<string, string> } = {}
    ) {
      return fastify.inject({
        method: "POST",
        url: `${RUTA}${opciones.query ?? ""}`,
        headers: opciones.headers ?? comoAgente(),
        payload: cuerpo as never,
      });
    }

    it("sin token o con un token que no es de agente, 401 y no se calcula nada", async () => {
      const sin = await fastify.inject({
        method: "POST",
        url: RUTA,
        payload: cuerpoValido() as never,
      });
      expect(sin.statusCode).toBe(401);
      const jwt = await enviar(cuerpoValido(), {
        headers: { authorization: "Bearer eyJhbGciOi.cliente.jwt" },
      });
      expect(jwt.statusCode).toBe(401);
      expect(sincronizarMock).not.toHaveBeenCalled();
    });

    it("un token de agente con leer y escribir NO sincroniza: 403", async () => {
      conAlcances(["leer", "escribir"]);
      const r = await enviar();
      expect(r.statusCode).toBe(403);
      expect(r.json().error).toMatch(/alcance «conocimiento»/);
      expect(sincronizarMock).not.toHaveBeenCalled();
    });

    it("un token revocado, 401", async () => {
      mock.growthTokenAgente.findUnique.mockResolvedValue(
        registroDeToken({ alcances: ["conocimiento"], revocadoEn: new Date() })
      );
      const r = await enviar();
      expect(r.statusCode).toBe(401);
      expect(sincronizarMock).not.toHaveBeenCalled();
    });

    it("el alcance conocimiento sincroniza y firma como el agente del token", async () => {
      sincronizarMock.mockResolvedValue({ sinCambios: false, nuevas: ["x"] });
      const r = await enviar();
      expect(r.statusCode).toBe(200);
      expect(r.json()).toEqual({ sinCambios: false, nuevas: ["x"] });
      const [body, opciones] = sincronizarMock.mock.calls[0];
      expect(body.commitSha).toBe(COMMIT);
      expect(body.afirmaciones).toHaveLength(2);
      expect(opciones).toMatchObject({
        agente: { id: "tok_1", nombre: "agente-semanal" },
        simular: false,
        fuentes: [],
      });
      expect(r.headers["cache-control"]).toBe("no-store");
    });

    it("?simular=true llega como simulación", async () => {
      await enviar(cuerpoValido(), { query: "?simular=true" });
      expect(sincronizarMock.mock.calls[0][1]).toMatchObject({ simular: true });
    });

    it("el agente no puede forzar los cierres masivos: ni por la URL ni por el cuerpo", async () => {
      const porUrl = await enviar(cuerpoValido(), { query: "?forzar=true" });
      expect(porUrl.statusCode).toBe(400);
      const porCuerpo = await enviar(
        cuerpoValido({ forzarCierres: true, forzar: true })
      );
      expect(porCuerpo.statusCode).toBe(400);
      expect(sincronizarMock).not.toHaveBeenCalled();
    });

    it("pasa el rastro de los ficheros leídos, separado del resto del cuerpo", async () => {
      const fuente = {
        ruta: "web/src/lib/plans.ts",
        blobSha: "b".repeat(40),
        commitSha: "c".repeat(40),
      };
      await enviar(cuerpoValido({ fuentes: [fuente] }));
      expect(sincronizarMock.mock.calls[0][1].fuentes).toEqual([fuente]);
      expect(sincronizarMock.mock.calls[0][0]).not.toHaveProperty("fuentes");
    });

    it("un rastro mal formado se rechaza en lugar de guardarse", async () => {
      const r = await enviar(
        cuerpoValido({ fuentes: [{ ruta: "../../etc/passwd", blobSha: "x" }] })
      );
      expect(r.statusCode).toBe(400);
      expect(sincronizarMock).not.toHaveBeenCalled();
    });

    describe("validación (400)", () => {
      it("una prohibida sin lista de términos", async () => {
        const body = cuerpoValido();
        body.afirmaciones[1].valor = { palabrasEnteras: true } as never;
        const r = await enviar(body);
        expect(r.statusCode).toBe(400);
        expect(JSON.stringify(r.json().error)).toMatch(/terminos/);
      });

      it("una prohibida con un término de menos de tres caracteres", async () => {
        const body = cuerpoValido();
        body.afirmaciones[1].valor = {
          terminos: ["IA"],
          palabrasEnteras: true,
        } as never;
        expect((await enviar(body)).statusCode).toBe(400);
      });

      it("una prohibida sin decir si es palabra entera", async () => {
        const body = cuerpoValido();
        body.afirmaciones[1].valor = { terminos: ["Telnyx"] } as never;
        expect((await enviar(body)).statusCode).toBe(400);
      });

      it("una comparativa sin el dominio del competidor", async () => {
        const body = cuerpoValido({ tipos: ["comparativa"] });
        body.afirmaciones = [
          {
            clave: "comparativa.retell-ai.precio",
            tipo: "comparativa",
            texto: "De 0,07 a 0,31 $ por minuto",
            valor: { dato: "x" },
            fuente: "web/src/lib/comparativas.ts#retell",
          },
        ] as never;
        expect((await enviar(body)).statusCode).toBe(400);
      });

      it("una clave cuyo prefijo no es su tipo", async () => {
        const body = cuerpoValido();
        body.afirmaciones[0].clave = "funcion.plan.pro";
        const r = await enviar(body);
        expect(r.statusCode).toBe(400);
        expect(JSON.stringify(r.json().error)).toMatch(/debe empezar por/);
      });

      it("un tipo inventado o una clave con mayúsculas", async () => {
        const body = cuerpoValido();
        body.afirmaciones[0].tipo = "oferta";
        expect((await enviar(body)).statusCode).toBe(400);
        const body2 = cuerpoValido();
        body2.afirmaciones[0].clave = "precio.Plan.Pro";
        expect((await enviar(body2)).statusCode).toBe(400);
      });

      it("una afirmación de un tipo que no está entre los declarados", async () => {
        const body = cuerpoValido({ tipos: ["precio"] });
        expect((await enviar(body)).statusCode).toBe(400);
      });

      it("claves repetidas", async () => {
        const body = cuerpoValido();
        body.afirmaciones.push({ ...body.afirmaciones[0] });
        const r = await enviar(body);
        expect(r.statusCode).toBe(400);
        expect(JSON.stringify(r.json().error)).toMatch(/repetida/);
      });

      it("un cuerpo vacío o sin afirmaciones", async () => {
        expect((await enviar({})).statusCode).toBe(400);
        expect(
          (await enviar({ commitSha: COMMIT, afirmaciones: [] })).statusCode
        ).toBe(400);
      });

      it("un commit que no es un SHA", async () => {
        expect(
          (await enviar(cuerpoValido({ commitSha: "main" }))).statusCode
        ).toBe(400);
      });

      it("una fuente con caracteres raros", async () => {
        const body = cuerpoValido();
        body.afirmaciones[0].fuente = "../../x?token=1";
        expect((await enviar(body)).statusCode).toBe(400);
      });

      it("campos que no existen en el esquema", async () => {
        const body = cuerpoValido();
        (body.afirmaciones[0] as Record<string, unknown>).vigenteHasta =
          "2026-01-01";
        expect((await enviar(body)).statusCode).toBe(400);
      });
    });

    it("con Growth en pausa responde 409 pausa y no sincroniza", async () => {
      mock.growthAjuste.findUnique.mockImplementation(
        async ({ where }: { where: { clave: string } }) =>
          where.clave === "pausa"
            ? { clave: "pausa", valor: true, actualizadoEn: new Date() }
            : null
      );
      const r = await enviar();
      expect(r.statusCode).toBe(409);
      expect(r.json().codigo).toBe("pausa");
      expect(sincronizarMock).not.toHaveBeenCalled();
    });

    it("los errores del servicio llegan con su código y sus datos", async () => {
      sincronizarMock.mockRejectedValue(
        new ErrorDeGrowth(
          409,
          "Se cerrarían 30 afirmaciones.",
          "cierres_masivos",
          {
            cierres: 30,
          }
        )
      );
      const r = await enviar();
      expect(r.statusCode).toBe(409);
      expect(r.json()).toEqual({
        error: "Se cerrarían 30 afirmaciones.",
        codigo: "cierres_masivos",
        cierres: 30,
      });
    });

    it("un fallo inesperado no filtra el mensaje", async () => {
      sincronizarMock.mockRejectedValue(
        new Error("connection refused postgres://usuario:clave@host")
      );
      const r = await enviar();
      expect(r.statusCode).toBe(500);
      expect(r.json()).toEqual({ error: "Error interno." });
    });
  });

  describe("GET /growth/agente/conocimiento", () => {
    it("pide el alcance leer: el de conocimiento solo no basta", async () => {
      conAlcances(["conocimiento"]);
      const r = await fastify.inject({
        method: "GET",
        url: "/growth/agente/conocimiento",
        headers: comoAgente(),
      });
      expect(r.statusCode).toBe(403);
    });

    it("devuelve solo lo vigente, filtrado, con el snapshot", async () => {
      conAlcances(["leer"]);
      mock.growthAfirmacion.findMany.mockResolvedValue([
        {
          clave: "precio.plan.pro",
          tipo: "precio",
          texto: "Plan Pro: 139 € + IVA al mes.",
          valor: null,
          fuente: "web/src/lib/plans.ts#plans-pro",
          commitSha: COMMIT,
          nichoSlug: null,
          vigenteDesde: new Date("2026-10-30T00:00:00Z"),
        },
      ]);
      const r = await fastify.inject({
        method: "GET",
        url: "/growth/agente/conocimiento?tipo=precio&clave=precio.&q=Pro&limite=5",
        headers: comoAgente(TOKEN),
      });
      expect(r.statusCode).toBe(200);
      expect(r.json().data).toHaveLength(1);
      expect(r.json().snapshot).toBeNull();
      expect(mock.growthAfirmacion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            vigenteHasta: null,
            tipo: "precio",
            clave: { startsWith: "precio." },
            OR: [
              { clave: { contains: "Pro", mode: "insensitive" } },
              { texto: { contains: "Pro", mode: "insensitive" } },
            ],
          },
          orderBy: [{ clave: "asc" }, { id: "asc" }],
          // Una de más para saber si queda otra página.
          take: 6,
        })
      );
      expect(r.json()).toMatchObject({ siguiente: null });
    });

    it("rechaza un tipo inventado y un límite fuera de rango", async () => {
      conAlcances(["leer"]);
      const tipo = await fastify.inject({
        method: "GET",
        url: "/growth/agente/conocimiento?tipo=oferta",
        headers: comoAgente(),
      });
      expect(tipo.statusCode).toBe(400);
      const limite = await fastify.inject({
        method: "GET",
        url: "/growth/agente/conocimiento?limite=100000",
        headers: comoAgente(),
      });
      expect(limite.statusCode).toBe(400);
    });
  });
});
