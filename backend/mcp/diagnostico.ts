import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { estadoDeBackendSim } from "./backendSim.js";
import { cargarEnv, rutaDelEnv, urlDeBdDeDev } from "./entorno.js";
import { COMO_VOLVER_A_ENTRAR, explicarFalloDeGcloud } from "./gcloud.js";
import { comprobarGrowth } from "./growth/comprobacion.js";
import type { LeerLlavero } from "./growth/credenciales.js";
import { DIR_HERRAMIENTAS, HERRAMIENTAS } from "./panel/entornoDev.js";
import { ejecutarSoloLectura } from "./sqlDeSoloLectura.js";

const ejecutar = promisify(execFile);

/**
 * ¿Por qué falla una herramienta? Cada pieza de la que dependen, comprobada
 * a la vez, con el arreglo de lo que no está bien. Nace del 29-10: la sesión
 * de gcloud caducada tumbó todo lo de producción con un error opaco, y la
 * copia del MCP llevaba seis días sin actualizarse.
 */
export type Comprobacion = {
  pieza: string;
  ok: boolean;
  detalle?: string;
  arreglo?: string;
};

async function salida(
  programa: string,
  argumentos: string[],
  opciones: { cwd?: string; timeoutMs?: number } = {}
): Promise<string> {
  const { stdout, stderr } = await ejecutar(programa, argumentos, {
    cwd: opciones.cwd,
    timeout: opciones.timeoutMs ?? 20_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  return (stdout || stderr).trim();
}

function motivo(error: unknown): string {
  const e = error as { stderr?: string; code?: string; message?: string };
  if (e.code === "ENOENT") return "no está instalado (o no está en el PATH)";
  return (e.stderr || e.message || String(error))
    .trim()
    .split("\n")
    .slice(-2)
    .join(" ");
}

async function comprobar(
  pieza: string,
  trabajo: () => Promise<string | undefined>,
  arreglo: string | ((detalle: string) => string)
): Promise<Comprobacion> {
  try {
    const detalle = await trabajo();
    return { pieza, ok: true, ...(detalle ? { detalle } : {}) };
  } catch (error) {
    const detalle = motivo(error);
    return {
      pieza,
      ok: false,
      detalle,
      arreglo: typeof arreglo === "string" ? arreglo : arreglo(detalle),
    };
  }
}

/** El commit con el que arrancó ESTE proceso del MCP (lo que tiene cargado). */
let commitAlArrancar: string | null = null;
export async function recordarCommitAlArrancar(): Promise<void> {
  commitAlArrancar = await salida("git", ["-C", HERRAMIENTAS, "rev-parse", "HEAD"]).catch(
    () => null
  );
}

async function herramientas(): Promise<Comprobacion> {
  return comprobar(
    "Herramientas al día (~/.alhabla-mcp)",
    async () => {
      await salida("git", ["-C", DIR_HERRAMIENTAS, "fetch", "-q", "origin", "main"], {
        timeoutMs: 30_000,
      }).catch(() => undefined);
      const [carpeta, main, detras] = await Promise.all([
        salida("git", ["-C", DIR_HERRAMIENTAS, "rev-parse", "HEAD"]),
        salida("git", ["-C", DIR_HERRAMIENTAS, "rev-parse", "origin/main"]),
        salida("git", ["-C", DIR_HERRAMIENTAS, "rev-list", "--count", "HEAD..origin/main"]),
      ]);
      const cargado = commitAlArrancar;
      const partes = [
        `carpeta en ${carpeta.slice(0, 7)}`,
        `main en ${main.slice(0, 7)}`,
        `este MCP arrancó con ${cargado?.slice(0, 7) ?? "?"}${HERRAMIENTAS !== DIR_HERRAMIENTAS ? ` (desde ${HERRAMIENTAS})` : ""}`,
      ];
      if (Number(detras) > 0) {
        throw new Error(
          `${partes.join("; ")}: la carpeta va ${detras} commits por detrás de main`
        );
      }
      return cargado && cargado !== carpeta
        ? `${partes.join("; ")}. La carpeta ya está al día; el código nuevo del MCP vale en la próxima sesión.`
        : partes.join("; ");
    },
    "Se pone al día sola (al arrancar el MCP y cada 15 min desde el panel). Para forzarlo: `bash ~/.alhabla-mcp/scripts/dev/entorno.sh herramientas`; el código nuevo del MCP vale en la próxima sesión."
  );
}

/**
 * Alhabla Growth: el token de agente y la API (`GET /growth/agente/contexto`).
 * Mientras no haya token es opcional (ok, «sin configurar»): hasta la Fase 2
 * nadie lo necesita y no debe ensuciar el panel. Con token configurado pero
 * inválido, sin alcance, con una URL no permitida o con la API caída, falla con
 * su arreglo. Nunca devuelve el token.
 */
export async function comprobacionDeGrowth({
  fetchFn = fetch,
  env = process.env,
  leerLlavero,
}: {
  fetchFn?: typeof fetch;
  env?: Record<string, string | undefined>;
  leerLlavero?: LeerLlavero;
} = {}): Promise<Comprobacion> {
  const pieza = "Alhabla Growth (token de agente y API)";
  try {
    const r = await comprobarGrowth({ fetchFn, env, leerLlavero });
    return {
      pieza,
      ok: r.ok,
      detalle: r.detalle,
      ...(r.ok && r.estado !== "sin_configurar" ? {} : { arreglo: r.arreglo }),
    };
  } catch (error) {
    return {
      pieza,
      ok: false,
      detalle: motivo(error),
      arreglo:
        "Prueba estado_growth (alhabla-growth) o `GET /growth/agente/contexto` con el token.",
    };
  }
}

export async function diagnosticarMcp({
  fetchFn = fetch,
}: { fetchFn?: typeof fetch } = {}) {
  const env = (() => {
    try {
      return cargarEnv();
    } catch {
      return null;
    }
  })();

  const comprobaciones = await Promise.all([
    herramientas(),
    comprobar(
      ".env de desarrollo",
      async () => {
        if (!env) throw new Error(`No se puede leer ${rutaDelEnv()}`);
        const faltan = [
          "DATABASE_URL",
          "JWT_SECRET",
          "TELNYX_API_KEY",
          "TELNYX_PRIVATE_KEY_SIMULACION",
        ].filter((nombre) => !env[nombre]);
        if (faltan.length > 0) throw new Error(`Faltan ${faltan.join(", ")}`);
        return rutaDelEnv();
      },
      "El .env vive en la raíz del checkout principal (~/AsistAI/.env). TELNYX_PRIVATE_KEY_SIMULACION la genera `npx tsx mcp/generarClavesDeSimulacion.ts` (desde backend/)."
    ),
    comprobar(
      "gcloud (producción)",
      async () => {
        const cuenta = await salida("gcloud", ["config", "get-value", "account"]);
        await salida("gcloud", ["auth", "print-access-token", "--quiet"]);
        return `sesión válida de ${cuenta}`;
      },
      (detalle) =>
        explicarFalloDeGcloud(detalle) === detalle
          ? `Revisa gcloud (\`gcloud auth list\`). ${COMO_VOLVER_A_ENTRAR}`
          : COMO_VOLVER_A_ENTRAR
    ),
    comprobar(
      "cloud-sql-proxy (BD de producción)",
      async () => salida("cloud-sql-proxy", ["--version"]),
      "brew install cloud-sql-proxy"
    ),
    comprobar(
      "gh (PRs y deploys)",
      async () => {
        const estado = await salida("gh", ["auth", "status"]);
        return /Logged in to github.com account (\S+)/.exec(estado)?.[1];
      },
      "gh auth login"
    ),
    comprobar(
      "Docker",
      async () => `servidor ${await salida("docker", ["info", "--format", "{{.ServerVersion}}"])}`,
      "Abre Docker Desktop (o `bash ~/.alhabla-mcp/scripts/dev/entorno.sh arrancar`)."
    ),
    comprobar(
      "Postgres de dev (botbook)",
      async () => {
        if (!env) throw new Error("Sin .env");
        await ejecutarSoloLectura(urlDeBdDeDev(env), "SELECT 1");
        return undefined;
      },
      "Levanta el perfil dev: `bash ~/.alhabla-mcp/scripts/dev/entorno.sh arrancar` (o mira estado_dev)."
    ),
    comprobar(
      "Backend de dev (:3000)",
      async () => {
        const res = await fetchFn("http://localhost:3000/health", {
          signal: AbortSignal.timeout(4_000),
        });
        if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
        return undefined;
      },
      "Mira estado_dev (y backendFueraDeSitio); ver_en_dev main lo vuelve a poner."
    ),
    comprobar(
      "backend-sim (:3010, webhooks simulados)",
      async () => {
        const estado = await estadoDeBackendSim({ fetchFn });
        if (!estado.responde) throw new Error("no responde");
        const detras =
          "commitsDeBackendDetrasDeMain" in estado
            ? (estado.commitsDeBackendDetrasDeMain ?? 0)
            : 0;
        const desde = !("tipoDeCarpeta" in estado)
          ? "?"
          : estado.tipoDeCarpeta === "herramientas"
            ? `main de ~/.alhabla-mcp (${estado.commit})`
            : estado.tipoDeCarpeta === "rama"
              ? `la rama ${estado.rama ?? "?"} en ~/.alhabla-sim (${estado.commit})`
              : `${estado.carpeta} (${estado.commit}), un worktree de sesión`;
        if (detras > 0 && "tipoDeCarpeta" in estado && estado.tipoDeCarpeta === "herramientas") {
          throw new Error(`corre ${desde}, ${detras} commits de backend por detrás de main`);
        }
        return `corre ${desde}`;
      },
      "backend_sim con accion «levantar» (main) o con una rama."
    ),
    comprobar(
      "Vercel CLI (visitas de la web)",
      async () => salida("vercel", ["whoami"], { cwd: "/private/tmp", timeoutMs: 20_000 }),
      "npm i -g vercel y `vercel login` (desde /private/tmp, fuera del repo)."
    ),
    comprobacionDeGrowth({ fetchFn }),
  ]);

  const mal = comprobaciones.filter((c) => !c.ok);
  return {
    todoBien: mal.length === 0,
    resumen:
      mal.length === 0
        ? "Todo lo que usa el MCP está bien."
        : `Falla: ${mal.map((c) => c.pieza).join(", ")}`,
    comprobaciones,
  };
}
