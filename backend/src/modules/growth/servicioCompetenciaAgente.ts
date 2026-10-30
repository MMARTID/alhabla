import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import {
  motivoDeAnalisis,
  porNombre,
  type MotivoDeAnalisis,
} from "./competidores.js";
import {
  DIAS_MINIMOS_ENTRE_ANALISIS,
  MAXIMO_DE_PROPUESTAS_PENDIENTES,
  MAXIMO_DE_VERSIONES_POR_COMPETIDOR,
  dominioNormalizado,
  type AnalisisDeCompetidorBody,
  type EstadoDeCompetidor,
  type OrigenDeCompetidor,
  type PropuestaDeCompetidorBody,
} from "./esquemas.js";
import {
  ErrorDeGrowth,
  dominioDeUrl,
  limpiarJsonParaBd,
  urlParaAbrir,
  validarUrlExterna,
} from "./service.js";
import { bloquearCompetidor } from "./servicioCompetenciaAdmin.js";

/**
 * La competencia vista por el agente (`/growth/agente/competidores`): leer la
 * lista, proponer un competidor que ha visto en una página y guardar el
 * análisis de uno confirmado.
 *
 * Lo que el agente NO puede: aceptar, quitar ni revisar (esas rutas son del
 * administrador y no existen con un token de agente), ni analizar un
 * `propuesto`, que no aplica ninguna regla hasta que el administrador lo
 * acepta. El análisis es inteligencia interna: no se puede citar en un
 * borrador.
 *
 * El texto de un análisis, el nombre y las notas de un `propuesto` los
 * escribió un modelo que leyó páginas ajenas: aquí se guardan tal cual y el
 * MCP los entrega siempre bajo `terceros`. Ningún log de este fichero imprime
 * ese texto.
 */

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Cuántos competidores por analizar entran en el contexto del agente. */
export const MAXIMO_DE_COMPETIDORES_POR_ANALIZAR_EN_EL_CONTEXTO = 10;

export type CompetidorParaElAgente = {
  id: string;
  nombre: string;
  dominio: string;
  url: string | null;
  estado: EstadoDeCompetidor;
  origen: OrigenDeCompetidor;
  necesitaAnalisis: boolean;
  motivoDeAnalisis: MotivoDeAnalisis | null;
  ultimoAnalisisEn: Date | null;
};

/**
 * `GET /growth/agente/competidores`: todos, también los `propuesto` (para no
 * volver a proponerlos). Sin `notas`, que son del administrador.
 */
export async function listarCompetidoresParaElAgente(
  ahora = new Date()
): Promise<{ data: CompetidorParaElAgente[] }> {
  const filas = await prisma.growthCompetidor.findMany({
    orderBy: [{ nombre: "asc" }, { id: "asc" }],
    select: {
      id: true,
      nombre: true,
      dominio: true,
      url: true,
      estado: true,
      origen: true,
      analisis: {
        orderBy: { version: "desc" },
        take: 1,
        select: { creadoEn: true },
      },
    },
  });
  return {
    data: porNombre(filas).map((fila) => {
      const ultimo = fila.analisis[0]?.creadoEn ?? null;
      const motivo = motivoDeAnalisis(fila, ultimo, ahora);
      // Campo a campo, sin `...fila`: lo que no se nombra aquí (las notas del
      // administrador, por ejemplo) no sale hacia el agente.
      return {
        id: fila.id,
        nombre: fila.nombre,
        dominio: fila.dominio,
        url: fila.url,
        estado: fila.estado as EstadoDeCompetidor,
        origen: fila.origen as OrigenDeCompetidor,
        necesitaAnalisis: motivo !== null,
        motivoDeAnalisis: motivo,
        ultimoAnalisisEn: ultimo,
      };
    }),
  };
}

/**
 * Los competidores que el agente tiene que analizar en este run (los
 * `necesitaAnalisis`: primero los que se pidieron, luego los caducados), para
 * `GET /growth/agente/contexto`.
 */
export async function competidoresPorAnalizarParaElContexto(
  ahora = new Date()
): Promise<
  { id: string; nombre: string; dominio: string; url: string | null }[]
> {
  const { data } = await listarCompetidoresParaElAgente(ahora);
  const orden: Record<MotivoDeAnalisis, number> = {
    por_analizar: 0,
    caducado: 1,
  };
  return data
    .filter((c) => c.motivoDeAnalisis !== null)
    .sort(
      (a, b) =>
        orden[a.motivoDeAnalisis!] - orden[b.motivoDeAnalisis!] ||
        a.nombre.localeCompare(b.nombre)
    )
    .slice(0, MAXIMO_DE_COMPETIDORES_POR_ANALIZAR_EN_EL_CONTEXTO)
    .map(({ id, nombre, dominio, url }) => ({ id, nombre, dominio, url }));
}

function codigoDePrisma(error: unknown): string | undefined {
  return (error as { code?: string } | null)?.code;
}

/**
 * `POST /growth/agente/competidores`: el agente sugiere uno que ha visto en
 * una lista «alternativas a X». Entra como `propuesto`: no aplica ninguna
 * regla hasta que el administrador lo acepta. Si el dominio ya existe (con
 * cualquier estado) no cambia nada y se devuelve el que hay.
 */
export async function proponerCompetidor(
  propuestaCruda: PropuestaDeCompetidorBody
): Promise<
  | { creado: true; id: string; estado: "propuesto" }
  | { creado: false; id: string; estado: EstadoDeCompetidor }
> {
  const propuesta = limpiarJsonParaBd(propuestaCruda);
  validarUrlExterna(propuesta.url);
  const dominio = dominioDeUrl(propuesta.url);
  if (!dominioNormalizado.safeParse(dominio).success) {
    throw new ErrorDeGrowth(400, "La URL no tiene un dominio válido.");
  }

  const existente = (d: string) =>
    prisma.growthCompetidor.findUnique({
      where: { dominio: d },
      select: { id: true, estado: true },
    });
  const yaExistia = (fila: { id: string; estado: string }) => ({
    creado: false as const,
    id: fila.id,
    estado: fila.estado as EstadoDeCompetidor,
  });

  const previo = await existente(dominio);
  if (previo) return yaExistia(previo);

  try {
    return await prisma.$transaction(async (tx) => {
      // Un cerrojo solo para las propuestas: sin él, dos a la vez pasarían el
      // tope de 20 juntas.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('growth_competidor_propuestas'))`;
      const pendientes = await tx.growthCompetidor.count({
        where: { estado: "propuesto" },
      });
      if (pendientes >= MAXIMO_DE_PROPUESTAS_PENDIENTES) {
        throw new ErrorDeGrowth(
          409,
          `Ya hay ${MAXIMO_DE_PROPUESTAS_PENDIENTES} competidores propuestos esperando al administrador: no propongas más hasta que decida.`,
          "demasiadas_propuestas"
        );
      }
      const creado = await tx.growthCompetidor.create({
        data: {
          nombre: propuesta.nombre,
          dominio,
          url: urlParaAbrir(propuesta.url),
          notas: `Propuesto por el agente: ${propuesta.motivo}${
            propuesta.fuenteUrl ? ` Visto en ${propuesta.fuenteUrl}.` : ""
          }`,
          origen: "agente",
          estado: "propuesto",
        },
        select: { id: true },
      });
      return {
        creado: true as const,
        id: creado.id,
        estado: "propuesto" as const,
      };
    });
  } catch (error) {
    // Otra petición (o el administrador) lo dio de alta entre medias.
    if (codigoDePrisma(error) === "P2002") {
      const ganador = await existente(dominio);
      if (ganador) return yaExistia(ganador);
    }
    throw error;
  }
}

/**
 * `POST /growth/agente/competidores/:id/analisis`. Guarda una versión nueva
 * (`version = máxima + 1`), conserva como mucho 10 y deja al competidor como
 * `analizado`, pendiente de la revisión del administrador.
 *
 * Todo en una transacción con el cerrojo del competidor: la versión sale de
 * la máxima que hay en ese momento y el administrador no puede revisar un
 * análisis que se está sustituyendo.
 *
 * 409 `competidor_propuesto` si aún no se ha aceptado; 409 `analisis_reciente`
 * si no está `por_analizar` y su último análisis tiene menos de 7 días (un
 * run que repite lo del anterior solo gasta turnos y ensucia el historial).
 */
export async function guardarAnalisisDeCompetidor(
  id: string,
  cuerpoCrudo: AnalisisDeCompetidorBody,
  agente: { nombre: string }
): Promise<{ id: string; version: number; estado: "analizado" }> {
  const cuerpo = limpiarJsonParaBd(cuerpoCrudo);
  try {
    return await prisma.$transaction(async (tx) => {
      await bloquearCompetidor(tx, id);
      const ahora = new Date();

      const competidor = await tx.growthCompetidor.findUnique({
        where: { id },
        select: { estado: true },
      });
      if (!competidor) throw new ErrorDeGrowth(404, "El competidor no existe.");
      if (competidor.estado === "propuesto") {
        throw new ErrorDeGrowth(
          409,
          "Ese competidor está propuesto: el administrador tiene que aceptarlo antes de que lo analices.",
          "competidor_propuesto"
        );
      }

      const ultimo = await tx.growthCompetidorAnalisis.findFirst({
        where: { competidorId: id },
        orderBy: { version: "desc" },
        select: { version: true, creadoEn: true },
      });
      if (
        competidor.estado !== "por_analizar" &&
        ultimo &&
        ahora.getTime() - ultimo.creadoEn.getTime() <
          DIAS_MINIMOS_ENTRE_ANALISIS * MS_POR_DIA
      ) {
        throw new ErrorDeGrowth(
          409,
          `Ya hay un análisis de hace menos de ${DIAS_MINIMOS_ENTRE_ANALISIS} días: no se repite hasta que el administrador lo pida o caduque.`,
          "analisis_reciente"
        );
      }

      const version = (ultimo?.version ?? 0) + 1;
      const creado = await tx.growthCompetidorAnalisis.create({
        data: {
          competidorId: id,
          version,
          resumen: cuerpo.resumen,
          datos: cuerpo.datos as unknown as Prisma.InputJsonArray,
          ejecucionId: cuerpo.ejecucionId ?? null,
          creadoPor: agente.nombre,
        },
        select: { id: true },
      });
      // Se conservan las 10 últimas versiones.
      await tx.growthCompetidorAnalisis.deleteMany({
        where: {
          competidorId: id,
          version: { lte: version - MAXIMO_DE_VERSIONES_POR_COMPETIDOR },
        },
      });
      await tx.growthCompetidor.update({
        where: { id },
        data: { estado: "analizado", analisisSolicitadoEn: null },
      });
      return { id: creado.id, version, estado: "analizado" as const };
    });
  } catch (error) {
    throw sinTextoDeTerceros(error, id);
  }
}

/** Códigos que `routes.ts` convierte en un 409 `conflicto`: se dejan pasar tal cual. */
const CODIGOS_DE_CONFLICTO = new Set(["P2034", "P2028", "40P01", "40001"]);

/**
 * Un error de Prisma al guardar un análisis puede traer en su mensaje los
 * argumentos de la consulta, es decir, el resumen y los datos que un modelo
 * escribió leyendo páginas ajenas. Ese texto no debe acabar en el log: lo
 * que no es nuestro ni un conflicto de transacciones se registra solo con su
 * código y se relanza con un mensaje genérico.
 */
function sinTextoDeTerceros(error: unknown, competidorId: string): unknown {
  if (error instanceof ErrorDeGrowth) return error;
  const e = error as { code?: unknown; name?: unknown } | null;
  const codigo = typeof e?.code === "string" ? e.code : undefined;
  if (codigo && CODIGOS_DE_CONFLICTO.has(codigo)) return error;
  if (codigo === "P2002") {
    // Dos análisis a la vez con la misma versión (no debería pasar con el cerrojo).
    return new ErrorDeGrowth(
      409,
      "Otra operación estaba cambiando lo mismo. Vuelve a cargarlo y repítelo.",
      "conflicto"
    );
  }
  console.error(
    `[Growth] No se pudo guardar el análisis del competidor ${competidorId} (${typeof e?.name === "string" ? e.name : "error"}${codigo ? ` ${codigo}` : ""})`
  );
  return new Error("No se pudo guardar el análisis del competidor.");
}
