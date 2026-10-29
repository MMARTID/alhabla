import {
  ejecutarSoloLectura,
  type ResultadoDeConsulta,
} from "./sqlDeSoloLectura.js";

/**
 * Las cifras de Alhabla como negocio, de un vistazo y sin datos personales
 * (solo recuentos): cuántas cuentas hay y cuántas se dieron de alta cada
 * día, el embudo de alta (cuenta → suscripción → número → agenda → primera
 * llamada), las suscripciones por plan y estado, la actividad por día
 * (llamadas de voz, chats y mensajes de WhatsApp, citas por canal) y los
 * minutos de voz del mes en curso. Los días son de Madrid.
 *
 * Las llamadas de voz son las que no son de WhatsApp (`voiceProvider`
 * whatsapp: chats, Gestor, panel y lista de espera llevan una Call
 * sintética) ni simuladas por el MCP (`sim-mcp-…`).
 */

const ZONA = "Europe/Madrid";
const LLAMADA_DE_VOZ = `c."voiceProvider" <> 'whatsapp' AND c."callId" NOT LIKE 'sim-mcp-%'`;

/** Día de Madrid de una columna DateTime de Prisma (timestamp sin zona, en
 * UTC). */
function diaDe(columna: string): string {
  return `to_char(((${columna} AT TIME ZONE 'UTC') AT TIME ZONE '${ZONA}')::date, 'YYYY-MM-DD')`;
}

/** Medianoche de Madrid de la fecha $n, como timestamp UTC comparable con
 * las columnas de Prisma. */
function medianocheDe(parametro: string): string {
  return `(${parametro}::date::timestamp AT TIME ZONE '${ZONA}') AT TIME ZONE 'UTC'`;
}

const FORMATO_DE_DIA = new Intl.DateTimeFormat("sv-SE", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Los `dias` días de Madrid que acaban hoy, del más reciente al más
 * antiguo («2026-10-29», «2026-10-28»…). */
export function diasDeLaVentana(dias: number, ahora = Date.now()): string[] {
  const [anio, mes, dia] = FORMATO_DE_DIA.format(new Date(ahora))
    .split("-")
    .map(Number) as [number, number, number];
  return Array.from({ length: dias }, (_, atras) =>
    new Date(Date.UTC(anio, mes - 1, dia - atras)).toISOString().slice(0, 10)
  );
}

/** Primer día del mes en curso en Madrid («2026-10-01»). */
export function inicioDelMes(ahora = Date.now()): string {
  return `${FORMATO_DE_DIA.format(new Date(ahora)).slice(0, 7)}-01`;
}

/** $1 = primer día del mes (Madrid). */
export const SQL_DE_RESUMEN = `WITH llamadas_reales AS (
    SELECT DISTINCT c."businessId" FROM calls c WHERE ${LLAMADA_DE_VOZ}
  ), etapas AS (
    SELECT b."subscriptionStatus" IN ('ACTIVE', 'TRIALING') AS suscrita,
      b."telnyxPhoneNumber" IS NOT NULL AS con_numero,
      (b."modoDeAgenda" = 'alhabla' OR EXISTS (
        SELECT 1 FROM calendar_connections cc
         WHERE cc."businessId" = b.id AND cc.provider = b."calendarProvider"
           AND cc.connected AND cc.credentials IS NOT NULL
      )) AS con_agenda,
      EXISTS (SELECT 1 FROM llamadas_reales r WHERE r."businessId" = b.id) AS con_llamada
    FROM businesses b
  ), mes AS (
    SELECT ${medianocheDe("$1")} AS desde
  )
  SELECT count(*) AS cuentas,
    count(*) FILTER (WHERE suscrita) AS suscrita,
    count(*) FILTER (WHERE suscrita AND con_numero) AS con_numero,
    count(*) FILTER (WHERE suscrita AND con_numero AND con_agenda) AS con_agenda,
    count(*) FILTER (WHERE suscrita AND con_numero AND con_agenda AND con_llamada) AS con_llamada,
    count(*) FILTER (WHERE con_numero) AS solo_con_numero,
    count(*) FILTER (WHERE con_agenda) AS solo_con_agenda,
    count(*) FILTER (WHERE con_llamada) AS solo_con_llamada,
    (SELECT count(*) FROM calls c, mes
      WHERE c."startedAt" >= mes.desde AND ${LLAMADA_DE_VOZ} AND c.status <> 'IN_PROGRESS') AS llamadas_del_mes,
    (SELECT coalesce(sum(c."durationSecs"), 0) FROM calls c, mes
      WHERE c."startedAt" >= mes.desde AND ${LLAMADA_DE_VOZ} AND c.status <> 'IN_PROGRESS') AS segundos_del_mes
  FROM etapas`;

/** El plan sale de la columna `plan` (syncSubscription la pone con el del
 * precio de Stripe: basic → inicio, pro, enterprise → scale); sin
 * suscripción nunca, «ninguno». */
export const SQL_DE_SUSCRIPCIONES = `SELECT
    CASE WHEN b."stripeSubscriptionId" IS NULL AND b."subscriptionStatus" IS NULL THEN 'ninguno'
         WHEN b.plan = 'basic' THEN 'inicio'
         WHEN b.plan = 'enterprise' THEN 'scale'
         ELSE b.plan END AS plan,
    coalesce(b."subscriptionStatus"::text, 'sin_suscripcion') AS estado,
    count(*) AS negocios,
    count(*) FILTER (WHERE b."subscriptionCancelAtPeriodEnd") AS "cancelanAlAcabarElPeriodo"
  FROM businesses b GROUP BY 1, 2 ORDER BY 3 DESC, 1, 2`;

/** $1 = primer día de la ventana (Madrid). Filas (dia, tipo, clave, n). */
export const SQL_POR_DIA = `WITH ventana AS (SELECT ${medianocheDe("$1")} AS desde)
  SELECT ${diaDe('b."createdAt"')} AS dia, 'altas' AS tipo, '' AS clave, count(*) AS n
    FROM businesses b, ventana v WHERE b."createdAt" >= v.desde GROUP BY 1
  UNION ALL
  SELECT ${diaDe('c."startedAt"')}, 'llamadas', '', count(*)
    FROM calls c, ventana v WHERE c."startedAt" >= v.desde AND ${LLAMADA_DE_VOZ} GROUP BY 1
  UNION ALL
  SELECT ${diaDe('c."startedAt"')}, 'segundosDeVoz', '', coalesce(sum(c."durationSecs"), 0)
    FROM calls c, ventana v WHERE c."startedAt" >= v.desde AND ${LLAMADA_DE_VOZ} GROUP BY 1
  UNION ALL
  SELECT ${diaDe('c."startedAt"')}, 'chatsNuevos', '', count(*)
    FROM calls c, ventana v WHERE c."startedAt" >= v.desde AND c."callId" LIKE 'whatsapp:chat:%' GROUP BY 1
  UNION ALL
  SELECT ${diaDe('m."receivedAt"')}, 'mensajesWhatsapp', m.role, count(*)
    FROM inbound_messages m, ventana v WHERE m."receivedAt" >= v.desde GROUP BY 1, 3
  UNION ALL
  SELECT ${diaDe('bk."createdAt"')}, 'citas', coalesce(bk."createdVia", 'voice'), count(*)
    FROM bookings bk JOIN calls c ON c.id = bk."callId", ventana v
   WHERE bk."createdAt" >= v.desde AND c."callId" NOT LIKE 'sim-mcp-%' GROUP BY 1, 3`;

export type DiaDelPanorama = {
  dia: string;
  altas: number;
  llamadas: number;
  minutosDeVoz: number;
  chatsNuevos: number;
  /** Entrantes por quién escribe: client, owner, unknown. */
  mensajesWhatsapp: Record<string, number>;
  /** Creadas por canal (createdVia; las antiguas sin canal son de voz). */
  citas: Record<string, number>;
};

function minutos(segundos: number): number {
  return Math.round((segundos / 60) * 10) / 10;
}

/** Junta las filas (dia, tipo, clave, n) en un objeto por día, con todos los
 * días de la ventana (los que no tienen nada, a cero), del más reciente al
 * más antiguo. */
export function serieDelPanorama(
  dias: string[],
  filas: { dia: string; tipo: string; clave: string; n: number | string }[]
): DiaDelPanorama[] {
  const porDia = new Map<string, DiaDelPanorama & { segundos: number }>(
    dias.map((dia) => [
      dia,
      {
        dia,
        altas: 0,
        llamadas: 0,
        minutosDeVoz: 0,
        segundos: 0,
        chatsNuevos: 0,
        mensajesWhatsapp: {},
        citas: {},
      },
    ])
  );
  for (const fila of filas) {
    const dia = porDia.get(fila.dia);
    if (!dia) continue;
    const n = Number(fila.n);
    if (fila.tipo === "altas") dia.altas += n;
    else if (fila.tipo === "llamadas") dia.llamadas += n;
    else if (fila.tipo === "segundosDeVoz") dia.segundos += n;
    else if (fila.tipo === "chatsNuevos") dia.chatsNuevos += n;
    else if (fila.tipo === "mensajesWhatsapp") {
      dia.mensajesWhatsapp[fila.clave] =
        (dia.mensajesWhatsapp[fila.clave] ?? 0) + n;
    } else if (fila.tipo === "citas") {
      dia.citas[fila.clave] = (dia.citas[fila.clave] ?? 0) + n;
    }
  }
  return dias.map((clave) => {
    const { segundos, ...dia } = porDia.get(clave)!;
    return { ...dia, minutosDeVoz: minutos(segundos) };
  });
}

/** Totales de la ventana a partir de la serie. */
export function totalesDeLaSerie(serie: DiaDelPanorama[]) {
  const sumar = (
    destino: Record<string, number>,
    origen: Record<string, number>
  ) => {
    for (const [clave, n] of Object.entries(origen)) {
      destino[clave] = (destino[clave] ?? 0) + n;
    }
  };
  const totales = {
    altas: 0,
    llamadas: 0,
    minutosDeVoz: 0,
    chatsNuevos: 0,
    mensajesWhatsapp: {} as Record<string, number>,
    citas: {} as Record<string, number>,
  };
  for (const dia of serie) {
    totales.altas += dia.altas;
    totales.llamadas += dia.llamadas;
    totales.minutosDeVoz += dia.minutosDeVoz;
    totales.chatsNuevos += dia.chatsNuevos;
    sumar(totales.mensajesWhatsapp, dia.mensajesWhatsapp);
    sumar(totales.citas, dia.citas);
  }
  totales.minutosDeVoz = Math.round(totales.minutosDeVoz * 10) / 10;
  return totales;
}

type FilaDeResumen = Record<
  | "cuentas"
  | "suscrita"
  | "con_numero"
  | "con_agenda"
  | "con_llamada"
  | "solo_con_numero"
  | "solo_con_agenda"
  | "solo_con_llamada"
  | "llamadas_del_mes"
  | "segundos_del_mes",
  string | number
>;

/** El embudo de alta: `negocios` cuenta los que pasaron esa etapa Y las
 * anteriores; `sinMirarLasAnteriores`, los que la cumplen aunque les falte
 * una anterior (p. ej. con número pero con la suscripción impagada). */
export function embudoDeAlta(fila: FilaDeResumen) {
  const n = (clave: keyof FilaDeResumen) => Number(fila[clave] ?? 0);
  return [
    { etapa: "cuenta creada", negocios: n("cuentas") },
    {
      etapa: "suscripción activa o en prueba",
      negocios: n("suscrita"),
      sinMirarLasAnteriores: n("suscrita"),
    },
    {
      etapa: "número de teléfono",
      negocios: n("con_numero"),
      sinMirarLasAnteriores: n("solo_con_numero"),
    },
    {
      etapa: "calendario conectado o agenda de Alhabla",
      negocios: n("con_agenda"),
      sinMirarLasAnteriores: n("solo_con_agenda"),
    },
    {
      etapa: "al menos una llamada de voz",
      negocios: n("con_llamada"),
      sinMirarLasAnteriores: n("solo_con_llamada"),
    },
  ];
}

type Ejecutor = (
  sql: string,
  parametros: unknown[],
  limiteFilas?: number
) => Promise<ResultadoDeConsulta>;

export async function panoramaDePlataforma(
  urlDeConexion: string,
  { dias = 14 }: { dias?: number } = {},
  {
    ahora = Date.now(),
    ejecutar = (sql, parametros, limiteFilas) =>
      ejecutarSoloLectura(urlDeConexion, sql, { parametros, limiteFilas }),
  }: { ahora?: number; ejecutar?: Ejecutor } = {}
) {
  const ventana = diasDeLaVentana(dias, ahora);
  const mes = inicioDelMes(ahora);

  // Una consulta tras otra: el rol de lectura de producción admite 2
  // conexiones.
  const resumen = await ejecutar(SQL_DE_RESUMEN, [mes], 1);
  const suscripciones = await ejecutar(SQL_DE_SUSCRIPCIONES, [], 100);
  const porDia = await ejecutar(SQL_POR_DIA, [ventana.at(-1)], 10_000);

  const fila = resumen.filas[0] as FilaDeResumen;
  const serie = serieDelPanorama(
    ventana,
    porDia.filas as { dia: string; tipo: string; clave: string; n: string }[]
  );
  return {
    zonaHoraria: ZONA,
    negocios: Number(fila.cuentas),
    embudoDeAlta: embudoDeAlta(fila),
    suscripciones: suscripciones.filas.map((s) => ({
      ...s,
      negocios: Number(s.negocios),
      cancelanAlAcabarElPeriodo: Number(s.cancelanAlAcabarElPeriodo),
    })),
    mesEnCurso: {
      desde: mes,
      llamadasDeVoz: Number(fila.llamadas_del_mes),
      minutosDeVoz: minutos(Number(fila.segundos_del_mes)),
    },
    ventana: {
      desde: ventana.at(-1),
      hasta: ventana[0],
      dias,
      totales: totalesDeLaSerie(serie),
    },
    leyenda: {
      llamadas:
        "de voz, sin chats de WhatsApp ni llamadas simuladas (sim-mcp-…)",
      chatsNuevos:
        "conversaciones de WhatsApp de clientes que empezaron ese día",
      mensajesWhatsapp:
        "mensajes de WhatsApp recibidos, por quién escribe (client, owner, unknown)",
      citas:
        "creadas ese día por canal: voice, client_chat, owner_chat, owner_panel, whatsapp_lista_espera",
      minutosDeVoz: "suma de la duración de las llamadas de voz",
    },
    porDia: serie,
  };
}
