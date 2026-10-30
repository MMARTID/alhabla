/**
 * La configuración pública del dashboard, leída una sola vez al cargar el
 * módulo. Next solo sustituye las variables `NEXT_PUBLIC_*` cuando se
 * escriben de forma literal (`process.env.NEXT_PUBLIC_X`): no se pueden leer
 * con un nombre calculado.
 *
 * En producción, una configuración incompleta o peligrosa LANZA al cargar: el
 * build de Vercel y el de CI fallan, en vez de desplegar un panel mudo (lo que
 * pasó dos veces con la app) o con una autenticación falsa.
 */

export type Configuracion = {
  /** Origen del backend. En desarrollo, el proxy `/api/backend` de Next. */
  apiBaseUrl: string;
  /** ID de cliente OAuth de Google (público). `null` si falta, solo en dev. */
  googleClientId: string | null;
};

/** Valor de relleno para desarrollo: el rewrite de next.config.mjs. */
export const API_LOCAL = "/api/backend";

export function leerConfiguracion(): Configuracion {
  const enProduccion = process.env.NODE_ENV === "production";
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  const googleClientId =
    process.env.NEXT_PUBLIC_GROWTH_GOOGLE_CLIENT_ID?.trim() || null;

  if (enProduccion) {
    // El modo demostración pone una sesión falsa y datos inventados en un
    // panel que aprueba contactos externos: en producción no puede existir
    // ni con valor vacío.
    if (process.env.NEXT_PUBLIC_GROWTH_DEMO !== undefined) {
      throw new Error(
        "[Growth] NEXT_PUBLIC_GROWTH_DEMO no puede existir en producción: es solo para desarrollo (quítala de las variables del proyecto)."
      );
    }
    if (!apiBaseUrl) {
      throw new Error(
        "[Growth] Falta NEXT_PUBLIC_API_BASE_URL en el build de producción: sin ella el panel saldría hablando con un proxy a localhost."
      );
    }
    if (!googleClientId) {
      throw new Error(
        "[Growth] Falta NEXT_PUBLIC_GROWTH_GOOGLE_CLIENT_ID en el build de producción: sin ella nadie podría iniciar sesión."
      );
    }
  }

  return { apiBaseUrl: apiBaseUrl || API_LOCAL, googleClientId };
}

export const config: Configuracion = leerConfiguracion();
