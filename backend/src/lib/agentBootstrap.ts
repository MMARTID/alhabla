import { prisma } from "./prisma.js";
import {
  BUSINESS_TYPE_LABELS,
  isBusinessType,
  type BusinessType,
} from "./businessType.js";
import {
  buildManagedAgentPrompt,
  parseAgentSettings,
  DEFAULT_AGENT_SETTINGS,
} from "./managedAgentPrompt.js";
import { componerSaludo } from "./idiomas/catalogo.js";
import { crearAssistantDelNegocio } from "./telnyxAgentSync.js";
import { listaDeEsperaDisponible } from "../modules/whatsapp/service.js";
import { recordatorioIncluido } from "./planFeatures.js";

/**
 * Alta del agente de un negocio: la fila `Agent` (con el prompt gestionado
 * de partida) y su assistant de Telnyx, que atiende todas las llamadas.
 * Hasta el 17-10 creaba también un agente de Retell como respaldo, que nunca
 * llegó a coger una llamada (docs/historico/PLAN-RETIRAR-RETELL.md).
 */

export type AgentTemplateConfig = {
  name: string;
  voiceId: string;
  voiceProvider: string;
  voiceModel?: string;
  language: string;
  systemPrompt: string;
  llmProvider: string;
  llmModel: string;
  llmTemperature: number;
  sttProvider: string;
  sttModel: string;
  firstMessage: string;
  firstMessageMode: "assistant-speaks-first" | "assistant-waits-for-user";
};

export const DEFAULT_AGENT_CONFIG: AgentTemplateConfig = {
  name: "Asistente virtual",
  voiceId: "538a8872-3799-4df5-b373-b78493b766c6",
  voiceProvider: "cartesia",
  voiceModel: "sonic-3.5",
  language: "es",
  systemPrompt:
    "Eres un asistente virtual básico. Responde de forma breve y directa: máximo 1-2 frases por turno. Evita listas, puntos suspensivos y explicaciones largas.",
  llmProvider: "groq",
  llmModel: "openai/gpt-oss-20b",
  llmTemperature: 0.3,
  sttProvider: "deepgram",
  sttModel: "nova-2",
  firstMessage: "Hola, soy la recepcionista virtual. ¿En qué te ayudo?",
  firstMessageMode: "assistant-speaks-first",
};

/**
 * Devuelve un nombre legible para el agente basado en el tipo de negocio.
 */
export function buildAgentDisplayName(
  businessName: string,
  businessType: BusinessType
) {
  const typeLabel =
    BUSINESS_TYPE_LABELS[businessType] ?? BUSINESS_TYPE_LABELS.other;
  return `${businessName} · ${typeLabel}`;
}

/**
 * Resuelve la configuración de plantilla para un tipo de negocio. El
 * systemPrompt ya incluye las instrucciones de nicho (NICHE_INSTRUCTIONS en
 * managedAgentPrompt.ts) desde el momento de creación — es efímero de todos
 * modos, porque PATCH /business/me lo reconstruye en cuanto el negocio guarda
 * ajustes o tipo de negocio (ver syncAgentToTelnyx). El horario y el
 * catálogo no viven en el prompt: get_catalog los devuelve solo cuando el
 * agente los necesita. TTS/LLM/STT siguen siendo iguales para todos los
 * nichos.
 */
export function getAgentTemplateForBusinessType(
  businessType: BusinessType,
  baseName: string,
  businessName: string,
  listaDeEspera?: boolean
): AgentTemplateConfig {
  return getDefaultAgentConfig({
    name: baseName,
    firstMessage: componerSaludo(DEFAULT_AGENT_SETTINGS.voiceLanguage, businessName),
    systemPrompt: buildManagedAgentPrompt({
      businessName,
      businessType,
      settings: DEFAULT_AGENT_SETTINGS,
      listaDeEspera,
    }),
  });
}

export function getDefaultAgentConfig(
  overrides: Partial<AgentTemplateConfig> = {}
): AgentTemplateConfig {
  return {
    ...DEFAULT_AGENT_CONFIG,
    ...overrides,
  };
}

export function buildAgentPersistencePayload(args: {
  businessId: string;
  name: string;
  config?: Partial<AgentTemplateConfig>;
}) {
  const config = getDefaultAgentConfig(args.config);

  return {
    businessId: args.businessId,
    name: args.name || config.name,
    voice: config.voiceId,
    voiceId: config.voiceId,
    voiceProvider: config.voiceProvider,
    language: config.language,
    systemPrompt: config.systemPrompt,
    llmProvider: config.llmProvider,
    llmModel: config.llmModel,
    llmTemperature: config.llmTemperature,
    sttProvider: config.sttProvider,
    sttModel: config.sttModel,
    firstMessage: config.firstMessage,
    firstMessageMode: config.firstMessageMode,
  };
}

export function buildSafeAssistantName(name: string) {
  const normalized = name.trim().replace(/\s+/g, " ");

  if (normalized.length <= 40) {
    return normalized;
  }

  const sanitized = normalized
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim();

  const compactWords = sanitized
    .split(" ")
    .filter(Boolean)
    .slice(0, 4)
    .join(" ");

  if (compactWords.length <= 40 && compactWords.length > 0) {
    return compactWords;
  }

  const hash = Buffer.from(normalized).toString("base64url").slice(0, 6);
  const prefix = normalized.slice(0, 33).trimEnd();
  return `${prefix}-${hash}`.slice(0, 40);
}

export async function createBusinessAgent(args: {
  businessId: string;
  name: string;
  businessType?: BusinessType;
  configOverrides?: Partial<AgentTemplateConfig>;
  prismaClient?: typeof prisma;
}) {
  const client = args.prismaClient ?? prisma;

  const business = await client.business.findUnique({
    where: { id: args.businessId },
    select: {
      businessType: true,
      name: true,
      businessDetails: true,
      agentSettings: true,
      timezone: true,
      minAdvanceBookingMinutes: true,
      maxAppointmentDurationMinutes: true,
      hideOwnerNumberFromClients: true,
      plan: true,
      stripePriceId: true,
    },
  });

  const businessType =
    args.businessType ??
    (isBusinessType(business?.businessType) ? business?.businessType : "other");
  const displayName = buildAgentDisplayName(args.name, businessType);

  const listaDeEspera = await listaDeEsperaDisponible();
  const templateConfig = getAgentTemplateForBusinessType(
    businessType,
    displayName,
    args.name,
    listaDeEspera
  );
  const agentSettings = parseAgentSettings(business?.agentSettings);
  const config = {
    ...templateConfig,
    systemPrompt: buildManagedAgentPrompt({
      businessName: business?.name ?? args.name,
      businessDetails: business?.businessDetails,
      businessType,
      settings: agentSettings,
      timezone: business?.timezone,
      minAdvanceBookingMinutes: business?.minAdvanceBookingMinutes,
      maxAppointmentDurationMinutes: business?.maxAppointmentDurationMinutes,
      listaDeEspera,
      recordatorioPorWhatsapp: recordatorioIncluido(business ?? {}),
      ocultarNumeroDelNegocio: business?.hideOwnerNumberFromClients,
    }),
  };

  const agent = await client.agent.create({
    data: buildAgentPersistencePayload({
      businessId: args.businessId,
      name: displayName,
      config,
    }),
  });

  // El assistant de Telnyx, que atiende todas las llamadas. Nunca lanza ni
  // impide devolver el agente; nace con sus tools de voz.
  await crearAssistantDelNegocio({
    agentId: agent.id,
    businessId: args.businessId,
    prismaClient: client,
  });
  return agent;
}

/**
 * Actualiza el nombre del agente existente para reflejar el tipo de negocio.
 * Se usa cuando el usuario confirma/selecciona el nicho tras el registro.
 */
export async function syncAgentNameWithBusinessType(args: {
  businessId: string;
  businessType: BusinessType;
  businessName?: string;
  prismaClient?: typeof prisma;
}) {
  const client = args.prismaClient ?? prisma;

  const business = await client.business.findUnique({
    where: { id: args.businessId },
    select: { name: true },
  });

  if (!business) return;

  const agents = await client.agent.findMany({
    where: { businessId: args.businessId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    take: 1,
  });

  const agent = agents[0];
  if (!agent) return;

  const displayName = buildAgentDisplayName(
    args.businessName ?? business.name,
    args.businessType
  );

  await client.agent.update({
    where: { id: agent.id },
    data: { name: displayName },
  });
}
