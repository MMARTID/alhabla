import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify from "fastify";
import growthAuthPlugin from "../../../src/plugins/growthAuth.js";
import { growthRoutes } from "../../../src/modules/growth/routes.js";
import type { PrismaMock } from "./ayudas.js";
import {
  ADMIN,
  TOKEN,
  comoAdmin,
  comoAgente,
  registroDeToken,
} from "./ayudas.js";

/**
 * Lo que es común a todas las rutas de /growth/*: quién entra, que nada se
 * cachea y que todos los errores tienen la misma forma. Las rutas del agente
 * y del administrador, cada una con sus casos, están en routesAgente.test.ts y
 * routesAdmin.test.ts.
 */

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

/** Responde, sin datos, a todo lo que lee el contexto del agente. */
function contextoVacio() {
  mock.growthAjuste.findMany.mockResolvedValue([]);
  mock.growthAjuste.findUnique.mockResolvedValue(null);
  mock.growthAfirmacion.findMany.mockResolvedValue([]);
  mock.growthCompetidor.findMany.mockResolvedValue([]);
  mock.growthNicho.findMany.mockResolvedValue([]);
  mock.growthFuente.findMany.mockResolvedValue([]);
  mock.growthGestion.count.mockResolvedValue(0);
  mock.growthGestion.findMany.mockResolvedValue([]);
  mock.growthOportunidad.count.mockResolvedValue(0);
  mock.growthOportunidad.findMany.mockResolvedValue([]);
}

describe("rutas de Alhabla Growth", () => {
  let fastify: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.resetAllMocks();
    process.env.GROWTH_GOOGLE_CLIENT_ID =
      "cliente-growth.apps.googleusercontent.com";
    process.env.GROWTH_ADMIN_EMAILS = ADMIN;

    mock.$transaction.mockImplementation(
      async (cb: (tx: typeof prismaMock) => unknown) => cb(prismaMock)
    );
    mock.growthTokenAgente.findUnique.mockResolvedValue(registroDeToken());
    mock.growthTokenAgente.update.mockResolvedValue({});
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ email: ADMIN, email_verified: true }),
    });

    fastify = Fastify();
    await fastify.register(growthRoutes);
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe("quién entra", () => {
    it("sin cabecera no entra ni el agente ni el administrador", async () => {
      const agente = await fastify.inject({
        method: "GET",
        url: "/growth/agente/contexto",
      });
      const admin = await fastify.inject({
        method: "GET",
        url: "/growth/admin/oportunidades",
      });
      expect(agente.statusCode).toBe(401);
      expect(admin.statusCode).toBe(401);
    });

    it("un JWT de cliente no abre las rutas del agente y ni toca la base de datos", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/growth/agente/contexto",
        headers: comoAgente("eyJhbGciOiJIUzI1NiJ9.cliente.firma"),
      });
      expect(response.statusCode).toBe(401);
      expect(mock.growthTokenAgente.findUnique).not.toHaveBeenCalled();
    });

    it("un JWT de cliente no abre las rutas del administrador", async () => {
      mockVerifyIdToken.mockRejectedValue(
        new Error("Wrong number of segments")
      );
      const response = await fastify.inject({
        method: "GET",
        url: "/growth/admin/oportunidades",
        headers: { authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.cliente.firma" },
      });
      expect(response.statusCode).toBe(401);
      expect(mock.growthOportunidad.findMany).not.toHaveBeenCalled();
    });

    it("un token de agente no abre las rutas del administrador", async () => {
      mockVerifyIdToken.mockRejectedValue(
        new Error("Wrong number of segments")
      );
      const response = await fastify.inject({
        method: "POST",
        url: "/growth/admin/oportunidades/o1/decision",
        headers: comoAgente(),
        payload: { accion: "aprobar", borradorId: "b1" },
      });
      expect(response.statusCode).toBe(401);
      expect(mock.$transaction).not.toHaveBeenCalled();
    });

    it("un ID token de Google no abre las rutas del agente", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/growth/agente/contexto",
        headers: comoAdmin(),
      });
      expect(response.statusCode).toBe(401);
    });

    it("rechaza un token de agente revocado o desconocido", async () => {
      mock.growthTokenAgente.findUnique.mockResolvedValueOnce(
        registroDeToken({ revocadoEn: new Date() })
      );
      const revocado = await fastify.inject({
        method: "GET",
        url: "/growth/agente/contexto",
        headers: comoAgente(),
      });
      expect(revocado.statusCode).toBe(401);

      mock.growthTokenAgente.findUnique.mockResolvedValueOnce(null);
      const desconocido = await fastify.inject({
        method: "GET",
        url: "/growth/agente/contexto",
        headers: comoAgente(),
      });
      expect(desconocido.statusCode).toBe(401);
    });

    it("un token que solo lee no puede escribir", async () => {
      mock.growthTokenAgente.findUnique.mockResolvedValue(
        registroDeToken({ alcances: ["leer"] })
      );
      const response = await fastify.inject({
        method: "POST",
        url: "/growth/agente/oportunidades",
        headers: comoAgente(),
        payload: {},
      });
      expect(response.statusCode).toBe(403);
      expect(mock.growthOportunidad.create).not.toHaveBeenCalled();
    });

    it("un token que solo escribe no puede leer el contexto", async () => {
      mock.growthTokenAgente.findUnique.mockResolvedValue(
        registroDeToken({ alcances: ["escribir"] })
      );
      const response = await fastify.inject({
        method: "GET",
        url: "/growth/agente/contexto",
        headers: comoAgente(),
      });
      expect(response.statusCode).toBe(403);
    });

    it("un administrador verificado pero fuera de la lista recibe 403", async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({ email: "otra@ejemplo.com", email_verified: true }),
      });
      const response = await fastify.inject({
        method: "GET",
        url: "/growth/admin/oportunidades",
        headers: comoAdmin(),
      });
      expect(response.statusCode).toBe(403);
    });

    it("un correo de la lista pero sin verificar en Google recibe 403", async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({ email: ADMIN, email_verified: false }),
      });
      const response = await fastify.inject({
        method: "GET",
        url: "/growth/admin/oportunidades",
        headers: comoAdmin(),
      });
      expect(response.statusCode).toBe(403);
    });

    it("sin configuración, las rutas de administrador responden 503", async () => {
      delete process.env.GROWTH_ADMIN_EMAILS;
      const response = await fastify.inject({
        method: "GET",
        url: "/growth/admin/oportunidades",
        headers: comoAdmin(),
      });
      expect(response.statusCode).toBe(503);
      expect(mockVerifyIdToken).not.toHaveBeenCalled();
    });

    it("anota el último uso del token si hace mucho que no se anotaba", async () => {
      mock.growthTokenAgente.findUnique.mockResolvedValue(
        registroDeToken({ ultimoUso: new Date(Date.now() - 60 * 60 * 1000) })
      );
      contextoVacio();
      const response = await fastify.inject({
        method: "GET",
        url: "/growth/agente/contexto",
        headers: comoAgente(),
      });
      expect(response.statusCode).toBe(200);
      expect(mock.growthTokenAgente.update).toHaveBeenCalledOnce();
    });

    it("no anota el uso dos veces seguidas", async () => {
      contextoVacio();
      await fastify.inject({
        method: "GET",
        url: "/growth/agente/contexto",
        headers: comoAgente(),
      });
      expect(mock.growthTokenAgente.update).not.toHaveBeenCalled();
    });
  });

  describe("alcance `conocimiento`", () => {
    let app: ReturnType<typeof Fastify>;

    beforeEach(async () => {
      // Ruta de prueba con el alcance nuevo: la real la registra el
      // sincronizador. Lo que se prueba es la puerta.
      app = Fastify();
      await app.register(growthAuthPlugin);
      app.post(
        "/probar/conocimiento",
        { onRequest: app.autenticarAgenteGrowth("conocimiento") },
        async (request) => ({ nombre: request.growthAgente?.nombre })
      );
      app.get(
        "/probar/leer",
        { onRequest: app.autenticarAgenteGrowth("leer") },
        async () => ({ ok: true })
      );
    });

    afterEach(async () => {
      await app.close();
    });

    it("un token [leer, escribir] recibe 403 en una ruta de conocimiento", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/probar/conocimiento",
        headers: comoAgente(),
        payload: {},
      });
      expect(response.statusCode).toBe(403);
      expect(response.json().error).toContain("conocimiento");
    });

    it("un token con el alcance conocimiento entra, y deja su nombre para la auditoría", async () => {
      mock.growthTokenAgente.findUnique.mockResolvedValue(
        registroDeToken({ nombre: "sincronizador", alcances: ["conocimiento"] })
      );
      const response = await app.inject({
        method: "POST",
        url: "/probar/conocimiento",
        headers: comoAgente(),
        payload: {},
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ nombre: "sincronizador" });
    });

    it("el alcance conocimiento no da lectura ni escritura", async () => {
      mock.growthTokenAgente.findUnique.mockResolvedValue(
        registroDeToken({ alcances: ["conocimiento"] })
      );
      const leer = await app.inject({
        method: "GET",
        url: "/probar/leer",
        headers: comoAgente(),
      });
      expect(leer.statusCode).toBe(403);
    });

    it("un token revocado con el alcance sigue sin entrar", async () => {
      mock.growthTokenAgente.findUnique.mockResolvedValue(
        registroDeToken({ alcances: ["conocimiento"], revocadoEn: new Date() })
      );
      const response = await app.inject({
        method: "POST",
        url: "/probar/conocimiento",
        headers: comoAgente(),
        payload: {},
      });
      expect(response.statusCode).toBe(401);
    });

    it("un ID token de Google o un JWT no valen para el alcance conocimiento", async () => {
      for (const authorization of [
        "Bearer id-token-de-google",
        "Bearer eyJhbGciOiJIUzI1NiJ9.cliente.firma",
        TOKEN.replace("gta_", ""),
      ]) {
        const response = await app.inject({
          method: "POST",
          url: "/probar/conocimiento",
          headers: { authorization },
          payload: {},
        });
        expect(response.statusCode).toBe(401);
      }
    });
  });

  describe("sin caché", () => {
    type Escenario = [
      string,
      () => Promise<{ statusCode: number; headers: Record<string, unknown> }>,
    ];

    const escenarios: Escenario[] = [
      [
        "200 del agente",
        async () => {
          contextoVacio();
          return fastify.inject({
            method: "GET",
            url: "/growth/agente/contexto",
            headers: comoAgente(),
          });
        },
      ],
      [
        "201 del agente",
        async () => {
          mock.growthOportunidad.findUnique.mockResolvedValue(null);
          mock.growthAjuste.findUnique.mockResolvedValue(null);
          mock.growthFuente.upsert.mockResolvedValue({
            id: "fuente_web",
            tipo: "web",
            nombre: "Web",
            activa: true,
          });
          mock.growthOportunidad.create.mockResolvedValue({
            id: "o1",
            estado: "detectada",
          });
          return fastify.inject({
            method: "POST",
            url: "/growth/agente/oportunidades",
            headers: comoAgente(),
            payload: {
              url: "https://ejemplo.com/p",
              titulo: "t",
              extracto: "e",
              objetivoPrincipal: "BACKLINKS",
            },
          });
        },
      ],
      [
        "200 del administrador",
        async () => {
          mock.growthOportunidad.findMany.mockResolvedValue([]);
          mock.growthOportunidad.count.mockResolvedValue(0);
          mock.growthOportunidad.groupBy.mockResolvedValue([]);
          return fastify.inject({
            method: "GET",
            url: "/growth/admin/oportunidades",
            headers: comoAdmin(),
          });
        },
      ],
      [
        "400 de validación",
        async () => {
          mock.growthAjuste.findUnique.mockResolvedValue(null);
          return fastify.inject({
            method: "POST",
            url: "/growth/agente/oportunidades",
            headers: comoAgente(),
            payload: {},
          });
        },
      ],
      [
        "401 del agente",
        async () =>
          fastify.inject({ method: "GET", url: "/growth/agente/contexto" }),
      ],
      [
        "401 del administrador",
        async () =>
          fastify.inject({ method: "GET", url: "/growth/admin/oportunidades" }),
      ],
      [
        "403",
        async () => {
          mock.growthTokenAgente.findUnique.mockResolvedValue(
            registroDeToken({ alcances: [] })
          );
          return fastify.inject({
            method: "GET",
            url: "/growth/agente/contexto",
            headers: comoAgente(),
          });
        },
      ],
      [
        "404",
        async () => {
          mock.growthOportunidad.findUnique.mockResolvedValue(null);
          return fastify.inject({
            method: "GET",
            url: "/growth/admin/oportunidades/nada",
            headers: comoAdmin(),
          });
        },
      ],
      [
        "409 de pausa",
        async () => {
          mock.growthAjuste.findUnique.mockResolvedValue({
            clave: "pausa",
            valor: true,
          });
          return fastify.inject({
            method: "POST",
            url: "/growth/agente/oportunidades",
            headers: comoAgente(),
            payload: {},
          });
        },
      ],
      [
        "500",
        async () => {
          mock.growthOportunidad.findUnique.mockRejectedValue(
            new Error("boom")
          );
          return fastify.inject({
            method: "GET",
            url: "/growth/admin/oportunidades/o1",
            headers: comoAdmin(),
          });
        },
      ],
      [
        "503 sin configurar",
        async () => {
          delete process.env.GROWTH_ADMIN_EMAILS;
          return fastify.inject({
            method: "GET",
            url: "/growth/admin/oportunidades",
            headers: comoAdmin(),
          });
        },
      ],
      [
        "JSON mal formado",
        async () =>
          fastify.inject({
            method: "POST",
            url: "/growth/agente/oportunidades",
            headers: { ...comoAgente(), "content-type": "application/json" },
            payload: '{"url": ',
          }),
      ],
    ];

    it.each(escenarios)(
      "%s lleva Cache-Control: no-store",
      async (_nombre, ejecutar) => {
        const response = await ejecutar();
        expect(response.headers["cache-control"]).toBe("no-store");
      }
    );

    it("no hay ETag ni Last-Modified en lo que sale de /growth/*", async () => {
      contextoVacio();
      const response = await fastify.inject({
        method: "GET",
        url: "/growth/agente/contexto",
        headers: comoAgente(),
      });
      expect(response.headers.etag).toBeUndefined();
      expect(response.headers["last-modified"]).toBeUndefined();
    });

    it("lo suyo no se contagia al resto de la API", async () => {
      const raiz = Fastify();
      await raiz.register(growthRoutes);
      raiz.get("/fuera", async () => ({ ok: true }));
      const response = await raiz.inject({ method: "GET", url: "/fuera" });
      expect(response.headers["cache-control"]).toBeUndefined();
      await raiz.close();
    });
  });

  describe("un solo formato de error", () => {
    it("una validación fallida es 400 con la lista de fallos", async () => {
      mock.growthAjuste.findUnique.mockResolvedValue(null);
      const response = await fastify.inject({
        method: "POST",
        url: "/growth/agente/oportunidades",
        headers: comoAgente(),
        payload: { url: "no es una url" },
      });
      expect(response.statusCode).toBe(400);
      const { error } = response.json();
      expect(Array.isArray(error)).toBe(true);
      expect(error[0]).toHaveProperty("path");
      expect(error[0]).toHaveProperty("message");
    });

    it("un error de dominio es `{ error: string }` y, si procede, con un `codigo`", async () => {
      mock.growthOportunidad.findUnique.mockResolvedValue(null);
      const noExiste = await fastify.inject({
        method: "GET",
        url: "/growth/admin/oportunidades/nada",
        headers: comoAdmin(),
      });
      expect(noExiste.statusCode).toBe(404);
      expect(noExiste.json()).toEqual({ error: "La oportunidad no existe." });

      mock.growthAjuste.findUnique.mockResolvedValue({
        clave: "pausa",
        valor: true,
      });
      const pausa = await fastify.inject({
        method: "POST",
        url: "/growth/agente/oportunidades",
        headers: comoAgente(),
        payload: {},
      });
      expect(pausa.json()).toEqual({
        error: "Growth está en pausa.",
        codigo: "pausa",
      });
    });

    it("un fallo interno es 500 con un mensaje fijo: no se filtra el error ni los datos", async () => {
      mock.growthOportunidad.findUnique.mockRejectedValue(
        new Error("connect ECONNREFUSED 10.0.0.5:5432 password=hunter2")
      );
      const response = await fastify.inject({
        method: "GET",
        url: "/growth/admin/oportunidades/o1",
        headers: comoAdmin(),
      });
      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({ error: "Error interno." });
      expect(response.body).not.toContain("hunter2");
      expect(response.body).not.toContain("10.0.0.5");
    });

    it("un error de Prisma que no se esperaba tampoco se filtra", async () => {
      mock.growthOportunidad.findMany.mockRejectedValue(
        Object.assign(
          new Error("Invalid `prisma.growthOportunidad.findMany()`"),
          {
            code: "P2021",
            meta: { table: "growth_oportunidades" },
          }
        )
      );
      const response = await fastify.inject({
        method: "GET",
        url: "/growth/admin/oportunidades",
        headers: comoAdmin(),
      });
      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({ error: "Error interno." });
    });

    it("un JSON mal formado es 400 con `{ error: string }` y no con la forma de Fastify", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/growth/agente/oportunidades",
        headers: { ...comoAgente(), "content-type": "application/json" },
        payload: '{"url": ',
      });
      expect(response.statusCode).toBe(400);
      const cuerpo = response.json();
      expect(typeof cuerpo.error).toBe("string");
      expect(cuerpo).not.toHaveProperty("statusCode");
      expect(cuerpo).not.toHaveProperty("message");
    });

    it("un tipo de contenido que no es JSON es 415 con el mismo formato", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/growth/agente/oportunidades",
        headers: { ...comoAgente(), "content-type": "application/xml" },
        payload: "<a>hola</a>",
      });
      expect(response.statusCode).toBe(415);
      expect(response.json()).toEqual({
        error: "El tipo de contenido no es compatible.",
      });
    });

    it("un cuerpo demasiado grande es 413 con el mismo formato", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/growth/agente/oportunidades",
        headers: { ...comoAgente(), "content-type": "application/json" },
        payload: JSON.stringify({ relleno: "x".repeat(2 * 1024 * 1024) }),
      });
      expect(response.statusCode).toBe(413);
      expect(response.json()).toEqual({
        error: "La petición es demasiado grande.",
      });
    });

    it("los errores de autenticación mantienen su forma `{ error: string }`", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/growth/admin/oportunidades",
      });
      expect(response.json()).toEqual({
        error: "Inicia sesión para continuar.",
      });
    });

    it("un POST sin cuerpo se trata como `{}` y falla la validación, no con un 500", async () => {
      mock.growthAjuste.findUnique.mockResolvedValue(null);
      const response = await fastify.inject({
        method: "POST",
        url: "/growth/agente/oportunidades",
        headers: comoAgente(),
      });
      expect(response.statusCode).toBe(400);
    });
  });
  describe("choques entre transacciones: 409 conflicto, nunca 500", () => {
    const decision = () =>
      fastify.inject({
        method: "POST",
        url: "/growth/admin/oportunidades/o1/decision",
        headers: comoAdmin(),
        payload: { accion: "aprobar", borradorId: "b1" },
      });

    it.each([
      [
        "un deadlock de Postgres (40P01) que llega en el mensaje",
        Object.assign(
          new Error(
            "Invalid `prisma.growthBorrador.updateMany()` invocation: ... deadlock detected (SQLSTATE 40P01)"
          ),
          {
            code: "P2010",
            meta: { code: "40P01", message: "deadlock detected" },
          }
        ),
      ],
      [
        "el código de Prisma P2034 (conflicto de escritura o deadlock)",
        Object.assign(new Error("Transaction failed due to a write conflict"), {
          code: "P2034",
        }),
      ],
      [
        "un fallo de serialización (40001)",
        Object.assign(new Error("could not serialize access"), {
          meta: { code: "40001" },
        }),
      ],
      [
        "una transacción que no llegó a tiempo (P2028)",
        Object.assign(new Error("Transaction API error: timeout"), {
          code: "P2028",
        }),
      ],
      [
        "solo el texto 40P01 en el mensaje",
        new Error("ERROR: 40P01 deadlock detected"),
      ],
    ])("%s", async (_nombre, error) => {
      mock.$transaction.mockRejectedValue(error);
      const response = await decision();
      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({
        error:
          "Otra operación estaba cambiando lo mismo. Vuelve a cargarlo y repítelo.",
        codigo: "conflicto",
      });
    });

    it("un error cualquiera de la base de datos sigue siendo un 500 sin filtrar el mensaje", async () => {
      mock.$transaction.mockRejectedValue(
        Object.assign(new Error('relation "x" does not exist'), {
          code: "P2021",
        })
      );
      const response = await decision();
      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({ error: "Error interno." });
    });
  });
});
