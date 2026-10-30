import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify from "fastify";
import { growthRoutes } from "../../../src/modules/growth/routes.js";
import type { PrismaMock } from "./ayudas.js";
import {
  ADMIN,
  TEXTO_DE_BORRADOR,
  comoAdmin,
  dentroDe,
  hace,
  prepararContexto,
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

/** Una revisión de las reglas tal como sale de la base de datos. */
function revision(resultado = "pasa", cambios: Record<string, unknown> = {}) {
  return {
    id: "r1",
    resultado,
    comprobaciones: [],
    revisor: "reglas",
    creadaEn: hace(1),
    ...cambios,
  };
}

/** Un borrador con su oportunidad, como lo lee el PATCH. */
function borradorBd(cambios: Record<string, unknown> = {}) {
  return {
    id: "b1",
    oportunidadId: "o1",
    version: 2,
    tipo: "email",
    objetivo: "BACKLINKS",
    asunto: "Una recepcionista de IA para vuestro listado",
    texto: TEXTO_DE_BORRADOR,
    enlaceUrl: "https://alhabla.ai/peluqueria?utm_source=listado",
    utm: null,
    afirmaciones: ["funcion.reserva_en_calendario"],
    estado: "pendiente_aprobacion",
    textoFinal: null,
    editadoPorHumano: false,
    creadoEn: hace(2),
    oportunidad: {
      id: "o1",
      estado: "pendiente_aprobacion",
      dominio: "ejemplo.com",
    },
    revisiones: [revision()],
    ...cambios,
  };
}

function parchear(payload: unknown, fastify: ReturnType<typeof Fastify>) {
  return fastify.inject({
    method: "PATCH",
    url: "/growth/admin/borradores/b1",
    headers: comoAdmin(),
    payload: payload as object,
  });
}

describe("borradores del administrador de Alhabla Growth", () => {
  let fastify: ReturnType<typeof Fastify>;

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

    fastify = Fastify();
    await fastify.register(growthRoutes);
  });

  afterEach(async () => {
    await fastify.close();
  });

  // ── Listado ────────────────────────────────────────────────────────────

  describe("listado", () => {
    function filaDeListado(cambios: Record<string, unknown> = {}) {
      return {
        id: "b1",
        oportunidadId: "o1",
        version: 1,
        tipo: "email",
        objetivo: "BACKLINKS",
        asunto: "Asunto",
        texto: "x".repeat(450),
        enlaceUrl: "https://alhabla.ai/?utm_source=a",
        afirmaciones: ["funcion.reserva_en_calendario"],
        estado: "bloqueado",
        editadoPorHumano: false,
        creadoEn: hace(1),
        oportunidad: {
          id: "o1",
          titulo: "Directorio",
          dominio: "ejemplo.com",
          url: "https://ejemplo.com/alta",
          estado: "bloqueada",
          objetivoPrincipal: "BACKLINKS",
          expiraEn: dentroDe(10),
        },
        gestion: null,
        revisiones: [
          {
            resultado: "bloquea",
            comprobaciones: [
              { regla: "identificacion", ok: false, dura: true, detalle: "x" },
              { regla: "enlace_con_utm", ok: true, dura: false, detalle: "y" },
            ],
          },
        ],
        ...cambios,
      };
    }

    beforeEach(() => {
      mock.growthBorrador.findMany.mockResolvedValue([filaDeListado()]);
      mock.growthBorrador.count.mockResolvedValue(1);
    });

    it("pide la página con el total (el de su pestaña) y los seis conteos, y no lleva el texto entero", async () => {
      mock.growthBorrador.count.mockImplementation(
        async ({ where }: { where: { AND: { estado?: unknown }[] } }) => {
          const estado = where.AND[0]?.estado;
          return estado === "bloqueado"
            ? 4
            : estado === "pendiente_aprobacion"
              ? 2
              : 0;
        }
      );
      const response = await fastify.inject({
        method: "GET",
        url: "/growth/admin/borradores?grupo=bloqueados&pagina=2&limite=10",
        headers: comoAdmin(),
      });

      expect(response.statusCode).toBe(200);
      const cuerpo = response.json();
      expect(cuerpo).toMatchObject({ total: 4, pagina: 2, limite: 10 });
      expect(cuerpo.conteos).toEqual({
        bloqueados: 4,
        pendientes: 2,
        aprobados: 0,
        gestionados: 0,
        caducados: 0,
        descartados: 0,
      });
      const [item] = cuerpo.data;
      expect(item.textoPreview).toHaveLength(200);
      expect(item.longitud).toBe(450);
      expect(item).not.toHaveProperty("texto");
      expect(mock.growthBorrador.findMany.mock.calls[0]![0]).toMatchObject({
        skip: 10,
        take: 10,
      });
    });

    it("enseña el porqué de un bloqueado: solo las comprobaciones que fallan", async () => {
      const [item] = (
        await fastify.inject({
          method: "GET",
          url: "/growth/admin/borradores?grupo=bloqueados",
          headers: comoAdmin(),
        })
      ).json().data;

      expect(item.resultado).toBe("bloquea");
      expect(item.reglasFallidas).toEqual([
        { regla: "identificacion", ok: false, dura: true, detalle: "x" },
      ]);
      expect(item.oportunidad).toMatchObject({
        id: "o1",
        dominio: "ejemplo.com",
        diasParaCaducar: 10,
      });
    });

    it("la revisión que se lee es la de las reglas, no la consultiva del modelo", async () => {
      await fastify.inject({
        method: "GET",
        url: "/growth/admin/borradores",
        headers: comoAdmin(),
      });
      const select = mock.growthBorrador.findMany.mock.calls[0]![0].select;
      expect(select.revisiones.where).toEqual({ revisor: "reglas" });
      expect(select.revisiones.take).toBe(1);
    });

    it("sin revisiones el resultado es null y no hay reglas fallidas", async () => {
      mock.growthBorrador.findMany.mockResolvedValue([
        filaDeListado({ revisiones: [] }),
      ]);
      const [item] = (
        await fastify.inject({
          method: "GET",
          url: "/growth/admin/borradores",
          headers: comoAdmin(),
        })
      ).json().data;
      expect(item.resultado).toBeNull();
      expect(item.reglasFallidas).toEqual([]);
    });

    it("por defecto son los pendientes; cada grupo filtra por su estado y deja fuera lo de oportunidades caducadas", async () => {
      const viva = { oportunidad: { estado: { not: "caducada" } } };
      const casos: [string, unknown][] = [
        ["", { estado: "pendiente_aprobacion", ...viva }],
        ["?grupo=bloqueados", { estado: "bloqueado", ...viva }],
        ["?grupo=pendientes", { estado: "pendiente_aprobacion", ...viva }],
        ["?grupo=aprobados", { estado: "aprobado", ...viva }],
        ["?grupo=gestionados", { estado: "gestionado", ...viva }],
        ["?grupo=descartados", { estado: "descartado", ...viva }],
        // «Caducado» lo decide SOLO la oportunidad, sea cual sea el estado
        // del borrador (el job de caducidad los pasa todos a descartado).
        ["?grupo=caducados", { oportunidad: { estado: "caducada" } }],
      ];
      for (const [consulta, esperado] of casos) {
        mock.growthBorrador.findMany.mockClear();
        const response = await fastify.inject({
          method: "GET",
          url: `/growth/admin/borradores${consulta}`,
          headers: comoAdmin(),
        });
        expect(response.statusCode).toBe(200);
        expect(
          mock.growthBorrador.findMany.mock.calls[0]![0].where.AND[0]
        ).toEqual(esperado);
      }
    });

    it("los filtros de objetivo, tipo y texto se aplican también a los conteos", async () => {
      await fastify.inject({
        method: "GET",
        url: "/growth/admin/borradores?objetivo=LEADS&tipo=email&q=Peluquer",
        headers: comoAdmin(),
      });
      const extra = mock.growthBorrador.findMany.mock.calls[0]![0].where.AND[1];
      expect(extra).toMatchObject({ objetivo: "LEADS", tipo: "email" });
      expect(extra.OR).toHaveLength(3);
      // Los seis conteos (uno por pestaña) llevan el mismo filtro extra.
      for (const [llamada] of mock.growthBorrador.count.mock.calls) {
        expect(llamada.where.AND[1]).toEqual(extra);
      }
      expect(mock.growthBorrador.count).toHaveBeenCalledTimes(6);
    });

    it("el orden «caducan» ordena por la caducidad de la oportunidad, con los nulos al final", async () => {
      await fastify.inject({
        method: "GET",
        url: "/growth/admin/borradores?orden=caducan",
        headers: comoAdmin(),
      });
      expect(mock.growthBorrador.findMany.mock.calls[0]![0].orderBy[0]).toEqual(
        {
          oportunidad: { expiraEn: { sort: "asc", nulls: "last" } },
        }
      );
    });

    it("rechaza un grupo, un tipo o un orden que no existen y los límites fuera de rango", async () => {
      for (const consulta of [
        "?grupo=todos",
        "?tipo=carta",
        "?orden=azar",
        "?limite=500",
        "?pagina=0",
        "?q=",
      ]) {
        const response = await fastify.inject({
          method: "GET",
          url: `/growth/admin/borradores${consulta}`,
          headers: comoAdmin(),
        });
        expect(response.statusCode, consulta).toBe(400);
        expect(Array.isArray(response.json().error)).toBe(true);
      }
    });
  });

  // ── Detalle ────────────────────────────────────────────────────────────

  describe("detalle", () => {
    function filaDeDetalle(
      estadoOportunidad = "pendiente_aprobacion",
      cambios: Record<string, unknown> = {}
    ) {
      const v2 = {
        ...borradorBd(cambios),
        oportunidad: undefined,
        gestion: null,
        revisiones: [revision("pasa", { id: "r2" })],
      };
      const v1 = {
        ...borradorBd({
          id: "b0",
          version: 1,
          estado: "descartado",
          texto: TEXTO_DE_BORRADOR,
        }),
        oportunidad: undefined,
        gestion: null,
        revisiones: [],
      };
      return {
        id: "b1",
        oportunidad: {
          id: "o1",
          titulo: "Directorio",
          dominio: "ejemplo.com",
          url: "https://ejemplo.com/alta",
          estado: estadoOportunidad,
          objetivoPrincipal: "BACKLINKS",
          expiraEn: null,
          borradores: [v2, v1],
        },
      };
    }

    beforeEach(() => {
      mock.growthAfirmacion.findMany.mockResolvedValue([
        {
          clave: "funcion.reserva_en_calendario",
          tipo: "funcion",
          texto: "Reserva en el calendario",
          valor: null,
          fuente: "web/src/lib/plans.ts#a",
          commitSha: "abc1234",
          vigenteDesde: hace(30),
          vigenteHasta: null,
        },
      ]);
    });

    it("devuelve el borrador completo con sus afirmaciones, revisiones y la oportunidad", async () => {
      mock.growthBorrador.findUnique.mockResolvedValue(filaDeDetalle());
      const response = await fastify.inject({
        method: "GET",
        url: "/growth/admin/borradores/b1",
        headers: comoAdmin(),
      });

      expect(response.statusCode).toBe(200);
      const cuerpo = response.json();
      expect(cuerpo).toMatchObject({
        id: "b1",
        version: 2,
        texto: TEXTO_DE_BORRADOR,
        esEditable: true,
        oportunidad: { id: "o1", estado: "pendiente_aprobacion" },
      });
      expect(cuerpo.afirmacionesDetalle[0]).toMatchObject({
        clave: "funcion.reserva_en_calendario",
        existe: true,
        vigente: true,
        fuente: "web/src/lib/plans.ts#a",
        commitSha: "abc1234",
      });
      expect(cuerpo.revisiones).toHaveLength(1);
      expect(cuerpo.similitudConVersionAnterior).toBe(1);
      // La oportunidad no arrastra la lista de borradores.
      expect(cuerpo.oportunidad).not.toHaveProperty("borradores");
    });

    it("no es editable si ya está aprobado, gestionado o su oportunidad ya avanzó", async () => {
      const casos: [string, Parameters<typeof filaDeDetalle>][] = [
        ["aprobado", ["aprobada", { estado: "aprobado" }]],
        ["gestionado", ["gestionada", { estado: "gestionado" }]],
        ["descartado", ["pendiente_aprobacion", { estado: "descartado" }]],
        ["oportunidad devuelta", ["devuelta", {}]],
        ["oportunidad aprobada", ["aprobada", {}]],
      ];
      for (const [nombre, argumentos] of casos) {
        mock.growthBorrador.findUnique.mockResolvedValue(
          filaDeDetalle(...argumentos)
        );
        const response = await fastify.inject({
          method: "GET",
          url: "/growth/admin/borradores/b1",
          headers: comoAdmin(),
        });
        expect(response.statusCode, nombre).toBe(200);
        expect(response.json().esEditable, nombre).toBe(false);
      }
    });

    it("una versión que ya no es la última no es editable", async () => {
      const fila = filaDeDetalle();
      // b1 pasa a ser la v1 y la v2 es otro borrador.
      const [v2, v1] = fila.oportunidad.borradores;
      fila.oportunidad.borradores = [
        { ...v2!, id: "b2", version: 2 },
        { ...v1!, id: "b1", version: 1, estado: "pendiente_aprobacion" },
      ];
      mock.growthBorrador.findUnique.mockResolvedValue(fila);
      const response = await fastify.inject({
        method: "GET",
        url: "/growth/admin/borradores/b1",
        headers: comoAdmin(),
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ id: "b1", version: 1 });
      expect(response.json().esEditable).toBe(false);
    });

    it("un bloqueado con su oportunidad bloqueada sí es editable", async () => {
      mock.growthBorrador.findUnique.mockResolvedValue(
        filaDeDetalle("bloqueada", { estado: "bloqueado" })
      );
      const response = await fastify.inject({
        method: "GET",
        url: "/growth/admin/borradores/b1",
        headers: comoAdmin(),
      });
      expect(response.json().esEditable).toBe(true);
    });

    it("un borrador que no existe da 404", async () => {
      mock.growthBorrador.findUnique.mockResolvedValue(null);
      const response = await fastify.inject({
        method: "GET",
        url: "/growth/admin/borradores/nada",
        headers: comoAdmin(),
      });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: "El borrador no existe." });
    });
  });

  // ── PATCH ──────────────────────────────────────────────────────────────

  describe("editar a mano (PATCH)", () => {
    beforeEach(() => {
      mock.growthBorrador.findUnique.mockResolvedValue(borradorBd());
      mock.growthBorrador.findFirst.mockResolvedValue({ version: 2 });
      mock.growthBorrador.updateMany.mockResolvedValue({ count: 1 });
      mock.growthOportunidad.updateMany.mockResolvedValue({ count: 1 });
      mock.growthRevisionCumplimiento.create.mockResolvedValue({});
      mock.growthDecision.create.mockResolvedValue({});
      prepararContexto(mock);
    });

    /** Nada de lo que escribe el PATCH puede dejar un borrador aprobado. */
    function nadaApruebaNada() {
      for (const [llamada] of mock.growthBorrador.updateMany.mock.calls) {
        expect(llamada.data.estado).not.toBe("aprobado");
        expect(llamada.data.estado).not.toBe("gestionado");
      }
      for (const [llamada] of mock.growthOportunidad.updateMany.mock.calls) {
        expect(["aprobada", "gestionada"]).not.toContain(llamada.data.estado);
      }
    }

    it("un cambio que cumple las reglas se guarda, marca editadoPorHumano y deja revisión y decisión", async () => {
      const texto = `${TEXTO_DE_BORRADOR} Gracias por vuestro tiempo.`;
      const response = await parchear({ texto, nota: "Más cercano" }, fastify);

      expect(response.statusCode).toBe(200);
      const cuerpo = response.json();
      expect(cuerpo.resultado).not.toBe("bloquea");
      expect(cuerpo.borrador).toMatchObject({
        id: "b1",
        version: 2,
        texto,
        estado: "pendiente_aprobacion",
        editadoPorHumano: true,
      });
      expect(cuerpo.oportunidad).toEqual({
        id: "o1",
        estado: "pendiente_aprobacion",
      });
      expect(cuerpo.comprobaciones.length).toBeGreaterThan(5);

      expect(mock.growthBorrador.updateMany).toHaveBeenCalledWith({
        where: {
          id: "b1",
          estado: "pendiente_aprobacion",
          texto: TEXTO_DE_BORRADOR,
          asunto: "Una recepcionista de IA para vuestro listado",
          enlaceUrl: "https://alhabla.ai/peluqueria?utm_source=listado",
          afirmaciones: { equals: ["funcion.reserva_en_calendario"] },
        },
        data: {
          asunto: "Una recepcionista de IA para vuestro listado",
          texto,
          enlaceUrl: "https://alhabla.ai/peluqueria?utm_source=listado",
          afirmaciones: ["funcion.reserva_en_calendario"],
          estado: "pendiente_aprobacion",
          editadoPorHumano: true,
        },
      });
      // La oportunidad no cambia de estado: no se toca.
      expect(mock.growthOportunidad.updateMany).not.toHaveBeenCalled();
      expect(mock.growthRevisionCumplimiento.create).toHaveBeenCalledOnce();
      expect(
        mock.growthRevisionCumplimiento.create.mock.calls[0]![0].data
      ).toMatchObject({ borradorId: "b1", revisor: "reglas" });
      const decisiones = mock.growthDecision.create.mock.calls.map(
        ([c]) => c.data
      );
      expect(decisiones).toHaveLength(1);
      expect(decisiones[0]).toMatchObject({
        oportunidadId: "o1",
        borradorId: "b1",
        accion: "editar",
        por: ADMIN,
      });
      expect(decisiones[0].motivo).toContain("texto");
      expect(decisiones[0].motivo).toContain("Más cercano");
      nadaApruebaNada();
    });

    it("reevalúa sin compararse consigo mismo (si no, la similitud daría 100 %)", async () => {
      await parchear({ texto: `${TEXTO_DE_BORRADOR} Hasta pronto.` }, fastify);
      const consultas = mock.growthBorrador.findMany.mock.calls.map(
        ([c]) => c.where
      );
      const propia = consultas.find((w) => w.oportunidadId === "o1");
      expect(propia).toMatchObject({ id: { not: "b1" } });
    });

    it("una edición que rompe una regla dura deja el borrador y la oportunidad bloqueados (200, no error)", async () => {
      const response = await parchear(
        { texto: `${TEXTO_DE_BORRADOR} Funciona con Telnyx.` },
        fastify
      );

      expect(response.statusCode).toBe(200);
      const cuerpo = response.json();
      expect(cuerpo.resultado).toBe("bloquea");
      expect(cuerpo.borrador).toMatchObject({
        estado: "bloqueado",
        editadoPorHumano: true,
      });
      expect(cuerpo.oportunidad).toEqual({ id: "o1", estado: "bloqueada" });
      expect(
        cuerpo.comprobaciones.find(
          (c: { regla: string }) => c.regla === "sin_terminos_prohibidos"
        )
      ).toMatchObject({ ok: false, dura: true });

      expect(mock.growthBorrador.updateMany.mock.calls[0]![0].data.estado).toBe(
        "bloqueado"
      );
      expect(mock.growthOportunidad.updateMany).toHaveBeenCalledWith({
        where: { id: "o1", estado: "pendiente_aprobacion" },
        data: { estado: "bloqueada" },
      });
      expect(
        mock.growthRevisionCumplimiento.create.mock.calls[0]![0].data
      ).toMatchObject({ resultado: "bloquea", revisor: "reglas" });
      const acciones = mock.growthDecision.create.mock.calls.map(([c]) => [
        c.data.accion,
        c.data.por,
      ]);
      expect(acciones).toEqual([
        ["editar", ADMIN],
        ["bloquear_por_reglas", "sistema"],
      ]);
      nadaApruebaNada();
    });

    describe("reabrir un bloqueado", () => {
      beforeEach(() => {
        mock.growthBorrador.findUnique.mockResolvedValue(
          borradorBd({
            estado: "bloqueado",
            texto: `${TEXTO_DE_BORRADOR} Funciona con Telnyx.`,
            oportunidad: {
              id: "o1",
              estado: "bloqueada",
              dominio: "ejemplo.com",
            },
            revisiones: [revision("bloquea")],
          })
        );
      });

      it("si ahora pasa las reglas duras vuelve a pendiente_aprobacion (nunca a aprobado)", async () => {
        const response = await parchear({ texto: TEXTO_DE_BORRADOR }, fastify);

        expect(response.statusCode).toBe(200);
        const cuerpo = response.json();
        expect(cuerpo.resultado).not.toBe("bloquea");
        expect(cuerpo.borrador.estado).toBe("pendiente_aprobacion");
        expect(cuerpo.oportunidad).toEqual({
          id: "o1",
          estado: "pendiente_aprobacion",
        });
        expect(mock.growthOportunidad.updateMany).toHaveBeenCalledWith({
          where: { id: "o1", estado: "bloqueada" },
          data: { estado: "pendiente_aprobacion" },
        });
        expect(mock.growthDecision.create).toHaveBeenCalledOnce();
        nadaApruebaNada();
      });

      it("si sigue incumpliendo una regla dura sigue bloqueado y la oportunidad no se mueve", async () => {
        const response = await parchear(
          { texto: `${TEXTO_DE_BORRADOR} Con Telnyx, claro.` },
          fastify
        );

        expect(response.json().resultado).toBe("bloquea");
        expect(response.json().borrador.estado).toBe("bloqueado");
        expect(mock.growthOportunidad.updateMany).not.toHaveBeenCalled();
        nadaApruebaNada();
      });

      it("corregir una afirmación que ya no existe lo reabre; citarla de nuevo, no", async () => {
        mock.growthBorrador.findUnique.mockResolvedValue(
          borradorBd({
            estado: "bloqueado",
            afirmaciones: ["funcion.cerrada"],
            oportunidad: {
              id: "o1",
              estado: "bloqueada",
              dominio: "ejemplo.com",
            },
          })
        );
        const sigue = await parchear(
          {
            afirmaciones: ["funcion.cerrada", "funcion.reserva_en_calendario"],
          },
          fastify
        );
        expect(sigue.json().resultado).toBe("bloquea");

        const arregla = await parchear(
          { afirmaciones: ["funcion.reserva_en_calendario"] },
          fastify
        );
        expect(arregla.json().resultado).not.toBe("bloquea");
        expect(arregla.json().borrador.estado).toBe("pendiente_aprobacion");
      });
    });

    describe("lo que NO se puede editar", () => {
      const casos: [string, Record<string, unknown>][] = [
        ["un aprobado", { estado: "aprobado" }],
        ["un gestionado", { estado: "gestionado" }],
        ["un descartado", { estado: "descartado" }],
        ["un borrador a medias", { estado: "borrador" }],
        ["una versión que no es la última", { version: 1 }],
        [
          "uno cuya oportunidad ya está aprobada",
          { oportunidad: { id: "o1", estado: "aprobada", dominio: "x.com" } },
        ],
        [
          "uno cuya oportunidad se devolvió",
          { oportunidad: { id: "o1", estado: "devuelta", dominio: "x.com" } },
        ],
        [
          "uno cuya oportunidad se descartó",
          { oportunidad: { id: "o1", estado: "descartada", dominio: "x.com" } },
        ],
      ];

      for (const [nombre, cambios] of casos) {
        it(`${nombre} da 409 y no escribe nada`, async () => {
          mock.growthBorrador.findUnique.mockResolvedValue(borradorBd(cambios));
          const response = await parchear({ texto: "otro texto" }, fastify);

          expect(response.statusCode).toBe(409);
          expect(response.json().codigo).toBe("no_editable");
          expect(mock.growthBorrador.updateMany).not.toHaveBeenCalled();
          expect(mock.growthOportunidad.updateMany).not.toHaveBeenCalled();
          expect(mock.growthRevisionCumplimiento.create).not.toHaveBeenCalled();
          expect(mock.growthDecision.create).not.toHaveBeenCalled();
        });
      }

      it("un borrador que no existe da 404", async () => {
        mock.growthBorrador.findUnique.mockResolvedValue(null);
        const response = await parchear({ texto: "otro" }, fastify);
        expect(response.statusCode).toBe(404);
      });
    });

    describe("el cuerpo", () => {
      it("no acepta estado, tipo, versión, textoFinal, editadoPorHumano ni utm: el .strict() da 400", async () => {
        for (const prohibido of [
          { estado: "aprobado" },
          { estado: "pendiente_aprobacion" },
          { tipo: "formulario" },
          { version: 9 },
          { textoFinal: "lo que envié" },
          { editadoPorHumano: false },
          { utm: { utm_source: "x" } },
          { id: "b9" },
        ]) {
          const response = await parchear(
            { texto: "Un texto nuevo", ...prohibido },
            fastify
          );
          expect(response.statusCode, JSON.stringify(prohibido)).toBe(400);
        }
        expect(mock.growthBorrador.updateMany).not.toHaveBeenCalled();
      });

      it("exige al menos un campo que cambiar (la nota sola no cuenta)", async () => {
        for (const cuerpo of [{}, { nota: "solo una nota" }]) {
          const response = await parchear(cuerpo, fastify);
          expect(response.statusCode).toBe(400);
        }
      });

      it("rechaza un enlace que no es http(s), un texto vacío y demasiadas afirmaciones", async () => {
        for (const cuerpo of [
          { enlaceUrl: "javascript:alert(1)" },
          { enlaceUrl: "data:text/html,<script>1</script>" },
          { enlaceUrl: "https://alhabla.ai@sitio-malo.com/" },
          { texto: "   " },
          {
            afirmaciones: Array.from({ length: 51 }, (_, i) => `funcion.f${i}`),
          },
        ]) {
          const response = await parchear(cuerpo, fastify);
          expect(response.statusCode, JSON.stringify(cuerpo)).toBe(400);
        }
      });
    });

    describe("nada que cambiar", () => {
      it("si el cuerpo deja todo igual responde 200 con el estado actual y sin revisión, decisión ni escrituras", async () => {
        mock.growthBorrador.findUnique.mockResolvedValue(
          borradorBd({
            revisiones: [
              revision("aviso", {
                comprobaciones: [
                  {
                    regla: "enlace_con_utm",
                    ok: false,
                    dura: false,
                    detalle: "x",
                  },
                ],
              }),
            ],
          })
        );
        const response = await parchear(
          {
            texto: TEXTO_DE_BORRADOR,
            asunto: "Una recepcionista de IA para vuestro listado",
          },
          fastify
        );

        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({
          resultado: "aviso",
          borrador: { estado: "pendiente_aprobacion", editadoPorHumano: false },
          oportunidad: { id: "o1", estado: "pendiente_aprobacion" },
        });
        expect(mock.growthBorrador.updateMany).not.toHaveBeenCalled();
        expect(mock.growthRevisionCumplimiento.create).not.toHaveBeenCalled();
        expect(mock.growthDecision.create).not.toHaveBeenCalled();
      });
    });

    describe("campos concretos", () => {
      it("un asunto vacío o null se guarda como null", async () => {
        for (const asunto of ["", null]) {
          mock.growthBorrador.updateMany.mockClear();
          const response = await parchear({ asunto }, fastify);
          expect(response.statusCode).toBe(200);
          expect(
            mock.growthBorrador.updateMany.mock.calls[0]![0].data.asunto
          ).toBeNull();
        }
      });

      it("enlaceUrl null quita el enlace y se vuelve a evaluar sin él", async () => {
        const response = await parchear({ enlaceUrl: null }, fastify);
        expect(response.statusCode).toBe(200);
        expect(
          mock.growthBorrador.updateMany.mock.calls[0]![0].data.enlaceUrl
        ).toBeNull();
        expect(
          response
            .json()
            .comprobaciones.find(
              (c: { regla: string }) => c.regla === "enlace_a_alhabla"
            )
        ).toMatchObject({ ok: true });
      });

      it("un enlace a otro dominio bloquea (el enlace que pedimos va a alhabla.ai)", async () => {
        const response = await parchear(
          { enlaceUrl: "https://competencia.com/precios" },
          fastify
        );
        expect(response.json().resultado).toBe("bloquea");
        expect(response.json().borrador.estado).toBe("bloqueado");
      });
    });

    describe("las reglas de agenda no bloquean el texto: dan su propio 409", () => {
      /** Un 409 de agenda no escribe nada: ni el texto, ni estados, ni revisión, ni decisión. */
      function noSeEscribioNada() {
        expect(mock.growthBorrador.updateMany).not.toHaveBeenCalled();
        expect(mock.growthBorrador.update).not.toHaveBeenCalled();
        expect(mock.growthOportunidad.updateMany).not.toHaveBeenCalled();
        expect(mock.growthRevisionCumplimiento.create).not.toHaveBeenCalled();
        expect(mock.growthDecision.create).not.toHaveBeenCalled();
      }

      it("con el tope semanal ya alcanzado, corregir una errata da 409 tope_semanal y no cambia nada", async () => {
        prepararContexto(mock, { hechasEstaSemana: 5 });
        const response = await parchear(
          { texto: `${TEXTO_DE_BORRADOR} Gracias.` },
          fastify
        );
        expect(response.statusCode).toBe(409);
        expect(response.json().codigo).toBe("tope_semanal");
        expect(response.json().error).toContain("tope");
        noSeEscribioNada();
      });

      it("el tope cuenta lo hecho más lo aprobado sin gestionar, igual que al aprobar", async () => {
        prepararContexto(mock, {
          hechasEstaSemana: 2,
          aprobadasSinGestionar: 3,
        });
        const response = await parchear(
          { texto: `${TEXTO_DE_BORRADOR} Gracias.` },
          fastify
        );
        expect(response.statusCode).toBe(409);
        expect(response.json().codigo).toBe("tope_semanal");
        noSeEscribioNada();
      });

      it("con hueco en el tope, lo aprobado sin gestionar no impide corregir el texto", async () => {
        prepararContexto(mock, {
          hechasEstaSemana: 1,
          aprobadasSinGestionar: 3,
        });
        const response = await parchear(
          { texto: `${TEXTO_DE_BORRADOR} Gracias.` },
          fastify
        );
        expect(response.statusCode).toBe(200);
        expect(response.json().borrador.estado).toBe("pendiente_aprobacion");
      });

      it("un dominio contactado hace poco da 409 dominio_en_enfriamiento", async () => {
        prepararContexto(mock, { gestionesDelDominio: [hace(10)] });
        const response = await parchear(
          { texto: `${TEXTO_DE_BORRADOR} Gracias.` },
          fastify
        );
        expect(response.statusCode).toBe(409);
        expect(response.json().codigo).toBe("dominio_en_enfriamiento");
        // Igual que al aprobar: dice hasta cuándo no se puede volver a escribir.
        const hasta = new Date(response.json().hasta).getTime();
        expect(hasta).toBeGreaterThan(Date.now() + 79 * 24 * 60 * 60 * 1000);
        expect(hasta).toBeLessThan(Date.now() + 81 * 24 * 60 * 60 * 1000);
        expect(response.json().error).toContain(
          "no se puede volver a escribir"
        );
        noSeEscribioNada();
      });

      it("otra oportunidad aprobada del mismo dominio da 409 dominio_ya_aprobado", async () => {
        prepararContexto(mock, { aprobadasDelDominio: 1 });
        const response = await parchear(
          { texto: `${TEXTO_DE_BORRADOR} Gracias.` },
          fastify
        );
        expect(response.statusCode).toBe(409);
        expect(response.json().codigo).toBe("dominio_ya_aprobado");
        noSeEscribioNada();
      });

      it("un borrador bloqueado por el texto que se corrige con la agenda llena sigue bloqueado: 409 y no se guarda", async () => {
        mock.growthBorrador.findUnique.mockResolvedValue(
          borradorBd({
            estado: "bloqueado",
            oportunidad: {
              id: "o1",
              estado: "bloqueada",
              dominio: "ejemplo.com",
            },
          })
        );
        prepararContexto(mock, { hechasEstaSemana: 5 });
        const response = await parchear(
          { texto: `${TEXTO_DE_BORRADOR} Ya corregido.` },
          fastify
        );
        expect(response.statusCode).toBe(409);
        expect(response.json().codigo).toBe("tope_semanal");
        noSeEscribioNada();
      });

      it("si falla el TEXTO, bloquea (200) aunque la agenda también esté llena; la agenda sale como aviso, no como causa", async () => {
        prepararContexto(mock, { hechasEstaSemana: 5 });
        const response = await parchear(
          { texto: `${TEXTO_DE_BORRADOR} Con Telnyx.` },
          fastify
        );
        expect(response.statusCode).toBe(200);
        const cuerpo = response.json();
        expect(cuerpo.resultado).toBe("bloquea");
        expect(cuerpo.borrador.estado).toBe("bloqueado");
        expect(cuerpo.oportunidad.estado).toBe("bloqueada");
        const tope = cuerpo.comprobaciones.find(
          (c: { regla: string }) => c.regla === "tope_semanal"
        );
        expect(tope).toMatchObject({ ok: false, dura: false });
        const decisiones = mock.growthDecision.create.mock.calls.map(
          ([c]) => c.data
        );
        const bloqueo = decisiones.find(
          (d) => d.accion === "bloquear_por_reglas"
        );
        // El motivo nombra lo que de verdad bloqueó, no la agenda.
        expect(bloqueo.motivo).toContain("sin_terminos_prohibidos");
        expect(bloqueo.motivo).not.toContain("tope_semanal");
      });

      it("el parecido con una versión anterior de la MISMA oportunidad solo avisa", async () => {
        prepararContexto(mock, { textosDeLaMisma: [TEXTO_DE_BORRADOR] });
        const response = await parchear(
          { texto: `${TEXTO_DE_BORRADOR} Gracias.` },
          fastify
        );
        expect(response.json().resultado).toBe("aviso");
        expect(response.json().borrador.estado).toBe("pendiente_aprobacion");
      });

      it("el mismo texto de OTRA oportunidad bloquea", async () => {
        prepararContexto(mock, {
          textosDeOtras: [`${TEXTO_DE_BORRADOR} Gracias.`],
        });
        const response = await parchear(
          { texto: `${TEXTO_DE_BORRADOR} Gracias.` },
          fastify
        );
        expect(response.json().resultado).toBe("bloquea");
      });
    });

    describe("concurrencia", () => {
      it("si alguien editó el borrador entre medias (el updateMany condicional no encuentra nada) da 409 y no deja revisión ni decisión", async () => {
        mock.growthBorrador.updateMany.mockResolvedValue({ count: 0 });
        const response = await parchear(
          { texto: "Un texto distinto" },
          fastify
        );

        expect(response.statusCode).toBe(409);
        expect(response.json().codigo).toBe("conflicto");
        expect(mock.growthRevisionCumplimiento.create).not.toHaveBeenCalled();
        expect(mock.growthDecision.create).not.toHaveBeenCalled();
      });

      it("si la oportunidad cambió de estado entre medias, 409 y no se escribe la revisión", async () => {
        mock.growthOportunidad.updateMany.mockResolvedValue({ count: 0 });
        const response = await parchear(
          { texto: `${TEXTO_DE_BORRADOR} Con Telnyx.` },
          fastify
        );
        expect(response.statusCode).toBe(409);
        expect(mock.growthRevisionCumplimiento.create).not.toHaveBeenCalled();
        expect(mock.growthDecision.create).not.toHaveBeenCalled();
      });

      it("todo ocurre en una sola transacción", async () => {
        await parchear({ texto: `${TEXTO_DE_BORRADOR} Gracias.` }, fastify);
        expect(mock.$transaction).toHaveBeenCalledOnce();
      });
    });
  });

  // ── Seguridad común ────────────────────────────────────────────────────

  describe("acceso", () => {
    const rutas: [string, string, object | undefined][] = [
      ["GET", "/growth/admin/borradores", undefined],
      ["GET", "/growth/admin/borradores/b1", undefined],
      ["PATCH", "/growth/admin/borradores/b1", { texto: "x" }],
    ];

    for (const [metodo, url, payload] of rutas) {
      it(`${metodo} ${url}: sin sesión da 401 y un correo ajeno da 403`, async () => {
        const sin = await fastify.inject({
          method: metodo as "GET",
          url,
          payload,
        });
        expect(sin.statusCode).toBe(401);

        mockVerifyIdToken.mockResolvedValue({
          getPayload: () => ({
            email: "otro@ejemplo.com",
            email_verified: true,
          }),
        });
        const ajeno = await fastify.inject({
          method: metodo as "GET",
          url,
          headers: comoAdmin(),
          payload,
        });
        expect(ajeno.statusCode).toBe(403);
      });
    }

    it("un token de agente no abre las rutas del administrador", async () => {
      // Google rechaza lo que no es uno de sus ID token.
      mockVerifyIdToken.mockRejectedValue(
        new Error("Wrong number of segments")
      );
      const response = await fastify.inject({
        method: "PATCH",
        url: "/growth/admin/borradores/b1",
        headers: { authorization: "Bearer gta_token-de-agente" },
        payload: { texto: "x" },
      });
      expect(response.statusCode).toBe(401);
      expect(mock.growthBorrador.updateMany).not.toHaveBeenCalled();
    });

    it("las respuestas no se cachean, ni siquiera las de error", async () => {
      const ok = await fastify.inject({
        method: "GET",
        url: "/growth/admin/borradores",
        headers: comoAdmin(),
      });
      const error = await fastify.inject({
        method: "GET",
        url: "/growth/admin/borradores?grupo=nada",
        headers: comoAdmin(),
      });
      expect(ok.headers["cache-control"]).toBe("no-store");
      expect(error.headers["cache-control"]).toBe("no-store");
    });

    it("un fallo inesperado de la base de datos es un 500 genérico que no filtra el mensaje", async () => {
      mock.growthBorrador.findMany.mockRejectedValue(
        new Error("connection refused 10.0.0.5:5432 password=secreto")
      );
      mock.growthBorrador.count.mockResolvedValue(0);
      const response = await fastify.inject({
        method: "GET",
        url: "/growth/admin/borradores",
        headers: comoAdmin(),
      });
      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({ error: "Error interno." });
    });
  });
});
