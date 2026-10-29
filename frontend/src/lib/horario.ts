import type { BusinessSchedule, ScheduleDay, WeekDay } from "./types";

export const DIAS_DEL_HORARIO: Array<{ key: WeekDay; nombre: string; inicial: string }> = [
  { key: "monday", nombre: "Lunes", inicial: "L" },
  { key: "tuesday", nombre: "Martes", inicial: "M" },
  { key: "wednesday", nombre: "Miércoles", inicial: "X" },
  { key: "thursday", nombre: "Jueves", inicial: "J" },
  { key: "friday", nombre: "Viernes", inicial: "V" },
  { key: "saturday", nombre: "Sábado", inicial: "S" },
  { key: "sunday", nombre: "Domingo", inicial: "D" },
];

/** «09:00» → «9:00»: en una línea de resumen sobra el cero. */
function hora(valor: string) {
  return valor.replace(/^0(\d)/, "$1");
}

function tramos(dia: ScheduleDay) {
  if (!dia.enabled || dia.intervals.length === 0) return "";
  return dia.intervals.map((tramo) => `${hora(tramo.start)}–${hora(tramo.end)}`).join(", ");
}

/**
 * El horario en una línea, agrupando los días seguidos que abren igual:
 * «L–V 9:00–14:00, 16:30–20:30 · S 9:00–14:00». Es lo que enseña el índice
 * del Agente en el móvil, donde no cabe «5 días abiertos con horario propio».
 */
export function resumenDeHorario(horario: BusinessSchedule) {
  const partes: string[] = [];
  let indice = 0;
  while (indice < DIAS_DEL_HORARIO.length) {
    const firma = tramos(horario.week[DIAS_DEL_HORARIO[indice].key]);
    if (!firma) {
      indice += 1;
      continue;
    }
    let fin = indice;
    while (
      fin + 1 < DIAS_DEL_HORARIO.length &&
      tramos(horario.week[DIAS_DEL_HORARIO[fin + 1].key]) === firma
    ) {
      fin += 1;
    }
    const dias =
      fin === indice
        ? DIAS_DEL_HORARIO[indice].inicial
        : `${DIAS_DEL_HORARIO[indice].inicial}–${DIAS_DEL_HORARIO[fin].inicial}`;
    partes.push(`${dias} ${firma}`);
    indice = fin + 1;
  }
  return partes.length > 0 ? partes.join(" · ") : "Cerrado toda la semana";
}

/**
 * El mismo criterio que valida el backend (lib/businessSchedule.ts), dicho
 * antes de guardar y debajo del día que lo incumple.
 */
export function errorDeTramos(dia: ScheduleDay): string | null {
  if (!dia.enabled) return null;
  if (dia.intervals.length === 0) return "Un día abierto necesita al menos un tramo.";
  if (dia.intervals.some((tramo) => tramo.start >= tramo.end)) {
    return "El cierre debe ser posterior a la apertura.";
  }
  const ordenados = [...dia.intervals].sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 1; i < ordenados.length; i += 1) {
    if (ordenados[i].start < ordenados[i - 1].end) return "Los tramos no pueden solaparse.";
  }
  return null;
}

/**
 * Si la recepcionista tiene un horario con el que reservar. El backend solo
 * acepta la forma estructurada (`version: 1` y los siete días; ver
 * `checkBusinessHours` en backend/src/lib/businessSchedule.ts) y, sin ella,
 * no ofrece ni un hueco (`BUSINESS_HOURS_NOT_CONFIGURED`). Una semana con
 * todos los días cerrados tampoco deja reservar nada. El registro crea el
 * negocio con `schedule: {}` y el alta sin ficha de Google no lo pide.
 */
export function horarioConfigurado(valor: unknown): boolean {
  if (!valor || typeof valor !== "object") return false;
  const { version, week } = valor as { version?: unknown; week?: unknown };
  if (version !== 1 || !week || typeof week !== "object") return false;
  const semana = week as Partial<Record<WeekDay, Partial<ScheduleDay> | null>>;
  const dias = DIAS_DEL_HORARIO.map(({ key }) => semana[key]);
  if (dias.some((dia) => !dia || typeof dia !== "object")) return false;
  return dias.some((dia) => dia?.enabled === true && Array.isArray(dia.intervals) && dia.intervals.length > 0);
}
