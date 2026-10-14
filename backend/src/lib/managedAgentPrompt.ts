import { z } from "zod";
import type { BusinessType } from "./businessType.js";
import {
  MODOS_DE_TRANSFERENCIA,
  type TransferenciaAlDueno,
} from "./transferenciaAlDueno.js";
import {
  GENEROS_DE_VOZ,
  idiomasQueHabla,
  type CodigoDeIdioma,
  type GeneroDeVoz,
} from "./idiomas/catalogo.js";
import {
  EsquemaDeIdiomaPrincipal,
  EsquemaDeIdiomas,
  EsquemaDeVoz,
  idiomasConocidos,
  normalizarIdiomas,
} from "./idiomas/ajustes.js";
import { instruccionesDeIdioma, resolverIdiomas } from "./idiomas/resolver.js";
import { componerPrompt } from "./seccionesDelPrompt.js";

// Lo que otros módulos importan de aquí desde antes de partir el prompt en
// secciones.
export {
  buildTransferInstruction,
  TITULO_DEL_BLOQUE_DE_TRANSFERENCIA,
  TITULO_DEL_BLOQUE_DEL_CATALOGO,
} from "./seccionesDelPrompt.js";

/** Los campos de AgentSettings por separado: parseAgentSettings los lee
 * uno a uno para que un valor inválido no se lleve por delante el resto. */
const CAMPOS_DE_AJUSTES = {
  version: z.literal(1),
  tone: z.enum(["warm", "professional", "direct"]),
  primaryGoal: z.enum(["bookings", "customer_service", "lead_capture"]),
  responseStyle: z.enum(["concise", "balanced"]),
  escalation: z.enum(["take_message", "request_callback"]),
  // .default() para que los agentSettings ya guardados de negocios existentes
  // (sin este campo) sigan validando y no caigan al fallback completo de
  // DEFAULT_AGENT_SETTINGS, que resetearía también tono/objetivo/etc.
  voiceGender: z.enum(GENEROS_DE_VOZ).default("femenina"),
  // Los idiomas que habla (catálogo en lib/idiomas/catalogo.ts). Desde el
  // 2026-10-05 no se eligen: se guardan los que van con el principal
  // (normalizarIdiomas), para que todo lo que lee `languages` siga igual.
  // Los negocios anteriores a los idiomas no los tienen: los del español.
  languages: EsquemaDeIdiomas.default(["es-ES"]),
  // El idioma principal: en él saluda y de él salen la voz y los idiomas
  // que habla (decisión del usuario del 2026-10-05; ver idiomasQueHabla y
  // familiaDeVoces en lib/idiomas/catalogo.ts). El campo conserva su nombre
  // histórico (antes «idioma de la voz») para no migrar el JSON.
  voiceLanguage: EsquemaDeIdiomaPrincipal.default("es-ES"),
  // La voz que eligió el dueño entre las de su principal (desde el
  // 2026-10-03). Sin valor, la primera de su género: así un negocio que no
  // elige sigue con la de siempre y recibe las mejoras del catálogo.
  voz: EsquemaDeVoz.optional(),
  // «Cuándo pasarme llamadas» (docs/historico/PLAN-TELEFONIA-UX.md § 5,
  // fase 4). Sin
  // valor = el de por defecto según el negocio (modoDeTransferenciaPorDefecto
  // en lib/transferenciaAlDueno.ts): «si el cliente lo pide» con Alhabla
  // como número principal y móvil del dueño, «nunca» en el resto. Se deja
  // opcional a propósito, sin .default(): así pasar a «Alhabla como
  // principal» activa la transferencia sin tener que reescribir el ajuste.
  pasarLlamadas: z.enum(MODOS_DE_TRANSFERENCIA).optional(),
};

export const AgentSettingsSchema = z
  .object(CAMPOS_DE_AJUSTES)
  // El principal manda y `languages` sale de él (normalizarIdiomas): un
  // principal que no está en los `languages` recibidos no se rechaza.
  .transform((settings) => {
    const { languages, voiceLanguage } = normalizarIdiomas(settings);
    return conVozValida({ ...settings, languages, voiceLanguage });
  });

/**
 * La voz elegida se guarda solo si atiende de verdad: de las de su
 * principal y hablando todos sus idiomas (si no, la vista previa ya enseñó
 * cuál atenderá y se olvida la elección). El género, el de la voz.
 */
function conVozValida<
  T extends {
    languages: CodigoDeIdioma[];
    voiceLanguage: CodigoDeIdioma;
    voiceGender: GeneroDeVoz;
    voz?: string;
  },
>(ajustes: T): T {
  if (ajustes.voz === undefined) return ajustes;
  const perfil = resolverIdiomas(ajustes);
  if (perfil.voz.id !== ajustes.voz) {
    const sinVoz = { ...ajustes };
    delete sinVoz.voz;
    return sinVoz;
  }
  return { ...ajustes, voiceGender: perfil.voz.genero };
}

export type AgentSettings = z.infer<typeof AgentSettingsSchema>;

export const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  version: 1,
  tone: "warm",
  primaryGoal: "bookings",
  responseStyle: "concise",
  escalation: "take_message",
  voiceGender: "femenina",
  languages: idiomasQueHabla("es-ES"),
  voiceLanguage: "es-ES",
};

/**
 * AgentSettings guardados → válidos. Si todo valida, tal cual (normalizado:
 * los idiomas, los de su principal). Si no, campo a campo: cada campo
 * inválido toma su valor por defecto y de los idiomas guardados se miran
 * los códigos conocidos (una cooficial entre ellos pasa a ser el
 * principal). Antes un solo valor inválido (p. ej. un idioma retirado)
 * devolvía DEFAULT_AGENT_SETTINGS entero y borraba también tono, objetivo y
 * el resto. Un plan que ya no incluye el principal guardado no lo cambia:
 * el plan se mira al escribir.
 */
export function parseAgentSettings(value: unknown): AgentSettings {
  const completo = AgentSettingsSchema.safeParse(value);
  if (completo.success) return completo.data;

  const bruto =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const campo = <T>(esquema: z.ZodType<T>, valor: unknown, porDefecto: T): T => {
    const leido = esquema.safeParse(valor);
    return leido.success ? leido.data : porDefecto;
  };
  const porDefecto = DEFAULT_AGENT_SETTINGS;
  const { languages, voiceLanguage } = normalizarIdiomas({
    languages: idiomasConocidos(bruto.languages),
    voiceLanguage: campo(
      EsquemaDeIdiomaPrincipal,
      bruto.voiceLanguage,
      porDefecto.voiceLanguage
    ),
  });
  const pasarLlamadas = campo(
    CAMPOS_DE_AJUSTES.pasarLlamadas,
    bruto.pasarLlamadas,
    undefined
  );
  const voz = campo(CAMPOS_DE_AJUSTES.voz, bruto.voz, undefined);
  return conVozValida({
    version: 1,
    tone: campo(CAMPOS_DE_AJUSTES.tone, bruto.tone, porDefecto.tone),
    primaryGoal: campo(
      CAMPOS_DE_AJUSTES.primaryGoal,
      bruto.primaryGoal,
      porDefecto.primaryGoal
    ),
    responseStyle: campo(
      CAMPOS_DE_AJUSTES.responseStyle,
      bruto.responseStyle,
      porDefecto.responseStyle
    ),
    escalation: campo(
      CAMPOS_DE_AJUSTES.escalation,
      bruto.escalation,
      porDefecto.escalation
    ),
    voiceGender: campo(
      z.enum(GENEROS_DE_VOZ),
      bruto.voiceGender,
      porDefecto.voiceGender
    ),
    languages,
    voiceLanguage,
    ...(pasarLlamadas ? { pasarLlamadas } : {}),
    ...(voz ? { voz } : {}),
  });
}

/** Zona válida o Madrid. La hora actual del agente depende de esto, así que
 * una zona mal escrita no puede propagarse al prompt. */
export function resolveManagedPromptTimezone(
  timezone: string | null | undefined
): string {
  const candidate = timezone || "Europe/Madrid";
  try {
    new Intl.DateTimeFormat("es-ES", { timeZone: candidate }).format();
    return candidate;
  } catch {
    return "Europe/Madrid";
  }
}

export function buildManagedAgentPrompt(input: {
  businessName: string;
  businessDetails?: string | null;
  businessType?: BusinessType;
  settings: unknown;
  timezone?: string | null;
  minAdvanceBookingMinutes?: number | null;
  maxAppointmentDurationMinutes?: number | null;
  /** ¿Está aprobada la plantilla `hueco_libre` (lista de espera por
   * WhatsApp)? `true` por defecto: el prompt de siempre. Con `false` la
   * recepcionista no promete avisos ni usa notify_when_available. Lo
   * calcula `listaDeEsperaDisponible()` (modules/whatsapp/service.ts). */
  listaDeEspera?: boolean;
  /** Privacidad (docs/historico/PLAN-TELEFONIA-UX.md § 3, caso C): con `true`
   * la
   * recepcionista nunca dice el número del negocio al cliente; toma recado
   * y el negocio le llama. Es `Business.hideOwnerNumberFromClients`. */
  ocultarNumeroDelNegocio?: boolean;
  /** Transferencia al dueño (fase 4): con `activa` el prompt lleva el
   * bloque «## Pasar la llamada» según el modo; sin ella (o sin pasar
   * nada, como en Retell, que no tiene la tool) no se menciona. */
  transferenciaAlDueno?: TransferenciaAlDueno | null;
  /** Los idiomas que atiende si no son todos los de su principal: los de
   * Retell, el respaldo (ajustesParaRetell en lib/idiomas/resolver.ts), o
   * los de su principal con la cooficial de su zona (lib/idiomas/zona.ts).
   * Sin ellos, los que habla con su principal. */
  idiomas?: readonly CodigoDeIdioma[];
}) {
  const settings = parseAgentSettings(input.settings);
  // Las secciones, su orden y su texto viven en lib/seccionesDelPrompt.ts;
  // aquí solo se resuelve lo que necesitan.
  return componerPrompt({
    settings,
    // parseAgentSettings ya deja en `languages` los que habla con su
    // principal (normalizarIdiomas).
    idioma: instruccionesDeIdioma(
      input.idiomas ?? settings.languages,
      settings.voiceLanguage
    ),
    businessType: input.businessType,
    businessDetails: input.businessDetails?.trim(),
    timezone: resolveManagedPromptTimezone(input.timezone),
    minAdvanceBookingMinutes: input.minAdvanceBookingMinutes,
    maxAppointmentDurationMinutes: input.maxAppointmentDurationMinutes,
    listaDeEspera: input.listaDeEspera !== false,
    ocultarNumero: input.ocultarNumeroDelNegocio === true,
    transferenciaAlDueno: input.transferenciaAlDueno,
  });
}
