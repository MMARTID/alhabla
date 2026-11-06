/**
 * Cambiar de assistant a mitad de llamada según el idioma (desde el
 * 2026-11-06; laboratorio en scripts/laboratorioCambioDeIdioma.ts).
 *
 * En una zona cooficial (lib/idiomas/zona.ts) la llamada empieza en el
 * assistant de siempre, con flux y la voz Ultra: contesta en 0,5–0,7 s por
 * turno, frente a los 2–4 s de Soniox, que es lo que tenían antes todas las
 * llamadas de esos negocios. Si quien llama habla la lengua de la zona, que
 * flux no entiende ni la voz Ultra habla, el modelo llama a la tool
 * `cambiar_de_idioma` y aquí se para ese assistant y se arranca, en la misma
 * llamada, el de la lengua (Soniox y Marta o Sergio,
 * `Agent.telnyxCooficialAssistantId`). Es una conversación nueva de Telnyx:
 * el traspaso nativo (tool `handoff`) no se usa porque no deja cambiar la
 * transcripción, y cambiarla en un nodo hacía que Telnyx dejara de guardar
 * los mensajes del cliente (14-10).
 *
 * Lo que arregla de lo medido en el laboratorio del 06-11:
 * - El assistant de flux seguía llamando a get_catalog y check_availability
 *   después de la tool: ahora se para DENTRO de la tool, antes de
 *   contestarle, así que no tiene otro turno.
 * - El cambio tardaba 9–12 s y el nuevo, con solo el saludo en el historial,
 *   esperaba a que el cliente repitiera lo que había pedido. Ahora la tool
 *   trae lo que dijo (bien escrito en su lengua) y la respuesta que le daría
 *   el de flux, y el nuevo arranca diciéndola, con lo pedido en el
 *   historial. El historial y el contexto se leen mientras se para.
 * - stopAIAssistant dio un 500: se reintenta una vez; si sigue fallando, el
 *   de flux sigue en castellano. Si el de la lengua no arranca, vuelve el de
 *   flux con lo hablado.
 *
 * Con dos conversaciones, la Call cuenta cuántos assistants se arrancaron
 * (`assistantsArrancados`) para que handleCallConversationEnded junte las
 * transcripciones y pida un solo informe, al terminar la última.
 */
import { prisma } from "./prisma.js";
import { telnyxAiAdapter } from "../adapters/telnyx/TelnyxAiAdapter.js";
import { esFalloTransitorioDeTelnyx } from "../adapters/telnyx/contestarLlamada.js";
import { callLabel, errorMessage } from "./logUtils.js";
import { IDIOMAS } from "./idiomas/catalogo.js";
import { cooficialDeLaZona } from "./idiomas/zona.js";
import { LENGUAS_CON_ASSISTANT_PROPIO } from "./telnyxAssistantPayload.js";
import { resolverContextoDeLlamada } from "./contextoDeLlamada.js";
import { guardarClave, leerClave } from "./almacenTemporal.js";
import { pedirInformeDeLlamada } from "../jobs/informeDeLlamada.js";

export type LenguaConAssistantPropio =
  (typeof LENGUAS_CON_ASSISTANT_PROPIO)[number];

export function esLenguaConAssistantPropio(
  valor: unknown
): valor is LenguaConAssistantPropio {
  return (
    typeof valor === "string" &&
    (LENGUAS_CON_ASSISTANT_PROPIO as readonly string[]).includes(valor)
  );
}

export type MensajeDelHistorial = {
  role: "user" | "assistant";
  content: string;
};

/** Lo que espera la lectura del historial y del contexto mientras se para
 * el assistant: más vale arrancar sin ellos que alargar el silencio. */
const ESPERA_MAXIMA_DE_LECTURA_MS = 2000;
const ESPERA_ANTES_DE_REPETIR_LA_PARADA_MS = 300;
/** Lo que vive la lista de mensajes sembrados (una llamada dura como mucho
 * 10 minutos; el fin de la última conversación puede llegar algo después). */
const VIDA_DE_LOS_SEMBRADOS_MS = 2 * 60 * 60 * 1000;
const LARGO_MAXIMO_DE_LA_RESPUESTA = 400;

function claveDeSembrados(callRowId: string): string {
  return `cambio-de-idioma:sembrados:${callRowId}`;
}

/** Los mensajes con los que se arrancó un assistant después del primero:
 * su conversación los trae al principio, repetidos, y la transcripción no
 * debe duplicarlos (adapters/telnyx/transcripcion.ts). */
export async function mensajesSembrados(
  callRowId: string
): Promise<MensajeDelHistorial[]> {
  try {
    const valor = await leerClave(claveDeSembrados(callRowId));
    return valor ? (JSON.parse(valor) as MensajeDelHistorial[]) : [];
  } catch (error) {
    console.error(
      `[CambioDeIdioma] No se pudieron leer los mensajes sembrados de la llamada ${callRowId}; la transcripción puede salir con lo hablado repetido: ${errorMessage(error)}`
    );
    return [];
  }
}

async function guardarSembrados(
  callRowId: string,
  businessId: string,
  mensajes: MensajeDelHistorial[]
): Promise<void> {
  const anteriores = await mensajesSembrados(callRowId);
  try {
    await guardarClave(
      claveDeSembrados(callRowId),
      JSON.stringify([...anteriores, ...mensajes]),
      VIDA_DE_LOS_SEMBRADOS_MS,
      { businessId }
    );
  } catch (error) {
    console.error(
      `[CambioDeIdioma] No se pudieron guardar los mensajes sembrados de la llamada ${callRowId} (negocio ${businessId}); la transcripción saldrá con lo hablado repetido: ${errorMessage(error)}`
    );
  }
}

/**
 * Lo hablado para el assistant nuevo: lo que guardó Telnyx (sin tools ni
 * avisos) o, si aún no tiene nada, el saludo; y al final lo que acaba de
 * decir quien llama, bien escrito por el modelo, en vez de lo que entendió
 * flux (deformado: «Vuldemanar hora por tallarme el Skabels»).
 */
export function historialParaElNuevo(input: {
  copia: MensajeDelHistorial[];
  saludo: string | null;
  loQueDice: string | null;
}): MensajeDelHistorial[] {
  const historial = input.copia.filter((mensaje) => mensaje.content.trim());
  if (historial.length === 0 && input.saludo) {
    historial.push({ role: "assistant", content: input.saludo });
  }
  if (input.loQueDice) {
    while (historial.at(-1)?.role === "user") historial.pop();
    historial.push({ role: "user", content: input.loQueDice });
  }
  return historial;
}

/** Lo que guardó Telnyx de las conversaciones de la llamada, en orden. */
async function leerLoHablado(
  callControlId: string
): Promise<MensajeDelHistorial[]> {
  const conversaciones =
    await telnyxAiAdapter.conversacionesDeLaLlamada(callControlId);
  const mensajes: Array<MensajeDelHistorial & { cuando: string }> = [];
  for (const conversacion of conversaciones) {
    for (const mensaje of await telnyxAiAdapter.listConversationMessages(
      conversacion.id
    )) {
      if (
        (mensaje.role === "user" || mensaje.role === "assistant") &&
        mensaje.text.trim()
      ) {
        mensajes.push({
          role: mensaje.role,
          content: mensaje.text,
          cuando: mensaje.sentAt ?? mensaje.createdAt ?? "",
        });
      }
    }
  }
  return mensajes
    .sort((a, b) => a.cuando.localeCompare(b.cuando))
    .map(({ role, content }) => ({ role, content }));
}

/** La promesa, o `alternativa` si tarda más de `ms` o falla. */
async function conTope<T>(
  promesa: Promise<T>,
  ms: number,
  alternativa: T,
  queEs: string,
  etiqueta: string
): Promise<T> {
  let temporizador: NodeJS.Timeout | undefined;
  const tope = new Promise<T>((resolve) => {
    temporizador = setTimeout(() => {
      console.warn(
        `[CambioDeIdioma] ${etiqueta}: ${queEs} tardó más de ${ms} ms; se arranca sin ello`
      );
      resolve(alternativa);
    }, ms);
  });
  try {
    return await Promise.race([
      promesa.catch((error) => {
        console.error(
          `[CambioDeIdioma] ${etiqueta}: no se pudo leer ${queEs}; se arranca sin ello: ${errorMessage(error)}`
        );
        return alternativa;
      }),
      tope,
    ]);
  } finally {
    clearTimeout(temporizador);
  }
}

function textoDe(valor: unknown, largo: number): string | null {
  if (typeof valor !== "string") return null;
  const texto = valor.replace(/\s+/g, " ").trim();
  return texto ? texto.slice(0, largo) : null;
}

/** Para el assistant de la llamada, con un reintento si Telnyx falla de
 * forma pasajera (el 500 del laboratorio). */
async function pararConUnReintento(callControlId: string): Promise<void> {
  try {
    await telnyxAiAdapter.stopAssistantOnCall(callControlId);
  } catch (error) {
    if (!esFalloTransitorioDeTelnyx(error)) throw error;
    await new Promise((resolve) =>
      setTimeout(resolve, ESPERA_ANTES_DE_REPETIR_LA_PARADA_MS)
    );
    await telnyxAiAdapter.stopAssistantOnCall(callControlId);
  }
}

/** Lo que contesta la tool al modelo. */
export interface RespuestaDelCambio {
  success: boolean;
  siguiente_paso: string;
}

const SIGUE_EN_CASTELLANO =
  "No se puede pasar la llamada a esa lengua: sigue tú, en castellano. Si no le entiendes, pídele con amabilidad que te lo diga en castellano.";

/**
 * La tool `cambiar_de_idioma`. Devuelve lo que se le contesta al modelo y,
 * si el cambio sigue, arranca el assistant de la lengua sin esperarlo (el
 * de flux ya está parado: su respuesta no la va a leer nadie).
 */
export async function cambiarDeIdioma(input: {
  callControlId: string;
  params: Record<string, unknown>;
}): Promise<RespuestaDelCambio> {
  const { callControlId, params } = input;
  const idioma = params.idioma;
  if (!esLenguaConAssistantPropio(idioma)) {
    return {
      success: false,
      siguiente_paso:
        "Ese idioma lo hablas tú: no cambies nada y contesta en el suyo.",
    };
  }

  const call = await prisma.call.findUnique({
    where: { callId: callControlId },
    select: {
      id: true,
      businessId: true,
      fromNumber: true,
      assistantsArrancados: true,
      agent: {
        select: { telnyxAssistantId: true, telnyxCooficialAssistantId: true },
      },
      business: {
        select: {
          id: true,
          name: true,
          agentSettings: true,
          businessType: true,
          address: true,
          businessDetails: true,
          timezone: true,
          phone: true,
          telnyxPhoneNumber: true,
          ownerWhatsappNumber: true,
        },
      },
    },
  });
  if (!call) {
    console.error(
      `[CambioDeIdioma] ${callLabel(callControlId)}: cambiar_de_idioma sin Call`
    );
    return { success: false, siguiente_paso: SIGUE_EN_CASTELLANO };
  }
  const etiqueta = `${callLabel(callControlId)} (negocio ${call.businessId})`;
  const destino = call.agent?.telnyxCooficialAssistantId ?? null;
  const deVuelta = call.agent?.telnyxAssistantId ?? null;
  const deLaZona = cooficialDeLaZona(call.business);
  if (!destino || deLaZona !== idioma) {
    console.warn(
      `[CambioDeIdioma] ${etiqueta}: pidió cambiar a ${idioma}, pero ${
        destino
          ? `la lengua de la zona es ${deLaZona ?? "ninguna"}`
          : "el agente no tiene assistant de la lengua de la zona"
      }; sigue el de flux`
    );
    return { success: false, siguiente_paso: SIGUE_EN_CASTELLANO };
  }

  // Un cambio a la vez: si el modelo llama dos veces a la tool, la segunda
  // no vuelve a parar al que ya está arrancando.
  const reservado = await prisma.call.updateMany({
    where: { id: call.id, assistantsArrancados: call.assistantsArrancados },
    data: { assistantsArrancados: { increment: 1 } },
  });
  if (reservado.count === 0) {
    console.warn(
      `[CambioDeIdioma] ${etiqueta}: cambiar_de_idioma repetida mientras ya se cambiaba; se ignora`
    );
    return {
      success: true,
      siguiente_paso: "No digas nada más ni uses ninguna herramienta.",
    };
  }

  const inicio = Date.now();
  // Mientras se para: lo hablado y lo que se sabe de quien llama.
  const loHablado = leerLoHablado(callControlId);
  const contexto = resolverContextoDeLlamada({
    business: call.business,
    telefono: call.fromNumber,
  });
  loHablado.catch(() => {});
  contexto.catch(() => {});

  try {
    await pararConUnReintento(callControlId);
  } catch (error) {
    await prisma.call
      .update({
        where: { id: call.id },
        data: { assistantsArrancados: { decrement: 1 } },
      })
      .catch(() => {});
    console.error(
      `[CambioDeIdioma] ${etiqueta}: no se pudo parar el assistant de flux para pasar a ${idioma}; sigue él en castellano: ${errorMessage(error)}`
    );
    return { success: false, siguiente_paso: SIGUE_EN_CASTELLANO };
  }
  const parado = Date.now();

  void arrancarElDeLaLengua({
    callControlId,
    callRowId: call.id,
    businessId: call.businessId,
    idioma,
    destino,
    deVuelta,
    loQueDice: textoDe(params.lo_que_dice, LARGO_MAXIMO_DE_LA_RESPUESTA),
    primeraRespuesta: textoDe(
      params.primera_respuesta,
      LARGO_MAXIMO_DE_LA_RESPUESTA
    ),
    loHablado,
    contexto,
    tiempos: { inicio, parado },
    etiqueta,
  });

  return {
    success: true,
    siguiente_paso: `No digas nada más ni uses ninguna herramienta: la llamada sigue en ${IDIOMAS[idioma].nombreEnPrompt}.`,
  };
}

async function arrancarElDeLaLengua(input: {
  callControlId: string;
  callRowId: string;
  businessId: string;
  idioma: LenguaConAssistantPropio;
  destino: string;
  deVuelta: string | null;
  loQueDice: string | null;
  primeraRespuesta: string | null;
  loHablado: Promise<MensajeDelHistorial[]>;
  contexto: ReturnType<typeof resolverContextoDeLlamada>;
  tiempos: { inicio: number; parado: number };
  etiqueta: string;
}): Promise<void> {
  const { callControlId, callRowId, businessId, idioma, etiqueta } = input;
  try {
    const [copia, contexto] = await Promise.all([
      conTope(
        input.loHablado,
        ESPERA_MAXIMA_DE_LECTURA_MS,
        [] as MensajeDelHistorial[],
        "lo hablado",
        etiqueta
      ),
      conTope(
        input.contexto,
        ESPERA_MAXIMA_DE_LECTURA_MS,
        null,
        "el contexto de quien llama",
        etiqueta
      ),
    ]);
    const leido = Date.now();
    const historial = historialParaElNuevo({
      copia,
      saludo: contexto?.saludo ?? null,
      loQueDice: input.loQueDice,
    });
    const frase = IDIOMAS[idioma].fraseAlCambiar ?? "";
    const saludo = [frase, input.primeraRespuesta].filter(Boolean).join(" ");
    await guardarSembrados(callRowId, businessId, historial);

    try {
      await telnyxAiAdapter.startAssistantOnCall(callControlId, input.destino, {
        greeting: saludo || undefined,
        messageHistory: historial,
        dynamicVariables: contexto?.variables,
      });
      console.log(
        `[CambioDeIdioma] ${etiqueta}: sigue en ${idioma} con ${input.destino} (${historial.length} mensajes${input.primeraRespuesta ? ", con su respuesta" : ", sin respuesta preparada"}; parar ${input.tiempos.parado - input.tiempos.inicio} ms, leer ${leido - input.tiempos.parado} ms más, arrancar ${Date.now() - leido} ms)`
      );
      return;
    } catch (error) {
      console.error(
        `[CambioDeIdioma] ${etiqueta}: no se pudo arrancar el assistant de ${idioma} (${input.destino}); vuelve el de flux: ${errorMessage(error)}`
      );
    }

    if (input.deVuelta) {
      try {
        await telnyxAiAdapter.startAssistantOnCall(
          callControlId,
          input.deVuelta,
          {
            greeting:
              "Perdona, no te he entendido bien. ¿Me lo puedes decir en castellano?",
            messageHistory: historial,
            dynamicVariables: contexto?.variables,
          }
        );
        console.warn(
          `[CambioDeIdioma] ${etiqueta}: vuelve el assistant de flux (${input.deVuelta}) con lo hablado`
        );
        return;
      } catch (error) {
        console.error(
          `[CambioDeIdioma] ${etiqueta}: tampoco se pudo volver al de flux; la llamada queda sin assistant y se cuelga: ${errorMessage(error)}`
        );
      }
    }
    await sinAssistantQueArrancar(input);
  } catch (error) {
    console.error(
      `[CambioDeIdioma] ${etiqueta}: fallo inesperado al cambiar a ${idioma}: ${errorMessage(error)}`
    );
    await sinAssistantQueArrancar(input);
  }
}

/**
 * Ningún assistant arrancó: no habrá otra conversación (el informe sale
 * ya, con la que terminó) y se cuelga, como cuando no se puede contestar
 * (decisión del 17-10): mejor que el cliente note el corte y vuelva a
 * llamar que dejarle en silencio.
 */
async function sinAssistantQueArrancar(input: {
  callControlId: string;
  callRowId: string;
  businessId: string;
  etiqueta: string;
}): Promise<void> {
  try {
    const call = await prisma.call.update({
      where: { id: input.callRowId },
      data: { assistantsArrancados: { decrement: 1 } },
      select: { assistantsArrancados: true, conversacionesDeTelnyx: true },
    });
    if (call.conversacionesDeTelnyx.length >= call.assistantsArrancados) {
      await pedirInformeDeLlamada({
        callRowId: input.callRowId,
        businessId: input.businessId,
        origen: "un cambio de idioma fallido",
      });
    }
  } catch (error) {
    console.error(
      `[CambioDeIdioma] ${input.etiqueta}: no se pudo descontar el assistant que no arrancó; el informe puede no salir: ${errorMessage(error)}`
    );
  }
  await telnyxAiAdapter.hangupCall(input.callControlId).catch((error) => {
    console.error(
      `[CambioDeIdioma] ${input.etiqueta}: tampoco se pudo colgar: ${errorMessage(error)}`
    );
  });
}

/**
 * ¿Quedan conversaciones de la llamada por terminar? Solo con un cambio de
 * idioma hay más de una: el informe espera a la última.
 */
export function quedanConversaciones(call: {
  assistantsArrancados: number;
  conversacionesDeTelnyx: string[];
}): boolean {
  return (
    call.assistantsArrancados > 1 &&
    call.conversacionesDeTelnyx.length < call.assistantsArrancados
  );
}
