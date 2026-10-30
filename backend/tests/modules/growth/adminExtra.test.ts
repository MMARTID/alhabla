import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify from "fastify";
import { growthRoutes } from "../../../src/modules/growth/routes.js";
import type { PrismaMock } from "./ayudas.js";
import { ADMIN, DIA, comoAdmin, dentroDe, hace } from "./ayudas.js";

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

/** `growth_ajustes.findUnique` por clave (el snapshot del conocimiento). */
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

describe("administración de Alhabla Growth: resumen, historial, conocimiento y competidores", () => {
  let fastify: ReturnType<typeof Fastify>;

  function pedir(url: string) {
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
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ email: ADMIN, email_verified: true }),
    });

    fastify = Fastify();
    await fastify.register(growthRoutes);
  });

  afterEach(async () => {
    await fastify.close();
  });

  // ── yo ─────────────────────────────────────────────────────────────────

  describe("yo", () => {
    it("devuelve el correo de la sesión (en minúsculas, como lo verifica Google)", async () => {
      const response = await pedir("/growth/admin/yo");
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ email: ADMIN });
    });

    it("distingue una sesión caducada (401), un correo sin permiso (403) y Growth sin configurar (503)", async () => {
      mockVerifyIdToken.mockRejectedValue(new Error("Token used too late"));
      expect((await pedir("/growth/admin/yo")).statusCode).toBe(401);

      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({ email: "otro@ejemplo.com", email_verified: true }),
      });
      expect((await pedir("/growth/admin/yo")).statusCode).toBe(403);

      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({ email: ADMIN, email_verified: false }),
      });
      expect((await pedir("/growth/admin/yo")).statusCode).toBe(403);

      delete process.env.GROWTH_GOOGLE_CLIENT_ID;
      expect((await pedir("/growth/admin/yo")).statusCode).toBe(503);
    });
  });

  // ── resumen ────────────────────────────────────────────────────────────

  describe("resumen", () => {
    beforeEach(() => {
      mock.growthOportunidad.groupBy.mockResolvedValue([
        { estado: "pendiente_aprobacion", _count: { _all: 3 } },
        { estado: "aprobada", _count: { _all: 2 } },
        { estado: "bloqueada", _count: { _all: 1 } },
        { estado: "devuelta", _count: { _all: 4 } },
        { estado: "descartada", _count: { _all: 9 } },
      ]);
      mock.growthAjuste.findMany.mockResolvedValue([
        { clave: "topeSemanal", valor: 4, actualizadoEn: hace(2) },
      ]);
      ajustesPorClave({
        "sistema.conocimiento": {
          commitSha: "abc1234",
          vigentes: 160,
          porTipo: { precio: 9 },
        },
      });
      mock.growthGestion.count.mockResolvedValue(1);
      mock.growthOportunidad.count.mockResolvedValue(2);
      mock.growthDecision.findMany.mockResolvedValue([
        { oportunidadId: "o1" },
        { oportunidadId: "o2" },
        { oportunidadId: "o3" },
        { oportunidadId: "o1" },
      ]);
      // Dos consultas distintas sobre oportunidades: las de por caducar y las descartadas.
      mock.growthOportunidad.findMany.mockImplementation(
        async ({ where }: { where: { id?: unknown } }) =>
          where.id
            ? [
                { datos: { codigoDescarte: "bajo_umbral" } },
                { datos: { codigoDescarte: "bajo_umbral" } },
                { datos: { codigoDescarte: "competidor" } },
              ]
            : [
                {
                  id: "o9",
                  titulo: "Directorio",
                  dominio: "ejemplo.com",
                  estado: "aprobada",
                  // 1,5 días y no 2: el cálculo redondea hacia arriba y la hora de la
                  // consulta es posterior a la del servicio por unos milisegundos.
                  expiraEn: dentroDe(1.5),
                },
              ]
      );
      mock.growthEjecucion.findFirst.mockResolvedValue({
        id: "e1",
        disparador: "programada",
        estado: "ok",
        inicio: hace(1),
        fin: hace(1),
      });
      mock.growthTokenAgente.count.mockResolvedValue(2);
      mock.growthTokenAgente.findFirst.mockResolvedValue({
        ultimoUso: hace(0.5),
      });
    });

    it("da los contadores de la navegación con todos los estados, también los vacíos", async () => {
      const cuerpo = (await pedir("/growth/admin/resumen")).json();

      expect(cuerpo.porEstado).toMatchObject({
        detectada: 0,
        pendiente_aprobacion: 3,
        aprobada: 2,
        bloqueada: 1,
        devuelta: 4,
        descartada: 9,
        caducada: 0,
      });
      expect(Object.keys(cuerpo.porEstado)).toHaveLength(13);
      expect(cuerpo).toMatchObject({
        paraRevisar: 3,
        aprobadasSinGestionar: 2,
        bloqueadas: 1,
        devueltas: 4,
      });
    });

    it("los descartes de la semana se agrupan por código, del más frecuente al menos", async () => {
      const cuerpo = (await pedir("/growth/admin/resumen")).json();

      expect(cuerpo.descartesUltimos7Dias).toEqual({
        total: 3,
        porMotivo: [
          { codigo: "bajo_umbral", n: 2 },
          { codigo: "competidor", n: 1 },
        ],
      });
      // Se piden las decisiones «descartar» de los últimos 7 días…
      const donde = mock.growthDecision.findMany.mock.calls[0]![0].where;
      expect(donde.accion).toBe("descartar");
      expect(donde.en.gte.getTime()).toBeGreaterThan(
        Date.now() - 7 * DIA - 5000
      );
      expect(donde.en.gte.getTime()).toBeLessThan(Date.now() - 7 * DIA + 5000);
      // …y se leen solo las oportunidades (sin repetir) que siguen descartadas.
      const consulta = mock.growthOportunidad.findMany.mock.calls
        .map(([c]) => c.where)
        .find((w) => w.id);
      expect(consulta).toEqual({
        id: { in: ["o1", "o2", "o3"] },
        estado: "descartada",
      });
    });

    it("un descarte sin código se cuenta como «otro»", async () => {
      mock.growthOportunidad.findMany.mockImplementation(
        async ({ where }: { where: { id?: unknown } }) =>
          where.id ? [{ datos: null }, { datos: { nota: "x" } }] : []
      );
      const cuerpo = (await pedir("/growth/admin/resumen")).json();
      expect(cuerpo.descartesUltimos7Dias.porMotivo).toEqual([
        { codigo: "otro", n: 2 },
      ]);
    });

    it("sin descartes no consulta las oportunidades y dice cero", async () => {
      mock.growthDecision.findMany.mockResolvedValue([]);
      const cuerpo = (await pedir("/growth/admin/resumen")).json();

      expect(cuerpo.descartesUltimos7Dias).toEqual({ total: 0, porMotivo: [] });
      const conIds = mock.growthOportunidad.findMany.mock.calls.filter(
        ([c]) => c.where.id
      );
      expect(conIds).toHaveLength(0);
    });

    it("enseña los topes usados (hechos más aprobados) y los ajustes efectivos, con la pausa", async () => {
      const cuerpo = (await pedir("/growth/admin/resumen")).json();

      expect(cuerpo.contactos).toEqual({
        estaSemana: 3,
        hechas: 1,
        aprobadasSinGestionar: 2,
        tope: 4,
      });
      expect(cuerpo.pausa).toBe(false);
      expect(cuerpo.ajustes).toEqual({
        topeSemanal: 4,
        umbralDeSimilitud: 0.6,
        umbralesPorObjetivo: { TRAFICO_MARCA: 60, LEADS: 60, BACKLINKS: 60 },
        pausa: false,
      });
    });

    it("avisa de la pausa", async () => {
      mock.growthAjuste.findMany.mockResolvedValue([
        { clave: "pausa", valor: true, actualizadoEn: hace(1) },
      ]);
      expect((await pedir("/growth/admin/resumen")).json().pausa).toBe(true);
    });

    it("lista lo que caduca en los próximos 7 días (también lo ya vencido) con sus días", async () => {
      const cuerpo = (await pedir("/growth/admin/resumen")).json();

      expect(cuerpo.porCaducar).toEqual([
        expect.objectContaining({
          id: "o9",
          titulo: "Directorio",
          estado: "aprobada",
          diasParaCaducar: 2,
        }),
      ]);
      const consulta = mock.growthOportunidad.findMany.mock.calls
        .map(([c]) => c)
        .find((c) => !c.where.id);
      expect(consulta.where.estado).toEqual({
        in: ["aprobada", "pendiente_aprobacion"],
      });
      expect(consulta.where.expiraEn.not).toBeNull();
      expect(consulta.take).toBe(5);
      expect(consulta.orderBy[0]).toEqual({ expiraEn: "asc" });
    });

    it("trae la última ejecución, el snapshot del conocimiento y los tokens", async () => {
      const cuerpo = (await pedir("/growth/admin/resumen")).json();

      expect(cuerpo.ultimaEjecucion).toMatchObject({
        id: "e1",
        disparador: "programada",
        estado: "ok",
      });
      expect(cuerpo.conocimiento).toMatchObject({
        commitSha: "abc1234",
        vigentes: 160,
        obsoleto: false,
      });
      expect(cuerpo.tokens.activos).toBe(2);
      expect(cuerpo.tokens.ultimoUso).toBeTruthy();
      expect(mock.growthTokenAgente.count).toHaveBeenCalledWith({
        where: { revocadoEn: null },
      });
    });

    it("en una instalación vacía todo sale a cero o null (no rompe)", async () => {
      mock.growthOportunidad.groupBy.mockResolvedValue([]);
      mock.growthAjuste.findMany.mockResolvedValue([]);
      ajustesPorClave({});
      mock.growthGestion.count.mockResolvedValue(0);
      mock.growthOportunidad.count.mockResolvedValue(0);
      mock.growthDecision.findMany.mockResolvedValue([]);
      mock.growthOportunidad.findMany.mockResolvedValue([]);
      mock.growthEjecucion.findFirst.mockResolvedValue(null);
      mock.growthTokenAgente.count.mockResolvedValue(0);
      mock.growthTokenAgente.findFirst.mockResolvedValue(null);

      const response = await pedir("/growth/admin/resumen");
      expect(response.statusCode).toBe(200);
      const cuerpo = response.json();
      expect(cuerpo.conocimiento).toBeNull();
      expect(cuerpo.ultimaEjecucion).toBeNull();
      expect(cuerpo.tokens).toEqual({ activos: 0, ultimoUso: null });
      expect(cuerpo.paraRevisar).toBe(0);
      expect(cuerpo.porCaducar).toEqual([]);
    });

    it("no enseña ningún hash de token ni la clave externa de las oportunidades", async () => {
      const texto = JSON.stringify(
        (await pedir("/growth/admin/resumen")).json()
      );
      expect(texto).not.toContain("hashToken");
      expect(texto).not.toContain("claveExterna");
    });
  });

  // ── añadir una URL a mano ──────────────────────────────────────────────

  describe("añadir una URL", () => {
    function anadir(payload: unknown) {
      return fastify.inject({
        method: "POST",
        url: "/growth/admin/oportunidades",
        headers: comoAdmin(),
        payload: payload as object,
      });
    }

    beforeEach(() => {
      mock.growthFuente.upsert.mockResolvedValue({
        id: "fuente_manual",
        tipo: "manual",
        nombre: "Entrada manual",
        activa: true,
      });
      mock.growthOportunidad.findUnique.mockResolvedValue(null);
      mock.growthOportunidad.create.mockResolvedValue({
        id: "o1",
        estado: "detectada",
        motivoDescarte: null,
      });
      mock.growthDecision.create.mockResolvedValue({});
    });

    it("crea la oportunidad `detectada` con la fuente manual y deja rastro firmado con tu correo", async () => {
      const response = await anadir({
        url: "https://www.Directorio-Ejemplo.es/alta/?utm_source=x",
        nota: "La vi en un grupo",
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toEqual({
        creada: true,
        id: "o1",
        estado: "detectada",
      });
      const datos = mock.growthOportunidad.create.mock.calls[0]![0].data;
      expect(datos).toMatchObject({
        fuenteId: "fuente_manual",
        // La URL que se guarda es la que abre una persona: sin seguimiento,
        // pero con su `www` y su ruta; el dominio sí va sin `www`.
        url: "https://www.directorio-ejemplo.es/alta/",
        dominio: "directorio-ejemplo.es",
        objetivoPrincipal: "BACKLINKS",
        titulo: "directorio-ejemplo.es",
        extracto: "",
        datos: { nota: "La vi en un grupo" },
      });
      expect(datos.retencionHasta.getTime()).toBeGreaterThan(
        Date.now() + 179 * DIA
      );
      expect(mock.growthDecision.create).toHaveBeenCalledWith({
        data: {
          oportunidadId: "o1",
          accion: "anadir_url",
          motivo: "La vi en un grupo",
          por: ADMIN,
        },
      });
    });

    it("una URL que ya existe, aunque esté descartada, no se reabre: 200 con creada:false y su motivo", async () => {
      mock.growthOportunidad.findUnique.mockResolvedValue({
        id: "o7",
        estado: "descartada",
        motivoDescarte: "Es de un competidor",
      });
      const response = await anadir({ url: "https://ejemplo.com/alta" });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        creada: false,
        id: "o7",
        estado: "descartada",
        motivoDescarte: "Es de un competidor",
      });
      expect(mock.growthOportunidad.create).not.toHaveBeenCalled();
      expect(mock.growthOportunidad.update).not.toHaveBeenCalled();
      expect(mock.growthOportunidad.updateMany).not.toHaveBeenCalled();
      expect(mock.growthDecision.create).not.toHaveBeenCalled();
    });

    it("la pausa del agente no impide al administrador añadir una URL", async () => {
      mock.growthAjuste.findUnique.mockResolvedValue({
        clave: "pausa",
        valor: true,
        actualizadoEn: new Date(),
      });
      const response = await anadir({ url: "https://ejemplo.com/alta" });
      expect(response.statusCode).toBe(201);
    });

    it("rechaza páginas de Alhabla, hosts internos e IP con 400", async () => {
      for (const url of [
        "https://alhabla.ai/sectores",
        "https://app.alhabla.ai/",
        "http://localhost:3000/x",
        "https://192.168.1.4/admin",
        "https://servidor.internal/x",
        "https://intranet/x",
      ]) {
        const response = await anadir({ url });
        expect(response.statusCode, url).toBe(400);
        expect(typeof response.json().error).toBe("string");
      }
      expect(mock.growthOportunidad.create).not.toHaveBeenCalled();
    });

    it("rechaza URL que no son http(s), con credenciales o que no son URL: 400 con la lista de fallos", async () => {
      for (const url of [
        "javascript:alert(1)",
        "data:text/html,<script>1</script>",
        "ftp://ejemplo.com/x",
        "https://alhabla.ai@sitio-malo.com/",
        "no es una url",
        "",
      ]) {
        const response = await anadir({ url });
        expect(response.statusCode, url).toBe(400);
        expect(Array.isArray(response.json().error)).toBe(true);
      }
    });

    it("el cuerpo es estricto: no deja fijar el estado, la puntuación ni la fuente", async () => {
      for (const extra of [
        { estado: "aprobada" },
        { puntBacklinks: 100 },
        { fuenteId: "otra" },
        { extracto: "texto" },
        { ejecucionId: "e1" },
      ]) {
        const response = await anadir({
          url: "https://ejemplo.com/alta",
          ...extra,
        });
        expect(response.statusCode, JSON.stringify(extra)).toBe(400);
      }
    });

    it("un nicho que no existe da 400; con nicho válido se enlaza", async () => {
      mock.growthNicho.findUnique.mockResolvedValue(null);
      const mal = await anadir({
        url: "https://ejemplo.com/alta",
        nichoSlug: "fantasma",
      });
      expect(mal.statusCode).toBe(400);

      mock.growthNicho.findUnique.mockResolvedValue({ id: "n1" });
      const bien = await anadir({
        url: "https://ejemplo.com/alta",
        nichoSlug: "peluqueria",
      });
      expect(bien.statusCode).toBe(201);
      expect(mock.growthOportunidad.create.mock.calls[0]![0].data.nichoId).toBe(
        "n1"
      );
    });

    it("acepta objetivo, título y caducidad", async () => {
      const caducidad = dentroDe(30).toISOString();
      const response = await anadir({
        url: "https://ejemplo.com/alta",
        objetivoPrincipal: "LEADS",
        titulo: "Ficha de ejemplo",
        expiraEn: caducidad,
      });
      expect(response.statusCode).toBe(201);
      expect(
        mock.growthOportunidad.create.mock.calls[0]![0].data
      ).toMatchObject({
        objetivoPrincipal: "LEADS",
        titulo: "Ficha de ejemplo",
        expiraEn: new Date(caducidad),
      });
    });

    it("una caducidad en el pasado se rechaza", async () => {
      const response = await anadir({
        url: "https://ejemplo.com/alta",
        expiraEn: hace(1).toISOString(),
      });
      expect(response.statusCode).toBe(400);
    });
  });

  // ── decisiones ─────────────────────────────────────────────────────────

  describe("decisiones", () => {
    beforeEach(() => {
      mock.growthDecision.findMany.mockResolvedValue([
        {
          id: "d2",
          accion: "aprobar",
          motivo: null,
          por: ADMIN,
          en: hace(1),
          oportunidad: {
            id: "o1",
            titulo: "Directorio",
            dominio: "ejemplo.com",
            url: "https://ejemplo.com/alta",
            estado: "aprobada",
          },
          borrador: { id: "b1", version: 2, tipo: "email" },
        },
        {
          id: "d1",
          accion: "ajustes",
          motivo: "topeSemanal: 5 -> 8",
          por: ADMIN,
          en: hace(3),
          oportunidad: null,
          borrador: null,
        },
      ]);
      mock.growthDecision.count.mockResolvedValue(42);
      mock.growthDecision.groupBy.mockResolvedValue([
        { accion: "aprobar", _count: { _all: 5 } },
        { accion: "ajustes", _count: { _all: 2 } },
      ]);
    });

    it("pagina por fecha descendente y enseña quién decidió (el correo)", async () => {
      const response = await pedir(
        "/growth/admin/decisiones?pagina=3&limite=2"
      );

      expect(response.statusCode).toBe(200);
      const cuerpo = response.json();
      expect(cuerpo).toMatchObject({ total: 42, pagina: 3, limite: 2 });
      expect(cuerpo.data[0]).toMatchObject({ accion: "aprobar", por: ADMIN });
      expect(cuerpo.data[1].oportunidad).toBeNull();
      expect(cuerpo.conteos).toEqual({ porAccion: { aprobar: 5, ajustes: 2 } });
      expect(mock.growthDecision.findMany.mock.calls[0]![0]).toMatchObject({
        orderBy: [{ en: "desc" }, { id: "desc" }],
        skip: 4,
        take: 2,
      });
    });

    it("sin filtros no pone ninguna condición", async () => {
      await pedir("/growth/admin/decisiones");
      expect(mock.growthDecision.findMany.mock.calls[0]![0].where).toEqual({});
    });

    it("cada filtro llega a la consulta y el conteo por acción ignora el filtro de acción", async () => {
      const desde = "2026-10-01T00:00:00.000Z";
      const hasta = "2026-10-31T00:00:00.000Z";
      await pedir(
        `/growth/admin/decisiones?accion=aprobar&oportunidadId=o1&borradorId=b1&por=${encodeURIComponent(ADMIN)}&soloSistema=true&fechaDesde=${desde}&fechaHasta=${hasta}`
      );

      const condiciones =
        mock.growthDecision.findMany.mock.calls[0]![0].where.AND;
      expect(condiciones).toEqual([
        { accion: "aprobar" },
        { oportunidadId: "o1" },
        { borradorId: "b1" },
        { por: ADMIN },
        { oportunidadId: null },
        { en: { gte: new Date(desde) } },
        { en: { lte: new Date(hasta) } },
      ]);
      const delConteo = mock.growthDecision.groupBy.mock.calls[0]![0];
      expect(delConteo.by).toEqual(["accion"]);
      expect(delConteo.where.AND).not.toContainEqual({ accion: "aprobar" });
      expect(delConteo.where.AND).toHaveLength(6);
    });

    it("soloSistema=false no filtra", async () => {
      await pedir("/growth/admin/decisiones?soloSistema=false");
      expect(mock.growthDecision.findMany.mock.calls[0]![0].where).toEqual({});
    });

    it("rechaza un booleano que no lo es, una fecha mala y un límite fuera de rango", async () => {
      for (const consulta of [
        "?soloSistema=quizas",
        "?fechaDesde=ayer",
        "?limite=201",
        "?pagina=-1",
      ]) {
        expect(
          (await pedir(`/growth/admin/decisiones${consulta}`)).statusCode
        ).toBe(400);
      }
    });

    it("el historial es de solo lectura: no hay forma de editar ni borrar una decisión", async () => {
      for (const metodo of ["PUT", "PATCH", "DELETE", "POST"] as const) {
        const response = await fastify.inject({
          method: metodo,
          url: "/growth/admin/decisiones",
          headers: comoAdmin(),
          payload: {},
        });
        expect(response.statusCode, metodo).toBe(404);
      }
      expect(mock.growthDecision.create).not.toHaveBeenCalled();
    });
  });

  // ── gestiones ──────────────────────────────────────────────────────────

  describe("gestiones", () => {
    beforeEach(() => {
      mock.growthGestion.findMany.mockResolvedValue([
        {
          id: "g1",
          canal: "email",
          dominio: "ejemplo.com",
          hechaEn: hace(2),
          respuestaEn: null,
          resultado: "pendiente",
          urlConseguida: null,
          notas: null,
          borrador: {
            id: "b1",
            version: 2,
            tipo: "email",
            asunto: "Asunto",
            textoFinal: null,
            editadoPorHumano: false,
            oportunidad: {
              id: "o1",
              titulo: "Directorio",
              url: "https://ejemplo.com/alta",
              estado: "gestionada",
              objetivoPrincipal: "BACKLINKS",
            },
          },
        },
      ]);
      mock.growthGestion.count.mockResolvedValue(7);
      mock.growthGestion.groupBy.mockResolvedValue([
        { resultado: "pendiente", _count: { _all: 4 } },
        { resultado: "aceptado", _count: { _all: 3 } },
      ]);
    });

    it("devuelve cada gestión con su borrador y su oportunidad aplanados, y los conteos por resultado", async () => {
      const response = await pedir("/growth/admin/gestiones?limite=10");

      expect(response.statusCode).toBe(200);
      const cuerpo = response.json();
      expect(cuerpo).toMatchObject({ total: 7, pagina: 1, limite: 10 });
      expect(cuerpo.data[0]).toMatchObject({
        id: "g1",
        canal: "email",
        dominio: "ejemplo.com",
        resultado: "pendiente",
        borrador: { id: "b1", version: 2, asunto: "Asunto" },
        oportunidad: { id: "o1", estado: "gestionada" },
      });
      // La oportunidad vive al lado del borrador, no dentro.
      expect(cuerpo.data[0].borrador).not.toHaveProperty("oportunidad");
      expect(cuerpo.conteos).toEqual({
        porResultado: { pendiente: 4, aceptado: 3 },
      });
      expect(mock.growthGestion.findMany.mock.calls[0]![0].orderBy).toEqual([
        { hechaEn: "desc" },
        { id: "desc" },
      ]);
    });

    it("filtra por resultado, canal, dominio (sin www ni mayúsculas) y fechas; el conteo ignora el resultado", async () => {
      await pedir(
        "/growth/admin/gestiones?resultado=aceptado&canal=formulario&dominio=WWW.Ejemplo.com&fechaDesde=2026-10-01&fechaHasta=2026-10-30"
      );

      expect(mock.growthGestion.findMany.mock.calls[0]![0].where).toEqual({
        resultado: "aceptado",
        canal: "formulario",
        dominio: "ejemplo.com",
        hechaEn: {
          gte: new Date("2026-10-01"),
          lte: new Date("2026-10-30"),
        },
      });
      expect(
        mock.growthGestion.groupBy.mock.calls[0]![0].where
      ).not.toHaveProperty("resultado");
    });

    it("rechaza un resultado o un canal desconocidos", async () => {
      expect(
        (await pedir("/growth/admin/gestiones?resultado=perfecto")).statusCode
      ).toBe(400);
      expect(
        (await pedir("/growth/admin/gestiones?canal=paloma")).statusCode
      ).toBe(400);
    });
  });

  // ── conocimiento ───────────────────────────────────────────────────────

  describe("conocimiento", () => {
    function afirmacion(clave: string, cambios: Record<string, unknown> = {}) {
      return {
        id: `id-${clave}`,
        clave,
        tipo: clave.split(".")[0],
        texto: `Texto de ${clave}`,
        valor: null,
        fuente: "web/src/lib/plans.ts#x",
        commitSha: "abc1234",
        nichoSlug: null,
        vigenteDesde: hace(10),
        ...cambios,
      };
    }

    beforeEach(() => {
      mock.growthAfirmacion.findMany.mockImplementation(
        async ({ where }: { where: Record<string, unknown> }) => {
          if (where.vigenteHasta === null) {
            return [
              afirmacion("funcion.reserva"),
              afirmacion("precio.plan.pro", { valor: { euros: 139 } }),
              afirmacion("precio.plan.basico"),
              afirmacion("prohibida.proveedor", {
                valor: { terminos: ["Telnyx"], palabrasEnteras: true },
              }),
            ];
          }
          if ("vigenteDesde" in where) {
            return [
              {
                clave: "precio.plan.pro",
                tipo: "precio",
                vigenteDesde: hace(2),
                commitSha: "n1",
              },
              {
                clave: "funcion.reserva",
                tipo: "funcion",
                vigenteDesde: hace(9),
                commitSha: "n0",
              },
            ];
          }
          return [
            {
              clave: "precio.plan.pro",
              tipo: "precio",
              vigenteHasta: hace(2),
              commitSha: "v1",
            },
            {
              clave: "limite.minutos",
              tipo: "limite",
              vigenteHasta: hace(5),
              commitSha: "v0",
            },
          ];
        }
      );
      mock.growthAfirmacion.groupBy.mockResolvedValue([
        { tipo: "precio", _count: { _all: 2 } },
        { tipo: "funcion", _count: { _all: 1 } },
        { tipo: "prohibida", _count: { _all: 1 } },
      ]);
      ajustesPorClave({
        "sistema.conocimiento": {
          commitSha: "abc1234",
          vigentes: 4,
          porTipo: { precio: 2, funcion: 1, prohibida: 1 },
        },
      });
    });

    it("agrupa lo vigente por los siete tipos (los vacíos, vacíos) y cuenta cada uno", async () => {
      const response = await pedir("/growth/admin/conocimiento");

      expect(response.statusCode).toBe(200);
      const cuerpo = response.json();
      expect(Object.keys(cuerpo.porTipo)).toEqual([
        "precio",
        "funcion",
        "limite",
        "sector",
        "comparativa",
        "pagina",
        "prohibida",
      ]);
      expect(
        cuerpo.porTipo.precio.map((a: { clave: string }) => a.clave)
      ).toEqual(["precio.plan.pro", "precio.plan.basico"]);
      expect(cuerpo.porTipo.limite).toEqual([]);
      expect(cuerpo.conteos).toEqual({
        precio: 2,
        funcion: 1,
        limite: 0,
        sector: 0,
        comparativa: 0,
        pagina: 0,
        prohibida: 1,
      });
      expect(cuerpo.truncado).toBe(false);
      expect(cuerpo.snapshot).toMatchObject({
        commitSha: "abc1234",
        obsoleto: false,
        vigentes: 4,
      });
    });

    it("«prohibido decir» sale con la lista de términos en `valor`", async () => {
      const cuerpo = (await pedir("/growth/admin/conocimiento")).json();
      expect(cuerpo.porTipo.prohibida[0].valor).toEqual({
        terminos: ["Telnyx"],
        palabrasEnteras: true,
      });
    });

    it("la antigüedad del snapshot sale de la sincronización, no de la fecha de las filas", async () => {
      mock.growthAjuste.findUnique.mockResolvedValue({
        clave: "sistema.conocimiento",
        valor: { commitSha: "abc1234", vigentes: 4, porTipo: {} },
        actualizadoEn: hace(10),
      });
      const cuerpo = (await pedir("/growth/admin/conocimiento")).json();
      expect(cuerpo.snapshot.obsoleto).toBe(true);
      expect(cuerpo.snapshot.antiguedadHoras).toBeGreaterThan(239);
    });

    it("sin sincronizar nunca, el snapshot es null", async () => {
      ajustesPorClave({});
      expect(
        (await pedir("/growth/admin/conocimiento")).json().snapshot
      ).toBeNull();
    });

    it("los cambios recientes mezclan altas y cierres, del más nuevo al más viejo", async () => {
      const { cambiosRecientes } = (
        await pedir("/growth/admin/conocimiento")
      ).json();

      expect(
        cambiosRecientes.map((c: { clave: string; cambio: string }) => [
          c.clave,
          c.cambio,
        ])
      ).toEqual([
        ["precio.plan.pro", "alta"],
        ["precio.plan.pro", "cierre"],
        ["limite.minutos", "cierre"],
        ["funcion.reserva", "alta"],
      ]);
      expect(cambiosRecientes[0]).toMatchObject({
        tipo: "precio",
        commitSha: "n1",
      });
    });

    it("los cambios miran 30 días atrás y a lo sumo 50 de cada clase", async () => {
      await pedir("/growth/admin/conocimiento");
      const consultas = mock.growthAfirmacion.findMany.mock.calls.map(
        ([c]) => c
      );
      const altas = consultas.find((c) => "vigenteDesde" in c.where)!;
      const cierres = consultas.find(
        (c) => c.where.vigenteHasta && typeof c.where.vigenteHasta === "object"
      )!;
      expect(altas.take).toBe(50);
      expect(cierres.take).toBe(50);
      expect(altas.where.vigenteDesde.gte.getTime()).toBeLessThan(
        Date.now() - 29 * DIA
      );
      expect(cierres.where.vigenteHasta.gte.getTime()).toBeLessThan(
        Date.now() - 29 * DIA
      );
    });

    it("filtra por tipo las listas, pero las pestañas siguen contando todos los tipos", async () => {
      await pedir("/growth/admin/conocimiento?tipo=precio");

      for (const [consulta] of mock.growthAfirmacion.findMany.mock.calls) {
        expect(consulta.where.tipo).toBe("precio");
      }
      expect(mock.growthAfirmacion.groupBy.mock.calls[0]![0].where).toEqual({
        vigenteHasta: null,
      });
    });

    it("con más de 1.000 afirmaciones vigentes se trunca y lo dice", async () => {
      const muchas = Array.from({ length: 1001 }, (_, i) =>
        afirmacion(`precio.p${String(i).padStart(4, "0")}`)
      );
      mock.growthAfirmacion.findMany.mockImplementation(
        async ({ where }: { where: Record<string, unknown> }) =>
          where.vigenteHasta === null ? muchas : []
      );
      const cuerpo = (await pedir("/growth/admin/conocimiento")).json();
      expect(cuerpo.truncado).toBe(true);
      expect(cuerpo.porTipo.precio).toHaveLength(1000);
    });

    it("rechaza un tipo que no existe", async () => {
      expect(
        (await pedir("/growth/admin/conocimiento?tipo=magia")).statusCode
      ).toBe(400);
    });

    describe("historial de una clave", () => {
      it("devuelve todas las versiones, la vigente primero", async () => {
        mock.growthAfirmacion.findMany.mockResolvedValue([
          {
            id: "a2",
            tipo: "precio",
            texto: "Pro: 139 €",
            valor: { euros: 139 },
            fuente: "web/src/lib/plans.ts#pro",
            commitSha: "n1",
            vigenteDesde: hace(2),
            vigenteHasta: null,
          },
          {
            id: "a1",
            tipo: "precio",
            texto: "Pro: 99 €",
            valor: { euros: 99 },
            fuente: "web/src/lib/plans.ts#pro",
            commitSha: "v1",
            vigenteDesde: hace(30),
            vigenteHasta: hace(2),
          },
        ]);
        const response = await pedir(
          "/growth/admin/conocimiento/precio.plan.pro/historial"
        );

        expect(response.statusCode).toBe(200);
        const cuerpo = response.json();
        expect(cuerpo.clave).toBe("precio.plan.pro");
        expect(cuerpo.versiones.map((v: { id: string }) => v.id)).toEqual([
          "a2",
          "a1",
        ]);
        expect(cuerpo.versiones[1].vigenteHasta).not.toBeNull();
        expect(mock.growthAfirmacion.findMany.mock.calls[0]![0]).toMatchObject({
          where: { clave: "precio.plan.pro" },
          orderBy: [{ vigenteDesde: "desc" }, { id: "desc" }],
        });
      });

      it("una clave que nunca existió da 404", async () => {
        mock.growthAfirmacion.findMany.mockResolvedValue([]);
        const response = await pedir(
          "/growth/admin/conocimiento/precio.fantasma/historial"
        );
        expect(response.statusCode).toBe(404);
        expect(response.json()).toEqual({ error: "Esa afirmación no existe." });
      });

      it("entiende una clave con la URL codificada", async () => {
        mock.growthAfirmacion.findMany.mockResolvedValue([]);
        await pedir(
          `/growth/admin/conocimiento/${encodeURIComponent("pagina./blog/uno")}/historial`
        );
        expect(
          mock.growthAfirmacion.findMany.mock.calls[0]![0].where.clave
        ).toBe("pagina./blog/uno");
      });
    });
  });

  // ── competidores ───────────────────────────────────────────────────────

  describe("competidores", () => {
    const base = {
      url: null,
      origen: "repo",
      estado: "por_analizar",
      creadoEn: new Date("2026-10-01T10:00:00.000Z"),
      analisisSolicitadoEn: null,
      analisis: [],
    };

    it("lista por nombre con cuántas oportunidades hay de su dominio y de sus subdominios", async () => {
      mock.growthCompetidor.findMany.mockResolvedValue([
        {
          ...base,
          id: "c1",
          nombre: "fonio",
          dominio: "fonio.ai",
          notas: null,
        },
        {
          ...base,
          id: "c2",
          nombre: "HeyDiga",
          dominio: "heydiga.ai",
          notas: "Directo",
        },
      ]);
      mock.growthOportunidad.groupBy.mockResolvedValue([
        { dominio: "heydiga.ai", _count: { _all: 2 } },
        { dominio: "blog.heydiga.ai", _count: { _all: 1 } },
        { dominio: "fonio.ai", _count: { _all: 4 } },
      ]);
      mock.growthOportunidad.count.mockResolvedValue(0);
      const response = await pedir("/growth/admin/competidores");

      expect(response.statusCode).toBe(200);
      const { data } = response.json();
      expect(
        data.map((c: { id: string; oportunidades: number }) => [
          c.id,
          c.oportunidades,
        ])
      ).toEqual([
        ["c1", 4],
        ["c2", 3],
      ]);
      expect(data[1]).toMatchObject({
        id: "c2",
        nombre: "HeyDiga",
        dominio: "heydiga.ai",
        notas: "Directo",
        origen: "repo",
        estado: "por_analizar",
        menciones: 0,
        analisis: null,
      });
      expect(
        mock.growthCompetidor.findMany.mock.calls[0]![0].orderBy[0]
      ).toEqual({
        nombre: "asc",
      });
    });

    it("un dominio que solo termina igual no cuenta (xheydiga.ai no es heydiga.ai)", async () => {
      mock.growthCompetidor.findMany.mockResolvedValue([
        {
          ...base,
          id: "c2",
          nombre: "HeyDiga",
          dominio: "heydiga.ai",
          notas: null,
        },
      ]);
      mock.growthOportunidad.groupBy.mockResolvedValue([
        { dominio: "xheydiga.ai", _count: { _all: 9 } },
      ]);
      mock.growthOportunidad.count.mockResolvedValue(0);
      const cuerpo = (await pedir("/growth/admin/competidores")).json();
      expect(cuerpo.data[0].oportunidades).toBe(0);
    });

    it("sin competidores devuelve una lista vacía y no consulta las oportunidades", async () => {
      mock.growthCompetidor.findMany.mockResolvedValue([]);
      const response = await pedir("/growth/admin/competidores");
      expect(response.json()).toEqual({ data: [] });
      expect(mock.growthOportunidad.groupBy).not.toHaveBeenCalled();
    });

    it("sobre un competidor concreto no hay PUT ni POST sueltos: solo PATCH, DELETE y las acciones con nombre", async () => {
      for (const [metodo, url] of [
        ["POST", "/growth/admin/competidores/c1"],
        ["PUT", "/growth/admin/competidores/c1"],
      ] as const) {
        const response = await fastify.inject({
          method: metodo,
          url,
          headers: comoAdmin(),
          payload: { nombre: "X", dominio: "x.com" },
        });
        expect(response.statusCode, `${metodo} ${url}`).toBe(404);
      }
      expect(mock.growthCompetidor.create).not.toHaveBeenCalled();
    });
  });

  // ── acceso a todo lo anterior ──────────────────────────────────────────

  describe("acceso", () => {
    const rutas: [string, string, object | undefined][] = [
      ["GET", "/growth/admin/yo", undefined],
      ["GET", "/growth/admin/resumen", undefined],
      ["POST", "/growth/admin/oportunidades", { url: "https://ejemplo.com/x" }],
      ["GET", "/growth/admin/decisiones", undefined],
      ["GET", "/growth/admin/gestiones", undefined],
      ["GET", "/growth/admin/conocimiento", undefined],
      [
        "GET",
        "/growth/admin/conocimiento/precio.plan.pro/historial",
        undefined,
      ],
      ["GET", "/growth/admin/competidores", undefined],
    ];

    for (const [metodo, url, payload] of rutas) {
      it(`${metodo} ${url}: sin sesión da 401, con un correo ajeno 403 y con un token de agente 401`, async () => {
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

        mockVerifyIdToken.mockRejectedValue(
          new Error("Wrong number of segments")
        );
        const agente = await fastify.inject({
          method: metodo as "GET",
          url,
          headers: { authorization: "Bearer gta_un-token-de-agente" },
          payload,
        });
        expect(agente.statusCode).toBe(401);

        expect(mock.growthOportunidad.create).not.toHaveBeenCalled();
      });
    }

    it("los errores de validación y los 404 tienen el formato de siempre", async () => {
      const validacion = await pedir("/growth/admin/decisiones?limite=0");
      expect(validacion.statusCode).toBe(400);
      expect(validacion.json().error[0]).toMatchObject({
        path: ["limite"],
      });

      mock.growthAfirmacion.findMany.mockResolvedValue([]);
      const noExiste = await pedir("/growth/admin/conocimiento/x.y/historial");
      expect(noExiste.json()).toEqual({ error: "Esa afirmación no existe." });
      expect(noExiste.headers["cache-control"]).toBe("no-store");
    });
  });
});
