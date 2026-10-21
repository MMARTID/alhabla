import { Mail } from "lucide-react";
import { Fuentes, Nota, PaginaGuia, Pasos, Seccion, Tabla, Tarjetas, Texto } from "@/components/pagina-guia";
import { metadataDePagina } from "@/lib/seo";

/**
 * Outlook / Microsoft 365 (2026-10-20). Microsoft Graph con el punto de
 * entrada `common` (cuentas personales y de empresa) y los permisos de
 * backend/src/lib/microsoftGraph.ts: User.Read + Calendars.ReadWrite +
 * offline_access. Ocupado: día completo siempre; con hora, todo salvo lo
 * marcado como «Disponible» (showAs: free) o cancelado.
 */
const ruta = "/integraciones/outlook";
const titulo = "Outlook y Microsoft 365 con tu recepcionista";
const descripcion =
  "Conecta tu calendario de Outlook, Hotmail o Microsoft 365 y elige en cuál entran las citas que reserva tu recepcionista de IA por teléfono.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

export default function OutlookPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      migas={[
        { name: "Integraciones", path: "/integraciones" },
        { name: "Outlook", path: ruta },
      ]}
      etiqueta={{ icono: Mail, texto: "Outlook · Microsoft 365" }}
      titulo={titulo}
      descripcion={descripcion}
      ubicacion="integracion_outlook"
      entradilla={
        <p>
          Hay clínicas y centros que llevan la agenda en el Outlook del ordenador de recepción desde hace años. No hace
          falta cambiarlo: Alhabla se conecta a ese mismo calendario, consulta tus horas libres y deja la cita apuntada
          para que la veas en el ordenador y en el móvil.
        </p>
      }
      faqs={[
        {
          question: "¿Funciona con Hotmail, Outlook.com y con cuentas de empresa?",
          answer:
            "Sí. La conexión acepta cuentas personales de Microsoft (Outlook.com, Hotmail, Live) y cuentas de trabajo de Microsoft 365. En una cuenta de empresa, el administrador puede exigir que apruebe él el acceso de apps externas.",
        },
        {
          question: "Uso Outlook en el ordenador con un correo de otro proveedor. ¿Vale?",
          answer:
            "Depende de dónde se guarde el calendario. Si el calendario está en una cuenta de Microsoft (lo ves también en outlook.com o en la app de Outlook del móvil), vale. Si es un calendario local del ordenador, Alhabla no puede verlo.",
        },
        {
          question: "¿Tengo que volver a conectarlo cada cierto tiempo?",
          answer:
            "No. Microsoft renueva el acceso en cada uso y Alhabla guarda la renovación. Solo tendrás que reconectar si revocas el permiso o un administrador lo retira.",
        },
        {
          question: "¿Qué permisos le doy exactamente?",
          answer:
            "Leer y escribir en tus calendarios, ver tu nombre y correo para identificar la cuenta, y mantener el acceso sin que tengas que entrar cada vez. No pide permiso sobre tu correo ni tus contactos.",
        },
        {
          question: "Tengo un calendario compartido con el equipo. ¿Puedo elegirlo?",
          answer:
            "Al conectar te enseñamos la lista de calendarios de tu cuenta y eliges uno. Si el compartido aparece en esa lista, puedes elegirlo; si no, crea un calendario propio del negocio y compártelo tú con el equipo.",
        },
        {
          question: "¿Y si marco una reunión como «Provisional»?",
          answer:
            "Cuenta como ocupado. Para que una franja con hora no bloquee la agenda, márcala como «Disponible» en Outlook.",
        },
      ]}
      relacionadas={[
        { href: "/integraciones/google-calendar", titulo: "Google Calendar" },
        { href: "/integraciones/icloud", titulo: "Calendario de Apple (iCloud)" },
        { href: "/fisioterapia", titulo: "Recepcionista de IA para fisioterapia", texto: "Primeras visitas y sesiones de seguimiento, reservadas sin dejar al paciente." },
        { href: "/centro-de-estetica", titulo: "Recepcionista de IA para centros de estética" },
      ]}
      cierre="Tu Outlook de siempre, con citas que entran solas."
    >
      <Seccion titulo="Conectarlo, paso a paso" entradilla={<p>Al darte de alta o más tarde desde «Agente» en el panel.</p>}>
        <Pasos
          pasos={[
            { titulo: "Pulsa «Conectar Outlook»", texto: "Se abre la página de inicio de sesión de Microsoft." },
            { titulo: "Entra con la cuenta del negocio", texto: "La personal o la de Microsoft 365 donde vive tu agenda." },
            { titulo: "Acepta los permisos", texto: "Microsoft te enseña la lista. Si tu empresa exige aprobación de un administrador, te lo dirá en esa pantalla." },
            { titulo: "Elige el calendario de la lista", texto: "De vuelta en Alhabla aparece la lista de calendarios de esa cuenta. El que elijas es donde entran las citas." },
          ]}
        />
      </Seccion>

      <Seccion fondo titulo="Lo que Outlook marca y lo que entiende Alhabla">
        <Tabla
          cabecera={["Estado en Outlook", "¿Bloquea la hora?"]}
          filas={[
            ["Ocupado", "Sí"],
            ["Provisional", "Sí"],
            ["Fuera de la oficina", "Sí"],
            ["Trabajando en otro lugar", "Sí"],
            ["Disponible (evento con hora)", "No"],
            ["Evento de todo el día, sea cual sea su estado", "Sí, el día entero"],
            ["Reunión cancelada", "No"],
          ]}
          nota="Outlook crea los eventos de todo el día como «Disponible» por defecto. Alhabla los trata como cierre igualmente: un «Vacaciones» de todo el día nunca deja reservar ese día."
        />
      </Seccion>

      <Seccion titulo="Para qué negocios encaja mejor Outlook">
        <Tarjetas
          columnas={2}
          items={[
            {
              titulo: "Centros con ordenador en recepción",
              texto: "Si la agenda se lleva en el Outlook del mostrador, las citas por teléfono aparecen ahí mismo, junto a las que apunta tu equipo.",
            },
            {
              titulo: "Clínicas con Microsoft 365",
              texto: "Si ya pagas Microsoft 365 para el correo de la clínica, usa su calendario: no necesitas una cuenta de Google solo para esto.",
            },
            {
              titulo: "Varios profesionales, una agenda",
              texto: "Cada cita lleva el nombre del profesional. Con un solo calendario del negocio, todos ven el día completo de un vistazo.",
            },
            {
              titulo: "Si prefieres el móvil",
              texto: "La app de Outlook en el móvil enseña las mismas citas. Y para cambios rápidos, el Gestor por WhatsApp: lo que mueve o cancela, cambia también en tu Outlook.",
            },
          ]}
        />
      </Seccion>

      <Seccion fondo titulo="Cómo quitarle el acceso" estrecha>
        <Texto>
          <p>
            Con una cuenta personal, entra en la página de privacidad de tu cuenta de Microsoft y quita a Alhabla de las
            aplicaciones con acceso. Con una cuenta de empresa, lo hace el administrador desde el centro de Microsoft
            Entra. En cuanto se revoca, la recepcionista deja de reservar en ese calendario y el panel te pide
            reconectar.
          </p>
        </Texto>
        <div className="mt-6">
          <Nota titulo="Tus correos quedan fuera">
            El permiso de calendarios no da acceso al correo. Alhabla no lee ni envía emails desde tu cuenta de Outlook.
          </Nota>
        </div>
      </Seccion>

      <Fuentes
        consultadas="2026-10-20"
        fuentes={[
          { nombre: "Microsoft: referencia de permisos de Microsoft Graph", url: "https://learn.microsoft.com/es-es/graph/permissions-reference" },
          { nombre: "Microsoft: gestionar las aplicaciones con acceso a tu cuenta", url: "https://account.live.com/consent/Manage" },
        ]}
      />
    </PaginaGuia>
  );
}
