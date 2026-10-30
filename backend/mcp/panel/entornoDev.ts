import { execFile, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const ejecutar = promisify(execFile);

/**
 * Lo que el panel de desarrollo sabe del entorno fijo (scripts/dev/entorno.sh):
 * qué rama enseña ~/.alhabla-dev, si cada pieza responde y si el backend de
 * dev sigue montado donde debe (una sesión puede haberlo movido a su worktree:
 * es la «mezcla» que este entorno quiere evitar).
 */
export const DIR_DEV =
  process.env.ALHABLA_DEV_DIR ?? join(homedir(), ".alhabla-dev");
/** La raíz de las herramientas: este fichero está en backend/mcp/panel. */
export const HERRAMIENTAS = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../.."
);
/** La carpeta FIJA de las herramientas, aunque este código corra desde otro
 * checkout (un MCP lanzado desde un worktree, los tests). */
export const DIR_HERRAMIENTAS =
  process.env.ALHABLA_HERRAMIENTAS_DIR ?? join(homedir(), ".alhabla-mcp");
const ESTADO = join(homedir(), "Library/Caches/alhabla-dev");
export const LOG_DEL_ENTORNO = join(
  homedir(),
  "Library/Logs/alhabla-dev/entorno.log"
);

async function comando(
  programa: string,
  argumentos: string[],
  timeoutMs = 10_000
): Promise<string> {
  const { stdout } = await ejecutar(programa, argumentos, {
    timeout: timeoutMs,
    maxBuffer: 8 * 1024 * 1024,
  });
  return stdout.trim();
}

async function intentar<T>(trabajo: () => Promise<T>, siFalla: T): Promise<T> {
  try {
    return await trabajo();
  } catch {
    return siFalla;
  }
}

export type Pieza = {
  id: string;
  nombre: string;
  url?: string;
  estado: "ok" | "caido";
  detalle?: string;
};

async function responde(
  url: string,
  fetchFn: typeof fetch
): Promise<{ ok: boolean; detalle?: string }> {
  try {
    const respuesta = await fetchFn(url, {
      signal: AbortSignal.timeout(5_000),
      redirect: "manual",
    });
    // Cualquier respuesta HTTP vale (la app redirige a /login): está viva.
    return respuesta.status < 500
      ? { ok: true }
      : { ok: false, detalle: `HTTP ${respuesta.status}` };
  } catch (error) {
    return { ok: false, detalle: (error as Error).message };
  }
}

async function contenedor(
  nombre: string
): Promise<{ ok: boolean; detalle?: string }> {
  const estado = await intentar(
    () =>
      comando("docker", [
        "inspect",
        "-f",
        "{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}",
        nombre,
      ]),
    ""
  );
  if (!estado) return { ok: false, detalle: "no existe o Docker no responde" };
  const [corriendo, salud] = estado.split(" ");
  const ok = corriendo === "running" && (!salud || salud === "healthy");
  return ok ? { ok } : { ok, detalle: estado };
}

/** Dónde monta /app el backend de dev. */
export async function montajeDelBackend(): Promise<string | null> {
  const salida = await intentar(
    () =>
      comando("docker", [
        "inspect",
        "-f",
        '{{range .Mounts}}{{if eq .Destination "/app"}}{{.Source}}{{end}}{{end}}',
        "alhabla_backend_dev",
      ]),
    ""
  );
  return salida || null;
}

export async function estadoDelEntorno({
  fetchFn = fetch,
}: { fetchFn?: typeof fetch } = {}) {
  const git = (argumentos: string[]) =>
    intentar(() => comando("git", ["-C", DIR_DEV, ...argumentos]), "");
  const [cabecera, detras, montaje] = await Promise.all([
    git(["log", "-1", "--format=%h%x1f%s%x1f%cI"]),
    git(["rev-list", "--count", "HEAD..origin/main"]),
    montajeDelBackend(),
  ]);
  const [commit, asunto, fecha] = cabecera.split("\x1f");
  const rama = existsSync(join(ESTADO, "rama"))
    ? readFileSync(join(ESTADO, "rama"), "utf8").trim()
    : null;

  const comprobaciones: [
    string,
    string,
    Promise<{ ok: boolean; detalle?: string }>,
    string?,
  ][] = [
    [
      "backend",
      "Backend de dev",
      responde("http://localhost:3000/health", fetchFn),
      "http://localhost:3000/health",
    ],
    [
      "app",
      "App",
      responde("http://localhost:3001", fetchFn),
      "http://localhost:3001",
    ],
    [
      "web",
      "Web pública",
      responde("http://localhost:3002", fetchFn),
      "http://localhost:3002",
    ],
    ["postgres", "Postgres (BD botbook)", contenedor("alhabla_postgres")],
    [
      "tunel",
      "Túnel dev-api.alhabla.ai",
      responde("https://dev-api.alhabla.ai/health", fetchFn),
      "https://dev-api.alhabla.ai/health",
    ],
    [
      "sim",
      "Backend de simulación (MCP)",
      responde("http://localhost:3010/health", fetchFn),
      "http://localhost:3010/health",
    ],
  ];
  const piezas: Pieza[] = await Promise.all(
    comprobaciones.map(async ([id, nombre, comprobacion, url]) => {
      const { ok, detalle } = await comprobacion;
      return {
        id,
        nombre,
        ...(url ? { url } : {}),
        estado: ok ? "ok" : "caido",
        ...(detalle ? { detalle } : {}),
      } as Pieza;
    })
  );

  const esperado = join(DIR_DEV, "backend");
  return {
    carpeta: DIR_DEV,
    rama,
    commit: commit || null,
    asunto: asunto || null,
    fecha: fecha || null,
    commitsDetrasDeMain: detras === "" ? null : Number(detras),
    actualizando: existsSync(join(ESTADO, "actualizando")),
    parado: existsSync(join(ESTADO, "parado")),
    backendMontadoEn: montaje,
    // La mezcla: otra sesión levantó backend-dev desde su worktree.
    backendFueraDeSitio:
      montaje !== null && resolve(montaje) !== resolve(esperado),
    piezas,
  };
}

// ---------------------------------------------------------------------------
// Pull requests abiertos
// ---------------------------------------------------------------------------

type PrDeGh = {
  number: number;
  title: string;
  headRefName: string;
  url: string;
  isDraft: boolean;
  updatedAt: string;
  author?: { login?: string };
  statusCheckRollup?: { conclusion?: string | null; status?: string | null }[];
};

export function resumirPrs(prs: PrDeGh[]) {
  return prs.map((pr) => {
    const checks = pr.statusCheckRollup ?? [];
    const fallo = checks.some((c) =>
      ["FAILURE", "TIMED_OUT", "CANCELLED", "ACTION_REQUIRED"].includes(
        c.conclusion ?? ""
      )
    );
    const pendiente = checks.some((c) => c.status && c.status !== "COMPLETED");
    return {
      numero: pr.number,
      titulo: pr.title,
      rama: pr.headRefName,
      url: pr.url,
      borrador: pr.isDraft,
      actualizado: pr.updatedAt,
      autor: pr.author?.login ?? null,
      ci:
        checks.length === 0
          ? null
          : fallo
            ? "fallo"
            : pendiente
              ? "pendiente"
              : "ok",
    };
  });
}

export async function prsAbiertos() {
  const salida = await comando(
    "gh",
    [
      "pr",
      "list",
      "--repo",
      "MMARTID/alhabla",
      "--state",
      "open",
      "--limit",
      "30",
      "--json",
      "number,title,headRefName,url,isDraft,updatedAt,author,statusCheckRollup",
    ],
    30_000
  );
  return resumirPrs(JSON.parse(salida || "[]") as PrDeGh[]);
}

// ---------------------------------------------------------------------------
// Acciones
// ---------------------------------------------------------------------------

/** Una rama de git (o «main», o «#123»/«123» para un PR), sin nada raro. */
export function ramaValida(rama: string): boolean {
  return (
    /^#?\d+$/.test(rama) ||
    (/^[A-Za-z0-9][\w./-]{0,199}$/.test(rama) &&
      !rama.includes("..") &&
      !rama.endsWith(".lock"))
  );
}

const SCRIPT_DEL_ENTORNO = join(HERRAMIENTAS, "scripts/dev/entorno.sh");

/** Pone el entorno en otra rama, en segundo plano (tarda: dependencias,
 * migraciones, reinicios). Lo que hace va al log del entorno. */
export function verRamaEnDev(rama: string): void {
  if (!ramaValida(rama)) throw new Error(`«${rama}» no es una rama válida`);
  const hijo = spawn("/bin/bash", [SCRIPT_DEL_ENTORNO, "ver", rama], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, ALHABLA_DEV_DIR: DIR_DEV },
  });
  hijo.unref();
}

/**
 * Pone las herramientas en el último main (`entorno.sh herramientas`: con
 * cerrojo, dependencias y backend-sim si hace falta) y dice si cambiaron.
 */
export async function actualizarHerramientas(): Promise<{
  antes: string | null;
  despues: string | null;
  cambiaron: boolean;
}> {
  const commit = () =>
    intentar(
      () => comando("git", ["-C", DIR_HERRAMIENTAS, "rev-parse", "HEAD"]),
      ""
    );
  const antes = await commit();
  await comando("/bin/bash", [SCRIPT_DEL_ENTORNO, "herramientas"], 10 * 60_000);
  const despues = await commit();
  return {
    antes: antes || null,
    despues: despues || null,
    cambiaron: antes !== despues,
  };
}

/** Lo mismo sin esperar, al arrancar el MCP: cada sesión nueva deja las
 * herramientas al día para la siguiente. */
export function actualizarHerramientasEnSegundoPlano(): void {
  const hijo = spawn("/bin/bash", [SCRIPT_DEL_ENTORNO, "herramientas"], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, ALHABLA_DEV_DIR: DIR_DEV },
  });
  hijo.on("error", () => undefined);
  hijo.unref();
}

export const PIEZAS_QUE_SE_REINICIAN = [
  "backend",
  "app",
  "web",
  "sim",
] as const;
export type PiezaReiniciable = (typeof PIEZAS_QUE_SE_REINICIAN)[number];

export async function reiniciar(pieza: PiezaReiniciable): Promise<string> {
  const uid = process.getuid?.() ?? 501;
  switch (pieza) {
    case "backend":
      await comando("docker", ["restart", "alhabla_backend_dev"], 60_000);
      return "Backend de dev reiniciado";
    case "app":
    case "web":
      await comando("launchctl", [
        "kickstart",
        "-k",
        `gui/${uid}/ai.alhabla.dev.${pieza}`,
      ]);
      return `${pieza === "app" ? "App" : "Web"} reiniciándose (tarda unos segundos en compilar)`;
    case "sim":
      // Se levanta desde las herramientas, como hace el MCP.
      await comando(
        "/bin/sh",
        [join(HERRAMIENTAS, "scripts/backend-sim.sh")],
        180_000
      );
      return "Backend de simulación levantado en :3010";
  }
}

export function ultimasLineasDelRegistro(cuantas = 40): string[] {
  if (!existsSync(LOG_DEL_ENTORNO)) return [];
  return readFileSync(LOG_DEL_ENTORNO, "utf8")
    .trimEnd()
    .split("\n")
    .slice(-cuantas);
}
