import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify from "fastify";
import type { ZodTypeAny } from "zod";
import { growthRoutes } from "../../../src/modules/growth/routes.js";
import {
  AbrirEjecucionBody,
  AjustesPutBody,
  CerrarEjecucionBody,
  EvaluarBorradorBody,
  OportunidadManualBody,
  PatchBorradorBody,
  RevisionLlmBody,
} from "../../../src/modules/growth/esquemas.js";
import { CalificacionRutaBody } from "../../../src/modules/growth/servicioAgente.js";
import type { PrismaMock } from "./ayudas.js";
import { ADMIN, comoAdmin, comoAgente, registroDeToken } from "./ayudas.js";

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
 * Contratos entre las rutas y quien las usa (el dashboard y el MCP): cada
 * cuerpo de ejemplo se construye como lo construiría el cliente, se pasa por
 * el esquema compartido y por la ruta. Si una ruta dejara de entender lo que
 * dice el esquema (o al revés), esto avisa sin red.
 */

type Quien = "admin" | "agente";

const EJEMPLOS_DE_CUERPOS: {
  nombre: string;
  metodo: "POST" | "PUT" | "PATCH";
  url: string;
  quien: Quien;
  esquema: ZodTypeAny;
  cuerpo: unknown;
}[] = [
  {
    nombre: "añadir una URL a mano",
    metodo: "POST",
    url: "/growth/admin/oportunidades",
    quien: "admin",
    esquema: OportunidadManualBody,
    cuerpo: {
      url: "https://directorio.ejemplo.es/alta",
      objetivoPrincipal: "BACKLINKS",
      titulo: "Directorio de ejemplo",
      nota: "La vi en un grupo",
      nichoSlug: "peluqueria",
    },
  },
  {
    nombre: "editar un borrador",
    metodo: "PATCH",
    url: "/growth/admin/borradores/b1",
    quien: "admin",
    esquema: PatchBorradorBody,
    cuerpo: {
      asunto: "Un asunto",
      texto: "Hola, soy el fundador de Alhabla.",
      enlaceUrl: "https://alhabla.ai/?utm_source=a",
      afirmaciones: ["funcion.reserva_en_calendario"],
      nota: "Retoque",
    },
  },
  {
    nombre: "guardar los ajustes",
    metodo: "PUT",
    url: "/growth/admin/ajustes",
    quien: "admin",
    esquema: AjustesPutBody,
    cuerpo: {
      topeSemanal: 6,
      umbralDeSimilitud: 0.7,
      umbralesPorObjetivo: { TRAFICO_MARCA: 55, LEADS: 60, BACKLINKS: 65 },
      pausa: false,
    },
  },
  {
    nombre: "calificar una oportunidad",
    metodo: "POST",
    url: "/growth/agente/oportunidades/o1/calificacion",
    quien: "agente",
    esquema: CalificacionRutaBody,
    cuerpo: {
      objetivoPrincipal: "BACKLINKS",
      puntTrafico: 30,
      puntLeads: 40,
      puntBacklinks: 80,
      datos: {
        tipoDestino: "directorio",
        enlaceEsperado: "dofollow",
        dificultad: "baja",
      },
    },
  },
  {
    nombre: "evaluar un borrador",
    metodo: "POST",
    url: "/growth/agente/borradores/evaluar",
    quien: "agente",
    esquema: EvaluarBorradorBody,
    cuerpo: {
      oportunidadId: "o1",
      tipo: "email",
      asunto: "Asunto",
      texto: "Hola, soy el fundador de Alhabla.",
      enlaceUrl: "https://alhabla.ai/?utm_source=a",
      afirmaciones: ["funcion.reserva_en_calendario"],
    },
  },
  {
    nombre: "registrar la revisión del modelo",
    metodo: "POST",
    url: "/growth/agente/borradores/b1/revision",
    quien: "agente",
    esquema: RevisionLlmBody,
    cuerpo: {
      comprobaciones: [
        { regla: "tono_cercano", ok: false, detalle: "Algo frío" },
      ],
    },
  },
  {
    nombre: "abrir una ejecución",
    metodo: "POST",
    url: "/growth/agente/ejecuciones",
    quien: "agente",
    esquema: AbrirEjecucionBody,
    cuerpo: {
      disparador: "programada",
      versionPrompts: "0123456789abcdef0123456789abcdef01234567",
      modulos: { discovery: { estado: "omitido" } },
    },
  },
  {
    nombre: "cerrar una ejecución",
    metodo: "POST",
    url: "/growth/agente/ejecuciones/e1/cierre",
    quien: "agente",
    esquema: CerrarEjecucionBody,
    cuerpo: {
      estado: "parcial",
      resumen: {
        candidatas: 10,
        calificadas: 4,
        descartadas: 6,
        descartesPorMotivo: { bajo_umbral: 4, competidor: 2 },
        borradores: 2,
        bloqueadas: 1,
        notas: "Sin incidencias",
      },
      modulos: {
        discovery: {
          estado: "ok",
          inicio: "2026-10-30T05:00:00.000Z",
          fin: "2026-10-30T05:05:00.000Z",
        },
        enlaces: { estado: "error", error: "Sin respuesta" },
      },
      error: "Falló un módulo",
    },
  },
];

const RUTAS_PAGINADAS: [string, Quien][] = [
  ["/growth/admin/oportunidades", "admin"],
  ["/growth/admin/borradores", "admin"],
  ["/growth/admin/decisiones", "admin"],
  ["/growth/admin/gestiones", "admin"],
  ["/growth/admin/ejecuciones", "admin"],
  ["/growth/agente/oportunidades", "agente"],
];

describe("contratos de las rutas de Alhabla Growth", () => {
  let fastify: ReturnType<typeof Fastify>;

  const cabeceras = (quien: Quien) =>
    quien === "admin" ? comoAdmin() : comoAgente();

  beforeEach(async () => {
    vi.resetAllMocks();
    process.env.GROWTH_GOOGLE_CLIENT_ID =
      "cliente-growth.apps.googleusercontent.com";
    process.env.GROWTH_ADMIN_EMAILS = ADMIN;

    mock.$transaction.mockImplementation(
      async (cb: (tx: typeof prismaMock) => unknown) => cb(prismaMock)
    );
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ email: ADMIN, email_verified: true }),
    });
    mock.growthTokenAgente.findUnique.mockResolvedValue(registroDeToken());
    mock.growthTokenAgente.update.mockResolvedValue({});
    // Una base de datos vacía: lo justo para que ninguna ruta se rompa.
    for (const modelo of Object.values(mock)) {
      if (typeof modelo !== "object") continue;
      const m = modelo as Record<
        string,
        { mockResolvedValue?: (v: unknown) => void }
      >;
      m.findMany?.mockResolvedValue?.([]);
      m.groupBy?.mockResolvedValue?.([]);
      m.count?.mockResolvedValue?.(0);
      m.findUnique?.mockResolvedValue?.(null);
      m.findFirst?.mockResolvedValue?.(null);
      m.updateMany?.mockResolvedValue?.({ count: 0 });
    }
    mock.growthTokenAgente.findUnique.mockResolvedValue(registroDeToken());
    // Lo mínimo para que la alta manual del ejemplo (con su nicho) llegue al final.
    mock.growthNicho.findUnique.mockResolvedValue({ id: "n1" });
    mock.growthFuente.upsert.mockResolvedValue({
      id: "fuente_manual",
      tipo: "manual",
      nombre: "Entrada manual",
      activa: true,
    });
    mock.growthOportunidad.create.mockResolvedValue({
      id: "o1",
      estado: "detectada",
      motivoDescarte: null,
    });

    fastify = Fastify();
    await fastify.register(growthRoutes);
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe("el cuerpo de ejemplo de cada ruta", () => {
    for (const ejemplo of EJEMPLOS_DE_CUERPOS) {
      it(`${ejemplo.nombre}: lo acepta el esquema y la ruta lo entiende (no es un 400)`, async () => {
        const analisis = ejemplo.esquema.safeParse(ejemplo.cuerpo);
        expect(
          analisis.success ? [] : analisis.error.issues,
          "el esquema compartido rechaza su propio ejemplo"
        ).toEqual([]);

        const response = await fastify.inject({
          method: ejemplo.metodo,
          url: ejemplo.url,
          headers: cabeceras(ejemplo.quien),
          payload: ejemplo.cuerpo as object,
        });
        // Con una base vacía lo normal es un 404 («no existe»): lo que no
        // puede ser es un 400 (la ruta no entiende el cuerpo), un 401/403
        // (el cliente entra con sus credenciales) ni un 500.
        expect([400, 401, 403, 415, 500]).not.toContain(response.statusCode);
      });

      it(`${ejemplo.nombre}: el mismo cuerpo con un campo sobrante o un tipo cambiado se rechaza`, async () => {
        const sobrante = {
          ...(ejemplo.cuerpo as object),
          camposQueNoExisten: true,
        };
        const analisis = ejemplo.esquema.safeParse(sobrante);
        // Los esquemas estrictos lo rechazan; los demás lo ignoran. En ambos
        // casos la ruta no puede acabar en un 500.
        const response = await fastify.inject({
          method: ejemplo.metodo,
          url: ejemplo.url,
          headers: cabeceras(ejemplo.quien),
          payload: sobrante,
        });
        expect(response.statusCode).not.toBe(500);
        if (!analisis.success) expect(response.statusCode).toBe(400);
      });
    }

    it("los esquemas de escritura rechazan campos que no existen, salvo el de evaluar (que hereda el de crear borrador)", async () => {
      for (const ejemplo of EJEMPLOS_DE_CUERPOS) {
        const analisis = ejemplo.esquema.safeParse({
          ...(ejemplo.cuerpo as object),
          camposQueNoExisten: true,
        });
        // `EvaluarBorradorBody` extiende `BorradorBody`, que no es estricto: un
        // campo sobrante se ignora (no hace daño, no se guarda nada).
        const esperado = ejemplo.nombre === "evaluar un borrador";
        expect(analisis.success, ejemplo.nombre).toBe(esperado);
      }
    });
  });

  describe("los listados comparten la forma { data, total, pagina, limite }", () => {
    for (const [url, quien] of RUTAS_PAGINADAS) {
      it(`${url}`, async () => {
        const response = await fastify.inject({
          method: "GET",
          url: `${url}?pagina=2&limite=10`,
          headers: cabeceras(quien),
        });

        expect(response.statusCode).toBe(200);
        const cuerpo = response.json();
        expect(Array.isArray(cuerpo.data)).toBe(true);
        expect(cuerpo).toMatchObject({ total: 0, pagina: 2, limite: 10 });
        // Un solo formato: nada de arrays desnudos ni `items`/`results`.
        for (const prohibida of ["items", "results", "rows", "count"]) {
          expect(cuerpo, prohibida).not.toHaveProperty(prohibida);
        }
      });
    }

    it("sin parámetros: primera página de 50", async () => {
      for (const [url, quien] of RUTAS_PAGINADAS) {
        const cuerpo = (
          await fastify.inject({
            method: "GET",
            url,
            headers: cabeceras(quien),
          })
        ).json();
        expect(cuerpo, url).toMatchObject({ pagina: 1, limite: 50 });
      }
    });
  });

  describe("los errores comparten formato en todas las rutas", () => {
    it("un 400 de validación es { error: [ZodIssue] } con ruta y mensaje", async () => {
      for (const [url, quien] of RUTAS_PAGINADAS) {
        const response = await fastify.inject({
          method: "GET",
          url: `${url}?pagina=0`,
          headers: cabeceras(quien),
        });
        expect(response.statusCode, url).toBe(400);
        const { error } = response.json();
        expect(Array.isArray(error), url).toBe(true);
        expect(error[0]).toMatchObject({
          path: ["pagina"],
          message: expect.any(String),
        });
        expect(Object.keys(response.json())).toEqual(["error"]);
      }
    });

    it("un 404 de dominio es { error: string }", async () => {
      for (const [url, quien] of [
        ["/growth/admin/borradores/nada", "admin"],
        ["/growth/admin/ejecuciones/nada", "admin"],
        ["/growth/admin/conocimiento/no.existe/historial", "admin"],
        ["/growth/agente/oportunidades/nada", "agente"],
      ] as [string, Quien][]) {
        const response = await fastify.inject({
          method: "GET",
          url,
          headers: cabeceras(quien),
        });
        expect(response.statusCode, url).toBe(404);
        expect(typeof response.json().error, url).toBe("string");
        expect(Object.keys(response.json()), url).toEqual(["error"]);
      }
    });

    it("el 401 de una ruta sin credenciales no dice si la ruta existe ni qué falta", async () => {
      for (const [url] of [...RUTAS_PAGINADAS, ["/growth/admin/yo"]] as [
        string,
      ][]) {
        const response = await fastify.inject({ method: "GET", url });
        expect(response.statusCode, url).toBe(401);
        expect(typeof response.json().error).toBe("string");
      }
    });
  });

  describe("las rutas que existen y las que no", () => {
    it("la API de la 1b no expone nichos, fuentes, tokens ni altas/bajas de competidores", async () => {
      const fuera: [string, string][] = [
        ["GET", "/growth/admin/nichos"],
        ["POST", "/growth/admin/nichos/n1/decision"],
        ["GET", "/growth/admin/fuentes"],
        ["PATCH", "/growth/admin/fuentes/f1"],
        ["GET", "/growth/admin/tokens"],
        ["POST", "/growth/admin/tokens/t1/revocar"],
        ["POST", "/growth/admin/competidores"],
        ["DELETE", "/growth/admin/competidores/c1"],
      ];
      for (const [metodo, url] of fuera) {
        const response = await fastify.inject({
          method: metodo as "GET",
          url,
          headers: comoAdmin(),
          payload: metodo === "GET" || metodo === "DELETE" ? undefined : {},
        });
        expect(response.statusCode, `${metodo} ${url}`).toBe(404);
      }
    });

    it("el agente no tiene ninguna ruta de aprobación, de decisión ni de gestión", async () => {
      for (const url of [
        "/growth/agente/oportunidades/o1/decision",
        "/growth/agente/oportunidades/o1/aprobar",
        "/growth/agente/borradores/b1/aprobar",
        "/growth/agente/borradores/b1/gestion",
        "/growth/agente/ajustes",
      ]) {
        const response = await fastify.inject({
          method: "POST",
          url,
          headers: comoAgente(),
          payload: {},
        });
        expect(response.statusCode, url).toBe(404);
      }
    });

    it("el administrador no entra en las rutas del agente con su ID token (son de token de servicio)", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/growth/agente/oportunidades",
        headers: comoAdmin(),
      });
      expect(response.statusCode).toBe(401);
    });
  });
});
