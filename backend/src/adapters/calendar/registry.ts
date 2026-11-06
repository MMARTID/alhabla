import type {
  CalendarProvider,
  CalendarProviderId,
} from "./CalendarProvider.js";
import { GoogleCalendarProvider } from "./google/GoogleCalendarProvider.js";
import { OutlookCalendarProvider } from "./outlook/OutlookCalendarProvider.js";
import { CaldavCalendarProvider } from "./caldav/CaldavCalendarProvider.js";
import {
  calendariosFalsosActivos,
  conCalendarioFalso,
} from "./falso/calendarioFalso.js";

// Singletons sin estado (como telnyxAdapter): el estado por operación
// (cliente OAuth de Google, access token de Outlook) vive dentro de cada
// llamada. Este fichero importa SOLO los adaptadores; la persistencia de
// credenciales rotadas se inyecta por conexión, no por constructor.
const reales: { [P in CalendarProviderId]: CalendarProvider<P> } = {
  google: new GoogleCalendarProvider(),
  outlook: new OutlookCalendarProvider(),
  caldav: new CaldavCalendarProvider(),
};

// En backend-sim (CALENDARIOS_FALSOS=1, nunca en producción) cada adaptador
// va envuelto: las conexiones con credenciales `falso:` usan el calendario
// falso de las pruebas de punta a punta (falso/calendarioFalso.ts); las
// demás, el real.
const registro: { [P in CalendarProviderId]: CalendarProvider<P> } =
  calendariosFalsosActivos()
    ? {
        google: conCalendarioFalso(reales.google),
        outlook: conCalendarioFalso(reales.outlook),
        caldav: conCalendarioFalso(reales.caldav),
      }
    : reales;

/** Sin fallback: el id ya viene normalizado por
 * normalizarProveedorDeCalendario. */
export function obtenerProveedorDeCalendario<P extends CalendarProviderId>(
  id: P
): CalendarProvider<P> {
  return registro[id] as CalendarProvider<P>;
}
