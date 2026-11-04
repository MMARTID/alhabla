/**
 * Normalización defensiva de los `startDateTime` que envía el LLM de voz a
 * las tools (check_availability, book_appointment, notify_when_available...).
 *
 * Hallazgo real (llamada de producción del 2026-09-14, conversación Telnyx
 * 48a320ef): el cliente pidió "el viernes a las cuatro" y el modelo llamó a
 * check_availability con `2026-09-18T16:00:00+00:00` — la hora hablada con
 * offset UTC. 16:00 UTC son las 18:00 en Madrid (justo el cierre), así que el
 * backend respondió OUTSIDE_BUSINESS_HOURS tres veces seguidas para horas que
 * en realidad estaban libres, y el cliente colgó sin reservar ("ya volveré a
 * llamar"). El prompt ahora exige el offset local, pero este módulo es la red
 * de seguridad en servidor: un LLM que escribe la hora hablada con `+00:00`
 * (o sin offset) casi nunca está haciendo la conversión a UTC de verdad —
 * está copiando la hora local y marcándola mal.
 *
 * Regla: si la fecha llega sin offset, o con offset cero (Z/+00:00) cuando la
 * zona del negocio NO está en offset cero en esa fecha, se reinterpreta la
 * hora de pared en la zona horaria del negocio. Un offset explícito distinto
 * de cero se respeta tal cual (el modelo hizo la conversión a conciencia).
 */

const ISO_LOCAL_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|z|[+-]\d{2}:?\d{2})?$/;

/** Offset de `timeZone` respecto a UTC, en minutos, en el instante `date`. */
export function timezoneOffsetMinutes(date: Date, timeZone: string): number {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;

  const match = formatted?.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return 0; // "GMT" a secas = offset cero
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

function parseExplicitOffsetMinutes(offset: string): number {
  if (offset === "Z" || offset === "z") return 0;
  const match = offset.match(/([+-])(\d{2}):?(\d{2})/);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const absolute = Math.abs(minutes);
  const hours = String(Math.floor(absolute / 60)).padStart(2, "0");
  const remainder = String(absolute % 60).padStart(2, "0");
  return `${sign}${hours}:${remainder}`;
}

/** Instante real correspondiente a una hora de pared en `timeZone` — doble
 * pasada estándar para acertar el offset también en los cambios de hora. */
function wallTimeToInstant(
  parts: { year: number; month: number; day: number; hour: number; minute: number; second: number },
  timeZone: string
): number {
  const utcGuess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  const firstOffset = timezoneOffsetMinutes(new Date(utcGuess), timeZone);
  const firstInstant = utcGuess - firstOffset * 60_000;
  const secondOffset = timezoneOffsetMinutes(new Date(firstInstant), timeZone);
  return secondOffset === firstOffset
    ? firstInstant
    : utcGuess - secondOffset * 60_000;
}

/** Medianoche de hoy (o del día de `ahora`) en la zona del negocio, como
 * instante real: el «Hoy» de los resúmenes del panel. */
export function inicioDelDiaEnZona(timeZone: string, ahora = new Date()): Date {
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(ahora)
    .split("-")
    .map(Number);
  return new Date(
    wallTimeToInstant(
      { year, month, day, hour: 0, minute: 0, second: 0 },
      timeZone
    )
  );
}

/**
 * Un instante calculado por el servidor (p. ej. «2026-10-15T07:00:00.000Z»)
 * escrito como hora local del negocio con su offset de esa fecha
 * («2026-10-15T09:00:00+02:00»). Es el formato en que el LLM debe ver toda
 * hora que pueda volver a mandar a una tool: si copia un valor con `Z`,
 * normalizeVoiceToolDateTime lo toma por hora de pared mal marcada y lo
 * desplaza (llamada de producción del 2026-10-09). Con el offset local, la
 * normalización lo deja intacto. Una entrada que no es una fecha válida se
 * devuelve tal cual.
 */
export function instanteEnHoraLocal(instante: string, timeZone: string): string {
  const date = new Date(instante);
  if (Number.isNaN(date.getTime())) return instante;
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(date)
        .map((part) => [part.type, part.value])
    );
    const offset = formatOffset(timezoneOffsetMinutes(date, timeZone));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${offset}`;
  } catch {
    return instante;
  }
}

/**
 * Devuelve el `startDateTime` con la hora de pared reinterpretada en la zona
 * del negocio cuando llega sin offset o con offset cero sospechoso (ver
 * cabecera del módulo). Cualquier entrada que no encaje en el patrón ISO
 * esperado se devuelve intacta: la validación de fechas inválidas ya la hacen
 * los propios checks de horario (INVALID_DATE_TIME).
 */
export function normalizeVoiceToolDateTime(
  startDateTime: string,
  timeZone: string
): string {
  const match = startDateTime.match(ISO_LOCAL_PATTERN);
  if (!match) return startDateTime;

  const [, year, month, day, hour, minute, second, offset] = match;
  const parts = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second ?? "0"),
  };

  try {
    if (offset && parseExplicitOffsetMinutes(offset) !== 0) {
      // Offset explícito distinto de cero: el modelo hizo su conversión.
      return startDateTime;
    }

    const instant = wallTimeToInstant(parts, timeZone);
    const businessOffset = timezoneOffsetMinutes(new Date(instant), timeZone);
    if (offset && businessOffset === 0) {
      // Offset cero legítimo (la zona del negocio también está en UTC en esa
      // fecha): no hay nada que corregir.
      return startDateTime;
    }

    const time = `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}:${String(parts.second).padStart(2, "0")}`;
    return `${year}-${month}-${day}T${time}${formatOffset(businessOffset)}`;
  } catch {
    // Zona horaria desconocida u otro fallo de Intl: mejor la entrada
    // original que romper la tool entera.
    return startDateTime;
  }
}

/** Fecha de pared (AAAA-MM-DD) de un instante en una zona. */
function fechaEnZona(fecha: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(fecha);
}

const NUMEROS_HABLADOS = [
  "cero",
  "una",
  "dos",
  "tres",
  "cuatro",
  "cinco",
  "seis",
  "siete",
  "ocho",
  "nueve",
  "diez",
  "once",
  "doce",
  "trece",
  "catorce",
  "quince",
  "dieciséis",
  "diecisiete",
  "dieciocho",
  "diecinueve",
  "veinte",
  "veintiuno",
  "veintidós",
  "veintitrés",
  "veinticuatro",
  "veinticinco",
  "veintiséis",
  "veintisiete",
  "veintiocho",
  "veintinueve",
];
const DECENAS_HABLADAS: Record<number, string> = {
  3: "treinta",
  4: "cuarenta",
  5: "cincuenta",
};

/** Minutos de 1 a 59 en palabras: «cinco», «veinte», «cuarenta y dos». */
function minutosHablados(minutos: number): string {
  if (minutos === 1) return "uno";
  if (minutos < 30) return NUMEROS_HABLADOS[minutos];
  const decena = DECENAS_HABLADAS[Math.floor(minutos / 10)];
  const unidad = minutos % 10;
  return unidad ? `${decena} y ${unidad === 1 ? "uno" : NUMEROS_HABLADOS[unidad]}` : decena;
}

/** La franja del día de una hora (0-23), como se dice en España. */
function franjaDelDia(hora: number): string {
  // Las 00:30 son «las doce y media de la noche», no de la madrugada.
  if (hora === 0) return "de la noche";
  if (hora < 6) return "de la madrugada";
  if (hora < 12) return "de la mañana";
  if (hora < 14) return "del mediodía";
  if (hora < 21) return "de la tarde";
  return "de la noche";
}

/**
 * Una hora de reloj (0-23 y 0-59) como se dice por teléfono: 17:00 es «a
 * las cinco de la tarde», 9:30 «a las nueve y media», 13:15 «a la una y
 * cuarto del mediodía» y 16:45 «a las cinco menos cuarto de la tarde». El
 * laboratorio del 02-11 con zai-org/GLM-5.3-Flash copiaba «a las 17:00» tal
 * cual aunque el prompt le pedía decirla con palabras.
 */
export function horaParaDecir(hora: number, minutos: number): string {
  const franja = franjaDelDia(hora);
  // «menos cuarto» es de la hora siguiente, con la franja de la hora real
  // («a las doce menos cuarto de la mañana»).
  const enPunto = minutos === 45 ? (hora + 1) % 24 : hora;
  const deDoce = enPunto % 12 || 12;
  const articulo = deDoce === 1 ? "a la" : "a las";
  const minutosDichos =
    minutos === 0
      ? ""
      : minutos === 15
        ? " y cuarto"
        : minutos === 30
          ? " y media"
          : minutos === 45
            ? " menos cuarto"
            : ` y ${minutosHablados(minutos)}`;
  return `${articulo} ${NUMEROS_HABLADOS[deDoce]}${minutosDichos} ${franja}`;
}

const DIAS_RELATIVOS: Record<number, string> = {
  0: "hoy",
  1: "mañana",
  2: "pasado mañana",
};

/**
 * El día y la hora de una cita como se dicen («mañana, jueves, 15 de
 * octubre, a las cinco de la tarde»), en la zona del negocio. Las tools lo devuelven en
 * `cuando` para que la recepcionista no calcule el día: en una llamada de
 * producción del 14-10 dijo «dijous setze» de una cita del jueves 15. El
 * día relativo (hoy, mañana, pasado mañana) se cuenta desde `ahora`. Una
 * entrada que no es una fecha válida devuelve null.
 */
/**
 * `cuando` en otro idioma que el castellano (`locale`, uno de
 * CODIGOS_DE_IDIOMA): el día con el formato de ese idioma, «hoy» y «mañana»
 * en él, y la hora en cifras, como se lee allí («Friday 6 November, 5 pm»,
 * «vendredi 6 novembre, 17:00»). Laboratorio del 03-11 (E3): con el
 * `cuando` en castellano delante, GLM-5.3-Flash contestaba en castellano el
 * primer turno tras check_availability a un cliente que hablaba inglés.
 */
export function cuandoEnOtroIdioma(
  instante: string | Date,
  timeZone: string,
  locale: string,
  ahora: Date = new Date()
): string | null {
  const fecha = instante instanceof Date ? instante : new Date(instante);
  if (Number.isNaN(fecha.getTime())) return null;
  const zona = timeZone || "Europe/Madrid";
  try {
    const dia = new Intl.DateTimeFormat(locale, {
      timeZone: zona,
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(fecha);
    const enIngles = locale.startsWith("en");
    const enPunto =
      new Intl.DateTimeFormat("en-GB", { timeZone: zona, minute: "2-digit" })
        .format(fecha)
        .replace(/^0+/, "") === "";
    // En inglés, «5 pm» y no «17:00» ni «5:00 pm».
    const hora = new Intl.DateTimeFormat(locale, {
      timeZone: zona,
      hour: "numeric",
      ...(enIngles && enPunto ? {} : { minute: "2-digit" }),
      ...(enIngles ? { hour12: true } : {}),
    }).format(fecha);
    const diferencia = Math.round(
      (Date.parse(fechaEnZona(fecha, zona)) -
        Date.parse(fechaEnZona(ahora, zona))) /
        86_400_000
    );
    const relativo =
      diferencia === 0 || diferencia === 1
        ? new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
            diferencia,
            "day"
          )
        : null;
    return `${relativo ? `${relativo}, ` : ""}${dia}, ${hora}`;
  } catch {
    return null;
  }
}

export function cuandoParaDecir(
  instante: string | Date,
  timeZone: string,
  ahora: Date = new Date()
): string | null {
  const fecha = instante instanceof Date ? instante : new Date(instante);
  if (Number.isNaN(fecha.getTime())) return null;
  const zona = timeZone || "Europe/Madrid";
  try {
    const dia = new Intl.DateTimeFormat("es-ES", {
      timeZone: zona,
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(fecha);
    const [hora, minutos] = new Intl.DateTimeFormat("es-ES", {
      timeZone: zona,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .format(fecha)
      .split(":")
      .map(Number);
    const diferencia = Math.round(
      (Date.parse(fechaEnZona(fecha, zona)) -
        Date.parse(fechaEnZona(ahora, zona))) /
        86_400_000
    );
    const relativo = DIAS_RELATIVOS[diferencia];
    return `${relativo ? `${relativo}, ` : ""}${dia}, ${horaParaDecir(hora, minutos)}`;
  } catch {
    return null;
  }
}
