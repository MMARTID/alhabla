import type { Prisma } from "@prisma/client";

/**
 * `voiceProvider` de las filas Call sintéticas que no son llamadas: los
 * chats de WhatsApp con clientes (modules/whatsapp/chatCliente.ts), las
 * citas que el dueño apunta con el Gestor (gestor/accionesAgenda.ts) y las
 * de la lista de espera (whatsapp/listaDeEspera.ts).
 */
export const PROVEEDOR_WHATSAPP = "whatsapp";

/**
 * Condición de Prisma sobre `Call` que deja solo las llamadas de voz que
 * han entrado de verdad por el número de Alhabla. Es la única prueba de que
 * el desvío funciona: la usan la guía del alta (onboarding/routes.ts) y el
 * mensaje del día 1 sobre el desvío (jobs/recordarDesvioSinComprobar.ts),
 * que no deben volver a divergir.
 */
export const SOLO_LLAMADAS_DE_VOZ = {
  voiceProvider: { not: PROVEEDOR_WHATSAPP },
} satisfies Prisma.CallWhereInput;
