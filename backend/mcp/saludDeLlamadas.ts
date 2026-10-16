import {
  ejecutarSoloLectura,
  type ResultadoDeConsulta,
} from "./sqlDeSoloLectura.js";
import { momentoDesde } from "./tiempo.js";

/**
 * ¿Le falta algo a las llamadas? Por día (hora de Madrid): cuántas hubo, en
 * qué estado acabaron y cuántas se quedaron sin alguna de las piezas que
 * dejan los webhooks y los jobs (transcripción, conversación, duración,
 * coste, grabación y su copia, resultado), más los eventos de webhook que
 * no terminaron bien, las citas por canal y las reservas que se quedaron
 * pendientes por código de fallo. Con `ejemplos`, las llamadas más
 * recientes con algún problema, para seguir con traza_llamada.
 *
 * Fuera quedan los chats de WhatsApp (Call sintética `whatsapp:…`) y las
 * llamadas simuladas por el MCP (`sim-mcp-…`).
 */

/** Cuánto se espera a que lleguen el coste, la grabación y los insights
 * después de colgar antes de contarlo como que falta. */
const MARGEN_TRAS_COLGAR = "interval '10 minutes'";

/** Una llamada que lleva esto «en curso» sin moverse es un zombi
 * (jobs/cleanupZombieCalls.ts usa el mismo umbral). */
const UMBRAL_DE_ZOMBI = "interval '20 minutes'";

/** El texto de las llamadas se purga a los 90 días
 * (jobs/purgarTextoDeLlamadas.ts): una más vieja sin transcripción no es un
 * fallo. */
const RETENCION_DEL_TEXTO = "interval '90 days'";

/** Telnyx cobró 0: quien llamó colgó antes de que contestara el assistant
 * (originator_cancel mientras sonaba). Esas llamadas no tienen conversación,
 * transcripción ni insights, y no es un fallo. IS NOT DISTINCT FROM y no
 * «= 0»: con el coste aún sin llegar (NULL), `NOT (… = 0)` daría NULL y la
 * llamada dejaría de contar como rota. */
const NO_SE_CONTESTO = `c."voiceProvider" = 'telnyx' AND c."providerCostCents" IS NOT DISTINCT FROM 0`;

export const PROBLEMAS_DE_LLAMADA = {
  zombi_abierta: `c.status = 'IN_PROGRESS' AND c."updatedAt" < (now() AT TIME ZONE 'UTC') - ${UMBRAL_DE_ZOMBI}`,
  sin_transcripcion: `c.status IN ('COMPLETED', 'FAILED', 'TIMED_OUT') AND NOT (${NO_SE_CONTESTO}) AND t.id IS NULL AND coalesce(c."durationSecs", 0) >= 10 AND c."startedAt" > (now() AT TIME ZONE 'UTC') - ${RETENCION_DEL_TEXTO}`,
  sin_conversacion: `c."voiceProvider" = 'telnyx' AND c.status IN ('COMPLETED', 'TIMED_OUT') AND NOT (${NO_SE_CONTESTO}) AND c."providerConversationId" IS NULL`,
  sin_duracion: `c.status IN ('COMPLETED', 'FAILED', 'TIMED_OUT') AND c."durationSecs" IS NULL`,
  sin_coste: `c."voiceProvider" = 'telnyx' AND c.status IN ('COMPLETED', 'FAILED') AND c."providerCostCents" IS NULL AND c."endedAt" < (now() AT TIME ZONE 'UTC') - ${MARGEN_TRAS_COLGAR}`,
  sin_grabacion: `c."grabacionPermitida" IS TRUE AND NOT (${NO_SE_CONTESTO}) AND c."grabacionRechazadaAt" IS NULL AND r.id IS NULL AND c.status = 'COMPLETED' AND coalesce(c."durationSecs", 0) >= 10 AND c."endedAt" < (now() AT TIME ZONE 'UTC') - ${MARGEN_TRAS_COLGAR}`,
  grabacion_sin_copiar: `r.id IS NOT NULL AND r."storageKey" IS NULL AND r."deletedAt" IS NULL AND r."processingFailedAt" IS NULL AND r."createdAt" < (now() AT TIME ZONE 'UTC') - ${MARGEN_TRAS_COLGAR}`,
  grabacion_fallida: `r."processingFailedAt" IS NOT NULL AND r."storageKey" IS NULL`,
  sin_resultado: `c.status = 'COMPLETED' AND NOT (${NO_SE_CONTESTO}) AND c.outcome IS NULL AND c."endedAt" < (now() AT TIME ZONE 'UTC') - ${MARGEN_TRAS_COLGAR}`,
} as const;

export type ProblemaDeLlamada = keyof typeof PROBLEMAS_DE_LLAMADA;

/**
 * CTE con cada llamada de la ventana y la lista de sus problemas. $1 =
 * desde (ISO, UTC); $2 = negocio o null.
 */
export function cteDeLlamadasMarcadas(): string {
  const problemas = Object.entries(PROBLEMAS_DE_LLAMADA)
    .map(([nombre, condicion]) => `CASE WHEN ${condicion} THEN '${nombre}' END`)
    .join(",\n        ");
  return `WITH marcadas AS (
    SELECT c.id, c."callId", c."businessId", c."startedAt", c.status::text AS estado,
      to_char(((c."startedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Madrid')::date, 'YYYY-MM-DD') AS dia,
      array_remove(ARRAY[
        ${problemas}
      ]::text[], NULL) AS problemas
    FROM calls c
    LEFT JOIN transcripts t ON t."callId" = c.id
    LEFT JOIN recordings r ON r."callId" = c.id
    WHERE c."startedAt" >= ($1::timestamptz AT TIME ZONE 'UTC')
      AND ($2::text IS NULL OR c."businessId" = $2)
      AND c."callId" NOT LIKE 'whatsapp:%'
      AND c."callId" NOT LIKE 'sim-mcp-%'
  )`;
}

type Ejecutor = (
  sql: string,
  parametros: unknown[],
  limiteFilas?: number
) => Promise<ResultadoDeConsulta>;

export type DiaDeLlamadas = {
  dia: string;
  llamadas: number;
  estados: Record<string, number>;
  problemas: Partial<Record<ProblemaDeLlamada, number>>;
};

/** Junta las filas (dia, tipo, clave, n) en un objeto por día, del más
 * reciente al más antiguo. */
export function agruparPorDia(
  filas: { dia: string; tipo: string; clave: string; n: number | string }[]
): DiaDeLlamadas[] {
  const dias = new Map<string, DiaDeLlamadas>();
  for (const fila of filas) {
    let dia = dias.get(fila.dia);
    if (!dia) {
      dia = { dia: fila.dia, llamadas: 0, estados: {}, problemas: {} };
      dias.set(fila.dia, dia);
    }
    const n = Number(fila.n);
    if (fila.tipo === "estado") {
      dia.estados[fila.clave] = n;
      dia.llamadas += n;
    } else {
      dia.problemas[fila.clave as ProblemaDeLlamada] = n;
    }
  }
  return [...dias.values()].sort((a, b) => b.dia.localeCompare(a.dia));
}

export type OpcionesDeSalud = {
  desde?: string;
  businessId?: string;
  ejemplos?: number;
};

export async function saludDeLlamadas(
  urlDeConexion: string,
  { desde = "7d", businessId, ejemplos = 10 }: OpcionesDeSalud,
  {
    ahora = Date.now(),
    ejecutar = (sql, parametros, limiteFilas) =>
      ejecutarSoloLectura(urlDeConexion, sql, { parametros, limiteFilas }),
  }: { ahora?: number; ejecutar?: Ejecutor } = {}
) {
  const desdeIso = momentoDesde(desde, ahora);
  const parametros = [desdeIso, businessId ?? null];
  const cte = cteDeLlamadasMarcadas();

  // Una consulta tras otra: el rol de lectura de producción admite 2
  // conexiones.
  const porDia = await ejecutar(
    `${cte}
    SELECT dia, 'estado' AS tipo, estado AS clave, count(*) AS n
      FROM marcadas GROUP BY 1, 3
    UNION ALL
    SELECT dia, 'problema', problema, count(*)
      FROM marcadas, unnest(problemas) AS problema GROUP BY 1, 3`,
    parametros,
    1000
  );

  const conProblemas =
    ejemplos > 0
      ? await ejecutar(
          `${cte}
          SELECT id, "callId", "businessId", "startedAt", estado, problemas
            FROM marcadas WHERE cardinality(problemas) > 0
           ORDER BY "startedAt" DESC LIMIT $3`,
          [...parametros, ejemplos],
          ejemplos
        )
      : null;

  // Los eventos no llevan negocio (voice_webhook_events.callId no se rellena
  // en Telnyx), así que esta parte es de toda la plataforma.
  const webhooks = await ejecutar(
    `SELECT provider AS proveedor, type AS tipo,
        CASE WHEN result = 'processing' THEN 'processing_colgado' ELSE coalesce(result, 'sin_resultado') END AS resultado,
        count(*) AS n, max(attempts) AS "maxIntentos", max("receivedAt") AS ultimo,
        (array_agg("lastError" ORDER BY "receivedAt" DESC) FILTER (WHERE "lastError" IS NOT NULL))[1] AS "ultimoError"
      FROM voice_webhook_events
     WHERE "receivedAt" >= ($1::timestamptz AT TIME ZONE 'UTC')
       AND (result IS DISTINCT FROM 'success')
       AND NOT (result = 'processing' AND "claimedAt" >= (now() AT TIME ZONE 'UTC') - interval '5 minutes')
     GROUP BY 1, 2, 3 ORDER BY n DESC`,
    [desdeIso],
    100
  );

  const citas = await ejecutar(
    `SELECT coalesce(b."createdVia", 'desconocido') AS canal, count(*) AS creadas,
        count(*) FILTER (WHERE b."isCancelled") AS canceladas,
        count(*) FILTER (WHERE NOT b."isCancelled" AND b."externalEventId" IS NULL) AS "sinEventoEnCalendario"
      FROM bookings b JOIN calls c ON c.id = b."callId"
     WHERE b."createdAt" >= ($1::timestamptz AT TIME ZONE 'UTC')
       AND ($2::text IS NULL OR c."businessId" = $2)
     GROUP BY 1 ORDER BY 2 DESC`,
    parametros,
    50
  );

  const pendientes = await ejecutar(
    `SELECT coalesce(l.data->>'failureCode', 'sin_codigo') AS codigo, count(*) AS total,
        count(*) FILTER (WHERE l."resolvedAt" IS NULL) AS "sinResolver",
        max(l."createdAt") AS ultimo
      FROM leads l JOIN calls c ON c.id = l."callId"
     WHERE l.type = 'pending_booking'
       AND l."createdAt" >= ($1::timestamptz AT TIME ZONE 'UTC')
       AND ($2::text IS NULL OR c."businessId" = $2)
     GROUP BY 1 ORDER BY 2 DESC`,
    parametros,
    50
  );

  return {
    desde: desdeIso,
    ...(businessId ? { businessId } : {}),
    leyenda: {
      zombi_abierta: "sigue «en curso» sin moverse más de 20 min (el barrido la cerrará como TIMED_OUT)",
      sin_transcripcion: "acabó, duró 10 s o más y no tiene transcripción (las de más de 90 días se purgan)",
      nota: "Las de Telnyx con coste 0 (colgaron antes de que contestara el assistant) no cuentan como sin transcripción, conversación, grabación ni resultado",
      sin_conversacion: "Telnyx sin providerConversationId (no llegó call.conversation.ended)",
      sin_duracion: "acabó sin durationSecs",
      sin_coste: "Telnyx sin providerCostCents 10 min después de colgar (no llegó call.cost)",
      sin_grabacion: "con permiso para grabar, 10 s o más y sin fila en recordings",
      grabacion_sin_copiar: "la grabación no está en R2 10 min después (processRecording)",
      grabacion_fallida: "processRecording se rindió (processingFailedAt)",
      sin_resultado: "COMPLETED sin outcome 10 min después (no llegaron los insights)",
    },
    dias: agruparPorDia(
      porDia.filas as { dia: string; tipo: string; clave: string; n: string }[]
    ),
    ...(conProblemas ? { ejemplos: conProblemas.filas } : {}),
    webhooksQueNoAcabaronBien: webhooks.filas,
    citasPorCanal: citas.filas,
    reservasPendientesPorCodigo: pendientes.filas,
  };
}
