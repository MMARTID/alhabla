import type { SubscriptionStatus } from "./types";

/**
 * Estados en los que la suscripción ya no se va a cobrar y la recepcionista
 * no contesta: los mismos que ESTADOS_DE_SUSCRIPCION_BLOQUEADOS del backend
 * (lib/planFeatures.ts). PAST_DUE no está: tiene siete días de gracia, y lo
 * que corta el servicio al acabar es `callsSuspendedAt`.
 */
const ESTADOS_SIN_COBRO: ReadonlySet<SubscriptionStatus> = new Set([
  "CANCELED",
  "UNPAID",
  "INCOMPLETE_EXPIRED",
]);

export function suscripcionSinCobro(estado: SubscriptionStatus | null | undefined) {
  return estado ? ESTADOS_SIN_COBRO.has(estado) : false;
}
