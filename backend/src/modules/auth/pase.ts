import { randomBytes } from "node:crypto";
import { consumirClave, guardarClave } from "../../lib/almacenTemporal.js";
import { errorMessage } from "../../lib/logUtils.js";

/**
 * Pase de un solo uso entre la web de marketing y la app
 * (docs/historico/PLAN-APP-DOMINIO.md § 3). La sesión es un JWT en
 * `localStorage`, que no
 * se comparte entre alhabla.ai y app.alhabla.ai: `POST /auth/register`
 * devuelve, además del token, un código aleatorio que vive 60 s en el
 * almacén temporal de Postgres (`claves_temporales`) y
 * muere al canjearse (`POST /auth/pase/canjear`). Así el JWT nunca viaja en
 * una URL. Crear el pase es best-effort: si el almacén falla, el registro sigue
 * devolviendo el token de siempre.
 */

export const PASE_TTL_SEGUNDOS = 60;
const PASE_BYTES = 32;

function clave(codigo: string): string {
  return `auth:pase:${codigo}`;
}

export function esPaseConFormatoValido(codigo: unknown): codigo is string {
  return typeof codigo === "string" && /^[0-9a-f]{64}$/.test(codigo);
}

export async function crearPase(user: {
  id: string;
  businessId: string;
}): Promise<string | null> {
  const codigo = randomBytes(PASE_BYTES).toString("hex");
  try {
    await guardarClave(
      clave(codigo),
      JSON.stringify({ id: user.id, businessId: user.businessId }),
      PASE_TTL_SEGUNDOS * 1000,
      { businessId: user.businessId }
    );
    return codigo;
  } catch (error) {
    console.error(
      `[Auth] No se pudo crear el pase del usuario ${user.id}; el registro sigue solo con el token: ${errorMessage(error)}`
    );
    return null;
  }
}

/** Devuelve el usuario del pase y lo borra; null si no existe, caducó o ya
 * se usó (la lectura y el borrado son una sola operación). */
export async function canjearPase(
  codigo: string
): Promise<{ id: string; businessId: string } | null> {
  if (!esPaseConFormatoValido(codigo)) return null;
  const raw = await consumirClave(clave(codigo));
  if (!raw) return null;
  try {
    const datos = JSON.parse(raw) as { id?: unknown; businessId?: unknown };
    return typeof datos.id === "string" && typeof datos.businessId === "string"
      ? { id: datos.id, businessId: datos.businessId }
      : null;
  } catch {
    return null;
  }
}
