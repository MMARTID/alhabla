import { prisma } from "./prisma.js";
import { errorMessage } from "./logUtils.js";
import {
  telnyxAiAdapter,
  type TelnyxRecording,
} from "../adapters/telnyx/TelnyxAiAdapter.js";

/**
 * Grabación opcional. El saludo dice que la recepcionista es una
 * inteligencia artificial y que la llamada se graba, y ofrece no grabarla
 * (Reglamento europeo de IA, art. 50, y RGPD; decisión del usuario del
 * 2026-10-12: grabar por defecto y, si el cliente no quiere, quedarse solo
 * con la transcripción). Si quien llama lo pide, la recepcionista usa la
 * tool `no_grabar` y:
 *
 * 1. Se anota `Call.grabacionRechazadaAt`. Es lo que manda: cuando llega la
 *    grabación (`call.recording.saved` de Telnyx o el webhook de Retell) no
 *    se guarda ni se copia a R2, y processRecording tampoco la sube si ya
 *    estaba en cola.
 * 2. En Telnyx se intenta pararla en ese momento. Si no se puede, se
 *    descarta igualmente cuando llega. Retell no deja pararla a mitad de
 *    llamada.
 *
 * La transcripción, el informe final y la clasificación salen de la
 * conversación, no del audio, y siguen igual.
 */

export type ResultadoDelRechazo = "registrado" | "ya_registrado" | "sin_llamada";

export async function registrarGrabacionRechazada(input: {
  /** `Call.callId`: el call_control_id de Telnyx o el call_id de Retell. */
  callId: string;
  businessId: string;
  etiqueta: string;
}): Promise<ResultadoDelRechazo> {
  const call = await prisma.call.findFirst({
    where: { callId: input.callId, businessId: input.businessId },
    select: { id: true, voiceProvider: true, grabacionRechazadaAt: true },
  });
  if (!call) {
    console.error(
      `[Grabación] ${input.etiqueta} pidió no grabar, pero la llamada no está en la base de datos (negocio ${input.businessId}): la grabación se guardará`
    );
    return "sin_llamada";
  }
  if (call.grabacionRechazadaAt) return "ya_registrado";

  // Antes de parar nada: el `call.recording.saved` de lo grabado hasta
  // ahora puede llegar en cuanto Telnyx la pare, y tiene que encontrar la
  // marca puesta.
  await prisma.call.updateMany({
    where: { id: call.id, grabacionRechazadaAt: null },
    data: { grabacionRechazadaAt: new Date() },
  });

  if (call.voiceProvider === "telnyx") {
    try {
      await telnyxAiAdapter.stopRecording(input.callId);
      console.log(
        `[Grabación] ${input.etiqueta}: grabación parada a petición de quien llama (negocio ${input.businessId})`
      );
    } catch (error) {
      console.error(
        `[Grabación] ${input.etiqueta}: Telnyx no paró la grabación (negocio ${input.businessId}); se descartará cuando llegue: ${errorMessage(error)}`
      );
    }
  } else {
    console.log(
      `[Grabación] ${input.etiqueta}: quien llama pidió no grabar (negocio ${input.businessId}, ${call.voiceProvider}); se descartará cuando llegue`
    );
  }
  return "registrado";
}

/**
 * Borra en Telnyx las grabaciones de una llamada que no se podía grabar.
 * Un fallo se loguea con todo y no se reintenta: la fila `Recording` no se
 * llega a crear, así que el audio no aparece en el panel ni se copia a R2.
 */
export async function borrarGrabacionesDeTelnyx(input: {
  grabaciones: TelnyxRecording[];
  businessId: string;
  etiqueta: string;
}): Promise<void> {
  for (const grabacion of input.grabaciones) {
    if (!grabacion.id) continue;
    try {
      await telnyxAiAdapter.deleteRecording(grabacion.id);
    } catch (error) {
      console.error(
        `[Grabación] ${input.etiqueta}: no se pudo borrar en Telnyx la grabación ${grabacion.id} que quien llama pidió no guardar (negocio ${input.businessId}): ${errorMessage(error)}`
      );
    }
  }
  console.log(
    `[Grabación] ${input.etiqueta}: grabación descartada, quien llama pidió no grabar (negocio ${input.businessId})`
  );
}
