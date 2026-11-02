import { prisma } from "../../lib/prisma.js";
import {
  telnyxAiAdapter,
  type TelnyxConversationMessage,
} from "./TelnyxAiAdapter.js";

/**
 * Mensaje tal como llega en `payload.messages` de `call.conversation.ended`
 * (tipo `CallConversationEnded.Payload.Message` del SDK 7.29). Con
 * `telephony_settings.conversation_ended_full_history` vienen también las
 * llamadas a tools, sus resultados (`tool`) y los avisos `system`/`developer`;
 * sin él, solo los turnos de texto de `user` y `assistant`.
 */
export interface MensajeDelFinDeConversacion {
  role?: string;
  content?: string;
  timestamp?: string;
}

/**
 * Guarda la transcripción de una llamada a partir de los mensajes que trae
 * el propio webhook `call.conversation.ended` (upsert: repetirlo no
 * duplica). Devuelve cuántos guardó; 0 = el webhook no traía ninguno y no se
 * escribe nada.
 *
 * Es la vía principal desde que los assistants guardan su copia con la
 * redacción de datos personales de Telnyx (`privacy_settings.pii_redaction`):
 * la copia de `ai.conversations.messages` sale con `<PII:name/>`,
 * `<PII:phone/>`… en vez del nombre y el teléfono del cliente, y el dueño
 * los necesita. El webhook se sirve de la conversación en memoria y llega
 * sin redactar (documentación de Telnyx y prueba por voz del 2026-11-02).
 * Además ya viene en orden y antes de que Telnyx termine de escribir su
 * copia (la carrera de la llamada cmufcsz4b0006s601kncxcf5m, 24-09).
 */
export async function guardarTranscripcionDelWebhook(
  callRowId: string,
  mensajesDelWebhook: MensajeDelFinDeConversacion[]
): Promise<number> {
  const messages: TelnyxConversationMessage[] = mensajesDelWebhook.map(
    (mensaje) => ({
      role: (mensaje.role ?? "assistant") as TelnyxConversationMessage["role"],
      // Un turno del assistant que solo llama a una tool no trae `content`;
      // la copia de la API lo da como texto vacío y se guarda igual.
      text: mensaje.content ?? "",
      createdAt: mensaje.timestamp,
      sentAt: mensaje.timestamp,
    })
  );
  return guardarMensajes(callRowId, messages);
}

/**
 * Descarga los mensajes de una conversación de Telnyx AI y los guarda como
 * la transcripción de la llamada (upsert: repetirlo no duplica). Devuelve
 * cuántos mensajes guardó; 0 = Telnyx todavía no tenía ninguno y no se
 * escribe nada. Lanza si falla la API de Telnyx o la BD.
 *
 * Solo es el respaldo para cuando `call.conversation.ended` llega sin
 * mensajes (ver `guardarTranscripcionDelWebhook`): esta copia es la que
 * Telnyx guarda, y con la redacción activada los datos personales del
 * cliente salen sustituidos por marcas `<PII:…/>`.
 *
 * Telnyx puede mandar `call.conversation.ended` antes de tener los mensajes:
 * en la llamada cmufcsz4b0006s601kncxcf5m (24-09) el evento llegó a las
 * 09:53:49 y los mensajes se escribieron entre las 09:54:01 y las 09:54:31.
 * Por eso quien la llama reintenta más tarde con 0 (jobs/recuperarTranscripcion.ts).
 */
export async function guardarTranscripcionDeTelnyx(
  callRowId: string,
  conversationId: string
): Promise<number> {
  const messages =
    await telnyxAiAdapter.listConversationMessages(conversationId);

  // `client.ai.conversations.messages.list()` devuelve del más
  // reciente al más antiguo (verificado en vivo 2026-09-12) — sin
  // reordenar, fullText queda con la conversación al revés.
  messages.sort((a, b) => {
    const timeA = Date.parse(a.sentAt ?? a.createdAt ?? "");
    const timeB = Date.parse(b.sentAt ?? b.createdAt ?? "");
    return timeA - timeB;
  });
  return guardarMensajes(callRowId, messages);
}

async function guardarMensajes(
  callRowId: string,
  messages: TelnyxConversationMessage[]
): Promise<number> {
  if (messages.length === 0) return 0;

  const fullText = messages
    .map((message) => `${message.role}: ${message.text}`)
    .join("\n");
  // Objeto plano: TelnyxConversationMessage con campos opcionales no
  // encaja en el tipo JSON estructural que exige Prisma.
  const jsonMessages = messages.map((message) => ({
    role: message.role,
    text: message.text,
    createdAt: message.createdAt ?? null,
    sentAt: message.sentAt ?? null,
  }));
  await prisma.transcript.upsert({
    where: { callId: callRowId },
    create: { callId: callRowId, fullText, messages: jsonMessages },
    update: { fullText, messages: jsonMessages },
  });
  return messages.length;
}
