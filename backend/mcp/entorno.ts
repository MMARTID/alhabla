import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

/**
 * Entorno del MCP de desarrollo: el `.env` de la raíz del checkout PRINCIPAL
 * (el mismo que lee docker-compose), aunque el MCP se lance desde un
 * worktree, que no lo tiene. Se localiza con `git rev-parse --git-common-dir`,
 * que en un worktree apunta al `.git` del checkout principal.
 * `ALHABLA_ENV_FILE` lo sobrescribe.
 */
export function rutaDelEnv(): string {
  if (process.env.ALHABLA_ENV_FILE) return process.env.ALHABLA_ENV_FILE;

  const aqui = dirname(fileURLToPath(import.meta.url));
  try {
    const gitComun = execFileSync(
      "git",
      ["rev-parse", "--path-format=absolute", "--git-common-dir"],
      { cwd: aqui, encoding: "utf8" }
    ).trim();
    const candidato = join(dirname(gitComun), ".env");
    if (existsSync(candidato)) return candidato;
  } catch {
    // Sin git: se cae a la raíz de este checkout.
  }
  return resolve(aqui, "../../.env");
}

export function cargarEnv(): Record<string, string> {
  const ruta = rutaDelEnv();
  if (!existsSync(ruta)) {
    throw new Error(`[MCP] No existe el .env de desarrollo en ${ruta}`);
  }
  return dotenv.parse(readFileSync(ruta));
}

export function variable(env: Record<string, string>, nombre: string): string {
  const valor = env[nombre];
  if (!valor) {
    throw new Error(`[MCP] Falta ${nombre} en el .env de desarrollo`);
  }
  return valor;
}

const HOSTS_LOCALES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/**
 * `DATABASE_URL` de dev vista desde el Mac. En el `.env` el host es
 * `postgres` (el nombre del servicio de Compose, para el contenedor); desde
 * fuera es localhost:5433 (el override de compose publica Postgres ahí
 * porque el 5432 lo ocupa el Postgres de Homebrew). `ALHABLA_DEV_DB_PORT`
 * cambia el puerto.
 *
 * Se niega a devolver nada que no sea local: el MCP de dev nunca debe poder
 * escribir en una BD remota por un `.env` mal copiado.
 */
export function urlDeBdDeDev(env: Record<string, string>): string {
  const url = new URL(variable(env, "DATABASE_URL"));
  if (url.hostname === "postgres") {
    url.hostname = "localhost";
    url.port = process.env.ALHABLA_DEV_DB_PORT ?? "5433";
  }
  // `?host=` manda sobre el host de la URL (así se conecta producción, por
  // el socket /cloudsql/…): con él, «localhost» no dice nada.
  if (!HOSTS_LOCALES.has(url.hostname) || url.searchParams.has("host")) {
    throw new Error(
      `[MCP] La DATABASE_URL de desarrollo no es local (${url.searchParams.get("host") ?? url.hostname}); el MCP de dev no se conecta a ella`
    );
  }
  return url.toString();
}

/** Solo URLs de localhost: los webhooks simulados nunca salen del Mac. */
export function exigirUrlLocal(base: string): URL {
  const url = new URL(base);
  if (!HOSTS_LOCALES.has(url.hostname)) {
    throw new Error(
      `[MCP] ${base} no es local; los webhooks simulados solo van a localhost`
    );
  }
  return url;
}
