import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../../src/lib/prisma.js";
import { esConflictoDeConcurrencia } from "../../../src/modules/growth/routes.js";
import {
  adquirirCerrojosDeAprobacion,
  crearOportunidad,
  decidir,
} from "../../../src/modules/growth/service.js";
import { crearFuente, hace, limpiarGrowth } from "./ayudas.js";

/**
 * Las carreras de Growth contra Postgres real y con peticiones de verdad a la
 * vez (`Promise.all`): con mocks no hay concurrencia. Cubre:
 *
 * - Dos aprobaciones simultáneas no se saltan «un contacto por dominio» ni el
 *   tope semanal (cerrojo `growth_aprobar`).
 * - Marcar como gestionado y aprobar a la vez tampoco.
 * - Aprobar y editar (otro orden de filas) ya no se cruzan en un deadlock.
 * - La plantilla repetida solo compara con lo anterior y lo que se dijo.
 * - Un FQDN con punto final no esquiva los duplicados, y un extracto con un
 *   emoji en el límite o con un NUL no da 500.
 */

const ADMIN = "admin@alhabla.ai";
/** Carácter de reemplazo (u+fffd): escrito por su código para que se vea en el fichero. */
const REEMPLAZO = String.fromCodePoint(0xfffd);

const AHORA = () => new Date();

const PALABRAS =
  "casa rio monte luz pan sal mar cielo viento campo flor nube piedra fuego hoja barco puente torre calle plaza huerto valle isla cueva nieve lluvia trigo olivo vino miel queso fruta".split(
    " "
  );

let contador = 0;

/** Un mensaje que cumple las reglas y no se parece a ningún otro. */
function textoUnico(): string {
  contador += 1;
  const azar = Array.from(
    { length: 45 },
    (_, i) =>
      `${PALABRAS[(contador * 7 + i * 13) % PALABRAS.length]}${contador}x${i}`
  ).join(" ");
  return `Hola, soy el fundador de Alhabla, una recepcionista de IA para pequeños negocios. Hemos visto vuestro directorio y creemos que encaja. ${azar}`;
}

async function sembrar() {
  await limpiarGrowth();
  await crearFuente();
  await prisma.growthAfirmacion.create({
    data: {
      clave: "funcion.reservas",
      tipo: "funcion",
      texto: "Alhabla reserva citas en tu calendario.",
      fuente: "PRODUCT.md#reservas",
      commitSha: "a".repeat(40),
    },
  });
}

async function ponerAjuste(clave: string, valor: Prisma.InputJsonValue) {
  await prisma.growthAjuste.upsert({
    where: { clave },
    create: { clave, valor },
    update: { valor },
  });
}

type Opciones = {
  dominio: string;
  estado?: "pendiente_aprobacion" | "aprobada" | "bloqueada";
  borrador?: "pendiente_aprobacion" | "aprobado" | "bloqueado";
  texto?: string;
  creadoEn?: Date;
};

/** Una oportunidad con UN borrador, directamente en la base de datos. */
async function oportunidadConBorrador(o: Opciones) {
  contador += 1;
  const oportunidad = await prisma.growthOportunidad.create({
    data: {
      claveExterna: `clave-${contador}-${Math.random()}`,
      fuenteId: "fuente_web",
      url: `https://${o.dominio}/p${contador}`,
      dominio: o.dominio,
      titulo: `Página ${contador}`,
      extracto: "Un directorio de negocios.",
      objetivoPrincipal: "BACKLINKS",
      estado: o.estado ?? "pendiente_aprobacion",
      retencionHasta: new Date(Date.now() + 100 * 86_400_000),
    },
  });
  const borrador = await prisma.growthBorrador.create({
    data: {
      oportunidadId: oportunidad.id,
      tipo: "email",
      objetivo: "BACKLINKS",
      asunto: "Alhabla en vuestro directorio",
      texto: o.texto ?? textoUnico(),
      afirmaciones: ["funcion.reservas"],
      estado: o.borrador ?? "pendiente_aprobacion",
      ...(o.creadoEn ? { creadoEn: o.creadoEn } : {}),
    },
  });
  return { oportunidadId: oportunidad.id, borradorId: borrador.id };
}

const aprobar = (o: { oportunidadId: string; borradorId: string }) =>
  decidir(
    o.oportunidadId,
    { accion: "aprobar", borradorId: o.borradorId },
    ADMIN
  );

/** `ok:aprobada` o `409:<codigo>` (o cualquier otro fallo, tal cual). */
function resumen(r: PromiseSettledResult<{ estado: string }>): string {
  if (r.status === "fulfilled") return `ok:${r.value.estado}`;
  const e = r.reason as { status?: number; codigo?: string; message?: string };
  return `${e.status ?? "?"}:${e.codigo ?? e.message}`;
}

/** Lo que deja `marcar_gestionado`, sin la gestión (esa la pone cada prueba con su fecha). */
async function marcarComoGestionada(o: {
  oportunidadId: string;
  borradorId: string;
}) {
  await prisma.growthBorrador.update({
    where: { id: o.borradorId },
    data: { estado: "gestionado" },
  });
  await prisma.growthOportunidad.update({
    where: { id: o.oportunidadId },
    data: { estado: "gestionada" },
  });
}

const estadoDe = async (id: string) =>
  (await prisma.growthOportunidad.findUniqueOrThrow({ where: { id } })).estado;

describe("carreras de Growth (Postgres real)", () => {
  beforeEach(async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    await sembrar();
  });

  describe("dos aprobaciones a la vez", () => {
    it("del MISMO dominio: una se aprueba y la otra recibe 409 dominio_ya_aprobado (10 rondas)", async () => {
      for (let ronda = 0; ronda < 10; ronda++) {
        await sembrar();
        const a = await oportunidadConBorrador({ dominio: "mismo.com" });
        const b = await oportunidadConBorrador({ dominio: "mismo.com" });

        const r = await Promise.allSettled([aprobar(a), aprobar(b)]);

        expect(r.map(resumen).sort(), `ronda ${ronda}`).toEqual([
          "409:dominio_ya_aprobado",
          "ok:aprobada",
        ]);
        expect(
          await prisma.growthOportunidad.count({
            where: { dominio: "mismo.com", estado: "aprobada" },
          }),
          `ronda ${ronda}`
        ).toBe(1);
      }
    });

    it("con el tope semanal en 1 y dominios distintos, solo una (10 rondas)", async () => {
      for (let ronda = 0; ronda < 10; ronda++) {
        await sembrar();
        await ponerAjuste("topeSemanal", 1);
        const a = await oportunidadConBorrador({ dominio: "uno.com" });
        const b = await oportunidadConBorrador({ dominio: "dos.com" });

        const r = await Promise.allSettled([aprobar(a), aprobar(b)]);

        expect(r.map(resumen).sort(), `ronda ${ronda}`).toEqual([
          "409:tope_semanal",
          "ok:aprobada",
        ]);
        expect(
          await prisma.growthOportunidad.count({
            where: { estado: "aprobada" },
          })
        ).toBe(1);
      }
    });

    it("cinco a la vez con el tope en 3: se aprueban exactamente tres", async () => {
      await ponerAjuste("topeSemanal", 3);
      const todas = await Promise.all(
        ["a.com", "b.com", "c.com", "d.com", "e.com"].map((dominio) =>
          oportunidadConBorrador({ dominio })
        )
      );

      const r = await Promise.allSettled(todas.map(aprobar));

      expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(3);
      expect(
        r
          .filter((x) => x.status === "rejected")
          .map(resumen)
          .every((m) => m === "409:tope_semanal")
      ).toBe(true);
      expect(
        await prisma.growthOportunidad.count({ where: { estado: "aprobada" } })
      ).toBe(3);
    });

    it("la misma oportunidad dos veces: una aprueba y la otra es un 409, nunca un 500", async () => {
      const a = await oportunidadConBorrador({ dominio: "doble.com" });
      const r = await Promise.allSettled([aprobar(a), aprobar(a)]);
      const resumenes = r.map(resumen).sort();
      expect(resumenes[0]).toMatch(/^409:/);
      expect(resumenes[1]).toBe("ok:aprobada");
    });
  });

  describe("marcar como gestionado y aprobar a la vez (mismo dominio)", () => {
    it("la otra oportunidad del dominio no se aprueba en ningún orden (10 rondas)", async () => {
      for (let ronda = 0; ronda < 10; ronda++) {
        await sembrar();
        const x = await oportunidadConBorrador({
          dominio: "gest.com",
          estado: "aprobada",
          borrador: "aprobado",
        });
        const y = await oportunidadConBorrador({ dominio: "gest.com" });

        const r = await Promise.allSettled([
          decidir(
            x.oportunidadId,
            { accion: "marcar_gestionado", canal: "email" },
            ADMIN
          ),
          aprobar(y),
        ]);

        expect(resumen(r[0]!), `ronda ${ronda}`).toBe("ok:gestionada");
        // Aprobada la X, o con su gestión de hoy: Y siempre se queda fuera.
        expect(resumen(r[1]!), `ronda ${ronda}`).toMatch(
          /^409:(dominio_ya_aprobado|dominio_en_enfriamiento)$/
        );
        expect(await estadoDe(y.oportunidadId)).toBe("pendiente_aprobacion");
      }
    });
  });

  describe("aprobar contra algo que edita en otro orden de filas", () => {
    /**
     * Imita a `editarBorrador`: primero el borrador, luego la oportunidad (al
     * revés que aprobar). La espera deja que `aprobar` coja la oportunidad
     * antes de que la edición la pida: el cruce que daba 40P01.
     */
    async function editarEnOtroOrden(
      ids: { oportunidadId: string; borradorId: string },
      conCerrojos: boolean
    ) {
      return prisma.$transaction(
        async (tx) => {
          if (conCerrojos) {
            await adquirirCerrojosDeAprobacion(tx, { conocimiento: true });
          }
          await tx.growthBorrador.update({
            where: { id: ids.borradorId },
            data: { asunto: "Asunto corregido a mano" },
          });
          await new Promise((siguiente) => setTimeout(siguiente, 400));
          await tx.growthOportunidad.updateMany({
            where: { id: ids.oportunidadId },
            data: { titulo: "Título corregido a mano" },
          });
        },
        { timeout: 20_000 }
      );
    }

    async function cruzar(conCerrojos: boolean) {
      const a = await oportunidadConBorrador({ dominio: "cruce.com" });
      const edicion = editarEnOtroOrden(a, conCerrojos);
      // Que la edición ya tenga su primera fila cuando entra aprobar.
      await new Promise((siguiente) => setTimeout(siguiente, 100));
      const aprobacion = aprobar(a);
      return Promise.allSettled([edicion, aprobacion]);
    }

    it("sin cerrojo el cruce sí da un deadlock (el control: la prueba discrimina)", async () => {
      // La edición simulada NO toma el cerrojo; `aprobar` sí lo toma, pero la
      // edición ya tiene su fila: aprobar espera la del borrador mientras la
      // edición espera la de la oportunidad.
      const [edicion, aprobacion] = await cruzar(false);
      const errores = [edicion, aprobacion]
        .filter((x) => x.status === "rejected")
        .map((x) => (x as PromiseRejectedResult).reason);
      expect(errores.length).toBeGreaterThan(0);
      // Y el error real de Prisma es de los que la ruta convierte en 409.
      expect(errores.every((e) => esConflictoDeConcurrencia(e))).toBe(true);
    });

    it("con los cerrojos en el mismo orden, no hay deadlock: la edición termina y aprobar espera su turno (5 rondas)", async () => {
      for (let ronda = 0; ronda < 5; ronda++) {
        await sembrar();
        const [edicion, aprobacion] = await cruzar(true);
        expect(edicion.status, `ronda ${ronda}`).toBe("fulfilled");
        // Aprobar corre después de la edición: se aprueba (la edición no tocó
        // lo que se evalúa) o, como mucho, es un 409 de negocio. Nunca un 500.
        const r = resumen(
          aprobacion as PromiseSettledResult<{ estado: string }>
        );
        expect(r, `ronda ${ronda}`).toMatch(/^(ok:aprobada|409:\w+)$/);
      }
    });
  });

  describe("la plantilla repetida: solo lo anterior y lo que se dijo", () => {
    const REPETIDO =
      "Hola, soy el fundador de Alhabla, una recepcionista de IA para peluquerías. Atiende las llamadas, mira el calendario y reserva la cita. Nos encantaría aparecer en vuestro listado de herramientas para negocios pequeños, si os parece bien. Un saludo cordial.";

    it("un borrador POSTERIOR parecido, aunque esté bloqueado o descartado, no impide aprobar el anterior", async () => {
      const a = await oportunidadConBorrador({
        dominio: "a.com",
        texto: REPETIDO,
        creadoEn: hace(5),
      });
      await oportunidadConBorrador({
        dominio: "b.com",
        estado: "bloqueada",
        borrador: "bloqueado",
        texto: REPETIDO,
        creadoEn: hace(1),
      });
      const r = await aprobar(a);
      expect(r.estado).toBe("aprobada");
    });

    it("tampoco uno posterior que esté pendiente: solo cuenta lo escrito ANTES", async () => {
      const a = await oportunidadConBorrador({
        dominio: "a.com",
        texto: REPETIDO,
        creadoEn: hace(5),
      });
      await oportunidadConBorrador({
        dominio: "b.com",
        texto: REPETIDO,
        creadoEn: hace(1),
      });
      const r = await aprobar(a);
      expect(r.estado).toBe("aprobada");
    });

    it("uno anterior bloqueado o descartado tampoco cuenta: nunca salió", async () => {
      const a = await oportunidadConBorrador({
        dominio: "a.com",
        texto: REPETIDO,
        creadoEn: hace(1),
      });
      await oportunidadConBorrador({
        dominio: "b.com",
        estado: "bloqueada",
        borrador: "bloqueado",
        texto: REPETIDO,
        creadoEn: hace(5),
      });
      expect((await aprobar(a)).estado).toBe("aprobada");
    });

    it("un mensaje ya enviado sigue comparándose aunque haya más de 30 borradores posteriores", async () => {
      const enviado = await oportunidadConBorrador({
        dominio: "enviado.com",
        estado: "aprobada",
        borrador: "aprobado",
        texto: REPETIDO,
        creadoEn: hace(100),
      });
      await prisma.growthBorrador.update({
        where: { id: enviado.borradorId },
        data: { estado: "gestionado" },
      });
      for (let i = 0; i < 35; i++) {
        await oportunidadConBorrador({
          dominio: `ruido${i}.com`,
          estado: "bloqueada",
          borrador: "bloqueado",
          creadoEn: hace(60 - i),
        });
      }
      const a = await oportunidadConBorrador({
        dominio: "nueva.com",
        texto: REPETIDO,
        creadoEn: hace(1),
      });

      await expect(aprobar(a)).rejects.toMatchObject({
        status: 409,
        codigo: "cumplimiento",
      });
      expect(await estadoDe(a.oportunidadId)).toBe("bloqueada");
    });

    it("lo enviado hace más de 180 días ya no cuenta", async () => {
      const viejo = await oportunidadConBorrador({
        dominio: "viejo.com",
        estado: "aprobada",
        borrador: "aprobado",
        texto: REPETIDO,
        creadoEn: hace(200),
      });
      await prisma.growthBorrador.update({
        where: { id: viejo.borradorId },
        data: { estado: "gestionado" },
      });
      const a = await oportunidadConBorrador({
        dominio: "nueva.com",
        texto: REPETIDO,
        creadoEn: hace(1),
      });
      expect((await aprobar(a)).estado).toBe("aprobada");
    });

    it("un parecido real con un pendiente anterior sí bloquea al aprobar", async () => {
      await oportunidadConBorrador({
        dominio: "anterior.com",
        texto: REPETIDO,
        creadoEn: hace(5),
      });
      const a = await oportunidadConBorrador({
        dominio: "nueva.com",
        texto: REPETIDO,
        creadoEn: hace(1),
      });
      await expect(aprobar(a)).rejects.toMatchObject({
        status: 409,
        codigo: "cumplimiento",
      });
    });
  });

  describe("la agenda no bloquea el texto ni cambia ningún estado", () => {
    it("un dominio contactado hace 10 días da 409 dominio_en_enfriamiento y todo queda como estaba", async () => {
      const previo = await oportunidadConBorrador({
        dominio: "frio.com",
        estado: "aprobada",
        borrador: "aprobado",
      });
      await marcarComoGestionada(previo);
      await prisma.growthGestion.create({
        data: {
          borradorId: previo.borradorId,
          canal: "email",
          dominio: "frio.com",
          hechaEn: hace(10),
        },
      });
      const a = await oportunidadConBorrador({ dominio: "frio.com" });
      const antes = await prisma.growthRevisionCumplimiento.count();

      await expect(aprobar(a)).rejects.toMatchObject({
        status: 409,
        codigo: "dominio_en_enfriamiento",
      });

      expect(await estadoDe(a.oportunidadId)).toBe("pendiente_aprobacion");
      const borrador = await prisma.growthBorrador.findUniqueOrThrow({
        where: { id: a.borradorId },
      });
      expect(borrador.estado).toBe("pendiente_aprobacion");
      expect(await prisma.growthRevisionCumplimiento.count()).toBe(antes);
      expect(
        await prisma.growthDecision.count({
          where: { oportunidadId: a.oportunidadId },
        })
      ).toBe(0);
    });

    it("pasados los 90 días se vuelve a poder", async () => {
      const previo = await oportunidadConBorrador({
        dominio: "tibio.com",
        estado: "aprobada",
        borrador: "aprobado",
      });
      await marcarComoGestionada(previo);
      await prisma.growthGestion.create({
        data: {
          borradorId: previo.borradorId,
          canal: "email",
          dominio: "tibio.com",
          hechaEn: hace(95),
        },
      });
      const a = await oportunidadConBorrador({ dominio: "tibio.com" });
      expect((await aprobar(a)).estado).toBe("aprobada");
    });
  });

  describe("entradas que daban 500 o esquivaban los duplicados", () => {
    const entrada = (cambios: Record<string, unknown>) =>
      ({
        url: "https://ejemplo.com/pagina",
        titulo: "Título",
        extracto: "Extracto",
        objetivoPrincipal: "BACKLINKS",
        ...cambios,
      }) as never;

    it("ejemplo.com. y www.ejemplo.com/ son la misma página que ejemplo.com", async () => {
      const primera = await crearOportunidad(entrada({}));
      const conPunto = await crearOportunidad(
        entrada({ url: "https://ejemplo.com./pagina" })
      );
      const conWww = await crearOportunidad(
        entrada({ url: "https://www.ejemplo.com/pagina/?utm_source=x#arriba" })
      );
      expect(primera.creada).toBe(true);
      expect(conPunto).toMatchObject({ creada: false, id: primera.id });
      expect(conWww).toMatchObject({ creada: false, id: primera.id });
      expect(await prisma.growthOportunidad.count()).toBe(1);
    });

    it("guarda la URL original limpia (con www), y el dominio y la clave normalizados", async () => {
      const r = await crearOportunidad(
        entrada({ url: "https://www.Ejemplo.com/Pagina/?utm_source=x&a=1#top" })
      );
      const fila = await prisma.growthOportunidad.findUniqueOrThrow({
        where: { id: r.id },
      });
      expect(fila.url).toBe("https://www.ejemplo.com/Pagina/?a=1");
      expect(fila.dominio).toBe("ejemplo.com");
    });

    it("un extracto con un emoji justo en el límite de 500 se guarda bien formado", async () => {
      const r = await crearOportunidad(
        entrada({ extracto: `${"a".repeat(499)}😀 y mucho más texto detrás` })
      );
      const fila = await prisma.growthOportunidad.findUniqueOrThrow({
        where: { id: r.id },
      });
      expect(Array.from(fila.extracto)).toHaveLength(500);
      expect(fila.extracto.endsWith("😀")).toBe(true);
    });

    it("un título con NUL y un extracto con un sustituto suelto no dan 500", async () => {
      const r = await crearOportunidad(
        entrada({
          url: "https://nul.com/p",
          titulo: "Tí\u0000tulo",
          extracto: "ex\uD83Dtracto",
          datos: { nota: "n\u0000ota" },
        })
      );
      const fila = await prisma.growthOportunidad.findUniqueOrThrow({
        where: { id: r.id },
      });
      expect(fila.titulo).toBe("Título");
      expect(fila.extracto).toBe(`ex${REEMPLAZO}tracto`);
      expect(fila.datos).toEqual({ nota: "nota" });
    });
  });
});
