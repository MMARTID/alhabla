import { enmascararEnTodo, recortar } from "./privacidad.js";
import {
  ejecutarSoloLectura,
  type ResultadoDeConsulta,
} from "./sqlDeSoloLectura.js";

/**
 * La foto de un negocio en una respuesta: suscripción y suspensiones,
 * número y orquestador, calendario (proveedor, si está conectado y su
 * último error; NUNCA las credenciales), assistants y su sincronización,
 * equipo y la actividad de los últimos 30 días.
 *
 * Sin negocio, lista todos con lo justo para elegir uno. Ahorra los joins
 * que no se ven a simple vista: `bookings` y `leads` no tienen businessId,
 * cuelgan de `calls`.
 */

type Ejecutor = (
  sql: string,
  parametros: unknown[],
  limiteFilas?: number
) => Promise<ResultadoDeConsulta>;

/** «miguel@icloud.com» → «m•••@icloud.com»: basta para saber qué cuenta es. */
export function enmascararEmail(email: string | null | undefined) {
  if (!email) return email ?? null;
  const [usuario = "", dominio] = email.split("@");
  return dominio ? `${usuario.slice(0, 1)}•••@${dominio}` : "•••";
}

/** La URL de un calendario de iCloud lleva el número de la cuenta de Apple
 * (`/17137020032/calendars/…`): se tapa como un teléfono. */
export function enmascararIdDeCuenta(calendarId: string): string {
  return calendarId.replace(/\/(\d{6,})\//g, (_, numero: string) =>
    `/•••${numero.slice(-3)}/`
  );
}

const LISTADO = `
  SELECT b.id, b.name AS nombre, b."businessType" AS tipo,
      b."subscriptionStatus"::text AS suscripcion,
      b."telnyxPhoneNumber" AS numero, b."calendarProvider" AS calendario,
      (SELECT max(c."startedAt") FROM calls c WHERE c."businessId" = b.id
         AND c."callId" NOT LIKE 'whatsapp:%') AS "ultimaLlamada",
      b."createdAt"
    FROM businesses b
   WHERE ($1::text IS NULL OR b.name ILIKE '%' || $1 || '%' OR b.id = $1
          OR b.phone = $1 OR b."telnyxPhoneNumber" = $1 OR b."ownerWhatsappNumber" = $1)
   ORDER BY b."createdAt"`;

export async function resumenDeNegocio(
  urlDeConexion: string,
  {
    businessId,
    buscar,
    mostrarTelefonos = false,
  }: { businessId?: string; buscar?: string; mostrarTelefonos?: boolean },
  {
    ejecutar = (sql, parametros, limiteFilas) =>
      ejecutarSoloLectura(urlDeConexion, sql, { parametros, limiteFilas }),
  }: { ejecutar?: Ejecutor } = {}
) {
  const privado = <T>(valor: T): T =>
    mostrarTelefonos ? valor : enmascararEnTodo(valor);

  let id = businessId;
  if (!id) {
    const { filas } = await ejecutar(LISTADO, [buscar ?? null], 100);
    if (filas.length !== 1) {
      return privado({
        negocios: filas,
        ...(filas.length === 0
          ? { aviso: `Ningún negocio coincide con «${buscar}»` }
          : { siguiente: "Repite con businessId para ver uno entero" }),
      });
    }
    id = (filas[0] as { id: string }).id;
  }

  // Una consulta tras otra: el rol de lectura de producción admite 2
  // conexiones.
  const negocio = await ejecutar(
    `SELECT b.id, b.name AS nombre, b."businessType" AS tipo, b.plan,
        b.timezone AS zona, b.active AS activo, b."createdAt",
        b."subscriptionStatus"::text AS suscripcion, b."subscriptionTrialEnd" AS "finDePrueba",
        b."subscriptionCurrentPeriodEnd" AS "finDelPeriodo",
        b."subscriptionCancelAtPeriodEnd" AS "cancelaAlFinal",
        b."callsSuspendedAt" AS "llamadasSuspendidasEn",
        b."paymentFailureSuspensionAt" AS "suspensionPorImpagoEn",
        b."telnyxPhoneNumber" AS numero, b."phoneNumberStatus" AS "estadoDelNumero",
        b.phone AS "telefonoDelDueno", b."customerLineType" AS "tipoDeLinea",
        b."ownerWhatsappNumber" AS "whatsappDelDueno",
        b."ownerWhatsappOptInAt" AS "whatsappAceptadoEn",
        b."ownerWhatsappOptOutAt" AS "whatsappRechazadoEn",
        b."ownerWhatsappUnreachableAt" AS "whatsappInalcanzableEn",
        b."clientChatEnabled" AS "chatDeClientes", b."ownerChatEnabled" AS "chatDelDueno",
        b."hideOwnerNumberFromClients" AS "ocultaNumeroDelDueno",
        b."calendarProvider" AS "calendarioActivo", b."bookingCapacity" AS capacidad,
        b."minAdvanceBookingMinutes" AS "antelacionMinima",
        b."maxAppointmentDurationMinutes" AS "duracionMaxima",
        jsonb_array_length(coalesce(b.schedule->'exceptions', '[]'::jsonb)) AS "excepcionesDeHorario"
      FROM businesses b WHERE b.id = $1`,
    [id]
  );
  if (negocio.filas.length === 0) {
    throw new Error(`[MCP] No hay ningún negocio ${id}`);
  }

  const calendarios = await ejecutar(
    `SELECT provider AS proveedor, connected AS conectado,
        credentials IS NOT NULL AS "tieneCredenciales", "calendarId",
        "accountEmail", "disconnectedAt" AS "desconectadoEn",
        "lastError" AS "ultimoError", "updatedAt" AS "actualizado"
      FROM calendar_connections WHERE "businessId" = $1 ORDER BY provider`,
    [id]
  );

  const agentes = await ejecutar(
    `SELECT id, name AS nombre, active AS activo, "deletedAt" AS "borradoEn",
        "telnyxAssistantId", "telnyxSyncedAt" AS "sincronizadoEn",
        "telnyxSyncError" AS "errorDeSincronizacion", "promptManuallyEdited" AS "promptEditadoAMano"
      FROM agents WHERE "businessId" = $1 ORDER BY "createdAt"`,
    [id]
  );

  const actividad = await ejecutar(
    `SELECT
        (SELECT count(*) FROM professionals WHERE "businessId" = $1 AND active AND "deletedAt" IS NULL) AS profesionales,
        (SELECT count(*) FROM services WHERE "businessId" = $1 AND active AND "deletedAt" IS NULL) AS servicios,
        (SELECT count(*) FROM professional_absences WHERE "businessId" = $1 AND "endsAt" > (now() AT TIME ZONE 'UTC')) AS "ausenciasPorDelante",
        (SELECT count(*) FROM calls WHERE "businessId" = $1 AND "callId" NOT LIKE 'whatsapp:%' AND "callId" NOT LIKE 'sim-mcp-%'
           AND "startedAt" > (now() AT TIME ZONE 'UTC') - interval '30 days') AS "llamadas30d",
        (SELECT max("startedAt") FROM calls WHERE "businessId" = $1 AND "callId" NOT LIKE 'whatsapp:%') AS "ultimaLlamada",
        (SELECT count(*) FROM calls WHERE "businessId" = $1 AND "callId" LIKE 'whatsapp:%'
           AND "ultimaActividadAt" > (now() AT TIME ZONE 'UTC') - interval '30 days') AS "chatsDeWhatsapp30d",
        (SELECT count(*) FROM bookings bk JOIN calls c ON c.id = bk."callId" WHERE c."businessId" = $1
           AND bk."createdAt" > (now() AT TIME ZONE 'UTC') - interval '30 days') AS "citasCreadas30d",
        (SELECT count(*) FROM bookings bk JOIN calls c ON c.id = bk."callId" WHERE c."businessId" = $1
           AND NOT bk."isCancelled" AND bk."programedAt" > (now() AT TIME ZONE 'UTC')) AS "citasPorDelante",
        (SELECT count(*) FROM leads l JOIN calls c ON c.id = l."callId" WHERE c."businessId" = $1
           AND l.type = 'pending_booking' AND l."resolvedAt" IS NULL) AS "reservasPendientesSinResolver"`,
    [id]
  );

  return privado({
    negocio: negocio.filas[0],
    calendarios: calendarios.filas.map((fila) => ({
      ...fila,
      calendarId:
        typeof fila.calendarId === "string"
          ? recortar(
              mostrarTelefonos
                ? fila.calendarId
                : enmascararIdDeCuenta(fila.calendarId),
              120
            )
          : null,
      accountEmail: mostrarTelefonos
        ? fila.accountEmail
        : enmascararEmail(fila.accountEmail as string | null),
      ultimoError:
        typeof fila.ultimoError === "string" ? recortar(fila.ultimoError, 300) : null,
    })),
    agentes: agentes.filas.map((fila) => ({
      ...fila,
      errorDeSincronizacion:
        typeof fila.errorDeSincronizacion === "string"
          ? recortar(fila.errorDeSincronizacion, 300)
          : null,
    })),
    actividad: actividad.filas[0],
  });
}
