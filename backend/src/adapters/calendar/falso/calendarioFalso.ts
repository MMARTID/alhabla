// Calendario falso para las pruebas de punta a punta en backend-sim
// (PLAN-AGENDA-PRINCIPAL.md, «Cómo se comprueba»). Sustituye al adaptador real
// SOLO para las conexiones cuyas credenciales empiezan por `falso:` (el
// refresh token de Google/Outlook o la contraseña de aplicación de Apple), y
// SOLO con CALENDARIOS_FALSOS=1 fuera de producción: las simulaciones de
// otras sesiones con calendarios reales no cambian.
//
// Los eventos viven en el almacén temporal de Postgres (`claves_temporales`,
// clave `calendario-falso:<marca>`), así que el MCP de desarrollo los lee y
// los cambia (backend/scripts/sim/calendarioFalso.ts): apuntar a mano, mover o
// borrar un evento como haría el dueño, o poner el calendario «caido» (lanza
// un error cualquiera) o «revocado» (lanza el error de reconexión, como un
// invalid_grant).
import { guardarClave, leerClave } from "../../../lib/almacenTemporal.js";
import type {
  CalendarBusyInterval,
  CalendarCredentials,
  CalendarProvider,
  CalendarProviderId,
  CalendarioDisponible,
  ConexionActiva,
  CredencialesActivas,
  EventoCreado,
  EventoProximo,
  NuevoEventoDeCalendario,
  ResultadoDeBorrado,
} from "../CalendarProvider.js";
import { CalendarBusinessError, codigoDeReconexion } from "../errors.js";

export const PREFIJO_DE_CREDENCIAL_FALSA = "falso:";
/** Un mes: lo justo para una tanda de pruebas; se renueva al escribir. */
const VIGENCIA_MS = 30 * 24 * 60 * 60 * 1000;

export type EstadoDelCalendarioFalso = "ok" | "caido" | "revocado";

export type EventoFalso = {
  id: string;
  summary: string;
  description: string;
  inicio: string;
  fin: string;
  /** Lo creó Alhabla (una copia) o se apuntó «a mano» desde el MCP. */
  origen: "alhabla" | "a_mano";
};

export type CalendarioFalso = {
  estado: EstadoDelCalendarioFalso;
  eventos: EventoFalso[];
};

/** Fuera de producción y con CALENDARIOS_FALSOS=1 (backend-sim). */
export function calendariosFalsosActivos(): boolean {
  return (
    process.env.CALENDARIOS_FALSOS === "1" &&
    process.env.NODE_ENV !== "production"
  );
}

/** La marca de una credencial falsa (`falso:<algo>`), o null si es real. */
export function marcaDeCredencialFalsa(
  credentials: CalendarCredentials | null | undefined
): string | null {
  if (!credentials) return null;
  const secreto =
    credentials.provider === "caldav"
      ? credentials.appPassword
      : credentials.refreshToken;
  return secreto.startsWith(PREFIJO_DE_CREDENCIAL_FALSA) ? secreto : null;
}

const claveDe = (marca: string) => `calendario-falso:${marca}`;

export async function leerCalendarioFalso(
  marca: string
): Promise<CalendarioFalso> {
  const crudo = await leerClave(claveDe(marca));
  if (!crudo) return { estado: "ok", eventos: [] };
  return JSON.parse(crudo) as CalendarioFalso;
}

export async function guardarCalendarioFalso(
  marca: string,
  calendario: CalendarioFalso
): Promise<void> {
  await guardarClave(claveDe(marca), JSON.stringify(calendario), VIGENCIA_MS);
}

async function exigirQueResponda(
  marca: string,
  provider: CalendarProviderId
): Promise<CalendarioFalso> {
  const calendario = await leerCalendarioFalso(marca);
  if (calendario.estado === "revocado") {
    throw new CalendarBusinessError(
      codigoDeReconexion(provider),
      "Calendario falso revocado (simula un invalid_grant).",
      provider
    );
  }
  if (calendario.estado === "caido") {
    throw new Error("Calendario falso caído (simula un 503 del proveedor).");
  }
  return calendario;
}

/** El adaptador falso, con el id del proveedor al que sustituye. */
export function proveedorFalso<P extends CalendarProviderId>(
  id: P
): CalendarProvider<P> {
  const marcaDe = (conexion: CredencialesActivas<P>) =>
    marcaDeCredencialFalsa(conexion.credentials) as string;
  return {
    id,
    async listarCalendarios(): Promise<CalendarioDisponible[]> {
      return [{ id: "primary", name: "Calendario falso", primary: true }];
    },
    async listarProximosEventos(
      conexion: ConexionActiva<P>,
      maxResults: number
    ): Promise<EventoProximo[]> {
      const calendario = await exigirQueResponda(marcaDe(conexion), id);
      const ahora = Date.now();
      return calendario.eventos
        .filter((evento) => new Date(evento.fin).getTime() > ahora)
        .sort((a, b) => a.inicio.localeCompare(b.inicio))
        .slice(0, maxResults)
        .map((evento) => ({
          id: evento.id,
          summary: evento.summary,
          start: evento.inicio,
          end: evento.fin,
          location: null,
          htmlLink: null,
        }));
    },
    async listarOcupacion(
      conexion: ConexionActiva<P>,
      ventana: { timeMin: Date; timeMax: Date }
    ): Promise<CalendarBusyInterval[]> {
      const calendario = await exigirQueResponda(marcaDe(conexion), id);
      return calendario.eventos
        .filter(
          (evento) =>
            new Date(evento.fin) > ventana.timeMin &&
            new Date(evento.inicio) < ventana.timeMax
        )
        .map((evento) => ({
          start: new Date(evento.inicio),
          end: new Date(evento.fin),
          externalEventId: evento.id,
        }));
    },
    async crearEvento(
      conexion: ConexionActiva<P>,
      evento: NuevoEventoDeCalendario
    ): Promise<EventoCreado> {
      const marca = marcaDe(conexion);
      const calendario = await exigirQueResponda(marca, id);
      const eventId = evento.idempotencyDigest
        ? `falso${evento.idempotencyDigest.slice(0, 24)}`
        : `falso${Math.random().toString(16).slice(2, 14)}`;
      const ya = calendario.eventos.find((e) => e.id === eventId);
      if (!ya) {
        calendario.eventos.push({
          id: eventId,
          summary: evento.summary,
          description: evento.description,
          inicio: evento.startTime.toISOString(),
          fin: evento.endTime.toISOString(),
          origen: "alhabla",
        });
        await guardarCalendarioFalso(marca, calendario);
      }
      return { id: eventId, htmlLink: null };
    },
    async borrarEvento(
      conexion: ConexionActiva<P>,
      eventId: string
    ): Promise<ResultadoDeBorrado> {
      const marca = marcaDe(conexion);
      const calendario = await exigirQueResponda(marca, id);
      const antes = calendario.eventos.length;
      calendario.eventos = calendario.eventos.filter((e) => e.id !== eventId);
      if (calendario.eventos.length === antes) {
        return { resultado: "no_estaba", estado: 404 };
      }
      await guardarCalendarioFalso(marca, calendario);
      return { resultado: "borrado" };
    },
  };
}

/**
 * El adaptador real envuelto: cada operación mira si la conexión trae una
 * credencial falsa y, si es así, va al falso. Solo lo monta el registro con
 * calendariosFalsosActivos().
 */
export function conCalendarioFalso<P extends CalendarProviderId>(
  real: CalendarProvider<P>
): CalendarProvider<P> {
  const falso = proveedorFalso(real.id);
  const elegir = (conexion: CredencialesActivas<P>) =>
    marcaDeCredencialFalsa(conexion.credentials) ? falso : real;
  return {
    id: real.id,
    listarCalendarios: (cuenta) => elegir(cuenta).listarCalendarios(cuenta),
    listarProximosEventos: (conexion, max) =>
      elegir(conexion).listarProximosEventos(conexion, max),
    listarOcupacion: (conexion, ventana) =>
      elegir(conexion).listarOcupacion(conexion, ventana),
    crearEvento: (conexion, evento) =>
      elegir(conexion).crearEvento(conexion, evento),
    borrarEvento: (conexion, eventId, ventana) =>
      elegir(conexion).borrarEvento(conexion, eventId, ventana),
  };
}
