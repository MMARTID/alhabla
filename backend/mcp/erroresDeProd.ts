import { gcloud, type Gcloud } from "./gcloud.js";
import {
  convertirEntrada,
  filtroDeLogs,
  type LineaDeLog,
} from "./logsDeProd.js";
import { enmascararEnTodo, recortar } from "./privacidad.js";

/**
 * Errores y avisos de `alhabla-api` AGRUPADOS por mensaje: «¿qué está
 * fallando en producción?» sin leer mil líneas. Cada grupo junta las líneas
 * que solo se distinguen por un id, un teléfono, una fecha o un número
 * (normalizarMensaje los cambia por marcadores) y dice cuántas veces salió,
 * la primera y la última, en qué revisiones y un ejemplo recortado.
 *
 * El filtro es el de ver_logs_prod con soloErrores: severity >= WARNING, el
 * log de stderr (console.error llega como textPayload sin severity) y el
 * nivel de pino >= 40 (warn) en jsonPayload. Una pila de console.error llega
 * partida en varias entradas (una por línea): cada línea «at …» forma su
 * propio grupo.
 */

const LIMITE_POR_DEFECTO = 1_000;
export const LIMITE_MAXIMO = 10_000;
const MAX_GRUPOS = 200;
const MAX_EJEMPLO = 500;
const MAX_CLAVE = 300;

/**
 * Lo que cambia de una línea a otra del mismo error, en el orden en que se
 * sustituye (los UUID y las fechas antes que los números sueltos y los
 * tokens largos).
 */
const SUSTITUCIONES: [RegExp, string][] = [
  [/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<uuid>"],
  [
    /\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?/g,
    "<fecha>",
  ],
  // call_control_id de Telnyx: «v3:» + base64url.
  [/\bv\d:[\w-]{10,}/g, "<llamada>"],
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "<email>"],
  [/\+\d{6,15}/g, "<tel>"],
  [/\bwamid\.[\w=-]+/g, "<wamid>"],
  // cuid de Prisma.
  [/\bc[a-z0-9]{24}\b/g, "<id>"],
  [/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, "<ip>"],
  [/\b[0-9a-f]{16,}\b/gi, "<hex>"],
  // Tokens largos con alguna cifra (ids de Telnyx, de Stripe, de Meta…).
  [/\b(?=[\w-]*\d)[\w-]{20,}\b/g, "<token>"],
  [/\d{4,}/g, "<n>"],
];

/** El mensaje sin lo que cambia de una línea a otra del mismo error. */
export function normalizarMensaje(texto: string): string {
  let normalizado = texto;
  for (const [patron, marcador] of SUSTITUCIONES) {
    normalizado = normalizado.replace(patron, marcador);
  }
  return normalizado.replace(/\s+/g, " ").trim().slice(0, MAX_CLAVE);
}

/** Lo que identifica una línea: su mensaje y, si pino trae `err`, la
 * primera línea del error (sin él, «send-sms job failed» juntaría fallos
 * distintos). */
function textoDeLaLinea(linea: LineaDeLog): string {
  const error = linea.error?.split("\n")[0];
  return error ? `${linea.mensaje} — ${error}` : linea.mensaje;
}

export type GrupoDeErrores = {
  mensaje: string;
  veces: number;
  primera: string;
  ultima: string;
  /** Revisión → cuántas veces salió en ella. */
  revisiones: Record<string, number>;
  origen: LineaDeLog["origen"];
  nivel?: string;
  /** La línea más reciente del grupo, recortada. */
  ejemplo: string;
};

/** Agrupa las líneas por mensaje normalizado, de más a menos veces (a
 * igualdad, el que salió más tarde primero). */
export function agruparErrores(lineas: LineaDeLog[]): GrupoDeErrores[] {
  const grupos = new Map<string, GrupoDeErrores>();
  for (const linea of lineas) {
    const texto = textoDeLaLinea(linea);
    const clave = normalizarMensaje(texto);
    let grupo = grupos.get(clave);
    if (!grupo) {
      grupo = {
        mensaje: clave,
        veces: 0,
        primera: linea.hora,
        ultima: linea.hora,
        revisiones: {},
        origen: linea.origen,
        ...(linea.nivel ? { nivel: linea.nivel } : {}),
        ejemplo: recortar(texto, MAX_EJEMPLO),
      };
      grupos.set(clave, grupo);
    }
    grupo.veces += 1;
    if (linea.hora < grupo.primera) grupo.primera = linea.hora;
    if (linea.hora >= grupo.ultima) {
      grupo.ultima = linea.hora;
      grupo.ejemplo = recortar(texto, MAX_EJEMPLO);
    }
    const revision = linea.revision || "?";
    grupo.revisiones[revision] = (grupo.revisiones[revision] ?? 0) + 1;
  }
  return [...grupos.values()].sort(
    (a, b) => b.veces - a.veces || b.ultima.localeCompare(a.ultima)
  );
}

export type OpcionesDeErrores = {
  desde?: string;
  hasta?: string;
  texto?: string | string[];
  revision?: string;
  limiteEntradas?: number;
  mostrarTelefonos?: boolean;
};

/** Solo los campos que hacen falta para agrupar: con miles de entradas, el
 * JSON entero (con la pila de cada error) pesa megas. */
const PROYECCION =
  "json(timestamp,severity,logName,textPayload,jsonPayload.msg,jsonPayload.level,jsonPayload.err.type,jsonPayload.err.message,jsonPayload.req.method,jsonPayload.req.url,resource.labels.revision_name)";

export async function leerErroresDeProd(
  opciones: OpcionesDeErrores,
  {
    gcloudFn = gcloud,
    ahora = Date.now(),
  }: { gcloudFn?: Gcloud; ahora?: number } = {}
) {
  const limite = Math.min(
    opciones.limiteEntradas ?? LIMITE_POR_DEFECTO,
    LIMITE_MAXIMO
  );
  const filtro = filtroDeLogs(
    {
      desde: opciones.desde ?? "24h",
      hasta: opciones.hasta,
      texto: opciones.texto,
      revision: opciones.revision,
      soloErrores: true,
    },
    ahora
  );
  const salida = await gcloudFn([
    "logging",
    "read",
    filtro,
    `--limit=${limite}`,
    `--format=${PROYECCION}`,
  ]);
  const lineas = (
    JSON.parse(salida || "[]") as Parameters<typeof convertirEntrada>[0][]
  ).map(convertirEntrada);
  const todos = agruparErrores(lineas);
  const grupos = todos.slice(0, MAX_GRUPOS);
  return {
    filtro,
    entradasLeidas: lineas.length,
    // Se llegó al límite: los recuentos son de las más recientes.
    truncado: lineas.length >= limite,
    totalGrupos: todos.length,
    ...(todos.length > grupos.length
      ? { gruposSinMostrar: todos.length - grupos.length }
      : {}),
    grupos: opciones.mostrarTelefonos ? grupos : enmascararEnTodo(grupos),
  };
}
