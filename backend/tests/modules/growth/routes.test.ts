import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify from "fastify";
import { growthRoutes } from "../../../src/modules/growth/routes.js";
import { hashDeToken } from "../../../src/modules/growth/tokens.js";

const { prismaMock, mockVerifyIdToken } = vi.hoisted(() => {
  const modelo = () => ({
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
    count: vi.fn(),
  });
  const prismaMock = {
    growthTokenAgente: modelo(),
    growthOportunidad: modelo(),
    growthInvestigacion: modelo(),
    growthBorrador: modelo(),
    growthRevisionCumplimiento: modelo(),
    growthDecision: modelo(),
    growthGestion: modelo(),
    growthAfirmacion: modelo(),
    growthCompetidor: modelo(),
    growthAjuste: modelo(),
    growthFuente: modelo(),
    growthNicho: modelo(),
    $transaction: vi.fn(),
  };
  return { prismaMock, mockVerifyIdToken: vi.fn() };
});

vi.mock("../../../src/lib/prisma.js", () => ({ prisma: prismaMock }));

vi.mock("google-auth-library", () => ({
  OAuth2Client: vi.fn(function OAuth2ClientMock() {
    return { verifyIdToken: mockVerifyIdToken };
  }),
}));

const TOKEN = "gta_token-de-prueba";
const ADMIN = "admin@alhabla.ai";

function registroDeToken(cambios: Record<string, unknown> = {}) {
  return {
    id: "tok_1",
    nombre: "agente-semanal",
    hashToken: hashDeToken(TOKEN),
    alcances: ["leer", "escribir"],
    revocadoEn: null,
    ultimoUso: new Date(),
    ...cambios,
  };
}

function comoAgente(token = TOKEN) {
  return { authorization: `Bearer ${token}` };
}

function comoAdmin() {
  return { authorization: "Bearer id-token-de-google" };
}

describe("rutas de Alhabla Growth", () => {
  let fastify: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.GROWTH_GOOGLE_CLIENT_ID =
      "cliente-growth.apps.googleusercontent.com";
    process.env.GROWTH_ADMIN_EMAILS = ADMIN;

    prismaMock.$transaction.mockImplementation(
      async (cb: (tx: typeof prismaMock) => unknown) => cb(prismaMock)
    );
    prismaMock.growthTokenAgente.findUnique.mockResolvedValue(
      registroDeToken()
    );
    prismaMock.growthTokenAgente.update.mockResolvedValue({});
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
      expect(prismaMock.growthTokenAgente.findUnique).not.toHaveBeenCalled();
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
      expect(prismaMock.growthOportunidad.findMany).not.toHaveBeenCalled();
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
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
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
      prismaMock.growthTokenAgente.findUnique.mockResolvedValueOnce(
        registroDeToken({ revocadoEn: new Date() })
      );
      const revocado = await fastify.inject({
        method: "GET",
        url: "/growth/agente/contexto",
        headers: comoAgente(),
      });
      expect(revocado.statusCode).toBe(401);

      prismaMock.growthTokenAgente.findUnique.mockResolvedValueOnce(null);
      const desconocido = await fastify.inject({
        method: "GET",
        url: "/growth/agente/contexto",
        headers: comoAgente(),
      });
      expect(desconocido.statusCode).toBe(401);
    });

    it("un token que solo lee no puede escribir", async () => {
      prismaMock.growthTokenAgente.findUnique.mockResolvedValue(
        registroDeToken({ alcances: ["leer"] })
      );
      const response = await fastify.inject({
        method: "POST",
        url: "/growth/agente/oportunidades",
        headers: comoAgente(),
        payload: {},
      });
      expect(response.statusCode).toBe(403);
      expect(prismaMock.growthOportunidad.create).not.toHaveBeenCalled();
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
      prismaMock.growthTokenAgente.findUnique.mockResolvedValue(
        registroDeToken({ ultimoUso: new Date(Date.now() - 60 * 60 * 1000) })
      );
      for (const modelo of [
        prismaMock.growthAjuste,
        prismaMock.growthAfirmacion,
        prismaMock.growthCompetidor,
        prismaMock.growthNicho,
        prismaMock.growthFuente,
      ]) {
        modelo.findMany.mockResolvedValue([]);
      }
      const response = await fastify.inject({
        method: "GET",
        url: "/growth/agente/contexto",
        headers: comoAgente(),
      });
      expect(response.statusCode).toBe(200);
      expect(prismaMock.growthTokenAgente.update).toHaveBeenCalledOnce();
    });
  });

  describe("oportunidades (agente)", () => {
    const cuerpo = {
      fuenteId: "f1",
      url: "https://www.Ejemplo.com/mejores-recepcionistas/?utm_source=x#top",
      titulo: "Las mejores recepcionistas de IA",
      extracto: "Comparativa de recepcionistas de IA en España.",
      objetivoPrincipal: "BACKLINKS",
      puntBacklinks: 80,
    };

    it("crea una oportunidad nueva con la URL normalizada y su retención", async () => {
      prismaMock.growthOportunidad.findUnique.mockResolvedValue(null);
      prismaMock.growthOportunidad.create.mockResolvedValue({
        id: "o1",
        estado: "detectada",
      });

      const response = await fastify.inject({
        method: "POST",
        url: "/growth/agente/oportunidades",
        headers: comoAgente(),
        payload: cuerpo,
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toEqual({
        creada: true,
        id: "o1",
        estado: "detectada",
      });
      const datos = prismaMock.growthOportunidad.create.mock.calls[0]![0].data;
      expect(datos.url).toBe("https://ejemplo.com/mejores-recepcionistas");
      expect(datos.dominio).toBe("ejemplo.com");
      expect(datos.claveExterna).toMatch(/^[0-9a-f]{64}$/);
      expect(datos.retencionHasta.getTime()).toBeGreaterThan(Date.now());
    });

    it("la misma página con otro seguimiento no se duplica", async () => {
      prismaMock.growthOportunidad.findUnique.mockResolvedValue({
        id: "o1",
        estado: "calificada",
      });
      const response = await fastify.inject({
        method: "POST",
        url: "/growth/agente/oportunidades",
        headers: comoAgente(),
        payload: cuerpo,
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ creada: false, id: "o1" });
      expect(prismaMock.growthOportunidad.create).not.toHaveBeenCalled();
    });

    it("rechaza una URL inválida con 400", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/growth/agente/oportunidades",
        headers: comoAgente(),
        payload: { ...cuerpo, url: "esto no es una url" },
      });
      expect(response.statusCode).toBe(400);
    });

    it("el agente no puede aprobar: ese estado ni se acepta", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/growth/agente/oportunidades/o1/estado",
        headers: comoAgente(),
        payload: { a: "aprobada" },
      });
      expect(response.statusCode).toBe(400);
      expect(prismaMock.growthOportunidad.update).not.toHaveBeenCalled();
    });

    it("descartar exige un motivo", async () => {
      prismaMock.growthOportunidad.findUnique.mockResolvedValue({
        estado: "detectada",
      });
      const response = await fastify.inject({
        method: "POST",
        url: "/growth/agente/oportunidades/o1/estado",
        headers: comoAgente(),
        payload: { a: "descartada" },
      });
      expect(response.statusCode).toBe(400);
    });

    it("no deja saltar de detectada a investigada", async () => {
      prismaMock.growthOportunidad.findUnique.mockResolvedValue({
        estado: "detectada",
      });
      const response = await fastify.inject({
        method: "POST",
        url: "/growth/agente/oportunidades/o1/estado",
        headers: comoAgente(),
        payload: { a: "investigada" },
      });
      expect(response.statusCode).toBe(409);
      expect(prismaMock.growthOportunidad.update).not.toHaveBeenCalled();
    });

    it("califica una detectada", async () => {
      prismaMock.growthOportunidad.findUnique.mockResolvedValue({
        estado: "detectada",
      });
      prismaMock.growthOportunidad.update.mockResolvedValue({
        id: "o1",
        estado: "calificada",
      });
      const response = await fastify.inject({
        method: "POST",
        url: "/growth/agente/oportunidades/o1/estado",
        headers: comoAgente(),
        payload: { a: "calificada" },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ id: "o1", estado: "calificada" });
    });
  });

  describe("borradores (agente)", () => {
    const borrador = {
      tipo: "email",
      asunto: "Una recepcionista de IA para vuestro listado",
      texto:
        "Hola, soy el fundador de Alhabla. Hemos hecho una recepcionista de IA para peluquerías que atiende las llamadas y reserva en el calendario del negocio. Si os encaja, nos gustaría aparecer en vuestro listado. Un saludo.",
      enlaceUrl: "https://alhabla.ai/peluqueria?utm_source=listado",
      afirmaciones: ["funcion.reserva_en_calendario"],
    };

    beforeEach(() => {
      prismaMock.growthOportunidad.findUnique.mockResolvedValue({
        id: "o1",
        estado: "investigada",
        dominio: "ejemplo.com",
        objetivoPrincipal: "BACKLINKS",
      });
      prismaMock.growthAfirmacion.findMany.mockResolvedValue([
        {
          clave: "funcion.reserva_en_calendario",
          tipo: "funcion",
          texto: "Reserva en el calendario del negocio",
          valor: null,
        },
        {
          clave: "prohibida.telnyx",
          tipo: "prohibida",
          texto: "No se nombra al proveedor de telefonía",
          valor: { terminos: ["Telnyx"] },
        },
      ]);
      prismaMock.growthCompetidor.findMany.mockResolvedValue([]);
      prismaMock.growthAjuste.findMany.mockResolvedValue([]);
      prismaMock.growthBorrador.findMany.mockResolvedValue([]);
      prismaMock.growthGestion.findMany.mockResolvedValue([]);
      prismaMock.growthGestion.count.mockResolvedValue(0);
      prismaMock.growthBorrador.count.mockResolvedValue(0);
      prismaMock.growthBorrador.create.mockImplementation(
        async ({ data }: { data: { estado: string } }) => ({
          id: "b1",
          version: 1,
          estado: data.estado,
        })
      );
      prismaMock.growthRevisionCumplimiento.create.mockResolvedValue({});
      prismaMock.growthOportunidad.update.mockResolvedValue({});
    });

    it("un borrador que cumple queda pendiente de tu aprobación", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/growth/agente/oportunidades/o1/borradores",
        headers: comoAgente(),
        payload: borrador,
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().resultado).toBe("pasa");
      expect(response.json().borrador.estado).toBe("pendiente_aprobacion");
      expect(prismaMock.growthOportunidad.update).toHaveBeenCalledWith({
        where: { id: "o1" },
        data: { estado: "pendiente_aprobacion" },
      });
      const revision =
        prismaMock.growthRevisionCumplimiento.create.mock.calls[0]![0].data;
      expect(revision.revisor).toBe("reglas");
      expect(revision.resultado).toBe("pasa");
    });

    it("un borrador con una afirmación inventada queda bloqueado, no pendiente", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/growth/agente/oportunidades/o1/borradores",
        headers: comoAgente(),
        payload: { ...borrador, afirmaciones: ["funcion.inventada"] },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().resultado).toBe("bloquea");
      expect(response.json().borrador.estado).toBe("bloqueado");
      expect(prismaMock.growthOportunidad.update).toHaveBeenCalledWith({
        where: { id: "o1" },
        data: { estado: "bloqueada" },
      });
    });

    it("un término prohibido que viene en `valor.terminos` bloquea el borrador", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/growth/agente/oportunidades/o1/borradores",
        headers: comoAgente(),
        payload: {
          ...borrador,
          texto: `${borrador.texto} Funciona sobre Telnyx.`,
        },
      });
      expect(response.json().resultado).toBe("bloquea");
      expect(response.json().borrador.estado).toBe("bloqueado");
    });

    it("no se redacta sobre una oportunidad que ya espera tu aprobación", async () => {
      prismaMock.growthOportunidad.findUnique.mockResolvedValue({
        id: "o1",
        estado: "pendiente_aprobacion",
        dominio: "ejemplo.com",
        objetivoPrincipal: "BACKLINKS",
      });
      const response = await fastify.inject({
        method: "POST",
        url: "/growth/agente/oportunidades/o1/borradores",
        headers: comoAgente(),
        payload: borrador,
      });
      expect(response.statusCode).toBe(409);
      expect(prismaMock.growthBorrador.create).not.toHaveBeenCalled();
    });

    it("un dominio contactado hace poco bloquea el borrador", async () => {
      prismaMock.growthGestion.findMany.mockResolvedValue([
        { hechaEn: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
      ]);
      const response = await fastify.inject({
        method: "POST",
        url: "/growth/agente/oportunidades/o1/borradores",
        headers: comoAgente(),
        payload: borrador,
      });
      expect(response.json().resultado).toBe("bloquea");
      const reglas = response
        .json()
        .comprobaciones.filter((c: { ok: boolean }) => !c.ok)
        .map((c: { regla: string }) => c.regla);
      expect(reglas).toContain("un_contacto_por_dominio");
    });
  });

  describe("decisiones (administrador)", () => {
    function oportunidad(estado: string, borradores: unknown[] = []) {
      return {
        id: "o1",
        estado,
        dominio: "ejemplo.com",
        borradores,
      };
    }

    beforeEach(() => {
      prismaMock.growthBorrador.update.mockResolvedValue({});
      prismaMock.growthBorrador.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.growthOportunidad.update.mockResolvedValue({});
      prismaMock.growthDecision.create.mockResolvedValue({});
      prismaMock.growthGestion.create.mockResolvedValue({});
      prismaMock.growthGestion.update.mockResolvedValue({});
    });

    it("aprueba un borrador pendiente y lo deja escrito con tu correo", async () => {
      prismaMock.growthOportunidad.findUnique.mockResolvedValue(
        oportunidad("pendiente_aprobacion", [
          { id: "b1", estado: "pendiente_aprobacion", gestion: null },
        ])
      );
      const response = await fastify.inject({
        method: "POST",
        url: "/growth/admin/oportunidades/o1/decision",
        headers: comoAdmin(),
        payload: { accion: "aprobar", borradorId: "b1" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ id: "o1", estado: "aprobada" });
      expect(prismaMock.growthBorrador.update).toHaveBeenCalledWith({
        where: { id: "b1" },
        data: { estado: "aprobado" },
      });
      expect(prismaMock.growthDecision.create).toHaveBeenCalledWith({
        data: {
          oportunidadId: "o1",
          borradorId: "b1",
          accion: "aprobar",
          motivo: undefined,
          por: ADMIN,
        },
      });
    });

    it("no aprueba una oportunidad que no ha pasado por la revisión", async () => {
      prismaMock.growthOportunidad.findUnique.mockResolvedValue(
        oportunidad("detectada")
      );
      const response = await fastify.inject({
        method: "POST",
        url: "/growth/admin/oportunidades/o1/decision",
        headers: comoAdmin(),
        payload: { accion: "aprobar", borradorId: "b1" },
      });
      expect(response.statusCode).toBe(409);
      expect(prismaMock.growthDecision.create).not.toHaveBeenCalled();
    });

    it("no aprueba un borrador bloqueado", async () => {
      prismaMock.growthOportunidad.findUnique.mockResolvedValue(
        oportunidad("pendiente_aprobacion", [
          { id: "b1", estado: "bloqueado", gestion: null },
        ])
      );
      const response = await fastify.inject({
        method: "POST",
        url: "/growth/admin/oportunidades/o1/decision",
        headers: comoAdmin(),
        payload: { accion: "aprobar", borradorId: "b1" },
      });
      expect(response.statusCode).toBe(409);
      expect(prismaMock.growthBorrador.update).not.toHaveBeenCalled();
    });

    it("devolver y descartar exigen un motivo", async () => {
      for (const accion of ["devolver", "descartar"]) {
        const response = await fastify.inject({
          method: "POST",
          url: "/growth/admin/oportunidades/o1/decision",
          headers: comoAdmin(),
          payload: { accion },
        });
        expect(response.statusCode).toBe(400);
      }
    });

    it("descartar guarda el motivo y cierra los borradores abiertos", async () => {
      prismaMock.growthOportunidad.findUnique.mockResolvedValue(
        oportunidad("pendiente_aprobacion", [])
      );
      const response = await fastify.inject({
        method: "POST",
        url: "/growth/admin/oportunidades/o1/decision",
        headers: comoAdmin(),
        payload: { accion: "descartar", motivo: "Es de un competidor" },
      });
      expect(response.statusCode).toBe(200);
      expect(prismaMock.growthOportunidad.update).toHaveBeenCalledWith({
        where: { id: "o1" },
        data: { estado: "descartada", motivoDescarte: "Es de un competidor" },
      });
      expect(prismaMock.growthBorrador.updateMany).toHaveBeenCalled();
    });

    it("marcar como gestionado registra la gestión con el dominio de la oportunidad", async () => {
      prismaMock.growthOportunidad.findUnique.mockResolvedValue(
        oportunidad("aprobada", [
          { id: "b1", estado: "aprobado", gestion: null },
        ])
      );
      const response = await fastify.inject({
        method: "POST",
        url: "/growth/admin/oportunidades/o1/decision",
        headers: comoAdmin(),
        payload: { accion: "marcar_gestionado", canal: "email" },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().estado).toBe("gestionada");
      const gestion = prismaMock.growthGestion.create.mock.calls[0]![0].data;
      expect(gestion).toMatchObject({
        borradorId: "b1",
        canal: "email",
        dominio: "ejemplo.com",
      });
      expect(gestion.hechaEn).toBeInstanceOf(Date);
    });

    it("sin borrador aprobado no hay nada que marcar como gestionado", async () => {
      prismaMock.growthOportunidad.findUnique.mockResolvedValue(
        oportunidad("aprobada", [])
      );
      const response = await fastify.inject({
        method: "POST",
        url: "/growth/admin/oportunidades/o1/decision",
        headers: comoAdmin(),
        payload: { accion: "marcar_gestionado", canal: "email" },
      });
      expect(response.statusCode).toBe(409);
    });

    it("el enlace conseguido guarda su URL en la gestión", async () => {
      prismaMock.growthOportunidad.findUnique.mockResolvedValue(
        oportunidad("gestionada", [
          { id: "b1", estado: "gestionado", gestion: { id: "g1" } },
        ])
      );
      const response = await fastify.inject({
        method: "POST",
        url: "/growth/admin/oportunidades/o1/decision",
        headers: comoAdmin(),
        payload: {
          accion: "conseguido",
          urlConseguida: "https://ejemplo.com/listado",
        },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().estado).toBe("conseguida");
      expect(prismaMock.growthGestion.update).toHaveBeenCalledWith({
        where: { id: "g1" },
        data: expect.objectContaining({
          resultado: "aceptado",
          urlConseguida: "https://ejemplo.com/listado",
        }),
      });
    });

    it("una oportunidad inexistente da 404", async () => {
      prismaMock.growthOportunidad.findUnique.mockResolvedValue(null);
      const response = await fastify.inject({
        method: "POST",
        url: "/growth/admin/oportunidades/nada/decision",
        headers: comoAdmin(),
        payload: { accion: "sin_respuesta" },
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe("listado (administrador)", () => {
    it("devuelve la puntuación más alta de cada oportunidad", async () => {
      prismaMock.growthOportunidad.findMany.mockResolvedValue([
        {
          id: "o1",
          puntTrafico: 10,
          puntLeads: 30,
          puntBacklinks: 70,
        },
      ]);
      const response = await fastify.inject({
        method: "GET",
        url: "/growth/admin/oportunidades?estado=pendiente_aprobacion&objetivo=BACKLINKS",
        headers: comoAdmin(),
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()[0].puntuacion).toBe(70);
      expect(
        prismaMock.growthOportunidad.findMany.mock.calls[0]![0].where
      ).toEqual({
        estado: "pendiente_aprobacion",
        objetivoPrincipal: "BACKLINKS",
      });
    });

    it("rechaza un estado que no existe", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/growth/admin/oportunidades?estado=inventado",
        headers: comoAdmin(),
      });
      expect(response.statusCode).toBe(400);
    });
  });
});
