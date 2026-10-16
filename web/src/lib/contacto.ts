/**
 * Contacto con una persona del equipo antes de pagar: el formulario de
 * /contacto (`POST /contacto` en el backend, que avisa a hola@alhabla.ai) y
 * el botón de WhatsApp.
 */

/** Las mismas opciones que acepta el backend (modules/contacto/routes.ts). */
export const OPCIONES_DE_SEDES = [
  { valor: "1", etiqueta: "1" },
  { valor: "2-4", etiqueta: "2–4" },
  { valor: "5+", etiqueta: "5 o más" },
  { valor: "franquicia", etiqueta: "Franquicia" },
] as const;

export type Sedes = (typeof OPCIONES_DE_SEDES)[number]["valor"];

/**
 * WhatsApp del equipo, en internacional y sin «+» (`34600123456`), o `null`
 * mientras no haya uno: entonces el botón no se pinta. No vale ninguno de los
 * números de Alhabla («Alhabla» y «Alhabla Reservas»): esos los contesta la
 * IA, y aquí quien escribe quiere hablar con una persona.
 */
export const WHATSAPP_DEL_EQUIPO: string | null = null;

const SALUDO_DE_WHATSAPP = "Hola, me gustaría saber más sobre Alhabla para mi negocio.";

/** Enlace `wa.me` con el saludo ya escrito; `null` si no hay número. */
export function enlaceDeWhatsappDelEquipo(): string | null {
  if (!WHATSAPP_DEL_EQUIPO) return null;
  return `https://wa.me/${WHATSAPP_DEL_EQUIPO}?text=${encodeURIComponent(SALUDO_DE_WHATSAPP)}`;
}

export type CampoDeContacto = "nombre" | "email" | "telefono" | "negocio" | "sedes" | "mensaje";

const CAMPOS: readonly CampoDeContacto[] = ["nombre", "email", "telefono", "negocio", "sedes", "mensaje"];

export type ErrorDeContacto = {
  /** Lo que se enseña sobre el botón. */
  general: string;
  /** El mensaje de cada campo que el backend rechazó (400). */
  campos: Partial<Record<CampoDeContacto, string>>;
};

/**
 * Traduce la respuesta del backend a lo que enseña el formulario. Los 400
 * traen un mensaje en español por campo (Zod); el 429 y los 5xx llegan en
 * inglés de Fastify, así que se reescriben.
 */
export function describirErrorDeContacto(error: unknown, buzon: string): ErrorDeContacto {
  const respuesta = (error as {
    response?: { status?: number; data?: { error?: string | Array<{ path?: unknown[]; message?: string }> } };
  }).response;
  const estado = respuesta?.status;
  const detalle = respuesta?.data?.error;

  if (estado === 400 && Array.isArray(detalle)) {
    const campos: ErrorDeContacto["campos"] = {};
    for (const problema of detalle) {
      const campo = problema.path?.[0];
      if (typeof campo === "string" && (CAMPOS as readonly string[]).includes(campo) && problema.message) {
        campos[campo as CampoDeContacto] ??= problema.message;
      }
    }
    return { general: "Revisa los campos marcados.", campos };
  }
  if (estado === 429) {
    return {
      general: `Has enviado varios mensajes seguidos. Espera unos minutos o escríbenos a ${buzon}.`,
      campos: {},
    };
  }
  if (typeof detalle === "string" && estado === 502) {
    return { general: detalle, campos: {} };
  }
  return {
    general: `No hemos podido enviar tu mensaje. Inténtalo de nuevo o escríbenos a ${buzon}.`,
    campos: {},
  };
}
