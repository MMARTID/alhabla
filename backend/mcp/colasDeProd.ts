import { REGION, gcloud, type Gcloud } from "./gcloud.js";
import { enmascararEnTodo, recortar } from "./privacidad.js";

/**
 * Las tareas que esperan en las colas de Cloud Tasks de producción
 * (send-whatsapp, send-email, process-recording…): estado_prod solo da
 * cuántas hay por cola; esto dice cuáles son, a qué ruta van, para cuándo
 * están programadas y cómo fue su último intento. Sirve para distinguir un
 * recordatorio programado para dentro de una semana de una tarea atascada
 * que Cloud Tasks reintenta sin éxito.
 *
 * El cuerpo solo se lee con `conCuerpo` (hace un `tasks describe
 * --response-view=full` por tarea: `tasks list` no lo trae) y sale
 * decodificado, con los teléfonos enmascarados y recortado.
 */

const LIMITE_POR_COLA = 100;
export const MAX_POR_COLA = 1_000;
/** Tareas como mucho de las que se lee el cuerpo en una llamada. */
export const MAX_CUERPOS = 25;
const MAX_CUERPO = 2_000;
/** Una tarea que debía haber salido hace más de esto y sigue sin intento
 * está atascada (la cola no la despacha). */
const ATASCADA_TRAS_MS = 10 * 60_000;

type Intento = {
  scheduleTime?: string;
  dispatchTime?: string;
  responseTime?: string;
  responseStatus?: { code?: number; message?: string };
};

export type TareaDeCloudTasks = {
  name?: string;
  createTime?: string;
  scheduleTime?: string;
  dispatchCount?: number | string;
  responseCount?: number | string;
  firstAttempt?: Intento;
  lastAttempt?: Intento;
  httpRequest?: { url?: string; httpMethod?: string; body?: string };
};

/** Códigos de google.rpc.Code y el estado HTTP que les corresponde según
 * Google (Cloud Tasks traduce así la respuesta del destino). */
const CODIGOS_RPC: Record<number, [string, number]> = {
  0: ["OK", 200],
  1: ["CANCELLED", 499],
  2: ["UNKNOWN", 500],
  3: ["INVALID_ARGUMENT", 400],
  4: ["DEADLINE_EXCEEDED", 504],
  5: ["NOT_FOUND", 404],
  6: ["ALREADY_EXISTS", 409],
  7: ["PERMISSION_DENIED", 403],
  8: ["RESOURCE_EXHAUSTED", 429],
  9: ["FAILED_PRECONDITION", 400],
  10: ["ABORTED", 409],
  11: ["OUT_OF_RANGE", 400],
  12: ["UNIMPLEMENTED", 501],
  13: ["INTERNAL", 500],
  14: ["UNAVAILABLE", 503],
  15: ["DATA_LOSS", 500],
  16: ["UNAUTHENTICATED", 401],
};

export type EstadoDeTarea =
  "programada" | "en_cola" | "atascada" | "reintentando";

export type TareaResumida = {
  id: string;
  cola: string;
  metodo: string;
  ruta: string;
  estado: EstadoDeTarea;
  programadaPara: string | null;
  creada: string | null;
  intentos: number;
  respuestas: number;
  ultimoIntento?: {
    despachado: string | null;
    respondido: string | null;
    codigo: number | null;
    nombre: string | null;
    /** El estado HTTP del mensaje si lo trae; si no, el equivalente del
     * código según Google. */
    http: number | null;
    mensaje: string | null;
  };
  cuerpo?: unknown;
};

function ultimoTrozo(nombre: string | undefined): string {
  return (nombre ?? "").split("/").pop() ?? "";
}

function ruta(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

export function estadoDeTarea(
  tarea: TareaDeCloudTasks,
  ahora = Date.now()
): EstadoDeTarea {
  if (Number(tarea.dispatchCount ?? 0) > 0) return "reintentando";
  const programada = tarea.scheduleTime ? Date.parse(tarea.scheduleTime) : NaN;
  if (Number.isNaN(programada)) return "en_cola";
  if (programada > ahora) return "programada";
  return ahora - programada > ATASCADA_TRAS_MS ? "atascada" : "en_cola";
}

export function resumirTarea(
  tarea: TareaDeCloudTasks,
  cola: string,
  ahora = Date.now()
): TareaResumida {
  const resumen: TareaResumida = {
    id: ultimoTrozo(tarea.name),
    cola,
    metodo: tarea.httpRequest?.httpMethod ?? "",
    ruta: ruta(tarea.httpRequest?.url),
    estado: estadoDeTarea(tarea, ahora),
    programadaPara: tarea.scheduleTime ?? null,
    creada: tarea.createTime ?? null,
    intentos: Number(tarea.dispatchCount ?? 0),
    respuestas: Number(tarea.responseCount ?? 0),
  };
  const ultimo = tarea.lastAttempt;
  if (ultimo) {
    const codigo = ultimo.responseStatus?.code ?? null;
    const mensaje = ultimo.responseStatus?.message ?? null;
    const httpDelMensaje = mensaje
      ? /(?:HTTP|status)\D{0,15}\b([1-5]\d{2})\b/i.exec(mensaje)
      : null;
    resumen.ultimoIntento = {
      despachado: ultimo.dispatchTime ?? null,
      respondido: ultimo.responseTime ?? null,
      codigo,
      nombre: codigo !== null ? (CODIGOS_RPC[codigo]?.[0] ?? null) : null,
      http: httpDelMensaje
        ? Number(httpDelMensaje[1])
        : codigo !== null
          ? (CODIGOS_RPC[codigo]?.[1] ?? null)
          : null,
      mensaje: mensaje ? recortar(mensaje, 300) : null,
    };
  }
  return resumen;
}

/** El cuerpo en base64 de la tarea, decodificado: JSON si lo es y cabe; si
 * no, el texto recortado. */
export function decodificarCuerpo(base64: string | undefined): unknown {
  if (!base64) return null;
  const texto = Buffer.from(base64, "base64").toString("utf8");
  if (texto.length <= MAX_CUERPO) {
    try {
      return JSON.parse(texto) as unknown;
    } catch {
      // No es JSON: va como texto.
    }
  }
  return recortar(texto, MAX_CUERPO);
}

export type OpcionesDeColas = {
  cola?: string;
  conCuerpo?: boolean;
  limitePorCola?: number;
  mostrarTelefonos?: boolean;
};

export async function verColasDeProd(
  opciones: OpcionesDeColas,
  {
    gcloudFn = gcloud,
    ahora = Date.now(),
  }: { gcloudFn?: Gcloud; ahora?: number } = {}
) {
  if (opciones.cola && !/^[a-z0-9-]+$/.test(opciones.cola)) {
    throw new Error(`[MCP] «${opciones.cola}» no es un nombre de cola`);
  }
  const limite = Math.min(
    opciones.limitePorCola ?? LIMITE_POR_COLA,
    MAX_POR_COLA
  );
  const colas: { cola: string; estado: string }[] = opciones.cola
    ? [{ cola: opciones.cola, estado: "" }]
    : (
        JSON.parse(
          await gcloudFn([
            "tasks",
            "queues",
            "list",
            `--location=${REGION}`,
            "--format=json",
          ])
        ) as { name?: string; state?: string }[]
      ).map((cola) => ({
        cola: ultimoTrozo(cola.name),
        estado: cola.state ?? "",
      }));

  const porCola = await Promise.all(
    colas.map(async ({ cola, estado }) => {
      const tareas = (
        JSON.parse(
          (await gcloudFn([
            "tasks",
            "list",
            `--queue=${cola}`,
            `--location=${REGION}`,
            `--limit=${limite}`,
            "--format=json",
          ])) || "[]"
        ) as TareaDeCloudTasks[]
      ).map((tarea) => resumirTarea(tarea, cola, ahora));
      return { cola, estado, tareas };
    })
  );

  const tareas = porCola
    .flatMap((cola) => cola.tareas)
    .sort((a, b) =>
      (a.programadaPara ?? "").localeCompare(b.programadaPara ?? "")
    );

  let cuerposSinLeer = 0;
  if (opciones.conCuerpo) {
    const conCuerpo = tareas.slice(0, MAX_CUERPOS);
    cuerposSinLeer = tareas.length - conCuerpo.length;
    // Una tras otra: son pocas y así no se lanzan 25 gcloud a la vez.
    for (const tarea of conCuerpo) {
      try {
        const completa = JSON.parse(
          await gcloudFn([
            "tasks",
            "describe",
            tarea.id,
            `--queue=${tarea.cola}`,
            `--location=${REGION}`,
            "--response-view=full",
            "--format=json(httpRequest.body)",
          ])
        ) as TareaDeCloudTasks;
        tarea.cuerpo = decodificarCuerpo(completa.httpRequest?.body);
      } catch (error) {
        // Ya salió de la cola entre el list y el describe, o sin permiso.
        tarea.cuerpo = { error: (error as Error).message };
      }
    }
  }

  const resumen = porCola.map(({ cola, estado, tareas: deLaCola }) => {
    const porEstado: Partial<Record<EstadoDeTarea, number>> = {};
    for (const tarea of deLaCola) {
      porEstado[tarea.estado] = (porEstado[tarea.estado] ?? 0) + 1;
    }
    return {
      cola,
      ...(estado ? { estado } : {}),
      tareas: deLaCola.length,
      ...(deLaCola.length >= limite ? { truncado: true } : {}),
      porEstado,
    };
  });

  return {
    leyenda: {
      programada: "aún no le toca (p. ej. un recordatorio de cita)",
      en_cola: "ya le toca y Cloud Tasks aún no la ha despachado",
      atascada: "le tocaba hace más de 10 min y no se ha intentado",
      reintentando:
        "se intentó y no acabó bien: Cloud Tasks la reintentará (mira ultimoIntento)",
    },
    colas: resumen,
    ...(cuerposSinLeer > 0
      ? {
          nota: `Cuerpo leído solo de las ${MAX_CUERPOS} primeras tareas; pide una cola concreta para ver el resto.`,
        }
      : {}),
    tareas: opciones.mostrarTelefonos ? tareas : enmascararEnTodo(tareas),
  };
}
