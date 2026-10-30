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
 * El sincronizador del conocimiento contra Postgres real y con la extracción
 * REAL del repo: el cerrojo asesor, las dos pasadas iguales, el bloqueo de
 * borradores y la ruta entera (token incluido).
 */

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const COMMIT = "a".repeat(40);
const AGENTE = { nombre: "conocimiento-semanal" };

let carga: ResultadoDeConstruccion;

function lote(
  cambios: (
    c: ResultadoDeConstruccion
  ) => Partial<ResultadoDeConstruccion> = () => ({})
) {
  const c = structuredClone(carga);
  const con = { ...c, ...cambios(c) };
  return SincronizarBody.parse({
    commitSha: COMMIT,
    // Como el CLI y el MCP: siempre los tipos de los que el extractor entrega todo.
    tipos: con.tipos,
    afirmaciones: con.afirmaciones,
    competidores: con.competidores,
    nichos: con.nichos,
    paginas: con.paginas,
  });
}

const vigentes = () =>
  prisma.growthAfirmacion.findMany({ where: { vigenteHasta: null } });

/** Claves con más de una vigente: el invariante que el cerrojo y planificar protegen. */
async function clavesRepetidas() {
  const grupos = await prisma.growthAfirmacion.groupBy({
    by: ["clave"],
    where: { vigenteHasta: null },
    _count: { _all: true },
    having: { clave: { _count: { gt: 1 } } },
  });
  return grupos.map((g) => g.clave);
}

describe("sincronizador del conocimiento (Postgres real)", () => {
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

  it("la primera sincronización crea todo lo extraído del repo", async () => {
    const r = await sincronizarConocimiento(lote(), { agente: AGENTE });

    expect(r.sinCambios).toBe(false);
    expect(r.nuevas).toHaveLength(carga.afirmaciones.length);
    expect(await vigentes()).toHaveLength(carga.afirmaciones.length);
    expect(await prisma.growthCompetidor.count()).toBe(
      carga.competidores.length
    );
    const nichos = await prisma.growthNicho.findMany();
    expect(nichos).toHaveLength(carga.nichos.length);
    expect(
      nichos.every((n) => n.estado === "activo" && n.origen === "web_sectores")
    ).toBe(true);
    expect(await prisma.growthPagina.count()).toBe(carga.paginas.length);

    const pro = await prisma.growthAfirmacion.findFirst({
      where: { clave: "precio.plan.pro", vigenteHasta: null },
    });
    expect(pro).toMatchObject({ tipo: "precio", commitSha: COMMIT });
    expect(pro?.texto).toContain("139 €");

    const snapshot = await prisma.growthAjuste.findUnique({
      where: { clave: "sistema.conocimiento" },
    });
    expect(snapshot?.valor).toMatchObject({
      commitSha: COMMIT,
      vigentes: carga.afirmaciones.length,
    });
    expect(
      await prisma.growthDecision.count({
        where: { accion: "conocimiento_sincronizado" },
      })
    ).toBe(1);
  });

  it("la segunda sincronización igual no cambia nada", async () => {
    await sincronizarConocimiento(lote(), { agente: AGENTE });
    const filasAntes = await prisma.growthAfirmacion.findMany({
      orderBy: { id: "asc" },
    });

    const r = await sincronizarConocimiento(lote(), { agente: AGENTE });

    expect(r.sinCambios).toBe(true);
    expect(r.iguales).toBe(carga.afirmaciones.length);
    expect(
      await prisma.growthAfirmacion.findMany({ orderBy: { id: "asc" } })
    ).toEqual(filasAntes);
    expect(await prisma.growthDecision.count()).toBe(1);
    expect(await clavesRepetidas()).toEqual([]);
  });

  it("dos sincronizaciones a la vez no duplican ninguna afirmación vigente (cerrojo asesor)", async () => {
    const resultados = await Promise.all([
      sincronizarConocimiento(lote(), { agente: { nombre: "a" } }),
      sincronizarConocimiento(lote(), { agente: { nombre: "b" } }),
      sincronizarConocimiento(lote(), { agente: { nombre: "c" } }),
    ]);

    expect(await clavesRepetidas()).toEqual([]);
    expect(await vigentes()).toHaveLength(carga.afirmaciones.length);
    // Se serializaron: una creó todo y las otras vieron que no había nada que hacer.
    expect(resultados.filter((r) => r.nuevas.length > 0)).toHaveLength(1);
    expect(resultados.filter((r) => r.sinCambios)).toHaveLength(2);
    expect(await prisma.growthCompetidor.count()).toBe(
      carga.competidores.length
    );
    expect(await prisma.growthPagina.count()).toBe(carga.paginas.length);
  }, 30_000);

  describe("cuando cambia el repo", () => {
    const conPrecioNuevo = () =>
      lote((c) => ({
        afirmaciones: c.afirmaciones.map((a) =>
          a.clave === "precio.plan.pro"
            ? {
                ...a,
                texto: "Plan Pro: 149 € + IVA al mes, 600 minutos incluidos.",
              }
            : a
        ),
      }));

    async function prepararBorradores() {
      await crearFuente();
      await crearOportunidad({
        id: "pendiente",
        estado: "pendiente_aprobacion",
      });
      await crearBorrador({
        id: "b_pendiente",
        oportunidadId: "pendiente",
        estado: "pendiente_aprobacion",
        afirmaciones: ["precio.plan.pro", "funcion.registro_de_llamadas"],
      });
      await crearOportunidad({ id: "aprobada", estado: "aprobada" });
      await crearBorrador({
        id: "b_aprobado",
        oportunidadId: "aprobada",
        estado: "aprobado",
        afirmaciones: ["precio.plan.pro"],
      });
      await crearOportunidad({ id: "otra", estado: "pendiente_aprobacion" });
      await crearBorrador({
        id: "b_otra",
        oportunidadId: "otra",
        estado: "pendiente_aprobacion",
        afirmaciones: ["precio.plan.inicio"],
      });
      await crearOportunidad({ id: "gestionada", estado: "gestionada" });
      await crearBorrador({
        id: "b_gestionado",
        oportunidadId: "gestionada",
        estado: "gestionado",
        afirmaciones: ["precio.plan.pro"],
      });
    }

    it("versiona la afirmación y bloquea solo los borradores en cola que la citan", async () => {
      await sincronizarConocimiento(lote(), { agente: AGENTE });
      await prepararBorradores();

      const r = await sincronizarConocimiento(conPrecioNuevo(), {
        agente: AGENTE,
      });

      expect(r.modificadas).toEqual([
        { clave: "precio.plan.pro", campos: ["texto"], semantico: true },
      ]);
      const versiones = await prisma.growthAfirmacion.findMany({
        where: { clave: "precio.plan.pro" },
        orderBy: { vigenteDesde: "asc" },
      });
      expect(versiones).toHaveLength(2);
      expect(versiones[0].vigenteHasta).not.toBeNull();
      expect(versiones[1].vigenteHasta).toBeNull();
      expect(versiones[0].vigenteHasta).toEqual(versiones[1].vigenteDesde);

      const estados = Object.fromEntries(
        (await prisma.growthBorrador.findMany()).map((b) => [b.id, b.estado])
      );
      expect(estados).toEqual({
        b_pendiente: "bloqueado",
        b_aprobado: "bloqueado",
        b_otra: "pendiente_aprobacion",
        b_gestionado: "gestionado",
      });
      const oportunidades = Object.fromEntries(
        (await prisma.growthOportunidad.findMany()).map((o) => [o.id, o.estado])
      );
      expect(oportunidades).toEqual({
        pendiente: "bloqueada",
        aprobada: "bloqueada",
        otra: "pendiente_aprobacion",
        gestionada: "gestionada",
      });

      const revisiones = await prisma.growthRevisionCumplimiento.findMany();
      expect(revisiones).toHaveLength(2);
      expect(
        revisiones.every(
          (rev) => rev.resultado === "bloquea" && rev.revisor === "reglas"
        )
      ).toBe(true);
      const decisiones = await prisma.growthDecision.findMany({
        where: { accion: "bloquear_por_conocimiento" },
      });
      expect(decisiones.map((d) => d.por)).toEqual(["sistema", "sistema"]);
      expect(await clavesRepetidas()).toEqual([]);
    });

    it("repetir la sincronización con el cambio ya aplicado no vuelve a bloquear ni a versionar", async () => {
      await sincronizarConocimiento(lote(), { agente: AGENTE });
      await prepararBorradores();
      await sincronizarConocimiento(conPrecioNuevo(), { agente: AGENTE });
      const revisiones = await prisma.growthRevisionCumplimiento.count();

      const r = await sincronizarConocimiento(conPrecioNuevo(), {
        agente: AGENTE,
      });

      expect(r.sinCambios).toBe(true);
      expect(r.borradoresBloqueados).toEqual([]);
      expect(await prisma.growthRevisionCumplimiento.count()).toBe(revisiones);
      expect(
        await prisma.growthAfirmacion.count({
          where: { clave: "precio.plan.pro" },
        })
      ).toBe(2);
    });

    it("retirar una clave la cierra (no la borra) y bloquea lo que la citaba", async () => {
      await sincronizarConocimiento(lote(), { agente: AGENTE });
      await prepararBorradores();

      const r = await sincronizarConocimiento(
        lote((c) => ({
          afirmaciones: c.afirmaciones.filter(
            (a) => a.clave !== "funcion.registro_de_llamadas"
          ),
        })),
        { agente: AGENTE }
      );

      expect(r.retiradas).toEqual(["funcion.registro_de_llamadas"]);
      const fila = await prisma.growthAfirmacion.findFirst({
        where: { clave: "funcion.registro_de_llamadas" },
      });
      expect(fila?.vigenteHasta).not.toBeNull();
      expect(
        (
          await prisma.growthBorrador.findUnique({
            where: { id: "b_pendiente" },
          })
        )?.estado
      ).toBe("bloqueado");
    });
  });

  describe("guardas", () => {
    it("un cierre masivo (se pierden 60 páginas) se rechaza con 409 y la base queda como estaba", async () => {
      await sincronizarConocimiento(lote(), { agente: AGENTE });
      const antes = await prisma.growthAfirmacion.findMany({
        orderBy: { id: "asc" },
      });
      const paginas = carga.afirmaciones
        .filter((a) => a.tipo === "pagina")
        .slice(0, 60);
      const fuera = new Set(paginas.map((p) => p.clave));

      const error = await sincronizarConocimiento(
        lote((c) => ({
          afirmaciones: c.afirmaciones.filter((a) => !fuera.has(a.clave)),
        })),
        { agente: AGENTE }
      ).catch((e) => e);

      expect(error).toMatchObject({ status: 409, codigo: "cierres_masivos" });
      expect(
        await prisma.growthAfirmacion.findMany({ orderBy: { id: "asc" } })
      ).toEqual(antes);
    });

    it("un término prohibido dentro de lo que se afirma se rechaza con 400 y no se escribe nada", async () => {
      const error = await sincronizarConocimiento(
        lote((c) => ({
          afirmaciones: c.afirmaciones.map((a) =>
            a.clave === "funcion.registro_de_llamadas"
              ? { ...a, texto: "Registro de llamadas en Telnyx." }
              : a
          ),
        })),
        { agente: AGENTE }
      ).catch((e) => e);

      expect(error).toMatchObject({ status: 400, codigo: "termino_prohibido" });
      expect(await prisma.growthAfirmacion.count()).toBe(0);
      expect(await prisma.growthAjuste.count()).toBe(0);
    });

    it("si algo falla al final, la transacción entera se deshace", async () => {
      // El último paso de la transacción es el log del resumen: si lanza,
      // las afirmaciones, la siembra, el snapshot y la decisión ya escritos
      // tienen que desaparecer con él.
      vi.spyOn(console, "log").mockImplementationOnce(() => {
        throw new Error("fallo simulado");
      });

      await expect(
        sincronizarConocimiento(lote(), { agente: AGENTE })
      ).rejects.toThrow("fallo simulado");

      expect(await prisma.growthAfirmacion.count()).toBe(0);
      expect(await prisma.growthCompetidor.count()).toBe(0);
      expect(await prisma.growthNicho.count()).toBe(0);
      expect(await prisma.growthPagina.count()).toBe(0);
      expect(await prisma.growthAjuste.count()).toBe(0);
      expect(await prisma.growthDecision.count()).toBe(0);
    });
  });

  describe("por la ruta, con un token de verdad", () => {
    let fastify: ReturnType<typeof Fastify>;

    async function tokenCon(alcances: string[]) {
      const { token, hash } = generarTokenDeAgente();
      await prisma.growthTokenAgente.create({
        data: {
          nombre: `token-${alcances.join("-")}`,
          hashToken: hash,
          alcances,
        },
      });
      return { authorization: `Bearer ${token}` };
    }

    const cuerpo = () => ({
      ...lote(),
      fuentes: [{ ruta: "web/src/lib/plans.ts", blobSha: "b".repeat(40) }],
    });

    beforeAll(async () => {
      fastify = Fastify();
      await fastify.register(growthRoutes);
    });

    afterAll(async () => {
      await fastify.close();
    });

    it("el token con el alcance conocimiento sincroniza; uno de leer y escribir, no", async () => {
      const conocimiento = await tokenCon(["conocimiento"]);
      const redactor = await tokenCon(["leer", "escribir"]);

      const rechazada = await fastify.inject({
        method: "POST",
        url: "/growth/agente/conocimiento/sincronizar",
        headers: redactor,
        payload: cuerpo(),
      });
      expect(rechazada.statusCode).toBe(403);
      expect(await prisma.growthAfirmacion.count()).toBe(0);

      const simulada = await fastify.inject({
        method: "POST",
        url: "/growth/agente/conocimiento/sincronizar?simular=true",
        headers: conocimiento,
        payload: cuerpo(),
      });
      expect(simulada.statusCode).toBe(200);
      expect(simulada.json()).toMatchObject({ simulado: true });
      expect(await prisma.growthAfirmacion.count()).toBe(0);

      const aplicada = await fastify.inject({
        method: "POST",
        url: "/growth/agente/conocimiento/sincronizar",
        headers: conocimiento,
        payload: cuerpo(),
      });
      expect(aplicada.statusCode).toBe(200);
      expect(aplicada.json().nuevas).toHaveLength(carga.afirmaciones.length);
      const snapshot = await prisma.growthAjuste.findUnique({
        where: { clave: "sistema.conocimiento" },
      });
      expect(snapshot?.valor).toMatchObject({
        fuentes: [{ ruta: "web/src/lib/plans.ts", blobSha: "b".repeat(40) }],
        sincronizadoPor: "agente:token-conocimiento",
      });
      const decision = await prisma.growthDecision.findFirst({
        where: { accion: "conocimiento_sincronizado" },
      });
      expect(decision?.por).toBe("agente:token-conocimiento");
    });

    it("la lectura del conocimiento pide leer y devuelve lo vigente", async () => {
      await sincronizarConocimiento(lote(), { agente: AGENTE });
      const lector = await tokenCon(["leer"]);

      const r = await fastify.inject({
        method: "GET",
        url: "/growth/agente/conocimiento?clave=precio.plan&limite=10",
        headers: lector,
      });

      expect(r.statusCode).toBe(200);
      const cuerpoDeRespuesta = r.json();
      expect(
        cuerpoDeRespuesta.data.map((a: { clave: string }) => a.clave)
      ).toEqual(["precio.plan.inicio", "precio.plan.pro", "precio.plan.scale"]);
      expect(cuerpoDeRespuesta.snapshot).toMatchObject({
        commitSha: COMMIT,
        obsoleto: false,
      });
      expect(r.headers["cache-control"]).toBe("no-store");
    });
  });
});
