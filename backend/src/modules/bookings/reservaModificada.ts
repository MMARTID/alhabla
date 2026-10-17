import { prisma } from "../../lib/prisma.js";
import { errorMessage } from "../../lib/logUtils.js";
import { cancelarReserva } from "./cancelacion.js";

/**
 * Cambiar una cita por teléfono o por WhatsApp deja dos reservas: la nueva
 * cuelga de la conversación que la cambió y la vieja queda cancelada en la
 * conversación original, que en el panel se quedaba sin etiqueta como si no
 * hubiera conseguido nada. Se enlazan (`rescheduledToId`) y el panel la
 * muestra como «Reserva modificada».
 *
 * Desde la auditoría del 16-10 la recepcionista reserva primero la nueva
 * (`check_availability` con `replacesBookingId`) y la vieja se anula solo si
 * la nueva quedó guardada (anularLaCitaCambiada): antes cancelaba y luego
 * reservaba, y si la reserva fallaba el cliente se quedaba sin ninguna (chat
 * real del 13-10). Los otros dos órdenes se siguen enlazando por si la
 * recepcionista no pasa el id: cancelar y luego reservar
 * (enlazarReservaModificada, desde book_appointment) y reservar y luego
 * cancelar (enlazarConLaReservaNueva, desde cancel_appointment).
 */

/**
 * Tras crear la reserva nueva, busca la que ese mismo cliente acaba de
 * cancelar en esta conversación y la enlaza. Solo enlaza cancelaciones
 * hechas por el cliente en esta misma conversación (desde que empezó la
 * llamada/chat) y del mismo cliente: por teléfono de la reserva o por número
 * desde el que llama. Mejor no enlazar que enlazar la cita de otra persona.
 */
export async function enlazarReservaModificada(params: {
  businessId: string;
  nuevaReservaId: string;
  conversacion: { id: string; startedAt: Date; fromNumber: string | null };
  clientPhone?: string | null;
}): Promise<string | null> {
  const telefonos = [params.clientPhone, params.conversacion.fromNumber].filter(
    (t): t is string => Boolean(t)
  );
  if (telefonos.length === 0) return null;

  const cancelada = await prisma.booking.findFirst({
    where: {
      id: { not: params.nuevaReservaId },
      call: { businessId: params.businessId },
      isCancelled: true,
      cancelledBy: { in: ["client_voice", "client_chat"] },
      cancelledAt: { gte: params.conversacion.startedAt },
      rescheduledToId: null,
      OR: [
        { clientPhone: { in: telefonos } },
        { clientPhone: null, call: { fromNumber: { in: telefonos } } },
      ],
    },
    orderBy: { cancelledAt: "desc" },
    select: { id: true },
  });
  if (!cancelada) return null;

  await prisma.booking.update({
    where: { id: cancelada.id },
    data: { rescheduledToId: params.nuevaReservaId },
  });
  console.log(
    `[Booking] reserva ${cancelada.id} marcada como modificada → ${params.nuevaReservaId} (conversación ${params.conversacion.id})`
  );
  return cancelada.id;
}

/**
 * Tras cancelar una cita en una conversación que ya tiene su reserva (la
 * recepcionista reservó la nueva y luego canceló la vieja con
 * cancel_appointment), la enlaza con esa reserva. La de esta conversación es
 * única (Booking es 1:1 con Call) y la cancelada ya pasó la comprobación de
 * titularidad por número.
 */
export async function enlazarConLaReservaNueva(params: {
  canceladaId: string;
  conversacion: { id: string };
}): Promise<string | null> {
  const nueva = await prisma.booking.findUnique({
    where: { callId: params.conversacion.id },
    select: { id: true, isCancelled: true },
  });
  if (!nueva || nueva.isCancelled || nueva.id === params.canceladaId) {
    return null;
  }

  const { count } = await prisma.booking.updateMany({
    where: { id: params.canceladaId, rescheduledToId: null },
    data: { rescheduledToId: nueva.id },
  });
  if (count === 0) return null;
  console.log(
    `[Booking] reserva ${params.canceladaId} marcada como modificada → ${nueva.id} (conversación ${params.conversacion.id})`
  );
  return nueva.id;
}

/**
 * La cita que el cliente cambia, una vez guardada la nueva: se cancela
 * (cancelarReserva: evento externo, aviso #4 al dueño y lista de espera) y
 * se enlaza con la nueva. Si son la misma fila (la cita era de esta misma
 * conversación y book_appointment ya la movió de hora), no hay nada que
 * anular. Nunca lanza: devuelve `"error"` con el motivo en el log, y quien
 * llama decide qué decirle al cliente (su cita nueva ya está guardada).
 */
export async function anularLaCitaCambiada(input: {
  businessId: string;
  citaAnteriorId: string;
  nuevaReservaId: string;
  cancelledBy: "client_voice" | "client_chat";
  /** Para los logs («llamada …», «lead …»). */
  etiqueta: string;
}): Promise<"anulada" | "error"> {
  if (input.citaAnteriorId === input.nuevaReservaId) return "anulada";

  let resultado: Awaited<ReturnType<typeof cancelarReserva>>["resultado"];
  try {
    ({ resultado } = await cancelarReserva({
      bookingId: input.citaAnteriorId,
      businessId: input.businessId,
      cancelledBy: input.cancelledBy,
      etiqueta: input.etiqueta,
    }));
  } catch (error) {
    console.error(
      `[Booking] ${input.etiqueta}: la cita nueva ${input.nuevaReservaId} del negocio ${input.businessId} quedó reservada pero no se pudo anular la que cambia (${input.citaAnteriorId}); el cliente tiene las dos: ${errorMessage(error)}`
    );
    return "error";
  }
  if (resultado === "no_encontrada") {
    console.warn(
      `[Booking] ${input.etiqueta}: la cita que cambia (${input.citaAnteriorId}) ya no existe en el negocio ${input.businessId}; la nueva ${input.nuevaReservaId} queda sola`
    );
    return "anulada";
  }

  try {
    await prisma.booking.updateMany({
      where: { id: input.citaAnteriorId, rescheduledToId: null },
      data: { rescheduledToId: input.nuevaReservaId },
    });
    console.log(
      `[Booking] ${input.etiqueta}: cita ${input.citaAnteriorId} ${resultado === "cancelada" ? "anulada" : "ya estaba cancelada"} y marcada como modificada → ${input.nuevaReservaId}`
    );
  } catch (error) {
    // La cita vieja ya está cancelada: solo falta la etiqueta del panel.
    console.error(
      `[Booking] ${input.etiqueta}: cita ${input.citaAnteriorId} anulada pero sin enlazar con la nueva ${input.nuevaReservaId} (el panel la verá como cancelada): ${errorMessage(error)}`
    );
  }
  return "anulada";
}
