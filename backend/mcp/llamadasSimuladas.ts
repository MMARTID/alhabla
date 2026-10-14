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
 * Borra las llamadas simuladas (y en cascada sus transcripciones, citas…)
 * para que no se mezclen con las reales en el historial del panel de dev.
 *
 * Se CONSERVAN las que tienen una cita viva que llegó al calendario
 * (`externalEventId` y sin cancelar): borrar la fila dejaría el evento
 * huérfano en el calendario real del negocio. Se devuelven para cancelarlas
 * antes (cancel_appointment simulada o desde el panel) y volver a limpiar.
 */
export async function borrarLlamadasSimuladas(
  urlDeBdDeDev: string,
  businessId?: string
): Promise<{ borradas: number; conservadas: CitaConservada[] }> {
  const cliente = new pg.Client({ connectionString: urlDeBdDeDev });
  await cliente.connect();
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
        ORDER BY b."programedAt"`,
      [`${PREFIJO_DE_LLAMADA_SIMULADA}%`, businessId ?? null]
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
          )`,
      [`${PREFIJO_DE_LLAMADA_SIMULADA}%`, businessId ?? null]
    );
    await cliente.query("COMMIT");
    return {
      borradas: borradas.rowCount ?? 0,
      conservadas: conservadas.rows.map((fila) => ({
        callId: fila.callId,
        bookingId: fila.bookingId,
        programedAt: fila.programedAt.toISOString(),
      })),
    };
  } catch (error) {
    await cliente.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await cliente.end();
  }
}
