import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, Eye, Layers, MessageCircle, Repeat, Tag } from "lucide-react";
import {
  Conversacion,
  Nota,
  PaginaGuia,
  Pasos,
  Seccion,
  Tabla,
  Tarjetas,
  Texto,
} from "@/components/pagina-guia";
import { metadataDePagina } from "@/lib/seo";

/**
 * Estudios de pestañas y cejas (2026-10-20): uno de los tres sectores con
 * cita previa y sin datos de salud que se abren con página propia. El alta
 * los trata como negocio «Otros» (backend/src/lib/businessType.ts), así que
 * la recepcionista es la misma de siempre; lo que vale aquí es el oficio.
 *
 * Lo que dice del producto sale del código, no de suposiciones:
 * - varios servicios en la misma cita, con la duración sumada y una sola
 *   profesional: book_appointment en modules/voiceTools/service.ts;
 * - niveles por servicio (especialista / lo hace / solo si lo piden):
 *   ProfessionalServiceLevel en prisma/schema.prisma;
 * - «Información para responder» es `Business.businessDetails`, el texto que
 *   la recepcionista usa al contestar (Agente › Información en la app);
 * - capacidad = citas a la vez en todo el negocio (lib/availability.ts);
 * - recordatorio 24 h antes solo en Pro y Scale (REMINDER_LEAD_HOURS en
 *   modules/whatsapp/mensajesCliente.ts, lib/planFeatures.ts); la lista de
 *   espera ofrece el hueco al primero que lo pidió (modules/whatsapp/listaDeEspera.ts).
 *
 * Las duraciones de la tabla son ejemplos para montar el catálogo, no datos
 * del sector: por eso la página pide que cada estudio ponga las suyas.
 */

const ruta = "/pestanas-y-cejas";
const titulo = "Recepcionista de IA para pestañas y cejas";
const descripcion =
  "Contesta el teléfono de tu estudio de pestañas mientras trabajas: distingue relleno, juego nuevo y retirada, y reserva con la técnica que domina cada uno.";

export const metadata: Metadata = metadataDePagina({ ruta, titulo, descripcion });

const faqs = [
  {
    question: "¿Sabe la diferencia entre extensiones clásicas y de volumen?",
    answer:
      "Sabe lo que tú le cuentes. Cada técnica es un servicio con su nombre, su duración y su precio, y en «Información para responder» puedes explicar en dos líneas en qué se diferencian. Con eso orienta a la clienta que duda y reserva la que elija.",
  },
  {
    question: "¿Puede reservar la retirada y el juego nuevo en la misma cita?",
    answer:
      "Sí. Una cita admite varios servicios seguidos con la misma técnica. Alhabla suma las duraciones y solo ofrece horas en las que cabe todo, así que una retirada de media hora más un volumen de dos horas y media buscan un hueco de tres horas.",
  },
  {
    question: "Una clienta siempre va con la misma técnica. ¿La respeta?",
    answer:
      "Si la clienta la nombra, reserva con ella. Si esa persona no tiene hueco a la hora pedida, le propone la siguiente hora libre de esa misma técnica en lugar de cambiarla de profesional sin preguntar.",
  },
  {
    question: "Tengo una chica en formación. ¿Puedo evitar que le caigan juegos de volumen?",
    answer:
      "Sí. Márcala como «solo si lo piden» en volumen y déjala normal en lifting o tinte. Nunca le llegará un volumen asignado por la recepcionista; si una clienta la pide por su nombre, se le sugiere una vez otra técnica y, si insiste, se reserva con quien pidió.",
  },
  {
    question: "¿Guarda la ficha de cada clienta, con la curva y el grosor?",
    answer:
      "No. La reserva guarda nombre, teléfono, servicio y profesional; no tiene campo de notas. Lo que la clienta cuente por teléfono queda en la transcripción de la llamada, en el panel. La ficha técnica sigue donde la tengas ahora.",
  },
  {
    question: "Muchas citas me llegan por Instagram. ¿Se pisan con las del teléfono?",
    answer:
      "No, si las apuntas en el calendario que conectas a Alhabla. Antes de ofrecer una hora, la recepcionista mira ese calendario y trata como ocupado todo lo que hay en él. Alhabla no se conecta a Instagram ni a programas de reservas: su referencia es tu calendario.",
  },
  {
    question: "Trabajo sola en una cabina. ¿Me sirve?",
    answer:
      "Sí: mientras pones un juego no hay nadie más que pueda coger el teléfono. Das de alta una profesional y una plaza a la vez, y la recepcionista solo ofrece las horas en las que no estás ya con otra clienta.",
  },
];

export default function PestanasYCejasPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      migas={[{ name: "Pestañas y cejas", path: ruta }]}
      etiqueta={{ icono: Eye, texto: "Pestañas y cejas" }}
      titulo="Recepcionista de IA para estudios de pestañas y cejas"
      entradilla={
        <p>
          Con una pinza aislando y otra colocando no queda mano para el móvil. Tu recepcionista de IA coge la llamada,
          distingue un relleno de un juego nuevo y reserva con la técnica que toca, mirando tu calendario real.
        </p>
      }
      descripcion={descripcion}
      ctaSecundario={{ texto: "Leer una llamada de ejemplo", href: "#llamada" }}
      ubicacion="pestanas_y_cejas"
      faqs={faqs}
      tituloFaqs="Preguntas de estudios de pestañas"
      relacionadas={[
        {
          href: "/salon-de-unas",
          titulo: "Salones de uñas",
          texto: "Otro oficio de manos ocupadas y clientas que vuelven cada pocas semanas.",
        },
        {
          href: "/centro-de-estetica",
          titulo: "Centros de estética",
          texto: "Si además de pestañas tienes cabinas de faciales y corporales.",
        },
        {
          href: "/herramientas/politica-de-cancelacion",
          titulo: "Política de cancelación",
          texto: "Decide qué pasa cuando alguien falta a un juego de dos horas, y escríbelo bien.",
        },
        {
          href: "/blog/lista-de-espera-huecos-libres",
          titulo: "Lista de espera para huecos libres",
          texto: "Cómo se rellena la cita que alguien anula a última hora.",
        },
        { href: "/planes", titulo: "Planes y precios", texto: "Qué incluye cada plan y cuántos minutos trae." },
      ]}
      cierre="Que las pinzas no tengan que esperar al teléfono."
    >
      <Seccion titulo="El teléfono suena a mitad de un juego de volumen" estrecha>
        <Texto>
          <p>
            Un juego completo se pone con la clienta tumbada, los ojos cerrados y los parches bajo las pestañas
            inferiores. Trabajas pestaña a pestaña: una pinza separa, la otra coloca, y el adhesivo marca el ritmo.
            Soltarlo todo para contestar no sale gratis: la gota se seca, pierdes el aislamiento y la clienta, que
            estaba a punto de dormirse, abre los ojos para ver qué pasa.
          </p>
          <p>
            Así que el móvil se queda boca abajo en la bandeja durante dos horas o más. Y las llamadas de un estudio
            de pestañas rara vez pueden esperar a que termines: la novia que quiere su relleno el jueves antes de la
            boda, la clienta que vuelve de la playa con media fila caída, la que ha visto vuestro laminado en una
            historia y pregunta el precio. Si nadie descuelga, lo fácil para ella es probar con el siguiente estudio
            que le salga en el buscador.
          </p>
          <p>
            Hay además algo muy propio de este oficio: casi todo se repite. Los rellenos vuelven cada pocas semanas y
            cada uno empieza con una llamada. Una recepcionista que las atiende sin que sueltes las pinzas te quita la
            tarea de devolver llamadas perdidas entre clienta y clienta, que es justo el rato que tienes para comer.
          </p>
        </Texto>
      </Seccion>

      <Seccion
        titulo="Los servicios de un estudio, con su duración"
        entradilla={
          <p>
            Así puede quedar el catálogo de un estudio de pestañas y cejas. La recepcionista ofrece huecos con la
            duración que pongas en cada servicio, y da el precio que tengas en él.
          </p>
        }
        fondo
      >
        <Tabla
          cabecera={["Servicio", "Duración de ejemplo", "Qué conviene saber al darlo de alta"]}
          filas={[
            ["Extensiones clásicas, juego completo", "2 h", "Una extensión por pestaña natural. Es la cita más larga para quien empieza."],
            ["Extensiones de volumen, juego completo", "2 h 30 min", "Va aparte del clásico: dura más y quizá no lo hace todo el equipo."],
            ["Relleno de clásicas", "1 h", "Solo tiene sentido si quedan suficientes extensiones; ponle tu límite."],
            ["Relleno de volumen", "1 h 30 min", "La misma idea que el anterior, con más tiempo de trabajo."],
            ["Retirada de extensiones", "30 min", "Sola, o delante de un juego nuevo cuando vienen de otro centro."],
            ["Lifting de pestañas con tinte", "1 h", "Trabaja la pestaña natural; no lleva rellenos."],
            ["Laminado de cejas", "45 min", "Se suele pedir junto al diseño o al tinte, en la misma cita."],
            ["Diseño de cejas", "30 min", "Si la pinza, la cera y el hilo tienen precio distinto, un servicio por técnica."],
            ["Tinte de cejas o de pestañas", "15 min", "Corto; encaja detrás de otro servicio sin buscar otro día."],
          ]}
          nota="Duraciones orientativas para ver cómo se monta el catálogo: configúralas con las tuyas. Si tu relleno de clásicas dura 75 minutos, ponle 75; si no, la recepcionista ofrecerá huecos que se te quedan cortos."
        />
        <div className="mt-8">
          <Texto>
            <p>
              Una misma cita puede llevar varios servicios seguidos: retirada y juego nuevo, o laminado, diseño y tinte
              de cejas. Alhabla suma las duraciones y busca un hueco en el que quepan enteros, con la misma técnica.
            </p>
          </Texto>
        </div>
      </Seccion>

      <Seccion titulo="Relleno o juego nuevo: lo que no se ve por teléfono" estrecha>
        <Texto>
          <p>
            Por teléfono nadie ve cuántas extensiones le quedan a la clienta. Es la duda que más descoloca la agenda:
            se reserva una hora de relleno y aparece alguien que necesita un juego completo, o que lleva extensiones
            puestas en otro sitio que hay que retirar primero.
          </p>
          <p>
            La recepcionista no adivina: trabaja con tus reglas. En el panel, en <strong>«Información para
            responder»</strong>, escribe la tuya con palabras normales. Por ejemplo: «el relleno es para trabajos
            nuestros de hasta tres semanas; si hace más o vienen de otro centro, se reserva retirada y juego nuevo».
            Con eso puede preguntar cuánto hace del último relleno y dónde se lo hicieron, y elegir los servicios que
            corresponden. Si la clienta no lo sabe, reserva lo que pide y tú lo ajustas al verla.
          </p>
          <p>
            Ayuda mucho que cada servicio tenga un nombre que no deje dudas: «Relleno de volumen», no
            «Mantenimiento». Es lo que la recepcionista lee al elegir y lo que tú verás luego en el calendario.
          </p>
        </Texto>
      </Seccion>

      <Seccion
        titulo="Las llamadas de cada semana y qué hace con ellas"
        entradilla={<p>Las que más se repiten en un estudio de pestañas y cejas, y hasta dónde llega la recepcionista.</p>}
        fondo
      >
        <Tarjetas
          items={[
            {
              icono: Repeat,
              titulo: "«Quiero mi relleno»",
              texto:
                "Busca un hueco con la duración del relleno. Si la clienta pide a su técnica de siempre, con ella; si esa persona no puede a esa hora, le propone su siguiente hueco libre.",
            },
            {
              icono: Tag,
              titulo: "«¿Cuánto cuesta el volumen?»",
              texto:
                "Contesta con el precio y la duración de tu catálogo. Por eso conviene tenerlo al día: un precio nuevo se cambia escribiéndole al Gestor desde el móvil.",
            },
            {
              icono: Layers,
              titulo: "«Me las puse en otro centro»",
              texto:
                "Si tu regla dice que eso es retirada y juego nuevo, reserva los dos servicios juntos en la misma cita, con el tiempo de ambos.",
            },
            {
              icono: Eye,
              titulo: "«Laminado y tinte de cejas»",
              texto:
                "Dos servicios en una cita: suma los tiempos, busca la hora en la que caben y lo reserva con quien hace los dos.",
            },
            {
              icono: CalendarClock,
              titulo: "«El primer hueco del sábado»",
              texto:
                "Mira el calendario real. Si el sábado está lleno, ofrece otra hora y, si la clienta prefiere esperar, la apunta para avisarla si se libera.",
            },
            {
              icono: MessageCircle,
              titulo: "«Tengo que cambiar la de mañana»",
              texto:
                "Si llama desde el móvil con el que reservó y aceptó los mensajes, encuentra su cita y la cambia o la anula. El hueco que deja puede ir a quien esperaba.",
            },
          ]}
        />
      </Seccion>

      <Seccion
        id="llamada"
        titulo="Un relleno que acaba siendo juego nuevo"
        entradilla={
          <p>
            Una clienta llama para un relleno, pero sus extensiones son de otro centro y de hace un mes. El estudio
            tiene escrita su regla en «Información para responder».
          </p>
        }
      >
        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-start">
          <Conversacion
            etiqueta="Ejemplo de llamada a un estudio de pestañas"
            turnos={[
              { quien: "recepcionista", texto: "Estudio Lía, te atiende una inteligencia artificial. ¿En qué te ayudo?" },
              { quien: "cliente", texto: "Hola, quería pedir un relleno de pestañas para esta semana." },
              { quien: "recepcionista", texto: "Claro. ¿Cuánto hace de tu último relleno, y te lo hicieron aquí?" },
              { quien: "cliente", texto: "Unas cuatro semanas, pero me las puse en otro sitio." },
              {
                quien: "recepcionista",
                texto:
                  "En ese caso el estudio lo hace como retirada y juego nuevo: el relleno es para trabajos suyos de hasta tres semanas. ¿Las quieres clásicas o de volumen?",
              },
              { quien: "cliente", texto: "De volumen." },
              {
                quien: "recepcionista",
                texto:
                  "Retirada y volumen son unas tres horas. Tengo el jueves a las diez con Nerea, que es quien más volumen hace. ¿Te viene bien?",
              },
              { quien: "cliente", texto: "Sí, el jueves a las diez." },
              { quien: "recepcionista", texto: "Perfecto. ¿A nombre de quién la reservo?" },
              { quien: "cliente", texto: "De Irene." },
              {
                quien: "recepcionista",
                texto:
                  "Hecho, Irene: jueves a las diez con Nerea, retirada y juego de volumen. ¿Te mando la confirmación por WhatsApp a este número?",
              },
              { quien: "cliente", texto: "Sí, gracias." },
            ]}
          />
          <Texto>
            <p>
              La recepcionista no ha decidido nada por su cuenta. La regla de las tres semanas la escribió el
              estudio; la duración de tres horas sale de sumar los dos servicios del catálogo, y Nerea aparece porque
              está marcada como especialista en volumen.
            </p>
            <p>
              Si Irene hubiera pedido a otra técnica por su nombre, la cita sería con ella. Y si el jueves no hubiera
              tenido hueco, le habría propuesto el siguiente que quedara libre en el calendario.
            </p>
          </Texto>
        </div>
      </Seccion>

      <Seccion titulo="Cómo se monta en Alhabla un estudio de pestañas" fondo>
        <Pasos
          pasos={[
            {
              titulo: "Date de alta como «Otros»",
              texto:
                "Las pestañas aún no tienen plantilla propia en el alta. Te propondrá servicios genéricos para empezar: marca los que te pida para avanzar y, al terminar, cámbialos en Agente › Servicios por los tuyos, con nombre, duración y precio.",
            },
            {
              titulo: "Marca qué técnica domina cada servicio",
              texto:
                "En Agente › Profesionales, una ficha por técnica y un nivel en cada servicio: especialista, lo hace o solo si lo piden. La especialista en volumen se lleva esas citas cuando la clienta no pide a nadie.",
            },
            {
              titulo: "Horario y camillas",
              texto:
                "Pon tu horario y, en Agente › Capacidad, cuántas clientas atendéis a la vez. Con dos camillas y tres técnicas, la capacidad es dos: nunca habrá tres juegos a la misma hora.",
            },
            {
              titulo: "Conecta tu calendario",
              texto: (
                <>
                  Google Calendar, Outlook o el Calendario de Apple. Lo que ya esté apuntado ahí cuenta como ocupado.{" "}
                  <Link href="/integraciones" className="font-semibold text-morado-tinta underline underline-offset-4">
                    Ver integraciones
                  </Link>
                  .
                </>
              ),
            },
            {
              titulo: "Desvía las llamadas que no coges",
              texto: (
                <>
                  Conservas tu número: en tu operador activas el desvío si no contestas o comunica, y lo compruebas desde
                  el panel.{" "}
                  <Link href="/desvio-de-llamadas" className="font-semibold text-morado-tinta underline underline-offset-4">
                    Cómo hacerlo con tu operador
                  </Link>
                  .
                </>
              ),
            },
          ]}
        />
      </Seccion>

      <Seccion titulo="Recordatorios y lista de espera, pensados para los rellenos" estrecha>
        <Texto>
          <p>
            Cuando la clienta acepta que le escribáis, recibe la confirmación por WhatsApp nada más reservar, en todos
            los planes. En Pro y Scale, además, le llega un recordatorio 24 horas antes si la cita se reservó con más
            margen, y puede confirmarla, cambiarla o anularla respondiendo al mensaje. En un oficio de citas largas,
            enterarte el día antes de que alguien no viene es la diferencia entre una camilla vacía y una camilla
            ocupada.
          </p>
          <p>
            Para ese hueco que se libera está la lista de espera. Si una clienta quería una hora que ya estaba cogida
            —el viernes por la tarde, el sábado por la mañana—, la recepcionista le ofrece avisarla. Si esa hora se
            anula, se le ofrece primero a quien la pidió antes, por WhatsApp, y se la queda con un botón. Y en el
            aviso de anulación que te llega a ti tienes otro botón para avisar a quien esperaba.
          </p>
          <p>
            ¿Quieres ver qué decir en esos mensajes cuando los mandas tú? Tienes ejemplos en las{" "}
            <Link href="/herramientas/plantillas-recordatorio-de-cita">plantillas de recordatorio de cita</Link>.
          </p>
        </Texto>
        <div className="mt-8">
          <Nota tipo="consejo" titulo="Cuando algo cambia en el estudio">
            Escríbele al Gestor por WhatsApp: «Nerea no viene el sábado», «el lifting pasa a 45 euros», «el martes
            abrimos a las once». Te propone el cambio y no toca nada hasta que pulsas «Confirmar».{" "}
            <Link href="/agenda-por-whatsapp" className="font-semibold text-morado-tinta underline underline-offset-4">
              Así funciona el Gestor
            </Link>
            .
          </Nota>
        </div>
      </Seccion>
    </PaginaGuia>
  );
}
