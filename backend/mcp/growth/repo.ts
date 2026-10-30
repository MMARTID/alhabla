import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

/**
 * El repositorio desde el que corre el MCP (en la práctica `~/.alhabla-mcp`,
 * la copia fija en `main`, o el worktree de la sesión). Solo se LEE: ninguna
 * herramienta de Growth cambia de rama, hace `checkout` ni modifica ficheros.
 * Los argumentos de git son fijos en el código; nada que venga del modelo
 * llega a la línea de órdenes.
 */

/** La raíz del repo: `backend/mcp/growth/` está tres niveles por debajo. */
export function raizDelRepo(): string {
  return fileURLToPath(new URL("../../../", import.meta.url)).replace(
    /\/$/,
    ""
  );
}

export type Git = (
  argumentos: string[],
  opciones?: { timeoutMs?: number }
) => Promise<string>;

/** Un fallo de git con el código de salida (para `merge-base --is-ancestor`, que usa 1 como «no»). */
export class ErrorDeGit extends Error {
  constructor(
    mensaje: string,
    readonly codigo: number | string | null
  ) {
    super(mensaje);
    this.name = "ErrorDeGit";
  }
}

export function crearGit(raiz: string): Git {
  return (argumentos, opciones = {}) =>
    new Promise((resolver, rechazar) => {
      execFile(
        "git",
        ["-C", raiz, ...argumentos],
        {
          timeout: opciones.timeoutMs ?? 20_000,
          maxBuffer: 4 * 1024 * 1024,
          // Sin preguntas por terminal: si pide credenciales, falla.
          env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
        },
        (error, stdout, stderr) => {
          if (error) {
            const e = error as { code?: number | string; killed?: boolean };
            const detalle = String(stderr || error.message)
              .trim()
              .split("\n")
              .slice(-2)
              .join(" ");
            rechazar(
              new ErrorDeGit(
                e.killed ? `git ${argumentos[0]} tardó demasiado` : detalle,
                e.code ?? null
              )
            );
            return;
          }
          resolver(String(stdout).trim());
        }
      );
    });
}

export const COMANDO_PARA_ACTUALIZAR_LA_COPIA =
  "bash ~/.alhabla-mcp/scripts/dev/entorno.sh herramientas";

export type EstadoDelRepo = {
  commit: string | null;
  rama: string | null;
  /** Commits de `origin/main` que le faltan a HEAD (`null` si no se pudo saber). */
  detrasDeMain: number | null;
  /** Commits de HEAD que `origin/main` no tiene. */
  delanteDeMain: number | null;
  /** Sin cambios sin commit ni ficheros nuevos sin seguir (`null` si no se pudo saber). */
  limpio: boolean | null;
  /** `false` si `git fetch` falló (sin red): `detrasDeMain` puede estar desfasado. */
  fetchHecho: boolean;
  problema?: string;
};

async function numero(git: Git, argumentos: string[]): Promise<number | null> {
  try {
    const n = Number(await git(argumentos));
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** Dónde está el repo respecto a `origin/main`. Nunca lanza: cada dato que falte sale `null`. */
export async function estadoDelRepo(
  git: Git,
  opciones: { fetch?: boolean } = {}
): Promise<EstadoDelRepo> {
  let fetchHecho = false;
  if (opciones.fetch !== false) {
    try {
      await git(["fetch", "-q", "origin", "main"], { timeoutMs: 30_000 });
      fetchHecho = true;
    } catch {
      fetchHecho = false;
    }
  }
  const [commit, rama, detras, delante, sucio] = await Promise.all([
    git(["rev-parse", "HEAD"]).catch(() => null),
    git(["rev-parse", "--abbrev-ref", "HEAD"]).catch(() => null),
    numero(git, ["rev-list", "--count", "HEAD..origin/main"]),
    numero(git, ["rev-list", "--count", "origin/main..HEAD"]),
    git(["status", "--porcelain"]).catch(() => null),
  ]);
  return {
    commit,
    rama: rama && rama !== "HEAD" ? rama : null,
    detrasDeMain: detras,
    delanteDeMain: delante,
    limpio: sucio === null ? null : sucio === "",
    fetchHecho,
    ...(commit ? {} : { problema: "No se pudo leer el commit de HEAD." }),
  };
}

/** `git rev-parse HEAD` para `versionPrompts`; `undefined` si no se puede. */
export async function versionDePrompts(git: Git): Promise<string | undefined> {
  try {
    const sha = await git(["rev-parse", "HEAD"]);
    return /^[0-9a-f]{7,40}$/.test(sha) ? sha : undefined;
  } catch {
    return undefined;
  }
}

/** ¿`a` es ascendiente de `b`? `merge-base --is-ancestor` sale con 1 cuando no. */
export async function esAscendiente(
  git: Git,
  a: string,
  b: string
): Promise<boolean> {
  try {
    await git(["merge-base", "--is-ancestor", a, b]);
    return true;
  } catch (error) {
    if (error instanceof ErrorDeGit && error.codigo === 1) return false;
    throw error;
  }
}
