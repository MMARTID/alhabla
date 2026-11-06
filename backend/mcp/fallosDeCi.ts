import { gh as ghDelRepo } from "./gcloud.js";
import { recortar } from "./privacidad.js";

/**
 * Por qué está en rojo el CI de un PR o una rama: los jobs que fallaron, el
 * paso y, del log, solo lo que explica el fallo.
 *
 * El 06-11 hubo que leerlo a mano dos veces con `gh run view --log-failed |
 * grep`: el log del job del backend tenía 3.324 líneas, casi todas stderr de
 * tests que pasaban, y los 4 fallos estaban en 20.
 */
export type Gh = (argumentos: string[]) => Promise<string>;

const MAXIMO_DE_LINEAS = 60;
const LINEAS_DEL_FINAL = 15;

/** Los colores llegan como ESC de verdad o como el texto «^[[31m». */
// eslint-disable-next-line no-control-regex -- el ESC de los colores es justo lo que se quita
const COLORES = /(?:\x1b|\^\[)\[[0-9;]*m/g;
const MARCA_DE_TIEMPO = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z ?/;

export type JobFallido = {
  job: string;
  pasos: string[];
  resumen: string[];
};

/**
 * `gh run view --log-failed`: «job<TAB>paso<TAB>fecha texto» por línea. Por
 * job, el bloque de fallos de vitest (de «Failed Suites/Tests» a «Test
 * Files», sin el código fuente que enseña) o, si no es vitest, las líneas de
 * error (tsc, eslint, next build, bash) y el final del paso.
 */
export function resumirLogFallido(texto: string): JobFallido[] {
  const porJob = new Map<string, { pasos: Set<string>; lineas: string[] }>();
  for (const cruda of texto.split("\n")) {
    const [job, paso, ...resto] = cruda.split("\t");
    if (!job || paso === undefined) continue;
    const linea = resto.join("\t").replace(MARCA_DE_TIEMPO, "").replace(COLORES, "");
    const entrada = porJob.get(job) ?? { pasos: new Set<string>(), lineas: [] };
    entrada.pasos.add(paso);
    entrada.lineas.push(linea);
    porJob.set(job, entrada);
  }
  return [...porJob].map(([job, { pasos, lineas }]) => ({
    job,
    pasos: [...pasos].filter((p) => p !== "Set up job" && p !== "Complete job"),
    resumen: resumenDeLineas(lineas),
  }));
}

function resumenDeLineas(lineas: string[]): string[] {
  const deVitest: string[] = [];
  let dentro = false;
  for (const linea of lineas) {
    if (/Failed (Suites|Tests) \d+/.test(linea)) dentro = true;
    if (!dentro) continue;
    const esCodigo = /^\s+(\d+)?\s*\|/.test(linea);
    const esSeparador = /^[\s⎯]*(\[\d+\/\d+\])?[\s⎯]*$/.test(linea);
    if (!esCodigo && !esSeparador) deVitest.push(linea.trimEnd());
    if (/^\s*Test Files /.test(linea)) dentro = false;
  }
  if (deVitest.length > 0) return recortarLineas(deVitest);

  const errores = lineas.filter(
    (linea) =>
      /error TS\d+|::error::|\berror\b|ERR!|ELIFECYCLE|Error:|✖|failed/i.test(linea) &&
      !/^stderr \|/.test(linea)
  );
  const final = lineas.slice(-LINEAS_DEL_FINAL);
  return recortarLineas([...new Set([...errores, ...final])].map((l) => l.trimEnd()));
}

function recortarLineas(lineas: string[]): string[] {
  const sinVacias = lineas.filter((l, i) => l.trim() !== "" || lineas[i - 1]?.trim() !== "");
  const recortadas = sinVacias.slice(0, MAXIMO_DE_LINEAS).map((l) => recortar(l, 400));
  if (sinVacias.length > MAXIMO_DE_LINEAS) {
    recortadas.push(`… ${sinVacias.length - MAXIMO_DE_LINEAS} líneas más (gh run view --log-failed)`);
  }
  return recortadas;
}

type Ejecucion = {
  databaseId: number;
  workflowName: string;
  status: string;
  conclusion: string;
  url: string;
};

const CAMPOS_DE_EJECUCION = "databaseId,workflowName,status,conclusion,url";

export async function fallosDeCi(
  { pr, rama }: { pr?: number; rama?: string },
  gh: Gh = ghDelRepo
) {
  if (!pr && !rama) throw new Error("[MCP] Indica pr o rama");
  let commit: string;
  let datosDelPr: Record<string, unknown> | undefined;
  if (pr) {
    datosDelPr = JSON.parse(
      await gh(["pr", "view", String(pr), "--json", "number,title,url,state,headRefName,headRefOid"])
    ) as Record<string, unknown>;
    commit = String(datosDelPr.headRefOid);
  } else {
    const ultimas = JSON.parse(
      await gh(["run", "list", "--branch", rama as string, "--limit", "1", "--json", "headSha"])
    ) as { headSha: string }[];
    if (ultimas.length === 0) {
      throw new Error(`[MCP] No hay ejecuciones de CI de la rama ${rama} (¿está subida?)`);
    }
    commit = ultimas[0].headSha;
  }

  const ejecuciones = JSON.parse(
    await gh(["run", "list", "--commit", commit, "--limit", "20", "--json", CAMPOS_DE_EJECUCION])
  ) as Ejecucion[];
  const fallidas = ejecuciones.filter((e) =>
    ["failure", "timed_out", "startup_failure"].includes(e.conclusion)
  );

  const fallidos = [];
  for (const ejecucion of fallidas) {
    const id = String(ejecucion.databaseId);
    const { jobs } = JSON.parse(await gh(["run", "view", id, "--json", "jobs"])) as {
      jobs: { name: string; conclusion: string; url: string }[];
    };
    const resumenes = resumirLogFallido(await gh(["run", "view", id, "--log-failed"]).catch(() => ""));
    for (const job of jobs.filter((j) => j.conclusion === "failure")) {
      const resumen = resumenes.find((r) => r.job === job.name);
      fallidos.push({
        workflow: ejecucion.workflowName,
        job: job.name,
        url: job.url,
        pasos: resumen?.pasos ?? [],
        resumen: resumen?.resumen ?? ["(sin log: mira la url)"],
      });
    }
  }

  const enCurso = ejecuciones.filter((e) => e.status !== "completed");
  return {
    ...(datosDelPr ? { pr: datosDelPr } : { rama }),
    commit: commit.slice(0, 12),
    ejecuciones: ejecuciones.map((e) => ({
      workflow: e.workflowName,
      estado: e.status === "completed" ? e.conclusion : e.status,
      url: e.url,
    })),
    fallidos,
    siguiente:
      fallidos.length > 0
        ? "Arregla y comprueba en local con scripts/comprobar-rama.sh antes de volver a subir."
        : enCurso.length > 0
          ? `Nada falla todavía; siguen en curso: ${enCurso.map((e) => e.workflowName).join(", ")}.`
          : "Todo en verde en ese commit.",
  };
}
