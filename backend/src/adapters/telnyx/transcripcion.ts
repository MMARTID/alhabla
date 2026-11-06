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
/** Para una llamada con más de una conversación (lib/cambioDeIdioma.ts):
 * los mensajes con los que se arrancó un assistant después del primero, que
 * su conversación trae repetidos al principio. */
export interface OpcionesDeGuardado {
  sembrados?: ReadonlyArray<{ role: string; content: string }>;
}

export async function guardarTranscripcionDelWebhook(
  callRowId: string,
  mensajesDelWebhook: MensajeDelFinDeConversacion[],
  opciones: OpcionesDeGuardado = {}
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
  return guardarMensajes(callRowId, messages, opciones);
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
  conversationId: string,
  opciones: OpcionesDeGuardado = {}
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
  return guardarMensajes(callRowId, messages, opciones);
}

type MensajeGuardado = {
  role: string;
  text: string;
  createdAt: string | null;
  sentAt: string | null;
};

/** Los sembrados, en orden, desde el principio: un mensaje que coincide
 * con el siguiente sembrado es la copia; los demás se quedan (un «sí» que se
 * repite más tarde no se pierde). */
function sinLosSembrados(
  messages: TelnyxConversationMessage[],
  sembrados: OpcionesDeGuardado["sembrados"]
): TelnyxConversationMessage[] {
  if (!sembrados?.length) return messages;
  let siguiente = 0;
  return messages.filter((message) => {
    const sembrado = sembrados[siguiente];
    if (
      sembrado &&
      sembrado.role === message.role &&
      sembrado.content.trim() === message.text.trim()
    ) {
      siguiente++;
      return false;
    }
    return true;
  });
}

function momento(message: MensajeGuardado): number {
  return Date.parse(message.sentAt ?? message.createdAt ?? "");
}

/**
 * Guarda los mensajes de una conversación junto a los que ya tenga la
 * llamada: con un cambio de idioma hay una conversación por assistant y
 * cada una llega en su `call.conversation.ended`. Los ya guardados (el
 * mismo webhook repetido) no se duplican, y todo queda en orden de hora.
 */
async function guardarMensajes(
  callRowId: string,
  recibidos: TelnyxConversationMessage[],
  opciones: OpcionesDeGuardado = {}
): Promise<number> {
  if (recibidos.length === 0) return 0;

  const anterior = await prisma.transcript.findUnique({
    where: { callId: callRowId },
    select: { messages: true },
  });
  const previos = Array.isArray(anterior?.messages)
    ? (anterior.messages as unknown as MensajeGuardado[])
    : [];
  const clave = (message: MensajeGuardado) =>
    `${message.role}|${message.text}|${message.sentAt ?? message.createdAt ?? ""}`;
  const yaGuardados = new Set(previos.map(clave));
  // Objeto plano: TelnyxConversationMessage con campos opcionales no
  // encaja en el tipo JSON estructural que exige Prisma.
  const nuevos: MensajeGuardado[] = sinLosSembrados(
    recibidos,
    opciones.sembrados
  )
    .map((message) => ({
      role: message.role,
      text: message.text,
      createdAt: message.createdAt ?? null,
      sentAt: message.sentAt ?? null,
    }))
    .filter((message) => !yaGuardados.has(clave(message)));
  let jsonMessages = [...previos, ...nuevos];
  // En orden de hora si todos la traen (los de dos conversaciones se
  // intercalan bien); si no, como llegaron.
  if (
    previos.length > 0 &&
    nuevos.length > 0 &&
    jsonMessages.every((message) => !Number.isNaN(momento(message)))
  ) {
    jsonMessages = jsonMessages
      .map((message, indice) => ({ message, indice }))
      .sort(
        (a, b) => momento(a.message) - momento(b.message) || a.indice - b.indice
      )
      .map(({ message }) => message);
  }
  const fullText = jsonMessages
    .map((message) => `${message.role}: ${message.text}`)
    .join("\n");
  await prisma.transcript.upsert({
    where: { callId: callRowId },
    create: { callId: callRowId, fullText, messages: jsonMessages },
    update: { fullText, messages: jsonMessages },
  });
  return recibidos.length;
}
