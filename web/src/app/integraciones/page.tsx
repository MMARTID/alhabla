import { CalendarCheck, Plug } from "lucide-react";
import { IndiceDePaginas, ListaCheck, Nota, PaginaGuia, Seccion, Tabla, Texto } from "@/components/pagina-guia";
import { paginasBajo } from "@/lib/paginas";
import { metadataDePagina } from "@/lib/seo";

/**
 * Índice de integraciones (2026-10-20). Solo lo que Alhabla hace de verdad
 * (AGENTS.md § Calendar Integration): tres calendarios por adaptador y
 * WhatsApp. Booksy, Treatwell y Fresha no tienen API pública, así que aquí
 * se explica cómo convivir con ellos a través del calendario, sin prometer
 * una integración que no existe.
 */
const ruta = "/integraciones";
const titulo = "Integraciones de tu recepcionista de IA";
const descripcion =
  "Google Calendar, Outlook, Calendario de Apple y WhatsApp: con qué se conecta Alhabla para reservar en tu agenda real y avisar a tus clientes.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

export default function IntegracionesPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      migas={[{ name: "Integraciones", path: ruta }]}
      etiqueta={{ icono: Plug, texto: "Integraciones" }}
      titulo={titulo}
      descripcion={descripcion}
      ubicacion="integraciones"
      tipo="CollectionPage"
      entradilla={
        <p>
          Una recepcionista solo es útil si reserva donde tú miras tu agenda. Alhabla se conecta a tu calendario de
          siempre para saber qué horas están libres, apunta ahí cada cita y avisa a tu cliente por WhatsApp. No tienes
          que cambiar de programa ni aprender otro.
        </p>
      }
      faqs={[
        {
          question: "¿Puedo conectar más de un calendario a la vez?",
          answer:
            "Se conecta una cuenta y, dentro de ella, eliges el calendario donde entran las citas. Si cambias de idea, desde el panel cambias de calendario o de proveedor sin perder la configuración de servicios y profesionales.",
        },
        {
          question: "¿Alhabla lee todo lo que tengo en el calendario?",
          answer:
            "Mira cuándo estás ocupado para no ofrecer esas horas y apunta las citas que reserva. En Google pide solo permiso sobre los eventos y la lista de calendarios, nunca el permiso completo de la cuenta.",
        },
        {
          question: "Uso Booksy, Treatwell o Fresha. ¿Sirve Alhabla?",
          answer:
            "No hay integración directa con esos programas. Si sincronizan tus citas con Google Calendar, Outlook o iCloud, la recepcionista las ve como horas ocupadas y no te monta dos citas a la vez. Las citas que reserva Alhabla entran en tu calendario, no en esos programas.",
        },
        {
          question: "¿Qué pasa si se desconecta el calendario?",
          answer:
            "Si tu proveedor deja de aceptar el permiso (por ejemplo, porque cambiaste la contraseña), te avisamos por WhatsApp y el panel te pide reconectar. Mientras tanto la recepcionista no da horas que no puede comprobar: prefiere no reservar a reservar a ciegas.",
        },
        {
          question: "¿Hace falta un técnico para conectarlo?",
          answer:
            "No. Google y Outlook se conectan con tu cuenta en dos clics; Apple, con tu Apple ID y una contraseña de aplicación que generas tú. Cada guía explica los pasos.",
        },
      ]}
      relacionadas={[
        { href: "/desvio-de-llamadas", titulo: "Desvío de llamadas por operador", texto: "El otro paso del alta: que las llamadas que no coges lleguen a tu recepcionista." },
        { href: "/agenda-por-whatsapp", titulo: "El Gestor por WhatsApp", texto: "Cambia tu agenda escribiendo, sin abrir el panel." },
        { href: "/planes", titulo: "Planes y precios", texto: "Todas las integraciones van incluidas en todos los planes." },
      ]}
      cierre="Tu agenda de siempre, con alguien que la llena por teléfono."
    >
      <Seccion titulo="Con qué se conecta Alhabla">
        <IndiceDePaginas paginas={paginasBajo(ruta)} />
      </Seccion>

      <Seccion
        fondo
        titulo="Qué hace la recepcionista con tu calendario"
        entradilla={<p>Lo mismo con los tres proveedores. Cambian los pasos para conectarlo, no lo que hace después.</p>}
      >
        <ListaCheck
          items={[
            <>
              <strong>Antes de ofrecer una hora</strong> cruza tu horario de apertura, la duración del servicio, quién
              lo hace y lo que ya tienes apuntado. Nunca reserva a ciegas.
            </>,
            <>
              <strong>Al reservar</strong> crea el evento en el calendario que elegiste, con el servicio, el cliente y el
              profesional, y dos avisos antes de la cita.
            </>,
            <>
              <strong>Si reintenta</strong> (un corte de red a mitad de reserva) no duplica la cita: cada reserva lleva
              una huella y la segunda vez reconoce la primera.
            </>,
            <>
              <strong>Si el cliente cancela</strong> por WhatsApp o por teléfono, borra el evento de tu calendario y
              deja el hueco libre para la lista de espera.
            </>,
            <>
              <strong>Lo que pongas tú a mano</strong> (una comida, un médico, un día libre) cuenta como ocupado. Los
              eventos de día completo también.
            </>,
          ]}
        />
      </Seccion>

      <Seccion titulo="Los tres calendarios, de un vistazo">
        <Tabla
          cabecera={["", "Google Calendar", "Outlook", "Calendario de Apple"]}
          filas={[
            ["Cómo se conecta", "Con tu cuenta de Google", "Con tu cuenta de Microsoft", "Apple ID y contraseña de aplicación"],
            ["Dónde se elige", "Al darte de alta o en Agente", "Al darte de alta o en Agente", "En Agente"],
            ["Elegir calendario", "El principal u otro tuyo", "Cualquiera de la cuenta", "Cualquiera de tu iCloud"],
            ["Permisos que pide", "Eventos y lista de calendarios", "Calendarios de la cuenta", "Los de tu contraseña de aplicación"],
            ["Si caduca el acceso", "Te pide reconectar", "Te pide reconectar", "Te pide reconectar"],
          ]}
          nota="Los tres van incluidos en todos los planes. «Agente» es la sección del panel donde configuras tu recepcionista."
        />
      </Seccion>

      <Seccion fondo titulo="¿Y si ya uso un programa de reservas?">
        <Texto>
          <p>
            Muchos salones reservan con Booksy, Treatwell, Fresha o el programa de su distribuidor. Alhabla no se
            conecta con ellos directamente: ninguno de los tres ofrece una conexión abierta para que otra empresa
            escriba en su agenda. Lo que sí funciona es el calendario como punto de encuentro.
          </p>
          <p>
            Si tu programa sincroniza las citas con Google Calendar, Outlook o iCloud, la recepcionista las ve y no
            ofrece esas horas. Las citas que reserva por teléfono entran en tu calendario, así que las verás en el
            móvil, pero no aparecerán dentro del otro programa. Para un negocio que reserva sobre todo por teléfono y
            WhatsApp, el calendario basta; si casi todo te entra por una app de reservas, cuéntanoslo antes de
            contratar y lo vemos con tu caso.
          </p>
        </Texto>
        <div className="mt-6">
          <Nota tipo="consejo" titulo="Haz la prueba antes de nada">
            Apunta a mano una cita falsa en tu calendario para mañana a las 11:00, llama a tu número y pide hora para
            esa franja: la recepcionista tiene que ofrecerte otra.
          </Nota>
        </div>
      </Seccion>

      <Seccion titulo="WhatsApp, el canal que ya usan tus clientes" entradilla={<p>No es un calendario, pero cierra el círculo.</p>}>
        <Texto>
          <p>
            Cada cita reservada por teléfono se confirma por WhatsApp al cliente, y en los planes Pro y Scale se le
            recuerda antes de venir. Tú, como dueño, también hablas con Alhabla por WhatsApp para cambiar horarios,
            ausencias o precios. Los detalles están en la <a href="/integraciones/whatsapp">guía de WhatsApp</a>.
          </p>
        </Texto>
        <div className="mt-6 flex items-center gap-3 text-sm text-muted">
          <CalendarCheck className="h-4 w-4 text-morado" aria-hidden="true" />
          Las integraciones no cuestan aparte: van en el precio de cada plan.
        </div>
      </Seccion>
    </PaginaGuia>
  );
}
