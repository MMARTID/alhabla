import { randomUUID } from "node:crypto";
import pg from "pg";

/**
 * `/webhooks/telnyx/tools/:toolName` resuelve el negocio SOLO por la cabecera
 * `x-alhabla-call-control-id` → fila de `calls` (sin fila, 404). Para probar
 * una tool sin llamar de verdad hace falta una fila de ese negocio: esta la
 * crea, o reutiliza la que ya exista para el mismo negocio y teléfono.
 *
 * Es la única escritura del MCP, y solo en la BD de dev (la URL ya viene
 * comprobada como local por entorno.ts). El `callId` empieza por `sim-mcp-`
 * para reconocerlas y borrarlas a mano.
 */
export async function llamadaSimulada(
  urlDeBdDeDev: string,
  businessId: string,
  telefonoCliente?: string
): Promise<{ callId: string; creada: boolean }> {
  const sufijo = telefonoCliente ? telefonoCliente.replace(/\D/g, "") : "anonimo";
  const callId = `sim-mcp-${businessId}-${sufijo}`;

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

    const insercion = await cliente.query(
      `INSERT INTO calls (id, "businessId", "callId", "fromNumber", "voiceProvider", "updatedAt")
       VALUES ($1, $2, $3, $4, 'telnyx', now())
       ON CONFLICT ("callId") DO NOTHING`,
      [`sim_${randomUUID()}`, businessId, callId, telefonoCliente ?? null]
    );
    return { callId, creada: insercion.rowCount === 1 };
  } finally {
    await cliente.end();
  }
}
