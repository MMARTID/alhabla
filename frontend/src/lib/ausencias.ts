import { claveDeDia, horaDelNegocio, minutosDelDia } from "@/lib/fechas-negocio";
import { horaDeMinutos } from "@/lib/agenda-escritorio";
import type { AusenciaDelEquipo } from "@/lib/types";

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function diaYMes(clave: string) {
  const [, mes, dia] = clave.split("-").map(Number);
  return `${dia} de ${MESES[mes - 1]}`;
}

/** Los minutos de un día (0–1440) que cubre la ausencia, o null si no lo
 * toca. El fin es exclusivo: una ausencia de días enteros acaba a las 00:00
 * del día siguiente y no cuenta como ese día. */
export function tramoDeAusenciaEnElDia(
  ausencia: Pick<AusenciaDelEquipo, "startsAt" | "endsAt">,
  dia: string,
  timeZone: string
): { desde: number; hasta: number } | null {
  const diaInicio = claveDeDia(ausencia.startsAt, timeZone);
  const diaFin = claveDeDia(ausencia.endsAt, timeZone);
  if (diaInicio > dia || diaFin < dia) return null;
  const desde = diaInicio < dia ? 0 : minutosDelDia(ausencia.startsAt, timeZone);
  const hasta = diaFin > dia ? 1440 : minutosDelDia(ausencia.endsAt, timeZone);
  return hasta > desde ? { desde, hasta } : null;
}

/** «todo el día», «de 09:00 a 14:00», «desde las 16:00» o «hasta las 14:00»,
 * recortado al día que se mira. */
export function textoDeAusenciaEnElDia(tramo: { desde: number; hasta: number }) {
  if (tramo.desde <= 0 && tramo.hasta >= 1440) return "todo el día";
  if (tramo.hasta >= 1440) return `desde las ${horaDeMinutos(tramo.desde)}`;
  if (tramo.desde <= 0) return `hasta las ${horaDeMinutos(tramo.hasta)}`;
  return `de ${horaDeMinutos(tramo.desde)} a ${horaDeMinutos(tramo.hasta)}`;
}

/** «el 9 de noviembre», «del 9 al 12 de noviembre» o «el 9 de noviembre de
 * 09:00 a 14:00»: lo que ve el dueño en la lista del equipo. */
export function textoDeAusencia(
  ausencia: Pick<AusenciaDelEquipo, "startsAt" | "endsAt">,
  timeZone: string
) {
  const inicio = claveDeDia(ausencia.startsAt, timeZone);
  const fin = claveDeDia(ausencia.endsAt, timeZone);
  const horaInicio = horaDelNegocio(ausencia.startsAt, timeZone);
  const horaFin = horaDelNegocio(ausencia.endsAt, timeZone);
  if (horaInicio === "00:00" && horaFin === "00:00") {
    // Días enteros: el fin es el 00:00 del día siguiente al último.
    const ultimo = claveDeDia(new Date(new Date(ausencia.endsAt).getTime() - 60_000), timeZone);
    if (ultimo === inicio) return `el ${diaYMes(inicio)}`;
    // «del 9 al 12 de noviembre» si es el mismo mes; si no, con los dos meses.
    const primero = inicio.slice(0, 7) === ultimo.slice(0, 7) ? String(Number(inicio.slice(8))) : diaYMes(inicio);
    return `del ${primero} al ${diaYMes(ultimo)}`;
  }
  return fin === inicio
    ? `el ${diaYMes(inicio)} de ${horaInicio} a ${horaFin}`
    : `desde el ${diaYMes(inicio)} a las ${horaInicio} hasta el ${diaYMes(fin)} a las ${horaFin}`;
}
