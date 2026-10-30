import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { DIAS_ENTRE_CONTACTOS_AL_MISMO_DOMINIO } from "./cumplimiento.js";
import {
  ajustesEfectivosDe,
  leerAjustesEfectivos,
  type AjustesEfectivos,
} from "./contextoDeCumplimiento.js";
import {
  AJUSTES_POR_DEFECTO,
  LIMITES_DE_AJUSTES,
  OBJETIVOS,
  type AjustesPutBody,
} from "./esquemas.js";
import { DIAS_DE_RETENCION, registrarDecision } from "./service.js";

/**
 * Los ajustes de Growth (`growth_ajustes`): el tope semanal de contactos, el
 * umbral de similitud de las reglas duras, el umbral de puntuación por
 * objetivo y la pausa. Los lee todo el mundo con sus valores efectivos (los
 * guardados mezclados con los del código); solo el administrador los cambia.
 *
 * Cambiar un tope o un umbral DEBILITA una regla dura, así que cada cambio
 * deja una fila en `growth_decisiones` con el valor de antes y el de después.
 */

/** `GET /growth/admin/ajustes`. */
export async function leerAjustesParaElAdministrador() {
  const { valores, actualizadoEn } = await leerAjustesEfectivos();
  return {
    valores,
    porDefecto: {
      topeSemanal: AJUSTES_POR_DEFECTO.topeSemanal,
      umbralDeSimilitud: AJUSTES_POR_DEFECTO.umbralDeSimilitud,
      umbralesPorObjetivo: { ...AJUSTES_POR_DEFECTO.umbralesPorObjetivo },
      pausa: AJUSTES_POR_DEFECTO.pausa,
    },
    actualizadoEn: Object.fromEntries(
      Object.entries(actualizadoEn).map(([clave, fecha]) => [
        clave,
        fecha ? fecha.toISOString() : null,
      ])
    ) as Record<string, string | null>,
    limites: {
      topeSemanal: [...LIMITES_DE_AJUSTES.topeSemanal],
      umbralDeSimilitud: [...LIMITES_DE_AJUSTES.umbralDeSimilitud],
      umbralesPorObjetivo: [...LIMITES_DE_AJUSTES.umbralesPorObjetivo],
    },
    // Se enseñan, pero no se editan en la 1b.
    soloLectura: {
      retencionDias: DIAS_DE_RETENCION,
      diasEntreContactosAlMismoDominio: DIAS_ENTRE_CONTACTOS_AL_MISMO_DOMINIO,
    },
  };
}

type ClaveEditable = keyof AjustesEfectivos;

const CLAVES_EN_ORDEN: readonly ClaveEditable[] = [
  "topeSemanal",
  "umbralDeSimilitud",
  "umbralesPorObjetivo",
  "pausa",
];

/** Un valor tal como se guarda: los umbrales siempre con las claves en el mismo orden. */
function valorParaGuardar(
  clave: ClaveEditable,
  valor: NonNullable<AjustesPutBody[ClaveEditable]>
): Prisma.InputJsonValue {
  if (clave === "umbralesPorObjetivo") {
    const umbrales = valor as Record<string, number>;
    return Object.fromEntries(OBJETIVOS.map((o) => [o, umbrales[o]]));
  }
  return valor as Prisma.InputJsonValue;
}

function mismoValor(guardado: unknown, nuevo: unknown): boolean {
  return JSON.stringify(guardado) === JSON.stringify(nuevo);
}

function comoTexto(valor: unknown): string {
  return typeof valor === "object" && valor !== null
    ? JSON.stringify(valor)
    : String(valor);
}

/**
 * `PUT /growth/admin/ajustes`. Cada clave que viene se guarda (upsert) en una
 * transacción y el conjunto deja UNA fila `ajustes` en el historial con
 * «clave: antes -> después». Lo que ya valía lo mismo no se toca: repetir la
 * petición no ensucia el historial.
 *
 * Solo escribe las cuatro claves de la API: las `sistema.*` (el snapshot del
 * conocimiento) las valida `AjustesPutBody` y nunca llegan aquí.
 */
export async function guardarAjustes(cambios: AjustesPutBody, por: string) {
  await prisma.$transaction(
    async (tx) => {
      const filas = await tx.growthAjuste.findMany({
        where: { clave: { in: [...CLAVES_EN_ORDEN] } },
      });
      // Lo que valía ANTES (con los valores por defecto donde no hay fila).
      const antes = ajustesEfectivosDe(filas);

      const aplicados: string[] = [];
      for (const clave of CLAVES_EN_ORDEN) {
        const pedido = cambios[clave];
        if (pedido === undefined) continue;

        const valor = valorParaGuardar(clave, pedido);
        const guardado = filas.find((f) => f.clave === clave)?.valor;
        // Se compara con lo GUARDADO, no con lo efectivo: un valor corrupto
        // en la base (que se ignora y se avisa en el log) se sustituye.
        if (guardado !== undefined && mismoValor(guardado, valor)) continue;

        await tx.growthAjuste.upsert({
          where: { clave },
          create: { clave, valor },
          update: { valor },
        });
        aplicados.push(
          `${clave}: ${comoTexto(antes[clave])} -> ${comoTexto(valor)}`
        );
      }

      if (aplicados.length > 0) {
        await registrarDecision(tx, {
          accion: "ajustes",
          motivo: aplicados.join("; "),
          por,
        });
      }
    },
    { maxWait: 5000, timeout: 15000 }
  );
  return leerAjustesParaElAdministrador();
}
