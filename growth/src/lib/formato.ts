/**
 * Fechas y números para pintar. Todo en español de España y en la zona
 * horaria del navegador (el administrador vive donde trabaja).
 */

const MS_POR_DIA = 24 * 60 * 60 * 1000;

function comoFecha(valor: string | Date | null | undefined): Date | null {
  if (!valor) return null;
  const fecha = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

const FORMATO_DE_FECHA = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const FORMATO_DE_FECHA_Y_HORA = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** «30 oct 2026». */
export function formatearFecha(
  valor: string | Date | null | undefined
): string {
  const fecha = comoFecha(valor);
  return fecha ? FORMATO_DE_FECHA.format(fecha) : "—";
}

/** «30 oct 2026, 08:15». */
export function formatearFechaYHora(
  valor: string | Date | null | undefined
): string {
  const fecha = comoFecha(valor);
  return fecha ? FORMATO_DE_FECHA_Y_HORA.format(fecha) : "—";
}

/**
 * «hace 3 h», «hace 2 días», «dentro de 5 días». Solo da la distancia: para el
 * dato exacto, `formatearFechaYHora`.
 */
export function formatearDistancia(
  valor: string | Date | null | undefined,
  ahora: Date = new Date()
): string {
  const fecha = comoFecha(valor);
  if (!fecha) return "—";
  const diferencia = fecha.getTime() - ahora.getTime();
  const futuro = diferencia > 0;
  const ms = Math.abs(diferencia);
  const minutos = Math.round(ms / 60_000);
  const horas = Math.round(ms / 3_600_000);
  const dias = Math.round(ms / MS_POR_DIA);

  let cantidad: string;
  if (minutos < 1) return "ahora mismo";
  if (minutos < 60) cantidad = `${minutos} min`;
  else if (horas < 24) cantidad = `${horas} h`;
  else cantidad = dias === 1 ? "1 día" : `${dias} días`;
  return futuro ? `dentro de ${cantidad}` : `hace ${cantidad}`;
}

/** «caduca en 12 d», «caduca hoy», «caducada». `null` si no caduca. */
export function textoDeCaducidad(
  diasParaCaducar: number | null
): string | null {
  if (diasParaCaducar === null) return null;
  if (diasParaCaducar < 0) return "Caducada";
  if (diasParaCaducar === 0) return "Caduca hoy";
  return `Caduca en ${diasParaCaducar} d`;
}

/** 0,38 → «38 %». */
export function formatearPorcentaje(proporcion: number): string {
  return `${Math.round(proporcion * 100)} %`;
}

/** 90 → «1 min 30 s»; 3720 → «1 h 2 min». */
export function formatearDuracion(segundos: number | null | undefined): string {
  if (segundos === null || segundos === undefined) return "—";
  if (segundos < 60) return `${Math.round(segundos)} s`;
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) {
    const resto = Math.round(segundos % 60);
    return resto === 0 ? `${minutos} min` : `${minutos} min ${resto} s`;
  }
  const horas = Math.floor(minutos / 60);
  const minutosSueltos = minutos % 60;
  return minutosSueltos === 0
    ? `${horas} h`
    : `${horas} h ${minutosSueltos} min`;
}

/** Los 7 primeros caracteres de un commit. */
export function commitCorto(sha: string | null | undefined): string {
  return sha ? sha.slice(0, 7) : "—";
}
