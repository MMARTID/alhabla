import { prisma } from "../lib/prisma.js";
import { errorMessage } from "../lib/logUtils.js";
import { telnyxAiAdapter } from "../adapters/telnyx/TelnyxAiAdapter.js";
import { propiedadesDelInformeFinal } from "../lib/telnyxAssistantPayload.js";
import { guardarIdiomaDelCliente } from "../lib/idiomaDelCliente.js";
import { procesarInformeFinal } from "../modules/whatsapp/recados.js";
import { enqueueInformeDeLlamadaJob } from "../lib/cloudTasks.js";
import type { InformeDeLlamadaJob } from "../lib/jobTypes.js";

/**
 * El informe de una llamada para el negocio (PLAN-CANAL-DUENO.md § 10),
 * escrito por el backend al colgar: lee la transcripción y le pide al modelo
 * el mismo informe que antes mandaba la recepcionista con la tool
 * informar_al_negocio, con las mismas propiedades (`postCallReport`), y lo
 * procesa igual (`procesarInformeFinal`: recado, aviso al dueño, resultado
 * del panel, dudas sin respuesta) y guarda el idioma del cliente.
 *
 * Hasta el 2026-11-04 lo hacía el propio assistant en una post-conversación
 * de Telnyx: una pasada más del modelo con el prompt entero (~31.000
 * caracteres con las tools), que llegaba dos veces y a veces distinta. Aquí
 * es una sola petición con la transcripción y estas instrucciones.
 *
 * La transcripción es la del webhook `call.conversation.ended`
 * (adapters/telnyx/transcripcion.ts), sin redactar: con `pii_redaction` la
 * copia de Telnyx y sus insights ven `<PII:name/>` en vez del nombre y el
 * recado perdería el nombre y el teléfono. Si solo se pudo guardar la copia
 * redactada, el informe sale igual, con lo que haya.
 *
 * Nunca lanza por el modelo (lo deja en el log y la llamada se queda sin
 * informe, como se quedaba si la post-conversación no llegaba); solo si falla
 * la BD, para que Cloud Tasks lo repita (procesarInformeFinal es idempotente
 * por llamada).
 */

/** El modelo del informe: el de la recepcionista, alojado por Telnyx y
 * servido en la UE. */
export const MODELO_DEL_INFORME = "zai-org/GLM-5.3-Flash";

/** Lo más que se lee de la respuesta de una tool: get_catalog trae el
 * catálogo entero, y para el informe basta con saber qué devolvió. */
const MAX_LARGO_DE_UNA_TOOL = 1_500;

interface MensajeGuardado {
  role?: unknown;
  text?: unknown;
}

const QUIEN: Record<string, string> = {
  user: "Cliente",
  assistant: "Recepcionista",
  tool: "Respuesta de una herramienta",
  system: "Aviso del sistema",
  developer: "Aviso del sistema",
};

/** La transcripción guardada como texto para el modelo, una línea por
 * mensaje, sin los turnos vacíos (los que solo llaman a una tool). */
export function transcripcionParaElInforme(mensajes: unknown): string {
  if (!Array.isArray(mensajes)) return "";
  return (mensajes as MensajeGuardado[])
    .map((mensaje) => {
      const rol = typeof mensaje.role === "string" ? mensaje.role : "";
      const texto =
        typeof mensaje.text === "string" ? mensaje.text.trim() : "";
      if (!texto) return null;
      const recortado =
        rol === "tool" && texto.length > MAX_LARGO_DE_UNA_TOOL
          ? `${texto.slice(0, MAX_LARGO_DE_UNA_TOOL)}…`
          : texto;
      return `${QUIEN[rol] ?? rol}: ${recortado}`;
    })
    .filter((linea): linea is string => linea !== null)
    .join("\n");
}

/** ¿Llegó a hablar quien llama? Sin ningún mensaje suyo no hace falta el
 * modelo: es NO_ANSWER. */
function hablaElCliente(mensajes: unknown): boolean {
  return (
    Array.isArray(mensajes) &&
    (mensajes as MensajeGuardado[]).some(
      (mensaje) =>
        mensaje.role === "user" &&
        typeof mensaje.text === "string" &&
        mensaje.text.trim() !== ""
    )
  );
}

/** Las instrucciones del informe: lo que decía la descripción de la tool y
 * la regla del recado del prompt de voz. Los campos los explica el esquema. */
export function instruccionesDelInforme(input: {
  negocio: string;
  telefonoDeLaLlamada: string | null;
}): string {
  return [
    `Escribes el informe final de una llamada para el negocio «${input.negocio}». La atendió su recepcionista de IA; abajo tienes la transcripción entera, con las respuestas de las herramientas que usó.`,
    "Rellena el informe con lo que pasó en la llamada. Cada campo del esquema dice qué poner. Usa solo lo que está en la transcripción: no inventes nombres, teléfonos, servicios ni preguntas.",
    // Insights y post-conversación lo confundían: «lo pienso y ya llamaré»
    // salía como NO_ANSWER, y una reserva que falló, como FRUSTRATED (dev,
    // 04-11). En orden: el primero que encaje.
    [
      "Para resultado, el primero de esta lista que encaje:",
      "1. NO_ANSWER: el cliente no llegó a decir qué quería.",
      "2. ESCALATED: quedó algo para que lo resuelva el negocio: una herramienta falló y no se pudo hacer lo que pedía (motivo_escalada FALLO_TECNICO), pidió hablar con una persona (CLIENTE_LO_PIDIO), llamó fuera de horario y se le remitió al negocio (FUERA_DE_HORARIO) o una consulta que la recepcionista no supo resolver (CONSULTA_COMPLEJA).",
      "3. LEAD_CAPTURED: dejó un recado o pidió que el negocio le llame.",
      "4. FRUSTRATED: se fue molesto o se quejó.",
      "5. RESOLVED: se le atendió: reservó, consultó, cambió o canceló, también si al final decidió no reservar.",
      "Si el resultado no es ESCALATED, motivo_escalada es NO_APLICA.",
    ].join("\n"),
    `El recado, solo si el cliente pidió de forma explícita dejar un mensaje para el negocio o que el negocio le llame: reservar, consultar o cambiar una cita no es un recado, y entonces recado es null. El teléfono del recado, solo si lo dictó o confirmó que le llamen al número desde el que llama (${input.telefonoDeLaLlamada ?? "oculto"}); si no, déjalo vacío.`,
    "En dudas_sin_respuesta, solo las preguntas del cliente sobre el negocio que la recepcionista no pudo responder porque no tenía esa información (formas de pago, aparcamiento, si hacen algo…), con sus palabras. Lo que preguntó y se le contestó, o lo que forma parte de reservar (qué hora, qué día), no va.",
    "En servicio_pedido, el nombre del servicio tal como aparece en el catálogo (la respuesta de get_catalog), si lo pidió.",
    "fallo_de_tool es true si alguna herramienta devolvió un error.",
  ].join("\n\n");
}

/**
 * El esquema que se le pide al modelo: las propiedades de la tool del chat
 * (las de `postCallReport`), todas obligatorias y con «nada» explícito
 * (recado null, cadenas y listas vacías). Con salida estructurada y campos
 * opcionales, el modelo rellenaba un recado inventado con el resumen de la
 * llamada (dev, 04-11). Delante, `que_paso`: una frase que no se guarda,
 * para que decida el resultado después de decir lo que pasó.
 */
export function esquemaDelInforme(): Record<string, unknown> {
  const propiedades = propiedadesDelInformeFinal() as Record<
    string,
    Record<string, unknown>
  >;
  const { recado, idioma_del_cliente, ...resto } = propiedades;
  const conNada = {
    que_paso: {
      type: "string",
      description:
        "En una frase corta: qué quería el cliente y cómo acabó la llamada.",
    },
    ...resto,
    servicio_pedido: {
      ...resto.servicio_pedido,
      description: `${String(resto.servicio_pedido?.description ?? "")} Cadena vacía si no pidió ninguno.`,
    },
    recado: {
      anyOf: [recado, { type: "null" }],
      description: `${String(recado?.description ?? "")} null si no dejó recado ni pidió que le llamen.`,
    },
    idioma_del_cliente: {
      anyOf: [idioma_del_cliente, { type: "null" }],
      description: String(idioma_del_cliente?.description ?? ""),
    },
  };
  return {
    type: "object",
    properties: conNada,
    required: Object.keys(conNada),
  };
}

/** El JSON del modelo, o null si no es un objeto. */
function leerInforme(contenido: string): Record<string, unknown> | null {
  try {
    const valor: unknown = JSON.parse(contenido);
    return valor && typeof valor === "object" && !Array.isArray(valor)
      ? (valor as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function processInformeDeLlamadaJob(
  data: InformeDeLlamadaJob
): Promise<void> {
  const call = await prisma.call.findUnique({
    where: { id: data.callId },
    select: {
      id: true,
      callId: true,
      businessId: true,
      voiceProvider: true,
      fromNumber: true,
      business: { select: { id: true, name: true, timezone: true } },
      transcript: { select: { messages: true } },
    },
  });
  const contexto = `llamada ${data.callId}${call ? ` (negocio ${call.businessId}, ${call.callId})` : ""}`;
  if (!call) {
    console.warn(`[Job] Informe: la ${contexto} ya no existe; se ignora`);
    return;
  }
  // El chat de WhatsApp lo informa la recepcionista con la tool.
  if (call.voiceProvider !== "telnyx") {
    console.warn(
      `[Job] Informe: la ${contexto} no es una llamada de Telnyx (${call.voiceProvider}); se ignora`
    );
    return;
  }
  if (!call.transcript) {
    // Lo vuelve a pedir recuperarTranscripcion cuando la guarde.
    console.warn(
      `[Job] Informe: la ${contexto} aún no tiene transcripción; se hará cuando llegue`
    );
    return;
  }

  const negocio = {
    id: call.business.id,
    name: call.business.name,
    timezone: call.business.timezone || "Europe/Madrid",
  };
  let informe: Record<string, unknown>;
  if (!hablaElCliente(call.transcript.messages)) {
    informe = { resultado: "NO_ANSWER", motivo_escalada: "NO_APLICA" };
  } else {
    const transcripcion = transcripcionParaElInforme(call.transcript.messages);
    const t0 = Date.now();
    let respuesta: Awaited<ReturnType<typeof telnyxAiAdapter.completarConEsquema>>;
    try {
      respuesta = await telnyxAiAdapter.completarConEsquema({
        modelo: MODELO_DEL_INFORME,
        mensajes: [
          {
            role: "system",
            content: instruccionesDelInforme({
              negocio: negocio.name,
              telefonoDeLaLlamada: call.fromNumber,
            }),
          },
          { role: "user", content: `Transcripción:\n${transcripcion}` },
        ],
        esquema: { nombre: "informe_de_la_llamada", schema: esquemaDelInforme() },
      });
    } catch (error) {
      console.error(
        `[Job] Informe: el modelo no respondió para la ${contexto}; la llamada se queda sin informe: ${errorMessage(error)}`
      );
      return;
    }
    const leido = leerInforme(respuesta.contenido);
    if (!leido) {
      console.error(
        `[Job] Informe: el modelo no devolvió un JSON para la ${contexto}; la llamada se queda sin informe: ${respuesta.contenido.slice(0, 200)}`
      );
      return;
    }
    informe = leido;
    console.log(
      `[Job] Informe de la ${contexto} en ${Date.now() - t0} ms (${respuesta.tokens.entrada ?? "?"} tokens de entrada, ${respuesta.tokens.salida ?? "?"} de salida)`
    );
  }

  const resultado = await procesarInformeFinal({
    business: negocio,
    callControlId: call.callId,
    params: informe,
  });
  await guardarIdiomaDelCliente({
    callId: call.callId,
    businessId: negocio.id,
    idioma: informe.idioma_del_cliente,
    etiqueta: `Informe de la ${contexto}`,
  });
  console.log(
    `[Job] Informe de la ${contexto}: ${resultado.outcome} (resultado ${String(informe.resultado ?? "—")}${resultado.leadId ? `, recado ${resultado.leadId}` : ""})`
  );
}

/**
 * Pide el informe de una llamada en cuanto se guarda su transcripción (el
 * webhook `call.conversation.ended` o su recuperación). Nunca lanza: sin
 * informe el negocio no recibe el recado ni ve el resultado, así que el
 * fallo queda en el log con todo lo necesario para repetirlo.
 */
export async function pedirInformeDeLlamada(input: {
  callRowId: string;
  businessId: string;
  origen: string;
}): Promise<void> {
  try {
    await enqueueInformeDeLlamadaJob({ callId: input.callRowId });
  } catch (error) {
    console.error(
      `[Telnyx] NO se pudo pedir el informe de la llamada ${input.callRowId} (negocio ${input.businessId}, tras ${input.origen}): el negocio no recibirá su recado ni el resultado. ${errorMessage(error)}`
    );
  }
}
