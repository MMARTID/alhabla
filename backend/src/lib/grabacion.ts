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
 *   mientras comprueba la disponibilidad de lo que le piden: la pregunta va
 *   en la respuesta de check_availability (`tocaPreguntarPorGrabar`) y, con
 *   su sí, la tool `preferencia_de_grabacion` empieza a grabar en ese
 *   momento.
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

/** Los teléfonos del propio negocio, que nunca son un cliente. */
export interface TelefonosDelNegocio {
  phone?: string | null;
  telnyxPhoneNumber?: string | null;
  ownerWhatsappNumber?: string | null;
}

/**
 * Un teléfono con el que recordar al cliente: E.164, no «anonymous», y que
 * no sea del propio negocio. Con algunos desvíos la operadora presenta como
 * llamante la línea del negocio (esLlamadaDeComprobacionDeDesvio lo
 * contempla): sin esta exclusión todos sus clientes acabarían en una sola
 * ficha, con el mismo nombre, idioma y permiso de grabar.
 */
export function telefonoDelCliente(
  telefono: string | null | undefined,
  negocio: TelefonosDelNegocio = {}
): string | null {
  if (!telefono || !/^\+\d{6,15}$/.test(telefono)) return null;
  const propios = [
    negocio.phone,
    negocio.telnyxPhoneNumber,
    negocio.ownerWhatsappNumber,
  ];
  return propios.includes(telefono) ? null : telefono;
}

/**
 * ¿Toca pedirle permiso para grabar ahora? Lo decide el backend, no el
 * modelo: con la regla en el prompt («si {{grabacion}} es sin_preguntar,
 * pregúntalo») volvía a preguntar aunque el cliente ya lo hubiera aceptado
 * (4 de 4 llamadas de prueba del 14-10). Una sola vez por llamada y solo a
 * quien no lo ha decidido: ni se graba ya, ni lo ha rechazado en esta
 * llamada o en otra. Con true queda anotado (`grabacionPreguntadaAt`), de
 * forma atómica: dos tools a la vez no lo preguntan dos veces.
 *
 * Si algo falla no se pregunta (se le preguntará en otra llamada) y se dice
 * en el log.
 */
export async function tocaPreguntarPorGrabar(input: {
  /** `Call.callId`: el call_control_id de Telnyx o el call_id de Retell. */
  callId: string;
  businessId: string;
  etiqueta: string;
}): Promise<boolean> {
  try {
    const call = await prisma.call.findFirst({
      where: { callId: input.callId, businessId: input.businessId },
      select: {
        id: true,
        fromNumber: true,
        grabacionPermitida: true,
        grabacionRechazadaAt: true,
        grabacionPreguntadaAt: true,
        business: {
          select: { phone: true, telnyxPhoneNumber: true, ownerWhatsappNumber: true },
        },
      },
    });
    if (!call) {
      console.error(
        `[Grabación] ${input.etiqueta}: la llamada no está en la base de datos (negocio ${input.businessId}); no se pregunta si se puede grabar`
      );
      return false;
    }
    if (
      call.grabacionPermitida === true ||
      call.grabacionRechazadaAt ||
      call.grabacionPreguntadaAt
    ) {
      return false;
    }

    const telefono = telefonoDelCliente(call.fromNumber, call.business);
    if (telefono) {
      const cliente = await prisma.clienteDelNegocio.findUnique({
        where: {
          businessId_telefono: { businessId: input.businessId, telefono },
        },
        select: { grabacionAceptada: true },
      });
      if (estadoDeGrabacion(cliente?.grabacionAceptada) !== "sin_preguntar") {
        return false;
      }
    }

    // Con las mismas condiciones en el where: si entre la lectura y aquí
    // contestó (preferencia_de_grabacion), no se le vuelve a preguntar.
    const { count } = await prisma.call.updateMany({
      where: {
        id: call.id,
        grabacionPreguntadaAt: null,
        grabacionRechazadaAt: null,
        OR: [{ grabacionPermitida: null }, { grabacionPermitida: false }],
      },
      data: { grabacionPreguntadaAt: new Date() },
    });
    return count === 1;
  } catch (error) {
    console.error(
      `[Grabación] ${input.etiqueta}: no se pudo saber si toca preguntar por grabar (negocio ${input.businessId}); no se pregunta: ${errorMessage(error)}`
    );
    return false;
  }
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
 * Lo que contestó quien llama a «¿te parece bien que grabe tus llamadas?» (o que
 * pidió después que no se grabe). Se recuerda para sus próximas llamadas si
 * llama con su número; con número oculto solo vale para esta.
 *
 * Un «no» que no contesta a la pregunta, en una llamada que no se está
 * grabando, vale solo para esta llamada: en el laboratorio del 14-10 el
 * modelo llamó a la tool con acepta false 3 veces en 60 conversaciones sin
 * que nadie hablara de grabar, y eso dejaba al cliente sin grabar para
 * siempre y sin que se le volviera a preguntar. Si de verdad no quiere, lo
 * dirá cuando se le pregunte en otra llamada.
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
      grabacionPreguntadaAt: true,
      business: {
        select: { phone: true, telnyxPhoneNumber: true, ownerWhatsappNumber: true },
      },
    },
  });
  if (!call) {
    console.error(
      `[Grabación] ${input.etiqueta}: quien llama ${input.acepta ? "aceptó" : "rechazó"} que se grabe, pero la llamada no está en la base de datos (negocio ${input.businessId}); no se guarda`
    );
    return "sin_llamada";
  }

  const telefono = telefonoDelCliente(call.fromNumber, call.business);
  const noSinPregunta =
    !input.acepta &&
    !call.grabacionPreguntadaAt &&
    call.grabacionPermitida !== true;
  if (noSinPregunta) {
    console.warn(
      `[Grabación] ${input.etiqueta}: «no» a grabar sin que se le preguntara y sin grabación en curso (negocio ${input.businessId}); vale solo para esta llamada`
    );
  } else if (telefono) {
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
      `[Grabación] ${input.etiqueta}: llama con número oculto o del propio negocio; lo que ha dicho de grabar vale solo para esta llamada (negocio ${input.businessId})`
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
  /** Por qué se descarta, para el log. */
  motivo?: string;
}): Promise<void> {
  const motivo = input.motivo ?? "quien llama pidió no grabar";
  for (const grabacion of input.grabaciones) {
    if (!grabacion.id) continue;
    try {
      await telnyxAiAdapter.deleteRecording(grabacion.id);
    } catch (error) {
      console.error(
        `[Grabación] ${input.etiqueta}: no se pudo borrar en Telnyx la grabación ${grabacion.id} (${motivo}, negocio ${input.businessId}): ${errorMessage(error)}`
      );
    }
  }
  console.log(
    `[Grabación] ${input.etiqueta}: grabación descartada, ${motivo} (negocio ${input.businessId})`
  );
}
