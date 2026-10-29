import { CalendarDays, Plug } from "lucide-react";
import { IndiceDePaginas, PaginaGuia, Seccion, Texto } from "@/components/pagina-guia";
import { paginasBajo } from "@/lib/paginas";
import { metadataDePagina } from "@/lib/seo";
import { IconoApple, IconoGoogleCalendar, IconoMicrosoft } from "./iconos-de-calendario";

/**
 * Índice de integraciones (2026-10-20; rehecho el 2026-10-29 alrededor de
 * «¿tengo que cambiar de agenda?»). Solo lo que Alhabla hace de verdad:
 * tres calendarios por adaptador (AGENTS.md § Calendar Integration) o, sin
 * ninguno, la agenda de Alhabla (§ Modo de agenda: la recepcionista reserva
 * en ella, el dueño apunta desde el panel o su asistente, y un enlace de
 * solo lectura la enseña en el calendario del móvil; no sincroniza de
 * vuelta). Las cuatro opciones de la pieza son las del alta
 * (frontend/src/app/bienvenida/calendar). Booksy, Treatwell y Fresha no
 * tienen API pública: se explica cómo convivir, sin prometer integración.
 */
const ruta = "/integraciones";
const titulo = "Tu recepcionista de IA, con la agenda que ya usas";
const descripcion =
  "No tienes que cambiar de agenda: Alhabla reserva en tu Google Calendar, Outlook o calendario del iPhone, o en la agenda de Alhabla si no usas ninguno.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

const opciones = [
  { icono: <IconoGoogleCalendar className="h-5 w-5" />, nombre: "Google Calendar", texto: "Con tu cuenta de Google." },
  { icono: <IconoMicrosoft className="h-5 w-5" />, nombre: "Outlook / Microsoft 365", texto: "Con tu cuenta de Microsoft." },
  { icono: <IconoApple className="h-5 w-5" />, nombre: "Apple / iCloud", texto: "Con tu Apple ID y una contraseña de aplicación." },
  {
    icono: <CalendarDays className="h-5 w-5 text-morado" aria-hidden="true" />,
    nombre: "La agenda de Alhabla",
    texto: "Sin conectar nada.",
  },
];

/** El paso del alta en el que eliges dónde entran las citas. */
function DondeLlevasTuAgenda() {
  return (
    <figure>
      <div className="rounded-3xl border border-linea bg-superficie p-5 sm:p-6">
        <p className="text-base font-bold text-tinta">¿Dónde llevas tu agenda?</p>
        <ul className="mt-4 space-y-2.5">
          {opciones.map(({ icono, nombre, texto }) => (
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
        El paso del alta en el que lo eliges. Se cambia después desde el panel.
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
          ¿Tienes que cambiar de agenda? No. Si llevas las citas en Google Calendar, Outlook o el calendario del
          iPhone, la recepcionista reserva ahí. Si no usas ninguno, reserva en la agenda de Alhabla.
        </p>
      }
      pieza={<DondeLlevasTuAgenda />}
      faqs={[
        {
          question: "¿Qué mira Alhabla de mi calendario?",
          answer:
            "Cuándo estás ocupado, para no ofrecer esas horas, y las citas que reserva ella. Lo que apuntas tú a mano cuenta como ocupado; tus eventos no los cambia.",
        },
        {
          question: "¿Puedo cambiar de calendario más adelante?",
          answer:
            "Sí, desde el panel: de calendario, de proveedor o a la agenda de Alhabla, sin perder tus servicios ni tu equipo.",
        },
        {
          question: "¿Y si el calendario se desconecta?",
          answer:
            "Te avisamos por WhatsApp y el panel te pide reconectarlo. Mientras, la recepcionista sigue cogiendo las llamadas: no da horas que no puede comprobar, toma nota de lo que piden y te lo pasa.",
        },
        {
          question: "¿Hace falta un técnico para conectarlo?",
          answer:
            "No. Google y Outlook se conectan con tu cuenta en dos clics; Apple, con una contraseña de aplicación que generas tú. Cada guía tiene los pasos.",
        },
        {
          question: "¿Cuesta aparte?",
          answer: "No. Los calendarios, la agenda de Alhabla y WhatsApp van en todos los planes.",
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
      cierre="Tu agenda de siempre, y ninguna llamada sin contestar."
    >
      <Seccion titulo="Las guías, una por una">
        <IndiceDePaginas paginas={paginasBajo(ruta)} />
      </Seccion>

      <Seccion fondo titulo="Si no usas ningún calendario: la agenda de Alhabla">
        <Texto>
          <p>
            La recepcionista reserva en ella y tú la ves en el panel, por profesional y por día. Lo que te entra en caja
            o por otro lado lo apuntas ahí o se lo dices a tu asistente por WhatsApp.
          </p>
          <p>
            Para tenerla en el móvil, te suscribes desde su calendario con un enlace. Es de solo lectura: lo que
            apuntes en el móvil no vuelve a Alhabla.
          </p>
        </Texto>
      </Seccion>

      <Seccion titulo="¿Y si ya uso Booksy, Treatwell o Fresha?">
        <Texto>
          <p>
            No se conectan: ninguno deja que otra empresa escriba en su agenda. Si tu programa pasa las citas a Google
            Calendar, Outlook o iCloud, la recepcionista las ve como horas ocupadas y no te monta dos citas a la vez. Las
            que reserva ella entran en tu calendario, no en ese programa.
          </p>
        </Texto>
      </Seccion>
    </PaginaGuia>
  );
}
