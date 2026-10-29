import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { CONTENEDOR_DE_SIMULACION } from "./enviosSimulados.js";
import {
  DIR_HERRAMIENTAS,
  actualizarHerramientas,
  ramaValida,
} from "./panel/entornoDev.js";
import { BASE_TELNYX_SIMULACION } from "./webhooks.js";

const ejecutar = promisify(execFile);

/**
 * backend-sim (localhost:3010): el backend contra el que van los webhooks
 * simulados. Monta el `backend/` de la carpeta desde la que se levanta, así
 * que corre el código de ESA carpeta:
 *
 * - por defecto las herramientas (~/.alhabla-mcp), siempre en el último main;
 * - para probar una rama antes de fusionarla, ~/.alhabla-sim, un worktree
 *   detached en esa rama que solo usa backend-sim (sin node_modules: las
 *   dependencias son las de la imagen).
 *
 * El 28-10 una prueba E2E corrió contra código de seis días antes sin que
 * nada avisara: de ahí `estadoDeBackendSim` y `avisoDeBackendSimViejo`.
 */
export const DIR_SIM =
  process.env.ALHABLA_SIM_DIR ?? join(homedir(), ".alhabla-sim");
const ESTADO = join(homedir(), "Library/Caches/alhabla-dev");
const RAMA_DEL_SIM = join(ESTADO, "rama-sim");
/** Lo que cuenta como código de backend-sim al compararlo con main. */
const RUTAS_DEL_BACKEND = ["backend/src", "backend/prisma", "backend/package-lock.json"];

async function comando(
  programa: string,
  argumentos: string[],
  opciones: { cwd?: string; timeoutMs?: number } = {}
): Promise<string> {
  const { stdout } = await ejecutar(programa, argumentos, {
    cwd: opciones.cwd,
    timeout: opciones.timeoutMs ?? 15_000,
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

const git = (carpeta: string, argumentos: string[]) =>
  intentar(() => comando("git", ["-C", carpeta, ...argumentos]), "");

/** Carpeta (la raíz del checkout) cuyo backend/ monta backend-sim. */
export async function carpetaDeBackendSim(): Promise<{
  carpeta: string | null;
  enMarcha: boolean;
  desde: string | null;
}> {
  const salida = await intentar(
    () =>
      comando("docker", [
        "inspect",
        "-f",
        '{{.State.Running}}|{{.State.StartedAt}}|{{range .Mounts}}{{if eq .Destination "/app"}}{{.Source}}{{end}}{{end}}',
        CONTENEDOR_DE_SIMULACION,
      ]),
    ""
  );
  if (!salida) return { carpeta: null, enMarcha: false, desde: null };
  const [enMarcha, desde, montaje] = salida.split("|");
  return {
    carpeta: montaje ? dirname(montaje) : null,
    enMarcha: enMarcha === "true",
    desde: desde || null,
  };
}

function queCarpetaEs(carpeta: string | null): string | null {
  if (!carpeta) return null;
  if (resolve(carpeta) === resolve(DIR_HERRAMIENTAS)) return "herramientas";
  if (resolve(carpeta) === resolve(DIR_SIM)) return "rama";
  return "otra";
}

export async function estadoDeBackendSim({
  fetchFn = fetch,
}: { fetchFn?: typeof fetch } = {}) {
  const { carpeta, enMarcha, desde } = await carpetaDeBackendSim();
  const responde = await fetchFn(`${BASE_TELNYX_SIMULACION}/health`, {
    signal: AbortSignal.timeout(3_000),
  })
    .then((res) => res.status < 500)
    .catch(() => false);
  if (!carpeta) {
    return {
      enMarcha: false,
      responde,
      arreglo: "backend_sim con accion «levantar» (en main) o con una rama.",
    };
  }
  const tipo = queCarpetaEs(carpeta);
  const [cabecera, detras, sinCommitear] = await Promise.all([
    git(carpeta, ["log", "-1", "--format=%h%x1f%s%x1f%cI"]),
    git(carpeta, [
      "rev-list",
      "--count",
      "HEAD..origin/main",
      "--",
      ...RUTAS_DEL_BACKEND,
    ]),
    git(carpeta, ["status", "--porcelain", "--", "backend"]),
  ]);
  const [commit, asunto, fecha] = cabecera.split("\x1f");
  const rama =
    tipo === "herramientas"
      ? "main"
      : tipo === "rama" && existsSync(RAMA_DEL_SIM)
        ? readFileSync(RAMA_DEL_SIM, "utf8").trim()
        : null;
  return {
    enMarcha,
    responde,
    desde,
    carpeta,
    // herramientas: ~/.alhabla-mcp (main); rama: ~/.alhabla-sim; otra: un
    // worktree de sesión (se queda colgado si esa sesión lo borra).
    tipoDeCarpeta: tipo,
    rama,
    commit: commit || null,
    asunto: asunto || null,
    fecha: fecha || null,
    commitsDeBackendDetrasDeMain: detras === "" ? null : Number(detras),
    cambiosSinCommitearEnBackend: sinCommitear
      ? sinCommitear.split("\n").length
      : 0,
  };
}

let avisoEnCache: { hasta: number; aviso: string | null } | null = null;

/**
 * Un aviso si backend-sim corre código de backend que va por detrás de main
 * (o desde un worktree de sesión), para pegarlo a la respuesta de un webhook
 * simulado. Se calcula como mucho cada 5 minutos (con un fetch de main).
 */
export async function avisoDeBackendSimViejo(): Promise<string | null> {
  if (avisoEnCache && avisoEnCache.hasta > Date.now()) return avisoEnCache.aviso;
  const { carpeta } = await carpetaDeBackendSim();
  let aviso: string | null = null;
  if (carpeta) {
    await intentar(
      () => comando("git", ["-C", carpeta, "fetch", "-q", "origin", "main"]),
      ""
    );
    const estado = await estadoDeBackendSim();
    const detras =
      "commitsDeBackendDetrasDeMain" in estado
        ? (estado.commitsDeBackendDetrasDeMain ?? 0)
        : 0;
    if (estado.tipoDeCarpeta === "herramientas" && detras > 0) {
      aviso = `backend-sim corre main de ${estado.fecha} (${detras} commits de backend por detrás del main actual): backend_sim con accion «levantar» lo pone al día.`;
    } else if (estado.tipoDeCarpeta === "otra") {
      aviso = `backend-sim corre el código de ${carpeta} (un worktree de sesión, commit ${estado.commit}), no main.`;
    } else if (estado.tipoDeCarpeta === "rama") {
      aviso = `backend-sim corre la rama ${estado.rama ?? "?"} (${estado.commit}), no main.`;
    }
  }
  avisoEnCache = { hasta: Date.now() + 5 * 60_000, aviso };
  return aviso;
}

function olvidarAviso() {
  avisoEnCache = null;
}

async function resolverRama(pedida: string): Promise<string> {
  const limpia = pedida.replace(/^#/, "");
  if (!/^\d+$/.test(limpia)) return limpia;
  const rama = await comando(
    "gh",
    [
      "pr",
      "view",
      limpia,
      "--repo",
      "MMARTID/botbook",
      "--json",
      "headRefName",
      "-q",
      ".headRefName",
    ],
    { timeoutMs: 30_000 }
  );
  if (!rama) throw new Error(`[MCP] No encuentro el PR ${limpia}`);
  return rama;
}

/** Raíz del checkout principal, del que cuelgan los worktrees. */
async function checkoutPrincipal(): Promise<string> {
  const comun = await comando("git", [
    "-C",
    DIR_HERRAMIENTAS,
    "rev-parse",
    "--path-format=absolute",
    "--git-common-dir",
  ]);
  return dirname(comun);
}

/** Pone ~/.alhabla-sim en origin/<rama> (lo crea la primera vez). */
async function prepararCarpetaDeRama(rama: string): Promise<void> {
  const principal = await checkoutPrincipal();
  await comando("git", ["-C", principal, "fetch", "-q", "origin", rama], {
    timeoutMs: 60_000,
  }).catch((error) => {
    throw new Error(
      `[MCP] La rama ${rama} no está en origin (¿falta el push?): ${(error as Error).message.split("\n")[0]}`,
      { cause: error }
    );
  });
  const ref = `origin/${rama}`;
  if (!existsSync(join(DIR_SIM, ".git"))) {
    await comando(
      "git",
      ["-C", principal, "worktree", "add", "-q", "--detach", DIR_SIM, ref],
      { timeoutMs: 120_000 }
    );
  } else {
    const sucio = await git(DIR_SIM, ["status", "--porcelain"]);
    if (sucio) {
      throw new Error(
        `[MCP] ${DIR_SIM} tiene cambios a mano; no se toca. Revísalos o bórrala (git worktree remove --force ${DIR_SIM}).`
      );
    }
    await comando("git", ["-C", DIR_SIM, "checkout", "-q", "--detach", ref]);
  }
  mkdirSync(ESTADO, { recursive: true });
  writeFileSync(RAMA_DEL_SIM, `${rama}\n`);
}

export type AccionDeBackendSim =
  | "estado"
  | "levantar"
  | "reiniciar"
  | "reconstruir"
  | "parar";

/**
 * Levanta backend-sim en main (las herramientas, puestas antes al día) o en
 * una rama (~/.alhabla-sim), lo reinicia, lo reconstruye (dependencias
 * nuevas) o lo para. Al levantarlo aplica las migraciones de ese código a la
 * BD de dev (compartida, como hace ver_en_dev): sin ellas, una rama con
 * columnas nuevas fallaría en cada tool.
 */
export async function gestionarBackendSim(
  accion: AccionDeBackendSim,
  rama?: string
) {
  if (accion === "estado") return estadoDeBackendSim();
  olvidarAviso();

  const actual = await carpetaDeBackendSim();
  if (accion === "parar") {
    const carpeta = actual.carpeta ?? DIR_HERRAMIENTAS;
    await comando("/bin/sh", [join(carpeta, "scripts/backend-sim.sh"), "parar"], {
      cwd: carpeta,
      timeoutMs: 60_000,
    });
    return { mensaje: "backend-sim parado", carpeta };
  }

  let carpeta: string;
  let cambiosDeHerramientas: Awaited<
    ReturnType<typeof actualizarHerramientas>
  > | null = null;
  if (accion === "levantar") {
    if (rama && rama !== "main") {
      if (!ramaValida(rama)) throw new Error(`[MCP] «${rama}» no es una rama válida`);
      const nombre = await resolverRama(rama);
      await prepararCarpetaDeRama(nombre);
      carpeta = DIR_SIM;
    } else {
      cambiosDeHerramientas = await actualizarHerramientas().catch(() => null);
      carpeta = DIR_HERRAMIENTAS;
    }
  } else {
    if (!actual.carpeta) {
      throw new Error(
        "[MCP] backend-sim no existe: usa accion «levantar»."
      );
    }
    carpeta = actual.carpeta;
  }

  // Unas dependencias distintas de las de la imagen piden reconstruirla.
  let paso: "levantar" | "reiniciar" | "reconstruir" = accion;
  if (paso === "levantar" && actual.carpeta) {
    const [lockActual, lockNuevo] = await Promise.all([
      git(actual.carpeta, ["rev-parse", "HEAD:backend/package-lock.json"]),
      git(carpeta, ["rev-parse", "HEAD:backend/package-lock.json"]),
    ]);
    if (lockActual && lockNuevo && lockActual !== lockNuevo) {
      paso = "reconstruir";
    }
  }

  await comando("/bin/sh", [join(carpeta, "scripts/backend-sim.sh"), paso], {
    cwd: carpeta,
    timeoutMs: paso === "reconstruir" ? 15 * 60_000 : 4 * 60_000,
  }).catch((error) => {
    const detalle = (error as { stderr?: string }).stderr?.trim().split("\n").slice(-3).join(" ");
    throw new Error(
      `[MCP] scripts/backend-sim.sh ${paso} falló en ${carpeta}: ${detalle || (error as Error).message}`,
      { cause: error }
    );
  });

  const migraciones = await comando(
    "docker",
    ["exec", CONTENEDOR_DE_SIMULACION, "npx", "prisma", "migrate", "deploy"],
    { timeoutMs: 120_000 }
  )
    .then(resumirMigraciones)
    .catch((error) => ({
      error: `prisma migrate deploy falló: ${(error as Error).message.split("\n").slice(-2).join(" ")}`,
    }));

  return {
    hecho: paso,
    ...(cambiosDeHerramientas?.cambiaron
      ? {
          herramientasActualizadas: `${cambiosDeHerramientas.antes?.slice(0, 7)} → ${cambiosDeHerramientas.despues?.slice(0, 7)}`,
        }
      : {}),
    migraciones,
    estado: await estadoDeBackendSim(),
  };
}

/** Lo que importa de la salida de `prisma migrate deploy`. */
export function resumirMigraciones(salida: string) {
  const aplicadas = [...salida.matchAll(/Applying migration `([^`]+)`/g)].map(
    (coincidencia) => coincidencia[1]
  );
  if (aplicadas.length > 0) return { aplicadas };
  return /No pending migrations/i.test(salida)
    ? { aplicadas: [], mensaje: "Ninguna pendiente" }
    : { aplicadas: [], salida: salida.split("\n").slice(-4).join("\n") };
}
