import { prisma } from "./prisma.js";
import { errorMessage } from "./logUtils.js";
import {
  telnyxAiAdapter,
  type TelnyxRecording,
} from "../adapters/telnyx/TelnyxAiAdapter.js";

/**
 * Grabación con permiso (decisiones del usuario del 2026-10-12 y 13-10): las
 * llamadas solo se graban si quien llama lo ha aceptado, y el permiso se
 * recuerda por negocio y teléfono (`ClienteDelNegocio`). La transcripción, el
 * informe final y la clasificación salen de la conversación, no del audio,
 * y se guardan siempre.
 *
 * - Sin decidir: no se graba al contestar. La recepcionista lo pregunta
 *   mientras comprueba el primer servicio que le piden (prompt, «##
 *   Grabación») y, con su sí, la tool `preferencia_de_grabacion` empieza a
 *   grabar en ese momento.
 * - Ya lo aceptó: se graba desde que se contesta y el saludo lo avisa
 *   (lib/contextoDeLlamada.ts).
 * - Dice que no, en cualquier momento: se para, lo grabado se descarta al
 *   llegar y no se le vuelve a preguntar.
 *
 * Retell, el respaldo, graba siempre por su cuenta y no deja empezar ni
 * parar a mitad de llamada: su audio no se guarda nunca (webhooks de
 * Retell). El permiso que dé ahí sí vale para sus llamadas por Telnyx.
 */

export type EstadoDeGrabacion = "aceptada" | "rechazada" | "sin_preguntar";

export function estadoDeGrabacion(
  aceptada: boolean | null | undefined
): EstadoDeGrabacion {
  if (aceptada === true) return "aceptada";
  if (aceptada === false) return "rechazada";
  return "sin_preguntar";
}

/** Un teléfono con el que recordar al cliente: E.164, no «anonymous». */
export function telefonoDelCliente(
  telefono: string | null | undefined
): string | null {
  return telefono && /^\+\d{6,15}$/.test(telefono) ? telefono : null;
}

type LlamadaParaGrabar = {
  id: string;
  callId: string;
  voiceProvider: string;
  grabacionPermitida: boolean | null;
  grabacionRechazadaAt: Date | null;
};

export type ResultadoDeLaPreferencia = "aceptada" | "rechazada" | "sin_llamada";

/**
 * Lo que contestó quien llama a «¿te importa que grabe la llamada?» (o que
 * pidió después que no se grabe). Se recuerda para sus próximas llamadas si
 * llama con su número; con número oculto solo vale para esta.
 */
export async function guardarPreferenciaDeGrabacion(input: {
  /** `Call.callId`: el call_control_id de Telnyx o el call_id de Retell. */
  callId: string;
  businessId: string;
  acepta: boolean;
  etiqueta: string;
}): Promise<ResultadoDeLaPreferencia> {
  const call = await prisma.call.findFirst({
    where: { callId: input.callId, businessId: input.businessId },
    select: {
      id: true,
      callId: true,
      fromNumber: true,
      voiceProvider: true,
      grabacionPermitida: true,
      grabacionRechazadaAt: true,
    },
  });
  if (!call) {
    console.error(
      `[Grabación] ${input.etiqueta}: quien llama ${input.acepta ? "aceptó" : "rechazó"} que se grabe, pero la llamada no está en la base de datos (negocio ${input.businessId}); no se guarda`
    );
    return "sin_llamada";
  }

  const telefono = telefonoDelCliente(call.fromNumber);
  if (telefono) {
    const decision = {
      grabacionAceptada: input.acepta,
      grabacionDecididaAt: new Date(),
      grabacionCallId: input.callId,
    };
    await prisma.clienteDelNegocio.upsert({
      where: {
        businessId_telefono: { businessId: input.businessId, telefono },
      },
      create: { businessId: input.businessId, telefono, ...decision },
      update: decision,
    });
  } else {
    console.log(
      `[Grabación] ${input.etiqueta}: llama con número oculto; lo que ha dicho de grabar vale solo para esta llamada (negocio ${input.businessId})`
    );
  }

  if (input.acepta) {
    await empezarAGrabar(call, input);
    return "aceptada";
  }
  await dejarDeGrabar(call, input);
  return "rechazada";
}

async function empezarAGrabar(
  call: LlamadaParaGrabar,
  input: { businessId: string; etiqueta: string }
): Promise<void> {
  if (call.voiceProvider !== "telnyx") {
    console.log(
      `[Grabación] ${input.etiqueta}: quien llama acepta que se grabe; en ${call.voiceProvider} no se guarda el audio, valdrá para sus próximas llamadas (negocio ${input.businessId})`
    );
    return;
  }
  // Ya grabando (aceptó en una llamada anterior) o pidió antes, en esta
  // misma llamada, que no se grabara: lo de esta llamada se descarta igual.
  if (call.grabacionPermitida === true || call.grabacionRechazadaAt) return;

  await prisma.call.update({
    where: { id: call.id },
    data: { grabacionPermitida: true },
  });
  try {
    await telnyxAiAdapter.startRecording(call.callId);
    console.log(
      `[Grabación] ${input.etiqueta}: grabando desde ahora, quien llama lo ha aceptado (negocio ${input.businessId})`
    );
  } catch (error) {
    console.error(
      `[Grabación] ${input.etiqueta}: Telnyx no empezó a grabar aunque quien llama lo aceptó (negocio ${input.businessId}); sus próximas llamadas sí se grabarán: ${errorMessage(error)}`
    );
  }
}

async function dejarDeGrabar(
  call: LlamadaParaGrabar,
  input: { businessId: string; etiqueta: string }
): Promise<void> {
  if (call.grabacionRechazadaAt) return;

  // Antes de parar nada: el `call.recording.saved` de lo grabado hasta
  // ahora puede llegar en cuanto Telnyx la pare, y tiene que encontrar la
  // marca puesta.
  await prisma.call.updateMany({
    where: { id: call.id, grabacionRechazadaAt: null },
    data: { grabacionRechazadaAt: new Date() },
  });

  // Sin grabación en curso no hay nada que parar (y record_stop daría un
  // error que no lo es). Null: llamada anterior a la grabación con permiso,
  // la grababa el assistant.
  if (call.voiceProvider !== "telnyx" || call.grabacionPermitida === false) {
    console.log(
      `[Grabación] ${input.etiqueta}: quien llama no quiere que se grabe (negocio ${input.businessId}, ${call.voiceProvider}); no se guardará audio`
    );
    return;
  }
  try {
    await telnyxAiAdapter.stopRecording(call.callId);
    console.log(
      `[Grabación] ${input.etiqueta}: grabación parada a petición de quien llama (negocio ${input.businessId})`
    );
  } catch (error) {
    console.error(
      `[Grabación] ${input.etiqueta}: Telnyx no paró la grabación (negocio ${input.businessId}); se descartará cuando llegue: ${errorMessage(error)}`
    );
  }
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
