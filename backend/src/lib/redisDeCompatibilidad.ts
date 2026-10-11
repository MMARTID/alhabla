import Redis from "ioredis";
import { errorMessage } from "./logUtils.js";

/**
 * Puente con Redis mientras dure el corte a Postgres (plan de apagado de
 * Memorystore, PR A). Se borra en la fase 3.
 *
 * Durante el despliegue conviven revisiones que solo conocen Redis (las
 * anteriores al PR A) con revisiones que ya guardan los cerrojos en Postgres.
 * Para que se excluyan entre sí, mientras la revisión tenga `REDIS_URL` cada
 * cerrojo se toma en los dos almacenes con la misma clave (lib/cerrojos.ts):
 * Redis es coautoridad, y si no confirma el cerrojo no se concede (falla
 * cerrado). La única bandera es `REDIS_URL`: sin ella, todo va solo por
 * Postgres.
 *
 * Cliente propio y distinto del de lib/redis.ts, con opciones que no dejan
 * comandos colgados ni en cola:
 * - `enableOfflineQueue: false` y `maxRetriesPerRequest: 0`: un comando que
 *   se envía sin conexión falla en el acto, no espera a que reconecte.
 * - `commandTimeout: 1000`: un Redis lento no alarga la sección crítica; si
 *   el SET vence el plazo se manda detrás, por la misma conexión, un
 *   compare-and-delete con el mismo token (ver cerrojoEnRedisAntiguo). Un
 *   compare-and-delete que vence el plazo fuerza la reconexión
 *   (`soltarUnaVez`): con la conexión medio abierta, ioredis seguiría en
 *   «ready» sin reconectar (medido con un agujero negro: sin forzarla, 6 de
 *   6 reservas fallan cerradas; forzándola, la primera entra a los 4,5 s y
 *   las siguientes en milisegundos).
 *
 * Sin cola offline, un corte breve (el cliente reconecta en 200-600 ms, por
 * su retryStrategy) ya no lo absorbe el cliente, como en lib/redis.ts, sino
 * los llamadores: adquirirCerrojo reintenta dentro de su presupuesto
 * (lib/cerrojos.ts) y un compare-and-delete que no pudo salir se vuelve a
 * mandar en cuanto el cliente está listo otra vez (soltarEnRedisAntiguo).
 *
 * Solo expone las operaciones que se usan. Todos los logs van con freno (uno
 * por minuto y operación) para no inundar Cloud Logging si Redis cae.
 */

/**
 * - `sin_conexion`: no se envió nada (cliente no listo); se puede reintentar.
 * - `incierto`: se envió y no hubo respuesta clara (plazo vencido, conexión
 *   caída con el comando en vuelo, error de Redis): el SET pudo aplicarse,
 *   así que ya se mandó (o se mandará al reconectar) un compare-and-delete
 *   con ese token; se puede reintentar, pero con otro token.
 */
export type ResultadoEnRedisAntiguo =
  "adquirido" | "ocupado" | "incierto" | "sin_conexion";

const OPCIONES_DEL_CLIENTE = {
  lazyConnect: true,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 0,
  commandTimeout: 1000,
  connectTimeout: 2000,
  retryStrategy: (intentos: number) => Math.min(intentos * 200, 2000),
} as const;

// Compare-and-delete: solo borra si la clave sigue siendo nuestra. Es el
// mismo script que usaba lib/bookingLock.ts antes del corte, así que una
// revisión vieja y una nueva liberan exactamente igual.
const SCRIPT_SOLTAR = `if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end`;

const FRENO_DE_LOGS_MS = 60_000;

/** Compare-and-delete que no pudieron salir, por token (cada token es de una
 * sola adquisición, así que reenviarlo nunca borra el cerrojo de otro). Se
 * reenvían en cada `ready`; con tope, porque la clave caduca sola por su TTL
 * igualmente. */
const SUELTAS_APLAZADAS_MAX = 1000;
const INTENTOS_DE_SOLTAR = 5;
const sueltasAplazadas = new Map<string, { clave: string; intentos: number }>();

let cliente: Redis | null = null;
const ultimoAvisoPorOperacion = new Map<
  string,
  { en: number; omitidos: number }
>();

/** Log con freno: como mucho uno por minuto y operación (y por instancia,
 * porque el estado vive en la memoria del proceso). Los que se callan se
 * cuentan y se dicen en el siguiente. */
function avisarConFreno(
  operacion: string,
  clave: string,
  motivo: string
): void {
  const ahora = Date.now();
  const previo = ultimoAvisoPorOperacion.get(operacion);
  if (previo && ahora - previo.en < FRENO_DE_LOGS_MS) {
    previo.omitidos += 1;
    return;
  }
  const omitidos = previo?.omitidos ?? 0;
  ultimoAvisoPorOperacion.set(operacion, { en: ahora, omitidos: 0 });
  console.error(
    `[Compat Redis] ${operacion} ${clave}: ${motivo}${
      omitidos > 0
        ? ` (+${omitidos} avisos iguales omitidos en el último minuto)`
        : ""
    }`
  );
}

function esPlazoVencido(err: unknown): boolean {
  return errorMessage(err).includes("Command timed out");
}

/** ioredis rechaza en el acto, sin enviar nada, un comando sin conexión
 * escribible cuando no hay cola offline. */
function noSeEnvio(err: unknown): boolean {
  return errorMessage(err).includes("Stream isn't writeable");
}

/** Redis contestó con un error: el comando llegó y no se aplicó. */
function esRespuestaDeError(err: unknown): boolean {
  return (err as { name?: unknown } | null)?.name === "ReplyError";
}

/** `true` si el cliente de compatibilidad puede enviar ya (estado `ready`). */
export function redisDeCompatibilidadListo(): boolean {
  return cliente?.status === "ready";
}

/** `true` solo si `conectarRedisDeCompatibilidad()` creó el cliente (hay
 * `REDIS_URL`), esté o no listo: un cliente que todavía no ha conectado no
 * deja la revisión en «solo Postgres», sino que hace que los cerrojos fallen
 * cerrados. */
export function compatibilidadActiva(): boolean {
  return cliente !== null;
}

/**
 * En el arranque, antes de `listen` (server.ts). Sin `REDIS_URL` no hace
 * nada. Con ella crea el cliente y espera a que esté listo hasta `plazoMs`;
 * si no llega, lo deja registrado y sigue: los cerrojos fallarán cerrados
 * hasta que conecte (el cliente reconecta solo). Idempotente.
 */
export async function conectarRedisDeCompatibilidad(
  plazoMs = 3000
): Promise<void> {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.log(
      "[Compat Redis] Sin REDIS_URL: los cerrojos van solo por Postgres"
    );
    return;
  }
  if (cliente) return;

  const nuevo = new Redis(url, { ...OPCIONES_DEL_CLIENTE });
  nuevo.on("error", (err) =>
    avisarConFreno("conexion", "-", errorMessage(err))
  );
  // Al (re)conectar, sale lo que no pudo soltarse durante el corte.
  nuevo.on("ready", () => {
    if (cliente === nuevo) void reenviarSueltasAplazadas();
  });
  cliente = nuevo;

  const listo = new Promise<boolean>((resolve) => {
    nuevo.once("ready", () => resolve(true));
  });
  // El rechazo de connect() no es definitivo (retryStrategy sigue
  // reconectando); se recoge para que no quede como promesa sin capturar.
  nuevo.connect().catch((err) => {
    avisarConFreno("conectar", "-", errorMessage(err));
  });
  let temporizador: NodeJS.Timeout | undefined;
  const plazo = new Promise<boolean>((resolve) => {
    temporizador = setTimeout(() => resolve(false), plazoMs);
    temporizador.unref?.();
  });
  const conecto = await Promise.race([listo, plazo]);
  clearTimeout(temporizador);

  if (conecto) {
    console.log(
      "[Compat Redis] Conectado: los cerrojos se toman en Postgres y en Redis"
    );
  } else {
    console.error(
      `[Compat Redis] Redis no estuvo listo en ${plazoMs} ms; los cerrojos fallarán cerrados hasta que conecte (estado: ${nuevo.status})`
    );
  }
}

/** Solo para los tests, para volver a «solo Postgres». El apagado de
 * server.ts no lo llama: una adquisición que estuviera reintentando se
 * concedería solo en Postgres, sin la clave de Redis. */
export async function cerrarRedisDeCompatibilidad(): Promise<void> {
  const actual = cliente;
  cliente = null;
  sueltasAplazadas.clear();
  if (!actual) return;
  try {
    await actual.quit();
  } catch {
    // Sin conexión no hay nada que cerrar con orden.
    actual.disconnect();
  }
}

/**
 * `SET clave token PX ttl NX` en el Redis que usan las revisiones viejas.
 * - Cliente no listo (o ioredis lo rechaza sin enviarlo) ⇒ `sin_conexion`.
 * - `OK` ⇒ `adquirido`; `null` ⇒ `ocupado`.
 * - Cualquier otro error ⇒ `incierto`: el SET pudo llegar a aplicarse, así
 *   que se manda un compare-and-delete con el mismo token para no dejar la
 *   clave huérfana. Si venció el plazo, sale detrás por la misma conexión (se
 *   ejecuta después del SET); si la conexión cayó, sale al reconectar.
 */
export async function cerrojoEnRedisAntiguo(
  clave: string,
  token: string,
  ttlMs: number
): Promise<ResultadoEnRedisAntiguo> {
  const actual = cliente;
  if (!actual || actual.status !== "ready") {
    avisarConFreno(
      "cerrojo",
      clave,
      `cliente no listo (${actual?.status ?? "sin cliente"}); el cerrojo no se concede`
    );
    return "sin_conexion";
  }
  try {
    const respuesta = await actual.set(clave, token, "PX", ttlMs, "NX");
    return respuesta === "OK" ? "adquirido" : "ocupado";
  } catch (err) {
    if (noSeEnvio(err)) {
      avisarConFreno("cerrojo", clave, errorMessage(err));
      return "sin_conexion";
    }
    avisarConFreno(
      "cerrojo",
      clave,
      `${esPlazoVencido(err) ? "plazo vencido" : errorMessage(err)}; se manda un compare-and-delete compensatorio`
    );
    void soltarEnRedisAntiguo(clave, token);
    return "incierto";
  }
}

/** Guarda un compare-and-delete para el próximo `ready`. */
function aplazarSoltar(clave: string, token: string, intentos: number): void {
  if (intentos >= INTENTOS_DE_SOLTAR) {
    avisarConFreno(
      "soltar",
      clave,
      `sin conseguirlo tras ${intentos} intentos; la clave caducará por su TTL`
    );
    return;
  }
  if (
    !sueltasAplazadas.has(token) &&
    sueltasAplazadas.size >= SUELTAS_APLAZADAS_MAX
  ) {
    avisarConFreno(
      "soltar",
      clave,
      `ya hay ${SUELTAS_APLAZADAS_MAX} pendientes de reenviar; esta caducará por su TTL`
    );
    return;
  }
  sueltasAplazadas.set(token, { clave, intentos });
}

async function soltarUnaVez(
  clave: string,
  token: string,
  intentos: number
): Promise<void> {
  const actual = cliente;
  if (!actual) return;
  if (actual.status !== "ready") {
    avisarConFreno(
      "soltar",
      clave,
      `cliente no listo (${actual.status}); se reenvía al reconectar`
    );
    aplazarSoltar(clave, token, intentos);
    return;
  }
  try {
    await actual.eval(SCRIPT_SOLTAR, 1, clave, token);
  } catch (err) {
    if (esRespuestaDeError(err)) {
      avisarConFreno(
        "soltar",
        clave,
        `${errorMessage(err)} (la clave caducará por su TTL)`
      );
      return;
    }
    // Si venció el plazo, el EVAL sigue en la conexión y puede ejecutarse;
    // reenviarlo al reconectar no hace daño (solo borra este token).
    const plazoVencido = esPlazoVencido(err);
    avisarConFreno(
      "soltar",
      clave,
      `${errorMessage(err)}; se reenvía al reconectar${plazoVencido ? " (se fuerza la reconexión)" : ""}`
    );
    aplazarSoltar(clave, token, intentos + 1);
    // Con la conexión medio abierta, ioredis sigue en «ready», cada comando
    // vence su plazo y nunca reconecta: todos los cerrojos de la instancia
    // fallarían cerrados (y /health no lo vería) hasta que el sistema diera
    // el socket por muerto, unos 15 min. Se fuerza aquí y no tras un SET
    // vencido: su compare-and-delete compensatorio tiene que salir detrás de
    // él por la MISMA conexión, para ejecutarse después si Redis recibe los
    // dos (tras un SET vencido, es ese compare-and-delete, 1 s después, el
    // que fuerza la reconexión). Los SET de otras adquisiciones que sigan en
    // la conexión fallan como inciertos y su compare-and-delete sale al
    // reconectar: si alguno llegara a Redis después, la clave quedaría
    // ocupada hasta su TTL (falla cerrado), nunca con dos poseedores.
    if (plazoVencido && cliente === actual && actual.status === "ready") {
      actual.disconnect(true);
    }
  }
}

async function reenviarSueltasAplazadas(): Promise<void> {
  const lote = [...sueltasAplazadas];
  sueltasAplazadas.clear();
  for (const [token, { clave, intentos }] of lote) {
    await soltarUnaVez(clave, token, intentos);
  }
}

/** Compare-and-delete en Redis. Nunca lanza. Si el cliente no está listo o la
 * conexión cae con el EVAL en vuelo, se reenvía en cuanto vuelva a estar
 * listo (hasta 5 veces); sin eso, la clave bloquearía a todos hasta su TTL
 * (45-120 s). */
export async function soltarEnRedisAntiguo(
  clave: string,
  token: string
): Promise<void> {
  await soltarUnaVez(clave, token, 0);
}

/** Solo para los tests: olvida el freno de logs. */
export function reiniciarFrenoDeLogsParaTests(): void {
  ultimoAvisoPorOperacion.clear();
}

/** Solo para los tests: cuántos compare-and-delete esperan a reconectar. */
export function sueltasAplazadasParaTests(): number {
  return sueltasAplazadas.size;
}
