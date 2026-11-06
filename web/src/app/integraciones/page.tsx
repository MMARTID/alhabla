import { CalendarDays, Plug } from "lucide-react";
import { IndiceDePaginas, PaginaGuia, Seccion, Texto } from "@/components/pagina-guia";
import { paginasBajo } from "@/lib/paginas";
import { metadataDePagina } from "@/lib/seo";
import { IconoApple, IconoGoogleCalendar, IconoMicrosoft } from "./iconos-de-calendario";

/**
 * Índice de integraciones (2026-10-20; rehecho el 2026-11-06 con
 * PLAN-AGENDA-PRINCIPAL.md). La agenda de Alhabla viene incluida y es la del
 * negocio; Google, Outlook y Apple se conectan a ella como complemento:
 * reciben una copia de cada cita y cuentan lo que el dueño apunta como
 * ocupado (AGENTS.md § Agenda de Alhabla y calendarios conectados). Un solo
 * sentido: lo que se cambie en Google no vuelve. Es la página de
 * compatibilidad, así que aquí sí se cuenta qué pasa si un calendario se
 * desconecta (las de venta no lo hacen). Booksy, Treatwell y Fresha no
 * tienen API pública: se explica cómo convivir, sin prometer integración.
 */
const ruta = "/integraciones";
const titulo = "La agenda viene incluida. Tu Google Calendar, si lo usas, también.";
const descripcion =
  "Tu recepcionista reserva en tu agenda de Alhabla desde el primer día. Si llevas las citas en Google Calendar, Outlook o el iPhone, conéctalo y las verás también ahí.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

const conectados = [
  { icono: <IconoGoogleCalendar className="h-5 w-5" />, nombre: "Google Calendar", texto: "Con tu cuenta de Google." },
  { icono: <IconoMicrosoft className="h-5 w-5" />, nombre: "Outlook / Microsoft 365", texto: "Con tu cuenta de Microsoft." },
  { icono: <IconoApple className="h-5 w-5" />, nombre: "Apple / iCloud", texto: "Con tu Apple ID y una contraseña de aplicación." },
];

/** La agenda en el centro y, debajo, los calendarios que se conectan a ella. */
function TuAgendaYTuCalendario() {
  return (
    <figure>
      <div className="rounded-3xl border border-linea bg-superficie p-5 sm:p-6">
        <div className="flex items-center gap-3 rounded-2xl border border-lavado-borde bg-lavado p-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-superficie">
            <CalendarDays className="h-5 w-5 text-morado" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-tinta">Tu agenda de Alhabla</span>
            <span className="block text-xs leading-5 text-apagado">Incluida. Aquí entran todas tus citas.</span>
          </span>
        </div>
        <p className="mt-4 px-1 text-xs font-bold uppercase tracking-wide text-tenue">Conectada a…</p>
        <ul className="mt-2 space-y-2.5">
          {conectados.map(({ icono, nombre, texto }) => (
            <li key={nombre} className="flex items-center gap-3 rounded-2xl border border-linea p-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-linea bg-relleno">
                {icono}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-tinta">{nombre}</span>
                <span className="block text-xs leading-5 text-apagado">{texto}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <figcaption className="mt-3 px-1 text-xs leading-5 text-tenue">
        Conectar uno es opcional, y se quita cuando quieras desde el panel.
      </figcaption>
    </figure>
  );
}

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
          ¿Tienes que cambiar de agenda? No, y tampoco tienes que elegir. Tu agenda viene puesta; tu Google Calendar,
          Outlook o el calendario del iPhone se conectan a ella: reciben cada cita y le cuentan a la recepcionista lo
          que apuntas tú, para que no lo pise.
        </p>
      }
      pieza={<TuAgendaYTuCalendario />}
      faqs={[
        {
          question: "¿Qué mira Alhabla de mi calendario?",
          answer:
            "Cuándo estás ocupado, para no ofrecer esas horas. Lo que apuntas tú a mano cuenta como ocupado; tus eventos no los cambia. Y ahí deja una copia de cada cita de tu agenda.",
        },
        {
          question: "¿Puedo conectar o quitar mi calendario después?",
          answer: "Cuando quieras, desde el panel. Tus citas no se mueven: viven en tu agenda.",
        },
        {
          question: "¿Y si el calendario se desconecta?",
          answer:
            "Tus citas siguen entrando en tu agenda y te avisamos por WhatsApp. Mientras no lo reconectes, lo que apuntes en tu calendario no lo vemos; al reconectar, copiamos ahí las citas que hayan entrado.",
        },
        {
          question: "¿Y si muevo una cita en Google?",
          answer:
            "Las citas se mueven en Alhabla: desde el panel o diciéndoselo a tu asistente por WhatsApp, que avisa al cliente. En Google la verás siempre al día.",
        },
        {
          question: "¿Hace falta un técnico para conectarlo?",
          answer:
            "No. Google y Outlook se conectan con tu cuenta en dos clics; Apple, con una contraseña de aplicación que generas tú. Cada guía tiene los pasos.",
        },
        {
          question: "¿Cuesta aparte?",
          answer: "No. La agenda, los calendarios y WhatsApp van en todos los planes.",
        },
      ]}
      relacionadas={[
        {
          href: "/desvio-de-llamadas",
          titulo: "Desvío de llamadas por operador",
          texto: "El otro paso del alta: que las llamadas que no coges lleguen a la recepcionista.",
        },
        {
          href: "/agenda-por-whatsapp",
          titulo: "Tu asistente por WhatsApp",
          texto: "Cambia tu agenda escribiendo, sin abrir el panel.",
        },
        { href: "/planes", titulo: "Planes y precios" },
      ]}
      cierre="Tu agenda, siempre al día, y ninguna llamada sin contestar."
    >
      <Seccion titulo="Las guías, una por una">
        <IndiceDePaginas paginas={paginasBajo(ruta)} />
      </Seccion>

      <Seccion fondo titulo="Tu agenda de Alhabla, con o sin calendario">
        <Texto>
          <p>
            La recepcionista reserva en ella y tú la ves en el panel, por profesional y por día. Lo que te entra en caja
            o por otro lado lo apuntas ahí o se lo dices a tu asistente por WhatsApp: «apúntame a Javier el viernes a las
            siete».
          </p>
          <p>
            Para tenerla en el móvil sin conectar nada, te suscribes desde su calendario con un enlace. Es de solo
            lectura: lo que apuntes en el móvil no vuelve a Alhabla.
          </p>
        </Texto>
      </Seccion>

      <Seccion titulo="¿Y si ya uso Booksy, Treatwell o Fresha?">
        <Texto>
          <p>
            No se conectan: ninguno deja que otra empresa escriba en su agenda. Si tu programa pasa las citas a Google
            Calendar, Outlook o iCloud, conecta ese calendario: la recepcionista las verá como horas ocupadas y no te
            montará dos citas a la vez. Las que reserva ella entran en tu agenda de Alhabla y su copia en tu calendario,
            no en ese programa.
          </p>
        </Texto>
      </Seccion>
    </PaginaGuia>
  );
}
