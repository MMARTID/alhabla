import { prisma } from "../lib/prisma.js";
import { telnyxAiAdapter } from "../adapters/telnyx/TelnyxAiAdapter.js";
import {
  crearAssistantDelNegocio,
  syncAgentToTelnyx,
} from "../lib/telnyxAgentSync.js";
import { sendZohoMail } from "../lib/zohoMail.js";
import { errorMessage } from "../lib/logUtils.js";
import { buildTelnyxAssistantName } from "../lib/telnyxAssistantPayload.js";
import {
  incorporarPlantillasNuevas,
  refrescarPlantillasConClave,
} from "../modules/whatsapp/service.js";
import { sincronizarGestor } from "../lib/gestorSync.js";
import { acquireLock, releaseLock } from "../lib/bookingLock.js";

/**
 * Reconciliador diario Telnyx (docs/historico/PLAN-TELNYX-ORQUESTADOR.md Fase 6:
 * "Reconciliador diario de assistants, números y rutas"). Invocado una vez
 * al día por Cloud Scheduler vía POST /internal/jobs/telnyx-reconciler.
 *
 * Límite conocido y deliberado: `TelnyxAssistant` (TelnyxAiAdapter.ts) solo
 * expone id/name/instructions/greeting — la respuesta real de la API trae
 * mucho más, pero el SDK no lo tipa completo y compararlo campo a campo
 * sería frágil (diferencias de espacios/orden que no son drift real).
 * Este reconciliador NO intenta un diff completo de configuración: se apoya
 * en `syncAgentToTelnyx` (que SÍ reescribe la configuración completa cuando
 * el hash local cambió) para reparar drift de contenido, y añade encima
 * comprobaciones baratas y fiables que `syncAgentToTelnyx` no hace porque
 * nunca consulta el lado remoto:
 *   1. El assistant sigue existiendo en Telnyx (alguien pudo borrarlo a mano
 *      en el dashboard).
 *   2. El `name` remoto sigue siendo el determinista esperado (detecta un
 *      `telnyxAssistantId` guardado que en realidad apunta a otro recurso).
 *   3. Todo número comprado tiene su `telnyxPhoneNumberId`: sin él no se
 *      sabe a qué negocio llega la llamada.
 * Y antes de todo eso repara lo que ninguna de las tres ve: un negocio sin
 * ningún agente activo con assistant (ver crearAssistantsQueFaltan).
 */
export interface TelnyxReconcilerResult {
  agentsChecked: number;
  agentsResynced: number;
  assistantsMissingOnTelnyx: string[];
  assistantsWithUnexpectedName: string[];
  businessesWithSyncError: string[];
  businessesWithRoutingInconsistency: string[];
  /** Assistants creados porque el negocio no tenía ninguno. */
  assistantsCreados: string[];
  /** Negocios que siguen sin assistant tras intentarlo, con el motivo. */
  assistantsSinCrear: string[];
}

/** Tope de agentes por pasada del reconciliador. */
const MAX_AGENTES_POR_PASADA = 200;

/** Tope de assistants nuevos por pasada: cada uno es una creación en Telnyx
 * (varios segundos). Los que no entren se crean en la siguiente. */
const MAX_ASSISTANTS_NUEVOS_POR_PASADA = 20;

/** Un agente más reciente que esto puede estar a medio crear:
 * `createBusinessAgent` lo guarda en la BD antes de crear su assistant, y
 * si el reconciliador (el deploy también lo lanza) creara el assistant a la
 * vez, el negocio acabaría con dos. */
const MARGEN_DE_CREACION_MS = 15 * 60 * 1000;

/** Cerrojo por negocio contra dos pasadas solapadas (p. ej. un reintento de
 * Cloud Scheduler mientras la primera sigue viva). Holgado: con el timeout y
 * los reintentos del SDK, una creación lenta pasa de 2 min, y un cerrojo
 * caducado a mitad dejaría a la otra pasada crear un segundo assistant. */
const CERROJO_DE_CREACION_MS = 5 * 60 * 1000;

export async function telnyxReconcilerJob(): Promise<TelnyxReconcilerResult> {
  const result: TelnyxReconcilerResult = {
    agentsChecked: 0,
    agentsResynced: 0,
    assistantsMissingOnTelnyx: [],
    assistantsWithUnexpectedName: [],
    businessesWithSyncError: [],
    businessesWithRoutingInconsistency: [],
    assistantsCreados: [],
    assistantsSinCrear: [],
  };

  // Barrido diario de plantillas de WhatsApp (PR 4): pone al día el estado
  // de cada fila con `key` aunque el webhook `whatsapp.template.*` no llegue.
  // Va antes del sync de assistants para que la aprobación de `hueco_libre`
  // (gate de la frase de la lista de espera en el prompt) entre en este mismo
  // ciclo. Nunca lanza; un fallo suyo no aborta la reconciliación.
  try {
    // Primero las que falten (versión o idioma nuevos), después el estado
    // de las que tienen clave.
    await incorporarPlantillasNuevas();
    await refrescarPlantillasConClave();
  } catch (error) {
    console.error(
      `[TelnyxReconciler] refrescarPlantillasConClave inesperado: ${errorMessage(error)}`
    );
  }

  // El Gestor (fase 2 del plan de WhatsApp): un solo assistant de plataforma
  // que no pasa por syncAgentToTelnyx; se mantiene igual al payload del
  // código aquí. Sin TELNYX_GESTOR_ASSISTANT_ID no hace nada.
  try {
    const gestor = await sincronizarGestor();
    if (gestor.estado !== "sin_id") {
      console.log(`[TelnyxReconciler] Gestor: ${gestor.estado}${"id" in gestor && gestor.id ? ` (${gestor.id})` : ""}${gestor.estado === "error" ? ` — ${gestor.motivo}` : ""}`);
    }
  } catch (error) {
    console.error(
      `[TelnyxReconciler] sincronizarGestor inesperado: ${errorMessage(error)}`
    );
  }

  // Antes de la revisión de abajo, para que los assistants recién creados
  // entren ya en ella (getAssistant confirma que existen). Nunca aborta la
  // reconciliación.
  try {
    await crearAssistantsQueFaltan(result);
  } catch (error) {
    console.error(
      `[TelnyxReconciler] crearAssistantsQueFaltan inesperado: ${errorMessage(error)}`
    );
  }

  // Con cota: el reconciliador habla con la API de Telnyx una vez por agente,
  // así que un parque grande desbordaría el plazo de la tarea. Los agentes que
  // no entren en esta pasada se revisan en la siguiente. OJO con la cadencia:
  // el Cloud Scheduler `telnyx-reconciler` corre UNA VEZ AL DÍA (0 4 * * *),
  // no cada 15 minutos como decía este comentario. Importa porque este job es
  // lo único que propaga sola una mejora del prompt a los assistants ya
  // creados: sin forzarlo, un cambio desplegado por la mañana no llega a los
  // clientes hasta las 04:00 del día siguiente. El deploy lo fuerza (ver
  // .github/workflows/deploy-backend.yml).
  const agentsBefore = await prisma.agent.findMany({
    where: { deletedAt: null, telnyxAssistantId: { not: null } },
    select: {
      id: true,
      businessId: true,
      telnyxAssistantId: true,
      telnyxSyncError: true,
    },
    // Los que tienen error de sincronización primero: son los que de verdad
    // hay que reconciliar.
    orderBy: [{ telnyxSyncError: { sort: "desc", nulls: "last" } }, { updatedAt: "asc" }],
    take: MAX_AGENTES_POR_PASADA,
  });
  const agentIdsWithErrorBefore = new Set(
    agentsBefore.filter((agent) => agent.telnyxSyncError).map((agent) => agent.id)
  );

  // Un negocio con varios agentes solo necesita un `syncAgentToTelnyx` — la
  // función ya recorre todos sus agentes internamente.
  const businessIds = [...new Set(agentsBefore.map((agent) => agent.businessId))];
  for (const businessId of businessIds) {
    try {
      await syncAgentToTelnyx(businessId);
    } catch (error) {
      // syncAgentToTelnyx ya no lanza en su uso normal (ver su propio
      // comentario), pero el reconciliador no debe poder abortar el resto
      // de negocios si algún día empieza a hacerlo.
      console.error(
        `[TelnyxReconciler] syncAgentToTelnyx inesperado para ${businessId}: ${errorMessage(error)}`
      );
    }
  }

  // Re-lee tras los syncAgentToTelnyx de arriba — telnyxSyncError pudo
  // quedar limpio si el reintento de hoy funcionó.
  const agentsAfter = await prisma.agent.findMany({
    where: { id: { in: agentsBefore.map((agent) => agent.id) } },
    select: { id: true, businessId: true, telnyxSyncError: true },
  });
  const errorById = new Map(
    agentsAfter.map((agent) => [agent.id, agent.telnyxSyncError])
  );

  result.agentsResynced = [...agentIdsWithErrorBefore].filter(
    (agentId) => !errorById.get(agentId)
  ).length;
  result.businessesWithSyncError = [
    ...new Set(
      agentsAfter.filter((agent) => agent.telnyxSyncError).map((agent) => agent.businessId)
    ),
  ];

  for (const agent of agentsBefore) {
    result.agentsChecked++;

    try {
      const remote = await telnyxAiAdapter.getAssistant(agent.telnyxAssistantId!);
      const expectedName = buildTelnyxAssistantName(agent.businessId, agent.id);
      if (remote.name !== expectedName) {
        result.assistantsWithUnexpectedName.push(
          `${agent.businessId}/${agent.id} (esperado "${expectedName}", remoto "${remote.name}")`
        );
      }
    } catch (error) {
      result.assistantsMissingOnTelnyx.push(
        `${agent.businessId}/${agent.id} (${agent.telnyxAssistantId}): ${errorMessage(error)}`
      );
    }
  }

  // Un número que Telnyx no sabría enrutar: activo (o con E.164 guardado)
  // pero sin el id del recurso PhoneNumber.
  const routingBusinesses = await prisma.business.findMany({
    where: {
      telnyxPhoneNumberId: null,
      OR: [{ phoneNumberStatus: "active" }, { telnyxPhoneNumber: { not: null } }],
    },
    select: { id: true },
  });
  for (const business of routingBusinesses) {
    // Un negocio que se registró y aún no ha comprado número (o cuya compra
    // falló) no sale aquí: no tiene nada que enrutar. El 20-09 el correo
    // diario señalaba una peluquería sin plan ni número.
    result.businessesWithRoutingInconsistency.push(
      `${business.id}: número sin telnyxPhoneNumberId`
    );
  }

  await maybeSendAlert(result);
  return result;
}

/**
 * Un negocio sin ningún agente activo con assistant no tiene quien conteste
 * en Telnyx, el orquestador de todas las llamadas, y el resto del
 * reconciliador no lo ve: solo revisa agentes que ya tienen uno. Pasa cuando
 * `createBusinessAgent` no pudo crearlo (Telnyx caído, sin voz compatible
 * ese día) o, hasta octubre de 2026, cuando Retell fallaba antes. Se crea el
 * del primer agente activo —el mismo que elige selectTelnyxInboundAgent
 * (phone/telnyxInbound.ts) para atender— como en el registro
 * (crearAssistantDelNegocio). Hace el trabajo de
 * scripts/backfillTelnyxAssistants.ts sin esperar a nadie.
 */
async function crearAssistantsQueFaltan(
  result: TelnyxReconcilerResult
): Promise<void> {
  const agenteActivo = { active: true, deletedAt: null };
  const negocios = await prisma.business.findMany({
    where: {
      agents: {
        some: {
          ...agenteActivo,
          createdAt: { lt: new Date(Date.now() - MARGEN_DE_CREACION_MS) },
        },
        none: { ...agenteActivo, telnyxAssistantId: { not: null } },
      },
    },
    select: {
      id: true,
      agents: {
        where: agenteActivo,
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { id: true },
      },
    },
    orderBy: { createdAt: "asc" },
    take: MAX_ASSISTANTS_NUEVOS_POR_PASADA,
  });

  for (const negocio of negocios) {
    const agente = negocio.agents[0];
    if (!agente) continue;
    const etiqueta = `${negocio.id}/${agente.id}`;

    const claveDelCerrojo = `telnyx_assistant_nuevo:${negocio.id}`;
    const token = await acquireLock(claveDelCerrojo, CERROJO_DE_CREACION_MS, 0);
    if (!token) {
      console.warn(
        `[TelnyxReconciler] ${etiqueta}: otra pasada está creando su assistant, se deja para ella`
      );
      continue;
    }

    try {
      // Releído dentro del cerrojo: otra pasada pudo crearlo entre la
      // consulta de arriba y ahora.
      const actual = await prisma.agent.findUnique({
        where: { id: agente.id },
        select: { telnyxAssistantId: true },
      });
      if (actual?.telnyxAssistantId) continue;

      console.warn(
        `[TelnyxReconciler] ${etiqueta}: el negocio no tiene assistant Telnyx, se crea`
      );
      const creado = await crearAssistantDelNegocio({
        agentId: agente.id,
        businessId: negocio.id,
      });
      if (!creado.eligible) {
        // crearAssistantDelNegocio ya lo ha logueado con el motivo.
        result.assistantsSinCrear.push(
          `${etiqueta}: ${creado.reason ?? "motivo desconocido"}`
        );
        continue;
      }
      result.assistantsCreados.push(etiqueta);
    } catch (error) {
      console.error(
        `[TelnyxReconciler] ${etiqueta}: no se pudo crear el assistant: ${errorMessage(error)}`
      );
      result.assistantsSinCrear.push(`${etiqueta}: ${errorMessage(error)}`);
    } finally {
      await releaseLock(claveDelCerrojo, token);
    }
  }
}

function hasFindings(result: TelnyxReconcilerResult): boolean {
  return (
    result.assistantsCreados.length > 0 ||
    result.assistantsSinCrear.length > 0 ||
    result.assistantsMissingOnTelnyx.length > 0 ||
    result.assistantsWithUnexpectedName.length > 0 ||
    result.businessesWithSyncError.length > 0 ||
    result.businessesWithRoutingInconsistency.length > 0
  );
}

/**
 * Un único correo diario si hay algo que revisar — nunca si todo está
 * limpio, para no acostumbrar a ignorar la bandeja. Reutiliza `sendZohoMail`
 * (ya usado para email transaccional) en vez de montar un canal de alertas
 * nuevo; requiere `TELNYX_ALERT_EMAIL` configurado o no envía nada (falla
 * cerrado en logs, no lanza — un fallo de alertas no debe tumbar el job).
 */
async function maybeSendAlert(result: TelnyxReconcilerResult): Promise<void> {
  if (!hasFindings(result)) {
    console.log(
      `[TelnyxReconciler] ${result.agentsChecked} agente(s) revisados, sin hallazgos.`
    );
    return;
  }

  console.warn("[TelnyxReconciler] Hallazgos:", result);

  const alertEmail = process.env.TELNYX_ALERT_EMAIL;
  if (!alertEmail) {
    console.warn(
      "[TelnyxReconciler] TELNYX_ALERT_EMAIL no configurado — hallazgos solo en logs."
    );
    return;
  }

  const rows = [
    section("Assistants creados porque faltaban", result.assistantsCreados),
    section("Negocios que siguen sin assistant", result.assistantsSinCrear),
    section("Assistants inexistentes en Telnyx", result.assistantsMissingOnTelnyx),
    section("Assistants con nombre inesperado", result.assistantsWithUnexpectedName),
    section("Negocios con error de sincronización", result.businessesWithSyncError),
    section(
      "Negocios con enrutamiento inconsistente",
      result.businessesWithRoutingInconsistency
    ),
  ]
    .filter(Boolean)
    .join("");

  try {
    await sendZohoMail({
      fromAddress: "support@alhabla.ai",
      toAddress: alertEmail,
      subject: `[Alhabla] Reconciliador Telnyx: ${result.agentsChecked} agentes, hallazgos pendientes`,
      html: `<h2>Reconciliador Telnyx</h2><p>${result.agentsChecked} agente(s) revisados.</p>${rows}`,
    });
  } catch (error) {
    console.error(
      `[TelnyxReconciler] No se pudo enviar el correo de alerta: ${errorMessage(error)}`
    );
  }
}

function section(title: string, items: string[]): string {
  if (items.length === 0) return "";
  const list = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  return `<h3>${title} (${items.length})</h3><ul>${list}</ul>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
