import { prisma } from "../../lib/prisma.js";

/**
 * Ausencias de los profesionales (`ProfessionalAbsence`): lectura y baja
 * compartidas por el panel (`/booking-settings/absences`) y por el Gestor
 * (`quitar_ausencia`). Crear una sigue siendo cosa del Gestor
 * (`marcar_ausencia`). `checkAvailability` y `get_catalog` leen la tabla en
 * cada llamada y no hay caché de voz sobre ella: al borrar la fila, la
 * recepcionista vuelve a ofrecer ese tramo en la siguiente llamada.
 */

export interface AusenciaDelPanel {
  id: string;
  professionalId: string;
  professionalName: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
  createdVia: string | null;
}

/** Ausencias que se solapan con [desde, hasta), por orden de comienzo. */
export async function listarAusencias(
  businessId: string,
  opciones: { desde: Date; hasta: Date; profesionalId?: string }
): Promise<AusenciaDelPanel[]> {
  const filas = await prisma.professionalAbsence.findMany({
    where: {
      businessId,
      startsAt: { lt: opciones.hasta },
      endsAt: { gt: opciones.desde },
      ...(opciones.profesionalId
        ? { professionalId: opciones.profesionalId }
        : {}),
    },
    orderBy: { startsAt: "asc" },
    take: 200,
    select: {
      id: true,
      professionalId: true,
      startsAt: true,
      endsAt: true,
      reason: true,
      createdVia: true,
      professional: { select: { name: true } },
    },
  });
  return filas.map((a) => ({
    id: a.id,
    professionalId: a.professionalId,
    professionalName: a.professional.name,
    startsAt: a.startsAt.toISOString(),
    endsAt: a.endsAt.toISOString(),
    reason: a.reason,
    createdVia: a.createdVia,
  }));
}

/**
 * Quita una ausencia del negocio. Devuelve `false` si no existe o es de otro
 * negocio (el filtro por `businessId` va en el propio borrado).
 */
export async function quitarAusencia(
  businessId: string,
  id: string
): Promise<boolean> {
  const { count } = await prisma.professionalAbsence.deleteMany({
    where: { id, businessId },
  });
  return count > 0;
}

/** «del 3 al 7 de octubre» o «el 3 de octubre de 09:00 a 14:00», en la zona
 * del negocio, para el catálogo que lee el agente y para el dueño. */
export function describirAusencia(
  startsAt: Date,
  endsAt: Date,
  timezone: string
): string {
  const zona = timezone || "Europe/Madrid";
  const dia = new Intl.DateTimeFormat("es-ES", {
    timeZone: zona,
    day: "numeric",
    month: "long",
  });
  const horaMin = new Intl.DateTimeFormat("es-ES", {
    timeZone: zona,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  // El fin es exclusivo: una ausencia de días enteros acaba a las 00:00 del
  // día siguiente, que para el dueño es «hasta el 7».
  const ultimoInstante = new Date(endsAt.getTime() - 60_000);
  const diasEnteros =
    horaMin.format(startsAt) === "00:00" &&
    horaMin.format(ultimoInstante) === "23:59";
  const mismoDia = dia.format(startsAt) === dia.format(ultimoInstante);
  if (diasEnteros) {
    return mismoDia
      ? `el ${dia.format(startsAt)}`
      : `del ${dia.format(startsAt)} al ${dia.format(ultimoInstante)}`;
  }
  if (mismoDia) {
    return `el ${dia.format(startsAt)} de ${horaMin.format(startsAt)} a ${horaMin.format(endsAt)}`;
  }
  return `desde el ${dia.format(startsAt)} a las ${horaMin.format(startsAt)} hasta el ${dia.format(endsAt)} a las ${horaMin.format(endsAt)}`;
}
