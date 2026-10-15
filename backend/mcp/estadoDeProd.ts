import { REGION, SERVICIO, gcloud, gh, type Gcloud } from "./gcloud.js";

/**
 * Foto de producción después de un merge o ante un «¿va todo bien?»: qué
 * revisión sirve y con qué imagen, el máximo de instancias (presupuesto de
 * conexiones de Cloud SQL: 11), `/health`, las colas de Cloud Tasks, los
 * jobs del Scheduler cuyo último intento falló y el último deploy del
 * backend. Cada parte va por separado: si una falla, sale su error y el
 * resto se devuelve igual.
 */
export const URL_DE_SALUD = "https://api.alhabla.ai/health";

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

export async function estadoDeProd({
  gcloudFn = gcloud,
  ghFn = gh,
  fetchFn = fetch,
}: {
  gcloudFn?: Gcloud;
  ghFn?: (argumentos: string[]) => Promise<string>;
  fetchFn?: typeof fetch;
} = {}) {
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
  };
}
