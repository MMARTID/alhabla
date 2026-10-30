import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import {
  DIAS_ENTRE_CONTACTOS_AL_MISMO_DOMINIO,
  evaluarCumplimiento,
  type BorradorAEvaluar,
  type Comprobacion,
  type ContextoDeCumplimiento,
  type OpcionesDeEvaluacion,
  type ResultadoDeCumplimiento,
  type TerminoProhibido,
} from "./cumplimiento.js";
import {
  AJUSTES_POR_DEFECTO,
  LIMITES_DE_AJUSTES,
  OBJETIVOS,
  type Objetivo,
} from "./esquemas.js";

/**
 * Lo que las reglas duras (y el agente, en `/contexto`) necesitan saber del
 * estado de Growth: ajustes efectivos, contactos de la semana, dominios en
 * enfriamiento y los textos con los que comparar. Un solo sitio para que
 * crear un borrador, editarlo y aprobarlo evalúen exactamente igual.
 */

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Hasta dónde mira atrás la regla de plantilla repetida: los mensajes de los
 * últimos 180 días (lo que dura el extracto de una página de terceros). Lo que
 * se escribió hace más ya no se recuerda; lo de dentro de ese plazo se compara
 * entero, sin tope de filas.
 */
export const DIAS_DE_MEMORIA_DE_PLANTILLAS = 180;

/**
 * Seguro contra una tabla desbocada, no un recorte de la comparación: a un
 * ritmo de cinco contactos a la semana, 180 días son unos pocos cientos de
 * textos como mucho.
 */
const MAXIMO_DE_TEXTOS_ANTERIORES = 2000;

/**
 * Los borradores que cuentan como «lo que ya hemos dicho»: los que están a la
 * espera de salir, los aprobados y los que ya se enviaron. Un borrador
 * bloqueado, descartado o a medias nunca salió ni saldrá: no puede impedir que
 * se apruebe otro.
 */
export const ESTADOS_DE_BORRADOR_QUE_CUENTAN_COMO_DICHOS = [
  "pendiente_aprobacion",
  "aprobado",
  "gestionado",
] as const;

export type ClienteDeBd = Prisma.TransactionClient;

// ── Ajustes ──────────────────────────────────────────────────────────────

/** Las claves de `growth_ajustes` que edita el administrador. */
export const CLAVES_DE_AJUSTES = [
  "topeSemanal",
  "umbralDeSimilitud",
  "umbralesPorObjetivo",
  "pausa",
] as const;

export type AjustesEfectivos = {
  topeSemanal: number;
  umbralDeSimilitud: number;
  umbralesPorObjetivo: Record<Objetivo, number>;
  pausa: boolean;
};

function numeroEnRango(
  valor: unknown,
  [minimo, maximo]: readonly [number, number],
  entero: boolean
): number | null {
  if (typeof valor !== "number" || !Number.isFinite(valor)) return null;
  if (entero && !Number.isInteger(valor)) return null;
  return valor >= minimo && valor <= maximo ? valor : null;
}

/**
 * Mezcla las filas de `growth_ajustes` con los valores por defecto. Un valor
 * guardado fuera de rango (alguien tocó la base a mano) no se aplica y se
 * dice en el log: aplicarlo debilitaría una regla dura sin que nadie lo vea.
 */
export function ajustesEfectivosDe(
  filas: readonly { clave: string; valor: Prisma.JsonValue }[]
): AjustesEfectivos {
  const valorDe = (clave: string) =>
    filas.find((f) => f.clave === clave)?.valor;
  const ignorado = (clave: string) =>
    console.error(
      `[Growth] El ajuste «${clave}» guardado no es válido: se usa el valor por defecto.`
    );

  const efectivos: AjustesEfectivos = {
    topeSemanal: AJUSTES_POR_DEFECTO.topeSemanal,
    umbralDeSimilitud: AJUSTES_POR_DEFECTO.umbralDeSimilitud,
    umbralesPorObjetivo: { ...AJUSTES_POR_DEFECTO.umbralesPorObjetivo },
    pausa: AJUSTES_POR_DEFECTO.pausa,
  };

  const tope = valorDe("topeSemanal");
  if (tope !== undefined) {
    const valido = numeroEnRango(tope, LIMITES_DE_AJUSTES.topeSemanal, true);
    if (valido === null) ignorado("topeSemanal");
    else efectivos.topeSemanal = valido;
  }

  const similitud = valorDe("umbralDeSimilitud");
  if (similitud !== undefined) {
    const valido = numeroEnRango(
      similitud,
      LIMITES_DE_AJUSTES.umbralDeSimilitud,
      false
    );
    if (valido === null) ignorado("umbralDeSimilitud");
    else efectivos.umbralDeSimilitud = valido;
  }

  const umbrales = valorDe("umbralesPorObjetivo");
  if (umbrales !== undefined) {
    if (!umbrales || typeof umbrales !== "object" || Array.isArray(umbrales)) {
      ignorado("umbralesPorObjetivo");
    } else {
      for (const objetivo of OBJETIVOS) {
        const valido = numeroEnRango(
          (umbrales as Record<string, unknown>)[objetivo],
          LIMITES_DE_AJUSTES.umbralesPorObjetivo,
          true
        );
        if (valido === null) ignorado(`umbralesPorObjetivo.${objetivo}`);
        else efectivos.umbralesPorObjetivo[objetivo] = valido;
      }
    }
  }

  const pausa = valorDe("pausa");
  if (pausa !== undefined) {
    if (typeof pausa === "boolean") efectivos.pausa = pausa;
    else ignorado("pausa");
  }

  return efectivos;
}

/** Los ajustes que valen ahora, y cuándo se guardó cada uno. */
export async function leerAjustesEfectivos(cliente: ClienteDeBd = prisma) {
  const filas = await cliente.growthAjuste.findMany({
    where: { clave: { in: [...CLAVES_DE_AJUSTES] } },
  });
  return {
    valores: ajustesEfectivosDe(filas),
    actualizadoEn: Object.fromEntries(
      CLAVES_DE_AJUSTES.map((clave) => [
        clave,
        filas.find((f) => f.clave === clave)?.actualizadoEn ?? null,
      ])
    ) as Record<(typeof CLAVES_DE_AJUSTES)[number], Date | null>,
  };
}

// ── Contactos y enfriamiento ─────────────────────────────────────────────

export type ContactosDeLaSemana = {
  /** Gestiones hechas en los últimos 7 días. */
  hechas: number;
  /** Oportunidades aprobadas que aún no se han gestionado. */
  aprobadasSinGestionar: number;
  /** `hechas + aprobadasSinGestionar`: lo que cuenta para el tope semanal. */
  total: number;
};

/**
 * Los contactos de la semana: lo ya hecho y lo ya comprometido. Aprobar es
 * comprometerse a contactar, así que cuenta aunque aún no se haya enviado.
 */
export async function contactosDeLaSemana(
  cliente: ClienteDeBd,
  opciones: { ahora?: Date; excluirOportunidadId?: string } = {}
): Promise<ContactosDeLaSemana> {
  const ahora = opciones.ahora ?? new Date();
  const [hechas, aprobadasSinGestionar] = await Promise.all([
    cliente.growthGestion.count({
      where: { hechaEn: { gte: new Date(ahora.getTime() - 7 * MS_POR_DIA) } },
    }),
    cliente.growthOportunidad.count({
      where: {
        estado: "aprobada",
        ...(opciones.excluirOportunidadId
          ? { id: { not: opciones.excluirOportunidadId } }
          : {}),
      },
    }),
  ]);
  return {
    hechas,
    aprobadasSinGestionar,
    total: hechas + aprobadasSinGestionar,
  };
}

export type DominioEnEnfriamiento = { dominio: string; hasta: Date };

/**
 * Dominios con los que ya se contactó en los últimos 90 días (y hasta cuándo
 * no se puede volver a escribir) y dominios con una oportunidad aprobada
 * pendiente de gestionar. El agente los lee para no gastar investigación en
 * destinos que las reglas duras bloquearán después.
 */
export async function dominiosEnEnfriamiento(
  cliente: ClienteDeBd,
  ahora = new Date()
): Promise<{
  dominiosEnEnfriamiento: DominioEnEnfriamiento[];
  dominiosConAprobadaPendiente: string[];
}> {
  const desde = new Date(
    ahora.getTime() - DIAS_ENTRE_CONTACTOS_AL_MISMO_DOMINIO * MS_POR_DIA
  );
  const [gestiones, aprobadas] = await Promise.all([
    cliente.growthGestion.findMany({
      where: { hechaEn: { gte: desde } },
      orderBy: { hechaEn: "desc" },
      take: 500,
      select: { dominio: true, hechaEn: true },
    }),
    cliente.growthOportunidad.findMany({
      where: { estado: "aprobada" },
      take: 500,
      select: { dominio: true },
    }),
  ]);

  const ultimaPorDominio = new Map<string, Date>();
  for (const g of gestiones) {
    if (!ultimaPorDominio.has(g.dominio)) {
      ultimaPorDominio.set(g.dominio, g.hechaEn);
    }
  }
  return {
    dominiosEnEnfriamiento: [...ultimaPorDominio].map(([dominio, hechaEn]) => ({
      dominio,
      hasta: new Date(
        hechaEn.getTime() + DIAS_ENTRE_CONTACTOS_AL_MISMO_DOMINIO * MS_POR_DIA
      ),
    })),
    dominiosConAprobadaPendiente: [...new Set(aprobadas.map((o) => o.dominio))],
  };
}

// ── Snapshot del conocimiento ────────────────────────────────────────────

/** La clave de `growth_ajustes` donde el sincronizador deja su huella. */
export const CLAVE_DEL_SNAPSHOT_DE_CONOCIMIENTO = "sistema.conocimiento";

/** Cuántos días sin sincronizar hacen que el conocimiento se dé por obsoleto. */
export const DIAS_PARA_DAR_POR_OBSOLETO_EL_CONOCIMIENTO = 8;

export type SnapshotDeConocimiento = {
  commitSha: string;
  /** Cuándo se sincronizó por última vez (aunque no cambiara nada). */
  sincronizadoEn: string;
  antiguedadHoras: number;
  obsoleto: boolean;
  vigentes: number;
  porTipo: Record<string, number>;
};

/**
 * Lo que guarda el sincronizador en `growth_ajustes['sistema.conocimiento']`
 * (`{ commitSha, vigentes, porTipo, previo? }`) más su `actualizadoEn`, en la
 * forma que ven el agente y el dashboard. Devuelve `null` si nunca se
 * sincronizó o si el valor guardado no tiene sentido.
 */
export function construirSnapshotDeConocimiento(
  valor: Prisma.JsonValue | undefined,
  actualizadoEn: Date | undefined,
  ahora = new Date()
): SnapshotDeConocimiento | null {
  if (!actualizadoEn || !valor || typeof valor !== "object") return null;
  if (Array.isArray(valor)) return null;
  const { commitSha, vigentes, porTipo } = valor as Record<string, unknown>;
  if (typeof commitSha !== "string") return null;

  const horas = Math.max(
    0,
    (ahora.getTime() - actualizadoEn.getTime()) / (60 * 60 * 1000)
  );
  const conteos: Record<string, number> = {};
  if (porTipo && typeof porTipo === "object" && !Array.isArray(porTipo)) {
    for (const [tipo, n] of Object.entries(porTipo)) {
      if (typeof n === "number" && Number.isFinite(n)) conteos[tipo] = n;
    }
  }
  return {
    commitSha,
    sincronizadoEn: actualizadoEn.toISOString(),
    antiguedadHoras: Math.round(horas * 10) / 10,
    obsoleto: horas > DIAS_PARA_DAR_POR_OBSOLETO_EL_CONOCIMIENTO * 24,
    vigentes: typeof vigentes === "number" ? vigentes : 0,
    porTipo: conteos,
  };
}

export async function leerSnapshotDeConocimiento(
  cliente: ClienteDeBd = prisma,
  ahora = new Date()
): Promise<SnapshotDeConocimiento | null> {
  const fila = await cliente.growthAjuste.findUnique({
    where: { clave: CLAVE_DEL_SNAPSHOT_DE_CONOCIMIENTO },
  });
  return construirSnapshotDeConocimiento(
    fila?.valor,
    fila?.actualizadoEn,
    ahora
  );
}

// ── Contexto de cumplimiento ─────────────────────────────────────────────

/**
 * Una afirmación `prohibida` trae su lista en `valor.terminos` y dice si se
 * busca como palabra entera en `valor.palabrasEnteras` (por defecto sí). Sin
 * lista, queda la frase de `texto` completa.
 */
export function terminosProhibidosDe(a: {
  texto: string;
  valor: Prisma.JsonValue | null;
}): TerminoProhibido[] {
  const valor = a.valor;
  if (
    valor &&
    typeof valor === "object" &&
    !Array.isArray(valor) &&
    Array.isArray(valor.terminos)
  ) {
    const palabraEntera = valor.palabrasEnteras !== false;
    return valor.terminos
      .filter((t): t is string => typeof t === "string")
      .map((termino) => ({ termino, palabraEntera }));
  }
  return [{ termino: a.texto, palabraEntera: true }];
}

export type OpcionesDeContexto = {
  /** Dominio de la oportunidad a la que pertenece el borrador. */
  dominio: string;
  oportunidadId: string;
  /** El propio borrador, si ya existe: no se compara consigo mismo. */
  excluirBorradorId?: string;
  /**
   * Cuándo se creó el borrador que se evalúa. Solo se compara con lo que se
   * escribió ANTES: un borrador posterior que se parezca a este no puede
   * impedir que se apruebe este. Sin él, se busca la fecha de
   * `excluirBorradorId` y, si tampoco hay, es un borrador nuevo y se compara
   * con todo lo que ya existe.
   */
  creadoEn?: Date;
  /** Claves que cita el borrador (para que la regla 3 sepa de qué competidor son). */
  afirmaciones?: readonly string[];
  /**
   * `true` (por defecto): lo aprobado y aún sin gestionar cuenta para el tope
   * semanal y para «un contacto por dominio». `false` solo al aprobar: ahí
   * esas dos restricciones tienen su propio 409 y no bloquean el borrador.
   */
  incluirAprobadas?: boolean;
  cliente?: ClienteDeBd;
  ahora?: Date;
};

/** Cuándo se creó el borrador que se evalúa; `null` si es nuevo (aún no existe). */
async function fechaDeCreacionDelEvaluado(
  opciones: OpcionesDeContexto,
  cliente: ClienteDeBd
): Promise<Date | null> {
  if (opciones.creadoEn) return opciones.creadoEn;
  if (opciones.excluirBorradorId) {
    const propio = await cliente.growthBorrador.findUnique({
      where: { id: opciones.excluirBorradorId },
      select: { creadoEn: true },
    });
    if (propio?.creadoEn instanceof Date) return propio.creadoEn;
  }
  // Un borrador nuevo: todo lo que ya existe es anterior, sin fiarse del reloj.
  return null;
}

/**
 * Construye el contexto de las reglas de cumplimiento. Lo usan crear un
 * borrador, editarlo, evaluarlo sin guardar y aprobarlo, para que las cuatro
 * cosas den el mismo resultado sobre el mismo texto.
 */
export async function contextoDeCumplimiento(opciones: OpcionesDeContexto) {
  const cliente = opciones.cliente ?? prisma;
  const ahora = opciones.ahora ?? new Date();
  const incluirAprobadas = opciones.incluirAprobadas ?? true;
  const citadas = new Set(opciones.afirmaciones ?? []);
  const creadoAntesDe = await fechaDeCreacionDelEvaluado(opciones, cliente);

  const [
    afirmaciones,
    competidores,
    ajustes,
    deOtrasOportunidades,
    deLaMismaOportunidad,
    gestiones,
    contactos,
    aprobadasDelDominio,
  ] = await Promise.all([
    cliente.growthAfirmacion.findMany({
      where: { vigenteHasta: null },
      select: { clave: true, tipo: true, texto: true, valor: true },
    }),
    cliente.growthCompetidor.findMany({
      select: { nombre: true, dominio: true },
    }),
    leerAjustesEfectivos(cliente),
    // Solo lo que de verdad se dijo (o se va a decir) y se escribió antes que
    // este borrador, de los últimos 180 días: ni lo posterior, ni lo
    // bloqueado, ni lo descartado, ni un recorte por número de filas.
    cliente.growthBorrador.findMany({
      where: {
        oportunidadId: { not: opciones.oportunidadId },
        estado: { in: [...ESTADOS_DE_BORRADOR_QUE_CUENTAN_COMO_DICHOS] },
        creadoEn: {
          ...(creadoAntesDe ? { lt: creadoAntesDe } : {}),
          gte: new Date(
            ahora.getTime() - DIAS_DE_MEMORIA_DE_PLANTILLAS * MS_POR_DIA
          ),
        },
      },
      orderBy: { creadoEn: "desc" },
      take: MAXIMO_DE_TEXTOS_ANTERIORES,
      select: { texto: true, textoFinal: true },
    }),
    cliente.growthBorrador.findMany({
      where: {
        oportunidadId: opciones.oportunidadId,
        ...(opciones.excluirBorradorId
          ? { id: { not: opciones.excluirBorradorId } }
          : {}),
      },
      orderBy: { creadoEn: "desc" },
      take: 10,
      select: { texto: true, textoFinal: true },
    }),
    cliente.growthGestion.findMany({
      where: {
        dominio: opciones.dominio,
        hechaEn: {
          gte: new Date(
            ahora.getTime() - DIAS_ENTRE_CONTACTOS_AL_MISMO_DOMINIO * MS_POR_DIA
          ),
        },
      },
      select: { hechaEn: true },
    }),
    contactosDeLaSemana(cliente, {
      ahora,
      excluirOportunidadId: opciones.oportunidadId,
    }),
    cliente.growthOportunidad.count({
      where: {
        estado: "aprobada",
        dominio: opciones.dominio,
        id: { not: opciones.oportunidadId },
      },
    }),
  ]);

  const textosDe = (
    borradores: { texto: string; textoFinal: string | null }[]
  ) =>
    borradores.flatMap((b) =>
      b.textoFinal ? [b.texto, b.textoFinal] : [b.texto]
    );

  const contexto: ContextoDeCumplimiento = {
    clavesVigentes: new Set(afirmaciones.map((a) => a.clave)),
    afirmacionesCitadas: afirmaciones
      .filter((a) => citadas.has(a.clave))
      .map((a) => ({ clave: a.clave, tipo: a.tipo, valor: a.valor })),
    terminosProhibidos: afirmaciones
      .filter((a) => a.tipo === "prohibida")
      .flatMap(terminosProhibidosDe),
    competidores,
    textosAnteriores: textosDe(deOtrasOportunidades),
    textosDeLaMismaOportunidad: textosDe(deLaMismaOportunidad),
    gestionesDelDominio: gestiones.map((g) => g.hechaEn),
    aprobadasDelDominio: incluirAprobadas ? aprobadasDelDominio : 0,
    contactosEstaSemana: incluirAprobadas ? contactos.total : contactos.hechas,
    topeSemanal: ajustes.valores.topeSemanal,
    umbralDeSimilitud: ajustes.valores.umbralDeSimilitud,
    ahora,
  };

  return {
    contexto,
    ajustes: ajustes.valores,
    /** Los contactos, con lo aprobado y lo hecho por separado, sea cual sea `incluirAprobadas`. */
    agenda: {
      contactos,
      aprobadasDelDominio,
      gestionesDelDominio: gestiones.map((g) => g.hechaEn),
    },
  };
}

export type ResultadoDeEvaluacion = {
  resultado: ResultadoDeCumplimiento;
  comprobaciones: Comprobacion[];
  ajustes: AjustesEfectivos;
  agenda: Awaited<ReturnType<typeof contextoDeCumplimiento>>["agenda"];
};

/** Contexto fresco + reglas, en una llamada. No escribe nada. */
export async function evaluarBorradorConContexto(
  borrador: BorradorAEvaluar,
  opciones: OpcionesDeContexto & OpcionesDeEvaluacion
): Promise<ResultadoDeEvaluacion> {
  const { agendaComoAviso, ...deContexto } = opciones;
  const { contexto, ajustes, agenda } = await contextoDeCumplimiento({
    afirmaciones: borrador.afirmaciones,
    ...deContexto,
  });
  const { resultado, comprobaciones } = evaluarCumplimiento(
    borrador,
    contexto,
    { agendaComoAviso }
  );
  return { resultado, comprobaciones, ajustes, agenda };
}
