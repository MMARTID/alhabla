import type { GrowthTarea, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import type {
  AltaDeTareaBody,
  CambioDeTareaBody,
  CategoriaDeTarea,
  EstadoDeTarea,
  OrigenDeTarea,
  ResultadoDeTarea,
  TareaDescartadaBody,
  TareaHechaBody,
} from "./esquemas.js";
import { ErrorDeGrowth, dominioDeUrl, limpiarJsonParaBd } from "./service.js";
import { TAREAS_INICIALES, filaDeTareaInicial } from "./tareasIniciales.js";

/**
 * Las tareas a mano del administrador (`/growth/admin/tareas`): destinos que
 * el agente no puede abrir o que se hacen mejor a mano, cada uno con su
 * enlace, sus pasos y la marca de hecho con el resultado. Es una lista de
 * trabajo del fundador: ni el agente ni el MCP la leen, y el backend no hace
 * ninguna petición saliente a las URL que guarda (las abre una persona).
 *
 * Concurrencia: la siembra toma un cerrojo de Postgres y se apoya además en el
 * índice único de `siembra`, así que dos peticiones a la vez no duplican filas.
 * Los cambios de estado son un `updateMany` condicionado al estado de partida
 * (una sola sentencia atómica): un doble clic repite el efecto sin cambiar
 * nada más.
 */

// ── Forma de respuesta (contrato del panel útil) ─────────────────────────

export type Tarea = {
  id: string;
  titulo: string;
  dominio: string | null;
  url: string;
  categoria: CategoriaDeTarea;
  pasos: string[];
  notas: string | null;
  origen: OrigenDeTarea;
  estado: EstadoDeTarea;
  resultado: ResultadoDeTarea | null;
  notaDeResultado: string | null;
  hechaEn: Date | null;
  creadoEn: Date;
  orden: number;
};

export function aTarea(fila: GrowthTarea): Tarea {
  return {
    id: fila.id,
    titulo: fila.titulo,
    dominio: fila.dominio,
    url: fila.url,
    categoria: fila.categoria as CategoriaDeTarea,
    // Se validó con Zod al guardarlo; por si una fila no lo es, nunca un 500.
    pasos: Array.isArray(fila.pasos)
      ? fila.pasos.filter((p): p is string => typeof p === "string")
      : [],
    notas: fila.notas,
    origen: fila.origen as OrigenDeTarea,
    estado: fila.estado as EstadoDeTarea,
    resultado: fila.resultado as ResultadoDeTarea | null,
    notaDeResultado: fila.notaDeResultado,
    hechaEn: fila.hechaEn,
    creadoEn: fila.creadoEn,
    orden: fila.orden,
  };
}

const ORDEN_DE_ESTADO: Record<string, number> = {
  pendiente: 0,
  hecha: 1,
  descartada: 2,
};

const COLACION = new Intl.Collator("es", { sensitivity: "base" });

/**
 * Pendientes primero, luego `orden` y título (sin distinguir mayúsculas ni
 * tildes). El `ORDER BY` de Postgres depende de la colación de la base, así
 * que el orden final se fija aquí.
 */
export function ordenarTareas<
  T extends { estado: string; orden: number; titulo: string; id: string },
>(filas: readonly T[]): T[] {
  return [...filas].sort(
    (a, b) =>
      (ORDEN_DE_ESTADO[a.estado] ?? 9) - (ORDEN_DE_ESTADO[b.estado] ?? 9) ||
      a.orden - b.orden ||
      COLACION.compare(a.titulo, b.titulo) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

function tareaNoExiste() {
  return new ErrorDeGrowth(404, "La tarea no existe.");
}

// ── Siembra ──────────────────────────────────────────────────────────────

const CERROJO_DE_LA_SIEMBRA = "growth_tareas_siembra";

/**
 * Añade las tareas iniciales que falten, nunca toca las que ya están. Es
 * idempotente y sin carreras:
 *
 * 1. Camino corriente (ya están todas): una lectura y nada más.
 * 2. Si falta alguna, una transacción toma un cerrojo de Postgres (las
 *    siembras se turnan, sin deadlocks), vuelve a mirar qué falta e inserta
 *    con `skipDuplicates` (`ON CONFLICT DO NOTHING`).
 * 3. El índice único de `siembra` es la garantía última: aunque algo se saltara
 *    el cerrojo, una fila repetida no entra ni da un 500.
 */
export async function asegurarTareasIniciales(): Promise<void> {
  const claves = TAREAS_INICIALES.map((t) => t.siembra);
  const yaEstan = await prisma.growthTarea.findMany({
    where: { siembra: { in: claves } },
    select: { siembra: true },
  });
  if (new Set(yaEstan.map((t) => t.siembra)).size >= claves.length) return;

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${CERROJO_DE_LA_SIEMBRA}))`;
    const existentes = new Set(
      (
        await tx.growthTarea.findMany({
          where: { siembra: { in: claves } },
          select: { siembra: true },
        })
      ).map((t) => t.siembra)
    );
    const faltan = TAREAS_INICIALES.flatMap((tarea, indice) =>
      existentes.has(tarea.siembra) ? [] : [filaDeTareaInicial(tarea, indice)]
    );
    if (faltan.length === 0) return;
    await tx.growthTarea.createMany({ data: faltan, skipDuplicates: true });
  });
}

// ── Lecturas ─────────────────────────────────────────────────────────────

/** `GET /growth/admin/tareas`: todas, con la siembra perezosa. */
export async function listarTareas(): Promise<{ data: Tarea[] }> {
  await asegurarTareasIniciales();
  const filas = await prisma.growthTarea.findMany();
  return { data: ordenarTareas(filas).map(aTarea) };
}

// ── Alta, edición y baja ─────────────────────────────────────────────────

/** ¿Es `url` del sitio `dominio` (o de un subdominio suyo)? */
function urlEsDelDominio(url: string, dominio: string | null): boolean {
  if (!dominio) return false;
  const host = dominioDeUrl(url);
  return host === dominio || host.endsWith(`.${dominio}`);
}

/** `POST /growth/admin/tareas`: `origen = manual`; el dominio, si no llega, sale de la URL. */
export async function crearTarea(
  entradaCruda: AltaDeTareaBody
): Promise<Tarea> {
  const entrada = limpiarJsonParaBd(entradaCruda);
  const fila = await prisma.growthTarea.create({
    data: {
      titulo: entrada.titulo,
      url: entrada.url,
      dominio: entrada.dominio ?? dominioDeUrl(entrada.url),
      categoria: entrada.categoria ?? "otro",
      pasos: entrada.pasos ?? [],
      notas: entrada.notas ? entrada.notas : null,
      origen: "manual",
    },
  });
  return aTarea(fila);
}

/**
 * `PATCH /growth/admin/tareas/:id`. Solo cambia lo que llega. Una URL de otro
 * sitio sin `dominio` recalcula el dominio; una del mismo sitio lo deja como
 * está (puede ser `g2.com` con una URL de `sell.g2.com`).
 */
export async function editarTarea(
  id: string,
  cambiosCrudos: CambioDeTareaBody
): Promise<Tarea> {
  const cambios = limpiarJsonParaBd(cambiosCrudos);
  const actual = await prisma.growthTarea.findUnique({
    where: { id },
    select: { dominio: true },
  });
  if (!actual) throw tareaNoExiste();

  const data: Prisma.GrowthTareaUpdateInput = {};
  if (cambios.titulo !== undefined) data.titulo = cambios.titulo;
  if (cambios.categoria !== undefined) data.categoria = cambios.categoria;
  if (cambios.pasos !== undefined) data.pasos = cambios.pasos;
  if (cambios.notas !== undefined) data.notas = cambios.notas || null;
  if (cambios.url !== undefined) data.url = cambios.url;
  if (cambios.dominio !== undefined) {
    // Un dominio explícito manda; `null` (o en blanco) lo quita.
    data.dominio = cambios.dominio;
  } else if (
    cambios.url !== undefined &&
    !urlEsDelDominio(cambios.url, actual.dominio)
  ) {
    data.dominio = dominioDeUrl(cambios.url);
  }

  try {
    const fila = await prisma.growthTarea.update({ where: { id }, data });
    return aTarea(fila);
  } catch (error) {
    // Borrada entre la lectura y el cambio.
    if ((error as { code?: string } | null)?.code === "P2025") {
      throw tareaNoExiste();
    }
    throw error;
  }
}

/**
 * `DELETE /growth/admin/tareas/:id`. Las sembradas (`origen = repo`) no se
 * borran, se descartan: el siguiente despliegue las volvería a sembrar.
 */
export async function borrarTarea(id: string): Promise<void> {
  const { count } = await prisma.growthTarea.deleteMany({
    where: { id, origen: { not: "repo" } },
  });
  if (count > 0) return;
  const existe = await prisma.growthTarea.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existe) throw tareaNoExiste();
  throw new ErrorDeGrowth(
    409,
    "Esta tarea viene del repositorio y no se puede borrar: descártala.",
    "tarea_del_repositorio"
  );
}

// ── Estados ──────────────────────────────────────────────────────────────

async function tareaPorId(id: string): Promise<Tarea> {
  const fila = await prisma.growthTarea.findUnique({ where: { id } });
  if (!fila) throw tareaNoExiste();
  return aTarea(fila);
}

/** Una nota en blanco cuenta como «sin nota». */
function notaLimpia(nota: string | null | undefined): string | undefined {
  return nota?.trim() ? nota : undefined;
}

/**
 * `POST …/:id/hecha`. Desde `pendiente` o `descartada` la marca (resultado y
 * nota, si llegan) y fecha el momento. Idempotente: si ya estaba hecha no
 * cambia `hechaEn`, y solo completa el resultado o la nota que lleguen ahora
 * (un doble clic, o apuntar luego que la ficha ya se aceptó).
 */
export async function marcarTareaHecha(
  id: string,
  cuerpoCrudo: TareaHechaBody
): Promise<Tarea> {
  const cuerpo = limpiarJsonParaBd(cuerpoCrudo);
  const resultado = cuerpo.resultado ?? undefined;
  const nota = notaLimpia(cuerpo.nota);

  const { count } = await prisma.growthTarea.updateMany({
    where: { id, estado: { not: "hecha" } },
    data: {
      estado: "hecha",
      hechaEn: new Date(),
      resultado: resultado ?? null,
      notaDeResultado: nota ?? null,
    },
  });
  if (count === 0 && (resultado !== undefined || nota !== undefined)) {
    // Ya estaba hecha (o no existe: no toca nada): se completa lo que llega.
    await prisma.growthTarea.updateMany({
      where: { id, estado: "hecha" },
      data: {
        ...(resultado !== undefined ? { resultado } : {}),
        ...(nota !== undefined ? { notaDeResultado: nota } : {}),
      },
    });
  }
  return tareaPorId(id);
}

/** `POST …/:id/descartar`: idempotente; la nota (por qué no) se completa si llega. */
export async function descartarTarea(
  id: string,
  cuerpoCrudo: TareaDescartadaBody
): Promise<Tarea> {
  const cuerpo = limpiarJsonParaBd(cuerpoCrudo);
  const nota = notaLimpia(cuerpo.nota);

  const { count } = await prisma.growthTarea.updateMany({
    where: { id, estado: { not: "descartada" } },
    data: {
      estado: "descartada",
      hechaEn: null,
      resultado: null,
      notaDeResultado: nota ?? null,
    },
  });
  if (count === 0 && nota !== undefined) {
    await prisma.growthTarea.updateMany({
      where: { id, estado: "descartada" },
      data: { notaDeResultado: nota },
    });
  }
  return tareaPorId(id);
}

/** `POST …/:id/reabrir`: vuelve a pendiente y limpia resultado y fecha; la nota se conserva. */
export async function reabrirTarea(id: string): Promise<Tarea> {
  await prisma.growthTarea.updateMany({
    where: { id, estado: { not: "pendiente" } },
    data: { estado: "pendiente", hechaEn: null, resultado: null },
  });
  return tareaPorId(id);
}
