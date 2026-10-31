import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify from "fastify";
import { growthRoutes } from "../../../src/modules/growth/routes.js";
import {
  PASOS_GENERICOS_DE_UNA_TAREA,
  TAREAS_INICIALES,
  filaDeTareaInicial,
} from "../../../src/modules/growth/tareasIniciales.js";
import { ordenarTareas } from "../../../src/modules/growth/servicioTareas.js";
import {
  CATEGORIAS_DE_TAREA,
  MAXIMO_DE_CARACTERES_DE_UN_PASO,
  MAXIMO_DE_PASOS_DE_UNA_TAREA,
} from "../../../src/modules/growth/esquemas.js";
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
 * Panel útil — las tareas a mano con Prisma de mentira: la siembra, la forma de
 * cada respuesta, la validación de los cuerpos, las transiciones y que solo
 * entre el administrador. Lo que depende de Postgres (índice único, siembra en
 * paralelo, sentencias atómicas) está en
 * tests/integration/growth/f3a-panel-util.test.ts.
 */

type Fila = Record<string, unknown>;

function filaDeTarea(cambios: Fila = {}) {
  return {
    id: "t1",
    titulo: "Una tarea",
    dominio: "ejemplo.com",
    url: "https://ejemplo.com/alta",
    categoria: "otro",
    pasos: ["Abre la página."],
    notas: null,
    origen: "manual",
    siembra: null,
    estado: "pendiente",
    resultado: null,
    notaDeResultado: null,
    hechaEn: null,
    creadoEn: new Date("2026-10-31T10:00:00.000Z"),
    orden: 0,
    ...cambios,
  };
}

const CLAVES_DE_TAREA = [
  "id",
  "titulo",
  "dominio",
  "url",
  "categoria",
  "pasos",
  "notas",
  "origen",
  "estado",
  "resultado",
  "notaDeResultado",
  "hechaEn",
  "creadoEn",
  "orden",
].sort();

describe("panel útil: tareas a mano (Prisma de mentira)", () => {
  let fastify: ReturnType<typeof Fastify>;

  const admin = (
    metodo: "GET" | "POST" | "PATCH" | "DELETE",
    url: string,
    payload?: unknown
  ) =>
    fastify.inject({
      method: metodo,
      url,
      headers: comoAdmin(),
      payload: payload as object | undefined,
    });

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
    fastify = Fastify();
    await fastify.register(growthRoutes);
  });

  afterEach(async () => {
    await fastify.close();
    vi.restoreAllMocks();
  });

  // ── Las tareas iniciales ────────────────────────────────────────────────

  describe("las tareas iniciales", () => {
    const filas = TAREAS_INICIALES.map(filaDeTareaInicial);

    it("son las once del contrato, con claves de siembra únicas y orden creciente", () => {
      expect(TAREAS_INICIALES.map((t) => t.dominio)).toEqual([
        "capterra.com",
        "g2.com",
        "sourceforge.net",
        "softwaredoit.es",
        "alternativeto.net",
        "selecthub.com",
        "stork.ai",
        "aiagentsdirectory.com",
        "toolradar.com",
        "topai.tools",
        "beautymarket.es",
      ]);
      expect(new Set(filas.map((f) => f.siembra)).size).toBe(filas.length);
      expect(filas.map((f) => f.orden)).toEqual(
        [...filas.map((f) => f.orden)].sort((a, b) => a - b)
      );
      expect(new Set(filas.map((f) => f.orden)).size).toBe(filas.length);
    });

    it("todas son del repositorio, con una URL https, una categoría y unos pasos que caben en los límites", () => {
      for (const f of filas) {
        expect(f.origen, f.siembra).toBe("repo");
        expect(f.url, f.siembra).toMatch(/^https:\/\//);
        expect(new URL(f.url).hostname.replace(/^www\./, ""), f.siembra).toBe(
          f.dominio
        );
        expect(CATEGORIAS_DE_TAREA, f.siembra).toContain(f.categoria);
        expect(f.pasos.length, f.siembra).toBeLessThanOrEqual(
          MAXIMO_DE_PASOS_DE_UNA_TAREA
        );
        for (const paso of f.pasos) {
          expect(paso.length, f.siembra).toBeLessThanOrEqual(
            MAXIMO_DE_CARACTERES_DE_UN_PASO
          );
        }
        if (f.notas) expect(f.notas.length).toBeLessThanOrEqual(1000);
        expect(f.dominio, f.siembra).not.toMatch(/^www\./);
      }
      expect(PASOS_GENERICOS_DE_UNA_TAREA.length).toBeGreaterThan(0);
    });

    it("solo Beautymarket viene hecha (en revisión, con la nota del fundador); las demás, pendientes y sin resultado", () => {
      const hechas = filas.filter((f) => f.estado === "hecha");
      expect(hechas).toHaveLength(1);
      expect(hechas[0]).toMatchObject({
        dominio: "beautymarket.es",
        categoria: "sector",
        resultado: "en_revision",
        notaDeResultado: "Ficha enviada por el fundador el 31-10-2026.",
      });
      expect(hechas[0].hechaEn!.toISOString().slice(0, 10)).toBe("2026-10-31");
      for (const f of filas.filter((f) => f.estado === "pendiente")) {
        expect(f.resultado).toBeNull();
        expect(f.hechaEn).toBeNull();
        expect(f.notaDeResultado).toBeNull();
      }
    });

    it("las categorías del contrato: software, IA y sector", () => {
      const porDominio = Object.fromEntries(
        filas.map((f) => [f.dominio, f.categoria])
      );
      expect(porDominio).toMatchObject({
        "capterra.com": "directorio_software",
        "g2.com": "directorio_software",
        "softwaredoit.es": "directorio_software",
        "stork.ai": "directorio_ia",
        "aiagentsdirectory.com": "directorio_ia",
        "toolradar.com": "directorio_ia",
        "topai.tools": "directorio_ia",
        "beautymarket.es": "sector",
      });
    });

    it("lo que dice haberse leído por búsqueda lo dice como «sin confirmar»", () => {
      for (const dominio of ["capterra.com", "g2.com"]) {
        const f = filas.find((x) => x.dominio === dominio)!;
        expect(f.notas).toContain("Por búsqueda, sin confirmar");
        expect(f.notas).toContain("El agente recibe 403");
      }
    });
  });

  // ── Listado y siembra ───────────────────────────────────────────────────

  describe("GET /growth/admin/tareas", () => {
    /** `findMany` de la siembra (con `select`) o del listado (sin él). */
    function baseConLasSembradas(sembradas: string[], todas: Fila[] = []) {
      mock.growthTarea.findMany.mockImplementation(
        async (args?: { select?: unknown }) =>
          args?.select ? sembradas.map((siembra) => ({ siembra })) : todas
      );
    }

    it("con la tabla vacía siembra las once, en una transacción con cerrojo y con skipDuplicates", async () => {
      baseConLasSembradas([]);
      const r = await admin("GET", "/growth/admin/tareas");
      expect(r.statusCode).toBe(200);
      expect(mock.$transaction).toHaveBeenCalledTimes(1);
      expect(mock.$executeRaw).toHaveBeenCalledTimes(1);
      expect(mock.growthTarea.createMany).toHaveBeenCalledTimes(1);
      const [args] = mock.growthTarea.createMany.mock.calls[0];
      expect(args.skipDuplicates).toBe(true);
      expect(args.data).toHaveLength(TAREAS_INICIALES.length);
      expect(args.data.map((d: Fila) => d.siembra)).toEqual(
        TAREAS_INICIALES.map((t) => t.siembra)
      );
    });

    it("si ya están todas no escribe nada ni abre una transacción", async () => {
      baseConLasSembradas(TAREAS_INICIALES.map((t) => t.siembra));
      const r = await admin("GET", "/growth/admin/tareas");
      expect(r.statusCode).toBe(200);
      expect(mock.$transaction).not.toHaveBeenCalled();
      expect(mock.growthTarea.createMany).not.toHaveBeenCalled();
    });

    it("si falta alguna, inserta solo las que faltan (una que se hubiera añadido a la lista después)", async () => {
      const faltan = ["g2", "beautymarket"];
      baseConLasSembradas(
        TAREAS_INICIALES.map((t) => t.siembra).filter(
          (s) => !faltan.includes(s)
        )
      );
      await admin("GET", "/growth/admin/tareas");
      const [args] = mock.growthTarea.createMany.mock.calls[0];
      expect(args.data.map((d: Fila) => d.siembra)).toEqual(faltan);
    });

    it("la lectura dentro del cerrojo vuelve a mirar: si otra petición ya sembró, no inserta nada", async () => {
      let lecturas = 0;
      mock.growthTarea.findMany.mockImplementation(
        async (args?: { select?: unknown }) => {
          if (!args?.select) return [];
          lecturas += 1;
          // Fuera del cerrojo faltaban; dentro, la otra petición ya las puso.
          return lecturas === 1
            ? []
            : TAREAS_INICIALES.map((t) => ({ siembra: t.siembra }));
        }
      );
      await admin("GET", "/growth/admin/tareas");
      expect(mock.$transaction).toHaveBeenCalledTimes(1);
      expect(mock.growthTarea.createMany).not.toHaveBeenCalled();
    });

    it("cada tarea lleva exactamente los campos del contrato, sin siembra", async () => {
      baseConLasSembradas(
        TAREAS_INICIALES.map((t) => t.siembra),
        [filaDeTarea({ siembra: "g2", origen: "repo" })]
      );
      const r = await admin("GET", "/growth/admin/tareas");
      const cuerpo = r.json();
      expect(Object.keys(cuerpo)).toEqual(["data"]);
      expect(Object.keys(cuerpo.data[0]).sort()).toEqual(CLAVES_DE_TAREA);
      expect(r.headers["cache-control"]).toBe("no-store");
    });

    it("ordena: pendientes, luego hechas, luego descartadas; dentro, por orden y por título", async () => {
      baseConLasSembradas(
        TAREAS_INICIALES.map((t) => t.siembra),
        [
          filaDeTarea({ id: "d", titulo: "A", estado: "descartada" }),
          filaDeTarea({ id: "h", titulo: "A", estado: "hecha", orden: 1 }),
          filaDeTarea({ id: "p3", titulo: "beta", orden: 20 }),
          filaDeTarea({ id: "p2", titulo: "Álamo", orden: 20 }),
          filaDeTarea({ id: "p1", titulo: "Zeta", orden: 10 }),
          filaDeTarea({ id: "p0", titulo: "Nueva", orden: 0 }),
        ]
      );
      const ids = (await admin("GET", "/growth/admin/tareas"))
        .json()
        .data.map((t: { id: string }) => t.id);
      expect(ids).toEqual(["p0", "p1", "p2", "p3", "h", "d"]);
    });

    it("ordenarTareas desempata por id y no toca el original", () => {
      const original = [
        { id: "b", estado: "pendiente", orden: 0, titulo: "X" },
        { id: "a", estado: "pendiente", orden: 0, titulo: "X" },
      ];
      expect(ordenarTareas(original).map((t) => t.id)).toEqual(["a", "b"]);
      expect(original.map((t) => t.id)).toEqual(["b", "a"]);
    });

    it("unos pasos que no son una lista de textos no rompen el listado", async () => {
      baseConLasSembradas(
        TAREAS_INICIALES.map((t) => t.siembra),
        [
          filaDeTarea({ pasos: { raro: true } }),
          filaDeTarea({ id: "t2", pasos: ["a", 3, null, "b"] }),
        ]
      );
      const r = await admin("GET", "/growth/admin/tareas");
      expect(r.statusCode).toBe(200);
      expect(r.json().data.map((t: Fila) => t.pasos)).toEqual([[], ["a", "b"]]);
    });
  });

  // ── Alta ────────────────────────────────────────────────────────────────

  describe("POST /growth/admin/tareas", () => {
    beforeEach(() => {
      mock.growthTarea.create.mockImplementation(
        async ({ data }: { data: Fila }) =>
          filaDeTarea({ id: "nueva", pasos: [], ...data })
      );
    });

    it("crea una tarea manual: 201, el dominio sale de la URL y los valores por defecto", async () => {
      const r = await admin("POST", "/growth/admin/tareas", {
        titulo: "  Un directorio nuevo  ",
        url: "https://www.Directorio.ejemplo.es/alta?ref=lista#paso1",
      });
      expect(r.statusCode).toBe(201);
      const [args] = mock.growthTarea.create.mock.calls[0];
      expect(args.data).toEqual({
        titulo: "Un directorio nuevo",
        url: "https://www.Directorio.ejemplo.es/alta?ref=lista#paso1",
        dominio: "directorio.ejemplo.es",
        categoria: "otro",
        pasos: [],
        notas: null,
        origen: "manual",
      });
      expect(r.json()).toMatchObject({
        id: "nueva",
        origen: "manual",
        estado: "pendiente",
      });
      expect(Object.keys(r.json()).sort()).toEqual(CLAVES_DE_TAREA);
    });

    it("guarda lo que se da: categoría, dominio normalizado, pasos y notas", async () => {
      await admin("POST", "/growth/admin/tareas", {
        titulo: "G2",
        url: "https://sell.g2.com/create-free-profile",
        categoria: "directorio_software",
        dominio: "WWW.G2.com",
        pasos: ["Uno", "Dos"],
        notas: "Perfil gratuito",
      });
      const [args] = mock.growthTarea.create.mock.calls[0];
      expect(args.data).toMatchObject({
        categoria: "directorio_software",
        dominio: "g2.com",
        pasos: ["Uno", "Dos"],
        notas: "Perfil gratuito",
        origen: "manual",
      });
    });

    it("un dominio en blanco o null equivale al de la URL; unas notas en blanco, a ninguna", async () => {
      for (const dominio of ["", null]) {
        mock.growthTarea.create.mockClear();
        const r = await admin("POST", "/growth/admin/tareas", {
          titulo: "X",
          url: "https://www.ejemplo.org/",
          dominio,
          notas: "  ",
        });
        expect(r.statusCode).toBe(201);
        expect(mock.growthTarea.create.mock.calls[0][0].data).toMatchObject({
          dominio: "ejemplo.org",
          notas: null,
        });
      }
    });

    it("un texto con emoji bien formado se guarda tal cual", async () => {
      const r = await admin("POST", "/growth/admin/tareas", {
        titulo: "Con emoji 🙂",
        url: "https://ejemplo.com/",
      });
      expect(r.statusCode).toBe(201);
      expect(mock.growthTarea.create.mock.calls[0][0].data.titulo).toBe(
        "Con emoji 🙂"
      );
    });

    const INVALIDOS: [string, Fila][] = [
      ["sin título", { url: "https://ejemplo.com/" }],
      ["título en blanco", { titulo: "   ", url: "https://ejemplo.com/" }],
      [
        "título de más de 200",
        { titulo: "x".repeat(201), url: "https://ejemplo.com/" },
      ],
      ["sin URL", { titulo: "X" }],
      ["URL que no es una URL", { titulo: "X", url: "esto no es una url" }],
      ["URL ftp", { titulo: "X", url: "ftp://ejemplo.com/" }],
      ["URL javascript", { titulo: "X", url: "javascript:alert(1)" }],
      ["URL data", { titulo: "X", url: "data:text/html,hola" }],
      [
        "URL con usuario y contraseña",
        { titulo: "X", url: "https://u:p@ejemplo.com/" },
      ],
      [
        "categoría inventada",
        { titulo: "X", url: "https://ejemplo.com/", categoria: "foro" },
      ],
      [
        "dominio que no lo es",
        {
          titulo: "X",
          url: "https://ejemplo.com/",
          dominio: "no es un dominio",
        },
      ],
      [
        "más de 12 pasos",
        {
          titulo: "X",
          url: "https://ejemplo.com/",
          pasos: Array(13).fill("p"),
        },
      ],
      [
        "un paso de más de 300",
        { titulo: "X", url: "https://ejemplo.com/", pasos: ["x".repeat(301)] },
      ],
      [
        "un paso en blanco",
        { titulo: "X", url: "https://ejemplo.com/", pasos: ["  "] },
      ],
      [
        "notas de más de 1000",
        { titulo: "X", url: "https://ejemplo.com/", notas: "x".repeat(1001) },
      ],
      [
        "un campo que no existe",
        { titulo: "X", url: "https://ejemplo.com/", origen: "repo" },
      ],
      [
        "un nulo dentro del título",
        { titulo: "a\u0000b", url: "https://ejemplo.com/" },
      ],
    ];
    for (const [nombre, cuerpo] of INVALIDOS) {
      it(`${nombre}: 400 y no se guarda nada`, async () => {
        const r = await admin("POST", "/growth/admin/tareas", cuerpo);
        expect(r.statusCode).toBe(400);
        expect(mock.growthTarea.create).not.toHaveBeenCalled();
      });
    }

    it("acepta justo los límites: 12 pasos de 300, notas de 1000, título de 200", async () => {
      const r = await admin("POST", "/growth/admin/tareas", {
        titulo: "x".repeat(200),
        url: "https://ejemplo.com/",
        pasos: Array(12).fill("p".repeat(300)),
        notas: "n".repeat(1000),
      });
      expect(r.statusCode).toBe(201);
    });

    it("el origen y la siembra no se pueden fijar desde fuera", async () => {
      const r = await admin("POST", "/growth/admin/tareas", {
        titulo: "X",
        url: "https://ejemplo.com/",
        siembra: "g2",
      });
      expect(r.statusCode).toBe(400);
    });
  });

  // ── Edición ─────────────────────────────────────────────────────────────

  describe("PATCH /growth/admin/tareas/:id", () => {
    beforeEach(() => {
      mock.growthTarea.findUnique.mockResolvedValue({ dominio: "g2.com" });
      mock.growthTarea.update.mockImplementation(
        async ({ data }: { data: Fila }) => filaDeTarea({ ...data })
      );
    });

    const parchea = (cuerpo: unknown) =>
      admin("PATCH", "/growth/admin/tareas/t1", cuerpo);

    it("cambia solo lo que llega", async () => {
      const r = await parchea({ titulo: "Nuevo título" });
      expect(r.statusCode).toBe(200);
      expect(mock.growthTarea.update.mock.calls[0][0]).toEqual({
        where: { id: "t1" },
        data: { titulo: "Nuevo título" },
      });
    });

    it("pasos y notas: una lista vacía vacía los pasos; null o en blanco quita las notas", async () => {
      await parchea({ pasos: [], notas: null });
      expect(mock.growthTarea.update.mock.calls[0][0].data).toEqual({
        pasos: [],
        notas: null,
      });
      mock.growthTarea.update.mockClear();
      await parchea({ notas: "   " });
      expect(mock.growthTarea.update.mock.calls[0][0].data).toEqual({
        notas: null,
      });
    });

    it("una URL de otro sitio sin dominio recalcula el dominio", async () => {
      await parchea({ url: "https://www.capterra.com/alta" });
      expect(mock.growthTarea.update.mock.calls[0][0].data).toEqual({
        url: "https://www.capterra.com/alta",
        dominio: "capterra.com",
      });
    });

    it("una URL del mismo sitio (o de un subdominio) deja el dominio como está", async () => {
      await parchea({ url: "https://sell.g2.com/create-free-profile" });
      expect(mock.growthTarea.update.mock.calls[0][0].data).toEqual({
        url: "https://sell.g2.com/create-free-profile",
      });
    });

    it("un sitio que solo termina igual no cuenta como el mismo (nog2.com no es g2.com)", async () => {
      await parchea({ url: "https://nog2.com/" });
      expect(mock.growthTarea.update.mock.calls[0][0].data).toMatchObject({
        dominio: "nog2.com",
      });
    });

    it("un dominio explícito manda sobre la URL; null lo quita", async () => {
      await parchea({ url: "https://capterra.com/", dominio: "gartner.com" });
      expect(mock.growthTarea.update.mock.calls[0][0].data).toMatchObject({
        dominio: "gartner.com",
      });
      mock.growthTarea.update.mockClear();
      await parchea({ dominio: null });
      expect(mock.growthTarea.update.mock.calls[0][0].data).toEqual({
        dominio: null,
      });
    });

    it("una tarea sin dominio y una URL nueva toma el de la URL", async () => {
      mock.growthTarea.findUnique.mockResolvedValue({ dominio: null });
      await parchea({ url: "https://nuevo.es/x" });
      expect(mock.growthTarea.update.mock.calls[0][0].data).toMatchObject({
        dominio: "nuevo.es",
      });
    });

    it("sin ningún campo: 400", async () => {
      expect((await parchea({})).statusCode).toBe(400);
      expect(mock.growthTarea.update).not.toHaveBeenCalled();
    });

    it("los campos que no se cambian por aquí (origen, estado, siembra, resultado…) se rechazan", async () => {
      for (const campo of [
        "origen",
        "estado",
        "siembra",
        "resultado",
        "hechaEn",
        "id",
      ]) {
        const r = await parchea({ titulo: "X", [campo]: "x" });
        expect(r.statusCode, campo).toBe(400);
      }
      expect(mock.growthTarea.update).not.toHaveBeenCalled();
    });

    it("valida como el alta: URL que no es http(s) y demasiados pasos, 400", async () => {
      expect((await parchea({ url: "javascript:alert(1)" })).statusCode).toBe(
        400
      );
      expect((await parchea({ pasos: Array(13).fill("p") })).statusCode).toBe(
        400
      );
    });

    it("una tarea que no existe: 404", async () => {
      mock.growthTarea.findUnique.mockResolvedValue(null);
      const r = await parchea({ titulo: "X" });
      expect(r.statusCode).toBe(404);
      expect(r.json()).toEqual({ error: "La tarea no existe." });
    });

    it("una tarea borrada entre la lectura y el cambio: 404, no 500", async () => {
      mock.growthTarea.update.mockRejectedValue(
        Object.assign(new Error("no existe"), { code: "P2025" })
      );
      expect((await parchea({ titulo: "X" })).statusCode).toBe(404);
    });
  });

  // ── Estados ─────────────────────────────────────────────────────────────

  describe("hecha, descartar y reabrir", () => {
    /** El estado de una tarea, con las sentencias condicionadas como en Postgres. */
    function tareaEnLaBase(inicial: Fila | null) {
      let fila = inicial ? { ...inicial } : null;
      const cumple = (where: Fila) =>
        !!fila &&
        fila.id === where.id &&
        (where.estado === undefined ||
          (typeof where.estado === "string"
            ? fila.estado === where.estado
            : fila.estado !== (where.estado as { not: string }).not));
      mock.growthTarea.updateMany.mockImplementation(
        async ({ where, data }: { where: Fila; data: Fila }) => {
          if (!cumple(where)) return { count: 0 };
          fila = { ...fila!, ...data };
          return { count: 1 };
        }
      );
      mock.growthTarea.findUnique.mockImplementation(async () =>
        fila ? { ...fila } : null
      );
      return () => fila;
    }

    describe("POST …/:id/hecha", () => {
      it("marca la tarea con el resultado y la nota, y fecha el momento", async () => {
        const antes = Date.now();
        tareaEnLaBase(filaDeTarea());
        const r = await admin("POST", "/growth/admin/tareas/t1/hecha", {
          resultado: "alta_creada",
          nota: "Gratis, pide verificar el correo",
        });
        expect(r.statusCode).toBe(200);
        expect(r.json()).toMatchObject({
          estado: "hecha",
          resultado: "alta_creada",
          notaDeResultado: "Gratis, pide verificar el correo",
        });
        expect(Date.parse(r.json().hechaEn)).toBeGreaterThanOrEqual(antes);
        expect(Object.keys(r.json()).sort()).toEqual(CLAVES_DE_TAREA);
      });

      it("la sentencia es una sola y atómica: solo cambia lo que aún no está hecho", async () => {
        tareaEnLaBase(filaDeTarea());
        await admin("POST", "/growth/admin/tareas/t1/hecha", {});
        expect(mock.growthTarea.updateMany.mock.calls[0][0].where).toEqual({
          id: "t1",
          estado: { not: "hecha" },
        });
      });

      it("sin cuerpo marca la tarea sin resultado ni nota", async () => {
        tareaEnLaBase(filaDeTarea());
        const r = await admin("POST", "/growth/admin/tareas/t1/hecha");
        expect(r.statusCode).toBe(200);
        expect(r.json()).toMatchObject({
          estado: "hecha",
          resultado: null,
          notaDeResultado: null,
        });
      });

      it("es idempotente: hacerla otra vez no cambia la fecha ni borra el resultado", async () => {
        const leer = tareaEnLaBase(filaDeTarea());
        const primera = (
          await admin("POST", "/growth/admin/tareas/t1/hecha", {
            resultado: "en_revision",
            nota: "Enviada",
          })
        ).json();
        const segunda = (
          await admin("POST", "/growth/admin/tareas/t1/hecha", {})
        ).json();
        expect(segunda.hechaEn).toBe(primera.hechaEn);
        expect(segunda).toMatchObject({
          estado: "hecha",
          resultado: "en_revision",
          notaDeResultado: "Enviada",
        });
        expect(leer()!.hechaEn).toEqual(new Date(primera.hechaEn));
      });

      it("hecha otra vez con un resultado nuevo lo completa y conserva la fecha", async () => {
        tareaEnLaBase(filaDeTarea());
        const primera = (
          await admin("POST", "/growth/admin/tareas/t1/hecha", {
            resultado: "en_revision",
          })
        ).json();
        const segunda = (
          await admin("POST", "/growth/admin/tareas/t1/hecha", {
            resultado: "alta_creada",
            nota: "Ya está publicada",
          })
        ).json();
        expect(segunda).toMatchObject({
          resultado: "alta_creada",
          notaDeResultado: "Ya está publicada",
          hechaEn: primera.hechaEn,
        });
      });

      it("una descartada también se puede dar por hecha, y deja de estar descartada", async () => {
        tareaEnLaBase(
          filaDeTarea({ estado: "descartada", notaDeResultado: "No aplica" })
        );
        const r = await admin("POST", "/growth/admin/tareas/t1/hecha", {
          resultado: "rechazada",
        });
        expect(r.json()).toMatchObject({
          estado: "hecha",
          resultado: "rechazada",
          notaDeResultado: null,
        });
      });

      it("resultado inventado, nota de más de 500 o campo que no existe: 400", async () => {
        tareaEnLaBase(filaDeTarea());
        for (const cuerpo of [
          { resultado: "genial" },
          { nota: "x".repeat(501) },
          { quien: "yo" },
        ]) {
          const r = await admin(
            "POST",
            "/growth/admin/tareas/t1/hecha",
            cuerpo
          );
          expect(r.statusCode, JSON.stringify(cuerpo)).toBe(400);
        }
        expect(mock.growthTarea.updateMany).not.toHaveBeenCalled();
      });

      it("acepta resultado y nota null (como «sin resultado»)", async () => {
        tareaEnLaBase(filaDeTarea());
        const r = await admin("POST", "/growth/admin/tareas/t1/hecha", {
          resultado: null,
          nota: null,
        });
        expect(r.statusCode).toBe(200);
        expect(r.json().resultado).toBeNull();
      });

      it("una tarea que no existe: 404", async () => {
        tareaEnLaBase(null);
        const r = await admin("POST", "/growth/admin/tareas/nada/hecha", {
          resultado: "otro",
        });
        expect(r.statusCode).toBe(404);
        expect(r.json()).toEqual({ error: "La tarea no existe." });
      });
    });

    describe("POST …/:id/descartar", () => {
      it("descarta con una nota y limpia resultado y fecha", async () => {
        tareaEnLaBase(
          filaDeTarea({
            estado: "hecha",
            resultado: "en_revision",
            hechaEn: new Date(),
          })
        );
        const r = await admin("POST", "/growth/admin/tareas/t1/descartar", {
          nota: "Pide pago",
        });
        expect(r.statusCode).toBe(200);
        expect(r.json()).toMatchObject({
          estado: "descartada",
          resultado: null,
          hechaEn: null,
          notaDeResultado: "Pide pago",
        });
      });

      it("es idempotente: descartar otra vez sin nota no borra la nota; con una nueva, la actualiza", async () => {
        tareaEnLaBase(filaDeTarea());
        await admin("POST", "/growth/admin/tareas/t1/descartar", {
          nota: "Uno",
        });
        const otra = await admin("POST", "/growth/admin/tareas/t1/descartar");
        expect(otra.json()).toMatchObject({
          estado: "descartada",
          notaDeResultado: "Uno",
        });
        const nueva = await admin("POST", "/growth/admin/tareas/t1/descartar", {
          nota: "Dos",
        });
        expect(nueva.json().notaDeResultado).toBe("Dos");
      });

      it("nota demasiado larga: 400; tarea que no existe: 404", async () => {
        tareaEnLaBase(null);
        expect(
          (
            await admin("POST", "/growth/admin/tareas/t1/descartar", {
              nota: "x".repeat(501),
            })
          ).statusCode
        ).toBe(400);
        expect(
          (await admin("POST", "/growth/admin/tareas/t1/descartar", {}))
            .statusCode
        ).toBe(404);
      });
    });

    describe("POST …/:id/reabrir", () => {
      it("vuelve a pendiente, limpia resultado y fecha y conserva la nota", async () => {
        tareaEnLaBase(
          filaDeTarea({
            estado: "hecha",
            resultado: "rechazada",
            notaDeResultado: "Solo para empresas grandes",
            hechaEn: new Date(),
          })
        );
        const r = await admin("POST", "/growth/admin/tareas/t1/reabrir");
        expect(r.statusCode).toBe(200);
        expect(r.json()).toMatchObject({
          estado: "pendiente",
          resultado: null,
          hechaEn: null,
          notaDeResultado: "Solo para empresas grandes",
        });
        expect(
          Object.keys(mock.growthTarea.updateMany.mock.calls[0][0].data).sort()
        ).toEqual(["estado", "hechaEn", "resultado"]);
      });

      it("una pendiente se queda como está (idempotente)", async () => {
        tareaEnLaBase(filaDeTarea());
        const r = await admin("POST", "/growth/admin/tareas/t1/reabrir");
        expect(r.statusCode).toBe(200);
        expect(r.json().estado).toBe("pendiente");
      });

      it("una tarea que no existe: 404", async () => {
        tareaEnLaBase(null);
        expect(
          (await admin("POST", "/growth/admin/tareas/nada/reabrir")).statusCode
        ).toBe(404);
      });
    });

    it("el ciclo completo: pendiente → hecha → reabrir → descartar → reabrir", async () => {
      tareaEnLaBase(filaDeTarea());
      const estados: string[] = [];
      for (const [ruta, cuerpo] of [
        ["hecha", { resultado: "alta_creada" }],
        ["reabrir", undefined],
        ["descartar", { nota: "No toca" }],
        ["reabrir", undefined],
      ] as const) {
        const r = await admin(
          "POST",
          `/growth/admin/tareas/t1/${ruta}`,
          cuerpo
        );
        expect(r.statusCode, ruta).toBe(200);
        estados.push(r.json().estado);
      }
      expect(estados).toEqual([
        "hecha",
        "pendiente",
        "descartada",
        "pendiente",
      ]);
    });
  });

  // ── Baja ────────────────────────────────────────────────────────────────

  describe("DELETE /growth/admin/tareas/:id", () => {
    it("borra una tarea manual: 204 y sin cuerpo", async () => {
      mock.growthTarea.deleteMany.mockResolvedValue({ count: 1 });
      const r = await admin("DELETE", "/growth/admin/tareas/t1");
      expect(r.statusCode).toBe(204);
      expect(r.body).toBe("");
      expect(mock.growthTarea.deleteMany).toHaveBeenCalledWith({
        where: { id: "t1", origen: { not: "repo" } },
      });
    });

    it("una del repositorio: 409 tarea_del_repositorio, y no se borra", async () => {
      mock.growthTarea.deleteMany.mockResolvedValue({ count: 0 });
      mock.growthTarea.findUnique.mockResolvedValue({ id: "t1" });
      const r = await admin("DELETE", "/growth/admin/tareas/t1");
      expect(r.statusCode).toBe(409);
      expect(r.json()).toEqual({
        error: expect.stringContaining("repositorio"),
        codigo: "tarea_del_repositorio",
      });
    });

    it("una que no existe: 404", async () => {
      mock.growthTarea.deleteMany.mockResolvedValue({ count: 0 });
      mock.growthTarea.findUnique.mockResolvedValue(null);
      const r = await admin("DELETE", "/growth/admin/tareas/nada");
      expect(r.statusCode).toBe(404);
    });
  });

  // ── Quién entra ─────────────────────────────────────────────────────────

  describe("solo el administrador", () => {
    const RUTAS: [string, string, object?][] = [
      ["GET", "/growth/admin/tareas"],
      ["POST", "/growth/admin/tareas", { titulo: "X", url: "https://e.com/" }],
      ["PATCH", "/growth/admin/tareas/t1", { titulo: "X" }],
      ["POST", "/growth/admin/tareas/t1/hecha", {}],
      ["POST", "/growth/admin/tareas/t1/descartar", {}],
      ["POST", "/growth/admin/tareas/t1/reabrir", {}],
      ["DELETE", "/growth/admin/tareas/t1"],
      ["GET", "/growth/admin/ficha-de-alhabla"],
      ["GET", "/growth/admin/competidores/comparador"],
    ];

    for (const [metodo, url, cuerpo] of RUTAS) {
      it(`${metodo} ${url}: sin sesión, 401; con un token de agente, 401; con otro correo, 403`, async () => {
        const inyecta = (headers: Record<string, string>) =>
          fastify.inject({
            method: metodo as "GET",
            url,
            headers,
            payload: cuerpo,
          });

        expect((await inyecta({})).statusCode).toBe(401);

        mockVerifyIdToken.mockRejectedValueOnce(new Error("Wrong segments"));
        expect((await inyecta(comoAgente())).statusCode).toBe(401);

        mockVerifyIdToken.mockResolvedValueOnce({
          getPayload: () => ({
            email: "otra@persona.es",
            email_verified: true,
          }),
        });
        expect((await inyecta(comoAdmin())).statusCode).toBe(403);

        expect(mock.growthTarea.findMany).not.toHaveBeenCalled();
        expect(mock.growthTarea.create).not.toHaveBeenCalled();
        expect(mock.growthTarea.update).not.toHaveBeenCalled();
        expect(mock.growthTarea.updateMany).not.toHaveBeenCalled();
        expect(mock.growthTarea.deleteMany).not.toHaveBeenCalled();
        expect(mock.growthTarea.createMany).not.toHaveBeenCalled();
      });
    }
  });
});
