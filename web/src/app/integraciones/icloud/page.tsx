import { Apple } from "lucide-react";
import { CitaEnElCalendario, Fuentes, PaginaGuia, Pasos, Seccion, Texto } from "@/components/pagina-guia";
import { metadataDePagina } from "@/lib/seo";
import { IconoApple } from "../iconos-de-calendario";

/**
 * Calendario de Apple / iCloud (2026-10-20; recortada a guía de pasos el
 * 2026-10-29). Va por CalDAV con Apple ID y contraseña de aplicación
 * (backend/src/adapters/calendar/caldav/); se conecta en el alta (Apple /
 * iCloud, desde el 2026-10-28) o desde /agente, con la pastilla «Beta»
 * (frontend/src/components/apple-calendar-connect.tsx). Aún falta la
 * primera conexión de un negocio real: no se dice que funcione «igual que»
 * Google y Outlook. Pasos de Apple contrastados con support.apple.com/es-es/102654.
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
            Si llevas la agenda en la app Calendario del iPhone y vive en iCloud, la recepcionista puede leerla y apuntar
            en ella cada cita que reserva.
          </p>
          <p className="text-base">
            Apple no deja entrar con tu contraseña normal: hace falta una contraseña de aplicación, que generas tú en dos
            minutos. Es la conexión más nueva y en el panel lleva la etiqueta «Beta».
          </p>
        </>
      }
      pieza={
        <CitaEnElCalendario
          calendario={{ icono: <IconoApple className="h-4 w-4" />, nombre: "Uñas Sara" }}
          dia="Sábado, 7 de noviembre"
          desde={10}
          hasta={13}
          ocupado={{ inicio: 10, fin: 11, titulo: "Clienta fija (cada sábado)" }}
          cita={{
            inicio: 11.5,
            fin: 12.5,
            titulo: "Manicura semipermanente — Carla Núñez",
            detalle: [
              ["Cliente", "Carla Núñez"],
              ["Teléfono", "+34 792 33 18 40"],
              ["Servicio", "Manicura semipermanente"],
              ["Profesional", "Sara"],
            ],
          }}
        />
      }
      faqs={[
        {
          question: "¿Por qué no vale la contraseña de mi cuenta de Apple?",
          answer:
            "Apple obliga a que las apps de otras empresas usen una contraseña propia. Así Alhabla nunca tiene tu contraseña principal y le cortas el acceso sin cambiar nada más.",
        },
        {
          question: "No me deja generar la contraseña de aplicación.",
          answer: "Hace falta tener activada la autenticación de doble factor en tu cuenta de Apple. Actívala y vuelve a probar.",
        },
        {
          question: "¿Qué correo pongo?",
          answer: "El de tu cuenta de Apple, completo y con la arroba, sea de iCloud o de otro dominio.",
        },
        {
          question: "¿Por qué pone «Beta»?",
          answer:
            "Porque es la conexión más reciente y todavía la estamos probando con negocios. Si notas algo raro, escríbenos y lo miramos contigo.",
        },
      ]}
      relacionadas={[
        { href: "/integraciones/google-calendar", titulo: "Google Calendar" },
        { href: "/integraciones/outlook", titulo: "Outlook y Microsoft 365" },
        {
          href: "/desvio-de-llamadas/iphone-y-android",
          titulo: "El desvío de llamadas en el iPhone",
          texto: "El ajuste del iPhone que puede comerse llamadas de clientes nuevos.",
        },
      ]}
      cierre="Las citas, en el calendario que ya miras en el iPhone."
    >
      <Seccion titulo="Antes de empezar: ¿está tu agenda en iCloud?">
        <Texto>
          <p>
            En el iPhone, abre Calendario y pulsa «Calendarios». Los que salen bajo «iCloud» son los que Alhabla puede
            usar. Si tu agenda está bajo «Gmail» u «Outlook», sigue mejor la guía de ese proveedor.
          </p>
        </Texto>
      </Seccion>

      <Seccion fondo titulo="Conectarlo, paso a paso">
        <Pasos
          pasos={[
            {
              titulo: "Entra en account.apple.com",
              texto: "Con tu Apple ID. Abre «Inicio de sesión y seguridad» y luego «Contraseñas específicas para apps».",
            },
            {
              titulo: "Genera una y llámala «Alhabla»",
              texto: "Apple te enseña una contraseña de 16 letras. Cópiala: no la volverás a ver.",
            },
            {
              titulo: "Pégala en Alhabla",
              texto: "En el alta, en «Apple / iCloud», o después en «Agente». Con tu Apple ID completo; si la contraseña no vale, te lo dice al momento.",
            },
            { titulo: "Elige el calendario", texto: "Alhabla te enseña tus calendarios de iCloud y eliges en cuál entran las citas." },
          ]}
        />
      </Seccion>

      <Seccion titulo="Lo que hace después, y cómo cortarlo">
        <Texto>
          <p>
            Antes de dar una hora mira lo que tienes apuntado, también lo que se repite cada semana. Apunta la cita sin
            invitados, así que iCloud no manda invitaciones a nadie. Y si la mueves o la cancelas desde el panel o con tu
            asistente, cambia también en el iPhone.
          </p>
          <p>
            Para cortarle el acceso, borra la contraseña «Alhabla» en account.apple.com. Ojo: si cambias la contraseña
            de tu Apple ID, Apple anula todas las de aplicación y tendrás que generar otra.
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
