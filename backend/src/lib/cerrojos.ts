import { randomBytes } from "node:crypto";
import { prisma } from "./prisma.js";
import { errorMessage } from "./logUtils.js";

/**
 * Arrendamientos de exclusión mutua en Postgres (tabla `cerrojos`), en lugar
 * del SET NX PX + compare-and-delete de Redis.
 *
 * Cada sentencia va en autocommit con `now()` de la BD: nunca se abre una
 * transacción interactiva mientras dura la sección crítica (que puede incluir
 * llamadas HTTP de ~30 s a un calendario), y la caducidad no depende del
 * reloj de ninguna instancia. El `INSERT … ON CONFLICT DO UPDATE … WHERE`
 * bloquea la fila y reevalúa el WHERE sobre la versión confirmada, así que
 * con dos adquisiciones a la vez nunca ganan las dos.
 */

export type ResultadoDeCerrojo =
  | { estado: "adquirido"; token: string }
  | { estado: "ocupado" }
  | { estado: "error"; motivo: string };

const ESPERA_ENTRE_INTENTOS_MS = 300;

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nuevoToken(): string {
  return `${Date.now()}-${randomBytes(12).toString("base64url")}`;
}

function codigoDe(err: unknown): { nombre: unknown; codigo: unknown } {
  const e = err as {
    name?: unknown;
    code?: unknown;
    errorCode?: unknown;
  } | null;
  return { nombre: e?.name, codigo: e?.code ?? e?.errorCode };
}

/**
 * Errores de Prisma que prueban que la sentencia no llegó a Postgres: no se
 * pudo conectar (PrismaClientInitializationError, a veces sin código; P1001,
 * P1002) o el pool siguió lleno hasta su `pool_timeout` (P2024).
 */
function noLlegoAPostgres(err: unknown): boolean {
  const { nombre, codigo } = codigoDe(err);
  return (
    nombre === "PrismaClientInitializationError" ||
    (typeof codigo === "string" && ["P1001", "P1002", "P2024"].includes(codigo))
  );
}

/**
 * Errores de conexión, que se reintentan dentro del presupuesto como absorbía
 * un corte breve la cola offline de ioredis antes del corte: los de
 * `noLlegoAPostgres` y P1017 (el servidor cerró la conexión). Un P1017 NO
 * prueba que la sentencia no se ejecutara: Postgres pudo confirmar el INSERT
 * y cerrarse la conexión antes de que llegara la respuesta, con la fila a
 * nombre de un token que nadie tiene. Por eso adquirirCerrojo borra esa fila
 * (best-effort) antes de reintentar, como tras cualquier error que no pruebe
 * que la sentencia no se ejecutó.
 *
 * Medido con Prisma 6.19: tras un P1017, las consultas con parámetros siguen
 * dando P1017 por esa conexión unos 15 s antes de que el pool la cambie, así
 * que ese caso agota el presupuesto de las reservas (6 s) y falla cerrado;
 * uno de 25 s (los chats de WhatsApp) sí lo cubre.
 */
function esErrorDeConexion(err: unknown): boolean {
  return noLlegoAPostgres(err) || codigoDe(err).codigo === "P1017";
}

/** El arrendamiento empieza en el `now()` de la sentencia, que es posterior a
 * `salida`: le quedan al menos `ttlMs - (Date.now() - salida)`. Si la
 * respuesta tardó `TARDANZA_MAXIMA_MS` o la mitad del TTL (lo que sea menos),
 * no se da por bueno: quien llama tiene al menos TTL − 12 s, o medio TTL con
 * un TTL de menos de 24 s. Las secciones críticas se dimensionaron con el TTL
 * entero (las reservas, 45 s para una sección de hasta ~32 s con Outlook):
 * con medio TTL, una respuesta de 14 s (un corte breve de red y el backoff
 * de retransmisión de TCP) dejaría 31 s y otro llamador entraría con el
 * primero aún dentro. El tope queda por encima del `pool_timeout` (10 s):
 * la espera del pool, por sí sola, nunca hace rechazar un arrendamiento. */
const TARDANZA_MAXIMA_MS = 12_000;
function llegoTarde(salida: number, ttlMs: number): number | null {
  const tardanza = Date.now() - salida;
  return tardanza >= Math.min(ttlMs / 2, TARDANZA_MAXIMA_MS) ? tardanza : null;
}

type IntentoEnPostgres =
  | { estado: "concedido" | "ocupado" }
  /** No concluyente: se puede reintentar con otro token. */
  | { estado: "inconcluso"; motivo: string; filaIncierta: boolean }
  | { estado: "error"; motivo: string; filaIncierta: boolean };

/** Nunca lanza. Si Postgres concedió el intento pero llegó tarde, borra la
 * fila propia. `filaIncierta`: la sentencia falló sin que se sepa si Postgres
 * la confirmó, así que puede haber una fila con este token. */
async function intentarEnPostgres(
  clave: string,
  token: string,
  ttlMs: number
): Promise<IntentoEnPostgres> {
  const salida = Date.now();
  let filas: { token: string }[];
  try {
    filas = await prisma.$queryRaw<{ token: string }[]>`
      INSERT INTO "cerrojos" AS c ("clave", "token", "expiraEn")
      VALUES (${clave}, ${token},
        now() + ${ttlMs}::int * interval '1 millisecond')
      ON CONFLICT ("clave") DO UPDATE
        SET "token" = EXCLUDED."token", "expiraEn" = EXCLUDED."expiraEn"
        WHERE c."expiraEn" <= now()
      RETURNING "token"`;
  } catch (err) {
    const motivo = errorMessage(err);
    const filaIncierta = !noLlegoAPostgres(err);
    if (!esErrorDeConexion(err)) {
      return { estado: "error", motivo, filaIncierta };
    }
    return {
      estado: "inconcluso",
      motivo: `sin conexión con Postgres: ${motivo}`,
      filaIncierta,
    };
  }
  if (filas.length === 0) return { estado: "ocupado" };
  const tardanza = llegoTarde(salida, ttlMs);
  if (tardanza !== null) {
    await borrarSinLanzar(clave, token);
    return {
      estado: "inconcluso",
      motivo: `Postgres tardó ${tardanza} ms en confirmar un arrendamiento de ${ttlMs} ms`,
      filaIncierta: false,
    };
  }
  return { estado: "concedido" };
}

async function borrarEnPostgres(clave: string, token: string): Promise<void> {
  await prisma.$executeRaw`
    DELETE FROM "cerrojos" WHERE "clave" = ${clave} AND "token" = ${token}`;
}

/** Borra la fila propia de un intento que no se concede, para no bloquear a
 * nadie hasta su caducidad. Si falla, se queda ocupada hasta entonces (con
 * log) y devuelve false. */
async function borrarSinLanzar(clave: string, token: string): Promise<boolean> {
  try {
    await borrarEnPostgres(clave, token);
    return true;
  } catch (err) {
    console.error(
      `[Cerrojo] No se pudo borrar la fila propia de ${clave} de un intento no concedido (quedará ocupado hasta que caduque): ${errorMessage(err)}`
    );
    return false;
  }
}

/** Borra (best-effort) las filas que pudieron quedar a nombre de los tokens
 * de `inciertos`, y deja en la lista solo los que no se pudieron borrar. */
async function borrarInciertos(
  clave: string,
  inciertos: string[]
): Promise<void> {
  for (const token of inciertos.splice(0)) {
    if (!(await borrarSinLanzar(clave, token))) inciertos.push(token);
  }
}

/**
 * Intenta coger el cerrojo hasta agotar `presupuestoMs` (plazo de reloj
 * local), con una espera de 300 ms entre intentos. El plazo se comprueba
 * DESPUÉS de cada intento: con presupuesto 0 se hace exactamente uno. Cada
 * intento lleva un token nuevo: el borrado de la fila de un intento
 * anterior nunca puede borrar el cerrojo que coja uno posterior. Si la
 * sentencia de un intento falla sin probar que no se ejecutó (un P1017, por
 * ejemplo), Postgres pudo confirmarla: la fila de ese token se borra antes del siguiente intento y
 * antes de rendirse; si no se puede, queda ocupada hasta que caduque, con
 * log.
 *
 * - `adquirido`: con el token propio, para liberar solo lo nuestro.
 * - `ocupado`: el último intento lo encontró cogido (por otro, o por la fila
 *   de un intento propio incierto que no se pudo borrar).
 * - `error`: la sentencia falló con un error que no es de conexión (en el
 *   acto, sin reintentar), o ningún intento fue concluyente en todo el
 *   presupuesto: sin conexión con Postgres o una respuesta que tardó 12 s o
 *   medio TTL (`llegoTarde`). Falla cerrado: quien llama no entra en la
 *   sección crítica. Un corte breve (una conexión del pool que se cerró)
 *   cabe en el presupuesto de las reservas (6 s) y no llega a fallar; con
 *   presupuesto 0 sí falla en el acto.
 *
 * El presupuesto no acota la espera de un intento: cada uno pide conexión al
 * pool de Prisma (`connection_limit=2` por instancia, AGENTS.md) y, con el
 * pool lleno, espera hasta su `pool_timeout` (10 s por defecto) aunque el
 * presupuesto sea 0. Y si la conexión que le toca está medio abierta (un
 * agujero negro en ella, con Postgres sano), el intento no vuelve, como
 * cualquier otra consulta de la app: el pool de `prisma` no lleva
 * `socket_timeout` (solo la conexión del limitador,
 * lib/limitesDePeticiones.ts). Sigue fallando cerrado (no concede, y una
 * respuesta que llegue tarde la rechaza `llegoTarde`), pero quien llama se
 * queda esperando.
 */
export async function adquirirCerrojo(
  clave: string,
  ttlMs: number,
  presupuestoMs: number
): Promise<ResultadoDeCerrojo> {
  const plazo = Date.now() + presupuestoMs;
  // Tokens de intentos cuya sentencia pudo confirmarse sin que llegara la
  // respuesta y cuya fila aún no se ha podido borrar.
  const inciertos: string[] = [];

  for (;;) {
    const token = nuevoToken();
    // Por qué el último intento no fue concluyente.
    let inconcluso: string | null = null;

    // Antes de reintentar: si no, la fila de un intento incierto que
    // Postgres sí confirmó dejaría este intento en «ocupado».
    await borrarInciertos(clave, inciertos);
    const enPostgres = await intentarEnPostgres(clave, token, ttlMs);
    if ("filaIncierta" in enPostgres && enPostgres.filaIncierta) {
      inciertos.push(token);
    }
    if (enPostgres.estado === "error") {
      await borrarInciertos(clave, inciertos);
      console.error(
        `[Cerrojo] No se pudo coger ${clave}: ${enPostgres.motivo}`
      );
      return { estado: "error", motivo: enPostgres.motivo };
    }
    if (enPostgres.estado === "concedido")
      return { estado: "adquirido", token };
    if (enPostgres.estado === "inconcluso") inconcluso = enPostgres.motivo;

    if (Date.now() >= plazo) {
      await borrarInciertos(clave, inciertos);
      if (inconcluso) {
        console.error(
          `[Cerrojo] No se pudo coger ${clave}: ${inconcluso}; falla cerrado`
        );
        return { estado: "error", motivo: inconcluso };
      }
      return { estado: "ocupado" };
    }
    await esperar(ESPERA_ENTRE_INTENTOS_MS);
  }
}

/**
 * Compare-and-delete: solo borra el cerrojo si sigue siendo nuestro, para no
 * soltar el de otro poseedor si el nuestro ya caducó y alguien lo cogió.
 * Nunca lanza: un fallo deja el cerrojo ocupado hasta que caduque, con log.
 */
export async function liberarCerrojo(
  clave: string,
  token: string
): Promise<void> {
  try {
    await borrarEnPostgres(clave, token);
  } catch (err) {
    console.error(
      `[Cerrojo] Error liberando ${clave} (quedará ocupado hasta que caduque): ${errorMessage(err)}`
    );
  }
}
