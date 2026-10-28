/**
 * Feed iCal de solo lectura de la agenda (PLAN-AGENDA-ALHABLA.md, fase 3):
 * el dueño se suscribe desde el calendario del móvil o de Google y ve las
 * citas de Alhabla sin conectar nada. Funciones puras sobre ical.js, como
 * adapters/calendar/caldav/ics.ts: sin red, sin prisma, testeables a pelo.
 *
 * Datos mínimos a propósito: la URL del feed equivale a una contraseña y
 * Google la copia a sus servidores, así que van el servicio, el nombre del
 * cliente y quién atiende, y NUNCA el teléfono.
 */
import ICAL from "ical.js";

export type CitaDelFeed = {
  id: string;
  programedAt: Date;
  durationMinutes: number;
  clientName: string | null;
  serviceNames: string[];
  professionalName: string | null;
  isCancelled: boolean;
  /** Última modificación conocida (cancelación o creación): DTSTAMP. */
  updatedAt: Date;
};

export type AusenciaDelFeed = {
  id: string;
  professionalName: string;
  startsAt: Date;
  endsAt: Date;
  reason: string | null;
};

/** UID estable por cita: el mismo en cada descarga, para que el calendario
 * suscrito actualice en vez de duplicar. */
export function uidDeCitaDelFeed(bookingId: string): string {
  return `cita-${bookingId}@alhabla.ai`;
}

export function uidDeAusenciaDelFeed(ausenciaId: string): string {
  return `ausencia-${ausenciaId}@alhabla.ai`;
}

/** «Corte y mechas · Marta», «Cita · Marta», «Corte» (sin nombre). */
export function tituloDeCitaDelFeed(cita: {
  clientName: string | null;
  serviceNames: string[];
}): string {
  const servicio =
    cita.serviceNames.length === 0
      ? "Cita"
      : cita.serviceNames.length === 1
        ? cita.serviceNames[0]
        : `${cita.serviceNames.slice(0, -1).join(", ")} y ${cita.serviceNames.at(-1)}`;
  const nombre = cita.clientName?.trim();
  return nombre ? `${servicio} · ${nombre}` : servicio;
}

function fechaUtc(fecha: Date): ICAL.Time {
  return ICAL.Time.fromJSDate(fecha, true);
}

/**
 * VCALENDAR con un VEVENT por cita (las canceladas recientes con
 * STATUS:CANCELLED, para que el calendario suscrito las retire) y uno por
 * ausencia («No está: Laura»). Fechas en UTC: el calendario del dueño las
 * pinta en su zona.
 */
export function construirFeedIcs(input: {
  nombreDelNegocio: string;
  citas: CitaDelFeed[];
  ausencias: AusenciaDelFeed[];
  /** Instante de generación: DTSTAMP de las ausencias (no guardan cambios). */
  ahora?: Date;
}): string {
  const ahora = input.ahora ?? new Date();
  const vcalendar = new ICAL.Component("vcalendar");
  vcalendar.addPropertyWithValue("version", "2.0");
  vcalendar.addPropertyWithValue(
    "prodid",
    "-//Alhabla//Agenda de Alhabla//ES"
  );
  vcalendar.addPropertyWithValue("calscale", "GREGORIAN");
  vcalendar.addPropertyWithValue("method", "PUBLISH");
  // Nombre que enseñan Apple y Google al suscribirse, y cada cuánto
  // conviene refrescar (Google lo ignora: refresca cada varias horas).
  vcalendar.addPropertyWithValue(
    "x-wr-calname",
    `Agenda de ${input.nombreDelNegocio}`
  );
  vcalendar.addPropertyWithValue("x-published-ttl", "PT15M");
  vcalendar.addPropertyWithValue("refresh-interval", "PT15M");

  for (const cita of input.citas) {
    const vevent = new ICAL.Component("vevent");
    vevent.addPropertyWithValue("uid", uidDeCitaDelFeed(cita.id));
    vevent.addPropertyWithValue("dtstamp", fechaUtc(cita.updatedAt));
    vevent.addPropertyWithValue("dtstart", fechaUtc(cita.programedAt));
    vevent.addPropertyWithValue(
      "dtend",
      fechaUtc(
        new Date(cita.programedAt.getTime() + cita.durationMinutes * 60_000)
      )
    );
    vevent.addPropertyWithValue("summary", tituloDeCitaDelFeed(cita));
    if (cita.professionalName) {
      vevent.addPropertyWithValue("description", `Con ${cita.professionalName}`);
    }
    vevent.addPropertyWithValue("status", cita.isCancelled ? "CANCELLED" : "CONFIRMED");
    vevent.addPropertyWithValue("transp", cita.isCancelled ? "TRANSPARENT" : "OPAQUE");
    // Una cita cancelada vuelve a publicarse con SEQUENCE mayor para que los
    // clientes que ya la tenían apliquen el cambio de estado.
    vevent.addPropertyWithValue("sequence", cita.isCancelled ? 1 : 0);
    vcalendar.addSubcomponent(vevent);
  }

  for (const ausencia of input.ausencias) {
    const vevent = new ICAL.Component("vevent");
    vevent.addPropertyWithValue("uid", uidDeAusenciaDelFeed(ausencia.id));
    vevent.addPropertyWithValue("dtstamp", fechaUtc(ahora));
    vevent.addPropertyWithValue("dtstart", fechaUtc(ausencia.startsAt));
    vevent.addPropertyWithValue("dtend", fechaUtc(ausencia.endsAt));
    vevent.addPropertyWithValue(
      "summary",
      `No está: ${ausencia.professionalName}`
    );
    if (ausencia.reason) {
      vevent.addPropertyWithValue("description", ausencia.reason);
    }
    vevent.addPropertyWithValue("status", "CONFIRMED");
    vevent.addPropertyWithValue("transp", "TRANSPARENT");
    vcalendar.addSubcomponent(vevent);
  }

  return vcalendar.toString();
}
