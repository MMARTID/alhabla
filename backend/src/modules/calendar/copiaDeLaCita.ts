// La copia de cada cita en el calendario conectado (PLAN-AGENDA-PRINCIPAL.md,
// reglas 3 y 5). La agenda de Alhabla es la del negocio: una cita existe en
// cuanto se guarda su Booking, y el calendario conectado (Google, Outlook,
// Apple) es un complemento que recibe una copia. Que la copia falle nunca
// impide reservar:
//
// - `intentarCopiaDeLaCita` la intenta en el momento, dentro de la reserva,
//   y NUNCA lanza. Devuelve lo que hay que guardar en el Booking.
// - Si no pudo (el calendario no respondió), la cita se guarda con
//   `copiaEnCalendario = "pendiente"` y el llamador encola
//   `encolarCopiaDeLaCita`: el job (`sincronizarCopiaDeLaCita`) la reintenta
//   con espera creciente unas 48 h y, agotado el plazo, la deja "fallida" con
//   un log ruidoso.
// - Con la conexión caducada no se gasta ningún intento: la cita queda
//   pendiente y la copia el volcado al reconectar (`volcarAgendaAlCalendario`,
//   que encola guardarConexionDeCalendario).
//
// Un solo sentido (regla 4): lo que el dueño cambie en su calendario no
// vuelve a Alhabla. Este módulo solo escribe en el calendario.
import { prisma } from "../../lib/prisma.js";
import { errorMessage } from "../../lib/logUtils.js";
import { isValidE164Phone } from "../../lib/phone.js";
import {
  enqueueCopiaDeLaCitaJob,
  enqueueVolcadoDeLaAgendaJob,
} from "../../lib/cloudTasks.js";
import {
  DESCRIPTORES_DE_PROVEEDOR,
  normalizarProveedorDeCalendario,
} from "../../adapters/calendar/CalendarProvider.js";
import { proveedorDesdeErrorDeReconexion } from "../../adapters/calendar/errors.js";
import { calendarService } from "./service.js";
import {
  SELECT_CONEXION_DE_CALENDARIO,
  conexionOperativa,
  marcarCalendarioDesconectado,
  resolverConexionDeCalendario,
  tieneCalendarioConectado,
  usaCalendarioExterno,
  type ConexionResuelta,
} from "./conexion.js";
import {
  registrarBorradoDeEvento,
  ventanaDeLaCita,
} from "./borradoDeEvento.js";

export const ESTADOS_DE_COPIA = ["pendiente", "hecha", "fallida"] as const;
export type EstadoDeCopia = (typeof ESTADOS_DE_COPIA)[number];

/** Lo que una reserva guarda en su Booking tras intentar la copia. */
export type CopiaIntentada = {
  externalEventId: string | null;
  htmlLink: string | null;
  /** `Booking.copiaEnCalendario`: null si no hay calendario conectado. */
  copiaEnCalendario: EstadoDeCopia | null;
  /** Dónde vive el evento (null sin evento). */
  externalCalendarProvider: string | null;
  externalCalendarId: string | null;
  /** La copia falló por algo que puede arreglarse solo: tras guardar el
   * Booking, el llamador encola `encolarCopiaDeLaCita`. Con la conexión
   * caducada es false: la copia la hace el volcado al reconectar. */
  reintentar: boolean;
  /** Motivo de la copia pendiente, para `Booking.copiaError`. */
  copiaError: string | null;
};

const SIN_COPIA: CopiaIntentada = {
  externalEventId: null,
  htmlLink: null,
  copiaEnCalendario: null,
  externalCalendarProvider: null,
  externalCalendarId: null,
  reintentar: false,
  copiaError: null,
};

/** Campos de Booking que salen de una copia intentada (para el spread de un
 * create/update de Prisma). `externalEventId` va aparte: cada camino decide
 * si conserva el evento viejo de una cita que se mueve. */
export function camposDeLaCopia(copia: CopiaIntentada): {
  copiaEnCalendario: EstadoDeCopia | null;
  copiaError: string | null;
  copiaIntentos: number;
  externalCalendarProvider: string | null;
  externalCalendarId: string | null;
} {
  return {
    copiaEnCalendario: copia.copiaEnCalendario,
    copiaError: copia.copiaError,
    copiaIntentos: 0,
    externalCalendarProvider: copia.externalCalendarProvider,
    externalCalendarId: copia.externalCalendarId,
  };
}

type EventoDeLaCita = Omit<
  Parameters<typeof calendarService.bookAppointment>[0],
  "conexion"
>;

/**
 * Intenta copiar en el calendario conectado una cita que se está reservando.
 * NUNCA lanza: pase lo que pase, la cita se reserva. Una conexión rechazada
 * (invalid_grant) se marca desconectada aquí mismo, que es lo que dispara la
 * alerta al dueño.
 */
export async function intentarCopiaDeLaCita(input: {
  conexion: ConexionResuelta;
  businessId: string;
  /** Módulo entre corchetes y quién reserva, para los logs. */
  log: { prefijo: string; etiqueta: string };
  evento: EventoDeLaCita;
}): Promise<CopiaIntentada> {
  const { conexion, businessId, log } = input;
  if (!tieneCalendarioConectado(conexion)) return SIN_COPIA;
  const nombre = DESCRIPTORES_DE_PROVEEDOR[conexion.provider].nombre;
  if (!conexionOperativa(conexion) || !usaCalendarioExterno(conexion)) {
    console.warn(
      `${log.prefijo} ${log.etiqueta}: ${nombre} del negocio ${businessId} está desconectado; la cita se reserva en Alhabla y su copia espera a que lo reconecte`
    );
    return {
      ...SIN_COPIA,
      copiaEnCalendario: "pendiente",
      copiaError: "calendario desconectado",
    };
  }
  try {
    const evento = await calendarService.bookAppointment({
      ...input.evento,
      conexion,
    });
    return {
      externalEventId: evento.id,
      htmlLink: evento.htmlLink,
      copiaEnCalendario: "hecha",
      externalCalendarProvider: conexion.provider,
      externalCalendarId: conexion.calendarId,
      reintentar: false,
      copiaError: null,
    };
  } catch (error) {
    const proveedorRoto = proveedorDesdeErrorDeReconexion(error);
    if (proveedorRoto) {
      await marcarCalendarioDesconectado(
        businessId,
        proveedorRoto,
        { modo: "revocar" },
        { prefijo: log.prefijo }
      );
      return {
        ...SIN_COPIA,
        copiaEnCalendario: "pendiente",
        copiaError: "calendario desconectado",
      };
    }
    console.error(
      `${log.prefijo} ${log.etiqueta}: ${nombre} del negocio ${businessId} no aceptó la copia de la cita; la cita queda reservada en Alhabla y la copia se reintentará: ${errorMessage(error)}`
    );
    return {
      ...SIN_COPIA,
      copiaEnCalendario: "pendiente",
      reintentar: true,
      copiaError: errorMessage(error).slice(0, 500),
    };
  }
}

/** Minutos entre un intento de copia y el siguiente: unas 44 h en total. */
export const ESPERAS_ENTRE_COPIAS_MINUTOS = [1, 5, 30, 120, 360, 720, 1440];
/** A partir de este intento (≈ 36 min de copia pendiente, la regla 5 del
 * plan dice «más de una hora» con los reintentos ya en marcha) se avisa al
 * dueño, una vez al día. */
const INTENTO_QUE_AVISA = 4;

/** Encola el siguiente intento de copia. Nunca lanza (best-effort con log
 * ruidoso): si no se encola, la cita sigue reservada y el próximo volcado al
 * reconectar la recoge. */
export async function encolarCopiaDeLaCita(
  bookingId: string,
  intento = 1
): Promise<void> {
  const espera =
    ESPERAS_ENTRE_COPIAS_MINUTOS[
      Math.min(intento - 1, ESPERAS_ENTRE_COPIAS_MINUTOS.length - 1)
    ];
  try {
    await enqueueCopiaDeLaCitaJob(
      { bookingId, attempt: intento },
      `copia-de-la-cita-${bookingId}-${intento}-${Date.now()}`,
      new Date(Date.now() + espera * 60_000)
    );
  } catch (error) {
    console.error(
      `[Calendar] No se pudo encolar la copia ${intento} de la cita ${bookingId} en el calendario: queda pendiente hasta el próximo volcado: ${errorMessage(error)}`
    );
  }
}

export type ResultadoDeCopia =
  | "hecha"
  | "ya_estaba"
  | "sin_calendario"
  | "esperando_reconexion"
  | "reintentando"
  | "fallida"
  | "descartada";

/**
 * Job `copiar-cita-al-calendario`: deja el calendario conectado al día con una
 * cita pendiente. Si la cita trae un evento (se movió y su evento viejo sigue
 * en el calendario), lo borra antes de crear el nuevo. Solo lanza ante un
 * fallo inesperado de la base de datos (Cloud Tasks lo reintenta); los
 * reintentos del calendario los programa él mismo.
 */
export async function sincronizarCopiaDeLaCita(input: {
  bookingId: string;
  attempt?: number;
}): Promise<ResultadoDeCopia> {
  const intento = input.attempt ?? 1;
  const cita = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    select: {
      id: true,
      programedAt: true,
      durationMinutes: true,
      clientName: true,
      clientPhone: true,
      serviceIds: true,
      isCancelled: true,
      externalEventId: true,
      externalCalendarProvider: true,
      externalCalendarId: true,
      copiaEnCalendario: true,
      copiaIntentos: true,
      professional: { select: { name: true } },
      call: { select: { businessId: true, fromNumber: true } },
    },
  });
  if (!cita) return "descartada";
  const businessId = cita.call.businessId;
  const etiqueta = `copia de la cita ${cita.id}`;
  if (cita.copiaEnCalendario !== "pendiente") return "ya_estaba";
  if (cita.isCancelled) {
    // Cancelar ya borra el evento que tuviera (bookings/cancelacion.ts).
    await prisma.booking.update({
      where: { id: cita.id },
      data: { copiaEnCalendario: null, copiaError: null },
    });
    return "descartada";
  }
  const fin = new Date(
    cita.programedAt.getTime() + (cita.durationMinutes || 30) * 60_000
  );
  if (fin.getTime() < Date.now()) {
    console.warn(
      `[Calendar] ${etiqueta} (negocio ${businessId}): la cita ya pasó sin llegar a copiarse en el calendario; se deja como fallida`
    );
    await prisma.booking.update({
      where: { id: cita.id },
      data: {
        copiaEnCalendario: "fallida",
        copiaError: "la cita pasó sin copiarse",
      },
    });
    return "fallida";
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { ...SELECT_CONEXION_DE_CALENDARIO, timezone: true },
  });
  const conexion = resolverConexionDeCalendario(business);
  if (!tieneCalendarioConectado(conexion)) {
    // Quitó el calendario: ya no hay dónde copiarla.
    await prisma.booking.update({
      where: { id: cita.id },
      data: { copiaEnCalendario: null, copiaError: null },
    });
    return "sin_calendario";
  }
  if (!conexionOperativa(conexion) || !usaCalendarioExterno(conexion)) {
    // No se gasta un intento: el volcado al reconectar la recoge.
    return "esperando_reconexion";
  }

  try {
    // 1. El evento viejo de una cita movida, contra el calendario donde vive.
    if (cita.externalEventId) {
      const proveedorViejo = normalizarProveedorDeCalendario(
        cita.externalCalendarProvider ?? conexion.provider
      );
      const conexionVieja = resolverConexionDeCalendario(business, {
        provider: proveedorViejo,
        calendarId: cita.externalCalendarId || undefined,
      });
      if (conexionOperativa(conexionVieja)) {
        const borrado = await calendarService.cancelAppointment({
          conexion: conexionVieja,
          eventId: cita.externalEventId,
          // La hora vieja no se conoce: la ventana es la de ahora, que
          // solo usa CalDAV para buscar por UID si no está en su sitio.
          ventana: ventanaDeLaCita(cita.programedAt, cita.durationMinutes),
        });
        registrarBorradoDeEvento({
          prefijo: "[Calendar]",
          etiqueta,
          businessId,
          bookingId: cita.id,
          proveedor: proveedorViejo,
          eventId: cita.externalEventId,
          resultado: borrado,
        });
      } else {
        console.warn(
          `[Calendar] ${etiqueta} (negocio ${businessId}): el evento viejo ${cita.externalEventId} está en ${proveedorViejo}, que ya no está conectado; se crea el nuevo sin borrarlo`
        );
      }
      await prisma.booking.update({
        where: { id: cita.id },
        data: {
          externalEventId: null,
          externalCalendarProvider: null,
          externalCalendarId: null,
        },
      });
    }

    // 2. El evento de la cita tal como está ahora.
    const nombresDeServicios = await nombresDeLosServicios(
      businessId,
      cita.serviceIds
    );
    const telefono =
      cita.clientPhone ??
      (cita.call.fromNumber && isValidE164Phone(cita.call.fromNumber)
        ? cita.call.fromNumber
        : null);
    const evento = await calendarService.bookAppointment({
      conexion,
      clientName: cita.clientName?.trim() || "Cliente",
      startDateTime: cita.programedAt.toISOString(),
      durationMinutes: cita.durationMinutes,
      clientPhone: telefono,
      serviceNames: nombresDeServicios,
      professionalName: cita.professional?.name ?? null,
      timezone: business?.timezone || "Europe/Madrid",
      // Estable entre reintentos de la misma copia: un timeout después de
      // crear el evento no lo duplica.
      idempotencyKey: `copia:${cita.id}:${cita.programedAt.getTime()}:${cita.durationMinutes}`,
    });
    await prisma.booking.update({
      where: { id: cita.id },
      data: {
        externalEventId: evento.id,
        externalCalendarProvider: conexion.provider,
        externalCalendarId: conexion.calendarId,
        copiaEnCalendario: "hecha",
        copiaError: null,
      },
    });
    console.log(
      `[Calendar] ${etiqueta} (negocio ${businessId}): copiada en ${DESCRIPTORES_DE_PROVEEDOR[conexion.provider].nombre} al intento ${intento}`
    );
    return "hecha";
  } catch (error) {
    const proveedorRoto = proveedorDesdeErrorDeReconexion(error);
    if (proveedorRoto) {
      await marcarCalendarioDesconectado(
        businessId,
        proveedorRoto,
        { modo: "revocar" },
        { prefijo: "[Calendar]" }
      );
      return "esperando_reconexion";
    }
    const motivo = errorMessage(error).slice(0, 500);
    const agotada = intento >= ESPERAS_ENTRE_COPIAS_MINUTOS.length;
    await prisma.booking.update({
      where: { id: cita.id },
      data: {
        copiaIntentos: { increment: 1 },
        copiaError: motivo,
        ...(agotada ? { copiaEnCalendario: "fallida" } : {}),
      },
    });
    if (agotada) {
      console.error(
        `[Calendar] ${etiqueta} (negocio ${businessId}): COPIA FALLIDA tras ${intento} intentos; la cita está reservada en Alhabla pero no en el calendario ${conexion.provider}: ${motivo}`
      );
      return "fallida";
    }
    console.warn(
      `[Calendar] ${etiqueta} (negocio ${businessId}): el intento ${intento} de copia falló; se reintenta: ${motivo}`
    );
    if (intento === INTENTO_QUE_AVISA) {
      const { alertarCopiasPendientes } =
        await import("../whatsapp/alertas.js");
      await alertarCopiasPendientes({
        businessId,
        proveedor: DESCRIPTORES_DE_PROVEEDOR[conexion.provider].nombre,
      });
    }
    await encolarCopiaDeLaCita(cita.id, intento + 1);
    return "reintentando";
  }
}

async function nombresDeLosServicios(
  businessId: string,
  serviceIds: string[]
): Promise<string[]> {
  if (serviceIds.length === 0) return [];
  const servicios = await prisma.service.findMany({
    where: { id: { in: serviceIds }, businessId },
    select: { id: true, name: true },
  });
  const porId = new Map(servicios.map((s) => [s.id, s.name]));
  return serviceIds
    .map((id) => porId.get(id))
    .filter((nombre): nombre is string => Boolean(nombre));
}

/** Cuántas citas copia una pasada del volcado (el job tiene 3 min); si hay
 * más, se encola otra pasada. */
const CITAS_POR_VOLCADO = 150;

/** Encola el volcado de la agenda al calendario recién conectado. Nunca
 * lanza. */
export async function encolarVolcadoDeLaAgenda(
  businessId: string
): Promise<void> {
  try {
    await enqueueVolcadoDeLaAgendaJob(
      { businessId },
      `volcado-de-la-agenda-${businessId}-${Date.now()}`
    );
  } catch (error) {
    console.error(
      `[Calendar] No se pudo encolar el volcado de la agenda del negocio ${businessId}: ${errorMessage(error)}`
    );
  }
}

/**
 * Job `volcar-agenda-al-calendario`: al conectar o reconectar un calendario,
 * copia en él las citas futuras que aún no tiene (sin evento, o pendientes de
 * cuando estaba caducado). Las que ya tienen evento en otro calendario se
 * dejan donde están.
 */
export async function volcarAgendaAlCalendario(input: {
  businessId: string;
}): Promise<{ copiadas: number; pendientes: number; quedan: boolean }> {
  const business = await prisma.business.findUnique({
    where: { id: input.businessId },
    select: SELECT_CONEXION_DE_CALENDARIO,
  });
  const conexion = resolverConexionDeCalendario(business);
  if (!conexionOperativa(conexion) || !usaCalendarioExterno(conexion)) {
    return { copiadas: 0, pendientes: 0, quedan: false };
  }
  const filtro = {
    call: { businessId: input.businessId },
    isCancelled: false,
    programedAt: { gte: new Date() },
    OR: [
      { externalEventId: null, copiaEnCalendario: null },
      // Las que esperaban la reconexión, y las que se dieron por perdidas:
      // con el calendario de vuelta se intentan de nuevo.
      { copiaEnCalendario: { in: ["pendiente", "fallida"] } },
    ],
  };
  const citas = await prisma.booking.findMany({
    where: filtro,
    select: { id: true },
    orderBy: { programedAt: "asc" },
    take: CITAS_POR_VOLCADO + 1,
  });
  const quedan = citas.length > CITAS_POR_VOLCADO;
  const lote = citas.slice(0, CITAS_POR_VOLCADO).map((c) => c.id);
  if (lote.length === 0) return { copiadas: 0, pendientes: 0, quedan: false };
  await prisma.booking.updateMany({
    where: { id: { in: lote } },
    data: { copiaEnCalendario: "pendiente", copiaIntentos: 0 },
  });
  let copiadas = 0;
  let pendientes = 0;
  for (const bookingId of lote) {
    const resultado = await sincronizarCopiaDeLaCita({ bookingId, attempt: 1 });
    if (resultado === "hecha") copiadas += 1;
    else if (
      resultado === "reintentando" ||
      resultado === "esperando_reconexion"
    )
      pendientes += 1;
    // Si la conexión se cae a mitad, el resto espera al próximo volcado.
    if (resultado === "esperando_reconexion") break;
  }
  console.log(
    `[Calendar] Volcado de la agenda del negocio ${input.businessId} a ${DESCRIPTORES_DE_PROVEEDOR[conexion.provider].nombre}: ${copiadas} copiadas, ${pendientes} pendientes${quedan ? ", quedan más" : ""}`
  );
  if (quedan) await encolarVolcadoDeLaAgenda(input.businessId);
  return { copiadas, pendientes, quedan };
}
