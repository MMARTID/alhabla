import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { CONTENEDOR_DE_SIMULACION } from "./enviosSimulados.js";
import {
  ejecutarSoloLectura,
  type ResultadoDeConsulta,
} from "./sqlDeSoloLectura.js";

const ejecutar = promisify(execFile);

/**
 * Las pruebas de punta a punta de la agenda (PLAN-AGENDA-PRINCIPAL.md, «Cómo se
 * comprueba») sin tocar un Google de verdad: backend-sim monta un calendario
 * falso (src/adapters/calendar/falso/calendarioFalso.ts, CALENDARIOS_FALSOS=1)
 * para las conexiones con credenciales `falso:`.
 *
 * - `calendario_falso` lo maneja ejecutando backend/scripts/sim/calendarioFalso.ts
 *   DENTRO de alhabla_backend_sim (mismo código, BD y entorno que las llamadas
 *   simuladas).
 * - `agenda_dev` (solo lectura) enseña las citas de un negocio con el estado de
 *   su copia y lo que no cuadra con los eventos del calendario falso.
 */

export const ACCIONES_DEL_CALENDARIO_FALSO = [
  "conectar",
  "estado",
  "apuntar",
  "mover",
  "borrar",
  "copiar",
  "volcar",
  "recordar",
  "quitar",
] as const;
export type AccionDelCalendarioFalso =
  (typeof ACCIONES_DEL_CALENDARIO_FALSO)[number];

const SEPARADOR = "@@RESULTADO@@";

/** Saca el JSON que el script deja tras el separador (la salida lleva antes
 * los logs del backend). */
export function leerResultadoDelScript(salida: string): {
  ok: boolean;
  resultado?: unknown;
  error?: string;
} {
  const linea = salida
    .split("\n")
    .reverse()
    .find((l) => l.includes(SEPARADOR));
  if (!linea) {
    throw new Error(
      "[MCP] El script del calendario falso no devolvió resultado (¿backend-sim corre una rama sin scripts/sim/calendarioFalso.ts?)."
    );
  }
  return JSON.parse(linea.slice(linea.indexOf(SEPARADOR) + SEPARADOR.length));
}

/** Los logs del backend que soltó la acción (copias, avisos simulados…),
 * para ver qué pasó sin abrir docker logs. */
function logsDeLaAccion(salida: string): string[] {
  return salida
    .split("\n")
    .filter(
      (l) =>
        !l.includes(SEPARADOR) &&
        /\[(Calendar|WhatsApp|Correo|SMS|Job)\]/.test(l)
    )
    .slice(-30);
}

export async function manejarCalendarioFalso(
  accion: AccionDelCalendarioFalso,
  entrada: Record<string, unknown>
): Promise<unknown> {
  let salida: string;
  try {
    const { stdout, stderr } = await ejecutar(
      "docker",
      [
        "exec",
        CONTENEDOR_DE_SIMULACION,
        "npx",
        "tsx",
        "scripts/sim/calendarioFalso.ts",
        accion,
        JSON.stringify(entrada),
      ],
      { maxBuffer: 10 * 1024 * 1024, timeout: 120_000 }
    );
    salida = `${stdout}\n${stderr}`;
  } catch (error) {
    // El script sale con código 1 cuando la acción falla: su salida sigue
    // trayendo el motivo.
    const conSalida = error as { stdout?: string; stderr?: string };
    if (conSalida.stdout?.includes(SEPARADOR)) {
      salida = `${conSalida.stdout}\n${conSalida.stderr ?? ""}`;
    } else {
      throw new Error(
        `[MCP] No se pudo ejecutar el calendario falso en ${CONTENEDOR_DE_SIMULACION} (¿está levantado? backend_sim levantar): ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }
  const resultado = leerResultadoDelScript(salida);
  if (!resultado.ok) {
    throw new Error(`[MCP] calendario_falso ${accion}: ${resultado.error}`);
  }
  return { ...((resultado.resultado as object) ?? {}), logs: logsDeLaAccion(salida) };
}

type Ejecutor = (
  sql: string,
  parametros: unknown[],
  limiteFilas: number
) => Promise<ResultadoDeConsulta>;

const CITAS = `
  SELECT b.id, b."programedAt", b."durationMinutes", b."clientName",
    b."isCancelled", b."createdVia", b."externalEventId",
    b."externalCalendarProvider", b."copiaEnCalendario", b."copiaIntentos",
    b."copiaError", p.name AS profesional
  FROM bookings b
  JOIN calls c ON c.id = b."callId"
  LEFT JOIN professionals p ON p.id = b."professionalId"
  WHERE c."businessId" = $1
    AND b."programedAt" >= now() - ($2::int * interval '1 day')
  ORDER BY b."programedAt"
  LIMIT 200`;

const CONEXION = `
  SELECT b."calendarProvider", b."modoDeAgenda",
    cc.provider, cc.connected, cc."disconnectedAt", cc."lastError",
    (cc.credentials IS NOT NULL) AS "conCredenciales"
  FROM businesses b
  LEFT JOIN calendar_connections cc ON cc."businessId" = b.id
  WHERE b.id = $1`;

const CALENDARIO_FALSO = `
  SELECT "valor" #>> '{}' AS valor, "expiraEn"
  FROM claves_temporales
  WHERE clave = $1 AND "expiraEn" > now()`;

const PENDIENTES = `
  SELECT l.id, l."createdAt", l.data->>'failureCode' AS codigo,
    l.data->>'startDateTime' AS hora
  FROM leads l JOIN calls c ON c.id = l."callId"
  WHERE c."businessId" = $1 AND l.type = 'pending_booking'
    AND l."resolvedAt" IS NULL
  ORDER BY l."createdAt" DESC LIMIT 20`;

type EventoFalso = {
  id: string;
  summary: string;
  inicio: string;
  fin: string;
  origen: string;
};

/**
 * La agenda de un negocio de dev tal como la ve la agenda principal: cada cita
 * con su copia (null, pendiente, hecha, fallida), la conexión de calendario,
 * los eventos del calendario falso si lo tiene, y lo que no cuadra:
 * citas activas sin evento, eventos de citas canceladas, copias cuyo evento
 * está a otra hora (movido «en Google») y eventos apuntados a mano.
 */
export async function agendaDeNegocio(
  urlDeConexion: string,
  { businessId, diasAtras = 1 }: { businessId: string; diasAtras?: number },
  {
    ejecutar: consultar = (sql, parametros, limiteFilas) =>
      ejecutarSoloLectura(urlDeConexion, sql, { parametros, limiteFilas }),
  }: { ejecutar?: Ejecutor } = {}
) {
  const [citas, conexion, falso, pendientes] = await Promise.all([
    consultar(CITAS, [businessId, diasAtras], 200),
    consultar(CONEXION, [businessId], 10),
    consultar(CALENDARIO_FALSO, [`calendario-falso:falso:${businessId}`], 1),
    consultar(PENDIENTES, [businessId], 20),
  ]);
  if (conexion.filas.length === 0) {
    throw new Error(`[MCP] No existe el negocio ${businessId} en dev.`);
  }
  const crudo = falso.filas[0]?.valor as string | undefined;
  const calendarioFalso = crudo
    ? (JSON.parse(crudo) as { estado: string; eventos: EventoFalso[] })
    : null;
  const eventos = new Map(
    (calendarioFalso?.eventos ?? []).map((e) => [e.id, e])
  );

  const filas = citas.filas as Array<{
    id: string;
    programedAt: Date;
    durationMinutes: number;
    isCancelled: boolean;
    externalEventId: string | null;
    copiaEnCalendario: string | null;
  }>;
  const aDescuadres = {
    activasSinEvento: [] as string[],
    eventoDeCitaCancelada: [] as string[],
    eventoAOtraHora: [] as Array<{ bookingId: string; cita: string; evento: string }>,
    eventoQueNoEsta: [] as string[],
    apuntadosAMano: [] as EventoFalso[],
  };
  const idsDeCitas = new Set<string>();
  for (const cita of filas) {
    if (cita.externalEventId) idsDeCitas.add(cita.externalEventId);
    if (!calendarioFalso) continue;
    const evento = cita.externalEventId
      ? eventos.get(cita.externalEventId)
      : undefined;
    if (cita.isCancelled) {
      if (evento) aDescuadres.eventoDeCitaCancelada.push(cita.id);
      continue;
    }
    if (!cita.externalEventId) {
      aDescuadres.activasSinEvento.push(cita.id);
    } else if (!evento) {
      aDescuadres.eventoQueNoEsta.push(cita.id);
    } else if (
      new Date(evento.inicio).getTime() !==
      new Date(cita.programedAt).getTime()
    ) {
      aDescuadres.eventoAOtraHora.push({
        bookingId: cita.id,
        cita: new Date(cita.programedAt).toISOString(),
        evento: evento.inicio,
      });
    }
  }
  for (const evento of eventos.values()) {
    if (evento.origen === "a_mano" && !idsDeCitas.has(evento.id)) {
      aDescuadres.apuntadosAMano.push(evento);
    }
  }

  const porEstado: Record<string, number> = {};
  for (const cita of filas) {
    if (cita.isCancelled) continue;
    const estado = cita.copiaEnCalendario ?? "sin_calendario";
    porEstado[estado] = (porEstado[estado] ?? 0) + 1;
  }

  return {
    conexion: conexion.filas,
    copias: porEstado,
    citas: citas.filas,
    reservasPendientes: pendientes.filas,
    calendarioFalso: calendarioFalso
      ? { estado: calendarioFalso.estado, eventos: calendarioFalso.eventos }
      : null,
    ...(calendarioFalso ? { descuadres: aDescuadres } : {}),
  };
}
