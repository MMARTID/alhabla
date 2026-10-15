import { SERVICIO, gcloud, type Gcloud } from "./gcloud.js";
import { enmascararEnTodo, recortar } from "./privacidad.js";
import { momentoDesde } from "./tiempo.js";

/**
 * Logs de `alhabla-api` en Cloud Logging, con las trampas ya resueltas:
 *
 * - `console.log`/`console.error` llegan como `textPayload` (stdout/stderr)
 *   y el logger de Fastify (`fastify.log`, rutas) como `jsonPayload.msg`:
 *   un texto se busca en los dos.
 * - Las líneas de `console.error` no traen `severity`: «solo errores» mira
 *   también el log de stderr y el nivel de pino (40 = warn, 50 = error).
 * - Cada petición deja «incoming request» y «request completed»: se quitan
 *   salvo que se pidan.
 */
const BASE = `resource.type="cloud_run_revision" AND resource.labels.service_name="${SERVICIO}"`;
const LOG_DE_PETICIONES = 'logName:"run.googleapis.com%2Frequests"';
const RUIDO = ["incoming request", "request completed"];
const MAX_CARACTERES = 2_000;

/** Literal de cadena para un filtro de Cloud Logging. */
export function literal(texto: string): string {
  return `"${texto.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function franja(
  desde: string,
  hasta: string | undefined,
  ahora: number
): string[] {
  const partes = [`timestamp>="${momentoDesde(desde, ahora)}"`];
  if (hasta) partes.push(`timestamp<="${momentoDesde(hasta, ahora)}"`);
  return partes;
}

export type OpcionesDeLogs = {
  /** Texto que tiene que aparecer; con varios, basta uno. */
  texto?: string | string[];
  desde?: string;
  hasta?: string;
  soloErrores?: boolean;
  revision?: string;
  incluirRuido?: boolean;
  limite?: number;
  mostrarTelefonos?: boolean;
};

export function filtroDeLogs(
  opciones: OpcionesDeLogs,
  ahora = Date.now()
): string {
  const partes = [
    BASE,
    `NOT ${LOG_DE_PETICIONES}`,
    ...franja(opciones.desde ?? "1h", opciones.hasta, ahora),
  ];
  if (!opciones.incluirRuido) {
    partes.push(
      ...RUIDO.map((ruido) => `NOT jsonPayload.msg=${literal(ruido)}`)
    );
  }
  const textos = [opciones.texto ?? []]
    .flat()
    .filter((texto) => texto.length > 0);
  if (textos.length > 0) {
    const alternativas = textos.flatMap((texto) => [
      `textPayload:${literal(texto)}`,
      `jsonPayload.msg:${literal(texto)}`,
      `jsonPayload.err.message:${literal(texto)}`,
    ]);
    partes.push(`(${alternativas.join(" OR ")})`);
  }
  if (opciones.soloErrores) {
    partes.push(
      '(severity>=WARNING OR logName:"run.googleapis.com%2Fstderr" OR jsonPayload.level>=40)'
    );
  }
  if (opciones.revision) {
    partes.push(`resource.labels.revision_name=${literal(opciones.revision)}`);
  }
  return partes.join(" AND ");
}

type EntradaDeLog = {
  timestamp?: string;
  severity?: string;
  logName?: string;
  textPayload?: string;
  jsonPayload?: {
    msg?: string;
    level?: number;
    err?: { type?: string; message?: string; stack?: string };
    req?: { method?: string; url?: string };
    res?: { statusCode?: number };
    [clave: string]: unknown;
  };
  resource?: { labels?: { revision_name?: string } };
  httpRequest?: {
    requestMethod?: string;
    requestUrl?: string;
    status?: number;
    latency?: string;
  };
};

export type LineaDeLog = {
  hora: string;
  revision: string;
  origen: "stdout" | "stderr" | "fastify";
  nivel?: string;
  mensaje: string;
  error?: string;
  peticion?: string;
};

const NIVELES_DE_PINO: Record<number, string> = {
  10: "trace",
  20: "debug",
  30: "info",
  40: "warn",
  50: "error",
  60: "fatal",
};

export function convertirEntrada(entrada: EntradaDeLog): LineaDeLog {
  const json = entrada.jsonPayload;
  const linea: LineaDeLog = {
    hora: entrada.timestamp ?? "",
    revision: entrada.resource?.labels?.revision_name ?? "",
    origen: json
      ? "fastify"
      : entrada.logName?.endsWith("stderr")
        ? "stderr"
        : "stdout",
    mensaje: recortar(
      entrada.textPayload ?? json?.msg ?? JSON.stringify(json ?? {}),
      MAX_CARACTERES
    ),
  };
  const nivel =
    json?.level !== undefined ? NIVELES_DE_PINO[json.level] : entrada.severity;
  if (nivel && nivel !== "DEFAULT") linea.nivel = nivel;
  if (json?.err) {
    linea.error = recortar(
      [json.err.type, json.err.message].filter(Boolean).join(": ") ||
        (json.err.stack ?? ""),
      MAX_CARACTERES
    );
  }
  if (json?.req?.url)
    linea.peticion = `${json.req.method ?? ""} ${json.req.url}`.trim();
  return linea;
}

export async function leerLogsDeProd(
  opciones: OpcionesDeLogs,
  {
    gcloudFn = gcloud,
    ahora = Date.now(),
  }: { gcloudFn?: Gcloud; ahora?: number } = {}
): Promise<{ filtro: string; total: number; lineas: LineaDeLog[] }> {
  const filtro = filtroDeLogs(opciones, ahora);
  const salida = await gcloudFn([
    "logging",
    "read",
    filtro,
    `--limit=${opciones.limite ?? 100}`,
    "--format=json",
  ]);
  // gcloud las da de la más nueva a la más vieja: se devuelven en orden.
  const lineas = (JSON.parse(salida || "[]") as EntradaDeLog[])
    .map(convertirEntrada)
    .reverse();
  return {
    filtro,
    total: lineas.length,
    lineas: opciones.mostrarTelefonos ? lineas : enmascararEnTodo(lineas),
  };
}

export type OpcionesDePeticiones = {
  ruta?: string;
  metodo?: string;
  estadoMinimo?: number;
  desde?: string;
  hasta?: string;
  incluirInternas?: boolean;
  limite?: number;
  mostrarTelefonos?: boolean;
};

/**
 * Peticiones HTTP (log de requests de Cloud Run). Por defecto se quitan las
 * que nadie mira al depurar: /health (el uptime check, ~8.600 al día),
 * /internal/ (Cloud Tasks y Scheduler) y los OPTIONS del CORS.
 */
export function filtroDePeticiones(
  opciones: OpcionesDePeticiones,
  ahora = Date.now()
): string {
  const partes = [
    BASE,
    LOG_DE_PETICIONES,
    ...franja(opciones.desde ?? "1h", opciones.hasta, ahora),
  ];
  if (opciones.ruta)
    partes.push(`httpRequest.requestUrl:${literal(opciones.ruta)}`);
  if (opciones.metodo) {
    partes.push(
      `httpRequest.requestMethod=${literal(opciones.metodo.toUpperCase())}`
    );
  }
  if (opciones.estadoMinimo !== undefined) {
    partes.push(`httpRequest.status>=${Math.trunc(opciones.estadoMinimo)}`);
  }
  if (!opciones.incluirInternas) {
    partes.push(
      'NOT httpRequest.requestUrl:"/internal/"',
      'NOT httpRequest.requestUrl:"/health"',
      'NOT httpRequest.requestMethod="OPTIONS"'
    );
  }
  return partes.join(" AND ");
}

export type Peticion = {
  hora: string;
  metodo: string;
  estado: number | null;
  ruta: string;
  latencia?: string;
  revision: string;
};

export function convertirPeticion(entrada: EntradaDeLog): Peticion {
  const peticion = entrada.httpRequest ?? {};
  let ruta = peticion.requestUrl ?? "";
  try {
    const url = new URL(ruta);
    ruta = `${url.pathname}${url.search}`;
  } catch {
    // Ya era una ruta.
  }
  return {
    hora: entrada.timestamp ?? "",
    metodo: peticion.requestMethod ?? "",
    estado: peticion.status ?? null,
    ruta,
    ...(peticion.latency ? { latencia: peticion.latency } : {}),
    revision: entrada.resource?.labels?.revision_name ?? "",
  };
}

export async function leerPeticionesDeProd(
  opciones: OpcionesDePeticiones,
  {
    gcloudFn = gcloud,
    ahora = Date.now(),
  }: { gcloudFn?: Gcloud; ahora?: number } = {}
): Promise<{ filtro: string; total: number; peticiones: Peticion[] }> {
  const filtro = filtroDePeticiones(opciones, ahora);
  const salida = await gcloudFn([
    "logging",
    "read",
    filtro,
    `--limit=${opciones.limite ?? 100}`,
    "--format=json",
  ]);
  const peticiones = (JSON.parse(salida || "[]") as EntradaDeLog[])
    .map(convertirPeticion)
    .reverse();
  return {
    filtro,
    total: peticiones.length,
    peticiones: opciones.mostrarTelefonos
      ? peticiones
      : enmascararEnTodo(peticiones),
  };
}
