import { execFile } from "node:child_process";
import { promisify } from "node:util";

/**
 * Lo que el extractor necesita saber de git: qué commit respalda lo que va a
 * afirmar y si lo que lee es lo que hay en ese commit. Todo con `execFile`
 * (sin shell) y solo comandos de lectura, salvo `git fetch origin main`, que
 * actualiza la referencia remota.
 *
 * Por qué importa (informe del sincronizador):
 *  - En un clon superficial (`actions/checkout` por defecto), `git log -1 --
 *    <ruta>` devuelve HEAD para todo: el commit no diría nada.
 *  - Con cambios sin commitear, el commit no corresponde al contenido leído.
 *  - Para producción, sincronizar desde una rama que no es main afirmaría
 *    cosas que todavía no están desplegadas.
 */

const ejecutar = promisify(execFile);

async function git(raiz: string, args: string[]): Promise<string> {
  const { stdout } = await ejecutar("git", args, {
    cwd: raiz,
    maxBuffer: 8 * 1024 * 1024,
  });
  return stdout.trim();
}

/** La raíz del repo que contiene `desde`. */
export async function raizDelRepo(desde: string): Promise<string> {
  return git(desde, ["rev-parse", "--show-toplevel"]);
}

export async function headSha(raiz: string): Promise<string> {
  return git(raiz, ["rev-parse", "HEAD"]);
}

export async function esClonSuperficial(raiz: string): Promise<boolean> {
  return (await git(raiz, ["rev-parse", "--is-shallow-repository"])) === "true";
}

/**
 * El último commit que tocó alguna de estas rutas, o `null` si ninguna está
 * en git (recién creadas).
 */
export async function ultimoCommitQueToca(
  raiz: string,
  rutas: readonly string[]
): Promise<string | null> {
  const sha = await git(raiz, ["log", "-1", "--format=%H", "--", ...rutas]);
  return sha === "" ? null : sha;
}

/** Líneas de `git status --porcelain` de esas rutas: modificadas o sin seguimiento. */
export async function rutasSinCommitear(
  raiz: string,
  rutas: readonly string[]
): Promise<string[]> {
  const salida = await git(raiz, [
    "status",
    "--porcelain",
    "--untracked-files=all",
    "--",
    ...rutas,
  ]);
  return salida === "" ? [] : salida.split("\n");
}

/**
 * SHA de blob del CONTENIDO actual de cada fichero (`git hash-object`): el
 * mismo valor que `git rev-parse HEAD:<ruta>` con el árbol limpio, y válido
 * también para un fichero modificado o aún sin añadir.
 */
export async function blobsDe(
  raiz: string,
  rutas: readonly string[]
): Promise<{ ruta: string; blobSha: string }[]> {
  if (rutas.length === 0) return [];
  const salida = await git(raiz, ["hash-object", "--", ...rutas]);
  const shas = salida.split("\n");
  if (shas.length !== rutas.length) {
    throw new Error(
      `[Conocimiento] git hash-object devolvió ${shas.length} SHA para ${rutas.length} ficheros.`
    );
  }
  return rutas.map((ruta, i) => ({ ruta, blobSha: shas[i] }));
}

/** `git fetch origin main`: devuelve `null` si fue bien y el motivo si no. */
export async function traerOrigenMain(raiz: string): Promise<string | null> {
  try {
    await git(raiz, ["fetch", "--quiet", "origin", "main"]);
    return null;
  } catch (error) {
    return error instanceof Error
      ? error.message.split("\n")[0]
      : String(error);
  }
}

async function sale0(raiz: string, args: string[]): Promise<boolean> {
  try {
    await ejecutar("git", args, { cwd: raiz });
    return true;
  } catch (error) {
    // Código 1: «no». Cualquier otro error es de git de verdad.
    if ((error as { code?: number }).code === 1) return false;
    throw error;
  }
}

/** ¿Está HEAD ya en `origin/main`? */
export async function headEstaEnOrigenMain(raiz: string): Promise<boolean> {
  return sale0(raiz, ["merge-base", "--is-ancestor", "HEAD", "origin/main"]);
}

/** ¿Son idénticas a `origin/main` estas rutas? */
export async function rutasIgualesAOrigenMain(
  raiz: string,
  rutas: readonly string[]
): Promise<boolean> {
  return sale0(raiz, ["diff", "--quiet", "origin/main", "--", ...rutas]);
}

/** Los ficheros `.ts` y `.mdx` que cuelgan de una carpeta, según git (sin node_modules ni build). */
export async function ficherosBajo(
  raiz: string,
  carpeta: string,
  extension: string
): Promise<string[]> {
  const salida = await git(raiz, [
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "--",
    `${carpeta}/*${extension}`,
  ]);
  return salida === "" ? [] : salida.split("\n").sort();
}

/**
 * Lo que el extractor EJECUTA o lee antes de saber qué fuentes tiene: `web/`
 * se carga como código en un proceso hijo y el resto es lo que se parsea. Las
 * guardas previas miran estas rutas enteras, no la lista de fuentes que
 * saldría de leerlas.
 */
export const RUTAS_QUE_EL_EXTRACTOR_LEE = [
  "PRODUCT.md",
  "web",
  "growth/agentes/reglas",
  "backend/src/lib/planFeatures.ts",
  "backend/src/modules/billing/catalog.ts",
] as const;

/**
 * Las guardas que NO necesitan leer nada y deben pasar ANTES de cargar `web/`
 * (que es código TypeScript que se ejecuta): clon completo y, para producción,
 * red hacia origin/main, HEAD en origin/main y las rutas que se leen sin
 * cambios e idénticas a origin/main. En dev solo se exige el clon completo:
 * se trabaja con la rama y el árbol que haya.
 */
export async function comprobarGuardasPrevias(
  raiz: string,
  opciones: { permitirRamaLocal: boolean }
): Promise<{ avisos: string[] }> {
  if (await esClonSuperficial(raiz)) {
    throw new Error(
      "[Conocimiento] Este clon es superficial: `git log` devolvería HEAD para todos los ficheros y el commit no diría nada. Haz `git fetch --unshallow`."
    );
  }
  if (opciones.permitirRamaLocal) return { avisos: [] };

  const fallo = await traerOrigenMain(raiz);
  if (fallo) {
    throw new Error(
      `[Conocimiento] No se pudo consultar origin/main (${fallo}). Sin red no se puede comprobar que el repo esté en main: producción no se sincroniza.`
    );
  }
  if (!(await headEstaEnOrigenMain(raiz))) {
    throw new Error(
      "[Conocimiento] HEAD todavía no está en origin/main: sincronizar producción desde una rama afirmaría cosas que no están desplegadas, y `web/` se ejecutaría sin estar publicado. Fusiona primero, o usa --entorno dev."
    );
  }
  const sucias = await rutasSinCommitear(raiz, RUTAS_QUE_EL_EXTRACTOR_LEE);
  if (sucias.length > 0) {
    throw new Error(
      `[Conocimiento] Hay cambios sin commitear en lo que se lee (${resumirRutas(sucias)}): producción solo se sincroniza desde un árbol limpio. Commitéalos o descártalos.`
    );
  }
  if (!(await rutasIgualesAOrigenMain(raiz, RUTAS_QUE_EL_EXTRACTOR_LEE))) {
    throw new Error(
      "[Conocimiento] Lo que se lee difiere de origin/main (main tiene cambios que este árbol no, o al revés). Haz `git pull` desde main antes de sincronizar producción."
    );
  }
  return { avisos: [] };
}

function resumirRutas(rutas: readonly string[]): string {
  return `${rutas.slice(0, 5).join("; ")}${rutas.length > 5 ? ` y ${rutas.length - 5} más` : ""}`;
}

export type GuardasDeGit = {
  commitSha: string;
  avisos: string[];
};

/**
 * Comprueba que lo leído se puede afirmar y devuelve el commit que lo
 * respalda: el último que tocó alguna de las fuentes.
 *
 * - Siempre: clon completo y fuentes sin cambios por commitear. En dev
 *   (`permitirRamaLocal`) lo segundo se degrada a aviso: se trabaja con la
 *   rama y el árbol sucios, y el commit puede no corresponder del todo.
 * - Producción (`permitirRamaLocal: false`): además, HEAD ya está en
 *   `origin/main` y las fuentes son idénticas a las de `origin/main`.
 */
export async function comprobarGuardasDeGit(
  raiz: string,
  fuentes: readonly string[],
  opciones: { permitirRamaLocal: boolean; omitirFetch?: boolean }
): Promise<GuardasDeGit> {
  const avisos: string[] = [];

  if (await esClonSuperficial(raiz)) {
    throw new Error(
      "[Conocimiento] Este clon es superficial: `git log` devolvería HEAD para todos los ficheros y el commit no diría nada. Haz `git fetch --unshallow`."
    );
  }

  const sucias = await rutasSinCommitear(raiz, fuentes);
  if (sucias.length > 0) {
    const detalle = resumirRutas(sucias);
    if (!opciones.permitirRamaLocal) {
      throw new Error(
        `[Conocimiento] Hay fuentes con cambios sin commitear (${detalle}): el commit no corresponde a lo que se leyó. Commitéalos o descártalos.`
      );
    }
    avisos.push(
      `Hay fuentes con cambios sin commitear (${detalle}): el commitSha es el del último commit que las tocó, no el contenido exacto.`
    );
  }

  if (!opciones.permitirRamaLocal) {
    // Sin red, la «última copia local» de origin/main puede ser de hace días:
    // producción no se compara con ella. (El MCP también aborta.)
    const fallo = opciones.omitirFetch ? null : await traerOrigenMain(raiz);
    if (fallo) {
      throw new Error(
        `[Conocimiento] No se pudo consultar origin/main (${fallo}). Sin red no se puede comprobar que el repo esté en main: producción no se sincroniza.`
      );
    }
    if (!(await headEstaEnOrigenMain(raiz))) {
      throw new Error(
        "[Conocimiento] HEAD todavía no está en origin/main: sincronizar producción desde una rama afirmaría cosas que no están desplegadas. Fusiona primero, o usa --permitir-rama-local contra dev."
      );
    }
    if (!(await rutasIgualesAOrigenMain(raiz, fuentes))) {
      throw new Error(
        "[Conocimiento] Las fuentes difieren de origin/main (main tiene cambios que este árbol no, o al revés). Haz `git pull` desde main antes de sincronizar producción."
      );
    }
  }

  const commitSha = await ultimoCommitQueToca(raiz, fuentes);
  if (!commitSha) {
    throw new Error(
      "[Conocimiento] Ninguna de las fuentes está en git todavía: no hay commit que citar."
    );
  }
  return { commitSha, avisos };
}
