import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify from "fastify";
import { growthRoutes } from "../../../src/modules/growth/routes.js";
import type { PrismaMock } from "./ayudas.js";
import {
  ADMIN,
  TEXTO_DE_BORRADOR,
  DIA,
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

function borrador(cambios: Record<string, unknown> = {}) {
  return {
    id: "b1",
    oportunidadId: "o1",
    version: 1,
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
    gestion: null,
    revisiones: [revision()],
    ...cambios,
  };
}

function oportunidad(
  estado: string,
  borradores: unknown[] = [],
  cambios: Record<string, unknown> = {}
) {
  return {
    id: "o1",
    estado,
    dominio: "ejemplo.com",
    expiraEn: null,
    datos: null,
    borradores,
    ...cambios,
  };
}

function decidir(payload: unknown, fastify: ReturnType<typeof Fastify>) {
  return fastify.inject({
    method: "POST",
    url: "/growth/admin/oportunidades/o1/decision",
    headers: comoAdmin(),
    payload: payload as object,
  });
}

describe("rutas del administrador de Alhabla Growth", () => {
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
    mock.growthDecision.create.mockResolvedValue({});
    mock.growthOportunidad.updateMany.mockResolvedValue({ count: 1 });
    mock.growthBorrador.updateMany.mockResolvedValue({ count: 1 });
    mock.growthBorrador.update.mockResolvedValue({});
    mock.growthGestion.create.mockResolvedValue({});
    mock.growthGestion.update.mockResolvedValue({});
    mock.growthRevisionCumplimiento.create.mockResolvedValue({});

    fastify = Fastify();
    await fastify.register(growthRoutes);
  });

  afterEach(async () => {
    await fastify.close();
  });

  // ── decisiones ─────────────────────────────────────────────────────────

  describe("decisiones", () => {
    describe("aprobar", () => {
      beforeEach(() => {
        mock.growthOportunidad.findUnique.mockResolvedValue(
          oportunidad("pendiente_aprobacion", [borrador()])
        );
        prepararContexto(mock);
      });

      it("aprueba un borrador pendiente y lo deja escrito con tu correo", async () => {
        const response = await decidir(
          { accion: "aprobar", borradorId: "b1" },
          fastify
        );

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ id: "o1", estado: "aprobada" });
        expect(mock.growthOportunidad.updateMany).toHaveBeenCalledWith({
          where: { id: "o1", estado: "pendiente_aprobacion" },
          data: { estado: "aprobada" },
        });
        expect(mock.growthBorrador.updateMany).toHaveBeenCalledWith({
          where: expect.objectContaining({
            id: "b1",
            estado: "pendiente_aprobacion",
          }),
          data: { estado: "aprobado" },
        });
        expect(mock.growthDecision.create).toHaveBeenCalledWith({
          data: {
            oportunidadId: "o1",
            borradorId: "b1",
            accion: "aprobar",
            motivo: undefined,
            por: ADMIN,
          },
        });
      });

      it("reevalúa con el contexto de ahora, sin compararse con el propio borrador", async () => {
        await decidir({ accion: "aprobar", borradorId: "b1" }, fastify);
        const consultas = mock.growthBorrador.findMany.mock.calls.map(
          (c) => c[0].where
        );
        expect(consultas).toContainEqual({
          oportunidadId: "o1",
          id: { not: "b1" },
        });
        expect(mock.growthAfirmacion.findMany).toHaveBeenCalled();
      });

      it("no aprueba una oportunidad que no ha pasado por la revisión", async () => {
        mock.growthOportunidad.findUnique.mockResolvedValue(
          oportunidad("detectada")
        );
        const response = await decidir(
          { accion: "aprobar", borradorId: "b1" },
          fastify
        );
        expect(response.statusCode).toBe(409);
        expect(mock.growthDecision.create).not.toHaveBeenCalled();
      });

      it("un borrador que no existe en esa oportunidad da 409", async () => {
        const response = await decidir(
          { accion: "aprobar", borradorId: "de-otra-oportunidad" },
          fastify
        );
        expect(response.statusCode).toBe(409);
        expect(mock.growthOportunidad.updateMany).not.toHaveBeenCalled();
      });

      describe("un bloqueado nunca se aprueba", () => {
        it("no aprueba un borrador en estado bloqueado", async () => {
          mock.growthOportunidad.findUnique.mockResolvedValue(
            oportunidad("pendiente_aprobacion", [
              borrador({ estado: "bloqueado" }),
            ])
          );
          const response = await decidir(
            { accion: "aprobar", borradorId: "b1" },
            fastify
          );
          expect(response.statusCode).toBe(409);
          expect(mock.growthBorrador.updateMany).not.toHaveBeenCalled();
          expect(mock.growthBorrador.update).not.toHaveBeenCalled();
        });

        it("ni aunque el estado diga pendiente si su última revisión de las reglas bloquea", async () => {
          mock.growthOportunidad.findUnique.mockResolvedValue(
            oportunidad("pendiente_aprobacion", [
              borrador({
                revisiones: [
                  revision("bloquea", {
                    comprobaciones: [
                      {
                        regla: "afirmaciones_vigentes",
                        ok: false,
                        dura: true,
                        detalle: "x",
                      },
                    ],
                  }),
                ],
              }),
            ])
          );
          const response = await decidir(
            { accion: "aprobar", borradorId: "b1" },
            fastify
          );
          expect(response.statusCode).toBe(409);
          expect(response.json().codigo).toBe("cumplimiento");
          expect(response.json().comprobaciones).toHaveLength(1);
          expect(mock.growthOportunidad.updateMany).not.toHaveBeenCalled();
          expect(mock.growthBorrador.updateMany).not.toHaveBeenCalled();
        });

        it("no se aprueba una versión que ya no es la última", async () => {
          mock.growthOportunidad.findUnique.mockResolvedValue(
            oportunidad("pendiente_aprobacion", [
              borrador({ id: "b1", version: 1 }),
              borrador({ id: "b2", version: 2, estado: "bloqueado" }),
            ])
          );
          const response = await decidir(
            { accion: "aprobar", borradorId: "b1" },
            fastify
          );
          expect(response.statusCode).toBe(409);
          expect(mock.growthBorrador.updateMany).not.toHaveBeenCalled();
        });

        it("una oportunidad bloqueada no se aprueba, ni siquiera con un borrador pendiente", async () => {
          mock.growthOportunidad.findUnique.mockResolvedValue(
            oportunidad("bloqueada", [borrador()])
          );
          const response = await decidir(
            { accion: "aprobar", borradorId: "b1" },
            fastify
          );
          expect(response.statusCode).toBe(409);
          expect(mock.growthBorrador.updateMany).not.toHaveBeenCalled();
        });

        it("en ningún caso se escribe `aprobado` ni `aprobada` tras un 409", async () => {
          mock.growthAfirmacion.findMany.mockResolvedValue([]);
          const response = await decidir(
            { accion: "aprobar", borradorId: "b1" },
            fastify
          );
          expect(response.statusCode).toBe(409);
          const escrituras = JSON.stringify([
            ...mock.growthBorrador.updateMany.mock.calls,
            ...mock.growthBorrador.update.mock.calls,
            ...mock.growthOportunidad.updateMany.mock.calls,
          ]);
          expect(escrituras).not.toContain('"aprobado"');
          expect(escrituras).not.toContain('"aprobada"');
        });
      });

      describe("aprobar reevalúa las reglas", () => {
        it("una afirmación que se cerró después de redactar bloquea el borrador y se persiste el bloqueo", async () => {
          prepararContexto(mock, { afirmaciones: [] });
          const response = await decidir(
            { accion: "aprobar", borradorId: "b1" },
            fastify
          );

          expect(response.statusCode).toBe(409);
          const cuerpo = response.json();
          expect(cuerpo.codigo).toBe("cumplimiento");
          expect(
            cuerpo.comprobaciones.find(
              (c: { regla: string }) => c.regla === "afirmaciones_vigentes"
            )
          ).toMatchObject({ ok: false, dura: true });

          // El 409 se responde DESPUÉS de guardar el bloqueo (no lo deshace).
          expect(mock.growthOportunidad.updateMany).toHaveBeenCalledWith({
            where: { id: "o1", estado: "pendiente_aprobacion" },
            data: { estado: "bloqueada" },
          });
          expect(mock.growthBorrador.update).toHaveBeenCalledWith({
            where: { id: "b1" },
            data: { estado: "bloqueado" },
          });
          const nueva =
            mock.growthRevisionCumplimiento.create.mock.calls[0]![0].data;
          expect(nueva).toMatchObject({
            borradorId: "b1",
            resultado: "bloquea",
            revisor: "reglas",
          });
          expect(
            mock.growthDecision.create.mock.calls[0]![0].data
          ).toMatchObject({
            accion: "bloquear_por_reglas",
            por: "sistema",
            oportunidadId: "o1",
            borradorId: "b1",
          });
        });

        it("un término que se prohibió después también bloquea", async () => {
          mock.growthOportunidad.findUnique.mockResolvedValue(
            oportunidad("pendiente_aprobacion", [
              borrador({ texto: `${TEXTO_DE_BORRADOR} Usamos Telnyx.` }),
            ])
          );
          const response = await decidir(
            { accion: "aprobar", borradorId: "b1" },
            fastify
          );
          expect(response.statusCode).toBe(409);
          expect(response.json().codigo).toBe("cumplimiento");
        });

        it("un competidor añadido después, nombrado sin dato comparativo, bloquea", async () => {
          prepararContexto(mock, {
            competidores: [{ nombre: "Alhabla Rival", dominio: "rival.ai" }],
          });
          mock.growthOportunidad.findUnique.mockResolvedValue(
            oportunidad("pendiente_aprobacion", [
              borrador({
                texto: `${TEXTO_DE_BORRADOR} Somos mejores que Alhabla Rival.`,
              }),
            ])
          );
          const response = await decidir(
            { accion: "aprobar", borradorId: "b1" },
            fastify
          );
          expect(response.json().codigo).toBe("cumplimiento");
        });

        it("una gestión reciente con el mismo dominio NO bloquea el texto: tiene su 409 y el borrador sigue pendiente", async () => {
          prepararContexto(mock, { gestionesDelDominio: [hace(10)] });
          const response = await decidir(
            { accion: "aprobar", borradorId: "b1" },
            fastify
          );
          expect(response.statusCode).toBe(409);
          expect(response.json().codigo).toBe("dominio_en_enfriamiento");
          // Ni el borrador ni la oportunidad se bloquean 90 días por esto.
          expect(mock.growthBorrador.update).not.toHaveBeenCalled();
          expect(mock.growthBorrador.updateMany).not.toHaveBeenCalled();
          expect(mock.growthOportunidad.updateMany).not.toHaveBeenCalled();
          expect(mock.growthRevisionCumplimiento.create).not.toHaveBeenCalled();
          expect(mock.growthDecision.create).not.toHaveBeenCalled();
        });

        it("el parecido con una versión anterior de la misma oportunidad no impide aprobar", async () => {
          prepararContexto(mock, { textosDeLaMisma: [TEXTO_DE_BORRADOR] });
          const response = await decidir(
            { accion: "aprobar", borradorId: "b1" },
            fastify
          );
          expect(response.statusCode).toBe(200);
        });

        it("si tope y texto fallan a la vez, manda el texto (se bloquea)", async () => {
          prepararContexto(mock, { afirmaciones: [], hechasEstaSemana: 9 });
          const response = await decidir(
            { accion: "aprobar", borradorId: "b1" },
            fastify
          );
          expect(response.json().codigo).toBe("cumplimiento");
        });
      });

      describe("restricciones de agenda: su propio 409 y el borrador no se toca", () => {
        function sinEfectos() {
          expect(mock.growthOportunidad.updateMany).not.toHaveBeenCalled();
          expect(mock.growthBorrador.updateMany).not.toHaveBeenCalled();
          expect(mock.growthBorrador.update).not.toHaveBeenCalled();
          expect(mock.growthRevisionCumplimiento.create).not.toHaveBeenCalled();
          expect(mock.growthDecision.create).not.toHaveBeenCalled();
        }

        it("tope semanal: lo hecho más lo aprobado sin gestionar", async () => {
          prepararContexto(mock, {
            hechasEstaSemana: 3,
            aprobadasSinGestionar: 2,
          });
          const response = await decidir(
            { accion: "aprobar", borradorId: "b1" },
            fastify
          );
          expect(response.statusCode).toBe(409);
          expect(response.json().codigo).toBe("tope_semanal");
          sinEfectos();
        });

        it("tope semanal: solo con aprobadas sin gestionar (nada hecho aún)", async () => {
          prepararContexto(mock, { aprobadasSinGestionar: 5 });
          const response = await decidir(
            { accion: "aprobar", borradorId: "b1" },
            fastify
          );
          expect(response.json().codigo).toBe("tope_semanal");
          sinEfectos();
        });

        it("tope semanal: solo con gestiones hechas, el texto no se bloquea", async () => {
          prepararContexto(mock, { hechasEstaSemana: 5 });
          const response = await decidir(
            { accion: "aprobar", borradorId: "b1" },
            fastify
          );
          expect(response.json().codigo).toBe("tope_semanal");
          sinEfectos();
        });

        it("uno por debajo del tope sí se aprueba", async () => {
          prepararContexto(mock, {
            hechasEstaSemana: 2,
            aprobadasSinGestionar: 2,
          });
          const response = await decidir(
            { accion: "aprobar", borradorId: "b1" },
            fastify
          );
          expect(response.statusCode).toBe(200);
        });

        it("el tope sale de los ajustes", async () => {
          prepararContexto(mock, {
            hechasEstaSemana: 1,
            ajustes: [{ clave: "topeSemanal", valor: 1 }],
          });
          const response = await decidir(
            { accion: "aprobar", borradorId: "b1" },
            fastify
          );
          expect(response.json().codigo).toBe("tope_semanal");
        });

        it("dominio en enfriamiento: dice hasta cuándo y no toca nada", async () => {
          const ultima = hace(10);
          prepararContexto(mock, { gestionesDelDominio: [hace(40), ultima] });
          const response = await decidir(
            { accion: "aprobar", borradorId: "b1" },
            fastify
          );
          expect(response.statusCode).toBe(409);
          const cuerpo = response.json();
          expect(cuerpo.codigo).toBe("dominio_en_enfriamiento");
          expect(cuerpo.error).toContain("hasta el");
          // 90 días desde la ÚLTIMA gestión, no desde la primera.
          expect(cuerpo.hasta).toBe(
            new Date(ultima.getTime() + 90 * DIA).toISOString()
          );
          sinEfectos();
        });

        it("si el texto falla y la agenda también, manda el texto (se bloquea y se persiste)", async () => {
          prepararContexto(mock, {
            afirmaciones: [],
            gestionesDelDominio: [hace(10)],
            hechasEstaSemana: 9,
          });
          const response = await decidir(
            { accion: "aprobar", borradorId: "b1" },
            fastify
          );
          expect(response.json().codigo).toBe("cumplimiento");
          expect(mock.growthBorrador.update).toHaveBeenCalledWith({
            where: { id: "b1" },
            data: { estado: "bloqueado" },
          });
          // La decisión que se anota nombra solo las reglas del texto.
          const motivo = mock.growthDecision.create.mock.calls[0]![0].data
            .motivo as string;
          expect(motivo).toContain("afirmaciones_vigentes");
          expect(motivo).not.toContain("un_contacto_por_dominio");
          expect(motivo).not.toContain("tope_semanal");
          // La revisión guardada anota la agenda como aviso, no como bloqueo.
          const guardadas = mock.growthRevisionCumplimiento.create.mock
            .calls[0]![0].data.comprobaciones as {
            regla: string;
            dura: boolean;
            ok: boolean;
          }[];
          for (const regla of ["un_contacto_por_dominio", "tope_semanal"]) {
            expect(guardadas.find((c) => c.regla === regla)).toMatchObject({
              ok: false,
              dura: false,
            });
          }
        });

        it("otra oportunidad del mismo dominio ya aprobada: dominio_ya_aprobado", async () => {
          prepararContexto(mock, { aprobadasDelDominio: 1 });
          const response = await decidir(
            { accion: "aprobar", borradorId: "b1" },
            fastify
          );
          expect(response.statusCode).toBe(409);
          expect(response.json().codigo).toBe("dominio_ya_aprobado");
          sinEfectos();
        });

        it("caducada: con la fecha de expiración vencida no se aprueba (ni se evalúa)", async () => {
          mock.growthOportunidad.findUnique.mockResolvedValue(
            oportunidad("pendiente_aprobacion", [borrador()], {
              expiraEn: hace(1),
            })
          );
          mock.growthAfirmacion.findMany.mockClear();
          const response = await decidir(
            { accion: "aprobar", borradorId: "b1" },
            fastify
          );
          expect(response.statusCode).toBe(409);
          expect(response.json().codigo).toBe("caducada");
          expect(mock.growthAfirmacion.findMany).not.toHaveBeenCalled();
          sinEfectos();
        });

        it("con la expiración por venir sí se aprueba", async () => {
          mock.growthOportunidad.findUnique.mockResolvedValue(
            oportunidad("pendiente_aprobacion", [borrador()], {
              expiraEn: dentroDe(5),
            })
          );
          const response = await decidir(
            { accion: "aprobar", borradorId: "b1" },
            fastify
          );
          expect(response.statusCode).toBe(200);
        });
      });

      describe("cerrojos (orden de bloqueo)", () => {
        const claves = () =>
          mock.$executeRaw.mock.calls.map((c) => ({
            sql: (c[0] as unknown as string[]).join("?"),
            clave: c[1] as string,
          }));

        it("aprobar toma growth_aprobar (exclusivo) y luego growth_conocimiento (compartido), antes de leer nada", async () => {
          const response = await decidir(
            { accion: "aprobar", borradorId: "b1" },
            fastify
          );
          expect(response.statusCode).toBe(200);
          const tomados = claves();
          expect(tomados).toHaveLength(2);
          expect(tomados[0]).toEqual({
            sql: "SELECT pg_advisory_xact_lock(hashtext(?))",
            clave: "growth_aprobar",
          });
          expect(tomados[1]).toEqual({
            sql: "SELECT pg_advisory_xact_lock_shared(hashtext(?))",
            clave: "growth_conocimiento",
          });
          // Antes de leer la oportunidad: lo que se lee después ya incluye lo
          // que acaba de confirmar quien tenía el cerrojo.
          const [ultimoCerrojo] =
            mock.$executeRaw.mock.invocationCallOrder.slice(-1);
          const [lectura] =
            mock.growthOportunidad.findUnique.mock.invocationCallOrder;
          expect(ultimoCerrojo).toBeLessThan(lectura!);
        });

        it("el 409 de la agenda también ocurre con los cerrojos tomados", async () => {
          prepararContexto(mock, { aprobadasDelDominio: 1 });
          await decidir({ accion: "aprobar", borradorId: "b1" }, fastify);
          expect(claves().map((c) => c.clave)).toEqual([
            "growth_aprobar",
            "growth_conocimiento",
          ]);
        });
      });

      describe("concurrencia", () => {
        it("si alguien cambió la oportunidad entre medias, 409 y no se aprueba el borrador", async () => {
          mock.growthOportunidad.updateMany.mockResolvedValue({ count: 0 });
          const response = await decidir(
            { accion: "aprobar", borradorId: "b1" },
            fastify
          );
          expect(response.statusCode).toBe(409);
          expect(response.json().codigo).toBe("conflicto");
          expect(mock.growthBorrador.updateMany).not.toHaveBeenCalled();
          expect(mock.growthDecision.create).not.toHaveBeenCalled();
        });

        it("si editaron el borrador mientras lo aprobabas (cambió el texto), 409", async () => {
          mock.growthBorrador.updateMany.mockResolvedValue({ count: 0 });
          const response = await decidir(
            { accion: "aprobar", borradorId: "b1" },
            fastify
          );
          expect(response.statusCode).toBe(409);
          expect(response.json().codigo).toBe("conflicto");
          expect(mock.growthDecision.create).not.toHaveBeenCalled();
          // Se aprueba solo lo que se evaluó: el texto va en la condición.
          expect(
            mock.growthBorrador.updateMany.mock.calls[0]![0].where
          ).toMatchObject({ texto: TEXTO_DE_BORRADOR });
        });
      });
    });

    it("devolver y descartar exigen un motivo", async () => {
      for (const accion of ["devolver", "descartar"]) {
        const response = await decidir({ accion }, fastify);
        expect(response.statusCode).toBe(400);
      }
    });

    it("devolver deja el motivo como nota y cierra los borradores abiertos", async () => {
      mock.growthOportunidad.findUnique.mockResolvedValue(
        oportunidad("pendiente_aprobacion", [borrador()])
      );
      const response = await decidir(
        { accion: "devolver", motivo: "Más corto y sin el segundo párrafo" },
        fastify
      );
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ id: "o1", estado: "devuelta" });
      expect(mock.growthBorrador.updateMany.mock.calls[0]![0].data).toEqual({
        estado: "descartado",
      });
      expect(mock.growthDecision.create.mock.calls[0]![0].data).toMatchObject({
        accion: "devolver",
        motivo: "Más corto y sin el segundo párrafo",
        por: ADMIN,
      });
    });

    it("descartar guarda el motivo y el código, y cierra los borradores abiertos", async () => {
      mock.growthOportunidad.findUnique.mockResolvedValue(
        oportunidad("pendiente_aprobacion", [], { datos: { nota: "n" } })
      );
      const response = await decidir(
        {
          accion: "descartar",
          motivo: "Es de un competidor",
          codigo: "competidor",
        },
        fastify
      );
      expect(response.statusCode).toBe(200);
      expect(mock.growthOportunidad.updateMany).toHaveBeenCalledWith({
        where: { id: "o1", estado: "pendiente_aprobacion" },
        data: {
          estado: "descartada",
          motivoDescarte: "Es de un competidor",
          datos: { nota: "n", codigoDescarte: "competidor" },
        },
      });
      expect(mock.growthBorrador.updateMany).toHaveBeenCalled();
    });

    it("descartar sin código guarda `otro`", async () => {
      mock.growthOportunidad.findUnique.mockResolvedValue(
        oportunidad("pendiente_aprobacion")
      );
      await decidir({ accion: "descartar", motivo: "No encaja" }, fastify);
      expect(
        mock.growthOportunidad.updateMany.mock.calls[0]![0].data.datos
      ).toEqual({ codigoDescarte: "otro" });
    });

    describe("marcar como gestionado", () => {
      const gestionable = () =>
        oportunidad("aprobada", [borrador({ estado: "aprobado" })]);

      beforeEach(() => {
        mock.growthOportunidad.findUnique.mockResolvedValue(gestionable());
      });

      it("toma los dos cerrojos, antes de leer", async () => {
        await decidir({ accion: "marcar_gestionado", canal: "email" }, fastify);
        expect(mock.$executeRaw.mock.calls.map((c) => c[1] as string)).toEqual([
          "growth_aprobar",
          "growth_conocimiento",
        ]);
        expect(mock.$executeRaw.mock.invocationCallOrder.at(-1)!).toBeLessThan(
          mock.growthOportunidad.findUnique.mock.invocationCallOrder[0]!
        );
      });

      it("devolver y descartar toman los mismos cerrojos (también escriben borrador y oportunidad); conseguido y sin respuesta, ninguno", async () => {
        mock.growthOportunidad.findUnique.mockResolvedValue(
          oportunidad("pendiente_aprobacion", [borrador()])
        );
        await decidir({ accion: "devolver", motivo: "más corto" }, fastify);
        expect(mock.$executeRaw.mock.calls.map((c) => c[1] as string)).toEqual([
          "growth_aprobar",
          "growth_conocimiento",
        ]);

        mock.$executeRaw.mockClear();
        await decidir({ accion: "descartar", motivo: "no encaja" }, fastify);
        expect(mock.$executeRaw.mock.calls.map((c) => c[1] as string)).toEqual([
          "growth_aprobar",
          "growth_conocimiento",
        ]);

        mock.$executeRaw.mockClear();
        mock.growthOportunidad.findUnique.mockResolvedValue(
          oportunidad("gestionada", [
            borrador({ estado: "gestionado", gestion: { id: "g1" } }),
          ])
        );
        await decidir({ accion: "sin_respuesta" }, fastify);
        expect(mock.$executeRaw).not.toHaveBeenCalled();
      });

      it("registra la gestión con el dominio de la oportunidad", async () => {
        const response = await decidir(
          { accion: "marcar_gestionado", canal: "email" },
          fastify
        );
        expect(response.statusCode).toBe(200);
        expect(response.json().estado).toBe("gestionada");
        const gestion = mock.growthGestion.create.mock.calls[0]![0].data;
        expect(gestion).toMatchObject({
          borradorId: "b1",
          canal: "email",
          dominio: "ejemplo.com",
        });
        expect(gestion.hechaEn).toBeInstanceOf(Date);
        expect(mock.growthBorrador.update).toHaveBeenCalledWith({
          where: { id: "b1" },
          data: { estado: "gestionado" },
        });
      });

      it("guarda lo que de verdad se envió si no fue el texto aprobado", async () => {
        await decidir(
          {
            accion: "marcar_gestionado",
            canal: "formulario",
            textoFinal:
              "Hola, escribo por el formulario. Soy el fundador de Alhabla.",
          },
          fastify
        );
        expect(mock.growthBorrador.update).toHaveBeenCalledWith({
          where: { id: "b1" },
          data: {
            estado: "gestionado",
            textoFinal:
              "Hola, escribo por el formulario. Soy el fundador de Alhabla.",
            editadoPorHumano: true,
          },
        });
      });

      it("si el texto enviado es el aprobado no lo duplica", async () => {
        await decidir(
          {
            accion: "marcar_gestionado",
            canal: "email",
            textoFinal: `  ${TEXTO_DE_BORRADOR}  `,
          },
          fastify
        );
        expect(mock.growthBorrador.update).toHaveBeenCalledWith({
          where: { id: "b1" },
          data: { estado: "gestionado" },
        });
      });

      it("un doble toque: el segundo ve la oportunidad ya cambiada y da 409, no 500", async () => {
        const primera = await decidir(
          { accion: "marcar_gestionado", canal: "email" },
          fastify
        );
        expect(primera.statusCode).toBe(200);

        // La segunda petición leyó la oportunidad antes de que la primera
        // confirmara, pero su cambio condicional ya no encuentra «aprobada».
        mock.growthOportunidad.updateMany.mockResolvedValue({ count: 0 });
        mock.growthGestion.create.mockClear();
        const segunda = await decidir(
          { accion: "marcar_gestionado", canal: "email" },
          fastify
        );
        expect(segunda.statusCode).toBe(409);
        expect(mock.growthGestion.create).not.toHaveBeenCalled();
      });

      it("si ambas llegan a crear la gestión, el índice único (P2002) da 409, no 500", async () => {
        mock.growthGestion.create.mockRejectedValue({ code: "P2002" });
        const response = await decidir(
          { accion: "marcar_gestionado", canal: "email" },
          fastify
        );
        expect(response.statusCode).toBe(409);
        expect(response.json().codigo).toBe("conflicto");
        expect(mock.growthDecision.create).not.toHaveBeenCalled();
      });

      it("el segundo toque, ya con la oportunidad leída como gestionada, da 409", async () => {
        mock.growthOportunidad.findUnique.mockResolvedValue(
          oportunidad("gestionada", [
            borrador({ estado: "gestionado", gestion: { id: "g1" } }),
          ])
        );
        const response = await decidir(
          { accion: "marcar_gestionado", canal: "email" },
          fastify
        );
        expect(response.statusCode).toBe(409);
        expect(mock.growthGestion.create).not.toHaveBeenCalled();
      });

      it("sin borrador aprobado no hay nada que marcar como gestionado", async () => {
        mock.growthOportunidad.findUnique.mockResolvedValue(
          oportunidad("aprobada", [])
        );
        const response = await decidir(
          { accion: "marcar_gestionado", canal: "email" },
          fastify
        );
        expect(response.statusCode).toBe(409);
      });

      it("una fecha de hace 40 días o futura se rechaza (saltaría la regla de los 90 días)", async () => {
        for (const hechaEn of [hace(40), dentroDe(2)]) {
          const response = await decidir(
            { accion: "marcar_gestionado", canal: "email", hechaEn },
            fastify
          );
          expect(response.statusCode).toBe(400);
        }
        expect(mock.growthGestion.create).not.toHaveBeenCalled();
      });

      it("acepta la fecha en que de verdad se hizo", async () => {
        const hechaEn = hace(3);
        await decidir(
          { accion: "marcar_gestionado", canal: "email", hechaEn },
          fastify
        );
        expect(
          mock.growthGestion.create.mock.calls[0]![0].data.hechaEn
        ).toEqual(hechaEn);
      });
    });

    describe("el resultado de lo gestionado", () => {
      beforeEach(() => {
        mock.growthOportunidad.findUnique.mockResolvedValue(
          oportunidad("gestionada", [
            borrador({ estado: "gestionado", gestion: { id: "g1" } }),
          ])
        );
      });

      it("el enlace conseguido guarda su URL en la gestión", async () => {
        const response = await decidir(
          {
            accion: "conseguido",
            urlConseguida: "https://ejemplo.com/listado",
          },
          fastify
        );
        expect(response.statusCode).toBe(200);
        expect(response.json().estado).toBe("conseguida");
        expect(mock.growthGestion.update).toHaveBeenCalledWith({
          where: { id: "g1" },
          data: expect.objectContaining({
            resultado: "aceptado",
            urlConseguida: "https://ejemplo.com/listado",
          }),
        });
      });

      it("una URL conseguida javascript: no se guarda", async () => {
        const response = await decidir(
          { accion: "conseguido", urlConseguida: "javascript:alert(1)" },
          fastify
        );
        expect(response.statusCode).toBe(400);
        expect(mock.growthGestion.update).not.toHaveBeenCalled();
      });

      it("sin respuesta cierra la gestión sin éxito", async () => {
        const response = await decidir(
          { accion: "sin_respuesta", notas: "Dos semanas sin contestar" },
          fastify
        );
        expect(response.json().estado).toBe("sin_respuesta");
        expect(mock.growthGestion.update).toHaveBeenCalledWith({
          where: { id: "g1" },
          data: {
            resultado: "sin_respuesta",
            notas: "Dos semanas sin contestar",
          },
        });
      });

      it("que el destino diga que no: la gestión queda `rechazado` y la oportunidad se cierra sin éxito", async () => {
        const response = await decidir(
          { accion: "rechazado", notas: "Dicen que no publican enlaces" },
          fastify
        );
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ id: "o1", estado: "sin_respuesta" });
        const datos = mock.growthGestion.update.mock.calls[0]![0].data;
        expect(datos).toMatchObject({
          resultado: "rechazado",
          notas: "Dicen que no publican enlaces",
        });
        expect(datos.respuestaEn).toBeInstanceOf(Date);
        expect(mock.growthDecision.create.mock.calls[0]![0].data).toMatchObject(
          {
            accion: "rechazado",
            borradorId: "b1",
            por: ADMIN,
          }
        );
      });

      it("las notas de lo que pasó después se suman a las de marcar gestionado, no las pisan", async () => {
        mock.growthOportunidad.findUnique.mockResolvedValue(
          oportunidad("gestionada", [
            borrador({
              estado: "gestionado",
              gestion: { id: "g1", notas: "Enviado por su formulario" },
            }),
          ])
        );
        await decidir(
          { accion: "rechazado", notas: "Dicen que no publican enlaces" },
          fastify
        );
        expect(mock.growthGestion.update.mock.calls[0]![0].data.notas).toBe(
          "Enviado por su formulario\nDicen que no publican enlaces"
        );
      });

      it("sin nota nueva no se toca la que ya había", async () => {
        mock.growthOportunidad.findUnique.mockResolvedValue(
          oportunidad("gestionada", [
            borrador({
              estado: "gestionado",
              gestion: { id: "g1", notas: "Enviado por su formulario" },
            }),
          ])
        );
        await decidir({ accion: "sin_respuesta" }, fastify);
        expect(
          mock.growthGestion.update.mock.calls[0]![0].data.notas
        ).toBeUndefined();
      });

      it("conseguido, sin respuesta y rechazado solo valen sobre lo gestionado", async () => {
        mock.growthOportunidad.findUnique.mockResolvedValue(
          oportunidad("aprobada", [borrador({ estado: "aprobado" })])
        );
        for (const cuerpo of [
          { accion: "conseguido", urlConseguida: "https://ejemplo.com/x" },
          { accion: "sin_respuesta" },
          { accion: "rechazado" },
        ]) {
          expect((await decidir(cuerpo, fastify)).statusCode).toBe(409);
        }
      });

      it("sin una gestión registrada no hay nada que cerrar", async () => {
        mock.growthOportunidad.findUnique.mockResolvedValue(
          oportunidad("gestionada", [])
        );
        const response = await decidir({ accion: "rechazado" }, fastify);
        expect(response.statusCode).toBe(409);
      });
    });

    it("una oportunidad inexistente da 404", async () => {
      mock.growthOportunidad.findUnique.mockResolvedValue(null);
      const response = await decidir({ accion: "sin_respuesta" }, fastify);
      expect(response.statusCode).toBe(404);
    });

    it("una acción desconocida da 400", async () => {
      const response = await decidir({ accion: "borrar_todo" }, fastify);
      expect(response.statusCode).toBe(400);
    });

    it("cada decisión deja una fila con el correo de quien la tomó", async () => {
      mock.growthOportunidad.findUnique.mockResolvedValue(
        oportunidad("pendiente_aprobacion")
      );
      await decidir({ accion: "descartar", motivo: "x" }, fastify);
      expect(mock.growthDecision.create).toHaveBeenCalledTimes(1);
      expect(mock.growthDecision.create.mock.calls[0]![0].data.por).toBe(ADMIN);
    });
  });

  // ── listado ────────────────────────────────────────────────────────────

  describe("listado", () => {
    function fila(id: string, cambios: Record<string, unknown> = {}) {
      return {
        id,
        url: `https://${id}.com/p`,
        dominio: `${id}.com`,
        titulo: `Título ${id}`,
        extracto: "Un extracto",
        retencionHasta: dentroDe(100),
        idioma: "es",
        objetivoPrincipal: "BACKLINKS",
        estado: "calificada",
        puntTrafico: 10,
        puntLeads: 30,
        puntBacklinks: 70,
        motivoDescarte: null,
        datos: { tipoDestino: "prensa", codigoDescarte: "otro", nota: "n" },
        detectadaEn: hace(1),
        expiraEn: dentroDe(10),
        ejecucionId: null,
        fuente: { id: "fuente_web", tipo: "web", nombre: "Web" },
        nicho: null,
        borradores: [],
        ...cambios,
      };
    }

    function listar(consulta = "") {
      return fastify.inject({
        method: "GET",
        url: `/growth/admin/oportunidades${consulta}`,
        headers: comoAdmin(),
      });
    }

    beforeEach(() => {
      mock.growthOportunidad.findMany.mockResolvedValue([fila("a")]);
      mock.growthOportunidad.count.mockResolvedValue(1);
      mock.growthOportunidad.groupBy.mockResolvedValue([
        { estado: "calificada", _count: { _all: 4 } },
        { estado: "bloqueada", _count: { _all: 1 } },
      ]);
    });

    it("devuelve página con total y los conteos por estado de todos los estados", async () => {
      const response = await listar();
      expect(response.statusCode).toBe(200);
      const cuerpo = response.json();
      expect(cuerpo).toMatchObject({ total: 1, pagina: 1, limite: 50 });
      expect(cuerpo.data).toHaveLength(1);
      expect(cuerpo.conteos.porEstado.calificada).toBe(4);
      expect(cuerpo.conteos.porEstado.bloqueada).toBe(1);
      expect(cuerpo.conteos.porEstado.aprobada).toBe(0);
      expect(Object.keys(cuerpo.conteos.porEstado)).toHaveLength(13);
    });

    it("la puntuación es la del objetivo principal, no la mayor de las tres", async () => {
      mock.growthOportunidad.findMany.mockResolvedValue([
        fila("a", { objetivoPrincipal: "LEADS" }),
      ]);
      const [o] = (await listar()).json().data;
      expect(o.puntuacion).toBe(30);
      expect(o.puntuaciones).toEqual({
        TRAFICO_MARCA: 10,
        LEADS: 30,
        BACKLINKS: 70,
      });
    });

    it("saca el código de descarte de `datos` a primer nivel y no lo repite dentro", async () => {
      const [o] = (await listar()).json().data;
      expect(o.codigoDescarte).toBe("otro");
      expect(o.datos).toEqual({ tipoDestino: "prensa", nota: "n" });
    });

    it("avisa de un extracto purgado y cuenta los días para caducar", async () => {
      mock.growthOportunidad.findMany.mockResolvedValue([
        fila("a", { extracto: "", retencionHasta: hace(1) }),
        fila("b", { extracto: "", retencionHasta: dentroDe(1) }),
      ]);
      const { data } = (await listar()).json();
      expect(data[0].extractoPurgado).toBe(true);
      expect(data[1].extractoPurgado).toBe(false);
      expect(data[0].diasParaCaducar).toBe(10);
    });

    it("el borrador actual lleva el resultado y las reglas que fallan de la última revisión", async () => {
      mock.growthOportunidad.findMany.mockResolvedValue([
        fila("a", {
          estado: "bloqueada",
          borradores: [
            {
              id: "b2",
              version: 2,
              tipo: "email",
              estado: "bloqueado",
              editadoPorHumano: false,
              revisiones: [
                {
                  resultado: "bloquea",
                  comprobaciones: [
                    {
                      regla: "tope_semanal",
                      ok: false,
                      dura: true,
                      detalle: "x",
                    },
                    {
                      regla: "identificacion",
                      ok: true,
                      dura: true,
                      detalle: "y",
                    },
                  ],
                },
              ],
            },
          ],
        }),
      ]);
      const [o] = (await listar()).json().data;
      expect(o.borradorActual).toMatchObject({
        id: "b2",
        version: 2,
        estado: "bloqueado",
        resultado: "bloquea",
      });
      expect(o.borradorActual.reglasFallidas).toEqual([
        { regla: "tope_semanal", ok: false, dura: true, detalle: "x" },
      ]);
      // Solo las revisiones de las reglas: las del modelo son consultivas.
      const include = mock.growthOportunidad.findMany.mock.calls[0]![0].include;
      expect(include.borradores.include.revisiones.where).toEqual({
        revisor: "reglas",
      });
    });

    it("sin borradores el borrador actual es null", async () => {
      expect((await listar()).json().data[0].borradorActual).toBeNull();
    });

    it("pagina con skip y take", async () => {
      await listar("?pagina=3&limite=20");
      const llamada = mock.growthOportunidad.findMany.mock.calls[0]![0];
      expect(llamada.skip).toBe(40);
      expect(llamada.take).toBe(20);
      expect(llamada.orderBy).toEqual([
        { detectadaEn: "desc" },
        { id: "desc" },
      ]);
    });

    it("filtra por estado (lista), objetivo, nicho, fuente, dominio y texto", async () => {
      await listar(
        "?estado=calificada,bloqueada&objetivo=BACKLINKS&nicho=peluqueria&fuente=manual&tipoDestino=prensa&dominio=WWW.Ejemplo.com&q=recepcion&ejecucionId=e1"
      );
      const { where } = mock.growthOportunidad.findMany.mock.calls[0]![0];
      expect(where).toMatchObject({
        estado: { in: ["calificada", "bloqueada"] },
        objetivoPrincipal: "BACKLINKS",
        nicho: { slug: "peluqueria" },
        fuente: { tipo: "manual" },
        datos: { path: ["tipoDestino"], equals: "prensa" },
        dominio: "ejemplo.com",
        ejecucionId: "e1",
      });
      expect(where.OR).toHaveLength(3);
    });

    it("los conteos de las pestañas usan los mismos filtros SALVO el de estado", async () => {
      await listar("?estado=bloqueada&objetivo=LEADS");
      const donde = mock.growthOportunidad.groupBy.mock.calls[0]![0].where;
      expect(donde).toEqual({ objetivoPrincipal: "LEADS" });
      expect(donde).not.toHaveProperty("estado");
    });

    it("orden `caducan`: por fecha de caducidad y los nulos al final", async () => {
      await listar("?orden=caducan");
      expect(
        mock.growthOportunidad.findMany.mock.calls[0]![0].orderBy[0]
      ).toEqual({
        expiraEn: { sort: "asc", nulls: "last" },
      });
    });

    describe("orden por puntuación (el de la Bandeja)", () => {
      beforeEach(() => {
        mock.growthOportunidad.findMany.mockImplementation(
          async (args: {
            select?: unknown;
            where: { id?: { in: string[] } };
          }) => {
            const filas = [
              fila("baja", { puntBacklinks: 40 }),
              fila("alta", { puntBacklinks: 95 }),
              fila("media-vieja", { puntBacklinks: 70, detectadaEn: hace(9) }),
              fila("media-nueva", { puntBacklinks: 70, detectadaEn: hace(1) }),
              // La nota alta de otro objetivo no cuenta para su orden.
              fila("otro-objetivo", {
                objetivoPrincipal: "LEADS",
                puntLeads: 20,
                puntBacklinks: 99,
              }),
            ];
            if (args.select) return filas;
            const ids = args.where.id!.in;
            // La base de datos no devuelve en el orden pedido.
            return filas.filter((f) => ids.includes(f.id)).reverse();
          }
        );
      });

      it("ordena por la nota del objetivo principal, luego por detección más reciente", async () => {
        const { data, total } = (await listar("?orden=puntuacion")).json();
        expect(total).toBe(5);
        expect(data.map((o: { id: string }) => o.id)).toEqual([
          "alta",
          "media-nueva",
          "media-vieja",
          "baja",
          "otro-objetivo",
        ]);
      });

      it("pagina sobre ese orden y solo carga completas las filas de la página", async () => {
        const { data } = (
          await listar("?orden=puntuacion&limite=2&pagina=2")
        ).json();
        expect(data.map((o: { id: string }) => o.id)).toEqual([
          "media-vieja",
          "baja",
        ]);
        const completa = mock.growthOportunidad.findMany.mock.calls[1]![0];
        expect(completa.where).toEqual({ id: { in: ["media-vieja", "baja"] } });
      });

      it("con más de 5.000 coincidencias pide afinar el filtro", async () => {
        mock.growthOportunidad.findMany.mockResolvedValue(
          Array.from({ length: 5001 }, (_, i) => fila(`o${i}`))
        );
        const response = await listar("?orden=puntuacion");
        expect(response.statusCode).toBe(400);
        expect(response.json().error).toContain("filtro");
      });
    });

    it("rechaza un estado que no existe, aunque venga en una lista", async () => {
      expect((await listar("?estado=inventado")).statusCode).toBe(400);
      expect((await listar("?estado=aprobada,inventado")).statusCode).toBe(400);
      expect(mock.growthOportunidad.findMany).not.toHaveBeenCalled();
    });

    it("rechaza una página o un límite fuera de rango", async () => {
      for (const q of [
        "?pagina=0",
        "?limite=0",
        "?limite=201",
        "?orden=azar",
      ]) {
        expect((await listar(q)).statusCode).toBe(400);
      }
    });
  });

  // ── detalle ────────────────────────────────────────────────────────────

  describe("detalle", () => {
    function completa(cambios: Record<string, unknown> = {}) {
      return {
        ...oportunidad("pendiente_aprobacion", [
          borrador({
            id: "b2",
            version: 2,
            texto: `${TEXTO_DE_BORRADOR} Con un añadido que cambia un poco el final del mensaje original.`,
            afirmaciones: ["funcion.reserva_en_calendario", "precio.plan.pro"],
            revisiones: [
              revision("pasa", { id: "r2", revisor: "llm" }),
              revision("pasa"),
            ],
          }),
          borrador({ id: "b1", version: 1, estado: "descartado" }),
        ]),
        url: "https://ejemplo.com/p",
        titulo: "T",
        extracto: "",
        retencionHasta: hace(1),
        objetivoPrincipal: "LEADS",
        puntTrafico: 1,
        puntLeads: 2,
        puntBacklinks: 3,
        expiraEn: dentroDe(12),
        fuente: { id: "fuente_web", tipo: "web", nombre: "Web" },
        nicho: null,
        ejecucion: null,
        investigacion: null,
        decisiones: [],
        ...cambios,
      };
    }

    function ver() {
      return fastify.inject({
        method: "GET",
        url: "/growth/admin/oportunidades/o1",
        headers: comoAdmin(),
      });
    }

    beforeEach(() => {
      mock.growthOportunidad.findUnique.mockResolvedValue(completa());
      mock.growthAfirmacion.findMany.mockResolvedValue([
        {
          clave: "funcion.reserva_en_calendario",
          tipo: "funcion",
          texto: "Reserva",
          valor: null,
          fuente: "PRODUCT.md#capacidades",
          commitSha: "abc1234",
          vigenteDesde: hace(30),
          vigenteHasta: null,
        },
      ]);
      mock.growthGestion.count.mockResolvedValue(1);
      mock.growthGestion.findMany.mockResolvedValue([{ hechaEn: hace(10) }]);
      mock.growthOportunidad.count.mockResolvedValue(2);
      mock.growthAjuste.findMany.mockResolvedValue([]);
    });

    describe("acciones: solo las que se pueden alcanzar desde el estado", () => {
      type Accion = { accion: string; habilitada: boolean; motivo?: string };
      const acciones = async () => (await ver()).json().acciones as Accion[];

      it("en pendiente_aprobacion: aprobar, devolver y descartar, y nada más", async () => {
        // Sin dominio en enfriamiento ni otras aprobadas: la agenda no estorba.
        mock.growthGestion.findMany.mockResolvedValue([]);
        mock.growthOportunidad.count.mockResolvedValue(0);
        const cuerpo = (await ver()).json();
        expect(cuerpo).not.toHaveProperty("accionesPosibles");
        expect(cuerpo.acciones).toEqual([
          { accion: "aprobar", habilitada: true },
          { accion: "devolver", habilitada: true },
          { accion: "descartar", habilitada: true },
        ]);
      });

      it("nunca saca una acción inalcanzable ni el texto «no admite esta acción»", async () => {
        const estados = [
          "detectada",
          "calificada",
          "investigada",
          "con_borrador",
          "bloqueada",
          "pendiente_aprobacion",
          "devuelta",
          "aprobada",
          "gestionada",
          "conseguida",
          "sin_respuesta",
          "descartada",
          "caducada",
        ];
        const esperadas: Record<string, string[]> = {
          detectada: ["descartar"],
          calificada: ["descartar"],
          investigada: ["descartar"],
          con_borrador: ["descartar"],
          bloqueada: ["descartar"],
          pendiente_aprobacion: ["aprobar", "devolver", "descartar"],
          devuelta: ["descartar"],
          aprobada: ["descartar", "marcar_gestionado"],
          gestionada: ["conseguido", "sin_respuesta", "rechazado"],
          conseguida: [],
          sin_respuesta: [],
          descartada: [],
          caducada: [],
        };
        for (const estado of estados) {
          mock.growthOportunidad.findUnique.mockResolvedValue(
            completa(oportunidad(estado, [borrador({ estado: "aprobado" })]))
          );
          const lista = await acciones();
          expect(
            lista.map((a) => a.accion),
            estado
          ).toEqual(esperadas[estado]);
          expect(JSON.stringify(lista), estado).not.toContain("no admite");
        }
      });

      it("marcar_gestionado sin borrador aprobado sale deshabilitada con su motivo", async () => {
        mock.growthOportunidad.findUnique.mockResolvedValue(
          completa(
            oportunidad("aprobada", [borrador({ estado: "descartado" })])
          )
        );
        const marcar = (await acciones()).find(
          (a) => a.accion === "marcar_gestionado"
        );
        expect(marcar).toEqual({
          accion: "marcar_gestionado",
          habilitada: false,
          motivo: "No hay ningún borrador aprobado.",
        });
      });

      it("aprobar sale deshabilitada, con motivo, si el dominio está en enfriamiento", async () => {
        // Por defecto el escenario tiene una gestión de hace 10 días.
        const aprobar = (await acciones()).find((a) => a.accion === "aprobar");
        expect(aprobar?.habilitada).toBe(false);
        expect(aprobar?.motivo).toContain("hasta el");
      });

      it("aprobar sale deshabilitada si otra oportunidad del dominio está aprobada o se llegó al tope", async () => {
        mock.growthGestion.findMany.mockResolvedValue([]);
        mock.growthOportunidad.count.mockImplementation(
          async ({ where }: { where: { dominio?: string } }) =>
            where.dominio ? 1 : 0
        );
        expect(
          (await acciones()).find((a) => a.accion === "aprobar")?.motivo
        ).toContain("otra oportunidad aprobada");

        mock.growthOportunidad.count.mockResolvedValue(0);
        mock.growthGestion.count.mockResolvedValue(5);
        expect(
          (await acciones()).find((a) => a.accion === "aprobar")?.motivo
        ).toContain("tope de 5 contactos");
      });
    });

    it("no se puede aprobar si el borrador pendiente está bloqueado por las reglas", async () => {
      mock.growthOportunidad.findUnique.mockResolvedValue(
        completa({
          ...oportunidad("pendiente_aprobacion", [
            borrador({ revisiones: [revision("bloquea")] }),
          ]),
          fuente: { id: "f", tipo: "web", nombre: "W" },
        })
      );
      const por = Object.fromEntries(
        (await ver())
          .json()
          .acciones.map((a: { accion: string }) => [a.accion, a])
      );
      expect(por.aprobar.habilitada).toBe(false);
      expect(por.aprobar.motivo).toContain("bloqueado");
    });

    it("una oportunidad caducada no se aprueba", async () => {
      mock.growthOportunidad.findUnique.mockResolvedValue(
        completa({ expiraEn: hace(1) })
      );
      const aprobar = (await ver())
        .json()
        .acciones.find((a: { accion: string }) => a.accion === "aprobar");
      expect(aprobar).toMatchObject({ habilitada: false });
      expect(aprobar.motivo).toContain("caducado");
    });

    it("en gestionada solo se habilitan conseguido, sin respuesta y rechazado", async () => {
      mock.growthOportunidad.findUnique.mockResolvedValue(
        completa(
          oportunidad("gestionada", [
            borrador({ estado: "gestionado", gestion: { id: "g1" } }),
          ])
        )
      );
      const habilitadas = (await ver())
        .json()
        .acciones.filter((a: { habilitada: boolean }) => a.habilitada)
        .map((a: { accion: string }) => a.accion);
      expect(habilitadas).toEqual(["conseguido", "sin_respuesta", "rechazado"]);
    });

    it("dice qué borrador se puede editar (el último, pendiente o bloqueado)", async () => {
      expect((await ver()).json().borradorEditableId).toBe("b2");

      mock.growthOportunidad.findUnique.mockResolvedValue(
        completa(oportunidad("aprobada", [borrador({ estado: "aprobado" })]))
      );
      expect((await ver()).json().borradorEditableId).toBeNull();
    });

    it("cada borrador trae las afirmaciones con su fuente, y las que no existen salen con existe:false", async () => {
      const [b2] = (await ver()).json().borradores;
      expect(b2.afirmacionesDetalle).toEqual([
        expect.objectContaining({
          clave: "funcion.reserva_en_calendario",
          existe: true,
          vigente: true,
          fuente: "PRODUCT.md#capacidades",
          commitSha: "abc1234",
        }),
        expect.objectContaining({
          clave: "precio.plan.pro",
          existe: false,
          vigente: false,
          fuente: null,
        }),
      ]);
    });

    it("una afirmación ya cerrada sale como no vigente, con la versión más reciente", async () => {
      mock.growthAfirmacion.findMany.mockResolvedValue([
        {
          clave: "precio.plan.pro",
          tipo: "precio",
          texto: "Pro cuesta 139 €",
          valor: null,
          fuente: "plans.ts",
          commitSha: "viejo",
          vigenteDesde: hace(90),
          vigenteHasta: hace(5),
        },
        {
          clave: "precio.plan.pro",
          tipo: "precio",
          texto: "Pro cuesta 119 €",
          valor: null,
          fuente: "plans.ts",
          commitSha: "mas-viejo",
          vigenteDesde: hace(200),
          vigenteHasta: hace(90),
        },
      ]);
      const [b2] = (await ver()).json().borradores;
      const precio = b2.afirmacionesDetalle.find(
        (a: { clave: string }) => a.clave === "precio.plan.pro"
      );
      expect(precio).toMatchObject({
        existe: true,
        vigente: false,
        texto: "Pro cuesta 139 €",
      });
    });

    it("calcula el parecido con la versión anterior (null para la primera)", async () => {
      const [b2, b1] = (await ver()).json().borradores;
      expect(b2.similitudConVersionAnterior).toBeGreaterThan(0.5);
      expect(b2.similitudConVersionAnterior).toBeLessThan(1);
      expect(b1.similitudConVersionAnterior).toBeNull();
    });

    it("los borradores van de la versión más nueva a la más antigua, con sus revisiones", async () => {
      const cuerpo = (await ver()).json();
      expect(
        cuerpo.borradores.map((b: { version: number }) => b.version)
      ).toEqual([2, 1]);
      expect(cuerpo.borradores[0].revisiones).toHaveLength(2);
    });

    it("avisa de cuándo termina el enfriamiento del dominio y de cómo va el tope", async () => {
      const { contacto } = (await ver()).json();
      expect(contacto.contactosEstaSemana).toBe(3); // 1 hecha + 2 aprobadas
      expect(contacto.topeSemanal).toBe(5);
      expect(
        new Date(contacto.dominioEnEnfriamientoHasta).getTime()
      ).toBeGreaterThan(Date.now() + 79 * 24 * 3600 * 1000);

      mock.growthGestion.findMany.mockResolvedValue([]);
      expect(
        (await ver()).json().contacto.dominioEnEnfriamientoHasta
      ).toBeNull();
    });

    it("incluye puntuación del objetivo principal, extracto purgado y días para caducar", async () => {
      const cuerpo = (await ver()).json();
      expect(cuerpo.puntuacion).toBe(2);
      expect(cuerpo.extractoPurgado).toBe(true);
      expect(cuerpo.diasParaCaducar).toBe(12);
    });

    it("una oportunidad que no existe da 404", async () => {
      mock.growthOportunidad.findUnique.mockResolvedValue(null);
      expect((await ver()).statusCode).toBe(404);
    });
  });
});
