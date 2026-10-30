import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "../../../src/lib/prisma.js";
import { caducarAprobadasDeGrowthJob } from "../../../src/jobs/caducarAprobadasDeGrowth.js";
import {
  editarBorrador,
  listarBorradores,
} from "../../../src/modules/growth/servicioAdmin.js";
import { ListadoDeBorradoresQuery } from "../../../src/modules/growth/esquemas.js";
import { ErrorDeGrowth } from "../../../src/modules/growth/service.js";
import { limpiarGrowth } from "./ayudas.js";
import {
  asegurarFuente,
  fijarTopeSemanal,
  fotoDeLoEscrito,
  gestionHecha,
  hace,
  pendienteDeAprobar,
  sembrarBorrador,
  sembrarOportunidad,
  textoUnico,
} from "./f1b-ayudas.js";

/**
 * La vista Borradores y su edición a mano contra Postgres real: las
 * pestañas dependen de filtros relacionales, y lo que el job de caducidad
 * hace a los borradores solo se comprueba pasando el job de verdad.
 */

const ADMIN = "admin@alhabla.ai";

function listar(consulta: Record<string, string> = {}) {
  return listarBorradores(ListadoDeBorradoresQuery.parse(consulta));
}

const ids = (r: { data: { id: string }[] }) => r.data.map((b) => b.id).sort();

async function errorDe(promesa: Promise<unknown>): Promise<ErrorDeGrowth> {
  try {
    await promesa;
  } catch (error) {
    expect(error).toBeInstanceOf(ErrorDeGrowth);
    return error as ErrorDeGrowth;
  }
  throw new Error("Debía fallar y no falló.");
}

describe("Borradores del administrador (Postgres real)", () => {
  beforeEach(async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    await limpiarGrowth();
    await asegurarFuente();
  });
  afterAll(limpiarGrowth);

  describe("la pestaña «caducados»", () => {
    async function escenario() {
      // Una aprobada vencida con dos versiones: una descartada al devolverla
      // y la aprobada (la que el fundador no llegó a gestionar).
      await sembrarOportunidad({
        id: "vencida",
        estado: "aprobada",
        expiraEn: hace(3),
      });
      await sembrarBorrador({
        id: "b_v1",
        oportunidadId: "vencida",
        estado: "descartado",
        version: 1,
      });
      await sembrarBorrador({
        id: "b_v2",
        oportunidadId: "vencida",
        estado: "aprobado",
        version: 2,
      });
      // Una descartada de verdad (por el fundador): sigue en «descartados».
      await sembrarOportunidad({ id: "descartada", estado: "descartada" });
      await sembrarBorrador({
        id: "b_descartado",
        oportunidadId: "descartada",
        estado: "descartado",
      });
      // Una pendiente y una bloqueada, vivas.
      await sembrarOportunidad({
        id: "pendiente",
        estado: "pendiente_aprobacion",
      });
      await sembrarBorrador({
        id: "b_pendiente",
        oportunidadId: "pendiente",
        estado: "pendiente_aprobacion",
      });
      await sembrarOportunidad({ id: "bloqueada", estado: "bloqueada" });
      await sembrarBorrador({
        id: "b_bloqueado",
        oportunidadId: "bloqueada",
        estado: "bloqueado",
      });
    }

    it("tras pasar el job de caducidad de verdad, sus borradores salen en «caducados» y NO en «descartados»", async () => {
      await escenario();

      const antes = await listar({ grupo: "caducados" });
      // Antes del job la oportunidad sigue aprobada: nada caducado todavía.
      expect(ids(antes)).toEqual([]);

      const resultado = await caducarAprobadasDeGrowthJob();
      expect(resultado.caducadas).toBe(1);
      // El job no se toca: descarta los borradores abiertos de la oportunidad.
      const bV2 = await prisma.growthBorrador.findUnique({
        where: { id: "b_v2" },
      });
      expect(bV2?.estado).toBe("descartado");

      const caducados = await listar({ grupo: "caducados" });
      expect(ids(caducados)).toEqual(["b_v1", "b_v2"]);
      expect(caducados.total).toBe(2);

      const descartados = await listar({ grupo: "descartados" });
      expect(ids(descartados)).toEqual(["b_descartado"]);
    });

    it("los conteos de las pestañas cuadran: cada borrador cuenta en una sola", async () => {
      await escenario();
      await caducarAprobadasDeGrowthJob();

      const { conteos } = await listar();
      expect(conteos).toEqual({
        bloqueados: 1,
        pendientes: 1,
        aprobados: 0,
        gestionados: 0,
        caducados: 2,
        descartados: 1,
      });
      expect(Object.values(conteos).reduce((a, b) => a + b, 0)).toBe(
        await prisma.growthBorrador.count()
      );
    });

    it("«caducado» lo decide la oportunidad, sea cual sea el estado del borrador", async () => {
      await sembrarOportunidad({ id: "o_caducada", estado: "caducada" });
      for (const estado of [
        "borrador",
        "bloqueado",
        "pendiente_aprobacion",
        "aprobado",
        "gestionado",
        "descartado",
      ] as const) {
        await sembrarBorrador({
          id: `b_${estado}`,
          oportunidadId: "o_caducada",
          estado,
          version:
            [
              "borrador",
              "bloqueado",
              "pendiente_aprobacion",
              "aprobado",
              "gestionado",
              "descartado",
            ].indexOf(estado) + 1,
        });
      }
      // El gestionado necesita su gestión para existir en el mundo real, pero
      // aquí solo se mira el filtro.
      const caducados = await listar({ grupo: "caducados" });
      expect(ids(caducados)).toHaveLength(6);
      const conteos = (await listar()).conteos;
      expect(conteos.caducados).toBe(6);
      expect(
        conteos.bloqueados +
          conteos.pendientes +
          conteos.aprobados +
          conteos.gestionados +
          conteos.descartados
      ).toBe(0);
    });

    it("una oportunidad caducada no deja sus borradores en ninguna otra pestaña", async () => {
      await escenario();
      await caducarAprobadasDeGrowthJob();
      for (const grupo of [
        "bloqueados",
        "pendientes",
        "aprobados",
        "gestionados",
        "descartados",
      ]) {
        const r = await listar({ grupo });
        expect(ids(r), grupo).not.toContain("b_v1");
        expect(ids(r), grupo).not.toContain("b_v2");
      }
    });
  });

  describe("la búsqueda `q` busca el texto tal cual (los comodines de LIKE no comodinean)", () => {
    beforeEach(async () => {
      await sembrarOportunidad({ id: "o1", estado: "pendiente_aprobacion" });
      await sembrarBorrador({
        id: "b_guion",
        oportunidadId: "o1",
        estado: "pendiente_aprobacion",
        asunto: "descuento_especial",
      });
      await sembrarOportunidad({ id: "o2", estado: "pendiente_aprobacion" });
      await sembrarBorrador({
        id: "b_porciento",
        oportunidadId: "o2",
        estado: "pendiente_aprobacion",
        asunto: "100% garantizado",
      });
      await sembrarOportunidad({ id: "o3", estado: "pendiente_aprobacion" });
      await sembrarBorrador({
        id: "b_normal",
        oportunidadId: "o3",
        estado: "pendiente_aprobacion",
        asunto: "Una recepcionista para vuestro listado",
      });
      await sembrarOportunidad({ id: "o4", estado: "pendiente_aprobacion" });
      await sembrarBorrador({
        id: "b_barra",
        oportunidadId: "o4",
        estado: "pendiente_aprobacion",
        asunto: "ruta c:\\carpeta",
      });
    });

    it("«_» solo casa con un guion bajo de verdad", async () => {
      expect(ids(await listar({ q: "_" }))).toEqual(["b_guion"]);
      expect(ids(await listar({ q: "descuento_" }))).toEqual(["b_guion"]);
      // Sin escapar, «descuento_» casaría con «descuentoX…»; y «_» con todo.
      expect(ids(await listar({ q: "descuent_especial" }))).toEqual([]);
    });

    it("«%» solo casa con un porcentaje de verdad", async () => {
      expect(ids(await listar({ q: "%" }))).toEqual(["b_porciento"]);
      expect(ids(await listar({ q: "100%" }))).toEqual(["b_porciento"]);
      expect(ids(await listar({ q: "r%l" }))).toEqual([]);
    });

    it("una barra invertida se busca como barra, no escapa nada", async () => {
      expect(ids(await listar({ q: "\\" }))).toEqual(["b_barra"]);
      expect(ids(await listar({ q: "c:\\carpeta" }))).toEqual(["b_barra"]);
    });

    it("un texto normal sigue buscando por trozo, sin importar mayúsculas", async () => {
      expect(ids(await listar({ q: "VUESTRO LISTADO" }))).toEqual(["b_normal"]);
    });

    it("los conteos de las pestañas usan la misma búsqueda", async () => {
      const r = await listar({ q: "_" });
      expect(r.conteos.pendientes).toBe(1);
    });
  });

  describe("editar a mano con la agenda en contra (PATCH)", () => {
    const corregir = (id: string, sufijo = " Gracias.") =>
      prisma.growthBorrador
        .findUniqueOrThrow({ where: { id } })
        .then((b) =>
          editarBorrador(id, { texto: `${b.texto}${sufijo}` }, ADMIN)
        );

    it("con el tope semanal lleno, corregir una errata da 409 tope_semanal y NO cambia nada en la base", async () => {
      await fijarTopeSemanal(1);
      await gestionHecha("hecha", "otro.ejemplo.com", 2);
      await pendienteDeAprobar("o_edit", "edit.ejemplo.com");
      const antes = await fotoDeLoEscrito();

      const error = await errorDe(corregir("b_o_edit"));

      expect(error.status).toBe(409);
      expect(error.codigo).toBe("tope_semanal");
      expect(await fotoDeLoEscrito()).toEqual(antes);
    });

    it("el tope cuenta lo aprobado sin gestionar: una aprobada ajena lo llena", async () => {
      await fijarTopeSemanal(1);
      await sembrarOportunidad({
        id: "aprobada_ajena",
        dominio: "ajena.ejemplo.com",
        estado: "aprobada",
      });
      await pendienteDeAprobar("o_edit", "edit.ejemplo.com");
      const antes = await fotoDeLoEscrito();

      const error = await errorDe(corregir("b_o_edit"));

      expect(error.codigo).toBe("tope_semanal");
      expect(await fotoDeLoEscrito()).toEqual(antes);
    });

    it("un dominio contactado hace poco da 409 dominio_en_enfriamiento y no cambia nada", async () => {
      await gestionHecha("hecha", "mismo.ejemplo.com", 10);
      await pendienteDeAprobar("o_edit", "mismo.ejemplo.com");
      const antes = await fotoDeLoEscrito();

      const error = await errorDe(corregir("b_o_edit"));

      expect(error.status).toBe(409);
      expect(error.codigo).toBe("dominio_en_enfriamiento");
      expect(error.extra).toEqual({ hasta: expect.any(String) });
      expect(await fotoDeLoEscrito()).toEqual(antes);
    });

    it("un dominio contactado hace más de 90 días ya no enfría", async () => {
      await gestionHecha("hecha", "mismo.ejemplo.com", 91);
      await pendienteDeAprobar("o_edit", "mismo.ejemplo.com");

      const r = await corregir("b_o_edit");

      expect(r.resultado).not.toBe("bloquea");
      expect(r.borrador.estado).toBe("pendiente_aprobacion");
    });

    it("otra oportunidad aprobada del mismo dominio da 409 dominio_ya_aprobado y no cambia nada", async () => {
      await sembrarOportunidad({
        id: "aprobada_gemela",
        dominio: "gemelo.ejemplo.com",
        estado: "aprobada",
      });
      await pendienteDeAprobar("o_edit", "gemelo.ejemplo.com");
      const antes = await fotoDeLoEscrito();

      const error = await errorDe(corregir("b_o_edit"));

      expect(error.codigo).toBe("dominio_ya_aprobado");
      expect(await fotoDeLoEscrito()).toEqual(antes);
    });

    it("con hueco en el tope y sin dominio repetido, la edición se guarda y deja revisión y decisión", async () => {
      await fijarTopeSemanal(3);
      await gestionHecha("hecha", "otro.ejemplo.com", 2);
      await pendienteDeAprobar("o_edit", "edit.ejemplo.com");

      const r = await corregir("b_o_edit");

      expect(r.resultado).not.toBe("bloquea");
      expect(r.borrador).toMatchObject({
        estado: "pendiente_aprobacion",
        editadoPorHumano: true,
      });
      expect(await prisma.growthRevisionCumplimiento.count()).toBe(1);
      expect(
        await prisma.growthDecision.count({ where: { accion: "editar" } })
      ).toBe(1);
    });

    it("si falla el TEXTO bloquea (200), aunque la agenda también esté llena: la causa es el texto", async () => {
      await sembrarOportunidad({
        id: "aprobada_gemela",
        dominio: "gemelo.ejemplo.com",
        estado: "aprobada",
      });
      await pendienteDeAprobar("o_edit", "gemelo.ejemplo.com");
      // Sin identificarse como Alhabla: falla la regla de identificación.
      const r = await editarBorrador(
        "b_o_edit",
        {
          texto: `Hola, ¿os interesaría incluirnos? ${textoUnico("zz").slice(200)}`,
        },
        ADMIN
      );

      expect(r.resultado).toBe("bloquea");
      expect(r.borrador.estado).toBe("bloqueado");
      expect(r.oportunidad.estado).toBe("bloqueada");
      const duras = r.comprobaciones.filter((c) => c.dura && !c.ok);
      expect(duras.map((c) => c.regla)).toEqual(["identificacion"]);
      const agenda = r.comprobaciones.find(
        (c) => c.regla === "un_contacto_por_dominio"
      );
      // La agenda en contra no bloqueó nada: queda como aviso.
      expect(agenda?.dura).toBe(false);
      const bloqueo = await prisma.growthDecision.findFirst({
        where: { accion: "bloquear_por_reglas" },
      });
      expect(bloqueo?.motivo).toContain("identificacion");
      expect(bloqueo?.motivo).not.toContain("un_contacto_por_dominio");
    });

    it("un bloqueado por el texto que se corrige con la agenda llena sigue bloqueado: 409 y nada cambia", async () => {
      await fijarTopeSemanal(1);
      await gestionHecha("hecha", "otro.ejemplo.com", 2);
      await sembrarOportunidad({
        id: "o_bloq",
        dominio: "bloq.ejemplo.com",
        estado: "bloqueada",
      });
      await sembrarBorrador({
        id: "b_bloq",
        oportunidadId: "o_bloq",
        estado: "bloqueado",
        texto:
          "Hola, ¿os interesaría incluirnos en vuestro listado de empresas?",
      });
      const antes = await fotoDeLoEscrito();

      const error = await errorDe(
        editarBorrador("b_bloq", { texto: textoUnico("bloq") }, ADMIN)
      );

      expect(error.codigo).toBe("tope_semanal");
      expect(await fotoDeLoEscrito()).toEqual(antes);
    });
  });
});
