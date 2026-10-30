import { createHash } from "node:crypto";
import type {
  GrowthEstadoOportunidad as Estado,
  GrowthObjetivo as Objetivo,
  GrowthTipoBorrador as TipoDeBorrador,
  Prisma,
} from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import {
  TOPE_SEMANAL_POR_DEFECTO,
  UMBRAL_DE_SIMILITUD_POR_DEFECTO,
  evaluarCumplimiento,
} from "./cumplimiento.js";
import { puedeTransicionar, transicionesPosibles } from "./estados.js";

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Cuánto se guarda el extracto de una página de terceros. */
export const DIAS_DE_RETENCION = 180;

/** Error con el código HTTP que debe devolver la ruta. */
export class ErrorDeGrowth extends Error {
  constructor(
    public readonly status: number,
    mensaje: string
  ) {
    super(mensaje);
    this.name = "ErrorDeGrowth";
  }
}

// ── URL ──────────────────────────────────────────────────────────────────

const PARAMETROS_DE_SEGUIMIENTO = /^(utm_|gclid$|fbclid$|mc_|ref$)/i;

/** La misma página con distinto seguimiento, `www` o barra final es la misma. */
export function normalizarUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ErrorDeGrowth(400, "La URL no es válida.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ErrorDeGrowth(400, "La URL debe ser http o https.");
  }

  const parametros = [...parsed.searchParams.entries()]
    .filter(([clave]) => !PARAMETROS_DE_SEGUIMIENTO.test(clave))
    .sort(([a], [b]) => a.localeCompare(b));
  const consulta = new URLSearchParams(parametros).toString();
  const ruta =
    parsed.pathname.length > 1
      ? parsed.pathname.replace(/\/+$/, "")
      : parsed.pathname;

  return `${parsed.protocol}//${dominioDeUrl(url)}${ruta}${consulta ? `?${consulta}` : ""}`;
}

export function dominioDeUrl(url: string): string {
  return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
}

export function claveDeUrl(url: string): string {
  return createHash("sha256").update(normalizarUrl(url)).digest("hex");
}

// ── Lo que lee el agente ─────────────────────────────────────────────────

export async function contextoParaElAgente() {
  const [ajustes, afirmaciones, competidores, nichos, fuentes] =
    await Promise.all([
      prisma.growthAjuste.findMany(),
      prisma.growthAfirmacion.findMany({
        where: { vigenteHasta: null },
        orderBy: { clave: "asc" },
      }),
      prisma.growthCompetidor.findMany({ orderBy: { nombre: "asc" } }),
      prisma.growthNicho.findMany({
        where: { estado: { in: ["activo", "candidato"] } },
        orderBy: { slug: "asc" },
      }),
      prisma.growthFuente.findMany({ where: { activa: true } }),
    ]);

  return {
    ajustes: Object.fromEntries(ajustes.map((a) => [a.clave, a.valor])),
    afirmaciones: afirmaciones.map((a) => ({
      clave: a.clave,
      tipo: a.tipo,
      texto: a.texto,
      valor: a.valor,
      fuente: a.fuente,
      commitSha: a.commitSha,
    })),
    competidores,
    nichos,
    fuentes,
  };
}

// ── Oportunidades (agente) ───────────────────────────────────────────────

export type DatosDeOportunidad = {
  fuenteId: string;
  nichoId?: string;
  url: string;
  titulo: string;
  extracto: string;
  idioma?: string;
  objetivoPrincipal: Objetivo;
  puntTrafico?: number;
  puntLeads?: number;
  puntBacklinks?: number;
  datos?: Prisma.InputJsonValue;
  expiraEn?: Date;
  ejecucionId?: string;
};

export async function crearOportunidad(datos: DatosDeOportunidad) {
  const claveExterna = claveDeUrl(datos.url);

  const existente = await prisma.growthOportunidad.findUnique({
    where: { claveExterna },
    select: { id: true, estado: true },
  });
  if (existente) return { creada: false, ...existente };

  try {
    const creada = await prisma.growthOportunidad.create({
      data: {
        ...datos,
        claveExterna,
        url: normalizarUrl(datos.url),
        dominio: dominioDeUrl(datos.url),
        extracto: datos.extracto.slice(0, 500),
        retencionHasta: new Date(Date.now() + DIAS_DE_RETENCION * MS_POR_DIA),
      },
      select: { id: true, estado: true },
    });
    return { creada: true, ...creada };
  } catch (error) {
    // Dos runs a la vez con la misma URL: gana el primero.
    if ((error as { code?: string }).code === "P2002") {
      const ganadora = await prisma.growthOportunidad.findUniqueOrThrow({
        where: { claveExterna },
        select: { id: true, estado: true },
      });
      return { creada: false, ...ganadora };
    }
    throw error;
  }
}

export async function transicionarComoAgente(
  id: string,
  a: Estado,
  motivo?: string
) {
  const oportunidad = await prisma.growthOportunidad.findUnique({
    where: { id },
    select: { estado: true },
  });
  if (!oportunidad) throw new ErrorDeGrowth(404, "La oportunidad no existe.");
  if (!puedeTransicionar(oportunidad.estado, a, "agente")) {
    throw new ErrorDeGrowth(
      409,
      `Una oportunidad ${oportunidad.estado} no puede pasar a ${a}.`
    );
  }
  if (a === "descartada" && !motivo) {
    throw new ErrorDeGrowth(400, "Descartar exige un motivo.");
  }

  return prisma.growthOportunidad.update({
    where: { id },
    data: {
      estado: a,
      ...(a === "descartada" ? { motivoDescarte: motivo } : {}),
    },
    select: { id: true, estado: true },
  });
}

export type DatosDeInvestigacion = {
  resumen: string;
  quienEdita?: string;
  viaDeContacto?: string;
  competidoresEnlazados?: Prisma.InputJsonValue;
  contexto?: Prisma.InputJsonValue;
};

export async function guardarInvestigacion(
  oportunidadId: string,
  datos: DatosDeInvestigacion
) {
  const oportunidad = await prisma.growthOportunidad.findUnique({
    where: { id: oportunidadId },
    select: { id: true },
  });
  if (!oportunidad) throw new ErrorDeGrowth(404, "La oportunidad no existe.");

  return prisma.growthInvestigacion.upsert({
    where: { oportunidadId },
    create: { oportunidadId, ...datos },
    update: datos,
    select: { oportunidadId: true },
  });
}

// ── Borradores (agente) ──────────────────────────────────────────────────

export type DatosDeBorrador = {
  tipo: TipoDeBorrador;
  asunto?: string;
  texto: string;
  enlaceUrl?: string;
  utm?: Prisma.InputJsonValue;
  afirmaciones: string[];
};

type AfirmacionConTerminos = {
  tipo: string;
  texto: string;
  valor: Prisma.JsonValue | null;
};

/** Una afirmación `prohibida` puede traer su lista en `valor.terminos`. */
function terminosProhibidosDe(a: AfirmacionConTerminos): string[] {
  const valor = a.valor;
  if (
    valor &&
    typeof valor === "object" &&
    !Array.isArray(valor) &&
    Array.isArray(valor.terminos)
  ) {
    return valor.terminos.filter((t): t is string => typeof t === "string");
  }
  return [a.texto];
}

function ajusteNumerico(
  ajustes: { clave: string; valor: Prisma.JsonValue }[],
  clave: string,
  porDefecto: number
): number {
  const valor = ajustes.find((a) => a.clave === clave)?.valor;
  return typeof valor === "number" && Number.isFinite(valor)
    ? valor
    : porDefecto;
}

/**
 * Crea un borrador y lo somete a las reglas duras en la misma petición. Si
 * alguna falla, el borrador queda `bloqueado` (y la oportunidad `bloqueada`)
 * con el motivo; si no, pasa a `pendiente_aprobacion` para que lo revise el
 * fundador. El agente no puede saltarse esto: es el único camino.
 */
export async function crearBorrador(
  oportunidadId: string,
  datos: DatosDeBorrador
) {
  const oportunidad = await prisma.growthOportunidad.findUnique({
    where: { id: oportunidadId },
    select: { id: true, estado: true, dominio: true, objetivoPrincipal: true },
  });
  if (!oportunidad) throw new ErrorDeGrowth(404, "La oportunidad no existe.");
  if (!puedeTransicionar(oportunidad.estado, "con_borrador", "agente")) {
    throw new ErrorDeGrowth(
      409,
      `No se puede redactar un borrador de una oportunidad ${oportunidad.estado}.`
    );
  }

  const ahora = new Date();
  const [afirmaciones, competidores, ajustes, anteriores, gestiones, semana] =
    await Promise.all([
      prisma.growthAfirmacion.findMany({
        where: { vigenteHasta: null },
        select: { clave: true, tipo: true, texto: true, valor: true },
      }),
      prisma.growthCompetidor.findMany({ select: { nombre: true } }),
      prisma.growthAjuste.findMany({
        where: { clave: { in: ["topeSemanal", "umbralDeSimilitud"] } },
      }),
      prisma.growthBorrador.findMany({
        orderBy: { creadoEn: "desc" },
        take: 30,
        select: { texto: true, textoFinal: true },
      }),
      prisma.growthGestion.findMany({
        where: {
          dominio: oportunidad.dominio,
          hechaEn: { gte: new Date(ahora.getTime() - 90 * MS_POR_DIA) },
        },
        select: { hechaEn: true },
      }),
      prisma.growthGestion.count({
        where: { hechaEn: { gte: new Date(ahora.getTime() - 7 * MS_POR_DIA) } },
      }),
    ]);

  const { resultado, comprobaciones } = evaluarCumplimiento(
    { ...datos, objetivo: oportunidad.objetivoPrincipal },
    {
      clavesVigentes: new Set(afirmaciones.map((a) => a.clave)),
      terminosProhibidos: afirmaciones
        .filter((a) => a.tipo === "prohibida")
        .flatMap(terminosProhibidosDe),
      competidores: competidores.map((c) => c.nombre),
      textosAnteriores: anteriores.flatMap((b) =>
        b.textoFinal ? [b.texto, b.textoFinal] : [b.texto]
      ),
      gestionesDelDominio: gestiones.map((g) => g.hechaEn),
      contactosEstaSemana: semana,
      topeSemanal: ajusteNumerico(
        ajustes,
        "topeSemanal",
        TOPE_SEMANAL_POR_DEFECTO
      ),
      umbralDeSimilitud: ajusteNumerico(
        ajustes,
        "umbralDeSimilitud",
        UMBRAL_DE_SIMILITUD_POR_DEFECTO
      ),
      ahora,
    }
  );

  const bloquea = resultado === "bloquea";

  return prisma.$transaction(async (tx) => {
    const version =
      (await tx.growthBorrador.count({ where: { oportunidadId } })) + 1;

    const borrador = await tx.growthBorrador.create({
      data: {
        oportunidadId,
        version,
        tipo: datos.tipo,
        objetivo: oportunidad.objetivoPrincipal,
        asunto: datos.asunto,
        texto: datos.texto,
        enlaceUrl: datos.enlaceUrl,
        utm: datos.utm,
        afirmaciones: datos.afirmaciones,
        estado: bloquea ? "bloqueado" : "pendiente_aprobacion",
      },
      select: { id: true, version: true, estado: true },
    });
    await tx.growthRevisionCumplimiento.create({
      data: {
        borradorId: borrador.id,
        resultado,
        comprobaciones: comprobaciones as unknown as Prisma.InputJsonValue,
        revisor: "reglas",
      },
    });
    await tx.growthOportunidad.update({
      where: { id: oportunidadId },
      data: { estado: bloquea ? "bloqueada" : "pendiente_aprobacion" },
    });

    return { borrador, resultado, comprobaciones };
  });
}

// ── Lo que ve y decide el administrador ──────────────────────────────────

export async function listarOportunidades(filtros: {
  estado?: Estado;
  objetivo?: Objetivo;
  limite: number;
}) {
  const filas = await prisma.growthOportunidad.findMany({
    where: {
      ...(filtros.estado ? { estado: filtros.estado } : {}),
      ...(filtros.objetivo ? { objetivoPrincipal: filtros.objetivo } : {}),
    },
    orderBy: { detectadaEn: "desc" },
    take: filtros.limite,
    select: {
      id: true,
      url: true,
      dominio: true,
      titulo: true,
      objetivoPrincipal: true,
      estado: true,
      puntTrafico: true,
      puntLeads: true,
      puntBacklinks: true,
      detectadaEn: true,
      expiraEn: true,
      motivoDescarte: true,
    },
  });

  return filas.map((f) => ({
    ...f,
    puntuacion: Math.max(f.puntTrafico, f.puntLeads, f.puntBacklinks),
  }));
}

export async function detalleDeOportunidad(id: string) {
  const oportunidad = await prisma.growthOportunidad.findUnique({
    where: { id },
    include: {
      investigacion: true,
      borradores: {
        orderBy: { version: "desc" },
        include: { revisiones: { orderBy: { creadaEn: "desc" } } },
      },
      decisiones: { orderBy: { en: "desc" } },
    },
  });
  if (!oportunidad) throw new ErrorDeGrowth(404, "La oportunidad no existe.");

  return {
    ...oportunidad,
    accionesPosibles: transicionesPosibles(oportunidad.estado, "admin"),
  };
}

export type CanalDeGestion =
  "email" | "formulario" | "alta_directorio" | "otro";

export type Decision =
  | { accion: "aprobar"; borradorId: string }
  | { accion: "devolver"; motivo: string }
  | { accion: "descartar"; motivo: string }
  | {
      accion: "marcar_gestionado";
      canal: CanalDeGestion;
      hechaEn?: Date;
      notas?: string;
    }
  | { accion: "conseguido"; urlConseguida: string }
  | { accion: "sin_respuesta"; notas?: string };

const ESTADO_POR_ACCION: Record<Decision["accion"], Estado> = {
  aprobar: "aprobada",
  devolver: "devuelta",
  descartar: "descartada",
  marcar_gestionado: "gestionada",
  conseguido: "conseguida",
  sin_respuesta: "sin_respuesta",
};

const BORRADORES_ABIERTOS = [
  "borrador",
  "bloqueado",
  "pendiente_aprobacion",
  "aprobado",
] as const;

/**
 * Lo que decide el fundador. Todo ocurre en una transacción y deja una fila
 * en `growth_decisiones`, que nunca se edita ni se borra.
 */
export async function decidir(id: string, decision: Decision, por: string) {
  return prisma.$transaction(async (tx) => {
    const oportunidad = await tx.growthOportunidad.findUnique({
      where: { id },
      include: { borradores: { include: { gestion: true } } },
    });
    if (!oportunidad) throw new ErrorDeGrowth(404, "La oportunidad no existe.");

    const destino = ESTADO_POR_ACCION[decision.accion];
    if (!puedeTransicionar(oportunidad.estado, destino, "admin")) {
      throw new ErrorDeGrowth(
        409,
        `Una oportunidad ${oportunidad.estado} no admite «${decision.accion}».`
      );
    }

    let borradorId: string | undefined;
    let motivo: string | undefined;

    switch (decision.accion) {
      case "aprobar": {
        const borrador = oportunidad.borradores.find(
          (b) => b.id === decision.borradorId
        );
        if (!borrador || borrador.estado !== "pendiente_aprobacion") {
          throw new ErrorDeGrowth(
            409,
            "Ese borrador no está pendiente de aprobación."
          );
        }
        borradorId = borrador.id;
        await tx.growthBorrador.update({
          where: { id: borrador.id },
          data: { estado: "aprobado" },
        });
        break;
      }
      case "devolver":
      case "descartar": {
        motivo = decision.motivo;
        await tx.growthBorrador.updateMany({
          where: {
            oportunidadId: id,
            estado: { in: [...BORRADORES_ABIERTOS] },
          },
          data: { estado: "descartado" },
        });
        break;
      }
      case "marcar_gestionado": {
        const aprobado = oportunidad.borradores.find(
          (b) => b.estado === "aprobado"
        );
        if (!aprobado) {
          throw new ErrorDeGrowth(409, "No hay ningún borrador aprobado.");
        }
        borradorId = aprobado.id;
        await tx.growthGestion.create({
          data: {
            borradorId: aprobado.id,
            canal: decision.canal,
            dominio: oportunidad.dominio,
            hechaEn: decision.hechaEn ?? new Date(),
            notas: decision.notas,
          },
        });
        await tx.growthBorrador.update({
          where: { id: aprobado.id },
          data: { estado: "gestionado" },
        });
        break;
      }
      case "conseguido":
      case "sin_respuesta": {
        const gestionado = oportunidad.borradores.find(
          (b) => b.estado === "gestionado" && b.gestion
        );
        if (!gestionado?.gestion) {
          throw new ErrorDeGrowth(409, "No hay ninguna gestión registrada.");
        }
        borradorId = gestionado.id;
        await tx.growthGestion.update({
          where: { id: gestionado.gestion.id },
          data:
            decision.accion === "conseguido"
              ? {
                  resultado: "aceptado",
                  urlConseguida: decision.urlConseguida,
                  respuestaEn: new Date(),
                }
              : { resultado: "sin_respuesta", notas: decision.notas },
        });
        break;
      }
    }

    await tx.growthOportunidad.update({
      where: { id },
      data: {
        estado: destino,
        ...(decision.accion === "descartar" ? { motivoDescarte: motivo } : {}),
      },
    });
    await tx.growthDecision.create({
      data: {
        oportunidadId: id,
        borradorId,
        accion: decision.accion,
        motivo,
        por,
      },
    });

    return { id, estado: destino };
  });
}
