import { CalendarDays } from "lucide-react";
import { Fuentes, Nota, PaginaGuia, Pasos, Seccion, Tabla, Tarjetas, Texto } from "@/components/pagina-guia";
import { metadataDePagina } from "@/lib/seo";

/**
 * Google Calendar (2026-10-20). Búsqueda real: «agenda de citas google
 * calendar» sale 2.ª al escribir «agenda de citas». Los permisos y la regla de
 * ocupado son los del adaptador (backend/src/adapters/calendar/google/):
 * `calendar.events` + `calendar.calendarlist.readonly`, nunca el permiso
 * completo; cuenta como ocupado todo salvo lo cancelado y los eventos con
 * hora marcados como «Disponible» (transparent); el día completo siempre.
 */
const ruta = "/integraciones/google-calendar";
const titulo = "Google Calendar para las citas de tu negocio";
const descripcion =
  "Tu recepcionista de IA reserva en tu Google Calendar, respeta lo que ya tienes apuntado y solo pide permiso sobre los eventos. Cómo conectarlo.";

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
          Si tu agenda ya vive en Google Calendar, no necesitas otra. Alhabla contesta el teléfono, mira tu calendario
          antes de dar una hora y apunta ahí la cita. Tú la ves en el móvil como cualquier otro evento.
        </p>
      }
      faqs={[
        {
          question: "¿Sirve una cuenta de Gmail normal o hace falta Google Workspace?",
          answer:
            "Sirven las dos. Con una cuenta de empresa de Google Workspace, el administrador puede tener restringido que apps externas accedan al calendario; si al conectar sale un aviso de acceso bloqueado, es eso.",
        },
        {
          question: "Ya uso el calendario de citas de Google Calendar. ¿Chocan?",
          answer:
            "No. Las citas que entran por tu calendario de citas de Google se apuntan en tu calendario y Alhabla las ve como horas ocupadas. Por teléfono no ofrecerá esas horas.",
        },
        {
          question: "¿Puedo quitarle el acceso a Alhabla cuando quiera?",
          answer:
            "Sí, desde tu cuenta de Google, en el apartado de vinculaciones con aplicaciones de otros desarrolladores. A partir de ese momento la recepcionista deja de reservar y el panel te pide reconectar.",
        },
        {
          question: "¿Tiene que ser mi calendario personal?",
          answer:
            "No conviene. Lo más cómodo es crear un calendario solo para el negocio dentro de tu cuenta y elegirlo al conectar. Si quieres que tus planes personales bloqueen horas, apúntalos en ese mismo calendario o como día completo.",
        },
        {
          question: "¿La cita sale con el nombre del cliente?",
          answer:
            "Sí: el evento lleva el servicio, el nombre de quien llamó y el profesional, con la duración del servicio y dos avisos antes de la hora.",
        },
        {
          question: "¿Cambia algo si dejo la reserva de Google y me paso a Outlook?",
          answer:
            "Desde el panel cambias de proveedor. Las citas futuras que reservó Alhabla siguen donde se crearon, y la recepcionista las cancela en ese calendario aunque ya no sea el activo.",
        },
      ]}
      relacionadas={[
        { href: "/integraciones/outlook", titulo: "Outlook y Microsoft 365" },
        { href: "/integraciones/icloud", titulo: "Calendario de Apple (iCloud)" },
        { href: "/blog/reservas-fuera-de-horario", titulo: "Reservas fuera de horario", texto: "Lo que entra de noche y en festivos, directo a tu calendario." },
        { href: "/herramientas/plantillas-recordatorio-de-cita", titulo: "Plantillas de recordatorio de cita" },
      ]}
      cierre="Tu Google Calendar, lleno por teléfono mientras trabajas."
    >
      <Seccion titulo="Conectarlo, paso a paso" entradilla={<p>Lo haces una vez al darte de alta, o después desde «Agente» en el panel.</p>}>
        <Pasos
          pasos={[
            { titulo: "Pulsa «Conectar Google Calendar»", texto: "Se abre la ventana de Google para elegir la cuenta del negocio." },
            {
              titulo: "Acepta los dos permisos",
              texto: "Ver y editar los eventos de tus calendarios, y ver la lista de calendarios para que elijas uno. Nada más: ni tu correo, ni tus contactos, ni el resto de tu cuenta.",
            },
            { titulo: "Elige el calendario", texto: "El principal o uno que hayas creado para el negocio. Puedes cambiarlo luego sin volver a conectar." },
            {
              titulo: "Haz una prueba",
              texto: "Apunta un evento falso mañana a las 11:00, llama a tu número y pide hora a esa misma hora. Si te ofrece otra, está leyendo bien tu agenda.",
            },
          ]}
        />
      </Seccion>

      <Seccion fondo titulo="Qué cuenta como hora ocupada" entradilla={<p>Así lee Alhabla lo que ya tienes en Google Calendar antes de ofrecer un hueco.</p>}>
        <Tabla
          cabecera={["En tu calendario", "¿Bloquea la hora?", "Por qué"]}
          filas={[
            ["Una cita o evento con hora", "Sí", "Es lo normal: ya estás ocupado."],
            ["Un evento de día completo («Vacaciones»)", "Sí, todo el día", "Google los marca como «Disponible» por defecto; Alhabla los trata como cierre."],
            ["Un evento con hora marcado como «Disponible»", "No", "Lo has marcado tú como libre (un recordatorio, por ejemplo)."],
            ["Un evento cancelado", "No", "Ya no ocupa la agenda."],
            ["Una cita de tu calendario de citas de Google", "Sí", "Entra en tu calendario como cualquier evento."],
          ]}
          nota="Además de tu calendario, cuenta tu horario de apertura y las ausencias que marques a cada profesional."
        />
      </Seccion>

      <Seccion titulo="Ideas para que te funcione mejor">
        <Tarjetas
          items={[
            {
              titulo: "Un calendario para el negocio",
              texto: "Crea en Google Calendar un calendario «Salón» y conéctalo. Tus planes personales no se mezclan con las citas, y si compartes ese calendario con tu equipo, todos ven lo mismo.",
            },
            {
              titulo: "Bloquea con día completo",
              texto: "Para un cierre, un curso o vacaciones, un evento de día completo es la forma más segura: bloquea el día entero aunque Google lo marque como disponible.",
            },
            {
              titulo: "O díselo al Gestor",
              texto: "Si prefieres no abrir el calendario, escribe por WhatsApp «cerramos el lunes» y, tras tu confirmación, ese día queda cerrado en tu horario de Alhabla y la recepcionista no lo ofrece (no crea un evento en tu calendario).",
            },
          ]}
        />
      </Seccion>

      <Seccion fondo titulo="Por qué solo pide permiso sobre los eventos">
        <Texto>
          <p>
            Google ofrece a las apps un permiso «completo» sobre el calendario que permite, entre otras cosas, compartir
            o borrar calendarios enteros. Alhabla no lo pide: le basta con crear, mover y borrar las citas que reserva y
            con ver qué calendarios tienes para que elijas uno. Es el mínimo que necesita para trabajar y lo que Google
            recomienda a las apps que acceden a datos de usuarios.
          </p>
          <p>
            Si un día revocas el acceso o cambias la contraseña y Google invalida el permiso, Alhabla no reserva a ciegas: la
            cita que no puede entrar en tu calendario queda pendiente y te avisa por WhatsApp para que lo reconectes.
          </p>
        </Texto>
        <div className="mt-6">
          <Nota titulo="¿Y las citas que ya tenías?">
            Alhabla no importa ni modifica tus eventos anteriores. Solo los lee para saber cuándo estás ocupado y solo
            cambia los que ha creado ella.
          </Nota>
        </div>
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
