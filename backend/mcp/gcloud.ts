import { execFile } from "node:child_process";
import { promisify } from "node:util";

const ejecutar = promisify(execFile);

/** Producción (AGENTS.md § Deployment Notes). */
export const PROYECTO = "project-84381467-a606-4b71-a6e";
export const REGION = "europe-west1";
export const SERVICIO = "alhabla-api";
export const REPOSITORIO = "MMARTID/alhabla";

/**
 * Lo que dicen gcloud y cloud-sql-proxy cuando la sesión de Google del Mac ha
 * caducado o se ha revocado (29-10: el dueño creó una contraseña de Google en
 * una cuenta que antes entraba por Zoho y todas las herramientas de
 * producción fallaban con un «Reauthentication failed» sin pista).
 */
const SESION_CADUCADA =
  /Reauthentication failed|invalid_grant|problem refreshing your current auth tokens|gcloud auth login|do not currently have an active account|Request had invalid authentication credentials/i;

export const COMO_VOLVER_A_ENTRAR =
  "Ejecuta en una terminal del Mac `gcloud auth login admin@alhabla.ai` (pide la contraseña de la cuenta de Google, no la del Mac) y vuelve a llamar a la herramienta; no hace falta reiniciar el MCP.";

/** El motivo de un fallo de gcloud, con el arreglo si es la sesión. */
export function explicarFalloDeGcloud(detalle: string): string {
  return SESION_CADUCADA.test(detalle)
    ? `La sesión de Google de gcloud ha caducado o no es válida. ${COMO_VOLVER_A_ENTRAR} (gcloud dijo: ${detalle})`
    : detalle;
}

/** Firma de un ejecutor de gcloud: se inyecta en los tests. */
export type Gcloud = (argumentos: string[]) => Promise<string>;

/**
 * `gcloud <argumentos> --project=<producción>` con las credenciales del Mac.
 * Devuelve stdout; si falla, un error con las últimas líneas de stderr (sin
 * el comando entero, que puede llevar un filtro largo).
 */
export const gcloud: Gcloud = async (argumentos) => {
  try {
    const { stdout } = await ejecutar(
      "gcloud",
      [...argumentos, `--project=${PROYECTO}`],
      { maxBuffer: 64 * 1024 * 1024, timeout: 90_000 }
    );
    return stdout;
  } catch (error) {
    const detalle = (
      (error as { stderr?: string }).stderr || (error as Error).message
    )
      .trim()
      .split("\n")
      .slice(-3)
      .join(" ");
    throw new Error(
      `[MCP] gcloud ${argumentos.slice(0, 3).join(" ")} falló: ${explicarFalloDeGcloud(detalle)}`,
      { cause: error }
    );
  }
};

/** Un secreto de Secret Manager. Nunca se devuelve en una respuesta. */
export async function leerSecreto(
  nombre: string,
  gcloudFn: Gcloud = gcloud
): Promise<string> {
  return (
    await gcloudFn([
      "secrets",
      "versions",
      "access",
      "latest",
      `--secret=${nombre}`,
    ])
  ).trim();
}

/** `gh` contra el repositorio (para el último deploy). */
export async function gh(argumentos: string[]): Promise<string> {
  try {
    const { stdout } = await ejecutar(
      "gh",
      [...argumentos, "--repo", REPOSITORIO],
      {
        maxBuffer: 8 * 1024 * 1024,
        timeout: 30_000,
      }
    );
    return stdout;
  } catch (error) {
    throw new Error(
      `[MCP] gh ${argumentos.slice(0, 2).join(" ")} falló: ${(error as Error).message.split("\n")[0]}`,
      { cause: error }
    );
  }
}
