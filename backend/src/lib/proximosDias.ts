/**
 * `{{proximos_dias}}`: hoy y los días siguientes con su día de la semana, en
 * la zona del negocio. Lo pone contextoDeLlamada.ts al contestar cada
 * llamada; el chat de WhatsApp no lo lleva (cada mensaje ya trae su fecha).
 *
 * Sin la lista, el modelo calculaba él solo qué fecha es «el jueves» y se
 * equivocaba: «¿el dos o el nueve?» de un jueves que caía en el cinco
 * (laboratorio, E4, 30-10). La lista no le pide calcular nada.
 */

/** Dos semanas: lo que se suele pedir por el nombre del día. */
const DIAS = 14;

// En UTC: se formatea el mediodía UTC de cada día civil (ver proximosDias).
const NOMBRE_DEL_DIA = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  timeZone: "UTC",
});
const NOMBRE_DEL_MES = new Intl.DateTimeFormat("es-ES", {
  month: "long",
  timeZone: "UTC",
});

/** Año, mes y día de `fecha` en la zona del negocio. */
function fechaEnLaZona(
  fecha: Date,
  timezone: string
): { anio: number; mes: number; dia: number } {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(fecha);
  const valor = (tipo: string) =>
    Number(partes.find((parte) => parte.type === tipo)?.value);
  return { anio: valor("year"), mes: valor("month"), dia: valor("day") };
}

export function proximosDias(ahora: Date, timezone: string): string {
  const zona = timezone || "Europe/Madrid";
  const hoy = fechaEnLaZona(ahora, zona);
  const dias: string[] = [];
  let mesAnterior: number | null = null;
  for (let i = 0; i < DIAS; i++) {
    // Mediodía UTC del día civil de la zona: su nombre y su número ya no
    // dependen de la zona del servidor.
    const fecha = new Date(Date.UTC(hoy.anio, hoy.mes - 1, hoy.dia + i, 12));
    const nombre = NOMBRE_DEL_DIA.format(fecha);
    const numero = fecha.getUTCDate();
    // El mes, la primera vez y cuando cambia: «lunes 2 de noviembre,
    // martes 3...».
    const mes =
      fecha.getUTCMonth() !== mesAnterior
        ? ` de ${NOMBRE_DEL_MES.format(fecha)}`
        : "";
    mesAnterior = fecha.getUTCMonth();
    dias.push(`${i === 0 ? "hoy, " : ""}${nombre} ${numero}${mes}`);
  }
  return `Próximos días: ${dias.join("; ")}.`;
}
