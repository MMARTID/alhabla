import { CalendarDays } from "lucide-react";
import { CitaEnElCalendario, Fuentes, PaginaGuia, Pasos, Seccion, Texto } from "@/components/pagina-guia";
import { metadataDePagina } from "@/lib/seo";
import { IconoGoogleCalendar } from "../iconos-de-calendario";

/**
 * Google Calendar (2026-10-20; recortada a guía de pasos el 2026-10-29).
 * Búsqueda: «agenda de citas google calendar». Los permisos y la regla de
 * ocupado son los del adaptador (backend/src/adapters/calendar/google/):
 * `calendar.events` + `calendar.calendarlist.readonly`, nunca el permiso
 * completo; cuenta como ocupado todo salvo lo cancelado y los eventos con
 * hora marcados como «Disponible» (transparent); el día completo siempre.
 * Sin conexión operativa no ofrece horas y toma nota (AGENTS.md § Modo de
 * agenda). Los avisos del evento: uno al crearse y otro 2 h antes
 * (eventoDeCalendario.ts).
 */
const ruta = "/integraciones/google-calendar";
const titulo = "Google Calendar para las citas de tu negocio";
const descripcion =
  "Tu recepcionista de IA mira tu Google Calendar antes de dar una hora y apunta ahí la cita, con permiso solo sobre los eventos. Cómo conectarlo en cuatro pasos.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

export default function GoogleCalendarPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      migas={[
        { name: "Integraciones", path: "/integraciones" },
        { name: "Google Calendar", path: ruta },
      ]}
      etiqueta={{ icono: CalendarDays, texto: "Google Calendar" }}
      titulo={titulo}
      descripcion={descripcion}
      ubicacion="integracion_google"
      entradilla={
        <p>
          Si tu agenda vive en Google Calendar, no necesitas otra. La recepcionista mira tu calendario antes de dar una
          hora y apunta ahí la cita, con el servicio, el cliente y quién la hace.
        </p>
      }
      pieza={
        <CitaEnElCalendario
          calendario={{ icono: <IconoGoogleCalendar className="h-4 w-4" />, nombre: "Peluquería Sol" }}
          dia="Jueves, 5 de noviembre"
          desde={16}
          hasta={19}
          ocupado={{ inicio: 16, fin: 17, titulo: "Médico (apuntado a mano)" }}
          cita={{
            inicio: 17.5,
            fin: 19,
            titulo: "Mechas — Lucía Romero",
            detalle: [
              ["Cliente", "Lucía Romero"],
              ["Teléfono", "+34 790 12 34 56"],
              ["Servicio", "Mechas"],
              ["Profesional", "Marta"],
            ],
          }}
        />
      }
      faqs={[
        {
          question: "¿Sirve una cuenta de Gmail o hace falta Google Workspace?",
          answer:
            "Sirven las dos. En una cuenta de empresa, el administrador puede tener bloqueado que apps externas usen el calendario; si al conectar sale ese aviso, es eso.",
        },
        {
          question: "Ya uso el calendario de citas de Google. ¿Chocan?",
          answer:
            "No. Esas citas entran en tu calendario como cualquier evento, así que la recepcionista no ofrece esas horas por teléfono.",
        },
        {
          question: "¿Conecto mi calendario personal?",
          answer:
            "Mejor uno solo para el negocio dentro de tu cuenta («Salón», por ejemplo). Si quieres que algo personal bloquee horas, apúntalo ahí o como día completo.",
        },
        {
          question: "¿Me entero cuando entra una cita?",
          answer:
            "Sí. El evento trae un aviso al crearse y otro dos horas antes. Si vinculas tu móvil, también te llega por WhatsApp.",
        },
      ]}
      relacionadas={[
        { href: "/integraciones/outlook", titulo: "Outlook y Microsoft 365" },
        { href: "/integraciones/icloud", titulo: "Calendario de Apple (iCloud)" },
        { href: "/integraciones/whatsapp", titulo: "Lo que le llega a tu cliente por WhatsApp" },
      ]}
      cierre="La cita entra en tu Google Calendar aunque estés con las manos ocupadas."
    >
      <Seccion
        titulo="Conectarlo, paso a paso"
        entradilla={<p>Una vez, al darte de alta o más tarde desde «Agente» en el panel.</p>}
      >
        <Pasos
          pasos={[
            { titulo: "Pulsa «Google Calendar»", texto: "Se abre la ventana de Google para elegir la cuenta del negocio." },
            {
              titulo: "Acepta los dos permisos",
              texto:
                "Ver y editar los eventos, y ver la lista de tus calendarios para elegir uno. Ni tu correo, ni tus contactos, ni el permiso completo sobre el calendario.",
            },
            { titulo: "Elige el calendario", texto: "El principal o uno del negocio. Se cambia luego sin volver a conectar." },
            {
              titulo: "Haz una prueba",
              texto: "Apunta un evento falso mañana a las 11:00, llama a tu número y pide esa hora. Si te ofrece otra, lee bien tu agenda.",
            },
          ]}
        />
      </Seccion>

      <Seccion fondo titulo="Qué cuenta como hora ocupada">
        <Texto>
          <p>
            Todo lo que tengas con hora, salvo lo que marques como «Disponible» y lo cancelado. Los eventos de día
            completo («Vacaciones») bloquean el día entero, aunque Google los cree como disponibles. Además cuentan tu
            horario y las ausencias de tu equipo.
          </p>
        </Texto>
      </Seccion>

      <Seccion titulo="Lo que no toca, y cómo quitarle el acceso">
        <Texto>
          <p>
            Tus eventos de antes solo los lee para saber cuándo estás ocupado: cambia únicamente las citas que crea ella.
          </p>
          <p>
            Para cortarle el acceso, entra en tu cuenta de Google, en las conexiones con aplicaciones de terceros, y quita
            a Alhabla. Desde ese momento la recepcionista deja de dar horas, toma nota de lo que le piden y el panel te
            pide reconectar.
          </p>
        </Texto>
      </Seccion>

      <Fuentes
        consultadas="2026-10-20"
        fuentes={[
          { nombre: "Google: alcances de la API de Google Calendar", url: "https://developers.google.com/workspace/calendar/api/auth" },
          { nombre: "Google: gestionar las vinculaciones con aplicaciones de otros desarrolladores", url: "https://support.google.com/accounts/answer/13533235?hl=es" },
          { nombre: "Google: crear un calendario de citas", url: "https://support.google.com/calendar/answer/10729749?hl=es" },
        ]}
      />
    </PaginaGuia>
  );
}
