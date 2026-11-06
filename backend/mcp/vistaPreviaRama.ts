import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { HERRAMIENTAS } from "./panel/entornoDev.js";

const ejecutar = promisify(execFile);

/**
 * La vista previa de un worktree cualquiera, sin tocar .claude/launch.json.
 *
 * preview_start arranca las vistas previas de launch.json en el checkout de
 * la SESIÓN: una sesión del checkout principal que trabaja en un worktree
 * veía siempre main (el 06-11 se editó cuatro veces el launch.json de main
 * para apuntarlo al worktree y se restauró con git checkout). Ahora
 * launch.json tiene `app-rama` (:3111) y `web-rama` (:3112), que lanzan
 * scripts/dev/vista-previa-rama.sh, y esta herramienta elige el worktree que
 * sirven: lo guarda en FICHERO_DE_VISTA_PREVIA y deja instaladas sus
 * dependencias. Todas van contra el backend fijo (:3000) y la BD de dev.
 */
export const FICHERO_DE_VISTA_PREVIA =
  process.env.ALHABLA_VISTA_PREVIA_RAMA ??
  join(homedir(), "Library/Caches/alhabla-dev/vista-previa-rama");

export const PIEZAS_DE_LA_VISTA_PREVIA = {
  app: { carpeta: "frontend", configuracion: "app-rama", puerto: 3111 },
  web: { carpeta: "web", configuracion: "web-rama", puerto: 3112 },
} as const;
export type PiezaDeLaVistaPrevia = keyof typeof PIEZAS_DE_LA_VISTA_PREVIA;

export type Worktree = { ruta: string; rama: string | null; commit: string };

/** `git worktree list --porcelain`: bloques separados por una línea vacía. */
export function leerWorktrees(porcelana: string): Worktree[] {
  return porcelana
    .split(/\n\s*\n/)
    .map((bloque) => {
      const lineas = bloque.split("\n");
      const valor = (clave: string) =>
        lineas.find((l) => l.startsWith(`${clave} `))?.slice(clave.length + 1) ?? null;
      const ruta = valor("worktree");
      if (!ruta) return null;
      const rama = valor("branch");
      return {
        ruta,
        rama: rama ? rama.replace(/^refs\/heads\//, "") : null,
        commit: valor("HEAD") ?? "",
      };
    })
    .filter((w): w is Worktree => w !== null);
}

/**
 * El worktree por su ruta (o una carpeta dentro de él) o por su rama. Solo
 * worktrees de este repo: nada de rutas sueltas del disco.
 */
export function elegirWorktree(worktrees: Worktree[], objetivo: string): Worktree {
  const limpio = objetivo.trim().replace(/\/+$/, "");
  if (limpio.startsWith("/")) {
    const porRuta = worktrees
      .filter((w) => limpio === w.ruta || limpio.startsWith(`${w.ruta}/`))
      .sort((a, b) => b.ruta.length - a.ruta.length)[0];
    if (porRuta) return porRuta;
  } else {
    const porRama = worktrees.find((w) => w.rama === limpio);
    if (porRama) return porRama;
  }
  const ramas = worktrees.map((w) => w.rama ?? `(${w.ruta})`).join(", ");
  throw new Error(
    `[MCP] «${objetivo}» no es la ruta ni la rama de ningún worktree de este repo. Hay: ${ramas}`
  );
}

async function git(argumentos: string[], cwd = HERRAMIENTAS): Promise<string> {
  const { stdout } = await ejecutar("git", argumentos, { cwd, timeout: 15_000 });
  return stdout.trim();
}

/** El worktree elegido ahora mismo, si sigue existiendo. */
export function vistaPreviaElegida(): string | null {
  if (!existsSync(FICHERO_DE_VISTA_PREVIA)) return null;
  const ruta = readFileSync(FICHERO_DE_VISTA_PREVIA, "utf8").trim();
  return ruta && existsSync(ruta) ? ruta : null;
}

export async function elegirVistaPrevia({
  objetivo,
  piezas = ["app", "web"],
}: {
  objetivo?: string;
  piezas?: PiezaDeLaVistaPrevia[];
}) {
  const worktrees = leerWorktrees(await git(["worktree", "list", "--porcelain"]));
  if (!objetivo) {
    const ruta = vistaPreviaElegida();
    return {
      elegido: ruta ? (worktrees.find((w) => w.ruta === ruta) ?? { ruta }) : null,
      worktrees: worktrees.map(({ ruta: r, rama }) => ({ ruta: r, rama })),
      nota: "Pasa objetivo (ruta o rama de un worktree) para elegir uno.",
    };
  }
  const worktree = elegirWorktree(worktrees, objetivo);
  const preparadas = [];
  for (const pieza of piezas) {
    const { carpeta, configuracion, puerto } = PIEZAS_DE_LA_VISTA_PREVIA[pieza];
    const dir = join(worktree.ruta, carpeta);
    if (!existsSync(join(dir, "package.json"))) {
      throw new Error(`[MCP] ${worktree.ruta} no tiene ${carpeta}/package.json`);
    }
    // Sin node_modules, next dev no arranca y preview_start espera al puerto
    // en balde: se instala aquí (un worktree nuevo no los trae).
    let instalado = false;
    if (!existsSync(join(dir, "node_modules/next"))) {
      await ejecutar("npm", ["ci", "--no-audit", "--no-fund", "--loglevel=error"], {
        cwd: dir,
        timeout: 5 * 60_000,
        maxBuffer: 16 * 1024 * 1024,
      });
      instalado = true;
    }
    preparadas.push({
      pieza,
      configuracion,
      url: `http://localhost:${puerto}`,
      ...(instalado ? { instalado: "npm ci" } : {}),
    });
  }
  mkdirSync(dirname(FICHERO_DE_VISTA_PREVIA), { recursive: true });
  writeFileSync(FICHERO_DE_VISTA_PREVIA, `${resolve(worktree.ruta)}\n`);
  return {
    elegido: worktree,
    preparadas,
    siguiente: `preview_start con name ${preparadas.map((p) => `«${p.configuracion}»`).join(" o ")} (si ya estaba arrancada, preview_stop antes: sigue sirviendo el worktree anterior). Para entrar como un negocio: entrar_en_app_dev con puerto 3111.`,
  };
}
