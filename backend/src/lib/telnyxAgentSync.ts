import { createHash } from "node:crypto";
import { prisma } from "./prisma.js";
import { telnyxAiAdapter } from "../adapters/telnyx/TelnyxAiAdapter.js";
import {
  buildTelnyxAssistantPayload,
  buildTelnyxChatAssistantPayload,
  buildTelnyxChatTools,
  buildTelnyxVoiceTools,
  conFraseDeEspera,
  toTelnyxWebhookTool,
} from "./telnyxAssistantPayload.js";
import { idsDeToolsCompartidas } from "./toolsCompartidas.js";
import { grupoDeInsightsDeLaRecepcionista } from "./insightsDeTelnyx.js";
import { getPublicWebhookBaseUrl } from "./serverUrl.js";
import {
  buildManagedAgentPrompt,
  buildTransferInstruction,
  parseAgentSettings,
  TITULO_DEL_BLOQUE_DE_TRANSFERENCIA,
} from "./managedAgentPrompt.js";
import { resolveTelnyxEligibility } from "./telnyxEligibility.js";
import { isBusinessType, type BusinessType } from "./businessType.js";
import { resolverIdiomas, saludoDelNegocio } from "./idiomas/resolver.js";
import { cooficialDeLaZona } from "./idiomas/zona.js";
import { listaDeEsperaDisponible } from "../modules/whatsapp/service.js";
import { resolverTransferenciaAlDueno } from "./transferenciaAlDueno.js";
import { recordatorioIncluido } from "./planFeatures.js";
import type { CreateTelnyxAssistantInput } from "../adapters/telnyx/TelnyxAiAdapter.js";

/** Hash del payload enviado a Telnyx: si no cambia, la sincronización no
 * vuelve a llamar a la API. Determinista mientras el propio builder del
 * payload no cambie el orden de sus claves. */
function hashConfig(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

/**
 * Prompt/greeting/idioma de un negocio, para no repetir la misma consulta y
 * transformación en createTelnyxAssistantForAgent y syncAgentToTelnyx.
 */
async function loadManagedAssistantConfig(
  businessId: string,
  prismaClient: typeof prisma
) {
  const business = await prismaClient.business.findUnique({
    where: { id: businessId },
    select: {
      name: true,
      timezone: true,
      // La cooficial de la zona sale del código postal (lib/idiomas/zona.ts).
      address: true,
      businessDetails: true,
      businessType: true,
      agentSettings: true,
      minAdvanceBookingMinutes: true,
      maxAppointmentDurationMinutes: true,
      hideOwnerNumberFromClients: true,
      // Transferencia al dueño (fase 4): de aquí salen el origen (número de
      // Alhabla), el destino (móvil del dueño) y el modo por defecto.
      customerLineType: true,
      phone: true,
      telnyxPhoneNumber: true,
      ownerWhatsappNumber: true,
      ownerPhoneIsCustomerLine: true,
      // El recordatorio por WhatsApp solo se ofrece si el plan lo manda.
      plan: true,
      stripePriceId: true,
    },
  });
  if (!business) return null;

  const businessType: BusinessType = isBusinessType(business.businessType)
    ? business.businessType
    : "other";
  const agentSettings = parseAgentSettings(business.agentSettings);
  // Los idiomas de la recepcionista con la cooficial de donde está el
  // negocio: el prompt y el payload, de la misma resolución.
  const idiomas = resolverIdiomas({
    ...agentSettings,
    zona: cooficialDeLaZona(business),
  });
  // La misma resolución decide el bloque del prompt Y la tool: nunca uno
  // sin el otro.
  const transferenciaAlDueno = resolverTransferenciaAlDueno(
    business,
    agentSettings.pasarLlamadas
  );
  const entradaDelPrompt = {
    businessName: business.name,
    businessDetails: business.businessDetails,
    businessType,
    settings: agentSettings,
    timezone: business.timezone,
    minAdvanceBookingMinutes: business.minAdvanceBookingMinutes,
    maxAppointmentDurationMinutes: business.maxAppointmentDurationMinutes,
    listaDeEspera: await listaDeEsperaDisponible(),
    recordatorioPorWhatsapp: recordatorioIncluido(business),
    ocultarNumeroDelNegocio: business.hideOwnerNumberFromClients,
    transferenciaAlDueno,
    idiomas: idiomas.idiomas,
  };
  // Un prompt por assistant (lib/seccionesDelPrompt.ts): el de las
  // llamadas y el del chat de clientes por WhatsApp.
  const systemPrompt = buildManagedAgentPrompt({
    ...entradaDelPrompt,
    canal: "voz",
  });
  const promptDeChat = buildManagedAgentPrompt({
    ...entradaDelPrompt,
    canal: "chat",
  });

  return {
    business,
    agentSettings,
    idiomas,
    systemPrompt,
    promptDeChat,
    transferenciaAlDueno: transferenciaAlDueno.activa
      ? { from: transferenciaAlDueno.origen!, to: transferenciaAlDueno.destino! }
      : null,
    /** El bloque «## Pasar la llamada» suelto, para los prompts editados a
     * mano (ver promptManualConSuRegla). null si la tool no se registra. */
    bloqueDeTransferencia: buildTransferInstruction(transferenciaAlDueno),
  };
}

/**
 * Un prompt editado a mano (PATCH /agents/:id) se manda tal cual, pero la
 * tool `transfer` se registra según los ajustes del negocio, no según el
 * prompt: si el bloque no está, se añade al final para no romper la
 * garantía «nunca la tool sin su regla». Si el dueño ya escribió su propio
 * «## Pasar la llamada», se respeta.
 */
export function promptManualConSuRegla(
  prompt: string,
  bloqueDeTransferencia: string | null
): string {
  if (
    !bloqueDeTransferencia ||
    prompt.includes(TITULO_DEL_BLOQUE_DE_TRANSFERENCIA)
  ) {
    return prompt;
  }
  return `${prompt.trimEnd()}\n\n${bloqueDeTransferencia}`;
}

/** Motivo que queda guardado cuando falta la URL pública del backend. */
const SIN_BASE_URL =
  "Falta BASE_URL; no se pueden registrar las tools de Telnyx";

type ConfiguracionGestionada = NonNullable<
  Awaited<ReturnType<typeof loadManagedAssistantConfig>>
>;

type AgenteDeRecepcionista = {
  id: string;
  systemPrompt: string;
  promptManuallyEdited: boolean;
};

/**
 * Nombres de los servicios y profesionales activos: sesgan la transcripción
 * (`keyterm` de deepgram/flux) hacia lo que de verdad se nombra en las
 * llamadas del negocio.
 */
async function cargarPalabrasClave(
  businessId: string,
  prismaClient: typeof prisma
): Promise<string[]> {
  const [services, professionals] = await Promise.all([
    prismaClient.service.findMany({
      where: { businessId, active: true, deletedAt: null },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
    prismaClient.professional.findMany({
      where: { businessId, active: true, deletedAt: null },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return [
    ...services.map((service) => service.name),
    ...professionals.map((professional) => professional.name),
  ];
}

/** Lo que los dos assistants de la recepcionista toman de la cuenta de
 * Telnyx: sus tools de la biblioteca (lib/toolsCompartidas.ts) y el grupo
 * de insights vacío (lib/insightsDeTelnyx.ts). */
interface RecursosDeTelnyx {
  toolIdsDeVoz: string[];
  toolIdsDeChat: string[];
  insightGroupId: string;
}

/**
 * Las tools de los dos assistants, tal como van a la biblioteca: con la
 * frase de espera del idioma principal en las dos (en el chat no suena),
 * para que las comunes sean la misma tool y no dos.
 */
async function cargarRecursosDeTelnyx(
  baseUrl: string,
  isoDeLaVoz: string
): Promise<RecursosDeTelnyx> {
  const comoTelnyx = (tools: ReturnType<typeof buildTelnyxVoiceTools>) =>
    tools.map((tool) => toTelnyxWebhookTool(conFraseDeEspera(tool, isoDeLaVoz)));
  // Seguidas, no a la vez: las comunes que falten se crean con la primera.
  const toolIdsDeVoz = await idsDeToolsCompartidas(
    comoTelnyx(buildTelnyxVoiceTools(baseUrl))
  );
  const toolIdsDeChat = await idsDeToolsCompartidas(
    comoTelnyx(buildTelnyxChatTools(baseUrl))
  );
  return {
    toolIdsDeVoz,
    toolIdsDeChat,
    insightGroupId: await grupoDeInsightsDeLaRecepcionista(),
  };
}

/**
 * El payload COMPLETO del assistant de llamadas de un agente: prompt (el
 * gestionado, o el manual con su regla de transferencia), las tools de voz
 * de la biblioteca, las palabras clave y la tool `transfer` cuando procede.
 * Lo usan la creación y la sincronización, así que las dos mandan
 * exactamente lo mismo y guardan el mismo hash: la primera sincronización
 * tras crear el assistant no tiene nada que cambiar.
 */
function construirPayloadDeRecepcionista(args: {
  businessId: string;
  agent: AgenteDeRecepcionista;
  config: ConfiguracionGestionada;
  voz: string;
  recursos: RecursosDeTelnyx;
  palabrasClave: string[];
}): CreateTelnyxAssistantInput {
  const { config } = args;
  const { idiomas } = config;
  return buildTelnyxAssistantPayload({
    businessId: args.businessId,
    agentId: args.agent.id,
    businessName: config.business.name,
    timezone: config.business.timezone,
    instructions: args.agent.promptManuallyEdited
      ? promptManualConSuRegla(
          args.agent.systemPrompt,
          config.bloqueDeTransferencia
        )
      : config.systemPrompt,
    greeting: saludoDelNegocio(idiomas, config.business.name),
    idiomas,
    voice: args.voz,
    boostedKeywords: args.palabrasClave,
    toolIds: args.recursos.toolIdsDeVoz,
    insightGroupId: args.recursos.insightGroupId,
    // Inline, con hangup: lleva los números del negocio.
    transferenciaAlDueno: config.transferenciaAlDueno,
  });
}

/**
 * El payload del assistant del chat de clientes por WhatsApp del agente: el
 * prompt de chat (o el manual, que vale para los dos assistants como antes
 * de separarlos, sin el bloque de transferencia: el chat no tiene la tool)
 * y sus tools de la biblioteca.
 */
function construirPayloadDeChat(args: {
  businessId: string;
  agent: AgenteDeRecepcionista;
  config: ConfiguracionGestionada;
  recursos: RecursosDeTelnyx;
}): CreateTelnyxAssistantInput {
  const { config } = args;
  return buildTelnyxChatAssistantPayload({
    businessId: args.businessId,
    agentId: args.agent.id,
    businessName: config.business.name,
    timezone: config.business.timezone,
    instructions: args.agent.promptManuallyEdited
      ? args.agent.systemPrompt
      : config.promptDeChat,
    toolIds: args.recursos.toolIdsDeChat,
    insightGroupId: args.recursos.insightGroupId,
  });
}

/** Lo que se guarda en el `Agent` tras mandar sus payloads a Telnyx. */
function datosDeSincronizacion(
  payloads: {
    voz: CreateTelnyxAssistantInput;
    chat: CreateTelnyxAssistantInput | null;
  },
  agent: AgenteDeRecepcionista,
  config: ConfiguracionGestionada
) {
  return {
    telnyxConfigHash: hashConfig(payloads.voz),
    ...(payloads.chat
      ? { telnyxChatConfigHash: hashConfig(payloads.chat) }
      : {}),
    telnyxSyncedAt: new Date(),
    telnyxSyncError: null,
    // La copia del prompt que ve el panel (/agente) es la que ejecuta
    // Telnyx en las llamadas: con el bloque de transferencia cuando la tool
    // está registrada y sin él cuando no. Los prompts editados a mano no se
    // pisan.
    ...(agent.promptManuallyEdited
      ? {}
      : { systemPrompt: config.systemPrompt }),
  };
}

/**
 * Crea los dos assistants Telnyx de un `Agent` (llamadas y chat de
 * clientes), si el negocio es elegible (idioma/voz), con el payload
 * completo desde el primer momento: tools, palabras clave y transferencia.
 * Antes nacía solo con `hangup` y dependía de una segunda sincronización
 * para poder consultar horario o reservar; si esa segunda llamada fallaba,
 * el negocio quedaba en Telnyx con una recepcionista incapaz de reservar
 * (incidente real 2026-09-14).
 *
 * Si el de chat no sale, el de voz se queda (el negocio contesta llamadas)
 * y el error queda en `telnyxSyncError`: la siguiente sincronización lo
 * vuelve a intentar.
 *
 * Nunca lanza: un fallo aquí no debe impedir que `createBusinessAgent()`
 * devuelva el agente. Lo llaman `crearAssistantDelNegocio()` (registro y
 * reconciliador) y el backfill (`scripts/backfillTelnyxAssistants.ts`); para
 * agentes que ya tienen assistant usa `syncAgentToTelnyx`.
 */
export async function createTelnyxAssistantForAgent(args: {
  agentId: string;
  businessId: string;
  prismaClient?: typeof prisma;
}): Promise<{ eligible: boolean; reason: string | null }> {
  const client = args.prismaClient ?? prisma;

  try {
    const config = await loadManagedAssistantConfig(args.businessId, client);
    if (!config) return { eligible: false, reason: "Negocio no encontrado." };

    const eligibility = await resolveTelnyxEligibility(config.agentSettings);
    if (!eligibility.eligible) {
      return { eligible: false, reason: eligibility.reason };
    }

    // Sin URL pública las tools no tendrían adónde llamar: mejor no crear
    // el assistant (el motivo queda guardado y el reconciliador lo reintenta)
    // que crear uno que contesta pero no puede consultar ni reservar nada.
    const baseUrl = getPublicWebhookBaseUrl();
    if (!baseUrl) return { eligible: false, reason: SIN_BASE_URL };

    const agent = await client.agent.findUnique({
      where: { id: args.agentId },
      select: { id: true, systemPrompt: true, promptManuallyEdited: true },
    });
    if (!agent) return { eligible: false, reason: "Agente no encontrado." };

    const recursos = await cargarRecursosDeTelnyx(
      baseUrl,
      config.idiomas.isoDeLaVoz
    );
    const voz = construirPayloadDeRecepcionista({
      businessId: args.businessId,
      agent,
      config,
      voz: eligibility.voiceId!,
      recursos,
      palabrasClave: await cargarPalabrasClave(args.businessId, client),
    });

    const assistant = await telnyxAiAdapter.createAssistant(voz);
    await client.agent.update({
      where: { id: args.agentId },
      data: {
        telnyxAssistantId: assistant.id,
        ...datosDeSincronizacion({ voz, chat: null }, agent, config),
      },
    });

    const chat = construirPayloadDeChat({
      businessId: args.businessId,
      agent,
      config,
      recursos,
    });
    try {
      const deChat = await telnyxAiAdapter.createAssistant(chat);
      await client.agent.update({
        where: { id: args.agentId },
        data: {
          telnyxChatAssistantId: deChat.id,
          telnyxChatConfigHash: hashConfig(chat),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        "[Agent] No se pudo crear el assistant de chat; el de llamadas sí:",
        { agentId: args.agentId, businessId: args.businessId, message }
      );
      await client.agent
        .update({
          where: { id: args.agentId },
          data: { telnyxSyncError: `Assistant de chat: ${message}` },
        })
        .catch(() => {});
    }
    return { eligible: true, reason: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Agent] No se pudo crear el assistant Telnyx:", {
      agentId: args.agentId,
      businessId: args.businessId,
      message,
    });
    return { eligible: false, reason: message };
  }
}

/**
 * Crea el assistant Telnyx de un agente y apunta en el negocio si es
 * elegible. Hasta el 17-10 además lo promocionaba a Telnyx-primary
 * (`orchestrator`); desde que no hay Retell (docs/historico/PLAN-RETIRAR-RETELL.md) todo
 * negocio es de Telnyx y su número va siempre al Call Control App
 * (phone/service.ts).
 *
 * Nunca lanza, y lo que no sale se loguea con negocio, agente y motivo: un
 * negocio sin assistant no tiene quien conteste. Lo llaman
 * `createBusinessAgent()` y el reconciliador diario (jobs/telnyxReconciler.ts).
 */
export async function crearAssistantDelNegocio(args: {
  agentId: string;
  businessId: string;
  prismaClient?: typeof prisma;
}): Promise<{ eligible: boolean; reason: string | null }> {
  const client = args.prismaClient ?? prisma;
  const { eligible, reason } = await createTelnyxAssistantForAgent(args);

  if (!eligible) {
    console.error("[Agent] El negocio se queda sin assistant Telnyx:", {
      businessId: args.businessId,
      agentId: args.agentId,
      motivo: reason,
    });
  }

  try {
    await client.business.update({
      where: { id: args.businessId },
      data: {
        telnyxEligibilityStatus: eligible ? "eligible" : "ineligible",
        telnyxEligibilityReason: reason,
      },
    });
  } catch (error) {
    console.error(
      "[Agent] No se pudo guardar la elegibilidad Telnyx del negocio:",
      {
        businessId: args.businessId,
        agentId: args.agentId,
        message: error instanceof Error ? error.message : String(error),
      }
    );
  }
  return { eligible, reason };
}

/**
 * Reconstruye la configuración gestionada de Telnyx y la sincroniza con los
 * agentes que ya tienen `telnyxAssistantId`: el assistant de llamadas y el
 * de chat de clientes (que se crea aquí si aún no existe: así los agentes de
 * antes de separarlos lo reciben en su primera sincronización). SIN lanzar
 * nunca: un fallo aquí no debe tumbar el flujo (reservas, ajustes) que
 * dispara esta sincronización. El estado queda en `telnyxSyncError` para que
 * el panel lo muestre. Solo llama a Telnyx si el hash del payload cambió.
 */
export async function syncAgentToTelnyx(
  businessId: string,
  prismaClient: typeof prisma = prisma,
  options?: {
    onlyManagedPrompts?: boolean;
    onlyActive?: boolean;
  }
): Promise<void> {
  try {
    const config = await loadManagedAssistantConfig(businessId, prismaClient);
    if (!config) return;

    const agents = await prismaClient.agent.findMany({
      where: {
        businessId,
        deletedAt: null,
        telnyxAssistantId: { not: null },
        ...(options?.onlyActive ? { active: true } : {}),
      },
    });
    if (agents.length === 0) return;

    const [palabrasClave, eligibility] = await Promise.all([
      cargarPalabrasClave(businessId, prismaClient),
      resolveTelnyxEligibility(config.agentSettings),
    ]);

    // Las tools van SIEMPRE, las pida quien las pida: guardar el horario,
    // crear/editar un servicio o profesional, conectar el calendario o el
    // reconciliador diario. Cuando cada llamada decidía si pasaba `tools`,
    // las que no las pasaban sobrescribían el assistant real con
    // `tools: []` — dejándolo sin get_catalog/check_availability/
    // book_appointment/find_my_appointment/cancel_appointment pese a que el
    // prompt seguía instruyéndole a usarlas. Hallazgo real 2026-09-14: los 5
    // assistants de las cuentas de prueba lo sufrieron (probablemente el
    // reconciliador diario) y las 25 llamadas reales de
    // telnyxCallBattery.ts fallaron en el 100% de los casos. Desde el
    // 2026-11-04 van por `tool_ids`, con el mismo cuidado.
    const baseUrl = getPublicWebhookBaseUrl();
    if (!baseUrl) {
      console.error(`[Agent] ${SIN_BASE_URL} para ${businessId}`);
    }
    let recursos: RecursosDeTelnyx | null = null;
    let sinRecursos: string | null = baseUrl ? null : SIN_BASE_URL;
    if (baseUrl && eligibility.eligible) {
      try {
        recursos = await cargarRecursosDeTelnyx(
          baseUrl,
          config.idiomas.isoDeLaVoz
        );
      } catch (error) {
        sinRecursos = `No se pudieron preparar las tools compartidas o el grupo de insights de Telnyx: ${
          error instanceof Error ? error.message : String(error)
        }`;
      }
    }

    for (const agent of agents) {
      if (options?.onlyManagedPrompts && agent.promptManuallyEdited) continue;

      try {
        if (!eligibility.eligible) {
          throw new Error(
            eligibility.reason ?? "Negocio no elegible para Telnyx."
          );
        }
        if (!recursos) throw new Error(sinRecursos ?? SIN_BASE_URL);

        const voz = construirPayloadDeRecepcionista({
          businessId,
          agent,
          config,
          voz: eligibility.voiceId!,
          recursos,
          palabrasClave,
        });
        const chat = construirPayloadDeChat({
          businessId,
          agent,
          config,
          recursos,
        });
        const datos = datosDeSincronizacion({ voz, chat }, agent, config);
        if (agent.telnyxConfigHash !== datos.telnyxConfigHash) {
          await telnyxAiAdapter.updateAssistant(agent.telnyxAssistantId!, voz);
        }
        let telnyxChatAssistantId = agent.telnyxChatAssistantId;
        let errorDeChat: string | null = null;
        try {
          if (!telnyxChatAssistantId) {
            telnyxChatAssistantId = (await telnyxAiAdapter.createAssistant(chat))
              .id;
            console.log(
              `[Agent] Assistant de chat creado para ${businessId}/${agent.id}: ${telnyxChatAssistantId}`
            );
          } else if (agent.telnyxChatConfigHash !== datos.telnyxChatConfigHash) {
            await telnyxAiAdapter.updateAssistant(telnyxChatAssistantId, chat);
          }
        } catch (error) {
          // El de llamadas ya está al día: que el chat no lo deshaga.
          errorDeChat = `Assistant de chat: ${
            error instanceof Error ? error.message : String(error)
          }`;
          console.error("[Agent] No se pudo sincronizar el assistant de chat:", {
            agentId: agent.id,
            businessId,
            message: errorDeChat,
          });
        }
        await prismaClient.agent.update({
          where: { id: agent.id },
          data: errorDeChat
            ? {
                ...datos,
                telnyxChatConfigHash: agent.telnyxChatConfigHash,
                telnyxSyncError: errorDeChat,
              }
            : { ...datos, telnyxChatAssistantId },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[Agent] No se pudo sincronizar el agente con Telnyx:", {
          agentId: agent.id,
          businessId,
          message,
        });
        await prismaClient.agent
          .update({ where: { id: agent.id }, data: { telnyxSyncError: message } })
          .catch(() => {});
      }
    }
  } catch (error) {
    console.error("[Agent] Fallo inesperado sincronizando Telnyx:", {
      businessId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
