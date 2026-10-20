import {
  servicioSuspendidoPorPago,
  type EstadoDePagoDelNegocio,
} from "../../lib/planFeatures.js";

/**
 * Cuándo no se atiende una llamada: el pago corta el servicio (suscripción
 * cancelada o sin cobro posible, o impago con la gracia vencida — el mismo
 * criterio que las reservas, el Gestor y los chats, ver
 * servicioSuspendidoPorPago) o no hay assistant de Telnyx operativo — ver
 * docs/historico/PLAN-TELNYX-ORQUESTADOR.md § "Enrutamiento de llamadas y
 * tools".
 */
export interface TelnyxInboundBusiness extends EstadoDePagoDelNegocio {
  agents: Array<{ id: string; telnyxAssistantId: string | null }>;
}

export function selectTelnyxInboundAgent(
  business: TelnyxInboundBusiness,
  now = new Date()
): { id: string; telnyxAssistantId: string } | null {
  if (servicioSuspendidoPorPago(business, now)) return null;

  const agent = business.agents[0];
  if (!agent?.telnyxAssistantId) return null;
  return { id: agent.id, telnyxAssistantId: agent.telnyxAssistantId };
}
