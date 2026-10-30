import type { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma.js";
import {
  CLAVE_DEL_SNAPSHOT_DE_CONOCIMIENTO,
  construirSnapshotDeConocimiento,
  terminosProhibidosDe,
  type ClienteDeBd,
  type SnapshotDeConocimiento,
} from "../contextoDeCumplimiento.js";
import type { TerminoProhibido } from "../cumplimiento.js";
import { puedeTransicionar } from "../estados.js";
import {
  tiposCubiertosPorLaSincronizacion,
  type SincronizarBody,
  type TipoDeAfirmacion,
} from "../esquemas.js";
import {
  ErrorDeGrowth,
  POR_SISTEMA,
  porAgente,
  registrarDecision,
} from "../service.js";
import type { FuenteLeida } from "./esquemas.js";
import {
  afirmacionesConTerminosProhibidos,
  terminosProhibidosInvalidos,
} from "./terminos.js";
import {
  clavesAfectadas,
  describirDebilitamientos,
  examinarCierres,
  planSinCambios,
  planificar,
  prohibidasDebilitadas,
  type AfirmacionVigente,
  type CampoQueCambia,
  type DebilitamientoDeProhibida,
  type PlanDeSincronizacion,
} from "./planificar.js";

/**
 * Sincronización de la base de conocimiento (PLAN-GROWTH.md § 3.1).
 *
 * El extractor corre FUERA del servidor (la imagen de Cloud Run no lleva
 * `web/` ni `PRODUCT.md`) y manda el conjunto DESEADO de afirmaciones. Aquí
 * se calcula el diff contra lo vigente y se aplica en UNA transacción con un
 * cerrojo asesor: dos sincronizaciones a la vez se serializan, y como la base
 * no tiene un único parcial sobre «clave vigente», el cerrojo y `planificar`
 * son lo que garantiza una sola vigente por clave.
 *
 * Qué hace, por este orden:
 *  1. Rechaza lo que no se puede sincronizar (lote vacío, un término
 *     prohibido dentro de lo que se afirma o inservible en la lista, una
 *     prohibida debilitada, un cierre masivo sin forzar). Las dos últimas
 *     guardas son de un administrador: un token de agente no las salta.
 *  2. Crea las claves nuevas, y versiona (cierra la vigente y abre otra) las
 *     que cambian. Lo retirado se cierra con `vigenteHasta`; nada se borra.
 *  3. Bloquea los borradores en `pendiente_aprobacion` o `aprobado` que citan
 *     una clave cuyo texto o valor cambió o que se cerró, y su oportunidad.
 *     Los vuelve a leer DESPUÉS de cerrar las claves y con las filas bloqueadas
 *     (`FOR UPDATE`, oportunidad antes que borrador, como aprobar): una
 *     aprobación que se cruzó entre la lectura inicial y el cierre no se
 *     escapa con una clave cerrada.
 *  4. Siembra competidores y nichos (solo altas) y el registro de páginas.
 *  5. Guarda el snapshot (`sistema.conocimiento`) y deja rastro en
 *     `growth_decisiones`.
 *
 * Idempotente: con el mismo lote, la segunda vez no crea, cierra ni bloquea
 * nada; solo renueva la fecha del snapshot, que es lo que dice «esto se
 * comprobó hoy».
 */

export { afirmacionesConTerminosProhibidos };

export const CLAVE_DEL_CERROJO_DE_CONOCIMIENTO = "growth_conocimiento";

const PLAZO_DE_LA_TRANSACCION_MS = 15_000;
const ESPERA_DEL_CERROJO_MS = 5_000;
const MAXIMO_DE_CAMBIOS_RECIENTES = 50;
const DIAS_DE_CAMBIOS_RECIENTES = 30;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

export type CambioReciente = {
  /** Una clave, o `<tipo>.*` cuando son tantas que se resumen por tipo. */
  clave: string;
  cambio: "alta" | "modificacion" | "cierre";
  en: string;
  commitSha: string;
  /** Solo en un resumen por tipo: cuántas claves cubre. */
  cantidad?: number;
};

export type ResultadoDeSincronizacion = {
  commitSha: string;
  simulado: boolean;
  sinCambios: boolean;
  /** Falso solo en una simulación que una guarda (cierres masivos, prohibidas) rechazaría. */
  aplicable: boolean;
  motivoNoAplicable: string | null;
  /** Lo que se quitaría de la lista de términos prohibidos (vacío si nada). */
  prohibidasDebilitadas: DebilitamientoDeProhibida[];
  snapshotAnterior: { commitSha: string; sincronizadoEn: string } | null;
  nuevas: string[];
  modificadas: {
    clave: string;
    campos: CampoQueCambia[];
    semantico: boolean;
  }[];
  retiradas: string[];
  /**
   * Los mismos datos con los nombres del contrato de la API (`altas` =
   * `nuevas`, `cierres` = `retiradas`): quien los lea con unos u otros
   * nombres recibe lo mismo.
   */
  altas: string[];
  cierres: string[];
  /** Nunca hay actualización en sitio: toda diferencia versiona la afirmación. */
  actualizadasEnSitio: number;
  iguales: number;
  /** El snapshot que queda tras aplicar; `null` en una simulación. */
  snapshot: SnapshotDeConocimiento | null;
  competidoresNuevos: string[];
  nichosNuevos: string[];
  paginasNuevas: string[];
  paginasActualizadas: string[];
  borradoresBloqueados: {
    borradorId: string;
    oportunidadId: string;
    claves: string[];
  }[];
  avisos: string[];
};

export type OpcionesDeSincronizacion = {
  /** Quién firma la auditoría: `agente:<nombre del token>`. */
  agente: { nombre: string };
  simular?: boolean;
  /**
   * Salta las guardas de cierres masivos y de prohibidas debilitadas. SOLO un
   * administrador debe poder pedirlo (hoy no hay ruta de administrador que lo
   * haga): la ruta del agente no lo pasa nunca.
   */
  forzarCierres?: boolean;
  /** Ficheros leídos, con su SHA, para el snapshot. */
  fuentes?: readonly FuenteLeida[];
  ahora?: Date;
};

// ── Validaciones del lote ────────────────────────────────────────────────

function corto(commitSha: string): string {
  return commitSha.slice(0, 7);
}

/** Los términos que no se pueden decir en este lote: los suyos o, si no los trae, los vigentes. */
async function terminosProhibidosDelLote(
  cliente: ClienteDeBd,
  body: SincronizarBody,
  tipos: readonly TipoDeAfirmacion[]
): Promise<TerminoProhibido[]> {
  if (tipos.includes("prohibida")) {
    return body.afirmaciones
      .filter((a) => a.tipo === "prohibida")
      .flatMap((a) =>
        terminosProhibidosDe({
          texto: a.texto,
          valor: (a.valor ?? null) as Prisma.JsonValue | null,
        })
      );
  }
  const vigentes = await cliente.growthAfirmacion.findMany({
    where: { tipo: "prohibida", vigenteHasta: null },
    select: { texto: true, valor: true },
  });
  return vigentes.flatMap((a) => terminosProhibidosDe(a));
}

// ── Lectura de la situación ──────────────────────────────────────────────

type BorradorAfectado = {
  id: string;
  oportunidadId: string;
  estado: "pendiente_aprobacion" | "aprobado";
  afirmaciones: string[];
  oportunidad: { id: string; estado: string };
};

type Situacion = {
  plan: PlanDeSincronizacion;
  porTipoAntes: Record<string, number>;
  afectadas: string[];
  borradores: BorradorAfectado[];
  cierres: ReturnType<typeof examinarCierres>;
  snapshotPrevio: Prisma.JsonValue | null;
};

async function leerSituacion(
  cliente: ClienteDeBd,
  body: SincronizarBody,
  tipos: readonly TipoDeAfirmacion[]
): Promise<Situacion> {
  const [filas, conteos, ajuste] = await Promise.all([
    cliente.growthAfirmacion.findMany({
      where: { vigenteHasta: null, tipo: { in: [...tipos] } },
      orderBy: [{ clave: "asc" }, { vigenteDesde: "desc" }],
    }),
    cliente.growthAfirmacion.groupBy({
      by: ["tipo"],
      where: { vigenteHasta: null },
      _count: { _all: true },
    }),
    cliente.growthAjuste.findUnique({
      where: { clave: CLAVE_DEL_SNAPSHOT_DE_CONOCIMIENTO },
    }),
  ]);

  const vigentes: AfirmacionVigente[] = filas.map((f) => ({
    id: f.id,
    clave: f.clave,
    tipo: f.tipo,
    texto: f.texto,
    valor: f.valor,
    fuente: f.fuente,
    commitSha: f.commitSha,
    nichoSlug: f.nichoSlug,
    vigenteDesde: f.vigenteDesde,
  }));
  const plan = planificar(vigentes, body.afirmaciones, tipos);
  const afectadas = clavesAfectadas(plan);

  const borradores: BorradorAfectado[] =
    afectadas.length === 0
      ? []
      : ((await cliente.growthBorrador.findMany({
          where: {
            estado: { in: ["pendiente_aprobacion", "aprobado"] },
            afirmaciones: { hasSome: afectadas },
          },
          select: {
            id: true,
            oportunidadId: true,
            estado: true,
            afirmaciones: true,
            oportunidad: { select: { id: true, estado: true } },
          },
          orderBy: { creadoEn: "asc" },
        })) as BorradorAfectado[]);

  const porTipoAntes: Record<string, number> = {};
  for (const c of conteos) porTipoAntes[c.tipo] = c._count._all;

  return {
    plan,
    porTipoAntes,
    afectadas,
    borradores,
    cierres: examinarCierres(
      plan,
      vigentes.length,
      body.afirmaciones,
      vigentes,
      tipos
    ),
    snapshotPrevio: ajuste?.valor ?? null,
  };
}

// ── Escritura ────────────────────────────────────────────────────────────

function valorParaPrisma(valor: unknown): Prisma.InputJsonValue | undefined {
  return valor === undefined || valor === null
    ? undefined
    : (valor as Prisma.InputJsonValue);
}

async function escribirAfirmaciones(
  tx: ClienteDeBd,
  plan: PlanDeSincronizacion,
  commitSha: string,
  ahora: Date
): Promise<void> {
  const aCerrar = [
    ...plan.cerrar.map((v) => v.id),
    ...plan.sobrantes.map((v) => v.id),
    ...plan.reemplazar.map((r) => r.vigente.id),
  ];
  if (aCerrar.length > 0) {
    await tx.growthAfirmacion.updateMany({
      // `vigenteHasta: null` repetido: si algo la cerró entre la lectura y
      // ahora, no se vuelve a cerrar con otra fecha.
      where: { id: { in: aCerrar }, vigenteHasta: null },
      data: { vigenteHasta: ahora },
    });
  }
  const aCrear = [...plan.crear, ...plan.reemplazar.map((r) => r.nueva)];
  if (aCrear.length > 0) {
    await tx.growthAfirmacion.createMany({
      data: aCrear.map((a) => ({
        clave: a.clave,
        tipo: a.tipo,
        texto: a.texto,
        valor: valorParaPrisma(a.valor),
        fuente: a.fuente,
        commitSha,
        nichoSlug: a.nichoSlug ?? null,
        vigenteDesde: ahora,
      })),
    });
  }
}

type Siembra = {
  competidoresNuevos: string[];
  nichosNuevos: string[];
  paginasNuevas: string[];
  paginasActualizadas: string[];
};

/** Lo que haría la siembra (solo lectura); con `escribir` también lo hace. */
async function sembrar(
  tx: ClienteDeBd,
  body: SincronizarBody,
  escribir: boolean
): Promise<Siembra> {
  const siembra: Siembra = {
    competidoresNuevos: [],
    nichosNuevos: [],
    paginasNuevas: [],
    paginasActualizadas: [],
  };

  // Competidores: solo altas, nunca se tocan ni se borran los que hay.
  if (body.competidores?.length) {
    const existentes = await tx.growthCompetidor.findMany({
      where: { dominio: { in: body.competidores.map((c) => c.dominio) } },
      select: { dominio: true },
    });
    const conocidos = new Set(existentes.map((e) => e.dominio));
    const nuevos = body.competidores.filter((c) => !conocidos.has(c.dominio));
    siembra.competidoresNuevos = nuevos.map((c) => c.dominio);
    if (escribir && nuevos.length > 0) {
      await tx.growthCompetidor.createMany({
        data: nuevos.map((c) => ({ nombre: c.nombre, dominio: c.dominio })),
        skipDuplicates: true,
      });
    }
  }

  // Nichos: se crean activos solo si faltan. Una decisión del fundador
  // (descartarlo, pausarlo) no se pisa nunca.
  if (body.nichos?.length) {
    const existentes = await tx.growthNicho.findMany({
      where: { slug: { in: body.nichos.map((n) => n.slug) } },
      select: { slug: true },
    });
    const conocidos = new Set(existentes.map((e) => e.slug));
    const nuevos = body.nichos.filter((n) => !conocidos.has(n.slug));
    siembra.nichosNuevos = nuevos.map((n) => n.slug);
    if (escribir && nuevos.length > 0) {
      await tx.growthNicho.createMany({
        data: nuevos.map((n) => ({
          slug: n.slug,
          nombre: n.nombre,
          estado: "activo" as const,
          origen: "web_sectores",
        })),
        skipDuplicates: true,
      });
    }
  }

  // Páginas: nombre, sección, nicho y fecha. `indexada` y `comprobadaEn` son
  // de Search Console y no se tocan.
  if (body.paginas?.length) {
    const existentes = await tx.growthPagina.findMany({
      where: { ruta: { in: body.paginas.map((p) => p.ruta) } },
    });
    const porRuta = new Map(existentes.map((p) => [p.ruta, p]));
    const nuevas: NonNullable<SincronizarBody["paginas"]> = [];
    for (const pagina of body.paginas) {
      const actual = porRuta.get(pagina.ruta);
      const actualizado = pagina.actualizado
        ? new Date(pagina.actualizado)
        : null;
      if (!actual) {
        nuevas.push(pagina);
        siembra.paginasNuevas.push(pagina.ruta);
        continue;
      }
      const cambia =
        actual.nombre !== pagina.nombre ||
        actual.seccion !== pagina.seccion ||
        (actual.nichoSlug ?? null) !== (pagina.nichoSlug ?? null) ||
        (actual.actualizado?.getTime() ?? null) !==
          (actualizado?.getTime() ?? null);
      if (!cambia) continue;
      siembra.paginasActualizadas.push(pagina.ruta);
      if (escribir) {
        await tx.growthPagina.update({
          where: { ruta: pagina.ruta },
          data: {
            nombre: pagina.nombre,
            seccion: pagina.seccion,
            nichoSlug: pagina.nichoSlug ?? null,
            actualizado,
          },
        });
      }
    }
    if (escribir && nuevas.length > 0) {
      await tx.growthPagina.createMany({
        data: nuevas.map((p) => ({
          ruta: p.ruta,
          nombre: p.nombre,
          seccion: p.seccion,
          nichoSlug: p.nichoSlug ?? null,
          actualizado: p.actualizado ? new Date(p.actualizado) : null,
        })),
        skipDuplicates: true,
      });
    }
  }
  return siembra;
}

const CLAVES_POR_LISTA_EN_UN_MOTIVO = 6;
const LONGITUD_MAXIMA_DE_UN_MOTIVO = 900;

/** `a, b, c y 3 más`, con un tope de claves para que el motivo quepa en la auditoría. */
function listaCorta(
  claves: readonly string[],
  maximo = CLAVES_POR_LISTA_EN_UN_MOTIVO
): string {
  const visibles = claves.slice(0, maximo).join(", ");
  return claves.length > maximo
    ? `${visibles} y ${claves.length - maximo} más`
    : visibles;
}

function recortarMotivo(texto: string): string {
  return texto.length > LONGITUD_MAXIMA_DE_UN_MOTIVO
    ? `${texto.slice(0, LONGITUD_MAXIMA_DE_UN_MOTIVO - 1)}…`
    : texto;
}

/** Las claves retiradas y las modificadas, lo que el motivo de una decisión debe decir. */
function clavesDelCambio(
  retiradas: readonly string[],
  modificadas: readonly string[]
): string {
  const partes: string[] = [];
  if (retiradas.length > 0) {
    partes.push(`Retiradas (${retiradas.length}): ${listaCorta(retiradas)}.`);
  }
  if (modificadas.length > 0) {
    partes.push(
      `Modificadas (${modificadas.length}): ${listaCorta(modificadas)}.`
    );
  }
  return partes.join(" ");
}

function motivoDeLaSincronizacion(
  commitSha: string,
  plan: PlanDeSincronizacion
): string {
  const resumen = `commit ${corto(commitSha)}: +${plan.crear.length} ~${plan.reemplazar.length} -${plan.cerrar.length}`;
  const detalle = clavesDelCambio(
    plan.cerrar.map((v) => v.clave),
    plan.reemplazar.map((r) => r.vigente.clave)
  );
  return recortarMotivo(detalle ? `${resumen}. ${detalle}` : resumen);
}

function detalleDelBloqueo(
  retiradas: readonly string[],
  modificadas: readonly string[],
  commitSha: string
) {
  return recortarMotivo(
    `Cambió o se retiró del repo (commit ${corto(commitSha)}). ${clavesDelCambio(retiradas, modificadas)} Revisa el borrador antes de aprobarlo.`
  );
}

/**
 * Bloquea los borradores que citan una clave cerrada o cambiada de sentido.
 *
 * Se lee AQUÍ, ya cerradas las claves y dentro de la transacción, y con las
 * filas bloqueadas: la lectura de `leerSituacion` es del principio y vale
 * para simular, pero entre ella y el cierre un administrador pudo aprobar un
 * borrador (el estado leído ya no es el real). Se bloquea primero la
 * oportunidad y luego el borrador, el orden en que aprueba `service.ts`,
 * para no interbloquearse con él.
 */
async function bloquearBorradores(
  tx: ClienteDeBd,
  plan: PlanDeSincronizacion,
  afectadas: readonly string[],
  commitSha: string,
  avisos: string[]
): Promise<ResultadoDeSincronizacion["borradoresBloqueados"]> {
  const bloqueados: ResultadoDeSincronizacion["borradoresBloqueados"] = [];
  if (afectadas.length === 0) return bloqueados;

  const afectadasSet = new Set(afectadas);
  const retiradasSet = new Set(plan.cerrar.map((v) => v.clave));
  const buscar = [...afectadas];
  const condicion: Prisma.GrowthBorradorWhereInput = {
    estado: { in: ["pendiente_aprobacion", "aprobado"] },
    afirmaciones: { hasSome: buscar },
  };

  const candidatos = await tx.growthBorrador.findMany({
    where: condicion,
    select: { id: true, oportunidadId: true },
  });
  if (candidatos.length === 0) return bloqueados;
  const idsDeOportunidad = [...new Set(candidatos.map((b) => b.oportunidadId))];
  const idsDeBorrador = candidatos.map((b) => b.id);
  await tx.$queryRaw`SELECT id FROM growth_oportunidades WHERE id = ANY(${idsDeOportunidad}::text[]) ORDER BY id FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM growth_borradores WHERE id = ANY(${idsDeBorrador}::text[]) ORDER BY id FOR UPDATE`;

  // Bloqueadas las filas, la lectura que vale: nadie las cambia hasta el commit.
  const borradores: BorradorAfectado[] = (await tx.growthBorrador.findMany({
    where: condicion,
    select: {
      id: true,
      oportunidadId: true,
      estado: true,
      afirmaciones: true,
      oportunidad: { select: { id: true, estado: true } },
    },
    orderBy: { creadoEn: "asc" },
  })) as BorradorAfectado[];

  const oportunidadesBloqueadas = new Set<string>();

  for (const borrador of borradores) {
    const claves = borrador.afirmaciones.filter((c) => afectadasSet.has(c));
    const detalle = detalleDelBloqueo(
      claves.filter((c) => retiradasSet.has(c)),
      claves.filter((c) => !retiradasSet.has(c)),
      commitSha
    );
    // Condicional por si algo lo cambió pese al bloqueo (otro cliente sin él).
    const { count } = await tx.growthBorrador.updateMany({
      where: { id: borrador.id, estado: borrador.estado },
      data: { estado: "bloqueado" },
    });
    if (count !== 1) {
      avisos.push(
        `El borrador ${borrador.id} cambió de estado mientras se sincronizaba: no se bloquea.`
      );
      continue;
    }
    await tx.growthRevisionCumplimiento.create({
      data: {
        borradorId: borrador.id,
        resultado: "bloquea",
        revisor: "reglas",
        comprobaciones: [
          {
            regla: "afirmaciones_vigentes",
            ok: false,
            dura: true,
            detalle,
          },
        ],
      },
    });

    const estadoDeLaOportunidad = borrador.oportunidad.estado as Parameters<
      typeof puedeTransicionar
    >[0];
    if (!oportunidadesBloqueadas.has(borrador.oportunidadId)) {
      if (puedeTransicionar(estadoDeLaOportunidad, "bloqueada", "sistema")) {
        const r = await tx.growthOportunidad.updateMany({
          where: {
            id: borrador.oportunidadId,
            estado: estadoDeLaOportunidad,
          },
          data: { estado: "bloqueada" },
        });
        if (r.count === 1) {
          oportunidadesBloqueadas.add(borrador.oportunidadId);
        } else {
          avisos.push(
            `La oportunidad ${borrador.oportunidadId} cambió de estado mientras se sincronizaba: su borrador queda bloqueado pero ella no.`
          );
        }
      } else {
        avisos.push(
          `La oportunidad ${borrador.oportunidadId} está ${borrador.oportunidad.estado} y no pasa a bloqueada: su borrador ${borrador.id} queda bloqueado.`
        );
      }
    }

    await registrarDecision(tx, {
      oportunidadId: borrador.oportunidadId,
      borradorId: borrador.id,
      accion: "bloquear_por_conocimiento",
      motivo: detalle,
      por: POR_SISTEMA,
    });
    bloqueados.push({
      borradorId: borrador.id,
      oportunidadId: borrador.oportunidadId,
      claves,
    });
  }
  return bloqueados;
}

// ── Snapshot ─────────────────────────────────────────────────────────────

function cambiosPrevios(valor: Prisma.JsonValue | null): CambioReciente[] {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return [];
  const lista = (valor as Record<string, unknown>).cambiosRecientes;
  if (!Array.isArray(lista)) return [];
  return lista.filter(
    (c): c is CambioReciente =>
      !!c &&
      typeof c === "object" &&
      typeof (c as CambioReciente).clave === "string" &&
      typeof (c as CambioReciente).en === "string" &&
      typeof (c as CambioReciente).cambio === "string" &&
      typeof (c as CambioReciente).commitSha === "string"
  );
}

/**
 * La primera sincronización crea todo (150 claves): cortar la lista a 50 dejaba
 * fuera, por orden alfabético, más de la mitad sin avisar. Si los cambios de
 * esta pasada no caben, se cuentan por tipo y tipo de cambio (`pagina.*`, 74
 * altas) en lugar de enumerarlos.
 */
function resumirSiSonMuchos(cambios: CambioReciente[]): CambioReciente[] {
  if (cambios.length <= MAXIMO_DE_CAMBIOS_RECIENTES) return cambios;
  const grupos = new Map<string, CambioReciente>();
  for (const c of cambios) {
    const tipo = c.clave.split(".")[0];
    const id = `${tipo}|${c.cambio}`;
    const grupo = grupos.get(id);
    if (grupo) grupo.cantidad = (grupo.cantidad ?? 1) + 1;
    else
      grupos.set(id, {
        clave: `${tipo}.*`,
        cambio: c.cambio,
        en: c.en,
        commitSha: c.commitSha,
        cantidad: 1,
      });
  }
  return [...grupos.values()];
}

function snapshotAnteriorDe(
  valor: Prisma.JsonValue | null
): ResultadoDeSincronizacion["snapshotAnterior"] {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;
  const { commitSha, sincronizadoEn } = valor as Record<string, unknown>;
  return typeof commitSha === "string" && typeof sincronizadoEn === "string"
    ? { commitSha, sincronizadoEn }
    : null;
}

function porTipoDespues(
  antes: Record<string, number>,
  plan: PlanDeSincronizacion
): Record<string, number> {
  const despues = { ...antes };
  const sumar = (tipo: string, n: number) => {
    despues[tipo] = (despues[tipo] ?? 0) + n;
  };
  for (const a of plan.crear) sumar(a.tipo, 1);
  for (const v of [...plan.cerrar, ...plan.sobrantes]) sumar(v.tipo, -1);
  for (const [tipo, n] of Object.entries(despues)) {
    if (n <= 0) delete despues[tipo];
  }
  return despues;
}

function fuentesDelSnapshot(
  body: SincronizarBody,
  leidas: readonly FuenteLeida[]
): { ruta: string; blobSha?: string; commitSha?: string }[] {
  if (leidas.length > 0) {
    return leidas.map((f) => ({
      ruta: f.ruta,
      blobSha: f.blobSha,
      ...(f.commitSha ? { commitSha: f.commitSha } : {}),
    }));
  }
  // Sin el rastro del cliente: al menos de qué ficheros salen las afirmaciones.
  return [...new Set(body.afirmaciones.map((a) => a.fuente.split("#")[0]))].map(
    (ruta) => ({ ruta })
  );
}

// ── Orquestación ─────────────────────────────────────────────────────────

async function ejecutar(
  cliente: ClienteDeBd,
  body: SincronizarBody,
  opciones: OpcionesDeSincronizacion,
  escribir: boolean
): Promise<ResultadoDeSincronizacion> {
  const ahora = opciones.ahora ?? new Date();
  const tipos = tiposCubiertosPorLaSincronizacion(body);
  const avisos: string[] = [];

  // Un término que no sirve (invisibles, tras normalizar casi vacío, solo
  // marcas) hace que la regla parezca cubrir algo que no cubre.
  const inservibles = body.afirmaciones
    .filter((a) => a.tipo === "prohibida")
    .flatMap((a) =>
      terminosProhibidosInvalidos(
        terminosProhibidosDe({
          texto: a.texto,
          valor: (a.valor ?? null) as Prisma.JsonValue | null,
        }).map((t) => t.termino)
      ).map((i) => ({ clave: a.clave, ...i }))
    );
  if (inservibles.length > 0) {
    throw new ErrorDeGrowth(
      400,
      `Hay términos prohibidos que no servirían: ${inservibles
        .slice(0, 5)
        .map((i) => `${i.clave} «${i.termino}» (${i.motivo})`)
        .join("; ")}.`,
      "termino_prohibido_invalido",
      { terminos: inservibles }
    );
  }

  // Lo que se afirma no puede usar lo que no se dice.
  const terminos = await terminosProhibidosDelLote(cliente, body, tipos);
  const infracciones = afirmacionesConTerminosProhibidos(
    body.afirmaciones,
    terminos
  );
  if (infracciones.length > 0) {
    throw new ErrorDeGrowth(
      400,
      `Hay afirmaciones cuyo texto usa un término prohibido: ${infracciones
        .slice(0, 5)
        .map((i) => `${i.clave} (${i.terminos.join(", ")})`)
        .join("; ")}.`,
      "termino_prohibido",
      { afirmaciones: infracciones }
    );
  }

  const situacion = await leerSituacion(cliente, body, tipos);
  const { plan } = situacion;

  // Un token de agente solo AÑADE prohibidas. Retirar una regla o un término
  // las debilita, y de ellas cuelga la regla dura 1: esto lo decide un
  // administrador, no el token (que lee páginas ajenas).
  const debilitadas = prohibidasDebilitadas(plan);
  const gravedad: string[] = [];
  if (debilitadas.length > 0 && !opciones.forzarCierres) {
    gravedad.push(
      `Se debilitarían las reglas duras: ${describirDebilitamientos(debilitadas)}. Un token de agente solo puede añadir prohibidas o términos; retirarlos o relajarlos lo aplica un administrador.`
    );
    if (escribir) {
      throw new ErrorDeGrowth(409, gravedad[0], "prohibida_debilitada", {
        prohibidas: debilitadas,
      });
    }
  }
  if (situacion.cierres.masivo && !opciones.forzarCierres) {
    const motivo = `${situacion.cierres.motivo} Parece un fallo del extractor, no un cambio del repo: no se aplica nada. Si el cambio es real, lo aplica un administrador (un token de agente no puede saltarse esta guarda).`;
    if (escribir) {
      throw new ErrorDeGrowth(409, motivo, "cierres_masivos", {
        cierres: plan.cerrar.length,
        claves: plan.cerrar.slice(0, 50).map((v) => v.clave),
        tiposVaciados: situacion.cierres.tiposVaciados,
        porTipo: situacion.cierres.porTipo,
      });
    }
    gravedad.push(situacion.cierres.motivo ?? motivo);
  }
  const aplicable = gravedad.length === 0;
  const motivoNoAplicable = aplicable ? null : gravedad.join(" ");
  if (plan.sobrantes.length > 0) {
    console.error(
      `[Growth] Conocimiento: ${plan.sobrantes.length} afirmaciones vigentes con clave repetida (${plan.sobrantes
        .map((s) => s.clave)
        .join(", ")}): se cierran las sobrantes.`
    );
    avisos.push(
      `Había ${plan.sobrantes.length} afirmaciones vigentes con clave repetida: ${plan.sobrantes
        .map((s) => s.clave)
        .join(", ")}.`
    );
  }

  const siembra = await sembrar(cliente, body, escribir && aplicable);
  const sinCambios =
    planSinCambios(plan) &&
    siembra.competidoresNuevos.length === 0 &&
    siembra.nichosNuevos.length === 0 &&
    siembra.paginasNuevas.length === 0 &&
    siembra.paginasActualizadas.length === 0;

  const resultado: ResultadoDeSincronizacion = {
    commitSha: body.commitSha,
    simulado: !escribir,
    sinCambios,
    aplicable,
    motivoNoAplicable,
    prohibidasDebilitadas: debilitadas,
    snapshotAnterior: snapshotAnteriorDe(situacion.snapshotPrevio),
    nuevas: plan.crear.map((a) => a.clave),
    modificadas: plan.reemplazar.map((r) => ({
      clave: r.vigente.clave,
      campos: r.campos,
      semantico: r.semantico,
    })),
    retiradas: plan.cerrar.map((v) => v.clave),
    altas: plan.crear.map((a) => a.clave),
    cierres: plan.cerrar.map((v) => v.clave),
    actualizadasEnSitio: 0,
    iguales: plan.iguales.length,
    snapshot: null,
    ...siembra,
    borradoresBloqueados: situacion.borradores.map((b) => ({
      borradorId: b.id,
      oportunidadId: b.oportunidadId,
      claves: b.afirmaciones.filter((c) => situacion.afectadas.includes(c)),
    })),
    avisos,
  };
  if (!escribir || !aplicable) return resultado;

  // ── Escritura ──
  await escribirAfirmaciones(cliente, plan, body.commitSha, ahora);
  resultado.borradoresBloqueados = await bloquearBorradores(
    cliente,
    plan,
    situacion.afectadas,
    body.commitSha,
    avisos
  );

  const enIso = ahora.toISOString();
  const cambios: CambioReciente[] = [
    ...plan.crear.map((a) => ({
      clave: a.clave,
      cambio: "alta" as const,
      en: enIso,
      commitSha: body.commitSha,
    })),
    ...plan.reemplazar.map((r) => ({
      clave: r.vigente.clave,
      cambio: "modificacion" as const,
      en: enIso,
      commitSha: body.commitSha,
    })),
    ...plan.cerrar.map((v) => ({
      clave: v.clave,
      cambio: "cierre" as const,
      en: enIso,
      commitSha: body.commitSha,
    })),
  ];
  const limite = ahora.getTime() - DIAS_DE_CAMBIOS_RECIENTES * MS_POR_DIA;
  const cambiosRecientes = [
    ...resumirSiSonMuchos(cambios),
    ...cambiosPrevios(situacion.snapshotPrevio).filter(
      (c) => new Date(c.en).getTime() >= limite
    ),
  ].slice(0, MAXIMO_DE_CAMBIOS_RECIENTES);

  const porTipo = porTipoDespues(situacion.porTipoAntes, plan);
  const vigentes = Object.values(porTipo).reduce((a, b) => a + b, 0);
  const valor: Prisma.InputJsonObject = {
    commitSha: body.commitSha,
    sincronizadoEn: enIso,
    sincronizadoPor: porAgente(opciones.agente),
    vigentes,
    porTipo,
    fuentes: fuentesDelSnapshot(body, opciones.fuentes ?? []),
    resumen: {
      nuevas: plan.crear.length,
      modificadas: plan.reemplazar.length,
      retiradas: plan.cerrar.length,
      iguales: plan.iguales.length,
    },
    cambiosRecientes,
    previo: resultado.snapshotAnterior,
  };
  await cliente.growthAjuste.upsert({
    where: { clave: CLAVE_DEL_SNAPSHOT_DE_CONOCIMIENTO },
    create: { clave: CLAVE_DEL_SNAPSHOT_DE_CONOCIMIENTO, valor },
    update: { valor },
  });
  resultado.snapshot = construirSnapshotDeConocimiento(
    valor as Prisma.JsonValue,
    ahora,
    ahora
  );

  if (!sinCambios) {
    await registrarDecision(cliente, {
      accion: "conocimiento_sincronizado",
      motivo: motivoDeLaSincronizacion(body.commitSha, plan),
      por: porAgente(opciones.agente),
    });
  }
  console.log(
    `[Growth] Conocimiento (commit ${corto(body.commitSha)}): +${plan.crear.length} creadas, ${plan.reemplazar.length} reemplazadas, ${plan.cerrar.length} cerradas, ${plan.iguales.length} iguales, ${resultado.borradoresBloqueados.length} borradores bloqueados`
  );
  return resultado;
}

/**
 * Calcula (y, salvo `simular`, aplica) la sincronización. Los errores de
 * entrada salen como `ErrorDeGrowth`: 400 `lote_vacio` y `termino_prohibido`,
 * 409 `cierres_masivos`.
 */
export async function sincronizarConocimiento(
  body: SincronizarBody,
  opciones: OpcionesDeSincronizacion
): Promise<ResultadoDeSincronizacion> {
  if (body.afirmaciones.length === 0) {
    // `tipos` sin afirmaciones cerraría todo lo vigente de esos tipos: el
    // extractor no ha leído nada, no es que el repo lo haya borrado.
    throw new ErrorDeGrowth(
      400,
      "El lote no trae ninguna afirmación: no hay nada que sincronizar.",
      "lote_vacio"
    );
  }
  if (opciones.simular) return ejecutar(prisma, body, opciones, false);

  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${CLAVE_DEL_CERROJO_DE_CONOCIMIENTO}))`;
      return ejecutar(tx, body, opciones, true);
    },
    { timeout: PLAZO_DE_LA_TRANSACCION_MS, maxWait: ESPERA_DEL_CERROJO_MS }
  );
}
