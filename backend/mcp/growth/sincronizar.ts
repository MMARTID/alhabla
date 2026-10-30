import { ZodError } from "zod";
import {
  analizarCuerpoDeSincronizacion,
  type FuenteLeida,
} from "../../src/modules/growth/conocimiento/esquemas.js";
import type { SincronizarBody as CuerpoDeSincronizacion } from "../../src/modules/growth/esquemas.js";
import type { CargaDeConocimiento } from "./conocimiento/index.js";
import {
  COMANDO_PARA_ACTUALIZAR_LA_COPIA,
  ErrorDeGit,
  esAscendiente,
  type Git,
} from "./repo.js";

/**
 * La parte local de `sincronizar_conocimiento`: las guardas del repositorio y
 * el cuerpo que se envía. El modelo no aporta contenido: las afirmaciones las
 * extrae código determinista de los ficheros del repo (`conocimiento/`), así
 * que una página con instrucciones inyectadas no puede fabricarlas. De esa base
 * cuelgan las reglas duras de cumplimiento (claves vigentes, términos
 * prohibidos, comparativas): solo debe reflejar lo que ya está en `main`.
 */

/**
 * Lo que devuelve `prepararCarga` (`conocimiento/index.ts`, el extractor). Se
 * importa solo el TIPO: arrancar el MCP no carga el extractor, y si éste cambia
 * de forma el typecheck de aquí lo detecta.
 */
export type { CargaDeConocimiento };

export type PrepararCarga = (opciones: {
  raiz: string;
  permitirRamaLocal: boolean;
}) => Promise<CargaDeConocimiento>;

/** Un motivo por el que NO se sincroniza, con el arreglo en el propio mensaje. */
export class ErrorDeSincronizacion extends Error {
  constructor(mensaje: string, opciones?: { cause?: unknown }) {
    super(mensaje, opciones);
    this.name = "ErrorDeSincronizacion";
  }
}

export type RepoComprobado = {
  commit: string;
  rama: string | null;
  /** `true` si se sincroniza desde una rama que no es `origin/main` (solo contra localhost). */
  contraRama: boolean;
  avisos: string[];
};

/**
 * Las tres guardas. En producción: HEAD == origin/main (tras `git fetch`) y
 * árbol limpio. Contra localhost se admite una rama (o un HEAD por detrás o
 * por delante de main) para probar el sincronizador en dev, con aviso; el árbol
 * limpio se exige siempre porque el commit que se anota ha de corresponder al
 * contenido que se lee.
 */
export async function comprobarRepoParaSincronizar(
  git: Git,
  opciones: { permitirRamaLocal: boolean }
): Promise<RepoComprobado> {
  const avisos: string[] = [];

  try {
    await git(["fetch", "-q", "origin", "main"], { timeoutMs: 30_000 });
  } catch (error) {
    const motivo = error instanceof Error ? error.message : String(error);
    if (!opciones.permitirRamaLocal) {
      throw new ErrorDeSincronizacion(
        `No se pudo consultar origin/main (${motivo}). Sin red no se puede comprobar que el repo esté en main: no se sincroniza.`
      );
    }
    avisos.push(
      `No se pudo consultar origin/main (${motivo}): se sincroniza contra localhost con lo que hay.`
    );
  }

  let head: string;
  let main: string;
  try {
    head = await git(["rev-parse", "HEAD"]);
    main = await git(["rev-parse", "origin/main"]);
  } catch (error) {
    throw new ErrorDeSincronizacion(
      `No se pudo leer el repositorio: ${error instanceof Error ? error.message : String(error)}.`
    );
  }
  const rama = await git(["rev-parse", "--abbrev-ref", "HEAD"]).catch(
    () => null
  );

  const sucio = await git(["status", "--porcelain"]).catch(() => null);
  if (sucio === null) {
    throw new ErrorDeSincronizacion(
      "No se pudo comprobar si el árbol de trabajo está limpio."
    );
  }
  if (sucio !== "") {
    const ficheros = sucio.split("\n").length;
    throw new ErrorDeSincronizacion(
      `El árbol de trabajo tiene ${ficheros} fichero${ficheros === 1 ? "" : "s"} con cambios o sin seguir: el commit anotado no correspondería a lo que se lee. Sincroniza desde una copia limpia de main (~/.alhabla-mcp).`
    );
  }

  if (head === main) {
    return {
      commit: head,
      rama: rama && rama !== "HEAD" ? rama : null,
      contraRama: false,
      avisos,
    };
  }

  let detras: boolean;
  try {
    detras = await esAscendiente(git, head, main);
  } catch (error) {
    throw new ErrorDeSincronizacion(
      `No se pudo comparar HEAD con origin/main: ${error instanceof ErrorDeGit ? error.message : String(error)}.`
    );
  }

  if (!opciones.permitirRamaLocal) {
    throw new ErrorDeSincronizacion(
      detras
        ? `El repo va por detrás de origin/main (HEAD ${head.slice(0, 7)}, main ${main.slice(0, 7)}): pondría en la base precios o funciones antiguas. Actualiza la copia: ${COMANDO_PARA_ACTUALIZAR_LA_COPIA}`
        : `HEAD (${head.slice(0, 7)}) tiene commits que no están en origin/main (${main.slice(0, 7)}): fijaría en la base cosas que no están publicadas. Sincroniza solo desde main: ${COMANDO_PARA_ACTUALIZAR_LA_COPIA}`
    );
  }

  avisos.push(
    detras
      ? `HEAD (${head.slice(0, 7)}) va por detrás de origin/main: se sincroniza contra localhost.`
      : `HEAD (${head.slice(0, 7)}) no está en origin/main: se sincroniza contra localhost, nunca contra producción.`
  );
  return {
    commit: head,
    rama: rama && rama !== "HEAD" ? rama : null,
    contraRama: true,
    avisos,
  };
}

/** Lo que viaja en el `POST`: el cuerpo del esquema más el rastro de los ficheros leídos. */
export type CuerpoParaEnviar = CuerpoDeSincronizacion & {
  fuentes?: FuenteLeida[];
};

/**
 * El cuerpo del `POST /growth/agente/conocimiento/sincronizar`. Se valida con
 * el MISMO analizador que usa el servidor (`analizarCuerpoDeSincronizacion`):
 * si el extractor y el backend discrepan, es un fallo de código (no del
 * modelo) y se dice aquí, sin enviar nada.
 */
export async function construirCuerpoDeSincronizacion(
  git: Git,
  carga: CargaDeConocimiento,
  repo: RepoComprobado
): Promise<CuerpoParaEnviar> {
  // El commit que se anota ha de estar en el historial de HEAD (y, en
  // producción, HEAD es main): una carga con un commit ajeno se descarta.
  const alcanzable = /^[0-9a-f]{7,40}$/.test(carga.commitSha)
    ? await esAscendiente(git, carga.commitSha, repo.commit).catch(() => false)
    : false;
  if (!alcanzable) {
    throw new ErrorDeSincronizacion(
      `El commit de la carga (${carga.commitSha.slice(0, 12)}) no es ascendiente de HEAD (${repo.commit.slice(0, 7)}): el extractor está desfasado con este repo.`
    );
  }

  const candidato = {
    commitSha: carga.commitSha,
    // Los tipos de los que la lista es COMPLETA: sin ellos el servidor solo
    // cubre los que aparecen en el lote y un tipo que se vació en el repo no
    // se retiraría ni se detectaría. Van siempre que el extractor los dé.
    ...(Array.isArray(carga.tipos) && carga.tipos.length > 0
      ? { tipos: carga.tipos }
      : {}),
    afirmaciones: carga.afirmaciones,
    ...(carga.competidores.length > 0
      ? { competidores: carga.competidores }
      : {}),
    ...(carga.nichos.length > 0 ? { nichos: carga.nichos } : {}),
    ...(carga.paginas && carga.paginas.length > 0
      ? { paginas: carga.paginas }
      : {}),
    ...(carga.fuentesLeidas.length > 0 ? { fuentes: carga.fuentesLeidas } : {}),
  };

  try {
    const { body, fuentes } = analizarCuerpoDeSincronizacion(candidato);
    return { ...body, ...(fuentes.length > 0 ? { fuentes } : {}) };
  } catch (error) {
    const issues =
      error instanceof ZodError
        ? error.issues
            .slice(0, 8)
            .map((i) => `${i.path.join(".") || "(cuerpo)"}: ${i.message}`)
            .join("; ")
        : error instanceof Error
          ? error.message
          : String(error);
    throw new ErrorDeSincronizacion(
      `La carga del extractor no cumple el esquema del backend (${issues}). No se envía nada: es un fallo del extractor, no de los datos.`,
      { cause: error }
    );
  }
}
