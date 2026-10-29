export type Plan = {
  id: "inicio" | "pro" | "scale";
  name: string;
  /** Cuota mensual sin IVA (los precios de Stripe son «exclusive»). */
  price: number;
  /**
   * Precio de fundador, sin IVA: lo que pagan los 15 primeros negocios en
   * contratar cualquier plan (cupo compartido,
   * backend/src/modules/billing/service.ts). Solo se enseña mientras
   * `GET /billing/fundadores` diga que quedan plazas.
   */
  founderPrice: number;
  minutes: number;
  extraPerMinute: number;
  description: string;
  summary: string;
  features: readonly string[];
  featured: boolean;
};

export const plans: readonly Plan[] = [
  {
    id: "inicio",
    name: "Inicio",
    price: 59,
    founderPrice: 39,
    minutes: 200,
    extraPerMinute: 0.3,
    description: "Para negocios que quieren empezar a no perder llamadas importantes.",
    summary: "3 profesionales · reservas en tu calendario o en la agenda de Alhabla · 200 minutos incluidos",
    features: [
      "Atención telefónica 24/7",
      "Habla en 8 idiomas, con voces naturales: español, inglés, francés, alemán, italiano, portugués, neerlandés y ruso",
      "También puede atender en catalán, euskera o gallego",
      "Reservas directas en tu calendario de Google, Outlook o iCloud, o en la agenda de Alhabla si no usas ninguno",
      "Hasta 3 profesionales en tu agenda",
      "Confirmación de cita por WhatsApp al cliente",
      "200 minutos de llamadas incluidos",
    ],
    featured: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: 139,
    founderPrice: 99,
    minutes: 600,
    extraPerMinute: 0.25,
    description: "La opción recomendada: además de atender, te llena la agenda y reduce las ausencias.",
    summary: "10 profesionales · recordatorios de cita · 600 minutos incluidos",
    features: [
      "Todo lo de Inicio",
      "Hasta 10 profesionales en tu agenda",
      "Recordatorios de cita por WhatsApp que reducen las ausencias",
      "Resumen semanal de llamadas y reservas en tu email",
      "Elige entre todas las voces de tu recepcionista",
      "600 minutos de llamadas incluidos",
    ],
    featured: true,
  },
  {
    id: "scale",
    name: "Scale",
    price: 269,
    founderPrice: 199,
    minutes: 1500,
    extraPerMinute: 0.2,
    description: "Para negocios con mucho volumen o un equipo grande que quieren datos para decidir.",
    summary: "Profesionales sin límite · analítica avanzada · 1.500 minutos incluidos",
    features: [
      "Todo lo de Pro",
      "Profesionales sin límite en tu agenda",
      "Analítica avanzada: demanda no atendida, horas punta y el resultado de cada llamada",
      "1.500 minutos de llamadas incluidos",
    ],
    featured: false,
  },
] as const;

export const starterPlan = plans[0];

/**
 * Días de prueba de la suscripción. Debe coincidir con `CHECKOUT_TRIAL_DAYS`
 * en `src/modules/billing/service.ts`, que es quien lo aplica en Stripe.
 */
export const TRIAL_DAYS = 7;

/** Tranquilizador que acompaña a cualquier bloque de precios. */
export const TRIAL_REASSURANCE = `${TRIAL_DAYS} días de prueba. Sin permanencia. Cancela cuando quieras.`;

/** IVA general de España: los precios de los planes se publican sin él. */
export const IVA_PORCENTAJE = 21;

export function formatPlanPrice(price: number) {
  return `${price} €`;
}

/** «71,39 € con IVA» para una cuota de 59 €. En céntimos para no arrastrar decimales. */
export function formatPriceWithVat(price: number) {
  const centimos = Math.round(price * (100 + IVA_PORCENTAJE));
  return `${(centimos / 100).toFixed(2).replace(".", ",")} € con IVA`;
}

export function formatExtraMinute(price: number) {
  return `${price.toFixed(2).replace(".", ",")} €/min adicional + IVA`;
}

/** «Desde 59 € + IVA/mes»: el precio vigente del plan más barato. */
export const PRECIO_DESDE = `Desde ${plans[0].price} € + IVA/mes`;

export function formatIncludedMinutes(minutes: number) {
  return new Intl.NumberFormat("es-ES").format(minutes);
}
