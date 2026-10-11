import { adquirirCerrojo, liberarCerrojo } from "./cerrojos.js";

/** Primitiva genérica de lock distribuido. Desde el corte de Redis (PR A)
 * es un envoltorio de lib/cerrojos.ts: un arrendamiento en Postgres (más el
 * mismo cerrojo en Redis mientras la revisión tenga `REDIS_URL`, para
 * excluir a las revisiones viejas). Reintenta con una espera corta contra un
 * PLAZO DE RELOJ real (no un nº fijo de intentos) y devuelve un token propio
 * de esta adquisición —para poder liberar solo el lock propio, nunca el de
 * otro poseedor— o null si no se consiguió dentro del presupuesto.
 *
 * null cubre dos casos: ocupado (otro lo tiene) y error (el almacén no
 * respondió; falla cerrado, con el log verdadero en lib/cerrojos.ts). Quien
 * necesite distinguirlos usa `adquirirCerrojo` de lib/cerrojos.ts.
 *
 * El plazo se comprueba DESPUÉS de cada intento, no antes — así
 * acquireBudgetMs=0 sigue intentando una vez (nunca cero intentos) pero no
 * malgasta una espera final antes de rendirse, dando un "solo un intento, sin
 * reintentos" limpio para llamadas que no quieren esperar (ver
 * provisionPhoneNumber en phone/service.ts, que necesita fallar rápido y
 * dejar que la otra ejecución concurrente termine de resolverlo). «Rápido»
 * con un matiz: cada intento pide conexión al pool de Prisma y, con el pool
 * lleno, espera hasta su `pool_timeout` (10 s por defecto) aunque el
 * presupuesto sea 0 (con Redis esperaba hasta su `commandTimeout` de 3 s);
 * y si la conexión que le toca está medio abierta, no vuelve, como
 * cualquier otra consulta de la app (lib/cerrojos.ts). */
export async function acquireLock(
  key: string,
  ttlMs: number,
  acquireBudgetMs: number
): Promise<string | null> {
  const resultado = await adquirirCerrojo(key, ttlMs, acquireBudgetMs);
  return resultado.estado === "adquirido" ? resultado.token : null;
}

/** Libera el lock solo si sigue siendo el nuestro (compare-and-delete por
 * token) — evita borrar el lock de OTRO poseedor si el nuestro ya expiró por
 * TTL mientras tanto (Cloud Run especialmente lento, un proveedor externo
 * caído, etc.) y, mientras tanto, un tercero ya adquirió el mismo lock. Un
 * simple borrado incondicional (el diseño original de phone/service.ts) no
 * distingue esto: si el TTL expiraba antes de que el poseedor original
 * terminara, su propio `finally` podía borrar el lock de quien lo hubiera
 * adquirido después, dejando la sección crítica sin protección real. Nunca
 * lanza. */
export async function releaseLock(key: string, token: string): Promise<void> {
  return liberarCerrojo(key, token);
}

// Sin este lock, dos reservas simultáneas para el mismo negocio (dos
// llamadas a la vez, o una llamada en vivo y el job de reintento en segundo
// plano) pueden comprobar disponibilidad para el mismo hueco ANTES de que
// ninguna haya guardado su reserva — ambas la ven libre, ambas crean el
// evento en el calendario y ambas confirman, superando la capacidad
// configurada (o duplicando la cita del mismo profesional). Serializa por
// negocio, no por hueco: un negocio pequeño no tiene concurrencia real más
// allá de "dos clientes llamando a la vez", así que basta con no dejar
// avanzar dos reservas del mismo negocio al mismo tiempo por su sección
// crítica (disponibilidad + creación del evento + upsert local).
//
// El lock NO es reentrante: quien ya lo tiene y vuelve a pedirlo para el
// mismo negocio espera como cualquier otro hasta agotar su presupuesto (y
// devuelve null). mover_cita del Gestor depende de no volver a cogerlo:
// moverReserva (gestor/accionesAgenda.ts) lo coge una sola vez, y sus
// llamadores (el Gestor y el panel) no lo tienen cogido al llamarlo (test
// de integración «no se bloquea a sí misma»). Anidar otra clave sí vale:
// lock:gestor:accion:<biz> → booking_lock:<biz>.
//
// Vive en lib/, no en modules/voiceTools/, para que jobs/retryFailedBooking.ts
// pueda reutilizarlo sin crear un import circular con lib/cloudTasks.ts
// (que a su vez importa jobs/retryFailedBooking.ts).

// La sección crítica que este lock protege puede incluir, para un negocio
// con Outlook, hasta 4 llamadas de red secuenciales capadas cada una a
// GRAPH_REQUEST_TIMEOUT_MS=8000 (refreshMicrosoftAccessToken +
// listMicrosoftBusyIntervals en fetchExternalBusyIntervals, y otra vez
// refreshMicrosoftAccessToken + createMicrosoftCalendarEvent dentro de
// bookAppointment) — hasta ~32s en el peor caso. Un TTL de 15s (el valor
// original) podía expirar a mitad de esa sección, dejando el lock libre
// para que una segunda reserva concurrente entrara y recreara exactamente
// la doble reserva que este lock existe para impedir (hallazgo de la
// revisión posterior a la auditoría). 45s deja margen de sobra.
const BOOKING_LOCK_TTL_MS = 45_000;
const BOOKING_LOCK_ACQUIRE_BUDGET_MS = 6_000;

// La misma clave que usaban las revisiones anteriores al corte en Redis: en
// modo compatibilidad las dos se excluyen porque cogen la misma clave.
function getBookingLockKey(businessId: string): string {
  return `booking_lock:${businessId}`;
}

export async function acquireBookingLock(
  businessId: string
): Promise<string | null> {
  return acquireLock(
    getBookingLockKey(businessId),
    BOOKING_LOCK_TTL_MS,
    BOOKING_LOCK_ACQUIRE_BUDGET_MS
  );
}

export async function releaseBookingLock(
  businessId: string,
  token: string
): Promise<void> {
  return releaseLock(getBookingLockKey(businessId), token);
}
