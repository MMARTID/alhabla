import { prisma } from "../../lib/prisma.js";
import { telnyxAiAdapter } from "./TelnyxAiAdapter.js";

/**
 * Descarga los mensajes de una conversación de Telnyx AI y los guarda como
 * la transcripción de la llamada (upsert: repetirlo no duplica). Devuelve
 * cuántos mensajes guardó; 0 = Telnyx todavía no tenía ninguno y no se
 * escribe nada. Lanza si falla la API de Telnyx o la BD.
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
  if (messages.length === 0) return 0;

  // `client.ai.conversations.messages.list()` devuelve del más
  // reciente al más antiguo (verificado en vivo 2026-09-12) — sin
  // reordenar, fullText queda con la conversación al revés.
  messages.sort((a, b) => {
    const timeA = Date.parse(a.sentAt ?? a.createdAt ?? "");
    const timeB = Date.parse(b.sentAt ?? b.createdAt ?? "");
    return timeA - timeB;
  });
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
