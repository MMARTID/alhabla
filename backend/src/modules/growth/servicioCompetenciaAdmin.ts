import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import {
  analisisCaducado,
  nombrePorDefectoDeDominio,
  numeroDeDatos,
  porNombre,
} from "./competidores.js";
import {
  dominioNormalizado,
  type AltaDeCompetidorBody,
  type CambioDeCompetidorBody,
  type DatoDeCompetidor,
  type EstadoDeCompetidor,
  type OrigenDeCompetidor,
  type RevisionDeAnalisisBody,
} from "./esquemas.js";
import {
  ErrorDeGrowth,
  dominioDeUrl,
  limpiarJsonParaBd,
  limpiarTextoParaBd,
  urlParaAbrir,
  validarUrlExterna,
} from "./service.js";

/**
 * La competencia vista por el administrador (`/growth/admin/competidores`):
 * alta por URL, edición, baja y el ciclo propuesto → por analizar →
 * analizado → revisado. Es INTELIGENCIA INTERNA: nada de lo que se guarda aquí
 * se puede citar en un borrador (la regla 3 solo admite `comparativa.*`, que
 * salen de `comparativas.ts`).
 *
 * El backend NUNCA hace una petición saliente a la URL de un competidor: la
 * lee el agente con su propia herramienta de lectura de páginas.
 *
 * Concurrencia: todo cambio de estado de un competidor toma antes un cerrojo
 * de Postgres por competidor (`bloquearCompetidor`) dentro de una transacción,
 * el mismo que toma el agente al guardar un análisis. Dos altas a la vez del
 * mismo dominio las resuelve el índice único (409, no 500).
 */

// ── Formas de respuesta (contrato de la Fase 2a) ─────────────────────────

export type ResumenDeAnalisis = {
  id: string;
  version: number;
  creadoEn: Date;
  revisadoEn: Date | null;
  numDatos: number;
  caducado: boolean;
};

export type CompetidorResumen = {
  id: string;
  nombre: string;
  dominio: string;
  url: string | null;
  notas: string | null;
  origen: OrigenDeCompetidor;
  estado: EstadoDeCompetidor;
  creadoEn: Date;
  analisisSolicitadoEn: Date | null;
  /** Oportunidades en el dominio del competidor o en sus subdominios. */
  oportunidades: number;
  /** Oportunidades cuyo `datos.competidoresMencionados` incluye su dominio. */
  menciones: number;
  /** El último análisis. */
  analisis: ResumenDeAnalisis | null;
};

export type AnalisisDeCompetidor = {
  id: string;
  version: number;
  resumen: string;
  datos: DatoDeCompetidor[];
  creadoEn: Date;
  creadoPor: string;
  revisadoEn: Date | null;
  notaDeRevision: string | null;
};

export type CompetidorDetalle = CompetidorResumen & {
  ultimoAnalisis: AnalisisDeCompetidor | null;
  /** De la más nueva a la más vieja. */
  versiones: {
    id: string;
    version: number;
    creadoEn: Date;
    revisadoEn: Date | null;
    numDatos: number;
  }[];
};

// ── Piezas comunes ───────────────────────────────────────────────────────

const SELECCION_DE_COMPETIDOR = {
  id: true,
  nombre: true,
  dominio: true,
  url: true,
  notas: true,
  origen: true,
  estado: true,
  creadoEn: true,
  analisisSolicitadoEn: true,
} satisfies Prisma.GrowthCompetidorSelect;

const SELECCION_DE_ANALISIS_COMPLETO = {
  id: true,
  version: true,
  resumen: true,
  datos: true,
  creadoEn: true,
  creadoPor: true,
  revisadoEn: true,
  notaDeRevision: true,
} satisfies Prisma.GrowthCompetidorAnalisisSelect;

type FilaDeCompetidor = Prisma.GrowthCompetidorGetPayload<{
  select: typeof SELECCION_DE_COMPETIDOR;
}>;
type FilaDeAnalisis = Prisma.GrowthCompetidorAnalisisGetPayload<{
  select: typeof SELECCION_DE_ANALISIS_COMPLETO;
}>;

/**
 * Cerrojo de Postgres por competidor, hasta el final de la transacción. Lo
 * toman el agente al guardar un análisis y el administrador al cambiar un
 * estado: sin él, «revisar» podría marcar como revisado un análisis que el
 * agente acaba de sustituir.
 */
export async function bloquearCompetidor(
  tx: Prisma.TransactionClient,
  id: string
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`growth_competidor:${id}`}))`;
}

function resumenDeAnalisis(
  fila: Pick<FilaDeAnalisis, "id" | "version" | "creadoEn" | "revisadoEn"> & {
    datos: Prisma.JsonValue;
  },
  ahora: Date
): ResumenDeAnalisis {
  return {
    id: fila.id,
    version: fila.version,
    creadoEn: fila.creadoEn,
    revisadoEn: fila.revisadoEn,
    numDatos: numeroDeDatos(fila.datos),
    caducado: analisisCaducado(fila.creadoEn, ahora),
  };
}

function analisisCompleto(fila: FilaDeAnalisis): AnalisisDeCompetidor {
  return {
    id: fila.id,
    version: fila.version,
    resumen: fila.resumen,
    // Se validó con Zod al guardarlo; por si una fila no lo es, nunca un 500.
    datos: Array.isArray(fila.datos) ? (fila.datos as DatoDeCompetidor[]) : [],
    creadoEn: fila.creadoEn,
    creadoPor: fila.creadoPor,
    revisadoEn: fila.revisadoEn,
    notaDeRevision: fila.notaDeRevision,
  };
}

/** ¿Cuenta la oportunidad de `dominioOportunidad` como del competidor? Mismo criterio que la puerta dura. */
function esDelCompetidor(dominioOportunidad: string, dominio: string) {
  return (
    dominioOportunidad === dominio || dominioOportunidad.endsWith(`.${dominio}`)
  );
}

/** Oportunidades por competidor (su dominio y sus subdominios), en una sola consulta. */
async function contarOportunidades(
  dominios: readonly string[]
): Promise<Map<string, number>> {
  const cuentas = new Map(dominios.map((d) => [d, 0]));
  if (dominios.length === 0) return cuentas;
  const grupos = await prisma.growthOportunidad.groupBy({
    by: ["dominio"],
    where: {
      OR: dominios.flatMap((dominio) => [
        { dominio },
        { dominio: { endsWith: `.${dominio}` } },
      ]),
    },
    _count: { _all: true },
  });
  for (const dominio of dominios) {
    cuentas.set(
      dominio,
      grupos
        .filter((g) => esDelCompetidor(g.dominio, dominio))
        .reduce((suma, g) => suma + g._count._all, 0)
    );
  }
  return cuentas;
}

/**
 * Menciones por competidor: Prisma no agrupa por los elementos de un array
 * dentro de un JSON, así que una cuenta por competidor (decenas como mucho:
 * los sembrados, los del administrador y hasta 20 propuestos).
 */
async function contarMenciones(
  dominios: readonly string[]
): Promise<Map<string, number>> {
  const cuentas = await Promise.all(
    dominios.map(
      async (dominio) =>
        [
          dominio,
          await prisma.growthOportunidad.count({
            where: {
              datos: {
                path: ["competidoresMencionados"],
                array_contains: [dominio],
              },
            },
          }),
        ] as const
    )
  );
  return new Map(cuentas);
}

function aResumen(
  fila: FilaDeCompetidor,
  ultimo: Parameters<typeof resumenDeAnalisis>[0] | null,
  oportunidades: number,
  menciones: number,
  ahora: Date
): CompetidorResumen {
  return {
    id: fila.id,
    nombre: fila.nombre,
    dominio: fila.dominio,
    url: fila.url,
    notas: fila.notas,
    origen: fila.origen as OrigenDeCompetidor,
    estado: fila.estado as EstadoDeCompetidor,
    creadoEn: fila.creadoEn,
    analisisSolicitadoEn: fila.analisisSolicitadoEn,
    oportunidades,
    menciones,
    analisis: ultimo ? resumenDeAnalisis(ultimo, ahora) : null,
  };
}

// ── Lecturas ─────────────────────────────────────────────────────────────

/** `GET /growth/admin/competidores`: todos, también los `propuesto`, por nombre. */
export async function listarCompetidores(): Promise<{
  data: CompetidorResumen[];
}> {
  const ahora = new Date();
  const competidores = await prisma.growthCompetidor.findMany({
    orderBy: [{ nombre: "asc" }, { id: "asc" }],
    select: {
      ...SELECCION_DE_COMPETIDOR,
      // Solo el último análisis de cada uno.
      analisis: {
        orderBy: { version: "desc" },
        take: 1,
        select: {
          id: true,
          version: true,
          creadoEn: true,
          revisadoEn: true,
          datos: true,
        },
      },
    },
  });
  if (competidores.length === 0) return { data: [] };

  const dominios = competidores.map((c) => c.dominio);
  const [oportunidades, menciones] = await Promise.all([
    contarOportunidades(dominios),
    contarMenciones(dominios),
  ]);

  return {
    data: porNombre(competidores).map(({ analisis, ...fila }) =>
      aResumen(
        fila,
        analisis[0] ?? null,
        oportunidades.get(fila.dominio) ?? 0,
        menciones.get(fila.dominio) ?? 0,
        ahora
      )
    ),
  };
}

/** `GET /growth/admin/competidores/:id`. */
export async function detalleDeCompetidor(
  id: string
): Promise<CompetidorDetalle> {
  const ahora = new Date();
  const fila = await prisma.growthCompetidor.findUnique({
    where: { id },
    select: {
      ...SELECCION_DE_COMPETIDOR,
      // Como mucho 10 versiones (el agente poda el resto al guardar).
      analisis: {
        orderBy: { version: "desc" },
        select: SELECCION_DE_ANALISIS_COMPLETO,
      },
    },
  });
  if (!fila) throw new ErrorDeGrowth(404, "El competidor no existe.");

  const { analisis, ...competidor } = fila;
  const [oportunidades, menciones] = await Promise.all([
    contarOportunidades([competidor.dominio]),
    contarMenciones([competidor.dominio]),
  ]);
  const ultimo = analisis[0] ?? null;
  return {
    ...aResumen(
      competidor,
      ultimo,
      oportunidades.get(competidor.dominio) ?? 0,
      menciones.get(competidor.dominio) ?? 0,
      ahora
    ),
    ultimoAnalisis: ultimo ? analisisCompleto(ultimo) : null,
    versiones: analisis.map((a) => ({
      id: a.id,
      version: a.version,
      creadoEn: a.creadoEn,
      revisadoEn: a.revisadoEn,
      numDatos: numeroDeDatos(a.datos),
    })),
  };
}

/** `GET /growth/admin/competidores/:id/analisis/:analisisId`: una versión concreta. */
export async function detalleDeAnalisis(
  competidorId: string,
  analisisId: string
): Promise<AnalisisDeCompetidor> {
  const fila = await prisma.growthCompetidorAnalisis.findFirst({
    where: { id: analisisId, competidorId },
    select: SELECCION_DE_ANALISIS_COMPLETO,
  });
  if (!fila) throw new ErrorDeGrowth(404, "El análisis no existe.");
  return analisisCompleto(fila);
}

// ── Alta, edición y baja ─────────────────────────────────────────────────

function competidorExistente(id: string | undefined) {
  return new ErrorDeGrowth(
    409,
    "Ya existe un competidor con ese dominio.",
    "competidor_existente",
    id ? { id } : undefined
  );
}

function codigoDePrisma(error: unknown): string | undefined {
  return (error as { code?: string } | null)?.code;
}

/**
 * `POST /growth/admin/competidores`: pegas una URL y el agente la analiza en
 * el siguiente run. El dominio sale de la URL; el nombre, si no lo das, de su
 * primera etiqueta. Entra como `por_analizar`, `origen = manual`.
 */
export async function darDeAltaUnCompetidor(
  entradaCruda: AltaDeCompetidorBody
): Promise<CompetidorDetalle> {
  const entrada = limpiarJsonParaBd(entradaCruda);
  // 400 `dominio_propio` para alhabla.ai y sus subdominios, y 400 para
  // localhost, IP y hosts internos.
  validarUrlExterna(entrada.url);
  const dominio = dominioDeUrl(entrada.url);
  if (!dominioNormalizado.safeParse(dominio).success) {
    throw new ErrorDeGrowth(400, "La URL no tiene un dominio válido.");
  }

  const previo = await prisma.growthCompetidor.findUnique({
    where: { dominio },
    select: { id: true },
  });
  if (previo) throw competidorExistente(previo.id);

  let id: string;
  try {
    const creado = await prisma.growthCompetidor.create({
      data: {
        nombre: entrada.nombre ?? nombrePorDefectoDeDominio(dominio),
        dominio,
        url: urlParaAbrir(entrada.url),
        notas: entrada.notas ? entrada.notas : null,
        origen: "manual",
        estado: "por_analizar",
        analisisSolicitadoEn: new Date(),
      },
      select: { id: true },
    });
    id = creado.id;
  } catch (error) {
    // Dos altas a la vez del mismo dominio: gana la primera (índice único).
    if (codigoDePrisma(error) === "P2002") {
      const ganador = await prisma.growthCompetidor.findUnique({
        where: { dominio },
        select: { id: true },
      });
      throw competidorExistente(ganador?.id);
    }
    throw error;
  }
  return detalleDeCompetidor(id);
}

/** `PATCH /growth/admin/competidores/:id`. El dominio no cambia. */
export async function editarCompetidor(
  id: string,
  cambiosCrudos: CambioDeCompetidorBody
): Promise<CompetidorDetalle> {
  const cambios = limpiarJsonParaBd(cambiosCrudos);
  const competidor = await prisma.growthCompetidor.findUnique({
    where: { id },
    select: { id: true, dominio: true },
  });
  if (!competidor) throw new ErrorDeGrowth(404, "El competidor no existe.");

  const data: Prisma.GrowthCompetidorUpdateInput = {};
  if (cambios.nombre !== undefined) data.nombre = cambios.nombre;
  if (cambios.notas !== undefined) data.notas = cambios.notas || null;
  if (cambios.url !== undefined) {
    if (cambios.url === null) {
      data.url = null;
    } else {
      validarUrlExterna(cambios.url);
      if (dominioDeUrl(cambios.url) !== competidor.dominio) {
        throw new ErrorDeGrowth(
          400,
          `La URL debe ser de ${competidor.dominio}: el dominio de un competidor no cambia.`,
          "url_de_otro_dominio"
        );
      }
      data.url = urlParaAbrir(cambios.url);
    }
  }

  await prisma.growthCompetidor.update({ where: { id }, data });
  return detalleDeCompetidor(id);
}

/**
 * `DELETE /growth/admin/competidores/:id`. Quita al competidor y, en cascada,
 * sus análisis. Es también «rechazar» un `propuesto`. Los que siembra el
 * repositorio (`origen = repo`) no se quitan: el sincronizador los volvería a
 * sembrar y la regla 3 quedaría a medias hasta entonces.
 */
export async function quitarCompetidor(id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await bloquearCompetidor(tx, id);
    const competidor = await tx.growthCompetidor.findUnique({
      where: { id },
      select: { origen: true },
    });
    if (!competidor) throw new ErrorDeGrowth(404, "El competidor no existe.");
    if (competidor.origen === "repo") {
      throw new ErrorDeGrowth(
        409,
        "Este competidor viene del repositorio y no se puede quitar desde aquí.",
        "competidor_del_repositorio"
      );
    }
    await tx.growthCompetidor.delete({ where: { id } });
  });
}

// ── Estados ──────────────────────────────────────────────────────────────

function estadoIncorrecto(mensaje: string) {
  return new ErrorDeGrowth(409, mensaje, "estado_incorrecto");
}

/** `POST …/aceptar`: `propuesto → por_analizar`. Desde ahora aplica las reglas duras. */
export async function aceptarCompetidor(
  id: string
): Promise<CompetidorDetalle> {
  await prisma.$transaction(async (tx) => {
    await bloquearCompetidor(tx, id);
    const competidor = await tx.growthCompetidor.findUnique({
      where: { id },
      select: { estado: true },
    });
    if (!competidor) throw new ErrorDeGrowth(404, "El competidor no existe.");
    if (competidor.estado !== "propuesto") {
      throw estadoIncorrecto(
        `Solo se puede aceptar un competidor propuesto (este está ${competidor.estado}).`
      );
    }
    await tx.growthCompetidor.update({
      where: { id },
      data: { estado: "por_analizar", analisisSolicitadoEn: new Date() },
    });
  });
  return detalleDeCompetidor(id);
}

/**
 * `POST …/reanalizar`: `analizado | revisado → por_analizar`. Idempotente si
 * ya lo está (un doble clic no es un error); un `propuesto` primero se acepta.
 */
export async function reanalizarCompetidor(
  id: string
): Promise<CompetidorDetalle> {
  await prisma.$transaction(async (tx) => {
    await bloquearCompetidor(tx, id);
    const competidor = await tx.growthCompetidor.findUnique({
      where: { id },
      select: { estado: true },
    });
    if (!competidor) throw new ErrorDeGrowth(404, "El competidor no existe.");
    if (competidor.estado === "propuesto") {
      throw estadoIncorrecto(
        "Un competidor propuesto primero se acepta; después se analiza."
      );
    }
    if (competidor.estado === "por_analizar") return;
    await tx.growthCompetidor.update({
      where: { id },
      data: { estado: "por_analizar", analisisSolicitadoEn: new Date() },
    });
  });
  return detalleDeCompetidor(id);
}

/**
 * `POST …/analisis/:analisisId/revisar`: el administrador da por bueno el
 * ÚLTIMO análisis (`analizado → revisado`). Revisar uno antiguo es un 409
 * (`analisis_antiguo`): lo que se revisa es lo que el agente dejó más
 * recientemente.
 */
export async function revisarAnalisis(
  id: string,
  analisisId: string,
  cuerpoCrudo: RevisionDeAnalisisBody
): Promise<CompetidorDetalle> {
  const cuerpo = limpiarJsonParaBd(cuerpoCrudo);
  await prisma.$transaction(async (tx) => {
    await bloquearCompetidor(tx, id);
    const competidor = await tx.growthCompetidor.findUnique({
      where: { id },
      select: { estado: true },
    });
    if (!competidor) throw new ErrorDeGrowth(404, "El competidor no existe.");

    const analisis = await tx.growthCompetidorAnalisis.findFirst({
      where: { id: analisisId, competidorId: id },
      select: { id: true, revisadoEn: true },
    });
    if (!analisis) throw new ErrorDeGrowth(404, "El análisis no existe.");

    const ultimo = await tx.growthCompetidorAnalisis.findFirst({
      where: { competidorId: id },
      orderBy: { version: "desc" },
      select: { id: true },
    });
    if (ultimo?.id !== analisis.id) {
      throw new ErrorDeGrowth(
        409,
        "Ese análisis ya no es el último: revisa el más reciente.",
        "analisis_antiguo"
      );
    }
    if (analisis.revisadoEn) {
      throw new ErrorDeGrowth(
        409,
        "Ese análisis ya está revisado.",
        "ya_revisado"
      );
    }
    if (competidor.estado !== "analizado") {
      throw estadoIncorrecto(
        `Solo se revisa un competidor analizado (este está ${competidor.estado}).`
      );
    }

    const ahora = new Date();
    await tx.growthCompetidorAnalisis.update({
      where: { id: analisis.id },
      data: {
        revisadoEn: ahora,
        notaDeRevision: cuerpo.nota ? limpiarTextoParaBd(cuerpo.nota) : null,
      },
    });
    await tx.growthCompetidor.update({
      where: { id },
      data: { estado: "revisado" },
    });
  });
  return detalleDeCompetidor(id);
}
