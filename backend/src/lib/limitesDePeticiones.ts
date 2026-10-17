import type { RouteOptions } from "fastify";
import type { FastifyRateLimitStore } from "@fastify/rate-limit";
import type { PrismaClient } from "@prisma/client";
import { incrementarContadores } from "./almacenTemporal.js";
import { errorMessage } from "./logUtils.js";
import { crearClienteDeUnaConexion } from "./prisma.js";

/**
 * Almacén de @fastify/rate-limit sobre Postgres (tabla UNLOGGED `contadores`),
 * en lugar del RedisStore. Mismas claves que antes: `ratelimit:<ip>` para el
 * límite global y `ratelimit:<METHOD><url>-<ip>` para el de cada ruta.
 *
 * El contador global es lo que hace que el límite valga entre instancias de
 * Cloud Run: en la memoria de cada una se multiplicaba por el número de
 * instancias y se reiniciaba en cada arranque en frío (arreglado el 17-09).
 *
 * Todas las rutas, también /webhooks/telnyx*, cuentan de
 * forma SÍNCRONA en Postgres (decisión D2, AGENTS.md § Corte de Redis): cada
 * petición espera a que Postgres la cuente y se decide con el valor global,
 * como con el INCR de Redis, a cualquier ritmo de llegada. La instancia
 * espera como mucho UNA sentencia del limitador a la vez (ver `proceso.vuelo`)
 * y la manda por una conexión PROPIA, fuera del pool de `prisma`
 * (`crearClienteDeUnaConexion`): en el pool compartido (connection_limit=2)
 * esperaría turno detrás de las consultas de los handlers (medido: con unas
 * 40 peticiones a la vez con consultas de 30 ms vencía el plazo con Postgres
 * sano y la instancia entera pasaba a la cuenta local). Lo que llega mientras
 * hay una sentencia en vuelo espera en una cola y sale todo junto en la
 * siguiente, una sola sentencia para todas sus claves (almacenTemporal.ts,
 * `incrementarContadores`). A la k-ésima de las c peticiones de una clave que
 * vuelve con valor v le toca v - c + k: la posición que le habría dado su
 * INCR.
 *
 * La conexión propia es una más por instancia, además de las
 * `connection_limit=2` del pool: 3 por instancia en marcha normal. Con el
 * `maxScale` de 20 de alhabla-api serían 60, más que el `max_connections` de 50
 * de Cloud SQL. Peor caso: durante los 15 min que siguen a un episodio de
 * conexión medio abierta, la instancia puede tener una más (la desechada, si
 * Postgres no se enteró del corte; ver abajo), `connection_limit + 2` = 4
 * (medido). Decisión del dueño (10-10-2026, revisada el 11-10 para cubrir ese
 * peor caso): antes de fusionar el PR A, producción baja `maxScale` a 11, y
 * 11 × 4 = 44, más una migración y un proxy, cabe en los 47 huecos que dejan
 * las 3 reservadas (con 14 serían 56 > 50). Cualquier cambio posterior de
 * `connection_limit` o de `maxScale` tiene que seguir cumpliendo
 * `maxScale × (connection_limit + 2)` + migraciones + proxy + 3 ≤
 * `max_connections` (AGENTS.md § Pool). Son 4 solo mientras Postgres cierre
 * las medio abiertas en menos de 15 min: si tarda más, cada 15 min puede
 * sumarse otra hasta que su keepalive las cierre (ver abajo).
 *
 * La cuenta local de la instancia solo decide cuando Postgres no puede:
 * - la sentencia en vuelo venció su plazo de 500 ms (Postgres o la red
 *   lentos): sus peticiones, las de la cola y las que lleguen hasta que
 *   vuelva se deciden en local (el plazo no cancela la sentencia: si acaba
 *   ejecutándose, cuenta las suyas en la ventana de Postgres en que se
 *   ejecute);
 * - Postgres devolvió un error;
 * - el cortacircuitos está abierto (3 fallos seguidos ⇒ 30 s; luego, una
 *   sonda: lo que llega con ella en vuelo espera detrás, como detrás de
 *   cualquier sentencia, y sale en la siguiente si va bien o se decide en
 *   local si falla o vence su plazo; una sonda que vence su plazo pero
 *   vuelve bien antes de 1 s cierra el cortacircuitos igualmente, porque
 *   tras 30 s sin usarse la conexión hace 2 viajes, o 6 si es nueva, y con
 *   la red algo lenta vencería en cada ciclo aunque una sentencia normal
 *   cupiera en el plazo);
 * - no hay conexión que usar: ya hay 2 desechadas por un plazo en los
 *   últimos 15 min (ver abajo). Dura hasta 15 min, aunque Postgres esté
 *   sano todo el rato.
 * La cuenta local es el último global que dio Postgres en la ventana más lo
 * que esta instancia lleva en vuelo y lo que ha decidido por su cuenta. Lo
 * decidido en local no se manda después a Postgres, y se anota de dos formas:
 * - `locales`: es seguro que Postgres no lo contó (no se llegó a mandar, o el
 *   error prueba que la sentencia no se ejecutó: `seguroQueNoSeEjecuto`).
 *   Sigue sumando en esta instancia, también en las posiciones que dé
 *   Postgres al volver, hasta que acaba la ventana en que se decidió;
 * - `inciertos`: la sentencia salió y falló sin que se sepa si Postgres la
 *   ejecutó (la conexión se cerró antes de la respuesta, P1017; un
 *   `socket_timeout` o el abandono a los 6 s; cualquier otro error).
 *   Postgres puede haberla confirmado, así que suma en las decisiones
 *   locales, pero en cuanto Postgres vuelve a dar un valor de la ventana se
 *   olvida: ese valor ya la incluye si se ejecutó, y sumarla otra vez daría
 *   429 que INCR no habría dado.
 * Así:
 * - nunca rechaza de más: lo que suma son peticiones reales de la clave de
 *   los últimos `ventanaMs`, y ninguna dos veces. El global deja de valer
 *   cuando acaba la ventana de Postgres, contada desde la salida de la
 *   sentencia (nunca más tarde que la real, aunque la respuesta llegue
 *   tarde), y lo decidido en local cuando acaba la ventana en que se decidió
 *   (una que Postgres abra después no la alarga). Un cliente que no pasa de
 *   `max` en ningún intervalo de `ventanaMs` no recibe un 429, como con INCR.
 *   La excepción, la misma que con un INCR que llega tarde: una sentencia que
 *   se ejecuta después de que acabe la ventana de su clave cuenta sus
 *   peticiones (las de esa clave en el lote, normalmente una) en la ventana
 *   siguiente;
 * - mientras Postgres responde a tiempo, el límite es global: entre todas las
 *   instancias pasan exactamente `max` por ventana;
 * - si Postgres falla o va lento, cada instancia que decide en local deja
 *   pasar como mucho `max` por ventana, y las que siguen contando en
 *   Postgres, `max` entre todas (no ven lo decidido en local): con N
 *   instancias en cuenta local, hasta (N+1)·max (medido: una en local y otra
 *   en Postgres, con max 5, pasan 10). Una instancia que falla y vuelve
 *   dentro de la ventana tampoco pasa de `max`, salvo por las inciertas que
 *   Postgres no llegara a ejecutar: esas pueden pasar de más (las de las
 *   sentencias que fallan así hasta que se abre el cortacircuitos, y las de
 *   cada sonda);
 * - cuando vuelve la BD, lo decidido en local no gasta el cupo de la ventana
 *   siguiente.
 *
 * Una petición espera como mucho a que acabe la sentencia en vuelo (o venza
 * su plazo) y a su propia sentencia: unos 2 viajes a la BD con Postgres sano
 * y 1 s en el peor caso. Nunca se devuelve un error al plugin (`skipOnError`
 * se mantiene en arranqueDelServidor.ts como red).
 *
 * El plazo no cancela la consulta. Por eso la sentencia en vuelo no se suelta
 * cuando vence el plazo sino cuando vuelve o se da por perdida: con la BD
 * lenta, el limitador espera como mucho una sentencia a la vez. Su vida está
 * acotada en los dos lados, solo en la conexión del limitador: Postgres la
 * cancela a los 2 s de RECIBIRLA (`statement_timeout`) y el cliente la da por
 * perdida a los 5 s de mandarla (`socket_timeout`). El `socket_timeout` de
 * Prisma 6.19 no cubre la primera sentencia de cada conexión, la que lleva el
 * PREPARE (medido: congelada, sin respuesta en 20 s; ya preparada, P2010 a
 * los 5 s), así que el limitador la abandona por su cuenta a los 6 s.
 *
 * Las dos cuentas no empiezan a la vez, y eso deja un hueco: si la red retiene
 * la sentencia más de 5 s y la entrega después (una retransmisión TCP tras un
 * corte que se arregla solo), Postgres la ejecuta aunque el cliente ya la
 * soltara, y puede hacerlo a la vez que la siguiente, que salió por una
 * conexión nueva (medido: dos sentencias de la misma instancia activas en
 * pg_stat_activity, una esperando el bloqueo de fila de la otra, y la soltada
 * contada). La cuenta no sale mal, porque lo de una sentencia soltada va como
 * incierto; pero «una sola sentencia a la vez» vale en el cliente, no en
 * Postgres. Para que valiera también allí habría que no abrir otra conexión
 * mientras la soltada siga abierta, y desde aquí no se ve: el `$disconnect`
 * del cliente desechado resuelve enseguida aunque su socket siga abierto
 * (medido).
 *
 * Tras cualquier error de su sentencia (o el abandono) el cliente se desecha
 * y la siguiente abre una conexión nueva, si no hay ya 2 desechadas por un
 * plazo (ver abajo): con la conexión medio abierta (agujero negro en ella,
 * Postgres sano), Prisma sigue usando la conexión muerta (P2010 a los 5 s,
 * una consulta tras otra, sin abrir otra), y sin desecharla la instancia no
 * volvería a contar en Postgres (medido con dos instancias y solo la
 * conexión del limitador de una congelada: ni una vez en 60 s; desechándola,
 * vuelve a los 6 s). El cliente desechado no cierra su socket mientras
 * espera la respuesta perdida (lo cierra el sistema cuando da la conexión
 * por muerta) y, si Postgres no se enteró del corte, la conexión sigue
 * ocupando un hueco de `max_connections` hasta que la cierre el keepalive de
 * Postgres: sin tope, cada episodio sumaría una conexión más (medido sin él:
 * de 3 a 6 conexiones de la instancia en cuatro episodios).
 *
 * Por eso se acota: una conexión desechada por un plazo (el P2010 «Timed out
 * during query execution» del `socket_timeout`, que se reconoce por su texto, o
 * el abandono; no un error que prueba que se cerró, como P1017, ni uno de
 * Postgres con la conexión sana, como el del `statement_timeout`) se da por
 * abierta durante 15 min, y con 2 así no se abre otra: la instancia decide en
 * local hasta que la más antigua cumple los 15 min, aunque Postgres esté sano,
 * con un `console.error` («… no se abre otra hasta …») como mucho una vez por
 * minuto; /health no lo ve. Un episodio se recupera en cuanto contesta la
 * conexión nueva (medido: a los 6 s, con Postgres sano). Si la nueva conecta
 * pero su primera sentencia tampoco vuelve, la segunda desechada llega unos
 * 11 s después de empezar el atasco (los 5 s del P2010 de la vieja y los 6 s
 * del abandono de la nueva); y también con dos episodios cortos dentro de
 * 15 min (medido: dos congelaciones con 7 s entre ellas y, 35 s después, con
 * Postgres sano, pasan 6 con max 3 entre dos instancias). Mientras dura, entre
 * instancias pasan hasta (N+1)·max, o N·max si todas sufrieron el mismo atasco.
 *
 * Los 15 min son un supuesto, no una medida: lo que tarda Linux en dar por
 * muerta, del lado del cliente, una conexión TCP con datos sin confirmar
 * (`tcp_retries2` = 15, unos 15,4 min); por el socket Unix del conector de
 * Cloud SQL lo decide el conector. El hueco de `max_connections` lo libera
 * Postgres, que no tiene datos sin confirmar (espera una consulta que no
 * llega) y solo se entera por su keepalive: si tarda más de 15 min, al
 * cumplirse se abre otra conexión y la instancia llega a 5, y así cada 15
 * min hasta que las cierre (medido con el keepalive por defecto de un
 * Postgres local, unas 2 h: 5 conexiones a los 16 min).
 *
 * No implementa `continueExceeding`, `exponentialBackoff` ni `ban` (el
 * RedisStore sí), ni `read` (`{ increment: false }`): ninguna ruta los usa.
 */

const PLAZO_DE_CONSULTA_MS = 500;
/** Vida máxima de la sentencia en Postgres (`statement_timeout` de la
 * conexión del limitador, desde que la recibe) y en el cliente
 * (`socket_timeout`, en segundos, desde que la manda). Si la red la retiene
 * más que la diferencia, Postgres puede ejecutarla después de que el cliente
 * la suelte (ver la cabecera). */
const VIDA_EN_POSTGRES_MS = 2_000;
const VIDA_EN_EL_CLIENTE_S = 5;
/** Si Prisma no devuelve la sentencia en este tiempo, el limitador la da por
 * perdida: su `socket_timeout` no acota la primera de cada conexión (la del
 * PREPARE). Un segundo más que el `socket_timeout`, para que con una ya
 * preparada llegue antes su P2010. */
const ABANDONO_MS = VIDA_EN_EL_CLIENTE_S * 1_000 + 1_000;
/** Conexiones desechadas por un plazo que se dan por abiertas a la vez, como
 * mucho: con más, no se abre otra. */
const TOPE_DE_DESECHADAS_ABIERTAS = 1;
const VIDA_SUPUESTA_DE_UNA_DESECHADA_MS = 15 * 60_000;
const FALLOS_PARA_ABRIR = 3;
const CORTACIRCUITOS_ABIERTO_MS = 30_000;
const TOPE_DE_CUENTAS_LOCALES = 10_000;
const FRENO_DE_LOGS_MS = 60_000;
const ESPERA_AL_CERRAR_MS = 500;
const PREFIJO_POR_DEFECTO = "ratelimit:";

type Resultado = { current: number; ttl: number };
type Callback = (error: Error | null, resultado?: Resultado) => void;
type Peticion = { callback: Callback; respondida: boolean };

/** Lo que sabe esta instancia de una clave en la ventana vigente. */
type CuentaLocal = {
  /** Clave completa, con el prefijo: la misma que va a `contadores`. */
  readonly clave: string;
  ventanaMs: number;
  max: number;
  /** Último valor global que devolvió Postgres en esta ventana (0 si aún no
   * ha contestado). */
  global: number;
  /** Fin de la ventana (ms de Date.now()): el que dio Postgres, contado
   * desde la salida de la sentencia, o uno provisional desde la primera
   * petición mientras no conteste. Con `locales` no se alarga. */
  hasta: number;
  /** Peticiones de esta ventana que lleva la sentencia en vuelo. */
  enVuelo: number;
  /** Peticiones de esta ventana que decidió la cuenta local y que Postgres
   * seguro que no contó: suman en lo que decida la cuenta local y en las
   * posiciones que dé Postgres hasta que acabe la ventana. */
  locales: number;
  /** Peticiones de esta ventana que decidió la cuenta local tras un error
   * de su sentencia que no prueba que no se ejecutara: suman en lo que
   * decida la cuenta local hasta que Postgres vuelva a dar un valor de la
   * ventana (que ya las incluye si se ejecutó). */
  inciertos: number;
  /** Bloqueo local: Postgres ya dijo que en esta ventana se pasó de `max`;
   * hasta aquí se responde «pasado» sin consultar la BD. */
  bloqueadoHasta: number;
};

/**
 * Estado del proceso (una instancia de Cloud Run = un proceso). `vuelo` es la
 * única sentencia del limitador que se espera, y `conexion` el cliente por el
 * que sale: una conexión propia, aparte de las `connection_limit` del pool de
 * `prisma` (por instancia, connection_limit + 1, y + 2 tras un episodio; las
 * cuentas con maxScale y max_connections, en AGENTS.md § Pool). Las consultas
 * de los handlers no pueden quitarle el turno. `desechadasAbiertas`: cuándo
 * se desechó cada conexión por un plazo en los últimos 15 min.
 */
type EstadoDelCortacircuitos = "cerrado" | "abierto" | "sonda";
const proceso = {
  cuentas: new Map<string, CuentaLocal>(),
  /** Peticiones que esperan a la siguiente sentencia, por clave y en orden
   * de llegada. */
  cola: new Map<CuentaLocal, Peticion[]>(),
  vuelo: null as { desde: number; vencida: boolean; sonda: boolean } | null,
  conexion: null as PrismaClient | null,
  desechadasAbiertas: [] as number[],
  fallosSeguidos: 0,
  cortacircuitos: "cerrado" as EstadoDelCortacircuitos,
  abiertoHasta: 0,
  avisos: new Map<string, { en: number; omitidos: number }>(),
};

/** Si la ventana ya acabó, empieza otra (provisional hasta que Postgres
 * conteste). Lo de la anterior no cuenta en esta. */
function renovarVentanaSiCaducada(cuenta: CuentaLocal, ahora: number): void {
  if (cuenta.hasta > ahora) return;
  cuenta.global = 0;
  cuenta.enVuelo = 0;
  cuenta.locales = 0;
  cuenta.inciertos = 0;
  cuenta.hasta = ahora + cuenta.ventanaMs;
}

function obtenerCuenta(
  clave: string,
  ventanaMs: number,
  max: number,
  ahora: number
): CuentaLocal {
  let cuenta = proceso.cuentas.get(clave);
  if (!cuenta) {
    hacerSitio(ahora);
    cuenta = {
      clave,
      ventanaMs,
      max,
      global: 0,
      hasta: ahora + ventanaMs,
      enVuelo: 0,
      locales: 0,
      inciertos: 0,
      bloqueadoHasta: 0,
    };
    proceso.cuentas.set(clave, cuenta);
  }
  cuenta.ventanaMs = ventanaMs;
  cuenta.max = max;
  renovarVentanaSiCaducada(cuenta, ahora);
  return cuenta;
}

/** Poda perezosa al llegar al tope: primero lo caducado y, si no basta, el
 * 10 % más antiguo. Nunca una cuenta con peticiones en la cola: la siguiente
 * de su clave crearía otra cuenta, la clave iría dos veces en el mismo lote y
 * las dos cuentas repartirían posiciones con el mismo valor (429 de más).
 * Olvidar una cuenta solo puede dejar pasar de más, nunca rechazar de más; y
 * solo pasa con más de 10 000 claves vivas en la instancia. */
function hacerSitio(ahora: number): void {
  if (proceso.cuentas.size < TOPE_DE_CUENTAS_LOCALES) return;
  for (const [clave, cuenta] of proceso.cuentas) {
    if (
      cuenta.hasta <= ahora &&
      cuenta.bloqueadoHasta <= ahora &&
      !proceso.cola.has(cuenta)
    ) {
      proceso.cuentas.delete(clave);
    }
  }
  if (proceso.cuentas.size < TOPE_DE_CUENTAS_LOCALES) return;
  let sobran = Math.ceil(TOPE_DE_CUENTAS_LOCALES / 10);
  for (const [clave, cuenta] of proceso.cuentas) {
    if (sobran <= 0) break;
    if (proceso.cola.has(cuenta)) continue;
    proceso.cuentas.delete(clave);
    sobran -= 1;
  }
}

function avisarConFreno(
  tipo: string,
  mensaje: string,
  nivel: "warn" | "error" = "warn"
): void {
  const ahora = Date.now();
  const previo = proceso.avisos.get(tipo);
  if (previo && ahora - previo.en < FRENO_DE_LOGS_MS) {
    previo.omitidos += 1;
    return;
  }
  const omitidos = previo?.omitidos ?? 0;
  proceso.avisos.set(tipo, { en: ahora, omitidos: 0 });
  console[nivel](
    `${mensaje}${omitidos > 0 ? ` (+${omitidos} avisos iguales omitidos en el último minuto)` : ""}`
  );
}

/** Responde una sola vez. El callback del plugin solo resuelve o rechaza su
 * promesa; si alguna vez lanzara, no debe impedir responder a las demás. */
function responder(peticion: Peticion, resultado: Resultado): void {
  if (peticion.respondida) return;
  peticion.respondida = true;
  try {
    peticion.callback(null, resultado);
  } catch (err) {
    console.error(
      `[Límite] Error inesperado al responder al limitador: ${errorMessage(err)}`
    );
  }
}

/** Lo que la cuenta local sabe de la clave en la ventana, sin el global. */
function decididasEnLocal(cuenta: CuentaLocal): number {
  return cuenta.locales + cuenta.inciertos;
}

/** Decide con la cuenta local una petición que Postgres no contará
 * (`incierta`: o que puede haber contado). */
function decidirEnLocal(
  cuenta: CuentaLocal,
  peticion: Peticion,
  incierta = false
): void {
  const ahora = Date.now();
  renovarVentanaSiCaducada(cuenta, ahora);
  if (cuenta.bloqueadoHasta > ahora) {
    responder(peticion, {
      current: cuenta.max + 1,
      ttl: cuenta.bloqueadoHasta - ahora,
    });
    return;
  }
  if (incierta) cuenta.inciertos += 1;
  else cuenta.locales += 1;
  responder(peticion, {
    current: cuenta.global + cuenta.enVuelo + decididasEnLocal(cuenta),
    ttl: Math.max(0, cuenta.hasta - ahora),
  });
}

/**
 * ¿Prueba el error que la sentencia no se ejecutó? Solo si no hubo conexión:
 * no se pudo conectar (PrismaClientInitializationError, P1001) o no quedaba
 * una libre en el pool (P2024). Con cualquier otro, la sentencia ya había
 * salido y Postgres puede haberla ejecutado y confirmado aunque la respuesta
 * no llegara: P1017 (la conexión se cerró), P2010 «Timed out during query
 * execution» (un `socket_timeout`), un ECONNRESET… o el 57014 de un
 * `statement_timeout` (no se ejecutó, pero se trata igual: como mucho deja
 * pasar de más, nunca un 429 de más).
 */
function seguroQueNoSeEjecuto(err: unknown): boolean {
  const { name, code } = (err ?? {}) as { name?: unknown; code?: unknown };
  return (
    name === "PrismaClientInitializationError" ||
    code === "P1001" ||
    code === "P2024"
  );
}

function vaciarColaEnLocal(): void {
  const cola = [...proceso.cola];
  proceso.cola.clear();
  for (const [cuenta, peticiones] of cola) {
    for (const peticion of peticiones) decidirEnLocal(cuenta, peticion);
  }
}

/** ¿Se puede consultar la BD? Pasados los 30 s, la primera petición sale
 * como sonda, y lo que llega mientras está en vuelo espera en la cola detrás
 * de ella, como detrás de cualquier sentencia: si sale bien, va en la
 * siguiente; si falla o vence su plazo, `anotarFallo` lo decide en local. Así
 * la primera ráfaga después de un fallo cuenta en Postgres, aunque la
 * instancia haya pasado mucho tiempo sin tráfico con el estado aún «abierto».
 * Los cambios de estado se registran sin freno: son pocos. */
function cortacircuitosDejaPasar(ahora: number): boolean {
  if (proceso.cortacircuitos === "abierto") {
    if (ahora < proceso.abiertoHasta) return false;
    proceso.cortacircuitos = "sonda";
    console.warn(
      "[Límite] Cortacircuitos: pasaron 30 s; se prueba Postgres con una sonda"
    );
  }
  return true;
}

function anotarExito(): void {
  if (proceso.cortacircuitos !== "cerrado") {
    console.warn(
      "[Límite] Cortacircuitos cerrado: Postgres vuelve a contar las peticiones"
    );
  }
  proceso.cortacircuitos = "cerrado";
  proceso.fallosSeguidos = 0;
}

/** Un fallo es un error de Postgres o un plazo vencido. Al abrirse el
 * cortacircuitos, lo que esperaba en la cola se decide ya en local. */
function anotarFallo(ahora: number): void {
  if (proceso.cortacircuitos === "sonda") {
    proceso.cortacircuitos = "abierto";
    proceso.abiertoHasta = ahora + CORTACIRCUITOS_ABIERTO_MS;
    console.error(
      "[Límite] Cortacircuitos: la sonda falló o venció su plazo; otros 30 s con la cuenta local de esta instancia (si aun así vuelve bien antes de 1 s, se cierra)"
    );
  } else {
    proceso.fallosSeguidos += 1;
    if (proceso.fallosSeguidos < FALLOS_PARA_ABRIR) return;
    proceso.cortacircuitos = "abierto";
    proceso.abiertoHasta = ahora + CORTACIRCUITOS_ABIERTO_MS;
    console.error(
      `[Límite] Cortacircuitos abierto tras ${proceso.fallosSeguidos} fallos seguidos (errores de Postgres o plazos vencidos): 30 s con la cuenta local de esta instancia`
    );
  }
  vaciarColaEnLocal();
}

/** El cliente de la conexión propia del limitador (se crea con la primera
 * sentencia, y otra vez tras desecharlo). Sus dos plazos acotan la vida de
 * cada sentencia; `options` sustituye al de DATABASE_URL, si lo hubiera, solo
 * en esta conexión. `null` si ya hay más de `TOPE_DE_DESECHADAS_ABIERTAS`
 * conexiones desechadas por un plazo que se dan por abiertas: abrir otra
 * sumaría una conexión más en Postgres por cada episodio, sin tope. */
function conexionDelLimitador(ahora: number): PrismaClient | null {
  if (proceso.conexion) return proceso.conexion;
  proceso.desechadasAbiertas = proceso.desechadasAbiertas.filter(
    (en) => ahora - en < VIDA_SUPUESTA_DE_UNA_DESECHADA_MS
  );
  if (proceso.desechadasAbiertas.length > TOPE_DE_DESECHADAS_ABIERTAS) {
    return null;
  }
  proceso.conexion = crearClienteDeUnaConexion({
    socket_timeout: String(VIDA_EN_EL_CLIENTE_S),
    options: `-c statement_timeout=${VIDA_EN_POSTGRES_MS}`,
  });
  return proceso.conexion;
}

/** El limitador dejó de esperar la sentencia sin que Prisma la devolviera. */
class SentenciaAbandonada extends Error {
  readonly code = "ABANDONADA";
  constructor() {
    super(
      `la sentencia no volvió en ${ABANDONO_MS / 1_000} s y se da por perdida`
    );
  }
}

/** ¿Puede seguir abierta la conexión tras este error? Si el cliente dejó de
 * esperar la respuesta sin que la conexión se cerrara: el P2010 «Timed out
 * during query execution» del `socket_timeout`, o el abandono. */
function puedeSeguirAbierta(err: unknown): boolean {
  if (err instanceof SentenciaAbandonada) return true;
  const { code } = (err ?? {}) as { code?: unknown };
  return (
    code === "P2010" &&
    errorMessage(err).includes("Timed out during query execution")
  );
}

/** Tras un error de su sentencia, la conexión puede haberse quedado medio
 * abierta, y Prisma la seguiría usando: el cliente se desecha (sin esperar
 * a que se cierre) y la siguiente sentencia abre una conexión nueva, si no
 * hay ya demasiadas desechadas que se dan por abiertas. */
function desecharConexion(conexion: PrismaClient, motivo: unknown): void {
  if (proceso.conexion === conexion) proceso.conexion = null;
  if (puedeSeguirAbierta(motivo)) proceso.desechadasAbiertas.push(Date.now());
  avisarConFreno(
    "conexion",
    `[Límite] Se desecha la conexión del limitador tras un error de su sentencia (${errorMessage(motivo)}); la siguiente abre otra${puedeSeguirAbierta(motivo) ? ` (desechadas por un plazo en los últimos 15 min: ${proceso.desechadasAbiertas.length}; con más de ${TOPE_DE_DESECHADAS_ABIERTAS} no se abre otra)` : ""}`
  );
  conexion.$disconnect().catch((err: unknown) => {
    console.error(
      `[Límite] Error al cerrar la conexión desechada: ${errorMessage(err)}`
    );
  });
}

/**
 * Manda en UNA sentencia todo lo que espera en la cola, si no hay otra en
 * vuelo. Al acabar manda lo que se haya encolado mientras tanto.
 */
function enviar(): void {
  if (proceso.vuelo || proceso.cola.size === 0) return;
  const salida = Date.now();
  const conexion = conexionDelLimitador(salida);
  if (!conexion) {
    const hasta = new Date(
      proceso.desechadasAbiertas[0] + VIDA_SUPUESTA_DE_UNA_DESECHADA_MS
    );
    avisarConFreno(
      "sin-conexion",
      `[Límite] ${proceso.desechadasAbiertas.length} conexiones del limitador desechadas por un plazo en los últimos 15 min pueden seguir abiertas en Postgres; no se abre otra hasta ${hasta.toISOString()} y, mientras, se aplica la cuenta local`,
      "error"
    );
    vaciarColaEnLocal();
    return;
  }
  const lote: Array<[CuentaLocal, Peticion[]]> = [];
  for (const [cuenta, peticiones] of proceso.cola) {
    renovarVentanaSiCaducada(cuenta, salida);
    // La sentencia anterior dejó la clave pasada de `max`: «pasado» sin
    // contarlas, como las que llegan con el bloqueo ya puesto.
    if (cuenta.bloqueadoHasta > salida) {
      for (const peticion of peticiones) decidirEnLocal(cuenta, peticion);
      continue;
    }
    cuenta.enVuelo += peticiones.length;
    lote.push([cuenta, peticiones]);
  }
  proceso.cola.clear();
  if (lote.length === 0) return;

  const vuelo = {
    desde: salida,
    vencida: false,
    sonda: proceso.cortacircuitos === "sonda",
  };
  proceso.vuelo = vuelo;
  const temporizador = setTimeout(() => {
    vuelo.vencida = true;
    // Primero las de la sentencia (siguen en `enVuelo`: si acaba
    // ejecutándose, Postgres las cuenta) y luego la cola, en orden.
    const ahora = Date.now();
    for (const [cuenta, peticiones] of lote) {
      renovarVentanaSiCaducada(cuenta, ahora);
      peticiones.forEach((peticion, i) =>
        responder(peticion, {
          current: cuenta.global + decididasEnLocal(cuenta) + i + 1,
          ttl: Math.max(0, cuenta.hasta - ahora),
        })
      );
    }
    anotarFallo(ahora);
    avisarConFreno(
      "postgres",
      `[Límite] La sentencia de ${lote.length} claves no ha vuelto a tiempo (plazo de ${PLAZO_DE_CONSULTA_MS} ms vencido: Postgres o la red lentos); se aplica la cuenta local`
    );
    vaciarColaEnLocal();
  }, PLAZO_DE_CONSULTA_MS);

  // Lo que devuelva Prisma o, si no devuelve nada en ABANDONO_MS, el
  // abandono. Una respuesta posterior se descarta: sus peticiones ya van como
  // inciertas.
  const sentencia = new Promise<
    Awaited<ReturnType<typeof incrementarContadores>>
  >((resolve, reject) => {
    const abandono = setTimeout(
      () => reject(new SentenciaAbandonada()),
      ABANDONO_MS
    );
    incrementarContadores(
      lote.map(([cuenta, peticiones]) => ({
        clave: cuenta.clave,
        ventanaMs: cuenta.ventanaMs,
        cantidad: peticiones.length,
      })),
      conexion
    ).then(
      (resultados) => {
        clearTimeout(abandono);
        resolve(resultados);
      },
      (err: unknown) => {
        clearTimeout(abandono);
        reject(err);
      }
    );
  });
  sentencia
    .then(
      (resultados) => {
        const fin = Date.now();
        for (const [cuenta, peticiones] of lote) {
          cuenta.enVuelo = 0;
          const fila = resultados.get(cuenta.clave);
          if (!fila) {
            // Un INSERT … ON CONFLICT DO UPDATE sin WHERE siempre devuelve
            // la fila; si no, que decida la cuenta local.
            for (const peticion of peticiones) decidirEnLocal(cuenta, peticion);
            continue;
          }
          renovarVentanaSiCaducada(cuenta, fin);
          // Postgres midió el ttl al ejecutar la sentencia, después de su
          // salida: contado desde la salida, el fin de su ventana nunca queda
          // más tarde que el real aunque la respuesta llegue tarde.
          const finEnBd = vuelo.desde + fila.ttlMs;
          // Lo que esta instancia decidió en local en la ventana y Postgres no
          // contó: también suma en las posiciones, como habría sumado en INCR.
          let propias = 0;
          // Una respuesta de una ventana que ya acabó solo vale para sus
          // peticiones, no para las siguientes.
          if (finEnBd > fin) {
            cuenta.global = fila.valor;
            // Con decisiones locales la ventana no se alarga: caducan con la
            // ventana en que se tomaron, no con otra que Postgres abrió
            // después.
            cuenta.hasta =
              cuenta.locales > 0 ? Math.min(cuenta.hasta, finEnBd) : finEnBd;
            propias = cuenta.locales;
            // Las inciertas no: si Postgres las ejecutó, ya van en el valor.
            cuenta.inciertos = 0;
            if (fila.valor + propias > cuenta.max) {
              cuenta.bloqueadoHasta = cuenta.hasta;
            }
          }
          peticiones.forEach((peticion, i) =>
            responder(peticion, {
              current: fila.valor - peticiones.length + i + 1 + propias,
              ttl: fila.ttlMs,
            })
          );
        }
        // Un éxito que llega después del plazo no cierra el cortacircuitos:
        // con la BD lenta, cada consulta vencería y luego «saldría bien». La
        // sonda, sí, si vuelve antes de 2 plazos: tras 30 s sin usarse, la
        // conexión hace 2 viajes (Prisma comprueba antes una conexión
        // inactiva) o 6 si es nueva, y con viajes de más de 250 ms vencería
        // en cada ciclo aunque una sentencia normal cupiera en el plazo. Sus
        // peticiones ya se decidieron en local: no esperan más.
        if (
          !vuelo.vencida ||
          (vuelo.sonda && fin - vuelo.desde < 2 * PLAZO_DE_CONSULTA_MS)
        ) {
          anotarExito();
        }
      },
      (err: unknown) => {
        desecharConexion(conexion, err);
        const noSeEjecuto = seguroQueNoSeEjecuto(err);
        if (vuelo.vencida) {
          // Ya respondidas en local; siguen sumando como seguras o como
          // inciertas.
          for (const [cuenta] of lote) {
            if (noSeEjecuto) cuenta.locales += cuenta.enVuelo;
            else cuenta.inciertos += cuenta.enVuelo;
            cuenta.enVuelo = 0;
          }
          return;
        }
        // Primero las de la sentencia; al abrirse el cortacircuitos,
        // anotarFallo decide también la cola.
        for (const [cuenta, peticiones] of lote) {
          cuenta.enVuelo = 0;
          for (const peticion of peticiones) {
            decidirEnLocal(cuenta, peticion, !noSeEjecuto);
          }
        }
        anotarFallo(Date.now());
        avisarConFreno(
          "postgres",
          noSeEjecuto
            ? `[Límite] Postgres no contó ${lote.length} claves (${errorMessage(err)}); se aplica la cuenta local`
            : `[Límite] No se sabe si Postgres contó ${lote.length} claves (${errorMessage(err)}); se aplica la cuenta local hasta que Postgres vuelva a dar su valor`
        );
      }
    )
    .finally(() => {
      clearTimeout(temporizador);
      if (proceso.vuelo === vuelo) proceso.vuelo = null;
      enviar();
    })
    // Solo ante un error de programación en los dos manejadores de arriba:
    // una promesa rechazada sin capturar tumbaría el proceso entero.
    .catch((err: unknown) => {
      console.error(`[Límite] Error inesperado: ${errorMessage(err)}`);
    });
}

export class AlmacenDeLimites implements FastifyRateLimitStore {
  private readonly prefijo: string;

  /** @fastify/rate-limit construye el almacén raíz con `new Store(opciones)`;
   * el prefijo solo lo pasa `child()`. */
  constructor(_opciones?: unknown, prefijo: string = PREFIJO_POR_DEFECTO) {
    this.prefijo = prefijo;
  }

  incr(
    clave: string,
    callback: Callback,
    ventanaMs: number,
    max: number
  ): void {
    const ahora = Date.now();
    const cuenta = obtenerCuenta(
      `${this.prefijo}${clave}`,
      ventanaMs,
      max,
      ahora
    );
    const peticion: Peticion = { callback, respondida: false };

    if (cuenta.bloqueadoHasta > ahora) {
      decidirEnLocal(cuenta, peticion);
      return;
    }
    // La sentencia en vuelo va antes que el cortacircuitos: la transición a
    // «sonda» solo ocurre cuando de verdad se puede mandar la sonda.
    if (proceso.vuelo?.vencida) {
      avisarConFreno(
        "en-vuelo",
        `[Límite] La consulta del limitador lleva ${ahora - proceso.vuelo.desde} ms en vuelo sin volver; ${cuenta.clave} y las demás se deciden con la cuenta local hasta que vuelva`,
        "error"
      );
      decidirEnLocal(cuenta, peticion);
      return;
    }
    if (!cortacircuitosDejaPasar(ahora)) {
      avisarConFreno(
        "cortacircuitos",
        `[Límite] Cortacircuitos abierto; ${cuenta.clave} se decide con la cuenta local`
      );
      decidirEnLocal(cuenta, peticion);
      return;
    }
    const enCola = proceso.cola.get(cuenta);
    if (enCola) enCola.push(peticion);
    else proceso.cola.set(cuenta, [peticion]);
    enviar();
  }

  /** Mismo formato de prefijo que el RedisStore de @fastify/rate-limit:
   * `${prefijo}${método}${url}-`. El plugin pasa la ruta en `routeInfo`. */
  child(
    opcionesDeRuta: RouteOptions & { path: string; prefix: string }
  ): FastifyRateLimitStore {
    const { routeInfo } = opcionesDeRuta as unknown as {
      routeInfo?: { method?: unknown; url?: unknown };
    };
    return new AlmacenDeLimites(
      undefined,
      `${this.prefijo}${String(routeInfo?.method)}${String(routeInfo?.url)}-`
    );
  }
}

/** Cierra la conexión propia del limitador (al apagar; la siguiente
 * sentencia abriría otra). Espera como mucho `ESPERA_AL_CERRAR_MS`: con la
 * conexión congelada, el `$disconnect` de Prisma no resuelve mientras su
 * sentencia sigue en vuelo (hasta el P2010 del `socket_timeout`, o nunca si
 * es la del PREPARE), y el apagado de server.ts acabaría forzado a los 8 s,
 * con código 1, sin cerrar el pool de `prisma`. */
export async function cerrarConexionDelLimitador(): Promise<void> {
  const conexion = proceso.conexion;
  proceso.conexion = null;
  if (!conexion) return;
  let temporizador: NodeJS.Timeout | undefined;
  const plazo = new Promise<"plazo">((resolve) => {
    temporizador = setTimeout(() => resolve("plazo"), ESPERA_AL_CERRAR_MS);
    temporizador.unref?.();
  });
  try {
    const resultado = await Promise.race([conexion.$disconnect(), plazo]);
    if (resultado === "plazo") {
      console.warn(
        `[Límite] La conexión del limitador no se cerró en ${ESPERA_AL_CERRAR_MS} ms (¿congelada con una sentencia en vuelo?); se sigue sin esperarla`
      );
    }
  } finally {
    clearTimeout(temporizador);
  }
}

// ── Solo para los tests: el estado es del módulo (uno por proceso). ──

/** Cuentas, cola, sentencia en vuelo, conexiones desechadas, cortacircuitos
 * y freno de logs a cero (la conexión propia se mantiene). */
export function reiniciarEstadoDeLimitesParaTests(): void {
  proceso.cuentas.clear();
  proceso.cola.clear();
  proceso.vuelo = null;
  proceso.desechadasAbiertas = [];
  proceso.fallosSeguidos = 0;
  proceso.cortacircuitos = "cerrado";
  proceso.abiertoHasta = 0;
  proceso.avisos.clear();
}

/** 1 si hay una sentencia del limitador en vuelo, 0 si no. */
export function consultasDeLimitesEnVueloParaTests(): number {
  return proceso.vuelo ? 1 : 0;
}

/** Cuántas claves recuerda la instancia. */
export function cuentasLocalesParaTests(): number {
  return proceso.cuentas.size;
}
