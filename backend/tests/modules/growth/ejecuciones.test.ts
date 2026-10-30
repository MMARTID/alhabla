import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify from "fastify";
import { growthRoutes } from "../../../src/modules/growth/routes.js";
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

const HORA = 60 * 60 * 1000;

/** `growth_ajustes.findUnique` por clave (la pausa). */
function ajustesPorClave(valores: Record<string, unknown>) {
  mock.growthAjuste.findUnique.mockImplementation(
    async ({ where }: { where: { clave: string } }) =>
      where.clave in valores
        ? {
            clave: where.clave,
            valor: valores[where.clave],
            actualizadoEn: new Date(),
          }
        : null
  );
}

describe("ejecuciones de Alhabla Growth", () => {
  let fastify: ReturnType<typeof Fastify>;

  function abrir(payload: unknown, headers = comoAgente()) {
    return fastify.inject({
      method: "POST",
      url: "/growth/agente/ejecuciones",
      headers,
      payload: payload as object,
    });
  }

  function cerrar(payload: unknown, id = "e1", headers = comoAgente()) {
    return fastify.inject({
      method: "POST",
      url: `/growth/agente/ejecuciones/${id}/cierre`,
      headers,
      payload: payload as object,
    });
  }

  function comoAdminGet(url: string) {
    return fastify.inject({ method: "GET", url, headers: comoAdmin() });
  }

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
    ajustesPorClave({});
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ email: ADMIN, email_verified: true }),
    });

    fastify = Fastify();
    await fastify.register(growthRoutes);
  });

  afterEach(async () => {
    await fastify.close();
  });

  // ── abrir ──────────────────────────────────────────────────────────────

  describe("abrir (agente)", () => {
    beforeEach(() => {
      mock.growthEjecucion.updateMany.mockResolvedValue({ count: 0 });
      mock.growthEjecucion.create.mockImplementation(
        async ({ data }: { data: { inicio: Date } }) => ({
          id: "e1",
          estado: "en_curso",
          inicio: data.inicio,
        })
      );
    });

    it("crea la ejecución en curso y la devuelve con su id", async () => {
      const response = await abrir({
        disparador: "programada",
        versionPrompts: "abcdef1234567",
        modulos: { discovery: { estado: "omitido" } },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({
        id: "e1",
        estado: "en_curso",
        interrumpidasCerradas: 0,
        reutilizada: false,
      });
      expect(mock.growthEjecucion.create.mock.calls[0]![0].data).toMatchObject({
        disparador: "programada",
        estado: "en_curso",
        versionPrompts: "abcdef1234567",
        modulos: { discovery: { estado: "omitido" } },
      });
    });

    it("cierra como error («interrumpida») las que llevan abiertas más de 6 h y dice cuántas", async () => {
      mock.growthEjecucion.updateMany.mockResolvedValue({ count: 2 });
      const response = await abrir({ disparador: "manual" });

      expect(response.json().interrumpidasCerradas).toBe(2);
      const llamada = mock.growthEjecucion.updateMany.mock.calls[0]![0];
      expect(llamada.where.estado).toBe("en_curso");
      const limite = llamada.where.inicio.lt.getTime();
      expect(limite).toBeLessThan(Date.now() - 6 * HORA + 5000);
      expect(limite).toBeGreaterThan(Date.now() - 6 * HORA - 5000);
      expect(llamada.data).toMatchObject({ estado: "error" });
      expect(llamada.data.error).toContain("interrumpida");
      expect(llamada.data.fin).toBeInstanceOf(Date);
    });

    it("cerrar las viejas y abrir la nueva ocurren en la misma transacción (cierra antes de crear)", async () => {
      await abrir({ disparador: "manual" });
      expect(mock.$transaction).toHaveBeenCalledOnce();
      const orden = [
        mock.growthEjecucion.updateMany.mock.invocationCallOrder[0]!,
        mock.growthEjecucion.create.mock.invocationCallOrder[0]!,
      ];
      expect(orden[0]).toBeLessThan(orden[1]!);
    });

    it("toma el cerrojo de Postgres (pg_advisory_xact_lock) ANTES de cerrar las viejas, mirar las recientes o crear", async () => {
      await abrir({ disparador: "manual" });

      expect(mock.$executeRaw).toHaveBeenCalledOnce();
      const [plantilla] = mock.$executeRaw.mock.calls[0]! as unknown as [
        string[],
      ];
      const sql = plantilla.join("?");
      expect(sql).toContain("pg_advisory_xact_lock");
      expect(sql).toContain("growth_ejecucion");
      const cerrojo = mock.$executeRaw.mock.invocationCallOrder[0]!;
      expect(cerrojo).toBeLessThan(
        mock.growthEjecucion.updateMany.mock.invocationCallOrder[0]!
      );
      expect(cerrojo).toBeLessThan(
        mock.growthEjecucion.findFirst.mock.invocationCallOrder[0]!
      );
      expect(cerrojo).toBeLessThan(
        mock.growthEjecucion.create.mock.invocationCallOrder[0]!
      );
    });

    describe("dos aperturas a la vez (o un reintento) son una sola", () => {
      it("mira si hay una ejecución en curso abierta hace menos de 30 s (después de cerrar las viejas)", async () => {
        await abrir({ disparador: "manual" });

        const donde = mock.growthEjecucion.findFirst.mock.calls[0]![0].where;
        expect(donde.estado).toBe("en_curso");
        const desde = donde.inicio.gte.getTime();
        expect(desde).toBeLessThanOrEqual(Date.now() - 30_000 + 1000);
        expect(desde).toBeGreaterThan(Date.now() - 30_000 - 5000);
        expect(
          mock.growthEjecucion.updateMany.mock.invocationCallOrder[0]!
        ).toBeLessThan(
          mock.growthEjecucion.findFirst.mock.invocationCallOrder[0]!
        );
      });

      it("si la hay, la devuelve (200, reutilizada) y NO crea otra", async () => {
        const inicio = new Date(Date.now() - 4000);
        mock.growthEjecucion.findFirst.mockResolvedValue({
          id: "e0",
          estado: "en_curso",
          inicio,
        });
        const response = await abrir({ disparador: "programada" });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({
          id: "e0",
          estado: "en_curso",
          inicio: inicio.toISOString(),
          interrumpidasCerradas: 0,
          reutilizada: true,
        });
        expect(mock.growthEjecucion.create).not.toHaveBeenCalled();
      });

      it("sin una reciente, crea (201) aunque haya otras en curso más antiguas: conviven hasta las 6 h", async () => {
        mock.growthEjecucion.findFirst.mockResolvedValue(null);
        const response = await abrir({ disparador: "programada" });

        expect(response.statusCode).toBe(201);
        expect(response.json().reutilizada).toBe(false);
        expect(mock.growthEjecucion.create).toHaveBeenCalledOnce();
      });

      it("las viejas interrumpidas se cuentan también cuando se reutiliza la reciente", async () => {
        mock.growthEjecucion.updateMany.mockResolvedValue({ count: 1 });
        mock.growthEjecucion.findFirst.mockResolvedValue({
          id: "e0",
          estado: "en_curso",
          inicio: new Date(),
        });
        const cuerpo = (await abrir({ disparador: "manual" })).json();
        expect(cuerpo).toMatchObject({
          reutilizada: true,
          interrumpidasCerradas: 1,
        });
      });
    });

    it("no toca las ejecuciones recientes: solo las más viejas de 6 h", async () => {
      await abrir({ disparador: "manual" });
      const donde = mock.growthEjecucion.updateMany.mock.calls[0]![0].where;
      // `lt`, no `lte` ni sin límite: lo que lleva menos de 6 h sigue en curso.
      expect(Object.keys(donde.inicio)).toEqual(["lt"]);
    });

    it("el cuerpo es estricto y la versión de los prompts tiene forma de sha de git", async () => {
      const malos: unknown[] = [
        {},
        { disparador: "cada_hora" },
        { disparador: "manual", estado: "ok" },
        { disparador: "manual", resumen: {} },
        { disparador: "manual", versionPrompts: "HEAD" },
        { disparador: "manual", versionPrompts: "abc" },
        { disparador: "manual", versionPrompts: "g".repeat(12) },
        { disparador: "manual", versionPrompts: "a".repeat(41) },
        { disparador: "manual", modulos: { texto: "x".repeat(9000) } },
        // Cada módulo es { estado, inicio?, fin?, error?, notas? }, estricto.
        { disparador: "manual", modulos: { discovery: { resultado: "ok" } } },
        { disparador: "manual", modulos: { discovery: { estado: "casi" } } },
        { disparador: "manual", modulos: { discovery: "ok" } },
        {
          disparador: "manual",
          modulos: { discovery: { estado: "ok", x: 1 } },
        },
      ];
      for (const cuerpo of malos) {
        const response = await abrir(cuerpo);
        expect(response.statusCode, JSON.stringify(cuerpo).slice(0, 80)).toBe(
          400
        );
      }
      expect(mock.growthEjecucion.create).not.toHaveBeenCalled();
    });

    it("con la pausa activa responde 409 `pausa` y no abre ni cierra nada", async () => {
      ajustesPorClave({ pausa: true });
      const response = await abrir({ disparador: "programada" });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({
        error: "Growth está en pausa.",
        codigo: "pausa",
      });
      expect(mock.growthEjecucion.updateMany).not.toHaveBeenCalled();
      expect(mock.growthEjecucion.create).not.toHaveBeenCalled();
    });

    it("pide el alcance `escribir`: un token solo de lectura recibe 403", async () => {
      mock.growthTokenAgente.findUnique.mockResolvedValue(
        registroDeToken({ alcances: ["leer"] })
      );
      const response = await abrir({ disparador: "manual" });
      expect(response.statusCode).toBe(403);
      expect(mock.growthEjecucion.create).not.toHaveBeenCalled();
    });

    it("sin token, con un token revocado o con el ID token del administrador: 401", async () => {
      expect(
        (
          await fastify.inject({
            method: "POST",
            url: "/growth/agente/ejecuciones",
            payload: { disparador: "manual" },
          })
        ).statusCode
      ).toBe(401);

      mock.growthTokenAgente.findUnique.mockResolvedValue(
        registroDeToken({ revocadoEn: hace(1) })
      );
      expect((await abrir({ disparador: "manual" })).statusCode).toBe(401);

      mock.growthTokenAgente.findUnique.mockResolvedValue(registroDeToken());
      expect(
        (await abrir({ disparador: "manual" }, comoAdmin())).statusCode
      ).toBe(401);
      expect(mock.growthEjecucion.create).not.toHaveBeenCalled();
    });
  });

  // ── cerrar ─────────────────────────────────────────────────────────────

  describe("cerrar (agente)", () => {
    const abierta = {
      id: "e1",
      estado: "en_curso",
      inicio: hace(0.05),
      fin: null,
      resumen: null,
      modulos: { discovery: { estado: "ok", notas: "al abrir" } },
    };

    /** Lo que de verdad hay en la base de datos para esa ejecución. */
    function conOportunidades(
      porEstado: Record<string, number>,
      descartadas: (Record<string, unknown> | null)[] = [],
      borradores = 0
    ) {
      mock.growthOportunidad.groupBy.mockResolvedValue(
        Object.entries(porEstado).map(([estado, n]) => ({
          estado,
          _count: { _all: n },
        }))
      );
      mock.growthOportunidad.findMany.mockResolvedValue(
        descartadas.map((datos) => ({ datos }))
      );
      mock.growthBorrador.count.mockResolvedValue(borradores);
    }

    beforeEach(() => {
      mock.growthEjecucion.findUnique.mockResolvedValue(abierta);
      mock.growthEjecucion.updateMany.mockResolvedValue({ count: 1 });
      conOportunidades({});
    });

    it("el servidor calcula el resumen con recuentos reales, no con los que declara el agente", async () => {
      conOportunidades(
        {
          detectada: 1,
          descartada: 3,
          calificada: 2,
          investigada: 1,
          pendiente_aprobacion: 2,
          bloqueada: 1,
        },
        [
          { codigoDescarte: "bajo_umbral" },
          { codigoDescarte: "bajo_umbral" },
          { codigoDescarte: "competidor" },
        ],
        4
      );
      const response = await cerrar({
        estado: "ok",
        resumen: { candidatas: 999, descartadas: 0, notas: "Todo en orden" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().resumen).toEqual({
        candidatas: 10,
        // Las que siguen vivas tras calificar: ni detectadas ni descartadas.
        calificadas: 6,
        descartadas: 3,
        descartesPorMotivo: { bajo_umbral: 2, competidor: 1 },
        borradores: 4,
        bloqueadas: 1,
        notas: "Todo en orden",
        // Lo que dijo el agente queda aparte, para compararlo.
        declaradoPorElAgente: { candidatas: 999, descartadas: 0 },
      });
      // Los contadores se leen de las oportunidades de ESA ejecución.
      expect(mock.growthOportunidad.groupBy.mock.calls[0]![0].where).toEqual({
        ejecucionId: "e1",
      });
      expect(mock.growthBorrador.count.mock.calls[0]![0].where).toEqual({
        oportunidad: { ejecucionId: "e1" },
      });
    });

    it("cero oportunidades es un resultado válido", async () => {
      const response = await cerrar({ estado: "ok" });

      expect(response.statusCode).toBe(200);
      expect(response.json().resumen).toEqual({
        candidatas: 0,
        calificadas: 0,
        descartadas: 0,
        descartesPorMotivo: {},
        borradores: 0,
        bloqueadas: 0,
      });
    });

    it("un descarte sin código se cuenta como `otro`", async () => {
      conOportunidades({ descartada: 2 }, [null, { nota: "x" }]);
      const response = await cerrar({ estado: "parcial" });
      expect(response.json().resumen.descartesPorMotivo).toEqual({ otro: 2 });
    });

    it("escribe el estado, el fin, el resumen y fusiona los módulos con los que se dieron al abrir", async () => {
      const response = await cerrar({
        estado: "parcial",
        error: "Falló el módulo de enlaces",
        modulos: {
          enlaces: { estado: "error", error: "timeout" },
          discovery: { estado: "ok", notas: "al cerrar" },
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ id: "e1", estado: "parcial" });
      const llamada = mock.growthEjecucion.updateMany.mock.calls[0]![0];
      expect(llamada.where).toEqual({ id: "e1", estado: "en_curso" });
      expect(llamada.data).toMatchObject({
        estado: "parcial",
        error: "Falló el módulo de enlaces",
      });
      expect(llamada.data.fin).toBeInstanceOf(Date);
      expect(llamada.data.modulos).toEqual({
        discovery: { estado: "ok", notas: "al cerrar" },
        enlaces: { estado: "error", error: "timeout" },
      });
    });

    it("de cada módulo solo se guardan los campos conocidos", async () => {
      await cerrar({
        estado: "ok",
        modulos: { enlaces: { estado: "ok", secreto: "no se guarda" } },
      });
      const modulos =
        mock.growthEjecucion.updateMany.mock.calls[0]![0].data.modulos;
      expect(modulos.enlaces).toEqual({ estado: "ok" });
    });

    it("sin módulos nuevos conserva los de la apertura sin reescribirlos", async () => {
      await cerrar({ estado: "ok" });
      expect(
        mock.growthEjecucion.updateMany.mock.calls[0]![0].data.modulos
      ).toEqual(abierta.modulos);
    });

    it("cerrar con error exige explicarlo; con ok no guarda ningún error", async () => {
      expect((await cerrar({ estado: "error" })).statusCode).toBe(400);
      expect(mock.growthEjecucion.updateMany).not.toHaveBeenCalled();

      const ok = await cerrar({ estado: "ok" });
      expect(ok.statusCode).toBe(200);
      expect(
        mock.growthEjecucion.updateMany.mock.calls[0]![0].data.error
      ).toBeNull();
    });

    describe("idempotencia", () => {
      const cerrada = {
        id: "e1",
        estado: "ok",
        inicio: hace(1),
        fin: hace(0.5),
        resumen: { candidatas: 4 },
        modulos: null,
      };

      it("cerrar otra vez con el MISMO estado es un reintento de red: 200, mismos datos y sin escribir", async () => {
        mock.growthEjecucion.findUnique.mockResolvedValue(cerrada);
        const response = await cerrar({ estado: "ok" });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({
          id: "e1",
          estado: "ok",
          resumen: { candidatas: 4 },
        });
        expect(mock.growthEjecucion.updateMany).not.toHaveBeenCalled();
        expect(mock.growthOportunidad.groupBy).not.toHaveBeenCalled();
      });

      it("con otro estado da 409 y no reescribe nada", async () => {
        mock.growthEjecucion.findUnique.mockResolvedValue(cerrada);
        const response = await cerrar({ estado: "parcial" });

        expect(response.statusCode).toBe(409);
        expect(response.json().codigo).toBe("ejecucion_cerrada");
        expect(response.json().error).toContain("«ok»");
        expect(mock.growthEjecucion.updateMany).not.toHaveBeenCalled();
      });

      it("una ejecución que se cerró como interrumpida (error) acepta el cierre `error` pero no un `ok` tardío", async () => {
        mock.growthEjecucion.findUnique.mockResolvedValue({
          ...cerrada,
          estado: "error",
        });
        expect((await cerrar({ estado: "error", error: "x" })).statusCode).toBe(
          200
        );
        expect((await cerrar({ estado: "ok" })).statusCode).toBe(409);
      });

      it("dos cierres a la vez: el que pierde la carrera relee y responde según el estado del ganador", async () => {
        // El updateMany condicional no encuentra nada: otro la cerró entre medias.
        mock.growthEjecucion.updateMany.mockResolvedValue({ count: 0 });

        mock.growthEjecucion.findUnique
          .mockResolvedValueOnce(abierta)
          .mockResolvedValueOnce({ ...cerrada, estado: "ok" });
        const mismo = await cerrar({ estado: "ok" });
        expect(mismo.statusCode).toBe(200);

        mock.growthEjecucion.findUnique
          .mockResolvedValueOnce(abierta)
          .mockResolvedValueOnce({ ...cerrada, estado: "ok" });
        const distinto = await cerrar({ estado: "parcial" });
        expect(distinto.statusCode).toBe(409);
      });
    });

    it("una ejecución que no existe da 404", async () => {
      mock.growthEjecucion.findUnique.mockResolvedValue(null);
      const response = await cerrar({ estado: "ok" }, "nada");
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: "La ejecución no existe." });
    });

    it("cerrar SIGUE permitido con la pausa activa (una ejecución abierta tiene que poder acabar)", async () => {
      ajustesPorClave({ pausa: true });
      const response = await cerrar({ estado: "ok" });
      expect(response.statusCode).toBe(200);
      expect(mock.growthEjecucion.updateMany).toHaveBeenCalledOnce();
    });

    it("el cuerpo es estricto: estados, códigos de descarte y contadores válidos", async () => {
      const malos: unknown[] = [
        {},
        { estado: "en_curso" },
        { estado: "ok", fin: "2026-10-30T10:00:00Z" },
        { estado: "ok", resumen: { magia: 1 } },
        { estado: "ok", resumen: { candidatas: -1 } },
        { estado: "ok", resumen: { candidatas: 1.5 } },
        { estado: "ok", resumen: { descartesPorMotivo: { inventado: 1 } } },
        { estado: "ok", modulos: { x: { estado: "genial" } } },
      ];
      for (const cuerpo of malos) {
        const response = await cerrar(cuerpo);
        expect(response.statusCode, JSON.stringify(cuerpo)).toBe(400);
      }
      expect(mock.growthEjecucion.updateMany).not.toHaveBeenCalled();
    });

    it("pide el alcance `escribir`", async () => {
      mock.growthTokenAgente.findUnique.mockResolvedValue(
        registroDeToken({ alcances: ["leer"] })
      );
      expect((await cerrar({ estado: "ok" })).statusCode).toBe(403);
      expect(mock.growthEjecucion.updateMany).not.toHaveBeenCalled();
    });
  });

  // ── lo que ve el administrador ─────────────────────────────────────────

  describe("listado (administrador)", () => {
    const fila = (cambios: Record<string, unknown> = {}) => ({
      id: "e1",
      disparador: "programada",
      inicio: new Date("2026-10-30T05:00:00.000Z"),
      fin: new Date("2026-10-30T05:12:30.000Z"),
      estado: "ok",
      resumen: { candidatas: 8 },
      modulos: { discovery: { estado: "ok" } },
      versionPrompts: "abcdef1",
      error: null,
      _count: { oportunidades: 8 },
      ...cambios,
    });

    beforeEach(() => {
      mock.growthEjecucion.findMany.mockResolvedValue([
        fila(),
        fila({
          id: "e0",
          fin: null,
          estado: "en_curso",
          _count: { oportunidades: 0 },
        }),
      ]);
      mock.growthEjecucion.count.mockResolvedValue(12);
    });

    it("pagina de la más nueva a la más vieja, con la duración y cuántas oportunidades creó", async () => {
      const response = await comoAdminGet(
        "/growth/admin/ejecuciones?pagina=2&limite=5"
      );

      expect(response.statusCode).toBe(200);
      const cuerpo = response.json();
      expect(cuerpo).toMatchObject({ total: 12, pagina: 2, limite: 5 });
      expect(cuerpo.data[0]).toMatchObject({
        id: "e1",
        duracionSegundos: 750,
        oportunidades: 8,
        versionPrompts: "abcdef1",
      });
      expect(cuerpo.data[0]).not.toHaveProperty("_count");
      // Una en curso aún no tiene duración.
      expect(cuerpo.data[1]).toMatchObject({
        estado: "en_curso",
        duracionSegundos: null,
      });
      expect(mock.growthEjecucion.findMany.mock.calls[0]![0]).toMatchObject({
        orderBy: [{ inicio: "desc" }, { id: "desc" }],
        skip: 5,
        take: 5,
      });
    });

    it("filtra por estado y por disparador", async () => {
      await comoAdminGet(
        "/growth/admin/ejecuciones?estado=error&disparador=manual"
      );
      expect(mock.growthEjecucion.findMany.mock.calls[0]![0].where).toEqual({
        estado: "error",
        disparador: "manual",
      });
      expect(mock.growthEjecucion.count.mock.calls[0]![0].where).toEqual({
        estado: "error",
        disparador: "manual",
      });
    });

    it("rechaza un estado o un disparador que no existen", async () => {
      for (const consulta of [
        "?estado=colgada",
        "?disparador=lunes",
        "?limite=0",
      ]) {
        expect(
          (await comoAdminGet(`/growth/admin/ejecuciones${consulta}`))
            .statusCode
        ).toBe(400);
      }
    });
  });

  describe("detalle (administrador)", () => {
    beforeEach(() => {
      mock.growthEjecucion.findUnique.mockResolvedValue({
        id: "e1",
        disparador: "manual",
        inicio: new Date("2026-10-30T05:00:00.000Z"),
        fin: new Date("2026-10-30T05:01:00.000Z"),
        estado: "ok",
        resumen: { candidatas: 2 },
        modulos: null,
        versionPrompts: null,
        error: null,
      });
      mock.growthOportunidad.groupBy.mockResolvedValue([
        { estado: "descartada", _count: { _all: 2 } },
        { estado: "pendiente_aprobacion", _count: { _all: 1 } },
      ]);
      // Dos consultas: las descartadas (solo `datos`) y las 200 del detalle.
      mock.growthOportunidad.findMany.mockImplementation(
        async ({ where }: { where: { estado?: string } }) =>
          where.estado === "descartada"
            ? [
                { datos: { codigoDescarte: "irrelevante" } },
                { datos: { codigoDescarte: "irrelevante" } },
              ]
            : [
                {
                  id: "o1",
                  titulo: "Una",
                  dominio: "uno.com",
                  estado: "descartada",
                  objetivoPrincipal: "BACKLINKS",
                  datos: { codigoDescarte: "irrelevante", nota: "privada" },
                },
                {
                  id: "o2",
                  titulo: "Dos",
                  dominio: "dos.com",
                  estado: "pendiente_aprobacion",
                  objetivoPrincipal: "LEADS",
                  datos: null,
                },
              ]
      );
      mock.growthBorrador.count.mockResolvedValue(1);
    });

    it("da los contadores del servidor: por estado (todos), por motivo de descarte y borradores", async () => {
      const response = await comoAdminGet("/growth/admin/ejecuciones/e1");

      expect(response.statusCode).toBe(200);
      const cuerpo = response.json();
      expect(cuerpo.id).toBe("e1");
      expect(cuerpo.duracionSegundos).toBe(60);
      expect(Object.keys(cuerpo.oportunidadesPorEstado)).toHaveLength(13);
      expect(cuerpo.oportunidadesPorEstado).toMatchObject({
        descartada: 2,
        pendiente_aprobacion: 1,
        aprobada: 0,
      });
      expect(cuerpo.descartesPorMotivo).toEqual([
        { codigo: "irrelevante", n: 2 },
      ]);
      expect(cuerpo.borradores).toBe(1);
    });

    it("lista las oportunidades (tope 200) con su código de descarte y sin el resto de `datos`", async () => {
      const cuerpo = (
        await comoAdminGet("/growth/admin/ejecuciones/e1")
      ).json();

      expect(cuerpo.oportunidades).toEqual([
        {
          id: "o1",
          titulo: "Una",
          dominio: "uno.com",
          estado: "descartada",
          objetivoPrincipal: "BACKLINKS",
          codigoDescarte: "irrelevante",
        },
        {
          id: "o2",
          titulo: "Dos",
          dominio: "dos.com",
          estado: "pendiente_aprobacion",
          objetivoPrincipal: "LEADS",
          codigoDescarte: null,
        },
      ]);
      const detalle = mock.growthOportunidad.findMany.mock.calls
        .map(([c]) => c)
        .find((c) => c.take === 200)!;
      expect(detalle.where).toEqual({ ejecucionId: "e1" });
    });

    it("una ejecución que no existe da 404", async () => {
      mock.growthEjecucion.findUnique.mockResolvedValue(null);
      const response = await comoAdminGet("/growth/admin/ejecuciones/nada");
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: "La ejecución no existe." });
    });
  });

  describe("acceso del administrador", () => {
    it("sin sesión 401 y con un correo ajeno 403, en el listado y en el detalle", async () => {
      for (const url of [
        "/growth/admin/ejecuciones",
        "/growth/admin/ejecuciones/e1",
      ]) {
        expect((await fastify.inject({ method: "GET", url })).statusCode).toBe(
          401
        );
      }
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({ email: "otro@ejemplo.com", email_verified: true }),
      });
      for (const url of [
        "/growth/admin/ejecuciones",
        "/growth/admin/ejecuciones/e1",
      ]) {
        expect((await comoAdminGet(url)).statusCode).toBe(403);
      }
    });

    it("un token de agente no lee las ejecuciones del administrador", async () => {
      mockVerifyIdToken.mockRejectedValue(
        new Error("Wrong number of segments")
      );
      const response = await fastify.inject({
        method: "GET",
        url: "/growth/admin/ejecuciones",
        headers: comoAgente(),
      });
      expect(response.statusCode).toBe(401);
    });
  });
});
