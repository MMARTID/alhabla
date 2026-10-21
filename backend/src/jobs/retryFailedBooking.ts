import { prisma } from "../lib/prisma.js";
import { enqueueEmailJob, enqueueRetryBookingJob } from "../lib/cloudTasks.js";
import { buildCalendarIdempotencyKey } from "../lib/calendarIdempotency.js";
import { calendarService } from "../modules/calendar/service.js";
import {
  conexionOperativa,
  marcarCalendarioDesconectado,
  origenDeCalendario,
  resolverConexionDeCalendario,
  SELECT_CONEXION_DE_CALENDARIO,
  usaCalendarioExterno,
} from "../modules/calendar/conexion.js";
import { DESCRIPTORES_DE_PROVEEDOR } from "../adapters/calendar/CalendarProvider.js";
import { proveedorDesdeErrorDeReconexion } from "../adapters/calendar/errors.js";
import {
  checkBusinessHours,
  checkBookingRestrictions,
} from "../lib/businessSchedule.js";
import {
  checkAvailability,
  computeAvailabilityLookaheadMs,
} from "../lib/availability.js";
import { acquireBookingLock, releaseBookingLock } from "../lib/bookingLock.js";
import { RetryFailedBookingJob } from "../lib/jobTypes.js";
import {
  avisarCitaRecuperada,
  avisarReintentosAgotados,
  avisarReservaPerdida,
} from "../modules/whatsapp/avisosNegocio.js";
import { finalDeReservaPendienteEmail } from "../lib/emailTemplates.js";
import { errorMessage } from "../lib/logUtils.js";
import { appUrl } from "../lib/urls.js";
import { programarMensajesAlCliente } from "../modules/whatsapp/mensajesCliente.js";
import { whatsappAdapter } from "../adapters/whatsapp/WhatsAppAdapter.js";
import { anularLaCitaCambiada } from "../modules/bookings/reservaModificada.js";
import { isValidE164Phone, normalizarTelefono } from "../lib/phone.js";

interface PendingBookingData {
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  startDateTime: string;
  durationMinutes: number;
  serviceIds?: string[] | null;
  professionalId?: string | null;
  /** Desde el 16-10-2026; los leads anteriores no lo traen (= sin permiso). */
  smsConsent?: boolean;
  /** Desde el 16-10-2026; los leads anteriores no lo traen (= voz). */
  createdVia?: string;
  /** La cita que el cliente cambiaba (voiceTools/service.ts): se anula solo
   * si la nueva acaba entrando. */
  replacesBookingId?: string | null;
}

function isValidAppointmentDuration(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= 24 * 60
  );
}

async function abandonLead(leadId: string, reason: string): Promise<void> {
  console.error(`[Job] Lead ${leadId} ya no es válido: ${reason}`);
  await prisma.lead.update({
    where: { id: leadId },
    data: { resolvedAt: new Date() },
  });
}

/** Lo que necesitan los avisos del final de una cita pendiente. */
interface FinalDeLaCita {
  leadId: string;
  businessId: string;
  businessName: string;
  timezone: string;
  clientName: string;
  clientPhone: string | null;
  startDate: Date;
}

/** Por qué una cita pendiente ya no cabe, en palabras del dueño. */
const MOTIVO_DE_RESTRICCION: Record<string, string> = {
  APPOINTMENT_IN_PAST: "la hora ya ha pasado",
  MIN_ADVANCE_NOT_MET:
    "ya no queda la antelación mínima que pides para reservar",
  TOO_FAR_IN_ADVANCE: "la fecha queda más lejos de lo que permites reservar",
  MAX_DURATION_EXCEEDED: "la cita dura más de lo que permites",
  INVALID_DATE_TIME: "la fecha de la cita no era válida",
};

/** El email de respaldo de los dos avisos del final. Nunca lanza. */
function emailDelFinal(
  cita: FinalDeLaCita,
  tipo: "perdida" | "agotada",
  motivo?: string
): () => Promise<void> {
  return async () => {
    try {
      const negocio = await prisma.business.findUnique({
        where: { id: cita.businessId },
        select: { users: { select: { email: true }, take: 1 } },
      });
      const email = negocio?.users[0]?.email;
      if (!email) {
        console.warn(
          `[Job] Lead ${cita.leadId} (${tipo}): el negocio ${cita.businessId} no tiene email; el aviso no sale por ninguna vía`
        );
        return;
      }
      const formattedDateTime = new Intl.DateTimeFormat("es-ES", {
        timeZone: cita.timezone,
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      }).format(cita.startDate);
      const { subject, html } = finalDeReservaPendienteEmail({
        tipo,
        businessName: cita.businessName,
        clientName: cita.clientName,
        clientPhone: cita.clientPhone,
        formattedDateTime,
        motivo,
        panelUrl: `${appUrl()}/`,
      });
      await enqueueEmailJob(
        { fromAlias: "support", toAddress: email, subject, html },
        `reserva-${tipo}-${cita.leadId}`
      );
    } catch (error) {
      console.error(
        `[Job] Lead ${cita.leadId} (${tipo}): no se pudo encolar el email al negocio ${cita.businessId}: ${errorMessage(error)}`
      );
    }
  };
}

/**
 * La cita ya no se puede hacer (hueco ocupado, fuera de horario o de plazo):
 * se cierra el lead y se avisa al dueño, porque al cliente se le dijo «he
 * tomado nota para confirmártela». Antes se cerraba en silencio.
 */
async function perderReserva(
  cita: FinalDeLaCita,
  motivoDelLog: string,
  motivo: string
): Promise<void> {
  await abandonLead(cita.leadId, motivoDelLog);
  const aviso = await avisarReservaPerdida({
    businessId: cita.businessId,
    businessName: cita.businessName,
    timezone: cita.timezone,
    leadId: cita.leadId,
    clientName: cita.clientName,
    clientPhone: cita.clientPhone,
    startDateTime: cita.startDate,
    motivo,
    email: emailDelFinal(cita, "perdida", motivo),
  });
  console.log(
    `[Job] Lead ${cita.leadId} perdido (${motivoDelLog}); aviso al negocio ${cita.businessId}: ${aviso.via}${aviso.motivo ? ` (${aviso.motivo})` : ""}`
  );
}

/**
 * Reintenta en segundo plano una reserva que falló durante la llamada (ver
 * capturePendingBookingLead en voiceTools/service.ts) por un fallo probablemente
 * transitorio del calendario. El cliente ya colgó — si el negocio sigue sin
 * reconectar el calendario, lanzamos un error para que Cloud Tasks reintente
 * más tarde en vez de dar la reserva por perdida.
 */
/** Cada cuánto se vuelve a mirar si el negocio ya reconectó el calendario, y
 * cuántas veces: 8 intentos cada 6 horas cubren dos días, que es lo que tarda
 * un negocio pequeño en darse cuenta por el aviso del panel o del correo. */
const HORAS_ENTRE_REINTENTOS = 6;
const MAX_REINTENTOS_POR_CALENDARIO = 8;

/**
 * El calendario está desconectado: se reprograma el propio reintento unas
 * horas más tarde y, agotado el plazo, se avisa al dueño. Antes esto lanzaba,
 * y Cloud Tasks gastaba sus cuatro reintentos en cuestión de minutos mientras
 * el negocio tardaba días en reconectar; y al agotar el plazo no se avisaba
 * a nadie. La cita sigue sin resolver (panel, resumen semanal) para que el
 * dueño la apunte o la reintente desde el aviso.
 */
async function esperarAlCalendario(
  intento: number | undefined,
  cita: FinalDeLaCita
): Promise<void> {
  const siguienteIntento = (intento ?? 0) + 1;
  if (siguienteIntento <= MAX_REINTENTOS_POR_CALENDARIO) {
    await enqueueRetryBookingJob(
      { leadId: cita.leadId, attempt: siguienteIntento },
      `retry-failed-booking-${cita.leadId}-${siguienteIntento}`,
      new Date(Date.now() + HORAS_ENTRE_REINTENTOS * 60 * 60 * 1000)
    );
    console.log(
      `[Job] Calendario de ${cita.businessId} aún desconectado; reintento ${siguienteIntento}/${MAX_REINTENTOS_POR_CALENDARIO} del lead ${cita.leadId} programado para dentro de ${HORAS_ENTRE_REINTENTOS}h`
    );
    return;
  }
  const aviso = await avisarReintentosAgotados({
    businessId: cita.businessId,
    businessName: cita.businessName,
    timezone: cita.timezone,
    leadId: cita.leadId,
    clientName: cita.clientName,
    clientPhone: cita.clientPhone,
    startDateTime: cita.startDate,
    email: emailDelFinal(cita, "agotada"),
  });
  console.warn(
    `[Job] Lead ${cita.leadId}: se agotaron los reintentos con el calendario desconectado; queda pendiente de gestión manual. Aviso al negocio ${cita.businessId}: ${aviso.via}${aviso.motivo ? ` (${aviso.motivo})` : ""}`
  );
}

export async function processRetryFailedBookingJob(
  data: RetryFailedBookingJob
): Promise<void> {
  const { leadId } = data;
  console.log(`[Job] Reintentando reserva pendiente del lead ${leadId}`);

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead || lead.resolvedAt) {
    console.log(
      `[Job] Lead ${leadId} ya no existe o ya está resuelto; se descarta el reintento`
    );
    return;
  }

  const data_ = lead.data as unknown as PendingBookingData;
  const startDate = new Date(data_.startDateTime);

  if (!isValidAppointmentDuration(data_.durationMinutes)) {
    await abandonLead(leadId, "duración de cita no válida");
    return;
  }

  const call = await prisma.call.findUnique({
    where: { id: lead.callId },
    select: { businessId: true, fromNumber: true, voiceProvider: true },
  });
  if (!call) {
    throw new Error(
      `Call ${lead.callId} no existe; no se puede reintentar la reserva del lead ${leadId}`
    );
  }

  const business = await prisma.business.findUnique({
    where: { id: call.businessId },
    select: {
      name: true,
      schedule: true,
      timezone: true,
      bookingCapacity: true,
      minAdvanceBookingMinutes: true,
      maxAppointmentDurationMinutes: true,
      ...SELECT_CONEXION_DE_CALENDARIO,
    },
  });
  if (!business) {
    throw new Error(
      `Business ${call.businessId} no existe; no se puede reintentar la reserva del lead ${leadId}`
    );
  }

  // Igual que en la reserva en vivo: si el cliente no dio un teléfono
  // distinto, se usa el de la llamada, si es un teléfono (con número
  // oculto el evento decía «Teléfono: anonymous»). El del lead se
  // normaliza: los anteriores al 16-10 se guardaban tal cual los dictaba.
  const effectiveClientPhone =
    normalizarTelefono(data_.clientPhone) ??
    (call.fromNumber && isValidE164Phone(call.fromNumber)
      ? call.fromNumber
      : undefined);

  const cita: FinalDeLaCita = {
    leadId,
    businessId: call.businessId,
    businessName: business.name,
    timezone: business.timezone || "Europe/Madrid",
    clientName: data_.clientName,
    clientPhone: effectiveClientPhone ?? null,
    startDate,
  };

  const conexion = resolverConexionDeCalendario(business);

  if (!conexionOperativa(conexion)) {
    // El negocio sigue sin reconectar el calendario (ver esperarAlCalendario).
    await esperarAlCalendario(data.attempt, cita);
    return;
  }

  // Resueltos aparte (no vienen guardados en el Lead) para que el evento de
  // calendario de un reintento en segundo plano quede tan completo como el
  // de una reserva que sale bien a la primera — ver buildEventContent en
  // calendar/service.ts. Filtrados por businessId igual que en
  // voiceTools/service.ts: serviceIds/professionalId en el Lead pueden venir
  // sin verificar (capturePendingBookingLead los guarda tal cual cuando el
  // fallo es por calendario desconectado, antes de que existan las versiones
  // verificadas) — sin este filtro, un id que por lo que sea coincidiera con
  // el de otro negocio filtraría el nombre de SU servicio/profesional al
  // evento de este negocio.
  const requestedServiceIds = data_.serviceIds ?? [];
  let serviceNames: string[] = [];
  if (requestedServiceIds.length > 0) {
    const services = await prisma.service.findMany({
      where: {
        id: { in: requestedServiceIds },
        businessId: call.businessId,
        active: true,
        deletedAt: null,
      },
      select: { id: true, name: true },
    });
    const serviceById = new Map(services.map((s) => [s.id, s.name]));
    serviceNames = requestedServiceIds
      .map((id) => serviceById.get(id))
      .filter((n): n is string => Boolean(n));
  }

  let professionalName: string | undefined;
  let verifiedProfessionalId: string | undefined;
  if (data_.professionalId) {
    const professional = await prisma.professional.findFirst({
      where: {
        id: data_.professionalId,
        businessId: call.businessId,
        active: true,
        deletedAt: null,
      },
      select: { id: true, name: true },
    });
    professionalName = professional?.name;
    verifiedProfessionalId = professional?.id;
  }

  // Mismo lock por negocio que usa la reserva en vivo (voiceTools/service.ts)
  // — este job puede correr a la vez que una llamada real está reservando
  // para el mismo negocio, y las dos comparten el mismo hueco/capacidad.
  const lockToken = await acquireBookingLock(call.businessId);
  if (!lockToken) {
    throw new Error(
      `No se pudo adquirir el lock de reserva de ${call.businessId}; se reintentará más tarde`
    );
  }

  try {
    // La comprobación de idempotencia tiene que vivir DENTRO de la sección
    // protegida por el lock, no antes de adquirirlo: si se hiciera antes,
    // dos entregas concurrentes de Cloud Tasks para el mismo leadId podrían
    // ambas leer "no existe reserva todavía", serializarse en el lock, y la
    // segunda —que ya no vuelve a comprobar tras conseguirlo— duplicaría el
    // evento de calendario y la notificación al negocio. Un booking ya
    // puede existir para esta llamada por un reintento anterior que tuvo
    // éxito, o porque el cliente siguió al teléfono y logró confirmar (otra
    // hora, quizás) antes de colgar — en ambos casos, sobrescribirlo con los
    // datos DEL LEAD (que reflejan el momento del fallo, no el estado
    // actual) sería el propio bug que este fix corrige.
    const existingBooking = await prisma.booking.findUnique({
      where: { callId: lead.callId },
      select: {
        externalEventId: true,
        programedAt: true,
        durationMinutes: true,
      },
    });
    if (existingBooking) {
      const sameRequest =
        existingBooking.programedAt.getTime() === startDate.getTime() &&
        existingBooking.durationMinutes === data_.durationMinutes;
      if (sameRequest && existingBooking.externalEventId) {
        await abandonLead(
          leadId,
          "ya tenía un evento creado para esta reserva exacta; se marca resuelto sin duplicar"
        );
      } else {
        await abandonLead(
          leadId,
          "descartado: ya existe una reserva distinta (más reciente) para esta llamada"
        );
      }
      return;
    }

    // Cambio de cita: la que cambia no cuenta como ocupada (puede solaparse
    // con la nueva) y se anula solo si la nueva entra. Si ya no está activa
    // (el cliente o el dueño la cancelaron), no hay nada que anular.
    const citaCambiada = data_.replacesBookingId
      ? await prisma.booking.findFirst({
          where: {
            id: data_.replacesBookingId,
            call: { businessId: call.businessId },
            isCancelled: false,
          },
          select: { id: true, externalEventId: true },
        })
      : null;

    // El fallo original pudo haber sido de calendario, pero entre ese
    // momento y este reintento (a veces minutos u horas más tarde) el
    // horario pudo cambiar, el hueco pudo ocuparse, o la antelación mínima
    // pudo dejar de cumplirse — revalidar aquí es lo que evita confirmar a
    // ciegas una reserva que ya no es válida.
    const businessHours = checkBusinessHours(
      business.schedule,
      business.timezone || "Europe/Madrid",
      data_.startDateTime,
      data_.durationMinutes
    );
    if (!businessHours.success || !businessHours.isOpen) {
      await perderReserva(
        cita,
        `fuera del horario actual del negocio (${businessHours.code ?? "sin código"})`,
        "esa hora ya queda fuera de tu horario"
      );
      return;
    }

    const restrictions = checkBookingRestrictions(
      business,
      data_.startDateTime,
      data_.durationMinutes
    );
    if (!restrictions.success) {
      await perderReserva(
        cita,
        restrictions.code,
        MOTIVO_DE_RESTRICCION[restrictions.code] ??
          "la cita ya no cumple tus reglas de reserva"
      );
      return;
    }

    // Misma comprobación de ocupación real del calendario que la reserva en
    // vivo (voiceTools/service.ts) — ver hallazgo #5 de la auditoría. Misma
    // ventana exacta que usa checkAvailability internamente
    // (computeAvailabilityLookaheadMs) — un margen fijo anterior (5h) se
    // quedaba corto para cualquier servicio de más de 60 min.
    const externalBusy = Number.isNaN(startDate.getTime())
      ? { intervals: [], calendarAvailabilityKnown: false }
      : await calendarService.getBusyIntervals({
          conexion,
          timeMin: startDate,
          timeMax: new Date(
            startDate.getTime() +
              computeAvailabilityLookaheadMs(data_.durationMinutes)
          ),
        });

    const normalizedExternalBusy = Array.isArray(externalBusy)
      ? { intervals: externalBusy, calendarAvailabilityKnown: false }
      : externalBusy;

    // Igual que la reserva en vivo: con un calendario externo que no se pudo
    // leer, no se reserva a ciegas. checkAvailability ignora la ocupación
    // externa cuando no se conoce, así que sin esta guarda la cita podía
    // entrar encima de una que el dueño apuntó a mano. Se lanza para que
    // Cloud Tasks lo reintente más tarde (el cerrojo se suelta en el
    // finally); si se agotan los reintentos, la reserva sigue pendiente y el
    // dueño ya tiene el aviso de cita pendiente.
    if (
      usaCalendarioExterno(conexion) &&
      !normalizedExternalBusy.calendarAvailabilityKnown
    ) {
      console.warn(
        `[Job] Lead ${leadId} (negocio ${call.businessId}): el calendario de ${DESCRIPTORES_DE_PROVEEDOR[conexion.provider].nombreCorto} sigue sin poder leerse; no se reserva a ciegas, se reintentará`
      );
      throw new Error(
        `Calendario ilegible al reintentar la reserva del lead ${leadId}`
      );
    }

    const availability = await checkAvailability({
      businessId: call.businessId,
      schedule: business.schedule,
      timezone: business.timezone || "Europe/Madrid",
      bookingCapacity: business.bookingCapacity,
      startDateTime: data_.startDateTime,
      durationMinutes: data_.durationMinutes,
      serviceIds: requestedServiceIds,
      professionalId: verifiedProfessionalId,
      externalBusyIntervals: normalizedExternalBusy.intervals,
      calendarAvailabilityKnown:
        normalizedExternalBusy.calendarAvailabilityKnown,
      calendarOrigin: origenDeCalendario(conexion),
      ...(citaCambiada
        ? {
            excluir: {
              bookingId: citaCambiada.id,
              externalEventId: citaCambiada.externalEventId,
            },
          }
        : {}),
    });
    if (!availability.available) {
      await perderReserva(
        cita,
        `${availability.code} (el hueco se ocupó mientras esperaba el reintento)`,
        "ese hueco se ha ocupado mientras tanto"
      );
      return;
    }
    const resolvedProfessionalId =
      verifiedProfessionalId ?? availability.availableProfessionals[0]?.id;

    let result: unknown;
    try {
      result = await calendarService.bookAppointment({
        conexion,
        clientName: data_.clientName,
        startDateTime: data_.startDateTime,
        durationMinutes: data_.durationMinutes,
        clientEmail: data_.clientEmail ?? undefined,
        clientPhone: effectiveClientPhone,
        serviceNames,
        professionalName,
        timezone: business.timezone || undefined,
        idempotencyKey: buildCalendarIdempotencyKey({
          callId: lead.callId,
          startDateTime: data_.startDateTime,
          durationMinutes: data_.durationMinutes,
        }),
      });
    } catch (error) {
      const proveedorRoto = proveedorDesdeErrorDeReconexion(error);
      if (proveedorRoto) {
        // A diferencia de otros fallos (transitorios, reintentables), este
        // requiere una acción manual del negocio — igual que en la reserva
        // en vivo (voiceTools/service.ts), se marca el calendario como
        // desconectado y se invalida la caché de voz, en vez de dejar que
        // Cloud Tasks siga reintentando contra una conexión que no va a
        // arreglarse sola. Sin este catch, el job simplemente fallaba una y
        // otra vez hasta agotar los reintentos de Cloud Tasks, dejando la
        // conexión marcada como conectada (el panel seguía mostrando
        // "conectado") aunque en realidad llevara horas rota.
        await marcarCalendarioDesconectado(
          call.businessId,
          proveedorRoto,
          { modo: "revocar" },
          { prefijo: "[Job]" }
        );
        // Antes el lead se cerraba aquí y la cita se perdía aunque el dueño
        // reconectara al rato. Ahora espera como cualquier cita con el
        // calendario desconectado: se reintenta cada 6 h hasta dos días.
        console.warn(
          `[Job] Lead ${leadId}: la conexión de ${DESCRIPTORES_DE_PROVEEDOR[proveedorRoto].nombreCorto} está revocada o expirada; la cita espera a que el negocio reconecte`
        );
        await esperarAlCalendario(data.attempt, cita);
        return;
      }
      throw error;
    }

    // Como la reserva en vivo: el consentimiento del resumen y el canal de
    // la tool. Antes la cita recuperada nacía sin permiso (nunca se le
    // confirmaba al cliente) y siempre como `voice`, aunque viniera del chat.
    const smsConsent = data_.smsConsent === true;
    const createdVia =
      data_.createdVia === "client_chat" ? "client_chat" : "voice";

    const reserva = await prisma.$transaction(async (tx) => {
      const guardada = await tx.booking.upsert({
        where: { callId: lead.callId },
        create: {
          callId: lead.callId,
          programedAt: startDate,
          durationMinutes: data_.durationMinutes,
          numberPeople: 1,
          professionalId: resolvedProfessionalId ?? undefined,
          serviceIds: data_.serviceIds ?? [],
          clientName: data_.clientName,
          clientPhone: effectiveClientPhone,
          smsConsent,
          createdVia,
          externalEventId: (result as { id?: string })?.id ?? undefined,
          externalCalendarProvider: conexion.provider,
          externalCalendarId: conexion.calendarId,
        },
        update: {
          programedAt: startDate,
          durationMinutes: data_.durationMinutes,
          professionalId: resolvedProfessionalId ?? undefined,
          serviceIds: data_.serviceIds ?? [],
          clientName: data_.clientName,
          clientPhone: effectiveClientPhone,
          smsConsent,
          externalEventId: (result as { id?: string })?.id ?? undefined,
          externalCalendarProvider: conexion.provider,
          externalCalendarId: conexion.calendarId,
          // Reservar de nuevo tras una cancelación reactiva la fila.
          isCancelled: false,
          cancelledAt: null,
          cancelledBy: null,
        },
        select: { id: true },
      });
      await tx.lead.update({
        where: { id: lead.id },
        data: { resolvedAt: new Date() },
      });
      return guardada;
    });

    console.log(
      `[Job] Reserva pendiente confirmada en segundo plano para el lead ${leadId} · evento=${
        (result as { htmlLink?: string })?.htmlLink ?? "n/d"
      }`
    );

    if (citaCambiada && reserva?.id) {
      await anularLaCitaCambiada({
        businessId: call.businessId,
        citaAnteriorId: citaCambiada.id,
        nuevaReservaId: reserva.id,
        cancelledBy:
          call.voiceProvider === "whatsapp" ? "client_chat" : "client_voice",
        etiqueta: `lead ${leadId}`,
      });
    }

    // El dueño recibió el aviso de cita pendiente: que sepa que ya entró.
    // Solo dentro de la ventana de 24 h (sin plantilla propia); nunca lanza.
    await avisarCitaRecuperada({
      businessId: call.businessId,
      businessName: business.name,
      timezone: business.timezone || "Europe/Madrid",
      leadId: lead.id,
      clientName: data_.clientName,
      startDateTime: startDate,
    });

    // La recepcionista le dijo que se la confirmaría: confirmación (y
    // recordatorio) por WhatsApp con las mismas condiciones que en vivo
    // (consentimiento, número válido, sin STOP). Nunca lanza.
    if (whatsappAdapter.isConfigured()) {
      await programarMensajesAlCliente({
        bookingId: reserva.id,
        etiqueta: `retry-failed-booking ${leadId}`,
      });
    }
  } finally {
    await releaseBookingLock(call.businessId, lockToken);
  }
}
