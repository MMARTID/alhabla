import type { Business, CalendarProviderId, ModoDeAgenda } from "./types";

/** Estado del calendario de un negocio tal como lo necesita el panel: quién
 * es el proveedor activo, si está conectado, si la conexión caducó, cómo
 * llamarlo y, desde PLAN-AGENDA-ALHABLA.md, en qué modo reserva. Única
 * fuente de esta regla (antes estaba copiada en cuatro componentes como
 * `=== "outlook" ? ... : ...`, que no sabía pintar Apple). */
export type CalendarState = {
  provider: CalendarProviderId;
  /** Nombre completo: "Google Calendar", "Outlook Calendar", "Calendario de Apple". */
  label: string;
  /** Nombre corto para frases: "Google", "Outlook", "Apple". */
  shortLabel: string;
  /** Hay un calendario EXTERNO conectado y en uso. En la agenda de Alhabla es
   * false aunque quede una conexión antigua: el backend la ignora. */
  connected: boolean;
  /** Hubo una conexión y se rompió (token caducado, contraseña revocada). */
  expired: boolean;
  /** Cuenta conectada cuando el proveedor la da (Outlook, Apple). */
  accountEmail: string | null;
  /** Dónde abre el negocio su agenda en el navegador. */
  webUrl: string;
  /** `Business.modoDeAgenda`; ausente en la respuesta = `sin_elegir`. */
  mode: ModoDeAgenda;
  /** El negocio reserva en la agenda de Alhabla, sin calendario externo. */
  alhabla: boolean;
  /** La recepcionista, el Gestor y el panel pueden reservar y mover citas:
   * agenda de Alhabla o calendario externo conectado. Sin esto la
   * recepcionista atiende y toma nota, pero no da hora. */
  bookable: boolean;
};

export const CALENDAR_PROVIDER_INFO: Record<
  CalendarProviderId,
  { label: string; shortLabel: string; webUrl: string }
> = {
  google: {
    label: "Google Calendar",
    shortLabel: "Google",
    webUrl: "https://calendar.google.com/calendar/u/0/r/agenda",
  },
  outlook: {
    label: "Outlook Calendar",
    shortLabel: "Outlook",
    webUrl: "https://outlook.office.com/calendar/",
  },
  caldav: {
    label: "Calendario de Apple",
    shortLabel: "Apple",
    webUrl: "https://www.icloud.com/calendar/",
  },
};

/** Nombre visible del modo `alhabla` (decisión D6 del plan). */
export const NOMBRE_AGENDA_DE_ALHABLA = "Agenda de Alhabla";

export function normalizeCalendarProvider(
  value: string | null | undefined
): CalendarProviderId {
  return value === "outlook" || value === "caldav" ? value : "google";
}

export function normalizeModoDeAgenda(
  value: string | null | undefined
): ModoDeAgenda {
  return value === "alhabla" || value === "externo" ? value : "sin_elegir";
}

/** Usa `activeCalendar` (contrato nuevo) y, si la respuesta aún no lo trae,
 * cae a los campos google* y outlook* antiguos. */
export function getCalendarState(
  business: Pick<
    Business,
    | "calendarProvider"
    | "activeCalendar"
    | "modoDeAgenda"
    | "googleCalendarConnected"
    | "googleCalendarDisconnectedAt"
    | "outlookCalendarConnected"
    | "outlookCalendarDisconnectedAt"
    | "outlookUserEmail"
  >
): CalendarState {
  const provider = normalizeCalendarProvider(business.calendarProvider);
  const info = CALENDAR_PROVIDER_INFO[provider];
  const mode = normalizeModoDeAgenda(business.modoDeAgenda);
  const alhabla = mode === "alhabla";

  const externo =
    business.activeCalendar !== undefined
      ? {
          connected: business.activeCalendar?.connected === true,
          expired: business.activeCalendar?.disconnectedAt != null,
          accountEmail: business.activeCalendar?.accountEmail ?? null,
        }
      : provider === "outlook"
        ? {
            connected: business.outlookCalendarConnected === true,
            expired: business.outlookCalendarDisconnectedAt != null,
            accountEmail: business.outlookUserEmail ?? null,
          }
        : provider === "google"
          ? {
              connected: business.googleCalendarConnected === true,
              expired: business.googleCalendarDisconnectedAt != null,
              accountEmail: null,
            }
          : { connected: false, expired: false, accountEmail: null };

  // En la agenda de Alhabla la conexión externa que quede no cuenta: ni
  // «conectado» ni «caducado», que llevarían a pedir reconectar algo que no
  // se usa.
  const connected = alhabla ? false : externo.connected;
  const expired = alhabla ? false : externo.expired;
  return {
    provider,
    label: info.label,
    shortLabel: info.shortLabel,
    connected,
    expired,
    accountEmail: alhabla ? null : externo.accountEmail,
    webUrl: info.webUrl,
    mode,
    alhabla,
    bookable: alhabla || connected,
  };
}

/** Proveedor al que apunta un código *_CALENDAR_RECONNECT_REQUIRED. */
export function providerFromReconnectCode(
  code: string | undefined
): CalendarProviderId {
  if (!code) return "google";
  const id = code.replace(/_CALENDAR_RECONNECT_REQUIRED$/, "").toLowerCase();
  return normalizeCalendarProvider(id);
}
