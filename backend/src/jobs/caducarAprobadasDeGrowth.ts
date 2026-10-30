import type { GrowthEstadoBorrador, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { errorMessage } from "../lib/logUtils.js";
import { puedeTransicionar } from "../modules/growth/estados.js";

/**
 * Caducidad de las oportunidades aprobadas de Alhabla Growth
 * (PLAN-GROWTH.md § 4): una oportunidad `aprobada` cuya fecha `expiraEn` ya
 * pasó y que nadie ha gestionado pasa a `caducada` por el sistema. Es la única
 * transición que el reloj provoca; una `pendiente_aprobacion` vencida NO se
 * mueve (el dashboard la pinta como vencida con `expiraEn < ahora`).
 *
 * Por cada una, en UNA transacción corta y en serie (el pool tiene pocas
 * conexiones y una transacción interactiva fija una):
 *  1. `updateMany` condicional: solo si sigue `aprobada` y vencida. Si el
 *     fundador la movió mientras tanto, no se toca nada más.
 *  2. Sus borradores abiertos pasan a `descartado`: uno `bloqueado` o
 *     `pendiente_aprobacion` huérfano bajo una oportunidad terminal quedaría
 *     para siempre en la vista de borradores sin poder aprobarse.
 *  3. Una fila en `growth_decisiones` (`caducar`, por `sistema`): sin ella no
 *     queda rastro de cuándo ni por qué caducó.
 *
 * Idempotente: el `where` repite el estado y la fecha, así que una doble
 * entrega de Cloud Scheduler no duplica nada. Un fallo en una oportunidad se
 * registra y se sigue con las demás; la siguiente pasada la reintenta.
 */

const LOTE = 50;

/**
 * Los mismos estados que cierra `decidir` al devolver o descartar
 * (modules/growth/service.ts). Duplicado a propósito para que el job no
 * dependa de ese módulo: si cambia allí, hay que cambiarlo aquí.
 */
const BORRADORES_ABIERTOS: GrowthEstadoBorrador[] = [
  "borrador",
  "bloqueado",
  "pendiente_aprobacion",
  "aprobado",
];

export type ResultadoDeLaCaducidad = {
  caducadas: number;
  borradoresDescartados: number;
  fallidas: number;
};

type Vencida = { id: string; dominio: string; expiraEn: Date | null };

async function caducarUna(
  tx: Prisma.TransactionClient,
  oportunidad: Vencida,
  ahora: Date
): Promise<{ borradoresDescartados: number } | null> {
  const { count } = await tx.growthOportunidad.updateMany({
    where: {
      id: oportunidad.id,
      estado: "aprobada",
      expiraEn: { lt: ahora },
    },
    data: { estado: "caducada" },
  });
  if (count === 0) return null;

  const aprobado = await tx.growthBorrador.findFirst({
    where: { oportunidadId: oportunidad.id, estado: "aprobado" },
    select: { id: true },
  });
  const descartados = await tx.growthBorrador.updateMany({
    where: {
      oportunidadId: oportunidad.id,
      estado: { in: BORRADORES_ABIERTOS },
    },
    data: { estado: "descartado" },
  });
  await tx.growthDecision.create({
    data: {
      oportunidadId: oportunidad.id,
      borradorId: aprobado?.id,
      accion: "caducar",
      motivo: `Venció el ${oportunidad.expiraEn?.toISOString().slice(0, 10) ?? "(sin fecha)"} sin gestionarse`,
      por: "sistema",
    },
  });
  return { borradoresDescartados: descartados.count };
}

export async function caducarAprobadasDeGrowthJob(
  ahora: Date = new Date()
): Promise<ResultadoDeLaCaducidad> {
  // estados.ts es la fuente de verdad de qué cambios existen: si alguien
  // quita esta transición, el job debe fallar, no saltársela.
  if (!puedeTransicionar("aprobada", "caducada", "sistema")) {
    throw new Error(
      "[Growth] estados.ts ya no permite aprobada → caducada por el sistema"
    );
  }

  let caducadas = 0;
  let borradoresDescartados = 0;
  const fallidas: string[] = [];

  for (;;) {
    const vencidas = await prisma.growthOportunidad.findMany({
      where: {
        estado: "aprobada",
        // `lt` ya deja fuera las que no tienen fecha: esas no caducan nunca.
        expiraEn: { lt: ahora },
        ...(fallidas.length > 0 ? { id: { notIn: fallidas } } : {}),
      },
      select: { id: true, dominio: true, expiraEn: true },
      orderBy: { expiraEn: "asc" },
      take: LOTE,
    });
    if (vencidas.length === 0) break;

    for (const oportunidad of vencidas) {
      try {
        const resultado = await prisma.$transaction((tx) =>
          caducarUna(tx, oportunidad, ahora)
        );
        if (resultado) {
          caducadas += 1;
          borradoresDescartados += resultado.borradoresDescartados;
        }
      } catch (error) {
        fallidas.push(oportunidad.id);
        console.error(
          `[Growth] No se pudo caducar la oportunidad ${oportunidad.id} (${oportunidad.dominio}): ${errorMessage(error)}`
        );
      }
    }
    if (vencidas.length < LOTE) break;
  }

  console.log(
    `[Growth] Caducidad de aprobadas: ${caducadas} caducadas, ${borradoresDescartados} borradores descartados, ${fallidas.length} con error`
  );
  return { caducadas, borradoresDescartados, fallidas: fallidas.length };
}
