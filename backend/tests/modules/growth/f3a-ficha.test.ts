import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  vi,
} from "vitest";
import Fastify from "fastify";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { growthRoutes } from "../../../src/modules/growth/routes.js";
import {
  CLAVES_DE_LA_DESCRIPCION_LARGA,
  CLAVES_DE_LA_FICHA,
  CLAVES_DE_PRECIOS,
  componerFicha,
  type AfirmacionDeFicha,
  type RespuestaDeFicha,
} from "../../../src/modules/growth/fichaDeAlhabla.js";
import type { SnapshotDeConocimiento } from "../../../src/modules/growth/contextoDeCumplimiento.js";
import {
  construirAfirmaciones,
  type ResultadoDeConstruccion,
} from "../../../mcp/growth/conocimiento/construir.js";
import { cargarEntrada } from "../../../mcp/growth/conocimiento/entrada.js";
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
 * Panel útil — la Ficha de Alhabla: la composición pura (plantillas fijas,
 * solo afirmaciones vigentes, sin modelo), los términos prohibidos, los
 * avisos, la ruta con Prisma de mentira y, sobre el repo real, que las claves
 * de las que sale la ficha siguen existiendo en el mapa de conocimiento y con
 * el mismo nombre.
 */

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const hayRepo =
  existsSync(join(RAIZ, "PRODUCT.md")) &&
  existsSync(join(RAIZ, "web", "src", "lib", "plans.ts"));

const SINCRONIZADO_HACE_UN_DIA: SnapshotDeConocimiento = {
  commitSha: "abc1234def5678abc1234def5678abc1234def56",
  sincronizadoEn: "2026-10-31T05:00:00.000Z",
  antiguedadHoras: 24,
  obsoleto: false,
  vigentes: 80,
  porTipo: {},
};

/** Las afirmaciones tal como salen hoy de la sincronización. */
const TEXTOS: Record<string, string> = {
  "pagina.inicio":
    "Alhabla: Recepcionista de IA que atiende las llamadas de tu negocio para que no pierdas ninguna; tú lo gestionas por WhatsApp o desde el panel.",
  "funcion.atiende_a_cualquier_hora":
    "Contesta tus llamadas a cualquier hora, también en festivos",
  "funcion.calendarios":
    "Reservas en tu calendario de Google, Outlook o iCloud, o en la agenda de Alhabla si no usas ninguno",
  "funcion.confirmacion_por_whatsapp":
    "Confirmación de cita por WhatsApp al cliente",
  "funcion.idiomas":
    "Habla español y 7 idiomas más, y el catalán, euskera o gallego de tu zona",
  "funcion.numero_de_espana":
    "Número de España aprovisionado automáticamente tras el checkout.",
  "funcion.registro_de_llamadas":
    "Registro de llamadas con transcripción, grabación (si quien llama lo permite) y clasificación de resultado.",
  "funcion.horario_servicios_y_equipo":
    "Horario de negocio, catálogo de servicios, profesionales y capacidad de reserva.",
  "funcion.asistente_por_whatsapp":
    "Tu asistente por WhatsApp: el dueño administra servicios y precios. Propone y el dueño confirma. Está en todos los planes.",
  "precio.desde": "Los planes de Alhabla empiezan en 59 € + IVA al mes.",
  "precio.plan.inicio":
    "Plan Inicio: 59 € + IVA al mes, 200 minutos incluidos y 0,30 € + IVA por minuto adicional.",
  "precio.plan.pro":
    "Plan Pro: 139 € + IVA al mes, 600 minutos incluidos y 0,25 € + IVA por minuto adicional.",
  "precio.plan.scale":
    "Plan Scale: 269 € + IVA al mes, 1.500 minutos incluidos y 0,20 € + IVA por minuto adicional.",
  "precio.iva": "Los precios se publican sin IVA; se añade el 21 %.",
  "precio.prueba": "7 días de prueba. Sin permanencia. Cancela cuando quieras.",
};

function afirmacion(
  clave: string,
  cambios: Partial<AfirmacionDeFicha> = {}
): AfirmacionDeFicha {
  return {
    clave,
    tipo: clave.split(".")[0],
    texto: TEXTOS[clave],
    valor: null,
    ...cambios,
  };
}

const PROHIBIDA_TELNYX: AfirmacionDeFicha = {
  clave: "prohibida.proveedor",
  tipo: "prohibida",
  texto: "No se nombra al proveedor de telefonía.",
  valor: { terminos: ["Telnyx"], palabrasEnteras: true },
};

function todas(sin: string[] = []): AfirmacionDeFicha[] {
  return [
    ...Object.keys(TEXTOS)
      .filter((c) => !sin.includes(c))
      .map((c) => afirmacion(c)),
    PROHIBIDA_TELNYX,
  ];
}

const campo = (ficha: RespuestaDeFicha, clave: string) =>
  ficha.campos.find((c) => c.clave === clave)!;

describe("panel útil: la Ficha de Alhabla", () => {
  describe("composición con las afirmaciones completas", () => {
    const ficha = componerFicha({
      afirmaciones: todas(),
      snapshot: SINCRONIZADO_HACE_UN_DIA,
    });

    it("lleva los ocho campos, en este orden, con etiqueta y sin textos vacíos", () => {
      expect(ficha.campos.map((c) => c.clave)).toEqual([
        "nombre",
        "web",
        "descripcion_corta",
        "descripcion_larga",
        "precios",
        "prueba",
        "idiomas",
        "categorias",
      ]);
      for (const c of ficha.campos) {
        expect(c.etiqueta, c.clave).toMatch(/\S/);
        expect(typeof c.texto, c.clave).toBe("string");
        expect(c.faltan, c.clave).toEqual([]);
      }
      expect(ficha.avisos).toEqual([]);
      expect(ficha.commit).toBe(SINCRONIZADO_HACE_UN_DIA.commitSha);
      expect(ficha.sincronizadaEn).toBe(
        SINCRONIZADO_HACE_UN_DIA.sincronizadoEn
      );
    });

    it("nombre y web son constantes, sin afirmaciones", () => {
      expect(campo(ficha, "nombre")).toEqual({
        clave: "nombre",
        etiqueta: "Nombre del producto",
        texto: "Alhabla",
        afirmaciones: [],
        faltan: [],
      });
      expect(campo(ficha, "web")).toMatchObject({
        texto: "https://alhabla.ai/",
        afirmaciones: [],
      });
    });

    it("la descripción corta es el texto de pagina.inicio sin el «Alhabla: » del principio, con su límite", () => {
      expect(campo(ficha, "descripcion_corta")).toMatchObject({
        texto:
          "Recepcionista de IA que atiende las llamadas de tu negocio para que no pierdas ninguna; tú lo gestionas por WhatsApp o desde el panel.",
        limite: 160,
        afirmaciones: ["pagina.inicio"],
        faltan: [],
      });
    });

    it("la descripción corta se queda como está si el texto no empieza por «Alhabla: »", () => {
      const f = componerFicha({
        afirmaciones: [
          afirmacion("pagina.inicio", {
            texto: "Otra cosa que no empieza por el nombre",
          }),
          PROHIBIDA_TELNYX,
        ],
        snapshot: SINCRONIZADO_HACE_UN_DIA,
      });
      expect(campo(f, "descripcion_corta").texto).toBe(
        "Otra cosa que no empieza por el nombre"
      );
    });

    it("la descripción larga: el arranque fijo y las funciones en su orden, cada frase con un solo punto", () => {
      const larga = campo(ficha, "descripcion_larga");
      expect(larga.limite).toBe(1000);
      expect(larga.afirmaciones).toEqual([...CLAVES_DE_LA_DESCRIPCION_LARGA]);
      expect(larga.texto).toBe(
        [
          "Alhabla es una recepcionista de IA que atiende las llamadas de tu negocio.",
          "Contesta tus llamadas a cualquier hora, también en festivos.",
          "Reservas en tu calendario de Google, Outlook o iCloud, o en la agenda de Alhabla si no usas ninguno.",
          "Confirmación de cita por WhatsApp al cliente.",
          "Habla español y 7 idiomas más, y el catalán, euskera o gallego de tu zona.",
          "Número de España aprovisionado automáticamente tras el checkout.",
          "Registro de llamadas con transcripción, grabación (si quien llama lo permite) y clasificación de resultado.",
          "Horario de negocio, catálogo de servicios, profesionales y capacidad de reserva.",
          "Tu asistente por WhatsApp: el dueño administra servicios y precios. Propone y el dueño confirma. Está en todos los planes.",
        ].join(" ")
      );
      expect(larga.texto).not.toMatch(/\.\./);
    });

    it("los precios: una línea por afirmación, en el orden de la ficha", () => {
      const precios = campo(ficha, "precios");
      expect(precios.afirmaciones).toEqual([...CLAVES_DE_PRECIOS]);
      expect(precios.texto!.split("\n")).toEqual([
        TEXTOS["precio.desde"],
        TEXTOS["precio.plan.inicio"],
        TEXTOS["precio.plan.pro"],
        TEXTOS["precio.plan.scale"],
        TEXTOS["precio.iva"],
      ]);
    });

    it("prueba e idiomas son el texto de su afirmación; las categorías, la lista fija sin afirmaciones", () => {
      expect(campo(ficha, "prueba")).toMatchObject({
        texto: TEXTOS["precio.prueba"],
        afirmaciones: ["precio.prueba"],
      });
      expect(campo(ficha, "idiomas")).toMatchObject({
        texto: TEXTOS["funcion.idiomas"],
        afirmaciones: ["funcion.idiomas"],
      });
      expect(campo(ficha, "categorias")).toMatchObject({
        texto:
          "Software de recepción telefónica con IA · Agenda y reservas de citas · Atención al cliente",
        afirmaciones: [],
        faltan: [],
      });
    });

    it("solo cita claves que existen en la lista de la ficha", () => {
      const citadas = ficha.campos.flatMap((c) => c.afirmaciones);
      expect(citadas.length).toBeGreaterThan(0);
      for (const clave of citadas) {
        expect(CLAVES_DE_LA_FICHA, clave).toContain(clave);
      }
    });

    it("es determinista y no toca lo que recibe", () => {
      const entrada = {
        afirmaciones: todas(),
        snapshot: SINCRONIZADO_HACE_UN_DIA,
      };
      const copia = structuredClone(entrada);
      expect(componerFicha(entrada)).toEqual(componerFicha(entrada));
      expect(entrada).toEqual(copia);
    });
  });

  describe("cuando falta alguna afirmación", () => {
    const componer = (sin: string[]) =>
      componerFicha({
        afirmaciones: todas(sin),
        snapshot: SINCRONIZADO_HACE_UN_DIA,
      });

    it("sin precio.plan.pro: precios queda en null con la clave que falta, y lo demás sigue", () => {
      const f = componer(["precio.plan.pro"]);
      expect(campo(f, "precios")).toMatchObject({
        texto: null,
        faltan: ["precio.plan.pro"],
        afirmaciones: [
          "precio.desde",
          "precio.plan.inicio",
          "precio.plan.scale",
          "precio.iva",
        ],
      });
      for (const clave of [
        "nombre",
        "descripcion_corta",
        "descripcion_larga",
      ]) {
        expect(campo(f, clave).texto, clave).not.toBeNull();
      }
    });

    it("sin ninguna de las cinco de precios: todas en faltan", () => {
      const f = componer([...CLAVES_DE_PRECIOS]);
      expect(campo(f, "precios")).toMatchObject({
        texto: null,
        faltan: [...CLAVES_DE_PRECIOS],
        afirmaciones: [],
      });
    });

    it("sin pagina.inicio: descripcion_corta en null", () => {
      const f = componer(["pagina.inicio"]);
      expect(campo(f, "descripcion_corta")).toMatchObject({
        texto: null,
        faltan: ["pagina.inicio"],
        afirmaciones: [],
      });
    });

    it("sin precio.prueba o sin funcion.idiomas: ese campo en null", () => {
      const f = componer(["precio.prueba", "funcion.idiomas"]);
      expect(campo(f, "prueba")).toMatchObject({
        texto: null,
        faltan: ["precio.prueba"],
      });
      expect(campo(f, "idiomas")).toMatchObject({
        texto: null,
        faltan: ["funcion.idiomas"],
      });
      // La descripción larga sigue con las demás y dice cuál no está.
      expect(campo(f, "descripcion_larga")).toMatchObject({
        faltan: ["funcion.idiomas"],
      });
      expect(campo(f, "descripcion_larga").texto).not.toContain("7 idiomas");
    });

    it("la descripción larga usa las funciones que existan y dice las que faltan; sin ninguna, null", () => {
      const f = componer(["funcion.calendarios", "funcion.numero_de_espana"]);
      const larga = campo(f, "descripcion_larga");
      expect(larga.faltan).toEqual([
        "funcion.calendarios",
        "funcion.numero_de_espana",
      ]);
      expect(larga.texto).not.toContain("Reservas en tu calendario");
      expect(larga.texto).toContain("Contesta tus llamadas");
      expect(
        larga.texto!.startsWith("Alhabla es una recepcionista de IA")
      ).toBe(true);

      const ninguna = componer([...CLAVES_DE_LA_DESCRIPCION_LARGA]);
      expect(campo(ninguna, "descripcion_larga")).toMatchObject({
        texto: null,
        afirmaciones: [],
        faltan: [...CLAVES_DE_LA_DESCRIPCION_LARGA],
      });
    });

    it("una afirmación con el texto en blanco cuenta como que falta", () => {
      const f = componerFicha({
        afirmaciones: [
          ...todas(["precio.iva"]),
          afirmacion("precio.iva", { texto: "   " }),
        ],
        snapshot: SINCRONIZADO_HACE_UN_DIA,
      });
      expect(campo(f, "precios")).toMatchObject({
        texto: null,
        faltan: ["precio.iva"],
      });
    });

    it("con la base vacía: solo salen los campos fijos y la ficha avisa de las dos faltas", () => {
      const f = componerFicha({ afirmaciones: [], snapshot: null });
      expect(
        f.campos.filter((c) => c.texto !== null).map((c) => c.clave)
      ).toEqual(["nombre", "web", "categorias"]);
      expect(f.commit).toBeNull();
      expect(f.sincronizadaEn).toBeNull();
      expect(f.avisos).toHaveLength(2);
    });
  });

  describe("términos prohibidos", () => {
    it("si un texto usa uno, el campo se devuelve igualmente y hay un aviso que lo nombra", () => {
      const f = componerFicha({
        afirmaciones: [
          ...todas(["funcion.numero_de_espana"]),
          afirmacion("funcion.numero_de_espana", {
            texto: "Número de España con Telnyx aprovisionado.",
          }),
        ],
        snapshot: SINCRONIZADO_HACE_UN_DIA,
      });
      expect(campo(f, "descripcion_larga").texto).toContain("Telnyx");
      expect(f.avisos).toEqual([
        "El campo «Descripción larga» contiene términos que no se pueden decir: Telnyx.",
      ]);
    });

    it("usa las mismas reglas que un borrador: sin mayúsculas, acentos ni homoglifos, y respeta palabrasEnteras", () => {
      const conTermino = (texto: string, valor: unknown) =>
        componerFicha({
          afirmaciones: [
            ...todas(["precio.prueba"]),
            afirmacion("precio.prueba", { texto }),
            {
              clave: "prohibida.x",
              tipo: "prohibida",
              texto: "x",
              valor: valor as AfirmacionDeFicha["valor"],
            },
          ],
          snapshot: SINCRONIZADO_HACE_UN_DIA,
        });

      // «Rеtell» con una е cirílica y en mayúsculas.
      expect(
        conTermino("Mejor que RЕTELL en todo", { terminos: ["retell"] }).avisos
      ).toHaveLength(1);
      // Palabra entera: «API» no salta con «fisioterapia».
      expect(
        conTermino("Para fisioterapia", { terminos: ["API"] }).avisos
      ).toEqual([]);
      // Sin palabra entera sí.
      expect(
        conTermino("Para fisioterapia", {
          terminos: ["API"],
          palabrasEnteras: false,
        }).avisos
      ).toHaveLength(1);
    });

    it("un término prohibido en dos campos da un aviso por campo", () => {
      const f = componerFicha({
        afirmaciones: [
          ...todas(["precio.prueba", "funcion.idiomas"]),
          afirmacion("precio.prueba", { texto: "Prueba con Telnyx" }),
          afirmacion("funcion.idiomas", { texto: "Idiomas de Telnyx" }),
        ],
        snapshot: SINCRONIZADO_HACE_UN_DIA,
      });
      expect(f.avisos).toEqual([
        "El campo «Descripción larga» contiene términos que no se pueden decir: Telnyx.",
        "El campo «Prueba y permanencia» contiene términos que no se pueden decir: Telnyx.",
        "El campo «Idiomas» contiene términos que no se pueden decir: Telnyx.",
      ]);
    });

    it("sin ninguna afirmación prohibida vigente avisa de que no se ha podido comprobar", () => {
      const f = componerFicha({
        afirmaciones: todas().filter((a) => a.tipo !== "prohibida"),
        snapshot: SINCRONIZADO_HACE_UN_DIA,
      });
      expect(f.avisos).toEqual([
        "No hay términos prohibidos vigentes en la base de conocimiento: no se ha podido comprobar el texto.",
      ]);
    });
  });

  describe("la base de conocimiento", () => {
    it("sin sincronizar nunca: commit y fecha en null, y un aviso", () => {
      const f = componerFicha({ afirmaciones: todas(), snapshot: null });
      expect(f.commit).toBeNull();
      expect(f.sincronizadaEn).toBeNull();
      expect(f.avisos).toEqual([
        "La base de conocimiento aún no se ha sincronizado: la ficha puede estar incompleta.",
      ]);
    });

    it("obsoleta: avisa de los días sin sincronizar y sigue dando commit y fecha", () => {
      const f = componerFicha({
        afirmaciones: todas(),
        snapshot: {
          ...SINCRONIZADO_HACE_UN_DIA,
          antiguedadHoras: 24 * 12 + 5,
          obsoleto: true,
        },
      });
      expect(f.avisos).toEqual([
        "La base de conocimiento no se sincroniza desde hace 12 días: comprueba los precios y las funciones antes de pegarlos.",
      ]);
      expect(f.commit).toBe(SINCRONIZADO_HACE_UN_DIA.commitSha);
    });
  });

  describe("la ruta, con Prisma de mentira", () => {
    let fastify: ReturnType<typeof Fastify>;

    const pide = (headers: Record<string, string> = comoAdmin()) =>
      fastify.inject({
        method: "GET",
        url: "/growth/admin/ficha-de-alhabla",
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
      mock.growthAfirmacion.findMany.mockResolvedValue(todas());
      mock.growthAjuste.findUnique.mockResolvedValue({
        clave: "sistema.conocimiento",
        valor: { commitSha: SINCRONIZADO_HACE_UN_DIA.commitSha, vigentes: 80 },
        actualizadoEn: new Date(),
      });
      fastify = Fastify();
      await fastify.register(growthRoutes);
    });

    afterEach(async () => {
      await fastify.close();
      vi.restoreAllMocks();
    });

    it("devuelve la ficha y el commit del snapshot, sin caché", async () => {
      const r = await pide();
      expect(r.statusCode).toBe(200);
      expect(r.headers["cache-control"]).toBe("no-store");
      const cuerpo = r.json();
      expect(Object.keys(cuerpo).sort()).toEqual([
        "avisos",
        "campos",
        "commit",
        "sincronizadaEn",
      ]);
      expect(cuerpo.commit).toBe(SINCRONIZADO_HACE_UN_DIA.commitSha);
      expect(cuerpo.sincronizadaEn).toEqual(expect.any(String));
      expect(cuerpo.campos).toHaveLength(8);
      expect(cuerpo.avisos).toEqual([]);
    });

    it("lee solo lo vigente: las claves de la ficha y las prohibidas, y nada más, en una consulta", async () => {
      await pide();
      expect(mock.growthAfirmacion.findMany).toHaveBeenCalledTimes(1);
      const [args] = mock.growthAfirmacion.findMany.mock.calls[0];
      expect(args.where.vigenteHasta).toBeNull();
      expect(args.where.OR).toEqual([
        { clave: { in: [...CLAVES_DE_LA_FICHA] } },
        { tipo: "prohibida" },
      ]);
    });

    it("si hay dos vigentes con la misma clave, gana la más reciente (la primera, por vigenteDesde descendente)", async () => {
      mock.growthAfirmacion.findMany.mockResolvedValue([
        { ...afirmacion("precio.prueba", { texto: "La nueva." }) },
        { ...afirmacion("precio.prueba", { texto: "La vieja." }) },
        ...todas(["precio.prueba"]),
      ]);
      const r = await pide();
      const [args] = mock.growthAfirmacion.findMany.mock.calls[0];
      expect(args.orderBy).toEqual({ vigenteDesde: "desc" });
      const prueba = r
        .json()
        .campos.find((c: { clave: string }) => c.clave === "prueba");
      expect(prueba.texto).toBe("La nueva.");
    });

    it("sin sesión: 401; con un token de agente: 401; con otro correo: 403", async () => {
      expect((await pide({})).statusCode).toBe(401);
      mockVerifyIdToken.mockRejectedValueOnce(new Error("Wrong segments"));
      expect((await pide(comoAgente())).statusCode).toBe(401);
      mockVerifyIdToken.mockResolvedValueOnce({
        getPayload: () => ({ email: "otra@persona.es", email_verified: true }),
      });
      expect((await pide()).statusCode).toBe(403);
      expect(mock.growthAfirmacion.findMany).not.toHaveBeenCalled();
    });
  });

  describe.skipIf(!hayRepo)("sobre el repo real", () => {
    let resultado: ResultadoDeConstruccion;

    beforeAll(async () => {
      resultado = construirAfirmaciones(await cargarEntrada(RAIZ));
    }, 30_000);

    it("todas las claves de las que sale la ficha existen en lo que extrae el mapa de conocimiento", () => {
      const claves = new Set(resultado.afirmaciones.map((a) => a.clave));
      const quePierden = CLAVES_DE_LA_FICHA.filter((c) => !claves.has(c));
      expect(
        quePierden,
        "Estas claves ya no salen del mapa (mcp/growth/conocimiento/mapa.ts, construir.ts) o cambiaron de nombre: la Ficha de Alhabla se quedaría sin ellas. Actualiza fichaDeAlhabla.ts."
      ).toEqual([]);
    });

    it("con las afirmaciones reales la ficha sale completa: ningún campo vacío, ningún término prohibido y dentro de los límites", () => {
      const ficha = componerFicha({
        afirmaciones: resultado.afirmaciones.map((a) => ({
          clave: a.clave,
          tipo: a.tipo,
          texto: a.texto,
          valor: (a.valor ?? null) as AfirmacionDeFicha["valor"],
        })),
        snapshot: SINCRONIZADO_HACE_UN_DIA,
      });
      expect(ficha.avisos).toEqual([]);
      for (const c of ficha.campos) {
        expect(c.texto, c.clave).not.toBeNull();
        expect(c.faltan, c.clave).toEqual([]);
        if (c.limite) {
          expect(c.texto!.length, c.clave).toBeLessThanOrEqual(c.limite);
        }
      }
    });
  });
});
