import {
  buildTelnyxAssistantName,
  buildTelnyxChatAssistantName,
  buildTelnyxCooficialAssistantName,
  buildTelnyxChatTools,
  buildTelnyxVoiceTools,
  CANAL_DE_TOOLS_DE_VOZ,
  type CanalDeTools,
  type TelnyxWebhookToolInput,
} from "./telnyxAssistantPayload.js";
import {
  buildGestorTools,
  CANAL_DE_TOOLS_DEL_GESTOR,
  GESTOR_ASSISTANT_NAME,
} from "./gestorPayload.js";

/**
 * Registro ÚNICO de los tipos de asistente de IA de Alhabla. Cada tipo dice
 * cómo se llama su assistant en Telnyx, por qué canal le llegan las tools
 * (ruta + cabeceras de identidad), qué tools tiene, cómo se sincroniza y por
 * dónde habla. Los builders de payload (telnyxAssistantPayload.ts,
 * gestorPayload.ts) y los sincronizadores (telnyxAgentSync.ts,
 * gestorSync.ts) siguen siendo los que hablan con el adaptador; este
 * registro es el mapa que hay que ampliar para añadir un tipo nuevo — ver
 * AGENTS.md § «Cómo añadir un nuevo tipo de asistente».
 *
 * Solo metadatos y referencias a funciones puras: nada aquí llama a Telnyx
 * ni cambia lo que se le envía.
 */

export type ClaveDeTipoDeAsistente =
  | "recepcionista"
  | "recepcionista_cooficial"
  | "recepcionista_chat"
  | "demo"
  | "gestor";

export interface TipoDeAsistente {
  clave: ClaveDeTipoDeAsistente;
  descripcion: string;
  /** Uno por agente de negocio, uno por entorno, o reutiliza otro tipo. */
  ambito: "por_agente" | "plataforma" | "reutiliza_recepcionista";
  /** Canales por los que habla con personas. */
  canales: ReadonlyArray<"voz" | "whatsapp" | "web">;
  /** Proveedor que lo atiende. */
  proveedores: { principal: "telnyx" };
  /** Canal de sus tools de webhook (null si no tiene tools propias). */
  canalDeTools: CanalDeTools | null;
  /** Nombre (o prefijo) del assistant en Telnyx: permite reconciliar y
   * comprobar que un id apunta al tipo esperado. */
  nombreEnTelnyx: (ids: { businessId: string; agentId: string }) => string;
  /** Tools de webhook del tipo (sin las nativas hangup/transfer, que añade
   * el builder del payload). */
  tools: ((baseUrl: string) => TelnyxWebhookToolInput[]) | null;
  /** Dónde vive su sincronización con el proveedor. */
  sincronizacion: string;
}

/** Prefijo de los assistants aislados de la demo pública (los crea
 * scripts/crearAssistantsDemoAislados.ts). */
export const PREFIJO_ASSISTANT_DE_DEMO = "alhabla-demo-";

export const TIPOS_DE_ASISTENTE: Readonly<
  Record<ClaveDeTipoDeAsistente, TipoDeAsistente>
> = {
  recepcionista: {
    clave: "recepcionista",
    descripcion:
      "Recepcionista de un negocio en sus llamadas: el assistant del número (Agent.telnyxAssistantId), con el prompt de voz.",
    ambito: "por_agente",
    canales: ["voz"],
    proveedores: { principal: "telnyx" },
    canalDeTools: CANAL_DE_TOOLS_DE_VOZ,
    nombreEnTelnyx: ({ businessId, agentId }) =>
      buildTelnyxAssistantName(businessId, agentId),
    tools: buildTelnyxVoiceTools,
    sincronizacion:
      "lib/telnyxAgentSync.ts (Telnyx, por hash del payload; tools de la biblioteca, lib/toolsCompartidas.ts)",
  },
  // Desde el 2026-11-06, en una zona cooficial (lib/idiomas/zona.ts): la
  // llamada empieza en el de voz (flux, rápido) y el backend cambia a este
  // si quien llama habla la lengua (lib/cambioDeIdioma.ts). Mismas tools de
  // la biblioteca que el de voz, sin cambiar_de_idioma.
  recepcionista_cooficial: {
    clave: "recepcionista_cooficial",
    descripcion:
      "Recepcionista de un negocio de zona cooficial cuando quien llama habla la lengua (catalán, gallego o euskera): Agent.telnyxCooficialAssistantId, con Soniox y la voz de Marta o Sergio. Lo arranca el backend a mitad de llamada (lib/cambioDeIdioma.ts) o al contestar a quien ya habló en ella.",
    ambito: "por_agente",
    canales: ["voz"],
    proveedores: { principal: "telnyx" },
    canalDeTools: CANAL_DE_TOOLS_DE_VOZ,
    nombreEnTelnyx: ({ businessId, agentId }) =>
      buildTelnyxCooficialAssistantName(businessId, agentId),
    tools: buildTelnyxVoiceTools,
    sincronizacion:
      "lib/telnyxAgentSync.ts, junto al de voz del mismo agente (lo crea si falta y lo borra si el negocio deja la zona)",
  },
  // Aparte del de voz desde el 2026-11-04: hasta entonces el mismo assistant
  // atendía las dos cosas y cada pasada del modelo releía las reglas del
  // otro canal. Mismo agente, mismas tools de reservar (las mismas de la
  // biblioteca) y el mismo canal de tools: el backend distingue el chat por
  // su Call sintética `whatsapp:chat:…`.
  recepcionista_chat: {
    clave: "recepcionista_chat",
    descripcion:
      "Recepcionista de un negocio en el chat de clientes por WhatsApp (modules/whatsapp/chatCliente.ts): Agent.telnyxChatAssistantId, con el prompt de chat, sin voz ni telefonía.",
    ambito: "por_agente",
    canales: ["whatsapp"],
    proveedores: { principal: "telnyx" },
    canalDeTools: CANAL_DE_TOOLS_DE_VOZ,
    nombreEnTelnyx: ({ businessId, agentId }) =>
      buildTelnyxChatAssistantName(businessId, agentId),
    tools: buildTelnyxChatTools,
    sincronizacion:
      "lib/telnyxAgentSync.ts, junto al de voz del mismo agente (lo crea si falta)",
  },
  demo: {
    clave: "demo",
    descripcion:
      "Demo pública de la landing: assistants aislados por nicho, llamadas web sin autenticar (modules/demo/routes.ts).",
    ambito: "reutiliza_recepcionista",
    canales: ["web"],
    proveedores: { principal: "telnyx" },
    canalDeTools: CANAL_DE_TOOLS_DE_VOZ,
    nombreEnTelnyx: () => PREFIJO_ASSISTANT_DE_DEMO,
    tools: buildTelnyxVoiceTools,
    sincronizacion:
      "scripts/crearAssistantsDemoAislados.ts (una vez); la ruta de demo solo reafirma supports_unauthenticated_web_calls",
  },
  gestor: {
    clave: "gestor",
    descripcion:
      "Gestor: asistente único de plataforma con el que chatea el dueño por WhatsApp (modules/whatsapp/chatDueno.ts, modules/gestor).",
    ambito: "plataforma",
    canales: ["whatsapp"],
    proveedores: { principal: "telnyx" },
    canalDeTools: CANAL_DE_TOOLS_DEL_GESTOR,
    nombreEnTelnyx: () => GESTOR_ASSISTANT_NAME,
    tools: buildGestorTools,
    sincronizacion:
      "lib/gestorSync.ts (reconciliador diario y scripts/manual/sincronizarGestor.mts)",
  },
};
