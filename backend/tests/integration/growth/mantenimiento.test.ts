import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "../../../src/lib/prisma.js";
import { caducarAprobadasDeGrowthJob } from "../../../src/jobs/caducarAprobadasDeGrowth.js";
import { purgarRetencionDeGrowthJob } from "../../../src/jobs/purgarRetencionDeGrowth.js";
import {
  crearBorrador,
  crearFuente,
  crearOportunidad,
  dentroDe,
  hace,
  limpiarGrowth,
} from "./ayudas.js";

/**
 * El mantenimiento de Growth contra Postgres real: los filtros relacionales
 * (`decisiones: none`, `gestion: isNot null`), las cascadas y los RESTRICT no
 * se comprueban con mocks.
 */

const estadoDe = async (id: string) =>
  (await prisma.growthOportunidad.findUnique({ where: { id } }))?.estado;

describe("mantenimiento de Growth (Postgres real)", () => {
  beforeEach(async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await limpiarGrowth();
    await crearFuente();
  });

  describe("caducidad de las aprobadas", () => {
    it("caduca la aprobada vencida, descarta todos sus borradores abiertos y deja una decisión del sistema", async () => {
      await crearOportunidad({
        id: "vencida",
        estado: "aprobada",
        expiraEn: hace(3),
      });
      await crearBorrador({
        id: "b_aprobado",
        oportunidadId: "vencida",
        estado: "aprobado",
        version: 2,
      });
      await crearBorrador({
        id: "b_bloqueado",
        oportunidadId: "vencida",
        estado: "bloqueado",
        version: 1,
      });

      const r = await caducarAprobadasDeGrowthJob();

      expect(r).toEqual({
        caducadas: 1,
        borradoresDescartados: 2,
        fallidas: 0,
      });
      expect(await estadoDe("vencida")).toBe("caducada");
      const borradores = await prisma.growthBorrador.findMany({
        orderBy: { id: "asc" },
      });
      expect(borradores.map((b) => [b.id, b.estado])).toEqual([
        ["b_aprobado", "descartado"],
        ["b_bloqueado", "descartado"],
      ]);
      const decisiones = await prisma.growthDecision.findMany();
      expect(decisiones).toHaveLength(1);
      expect(decisiones[0]).toMatchObject({
        oportunidadId: "vencida",
        borradorId: "b_aprobado",
        accion: "caducar",
        por: "sistema",
      });
      expect(decisiones[0].motivo).toMatch(
        /^Venció el \d{4}-\d{2}-\d{2} sin gestionarse$/
      );
    });

    it("no toca lo que no debe: aprobada sin vencer o sin fecha, otros estados vencidos", async () => {
      await crearOportunidad({
        id: "vigente",
        estado: "aprobada",
        expiraEn: dentroDe(5),
      });
      await crearOportunidad({
        id: "sin_fecha",
        estado: "aprobada",
        expiraEn: null,
      });
      await crearOportunidad({
        id: "pendiente",
        estado: "pendiente_aprobacion",
        expiraEn: hace(10),
      });
      await crearOportunidad({
        id: "gestionada",
        estado: "gestionada",
        expiraEn: hace(10),
      });
      await crearBorrador({
        id: "b1",
        oportunidadId: "pendiente",
        estado: "pendiente_aprobacion",
      });

      const r = await caducarAprobadasDeGrowthJob();

      expect(r.caducadas).toBe(0);
      expect(await estadoDe("vigente")).toBe("aprobada");
      expect(await estadoDe("sin_fecha")).toBe("aprobada");
      expect(await estadoDe("pendiente")).toBe("pendiente_aprobacion");
      expect(await estadoDe("gestionada")).toBe("gestionada");
      expect(
        (await prisma.growthBorrador.findUnique({ where: { id: "b1" } }))
          ?.estado
      ).toBe("pendiente_aprobacion");
      expect(await prisma.growthDecision.count()).toBe(0);
    });

    it("es idempotente: la segunda pasada no cambia nada", async () => {
      await crearOportunidad({
        id: "vencida",
        estado: "aprobada",
        expiraEn: hace(1),
      });
      await crearBorrador({
        id: "b",
        oportunidadId: "vencida",
        estado: "aprobado",
      });
      await caducarAprobadasDeGrowthJob();
      const antes = await prisma.growthDecision.count();

      const r = await caducarAprobadasDeGrowthJob();

      expect(r).toEqual({
        caducadas: 0,
        borradoresDescartados: 0,
        fallidas: 0,
      });
      expect(await prisma.growthDecision.count()).toBe(antes);
    });

    it("dos pasadas a la vez (entrega doble de Scheduler) caducan una sola vez", async () => {
      await crearOportunidad({
        id: "vencida",
        estado: "aprobada",
        expiraEn: hace(1),
      });
      await crearBorrador({
        id: "b",
        oportunidadId: "vencida",
        estado: "aprobado",
      });

      const [a, b] = await Promise.all([
        caducarAprobadasDeGrowthJob(),
        caducarAprobadasDeGrowthJob(),
      ]);

      expect(a.caducadas + b.caducadas).toBe(1);
      expect(await prisma.growthDecision.count()).toBe(1);
    });

    it("caduca más de un lote (50) sin dejar ninguna", async () => {
      for (let i = 0; i < 53; i++) {
        await crearOportunidad({
          id: `o${i}`,
          estado: "aprobada",
          expiraEn: hace(2),
        });
      }
      const r = await caducarAprobadasDeGrowthJob();
      expect(r.caducadas).toBe(53);
      expect(
        await prisma.growthOportunidad.count({ where: { estado: "aprobada" } })
      ).toBe(0);
      expect(
        await prisma.growthDecision.count({ where: { accion: "caducar" } })
      ).toBe(53);
    }, 60_000);
  });

  describe("purga de retención", () => {
    it("borra la fila vencida sin historial, con su investigación, borradores y revisiones", async () => {
      await crearOportunidad({
        id: "limpia",
        estado: "descartada",
        retencionHasta: hace(1),
      });
      await prisma.growthInvestigacion.create({
        data: {
          oportunidadId: "limpia",
          resumen: "Resumen",
          quienEdita: "Redacción",
        },
      });
      await crearBorrador({
        id: "b",
        oportunidadId: "limpia",
        estado: "descartado",
      });
      await prisma.growthRevisionCumplimiento.create({
        data: {
          borradorId: "b",
          resultado: "pasa",
          comprobaciones: [],
          revisor: "reglas",
        },
      });

      const r = await purgarRetencionDeGrowthJob();

      expect(r.filasBorradas).toBe(1);
      expect(await prisma.growthOportunidad.count()).toBe(0);
      expect(await prisma.growthInvestigacion.count()).toBe(0);
      expect(await prisma.growthBorrador.count()).toBe(0);
      expect(await prisma.growthRevisionCumplimiento.count()).toBe(0);
    });

    it("la vencida CON decisión se conserva: sin el texto del tercero y con la decisión intacta", async () => {
      await crearOportunidad({
        id: "decidida",
        estado: "descartada",
        retencionHasta: hace(1),
      });
      await prisma.growthInvestigacion.create({
        data: {
          oportunidadId: "decidida",
          resumen: "Resumen",
          quienEdita: "Redacción",
        },
      });
      await prisma.growthDecision.create({
        data: {
          oportunidadId: "decidida",
          accion: "descartar",
          motivo: "No encaja",
          por: "admin@alhabla.ai",
        },
      });

      const r = await purgarRetencionDeGrowthJob();

      expect(r).toMatchObject({
        filasBorradas: 0,
        extractosVaciados: 1,
        investigacionesSinNombre: 1,
      });
      const fila = await prisma.growthOportunidad.findUnique({
        where: { id: "decidida" },
      });
      expect(fila?.extracto).toBe("");
      // El resto de lo que se decidió sigue ahí.
      expect(fila).toMatchObject({
        titulo: "Título de decidida",
        estado: "descartada",
      });
      const decision = await prisma.growthDecision.findFirst();
      expect(decision).toMatchObject({
        oportunidadId: "decidida",
        accion: "descartar",
      });
      expect(
        (
          await prisma.growthInvestigacion.findUnique({
            where: { oportunidadId: "decidida" },
          })
        )?.quienEdita
      ).toBeNull();
    });

    it("una vencida con una gestión no se borra aunque falte la decisión: la FK RESTRICT no hace fallar el job", async () => {
      await crearOportunidad({
        id: "gestionada",
        estado: "gestionada",
        retencionHasta: hace(1),
      });
      await crearBorrador({
        id: "b",
        oportunidadId: "gestionada",
        estado: "gestionado",
      });
      await prisma.growthGestion.create({
        data: {
          borradorId: "b",
          canal: "email",
          dominio: "gestionada.example.com",
          hechaEn: hace(30),
        },
      });

      const r = await purgarRetencionDeGrowthJob();

      expect(r.filasBorradas).toBe(0);
      expect(await prisma.growthGestion.count()).toBe(1);
      expect(await prisma.growthOportunidad.count()).toBe(1);
      expect((await prisma.growthOportunidad.findFirst())?.extracto).toBe("");
    });

    it("una vencida cuyo borrador tiene una decisión (sin colgar de la oportunidad) se conserva: es historial", async () => {
      await crearOportunidad({
        id: "con_decision_de_borrador",
        estado: "descartada",
        retencionHasta: hace(1),
      });
      await crearBorrador({
        id: "b_decidido",
        oportunidadId: "con_decision_de_borrador",
        estado: "descartado",
      });
      // Solo cuelga del borrador: `oportunidadId` nulo.
      await prisma.growthDecision.create({
        data: {
          borradorId: "b_decidido",
          accion: "descartar",
          motivo: "No encaja",
          por: "admin@alhabla.ai",
        },
      });
      // Una vencida sin nada de nada sí se borra, como siempre.
      await crearOportunidad({
        id: "sin_nada",
        estado: "descartada",
        retencionHasta: hace(1),
      });
      await crearBorrador({
        id: "b_sin_nada",
        oportunidadId: "sin_nada",
        estado: "descartado",
      });

      const r = await purgarRetencionDeGrowthJob();

      expect(r.filasBorradas).toBe(1);
      expect(
        await prisma.growthOportunidad.findUnique({
          where: { id: "con_decision_de_borrador" },
        })
      ).toMatchObject({ extracto: "" });
      expect(
        await prisma.growthOportunidad.findUnique({ where: { id: "sin_nada" } })
      ).toBeNull();
      // La decisión sigue apuntando a su borrador (no quedó huérfana).
      expect(await prisma.growthDecision.findFirst()).toMatchObject({
        borradorId: "b_decidido",
        accion: "descartar",
      });
      expect(await prisma.growthBorrador.count()).toBe(1);
    });

    it("una vencida con un enlace conseguido se conserva", async () => {
      await crearOportunidad({
        id: "conseguida",
        estado: "conseguida",
        retencionHasta: hace(1),
      });
      await prisma.growthEnlaceEntrante.create({
        data: {
          dominioOrigen: "conseguida.example.com",
          urlOrigen: "https://conseguida.example.com/a",
          urlDestino: "https://alhabla.ai/",
          rel: "dofollow",
          primeraVistaEn: hace(10),
          fuente: "manual",
          oportunidadId: "conseguida",
        },
      });
      const r = await purgarRetencionDeGrowthJob();
      expect(r.filasBorradas).toBe(0);
      expect(await prisma.growthEnlaceEntrante.count()).toBe(1);
    });

    it("lo que aún no venció no se toca: ni la fila, ni el extracto, ni el nombre", async () => {
      await crearOportunidad({
        id: "reciente",
        estado: "descartada",
        retencionHasta: dentroDe(30),
      });
      await prisma.growthInvestigacion.create({
        data: {
          oportunidadId: "reciente",
          resumen: "R",
          quienEdita: "Redacción",
        },
      });

      const r = await purgarRetencionDeGrowthJob();

      expect(r).toEqual({
        filasBorradas: 0,
        extractosVaciados: 0,
        investigacionesSinNombre: 0,
      });
      expect(
        (
          await prisma.growthOportunidad.findUnique({
            where: { id: "reciente" },
          })
        )?.extracto
      ).not.toBe("");
      expect(
        (
          await prisma.growthInvestigacion.findUnique({
            where: { oportunidadId: "reciente" },
          })
        )?.quienEdita
      ).toBe("Redacción");
    });

    it("nunca toca decisiones ni gestiones, y es idempotente", async () => {
      await crearOportunidad({
        id: "a",
        estado: "gestionada",
        retencionHasta: hace(1),
      });
      await crearBorrador({
        id: "ba",
        oportunidadId: "a",
        estado: "gestionado",
      });
      await prisma.growthGestion.create({
        data: {
          borradorId: "ba",
          canal: "email",
          dominio: "a.example.com",
          hechaEn: hace(20),
        },
      });
      await prisma.growthDecision.create({
        data: {
          oportunidadId: "a",
          borradorId: "ba",
          accion: "marcar_gestionado",
          por: "admin@alhabla.ai",
        },
      });
      await crearOportunidad({
        id: "b",
        estado: "descartada",
        retencionHasta: hace(2),
      });

      await purgarRetencionDeGrowthJob();
      const decisiones = await prisma.growthDecision.findMany();
      const gestiones = await prisma.growthGestion.findMany();
      expect(decisiones).toHaveLength(1);
      expect(decisiones[0].oportunidadId).toBe("a");
      expect(gestiones).toHaveLength(1);
      expect(
        await prisma.growthOportunidad.findUnique({ where: { id: "b" } })
      ).toBeNull();

      const segunda = await purgarRetencionDeGrowthJob();
      expect(segunda).toEqual({
        filasBorradas: 0,
        extractosVaciados: 0,
        investigacionesSinNombre: 0,
      });
      expect(await prisma.growthDecision.findMany()).toEqual(decisiones);
    });

    it("borra más de un lote (200) entero", async () => {
      const filas = Array.from({ length: 205 }, (_, i) => ({
        id: `m${i}`,
        claveExterna: `masiva-${i}`,
        fuenteId: "fuente_web",
        url: `https://m${i}.example.com/`,
        dominio: `m${i}.example.com`,
        titulo: "T",
        extracto: "E",
        objetivoPrincipal: "BACKLINKS" as const,
        estado: "descartada" as const,
        retencionHasta: hace(5),
      }));
      await prisma.growthOportunidad.createMany({ data: filas });
      const r = await purgarRetencionDeGrowthJob();
      expect(r.filasBorradas).toBe(205);
      expect(await prisma.growthOportunidad.count()).toBe(0);
    }, 60_000);
  });
});
