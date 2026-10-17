import { prisma } from "../lib/prisma.js";

// 20 minutos, no 60: el agente cuelga solo a los 10 (maxCallDurationMs), así
// que una llamada que sigue "en curso" pasados 20 es un zombi seguro. Con el
// umbral anterior podía quedarse viva hasta 75 minutos y el heurístico de
// vinculación de reservas llegaba a elegirla como "la llamada actual".
const ZOMBIE_CALL_THRESHOLD_MINUTES = 20;

/**
 * Marca como TIMED_OUT las llamadas que llevan más de 20 minutos en
 * IN_PROGRESS sin actualizarse (el proveedor de voz nunca mandó el evento de
 * fin de llamada). Invocado cada 15 min por Cloud Scheduler vía
 * POST /internal/jobs/cleanup-zombie-calls.
 */
export async function cleanupZombieCallsJob(): Promise<void> {
  await cerrarLlamadasZombi();
  await avisarDeLlamadasSinResultado();
}

async function cerrarLlamadasZombi(): Promise<void> {
  console.log("[Reaper] Buscando llamadas zombie...");

  const threshold = new Date(
    Date.now() - ZOMBIE_CALL_THRESHOLD_MINUTES * 60 * 1000
  );

  const zombieCalls = await prisma.call.findMany({
    where: {
      status: "IN_PROGRESS",
      updatedAt: { lt: threshold },
    },
    select: { id: true },
  });

  if (zombieCalls.length === 0) {
    console.log("[Reaper] No se encontraron llamadas zombie.");
    return;
  }

  console.log(
    `[Reaper] Se encontraron ${zombieCalls.length} llamadas zombie. Marcando como TIMED_OUT...`
  );

  // El predicado se repite aquí a propósito: entre el findMany y este update
  // puede llegar el webhook call_ended y dejar la llamada en COMPLETED con su
  // duración real. Sin volver a exigir IN_PROGRESS, el barrido la degradaría a
  // TIMED_OUT y perderíamos una llamada buena del historial.
  const { count } = await prisma.call.updateMany({
    where: {
      id: { in: zombieCalls.map((call) => call.id) },
      status: "IN_PROGRESS",
      updatedAt: { lt: threshold },
    },
    data: { status: "TIMED_OUT" },
  });

  console.log(`[Reaper] ${count} llamadas marcadas como TIMED_OUT.`);

  console.log("[Reaper] Limpieza completada.");
}

/** Margen que tienen los insights de la conversación para llegar tras colgar
 * (el mismo que `sin_resultado` en mcp/saludDeLlamadas.ts). */
const MARGEN_PARA_EL_RESULTADO_MS = 10 * 60 * 1000;
/** La cadencia del barrido: cada llamada cae en una sola ventana y se avisa
 * una vez. */
const VENTANA_DEL_BARRIDO_MS = 15 * 60 * 1000;

/**
 * Llamadas de Telnyx que acabaron sin resultado (`outcome`), es decir, sin
 * que llegaran los insights de la conversación: el informe al dueño, el
 * resultado del panel y el cobro por resultado dependen de ellos. Las de
 * coste 0 colgaron antes de que contestara el assistant y no cuentan. Deja
 * un `console.error` con «[Salud]», que vigila la alerta «llamadas de voz con
 * fallos» (AGENTS.md § Alertas; PLAN-RETIRAR-RETELL.md, PR 5). Nunca lanza:
 * es un aviso, y el barrido de zombis ya ha hecho su trabajo.
 */
export async function avisarDeLlamadasSinResultado(
  ahora: Date = new Date()
): Promise<void> {
  const hasta = new Date(ahora.getTime() - MARGEN_PARA_EL_RESULTADO_MS);
  const desde = new Date(hasta.getTime() - VENTANA_DEL_BARRIDO_MS);
  try {
    const sinResultado = await prisma.call.findMany({
      where: {
        voiceProvider: "telnyx",
        status: "COMPLETED",
        outcome: null,
        endedAt: { gte: desde, lt: hasta },
        // Sin coste todavía cuenta (el call.cost puede no haber llegado);
        // con coste 0, no. `not: 0` solo dejaría fuera también los NULL.
        OR: [{ providerCostCents: null }, { providerCostCents: { not: 0 } }],
      },
      select: { id: true, businessId: true },
      take: 20,
    });
    if (sinResultado.length === 0) return;
    console.error(
      `[Salud] ${sinResultado.length} ${sinResultado.length === 1 ? "llamada de Telnyx acabó" : "llamadas de Telnyx acabaron"} hace más de 10 min sin resultado (no llegaron los insights de la conversación): ${sinResultado.map((call) => `${call.id} (negocio ${call.businessId})`).join(", ")}`
    );
  } catch (error) {
    console.error(
      `[Salud] No se pudo comprobar si hay llamadas sin resultado: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
