import { Apple } from "lucide-react";
import { Fuentes, ListaCheck, Nota, PaginaGuia, Pasos, Seccion, Texto } from "@/components/pagina-guia";
import { metadataDePagina } from "@/lib/seo";

/**
 * Calendario de Apple / iCloud (2026-10-20). Va por CalDAV con Apple ID y
 * contraseña de aplicación (backend/src/adapters/calendar/caldav/); en la app
 * se conecta solo desde /agente y lleva la pastilla «Beta»
 * (frontend/src/components/apple-calendar-connect.tsx), así que aquí se dice.
 * Los pasos de Apple están contrastados con support.apple.com/es-es/102654.
 */
const ruta = "/integraciones/icloud";
const titulo = "Citas en el calendario del iPhone con tu recepcionista";
const descripcion =
  "Conecta el Calendario de Apple (iCloud) con tu Apple ID y una contraseña de aplicación: las citas que reserva tu recepcionista de IA salen en tu iPhone.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

export default function IcloudPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      migas={[
        { name: "Integraciones", path: "/integraciones" },
        { name: "Calendario de Apple", path: ruta },
      ]}
      etiqueta={{ icono: Apple, texto: "Calendario de Apple · iCloud" }}
      titulo={titulo}
      descripcion={descripcion}
      ubicacion="integracion_icloud"
      entradilla={
        <>
          <p>
            Mucha gente lleva la agenda del negocio en la app Calendario del iPhone sin saber que vive en iCloud. Si es
            tu caso, Alhabla puede leer ese calendario y apuntar en él las citas que reserva por teléfono.
          </p>
          <p className="text-base">
            Apple no deja a otras empresas entrar con tu contraseña normal: hace falta una contraseña de aplicación, que
            generas tú en dos minutos y puedes anular cuando quieras.
          </p>
        </>
      }
      faqs={[
        {
          question: "¿Por qué no vale la contraseña de mi cuenta de Apple?",
          answer:
            "Porque Apple obliga a que las apps de otras empresas usen una contraseña específica para cada app. Así Alhabla nunca tiene tu contraseña principal y tú puedes cortarle el acceso sin cambiar nada más.",
        },
        {
          question: "No me deja generar la contraseña de aplicación.",
          answer:
            "Apple solo las permite si tu cuenta tiene activada la autenticación de doble factor. Actívala en los ajustes de tu cuenta de Apple y vuelve a intentarlo.",
        },
        {
          question: "He cambiado la contraseña de mi Apple ID y ha dejado de reservar.",
          answer:
            "Es lo esperado: al cambiar la contraseña principal, Apple anula todas las contraseñas de aplicación. Genera una nueva y pégala en el panel; tus servicios y profesionales siguen como estaban.",
        },
        {
          question: "¿Pongo mi correo de iCloud o el de Gmail con el que entro a Apple?",
          answer:
            "El correo completo de tu cuenta de Apple, con la arroba, sea de iCloud o de otro dominio. Sin el dominio, Apple rechaza el acceso.",
        },
        {
          question: "¿Mis clientes reciben una invitación de calendario?",
          answer:
            "No. Las citas se crean sin invitados a propósito, para que iCloud no envíe invitaciones desde tu cuenta. Al cliente le llega la confirmación por WhatsApp.",
        },
        {
          question: "¿Por qué pone «Beta» en el panel?",
          answer:
            "Porque es la conexión más reciente de las tres y aún la estamos probando con más negocios. Funciona igual que Google y Outlook; si notas algo raro, escríbenos y lo miramos contigo.",
        },
      ]}
      relacionadas={[
        { href: "/integraciones/google-calendar", titulo: "Google Calendar" },
        { href: "/integraciones/outlook", titulo: "Outlook y Microsoft 365" },
        { href: "/desvio-de-llamadas/iphone-y-android", titulo: "El desvío de llamadas en el iPhone", texto: "El ajuste del iPhone que puede comerse llamadas de clientes nuevos." },
        { href: "/contacto", titulo: "Hablar con nosotros" },
      ]}
      cierre="Las citas, en el calendario que ya miras en el iPhone."
    >
      <Seccion titulo="Antes de empezar: comprueba que tu agenda está en iCloud" estrecha>
        <Texto>
          <p>
            En el iPhone, abre Calendario y pulsa «Calendarios» abajo. Verás los calendarios agrupados por cuenta: los
            que aparecen bajo «iCloud» son los que Alhabla puede usar. Si tu agenda del negocio está bajo «Gmail» o
            «Outlook», conecta mejor ese proveedor desde su guía.
          </p>
        </Texto>
      </Seccion>

      <Seccion fondo titulo="Genera la contraseña de aplicación">
        <Pasos
          pasos={[
            { titulo: "Entra en tu cuenta de Apple", texto: "En account.apple.com, con tu Apple ID. Necesitas tener activada la autenticación de doble factor." },
            { titulo: "Inicio de sesión y seguridad", texto: "Abre «Contraseñas específicas para apps»." },
            {
              titulo: "Genera una y llámala «Alhabla»",
              texto: "Apple te enseña una contraseña de 16 letras en cuatro bloques. Cópiala: no la volverás a ver.",
            },
          ]}
        />
      </Seccion>

      <Seccion titulo="Conéctala en el panel de Alhabla">
        <Pasos
          pasos={[
            { titulo: "Ve a «Agente» y busca «Calendario de Apple»", texto: "Al darte de alta solo se ofrecen Google y Outlook; Apple se conecta después, desde aquí." },
            {
              titulo: "Escribe tu Apple ID y pega la contraseña",
              texto: "El correo completo, con la arroba. La contraseña vale con guiones, sin ellos o en mayúsculas.",
            },
            { titulo: "Elige el calendario", texto: "Alhabla comprueba el acceso, te enseña tus calendarios de iCloud y eliges en cuál entran las citas." },
          ]}
        />
        <div className="mt-6">
          <Nota tipo="importante" titulo="Si te equivocas de contraseña">
            El panel te lo dice al momento y no deja una conexión a medias. Revisa que hayas pegado la contraseña de
            aplicación, no la de tu cuenta.
          </Nota>
        </div>
      </Seccion>

      <Seccion fondo titulo="Lo que hace en tu calendario de iCloud">
        <ListaCheck
          items={[
            "Antes de dar una hora, mira lo que tienes apuntado: los eventos con hora y los de día completo bloquean; los que marcaste como «Disponible», no.",
            "Las citas recurrentes que tengas (una clienta fija cada martes) se tienen en cuenta en cada repetición.",
            "Cada cita se guarda con la hora exacta en tiempo universal, así que se ve a su hora en el iPhone, el Mac o cualquier otro dispositivo, también al cambiar al horario de verano.",
            "Si reintenta una reserva por un corte de red, no la duplica: reconoce la que ya creó.",
            "Si el cliente cancela, borra solo esa cita. Nunca toca eventos que no haya creado ella.",
            "Si mueves o cancelas una cita con el Gestor por WhatsApp o desde el panel, el evento cambia también en iCloud. Y si al borrarlo no está donde lo dejó, lo busca por su identificador para que no quede una cita fantasma en tu iPhone.",
          ]}
        />
      </Seccion>

      <Seccion titulo="Cómo cortarle el acceso" estrecha>
        <Texto>
          <p>
            En account.apple.com, «Contraseñas específicas para apps», borra la que llamaste «Alhabla». Desde ese momento
            la recepcionista no puede leer ni escribir en tu calendario y el panel te avisa para que lo reconectes o
            elijas otro proveedor. Apple permite tener hasta 25 contraseñas de aplicación activas a la vez.
          </p>
        </Texto>
      </Seccion>

      <Fuentes
        consultadas="2026-10-20"
        fuentes={[
          { nombre: "Apple: contraseñas específicas para apps", url: "https://support.apple.com/es-es/102654" },
          { nombre: "Apple: cuenta de Apple", url: "https://account.apple.com/" },
        ]}
      />
    </PaginaGuia>
  );
}
