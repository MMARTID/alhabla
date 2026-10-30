import type { GrowthEstadoOportunidad as Estado, Prisma } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import type { ClienteDeBd } from "./contextoDeCumplimiento.js";
import type {
  AbrirEjecucionBody,
  CerrarEjecucionBody,
  DeclaradoPorElAgente,
  ListadoDeEjecucionesQuery,
} from "./esquemas.js";
import {
  agruparDescartesPorCodigo,
  codigoDeDescarteDe,
  conteoPorEstadoDeOportunidad,
  paginar,
  saltoDe,
} from "./servicioAdmin.js";
import { ErrorDeGrowth } from "./service.js";

/**
 * Ejecuciones del agente: cada vez que la sesión programada (o una manual)
 * trabaja abre una `growth_ejecuciones` y la cierra al acabar. El dashboard
 * la enseña en Ejecuciones, y los números que muestra salen de las
 * oportunidades enlazadas por `ejecucionId`, no de lo que declare el agente.
 */

const MS_POR_HORA = 60 * 60 * 1000;

/** Una ejecución que lleva más de esto abierta se da por interrumpida. */
export const HORAS_PARA_DAR_POR_INTERRUMPIDA = 6;

/**
 * Dos aperturas con menos de esto de diferencia (un reintento de red, un
 * doble clic, dos sesiones que arrancan a la vez) son la MISMA apertura: la
 * segunda recibe la ejecución de la primera en vez de abrir otra. Pasada la
 * ventana, una ejecución sin cerrar convive con la nueva hasta las 6 h.
 */
export const VENTANA_DE_APERTURAS_SIMULTANEAS_MS = 30 * 1000;

/** Lo que se anota en `error` de una ejecución que nadie cerró. */
export const ERROR_DE_EJECUCION_INTERRUMPIDA = `interrumpida: sin cerrar tras ${HORAS_PARA_DAR_POR_INTERRUMPIDA} h`;

function objetoJson(valor: Prisma.JsonValue | null | undefined) {
  return valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Prisma.JsonObject)
    : {};
}

// ── Contadores ───────────────────────────────────────────────────────────

/**
 * Lo que de verdad pasó en una ejecución: las oportunidades que creó, por
 * estado y por código de descarte, y cuántos borradores salieron de ellas.
 */
export async function contadoresDeEjecucion(
  cliente: ClienteDeBd,
  ejecucionId: string
) {
  const [grupos, descartadas, borradores] = await Promise.all([
    cliente.growthOportunidad.groupBy({
      by: ["estado"],
      where: { ejecucionId },
      _count: { _all: true },
    }),
    cliente.growthOportunidad.findMany({
      where: { ejecucionId, estado: "descartada" },
      select: { datos: true },
      take: 5000,
    }),
    cliente.growthBorrador.count({
      where: { oportunidad: { ejecucionId } },
    }),
  ]);
  const oportunidadesPorEstado = conteoPorEstadoDeOportunidad(grupos);
  return {
    oportunidadesPorEstado,
    descartesPorMotivo: agruparDescartesPorCodigo(descartadas),
    borradores,
  };
}

/** Las que siguen vivas tras calificar: ni sin calificar ni descartadas. */
const ESTADOS_QUE_NO_SON_CALIFICADAS: readonly Estado[] = [
  "detectada",
  "descartada",
];

/**
 * El `resumen` tal como lo guarda el cierre (y lo devuelven el cierre, el
 * listado y el detalle de ejecuciones). Los números son los que MIDE el
 * servidor; `notas` es la nota del agente tal cual; `declaradoPorElAgente`
 * conserva aparte lo que el agente dijo, con la forma de
 * `ResumenDeEjecucion` sin `notas` (y `descartesPorMotivo` anidado:
 * `{ [codigo]: n }`), y solo aparece si declaró algo.
 */
export type ResumenGuardadoDeEjecucion = {
  candidatas: number;
  calificadas: number;
  descartadas: number;
  descartesPorMotivo: Record<string, number>;
  borradores: number;
  bloqueadas: number;
  notas?: string;
  declaradoPorElAgente?: DeclaradoPorElAgente;
};

/**
 * El `resumen` que guarda el cierre: lo calcula el servidor con recuentos
 * reales (la forma de `ResumenDeEjecucion`). Cero oportunidades es un
 * resultado válido. Lo que declaró el agente se conserva aparte, para poder
 * compararlo, y nunca sustituye a lo medido.
 */
async function resumenDeCierre(
  cliente: ClienteDeBd,
  ejecucionId: string,
  declarado: CerrarEjecucionBody["resumen"]
): Promise<ResumenGuardadoDeEjecucion> {
  const { oportunidadesPorEstado, descartesPorMotivo, borradores } =
    await contadoresDeEjecucion(cliente, ejecucionId);
  const total = Object.values(oportunidadesPorEstado).reduce(
    (suma, n) => suma + n,
    0
  );
  const calificadas = (
    Object.entries(oportunidadesPorEstado) as [Estado, number][]
  )
    .filter(([estado]) => !ESTADOS_QUE_NO_SON_CALIFICADAS.includes(estado))
    .reduce((suma, [, n]) => suma + n, 0);

  const { notas, ...numerosDeclarados } = declarado ?? {};
  return {
    candidatas: total,
    calificadas,
    descartadas: oportunidadesPorEstado.descartada,
    descartesPorMotivo: Object.fromEntries(
      descartesPorMotivo.map((d) => [d.codigo, d.n])
    ),
    borradores,
    bloqueadas: oportunidadesPorEstado.bloqueada,
    ...(notas ? { notas } : {}),
    ...(Object.keys(numerosDeclarados).length > 0
      ? { declaradoPorElAgente: numerosDeclarados }
      : {}),
  };
}

// ── Abrir y cerrar (agente) ──────────────────────────────────────────────

/**
 * `POST /growth/agente/ejecuciones`. Abre una ejecución y, en la misma
 * transacción, cierra como `error` («interrumpida») las que llevan abiertas
 * más de 6 horas: el Mac se durmió o el agente murió sin cerrar, y sin esto
 * se quedarían «en curso» para siempre.
 *
 * Las aperturas se serializan con un cerrojo de Postgres (`pg_advisory_xact_lock`,
 * que se suelta solo al acabar la transacción): sin él, dos peticiones a la
 * vez no se ven entre sí y dejan dos ejecuciones en curso. Con él, la segunda
 * ve la de la primera y, si se abrió hace menos de
 * `VENTANA_DE_APERTURAS_SIMULTANEAS_MS`, la devuelve (`reutilizada: true`) en
 * lugar de abrir otra. Sin esa devolución el cerrojo solo ordenaría las dos
 * creaciones, que seguirían siendo dos.
 */
export async function abrirEjecucion(entrada: AbrirEjecucionBody) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('growth_ejecucion'))`;

      // La hora se toma con el cerrojo ya en la mano: la de antes podría ser
      // anterior a la apertura que acaba de terminar la otra petición.
      const ahora = new Date();
      const limite = new Date(
        ahora.getTime() - HORAS_PARA_DAR_POR_INTERRUMPIDA * MS_POR_HORA
      );

      const { count } = await tx.growthEjecucion.updateMany({
        where: { estado: "en_curso", inicio: { lt: limite } },
        data: {
          estado: "error",
          fin: ahora,
          error: ERROR_DE_EJECUCION_INTERRUMPIDA,
        },
      });
      const recienAbierta = await tx.growthEjecucion.findFirst({
        where: {
          estado: "en_curso",
          inicio: {
            gte: new Date(
              ahora.getTime() - VENTANA_DE_APERTURAS_SIMULTANEAS_MS
            ),
          },
        },
        orderBy: [{ inicio: "desc" }, { id: "desc" }],
        select: { id: true, estado: true, inicio: true },
      });
      if (recienAbierta) {
        return {
          ...recienAbierta,
          interrumpidasCerradas: count,
          reutilizada: true as const,
        };
      }
      const ejecucion = await tx.growthEjecucion.create({
        data: {
          disparador: entrada.disparador,
          estado: "en_curso",
          inicio: ahora,
          versionPrompts: entrada.versionPrompts,
          modulos: entrada.modulos as Prisma.InputJsonObject | undefined,
        },
        select: { id: true, estado: true, inicio: true },
      });
      return {
        ...ejecucion,
        interrumpidasCerradas: count,
        reutilizada: false as const,
      };
    },
    { maxWait: 5000, timeout: 15000 }
  );
}

type Cierre = { id: string; estado: string; inicio: Date; fin: Date | null };

/** Cerrar dos veces con el mismo estado es un reintento de red: 200. Con otro, 409. */
function respuestaDeEjecucionCerrada(
  ejecucion: Cierre & { resumen: Prisma.JsonValue | null },
  estadoPedido: string
) {
  if (ejecucion.estado === estadoPedido) {
    return {
      id: ejecucion.id,
      estado: ejecucion.estado,
      inicio: ejecucion.inicio,
      fin: ejecucion.fin,
      resumen: ejecucion.resumen,
    };
  }
  throw new ErrorDeGrowth(
    409,
    ejecucion.estado === "en_curso"
      ? "La ejecución ha cambiado mientras la cerrabas. Vuelve a intentarlo."
      : `La ejecución ya está cerrada como «${ejecucion.estado}».`,
    "ejecucion_cerrada"
  );
}

/**
 * `POST /growth/agente/ejecuciones/:id/cierre`. Pone `fin`, el estado y un
 * `resumen` calculado por el servidor. Sigue permitido con la pausa activa:
 * una ejecución abierta tiene que poder cerrarse.
 */
export async function cerrarEjecucion(
  id: string,
  entrada: CerrarEjecucionBody
) {
  const ejecucion = await prisma.growthEjecucion.findUnique({
    where: { id },
    select: {
      id: true,
      estado: true,
      inicio: true,
      fin: true,
      resumen: true,
      modulos: true,
    },
  });
  if (!ejecucion) throw new ErrorDeGrowth(404, "La ejecución no existe.");
  if (ejecucion.estado !== "en_curso") {
    return respuestaDeEjecucionCerrada(ejecucion, entrada.estado);
  }

  const resumen = await resumenDeCierre(prisma, id, entrada.resumen);
  const fin = new Date();
  const modulos = {
    ...objetoJson(ejecucion.modulos),
    ...(entrada.modulos ?? {}),
  };

  // Condicional al estado: dos cierres a la vez no pisan al primero.
  const { count } = await prisma.growthEjecucion.updateMany({
    where: { id, estado: "en_curso" },
    data: {
      estado: entrada.estado,
      fin,
      resumen,
      error: entrada.error ?? null,
      ...(Object.keys(modulos).length > 0
        ? { modulos: modulos as Prisma.InputJsonObject }
        : {}),
    },
  });
  if (count !== 1) {
    const actual = await prisma.growthEjecucion.findUnique({
      where: { id },
      select: {
        id: true,
        estado: true,
        inicio: true,
        fin: true,
        resumen: true,
      },
    });
    if (!actual) throw new ErrorDeGrowth(404, "La ejecución no existe.");
    return respuestaDeEjecucionCerrada(actual, entrada.estado);
  }
  return { id, estado: entrada.estado, inicio: ejecucion.inicio, fin, resumen };
}

/** La ejecución que sigue abierta (de menos de 6 h), para el contexto del agente. */
export async function ejecucionAbierta(cliente: ClienteDeBd = prisma) {
  const limite = new Date(
    Date.now() - HORAS_PARA_DAR_POR_INTERRUMPIDA * MS_POR_HORA
  );
  return cliente.growthEjecucion.findFirst({
    where: { estado: "en_curso", inicio: { gte: limite } },
    orderBy: [{ inicio: "desc" }, { id: "desc" }],
    select: { id: true, disparador: true, inicio: true },
  });
}

// ── Lo que ve el administrador ───────────────────────────────────────────

type ListadoDeEjecuciones = z.infer<typeof ListadoDeEjecucionesQuery>;

function duracionEnSegundos(inicio: Date, fin: Date | null): number | null {
  return fin ? Math.round((fin.getTime() - inicio.getTime()) / 1000) : null;
}

/** `GET /growth/admin/ejecuciones`. */
export async function listarEjecuciones(filtros: ListadoDeEjecuciones) {
  const donde: Prisma.GrowthEjecucionWhereInput = {
    ...(filtros.estado ? { estado: filtros.estado } : {}),
    ...(filtros.disparador ? { disparador: filtros.disparador } : {}),
  };
  const [filas, total] = await Promise.all([
    prisma.growthEjecucion.findMany({
      where: donde,
      orderBy: [{ inicio: "desc" }, { id: "desc" }],
      skip: saltoDe(filtros),
      take: filtros.limite,
      select: {
        id: true,
        disparador: true,
        inicio: true,
        fin: true,
        estado: true,
        resumen: true,
        modulos: true,
        versionPrompts: true,
        error: true,
        _count: { select: { oportunidades: true } },
      },
    }),
    prisma.growthEjecucion.count({ where: donde }),
  ]);

  return paginar(
    filas.map(({ _count, ...ejecucion }) => ({
      ...ejecucion,
      duracionSegundos: duracionEnSegundos(ejecucion.inicio, ejecucion.fin),
      oportunidades: _count.oportunidades,
    })),
    total,
    filtros
  );
}

const TOPE_DE_OPORTUNIDADES_EN_EL_DETALLE = 200;

/**
 * `GET /growth/admin/ejecuciones/:id`: la ejecución con los contadores
 * calculados por el servidor (no por el agente), que sirven para calibrar los
 * umbrales sin fiarse del resumen autodeclarado.
 */
export async function detalleDeEjecucion(id: string) {
  const ejecucion = await prisma.growthEjecucion.findUnique({
    where: { id },
    select: {
      id: true,
      disparador: true,
      inicio: true,
      fin: true,
      estado: true,
      resumen: true,
      modulos: true,
      versionPrompts: true,
      error: true,
    },
  });
  if (!ejecucion) throw new ErrorDeGrowth(404, "La ejecución no existe.");

  const [contadores, oportunidades] = await Promise.all([
    contadoresDeEjecucion(prisma, id),
    prisma.growthOportunidad.findMany({
      where: { ejecucionId: id },
      orderBy: [{ detectadaEn: "desc" }, { id: "desc" }],
      take: TOPE_DE_OPORTUNIDADES_EN_EL_DETALLE,
      select: {
        id: true,
        titulo: true,
        dominio: true,
        estado: true,
        objetivoPrincipal: true,
        datos: true,
      },
    }),
  ]);

  return {
    ...ejecucion,
    duracionSegundos: duracionEnSegundos(ejecucion.inicio, ejecucion.fin),
    oportunidadesPorEstado: contadores.oportunidadesPorEstado,
    descartesPorMotivo: contadores.descartesPorMotivo,
    borradores: contadores.borradores,
    oportunidades: oportunidades.map(({ datos, ...oportunidad }) => ({
      ...oportunidad,
      codigoDescarte: codigoDeDescarteDe(datos),
    })),
  };
}
