import { createHash } from "node:crypto";

// Claves de los mensajes al cliente (nombre de la tarea de Cloud Tasks y
// `SentMessage.idempotencyKey`). Sin dependencias: las usan
// `whatsapp/mensajesCliente.ts` y `whatsapp/service.ts` (el respaldo de la
// confirmación), que se importan entre sí.

/**
 * Huella corta del número de destino (8 hex de sha256), para que el nombre
 * de la tarea y la clave de `sent_messages` no lleven el teléfono.
 */
export function huellaDelDestino(e164: string): string {
  return createHash("sha256").update(e164).digest("hex").slice(0, 8);
}

/**
 * Clave (y taskId) de la confirmación y del recordatorio:
 * `booking-<id>-<propósito>-<epoch de la cita>-<huella del destino>`. Sin la
 * huella, corregir el teléfono en la llamada y volver a reservar a la misma
 * hora chocaba con la tarea del número viejo (`ALREADY_EXISTS`), que el job
 * descarta con DESTINO_CAMBIADO: no le llegaba nada a nadie.
 */
export function claveDeMensajeAlCliente(
  bookingId: string,
  proposito: "confirmacion" | "recordatorio",
  programedAtMs: number,
  toNumber: string
): string {
  const epoch = Math.floor(programedAtMs / 1000);
  return `booking-${bookingId}-${proposito}-${epoch}-${huellaDelDestino(toNumber)}`;
}
