import { prisma } from "../lib/prisma.js";
import { enqueueRecuperarTranscripcionJob } from "../lib/cloudTasks.js";
import type { RecuperarTranscripcionJob } from "../lib/jobTypes.js";
import { errorMessage } from "../lib/logUtils.js";
import { guardarTranscripcionDeTelnyx } from "../adapters/telnyx/transcripcion.js";

/** Espera antes de cada intento (el primero es el 1). Telnyx puede tardar en
 * escribir los mensajes después de `call.conversation.ended` (~40 s en la
 * llamada del 24-09); el último intento queda a ~22 min de colgar. */
export const ESPERAS_RECUPERAR_TRANSCRIPCION_MS = [
  2 * 60_000,
  5 * 60_000,
  15 * 60_000,
];
export const MAX_INTENTOS_RECUPERAR_TRANSCRIPCION =
  ESPERAS_RECUPERAR_TRANSCRIPCION_MS.length;

function describir(input: {
  businessId: string;
  callRowId: string;
  conversationId: string;
}): string {
  return `negocio ${input.businessId}, llamada ${input.callRowId}, conversación ${input.conversationId}`;
}

/**
 * Programa el intento `intento` de recuperar la transcripción. Nunca lanza:
 * si no se puede encolar lo dice en voz alta, porque la transcripción se
 * pierde.
 */
export async function programarRecuperacionDeTranscripcion(input: {
  businessId: string;
  callRowId: string;
  conversationId: string;
  intento: number;
}): Promise<void> {
  const espera =
    ESPERAS_RECUPERAR_TRANSCRIPCION_MS[input.intento - 1] ??
    ESPERAS_RECUPERAR_TRANSCRIPCION_MS.at(-1)!;
  try {
    await enqueueRecuperarTranscripcionJob(
      {
        callId: input.callRowId,
        conversationId: input.conversationId,
        intento: input.intento,
      },
      new Date(Date.now() + espera)
    );
  } catch (error) {
    console.error(
      `[Telnyx] NO se pudo programar el intento ${input.intento} de recuperar la transcripción (${describir(input)}): la llamada se queda sin transcripción. ${errorMessage(error)}`
    );
  }
}

/**
 * Reintento diferido de la transcripción de una llamada de Telnyx que no
 * tenía mensajes (o cuya descarga falló) al llegar `call.conversation.ended`.
 * Si sigue sin mensajes programa el siguiente intento; tras el último lo da
 * por perdida con un log de error. Solo lanza si falla la BD, para que Cloud
 * Tasks lo repita (el guardado es un upsert: repetirlo es seguro).
 */
export async function processRecuperarTranscripcionJob(
  data: RecuperarTranscripcionJob
): Promise<void> {
  const intento = data.intento ?? 1;
  const call = await prisma.call.findUnique({
    where: { id: data.callId },
    select: {
      id: true,
      businessId: true,
      transcript: { select: { id: true } },
    },
  });
  if (!call) {
    console.warn(
      `[Telnyx] Recuperar transcripción: la llamada ${data.callId} ya no existe; se ignora`
    );
    return;
  }
  const contexto = {
    businessId: call.businessId,
    callRowId: call.id,
    conversationId: data.conversationId,
  };
  if (call.transcript) {
    console.log(
      `[Telnyx] Recuperar transcripción: ya estaba guardada (${describir(contexto)})`
    );
    return;
  }

  let guardados = 0;
  let fallo: string | null = null;
  try {
    guardados = await guardarTranscripcionDeTelnyx(
      call.id,
      data.conversationId
    );
  } catch (error) {
    fallo = errorMessage(error);
  }

  if (guardados > 0) {
    console.log(
      `[Telnyx] Transcripción recuperada en el intento ${intento} con ${guardados} mensajes (${describir(contexto)})`
    );
    return;
  }

  const motivo = fallo
    ? `la descarga falló: ${fallo}`
    : "Telnyx sigue sin mensajes";
  if (intento < MAX_INTENTOS_RECUPERAR_TRANSCRIPCION) {
    console.warn(
      `[Telnyx] Intento ${intento} de recuperar la transcripción sin éxito (${motivo}); se reintenta (${describir(contexto)})`
    );
    await programarRecuperacionDeTranscripcion({
      ...contexto,
      intento: intento + 1,
    });
    return;
  }
  console.error(
    `[Telnyx] Transcripción PERDIDA tras ${intento} intentos (${motivo}); la llamada se queda sin transcripción (${describir(contexto)})`
  );
}
