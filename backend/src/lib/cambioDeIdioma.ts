/**
 * Cambiar de assistant a mitad de llamada según el idioma (laboratorio del
 * 2026-11-06, scripts/laboratorioUeCatalan.ts).
 *
 * La recepcionista contesta con un assistant procesado en la UE
 * (`privacy_settings.in_transit_data_locality`: flux, voz Ultra y GLM). En la
 * UE no hay transcripción ni voz para el catalán, el gallego ni el euskera,
 * así que cuando quien llama habla en una de ellas el modelo llama a la tool
 * `cambiar_de_idioma` y aquí se para ese assistant y se arranca, en la misma
 * llamada, el de esa lengua (Soniox, sin la garantía), con lo hablado hasta
 * ahora. El traspaso de Telnyx (tool `handoff`) no sirve: la garantía vale
 * para toda la conversación y Telnyx la corta al traspasar
 * (`data_locality_unavailable`, medido el 06-11).
 *
 * Los assistants de destino llegan en la URL de la tool
 * (`?ca-ES=assistant-…&gl-ES=…`), que pone quien crea el assistant de la UE.
 */
import { telnyxAiAdapter } from "../adapters/telnyx/TelnyxAiAdapter.js";
import { callLabel, errorMessage } from "./logUtils.js";
import { IDIOMAS } from "./idiomas/catalogo.js";

export const IDIOMAS_CON_CAMBIO = ["ca-ES", "gl-ES", "eu-ES"] as const;
export type IdiomaConCambio = (typeof IDIOMAS_CON_CAMBIO)[number];

const ID_DE_ASSISTANT = /^assistant-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function esIdiomaConCambio(valor: unknown): valor is IdiomaConCambio {
  return (
    typeof valor === "string" &&
    (IDIOMAS_CON_CAMBIO as readonly string[]).includes(valor)
  );
}

/** El assistant de destino de un idioma, leído de la query de la URL de la
 * tool. Solo acepta ids con forma de assistant de Telnyx. */
export function assistantDeDestino(
  query: Record<string, unknown> | undefined,
  idioma: IdiomaConCambio
): string | null {
  const valor = query?.[idioma];
  return typeof valor === "string" && ID_DE_ASSISTANT.test(valor) ? valor : null;
}

/** Lo hablado hasta ahora en la llamada, para el assistant nuevo: solo lo
 * que dijeron quien llama y la recepcionista (sin tools ni avisos). */
async function historialDeLaLlamada(
  callControlId: string
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  const conversaciones = await telnyxAiAdapter.conversacionesDeLaLlamada(callControlId);
  const historial: Array<{ role: "user" | "assistant"; content: string; cuando: string }> = [];
  for (const conversacion of conversaciones) {
    const mensajes = await telnyxAiAdapter.listConversationMessages(conversacion.id);
    for (const mensaje of mensajes) {
      if ((mensaje.role === "user" || mensaje.role === "assistant") && mensaje.text.trim()) {
        historial.push({
          role: mensaje.role,
          content: mensaje.text,
          cuando: mensaje.sentAt ?? mensaje.createdAt ?? "",
        });
      }
    }
  }
  return historial
    .sort((a, b) => a.cuando.localeCompare(b.cuando))
    .map(({ role, content }) => ({ role, content }));
}

/**
 * Para el assistant de la llamada y arranca el del idioma. No lanza: lo
 * llama la tool sin esperarlo (su respuesta tiene que volver enseguida) y
 * un fallo se loguea con todo. Si falla al arrancar el nuevo, se vuelve a
 * arrancar el de la UE con lo hablado, para no dejar la llamada en silencio.
 */
export async function cambiarDeAssistantPorIdioma(input: {
  callControlId: string;
  businessId: string;
  idioma: IdiomaConCambio;
  assistantDestino: string;
  assistantDeVuelta: string | null;
}): Promise<void> {
  const { callControlId, businessId, idioma, assistantDestino, assistantDeVuelta } = input;
  const etiqueta = `${callLabel(callControlId)} (negocio ${businessId})`;
  const inicio = Date.now();
  let historial: Array<{ role: "user" | "assistant"; content: string }> = [];
  try {
    historial = await historialDeLaLlamada(callControlId);
  } catch (error) {
    console.error(
      `[CambioDeIdioma] ${etiqueta}: no se pudo leer lo hablado; el assistant de ${idioma} empieza sin historial: ${errorMessage(error)}`
    );
  }
  const leido = Date.now();

  try {
    await telnyxAiAdapter.stopAssistantOnCall(callControlId);
  } catch (error) {
    console.error(
      `[CambioDeIdioma] ${etiqueta}: no se pudo parar el assistant de la UE; la llamada sigue con él: ${errorMessage(error)}`
    );
    return;
  }
  const parado = Date.now();

  try {
    await telnyxAiAdapter.startAssistantOnCall(callControlId, assistantDestino, {
      greeting: IDIOMAS[idioma].fraseAlCambiar,
      messageHistory: historial,
    });
    console.log(
      `[CambioDeIdioma] ${etiqueta}: sigue en ${idioma} con ${assistantDestino} (${historial.length} mensajes; leer ${leido - inicio} ms, parar ${parado - leido} ms, arrancar ${Date.now() - parado} ms)`
    );
  } catch (error) {
    console.error(
      `[CambioDeIdioma] ${etiqueta}: no se pudo arrancar el assistant de ${idioma} (${assistantDestino}): ${errorMessage(error)}`
    );
    if (!assistantDeVuelta) return;
    await telnyxAiAdapter
      .startAssistantOnCall(callControlId, assistantDeVuelta, { messageHistory: historial })
      .then(() =>
        console.warn(`[CambioDeIdioma] ${etiqueta}: vuelve el assistant de la UE (${assistantDeVuelta})`)
      )
      .catch((otroError) =>
        console.error(
          `[CambioDeIdioma] ${etiqueta}: tampoco se pudo volver al de la UE; la llamada queda sin assistant: ${errorMessage(otroError)}`
        )
      );
  }
}
