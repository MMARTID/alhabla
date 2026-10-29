import { execFile } from "node:child_process";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  REGION,
  REPOSITORIO,
  SERVICIO,
  gcloud,
  gh,
  type Gcloud,
} from "./gcloud.js";
import { urlDeBdDeProd } from "./prod.js";
import {
  ejecutarSoloLectura,
  type ResultadoDeConsulta,
} from "./sqlDeSoloLectura.js";

/**
 * Foto de producción después de un merge o ante un «¿va todo bien?»: qué
 * revisión sirve y con qué imagen, el máximo de instancias (presupuesto de
 * conexiones de Cloud SQL: 11), `/health`, las colas de Cloud Tasks, los
 * jobs del Scheduler cuyo último intento falló, el último deploy del
 * backend, las migraciones de Prisma aplicadas (y las de este checkout que
 * faltan) y el último despliegue de producción de las dos webs de Vercel.
 * Cada parte va por separado: si una falla, sale su error y el resto se
 * devuelve igual.
 */
export const URL_DE_SALUD = "https://api.alhabla.ai/health";

const ejecutarComando = promisify(execFile);

type ServicioDeCloudRun = {
  metadata?: { annotations?: Record<string, string> };
  spec?: {
    template?: {
      metadata?: { annotations?: Record<string, string> };
      spec?: { containers?: { image?: string }[] };
    };
  };
  status?: {
    url?: string;
    latestReadyRevisionName?: string;
    latestCreatedRevisionName?: string;
    traffic?: { revisionName?: string; percent?: number; tag?: string }[];
    conditions?: { type?: string; status?: string; message?: string }[];
  };
};

export function resumirServicio(servicio: ServicioDeCloudRun) {
  const imagen = servicio.spec?.template?.spec?.containers?.[0]?.image ?? "";
  const anotaciones = servicio.metadata?.annotations ?? {};
  const deLaPlantilla = servicio.spec?.template?.metadata?.annotations ?? {};
  return {
    url: servicio.status?.url ?? null,
    revisionLista: servicio.status?.latestReadyRevisionName ?? null,
    revisionCreada: servicio.status?.latestCreatedRevisionName ?? null,
    trafico: (servicio.status?.traffic ?? []).map((t) => ({
      revision: t.revisionName ?? null,
      porcentaje: t.percent ?? 0,
      ...(t.tag ? { etiqueta: t.tag } : {}),
    })),
    imagen,
    // La etiqueta de la imagen es el sha del commit (deploy-backend.yml).
    commit: imagen.includes(":")
      ? imagen.slice(imagen.lastIndexOf(":") + 1)
      : null,
    // El del servicio manda sobre el de la plantilla si los dos están.
    maxInstanciasDelServicio:
      anotaciones["run.googleapis.com/maxScale"] ?? null,
    maxInstanciasDeLaPlantilla:
      deLaPlantilla["autoscaling.knative.dev/maxScale"] ?? null,
    condicionesQueNoEstanBien: (servicio.status?.conditions ?? [])
      .filter((c) => c.status !== "True")
      .map((c) => ({ tipo: c.type, estado: c.status, mensaje: c.message })),
  };
}

type JobDelScheduler = {
  name?: string;
  schedule?: string;
  state?: string;
  lastAttemptTime?: string;
  status?: { code?: number; message?: string };
};

export function resumirJobs(jobs: JobDelScheduler[]) {
  return jobs.map((job) => ({
    job: (job.name ?? "").split("/").pop() ?? "",
    horario: job.schedule ?? "",
    estado: job.state ?? "",
    ultimoIntento: job.lastAttemptTime ?? null,
    ...(job.status?.code
      ? {
          fallo: { codigo: job.status.code, mensaje: job.status.message ?? "" },
        }
      : {}),
  }));
}

async function parte<T>(
  trabajo: () => Promise<T>
): Promise<T | { error: string }> {
  try {
    return await trabajo();
  } catch (error) {
    return { error: (error as Error).message };
  }
}

// ── Migraciones de Prisma ───────────────────────────────────────────────

/** Las migraciones del checkout donde corre el MCP (backend/prisma/migrations). */
const CARPETA_DE_MIGRACIONES = fileURLToPath(
  new URL("../prisma/migrations/", import.meta.url)
);

export async function migracionesDelCheckout(
  carpeta = CARPETA_DE_MIGRACIONES
): Promise<string[]> {
  const entradas = await readdir(carpeta, { withFileTypes: true });
  return entradas
    .filter((entrada) => entrada.isDirectory())
    .map((entrada) => entrada.name)
    .sort();
}

export const SQL_DE_MIGRACIONES = `SELECT migration_name, started_at, finished_at, rolled_back_at
  FROM _prisma_migrations ORDER BY started_at`;

export type FilaDeMigracion = {
  migration_name: string;
  started_at: string | null;
  finished_at: string | null;
  rolled_back_at: string | null;
};

/**
 * Lo que importa de `_prisma_migrations`: una fila sin `finished_at` ni
 * `rolled_back_at` es una migración que falló o se quedó a medias (bloquea
 * `prisma migrate deploy` hasta resolverla); una revertida que no se volvió
 * a aplicar falta en producción. `pendientes` son las de este checkout que
 * producción no tiene (normal en una rama con una migración nueva; en main,
 * el deploy no las aplicó); `soloEnProduccion`, las que tiene producción y
 * este checkout no (el checkout va por detrás de main).
 */
export function resumirMigraciones(
  filas: FilaDeMigracion[],
  locales: string[]
) {
  const aplicadas = filas.filter(
    (fila) => fila.finished_at && !fila.rolled_back_at
  );
  const nombresAplicados = new Set(
    aplicadas.map((fila) => fila.migration_name)
  );
  const ultima = [...aplicadas].sort((a, b) =>
    (b.finished_at ?? "").localeCompare(a.finished_at ?? "")
  )[0];
  const enLocal = new Set(locales);
  return {
    aplicadas: nombresAplicados.size,
    ultima: ultima
      ? { nombre: ultima.migration_name, aplicada: ultima.finished_at }
      : null,
    fallidasOAMedias: filas
      .filter((fila) => !fila.finished_at && !fila.rolled_back_at)
      .map((fila) => ({
        nombre: fila.migration_name,
        empezada: fila.started_at,
      })),
    revertidasSinVolverAAplicar: [
      ...new Set(
        filas
          .filter(
            (fila) =>
              fila.rolled_back_at && !nombresAplicados.has(fila.migration_name)
          )
          .map((fila) => fila.migration_name)
      ),
    ],
    pendientes: locales.filter((nombre) => !nombresAplicados.has(nombre)),
    soloEnProduccion: [...nombresAplicados]
      .filter((nombre) => !enLocal.has(nombre))
      .sort(),
  };
}

// ── Webs de Vercel ──────────────────────────────────────────────────────

/** `gh api <ruta> [--jq <filtro>]`. No sirve el helper `gh` de gcloud.ts:
 * añade `--repo`, que `gh api` no admite (la ruta ya lleva el repositorio). */
export type GhApi = (ruta: string, jq?: string) => Promise<string>;

export const ghApi: GhApi = async (ruta, jq) => {
  try {
    const { stdout } = await ejecutarComando(
      "gh",
      ["api", ruta, ...(jq ? ["--jq", jq] : [])],
      { maxBuffer: 8 * 1024 * 1024, timeout: 30_000 }
    );
    return stdout;
  } catch (error) {
    const detalle = (
      (error as { stderr?: string }).stderr || (error as Error).message
    )
      .trim()
      .split("\n")
      .slice(-2)
      .join(" ");
    throw new Error(`[MCP] gh api ${ruta.split("?")[0]} falló: ${detalle}`, {
      cause: error,
    });
  }
};

/** Proyectos de Vercel: la integración con GitHub deja un Deployment por
 * despliegue en el entorno «Production – <proyecto>». */
export const WEBS_DE_VERCEL = [
  {
    proyecto: "alhabla-frontend",
    dominio: "app.alhabla.ai",
    carpeta: "frontend",
  },
  { proyecto: "alhabla-web", dominio: "alhabla.ai", carpeta: "web" },
] as const;

type WebDeVercel = (typeof WEBS_DE_VERCEL)[number];

export type ComparacionConMain = {
  ahead_by?: number;
  archivos?: string[];
};

/**
 * ¿Sirve la web lo último de main? Vercel solo despliega si el commit toca
 * la carpeta del proyecto, así que un commit anterior a main está al día si
 * ninguno de los commits de después cambió esa carpeta.
 */
export function frenteAMain(
  carpeta: string,
  comparacion: ComparacionConMain | null
) {
  if (!comparacion) return { esElUltimoDeMain: true, alDia: true };
  const archivos = comparacion.archivos ?? [];
  const enSuCarpeta = archivos.filter((archivo) =>
    archivo.startsWith(`${carpeta}/`)
  ).length;
  return {
    esElUltimoDeMain: false,
    commitsDeMainDespues: comparacion.ahead_by ?? null,
    archivosDeSuCarpetaSinDesplegar: enSuCarpeta,
    alDia: enSuCarpeta === 0,
    // GitHub corta la lista de archivos de una comparación en 300.
    ...(archivos.length >= 300 ? { comparacionIncompleta: true } : {}),
  };
}

type DespliegueResumido = {
  estado: string;
  commit: string;
  creado: string;
  actualizado: string | null;
  url: string | null;
};

export async function despliegueDeWeb(
  web: WebDeVercel,
  main: { sha: string },
  ghApiFn: GhApi = ghApi
) {
  const entorno = encodeURIComponent(`Production – ${web.proyecto}`);
  const despliegues = JSON.parse(
    await ghApiFn(
      `repos/${REPOSITORIO}/deployments?environment=${entorno}&per_page=5`,
      "[.[] | {id, sha, created_at}]"
    )
  ) as { id: number; sha: string; created_at: string }[];
  const base = { proyecto: web.proyecto, dominio: web.dominio };
  if (despliegues.length === 0) {
    return {
      ...base,
      error: "No hay ningún despliegue de producción de Vercel en GitHub",
    };
  }

  // El más reciente y, si no salió bien, el último que sí (el que sirve).
  let ultimo: DespliegueResumido | undefined;
  let bueno: DespliegueResumido | undefined;
  for (const despliegue of despliegues) {
    const [estado] = JSON.parse(
      await ghApiFn(
        `repos/${REPOSITORIO}/deployments/${despliegue.id}/statuses?per_page=1`,
        "[.[] | {state, created_at, environment_url, target_url}]"
      )
    ) as {
      state?: string;
      created_at?: string;
      environment_url?: string;
      target_url?: string;
    }[];
    const resumen: DespliegueResumido = {
      estado: estado?.state ?? "sin_estado",
      commit: despliegue.sha,
      creado: despliegue.created_at,
      actualizado: estado?.created_at ?? null,
      url: estado?.environment_url || estado?.target_url || null,
    };
    ultimo ??= resumen;
    if (resumen.estado === "success") {
      bueno = resumen;
      break;
    }
  }

  const sirve = bueno ?? ultimo!;
  const comparacion =
    sirve.commit === main.sha
      ? null
      : (JSON.parse(
          await ghApiFn(
            `repos/${REPOSITORIO}/compare/${sirve.commit}...${main.sha}`,
            "{ahead_by, archivos: [.files[]?.filename]}"
          )
        ) as ComparacionConMain);

  return {
    ...base,
    ultimoDespliegue: ultimo!,
    ...(bueno && bueno !== ultimo ? { ultimoQueSalioBien: bueno } : {}),
    ...(!bueno ? { aviso: "Ninguno de los 5 últimos salió bien" } : {}),
    ...frenteAMain(web.carpeta, comparacion),
  };
}

export async function desplieguesDeLasWebs(ghApiFn: GhApi = ghApi) {
  const main = JSON.parse(
    await ghApiFn(
      `repos/${REPOSITORIO}/commits/main`,
      "{sha, fecha: .commit.committer.date}"
    )
  ) as { sha: string; fecha: string };
  return {
    main: { commit: main.sha, fecha: main.fecha },
    webs: await Promise.all(
      WEBS_DE_VERCEL.map((web) =>
        parte(() => despliegueDeWeb(web, main, ghApiFn))
      )
    ),
  };
}

export async function estadoDeProd({
  gcloudFn = gcloud,
  ghFn = gh,
  fetchFn = fetch,
  ghApiFn = ghApi,
  consultarBd = async (sql) =>
    ejecutarSoloLectura(await urlDeBdDeProd(), sql, { limiteFilas: 1000 }),
  migracionesLocales = migracionesDelCheckout,
}: {
  gcloudFn?: Gcloud;
  ghFn?: (argumentos: string[]) => Promise<string>;
  fetchFn?: typeof fetch;
  ghApiFn?: GhApi;
  consultarBd?: (sql: string) => Promise<ResultadoDeConsulta>;
  migracionesLocales?: () => Promise<string[]>;
} = {}) {
  // Las dos partes nuevas arrancan a la vez que las demás (parte() nunca
  // rechaza: no queda ninguna promesa sin atender).
  const migracionesEnCurso = parte(async () => {
    const [{ filas }, locales] = await Promise.all([
      consultarBd(SQL_DE_MIGRACIONES),
      migracionesLocales(),
    ]);
    return resumirMigraciones(filas as FilaDeMigracion[], locales);
  });
  const websEnCurso = parte(() => desplieguesDeLasWebs(ghApiFn));

  const [servicio, salud, colas, jobs, despliegues] = await Promise.all([
    parte(async () =>
      resumirServicio(
        JSON.parse(
          await gcloudFn([
            "run",
            "services",
            "describe",
            SERVICIO,
            `--region=${REGION}`,
            "--format=json",
          ])
        ) as ServicioDeCloudRun
      )
    ),
    parte(async () => {
      const respuesta = await fetchFn(URL_DE_SALUD, {
        signal: AbortSignal.timeout(10_000),
      });
      const texto = await respuesta.text();
      let cuerpo: unknown = texto;
      try {
        cuerpo = JSON.parse(texto);
      } catch {
        // Se devuelve tal cual.
      }
      return { codigo: respuesta.status, cuerpo };
    }),
    parte(async () => {
      const lista = JSON.parse(
        await gcloudFn([
          "tasks",
          "queues",
          "list",
          `--location=${REGION}`,
          "--format=json",
        ])
      ) as { name?: string; state?: string }[];
      return Promise.all(
        lista.map(async (cola) => {
          const nombre = (cola.name ?? "").split("/").pop() ?? "";
          const tareas = await gcloudFn([
            "tasks",
            "list",
            `--queue=${nombre}`,
            `--location=${REGION}`,
            "--limit=1000",
            "--format=value(name)",
          ]);
          return {
            cola: nombre,
            estado: cola.state ?? "",
            tareas: tareas.split("\n").filter((linea) => linea.trim()).length,
          };
        })
      );
    }),
    parte(async () => {
      const todos = resumirJobs(
        JSON.parse(
          await gcloudFn([
            "scheduler",
            "jobs",
            "list",
            `--location=${REGION}`,
            "--format=json",
          ])
        ) as JobDelScheduler[]
      );
      return {
        total: todos.length,
        conFallo: todos.filter((job) => "fallo" in job),
        pausados: todos
          .filter((job) => job.estado !== "ENABLED")
          .map((job) => job.job),
      };
    }),
    parte(async () => {
      const runs = JSON.parse(
        await ghFn([
          "run",
          "list",
          "--workflow=deploy-backend.yml",
          "--limit=3",
          "--json=databaseId,headSha,status,conclusion,createdAt,url",
        ])
      ) as {
        databaseId: number;
        headSha: string;
        status: string;
        conclusion: string;
        createdAt: string;
        url: string;
      }[];
      return runs.map((run) => ({
        commit: run.headSha,
        estado: run.status,
        resultado: run.conclusion || null,
        creado: run.createdAt,
        url: run.url,
      }));
    }),
  ]);
  const [migraciones, webs] = await Promise.all([
    migracionesEnCurso,
    websEnCurso,
  ]);

  // ¿Sirve producción el último deploy que salió bien?
  let alDia: boolean | null = null;
  if (!("error" in servicio) && Array.isArray(despliegues)) {
    const ultimoBueno = despliegues.find((run) => run.resultado === "success");
    alDia = ultimoBueno ? servicio.commit === ultimoBueno.commit : null;
  }

  return {
    servicio,
    salud,
    colas,
    jobs,
    despliegues,
    sirveElUltimoDeployBueno: alDia,
    migraciones,
    webs,
  };
}
