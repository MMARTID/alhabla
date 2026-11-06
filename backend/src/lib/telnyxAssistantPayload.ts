import type {
  CreateTelnyxAssistantInput,
  HangupTool,
  RespaldoDeTranscripcion,
  TelnyxTransferTool,
  TelnyxWebhookTool,
  TranscriptionSettingsInput,
} from "../adapters/telnyx/TelnyxAiAdapter.js";
import type { FlowNodeReq } from "telnyx/resources/ai/assistants/assistants.js";
import { resolveManagedPromptTimezone } from "./managedAgentPrompt.js";
import { VARIABLES_DE_LA_LLAMADA_POR_DEFECTO } from "./seccionesDelPrompt.js";
import type { CooficialDeLaZona, PerfilDeIdiomas } from "./idiomas/resolver.js";
import { CODIGOS_DE_IDIOMA, IDIOMAS } from "./idiomas/catalogo.js";

/**
 * Nombre estable y determinista del assistant Telnyx de un agente — permite
 * reconciliar por nombre si algún día se pierde `Agent.telnyxAssistantId`.
 */
export function buildTelnyxAssistantName(
  businessId: string,
  agentId: string
): string {
  return `alhabla-${businessId}-${agentId}`;
}

/** El del assistant de la lengua cooficial de la zona del agente (tipo
 * «recepcionista_cooficial», lib/tiposDeAsistente.ts). */
export function buildTelnyxCooficialAssistantName(
  businessId: string,
  agentId: string
): string {
  return `alhabla-cooficial-${businessId}-${agentId}`;
}

/** Lo mismo para el assistant del chat de clientes por WhatsApp del
 * agente (tipo «recepcionista_chat», lib/tiposDeAsistente.ts). */
export function buildTelnyxChatAssistantName(
  businessId: string,
  agentId: string
): string {
  return `alhabla-chat-${businessId}-${agentId}`;
}

export interface TelnyxWebhookToolInput {
  name: string;
  description: string;
  url: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  properties: Record<string, unknown>;
  required?: string[];
  headers?: Array<{ name: string; value: string }>;
  timeoutMs?: number;
  /** Lo que dice Telnyx mientras espera la respuesta (filler messages):
   * frases fijas, no del modelo. Solo suenan en voz; en el chat no salen
   * (comprobado en dev el 2026-11-02). */
  mensajesDeEspera?: Array<{ content: string; timingMs: number }>;
}

/**
 * El timeout va al nivel de la tool, hermano de `type`: Telnyx guarda un
 * `webhook.timeout_ms` pero no lo aplica, y la tool corre con su valor por
 * defecto (5000 ms). Así estuvieron todas las tools hasta el SDK 7.24, que lo
 * documenta — verificado en vivo el 2026-10-02 (GET de un assistant de dev:
 * `timeout_ms: 5000` en la tool y `webhook.timeout_ms: 20000` sin efecto).
 */
export function toTelnyxWebhookTool(
  input: TelnyxWebhookToolInput
): TelnyxWebhookTool {
  return {
    type: "webhook",
    timeout_ms: input.timeoutMs,
    webhook: {
      name: input.name,
      description: input.description,
      url: input.url,
      method: input.method ?? "POST",
      body_parameters: {
        type: "object",
        properties: input.properties,
        required: input.required,
      },
      headers: input.headers,
      ...(input.mensajesDeEspera
        ? {
            messages: input.mensajesDeEspera.map((mensaje) => ({
              type: "request_response_delayed" as const,
              content: mensaje.content,
              timing_ms: mensaje.timingMs,
            })),
          }
        : {}),
    },
  };
}

/**
 * Las tools que tardan lo bastante como para que se note el silencio: en
 * producción, del 19-10 al 02-11, book_appointment tardó 2,0 s de mediana
 * (3,2 s el máximo) y cancel_appointment 1,1 s; el resto, menos de 0,5 s.
 * Si a los 1,5 s no han respondido, la recepcionista dice la frase de
 * espera del idioma principal (no la de cada llamada: las variables de
 * llamada en estas frases están sin comprobar, y si no se sustituyeran se
 * leerían las llaves en voz alta).
 */
const TOOLS_CON_FRASE_DE_ESPERA = new Set([
  "book_appointment",
  "cancel_appointment",
]);
const ESPERA_ANTES_DE_LA_FRASE_MS = 1500;

export function conFraseDeEspera(
  tool: TelnyxWebhookToolInput,
  isoDelPrincipal: string
): TelnyxWebhookToolInput {
  if (!TOOLS_CON_FRASE_DE_ESPERA.has(tool.name)) return tool;
  const idioma =
    Object.values(IDIOMAS).find((i) => i.iso === isoDelPrincipal) ??
    IDIOMAS["es-ES"];
  return {
    ...tool,
    mensajesDeEspera: [
      {
        content: idioma.fraseDeEspera,
        timingMs: ESPERA_ANTES_DE_LA_FRASE_MS,
      },
    ],
  };
}

/**
 * Canal por el que un tipo de asistente recibe sus tools de webhook: la ruta
 * del backend (cada ruta tiene su handler en server.ts, con la misma firma
 * Ed25519 de Telnyx) y las cabeceras con las que Telnyx le dice al backend
 * QUIÉN llama — nunca el LLM. Un tipo de asistente nuevo con tools propias
 * declara su canal aquí (ver lib/tiposDeAsistente.ts).
 */
export interface CanalDeTools {
  /** Ruta bajo BASE_URL, sin barra final; la tool va en `<ruta>/<nombre>`. */
  ruta: string;
  /** Cabeceras templadas por Telnyx con variables de sistema o metadata. */
  cabeceras: Array<{ name: string; value: string }>;
  timeoutMs: number;
}

/** Recepcionista (sus dos assistants, voz y chat de clientes por
 * WhatsApp): el negocio sale de la Call que identifica
 * `{{call_control_id}}` (voiceTools/service.ts). */
export const CANAL_DE_TOOLS_DE_VOZ: CanalDeTools = {
  ruta: "/webhooks/telnyx/tools",
  cabeceras: [
    { name: "X-Alhabla-Call-Control-Id", value: "{{call_control_id}}" },
  ],
  timeoutMs: 20000,
};

/** Lo que cambia de una tool de webhook a otra: el canal pone el resto. */
export type DefinicionDeToolDeWebhook = Pick<
  TelnyxWebhookToolInput,
  "name" | "description" | "properties" | "required"
>;

/**
 * Convierte las definiciones de un tipo de asistente en tools de webhook de
 * su canal: url `<BASE_URL><ruta>/<name>`, POST, cabeceras y timeout del
 * canal. Antes cada builder repetía estos cuatro campos en cada tool.
 */
export function construirToolsDeWebhook(
  baseUrl: string,
  canal: CanalDeTools,
  definiciones: DefinicionDeToolDeWebhook[]
): TelnyxWebhookToolInput[] {
  const base = `${baseUrl.replace(/\/$/, "")}${canal.ruta}`;
  return definiciones.map((definicion) => ({
    name: definicion.name,
    description: definicion.description,
    url: `${base}/${definicion.name}`,
    method: "POST",
    properties: definicion.properties,
    ...(definicion.required ? { required: definicion.required } : {}),
    headers: canal.cabeceras.map((cabecera) => ({ ...cabecera })),
    timeoutMs: canal.timeoutMs,
  }));
}

/**
 * Única forma de que el assistant pueda colgar por su cuenta: sin ella la
 * llamada sigue abierta hasta que cuelga el cliente o se agota el límite de
 * duración.
 */
export function buildTelnyxHangupTool(description: string): HangupTool {
  return { type: "hangup", hangup: { description } };
}

/** Nombre del destino que ve el modelo al elegir a quién transferir. */
export const NOMBRE_DEL_DESTINO_DE_TRANSFERENCIA = "Responsable del negocio";

/**
 * Tool nativa `transfer` de Telnyx (docs/historico/PLAN-TELEFONIA-UX.md § 5,
 * fase 4):
 * pasa la llamada en curso al móvil del dueño. Formato tomado del SDK
 * (`AssistantTool.Transfer`, telnyx 7.21): `from` es el número que marca
 * (el de Alhabla del negocio), `targets` la lista de destinos entre los que
 * el modelo elige por `name`. Sin `timeout_secs`: la tool nativa no lo
 * tiene, así que la pata suena hasta que el operador del dueño se rinde o
 * salta su buzón.
 *
 * - `warm_transfer_instructions`: Telnyx reproduce al dueño, antes de unir
 *   las llamadas, un mensaje que compone el propio assistant con estas
 *   instrucciones (transferencia «en caliente»): así sabe que es un cliente
 *   que le pasa su recepcionista, no una llamada rara desde un número que
 *   no conoce.
 * - `voicemail_detection` premium + `stop_transfer`: si el buzón de voz del
 *   móvil contesta, Telnyx cancela la pata y devuelve la llamada a la
 *   recepcionista (documentación «Voicemail Detection on Transfer»); sin
 *   esto el cliente acabaría hablando con el contestador del dueño.
 * - Sin `warm_transfer_acceptance`: la documentación lo limita a llamadas
 *   arrancadas con `ai_assistant_start`, y las nuestras se contestan con
 *   `answer` + `assistant` (answerCallWithAssistant).
 * - Sin `description`: la genera Telnyx a partir de los destinos; la regla
 *   de cuándo transferir vive en el prompt («## Pasar la llamada»).
 */
export function buildTelnyxTransferTool(input: {
  from: string;
  to: string;
  businessName: string;
}): TelnyxTransferTool {
  return {
    type: "transfer",
    transfer: {
      from: input.from,
      targets: [{ name: NOMBRE_DEL_DESTINO_DE_TRANSFERENCIA, to: input.to }],
      warm_transfer_instructions: `Habla en español. En una sola frase, di que eres la recepcionista de ${input.businessName} y que le pasas a un cliente: su nombre si lo dijo y qué quiere. No hagas preguntas ni esperes respuesta.`,
      voicemail_detection: {
        detection_mode: "premium",
        on_voicemail_detected: { action: "stop_transfer" },
      },
    },
  };
}

/**
 * Las 5 tools de voz (catálogo, disponibilidad, reserva, buscar/cancelar
 * cita) — pese al nombre histórico "calendario" en calendar/service.ts, no
 * son específicas de tener un calendario externo conectado: son la única
 * forma que tiene el assistant de consultar el negocio real y reservar.
 * Vive aquí (no en calendar/service.ts) para que `telnyxAgentSync.ts` la
 * use al crear Y al sincronizar sin un import circular. Ninguna llamada
 * decide si las pasa — hallazgo real (2026-09-14): cuando guardar el horario,
 * editar un servicio o el reconciliador diario sincronizaban sin pasarlas,
 * `tools: input.tools ?? []` volcaba el assistant real a solo la tool
 * `hangup`, incapaz de reservar pese a que su propio prompt seguía
 * instruyéndole a usarlas: los 25/25 escenarios de `telnyxCallBattery.ts`
 * fallaron porque ningún assistant de las 5 cuentas de prueba las tenía.
 */
/** `idioma` de las tools que devuelven una fecha (cuandoEnSuIdioma en
 * voiceTools/service.ts): con él, `cuando` llega ya en el idioma de quien
 * llama. Laboratorio del 03-11 (E3): con el `cuando` en castellano, el
 * primer turno tras la tool salía en castellano a quien hablaba inglés. */
const IDIOMA_DE_LA_RESPUESTA = {
  type: "string",
  enum: [...CODIGOS_DE_IDIOMA],
  description:
    "El idioma en que te habla quien llama ahora (por ejemplo, en-GB si te habla en inglés). Con él, cuando llega ya en ese idioma.",
} as const;

/**
 * Las tools de webhook del assistant de llamadas. Sin informar_al_negocio
 * desde el 2026-11-04: el informe de una llamada lo escribe el backend al
 * colgar (jobs/informeDeLlamada.ts).
 */
export function buildTelnyxVoiceTools(
  baseUrl: string
): TelnyxWebhookToolInput[] {
  return construirToolsDeWebhook(baseUrl, CANAL_DE_TOOLS_DE_VOZ, [
    ...definicionesComunes(),
    {
      // Grabación con permiso (lib/grabacion.ts): la recepcionista lo
      // pregunta mientras comprueba el primer servicio.
      name: "preferencia_de_grabacion",
      description:
        "Guarda lo que contesta quien llama sobre grabar sus llamadas (el audio es solo para que el negocio las revise). Con acepta true se empieza a grabar y se recuerda para sus próximas llamadas; con false no se graba (o se deja de grabar) y no se guarda el audio; la transcripción sí. Úsala solo en dos casos: cuando conteste con claridad a la pregunta_de_grabacion que te dio check_availability, o cuando pida con sus palabras que no se grabe. Nunca en otro momento, ni con lo que conteste a otras preguntas (su nombre, la hora, el WhatsApp).",
      properties: {
        acepta: {
          type: "boolean",
          description:
            "true si acepta con claridad que se grabe (sí, vale, claro); false si dice que no.",
        },
      },
      required: ["acepta"],
    },
  ]);
}

/**
 * Las tools de webhook del assistant del chat de clientes por WhatsApp: las
 * de reservar y consultar, que son las mismas que en voz (y las mismas tools
 * de la biblioteca de Telnyx, lib/toolsCompartidas.ts), y el informe, que en
 * el chat sigue mandando la recepcionista. Sin grabación ni colgar.
 */
export function buildTelnyxChatTools(
  baseUrl: string
): TelnyxWebhookToolInput[] {
  return construirToolsDeWebhook(baseUrl, CANAL_DE_TOOLS_DE_VOZ, [
    ...definicionesComunes(),
    buildInformarAlNegocioTool(),
  ]);
}

/** Las lenguas que tienen su propio assistant (las cooficiales: flux no
 * las entiende ni las voces Ultra las hablan). */
export const LENGUAS_CON_ASSISTANT_PROPIO = [
  "ca-ES",
  "gl-ES",
  "eu-ES",
] as const;

/**
 * La tool `cambiar_de_idioma` (lib/cambioDeIdioma.ts), solo en el assistant
 * de llamadas de un negocio de zona cooficial. La misma para todos (de la
 * biblioteca): el backend sabe por la Call a qué assistant cambiar.
 *
 * `lo_que_dice` y `primera_respuesta` vienen del laboratorio del 06-11: el
 * cambio tardaba 9–12 s y el assistant nuevo, con solo el saludo en el
 * historial, esperaba a que el cliente repitiera lo que ya había pedido. Con
 * ellas el nuevo arranca diciendo ya su respuesta y sabe qué le pidieron.
 */
export function buildTelnyxCambioDeIdiomaTool(
  baseUrl: string
): TelnyxWebhookToolInput {
  return construirToolsDeWebhook(baseUrl, CANAL_DE_TOOLS_DE_VOZ, [
    {
      name: "cambiar_de_idioma",
      description:
        "Pasa la llamada a tu compañera que habla la lengua cooficial de quien llama (catalán, gallego o euskera), que tu transcripción no entiende y tu voz no habla. Llámala en el mismo turno en que notes que quien llama habla esa lengua (te llega deformada) o lo pide, sin decir nada antes. Es lo último que haces en la llamada: no uses ninguna otra herramienta antes ni después.",
      properties: {
        idioma: {
          type: "string",
          enum: [...LENGUAS_CON_ASSISTANT_PROPIO],
          description: "ca-ES catalán, gl-ES gallego, eu-ES euskera.",
        },
        lo_que_dice: {
          type: "string",
          description:
            "Lo que acaba de decir quien llama, bien escrito en su lengua: la transcripción te llega deformada, reconstruye la frase con sentido (por ejemplo «Bon dia, voldria hora per tallar-me els cabells demà»).",
        },
        primera_respuesta: {
          type: "string",
          description:
            "Tu respuesta a eso en su lengua, corta, como se la dirías: si pide algo, una pregunta para seguir (qué servicio, qué día, a qué hora) o para confirmar lo que pide. Sin horas libres, precios ni nada que no hayas comprobado con una herramienta, y sin saludar otra vez.",
        },
      },
      required: ["idioma", "lo_que_dice", "primera_respuesta"],
    },
  ])[0];
}

/** Las tools de reservar y consultar, iguales en los dos assistants. */
function definicionesComunes(): DefinicionDeToolDeWebhook[] {
  return [
    {
      name: "get_catalog",
      description:
        "Única fuente de lo que ofrece el negocio: los servicios activos con sus IDs, duraciones y precios (si el negocio los da; en precios, cuándo decirlos), los profesionales y el horario. Llámala antes de confirmar o negar un servicio, un profesional o el horario, también ante una pregunta de sí o no, antes de decir un precio y antes de comprobar o reservar si necesitas un ID o una duración.",
      properties: {},
    },
    {
      name: "check_availability",
      description:
        "Comprueba una cita en una fecha y hora concretas: valida horario, restricciones, capacidad, profesionales y calendario real. Úsala antes de book_appointment y conserva el availabilityToken que devuelve. Si el cliente no pide a nadie, no envíes professionalId: el sistema asigna a quien mejor hace el servicio y lo devuelve en assignedProfessional.",
      properties: {
        startDateTime: {
          type: "string",
          description:
            "Inicio solicitado en formato ISO 8601, en HORA LOCAL del negocio con su offset explícito (ej. 2026-09-18T16:00:00+02:00). Nunca en UTC (+00:00/Z): las cuatro de la tarde son 16:00 con el offset local.",
        },
        durationMinutes: {
          type: "number",
          description: "Duración total de la cita en minutos.",
        },
        serviceIds: {
          type: "array",
          items: { type: "string" },
          description:
            "IDs de los servicios pedidos, copiados exactamente de get_catalog carácter a carácter (opcional; puede ser más de uno si el cliente pide varios servicios en la misma cita, ej. corte y mechas). Se prioriza al profesional que domine todos esos servicios.",
        },
        professionalId: {
          type: "string",
          description:
            "ID exacto copiado tal cual de get_catalog, solo si el cliente pidió a un profesional concreto por su nombre (opcional). Déjalo vacío si no lo nombró: nunca elijas tú a nadie.",
        },
        professionalConfirmed: {
          type: "boolean",
          description:
            "true SOLO si check_availability te devolvió una recommendation, la propusiste y el cliente prefiere a la persona que pidió por su nombre: entonces te da su hueco. Nunca en la primera comprobación.",
        },
        replacesBookingId: {
          type: "string",
          description:
            "Solo para cambiar una cita que ya tiene: el bookingId que devolvió find_my_appointment, o el que devolvió book_appointment si es la cita reservada en esta misma llamada. Su hora no cuenta como ocupada y, al reservar con el token de esta comprobación, el sistema anula la cita antigua (solo si la nueva queda reservada).",
        },
        idioma: IDIOMA_DE_LA_RESPUESTA,
      },
      required: ["startDateTime", "durationMinutes"],
    },
    {
      name: "book_appointment",
      description:
        "Agenda una cita en el calendario activo. Úsala solo tras confirmación explícita y con el availabilityToken de check_availability. Si la comprobación se hizo con replacesBookingId, la cita antigua se anula al reservar la nueva. Solo se puede reservar una cita por llamada: devuelve su bookingId, y si después el cliente quiere cambiarle la hora o el servicio, comprueba con check_availability pasando ese bookingId en replacesBookingId. Una segunda cita (otra persona u otro servicio) responde YA_HAY_CITA_EN_ESTA_LLAMADA y no se reserva.",
      properties: {
        clientName: {
          type: "string",
          description: "El nombre del cliente que hace la reserva",
        },
        clientPhone: {
          type: "string",
          description:
            "Teléfono de contacto solo si el cliente da uno distinto al número desde el que llama o book_appointment te lo pidió (opcional). Pásalo en cuanto lo dicte: si hay que confirmarlo, la respuesta te dice cómo repetírselo.",
        },
        availabilityToken: {
          type: "string",
          description:
            "Token exacto devuelto por check_availability para la opción confirmada.",
        },
        smsConsent: {
          type: "boolean",
          description:
            "true si el cliente dijo que sí a recibir la confirmación y un recordatorio por WhatsApp en este número; false si dijo que no, dudó o no se le preguntó.",
        },
        phoneConfirmed: {
          type: "boolean",
          description:
            "true SOLO si book_appointment respondió CLIENT_PHONE_CONFIRMATION_REQUIRED, le repetiste ese teléfono tal como venía y el cliente dijo que sí.",
        },
        idioma: IDIOMA_DE_LA_RESPUESTA,
      },
      required: ["clientName", "availabilityToken"],
    },
    {
      name: "find_my_appointment",
      description:
        "Busca la próxima cita del negocio asociada al número desde el que llama. Devuelve su bookingId (para cancelarla, o para cambiarla con replacesBookingId en check_availability) y clientName (el nombre con el que se reservó; puede venir vacío en citas antiguas): úsalo si el cliente quiere la cita nueva al mismo nombre. Úsala solo si quien llama pide cambiar o cancelar una cita existente y no te ha dado datos concretos.",
      properties: { idioma: IDIOMA_DE_LA_RESPUESTA },
    },
    {
      name: "cancel_appointment",
      description:
        "Cancela la cita cuyo id devolvió find_my_appointment. Úsala solo si el cliente quiere anularla, tras su confirmación explícita. Para cambiarla no la uses: comprueba la hora nueva con check_availability y replacesBookingId, y la antigua se anula al reservar la nueva.",
      properties: {
        bookingId: {
          type: "string",
          description: "El id de la cita devuelto por find_my_appointment.",
        },
      },
      required: ["bookingId"],
    },
    {
      name: "notify_when_available",
      description:
        "Guarda el aviso de que el cliente quiere que le escribamos por WhatsApp si se libera la hora que pidió y no estaba disponible. Válido tanto si el cliente se va sin reservar nada más como si reserva otra hora igualmente. Úsala solo cuando lo pida explícitamente y haya dado consentimiento para WhatsApp a este número.",
      properties: {
        startDateTime: {
          type: "string",
          description:
            "La hora exacta que el cliente quería y no estaba disponible, en formato ISO 8601 en hora local del negocio con su offset explícito (nunca UTC).",
        },
        durationMinutes: {
          type: "number",
          description: "Duración en minutos de la cita que quería.",
        },
        serviceIds: {
          type: "array",
          items: { type: "string" },
          description:
            "IDs de los servicios que pidió, si los mencionó (opcional).",
        },
        professionalId: {
          type: "string",
          description:
            "ID del profesional concreto que pidió, si lo mencionó (opcional).",
        },
        clientName: {
          type: "string",
          description:
            "Nombre del cliente si ya lo sabes, para reservar a su nombre si se libera la hora.",
        },
      },
      required: ["startDateTime", "durationMinutes"],
    },
  ];
}

/**
 * El informe de una conversación para el negocio (PLAN-CANAL-DUENO.md
 * § 10): resultado, motivo de escalada, recado, dudas sin respuesta… Lo
 * procesa `procesarInformeFinal` (modules/whatsapp/recados.ts), con la
 * idempotencia por call_control_id: el recado (nombre, teléfono, motivo) se
 * convierte en un `Lead` tipo `message` y en el aviso #2 al dueño.
 *
 * En el chat es una tool que la recepcionista llama al despedirse. En las
 * llamadas fue una tool de post-conversación (Telnyx volvía a invocar al
 * assistant tras colgar, con el prompt entero, y llegaba dos veces) hasta el
 * 2026-11-04: ahora el mismo informe lo rellena el backend con la
 * transcripción (jobs/informeDeLlamada.ts), con estas mismas propiedades.
 */
export function buildInformarAlNegocioTool(): DefinicionDeToolDeWebhook {
  return {
    name: "informar_al_negocio",
    description:
      "Informe final de la conversación para el negocio. Llámala UNA sola vez, cuando el cliente se despida o ya no quede nada pendiente. Resume cómo acabó y, si el cliente dejó un recado o pidió que le llamen, inclúyelo en recado.",
    properties: propiedadesDelInformeFinal(),
    required: ["resultado"],
  };
}

/** Las propiedades del informe (el esquema de `postCallReport`): las de la
 * tool del chat y las que rellena el job de las llamadas. */
export function propiedadesDelInformeFinal(): Record<string, unknown> {
  return {
    resultado: {
      type: "string",
      enum: [
        "RESOLVED",
        "FRUSTRATED",
        "NO_ANSWER",
        "ESCALATED",
        "LEAD_CAPTURED",
      ],
      description:
        "RESOLVED si el cliente consiguió lo que quería (reservar, consultar, cancelar); FRUSTRATED si se fue molesto o sin solución; NO_ANSWER si nadie habló o colgó enseguida; ESCALATED si hubo que remitirle al negocio; LEAD_CAPTURED si dejó recado o pidió que le llamen.",
    },
    motivo_escalada: {
      type: "string",
      enum: [
        "CLIENTE_LO_PIDIO",
        "FALLO_TECNICO",
        "FUERA_DE_HORARIO",
        "CONSULTA_COMPLEJA",
        "NO_APLICA",
      ],
      description:
        "Por qué no se resolvió en la llamada. NO_APLICA si se resolvió.",
    },
    fallo_de_tool: {
      type: "boolean",
      description:
        "true si alguna herramienta (disponibilidad, reserva, cancelación) falló o devolvió error durante la llamada.",
    },
    servicio_pedido: {
      type: "string",
      description:
        "Nombre del servicio que pidió el cliente, tal como aparece en el catálogo; vacío si no pidió ninguno.",
    },
    recado: {
      type: "object",
      description:
        "Solo si el cliente dejó un recado explícito o pidió que el negocio le llame. Si no, no lo envíes.",
      properties: {
        nombre: {
          type: "string",
          description: "Nombre que dio el cliente; vacío si no lo dijo.",
        },
        telefono: {
          type: "string",
          description:
            "Teléfono al que quiere que le llamen, SOLO si el cliente lo dictó o confirmó que le llamen al número desde el que llama. Nunca lo rellenes por tu cuenta.",
        },
        motivo: {
          type: "string",
          description:
            "Qué quiere o qué pregunta, en una o dos frases, con sus palabras.",
        },
        quiere_que_le_llamen: {
          type: "boolean",
          description: "true si pidió que el negocio le devuelva la llamada.",
        },
      },
      required: ["motivo"],
    },
    // Para saludarle en su idioma la próxima vez (lib/idiomaDelCliente.ts).
    idioma_del_cliente: {
      type: "string",
      enum: [...CODIGOS_DE_IDIOMA],
      description: `El idioma en que habló quien llama la mayor parte de la llamada: ${CODIGOS_DE_IDIOMA.map(
        (codigo) => `${codigo} ${IDIOMAS[codigo].nombreEnPrompt}`
      ).join(", ")}. Si no llegó a hablar, no lo envíes.`,
    },
    dudas_sin_respuesta: {
      type: "array",
      items: { type: "string" },
      description:
        "Preguntas del cliente que no pudiste responder porque no tenías esa información (formas de pago, aparcamiento, si hacéis algo…), una por elemento y con sus palabras. No incluyas lo que sí respondiste ni lo que era para el negocio (recados, quejas). Si respondiste a todo, no lo envíes.",
    },
  };
}

// Cadena exacta que produce managedAgentPrompt.ts para "hora actual en la
// zona del negocio" — Retell resuelve el patrón anidado
// {{current_time_<timezone>}} de forma nativa. Telnyx tiene el equivalente
// {{telnyx_current_time_<zona IANA>}} (documentado en dynamic-variables ›
// «Timezone variants», ej. {{telnyx_current_time_America/New_York}}), que
// es el que se usa desde el 2026-09-20: hasta entonces se traducía a
// {{telnyx_current_time}} a secas, que Telnyx resuelve en UTC, y el prompt lo
// presentaba como «momento actual en la zona del negocio» — la recepcionista
// iba dos horas atrasada en verano para «dentro de una hora», «ahora mismo»
// (issue #122; visto en un chat de dev: dijo «14:51 hora de Madrid» a las
// 16:51). Si Telnyx no reconoce la zona deja el placeholder sin resolver, por
// eso la zona pasa siempre por resolveManagedPromptTimezone.
// Patrón, no cadena fija: managedAgentPrompt.ts escribe ahora la zona
// literal dentro de la variable de Retell ({{current_time_Europe/Madrid}}).
// La alternativa con llaves internas cubre los prompts antiguos, que siguen
// guardados en la columna systemPrompt de agentes ya creados.
const RETELL_CURRENT_TIME_PATTERN =
  /\{\{current_time_(?:\{\{[^{}]*\}\}\s*|[^{}]*)\}\}/g;

/**
 * Traduce un prompt gestionado escrito con las variables nativas de Retell
 * (managedAgentPrompt.ts) a las variables de sistema de Telnyx — verificado
 * el 2026-09-12 contra la documentación oficial de Telnyx (dynamic-
 * variables): `{{call_control_id}}`, `{{telnyx_end_user_target}}`,
 * `{{telnyx_agent_target}}`, `{{telnyx_current_time}}` son variables de
 * sistema reales, resueltas por Telnyx en cada llamada. Sin esta traducción
 * el prompt le llega a Telnyx con placeholders de Retell que nunca se
 * resuelven (`{{user_number}}`, `{{current_time_{{zona_horaria}}}}`) y se
 * quedan como texto literal — encontrado el 2026-09-12 al revisar la
 * primera llamada real, no documentado en ningún sitio.
 *
 * `{{nombre_negocio}}` no es una variable de sistema de ningún proveedor —
 * es propia de Alhabla, y la resolvía `retell_llm_dynamic_variables` en el
 * webhook de llamada entrante de Retell (retirado el 17-10). Telnyx no tiene
 * ese mecanismo para el flujo normal (ver plan §2: sin
 * `dynamic_variables_webhook_url`), así que aquí se sustituye por el nombre
 * real del negocio en texto plano.
 *
 * `{{zona_horaria}}` también es de Alhabla (dynamic variable de Retell): el
 * prompt gestionado la usa suelta en la regla de zona horaria de las tools
 * (managedAgentPrompt.ts § Uso de herramientas). El reemplazo del patrón
 * anidado de current_time va PRIMERO — contiene `{{zona_horaria}}` dentro, y
 * sustituir la variable suelta antes rompería ese patrón.
 */
export function adaptManagedPromptForTelnyx(
  instructions: string,
  businessName: string,
  timezone?: string | null
): string {
  // Zona IANA válida siempre: con una desconocida Telnyx dejaría
  // {{telnyx_current_time_<zona>}} sin resolver y el agente sin saber qué
  // día es (fecha inventada para «mañana»).
  const zona = resolveManagedPromptTimezone(timezone);
  // En el prompt en JSON (FormatoDelPrompt) el nombre cae dentro de una
  // cadena: unas comillas en «Peluquería "La Rosa"» lo romperían.
  const nombre = instructions.trimStart().startsWith("{")
    ? JSON.stringify(businessName).slice(1, -1)
    : businessName;
  return instructions
    .split("{{nombre_negocio}}")
    .join(nombre)
    .split("{{user_number}}")
    .join("{{telnyx_end_user_target}}")
    .replace(RETELL_CURRENT_TIME_PATTERN, `{{telnyx_current_time_${zona}}}`)
    .split("{{zona_horaria}}")
    .join(zona);
}

/**
 * Transcripción con Soniox para los negocios con catalán, euskera o gallego,
 * que deepgram/flux no reconoce. `language_hints` fija los idiomas del
 * negocio (todos, español incluido) y `language: "auto"` deja que Soniox
 * siga los cambios de idioma dentro de la llamada.
 *
 * Soniox no trae turn-taking propio como flux: el fin de turno lo marca su
 * endpoint detection, apagado por defecto en Telnyx. 500 ms, el mínimo:
 * con llamadas reales (2026-10-03, scripts/medirLatenciaDeTurnos.ts), pasar
 * de 700 a 500 ms y el margen sin puntuación de 0.8 a 0.5 s (abajo) bajó la
 * espera con clientes que hablan catalán de 2100 a 1434 ms (p50), sin más
 * solapes. Aun así queda entre medio segundo y un segundo por encima de
 * flux. `smart_format`/`numerals`/`keyterm` son de Deepgram: las palabras
 * clave van en `context`, su equivalente en Soniox.
 */
function transcripcionDeSoniox(
  pistas: readonly string[],
  boostedKeywords: readonly string[] | undefined
): TranscriptionSettingsInput {
  return {
    ...ajustesDeSoniox(pistas, boostedKeywords),
    // Si Soniox cae, nova-3 (Deepgram) en `multi`: pierde el catalán, el
    // euskera o el gallego, pero la llamada sigue entendiendo español e
    // inglés en vez de quedarse sorda (docs/historico/PLAN-RETIRAR-RETELL.md, PR 7).
    fallback_models: [respaldoDeNova3("multi", boostedKeywords)],
  };
}

function ajustesDeSoniox(
  pistas: readonly string[] | undefined,
  boostedKeywords: readonly string[] | undefined
): RespaldoDeTranscripcion & {
  language: string;
  settings: NonNullable<RespaldoDeTranscripcion["settings"]>;
} {
  return {
    model: "soniox/stt-rt-v5",
    language: "auto",
    settings: {
      ...(pistas?.length ? { language_hints: [...pistas] } : {}),
      ...(boostedKeywords?.length
        ? { context: boostedKeywords.join(",") }
        : {}),
      enable_endpoint_detection: true,
      max_endpoint_delay_ms: 500,
    },
  };
}

/**
 * deepgram/nova-3 como respaldo: el mismo proveedor que flux con otro modelo
 * (sin el fin de turno nativo de flux: lo decide start_speaking_plan) y las
 * mismas palabras clave y formato de números.
 */
function respaldoDeNova3(
  idioma: string,
  boostedKeywords: readonly string[] | undefined
): RespaldoDeTranscripcion {
  return {
    model: "deepgram/nova-3",
    language: idioma,
    settings: {
      ...(boostedKeywords?.length
        ? { keyterm: boostedKeywords.join(",") }
        : {}),
      smart_format: true,
      numerals: true,
    },
  };
}

/** Sonido de oficina de fondo, el mismo en la voz de cada nodo. */
const AUDIO_DE_FONDO = {
  type: "predefined_media",
  value: "office",
  volume: 0.2,
} as const;

/**
 * La voz de la cooficial de la zona (Marta o Sergio) con el idioma de
 * Soniox. Solo queda para contestar a quien habló en ella con la voz
 * cambiada mientras su agente aún no tiene el assistant de la lengua
 * (lib/contextoDeLlamada.ts): ese assistant ya la lleva.
 */
export function vozDeLaCooficial(
  cooficial: Pick<CooficialDeLaZona, "voz" | "iso">
): NonNullable<FlowNodeReq["voice_settings"]> {
  return {
    voice: cooficial.voz.id,
    // El idioma de la voz de Soniox; el SDK no lo declara.
    language: cooficial.iso,
    expressive_mode: false,
    background_audio: AUDIO_DE_FONDO,
  } as NonNullable<FlowNodeReq["voice_settings"]>;
}

/**
 * Lo que se añade al prompt del assistant de llamadas de un negocio de zona
 * cooficial (el de flux y la voz Ultra): cuándo pasar la llamada al de la
 * lengua. Viene del laboratorio del 06-11 (scripts/laboratorioCambioDeIdioma.ts):
 * flux deforma el catalán («Vuldemanar hora por tallarme el Skabels…») pero
 * GLM lo reconoce a la primera. Las palabras de ejemplo, de la lengua de la
 * zona.
 */
export function instruccionesDelCambioDeIdioma(
  cooficial: Pick<CooficialDeLaZona, "idioma">
): string {
  const lengua = IDIOMAS[cooficial.idioma].nombreEnPrompt;
  const ejemplos: Record<string, string> = {
    "ca-ES":
      "«bon dia», «voldria», «demà», «si us plau», «gràcies»; te llega como si fuera italiano o un castellano con palabras raras",
    "gl-ES":
      "«bos días», «quería», «mañá», «grazas», «onte»; te llega como si fuera portugués o un castellano con palabras raras",
    "eu-ES":
      "«kaixo», «egun on», «eskerrik asko», «bihar», «ordua»; te llega como palabras sin sentido",
  };
  return `## ${IDIOMAS[cooficial.idioma].nombreEnPrompt.replace(/^./, (letra) => letra.toUpperCase())}

Tu transcripción no entiende el ${lengua} y tu voz no lo habla. Si quien llama habla en ${lengua} (por ejemplo ${ejemplos[cooficial.idioma] ?? "palabras que no tienen sentido en castellano"}), aunque sea una sola frase o mezclada con castellano, o pide que le atiendas en ${lengua}, llama a cambiar_de_idioma con idioma ${cooficial.idioma} en ese mismo turno: sin decir nada antes, sin pedirle que lo repita y sin usar antes ninguna otra herramienta. En lo_que_dice pon su frase bien escrita en ${lengua} y en primera_respuesta lo que le contestarías en ${lengua}. Después no digas nada más: la llamada sigue en ${lengua}. No le digas que le pasas con nadie: para quien llama es la misma recepcionista.

Con el resto de idiomas que hablas no uses cambiar_de_idioma: contesta tú en el suyo. Si dudas entre italiano y catalán o entre portugués y gallego, y las frases llegan enteras y con sentido en italiano o portugués, es italiano o portugués.`;
}

/**
 * Lo que se añade al prompt del assistant de la lengua cooficial: la llamada
 * le llega empezada (lib/cambioDeIdioma.ts). Su primera frase ya la dijo al
 * arrancar (la frase del cambio y la respuesta que preparó el de flux), y el
 * aviso de IA ya se dio en el saludo.
 */
export function instruccionesDeLaCooficial(
  cooficial: Pick<CooficialDeLaZona, "idioma">
): string {
  const lengua = IDIOMAS[cooficial.idioma].nombreEnPrompt;
  return `## Idioma de esta llamada

Atiendes en ${lengua}. Si la conversación ya ha empezado (hay mensajes antes del tuyo), quien llama ha hablado en ${lengua} y ya le has contestado al cambiar: sigue en ${lengua} con naturalidad, sin saludar otra vez ni repetir lo que ya se ha dicho, y continúa con lo que ha pedido. Si después habla en castellano u otro de tus idiomas, contesta en el suyo.`;
}

export interface BuildTelnyxAssistantPayloadInput {
  businessId: string;
  agentId: string;
  /** Nombre real del negocio — sustituye a `{{nombre_negocio}}` en el
   * prompt (ver adaptManagedPromptForTelnyx). */
  businessName: string;
  /** Zona horaria IANA del negocio — sustituye a `{{zona_horaria}}` en el
   * prompt (regla de startDateTime local de las tools). */
  timezone?: string;
  /** Prompt gestionado completo (managedAgentPrompt.ts) o el prompt manual
   * del negocio. Se traduce
   * automáticamente a las variables de sistema de Telnyx. */
  instructions: string;
  /** Cadena vacía para que el assistant espere a que hable el cliente. */
  greeting: string;
  /** Lo que el idioma decide del payload (resolverIdiomas, en
   * lib/idiomas/resolver.ts): el motor de transcripción con sus pistas, el
   * idioma en que arranca una voz de Soniox (el del principal, la
   * cooficial) y la cooficial de la zona: con ella, el prompt lleva cuándo
   * pasar la llamada a su assistant (instruccionesDelCambioDeIdioma) y
   * quien sincroniza añade la tool cambiar_de_idioma a `toolIds`. */
  idiomas: Pick<PerfilDeIdiomas, "transcripcion" | "isoDeLaVoz"> &
    Partial<Pick<PerfilDeIdiomas, "idiomas" | "cooficialDeLaZona">>;
  /** Identificador Telnyx (`Telnyx.<modelo>.<voz>`), de Soniox
   * (`Soniox.tts-rt-v2.<voz>`) o de ElevenLabs vía `api_key_ref` — resuelto
   * contra la API de voces de la cuenta, no fijo. */
  voice: string;
  /** El grupo de insights vacío de la recepcionista (lib/insightsDeTelnyx.ts):
   * sin él Telnyx pone «Default» y corre sus 6 insights en cada llamada. */
  insightGroupId?: string;
  /** Tools de webhook inline (las demos y el laboratorio). Las
   * recepcionistas de los negocios las llevan de la biblioteca, en
   * `toolIds`. */
  tools?: TelnyxWebhookToolInput[];
  /** Tools de la biblioteca de Telnyx (lib/toolsCompartidas.ts). */
  toolIds?: string[];
  includeHangupTool?: boolean;
  /** Transferencia al dueño (fase 4): con destino se añade la tool nativa
   * `transfer`; sin él (ajuste «nunca» o sin móvil válido) no se registra.
   * Lo resuelve `resolverTransferenciaAlDueno` (lib/transferenciaAlDueno.ts). */
  transferenciaAlDueno?: { from: string; to: string } | null;
  /** Nombres de servicios/profesionales para sesgar la transcripción. */
  boostedKeywords?: string[];
  maxCallDurationSecs?: number;
  userIdleTimeoutSecs?: number;
  userIdleReplySecs?: number;
}

// Los mismos límites que tenía el agente de Retell: una recepcionista de
// reservas no necesita más de 10 minutos, y 30s de silencio
// ya indica que el cliente colgó o dejó el teléfono descolgado.
const DEFAULT_MAX_CALL_DURATION_SECS = 10 * 60;
const DEFAULT_USER_IDLE_TIMEOUT_SECS = 30;
// A mitad del timeout total: da tiempo a que el cliente reaccione a un
// "¿sigues ahí?" antes del corte a los 30s. Sin este campo (encontrado
// 2026-09-15, nunca configurado) el agente se queda completamente callado
// durante los 30s de silencio y luego cuelga sin avisar — una recepcionista
// real pregunta antes de darse por vencida.
const DEFAULT_USER_IDLE_REPLY_SECS = 12;

export function buildTelnyxAssistantPayload(
  input: BuildTelnyxAssistantPayloadInput
): CreateTelnyxAssistantInput {
  const tools: Array<TelnyxWebhookTool | HangupTool | TelnyxTransferTool> = (
    input.tools ?? []
  ).map((tool) =>
    toTelnyxWebhookTool(conFraseDeEspera(tool, input.idiomas.isoDeLaVoz))
  );

  if (input.transferenciaAlDueno) {
    tools.push(
      buildTelnyxTransferTool({
        from: input.transferenciaAlDueno.from,
        to: input.transferenciaAlDueno.to,
        businessName: input.businessName,
      })
    );
  }

  if (input.includeHangupTool ?? true) {
    tools.push(
      // Telnyx solo deja cambiar la descripción: es lo que el modelo ve de la
      // tool. Con la de antes («cuando la conversación haya terminado») se
      // despedía y no colgaba (laboratorio y AI Tests del 03-11).
      buildTelnyxHangupTool(
        "Cuelga la llamada. Llámala en el mismo turno en que te despides, justo después de tu frase de despedida: si no, la llamada se queda abierta y el cliente espera en silencio. También cuando te pidan colgar con claridad."
      )
    );
  }

  const transcripcion = input.idiomas.transcripcion;
  const soniox = transcripcion.motor === "soniox";

  return {
    name: buildTelnyxAssistantName(input.businessId, input.agentId),
    instructions: adaptManagedPromptForTelnyx(
      input.idiomas.cooficialDeLaZona
        ? `${input.instructions.trimEnd()}\n\n${instruccionesDelCambioDeIdioma(input.idiomas.cooficialDeLaZona)}`
        : input.instructions,
      input.businessName,
      input.timezone
    ),
    greeting: input.greeting,
    // Decisión explícita del usuario 2026-09-12: sin fijar `model`, Telnyx
    // aplicaba su default de cuenta (moonshotai/Kimi-K2.6). Se probó
    // cambiar a gpt-5.6-luna esperando abaratar la llamada, pero una
    // llamada de prueba real confirmó que el bloque `ai-voice-assistant`
    // (LLM+STT+TTS) factura una TARIFA PLANA de $0.05 por minuto
    // (redondeado a bloques de 60s) sin importar el modelo — mismo coste
    // exacto con Kimi-K2.6 y con gpt-5.6-luna en llamadas de duración
    // comparable. El modelo NO afecta al coste. La única palanca real de
    // coste es la duración de la llamada.
    //
    // Desde el 2026-11-02, zai-org/GLM-5.3-Flash (decisión del usuario). Lo
    // aloja Telnyx (antes gpt-5.6-luna, de OpenAI y fuera del EEE;
    // docs/auditorias/2026-10-16-pipelines-ue-y-datos.md) y es el único
    // modelo de assistants que Telnyx sirve en la región EU con
    // `privacy_settings.in_transit_data_locality` (Kimi-K2.6 no está en EU:
    // 422/10027 medido el 02-11). En el laboratorio de prompt
    // (laboratorioDePrompt.ts) acierta como luna (~80 %) y contesta unas
    // tres veces más rápido (~1,2 s por turno frente a ~3,9 s).
    model: "zai-org/GLM-5.3-Flash",
    // Kimi-K2.6 también es de Telnyx (`owned_by: "Telnyx"`), no exige una
    // Integration Secret y es el modelo validado con llamadas reales antes
    // de luna. No se sirve en EU: si algún día se activa
    // `in_transit_data_locality`, el respaldo tendrá que ser otro.
    fallbackConfig: { model: "moonshotai/Kimi-K2.6" },
    // voice_speed retirado (encontrado 2026-09-14): la propia documentación
    // del SDK dice "only applicable for Telnyx Natural voices" — la cuenta
    // usa una voz Telnyx ULTRA (Blanca - Graceful Host), así que el 1.1x
    // fijado el 2026-09-12 nunca tuvo efecto real, pese a documentarse como
    // "decisión explícita del usuario". Pendiente decidir con el usuario si
    // se cambia a una voz Natural (si el ritmo más rápido importa más que
    // Ultra) o se acepta la velocidad por defecto de Ultra.
    // expressive_mode=true: SOLO disponible en voces Ultra/XAI — añade
    // matices emocionales vía SSML de forma automática, sin intervención
    // nuestra en el texto. Coste cero, más natural. Hallazgo real
    // (2026-09-14): el comentario original asumía "la cuenta usa una voz
    // Telnyx Ultra" como si fuera universal, pero `resolveTelnyxEligibility`
    // asigna voces de un pool compartido — un negocio con una voz Natural (no
    // Ultra/XAI) recibía expressive_mode:true igualmente y Telnyx rechazaba
    // el `updateAssistant` entero con 400/10015, dejando ese negocio sin
    // sincronizar (confirmado con la barbería de prueba). Ahora se activa
    // solo si la voz asignada lo soporta.
    // background_audio "office" a volumen bajo (0.2 de 1.0, decisión
    // explícita del usuario 2026-09-14): sonido de oficina de fondo muy
    // sutil en vez de silencio total — silencio absoluto puede sonar
    // artificial en una llamada real.
    voiceSettings: {
      voice: input.voice,
      // Las voces de Soniox hablan todos los idiomas: arrancan en el
      // principal, la cooficial. Las Ultra tienen el suyo.
      ...(input.voice.startsWith("Soniox.")
        ? { language: input.idiomas.isoDeLaVoz }
        : {}),
      expressive_mode:
        input.voice.startsWith("Telnyx.Ultra.") ||
        input.voice.startsWith("XAI."),
      background_audio: AUDIO_DE_FONDO,
    },
    // deepgram/flux — decisión explícita del usuario 2026-09-12: mejor
    // detección de turno de palabra (end-of-turn/eager end-of-turn) que
    // nova-3. Sigue siendo Deepgram (nativo de Telnyx, sin api_key_ref
    // propia) — no confundir con azure/fast o google/*, proveedores
    // EXTERNOS que exigen tu propia clave (Integration Secret) para
    // funcionar de verdad; sin ella se configuran sin error pero no
    // procesan audio (ver Second-Brain, Bitácora § STT: proveedores nativos
    // vs externos, y issues #18/#19 de GitHub). `keyterm` sigue soportado
    // en flux igual que en nova-3.
    //
    // eot_threshold/eot_timeout_ms/eager_eot_threshold (verificado contra la
    // documentación oficial de Telnyx, 2026-09-14): flux es un modelo con
    // turn-taking propio, por lo que interruption_settings.start_speaking_plan
    // NO decide el fin de turno aquí (solo aplica a modelos sin turn-taking) —
    // se fijan explícitamente en vez de dejarlos en el default de cuenta para
    // no depender de que Telnyx no los cambie sin avisar. eot_threshold=0.8 y
    // eot_timeout_ms=5000 son justo los defaults documentados por Telnyx (ya
    // conservadores contra cortar a quien llama a mitad de frase);
    // eager_eot_threshold=0.4 (su propio default) habilita el procesamiento
    // especulativo del LLM — el agente responde más rápido en cuanto detecta
    // fin de turno sin bajar el umbral de confianza real, así que no aumenta
    // el riesgo de interrumpir, solo reduce la latencia percibida.
    transcription: soniox
      ? transcripcionDeSoniox(transcripcion.pistas, input.boostedKeywords)
      : {
          model: "deepgram/flux",
          language: transcripcion.idioma,
          // Respaldo si flux falla al empezar o a mitad de llamada
          // (docs/historico/PLAN-RETIRAR-RETELL.md, PR 7; validado contra la API el 18-10
          // con los ocho idiomas de flux y `multi`): nova-3, del mismo
          // proveedor, y después Soniox, que cubre una caída entera de
          // Deepgram. Telnyx exige que todos sean de streaming.
          fallback_models: [
            respaldoDeNova3(transcripcion.idioma, input.boostedKeywords),
            ajustesDeSoniox(
              transcripcion.idioma === "multi"
                ? undefined
                : [transcripcion.idioma],
              input.boostedKeywords
            ),
          ],
          settings: {
            ...(input.boostedKeywords?.length
              ? { keyterm: input.boostedKeywords.join(",") }
              : {}),
            eot_threshold: 0.8,
            eot_timeout_ms: 5000,
            eager_eot_threshold: 0.4,
            // smart_format/numerals (Deepgram, aplican a flux): formatea fechas,
            // horas, teléfonos y números como se escriben, no como se dictan
            // ("quince de marzo a las tres" → "15 de marzo a las 3") — ayuda
            // tanto a la transcripción legible para el negocio como a que el
            // propio modelo interprete bien lo que acaba de transcribir antes
            // de llamar a check_availability/book_appointment.
            smart_format: true,
            numerals: true,
          },
        },
    // wait_seconds=0.1: recomendación explícita de Telnyx para flux ("Flux
    // works best with low start speaking delays, such as 0.1 seconds for
    // wait time") — es solo un suelo mínimo antes de que el agente pueda
    // empezar a hablar, no decide si el turno terminó (eso lo hace
    // transcription.settings de arriba), así que no aumenta el riesgo de
    // cortar a quien llama.
    //
    // interrupt_prediction_threshold=0.4 (verificado contra la documentación
    // y release notes de Telnyx, 2026-09-14): feature "Interruption
    // Prediction", solo con deepgram/flux — por debajo del umbral, un "sí"/
    // "mmhm"/"vale" sueltos del cliente no cortan al agente a mitad de
    // frase (la propia Telnyx lo describe como "una de las razones más
    // comunes por las que las llamadas de voz con IA se sienten rotas").
    // Mismo problema que se arregló en Retell bajando
    // interruptionSensitivity a 0.65; esta es la versión nativa de Telnyx. Por defecto viene
    // desactivado (0.0); 0.4 es el punto de partida que la propia Telnyx
    // recomienda, subir para exigir más confianza (menos interrupciones
    // falsas) o bajar para un barge-in más permisivo.
    //
    // Con Soniox la predicción de interrupciones no existe (es de flux) y
    // el fin de turno lo marcan su endpoint detection y el
    // transcription_endpointing_plan de Telnyx, que solo aplica a modelos sin
    // turn-taking. Sus defaults (0.4 s de espera y 1.5 s si la frase acaba
    // sin puntuación) se notaban lentos frente a flux en la prueba del
    // 2026-10-02: la espera, la de flux; sin puntuación, 0.5 s (medido con
    // llamadas reales el 2026-10-03, ver transcripcionDeSoniox); con
    // puntuación y con número, los defaults de Telnyx.
    //
    // El saludo no se puede cortar: lleva el aviso de IA (Reglamento europeo
    // de IA, art. 50) y, si toca, el de grabación, y tienen que oírse
    // enteros. Telnyx pone este caso de ejemplo en su guía de interrupciones.
    interruptionSettings: soniox
      ? {
          disable_greeting_interruption: true,
          start_speaking_plan: {
            wait_seconds: 0.1,
            transcription_endpointing_plan: {
              on_punctuation_seconds: 0.1,
              on_no_punctuation_seconds: 0.5,
              on_number_seconds: 0.5,
            },
          },
        }
      : {
          disable_greeting_interruption: true,
          start_speaking_plan: { wait_seconds: 0.1 },
          interrupt_prediction_threshold: 0.4,
        },
    telephonySettings: {
      // MP3 y no WAV (issue #280): el WAV de Telnyx es PCM sin comprimir
      // (en producción 8 kHz, 16 bits, dos canales: 1,9 MB por minuto; el MP3
      // pesa ~0,24 MB por minuto, 8 veces menos, medido el 12-10-2026) y cada
      // grabación pasa por Cloud Run al copiarla a R2, que es salida a
      // internet de pago. Telnyx solo da la URL del formato con el que se grabó. Se
      // mantienen los dos canales (uno por interlocutor).
      // Grabación con permiso (13-10-2026, lib/grabacion.ts): el assistant
      // no graba por su cuenta. Se graba por llamada, con `record` al
      // contestar (cliente que ya lo aceptó) o `record_start` cuando lo
      // acepta, en el mismo formato.
      recording_settings: {
        enabled: false,
        format: "mp3",
        channels: "dual",
        stop_on_conversation_end: true,
      },
      user_idle_timeout_secs:
        input.userIdleTimeoutSecs ?? DEFAULT_USER_IDLE_TIMEOUT_SECS,
      user_idle_reply_secs:
        input.userIdleReplySecs ?? DEFAULT_USER_IDLE_REPLY_SECS,
      time_limit_secs:
        input.maxCallDurationSecs ?? DEFAULT_MAX_CALL_DURATION_SECS,
      // Desactivado a propósito (antes "krisp"): el audio entrante ya se
      // limpia por llamada vía Call Control con el motor AiCoustics/quail,
      // específico para Voice AI/STT (ver TelnyxAiAdapter.startNoiseSuppression,
      // 2026-09-14) — tener los dos motores encadenados sobre el mismo audio
      // es redundante en el mejor caso y puede degradar la señal en el peor.
      noise_suppression: "disabled",
      // Sin este campo (verificado en vivo el 2026-09-11, NO documentado en
      // el tipo TelephonySettings del SDK) la API nunca rellena
      // ai.conversations.messages para llamadas de voz — el historial vuelve
      // vacío aunque hubiera conversación real.
      send_conversation_message_events: true,
      // `call.conversation.ended` trae entera la conversación, tools y sus
      // resultados incluidos y sin redactar: es de donde sale la
      // transcripción que ve el dueño (adapters/telnyx/transcripcion.ts),
      // porque la copia de Telnyx va redactada (pii_redaction, abajo).
      conversation_ended_full_history: true,
      // Si la conversación con la IA acaba mal (en la prueba del 18-10, tres
      // fallos seguidos del LLM, unos 40 s de silencio), Telnyx pasa la
      // llamada a este número en vez de dejar al cliente sin nadie. Solo
      // cuando el dueño acepta que le pasen llamadas (regla (a) de
      // docs/historico/PLAN-RETIRAR-RETELL.md, PR 6): el mismo destino que la tool
      // `transfer`, y la pata sale, como la de la tool, con el número de
      // Alhabla. No salta si el cliente cuelga, si el assistant termina bien
      // o si ya transfirió. Siempre se manda: Telnyx mezcla
      // telephony_settings, y omitirlo dejaría el destino anterior de un
      // dueño que ya no quiere llamadas; `null` lo borra.
      fallback_destination: input.transferenciaAlDueno?.to ?? null,
    },
    // Verificado en vivo el 2026-09-11: Telnyx rechaza recording_settings.
    // enabled=true si data_retention=false ("Cannot enable recording when
    // data retention is disabled"). El diseño original de
    // docs/historico/PLAN-TELNYX-ORQUESTADOR.md ("memoria bajo control de Alhabla, sin
    // recuperación nativa de Telnyx") es incompatible con tener
    // grabación/transcripción a la vez — decisión explícita del usuario
    // 2026-09-11: igual que con Retell (dataStorageRetentionDays=30),
    // aceptar que Telnyx retenga temporalmente la conversación además de
    // que Alhabla descargue su propia copia. Duración real de esa
    // retención en Telnyx: sin confirmar todavía (no hay un campo de días
    // como en Retell, solo este booleano) — pendiente de la Fase 0.
    //
    // pii_redaction (2026-11-02): lo que Telnyx guarda (transcripción,
    // argumentos de las tools, insights) sale con <PII:name/>,
    // <PII:phone/>, <PII:email_address/>, <PII:address/>… en vez de los
    // datos del cliente. Probado por voz en español. La llamada en vivo, las
    // tools y el webhook de fin de conversación los siguen recibiendo
    // enteros; la grabación no cambia. Solo se aplica a las llamadas: las
    // conversaciones de chat que crea Alhabla (WhatsApp) no lo heredan, y
    // Telnyx rechaza con 400 la combinación con `enabled_features`
    // messaging, que estos assistants no usan.
    privacySettings: { data_retention: true, pii_redaction: "redact" },
    insightGroupId: input.insightGroupId,
    // Sin post-conversación desde el 2026-11-04: era una pasada más del
    // modelo, con el prompt entero, solo para llamar a informar_al_negocio
    // (y llegaba dos veces). El informe lo rellena el backend al colgar con
    // la transcripción sin redactar (jobs/informeDeLlamada.ts). `false` y no
    // ausente: Telnyx mezcla el campo y los assistants de antes lo tienen.
    postConversationSettings: { enabled: false },
    // Lo de quien llama lo manda el backend en cada llamada
    // (lib/contextoDeLlamada.ts); estos valores quedan para una llamada en
    // la que no se pudo mirar nada.
    dynamicVariables: { ...VARIABLES_DE_LA_LLAMADA_POR_DEFECTO },
    tools,
    ...(input.toolIds ? { toolIds: input.toolIds } : {}),
    // Sin nodos desde el 2026-11-06: la cooficial de la zona tiene su
    // assistant. null y no ausente: así los de antes pierden el suyo
    // («inicial» y «cooficial», que cambiaba la voz) al sincronizar.
    conversationFlow: null,
  };
}

/**
 * El assistant de la lengua cooficial de la zona de un agente (tipo
 * «recepcionista_cooficial»): el mismo que el de llamadas (prompt con todos
 * sus idiomas, tools, telefonía) con la transcripción de Soniox y la voz de
 * la lengua (Marta o Sergio), como la variante S del 14-10 que atendía
 * antes toda la llamada: catalán perfecto, con 2–4 s de espera por turno. Sin
 * cambiar_de_idioma: Soniox entiende también el castellano y la voz lo habla.
 * Sin saludo propio: lo pone cada llamada (lib/cambioDeIdioma.ts y
 * handleCallInitiated para quien ya habló en la lengua).
 */
export function buildTelnyxCooficialAssistantPayload(
  input: Omit<BuildTelnyxAssistantPayloadInput, "greeting" | "voice"> & {
    cooficial: CooficialDeLaZona;
  }
): CreateTelnyxAssistantInput {
  const payload = buildTelnyxAssistantPayload({
    ...input,
    instructions: `${input.instructions.trimEnd()}\n\n${instruccionesDeLaCooficial(input.cooficial)}`,
    greeting: "",
    voice: input.cooficial.voz.id,
    idiomas: {
      transcripcion: input.cooficial.transcripcion,
      isoDeLaVoz: input.cooficial.iso,
      idiomas: input.idiomas.idiomas,
      cooficialDeLaZona: null,
    },
  });
  return {
    ...payload,
    name: buildTelnyxCooficialAssistantName(input.businessId, input.agentId),
  };
}

export interface BuildTelnyxChatAssistantPayloadInput {
  businessId: string;
  agentId: string;
  businessName: string;
  timezone?: string;
  /** El prompt de chat (buildManagedAgentPrompt con `canal: "chat"`) o el
   * manual del negocio. */
  instructions: string;
  insightGroupId?: string;
  /** Inline (laboratorio) o de la biblioteca (`toolIds`), como en voz. */
  tools?: TelnyxWebhookToolInput[];
  toolIds?: string[];
}

/**
 * El assistant del chat de clientes por WhatsApp (tipo «recepcionista_chat»,
 * lib/tiposDeAsistente.ts): lo usa `ai.assistants.chat` desde
 * modules/whatsapp/chatCliente.ts. Solo prompt, modelo y tools: sin voz,
 * transcripción, telefonía, saludo, flujo de idiomas ni hangup/transfer, y
 * con `enabled_features` vacío (comprobado contra la API el 2026-11-04: el
 * chat contesta igual). Las tools son las mismas de la biblioteca que las de
 * voz, más informar_al_negocio y menos la grabación.
 */
export function buildTelnyxChatAssistantPayload(
  input: BuildTelnyxChatAssistantPayloadInput
): CreateTelnyxAssistantInput {
  return {
    name: buildTelnyxChatAssistantName(input.businessId, input.agentId),
    instructions: adaptManagedPromptForTelnyx(
      input.instructions,
      input.businessName,
      input.timezone
    ),
    // El mismo modelo y respaldo que la voz (ver buildTelnyxAssistantPayload).
    model: "zai-org/GLM-5.3-Flash",
    fallbackConfig: { model: "moonshotai/Kimi-K2.6" },
    enabledFeatures: [],
    // Sin pii_redaction: no se aplica a las conversaciones que crea Alhabla
    // (ver la voz).
    privacySettings: { data_retention: true },
    insightGroupId: input.insightGroupId,
    tools: (input.tools ?? []).map((tool) => toTelnyxWebhookTool(tool)),
    ...(input.toolIds ? { toolIds: input.toolIds } : {}),
    // Un assistant de chat no tiene nodos: null por si se creó con otro
    // payload.
    conversationFlow: null,
  };
}
