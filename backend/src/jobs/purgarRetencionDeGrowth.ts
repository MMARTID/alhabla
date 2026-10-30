import { prisma } from "../lib/prisma.js";
import { errorMessage } from "../lib/logUtils.js";

/**
 * Retención de los datos de terceros de Alhabla Growth (PLAN-GROWTH.md § 7).
 * Cada oportunidad lleva en `retencionHasta` el día a partir del cual ya no
 * debe guardar el texto de una página ajena (180 días desde que se detectó).
 * El job hace tres cosas, en este orden y cada una en su `try`:
 *
 *  A. BORRA la fila entera de lo vencido que no tiene historial: ni
 *     decisiones (suyas ni de alguno de sus borradores), ni enlaces
 *     conseguidos, ni una gestión. Las cascadas llevan consigo la
 *     investigación, los borradores y sus revisiones. Es lo que hace seguro el
 *     borrado: una gestión solo nace al marcar algo como gestionado, que
 *     también escribe una decisión, y `growth_gestiones` apunta al borrador
 *     con RESTRICT (borrarlo con gestión fallaría). Las decisiones de un
 *     borrador cuentan como historial aunque no cuelguen de la oportunidad:
 *     borrarlas con la fila las dejaría huérfanas (`ON DELETE SET NULL`).
 *  B. VACÍA el `extracto` del resto (la columna no admite null, así que
 *     cadena vacía). Lo que el fundador decidió se conserva, sin el texto del
 *     tercero.
 *  C. Pone a null `quienEdita` en las investigaciones de lo vencido: el plan
 *     dice que no se guardan nombres de personas, y ese campo puede llevar uno.
 *
 * Idempotente: A y C filtran por lo que aún queda por borrar y B por
 * `extracto <> ''`, así que repetir el job no toca dos veces la misma fila y
 * un paso que falle se reintenta en la siguiente pasada sin deshacer los
 * demás. Nunca toca `growth_decisiones` ni `growth_gestiones`.
 */

const LOTE = 200;
/** Cloud Scheduler da 3 minutos por intento: se corta antes y la siguiente pasada sigue. */
const PLAZO_DEL_JOB_MS = 120_000;

/** Estados en los que lo que se borra es trabajo que el fundador nunca llegó a revisar. */
const ESTADOS_SIN_REVISAR = ["pendiente_aprobacion", "con_borrador"];

export type ResultadoDeLaRetencion = {
  filasBorradas: number;
  extractosVaciados: number;
  investigacionesSinNombre: number;
};

async function borrarFilasSinHistorial(
  ahora: Date,
  inicio: number
): Promise<number> {
  const vencida = { retencionHasta: { lt: ahora } };
  // Una decisión puede colgar solo del borrador (`oportunidadId` nulo): también
  // es historial. Borrar el borrador dejaría esa decisión huérfana (la FK pone
  // `borradorId` a null), así que la fila entera se conserva y B vacía su
  // extracto.
  const sinHistorial = {
    decisiones: { none: {} },
    enlaces: { none: {} },
    borradores: {
      none: {
        OR: [{ gestion: { isNot: null } }, { decisiones: { some: {} } }],
      },
    },
  };

  let borradas = 0;
  const porEstado: Record<string, number> = {};
  for (;;) {
    const lote = await prisma.growthOportunidad.findMany({
      where: { ...vencida, ...sinHistorial },
      select: { id: true, estado: true },
      orderBy: { retencionHasta: "asc" },
      take: LOTE,
    });
    if (lote.length === 0) break;

    // Se repiten los filtros: si el fundador decide justo entre la lectura y
    // el borrado, esa fila ya no cumple y no se borra.
    const { count } = await prisma.growthOportunidad.deleteMany({
      where: {
        id: { in: lote.map((o) => o.id) },
        ...vencida,
        ...sinHistorial,
      },
    });
    borradas += count;
    for (const o of lote) porEstado[o.estado] = (porEstado[o.estado] ?? 0) + 1;

    // Una carrera dejó el lote sin borrar: no se vuelve a intentar en bucle.
    if (count === 0 || lote.length < LOTE) break;
    if (Date.now() - inicio > PLAZO_DEL_JOB_MS) {
      console.warn(
        "[Growth] La purga de retención agotó su plazo: queda trabajo para la siguiente pasada"
      );
      break;
    }
  }

  if (borradas > 0) {
    const desglose = Object.entries(porEstado)
      .map(([estado, n]) => `${estado} ${n}`)
      .join(", ");
    const sinRevisar = ESTADOS_SIN_REVISAR.filter((e) => porEstado[e]);
    const mensaje = `[Growth] Purga de retención: ${borradas} filas borradas por no tener decisiones (${desglose})`;
    if (sinRevisar.length > 0) {
      console.warn(
        `${mensaje}. Entre ellas, trabajo que nadie llegó a revisar (${sinRevisar.join(", ")}).`
      );
    } else {
      console.log(mensaje);
    }
  }
  return borradas;
}

export async function purgarRetencionDeGrowthJob(
  ahora: Date = new Date()
): Promise<ResultadoDeLaRetencion> {
  const inicio = Date.now();
  const errores: unknown[] = [];

  let filasBorradas = 0;
  let extractosVaciados = 0;
  let investigacionesSinNombre = 0;

  try {
    filasBorradas = await borrarFilasSinHistorial(ahora, inicio);
  } catch (error) {
    errores.push(error);
    console.error(
      `[Growth] La purga de retención no pudo borrar las filas vencidas: ${errorMessage(error)}`
    );
  }

  try {
    const { count } = await prisma.growthOportunidad.updateMany({
      where: { retencionHasta: { lt: ahora }, extracto: { not: "" } },
      data: { extracto: "" },
    });
    extractosVaciados = count;
  } catch (error) {
    errores.push(error);
    console.error(
      `[Growth] La purga de retención no pudo vaciar los extractos: ${errorMessage(error)}`
    );
  }

  try {
    const { count } = await prisma.growthInvestigacion.updateMany({
      where: {
        quienEdita: { not: null },
        oportunidad: { is: { retencionHasta: { lt: ahora } } },
      },
      data: { quienEdita: null },
    });
    investigacionesSinNombre = count;
  } catch (error) {
    errores.push(error);
    console.error(
      `[Growth] La purga de retención no pudo quitar los nombres de las investigaciones: ${errorMessage(error)}`
    );
  }

  console.log(
    `[Growth] Purga de retención: ${filasBorradas} filas borradas (sin decisiones), ${extractosVaciados} extractos vaciados, ${investigacionesSinNombre} investigaciones sin nombre`
  );
  // Lo que se pudo, se hizo; pero el job falla para que Scheduler repita.
  if (errores.length > 0) throw errores[0];
  return { filasBorradas, extractosVaciados, investigacionesSinNombre };
}
