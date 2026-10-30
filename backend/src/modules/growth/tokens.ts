import { createHash, randomBytes } from "node:crypto";

/**
 * Los tokens de agente de Alhabla Growth llevan este prefijo para que un
 * JWT de cliente (o cualquier otro Bearer) se rechace sin tocar la base de
 * datos, y para que un escáner de secretos los reconozca si se filtran.
 */
export const PREFIJO_DE_TOKEN = "gta_";

/** Lo único que se guarda del token: su SHA-256. */
export function hashDeToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Token nuevo: se enseña una sola vez; en la base solo va el hash. */
export function generarTokenDeAgente(): { token: string; hash: string } {
  const token = `${PREFIJO_DE_TOKEN}${randomBytes(32).toString("base64url")}`;
  return { token, hash: hashDeToken(token) };
}

/** Correos con permiso de administrador: GROWTH_ADMIN_EMAILS, separados por comas. */
export function administradoresDeGrowth(
  valor: string | undefined = process.env.GROWTH_ADMIN_EMAILS
): string[] {
  return (valor ?? "")
    .split(",")
    .map((correo) => correo.trim().toLowerCase())
    .filter(Boolean);
}
