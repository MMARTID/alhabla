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
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../../../src/lib/prisma.js";
import { purgarRetencionDeGrowthJob } from "../../../src/jobs/purgarRetencionDeGrowth.js";
import { growthRoutes } from "../../../src/modules/growth/routes.js";
import { SincronizarBody } from "../../../src/modules/growth/esquemas.js";
import { sincronizarConocimiento } from "../../../src/modules/growth/conocimiento/sincronizar.js";
import { generarTokenDeAgente } from "../../../src/modules/growth/tokens.js";
import {
  construirAfirmaciones,
  type ResultadoDeConstruccion,
} from "../../../mcp/growth/conocimiento/construir.js";
import { cargarEntrada } from "../../../mcp/growth/conocimiento/entrada.js";
import { limpiarGrowth } from "./ayudas.js";
import {
  TEXTO_QUE_CUMPLE,
  asegurarFuente,
  hace,
  sembrarOportunidad,
} from "./f1b-ayudas.js";

const { mockVerifyIdToken } = vi.hoisted(() => ({
  mockVerifyIdToken: vi.fn(),
}));

vi.mock("google-auth-library", () => ({
  OAuth2Client: vi.fn(function OAuth2ClientMock() {
    return { verifyIdToken: mockVerifyIdToken };
  }),
}));

/**
 * Fase 2a — Competencia contra Postgres real: lo que el Prisma de mentira no
 * puede probar. El índice único (altas a la vez), el cerrojo por competidor
 * (análisis y revisiones a la vez), la poda de versiones, el filtro por JSON
 * (`menciona`), el borrado en cascada, que un `propuesto` no aplique reglas y
 * que el sincronizador y la retención no toquen lo del administrador.
 */

const ADMIN = "admin@alhabla.ai";
const ID_TOKEN = "id-token-de-google";
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

type Respuesta = { statusCode: number; json: () => any; body: string };

const datoDePrecio = (cambios: Record<string, unknown> = {}) => ({
  tipo: "precio",
  etiqueta: "Plan Pro",
  texto: "99 € al mes con 500 minutos",
  valor: { importe: 99, moneda: "EUR", periodo: "mes", ivaIncluido: false },
  urlFuente: "https://rival.com/precios",
  consultadoEn: new Date().toISOString(),
  ...cambios,
});

const analisisNuevo = (resumen = "Recepcionista de IA para pymes.") => ({
  resumen,
  datos: [datoDePrecio()],
});

describe("competencia contra Postgres real (Fase 2a)", () => {
  let fastify: ReturnType<typeof Fastify>;
  let token = "";
  let tokenSoloLeer = "";
  let tokenSoloEscribir = "";

  const comoAgente = (t = token) => ({ authorization: `Bearer ${t}` });
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

  const agente = (
    method: "GET" | "POST" | "PUT",
    url: string,
    payload?: unknown,
    t = token
  ): Promise<Respuesta> =>
    fastify.inject({
      method,
      url,
      headers: comoAgente(t),
      payload: payload as object | undefined,
    });

  async function crearToken(nombre: string, alcances: string[]) {
    const generado = generarTokenDeAgente();
    await prisma.growthTokenAgente.create({
      data: { nombre, hashToken: generado.hash, alcances },
    });
    return generado.token;
  }

  /** Un competidor por la API de administración. */
  async function altaDeCompetidor(url: string, nombre?: string) {
    const r = await admin("POST", "/growth/admin/competidores", {
      url,
      ...(nombre ? { nombre } : {}),
    });
    expect(r.statusCode).toBe(201);
    return r.json() as { id: string; dominio: string; estado: string };
  }

  /** Un competidor propuesto por el agente. */
  async function propuesta(url: string, nombre = "Propuesto") {
    const r = await agente("POST", "/growth/agente/competidores", {
      url,
      nombre,
      motivo: "Sale en una lista de alternativas",
    });
    expect(r.statusCode).toBe(201);
    return r.json().id as string;
  }

  const analisisDe = (competidorId: string) =>
    prisma.growthCompetidorAnalisis.findMany({
      where: { competidorId },
      orderBy: { version: "asc" },
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
    // Solo el ID token del administrador verifica; cualquier otro (un token de
    // agente, un JWT de cliente) falla como falla con Google.
    mockVerifyIdToken.mockImplementation(
      async ({ idToken }: { idToken: string }) => {
        if (idToken !== ID_TOKEN) throw new Error("Wrong number of segments");
        return { getPayload: () => ({ email: ADMIN, email_verified: true }) };
      }
    );
    await limpiarGrowth();
    await asegurarFuente();
    token = await crearToken("agente-2a", ["leer", "escribir"]);
    tokenSoloLeer = await crearToken("solo-leer", ["leer"]);
    tokenSoloEscribir = await crearToken("solo-escribir", ["escribir"]);
  });

  afterAll(async () => {
    await fastify.close();
    await limpiarGrowth();
  });

  // ── La migración ───────────────────────────────────────────────────────

  describe("la migración y los valores por defecto", () => {
    it("una fila creada como lo hace el sincronizador (solo nombre y dominio) queda como repo, por analizar, sin URL ni análisis pedido", async () => {
      const c = await prisma.growthCompetidor.create({
        data: { nombre: "HeyDiga", dominio: "heydiga.ai" },
      });
      expect(c).toMatchObject({
        origen: "repo",
        estado: "por_analizar",
        url: null,
        notas: null,
        analisisSolicitadoEn: null,
      });
      expect(c.creadoEn).toBeInstanceOf(Date);
    });
  });

  // ── Alta ───────────────────────────────────────────────────────────────

  describe("alta por URL", () => {
    it("guarda el dominio sin www, la URL sin seguimiento y deja el análisis pedido", async () => {
      const r = await admin("POST", "/growth/admin/competidores", {
        url: "https://www.Rival.com/precios?utm_source=lista&plan=pro#top",
        notas: "Visto en una lista",
      });
      expect(r.statusCode).toBe(201);
      const c = r.json();
      expect(c).toMatchObject({
        nombre: "Rival",
        dominio: "rival.com",
        url: "https://www.rival.com/precios?plan=pro",
        notas: "Visto en una lista",
        origen: "manual",
        estado: "por_analizar",
        oportunidades: 0,
        menciones: 0,
        analisis: null,
        ultimoAnalisis: null,
        versiones: [],
      });
      expect(c.analisisSolicitadoEn).toEqual(expect.any(String));
      expect(
        await prisma.growthCompetidor.count({ where: { dominio: "rival.com" } })
      ).toBe(1);
    });

    it("el mismo dominio otra vez (www, mayúsculas, otra ruta) es un 409 con el id del que hay", async () => {
      const primero = await altaDeCompetidor("https://rival.com");
      for (const url of [
        "https://www.rival.com/otra-ruta",
        "https://RIVAL.COM/",
        "http://rival.com./",
      ]) {
        const r = await admin("POST", "/growth/admin/competidores", { url });
        expect(r.statusCode, url).toBe(409);
        expect(r.json(), url).toEqual({
          error: expect.any(String),
          codigo: "competidor_existente",
          id: primero.id,
        });
      }
    });

    it("cinco altas a la vez del mismo dominio: una es 201 y las demás 409 competidor_existente (ningún 500) y queda una sola fila", async () => {
      const respuestas = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          admin("POST", "/growth/admin/competidores", {
            url: `https://rival.com/ruta-${i}`,
          })
        )
      );
      const estados = respuestas.map((r) => r.statusCode).sort();
      expect(estados).toEqual([201, 409, 409, 409, 409]);
      const ganadora = respuestas.find((r) => r.statusCode === 201)!.json();
      for (const r of respuestas.filter((r) => r.statusCode === 409)) {
        expect(r.json()).toMatchObject({
          codigo: "competidor_existente",
          id: ganadora.id,
        });
      }
      expect(await prisma.growthCompetidor.count()).toBe(1);
    });

    it("alhabla.ai, localhost, una IP, el metadata de Google y un esquema peligroso se rechazan sin guardar nada", async () => {
      const casos: [string, number][] = [
        ["https://alhabla.ai", 400],
        ["https://app.alhabla.ai/x", 400],
        ["http://localhost:3000", 400],
        ["http://127.0.0.1", 400],
        ["http://169.254.169.254/latest/meta-data", 400],
        ["http://metadata.google.internal./", 400],
        ["javascript:alert(1)", 400],
        ["https://alhabla.ai@competidor-falso.com", 400],
      ];
      for (const [url, estado] of casos) {
        const r = await admin("POST", "/growth/admin/competidores", { url });
        expect(r.statusCode, url).toBe(estado);
      }
      expect(await prisma.growthCompetidor.count()).toBe(0);
    });
  });

  // ── Ciclo completo ─────────────────────────────────────────────────────

  describe("el ciclo completo: proponer → aceptar → analizar → revisar → volver a analizar", () => {
    it("recorre todos los estados con sus errores", async () => {
      // 1. El agente propone. No cambia nada si lo repite.
      const id = await propuesta("https://www.nuevo-rival.com/precios");
      const otra = await agente("POST", "/growth/agente/competidores", {
        url: "https://nuevo-rival.com/otra",
        nombre: "Otro nombre",
        motivo: "Otra vez",
      });
      expect(otra.statusCode).toBe(200);
      expect(otra.json()).toEqual({ id, estado: "propuesto", existente: true });

      let c = (await admin("GET", `/growth/admin/competidores/${id}`)).json();
      expect(c).toMatchObject({
        origen: "agente",
        estado: "propuesto",
        analisisSolicitadoEn: null,
        nombre: "Propuesto",
      });
      expect(c.notas).toBe(
        "Propuesto por el agente: Sale en una lista de alternativas"
      );

      // 2. Un propuesto no se analiza, ni se reanaliza, ni se revisa.
      const sinAceptar = await agente(
        "POST",
        `/growth/agente/competidores/${id}/analisis`,
        analisisNuevo()
      );
      expect(sinAceptar.statusCode).toBe(409);
      expect(sinAceptar.json().codigo).toBe("competidor_propuesto");
      expect(
        (
          await admin("POST", `/growth/admin/competidores/${id}/reanalizar`, {})
        ).json().codigo
      ).toBe("estado_incorrecto");

      // 3. El administrador lo acepta (y no se puede aceptar dos veces).
      const aceptado = await admin(
        "POST",
        `/growth/admin/competidores/${id}/aceptar`,
        {}
      );
      expect(aceptado.statusCode).toBe(200);
      expect(aceptado.json()).toMatchObject({
        estado: "por_analizar",
        origen: "agente",
      });
      expect(aceptado.json().analisisSolicitadoEn).toEqual(expect.any(String));
      const segunda = await admin(
        "POST",
        `/growth/admin/competidores/${id}/aceptar`,
        {}
      );
      expect(segunda.statusCode).toBe(409);
      expect(segunda.json().codigo).toBe("estado_incorrecto");

      // 4. Ahora el agente lo ve pendiente de análisis.
      let lista = (await agente("GET", "/growth/agente/competidores")).json();
      expect(lista.data.find((x: { id: string }) => x.id === id)).toMatchObject(
        {
          estado: "por_analizar",
          necesitaAnalisis: true,
          motivoDeAnalisis: "por_analizar",
        }
      );
      const contexto = (await agente("GET", "/growth/agente/contexto")).json();
      expect(contexto.competidoresPorAnalizar).toEqual([
        {
          id,
          nombre: "Propuesto",
          dominio: "nuevo-rival.com",
          url: "https://www.nuevo-rival.com/precios",
        },
      ]);

      // 5. Guarda el análisis: versión 1, analizado y sin petición pendiente.
      const v1 = await agente(
        "POST",
        `/growth/agente/competidores/${id}/analisis`,
        analisisNuevo("Primera lectura")
      );
      expect(v1.statusCode).toBe(201);
      expect(v1.json()).toMatchObject({ version: 1, estado: "analizado" });
      c = (await admin("GET", `/growth/admin/competidores/${id}`)).json();
      expect(c).toMatchObject({
        estado: "analizado",
        analisisSolicitadoEn: null,
        analisis: {
          version: 1,
          numDatos: 1,
          caducado: false,
          revisadoEn: null,
        },
        ultimoAnalisis: {
          version: 1,
          resumen: "Primera lectura",
          creadoPor: "agente-2a",
          revisadoEn: null,
        },
      });
      lista = (await agente("GET", "/growth/agente/competidores")).json();
      expect(lista.data.find((x: { id: string }) => x.id === id)).toMatchObject(
        {
          necesitaAnalisis: false,
          motivoDeAnalisis: null,
        }
      );
      expect(
        (await agente("GET", "/growth/agente/contexto")).json()
          .competidoresPorAnalizar
      ).toEqual([]);

      // 6. Repetirlo enseguida es un 409 analisis_reciente.
      const reciente = await agente(
        "POST",
        `/growth/agente/competidores/${id}/analisis`,
        analisisNuevo("Otra vez")
      );
      expect(reciente.statusCode).toBe(409);
      expect(reciente.json().codigo).toBe("analisis_reciente");
      expect(await analisisDe(id)).toHaveLength(1);

      // 7. El administrador lo revisa; no se puede revisar dos veces.
      const idV1 = c.ultimoAnalisis.id as string;
      const revisado = await admin(
        "POST",
        `/growth/admin/competidores/${id}/analisis/${idV1}/revisar`,
        { nota: "Cuadra con su web" }
      );
      expect(revisado.statusCode).toBe(200);
      expect(revisado.json()).toMatchObject({
        estado: "revisado",
        ultimoAnalisis: {
          revisadoEn: expect.any(String),
          notaDeRevision: "Cuadra con su web",
        },
      });
      const doble = await admin(
        "POST",
        `/growth/admin/competidores/${id}/analisis/${idV1}/revisar`,
        {}
      );
      expect(doble.statusCode).toBe(409);
      expect(doble.json().codigo).toBe("ya_revisado");

      // 8. Volver a analizar: el agente puede aunque sea reciente; es idempotente.
      for (let i = 0; i < 2; i++) {
        const re = await admin(
          "POST",
          `/growth/admin/competidores/${id}/reanalizar`,
          {}
        );
        expect(re.statusCode).toBe(200);
        expect(re.json().estado).toBe("por_analizar");
      }
      const v2 = await agente(
        "POST",
        `/growth/agente/competidores/${id}/analisis`,
        analisisNuevo("Segunda lectura")
      );
      expect(v2.statusCode).toBe(201);
      expect(v2.json().version).toBe(2);

      // 9. La versión 1 ya no es la última: no se revisa. La 2 sí.
      const antiguo = await admin(
        "POST",
        `/growth/admin/competidores/${id}/analisis/${idV1}/revisar`,
        {}
      );
      expect(antiguo.statusCode).toBe(409);
      expect(antiguo.json().codigo).toBe("analisis_antiguo");

      c = (await admin("GET", `/growth/admin/competidores/${id}`)).json();
      expect(c.versiones.map((v: { version: number }) => v.version)).toEqual([
        2, 1,
      ]);
      expect(c.estado).toBe("analizado");
      const bien = await admin(
        "POST",
        `/growth/admin/competidores/${id}/analisis/${c.ultimoAnalisis.id}/revisar`,
        {}
      );
      expect(bien.statusCode).toBe(200);
      expect(bien.json().estado).toBe("revisado");

      // 10. Una versión antigua se lee entera, solo con el id del competidor.
      const vieja = await admin(
        "GET",
        `/growth/admin/competidores/${id}/analisis/${idV1}`
      );
      expect(vieja.json()).toMatchObject({
        version: 1,
        resumen: "Primera lectura",
      });
      const ajeno = await altaDeCompetidor("https://otro-rival.com");
      expect(
        (
          await admin(
            "GET",
            `/growth/admin/competidores/${ajeno.id}/analisis/${idV1}`
          )
        ).statusCode
      ).toBe(404);
      expect(
        (
          await admin(
            "POST",
            `/growth/admin/competidores/${ajeno.id}/analisis/${idV1}/revisar`,
            {}
          )
        ).statusCode
      ).toBe(404);
    });

    it("revisar un competidor al que se le ha pedido volver a analizar es un 409 estado_incorrecto", async () => {
      const { id } = await altaDeCompetidor("https://rival.com");
      await agente(
        "POST",
        `/growth/agente/competidores/${id}/analisis`,
        analisisNuevo()
      );
      const [a] = await analisisDe(id);
      await admin("POST", `/growth/admin/competidores/${id}/reanalizar`, {});

      const r = await admin(
        "POST",
        `/growth/admin/competidores/${id}/analisis/${a!.id}/revisar`,
        {}
      );
      expect(r.statusCode).toBe(409);
      expect(r.json().codigo).toBe("estado_incorrecto");
      expect((await analisisDe(id))[0]!.revisadoEn).toBeNull();
    });

    it("un análisis de hace más de 7 días se puede repetir sin pedirlo, y uno de más de 90 días se anuncia como caducado", async () => {
      const { id } = await altaDeCompetidor("https://rival.com");
      await agente(
        "POST",
        `/growth/agente/competidores/${id}/analisis`,
        analisisNuevo()
      );
      await prisma.growthCompetidorAnalisis.updateMany({
        where: { competidorId: id },
        data: { creadoEn: hace(8) },
      });
      const v2 = await agente(
        "POST",
        `/growth/agente/competidores/${id}/analisis`,
        analisisNuevo("Repetido")
      );
      expect(v2.statusCode).toBe(201);

      await prisma.growthCompetidorAnalisis.updateMany({
        where: { competidorId: id },
        data: { creadoEn: hace(91) },
      });
      const lista = (await agente("GET", "/growth/agente/competidores")).json();
      expect(lista.data[0]).toMatchObject({
        necesitaAnalisis: true,
        motivoDeAnalisis: "caducado",
        estado: "analizado",
      });
      const c = (await admin("GET", `/growth/admin/competidores/${id}`)).json();
      expect(c.analisis.caducado).toBe(true);
      expect(
        (await agente("GET", "/growth/agente/contexto")).json()
          .competidoresPorAnalizar
      ).toHaveLength(1);
      // Y entonces el agente SÍ puede repetirlo.
      const v3 = await agente(
        "POST",
        `/growth/agente/competidores/${id}/analisis`,
        analisisNuevo("Tras caducar")
      );
      expect(v3.statusCode).toBe(201);
    });

    it("se conservan 10 versiones: la 11 borra la más vieja", async () => {
      const { id } = await altaDeCompetidor("https://rival.com");
      for (let version = 1; version <= 10; version++) {
        await prisma.growthCompetidorAnalisis.create({
          data: {
            competidorId: id,
            version,
            resumen: `Versión ${version}`,
            datos: [datoDePrecio()],
            creadoEn: hace(100 - version),
            creadoPor: "test",
          },
        });
      }
      const r = await agente(
        "POST",
        `/growth/agente/competidores/${id}/analisis`,
        analisisNuevo("Versión 11")
      );
      expect(r.statusCode).toBe(201);
      expect(r.json().version).toBe(11);

      const versiones = (await analisisDe(id)).map((a) => a.version);
      expect(versiones).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

      const c = (await admin("GET", `/growth/admin/competidores/${id}`)).json();
      expect(c.versiones).toHaveLength(10);
      expect(c.versiones[0].version).toBe(11);
    });

    it("dos análisis a la vez del mismo competidor: uno se guarda y el otro es un 409 analisis_reciente (una sola versión)", async () => {
      const { id } = await altaDeCompetidor("https://rival.com");
      const respuestas = await Promise.all(
        Array.from({ length: 4 }, (_, i) =>
          agente(
            "POST",
            `/growth/agente/competidores/${id}/analisis`,
            analisisNuevo(`Run ${i}`)
          )
        )
      );
      expect(respuestas.map((r) => r.statusCode).sort()).toEqual([
        201, 409, 409, 409,
      ]);
      for (const r of respuestas.filter((r) => r.statusCode === 409)) {
        expect(r.json().codigo).toBe("analisis_reciente");
      }
      expect(await analisisDe(id)).toHaveLength(1);
    });

    it("dos aceptar a la vez: uno es 200 y el otro 409 estado_incorrecto", async () => {
      const id = await propuesta("https://nuevo-rival.com");
      const respuestas = await Promise.all([
        admin("POST", `/growth/admin/competidores/${id}/aceptar`, {}),
        admin("POST", `/growth/admin/competidores/${id}/aceptar`, {}),
      ]);
      expect(respuestas.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    });

    it("revisar a la vez que el agente guarda otro análisis nunca deja un competidor revisado con un análisis sin revisar", async () => {
      for (let intento = 0; intento < 5; intento++) {
        await limpiarGrowth();
        await asegurarFuente();
        token = await crearToken(`agente-${intento}`, ["leer", "escribir"]);
        const { id } = await altaDeCompetidor("https://rival.com");
        await agente(
          "POST",
          `/growth/agente/competidores/${id}/analisis`,
          analisisNuevo("v1")
        );
        const [v1] = await analisisDe(id);
        // Para que el agente pueda repetir sin esperar los 7 días.
        await prisma.growthCompetidorAnalisis.update({
          where: { id: v1!.id },
          data: { creadoEn: hace(8) },
        });

        const [revision, nuevo] = await Promise.all([
          admin(
            "POST",
            `/growth/admin/competidores/${id}/analisis/${v1!.id}/revisar`,
            {}
          ),
          agente(
            "POST",
            `/growth/agente/competidores/${id}/analisis`,
            analisisNuevo("v2")
          ),
        ]);
        expect([200, 409]).toContain(revision.statusCode);
        expect(nuevo.statusCode).toBe(201);

        const competidor = await prisma.growthCompetidor.findUniqueOrThrow({
          where: { id },
        });
        const todos = await analisisDe(id);
        const ultimo = todos[todos.length - 1]!;
        // El invariante: «revisado» si y solo si el último análisis está revisado.
        expect(competidor.estado === "revisado").toBe(
          ultimo.revisadoEn !== null
        );
        expect(ultimo.version).toBe(2);
      }
    });
  });

  // ── Edición y baja ─────────────────────────────────────────────────────

  describe("editar y quitar", () => {
    it("PATCH cambia nombre y notas y acepta una URL del mismo dominio, pero no de otro", async () => {
      const { id } = await altaDeCompetidor("https://rival.com");
      const r = await admin("PATCH", `/growth/admin/competidores/${id}`, {
        nombre: "Rival SL",
        notas: "Directo",
        url: "https://rival.com/precios?utm_medium=x",
      });
      expect(r.statusCode).toBe(200);
      expect(r.json()).toMatchObject({
        nombre: "Rival SL",
        notas: "Directo",
        url: "https://rival.com/precios",
        dominio: "rival.com",
      });
      const otro = await admin("PATCH", `/growth/admin/competidores/${id}`, {
        url: "https://otra-empresa.com/x",
      });
      expect(otro.statusCode).toBe(400);
      expect(otro.json().codigo).toBe("url_de_otro_dominio");
      const borrada = await admin("PATCH", `/growth/admin/competidores/${id}`, {
        notas: null,
        url: null,
      });
      expect(borrada.json()).toMatchObject({ notas: null, url: null });
    });

    it("DELETE de uno manual borra también sus análisis (cascada) y 404 si ya no existe", async () => {
      const { id } = await altaDeCompetidor("https://rival.com");
      await agente(
        "POST",
        `/growth/agente/competidores/${id}/analisis`,
        analisisNuevo()
      );
      expect(await analisisDe(id)).toHaveLength(1);

      const r = await admin("DELETE", `/growth/admin/competidores/${id}`);
      expect(r.statusCode).toBe(204);
      expect(await prisma.growthCompetidor.count()).toBe(0);
      expect(await prisma.growthCompetidorAnalisis.count()).toBe(0);
      expect(
        (await admin("DELETE", `/growth/admin/competidores/${id}`)).statusCode
      ).toBe(404);
    });

    it("DELETE rechaza un propuesto (es «rechazar») pero no uno del repositorio", async () => {
      const propuesto = await propuesta("https://nuevo-rival.com");
      expect(
        (await admin("DELETE", `/growth/admin/competidores/${propuesto}`))
          .statusCode
      ).toBe(204);

      const repo = await prisma.growthCompetidor.create({
        data: { nombre: "HeyDiga", dominio: "heydiga.ai" },
      });
      const r = await admin("DELETE", `/growth/admin/competidores/${repo.id}`);
      expect(r.statusCode).toBe(409);
      expect(r.json().codigo).toBe("competidor_del_repositorio");
      expect(await prisma.growthCompetidor.count()).toBe(1);
    });
  });

  // ── El tope de propuestas ──────────────────────────────────────────────

  describe("propuestas del agente", () => {
    it("con 20 propuestos esperando, la siguiente es un 409 demasiadas_propuestas; aceptar uno libera un hueco", async () => {
      for (let i = 0; i < 20; i++) {
        await prisma.growthCompetidor.create({
          data: {
            nombre: `Propuesto ${i}`,
            dominio: `propuesto-${i}.com`,
            origen: "agente",
            estado: "propuesto",
          },
        });
      }
      const nueva = {
        url: "https://uno-mas.com",
        nombre: "Uno más",
        motivo: "Sale en una lista",
      };
      const r = await agente("POST", "/growth/agente/competidores", nueva);
      expect(r.statusCode).toBe(409);
      expect(r.json().codigo).toBe("demasiadas_propuestas");

      // Un dominio que ya está propuesto no cuenta como propuesta nueva.
      const repetido = await agente("POST", "/growth/agente/competidores", {
        ...nueva,
        url: "https://propuesto-3.com/precios",
      });
      expect(repetido.statusCode).toBe(200);
      expect(repetido.json().existente).toBe(true);

      const uno = await prisma.growthCompetidor.findUniqueOrThrow({
        where: { dominio: "propuesto-0.com" },
      });
      await admin("POST", `/growth/admin/competidores/${uno.id}/aceptar`, {});
      expect(
        (await agente("POST", "/growth/agente/competidores", nueva)).statusCode
      ).toBe(201);
    });

    it("propuestas a la vez cerca del tope no lo sobrepasan", async () => {
      for (let i = 0; i < 18; i++) {
        await prisma.growthCompetidor.create({
          data: {
            nombre: `Propuesto ${i}`,
            dominio: `propuesto-${i}.com`,
            origen: "agente",
            estado: "propuesto",
          },
        });
      }
      const respuestas = await Promise.all(
        Array.from({ length: 6 }, (_, i) =>
          agente("POST", "/growth/agente/competidores", {
            url: `https://nuevo-${i}.com`,
            nombre: `Nuevo ${i}`,
            motivo: "Sale en una lista",
          })
        )
      );
      expect(respuestas.filter((r) => r.statusCode === 201)).toHaveLength(2);
      expect(respuestas.filter((r) => r.statusCode === 409)).toHaveLength(4);
      expect(
        await prisma.growthCompetidor.count({ where: { estado: "propuesto" } })
      ).toBe(20);
    });

    it("alhabla.ai no se puede proponer", async () => {
      const r = await agente("POST", "/growth/agente/competidores", {
        url: "https://alhabla.ai/blog",
        nombre: "Nosotros",
        motivo: "Prueba",
      });
      expect(r.statusCode).toBe(400);
      expect(r.json().codigo).toBe("dominio_propio");
      expect(await prisma.growthCompetidor.count()).toBe(0);
    });
  });

  // ── Alcances ───────────────────────────────────────────────────────────

  describe("alcances y puertas", () => {
    it("un token sin «escribir» no guarda análisis ni propone; uno sin «leer» no lista", async () => {
      const { id } = await altaDeCompetidor("https://rival.com");

      const guardar = await agente(
        "POST",
        `/growth/agente/competidores/${id}/analisis`,
        analisisNuevo(),
        tokenSoloLeer
      );
      expect(guardar.statusCode).toBe(403);
      const proponer = await agente(
        "POST",
        "/growth/agente/competidores",
        { url: "https://nuevo.com", nombre: "Nuevo", motivo: "Prueba" },
        tokenSoloLeer
      );
      expect(proponer.statusCode).toBe(403);
      expect(await analisisDe(id)).toHaveLength(0);
      expect(
        await prisma.growthCompetidor.count({ where: { origen: "agente" } })
      ).toBe(0);

      const listar = await agente(
        "GET",
        "/growth/agente/competidores",
        undefined,
        tokenSoloEscribir
      );
      expect(listar.statusCode).toBe(403);
      expect(
        (
          await agente(
            "GET",
            "/growth/agente/competidores",
            undefined,
            tokenSoloLeer
          )
        ).statusCode
      ).toBe(200);
    });

    it("el token del agente no abre ninguna ruta de administración de competidores (aceptar, quitar y revisar incluidas)", async () => {
      const propuesto = await propuesta("https://nuevo-rival.com");
      const manual = await altaDeCompetidor("https://rival.com");
      await agente(
        "POST",
        `/growth/agente/competidores/${manual.id}/analisis`,
        analisisNuevo()
      );
      const [a] = await analisisDe(manual.id);

      const rutas: [
        "GET" | "POST" | "PATCH" | "DELETE",
        string,
        object | undefined,
      ][] = [
        ["GET", "/growth/admin/competidores", undefined],
        ["POST", "/growth/admin/competidores", { url: "https://x-rival.com" }],
        ["GET", `/growth/admin/competidores/${manual.id}`, undefined],
        ["PATCH", `/growth/admin/competidores/${manual.id}`, { nombre: "X" }],
        ["DELETE", `/growth/admin/competidores/${manual.id}`, undefined],
        ["POST", `/growth/admin/competidores/${propuesto}/aceptar`, {}],
        ["POST", `/growth/admin/competidores/${manual.id}/reanalizar`, {}],
        [
          "GET",
          `/growth/admin/competidores/${manual.id}/analisis/${a!.id}`,
          undefined,
        ],
        [
          "POST",
          `/growth/admin/competidores/${manual.id}/analisis/${a!.id}/revisar`,
          {},
        ],
      ];
      for (const [metodo, url, payload] of rutas) {
        const r = await fastify.inject({
          method: metodo,
          url,
          headers: comoAgente(),
          payload,
        });
        expect(r.statusCode, `${metodo} ${url}`).toBe(401);
      }
      // Nada cambió.
      expect(
        (
          await prisma.growthCompetidor.findUniqueOrThrow({
            where: { id: propuesto },
          })
        ).estado
      ).toBe("propuesto");
      expect(await prisma.growthCompetidor.count()).toBe(2);
      expect((await analisisDe(manual.id))[0]!.revisadoEn).toBeNull();
    });

    it("un JWT de cliente recibe 401 en todo lo nuevo, del administrador y del agente", async () => {
      const jwtDeCliente =
        "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJ1MSIsImJ1c2luZXNzSWQiOiJiMSJ9.firma";
      const { id } = await altaDeCompetidor("https://rival.com");
      const rutas: [
        "GET" | "POST" | "PATCH" | "DELETE",
        string,
        object | undefined,
      ][] = [
        ["GET", "/growth/admin/competidores", undefined],
        ["POST", "/growth/admin/competidores", { url: "https://x-rival.com" }],
        ["GET", `/growth/admin/competidores/${id}`, undefined],
        ["PATCH", `/growth/admin/competidores/${id}`, { nombre: "X" }],
        ["DELETE", `/growth/admin/competidores/${id}`, undefined],
        ["POST", `/growth/admin/competidores/${id}/aceptar`, {}],
        ["POST", `/growth/admin/competidores/${id}/reanalizar`, {}],
        ["GET", `/growth/admin/competidores/${id}/analisis/a1`, undefined],
        ["POST", `/growth/admin/competidores/${id}/analisis/a1/revisar`, {}],
        ["GET", "/growth/admin/oportunidades?menciona=rival.com", undefined],
        ["GET", "/growth/agente/competidores", undefined],
        [
          "POST",
          "/growth/agente/competidores",
          { url: "https://n.com", nombre: "N", motivo: "M" },
        ],
        ["POST", `/growth/agente/competidores/${id}/analisis`, analisisNuevo()],
      ];
      for (const [metodo, url, payload] of rutas) {
        const r = await fastify.inject({
          method: metodo,
          url,
          headers: { authorization: `Bearer ${jwtDeCliente}` },
          payload,
        });
        expect(r.statusCode, `${metodo} ${url}`).toBe(401);
      }
      expect(await prisma.growthCompetidor.count()).toBe(1);
    });
  });

  // ── Oportunidades que mencionan a la competencia ───────────────────────

  describe("menciones: competidoresMencionados y el filtro ?menciona=", () => {
    const crearOportunidad = (
      url: string,
      datos?: Record<string, unknown>
    ): Promise<Respuesta> =>
      agente("POST", "/growth/agente/oportunidades", {
        url,
        titulo: "Mejores recepcionistas de IA",
        extracto: "Una lista de herramientas.",
        objetivoPrincipal: "BACKLINKS",
        puntBacklinks: 80,
        ...(datos ? { datos } : {}),
      });

    async function escenario() {
      await prisma.growthCompetidor.createMany({
        data: [
          { nombre: "HeyDiga", dominio: "heydiga.ai" },
          { nombre: "fonio", dominio: "fonio.ai" },
        ],
      });
      await propuesta("https://propuesto.io"); // no cuenta
      const a = await crearOportunidad("https://lista-a.es/mejores", {
        tipoDestino: "directorio",
        competidoresMencionados: [
          "www.HeyDiga.ai",
          "heydiga.ai",
          "app.fonio.ai",
        ],
      });
      const b = await crearOportunidad("https://lista-b.es/mejores", {
        tipoDestino: "comparativa",
        competidoresMencionados: ["fonio.ai"],
      });
      const c = await crearOportunidad("https://lista-c.es/mejores", {
        tipoDestino: "directorio",
      });
      for (const r of [a, b, c]) expect(r.statusCode).toBe(201);
      return { a: a.json().id, b: b.json().id, c: c.json().id };
    }

    it("guarda los dominios canónicos, sin duplicados, y los subdominios se reducen al competidor", async () => {
      const { a } = await escenario();
      const fila = await prisma.growthOportunidad.findUniqueOrThrow({
        where: { id: a },
      });
      expect(
        (fila.datos as Record<string, unknown>).competidoresMencionados
      ).toEqual(["heydiga.ai", "fonio.ai"]);
    });

    it("?menciona= devuelve solo las que llevan ese dominio (con o sin www y en mayúsculas) y ajusta los conteos", async () => {
      const { a, b } = await escenario();

      const heydiga = await admin(
        "GET",
        "/growth/admin/oportunidades?menciona=WWW.HeyDiga.ai"
      );
      expect(heydiga.statusCode).toBe(200);
      expect(heydiga.json().data.map((o: { id: string }) => o.id)).toEqual([a]);
      expect(heydiga.json().total).toBe(1);
      expect(heydiga.json().conteos.porEstado.detectada).toBe(1);
      expect(heydiga.json().data[0].datos.competidoresMencionados).toEqual([
        "heydiga.ai",
        "fonio.ai",
      ]);

      const fonio = await admin(
        "GET",
        "/growth/admin/oportunidades?menciona=fonio.ai&orden=recientes"
      );
      expect(
        fonio
          .json()
          .data.map((o: { id: string }) => o.id)
          .sort()
      ).toEqual([a, b].sort());
      expect(fonio.json().conteos.porEstado.detectada).toBe(2);

      // Sin filtro, las tres; con un dominio que nadie menciona, ninguna.
      expect(
        (await admin("GET", "/growth/admin/oportunidades")).json().total
      ).toBe(3);
      expect(
        (
          await admin("GET", "/growth/admin/oportunidades?menciona=nadie.com")
        ).json().total
      ).toBe(0);
    });

    it("?menciona= se combina con tipoDestino sin pisarlo", async () => {
      const { a } = await escenario();
      const r = await admin(
        "GET",
        "/growth/admin/oportunidades?menciona=fonio.ai&tipoDestino=directorio"
      );
      expect(r.json().data.map((o: { id: string }) => o.id)).toEqual([a]);
      const ninguna = await admin(
        "GET",
        "/growth/admin/oportunidades?menciona=heydiga.ai&tipoDestino=comparativa"
      );
      expect(ninguna.json().total).toBe(0);
    });

    it("el listado de competidores cuenta las menciones y las oportunidades del dominio y sus subdominios", async () => {
      await escenario();
      await sembrarOportunidad({
        id: "o-propia-1",
        dominio: "heydiga.ai",
        estado: "detectada",
      });
      await sembrarOportunidad({
        id: "o-propia-2",
        dominio: "blog.heydiga.ai",
        estado: "detectada",
      });
      await sembrarOportunidad({
        id: "o-ajena",
        dominio: "xheydiga.ai",
        estado: "detectada",
      });
      const { data } = (
        await admin("GET", "/growth/admin/competidores")
      ).json();
      const por = Object.fromEntries(
        data.map((c: { dominio: string }) => [c.dominio, c])
      );
      expect(por["heydiga.ai"]).toMatchObject({
        menciones: 1,
        oportunidades: 2,
      });
      expect(por["fonio.ai"]).toMatchObject({ menciones: 2, oportunidades: 0 });
      expect(por["propuesto.io"]).toMatchObject({
        menciones: 0,
        estado: "propuesto",
      });
      // Por nombre.
      expect(data.map((c: { nombre: string }) => c.nombre)).toEqual(
        [...data.map((c: { nombre: string }) => c.nombre)].sort((x, y) =>
          x.localeCompare(y)
        )
      );
    });

    it("un dominio que no es de un competidor confirmado (inventado, propuesto o que solo termina igual) es un 400 competidor_desconocido con la lista, y no crea nada", async () => {
      await prisma.growthCompetidor.create({
        data: { nombre: "HeyDiga", dominio: "heydiga.ai" },
      });
      await propuesta("https://propuesto.io");
      const r = await crearOportunidad("https://lista-x.es/mejores", {
        competidoresMencionados: [
          "heydiga.ai",
          "inventado.com",
          "propuesto.io",
          "xheydiga.ai",
        ],
      });
      expect(r.statusCode).toBe(400);
      expect(r.json()).toMatchObject({
        codigo: "competidor_desconocido",
        dominios: ["inventado.com", "propuesto.io", "xheydiga.ai"],
      });
      expect(await prisma.growthOportunidad.count()).toBe(0);
    });

    it("calificar y volver a calificar con las mismas menciones es un 200; con menciones inventadas, un 400", async () => {
      await prisma.growthCompetidor.create({
        data: { nombre: "HeyDiga", dominio: "heydiga.ai" },
      });
      const { id } = (
        await crearOportunidad("https://lista-y.es/mejores")
      ).json();
      const calificacion = {
        puntBacklinks: 90,
        datos: { competidoresMencionados: ["www.heydiga.ai", "heydiga.ai"] },
      };
      const ok = await agente(
        "POST",
        `/growth/agente/oportunidades/${id}/calificacion`,
        calificacion
      );
      expect(ok.statusCode).toBe(200);
      expect(ok.json().estado).toBe("calificada");
      const repetida = await agente(
        "POST",
        `/growth/agente/oportunidades/${id}/calificacion`,
        calificacion
      );
      expect(repetida.statusCode).toBe(200);

      const mala = await crearOportunidad("https://lista-z.es/mejores");
      const rechazada = await agente(
        "POST",
        `/growth/agente/oportunidades/${mala.json().id}/calificacion`,
        {
          puntBacklinks: 90,
          datos: { competidoresMencionados: ["inventado.com"] },
        }
      );
      expect(rechazada.statusCode).toBe(400);
      expect(rechazada.json().codigo).toBe("competidor_desconocido");
    });
  });

  // ── Un propuesto no aplica reglas duras ────────────────────────────────

  describe("gates: un propuesto NO aplica reglas duras y un por_analizar SÍ", () => {
    async function calificarPagina(url: string) {
      const creada = await agente("POST", "/growth/agente/oportunidades", {
        url,
        titulo: "Una página",
        extracto: "Contenido de la página.",
        objetivoPrincipal: "BACKLINKS",
        puntBacklinks: 90,
      });
      expect(creada.statusCode).toBe(201);
      return agente(
        "POST",
        `/growth/agente/oportunidades/${creada.json().id}/calificacion`,
        { puntBacklinks: 90 }
      );
    }

    it("al calificar: una página (o un subdominio) de un propuesto NO se descarta; la de un por_analizar sí, y tras aceptar el propuesto también", async () => {
      await propuesta("https://www.rival-propuesto.com");
      await altaDeCompetidor("https://rival-confirmado.com");

      const deLaPropuesta = await calificarPagina(
        "https://blog.rival-propuesto.com/articulo"
      );
      expect(deLaPropuesta.statusCode).toBe(200);
      expect(deLaPropuesta.json()).toEqual({
        id: expect.any(String),
        estado: "calificada",
      });

      const deLaConfirmada = await calificarPagina(
        "https://blog.rival-confirmado.com/articulo"
      );
      expect(deLaConfirmada.json()).toMatchObject({
        estado: "descartada",
        descartadaPorReglas: true,
        codigoDescarte: "competidor",
      });

      const propuesto = await prisma.growthCompetidor.findUniqueOrThrow({
        where: { dominio: "rival-propuesto.com" },
      });
      await admin(
        "POST",
        `/growth/admin/competidores/${propuesto.id}/aceptar`,
        {}
      );
      const tras = await calificarPagina("https://rival-propuesto.com/otra");
      expect(tras.json()).toMatchObject({
        estado: "descartada",
        codigoDescarte: "competidor",
      });
    });

    it("el contexto del agente lista como competidores solo a los confirmados", async () => {
      await propuesta("https://rival-propuesto.com");
      await altaDeCompetidor("https://rival-confirmado.com");
      const { competidores } = (
        await agente("GET", "/growth/agente/contexto")
      ).json();
      expect(competidores.map((c: { dominio: string }) => c.dominio)).toEqual([
        "rival-confirmado.com",
      ]);
    });

    it("regla 3 al redactar: nombrar a un propuesto no bloquea el borrador; nombrar a un por_analizar sí; y tras aceptarlo también", async () => {
      await prisma.growthCompetidor.createMany({
        data: [
          {
            nombre: "Rivalpropuesto",
            dominio: "rivalpropuesto.com",
            origen: "agente",
            estado: "propuesto",
          },
          { nombre: "Rivalconfirmado", dominio: "rivalconfirmado.com" },
        ],
      });
      const borradorQueNombra = async (id: string, nombre: string) => {
        await sembrarOportunidad({ id, estado: "investigada" });
        const r = await agente(
          "POST",
          `/growth/agente/oportunidades/${id}/borradores`,
          {
            tipo: "email",
            asunto: "Alhabla en vuestro directorio",
            texto: `${TEXTO_QUE_CUMPLE} Somos otra opción distinta de ${nombre}.`,
            enlaceUrl: "https://alhabla.ai/peluquerias?utm_source=listado",
          }
        );
        expect(r.statusCode).toBe(201);
        const regla3 = (
          r.json().comprobaciones as { regla: string; ok: boolean }[]
        ).find((c) => c.regla === "comparativa_con_fuente")!;
        return { resultado: r.json().resultado as string, regla3 };
      };

      const conPropuesto = await borradorQueNombra(
        "o-propuesto",
        "Rivalpropuesto"
      );
      expect(conPropuesto.regla3.ok).toBe(true);
      expect(conPropuesto.resultado).not.toBe("bloquea");

      const conConfirmado = await borradorQueNombra(
        "o-confirmado",
        "Rivalconfirmado"
      );
      expect(conConfirmado.regla3.ok).toBe(false);
      expect(conConfirmado.resultado).toBe("bloquea");

      const propuesto = await prisma.growthCompetidor.findUniqueOrThrow({
        where: { dominio: "rivalpropuesto.com" },
      });
      await admin(
        "POST",
        `/growth/admin/competidores/${propuesto.id}/aceptar`,
        {}
      );
      const tras = await borradorQueNombra("o-tras", "Rivalpropuesto");
      expect(tras.regla3.ok).toBe(false);
      expect(tras.resultado).toBe("bloquea");
    });

    it("un análisis guardado NO desbloquea nombrar al competidor: la regla 3 solo admite comparativa.*", async () => {
      const { id } = await altaDeCompetidor(
        "https://rivalanalizado.com",
        "Rivalanalizado"
      );
      await agente(
        "POST",
        `/growth/agente/competidores/${id}/analisis`,
        analisisNuevo()
      );
      await sembrarOportunidad({ id: "o-analizado", estado: "investigada" });
      const r = await agente(
        "POST",
        "/growth/agente/oportunidades/o-analizado/borradores",
        {
          tipo: "email",
          asunto: "Alhabla en vuestro directorio",
          texto: `${TEXTO_QUE_CUMPLE} Somos otra opción distinta de Rivalanalizado, que cuesta 99 € al mes.`,
          enlaceUrl: "https://alhabla.ai/peluquerias?utm_source=listado",
        }
      );
      expect(r.statusCode).toBe(201);
      expect(r.json().resultado).toBe("bloquea");
      expect(
        (r.json().comprobaciones as { regla: string; ok: boolean }[]).find(
          (c) => c.regla === "comparativa_con_fuente"
        )!.ok
      ).toBe(false);
    });
  });

  // ── Sincronizador y retención ──────────────────────────────────────────

  describe("el sincronizador y la retención no tocan lo del administrador", () => {
    let carga: ResultadoDeConstruccion;

    beforeAll(async () => {
      carga = construirAfirmaciones(await cargarEntrada(RAIZ));
    }, 30_000);

    const lote = () =>
      SincronizarBody.parse({
        commitSha: "a".repeat(40),
        tipos: carga.tipos,
        afirmaciones: carga.afirmaciones,
        competidores: carga.competidores,
        nichos: carga.nichos,
        paginas: carga.paginas,
      });

    it("siembra con origen repo y por_analizar, y no pisa la URL, el estado, el origen ni las notas de una fila existente (tampoco la de un propuesto)", async () => {
      const [primero, segundo] = carga.competidores;
      expect(primero && segundo).toBeTruthy();
      // El administrador ya tenía a uno (revisado, con URL y notas) y el agente
      // había propuesto al otro.
      const mio = await prisma.growthCompetidor.create({
        data: {
          nombre: "Nombre del administrador",
          dominio: primero!.dominio,
          url: `https://${primero!.dominio}/precios`,
          notas: "Notas mías",
          origen: "manual",
          estado: "revisado",
          analisisSolicitadoEn: hace(3),
        },
      });
      await prisma.growthCompetidorAnalisis.create({
        data: {
          competidorId: mio.id,
          version: 1,
          resumen: "Lo que ya sabía",
          datos: [datoDePrecio()],
          creadoPor: "agente",
          revisadoEn: hace(1),
        },
      });
      const propuesto = await prisma.growthCompetidor.create({
        data: {
          nombre: "Propuesto por el agente",
          dominio: segundo!.dominio,
          url: `https://${segundo!.dominio}`,
          origen: "agente",
          estado: "propuesto",
        },
      });

      await sincronizarConocimiento(lote(), {
        agente: { nombre: "conocimiento-semanal" },
      });

      expect(
        await prisma.growthCompetidor.findUniqueOrThrow({
          where: { id: mio.id },
        })
      ).toEqual(mio);
      expect(
        await prisma.growthCompetidor.findUniqueOrThrow({
          where: { id: propuesto.id },
        })
      ).toEqual(propuesto);
      expect(await analisisDe(mio.id)).toHaveLength(1);

      // Los demás se sembraron como repo / por analizar, sin URL.
      const sembrados = await prisma.growthCompetidor.findMany({
        where: { id: { notIn: [mio.id, propuesto.id] } },
      });
      expect(sembrados).toHaveLength(carga.competidores.length - 2);
      for (const s of sembrados) {
        expect(s).toMatchObject({
          origen: "repo",
          estado: "por_analizar",
          url: null,
          notas: null,
          analisisSolicitadoEn: null,
        });
      }

      // Una segunda pasada no cambia nada.
      const antes = await prisma.growthCompetidor.findMany({
        orderBy: { id: "asc" },
      });
      await sincronizarConocimiento(lote(), {
        agente: { nombre: "conocimiento-semanal" },
      });
      expect(
        await prisma.growthCompetidor.findMany({ orderBy: { id: "asc" } })
      ).toEqual(antes);
    }, 30_000);

    it("la purga de retención no borra los análisis de competidores", async () => {
      const { id } = await altaDeCompetidor("https://rival.com");
      await agente(
        "POST",
        `/growth/agente/competidores/${id}/analisis`,
        analisisNuevo()
      );
      await prisma.growthCompetidorAnalisis.updateMany({
        where: { competidorId: id },
        data: { creadoEn: hace(400) },
      });
      await prisma.growthCompetidor.update({
        where: { id },
        data: { creadoEn: hace(400) },
      });

      await purgarRetencionDeGrowthJob(new Date(Date.now() + 365 * 86_400_000));

      expect(await prisma.growthCompetidor.count()).toBe(1);
      expect(await analisisDe(id)).toHaveLength(1);
    });
  });

  // ── Logs ───────────────────────────────────────────────────────────────

  describe("logs", () => {
    it("guardar un análisis no imprime su resumen ni sus datos", async () => {
      const salidas: string[] = [];
      const espias = (["log", "info", "warn", "error"] as const).map((nivel) =>
        vi.spyOn(console, nivel).mockImplementation((...args: unknown[]) => {
          salidas.push(args.map(String).join(" "));
        })
      );
      const { id } = await altaDeCompetidor("https://rival.com");
      const secreto = "TEXTO-DE-UN-TERCERO-QUE-NO-DEBE-SALIR-EN-LOS-LOGS";
      const r = await agente(
        "POST",
        `/growth/agente/competidores/${id}/analisis`,
        {
          resumen: secreto,
          datos: [datoDePrecio({ texto: secreto, etiqueta: secreto })],
        }
      );
      expect(r.statusCode).toBe(201);
      for (const espia of espias) espia.mockRestore();
      expect(salidas.join("\n")).not.toContain(secreto);
    });
  });
});
