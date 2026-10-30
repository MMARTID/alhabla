import type { GrowthEstadoOportunidad as Estado, Prisma } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import {
  DIAS_ENTRE_CONTACTOS_AL_MISMO_DOMINIO,
  fallosDelTexto,
  normalizarDominio,
  type Comprobacion,
} from "./cumplimiento.js";
import {
  contactosDeLaSemana,
  evaluarBorradorConContexto,
  leerAjustesEfectivos,
  leerSnapshotDeConocimiento,
  type ResultadoDeEvaluacion,
} from "./contextoDeCumplimiento.js";
import {
  ESTADOS_DE_OPORTUNIDAD,
  TIPOS_DE_AFIRMACION,
  type ConocimientoDelAdministradorQuery,
  type ListadoDeBorradoresQuery,
  type ListadoDeDecisionesQuery,
  type ListadoDeGestionesQuery,
  type Pagina,
  type PatchBorradorBody,
} from "./esquemas.js";
import {
  ErrorDeGrowth,
  POR_SISTEMA,
  adquirirCerrojosDeAprobacion,
  cambiarEstadoConGuardia,
  detallarBorradores,
  esBorradorEditable,
  escaparComodinesDeLike,
  registrarDecision,
} from "./service.js";

/**
 * Lo que el dashboard lee y edita además de la Bandeja y la Revisión (que
 * viven en `service.ts`): el resumen, los borradores, el historial de
 * decisiones y gestiones y la base de conocimiento. (Los competidores viven
 * en `servicioCompetenciaAdmin.ts`.)
 *
 * Este fichero es también donde viven las piezas pequeñas que comparten
 * `ejecuciones.ts` y `servicioAgente.ts` (paginar, el código de descarte,
 * el recuento por estado): así no hace falta tocar `service.ts`.
 */

const MS_POR_DIA = 24 * 60 * 60 * 1000;

// ── Piezas compartidas ───────────────────────────────────────────────────

export function paginar<T>(
  data: T[],
  total: number,
  paginacion: { pagina: number; limite: number }
): Pagina<T> {
  return {
    data,
    total,
    pagina: paginacion.pagina,
    limite: paginacion.limite,
  };
}

/** Cuántas filas saltar para llegar a esa página. */
export function saltoDe(paginacion: { pagina: number; limite: number }) {
  return (paginacion.pagina - 1) * paginacion.limite;
}

export function diasHasta(fecha: Date | null, ahora: Date): number | null {
  return fecha
    ? Math.ceil((fecha.getTime() - ahora.getTime()) / MS_POR_DIA)
    : null;
}

export function comprobacionesDe(
  json: Prisma.JsonValue | null | undefined
): Comprobacion[] {
  return Array.isArray(json) ? (json as unknown as Comprobacion[]) : [];
}

/** El código de descarte que el backend guarda en `datos.codigoDescarte`. */
export function codigoDeDescarteDe(
  datos: Prisma.JsonValue | null | undefined
): string | null {
  if (!datos || typeof datos !== "object" || Array.isArray(datos)) return null;
  const codigo = (datos as Prisma.JsonObject).codigoDescarte;
  return typeof codigo === "string" ? codigo : null;
}

/**
 * Cuenta descartes por código (`otro` si no hay), del más frecuente al menos.
 * Prisma no agrupa por una ruta dentro de un JSON: se hace en memoria, que
 * con decenas de descartes por semana sobra.
 */
export function agruparDescartesPorCodigo(
  filas: readonly { datos: Prisma.JsonValue | null }[]
): { codigo: string; n: number }[] {
  const cuentas = new Map<string, number>();
  for (const fila of filas) {
    const codigo = codigoDeDescarteDe(fila.datos) ?? "otro";
    cuentas.set(codigo, (cuentas.get(codigo) ?? 0) + 1);
  }
  return [...cuentas]
    .map(([codigo, n]) => ({ codigo, n }))
    .sort((a, b) => b.n - a.n || a.codigo.localeCompare(b.codigo));
}

/** `{ estado: n }` con todos los estados, también los que no tienen nada. */
export function conteoPorEstadoDeOportunidad(
  grupos: readonly { estado: Estado; _count: { _all: number } }[]
): Record<Estado, number> {
  const conteo = Object.fromEntries(
    ESTADOS_DE_OPORTUNIDAD.map((estado) => [estado, 0])
  ) as Record<Estado, number>;
  for (const grupo of grupos) conteo[grupo.estado] = grupo._count._all;
  return conteo;
}

function nombresDeReglasFallidas(comprobaciones: readonly Comprobacion[]) {
  return comprobaciones
    .filter((c) => c.dura && !c.ok)
    .map((c) => c.regla)
    .join(", ");
}

// ── Resumen ──────────────────────────────────────────────────────────────

/** Cuántos días mira el resumen hacia atrás (descartes) y hacia delante (caducidades). */
const DIAS_DEL_RESUMEN = 7;

async function descartesDeLosUltimosDias(desde: Date) {
  const decisiones = await prisma.growthDecision.findMany({
    where: {
      accion: "descartar",
      en: { gte: desde },
      oportunidadId: { not: null },
    },
    select: { oportunidadId: true },
    take: 5000,
  });
  const ids = [
    ...new Set(
      decisiones.flatMap((d) => (d.oportunidadId ? [d.oportunidadId] : []))
    ),
  ];
  if (ids.length === 0) return { total: 0, porMotivo: [] };

  const oportunidades = await prisma.growthOportunidad.findMany({
    where: { id: { in: ids }, estado: "descartada" },
    select: { datos: true },
  });
  return {
    total: oportunidades.length,
    porMotivo: agruparDescartesPorCodigo(oportunidades),
  };
}

/**
 * `GET /growth/admin/resumen`: lo que necesita la Bandeja vacía (cuántas se
 * descartaron y por qué), los contadores de la navegación y el estado de la
 * máquina (pausa, topes, conocimiento, última ejecución).
 */
export async function resumenDelAdministrador() {
  const ahora = new Date();
  const hace7Dias = new Date(ahora.getTime() - DIAS_DEL_RESUMEN * MS_POR_DIA);
  const dentroDe7Dias = new Date(
    ahora.getTime() + DIAS_DEL_RESUMEN * MS_POR_DIA
  );

  const [
    grupos,
    ajustes,
    contactos,
    snapshot,
    porCaducar,
    descartes,
    ultimaEjecucion,
    tokensActivos,
    tokenMasReciente,
  ] = await Promise.all([
    prisma.growthOportunidad.groupBy({
      by: ["estado"],
      _count: { _all: true },
    }),
    leerAjustesEfectivos(),
    contactosDeLaSemana(prisma, { ahora }),
    leerSnapshotDeConocimiento(prisma, ahora),
    // Incluye lo ya vencido que sigue esperando: nada lo caduca por sí solo
    // salvo lo aprobado, y es justo lo que pide que alguien lo mire.
    prisma.growthOportunidad.findMany({
      where: {
        estado: { in: ["aprobada", "pendiente_aprobacion"] },
        expiraEn: { not: null, lte: dentroDe7Dias },
      },
      orderBy: [{ expiraEn: "asc" }, { id: "asc" }],
      take: 5,
      select: {
        id: true,
        titulo: true,
        dominio: true,
        estado: true,
        expiraEn: true,
      },
    }),
    descartesDeLosUltimosDias(hace7Dias),
    prisma.growthEjecucion.findFirst({
      orderBy: [{ inicio: "desc" }, { id: "desc" }],
      select: {
        id: true,
        disparador: true,
        estado: true,
        inicio: true,
        fin: true,
      },
    }),
    prisma.growthTokenAgente.count({ where: { revocadoEn: null } }),
    prisma.growthTokenAgente.findFirst({
      where: { ultimoUso: { not: null } },
      orderBy: { ultimoUso: "desc" },
      select: { ultimoUso: true },
    }),
  ]);

  const porEstado = conteoPorEstadoDeOportunidad(grupos);
  return {
    pausa: ajustes.valores.pausa,
    ajustes: ajustes.valores,
    porEstado,
    paraRevisar: porEstado.pendiente_aprobacion,
    aprobadasSinGestionar: porEstado.aprobada,
    bloqueadas: porEstado.bloqueada,
    devueltas: porEstado.devuelta,
    porCaducar: porCaducar.map((o) => ({
      ...o,
      diasParaCaducar: diasHasta(o.expiraEn, ahora),
    })),
    contactos: {
      // Lo que cuenta para el tope: lo hecho más lo aprobado sin gestionar.
      estaSemana: contactos.total,
      hechas: contactos.hechas,
      aprobadasSinGestionar: contactos.aprobadasSinGestionar,
      tope: ajustes.valores.topeSemanal,
    },
    descartesUltimos7Dias: descartes,
    ultimaEjecucion,
    conocimiento: snapshot,
    tokens: {
      activos: tokensActivos,
      ultimoUso: tokenMasReciente?.ultimoUso ?? null,
    },
  };
}

// ── Borradores: listado ──────────────────────────────────────────────────

type ListadoDeBorradores = z.infer<typeof ListadoDeBorradoresQuery>;

/**
 * El borrador no tiene estado «caducado»: caduca su oportunidad. El job de
 * caducidad pasa los borradores abiertos de una oportunidad que vence a
 * `descartado`, así que «caducado» se define SOLO por la oportunidad
 * (`estado = caducada`, sea cual sea el estado del borrador) y esos borradores
 * se excluyen de las demás pestañas: si no, saldrían dos veces.
 */
const DE_OPORTUNIDAD_NO_CADUCADA: Prisma.GrowthBorradorWhereInput = {
  oportunidad: { estado: { not: "caducada" } },
};

/** Qué borradores entran en cada pestaña de la vista Borradores. */
function dondeDeGrupoDeBorradores(
  grupo: ListadoDeBorradores["grupo"]
): Prisma.GrowthBorradorWhereInput {
  switch (grupo) {
    case "bloqueados":
      return { estado: "bloqueado", ...DE_OPORTUNIDAD_NO_CADUCADA };
    case "pendientes":
      return { estado: "pendiente_aprobacion", ...DE_OPORTUNIDAD_NO_CADUCADA };
    case "aprobados":
      return { estado: "aprobado", ...DE_OPORTUNIDAD_NO_CADUCADA };
    case "gestionados":
      return { estado: "gestionado", ...DE_OPORTUNIDAD_NO_CADUCADA };
    case "descartados":
      return { estado: "descartado", ...DE_OPORTUNIDAD_NO_CADUCADA };
    case "caducados":
      return { oportunidad: { estado: "caducada" } };
  }
}

function dondeDeFiltrosDeBorradores(
  filtros: Pick<ListadoDeBorradores, "objetivo" | "tipo" | "q">
): Prisma.GrowthBorradorWhereInput {
  // `%` y `_` son comodines de LIKE: se escapan para buscar el texto tal cual.
  const q = filtros.q ? escaparComodinesDeLike(filtros.q) : undefined;
  return {
    ...(filtros.objetivo ? { objetivo: filtros.objetivo } : {}),
    ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
    ...(q
      ? {
          OR: [
            { asunto: { contains: q, mode: "insensitive" } },
            { texto: { contains: q, mode: "insensitive" } },
            {
              oportunidad: {
                dominio: { contains: q, mode: "insensitive" },
              },
            },
          ],
        }
      : {}),
  };
}

const SELECT_DE_LISTADO_DE_BORRADORES = {
  id: true,
  oportunidadId: true,
  version: true,
  tipo: true,
  objetivo: true,
  asunto: true,
  texto: true,
  enlaceUrl: true,
  afirmaciones: true,
  estado: true,
  editadoPorHumano: true,
  creadoEn: true,
  oportunidad: {
    select: {
      id: true,
      titulo: true,
      dominio: true,
      url: true,
      estado: true,
      objetivoPrincipal: true,
      expiraEn: true,
    },
  },
  gestion: { select: { canal: true, hechaEn: true, resultado: true } },
  // La última revisión de las reglas: la del modelo es solo consultiva y no
  // debe tapar un bloqueo.
  revisiones: {
    where: { revisor: "reglas" },
    orderBy: { creadaEn: "desc" },
    take: 1,
    select: { resultado: true, comprobaciones: true },
  },
} satisfies Prisma.GrowthBorradorSelect;

const LONGITUD_DE_LA_VISTA_PREVIA = 200;

const GRUPOS = [
  "bloqueados",
  "pendientes",
  "aprobados",
  "gestionados",
  "caducados",
  "descartados",
] as const;

/**
 * `GET /growth/admin/borradores`: la vista Borradores. Las pestañas se
 * cuentan con los mismos filtros (menos el grupo). No devuelve el texto
 * entero, solo una vista previa: para eso está el detalle.
 */
export async function listarBorradores(filtros: ListadoDeBorradores) {
  const ahora = new Date();
  const extra = dondeDeFiltrosDeBorradores(filtros);
  const donde: Prisma.GrowthBorradorWhereInput = {
    AND: [dondeDeGrupoDeBorradores(filtros.grupo), extra],
  };
  const orden: Prisma.GrowthBorradorOrderByWithRelationInput[] =
    filtros.orden === "caducan"
      ? [
          { oportunidad: { expiraEn: { sort: "asc", nulls: "last" } } },
          { creadoEn: "desc" },
          { id: "desc" },
        ]
      : [{ creadoEn: "desc" }, { id: "desc" }];

  const [filas, ...cuentas] = await Promise.all([
    prisma.growthBorrador.findMany({
      where: donde,
      orderBy: orden,
      skip: saltoDe(filtros),
      take: filtros.limite,
      select: SELECT_DE_LISTADO_DE_BORRADORES,
    }),
    // Un conteo por pestaña; el del grupo que se está viendo es el total.
    ...GRUPOS.map((grupo) =>
      prisma.growthBorrador.count({
        where: { AND: [dondeDeGrupoDeBorradores(grupo), extra] },
      })
    ),
  ]);
  const total = cuentas[GRUPOS.indexOf(filtros.grupo)] ?? 0;

  const data = filas.map((fila) => {
    const revision = fila.revisiones[0] ?? null;
    return {
      id: fila.id,
      oportunidadId: fila.oportunidadId,
      version: fila.version,
      tipo: fila.tipo,
      objetivo: fila.objetivo,
      asunto: fila.asunto,
      textoPreview: fila.texto.slice(0, LONGITUD_DE_LA_VISTA_PREVIA),
      longitud: fila.texto.length,
      enlaceUrl: fila.enlaceUrl,
      afirmaciones: fila.afirmaciones,
      estado: fila.estado,
      editadoPorHumano: fila.editadoPorHumano,
      creadoEn: fila.creadoEn,
      resultado: revision?.resultado ?? null,
      // El «porqué» de los bloqueados.
      reglasFallidas: comprobacionesDe(revision?.comprobaciones).filter(
        (c) => !c.ok
      ),
      oportunidad: {
        ...fila.oportunidad,
        diasParaCaducar: diasHasta(fila.oportunidad.expiraEn, ahora),
      },
      gestion: fila.gestion,
    };
  });

  return {
    ...paginar(data, total, filtros),
    conteos: Object.fromEntries(
      GRUPOS.map((grupo, i) => [grupo, cuentas[i]])
    ) as Record<(typeof GRUPOS)[number], number>,
  };
}

// ── Borradores: detalle ──────────────────────────────────────────────────

/**
 * `GET /growth/admin/borradores/:id`: el borrador tal como se ve en el
 * detalle de su oportunidad (texto completo, afirmaciones con su fuente,
 * parecido con la versión anterior, revisiones y gestión) más la
 * oportunidad y si se puede editar.
 */
export async function detalleDeBorrador(id: string) {
  const fila = await prisma.growthBorrador.findUnique({
    where: { id },
    select: {
      id: true,
      oportunidad: {
        select: {
          id: true,
          titulo: true,
          dominio: true,
          url: true,
          estado: true,
          objetivoPrincipal: true,
          expiraEn: true,
          borradores: {
            orderBy: { version: "desc" },
            include: {
              revisiones: { orderBy: { creadaEn: "desc" } },
              gestion: true,
            },
          },
        },
      },
    },
  });
  if (!fila) throw new ErrorDeGrowth(404, "El borrador no existe.");

  const { borradores, ...oportunidad } = fila.oportunidad;
  const detallados = await detallarBorradores(prisma, borradores);
  const detallado = detallados.find((b) => b.id === id);
  if (!detallado) throw new ErrorDeGrowth(404, "El borrador no existe.");

  const versionMaxima = Math.max(0, ...borradores.map((b) => b.version));
  return {
    ...detallado,
    oportunidad,
    esEditable: esBorradorEditable(detallado, oportunidad, versionMaxima),
  };
}

// ── Borradores: edición a mano ───────────────────────────────────────────

function mismasAfirmaciones(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((clave, i) => clave === b[i]);
}

/**
 * El 409 de agenda de una evaluación cuyo TEXTO está bien, o `null` si la
 * agenda deja pasar. Son las mismas comprobaciones, en el mismo orden y con
 * los mismos códigos y mensajes, que hace `aprobar` (service.ts): si aprobar
 * daría un 409 de agenda, corregir el borrador también (y sin tocar nada).
 * Los códigos son estables para el dashboard: `dominio_en_enfriamiento` (se
 * contactó hace menos de 90 días; `hasta` dice hasta cuándo),
 * `dominio_ya_aprobado` (otra oportunidad del dominio espera su gestión) y
 * `tope_semanal` (hechos más aprobados llegan al tope).
 */
function errorDeAgenda(
  evaluacion: ResultadoDeEvaluacion
): ErrorDeGrowth | null {
  const ultimaGestion = evaluacion.agenda.gestionesDelDominio.reduce<
    Date | undefined
  >((ultima, fecha) => (!ultima || fecha > ultima ? fecha : ultima), undefined);
  if (ultimaGestion) {
    const hasta = new Date(
      ultimaGestion.getTime() +
        DIAS_ENTRE_CONTACTOS_AL_MISMO_DOMINIO * MS_POR_DIA
    );
    return new ErrorDeGrowth(
      409,
      `Ya se contactó con este dominio el ${ultimaGestion.toISOString().slice(0, 10)}: no se puede volver a escribir hasta el ${hasta.toISOString().slice(0, 10)}.`,
      "dominio_en_enfriamiento",
      { hasta: hasta.toISOString() }
    );
  }
  if (evaluacion.agenda.aprobadasDelDominio > 0) {
    return new ErrorDeGrowth(
      409,
      "Ya hay otra oportunidad aprobada de este dominio pendiente de gestionar.",
      "dominio_ya_aprobado"
    );
  }
  if (evaluacion.agenda.contactos.total >= evaluacion.ajustes.topeSemanal) {
    return new ErrorDeGrowth(
      409,
      `Se ha llegado al tope de ${evaluacion.ajustes.topeSemanal} contactos esta semana (hechos o aprobados).`,
      "tope_semanal"
    );
  }
  return null;
}

/**
 * `PATCH /growth/admin/borradores/:id`. El fundador corrige el texto a mano
 * y el backend vuelve a pasar las reglas duras con el contexto de ahora:
 *
 * - Si bloquean POR EL TEXTO, el borrador queda `bloqueado` y la oportunidad
 *   `bloqueada`. Se responde 200: el cambio se guardó, y la interfaz enseña
 *   por qué.
 * - Las reglas de agenda (tope semanal, un contacto por dominio, dominio ya
 *   aprobado) no dicen nada del texto y no lo bloquean nunca: si el texto
 *   pasa pero la agenda no, se responde 409 con su código
 *   (`tope_semanal`, `dominio_en_enfriamiento` o `dominio_ya_aprobado`) y NO
 *   se guarda nada: ni el texto, ni estados, ni revisión, ni decisión.
 * - Si pasan, un bloqueado vuelve a `pendiente_aprobacion` (solo si pasa las
 *   reglas duras; nadie lo reabre a mano).
 * - NUNCA queda `aprobado`: aprobar es siempre la decisión `aprobar`, que
 *   vuelve a evaluar.
 *
 * Solo se edita el último borrador de una oportunidad que sigue en manos del
 * fundador (bloqueado o pendiente). Un aprobado, gestionado o descartado es
 * inmutable: lo que se envió distinto se anota como `textoFinal` al marcar
 * como gestionado.
 */
export async function editarBorrador(
  id: string,
  cambios: PatchBorradorBody,
  por: string
) {
  return prisma.$transaction(
    async (tx) => {
      // Mismo orden de bloqueo que aprobar, devolver, descartar y el
      // sincronizador (ver service.ts › adquirirCerrojosDeAprobacion): sin
      // él, editar y aprobar a la vez se cruzan en un deadlock.
      await adquirirCerrojosDeAprobacion(tx);

      const borrador = await tx.growthBorrador.findUnique({
        where: { id },
        include: {
          oportunidad: { select: { id: true, estado: true, dominio: true } },
          revisiones: {
            where: { revisor: "reglas" },
            orderBy: { creadaEn: "desc" },
            take: 1,
          },
        },
      });
      if (!borrador) throw new ErrorDeGrowth(404, "El borrador no existe.");

      const ultimaVersion = await tx.growthBorrador.findFirst({
        where: { oportunidadId: borrador.oportunidadId },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const versionMaxima = ultimaVersion?.version ?? borrador.version;
      if (!esBorradorEditable(borrador, borrador.oportunidad, versionMaxima)) {
        throw new ErrorDeGrowth(
          409,
          borrador.estado === "bloqueado" ||
            borrador.estado === "pendiente_aprobacion"
            ? "Este borrador ya no es la última versión o su oportunidad ha cambiado: no se puede editar."
            : `Un borrador ${borrador.estado} no se puede editar.`,
          "no_editable"
        );
      }

      const nuevo = {
        asunto:
          cambios.asunto === undefined
            ? borrador.asunto
            : cambios.asunto === "" || cambios.asunto === null
              ? null
              : cambios.asunto,
        texto: cambios.texto ?? borrador.texto,
        enlaceUrl:
          cambios.enlaceUrl === undefined
            ? borrador.enlaceUrl
            : cambios.enlaceUrl,
        afirmaciones: cambios.afirmaciones ?? borrador.afirmaciones,
      };
      const camposCambiados = [
        nuevo.asunto !== borrador.asunto ? "asunto" : null,
        nuevo.texto !== borrador.texto ? "texto" : null,
        nuevo.enlaceUrl !== borrador.enlaceUrl ? "enlaceUrl" : null,
        !mismasAfirmaciones(nuevo.afirmaciones, borrador.afirmaciones)
          ? "afirmaciones"
          : null,
      ].filter((campo): campo is string => campo !== null);

      const base = {
        id: borrador.id,
        oportunidadId: borrador.oportunidadId,
        version: borrador.version,
        tipo: borrador.tipo,
        objetivo: borrador.objetivo,
        utm: borrador.utm,
        textoFinal: borrador.textoFinal,
        creadoEn: borrador.creadoEn,
      };

      // Nada que cambiar: se enseña el estado actual sin revisión ni decisión.
      if (camposCambiados.length === 0) {
        const ultima = borrador.revisiones[0];
        return {
          borrador: {
            ...base,
            ...nuevo,
            estado: borrador.estado,
            editadoPorHumano: borrador.editadoPorHumano,
          },
          resultado:
            ultima?.resultado ??
            (borrador.estado === "bloqueado" ? "bloquea" : "pasa"),
          comprobaciones: comprobacionesDe(ultima?.comprobaciones),
          oportunidad: {
            id: borrador.oportunidad.id,
            estado: borrador.oportunidad.estado,
          },
        };
      }

      // Las reglas, con el contexto de ahora y sin compararse consigo mismo.
      // La agenda se evalúa aparte (`agendaComoAviso`, sin contar lo aprobado
      // sin gestionar): no puede bloquear el texto.
      const evaluacion = await evaluarBorradorConContexto(
        {
          tipo: borrador.tipo,
          objetivo: borrador.objetivo,
          asunto: nuevo.asunto,
          texto: nuevo.texto,
          enlaceUrl: nuevo.enlaceUrl,
          utm: borrador.utm,
          afirmaciones: nuevo.afirmaciones,
        },
        {
          dominio: borrador.oportunidad.dominio,
          oportunidadId: borrador.oportunidadId,
          excluirBorradorId: borrador.id,
          creadoEn: borrador.creadoEn,
          agendaComoAviso: true,
          cliente: tx,
        }
      );
      const bloquea = fallosDelTexto(evaluacion.comprobaciones).length > 0;
      if (!bloquea) {
        // Texto bien, agenda mal: 409 y se deshace la transacción entera.
        const deAgenda = errorDeAgenda(evaluacion);
        if (deAgenda) throw deAgenda;
      }
      const estadoDelBorrador = bloquea ? "bloqueado" : "pendiente_aprobacion";
      const estadoDeLaOportunidad: Estado = bloquea
        ? "bloqueada"
        : "pendiente_aprobacion";

      // Solo se guarda lo que se evaluó: si alguien lo editó entre medias, 409.
      const { count } = await tx.growthBorrador.updateMany({
        where: {
          id: borrador.id,
          estado: borrador.estado,
          texto: borrador.texto,
          asunto: borrador.asunto,
          enlaceUrl: borrador.enlaceUrl,
          afirmaciones: { equals: borrador.afirmaciones },
        },
        data: {
          ...nuevo,
          estado: estadoDelBorrador,
          editadoPorHumano: true,
        },
      });
      if (count !== 1) {
        throw new ErrorDeGrowth(
          409,
          "El borrador ha cambiado mientras lo editabas. Vuelve a cargarlo.",
          "conflicto"
        );
      }
      if (borrador.oportunidad.estado !== estadoDeLaOportunidad) {
        await cambiarEstadoConGuardia(tx, {
          id: borrador.oportunidadId,
          desde: borrador.oportunidad.estado,
          hasta: estadoDeLaOportunidad,
          actor: "sistema",
        });
      }
      await tx.growthRevisionCumplimiento.create({
        data: {
          borradorId: borrador.id,
          resultado: evaluacion.resultado,
          comprobaciones:
            evaluacion.comprobaciones as unknown as Prisma.InputJsonValue,
          revisor: "reglas",
        },
      });

      const motivo = [
        `Campos: ${camposCambiados.join(", ")}`,
        cambios.nota ? `Nota: ${cambios.nota}` : null,
        `Resultado: ${evaluacion.resultado}`,
      ]
        .filter(Boolean)
        .join(". ");
      await registrarDecision(tx, {
        oportunidadId: borrador.oportunidadId,
        borradorId: borrador.id,
        accion: "editar",
        motivo,
        por,
      });
      if (bloquea) {
        await registrarDecision(tx, {
          oportunidadId: borrador.oportunidadId,
          borradorId: borrador.id,
          accion: "bloquear_por_reglas",
          motivo: `Al editar: ${nombresDeReglasFallidas(evaluacion.comprobaciones)}`,
          por: POR_SISTEMA,
        });
      }

      return {
        borrador: {
          ...base,
          ...nuevo,
          estado: estadoDelBorrador,
          editadoPorHumano: true,
        },
        resultado: evaluacion.resultado,
        comprobaciones: evaluacion.comprobaciones,
        oportunidad: {
          id: borrador.oportunidadId,
          estado: estadoDeLaOportunidad,
        },
      };
    },
    { maxWait: 5000, timeout: 15000 }
  );
}

// ── Historial: decisiones y gestiones ────────────────────────────────────

type ListadoDeDecisiones = z.infer<typeof ListadoDeDecisionesQuery>;

function dondeDeDecisiones(
  filtros: ListadoDeDecisiones,
  conAccion: boolean
): Prisma.GrowthDecisionWhereInput {
  const condiciones: Prisma.GrowthDecisionWhereInput[] = [];
  if (conAccion && filtros.accion) condiciones.push({ accion: filtros.accion });
  if (filtros.oportunidadId) {
    condiciones.push({ oportunidadId: filtros.oportunidadId });
  }
  if (filtros.borradorId) condiciones.push({ borradorId: filtros.borradorId });
  if (filtros.por) condiciones.push({ por: filtros.por });
  // Las que no cuelgan de ninguna oportunidad: ajustes, sincronizaciones…
  if (filtros.soloSistema) condiciones.push({ oportunidadId: null });
  if (filtros.fechaDesde) condiciones.push({ en: { gte: filtros.fechaDesde } });
  if (filtros.fechaHasta) condiciones.push({ en: { lte: filtros.fechaHasta } });
  return condiciones.length > 0 ? { AND: condiciones } : {};
}

/**
 * `GET /growth/admin/decisiones`: el Historial. Registro inmutable por
 * convención: ninguna ruta lo edita ni lo borra. Es la única vista que
 * enseña el correo (`por`).
 */
export async function listarDecisiones(filtros: ListadoDeDecisiones) {
  const donde = dondeDeDecisiones(filtros, true);
  const [filas, total, porAccion] = await Promise.all([
    prisma.growthDecision.findMany({
      where: donde,
      orderBy: [{ en: "desc" }, { id: "desc" }],
      skip: saltoDe(filtros),
      take: filtros.limite,
      select: {
        id: true,
        accion: true,
        motivo: true,
        por: true,
        en: true,
        oportunidad: {
          select: {
            id: true,
            titulo: true,
            dominio: true,
            url: true,
            estado: true,
          },
        },
        borrador: { select: { id: true, version: true, tipo: true } },
      },
    }),
    prisma.growthDecision.count({ where: donde }),
    // Las pestañas por acción se cuentan sin el filtro de acción.
    prisma.growthDecision.groupBy({
      by: ["accion"],
      where: dondeDeDecisiones(filtros, false),
      _count: { _all: true },
    }),
  ]);

  return {
    ...paginar(filas, total, filtros),
    conteos: {
      porAccion: Object.fromEntries(
        porAccion.map((g) => [g.accion, g._count._all])
      ) as Record<string, number>,
    },
  };
}

type ListadoDeGestiones = z.infer<typeof ListadoDeGestionesQuery>;

function dondeDeGestiones(
  filtros: ListadoDeGestiones,
  conResultado: boolean
): Prisma.GrowthGestionWhereInput {
  return {
    ...(conResultado && filtros.resultado
      ? { resultado: filtros.resultado }
      : {}),
    ...(filtros.canal ? { canal: filtros.canal } : {}),
    ...(filtros.dominio ? { dominio: normalizarDominio(filtros.dominio) } : {}),
    ...(filtros.fechaDesde || filtros.fechaHasta
      ? {
          hechaEn: {
            ...(filtros.fechaDesde ? { gte: filtros.fechaDesde } : {}),
            ...(filtros.fechaHasta ? { lte: filtros.fechaHasta } : {}),
          },
        }
      : {}),
  };
}

/** `GET /growth/admin/gestiones`: lo que se hizo a mano tras aprobar. */
export async function listarGestiones(filtros: ListadoDeGestiones) {
  const donde = dondeDeGestiones(filtros, true);
  const [filas, total, porResultado] = await Promise.all([
    prisma.growthGestion.findMany({
      where: donde,
      orderBy: [{ hechaEn: "desc" }, { id: "desc" }],
      skip: saltoDe(filtros),
      take: filtros.limite,
      select: {
        id: true,
        canal: true,
        dominio: true,
        hechaEn: true,
        respuestaEn: true,
        resultado: true,
        urlConseguida: true,
        notas: true,
        borrador: {
          select: {
            id: true,
            version: true,
            tipo: true,
            asunto: true,
            textoFinal: true,
            editadoPorHumano: true,
            oportunidad: {
              select: {
                id: true,
                titulo: true,
                url: true,
                estado: true,
                objetivoPrincipal: true,
              },
            },
          },
        },
      },
    }),
    prisma.growthGestion.count({ where: donde }),
    prisma.growthGestion.groupBy({
      by: ["resultado"],
      where: dondeDeGestiones(filtros, false),
      _count: { _all: true },
    }),
  ]);

  const data = filas.map(({ borrador, ...gestion }) => {
    const { oportunidad, ...resto } = borrador;
    return { ...gestion, borrador: resto, oportunidad };
  });
  return {
    ...paginar(data, total, filtros),
    conteos: {
      porResultado: Object.fromEntries(
        porResultado.map((g) => [g.resultado, g._count._all])
      ) as Record<string, number>,
    },
  };
}

// ── Conocimiento ─────────────────────────────────────────────────────────

/** Más afirmaciones vigentes que esto y la vista se trunca. */
const TOPE_DE_AFIRMACIONES_EN_LA_VISTA = 1000;
const DIAS_DE_CAMBIOS_RECIENTES = 30;
const TOPE_DE_CAMBIOS_RECIENTES = 50;

type ConsultaDeConocimiento = z.infer<typeof ConocimientoDelAdministradorQuery>;

/**
 * `GET /growth/admin/conocimiento`: lo vigente por tipo, el snapshot (con su
 * antigüedad, que sale del sincronizador y no de la fecha de las filas) y lo
 * que cambió en los últimos 30 días. Una modificación se ve como un cierre
 * y un alta de la misma clave.
 */
export async function conocimientoParaElAdministrador(
  consulta: ConsultaDeConocimiento
) {
  const ahora = new Date();
  const desde = new Date(
    ahora.getTime() - DIAS_DE_CAMBIOS_RECIENTES * MS_POR_DIA
  );
  const filtroDeTipo = consulta.tipo ? { tipo: consulta.tipo } : {};

  const [snapshot, vigentes, porTipoContado, altas, cierres] =
    await Promise.all([
      leerSnapshotDeConocimiento(prisma, ahora),
      prisma.growthAfirmacion.findMany({
        where: { vigenteHasta: null, ...filtroDeTipo },
        orderBy: [{ clave: "asc" }, { id: "asc" }],
        take: TOPE_DE_AFIRMACIONES_EN_LA_VISTA + 1,
        select: {
          id: true,
          clave: true,
          tipo: true,
          texto: true,
          valor: true,
          fuente: true,
          commitSha: true,
          nichoSlug: true,
          vigenteDesde: true,
        },
      }),
      // Los conteos son de todos los tipos aunque se filtre uno: son las pestañas.
      prisma.growthAfirmacion.groupBy({
        by: ["tipo"],
        where: { vigenteHasta: null },
        _count: { _all: true },
      }),
      prisma.growthAfirmacion.findMany({
        where: { vigenteDesde: { gte: desde }, ...filtroDeTipo },
        orderBy: { vigenteDesde: "desc" },
        take: TOPE_DE_CAMBIOS_RECIENTES,
        select: {
          clave: true,
          tipo: true,
          vigenteDesde: true,
          commitSha: true,
        },
      }),
      prisma.growthAfirmacion.findMany({
        where: { vigenteHasta: { gte: desde }, ...filtroDeTipo },
        orderBy: { vigenteHasta: "desc" },
        take: TOPE_DE_CAMBIOS_RECIENTES,
        select: {
          clave: true,
          tipo: true,
          vigenteHasta: true,
          commitSha: true,
        },
      }),
    ]);

  const truncado = vigentes.length > TOPE_DE_AFIRMACIONES_EN_LA_VISTA;
  const enLaVista = truncado
    ? vigentes.slice(0, TOPE_DE_AFIRMACIONES_EN_LA_VISTA)
    : vigentes;

  const porTipo = Object.fromEntries(
    TIPOS_DE_AFIRMACION.map((tipo) => [
      tipo,
      enLaVista.filter((a) => a.tipo === tipo),
    ])
  ) as Record<(typeof TIPOS_DE_AFIRMACION)[number], typeof enLaVista>;

  const conteos = Object.fromEntries(
    TIPOS_DE_AFIRMACION.map((tipo) => [
      tipo,
      porTipoContado.find((g) => g.tipo === tipo)?._count._all ?? 0,
    ])
  ) as Record<(typeof TIPOS_DE_AFIRMACION)[number], number>;

  const cambiosRecientes = [
    ...altas.map((a) => ({
      clave: a.clave,
      tipo: a.tipo,
      cambio: "alta" as const,
      en: a.vigenteDesde,
      commitSha: a.commitSha,
    })),
    ...cierres.flatMap((a) =>
      a.vigenteHasta
        ? [
            {
              clave: a.clave,
              tipo: a.tipo,
              cambio: "cierre" as const,
              en: a.vigenteHasta,
              commitSha: a.commitSha,
            },
          ]
        : []
    ),
  ]
    .sort((a, b) => b.en.getTime() - a.en.getTime())
    .slice(0, TOPE_DE_CAMBIOS_RECIENTES);

  return { snapshot, conteos, porTipo, cambiosRecientes, truncado };
}

/** `GET /growth/admin/conocimiento/:clave/historial`: todas las versiones de una clave. */
export async function historialDeAfirmacion(clave: string) {
  const versiones = await prisma.growthAfirmacion.findMany({
    where: { clave },
    orderBy: [{ vigenteDesde: "desc" }, { id: "desc" }],
    take: 200,
    select: {
      id: true,
      tipo: true,
      texto: true,
      valor: true,
      fuente: true,
      commitSha: true,
      vigenteDesde: true,
      vigenteHasta: true,
    },
  });
  if (versiones.length === 0) {
    throw new ErrorDeGrowth(404, "Esa afirmación no existe.");
  }
  return { clave, versiones };
}
