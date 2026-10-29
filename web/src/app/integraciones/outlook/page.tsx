import { Mail } from "lucide-react";
import { CitaEnElCalendario, Fuentes, PaginaGuia, Pasos, Seccion, Texto } from "@/components/pagina-guia";
import { metadataDePagina } from "@/lib/seo";
import { IconoMicrosoft } from "../iconos-de-calendario";

/**
 * Outlook / Microsoft 365 (2026-10-20; recortada a guía de pasos el
 * 2026-10-29). Microsoft Graph con el punto de entrada `common` (cuentas
 * personales y de empresa) y los permisos de backend/src/lib/microsoftGraph.ts:
 * User.Read + Calendars.ReadWrite + offline_access. Ocupado: día completo
 * siempre; con hora, todo salvo lo marcado como «Disponible» (showAs: free)
 * o cancelado.
 */
const ruta = "/integraciones/outlook";
const titulo = "Outlook y Microsoft 365 con tu recepcionista";
const descripcion =
  "Conecta tu calendario de Outlook, Hotmail o Microsoft 365: tu recepcionista de IA mira tus horas libres y deja ahí cada cita que reserva por teléfono.";

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
          Vale con Outlook.com, Hotmail y Microsoft 365. Si tu clínica lleva la agenda en el Outlook del ordenador de
          recepción, la recepcionista usa ese mismo calendario: mira las horas libres y deja la cita apuntada.
        </p>
      }
      pieza={
        <CitaEnElCalendario
          calendario={{ icono: <IconoMicrosoft className="h-4 w-4" />, nombre: "Fisioterapia Ribera" }}
          dia="Martes, 10 de noviembre"
          desde={9}
          hasta={12}
          ocupado={{ inicio: 9, fin: 10, titulo: "Reunión de equipo" }}
          cita={{
            inicio: 10.5,
            fin: 11.25,
            titulo: "Sesión de fisioterapia — Javier Ortega",
            detalle: [
              ["Cliente", "Javier Ortega"],
              ["Teléfono", "+34 791 45 67 89"],
              ["Servicio", "Sesión de fisioterapia"],
              ["Profesional", "Laura"],
            ],
          }}
        />
      }
      faqs={[
        {
          question: "Uso Outlook en el ordenador con un correo de otro proveedor. ¿Vale?",
          answer:
            "Depende de dónde se guarde el calendario. Si lo ves también en outlook.com o en la app de Outlook del móvil, vale. Si es un calendario local del ordenador, Alhabla no puede verlo.",
        },
        {
          question: "¿Tengo que volver a conectarlo cada cierto tiempo?",
          answer:
            "No. Solo si revocas el permiso o un administrador lo retira; entonces el panel te pide reconectar.",
        },
        {
          question: "Tenemos un calendario compartido. ¿Puedo elegirlo?",
          answer:
            "Si aparece en la lista de calendarios de tu cuenta, sí. Si no, crea uno del negocio y compártelo tú con el equipo.",
        },
      ]}
      relacionadas={[
        { href: "/integraciones/google-calendar", titulo: "Google Calendar" },
        { href: "/integraciones/icloud", titulo: "Calendario de Apple (iCloud)" },
        { href: "/fisioterapia", titulo: "Recepcionista de IA para fisioterapia" },
      ]}
      cierre="Tu Outlook de siempre, con las citas del teléfono ya dentro."
    >
      <Seccion
        titulo="Conectarlo, paso a paso"
        entradilla={<p>Al darte de alta o más tarde desde «Agente» en el panel.</p>}
      >
        <Pasos
          pasos={[
            { titulo: "Pulsa «Outlook / Microsoft 365»", texto: "Se abre el inicio de sesión de Microsoft." },
            { titulo: "Entra con la cuenta del negocio", texto: "La personal o la de Microsoft 365 donde vive tu agenda." },
            {
              titulo: "Acepta los permisos",
              texto:
                "Leer y escribir en tus calendarios y ver tu nombre y correo para saber qué cuenta es. Nada sobre tus correos ni tus contactos.",
            },
            { titulo: "Elige el calendario", texto: "Alhabla te enseña los de esa cuenta; en el que elijas entran las citas." },
          ]}
        />
      </Seccion>

      <Seccion fondo titulo="Qué bloquea una hora">
        <Texto>
          <p>
            Todo lo que tenga hora y no esté marcado como «Disponible»: «Ocupado», «Provisional», «Fuera de la oficina» y
            «Trabajando en otro lugar». Lo cancelado, no. Un evento de todo el día cierra el día entero, aunque Outlook lo
            cree como disponible.
          </p>
        </Texto>
      </Seccion>

      <Seccion titulo="Con una cuenta de empresa">
        <Texto>
          <p>
            El administrador puede exigir que apruebe él el acceso de apps externas; si es tu caso, Microsoft te lo dice
            al aceptar los permisos. Para quitarle el acceso a Alhabla, con una cuenta personal lo haces en la privacidad
            de tu cuenta de Microsoft; con una de empresa, el administrador desde Microsoft Entra.
          </p>
        </Texto>
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
