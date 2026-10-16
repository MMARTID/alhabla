import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { CONTENEDOR_DE_SIMULACION } from "./enviosSimulados.js";
import {
  leerLogsDeProd,
  leerPeticionesDeProd,
  type Peticion,
} from "./logsDeProd.js";
import { enmascararEnTodo, recortar } from "./privacidad.js";
import {
  ejecutarSoloLectura,
  type ResultadoDeConsulta,
} from "./sqlDeSoloLectura.js";
import type { Entorno } from "./telnyx.js";

const ejecutarComando = promisify(execFile);

/**
 * Todo lo que dejó UNA llamada, en una respuesta: su fila, la cita (con el
 * calendario donde se creó), las reservas que se quedaron pendientes y por
 * qué, si hay transcripción y grabación, cuántas llamadas (de cualquier
 * negocio) se solaparon con ella y sus logs.
 *
 * Los logs se buscan por el `callId` (los handlers lo escriben como
 * «llamada <call_control_id>») y por el id de la fila, en la ventana de la
 * llamada: en producción en Cloud Logging, en dev en `docker logs` del
 * backend de dev (o de backend-sim si es una llamada simulada).
 *
 * Las peticiones a las tools de voz (en dev, sacadas del log de Fastify del
 * contenedor) no llevan el call_control_id en la URL
 * (va en una cabecera), así que se dan las que llegaron mientras duró la
 * llamada: con `llamadasSolapadas` > 0 pueden ser de otra (de cualquier
 * negocio).
 */

/** Antes de empezar y después de acabar: call.cost, la grabación, los
 * insights y los jobs llegan después de colgar. */
const MARGEN_ANTES_MS = 2 * 60_000;
const MARGEN_DESPUES_MS = 20 * 60_000;
/** Si la llamada no tiene endedAt, hasta dónde se mira. */
const DURACION_SI_NO_ACABO_MS = 30 * 60_000;

export const CONTENEDOR_DE_DEV = "alhabla_backend_dev";

type Ejecutor = (
  sql: string,
  parametros: unknown[],
  limiteFilas?: number
) => Promise<ResultadoDeConsulta>;

type FilaDeLlamada = {
  id: string;
  callId: string;
  businessId: string;
  negocio: string;
  startedAt: string;
  endedAt: string | null;
  [columna: string]: unknown;
};

/** Mientras duró la llamada (con 30 s de margen): las tools solo se llaman
 * con la llamada en curso, y fuera de esto son de otra. */
export function duracionDeLaLlamada(llamada: {
  startedAt: string;
  endedAt: string | null;
}): { desde: string; hasta: string } {
  const inicio = Date.parse(llamada.startedAt);
  const fin = llamada.endedAt
    ? Date.parse(llamada.endedAt)
    : inicio + DURACION_SI_NO_ACABO_MS;
  return {
    desde: new Date(inicio).toISOString(),
    hasta: new Date(fin + 30_000).toISOString(),
  };
}

export function ventanaDeLaLlamada(llamada: {
  startedAt: string;
  endedAt: string | null;
}): { desde: string; hasta: string } {
  const inicio = Date.parse(llamada.startedAt);
  const fin = llamada.endedAt
    ? Date.parse(llamada.endedAt)
    : inicio + DURACION_SI_NO_ACABO_MS;
  return {
    desde: new Date(inicio - MARGEN_ANTES_MS).toISOString(),
    hasta: new Date(fin + MARGEN_DESPUES_MS).toISOString(),
  };
}

/** Las líneas de un volcado de `docker logs -t` que mencionan algún texto. */
export function lineasQueMencionan(
  volcado: string,
  textos: string[],
  limite: number
): { hora: string; mensaje: string }[] {
  const lineas: { hora: string; mensaje: string }[] = [];
  for (const linea of volcado.split("\n")) {
    if (!textos.some((texto) => linea.includes(texto))) continue;
    const [hora = "", ...resto] = linea.trim().split(" ");
    lineas.push({ hora, mensaje: recortar(resto.join(" "), 2_000) });
  }
  return lineas
    .sort((a, b) => a.hora.localeCompare(b.hora))
    .slice(-limite);
}

const RUTA_DE_TOOL = /\/webhooks\/(telnyx\/tools|retell\/tools)\//;

/**
 * Las peticiones a las tools de un volcado de `docker logs -t`, a partir de
 * las dos líneas que deja el logger de Fastify por petición («incoming
 * request» con la URL y «request completed» con el estado y el tiempo),
 * casadas por `reqId`. Solo las que empezaron dentro de `duracion`.
 */
export function peticionesDeToolsEnVolcado(
  volcado: string,
  duracion: { desde: string; hasta: string }
): Peticion[] {
  const entrantes = new Map<string, Peticion>();
  const salida: Peticion[] = [];
  for (const linea of volcado.split("\n")) {
    const espacio = linea.indexOf(" ");
    const hora = linea.slice(0, espacio);
    const json = linea.slice(espacio + 1).trim();
    if (!json.startsWith("{")) continue;
    let entrada: {
      reqId?: string;
      msg?: string;
      req?: { method?: string; url?: string };
      res?: { statusCode?: number };
      responseTime?: number;
    };
    try {
      entrada = JSON.parse(json) as typeof entrada;
    } catch {
      continue;
    }
    if (!entrada.reqId) continue;
    if (entrada.msg === "incoming request" && entrada.req?.url) {
      if (!RUTA_DE_TOOL.test(entrada.req.url)) continue;
      const momento = Date.parse(hora);
      if (
        !(momento >= Date.parse(duracion.desde)) ||
        momento > Date.parse(duracion.hasta)
      ) {
        continue;
      }
      const peticion: Peticion = {
        hora,
        metodo: entrada.req.method ?? "",
        estado: null,
        ruta: entrada.req.url,
        revision: "",
      };
      entrantes.set(entrada.reqId, peticion);
      salida.push(peticion);
    } else if (entrada.msg === "request completed") {
      const peticion = entrantes.get(entrada.reqId);
      if (!peticion) continue;
      peticion.estado = entrada.res?.statusCode ?? null;
      if (entrada.responseTime !== undefined) {
        peticion.latencia = `${(entrada.responseTime / 1000).toFixed(3)}s`;
      }
    }
  }
  return salida.map(({ revision: _revision, ...resto }) => resto as Peticion);
}

async function logsDeDocker(
  contenedor: string,
  textos: string[],
  ventana: { desde: string; hasta: string },
  limite: number,
  duracion: { desde: string; hasta: string }
): Promise<{
  contenedor: string;
  lineas?: { hora: string; mensaje: string }[];
  peticionesDeTools?: Peticion[];
  aviso?: string;
  error?: string;
}> {
  try {
    const { stdout, stderr } = await ejecutarComando(
      "docker",
      [
        "logs",
        "-t",
        "--since",
        ventana.desde,
        "--until",
        ventana.hasta,
        contenedor,
      ],
      { maxBuffer: 64 * 1024 * 1024 }
    );
    // console.error y console.warn salen por el stderr del CLI.
    const volcado = `${stdout}\n${stderr}`;
    const lineas = lineasQueMencionan(volcado, textos, limite);
    const peticionesDeTools = peticionesDeToolsEnVolcado(volcado, duracion);
    // docker logs solo tiene lo de este contenedor: el entorno fijo lo
    // recrea al cambiar de rama. Sin esto, «0 líneas» parecería «no pasó
    // nada».
    const arranque = await ejecutarComando("docker", [
      "inspect",
      "-f",
      "{{.State.StartedAt}}",
      contenedor,
    ])
      .then(({ stdout: salida }) => salida.trim())
      .catch(() => "");
    const arrancoDespues =
      arranque !== "" && Date.parse(arranque) > Date.parse(ventana.desde);
    return {
      contenedor,
      lineas,
      peticionesDeTools,
      ...(arrancoDespues
        ? {
            aviso: `${contenedor} arrancó el ${arranque}, después del inicio de la llamada: sus logs anteriores ya no existen`,
          }
        : {}),
    };
  } catch (error) {
    return {
      contenedor,
      error: `No pude leer docker logs de ${contenedor}: ${(error as Error).message.split("\n")[0]}`,
    };
  }
}

export type OpcionesDeTraza = {
  llamada: string;
  conLogs?: boolean;
  limiteLogs?: number;
  mostrarTelefonos?: boolean;
};

export async function trazaDeLlamada(
  entorno: Entorno,
  urlDeConexion: string,
  {
    llamada,
    conLogs = true,
    limiteLogs = 150,
    mostrarTelefonos = false,
  }: OpcionesDeTraza,
  {
    ejecutar = (sql, parametros, limiteFilas) =>
      ejecutarSoloLectura(urlDeConexion, sql, { parametros, limiteFilas }),
    leerLogs = leerLogsDeProd,
    leerPeticiones = leerPeticionesDeProd,
    leerDocker = logsDeDocker,
  }: {
    ejecutar?: Ejecutor;
    leerLogs?: typeof leerLogsDeProd;
    leerPeticiones?: typeof leerPeticionesDeProd;
    leerDocker?: typeof logsDeDocker;
  } = {}
) {
  const { filas } = await ejecutar(
    `SELECT c.id, c."callId", c."businessId", b.name AS negocio, c."agentId",
        c."voiceProvider", c."providerCallId", c."providerConversationId",
        c.status::text AS estado, c.outcome::text AS resultado,
        c."escalationReason"::text AS "motivoDeEscalada", c."toolFailureDetected",
        c."fromNumber", c."startedAt", c."endedAt", c."ultimaActividadAt",
        c."durationSecs", c."providerCostCents", c."grabacionPermitida",
        c."grabacionPreguntadaAt", c."grabacionRechazadaAt", c.summary AS resumen
      FROM calls c JOIN businesses b ON b.id = c."businessId"
     WHERE c.id = $1 OR c."callId" = $1 OR c."providerCallId" = $1
        OR c."providerConversationId" = $1
     LIMIT 1`,
    [llamada]
  );
  const fila = filas[0] as FilaDeLlamada | undefined;
  if (!fila) {
    throw new Error(
      `[MCP] No hay ninguna llamada ${llamada} en ${entorno} (se busca por id, callId, providerCallId y providerConversationId)`
    );
  }

  // Una consulta tras otra: el rol de lectura de producción admite 2
  // conexiones.
  const cita = await ejecutar(
    `SELECT bk.id, bk."programedAt", bk."durationMinutes", bk."isCancelled",
        bk."cancelledAt", bk."cancelledBy", bk."createdVia", bk."createdAt",
        bk."clientName", bk."clientPhone", bk."smsConsent",
        bk."externalCalendarProvider", bk."externalEventId",
        bk."confirmedByClientAt", bk."clientNotifiedAt", bk."rescheduledToId",
        p.name AS profesional,
        (SELECT array_agg(s.name ORDER BY s.name) FROM services s
          WHERE s.id = ANY(bk."serviceIds")) AS servicios
      FROM bookings bk LEFT JOIN professionals p ON p.id = bk."professionalId"
     WHERE bk."callId" = $1`,
    [fila.id]
  );
  const pendientes = await ejecutar(
    `SELECT id, type AS tipo, "createdAt", "resolvedAt", "notifiedAt",
        "notifiedVia", data->>'failureCode' AS "codigoDeFallo",
        data->>'startDateTime' AS "horaPedida"
      FROM leads WHERE "callId" = $1 ORDER BY "createdAt"`,
    [fila.id]
  );
  const piezas = await ejecutar(
    `SELECT
        (SELECT jsonb_build_object(
            'mensajes', jsonb_array_length(t.messages),
            'caracteres', length(t."fullText"))
          FROM transcripts t WHERE t."callId" = $1) AS transcripcion,
        (SELECT jsonb_build_object(
            'copiadaEnR2', r."storageKey" IS NOT NULL,
            'fallo', r."processingError",
            'falloEn', r."processingFailedAt",
            'borradaEn', r."deletedAt")
          FROM recordings r WHERE r."callId" = $1) AS grabacion,
        -- De toda la plataforma: las peticiones a las tools no dicen de qué
        -- negocio son.
        (SELECT count(*) FROM calls o
          WHERE o.id <> $1
            AND o."callId" NOT LIKE 'whatsapp:%'
            AND o."startedAt" < coalesce($3::timestamptz AT TIME ZONE 'UTC', ($2::timestamptz AT TIME ZONE 'UTC') + interval '30 minutes')
            AND coalesce(o."endedAt", o."startedAt" + interval '30 minutes') > ($2::timestamptz AT TIME ZONE 'UTC')
        ) AS "llamadasSolapadas"`,
    [fila.id, fila.startedAt, fila.endedAt]
  );

  const ventana = ventanaDeLaLlamada(fila);
  const duracion = duracionDeLaLlamada(fila);
  const textos = [...new Set([fila.callId, fila.id])];
  let logs: unknown = { omitidos: true };
  let peticionesDeTools: unknown = undefined;
  if (conLogs) {
    if (entorno === "prod") {
      logs = await leerLogs({
        texto: textos,
        desde: ventana.desde,
        hasta: ventana.hasta,
        limite: limiteLogs,
        mostrarTelefonos: true,
      });
      const peticiones = await leerPeticiones({
        ruta: "/webhooks/",
        desde: duracion.desde,
        hasta: duracion.hasta,
        limite: 200,
        mostrarTelefonos: true,
      });
      // Solo las tools: los eventos de Call Control son de todas las
      // llamadas de la plataforma.
      peticionesDeTools = (peticiones.peticiones as Peticion[]).filter((p) =>
        /\/webhooks\/(telnyx\/tools|retell\/tools)\//.test(p.ruta)
      );
    } else {
      const contenedor = fila.callId.startsWith("sim-mcp-")
        ? CONTENEDOR_DE_SIMULACION
        : CONTENEDOR_DE_DEV;
      const { peticionesDeTools: deDocker, ...resto } = await leerDocker(
        contenedor,
        textos,
        ventana,
        limiteLogs,
        duracion
      );
      logs = resto;
      if (deDocker) peticionesDeTools = deDocker;
    }
  }

  const resultado = {
    llamada: fila,
    ventanaDeLogs: ventana,
    cita: cita.filas[0] ?? null,
    reservasPendientes: pendientes.filas,
    ...(piezas.filas[0] ?? {}),
    ...(peticionesDeTools !== undefined ? { peticionesDeTools } : {}),
    logs,
    siguiente: fila.providerConversationId
      ? `ver_conversacion_telnyx con llamada=${fila.id} para ver qué tools llamó el modelo y qué devolvieron`
      : "sin conversación de Telnyx guardada",
  };
  return mostrarTelefonos ? resultado : enmascararEnTodo(resultado);
}
