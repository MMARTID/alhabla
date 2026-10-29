// Fachada del calendario. Aquí viven el flujo OAuth (Google y Microsoft), la
// selección de calendario, la sincronización de tools con los agentes de voz
// y las operaciones genéricas (ocupación, reservar, cancelar, próximos
// eventos, listar calendarios), que se delegan al adaptador del proveedor vía
// adapters/calendar/registry.ts. No hay ramas por proveedor: cualquier cosa
// específica de Google u Outlook va en su adaptador, y cualquier cosa que
// dependa de las columnas google*/outlook* de Business va en ./conexion.ts.
import { randomBytes } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { consumirClave, guardarClave } from "../../lib/almacenTemporal.js";
import { getPublicWebhookBaseUrl } from "../../lib/serverUrl.js";
import { syncAgentToTelnyx } from "../../lib/telnyxAgentSync.js";
import {
  exchangeMicrosoftCode,
  getMicrosoftAuthUrl,
  getMicrosoftProfile,
  listMicrosoftCalendars,
  type MicrosoftCalendar,
} from "../../lib/microsoftGraph.js";
import {
  CalendarBusinessError,
  codigoDeReconexion,
  type CalendarBusinessErrorCode,
} from "../../adapters/calendar/errors.js";
import {
  DESCRIPTORES_DE_PROVEEDOR,
  normalizarProveedorDeCalendario,
  type CalendarBusyInterval,
  type CalendarBusyIntervalsResult,
  type CalendarConnection,
  type CalendarioDisponible,
  type ConexionActiva,
  type EventoCreado,
  type EventoProximo,
  type CalendarCredentials,
  type ResultadoDeBorrado,
  type VentanaDelEvento,
} from "../../adapters/calendar/CalendarProvider.js";
import {
  buildEventContent,
  buildImmediateReminderMinutes,
  hashDeIdempotencia,
  REMINDER_MINUTES_BEFORE_START,
} from "../../adapters/calendar/eventoDeCalendario.js";
import {
  crearClienteOAuthDeGoogle,
  isGoogleInvalidGrantError,
} from "../../adapters/calendar/google/GoogleCalendarProvider.js";
import { obtenerProveedorDeCalendario } from "../../adapters/calendar/registry.js";
import {
  conCallbackDeRotacion,
  estadoDeConexion,
  guardarConexionDeCalendario,
  resolverConexionDeCalendario,
  SELECT_CONEXION_DE_CALENDARIO,
} from "./conexion.js";

// Re-exports de compatibilidad: calendar/routes.ts y los tests importan estos
// nombres desde aquí; su definición vive ahora en adapters/calendar/.
export { CalendarBusinessError, isGoogleInvalidGrantError };
export type {
  CalendarBusinessErrorCode,
  CalendarBusyInterval,
  CalendarBusyIntervalsResult,
};

// El callback de OAuth es un endpoint público (Google/Microsoft lo llaman
// por redirect del navegador, sin nuestro JWT) — el `state` es la única
// defensa contra que alguien complete SU PROPIO código de autorización con
// el `state` (antes, businessId en claro) de OTRO negocio, sustituyendo su
// calendario conectado por el del atacante. Se genera un token opaco de un
// solo uso, ligado al businessId en el almacén temporal, y se consume (se
// lee y se borra de una vez) en el callback — un `state` reutilizado,
// caducado o inventado no resuelve a ningún negocio.
const CALENDAR_OAUTH_STATE_TTL_SECONDS = 10 * 60;

function claveDelStateDeCalendario(
  provider: "google" | "microsoft",
  state: string
): string {
  return `calendar_oauth_state:${provider}:${state}`;
}

async function createCalendarOAuthState(
  provider: "google" | "microsoft",
  businessId: string
): Promise<string> {
  const state = randomBytes(32).toString("base64url");
  await guardarClave(
    claveDelStateDeCalendario(provider, state),
    businessId,
    CALENDAR_OAUTH_STATE_TTL_SECONDS * 1000,
    { businessId }
  );
  return state;
}

async function consumeCalendarOAuthState(
  provider: "google" | "microsoft",
  state: string
): Promise<string | null> {
  return consumirClave(claveDelStateDeCalendario(provider, state));
}

/** Las operaciones reciben la conexión ya resuelta por conexion.ts: los
 * consumidores (voiceTools, el job, calendar/routes) no conocen columnas. */
type EntradaConConexion = { conexion: CalendarConnection };

/** Guardas comunes a las operaciones. Reproducen exactamente los textos y
 * códigos que antes tenía cada rama por proveedor:
 *  - sin credenciales → <P>_CALENDAR_RECONNECT_REQUIRED
 *    "El negocio no tiene conectado <nombre>."
 *  - sin calendario (solo posible con calendarIdPorDefecto null, hoy Outlook):
 *    reservar → BOOK_APPOINTMENT_FAILED
 *      "No se ha seleccionado un calendario de <nombreCorto>."
 *    resto → RECONNECT "El negocio no tiene conectado <nombre>." */
function exigirConexionActiva(
  conexion: CalendarConnection,
  operacion: "reservar" | "cancelar" | "proximos"
): ConexionActiva {
  const { nombre, nombreCorto } = DESCRIPTORES_DE_PROVEEDOR[conexion.provider];
  const errorDeReconexion = () =>
    new CalendarBusinessError(
      codigoDeReconexion(conexion.provider),
      `El negocio no tiene conectado ${nombre}.`,
      conexion.provider
    );
  // Mismos tres estados que estadoDeConexion(); se comprueban en línea para
  // que TypeScript estreche credentials/calendarId sin casts.
  if (!conexion.credentials) {
    throw errorDeReconexion();
  }
  if (!conexion.calendarId) {
    if (operacion === "reservar") {
      throw new CalendarBusinessError(
        "BOOK_APPOINTMENT_FAILED",
        `No se ha seleccionado un calendario de ${nombreCorto}.`
      );
    }
    throw errorDeReconexion();
  }
  return {
    provider: conexion.provider,
    calendarId: conexion.calendarId,
    ...conCallbackDeRotacion(conexion.credentials, conexion.businessId ?? null),
  } as ConexionActiva;
}

export class CalendarService {
  constructor() {}

  async getAuthUrl(businessId: string): Promise<string> {
    const state = await createCalendarOAuthState("google", businessId);
    const oauth2Client = crearClienteOAuthDeGoogle();
    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      // Scopes mínimos: calendar.events cubre list/get/insert/delete de citas
      // (voiceTools + CalendarService) y calendarlist.readonly cubre el
      // selector de calendario en Ajustes (listGoogleCalendars). Se evita
      // deliberadamente el scope completo "calendar" (gestión de
      // calendarios/ACL/settings que esta app nunca usa) porque es el más
      // amplio dentro de la categoría "sensitive" de Google — pedir solo lo
      // necesario agiliza la revisión de verificación OAuth (Google exige
      // justificar por qué no basta un scope más estrecho). Ningún scope de
      // Calendar está en la lista "restricted" de Google a día de hoy
      // (verificado en support.google.com/cloud/answer/13464325), así que
      // esto no evita una asesoría CASA — reduce el scope pedido al mínimo.
      scope: [
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
      ],
      state,
    });
    return url;
  }

  /** Callback de Google. Antes se conectaba directamente al calendario
   * «primary»; ahora, como Outlook y Apple, se guardan las credenciales SIN
   * confirmar y se devuelve la lista de calendarios para que el dueño elija
   * (POST /calendar/select). Hasta que elija, la recepcionista no reserva
   * (`conexionOperativa` es false con connected=false). Si la lista no se
   * puede obtener, se conecta a «primary» como siempre: mejor eso que dejar
   * al dueño a medias. */
  async handleCallback(
    code: string,
    state: string
  ): Promise<{ calendars: CalendarioDisponible[]; email: string | null }> {
    const businessId = await consumeCalendarOAuthState("google", state);
    if (!businessId) {
      throw new Error(
        "El enlace de autorización de Google ha caducado, ya se usó, o no es válido."
      );
    }

    const oauth2Client = crearClienteOAuthDeGoogle();

    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return { calendars: [], email: null };
    }
    const credenciales = {
      provider: "google" as const,
      refreshToken: tokens.refresh_token,
    };

    let calendars: CalendarioDisponible[];
    try {
      calendars = await obtenerProveedorDeCalendario("google").listarCalendarios(
        conCallbackDeRotacion(credenciales, businessId)
      );
    } catch (error) {
      console.error(
        `[Calendar] Google: no se pudo listar los calendarios del negocio ${businessId} tras autorizar; se conecta a "primary": ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      await guardarConexionDeCalendario(businessId, {
        provider: "google",
        credenciales,
        calendarId: "primary",
        conectado: true,
      });
      await this.syncCalendarToolsToAgents(businessId);
      return { calendars: [], email: null };
    }

    // En Google el id del calendario principal es el correo de la cuenta.
    const email = calendars.find((c) => c.primary)?.id ?? null;
    await guardarConexionDeCalendario(businessId, {
      provider: "google",
      credenciales,
      calendarId: null,
      conectado: false,
      userEmail: email,
    });
    return { calendars, email };
  }

  async getMicrosoftAuthUrl(businessId: string): Promise<string> {
    const state = await createCalendarOAuthState("microsoft", businessId);
    return getMicrosoftAuthUrl(state);
  }

  async handleMicrosoftCallback(code: string, state: string) {
    const businessId = await consumeCalendarOAuthState("microsoft", state);
    if (!businessId) {
      throw new Error(
        "El enlace de autorización de Microsoft ha caducado, ya se usó, o no es válido."
      );
    }

    const tokens = await exchangeMicrosoftCode(code);
    const profile = await getMicrosoftProfile(tokens.access_token);
    const calendars = await listMicrosoftCalendars(tokens.access_token);

    await guardarConexionDeCalendario(businessId, {
      provider: "outlook",
      credenciales: { provider: "outlook", refreshToken: tokens.refresh_token },
      conectado: false,
      userEmail: profile.mail ?? profile.userPrincipalName ?? null,
    });

    return {
      calendars,
      email: profile.mail ?? profile.userPrincipalName ?? null,
    } satisfies { calendars: MicrosoftCalendar[]; email: string | null };
  }

  async connectMicrosoftCalendar(businessId: string, calendarId: string) {
    const business = await guardarConexionDeCalendario(businessId, {
      provider: "outlook",
      calendarId,
      conectado: true,
    });
    await this.syncCalendarToolsToAgents(businessId);
    return business;
  }

  /** Calendarios de la cuenta conectada (paso de selección: aún puede no
   * haber calendarId). Sin credenciales lanza el RECONNECT del proveedor. */
  async listarCalendarios(
    conexion: CalendarConnection
  ): Promise<CalendarioDisponible[]> {
    if (!conexion.credentials) {
      throw new CalendarBusinessError(
        codigoDeReconexion(conexion.provider),
        `El negocio no tiene conectado ${DESCRIPTORES_DE_PROVEEDOR[conexion.provider].nombre}.`,
        conexion.provider
      );
    }
    return obtenerProveedorDeCalendario(conexion.provider).listarCalendarios(
      conCallbackDeRotacion(conexion.credentials, conexion.businessId ?? null)
    );
  }

  /** @deprecated Usa listarCalendarios(conexion); se conserva por los tests
   * antiguos de service.test.ts. */
  async listGoogleCalendars(googleRefreshToken: string) {
    return obtenerProveedorDeCalendario("google").listarCalendarios(
      conCallbackDeRotacion({
        provider: "google",
        refreshToken: googleRefreshToken,
      })
    );
  }

  /** @deprecated Usa listarCalendarios(conexion); se conserva por los tests
   * antiguos de service.test.ts. */
  async listOutlookCalendars(outlookRefreshToken: string) {
    return obtenerProveedorDeCalendario("outlook").listarCalendarios(
      conCallbackDeRotacion({
        provider: "outlook",
        refreshToken: outlookRefreshToken,
      })
    );
  }

  /** Alta sin OAuth (CalDAV): valida las credenciales listando los
   * calendarios de la cuenta —un 401 sale como CALDAV_CALENDAR_RECONNECT_REQUIRED
   * y la ruta lo convierte en 400 "usuario o contraseña incorrectos"—, guarda
   * la conexión sin calendario elegido y devuelve la lista para que el panel
   * llame a POST /calendar/select. Mismo contrato que handleMicrosoftCallback. */
  async conectarConCredenciales(
    businessId: string,
    credenciales: CalendarCredentials
  ): Promise<{ calendars: CalendarioDisponible[]; email: string | null }> {
    const { provider } = credenciales;
    if (
      DESCRIPTORES_DE_PROVEEDOR[provider].tipoDeAutorizacion !== "credenciales"
    ) {
      throw new CalendarBusinessError(
        "BOOK_APPOINTMENT_FAILED",
        `${DESCRIPTORES_DE_PROVEEDOR[provider].nombre} se conecta con OAuth, no con credenciales.`
      );
    }
    // Sin callback de rotación: las credenciales de tipo usuario+contraseña
    // no rotan.
    const calendars = await obtenerProveedorDeCalendario(
      provider
    ).listarCalendarios({ credentials: credenciales } as never);
    const email =
      credenciales.provider === "caldav" ? credenciales.username : null;
    await guardarConexionDeCalendario(businessId, {
      provider,
      credenciales,
      conectado: false,
      userEmail: email,
    });
    return { calendars, email };
  }

  /** Despacho de POST /calendar/select por el proveedor guardado del negocio.
   * Conserva la asimetría histórica: Google no resincroniza las tools; el
   * resto (Outlook, CalDAV) sí. */
  async seleccionarCalendario(businessId: string, calendarId: string) {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { calendarProvider: true },
    });
    const provider = normalizarProveedorDeCalendario(
      business?.calendarProvider
    );
    if (provider === "google") {
      return this.selectGoogleCalendar(businessId, calendarId);
    }
    if (provider === "outlook") {
      return this.connectMicrosoftCalendar(businessId, calendarId);
    }
    // En CalDAV el `calendarId` ES una URL absoluta que luego se visita con
    // las credenciales del negocio. Guardar la que venga del formulario
    // permitiría apuntarla a cualquier sitio después de haber conectado un
    // servidor legítimo, así que solo se acepta si sale del descubrimiento.
    if (provider === "caldav") {
      const conexion = resolverConexionDeCalendario(
        await prisma.business.findUnique({
          where: { id: businessId },
          select: SELECT_CONEXION_DE_CALENDARIO,
        })
      );
      const disponibles = await this.listarCalendarios(conexion);
      if (!disponibles.some((c) => c.id === calendarId)) {
        throw new CalendarBusinessError(
          "BOOK_APPOINTMENT_FAILED",
          "Ese calendario no está entre los de tu cuenta. Vuelve a conectar el calendario y elige uno de la lista."
        );
      }
    }
    const actualizado = await guardarConexionDeCalendario(businessId, {
      provider,
      calendarId,
      conectado: true,
    });
    await this.syncCalendarToolsToAgents(businessId);
    return actualizado;
  }

  /** A diferencia de connectMicrosoftCalendar, no resincroniza las tools de
   * los agentes (asimetría histórica que se conserva a propósito). */
  async selectGoogleCalendar(businessId: string, calendarId: string) {
    return guardarConexionDeCalendario(businessId, {
      provider: "google",
      calendarId,
      conectado: true,
    });
  }

  /**
   * `end_call` no hace falta aquí: `buildTelnyxAssistantPayload` ya añade
   * la tool `hangup` nativa de Telnyx a todos los assistants por defecto
   * (ver telnyxAssistantPayload.ts).
   *
   * `call_control_id` llega por un header custom templado con la variable
   * de sistema `{{call_control_id}}` — confirmado con una reserva real de
   * punta a punta el 2026-09-12 (ver server.ts, ruta de tools). Se probó
   * también por query string a la vez por si el header no se resolvía;
   * como el header sí funcionó, se quitó la query string para no mandar
   * dos veces el mismo dato.
   */
  async syncCalendarToolsToAgents(
    businessId: string,
    options?: { strict?: boolean }
  ) {
    const errors: Error[] = [];
    const recordError = (message: string, error?: unknown) => {
      if (!options?.strict) return;
      errors.push(error instanceof Error ? error : new Error(message));
    };

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    });

    if (!business) {
      const message = `[Calendar] No se encontró negocio ${businessId} para sincronizar tools`;
      console.error(message);
      recordError(message);
      if (errors.length > 0) {
        throw new AggregateError(errors, message);
      }
      return;
    }

    const agents = await prisma.agent.findMany({
      where: { businessId, deletedAt: null },
    });

    // Una sola vez para todo el negocio: syncAgentToTelnyx ya recorre todos
    // los agentes con telnyxAssistantId.
    const telnyxAgents = agents.filter((agent) => agent.telnyxAssistantId);
    if (telnyxAgents.length > 0) {
      const baseUrl = getPublicWebhookBaseUrl();
      if (!baseUrl) {
        const message = `[Calendar] Falta BASE_URL; no se pueden sincronizar tools de Telnyx para ${businessId}`;
        console.error(message);
        recordError(message);
      } else {
        // syncAgentToTelnyx registra siempre las tools de voz
        // (buildTelnyxVoiceTools) y nunca lanza (un fallo de Telnyx no debe
        // poder bloquear este flujo) — en modo strict se comprueba
        // telnyxSyncError después para no dar por buena una sincronización
        // que en realidad falló en silencio.
        await syncAgentToTelnyx(businessId, prisma);
        console.log(
          `[Calendar] Tools de calendario sincronizadas en Telnyx para el negocio ${businessId}`
        );

        if (options?.strict) {
          const refreshed = await prisma.agent.findMany({
            where: { id: { in: telnyxAgents.map((agent) => agent.id) } },
            select: { id: true, telnyxSyncError: true },
          });
          for (const agent of refreshed) {
            if (agent.telnyxSyncError) {
              const message = `[Calendar] Fallo sincronizando tools de Telnyx en el agente ${agent.id}: ${agent.telnyxSyncError}`;
              console.error(message);
              recordError(message);
            }
          }
        }
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(
        errors,
        `No se pudieron sincronizar las tools de calendario de ${errors.length} agente(s).`
      );
    }
  }

  async getUpcomingEvents(
    conexion: CalendarConnection,
    maxResults = 5
  ): Promise<EventoProximo[]> {
    const safeMaxResults = Math.min(Math.max(Math.trunc(maxResults), 1), 15);
    const activa = exigirConexionActiva(conexion, "proximos");
    return obtenerProveedorDeCalendario(activa.provider).listarProximosEventos(
      activa,
      safeMaxResults
    );
  }

  /**
   * Bloques ocupados del calendario REALMENTE conectado dentro de
   * [timeMin, timeMax) — la disponibilidad (checkAvailability en
   * availability.ts) solo consultaba las reservas guardadas en Postgres,
   * nunca el calendario en sí: una cita metida a mano en Google/Outlook no
   * bloqueaba el hueco, y cancelar una reserva desde el propio calendario
   * tampoco la liberaba aquí. Se degrada a "sin bloqueos" (array vacío) ante
   * cualquier fallo — nunca debe poder bloquear TODAS las reservas porque el
   * calendario esté lento o caído un momento; el propio Booking de Postgres
   * sigue siendo la red de seguridad mínima en ese caso. NUNCA lanza.
   */
  async getBusyIntervals(
    input: EntradaConConexion & { timeMin: Date; timeMax: Date }
  ): Promise<CalendarBusyIntervalsResult> {
    const { conexion } = input;
    if (estadoDeConexion(conexion) !== "ok") {
      return { intervals: [], calendarAvailabilityKnown: false };
    }
    try {
      const activa = exigirConexionActiva(conexion, "proximos");
      const intervals = await obtenerProveedorDeCalendario(
        activa.provider
      ).listarOcupacion(activa, {
        timeMin: input.timeMin,
        timeMax: input.timeMax,
      });
      return { intervals, calendarAvailabilityKnown: true };
    } catch (err) {
      console.error(
        "[Calendar] No se pudo consultar la ocupación real del calendario, se ignora para esta comprobación:",
        err instanceof Error ? err.message : err
      );
      return { intervals: [], calendarAvailabilityKnown: false };
    }
  }

  async bookAppointment(
    input: EntradaConConexion & {
      clientName: string;
      startDateTime: string;
      durationMinutes?: number;
      clientEmail?: string;
      clientPhone?: string | null;
      serviceNames?: string[] | null;
      professionalName?: string | null;
      /** Zona del negocio; "Europe/Madrid" por defecto. Inerte para Google
       * y Outlook (los dos mandan la hora en UTC). */
      timezone?: string;
      /** Clave estable por llamada/reserva para que un timeout no cree dos
       * eventos externos. */
      idempotencyKey?: string;
    }
  ): Promise<EventoCreado> {
    // Agenda de Alhabla (PLAN-AGENDA-ALHABLA.md): la cita vive solo en
    // Postgres. No hay evento que crear, y así los cinco caminos que
    // reservan (voz, Gestor, lista de espera, reintento, panel) siguen
    // llamando aquí antes de escribir el Booking sin tener que distinguir.
    if ("agendaPropia" in input.conexion && input.conexion.agendaPropia) {
      return { id: null, htmlLink: null };
    }
    const activa = exigirConexionActiva(input.conexion, "reservar");
    const startTime = new Date(input.startDateTime);
    const endTime = new Date(
      startTime.getTime() + (input.durationMinutes ?? 30) * 60000
    );
    const { summary, description } = buildEventContent(input);

    return obtenerProveedorDeCalendario(activa.provider).crearEvento(activa, {
      summary,
      description,
      startTime,
      endTime,
      cliente: {
        nombre: input.clientName,
        telefono: input.clientPhone ?? null,
        email: input.clientEmail ?? null,
      },
      recordatorioInmediatoMinutos: buildImmediateReminderMinutes(startTime),
      recordatorioPrevioMinutos: REMINDER_MINUTES_BEFORE_START,
      zonaHoraria: input.timezone ?? "Europe/Madrid",
      idempotencyDigest: input.idempotencyKey
        ? hashDeIdempotencia(input.idempotencyKey)
        : null,
    });
  }

  /** Borra el evento externo de una cita (cancelada, movida o que no se
   * pudo guardar). Devuelve lo que pasó en el calendario: «no_estaba» no es
   * un fallo (puede haberlo borrado el dueño a mano o un reintento), pero el
   * llamador lo registra con registrarBorradoDeEvento (./borradoDeEvento.ts)
   * porque también puede ser un evento vivo en otra dirección. `ventana` es
   * la hora del evento: CalDAV la usa para buscarlo por UID. */
  async cancelAppointment(
    input: EntradaConConexion & {
      eventId: string;
      ventana?: VentanaDelEvento;
    }
  ): Promise<ResultadoDeBorrado> {
    const activa = exigirConexionActiva(input.conexion, "cancelar");
    return obtenerProveedorDeCalendario(activa.provider).borrarEvento(
      activa,
      input.eventId,
      input.ventana
    );
  }
}

export const calendarService = new CalendarService();
