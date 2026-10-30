import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify from "fastify";
import { growthRoutes } from "../../../src/modules/growth/routes.js";
import type { PrismaMock } from "./ayudas.js";
import {
  ADMIN,
  TEXTO_DE_BORRADOR,
  comoAgente,
  prepararContexto,
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

/** `growth_ajustes.findUnique` por clave (la pausa y el snapshot). */
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

describe("rutas del agente de Alhabla Growth", () => {
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
    ajustesPorClave({});
    mock.growthDecision.create.mockResolvedValue({});
    mock.growthOportunidad.updateMany.mockResolvedValue({ count: 1 });

    fastify = Fastify();
    await fastify.register(growthRoutes);
  });

  afterEach(async () => {
    await fastify.close();
  });

  // ── contexto ───────────────────────────────────────────────────────────

  describe("contexto", () => {
    beforeEach(() => {
      mock.growthAjuste.findMany.mockResolvedValue([
        { clave: "topeSemanal", valor: 3, actualizadoEn: new Date() },
      ]);
      mock.growthGestion.count.mockResolvedValue(1);
      mock.growthGestion.findMany.mockResolvedValue([
        { dominio: "ejemplo.com", hechaEn: new Date(Date.now() - 86400000) },
      ]);
      mock.growthOportunidad.count.mockResolvedValue(0);
      mock.growthOportunidad.findMany.mockResolvedValue([
        { dominio: "aprobada.com" },
      ]);
      mock.growthAfirmacion.findMany.mockResolvedValue([
        {
          clave: "precio.plan.pro",
          tipo: "precio",
          texto: "Pro cuesta 139 €",
          valor: { euros: 139 },
          fuente: "web/src/lib/plans.ts#pro",
          commitSha: "abc1234",
          id: "interno",
          vigenteDesde: new Date(),
        },
      ]);
      mock.growthCompetidor.findMany.mockResolvedValue([
        { id: "c1", nombre: "HeyDiga", dominio: "heydiga.ai" },
      ]);
      mock.growthNicho.findMany.mockResolvedValue([
        {
          id: "n1",
          slug: "peluqueria",
          nombre: "Peluquería",
          estado: "activo",
        },
      ]);
      mock.growthFuente.findMany.mockResolvedValue([
        { id: "fuente_web", tipo: "web", nombre: "Búsqueda en la web" },
      ]);
    });

    it("enseña los ajustes EFECTIVOS (con los valores por defecto), no el mapa crudo", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/growth/agente/contexto",
        headers: comoAgente(),
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().ajustes).toEqual({
        topeSemanal: 3,
        umbralDeSimilitud: 0.6,
        umbralesPorObjetivo: { TRAFICO_MARCA: 60, LEADS: 60, BACKLINKS: 60 },
        pausa: false,
      });
    });

    it("dice cuántos contactos van, el tope y qué dominios no tocar", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/growth/agente/contexto",
        headers: comoAgente(),
      });
      const cuerpo = response.json();
      expect(cuerpo.contactos).toEqual({ estaSemana: 1, tope: 3 });
      expect(cuerpo.dominiosEnEnfriamiento).toHaveLength(1);
      expect(cuerpo.dominiosEnEnfriamiento[0].dominio).toBe("ejemplo.com");
      expect(cuerpo.dominiosConAprobadaPendiente).toEqual(["aprobada.com"]);
      expect(cuerpo.manualesPendientes).toBe(0);
    });

    it("incluye el snapshot del conocimiento (o null si nunca se sincronizó)", async () => {
      const sin = await fastify.inject({
        method: "GET",
        url: "/growth/agente/contexto",
        headers: comoAgente(),
      });
      expect(sin.json().snapshot).toBeNull();

      ajustesPorClave({
        "sistema.conocimiento": {
          commitSha: "abc1234",
          vigentes: 160,
          porTipo: { precio: 9 },
        },
      });
      const con = await fastify.inject({
        method: "GET",
        url: "/growth/agente/contexto",
        headers: comoAgente(),
      });
      expect(con.json().snapshot).toMatchObject({
        commitSha: "abc1234",
        vigentes: 160,
        obsoleto: false,
        porTipo: { precio: 9 },
      });
    });

    it("es compacto: nunca lleva el texto de las afirmaciones (ni se piden a la base), pida lo que pida", async () => {
      for (const consulta of [
        "",
        "?sinAfirmaciones=true",
        "?sinAfirmaciones=false",
      ]) {
        mock.growthAfirmacion.findMany.mockClear();
        const response = await fastify.inject({
          method: "GET",
          url: `/growth/agente/contexto${consulta}`,
          headers: comoAgente(),
        });
        expect(response.statusCode).toBe(200);
        expect(response.json()).not.toHaveProperty("afirmaciones");
        expect(JSON.stringify(response.json())).not.toContain("Pro cuesta 139");
        expect(mock.growthAfirmacion.findMany).not.toHaveBeenCalled();
      }
    });

    it("dice si hay una ejecución abierta (de menos de 6 h) o null", async () => {
      const sin = await fastify.inject({
        method: "GET",
        url: "/growth/agente/contexto",
        headers: comoAgente(),
      });
      expect(sin.json().ejecucionAbierta).toBeNull();

      const inicio = new Date(Date.now() - 60 * 60 * 1000);
      mock.growthEjecucion.findFirst.mockResolvedValue({
        id: "e1",
        disparador: "programada",
        inicio,
      });
      const con = await fastify.inject({
        method: "GET",
        url: "/growth/agente/contexto",
        headers: comoAgente(),
      });
      expect(con.json().ejecucionAbierta).toEqual({
        id: "e1",
        disparador: "programada",
        inicio: inicio.toISOString(),
      });
      // Solo cuenta lo que lleva menos de 6 h abierto.
      const donde = mock.growthEjecucion.findFirst.mock.calls[0]![0].where;
      expect(donde.estado).toBe("en_curso");
      expect(donde.inicio.gte.getTime()).toBeGreaterThan(
        Date.now() - 6 * 60 * 60 * 1000 - 5000
      );
    });

    it("no enseña notas, evidencia ni config de competidores, nichos y fuentes", async () => {
      const cuerpo = (
        await fastify.inject({
          method: "GET",
          url: "/growth/agente/contexto",
          headers: comoAgente(),
        })
      ).json();
      expect(cuerpo.competidores).toEqual([
        { id: "c1", nombre: "HeyDiga", dominio: "heydiga.ai" },
      ]);
      const select = mock.growthNicho.findMany.mock.calls[0]![0].select;
      expect(select).toEqual({
        id: true,
        slug: true,
        nombre: true,
        estado: true,
      });
      expect(mock.growthFuente.findMany.mock.calls[0]![0].select).toEqual({
        id: true,
        tipo: true,
        nombre: true,
      });
    });

    it("un sinAfirmaciones que no es booleano da 400", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/growth/agente/contexto?sinAfirmaciones=quizas",
        headers: comoAgente(),
      });
      expect(response.statusCode).toBe(400);
    });
  });

  // ── crear oportunidad ──────────────────────────────────────────────────

  describe("oportunidades", () => {
    const cuerpo = {
      url: "https://www.Ejemplo.com/mejores-recepcionistas/?utm_source=x#top",
      titulo: "Las mejores recepcionistas de IA",
      extracto: "Comparativa de recepcionistas de IA en España.",
      objetivoPrincipal: "BACKLINKS",
      puntBacklinks: 80,
    };

    function enviar(payload: unknown) {
      return fastify.inject({
        method: "POST",
        url: "/growth/agente/oportunidades",
        headers: comoAgente(),
        payload: payload as object,
      });
    }

    beforeEach(() => {
      mock.growthOportunidad.findUnique.mockResolvedValue(null);
      mock.growthFuente.upsert.mockResolvedValue({
        id: "fuente_web",
        tipo: "web",
        nombre: "Búsqueda en la web",
        activa: true,
      });
      mock.growthOportunidad.create.mockResolvedValue({
        id: "o1",
        estado: "detectada",
      });
    });

    it("crea una oportunidad nueva: guarda la URL para abrir (con su www, sin seguimiento ni fragmento) y la clave y el dominio normalizados", async () => {
      const response = await enviar(cuerpo);

      expect(response.statusCode).toBe(201);
      expect(response.json()).toEqual({
        creada: true,
        id: "o1",
        estado: "detectada",
      });
      const datos = mock.growthOportunidad.create.mock.calls[0]![0].data;
      // «Abrir página» tiene que resolver: se conserva el www. y la barra.
      expect(datos.url).toBe("https://www.ejemplo.com/mejores-recepcionistas/");
      expect(datos.dominio).toBe("ejemplo.com");
      expect(datos.claveExterna).toMatch(/^[0-9a-f]{64}$/);
      expect(datos.retencionHasta.getTime()).toBeGreaterThan(Date.now());
    });

    it("sin fuente indicada usa la web, creada al vuelo con id fijo (sin seed ni migración)", async () => {
      await enviar(cuerpo);
      expect(mock.growthFuente.upsert).toHaveBeenCalledWith({
        where: { id: "fuente_web" },
        create: {
          id: "fuente_web",
          tipo: "web",
          nombre: "Búsqueda en la web",
          activa: true,
        },
        update: {},
        select: { id: true, tipo: true, nombre: true, activa: true },
      });
      expect(
        mock.growthOportunidad.create.mock.calls[0]![0].data.fuenteId
      ).toBe("fuente_web");
    });

    it("fuenteTipo directorio usa la fuente de directorios", async () => {
      mock.growthFuente.upsert.mockResolvedValue({
        id: "fuente_directorio",
        tipo: "directorio",
        nombre: "Directorios",
        activa: true,
      });
      await enviar({ ...cuerpo, fuenteTipo: "directorio" });
      expect(mock.growthFuente.upsert.mock.calls[0]![0].where).toEqual({
        id: "fuente_directorio",
      });
    });

    it("dos peticiones a la vez no duplican la fuente: si el alta choca, se relee", async () => {
      mock.growthFuente.upsert.mockRejectedValue({ code: "P2002" });
      mock.growthFuente.findUniqueOrThrow.mockResolvedValue({
        id: "fuente_web",
        tipo: "web",
        nombre: "Búsqueda en la web",
        activa: true,
      });
      const response = await enviar(cuerpo);
      expect(response.statusCode).toBe(201);
    });

    it("una fuente desactivada da 409 fuente_inactiva y no crea nada", async () => {
      mock.growthFuente.upsert.mockResolvedValue({
        id: "fuente_web",
        tipo: "web",
        nombre: "Búsqueda en la web",
        activa: false,
      });
      const response = await enviar(cuerpo);
      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ codigo: "fuente_inactiva" });
      expect(mock.growthOportunidad.create).not.toHaveBeenCalled();
    });

    it("una fuenteId que no existe da 400, no 500", async () => {
      mock.growthFuente.findUnique.mockResolvedValue(null);
      const response = await enviar({ ...cuerpo, fuenteId: "inventada" });
      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe("La fuente no existe.");
    });

    it("la fuente manual es del administrador: por su id tampoco se admite", async () => {
      mock.growthFuente.findUnique.mockResolvedValue({
        id: "fuente_manual",
        tipo: "manual",
        activa: true,
      });
      const response = await enviar({ ...cuerpo, fuenteId: "fuente_manual" });
      expect(response.statusCode).toBe(400);
      expect(mock.growthOportunidad.create).not.toHaveBeenCalled();
    });

    it("una fuenteId activa vale", async () => {
      mock.growthFuente.findUnique.mockResolvedValue({
        id: "f1",
        tipo: "web",
        activa: true,
      });
      const response = await enviar({ ...cuerpo, fuenteId: "f1" });
      expect(response.statusCode).toBe(201);
      expect(
        mock.growthOportunidad.create.mock.calls[0]![0].data.fuenteId
      ).toBe("f1");
    });

    it("resuelve el nicho por su slug; si no existe, 400", async () => {
      mock.growthNicho.findUnique.mockResolvedValue({ id: "n1" });
      const ok = await enviar({ ...cuerpo, nichoSlug: "peluqueria" });
      expect(ok.statusCode).toBe(201);
      expect(mock.growthNicho.findUnique.mock.calls[0]![0].where).toEqual({
        slug: "peluqueria",
      });
      expect(mock.growthOportunidad.create.mock.calls[0]![0].data.nichoId).toBe(
        "n1"
      );

      mock.growthNicho.findUnique.mockResolvedValue(null);
      const malo = await enviar({ ...cuerpo, nichoSlug: "no-existe" });
      expect(malo.statusCode).toBe(400);
    });

    it("la ejecución tiene que existir y estar en curso", async () => {
      mock.growthEjecucion.findUnique.mockResolvedValue(null);
      const inexistente = await enviar({ ...cuerpo, ejecucionId: "e1" });
      expect(inexistente.statusCode).toBe(400);

      mock.growthEjecucion.findUnique.mockResolvedValue({ estado: "ok" });
      const cerrada = await enviar({ ...cuerpo, ejecucionId: "e1" });
      expect(cerrada.statusCode).toBe(409);

      mock.growthEjecucion.findUnique.mockResolvedValue({ estado: "en_curso" });
      const abierta = await enviar({ ...cuerpo, ejecucionId: "e1" });
      expect(abierta.statusCode).toBe(201);
      expect(
        mock.growthOportunidad.create.mock.calls.at(-1)![0].data.ejecucionId
      ).toBe("e1");
    });

    it("una clave foránea que falla por una carrera (P2003) es 400, nunca 500", async () => {
      // El nicho existía al comprobarlo y desapareció antes de insertar.
      mock.growthNicho.findUnique.mockResolvedValue({ id: "n1" });
      mock.growthOportunidad.create.mockRejectedValue({ code: "P2003" });
      const response = await enviar({ ...cuerpo, nichoId: "n1" });
      expect(response.statusCode).toBe(400);
      expect(response.json().error).toContain("no existen");
    });

    it("la misma página con otro seguimiento no se duplica", async () => {
      mock.growthOportunidad.findUnique.mockResolvedValue({
        id: "o1",
        estado: "calificada",
        motivoDescarte: null,
      });
      const response = await enviar(cuerpo);
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ creada: false, id: "o1" });
      expect(mock.growthOportunidad.create).not.toHaveBeenCalled();
    });

    it("una URL que ya existe descartada se devuelve tal cual: no se reabre", async () => {
      mock.growthOportunidad.findUnique.mockResolvedValue({
        id: "o1",
        estado: "descartada",
        motivoDescarte: "No viva",
      });
      const response = await enviar(cuerpo);
      expect(response.json()).toEqual({
        creada: false,
        id: "o1",
        estado: "descartada",
        motivoDescarte: "No viva",
      });
      expect(mock.growthOportunidad.updateMany).not.toHaveBeenCalled();
    });

    it("si dos runs crean la misma URL a la vez, gana el primero (P2002)", async () => {
      mock.growthOportunidad.create.mockRejectedValue({ code: "P2002" });
      mock.growthOportunidad.findUniqueOrThrow.mockResolvedValue({
        id: "o1",
        estado: "detectada",
        motivoDescarte: null,
      });
      const response = await enviar(cuerpo);
      expect(response.statusCode).toBe(200);
      expect(response.json().creada).toBe(false);
    });

    it("rechaza una URL inválida con 400", async () => {
      const response = await enviar({ ...cuerpo, url: "esto no es una url" });
      expect(response.statusCode).toBe(400);
    });

    it.each(["javascript:alert(1)", "data:text/html,x", "file:///etc/passwd"])(
      "rechaza la URL %s y no toca la base de datos",
      async (url) => {
        const response = await enviar({ ...cuerpo, url });
        expect(response.statusCode).toBe(400);
        expect(mock.growthOportunidad.create).not.toHaveBeenCalled();
      }
    );

    it.each([
      "https://alhabla.ai/planes",
      "https://app.alhabla.ai/login",
      "http://localhost:3000/x",
      "http://127.0.0.1/x",
      "http://192.168.1.10/x",
      "http://[::1]/x",
      "http://2130706433/x",
      "https://impresora.local/x",
      "https://panel.internal/x",
      "http://intranet/x",
    ])("la URL %s no es una página de terceros: 400", async (url) => {
      const response = await enviar({ ...cuerpo, url });
      expect(response.statusCode).toBe(400);
      expect(mock.growthOportunidad.create).not.toHaveBeenCalled();
    });

    it("un duplicado no actualiza puntuaciones ni datos", async () => {
      mock.growthOportunidad.findUnique.mockResolvedValue({
        id: "o1",
        estado: "detectada",
        motivoDescarte: null,
      });
      await enviar({ ...cuerpo, puntBacklinks: 5 });
      expect(mock.growthOportunidad.updateMany).not.toHaveBeenCalled();
      expect(mock.growthOportunidad.update).not.toHaveBeenCalled();
    });
  });

  // ── cambiar el estado ──────────────────────────────────────────────────

  describe("estado", () => {
    function fila(cambios: Record<string, unknown> = {}) {
      return {
        id: "o1",
        estado: "detectada",
        dominio: "ejemplo.com",
        objetivoPrincipal: "BACKLINKS",
        puntTrafico: 0,
        puntLeads: 0,
        puntBacklinks: 0,
        datos: null,
        fuente: { tipo: "web" },
        ...cambios,
      };
    }

    function pedir(payload: unknown) {
      return fastify.inject({
        method: "POST",
        url: "/growth/agente/oportunidades/o1/estado",
        headers: comoAgente(),
        payload: payload as object,
      });
    }

    beforeEach(() => {
      mock.growthOportunidad.findUnique.mockResolvedValue(fila());
      mock.growthCompetidor.findMany.mockResolvedValue([]);
      mock.growthAjuste.findMany.mockResolvedValue([]);
    });

    it("el agente no puede aprobar: ese estado ni se acepta", async () => {
      const response = await pedir({ a: "aprobada" });
      expect(response.statusCode).toBe(400);
      expect(mock.growthOportunidad.updateMany).not.toHaveBeenCalled();
    });

    it("descartar exige un motivo", async () => {
      const response = await pedir({ a: "descartada" });
      expect(response.statusCode).toBe(400);
    });

    it("no deja saltar de detectada a investigada", async () => {
      const response = await pedir({ a: "investigada" });
      expect(response.statusCode).toBe(409);
      expect(mock.growthOportunidad.updateMany).not.toHaveBeenCalled();
    });

    it("una oportunidad que no existe da 404", async () => {
      mock.growthOportunidad.findUnique.mockResolvedValue(null);
      const response = await pedir({ a: "calificada" });
      expect(response.statusCode).toBe(404);
    });

    it("pedir el estado en que ya está, con los mismos datos, responde 200 sin efectos (reintento de red)", async () => {
      mock.growthOportunidad.findUnique.mockResolvedValue(
        fila({
          estado: "calificada",
          puntLeads: 99,
          datos: { dificultad: "baja" },
        })
      );
      const response = await pedir({
        a: "calificada",
        puntLeads: 99,
        datos: { dificultad: "baja" },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ id: "o1", estado: "calificada" });
      expect(mock.$transaction).not.toHaveBeenCalled();
      expect(mock.growthOportunidad.updateMany).not.toHaveBeenCalled();
      expect(mock.growthDecision.create).not.toHaveBeenCalled();
    });

    it("pedir 'calificada' sin datos nuevos también es un reintento: 200", async () => {
      mock.growthOportunidad.findUnique.mockResolvedValue(
        fila({ estado: "calificada" })
      );
      const response = await pedir({ a: "calificada" });
      expect(response.statusCode).toBe(200);
      expect(mock.growthOportunidad.updateMany).not.toHaveBeenCalled();
    });

    it("recalificar con datos distintos da 409 ya_calificada y dice qué difiere (no se toca nada)", async () => {
      mock.growthOportunidad.findUnique.mockResolvedValue(
        fila({
          estado: "calificada",
          puntLeads: 10,
          datos: { dificultad: "baja" },
        })
      );
      const response = await pedir({
        a: "calificada",
        objetivoPrincipal: "LEADS",
        puntLeads: 99,
        datos: { dificultad: "alta" },
      });
      expect(response.statusCode).toBe(409);
      const cuerpo = response.json();
      expect(cuerpo.codigo).toBe("ya_calificada");
      expect(cuerpo.error).toContain("no se reescribe");
      expect(cuerpo.diferencias).toEqual([
        "objetivoPrincipal",
        "puntLeads",
        "datos.dificultad",
      ]);
      expect(mock.$transaction).not.toHaveBeenCalled();
      expect(mock.growthOportunidad.updateMany).not.toHaveBeenCalled();
      expect(mock.growthDecision.create).not.toHaveBeenCalled();
    });

    it("recalificar con puntuaciones iguales y una clave nueva en datos también difiere (la clave no existía)", async () => {
      mock.growthOportunidad.findUnique.mockResolvedValue(
        fila({ estado: "calificada", datos: { dificultad: "baja" } })
      );
      const response = await pedir({
        a: "calificada",
        datos: { tipoDestino: "directorio" },
      });
      expect(response.statusCode).toBe(409);
      expect(response.json().diferencias).toEqual(["datos.tipoDestino"]);
    });

    it("califica una detectada con sus puntuaciones y deja rastro firmado por el token", async () => {
      const response = await pedir({
        a: "calificada",
        objetivoPrincipal: "LEADS",
        puntTrafico: 20,
        puntLeads: 85,
        puntBacklinks: 30,
        titulo: "Título mejor",
        extracto: "x".repeat(900),
        datos: { dificultad: "baja" },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ id: "o1", estado: "calificada" });

      const llamada = mock.growthOportunidad.updateMany.mock.calls[0]![0];
      expect(llamada.where).toEqual({ id: "o1", estado: "detectada" });
      expect(llamada.data).toMatchObject({
        estado: "calificada",
        objetivoPrincipal: "LEADS",
        puntTrafico: 20,
        puntLeads: 85,
        puntBacklinks: 30,
        titulo: "Título mejor",
        datos: { dificultad: "baja" },
      });
      expect(llamada.data.extracto).toHaveLength(500);
      expect(mock.growthDecision.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          oportunidadId: "o1",
          accion: "calificar",
          por: "agente:agente-semanal",
        }),
      });
    });

    it("los datos se fusionan con los que ya había, sin perder el código de descarte", async () => {
      mock.growthOportunidad.findUnique.mockResolvedValue(
        fila({ datos: { tipoDestino: "prensa", nota: "vieja" } })
      );
      await pedir({
        a: "calificada",
        puntBacklinks: 90,
        datos: { nota: "nueva" },
      });
      expect(
        mock.growthOportunidad.updateMany.mock.calls[0]![0].data.datos
      ).toEqual({
        tipoDestino: "prensa",
        nota: "nueva",
      });
    });

    it("las puntuaciones se aceptan al investigar", async () => {
      mock.growthOportunidad.findUnique.mockResolvedValue(
        fila({ estado: "calificada" })
      );
      const response = await pedir({ a: "investigada", puntLeads: 70 });
      expect(response.statusCode).toBe(200);
      expect(mock.growthDecision.create.mock.calls[0]![0].data.accion).toBe(
        "investigar"
      );
    });

    it("resuelve el nicho por slug y falla con 400 si no existe", async () => {
      mock.growthNicho.findUnique.mockResolvedValue({ id: "n1" });
      await pedir({
        a: "calificada",
        puntBacklinks: 90,
        nichoSlug: "peluqueria",
      });
      expect(
        mock.growthOportunidad.updateMany.mock.calls[0]![0].data.nichoId
      ).toBe("n1");

      mock.growthNicho.findUnique.mockResolvedValue(null);
      const malo = await pedir({
        a: "calificada",
        puntBacklinks: 90,
        nichoSlug: "no-existe",
      });
      expect(malo.statusCode).toBe(400);
    });

    it("si cambió de estado mientras tanto (otro proceso), 409 y no escribe decisión", async () => {
      mock.growthOportunidad.updateMany.mockResolvedValue({ count: 0 });
      const response = await pedir({ a: "calificada", puntBacklinks: 90 });
      expect(response.statusCode).toBe(409);
      expect(response.json().codigo).toBe("conflicto");
      expect(mock.growthDecision.create).not.toHaveBeenCalled();
    });

    describe("las puertas duras al calificar las decide el backend", () => {
      it("una página de Alhabla se descarta sola con el código dominio_propio", async () => {
        mock.growthOportunidad.findUnique.mockResolvedValue(
          fila({ dominio: "app.alhabla.ai" })
        );
        const response = await pedir({ a: "calificada", puntBacklinks: 95 });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({
          id: "o1",
          estado: "descartada",
          descartadaPorReglas: true,
          codigoDescarte: "dominio_propio",
        });
        const cambios = mock.growthOportunidad.updateMany.mock.calls[0]![0];
        expect(cambios.data).toMatchObject({
          estado: "descartada",
          datos: { codigoDescarte: "dominio_propio" },
        });
        expect(mock.growthDecision.create.mock.calls[0]![0].data).toMatchObject(
          {
            accion: "descartar",
            por: "sistema",
          }
        );
      });

      it("la página de un competidor (o de un subdominio suyo) se descarta sola", async () => {
        mock.growthCompetidor.findMany.mockResolvedValue([
          { nombre: "HeyDiga", dominio: "heydiga.ai" },
        ]);
        for (const dominio of ["heydiga.ai", "blog.heydiga.ai"]) {
          mock.growthOportunidad.findUnique.mockResolvedValue(
            fila({ dominio })
          );
          const response = await pedir({ a: "calificada", puntBacklinks: 95 });
          expect(response.json()).toMatchObject({
            descartadaPorReglas: true,
            codigoDescarte: "competidor",
          });
        }
      });

      it("las páginas de socios de HeyDiga y fonio (el caso heydiga.ai/blog/partners y www.fonio.ai/partners) se descartan al calificar", async () => {
        // Con HeyDiga y fonio en `growth_competidores` (los siembra el
        // sincronizador desde comparativas.ts), la compuerta los reconoce
        // aunque la oportunidad se guardara con www., en un subdominio o con
        // el punto final de un FQDN.
        mock.growthCompetidor.findMany.mockResolvedValue([
          { nombre: "HeyDiga", dominio: "heydiga.ai" },
          { nombre: "fonio", dominio: "www.fonio.ai" },
        ]);
        for (const dominio of [
          "heydiga.ai",
          "heydiga.ai.",
          "partners.heydiga.ai",
          "fonio.ai",
          "www.fonio.ai",
          "fonio.ai.",
          "socios.fonio.ai",
        ]) {
          mock.growthOportunidad.findUnique.mockResolvedValue(
            fila({ dominio })
          );
          const response = await pedir({ a: "calificada", puntBacklinks: 95 });
          expect(response.json(), dominio).toMatchObject({
            estado: "descartada",
            descartadaPorReglas: true,
            codigoDescarte: "competidor",
          });
        }
      });

      it("un dominio que solo termina igual que el competidor no cuenta", async () => {
        mock.growthCompetidor.findMany.mockResolvedValue([
          { nombre: "HeyDiga", dominio: "heydiga.ai" },
        ]);
        mock.growthOportunidad.findUnique.mockResolvedValue(
          fila({ dominio: "noheydiga.ai" })
        );
        const response = await pedir({ a: "calificada", puntBacklinks: 95 });
        expect(response.json()).toEqual({ id: "o1", estado: "calificada" });
      });

      it("por debajo del umbral del objetivo principal se descarta con bajo_umbral", async () => {
        const response = await pedir({
          a: "calificada",
          puntTrafico: 99,
          puntBacklinks: 59,
        });
        expect(response.json()).toMatchObject({
          estado: "descartada",
          descartadaPorReglas: true,
          codigoDescarte: "bajo_umbral",
        });
        // La nota alta de OTRO objetivo no salva a la oportunidad.
        expect(response.json().motivoDescarte).toContain("BACKLINKS");
      });

      it("en el umbral exacto pasa", async () => {
        const response = await pedir({ a: "calificada", puntBacklinks: 60 });
        expect(response.json()).toEqual({ id: "o1", estado: "calificada" });
      });

      it("el umbral sale de los ajustes", async () => {
        mock.growthAjuste.findMany.mockResolvedValue([
          {
            clave: "umbralesPorObjetivo",
            valor: { TRAFICO_MARCA: 10, LEADS: 10, BACKLINKS: 90 },
            actualizadoEn: new Date(),
          },
        ]);
        const response = await pedir({ a: "calificada", puntBacklinks: 80 });
        expect(response.json()).toMatchObject({
          codigoDescarte: "bajo_umbral",
        });
      });

      it("una URL añadida a mano no se descarta por la puntuación, pero sí por competidor", async () => {
        mock.growthOportunidad.findUnique.mockResolvedValue(
          fila({ fuente: { tipo: "manual" } })
        );
        const sinNota = await pedir({ a: "calificada", puntBacklinks: 0 });
        expect(sinNota.json()).toEqual({ id: "o1", estado: "calificada" });

        mock.growthCompetidor.findMany.mockResolvedValue([
          { nombre: "HeyDiga", dominio: "ejemplo.com" },
        ]);
        mock.growthOportunidad.findUnique.mockResolvedValue(
          fila({ fuente: { tipo: "manual" } })
        );
        const competidor = await pedir({ a: "calificada", puntBacklinks: 0 });
        expect(competidor.json()).toMatchObject({
          codigoDescarte: "competidor",
        });
      });

      it("las puertas no se aplican al investigar", async () => {
        mock.growthOportunidad.findUnique.mockResolvedValue(
          fila({ estado: "calificada" })
        );
        const response = await pedir({ a: "investigada", puntBacklinks: 1 });
        expect(response.json()).toEqual({ id: "o1", estado: "investigada" });
      });
    });

    it("descartar guarda el motivo, el código y el rastro", async () => {
      const response = await pedir({
        a: "descartada",
        motivo: "La página ya no existe",
        codigo: "no_viva",
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ id: "o1", estado: "descartada" });
      expect(mock.growthOportunidad.updateMany.mock.calls[0]![0].data).toEqual({
        estado: "descartada",
        motivoDescarte: "La página ya no existe",
        datos: { codigoDescarte: "no_viva" },
      });
      expect(mock.growthDecision.create.mock.calls[0]![0].data).toMatchObject({
        accion: "descartar",
        motivo: "La página ya no existe",
        por: "agente:agente-semanal",
      });
    });

    it("sin código, descartar guarda `otro`", async () => {
      await pedir({ a: "descartada", motivo: "No me gusta" });
      expect(
        mock.growthOportunidad.updateMany.mock.calls[0]![0].data.datos
      ).toEqual({ codigoDescarte: "otro" });
    });

    it("el agente no descarta algo que ya espera tu aprobación", async () => {
      mock.growthOportunidad.findUnique.mockResolvedValue(
        fila({ estado: "pendiente_aprobacion" })
      );
      const response = await pedir({ a: "descartada", motivo: "x" });
      expect(response.statusCode).toBe(409);
    });
  });

  // ── investigación ──────────────────────────────────────────────────────

  describe("investigación", () => {
    function guardar(payload: unknown) {
      return fastify.inject({
        method: "PUT",
        url: "/growth/agente/oportunidades/o1/investigacion",
        headers: comoAgente(),
        payload: payload as object,
      });
    }

    beforeEach(() => {
      mock.growthOportunidad.findUnique.mockResolvedValue({
        id: "o1",
        estado: "calificada",
      });
      mock.growthInvestigacion.upsert.mockResolvedValue({
        oportunidadId: "o1",
      });
    });

    it("guarda la investigación y la URL de contacto dentro del contexto", async () => {
      const response = await guardar({
        resumen: "Medio digital sobre peluquería.",
        quienEdita: "Medio digital",
        viaDeContacto: "formulario",
        urlContacto: "https://ejemplo.com/contacto",
        contexto: { audiencia: "profesionales" },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ oportunidadId: "o1" });
      const { create } = mock.growthInvestigacion.upsert.mock.calls[0]![0];
      expect(create).toMatchObject({
        oportunidadId: "o1",
        resumen: "Medio digital sobre peluquería.",
        contexto: {
          audiencia: "profesionales",
          urlContacto: "https://ejemplo.com/contacto",
        },
      });
    });

    it("es un PUT: lo que no viene se borra", async () => {
      await guardar({ resumen: "Solo el resumen" });
      const { update } = mock.growthInvestigacion.upsert.mock.calls[0]![0];
      expect(update.quienEdita).toBeNull();
      expect(update.viaDeContacto).toBeNull();
    });

    it.each(["calificada", "investigada", "bloqueada", "devuelta"])(
      "se puede guardar con la oportunidad %s",
      async (estado) => {
        mock.growthOportunidad.findUnique.mockResolvedValue({
          id: "o1",
          estado,
        });
        expect((await guardar({ resumen: "x" })).statusCode).toBe(200);
      }
    );

    it.each([
      "detectada",
      "pendiente_aprobacion",
      "aprobada",
      "gestionada",
      "conseguida",
      "descartada",
    ])("NO se pisa la investigación de una oportunidad %s", async (estado) => {
      mock.growthOportunidad.findUnique.mockResolvedValue({ id: "o1", estado });
      const response = await guardar({ resumen: "x" });
      expect(response.statusCode).toBe(409);
      expect(mock.growthInvestigacion.upsert).not.toHaveBeenCalled();
    });

    it("una oportunidad inexistente da 404", async () => {
      mock.growthOportunidad.findUnique.mockResolvedValue(null);
      expect((await guardar({ resumen: "x" })).statusCode).toBe(404);
    });

    it("no guarda correos ni teléfonos de terceros", async () => {
      for (const resumen of [
        "Escribid a redaccion@ejemplo.es",
        "Su teléfono es 612 345 678",
      ]) {
        const response = await guardar({ resumen });
        expect(response.statusCode).toBe(400);
      }
      expect(mock.growthInvestigacion.upsert).not.toHaveBeenCalled();
    });

    it("una URL de contacto javascript: se rechaza", async () => {
      const response = await guardar({
        resumen: "x",
        urlContacto: "javascript:alert(1)",
      });
      expect(response.statusCode).toBe(400);
    });
  });

  // ── borradores ─────────────────────────────────────────────────────────

  describe("borradores", () => {
    const borrador = {
      tipo: "email",
      asunto: "Una recepcionista de IA para vuestro listado",
      texto: TEXTO_DE_BORRADOR,
      enlaceUrl: "https://alhabla.ai/peluqueria?utm_source=listado",
      afirmaciones: ["funcion.reserva_en_calendario"],
    };

    function redactar(payload: unknown = borrador) {
      return fastify.inject({
        method: "POST",
        url: "/growth/agente/oportunidades/o1/borradores",
        headers: comoAgente(),
        payload: payload as object,
      });
    }

    beforeEach(() => {
      mock.growthOportunidad.findUnique.mockResolvedValue({
        id: "o1",
        estado: "investigada",
        dominio: "ejemplo.com",
        objetivoPrincipal: "BACKLINKS",
      });
      prepararContexto(mock);
      mock.growthBorrador.count.mockResolvedValue(0);
      mock.growthBorrador.create.mockImplementation(
        async ({ data }: { data: { estado: string; version: number } }) => ({
          id: "b1",
          version: data.version,
          estado: data.estado,
        })
      );
      mock.growthBorrador.updateMany.mockResolvedValue({ count: 0 });
      mock.growthRevisionCumplimiento.create.mockResolvedValue({});
    });

    it("un borrador que cumple queda pendiente de tu aprobación", async () => {
      const response = await redactar();

      expect(response.statusCode).toBe(201);
      const cuerpo = response.json();
      expect(cuerpo.resultado).toBe("pasa");
      expect(cuerpo.borrador).toEqual({
        id: "b1",
        version: 1,
        estado: "pendiente_aprobacion",
      });
      expect(cuerpo.oportunidad).toEqual({
        id: "o1",
        estado: "pendiente_aprobacion",
      });
      const revision =
        mock.growthRevisionCumplimiento.create.mock.calls[0]![0].data;
      expect(revision.revisor).toBe("reglas");
      expect(revision.resultado).toBe("pasa");
    });

    it("primero reclama la oportunidad (con su estado) y luego la deja en su estado final", async () => {
      await redactar();
      const llamadas = mock.growthOportunidad.updateMany.mock.calls.map(
        (c) => c[0]
      );
      expect(llamadas).toEqual([
        {
          where: { id: "o1", estado: "investigada" },
          data: { estado: "con_borrador" },
        },
        {
          where: { id: "o1", estado: "con_borrador" },
          data: { estado: "pendiente_aprobacion" },
        },
      ]);
      // La reclamación va antes de numerar la versión.
      const reclamo =
        mock.growthOportunidad.updateMany.mock.invocationCallOrder[0]!;
      const numero = mock.growthBorrador.count.mock.invocationCallOrder[0]!;
      expect(reclamo).toBeLessThan(numero);
    });

    it("toma los cerrojos de aprobación antes de reclamar la oportunidad (mismo orden de bloqueo que aprobar y editar)", async () => {
      await redactar();
      expect(mock.$executeRaw.mock.calls.map((c) => c[1] as string)).toEqual([
        "growth_aprobar",
        "growth_conocimiento",
      ]);
      expect(mock.$executeRaw.mock.invocationCallOrder.at(-1)!).toBeLessThan(
        mock.growthOportunidad.updateMany.mock.invocationCallOrder[0]!
      );
    });

    it("el campo `utm` llega a las reglas: el aviso dice que el campo no se añade solo", async () => {
      prepararContexto(mock);
      const response = await redactar({
        ...borrador,
        enlaceUrl: "https://alhabla.ai/peluqueria",
        utm: { utm_source: "listado" },
      });
      expect(response.statusCode).toBe(201);
      const aviso = response
        .json()
        .comprobaciones.find(
          (c: { regla: string }) => c.regla === "enlace_con_utm"
        );
      expect(aviso).toMatchObject({ ok: false, dura: false });
      expect(aviso.detalle).toContain("el campo `utm` no se añade solo");
    });

    it("dos borradores a la vez: el segundo no pasa la reclamación y recibe 409 sin crear nada", async () => {
      mock.growthOportunidad.updateMany.mockResolvedValue({ count: 0 });
      const response = await redactar();
      expect(response.statusCode).toBe(409);
      expect(response.json().codigo).toBe("conflicto");
      expect(mock.growthBorrador.create).not.toHaveBeenCalled();
      expect(mock.growthRevisionCumplimiento.create).not.toHaveBeenCalled();
    });

    it("la versión es la siguiente a las que ya había", async () => {
      mock.growthBorrador.count.mockResolvedValue(2);
      const response = await redactar();
      expect(response.json().borrador.version).toBe(3);
    });

    it("la versión nueva descarta las anteriores que quedaron bloqueadas o a medias", async () => {
      await redactar();
      expect(mock.growthBorrador.updateMany).toHaveBeenCalledWith({
        where: {
          oportunidadId: "o1",
          id: { not: "b1" },
          estado: { in: ["bloqueado", "borrador"] },
        },
        data: { estado: "descartado" },
      });
    });

    it("un borrador con una afirmación inventada queda bloqueado, no pendiente", async () => {
      const response = await redactar({
        ...borrador,
        afirmaciones: ["funcion.inventada"],
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().resultado).toBe("bloquea");
      expect(response.json().borrador.estado).toBe("bloqueado");
      expect(response.json().oportunidad.estado).toBe("bloqueada");
      expect(
        mock.growthOportunidad.updateMany.mock.calls.at(-1)![0].data
      ).toEqual({ estado: "bloqueada" });
    });

    it("un término prohibido que viene en `valor.terminos` bloquea el borrador", async () => {
      const response = await redactar({
        ...borrador,
        texto: `${borrador.texto} Funciona sobre Telnyx.`,
      });
      expect(response.json().resultado).toBe("bloquea");
      expect(response.json().borrador.estado).toBe("bloqueado");
    });

    it("un término prohibido de palabra entera no salta dentro de otra palabra", async () => {
      prepararContexto(mock, {
        afirmaciones: [
          {
            clave: "funcion.reserva_en_calendario",
            tipo: "funcion",
            texto: "Reserva",
            valor: null,
          },
          {
            clave: "prohibida.api",
            tipo: "prohibida",
            texto: "No se habla de API",
            valor: { terminos: ["API"], palabrasEnteras: true },
          },
        ],
      });
      const response = await redactar({
        ...borrador,
        texto: `${borrador.texto} También atendemos clínicas de fisioterapia.`,
      });
      expect(response.json().resultado).toBe("pasa");
    });

    it("no se redacta sobre una oportunidad que ya espera tu aprobación", async () => {
      mock.growthOportunidad.findUnique.mockResolvedValue({
        id: "o1",
        estado: "pendiente_aprobacion",
        dominio: "ejemplo.com",
        objetivoPrincipal: "BACKLINKS",
      });
      const response = await redactar();
      expect(response.statusCode).toBe(409);
      expect(mock.growthBorrador.create).not.toHaveBeenCalled();
    });

    it("una oportunidad inexistente da 404", async () => {
      mock.growthOportunidad.findUnique.mockResolvedValue(null);
      expect((await redactar()).statusCode).toBe(404);
    });

    it("un dominio contactado hace poco bloquea el borrador", async () => {
      prepararContexto(mock, {
        gestionesDelDominio: [new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)],
      });
      const response = await redactar();
      expect(response.json().resultado).toBe("bloquea");
      const reglas = response
        .json()
        .comprobaciones.filter((c: { ok: boolean }) => !c.ok)
        .map((c: { regla: string }) => c.regla);
      expect(reglas).toContain("un_contacto_por_dominio");
    });

    it("lo aprobado sin gestionar del mismo dominio también cuenta", async () => {
      prepararContexto(mock, { aprobadasDelDominio: 1 });
      const response = await redactar();
      expect(response.json().resultado).toBe("bloquea");
    });

    it("el tope semanal cuenta lo hecho y lo aprobado", async () => {
      prepararContexto(mock, { hechasEstaSemana: 3, aprobadasSinGestionar: 2 });
      const response = await redactar();
      const reglas = response
        .json()
        .comprobaciones.filter((c: { ok: boolean }) => !c.ok)
        .map((c: { regla: string }) => c.regla);
      expect(reglas).toContain("tope_semanal");
    });

    it("el mismo texto de OTRA oportunidad bloquea; el de una versión anterior solo avisa", async () => {
      prepararContexto(mock, { textosDeOtras: [borrador.texto] });
      const otra = await redactar();
      expect(otra.json().resultado).toBe("bloquea");

      prepararContexto(mock, { textosDeLaMisma: [borrador.texto] });
      const misma = await redactar();
      expect(misma.json().resultado).toBe("aviso");
      expect(misma.json().borrador.estado).toBe("pendiente_aprobacion");
      const avisos = misma
        .json()
        .comprobaciones.filter((c: { ok: boolean }) => !c.ok)
        .map((c: { regla: string }) => c.regla);
      expect(avisos).toEqual(["similitud_con_version_anterior"]);
    });

    it("una enlaceUrl javascript: ni llega a evaluarse", async () => {
      const response = await redactar({
        ...borrador,
        enlaceUrl: "javascript:alert(1)",
      });
      expect(response.statusCode).toBe(400);
      expect(mock.$transaction).not.toHaveBeenCalled();
    });

    it("deja rastro: la redacción firmada por el token y, si se bloquea, el bloqueo del sistema", async () => {
      await redactar();
      expect(mock.growthDecision.create).toHaveBeenCalledTimes(1);
      expect(mock.growthDecision.create.mock.calls[0]![0].data).toMatchObject({
        oportunidadId: "o1",
        borradorId: "b1",
        accion: "redactar",
        por: "agente:agente-semanal",
      });

      mock.growthDecision.create.mockClear();
      await redactar({ ...borrador, afirmaciones: ["funcion.inventada"] });
      const acciones = mock.growthDecision.create.mock.calls.map((c) => ({
        accion: c[0].data.accion,
        por: c[0].data.por,
      }));
      expect(acciones).toEqual([
        { accion: "redactar", por: "agente:agente-semanal" },
        { accion: "bloquear_por_reglas", por: "sistema" },
      ]);
      expect(
        mock.growthDecision.create.mock.calls[1]![0].data.motivo
      ).toContain("afirmaciones_vigentes");
    });

    it("desde una oportunidad bloqueada o devuelta se puede redactar otra versión", async () => {
      for (const estado of ["bloqueada", "devuelta"]) {
        mock.growthOportunidad.findUnique.mockResolvedValue({
          id: "o1",
          estado,
          dominio: "ejemplo.com",
          objetivoPrincipal: "BACKLINKS",
        });
        expect((await redactar()).statusCode).toBe(201);
      }
    });
  });

  // ── la pausa ───────────────────────────────────────────────────────────

  describe("pausa", () => {
    const escrituras: [string, string, unknown][] = [
      [
        "POST",
        "/growth/agente/oportunidades",
        {
          url: "https://ejemplo.com/p",
          titulo: "t",
          extracto: "e",
          objetivoPrincipal: "BACKLINKS",
        },
      ],
      ["POST", "/growth/agente/oportunidades/o1/estado", { a: "calificada" }],
      [
        "PUT",
        "/growth/agente/oportunidades/o1/investigacion",
        { resumen: "x" },
      ],
      [
        "POST",
        "/growth/agente/oportunidades/o1/borradores",
        { tipo: "email", texto: "x" },
      ],
    ];

    it.each(escrituras)(
      "con la pausa activa, %s %s responde 409 pausa sin tocar nada",
      async (method, url, payload) => {
        ajustesPorClave({ pausa: true });
        const response = await fastify.inject({
          method: method as "POST" | "PUT",
          url,
          headers: comoAgente(),
          payload: payload as object,
        });
        expect(response.statusCode).toBe(409);
        expect(response.json()).toEqual({
          error: "Growth está en pausa.",
          codigo: "pausa",
        });
        expect(mock.$transaction).not.toHaveBeenCalled();
        expect(mock.growthOportunidad.create).not.toHaveBeenCalled();
        expect(mock.growthOportunidad.updateMany).not.toHaveBeenCalled();
        expect(mock.growthInvestigacion.upsert).not.toHaveBeenCalled();
      }
    );

    it("la lectura del contexto sigue funcionando en pausa y dice que lo está", async () => {
      ajustesPorClave({ pausa: true });
      mock.growthAjuste.findMany.mockResolvedValue([
        { clave: "pausa", valor: true, actualizadoEn: new Date() },
      ]);
      mock.growthGestion.count.mockResolvedValue(0);
      mock.growthGestion.findMany.mockResolvedValue([]);
      mock.growthOportunidad.count.mockResolvedValue(0);
      mock.growthOportunidad.findMany.mockResolvedValue([]);
      mock.growthAfirmacion.findMany.mockResolvedValue([]);
      mock.growthCompetidor.findMany.mockResolvedValue([]);
      mock.growthNicho.findMany.mockResolvedValue([]);
      mock.growthFuente.findMany.mockResolvedValue([]);
      const response = await fastify.inject({
        method: "GET",
        url: "/growth/agente/contexto",
        headers: comoAgente(),
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().ajustes.pausa).toBe(true);
    });

    it("sin autenticar no se averigua si hay pausa", async () => {
      ajustesPorClave({ pausa: true });
      const response = await fastify.inject({
        method: "POST",
        url: "/growth/agente/oportunidades",
        payload: {},
      });
      expect(response.statusCode).toBe(401);
      expect(mock.growthAjuste.findUnique).not.toHaveBeenCalled();
    });

    it("pausa = false (o ausente) no bloquea", async () => {
      ajustesPorClave({ pausa: false });
      mock.growthOportunidad.findUnique.mockResolvedValue({
        id: "o1",
        estado: "calificada",
        dominio: "ejemplo.com",
        objetivoPrincipal: "BACKLINKS",
        puntTrafico: 0,
        puntLeads: 0,
        puntBacklinks: 0,
        datos: null,
        fuente: { tipo: "web" },
      });
      const response = await fastify.inject({
        method: "POST",
        url: "/growth/agente/oportunidades/o1/estado",
        headers: comoAgente(),
        payload: { a: "calificada" },
      });
      expect(response.statusCode).toBe(200);
    });
  });
});
