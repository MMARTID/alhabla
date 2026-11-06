import { randomUUID } from "node:crypto";
import pg from "./pg.js";

/**
 * Llamadas simuladas en la BD de dev (la URL ya viene comprobada como local
 * por entorno.ts). Son las únicas escrituras del MCP.
 *
 * `/webhooks/telnyx/tools/:toolName` resuelve el negocio SOLO por la cabecera
 * `x-alhabla-call-control-id` → fila de `calls` (sin fila, 404), así que
 * probar una tool sin llamar de verdad exige una fila de ese negocio.
 *
 * Una por conversación, nunca reutilizada entre pruebas: `bookings.callId`
 * es único (una cita por llamada), y una llamada simulada compartida hacía
 * fallar el segundo `book_appointment`. Para seguir la MISMA conversación
 * (check_availability y luego book_appointment) se pasa su callId.
 *
 * El `callId` empieza por `sim-mcp-` para reconocerlas y borrarlas.
 */
export const PREFIJO_DE_LLAMADA_SIMULADA = "sim-mcp-";

export async function crearLlamadaSimulada(
  urlDeBdDeDev: string,
  businessId: string,
  telefonoCliente?: string
): Promise<string> {
  const callId = `${PREFIJO_DE_LLAMADA_SIMULADA}${randomUUID()}`;
  const cliente = new pg.Client({ connectionString: urlDeBdDeDev });
  await cliente.connect();
  try {
    const negocio = await cliente.query(
      "SELECT 1 FROM businesses WHERE id = $1",
      [businessId]
    );
    if (negocio.rowCount === 0) {
      throw new Error(`[MCP] No existe el negocio ${businessId} en la BD de dev`);
    }
    await cliente.query(
      `INSERT INTO calls (id, "businessId", "callId", "fromNumber", "voiceProvider", "updatedAt")
       VALUES ($1, $2, $3, $4, 'telnyx', now())`,
      [`sim_${randomUUID()}`, businessId, callId, telefonoCliente ?? null]
    );
    return callId;
  } finally {
    await cliente.end();
  }
}

export type CitaConservada = {
  callId: string;
  bookingId: string;
  programedAt: string;
};

/**
 * Los eventos que crea el calendario falso de backend-sim
 * (src/adapters/calendar/falso/calendarioFalso.ts) llevan este prefijo, y
 * ningún adaptador real lo usa: Google y Outlook derivan el id del digest en
 * hexadecimal o los da el proveedor, y CalDAV termina en `@…`.
 */
export const PREFIJO_DE_EVENTO_FALSO = "falso";
const CLAVES_DEL_CALENDARIO_FALSO = "calendario-falso:%";

/**
 * Borra las llamadas simuladas (y en cascada sus transcripciones, citas…)
 * para que no se mezclen con las reales en el historial del panel de dev.
 *
 * Se CONSERVAN las que tienen una cita viva que llegó a un calendario REAL
 * (`externalEventId` y sin cancelar): borrar la fila dejaría el evento
 * huérfano en el calendario del negocio. Se devuelven para cancelarlas antes
 * (cancel_appointment simulada o desde el panel) y volver a limpiar.
 *
 * Las del calendario falso sí se borran, y sus eventos salen del almacén del
 * calendario falso (`claves_temporales`, `calendario-falso:<marca>`) en la
 * misma transacción, para que agenda_dev no enseñe copias de citas que ya no
 * existen. Los apuntados «a mano» y los de otras citas se quedan.
 */
export async function borrarLlamadasSimuladas(
  urlDeBdDeDev: string,
  businessId?: string
): Promise<{
  borradas: number;
  conservadas: CitaConservada[];
  eventosFalsosBorrados: number;
}> {
  const cliente = new pg.Client({ connectionString: urlDeBdDeDev });
  await cliente.connect();
  const filtro = [
    `${PREFIJO_DE_LLAMADA_SIMULADA}%`,
    businessId ?? null,
    `${PREFIJO_DE_EVENTO_FALSO}%`,
  ];
  try {
    await cliente.query("BEGIN");
    const conservadas = await cliente.query<{
      callId: string;
      bookingId: string;
      programedAt: Date;
    }>(
      `SELECT c."callId", b.id AS "bookingId", b."programedAt"
         FROM calls c
         JOIN bookings b ON b."callId" = c.id
        WHERE c."callId" LIKE $1
          AND ($2::text IS NULL OR c."businessId" = $2)
          AND b."isCancelled" = false
          AND b."externalEventId" IS NOT NULL
          AND b."externalEventId" NOT LIKE $3
        ORDER BY b."programedAt"`,
      filtro
    );
    // Los eventos falsos de las citas que se van a borrar (vivas o no: quitar
    // uno que ya no está no hace nada), antes de que se vayan en cascada.
    const eventosFalsos = await cliente.query<{ externalEventId: string }>(
      `SELECT b."externalEventId"
         FROM calls c
         JOIN bookings b ON b."callId" = c.id
        WHERE c."callId" LIKE $1
          AND ($2::text IS NULL OR c."businessId" = $2)
          AND b."externalEventId" LIKE $3
          AND NOT EXISTS (
            SELECT 1 FROM bookings v
             WHERE v."callId" = c.id
               AND v."isCancelled" = false
               AND v."externalEventId" IS NOT NULL
               AND v."externalEventId" NOT LIKE $3
          )`,
      filtro
    );
    const borradas = await cliente.query(
      `DELETE FROM calls c
        WHERE c."callId" LIKE $1
          AND ($2::text IS NULL OR c."businessId" = $2)
          AND NOT EXISTS (
            SELECT 1 FROM bookings b
             WHERE b."callId" = c.id
               AND b."isCancelled" = false
               AND b."externalEventId" IS NOT NULL
               AND b."externalEventId" NOT LIKE $3
          )`,
      filtro
    );
    const eventosFalsosBorrados = await quitarDelCalendarioFalso(
      cliente,
      new Set(eventosFalsos.rows.map((fila) => fila.externalEventId))
    );
    await cliente.query("COMMIT");
    return {
      borradas: borradas.rowCount ?? 0,
      conservadas: conservadas.rows.map((fila) => ({
        callId: fila.callId,
        bookingId: fila.bookingId,
        programedAt: fila.programedAt.toISOString(),
      })),
      eventosFalsosBorrados,
    };
  } catch (error) {
    await cliente.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await cliente.end();
  }
}

/**
 * Quita esos ids de todos los calendarios falsos (cada evento lleva el
 * digest de su cita, así que solo puede estar en el del negocio). El valor
 * es un texto JSON guardado como jsonb (almacenTemporal.ts), y la caducidad
 * no se toca. Devuelve cuántos eventos quitó.
 */
async function quitarDelCalendarioFalso(
  cliente: InstanceType<typeof pg.Client>,
  ids: Set<string>
): Promise<number> {
  if (ids.size === 0) return 0;
  const calendarios = await cliente.query<{
    clave: string;
    valor: string | null;
  }>(
    `SELECT "clave", "valor" #>> '{}' AS "valor"
       FROM "claves_temporales"
      WHERE "clave" LIKE $1
      FOR UPDATE`,
    [CLAVES_DEL_CALENDARIO_FALSO]
  );
  let quitados = 0;
  for (const { clave, valor } of calendarios.rows) {
    if (!valor) continue;
    let calendario: { eventos?: { id: string }[] };
    try {
      calendario = JSON.parse(valor);
    } catch {
      console.error(`[MCP] Calendario falso ilegible en ${clave}: no se toca`);
      continue;
    }
    const eventos = calendario.eventos ?? [];
    const quedan = eventos.filter((evento) => !ids.has(evento.id));
    if (quedan.length === eventos.length) continue;
    quitados += eventos.length - quedan.length;
    await cliente.query(
      `UPDATE "claves_temporales" SET "valor" = to_jsonb($2::text) WHERE "clave" = $1`,
      [clave, JSON.stringify({ ...calendario, eventos: quedan })]
    );
  }
  return quitados;
}
