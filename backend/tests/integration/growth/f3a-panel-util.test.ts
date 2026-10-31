import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";
import Fastify from "fastify";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../src/lib/prisma.js";
import { growthRoutes } from "../../../src/modules/growth/routes.js";
import { TAREAS_INICIALES } from "../../../src/modules/growth/tareasIniciales.js";
import { CLAVES_DE_LA_FICHA } from "../../../src/modules/growth/fichaDeAlhabla.js";
import { generarTokenDeAgente } from "../../../src/modules/growth/tokens.js";
import {
  construirAfirmaciones,
  type ResultadoDeConstruccion,
} from "../../../mcp/growth/conocimiento/construir.js";
import { cargarEntrada } from "../../../mcp/growth/conocimiento/entrada.js";
import { hace, limpiarGrowth } from "./ayudas.js";

const { mockVerifyIdToken } = vi.hoisted(() => ({
  mockVerifyIdToken: vi.fn(),
}));

vi.mock("google-auth-library", () => ({
  OAuth2Client: vi.fn(function OAuth2ClientMock() {
    return { verifyIdToken: mockVerifyIdToken };
  }),
}));

/**
 * Panel útil contra Postgres real: lo que el Prisma de mentira no puede
 * probar. El comparador (sin los `propuesto`, solo el último análisis, sin una
 * consulta por competidor), la Ficha de Alhabla con la base de conocimiento
 * real del repo, la tabla de tareas (valores por defecto, índice único de la
 * siembra), la siembra en paralelo sin duplicados ni 500 y las transiciones
 * atómicas con peticiones a la vez.
 */

const ADMIN = "admin@alhabla.ai";
const ID_TOKEN = "id-token-de-google";
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const hayRepo =
  existsSync(join(RAIZ, "PRODUCT.md")) &&
  existsSync(join(RAIZ, "web", "src", "lib", "plans.ts"));

type Respuesta = { statusCode: number; json: () => any; body: string };
type Fila = Record<string, any>;

const datoDe = (cambios: Fila = {}) => ({
  tipo: "precio",
  etiqueta: "Plan Pro",
  texto: "99 € al mes con 500 minutos",
  valor: { importe: 99, moneda: "EUR", periodo: "mes", ivaIncluido: false },
  urlFuente: "https://rival.com/precios",
  consultadoEn: new Date().toISOString(),
  ...cambios,
});

describe("panel útil contra Postgres real", () => {
  let fastify: ReturnType<typeof Fastify>;

  const comoAdmin = () => ({ authorization: `Bearer ${ID_TOKEN}` });
  const admin = (
    method: "GET" | "POST" | "PATCH" | "DELETE",
    url: string,
    payload?: unknown
  ): Promise<Respuesta> =>
    fastify.inject({
      method,
      url,
      headers: comoAdmin(),
      payload: payload as object | undefined,
    });

  beforeAll(async () => {
    process.env.GROWTH_GOOGLE_CLIENT_ID =
      "cliente-growth.apps.googleusercontent.com";
    process.env.GROWTH_ADMIN_EMAILS = ADMIN;
    fastify = Fastify();
    await fastify.register(growthRoutes);
  });

  beforeEach(async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    mockVerifyIdToken.mockImplementation(
      async ({ idToken }: { idToken: string }) => {
        if (idToken !== ID_TOKEN) throw new Error("Wrong number of segments");
        return { getPayload: () => ({ email: ADMIN, email_verified: true }) };
      }
    );
    await limpiarGrowth();
  });

  afterAll(async () => {
    await fastify.close();
    await limpiarGrowth();
  });

  // ── Comparador ──────────────────────────────────────────────────────────

  describe("comparador de precios", () => {
    async function competidor(
      nombre: string,
      dominio: string,
      estado: string,
      origen = "manual"
    ) {
      return prisma.growthCompetidor.create({
        data: { nombre, dominio, estado, origen, url: `https://${dominio}/` },
      });
    }

    async function analisis(
      competidorId: string,
      version: number,
      datos: unknown[],
      cambios: Partial<{ creadoEn: Date; revisadoEn: Date | null }> = {}
    ) {
      return prisma.growthCompetidorAnalisis.create({
        data: {
          competidorId,
          version,
          resumen: `Versión ${version}`,
          datos: datos as Prisma.InputJsonValue,
          creadoPor: "agente-semanal",
          ...cambios,
        },
      });
    }

    it("sin competidores: lista vacía", async () => {
      const r = await admin("GET", "/growth/admin/competidores/comparador");
      expect(r.statusCode).toBe(200);
      expect(r.json()).toEqual({ data: [], generadoEn: expect.any(String) });
    });

    it("un propuesto no sale, aunque tenga análisis; los demás, por nombre", async () => {
      const heydiga = await competidor(
        "HeyDiga",
        "heydiga.com",
        "revisado",
        "repo"
      );
      const fonio = await competidor(
        "fonio",
        "fonio.ai",
        "por_analizar",
        "repo"
      );
      const propuesto = await competidor(
        "Zeta",
        "zeta.com",
        "propuesto",
        "agente"
      );
      await analisis(heydiga.id, 1, [datoDe()]);
      await analisis(propuesto.id, 1, [datoDe()]);

      const r = await admin("GET", "/growth/admin/competidores/comparador");
      const filas = r.json().data as Fila[];
      expect(filas.map((f) => f.nombre)).toEqual(["fonio", "HeyDiga"]);
      expect(filas.map((f) => f.competidorId)).not.toContain(propuesto.id);
      expect(filas.map((f) => f.competidorId)).toEqual([fonio.id, heydiga.id]);
      expect(filas.find((f) => f.nombre === "fonio")).toMatchObject({
        estado: "por_analizar",
        analisis: null,
        datos: [],
        origen: "repo",
        url: "https://fonio.ai/",
      });
    });

    it("un propuesto que se acepta pasa a salir", async () => {
      const c = await competidor("Nuevo", "nuevo.com", "propuesto", "agente");
      const antes = (
        await admin("GET", "/growth/admin/competidores/comparador")
      ).json();
      expect(antes.data).toHaveLength(0);
      const aceptado = await admin(
        "POST",
        `/growth/admin/competidores/${c.id}/aceptar`
      );
      expect(aceptado.statusCode).toBe(200);
      const despues = (
        await admin("GET", "/growth/admin/competidores/comparador")
      ).json();
      expect(despues.data.map((f: Fila) => f.dominio)).toEqual(["nuevo.com"]);
    });

    it("solo el último análisis de cada uno, con sus datos comparables, y caducado a los 90 días", async () => {
      const rival = await competidor("Rival", "rival.com", "analizado");
      await analisis(rival.id, 1, [datoDe({ etiqueta: "VIEJO" })], {
        creadoEn: hace(200),
      });
      await analisis(
        rival.id,
        2,
        [
          datoDe({ etiqueta: "Plan Pro" }),
          datoDe({ tipo: "producto", etiqueta: "Qué es", valor: undefined }),
          datoDe({
            tipo: "integracion",
            etiqueta: "Google Calendar",
            valor: undefined,
          }),
          datoDe({ tipo: "diferencia", etiqueta: "Nota", valor: undefined }),
        ],
        { creadoEn: hace(100) }
      );
      const fresco = await competidor("Fresco", "fresco.com", "revisado");
      await analisis(fresco.id, 1, [datoDe()], {
        creadoEn: hace(5),
        revisadoEn: hace(4),
      });

      const filas = (
        await admin("GET", "/growth/admin/competidores/comparador")
      ).json().data as Fila[];
      const filaDe = (nombre: string) =>
        filas.find((f) => f.nombre === nombre)!;

      expect(filaDe("Rival").analisis).toMatchObject({
        id: expect.any(String),
        version: 2,
        caducado: true,
        revisadoEn: null,
      });
      expect(filaDe("Rival").datos.map((d: Fila) => d.etiqueta)).toEqual([
        "Plan Pro",
        "Google Calendar",
      ]);
      expect(filaDe("Fresco").analisis).toMatchObject({
        version: 1,
        caducado: false,
        revisadoEn: expect.any(String),
      });
      expect(filaDe("Fresco").datos).toHaveLength(1);
      expect(filaDe("Fresco").datos[0]).toMatchObject({
        tipo: "precio",
        valor: { importe: 99, moneda: "EUR", periodo: "mes" },
        urlFuente: "https://rival.com/precios",
      });
    });

    it("30 competidores con 3 versiones cada uno: a cada uno le toca su última versión y solo sus datos", async () => {
      for (let i = 0; i < 30; i++) {
        const c = await competidor(
          `Competidor ${String(i).padStart(2, "0")}`,
          `competidor${i}.com`,
          "analizado"
        );
        for (let v = 1; v <= 3; v++) {
          await analisis(c.id, v, [datoDe({ etiqueta: `v${v}` })]);
        }
      }
      const r = await admin("GET", "/growth/admin/competidores/comparador");
      const filas = r.json().data as Fila[];
      expect(filas).toHaveLength(30);
      for (const f of filas) {
        expect(f.analisis.version).toBe(3);
        expect(f.datos.map((d: Fila) => d.etiqueta)).toEqual(["v3"]);
      }
    });
  });

  // ── Ficha de Alhabla ────────────────────────────────────────────────────

  describe.skipIf(!hayRepo)(
    "Ficha de Alhabla con la base de conocimiento real",
    () => {
      let resultado: ResultadoDeConstruccion;
      const SHA = "0123456789abcdef0123456789abcdef01234567";

      beforeAll(async () => {
        resultado = construirAfirmaciones(await cargarEntrada(RAIZ));
      }, 30_000);

      async function sembrarConocimiento(opciones: { sin?: string[] } = {}) {
        await prisma.growthAfirmacion.createMany({
          data: resultado.afirmaciones
            .filter((a) => !(opciones.sin ?? []).includes(a.clave))
            .map((a) => ({
              clave: a.clave,
              tipo: a.tipo,
              texto: a.texto,
              valor: (a.valor ?? undefined) as
                Prisma.InputJsonValue | undefined,
              fuente: a.fuente,
              commitSha: SHA,
              nichoSlug: a.nichoSlug ?? null,
            })),
        });
        await prisma.growthAjuste.upsert({
          where: { clave: "sistema.conocimiento" },
          create: {
            clave: "sistema.conocimiento",
            valor: { commitSha: SHA, vigentes: resultado.afirmaciones.length },
          },
          update: {
            valor: { commitSha: SHA, vigentes: resultado.afirmaciones.length },
          },
        });
      }

      const campoDe = (cuerpo: Fila, clave: string): Fila =>
        cuerpo.campos.find((c: Fila) => c.clave === clave);

      it("completa: los ocho campos con texto, sin faltas ni avisos, con el commit sincronizado", async () => {
        await sembrarConocimiento();
        const r = await admin("GET", "/growth/admin/ficha-de-alhabla");
        expect(r.statusCode).toBe(200);
        expect(r.headers).toMatchObject({ "cache-control": "no-store" });
        const cuerpo = r.json();
        expect(cuerpo.commit).toBe(SHA);
        expect(cuerpo.sincronizadaEn).toEqual(expect.any(String));
        expect(cuerpo.avisos).toEqual([]);
        expect(cuerpo.campos.map((c: Fila) => c.clave)).toEqual([
          "nombre",
          "web",
          "descripcion_corta",
          "descripcion_larga",
          "precios",
          "prueba",
          "idiomas",
          "categorias",
        ]);
        for (const c of cuerpo.campos) {
          expect(c.texto, c.clave).toEqual(expect.any(String));
          expect(c.faltan, c.clave).toEqual([]);
        }
        expect(campoDe(cuerpo, "precios").texto).toContain("\n");
        expect(
          campoDe(cuerpo, "descripcion_corta").texto.length
        ).toBeLessThanOrEqual(160);
        expect(
          campoDe(cuerpo, "descripcion_larga").texto.length
        ).toBeLessThanOrEqual(1000);
        // Solo cita claves que existen de verdad en la base.
        const citadas = cuerpo.campos.flatMap((c: Fila) => c.afirmaciones);
        expect(citadas.length).toBeGreaterThan(10);
        const enLaBase = await prisma.growthAfirmacion.findMany({
          where: { clave: { in: citadas }, vigenteHasta: null },
          select: { clave: true },
        });
        expect(new Set(enLaBase.map((a) => a.clave))).toEqual(new Set(citadas));
      });

      it("todas las claves de la ficha existen en lo que sincroniza el repo", () => {
        const claves = new Set(resultado.afirmaciones.map((a) => a.clave));
        expect(CLAVES_DE_LA_FICHA.filter((c) => !claves.has(c))).toEqual([]);
      });

      it("una afirmación cerrada (ya no vigente) cuenta como que falta, y el resto sigue", async () => {
        await sembrarConocimiento();
        await prisma.growthAfirmacion.updateMany({
          where: { clave: "precio.plan.pro" },
          data: { vigenteHasta: new Date() },
        });
        const cuerpo = (
          await admin("GET", "/growth/admin/ficha-de-alhabla")
        ).json();
        expect(campoDe(cuerpo, "precios")).toMatchObject({
          texto: null,
          faltan: ["precio.plan.pro"],
        });
        expect(campoDe(cuerpo, "prueba").texto).toEqual(expect.any(String));
      });

      it("con dos vigentes de la misma clave gana la más reciente", async () => {
        await sembrarConocimiento({ sin: ["precio.prueba"] });
        await prisma.growthAfirmacion.create({
          data: {
            clave: "precio.prueba",
            tipo: "precio",
            texto: "La vieja.",
            fuente: "x#y",
            commitSha: SHA,
            vigenteDesde: hace(10),
          },
        });
        await prisma.growthAfirmacion.create({
          data: {
            clave: "precio.prueba",
            tipo: "precio",
            texto: "La nueva.",
            fuente: "x#y",
            commitSha: SHA,
            vigenteDesde: hace(1),
          },
        });
        const cuerpo = (
          await admin("GET", "/growth/admin/ficha-de-alhabla")
        ).json();
        expect(campoDe(cuerpo, "prueba").texto).toBe("La nueva.");
      });

      it("un término prohibido vigente en un texto de la ficha: aviso, y el campo se devuelve igualmente", async () => {
        await sembrarConocimiento({ sin: ["precio.prueba"] });
        await prisma.growthAfirmacion.create({
          data: {
            clave: "precio.prueba",
            tipo: "precio",
            texto: "7 días de prueba con ZorgonTel incluido.",
            fuente: "x#y",
            commitSha: SHA,
          },
        });
        await prisma.growthAfirmacion.create({
          data: {
            clave: "prohibida.zorgontel",
            tipo: "prohibida",
            texto: "No se nombra a ZorgonTel.",
            valor: { terminos: ["ZorgonTel"], palabrasEnteras: true },
            fuente: "x#y",
            commitSha: SHA,
          },
        });
        const cuerpo = (
          await admin("GET", "/growth/admin/ficha-de-alhabla")
        ).json();
        expect(campoDe(cuerpo, "prueba").texto).toContain("ZorgonTel");
        expect(cuerpo.avisos).toEqual([
          "El campo «Prueba y permanencia» contiene términos que no se pueden decir: ZorgonTel.",
        ]);
      });

      it("con la base vacía no falla: solo los campos fijos y los avisos", async () => {
        const r = await admin("GET", "/growth/admin/ficha-de-alhabla");
        expect(r.statusCode).toBe(200);
        const cuerpo = r.json();
        expect(cuerpo.commit).toBeNull();
        expect(cuerpo.sincronizadaEn).toBeNull();
        expect(
          cuerpo.campos
            .filter((c: Fila) => c.texto !== null)
            .map((c: Fila) => c.clave)
        ).toEqual(["nombre", "web", "categorias"]);
        expect(cuerpo.avisos.length).toBeGreaterThan(0);
      });
    }
  );

  // ── Tareas: la tabla ────────────────────────────────────────────────────

  describe("la tabla growth_tareas", () => {
    it("una fila con lo mínimo toma los valores por defecto de la migración", async () => {
      const t = await prisma.growthTarea.create({
        data: { titulo: "Mínima", url: "https://ejemplo.com/" },
      });
      expect(t).toMatchObject({
        dominio: null,
        categoria: "otro",
        pasos: [],
        notas: null,
        origen: "repo",
        siembra: null,
        estado: "pendiente",
        resultado: null,
        notaDeResultado: null,
        hechaEn: null,
        orden: 0,
      });
      expect(t.creadoEn).toBeInstanceOf(Date);
    });

    it("el índice único de siembra impide repetir una clave, pero admite todas las filas manuales (NULL repetido)", async () => {
      await prisma.growthTarea.create({
        data: { titulo: "A", url: "https://a.com/", siembra: "g2" },
      });
      await expect(
        prisma.growthTarea.create({
          data: { titulo: "B", url: "https://b.com/", siembra: "g2" },
        })
      ).rejects.toMatchObject({ code: "P2002" });
      await prisma.growthTarea.createMany({
        data: [
          {
            titulo: "M1",
            url: "https://m.com/",
            dominio: "m.com",
            origen: "manual",
          },
          {
            titulo: "M2",
            url: "https://m.com/",
            dominio: "m.com",
            origen: "manual",
          },
          {
            titulo: "M3",
            url: "https://m.com/",
            dominio: "m.com",
            origen: "manual",
          },
        ],
      });
      expect(
        await prisma.growthTarea.count({ where: { dominio: "m.com" } })
      ).toBe(3);
    });
  });

  // ── Tareas: la siembra ──────────────────────────────────────────────────

  describe("la siembra perezosa", () => {
    const sembradas = () =>
      prisma.growthTarea.findMany({ where: { origen: "repo" } });

    it("el primer GET siembra las once; el segundo no cambia nada (mismos ids)", async () => {
      expect(await prisma.growthTarea.count()).toBe(0);
      const primero = await admin("GET", "/growth/admin/tareas");
      expect(primero.statusCode).toBe(200);
      expect(primero.json().data).toHaveLength(TAREAS_INICIALES.length);
      const idsPrimero = (await sembradas()).map((t) => t.id).sort();

      const segundo = await admin("GET", "/growth/admin/tareas");
      expect(segundo.statusCode).toBe(200);
      expect(segundo.json().data).toEqual(primero.json().data);
      expect((await sembradas()).map((t) => t.id).sort()).toEqual(idsPrimero);
      expect(await prisma.growthTarea.count()).toBe(TAREAS_INICIALES.length);
    });

    it("diez GET a la vez con la tabla vacía: todos 200, once filas y sin duplicados", async () => {
      const respuestas = await Promise.all(
        Array.from({ length: 10 }, () => admin("GET", "/growth/admin/tareas"))
      );
      expect(respuestas.map((r) => r.statusCode)).toEqual(Array(10).fill(200));
      for (const r of respuestas) {
        expect(r.json().data).toHaveLength(TAREAS_INICIALES.length);
      }
      expect(await prisma.growthTarea.count()).toBe(TAREAS_INICIALES.length);
      const claves = (await sembradas()).map((t) => t.siembra);
      expect(new Set(claves).size).toBe(TAREAS_INICIALES.length);
    });

    describe("con un insert lento: la carrera deja de ser cuestión de suerte", () => {
      // Un disparador que frena cada inserción 25 ms ensancha la ventana entre
      // «mirar qué falta» y «insertar»: sin el cerrojo, todas las peticiones
      // entrarían a la vez. Solo existe durante estas pruebas.
      beforeAll(async () => {
        await prisma.$executeRawUnsafe(`
          CREATE OR REPLACE FUNCTION growth_tareas_insercion_lenta() RETURNS trigger AS $$
          BEGIN PERFORM pg_sleep(0.025); RETURN NEW; END;
          $$ LANGUAGE plpgsql`);
        await prisma.$executeRawUnsafe(
          `DROP TRIGGER IF EXISTS growth_tareas_lenta ON growth_tareas`
        );
        await prisma.$executeRawUnsafe(`
          CREATE TRIGGER growth_tareas_lenta BEFORE INSERT ON growth_tareas
          FOR EACH ROW EXECUTE FUNCTION growth_tareas_insercion_lenta()`);
      });

      afterAll(async () => {
        await prisma.$executeRawUnsafe(
          `DROP TRIGGER IF EXISTS growth_tareas_lenta ON growth_tareas`
        );
        await prisma.$executeRawUnsafe(
          `DROP FUNCTION IF EXISTS growth_tareas_insercion_lenta()`
        );
      });

      it("diez GET a la vez con la tabla vacía: todos 200, once filas y sin duplicados", async () => {
        const respuestas = await Promise.all(
          Array.from({ length: 10 }, () => admin("GET", "/growth/admin/tareas"))
        );
        expect(respuestas.map((r) => r.statusCode)).toEqual(
          Array(10).fill(200)
        );
        for (const r of respuestas) {
          expect(r.json().data).toHaveLength(TAREAS_INICIALES.length);
        }
        expect(await prisma.growthTarea.count()).toBe(TAREAS_INICIALES.length);
        const claves = (await sembradas()).map((t) => t.siembra);
        expect(new Set(claves).size).toBe(TAREAS_INICIALES.length);
      });

      it("si ya había algunas sembradas, diez GET a la vez solo ponen las que faltan", async () => {
        await admin("GET", "/growth/admin/tareas");
        await prisma.growthTarea.deleteMany({
          where: { siembra: { in: ["g2", "stork", "selecthub"] } },
        });
        const respuestas = await Promise.all(
          Array.from({ length: 10 }, () => admin("GET", "/growth/admin/tareas"))
        );
        expect(respuestas.map((r) => r.statusCode)).toEqual(
          Array(10).fill(200)
        );
        expect(await prisma.growthTarea.count()).toBe(TAREAS_INICIALES.length);
      });
    });

    it("la siembra a pelo, sin pasar por el cerrojo, tampoco duplica: lo impide el índice único", async () => {
      const { filaDeTareaInicial } =
        await import("../../../src/modules/growth/tareasIniciales.js");
      const filas = TAREAS_INICIALES.map(filaDeTareaInicial);
      const resultados = await Promise.all(
        Array.from({ length: 8 }, () =>
          prisma.growthTarea.createMany({
            data: filas.map((f) => ({ ...f, pasos: f.pasos })),
            skipDuplicates: true,
          })
        )
      );
      expect(resultados.reduce((suma, r) => suma + r.count, 0)).toBe(
        filas.length
      );
      expect(await prisma.growthTarea.count()).toBe(filas.length);
    });

    it("las iniciales salen como en el contrato: del repositorio, once, y solo Beautymarket hecha", async () => {
      const { data } = (await admin("GET", "/growth/admin/tareas")).json();
      expect(data.every((t: Fila) => t.origen === "repo")).toBe(true);
      const hechas = data.filter((t: Fila) => t.estado === "hecha");
      expect(hechas).toHaveLength(1);
      expect(hechas[0]).toMatchObject({
        dominio: "beautymarket.es",
        resultado: "en_revision",
        notaDeResultado: "Ficha enviada por el fundador el 31-10-2026.",
        hechaEn: "2026-10-31T12:00:00.000Z",
      });
      // Pendientes primero y Beautymarket (hecha) al final.
      expect(data[data.length - 1].dominio).toBe("beautymarket.es");
      expect(
        data.slice(0, -1).every((t: Fila) => t.estado === "pendiente")
      ).toBe(true);
      for (const t of data) {
        expect(Array.isArray(t.pasos)).toBe(true);
        expect(t.pasos.length).toBeGreaterThan(0);
        expect(t).not.toHaveProperty("siembra");
      }
    });

    it("no pisa lo que el administrador ya hizo: editada, hecha o descartada, se queda como está tras otro GET", async () => {
      const { data } = (await admin("GET", "/growth/admin/tareas")).json();
      const idDe = (dominio: string) =>
        data.find((t: Fila) => t.dominio === dominio).id as string;

      await admin("PATCH", `/growth/admin/tareas/${idDe("g2.com")}`, {
        titulo: "G2 (mío)",
        dominio: "otro-dominio.com",
      });
      await admin(
        "POST",
        `/growth/admin/tareas/${idDe("capterra.com")}/hecha`,
        {
          resultado: "alta_creada",
        }
      );
      await admin(
        "POST",
        `/growth/admin/tareas/${idDe("stork.ai")}/descartar`,
        {
          nota: "No aplica",
        }
      );

      const otra = (await admin("GET", "/growth/admin/tareas")).json()
        .data as Fila[];
      expect(otra).toHaveLength(TAREAS_INICIALES.length);
      expect(otra.find((t) => t.id === idDe("g2.com"))).toMatchObject({
        titulo: "G2 (mío)",
        dominio: "otro-dominio.com",
      });
      expect(otra.find((t) => t.id === idDe("capterra.com"))).toMatchObject({
        estado: "hecha",
        resultado: "alta_creada",
      });
      expect(otra.find((t) => t.id === idDe("stork.ai"))).toMatchObject({
        estado: "descartada",
      });
      expect(await prisma.growthTarea.count()).toBe(TAREAS_INICIALES.length);
    });

    it("si una tarea inicial desaparece de la base, el siguiente GET la repone sin tocar las demás", async () => {
      await admin("GET", "/growth/admin/tareas");
      const antes = await prisma.growthTarea.findUniqueOrThrow({
        where: { siembra: "selecthub" },
      });
      const otra = await prisma.growthTarea.findUniqueOrThrow({
        where: { siembra: "toolradar" },
      });
      await prisma.growthTarea.delete({ where: { siembra: "selecthub" } });
      await admin("GET", "/growth/admin/tareas");
      const repuesta = await prisma.growthTarea.findUniqueOrThrow({
        where: { siembra: "selecthub" },
      });
      expect(repuesta.id).not.toBe(antes.id);
      expect(
        (
          await prisma.growthTarea.findUniqueOrThrow({
            where: { siembra: "toolradar" },
          })
        ).id
      ).toBe(otra.id);
      expect(await prisma.growthTarea.count()).toBe(TAREAS_INICIALES.length);
    });
  });

  // ── Tareas: alta, estados y baja ────────────────────────────────────────

  describe("alta, ciclo y baja", () => {
    it("añadir una tarea a mano: 201, origen manual, y sale en el listado antes que las sembradas", async () => {
      const r = await admin("POST", "/growth/admin/tareas", {
        titulo: "Asociación de peluqueros",
        url: "https://www.peluqueros.example.es/asociate",
        categoria: "asociacion",
        pasos: ["Rellena el formulario.", "Adjunta el logotipo."],
        notas: "Cuota anual sin confirmar",
      });
      expect(r.statusCode).toBe(201);
      expect(r.json()).toMatchObject({
        titulo: "Asociación de peluqueros",
        dominio: "peluqueros.example.es",
        categoria: "asociacion",
        origen: "manual",
        estado: "pendiente",
        pasos: ["Rellena el formulario.", "Adjunta el logotipo."],
        notas: "Cuota anual sin confirmar",
        resultado: null,
        hechaEn: null,
        orden: 0,
      });
      const { data } = (await admin("GET", "/growth/admin/tareas")).json();
      expect(data).toHaveLength(TAREAS_INICIALES.length + 1);
      expect(data[0].id).toBe(r.json().id);
    });

    it("dos tareas manuales del mismo dominio caben (el índice único es de la siembra, no del dominio)", async () => {
      for (const titulo of ["Alta", "Reseñas"]) {
        const r = await admin("POST", "/growth/admin/tareas", {
          titulo,
          url: "https://g2.com/algo",
        });
        expect(r.statusCode, titulo).toBe(201);
      }
      expect(
        await prisma.growthTarea.count({ where: { origen: "manual" } })
      ).toBe(2);
    });

    it("el ciclo pendiente → hecha → reabrir → descartada → reabrir", async () => {
      const { id } = (
        await admin("POST", "/growth/admin/tareas", {
          titulo: "Ciclo",
          url: "https://ciclo.example.com/",
        })
      ).json();

      const hecha = (
        await admin("POST", `/growth/admin/tareas/${id}/hecha`, {
          resultado: "en_revision",
          nota: "Enviada",
        })
      ).json();
      expect(hecha).toMatchObject({
        estado: "hecha",
        resultado: "en_revision",
        notaDeResultado: "Enviada",
        hechaEn: expect.any(String),
      });

      const reabierta = (
        await admin("POST", `/growth/admin/tareas/${id}/reabrir`)
      ).json();
      expect(reabierta).toMatchObject({
        estado: "pendiente",
        resultado: null,
        hechaEn: null,
        notaDeResultado: "Enviada",
      });

      const descartada = (
        await admin("POST", `/growth/admin/tareas/${id}/descartar`, {
          nota: "No toca",
        })
      ).json();
      expect(descartada).toMatchObject({
        estado: "descartada",
        resultado: null,
        hechaEn: null,
        notaDeResultado: "No toca",
      });

      const otraVez = (
        await admin("POST", `/growth/admin/tareas/${id}/reabrir`)
      ).json();
      expect(otraVez.estado).toBe("pendiente");
    });

    it("cinco «hecha» a la vez dan todas 200 y la misma fecha: la sentencia es atómica", async () => {
      const { id } = (
        await admin("POST", "/growth/admin/tareas", {
          titulo: "Carrera",
          url: "https://carrera.example.com/",
        })
      ).json();
      // Un disparador frena cada cambio 60 ms, así que las cinco peticiones se
      // solapan: si «hecha» no fuera una sola sentencia condicionada, cada una
      // pondría su propia fecha.
      await prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION growth_tareas_cambio_lento() RETURNS trigger AS $$
        BEGIN PERFORM pg_sleep(0.06); RETURN NEW; END;
        $$ LANGUAGE plpgsql`);
      await prisma.$executeRawUnsafe(
        `DROP TRIGGER IF EXISTS growth_tareas_cambio_lento ON growth_tareas`
      );
      await prisma.$executeRawUnsafe(`
        CREATE TRIGGER growth_tareas_cambio_lento BEFORE UPDATE ON growth_tareas
        FOR EACH ROW EXECUTE FUNCTION growth_tareas_cambio_lento()`);
      try {
        // Escalonadas 15 ms: cada petición tiene su propio «ahora».
        const respuestas = await Promise.all(
          Array.from({ length: 5 }, async (_, i) => {
            await new Promise((resolver) => setTimeout(resolver, i * 15));
            return admin("POST", `/growth/admin/tareas/${id}/hecha`, {
              resultado: "alta_creada",
            });
          })
        );
        expect(respuestas.map((r) => r.statusCode)).toEqual(Array(5).fill(200));
        expect(new Set(respuestas.map((r) => r.json().hechaEn)).size).toBe(1);
        const fila = await prisma.growthTarea.findUniqueOrThrow({
          where: { id },
        });
        expect(fila.hechaEn!.toISOString()).toBe(respuestas[0].json().hechaEn);
      } finally {
        await prisma.$executeRawUnsafe(
          `DROP TRIGGER IF EXISTS growth_tareas_cambio_lento ON growth_tareas`
        );
        await prisma.$executeRawUnsafe(
          `DROP FUNCTION IF EXISTS growth_tareas_cambio_lento()`
        );
      }
    });

    it("hecha otra vez, más tarde, no mueve la fecha pero sí completa el resultado", async () => {
      const { id } = (
        await admin("POST", "/growth/admin/tareas", {
          titulo: "Dos veces",
          url: "https://dos.example.com/",
        })
      ).json();
      const primera = (
        await admin("POST", `/growth/admin/tareas/${id}/hecha`, {
          resultado: "en_revision",
        })
      ).json();
      await new Promise((resolver) => setTimeout(resolver, 15));
      const segunda = (
        await admin("POST", `/growth/admin/tareas/${id}/hecha`, {
          resultado: "alta_creada",
          nota: "Publicada",
        })
      ).json();
      expect(segunda).toMatchObject({
        hechaEn: primera.hechaEn,
        resultado: "alta_creada",
        notaDeResultado: "Publicada",
      });
    });

    it("editar: solo cambia lo que llega; una URL de otro sitio recalcula el dominio", async () => {
      const { id } = (
        await admin("POST", "/growth/admin/tareas", {
          titulo: "Editable",
          url: "https://uno.example.com/alta",
          notas: "Nota",
          pasos: ["Uno"],
        })
      ).json();
      const r = await admin("PATCH", `/growth/admin/tareas/${id}`, {
        titulo: "Editada",
        url: "https://www.dos.example.org/entrada",
      });
      expect(r.statusCode).toBe(200);
      expect(r.json()).toMatchObject({
        titulo: "Editada",
        url: "https://www.dos.example.org/entrada",
        dominio: "dos.example.org",
        notas: "Nota",
        pasos: ["Uno"],
      });
      const sinNotas = await admin("PATCH", `/growth/admin/tareas/${id}`, {
        notas: null,
      });
      expect(sinNotas.json().notas).toBeNull();
    });

    it("borrar: una manual se va (204); una del repositorio da 409 y sigue ahí; una que no existe, 404", async () => {
      const { id } = (
        await admin("POST", "/growth/admin/tareas", {
          titulo: "Para borrar",
          url: "https://borrar.example.com/",
        })
      ).json();
      const borrada = await admin("DELETE", `/growth/admin/tareas/${id}`);
      expect(borrada.statusCode).toBe(204);
      expect(borrada.body).toBe("");
      expect(await prisma.growthTarea.count({ where: { id } })).toBe(0);
      expect(
        (await admin("DELETE", `/growth/admin/tareas/${id}`)).statusCode
      ).toBe(404);

      const { data } = (await admin("GET", "/growth/admin/tareas")).json();
      const delRepo = data.find((t: Fila) => t.dominio === "g2.com");
      const r = await admin("DELETE", `/growth/admin/tareas/${delRepo.id}`);
      expect(r.statusCode).toBe(409);
      expect(r.json()).toEqual({
        error: expect.any(String),
        codigo: "tarea_del_repositorio",
      });
      expect(
        await prisma.growthTarea.count({ where: { id: delRepo.id } })
      ).toBe(1);
    });

    it("una que se descarta en vez de borrarla sigue ahí, al final", async () => {
      const { data } = (await admin("GET", "/growth/admin/tareas")).json();
      const g2 = data.find((t: Fila) => t.dominio === "g2.com");
      const r = await admin("POST", `/growth/admin/tareas/${g2.id}/descartar`, {
        nota: "Pide cuenta de empresa",
      });
      expect(r.statusCode).toBe(200);
      const despues = (await admin("GET", "/growth/admin/tareas")).json()
        .data as Fila[];
      expect(despues[despues.length - 1].id).toBe(g2.id);
      expect(despues).toHaveLength(TAREAS_INICIALES.length);
    });

    it("ids y cuerpos inválidos: 404 y 400, nunca un 500", async () => {
      expect(
        (
          await admin("PATCH", "/growth/admin/tareas/no-existe", {
            titulo: "X",
          })
        ).statusCode
      ).toBe(404);
      expect(
        (await admin("POST", "/growth/admin/tareas/no-existe/hecha", {}))
          .statusCode
      ).toBe(404);
      expect(
        (await admin("POST", "/growth/admin/tareas/no-existe/reabrir"))
          .statusCode
      ).toBe(404);
      expect(
        (await admin("POST", "/growth/admin/tareas/no-existe/descartar", {}))
          .statusCode
      ).toBe(404);
      expect(
        (
          await admin("POST", "/growth/admin/tareas", {
            titulo: "X",
            url: "javascript:alert(1)",
          })
        ).statusCode
      ).toBe(400);
      expect(
        (
          await admin("POST", "/growth/admin/tareas", {
            titulo: "a\u0000b",
            url: "https://e.com/",
          })
        ).statusCode
      ).toBe(400);
    });
  });

  // ── Quién entra ─────────────────────────────────────────────────────────

  describe("solo el administrador", () => {
    it("sin sesión, 401; con un token de agente (con todos los alcances), 401; no se escribe nada", async () => {
      const generado = generarTokenDeAgente();
      await prisma.growthTokenAgente.create({
        data: {
          nombre: "agente-f3a",
          hashToken: generado.hash,
          alcances: ["leer", "escribir", "conocimiento"],
        },
      });
      const rutas: [string, string, object?][] = [
        ["GET", "/growth/admin/tareas"],
        [
          "POST",
          "/growth/admin/tareas",
          { titulo: "X", url: "https://e.com/" },
        ],
        ["PATCH", "/growth/admin/tareas/t1", { titulo: "X" }],
        ["POST", "/growth/admin/tareas/t1/hecha", {}],
        ["POST", "/growth/admin/tareas/t1/descartar", {}],
        ["POST", "/growth/admin/tareas/t1/reabrir", {}],
        ["DELETE", "/growth/admin/tareas/t1"],
        ["GET", "/growth/admin/ficha-de-alhabla"],
        ["GET", "/growth/admin/competidores/comparador"],
      ];
      for (const [metodo, url, cuerpo] of rutas) {
        const sin = await fastify.inject({
          method: metodo as "GET",
          url,
          payload: cuerpo,
        });
        expect(sin.statusCode, `${metodo} ${url} sin sesión`).toBe(401);
        const agente = await fastify.inject({
          method: metodo as "GET",
          url,
          headers: { authorization: `Bearer ${generado.token}` },
          payload: cuerpo,
        });
        expect(agente.statusCode, `${metodo} ${url} con token de agente`).toBe(
          401
        );
      }
      expect(await prisma.growthTarea.count()).toBe(0);
    });
  });
});
