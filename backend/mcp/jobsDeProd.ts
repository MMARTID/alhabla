import { REGION, gcloud, type Gcloud } from "./gcloud.js";
import { leerLogsDeProd, type LineaDeLog } from "./logsDeProd.js";

/**
 * Jobs del Scheduler de producción que se pueden lanzar a mano: los que ya
 * corren solos a menudo y para los que una pasada de más no hace nada que
 * no fuera a hacer el siguiente tick. Sirven para no esperar al horario
 * (p. ej. que el reconciliador lleve a Telnyx un cambio hecho en la BD).
 */
export const JOBS_QUE_SE_PUEDEN_LANZAR: Record<
  string,
  { prefijosDeLog: string[]; queHace: string }
> = {
  "telnyx-reconciler": {
    prefijosDeLog: ["[TelnyxReconciler]"],
    queHace:
      "Vuelve a sincronizar los assistants de Telnyx con la BD (syncAgentToTelnyx) y crea el que falte. Lo normal: cada día a las 04:00.",
  },
  "cleanup-zombie-calls": {
    prefijosDeLog: ["[Reaper]", "[Purga]"],
    queHace:
      "Cierra las llamadas colgadas y purga el estado temporal caducado. Lo normal: cada 15 min.",
  },
  "retry-stuck-recordings": {
    prefijosDeLog: ["[Recordings]"],
    queHace:
      "Vuelve a copiar a R2 las grabaciones atascadas. Lo normal: cada 15 min.",
  },
};

/** Los demás tienen efectos que no se repiten sin pensarlo. */
export const JOBS_QUE_NO: Record<string, string> = {
  "send-weekly-summaries": "manda el resumen semanal por correo a los dueños",
  "recordar-desvio-sin-comprobar": "manda WhatsApp a los dueños",
  "purge-old-recordings": "borra grabaciones",
  "suspend-overdue-calls":
    "suspende las llamadas de cuentas con pagos atrasados",
  "retry-usage-reports": "reporta minutos a Stripe",
};

type EstadoDelJob = {
  lastAttemptTime?: string;
  status?: { code?: number; message?: string };
};

export async function lanzarJobDeProd(
  job: string,
  {
    gcloudFn = gcloud,
    esperarHastaMs = 120_000,
    pausa = (ms: number) =>
      new Promise<void>((resolver) => setTimeout(resolver, ms)),
    ahora = () => Date.now(),
  }: {
    gcloudFn?: Gcloud;
    esperarHastaMs?: number;
    pausa?: (ms: number) => Promise<void>;
    ahora?: () => number;
  } = {}
): Promise<{
  job: string;
  queHace: string;
  resultado: "ok" | "fallo" | "sin respuesta todavía";
  ultimoIntento: string | null;
  fallo?: { codigo: number; mensaje: string };
  logs: LineaDeLog[];
  nota?: string;
}> {
  const definicion = JOBS_QUE_SE_PUEDEN_LANZAR[job];
  if (!definicion) {
    const motivo = JOBS_QUE_NO[job];
    throw new Error(
      motivo
        ? `[MCP] ${job} no se lanza desde aquí: ${motivo}. Si de verdad hace falta, que lo lance una persona con gcloud scheduler jobs run.`
        : `[MCP] No conozco el job «${job}». Se pueden lanzar: ${Object.keys(JOBS_QUE_SE_PUEDEN_LANZAR).join(", ")}`
    );
  }

  // Un pelín antes, por si el reloj del Mac va por delante del de Google.
  const inicio = ahora() - 5_000;
  await gcloudFn(["scheduler", "jobs", "run", job, `--location=${REGION}`]);

  let estado: EstadoDelJob = {};
  let termino = false;
  while (ahora() - inicio < esperarHastaMs) {
    await pausa(3_000);
    estado = JSON.parse(
      await gcloudFn([
        "scheduler",
        "jobs",
        "describe",
        job,
        `--location=${REGION}`,
        "--format=json",
      ])
    ) as EstadoDelJob;
    if (
      estado.lastAttemptTime &&
      Date.parse(estado.lastAttemptTime) >= inicio
    ) {
      termino = true;
      break;
    }
  }

  // Cloud Logging tarda unos segundos en tener los logs del intento.
  await pausa(termino ? 5_000 : 0);
  const { lineas } = await leerLogsDeProd(
    {
      texto: definicion.prefijosDeLog,
      desde: new Date(inicio).toISOString(),
      limite: 50,
    },
    { gcloudFn, ahora: ahora() }
  );

  const fallo = estado.status?.code
    ? { codigo: estado.status.code, mensaje: estado.status.message ?? "" }
    : undefined;
  return {
    job,
    queHace: definicion.queHace,
    resultado: !termino ? "sin respuesta todavía" : fallo ? "fallo" : "ok",
    ultimoIntento: estado.lastAttemptTime ?? null,
    ...(fallo ? { fallo } : {}),
    logs: lineas,
    ...(lineas.length === 0
      ? {
          nota: `Sin logs todavía: pueden tardar unos segundos. ver_logs_prod con texto «${definicion.prefijosDeLog[0]}».`,
        }
      : {}),
  };
}
