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
import { growthRoutes } from "../../../src/modules/growth/routes.js";
import { sincronizarConocimiento } from "../../../src/modules/growth/conocimiento/sincronizar.js";
import { SincronizarBody } from "../../../src/modules/growth/esquemas.js";
import { generarTokenDeAgente } from "../../../src/modules/growth/tokens.js";
import {
  construirAfirmaciones,
  type ResultadoDeConstruccion,
} from "../../../mcp/growth/conocimiento/construir.js";
import { cargarEntrada } from "../../../mcp/growth/conocimiento/entrada.js";
import {
  crearBorrador,
  crearFuente,
  crearOportunidad,
  limpiarGrowth,
} from "./ayudas.js";

/**
 * Revisión 1b contra Postgres real y con la extracción REAL del repo: lo que un
 * token con alcance `conocimiento` no puede hacer con las reglas duras, el
 * cierre masivo por tipo, la pausa y la carrera con aprobar (bloqueo de filas
 * `FOR UPDATE`, oportunidad antes que borrador).
 */

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const COMMIT = "a".repeat(40);
const AGENTE = { nombre: "conocimiento-semanal" };

let carga: ResultadoDeConstruccion;

function lote(
  cambios: (
    c: ResultadoDeConstruccion
  ) => Partial<ResultadoDeConstruccion> = () => ({}),
  extra: Record<string, unknown> = {}
) {
  const c = structuredClone(carga);
  const con = { ...c, ...cambios(c) };
  return SincronizarBody.parse({
    commitSha: COMMIT,
    tipos: con.tipos,
    afirmaciones: con.afirmaciones,
    competidores: con.competidores,
    nichos: con.nichos,
    paginas: con.paginas,
    ...extra,
  });
}

async function terminosVigentes(): Promise<string[]> {
  const filas = await prisma.growthAfirmacion.findMany({
    where: { tipo: "prohibida", vigenteHasta: null },
  });
  return filas.flatMap((f) => (f.valor as { terminos: string[] }).terminos);
}

const estadoDelBorrador = async (id: string) =>
  (await prisma.growthBorrador.findUnique({ where: { id } }))?.estado;
const estadoDeLaOportunidad = async (id: string) =>
  (await prisma.growthOportunidad.findUnique({ where: { id } }))?.estado;

describe("conocimiento: reglas duras y carrera (Postgres real)", () => {
  beforeAll(async () => {
    carga = construirAfirmaciones(await cargarEntrada(RAIZ));
  }, 30_000);

  beforeEach(async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    await limpiarGrowth();
  });

  afterAll(async () => {
    await limpiarGrowth();
  });

  describe("prohibida solo se puede añadir", () => {
    beforeEach(async () => {
      await sincronizarConocimiento(lote(), { agente: AGENTE });
    });

    it("un lote con una sola prohibida (cierra las otras cuatro) → 409 y los términos de la base intactos", async () => {
      const antes = await terminosVigentes();
      expect(antes).toContain("Telnyx");
      const una = carga.afirmaciones.find(
        (a) => a.clave === "prohibida.jerga_tecnica"
      )!;

      const error = await sincronizarConocimiento(
        SincronizarBody.parse({ commitSha: COMMIT, afirmaciones: [una] }),
        { agente: AGENTE }
      ).catch((e) => e);

      expect(error).toMatchObject({
        status: 409,
        codigo: "prohibida_debilitada",
      });
      expect(error.extra.prohibidas).toHaveLength(4);
      expect(await terminosVigentes()).toEqual(antes);
    });

    it("prohibida.proveedores → ['xyzzy'] → 409, y una función falsa con Telnyx en `valor` → 400", async () => {
      const antes = await terminosVigentes();
      const debilitar = await sincronizarConocimiento(
        lote((c) => ({
          afirmaciones: c.afirmaciones.map((a) =>
            a.clave === "prohibida.proveedores"
              ? {
                  ...a,
                  texto: "No se dice: xyzzy.",
                  valor: { terminos: ["xyzzy"], palabrasEnteras: true },
                }
              : a
          ),
        })),
        { agente: AGENTE }
      ).catch((e) => e);
      expect(debilitar).toMatchObject({
        status: 409,
        codigo: "prohibida_debilitada",
      });
      expect(debilitar.extra.prohibidas[0]).toMatchObject({
        clave: "prohibida.proveedores",
        motivo: "terminos_quitados",
        terminos: ["Telnyx"],
      });

      const falsa = await sincronizarConocimiento(
        lote((c) => ({
          afirmaciones: [
            ...c.afirmaciones,
            {
              clave: "funcion.falsa_telnyx",
              tipo: "funcion",
              texto: "Una función inocente.",
              valor: { detalle: "Va por Telnyx" },
              fuente: "PRODUCT.md#capacidades-confirmadas",
            },
          ],
        })),
        { agente: AGENTE }
      ).catch((e) => e);
      expect(falsa).toMatchObject({ status: 400, codigo: "termino_prohibido" });

      expect(await terminosVigentes()).toEqual(antes);
      expect(
        await prisma.growthAfirmacion.count({
          where: { clave: "funcion.falsa_telnyx" },
        })
      ).toBe(0);
    });

    it("endurecer sí: un término más se aplica", async () => {
      const r = await sincronizarConocimiento(
        lote((c) => ({
          afirmaciones: c.afirmaciones.map((a) =>
            a.clave === "prohibida.proveedores"
              ? {
                  ...a,
                  texto: `${a.texto} Tampoco Deepgram.`,
                  valor: {
                    ...(a.valor as Record<string, unknown>),
                    terminos: [
                      ...(a.valor as { terminos: string[] }).terminos,
                      "Deepgram",
                    ],
                  },
                }
              : a
          ),
        })),
        { agente: AGENTE }
      );
      expect(r.aplicable).toBe(true);
      expect(await terminosVigentes()).toContain("Deepgram");
    });
  });

  describe("cierre masivo por tipo, con la extracción real", () => {
    beforeEach(async () => {
      await sincronizarConocimiento(lote(), { agente: AGENTE });
    });

    it("retirar tres funciones (el 19 % de las 16) se rechaza; dos pasan", async () => {
      const sin = (n: number) =>
        lote((c) => {
          const fuera = new Set(
            c.afirmaciones
              .filter((a) => a.tipo === "funcion")
              .slice(0, n)
              .map((a) => a.clave)
          );
          return {
            afirmaciones: c.afirmaciones.filter((a) => !fuera.has(a.clave)),
          };
        });
      await expect(
        sincronizarConocimiento(sin(3), { agente: AGENTE })
      ).rejects.toMatchObject({ status: 409, codigo: "cierres_masivos" });
      const r = await sincronizarConocimiento(sin(2), { agente: AGENTE });
      expect(r.retiradas).toHaveLength(2);
    });

    it("un tipo vaciado en el repo se detecta SOLO porque el cuerpo lleva `tipos`", async () => {
      const sinComparativas = (conTipos: boolean) => {
        const l = lote((c) => ({
          afirmaciones: c.afirmaciones.filter((a) => a.tipo !== "comparativa"),
        }));
        if (!conTipos) delete (l as { tipos?: unknown }).tipos;
        return l;
      };
      const vaciado = await sincronizarConocimiento(sinComparativas(true), {
        agente: AGENTE,
      }).catch((e) => e);
      expect(vaciado).toMatchObject({ status: 409, codigo: "cierres_masivos" });
      expect(vaciado.message).toMatch(
        /no trae ninguna afirmación de comparativa y la base tiene vigentes de ese tipo/
      );

      const sinTipos = await sincronizarConocimiento(sinComparativas(false), {
        agente: AGENTE,
      });
      expect(sinTipos.retiradas).toEqual([]);
      expect(
        await prisma.growthAfirmacion.count({
          where: { tipo: "comparativa", vigenteHasta: null },
        })
      ).toBe(21);
    });
  });

  describe("carrera con aprobar", () => {
    beforeEach(async () => {
      await sincronizarConocimiento(lote(), { agente: AGENTE });
      await crearFuente();
    });

    const conPrecioNuevo = (texto = "Plan Pro: 149 € + IVA al mes.") =>
      lote((c) => ({
        afirmaciones: c.afirmaciones.map((a) =>
          a.clave === "precio.plan.pro" ? { ...a, texto } : a
        ),
      }));

    /** Lo que deja aprobar: la oportunidad y el borrador aprobados y su decisión. */
    async function aprobarComoElFundador(
      oportunidadId: string,
      borradorId: string
    ) {
      await prisma.growthOportunidad.update({
        where: { id: oportunidadId },
        data: { estado: "aprobada" },
      });
      await prisma.growthBorrador.update({
        where: { id: borradorId },
        data: { estado: "aprobado" },
      });
      await prisma.growthDecision.create({
        data: {
          oportunidadId,
          borradorId,
          accion: "aprobar",
          por: "admin@alhabla.ai",
        },
      });
    }

    it("una aprobación que se cruza entre la lectura y el cierre no deja un borrador aprobado con una clave cerrada", async () => {
      await crearOportunidad({
        id: "carrera",
        estado: "pendiente_aprobacion",
      });
      await crearBorrador({
        id: "b_carrera",
        oportunidadId: "carrera",
        estado: "pendiente_aprobacion",
        afirmaciones: ["precio.plan.pro"],
      });

      // Se ensancha la ventana (milisegundos en producción) reteniendo un
      // FOR UPDATE sobre la afirmación que el sincronizador va a cerrar.
      let soltar!: () => void;
      const puerta = new Promise<void>((r) => (soltar = r));
      let retenido!: () => void;
      const yaRetenido = new Promise<void>((r) => (retenido = r));
      const bloqueo = prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM growth_afirmaciones WHERE clave = 'precio.plan.pro' AND "vigenteHasta" IS NULL FOR UPDATE`;
          retenido();
          await puerta;
        },
        { timeout: 30_000 }
      );
      await yaRetenido;

      const sincronizando = sincronizarConocimiento(conPrecioNuevo(), {
        agente: AGENTE,
      });
      // El sincronizador ya leyó («pendiente») y espera el bloqueo.
      await new Promise((r) => setTimeout(r, 600));
      await aprobarComoElFundador("carrera", "b_carrera");

      soltar();
      await bloqueo;
      const r = await sincronizando;

      expect(r.avisos).toEqual([]);
      expect(r.borradoresBloqueados).toEqual([
        {
          borradorId: "b_carrera",
          oportunidadId: "carrera",
          claves: ["precio.plan.pro"],
        },
      ]);
      expect(await estadoDelBorrador("b_carrera")).toBe("bloqueado");
      expect(await estadoDeLaOportunidad("carrera")).toBe("bloqueada");
      expect(
        (
          await prisma.growthAfirmacion.findFirst({
            where: { clave: "precio.plan.pro", vigenteHasta: null },
          })
        )?.texto
      ).toBe("Plan Pro: 149 € + IVA al mes.");
      expect(
        await prisma.growthRevisionCumplimiento.count({
          where: { borradorId: "b_carrera", resultado: "bloquea" },
        })
      ).toBe(1);
    }, 30_000);

    it("sincronizar y aprobar a la vez, con el orden de bloqueo de aprobar, ni se interbloquean ni dejan un aprobado con clave cerrada", async () => {
      const rondas = 12;
      for (let i = 0; i < rondas; i++) {
        await limpiarGrowth();
        await sincronizarConocimiento(lote(), { agente: AGENTE });
        await crearFuente();
        await crearOportunidad({
          id: "o",
          estado: "pendiente_aprobacion",
        });
        await crearBorrador({
          id: "b",
          oportunidadId: "o",
          estado: "pendiente_aprobacion",
          afirmaciones: ["precio.plan.pro"],
        });

        // Aprobar: bloquea la oportunidad, espera un poco y toca el borrador.
        const aprobando = prisma.$transaction(
          async (tx) => {
            await tx.growthOportunidad.updateMany({
              where: { id: "o", estado: "pendiente_aprobacion" },
              data: { estado: "aprobada" },
            });
            await new Promise((r) => setTimeout(r, (i * 7) % 40));
            await tx.growthBorrador.updateMany({
              where: { id: "b", estado: "pendiente_aprobacion" },
              data: { estado: "aprobado" },
            });
          },
          { timeout: 20_000 }
        );
        const sincronizando = sincronizarConocimiento(
          conPrecioNuevo(`Plan Pro: ${150 + i} € + IVA al mes.`),
          { agente: AGENTE }
        );
        const [aprobacion, sincronizacion] = await Promise.allSettled([
          aprobando,
          sincronizando,
        ]);

        expect(
          sincronizacion.status,
          `ronda ${i}: ${sincronizacion.status === "rejected" ? String(sincronizacion.reason) : ""}`
        ).toBe("fulfilled");
        // Que aprobar pierda la carrera (porque el sincronizador ya lo bloqueó) es válido; un interbloqueo, no.
        if (aprobacion.status === "rejected") {
          expect(String(aprobacion.reason)).not.toMatch(/deadlock|40P01/i);
        }
        // Invariante: nunca queda aprobado un borrador que cita una clave que cambió.
        expect(await estadoDelBorrador("b"), `ronda ${i}`).toBe("bloqueado");
        expect(await estadoDeLaOportunidad("o"), `ronda ${i}`).toBe(
          "bloqueada"
        );
      }
    }, 120_000);
  });

  describe("sincronizar?simular=true con Growth en pausa (por la ruta)", () => {
    let fastify: ReturnType<typeof Fastify>;

    beforeAll(async () => {
      fastify = Fastify();
      await fastify.register(growthRoutes);
    });

    afterAll(async () => {
      await fastify.close();
    });

    it("la simulación responde 200 y no escribe; aplicar responde 409 pausa", async () => {
      const { token, hash } = generarTokenDeAgente();
      await prisma.growthTokenAgente.create({
        data: {
          nombre: "conocimiento-pausa",
          hashToken: hash,
          alcances: ["conocimiento"],
        },
      });
      await prisma.growthAjuste.create({
        data: { clave: "pausa", valor: true },
      });
      const headers = { authorization: `Bearer ${token}` };

      const simulada = await fastify.inject({
        method: "POST",
        url: "/growth/agente/conocimiento/sincronizar?simular=true",
        headers,
        payload: lote(),
      });
      expect(simulada.statusCode).toBe(200);
      expect(simulada.json()).toMatchObject({
        simulado: true,
        aplicable: true,
        prohibidasDebilitadas: [],
      });
      expect(await prisma.growthAfirmacion.count()).toBe(0);

      const aplicada = await fastify.inject({
        method: "POST",
        url: "/growth/agente/conocimiento/sincronizar",
        headers,
        payload: lote(),
      });
      expect(aplicada.statusCode).toBe(409);
      expect(aplicada.json().codigo).toBe("pausa");
      expect(await prisma.growthAfirmacion.count()).toBe(0);
    });
  });
});
