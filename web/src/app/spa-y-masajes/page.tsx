import type { Metadata } from "next";
import Link from "next/link";
import { BedDouble, CalendarDays, Clock, Flower2, Gift, Info, MessageSquareText, UserCheck, Users } from "lucide-react";
import {
  Conversacion,
  Nota,
  PaginaGuia,
  Seccion,
  Tabla,
  Tarjetas,
  Texto,
} from "@/components/pagina-guia";
import { metadataDePagina } from "@/lib/seo";

/**
 * Spa y masajes de relajación (2026-10-20). Va con los otros dos sectores
 * sin datos de salud: por eso la página habla solo de masajes de relajación
 * y bienestar, rituales y circuitos, y nunca de nada terapéutico. Tampoco
 * promete guardar del cliente más que lo que guarda una reserva (nombre,
 * teléfono, servicio y profesional; prisma/schema.prisma › Booking).
 *
 * Límites reales que la página dice en voz alta, porque un spa los va a
 * encontrar el primer día:
 * - una llamada termina en UNA cita (Booking.callId es único) y cada cita es
 *   para una persona (numberPeople: 1 en voiceTools/service.ts): el masaje
 *   en pareja con dos terapeutas no se reserva solo;
 * - toda cita ocupa a un profesional y la capacidad es una para todo el
 *   negocio (lib/availability.ts): un circuito por turnos con aforo no se
 *   puede llevar aparte;
 * - no hay tiempo entre citas configurable: el cambio de cabina va dentro de
 *   la duración del servicio;
 * - la recepcionista no ve bonos ni cobra; sí puede dejar un recado, que
 *   llega al dueño por WhatsApp (modules/whatsapp/recados.ts).
 */

const ruta = "/spa-y-masajes";
const titulo = "Recepcionista de IA para spa y masajes";
const descripcion =
  "Atiende las llamadas de tu spa sin entrar en cabina: masajes de relajación, rituales y circuitos, con el terapeuta que piden y confirmación por WhatsApp.";

export const metadata: Metadata = metadataDePagina({ ruta, titulo, descripcion });

const faqs = [
  {
    question: "¿Puede aconsejar qué masaje le conviene a cada cliente?",
    answer:
      "No hace de terapeuta. Explica en qué consiste cada servicio con lo que tú le hayas escrito y reserva el que el cliente elija. Si en «Información para responder» dejas claro que vuestros masajes son de relajación y bienestar, lo contará así a quien pregunte.",
  },
  {
    question: "¿Qué guarda de cada cliente?",
    answer:
      "Lo que necesita la cita: nombre, teléfono, servicio y terapeuta. No hay fichas de cliente ni campo de notas. Lo hablado queda en la transcripción de la llamada y, solo si el cliente acepta que se grabe, también el audio.",
  },
  {
    question: "¿Reserva masajes en pareja?",
    answer:
      "Todavía no por sí sola: cada llamada termina en una cita, y cada cita es para una persona con alguien del equipo. Lo que sí hace es contar lo que ofrecéis para dos y dejarte el recado, para que llames tú y cuadres las dos cabinas.",
  },
  {
    question: "¿Y los circuitos de aguas?",
    answer:
      "Si el circuito se reserva como una cita con hora de entrada y una persona del equipo asignada, se da de alta como un servicio más. Si va por turnos con aforo compartido, la recepcionista informa de horarios y precio y te deja el recado, porque hoy no lleva ese aforo aparte.",
  },
  {
    question: "¿Sabe si un bono regalo es válido?",
    answer:
      "No, porque no tiene acceso a tus bonos. Reserva el servicio que el cliente dice tener regalado y le recuerda traer el bono; la comprobación la haces tú al recibirle.",
  },
  {
    question: "Muchos clientes son extranjeros. ¿Les atiende?",
    answer:
      "Sí. Además de castellano habla inglés, francés, alemán, italiano, portugués, neerlandés y ruso en todos los planes, algo que se agradece en un spa de hotel o de costa.",
  },
  {
    question: "Ya uso un programa de reservas. ¿Tengo que dejarlo?",
    answer:
      "Alhabla no es un programa de reservas ni se conecta a ninguno: trabaja con tu calendario de Google, Outlook o Apple. Si tu programa vuelca sus citas en ese calendario, la recepcionista las ve como horas ocupadas y no las ofrece.",
  },
];

export default function SpaYMasajesPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      migas={[{ name: "Spa y masajes", path: ruta }]}
      etiqueta={{ icono: Flower2, texto: "Spa y masajes" }}
      titulo="Recepcionista de IA para spas y centros de masaje"
      entradilla={
        <p>
          En cabina hay aceite en las manos, luz baja y alguien que ha venido a desconectar. Tu recepcionista de IA
          atiende el teléfono fuera, informa de masajes, rituales y circuitos y reserva con el terapeuta que toca, sin
          interrumpir la sesión.
        </p>
      }
      descripcion={descripcion}
      ctaSecundario={{ texto: "Ver cómo atiende una llamada", href: "#llamada" }}
      ubicacion="spa_y_masajes"
      faqs={faqs}
      tituloFaqs="Preguntas de spas y centros de masaje"
      relacionadas={[
        {
          href: "/blog/agenda-para-spa",
          titulo: "Agenda para spa",
          texto: "Cómo organizar reservas, cabinas y recordatorios sin perder clientes.",
        },
        {
          href: "/centro-de-estetica",
          titulo: "Centros de estética",
          texto: "Si además de masajes haces faciales y corporales por cabina.",
        },
        {
          href: "/agenda-por-whatsapp",
          titulo: "El Gestor por WhatsApp",
          texto: "Cierres, tarifas y ausencias cambiados con un mensaje y tu «Confirmar».",
        },
        {
          href: "/integraciones",
          titulo: "Integraciones",
          texto: "Los calendarios en los que reserva: Google, Outlook y Apple.",
        },
        {
          href: "/desvio-de-llamadas",
          titulo: "Desvío de llamadas",
          texto: "Mantén el número del spa y desvía solo lo que no coges.",
        },
      ]}
      cierre="Que en cabina solo se oiga la música."
    >
      <Seccion titulo="Un móvil que suena rompe lo que el cliente ha venido a buscar" estrecha>
        <Texto>
          <p>
            En un spa el silencio forma parte del servicio. La música está baja, la luz es tenue y el cliente lleva un
            buen rato soltando la tensión de la semana. Si en ese momento vibra un teléfono, o el terapeuta sale a
            contestar con las manos untadas de aceite, la sesión ya no es la misma. Por eso el teléfono se queda fuera
            de la cabina, en silencio.
          </p>
          <p>
            El problema es que las sesiones son largas. Un masaje de una hora seguido de un ritual de noventa minutos
            deja la línea sin atender toda la mañana. Y la gente llama cuando piensa en su descanso: desde la oficina,
            en la pausa de la comida, el jueves con la vista puesta en el sábado.
          </p>
          <p>
            Muchas de esas llamadas ni siquiera son para reservar, sino para preguntar: qué incluye el ritual, si hace
            falta bañador, si el bono que le regalaron sigue valiendo, si hay algo para dos. Si nadie las contesta,
            quien llama busca otro spa en el que sí haya alguien al otro lado.
          </p>
        </Texto>
      </Seccion>

      <Seccion
        titulo="La carta del spa, servicio a servicio"
        entradilla={
          <p>
            Solo masajes de relajación y bienestar, rituales y circuitos. Cada servicio lleva su duración y su precio,
            y la recepcionista ofrece huecos con esa duración exacta.
          </p>
        }
        fondo
      >
        <Tabla
          cabecera={["Servicio", "Duración de ejemplo", "Cómo darlo de alta"]}
          filas={[
            ["Masaje relajante de 30 minutos", "30 min", "Para espalda y cuello, o como añadido a otro servicio en la misma cita."],
            ["Masaje relajante de 60 minutos", "1 h", "Si das el mismo masaje en varias duraciones, un servicio por duración."],
            ["Masaje relajante de 90 minutos", "1 h 30 min", "Con nombre propio, para que nadie reserve el corto pensando en el largo."],
            ["Masaje con piedras calientes", "1 h 15 min", "Un servicio aparte, con quien mejor lo hace marcado como especialista."],
            ["Masaje con aromaterapia", "1 h", "Si el aceite se elige al llegar, no hace falta un servicio por aroma."],
            ["Masaje craneofacial", "30 min", "Encaja detrás de un masaje corporal sin buscar otra cita."],
            ["Ritual corporal (exfoliación, envoltura y masaje)", "1 h 30 min", "Con el nombre comercial que uses, que es el que dirán al llamar."],
            ["Circuito de spa privado", "1 h 30 min", "Solo si se reserva como cita con hora de entrada y alguien del equipo asignado."],
          ]}
          nota="Duraciones orientativas: configúralas con las tuyas. Alhabla no deja tiempo libre entre una cita y la siguiente por su cuenta, así que, si necesitas diez minutos para cambiar la camilla y ventilar la cabina, súmalos a la duración del servicio."
        />
        <div className="mt-8">
          <Nota tipo="importante" titulo="Circuitos con aforo y masajes en pareja">
            Hoy cada reserva es una cita para una persona con alguien del equipo, y cada llamada termina en una cita.
            Un circuito por turnos en el que entran varias personas a la vez, o un masaje en pareja con dos terapeutas
            en la misma cabina, todavía no se reservan solos. La recepcionista sí explica horarios, precios y qué
            incluyen, con lo que escribas en «Información para responder», y te deja el recado para que cuadres tú las
            plazas.
          </Nota>
        </div>
      </Seccion>

      <Seccion titulo="Lo que preguntan al llamar a un spa">
        <Tarjetas
          items={[
            {
              icono: Gift,
              titulo: "«Me han regalado un bono»",
              texto:
                "Reserva el servicio del bono como cualquier cita y le recuerda traerlo. Comprobar si es válido o si ya se usó te toca a ti en recepción: no tiene acceso a tus bonos.",
            },
            {
              icono: Info,
              titulo: "«¿Tengo que traer algo?»",
              texto:
                "Contesta con lo que escribas en «Información para responder»: si dais albornoz y zapatillas, si hace falta bañador, con cuánta antelación llegar, dónde aparcar.",
            },
            {
              icono: UserCheck,
              titulo: "«Quiero que me lo haga Lucía»",
              texto:
                "Reserva con la persona que piden por su nombre. Si alguien prefiere terapeuta mujer u hombre, puede tenerlo en cuenta si en «Información para responder» dices quién es quién.",
            },
            {
              icono: Users,
              titulo: "«¿Tenéis algo para dos?»",
              texto:
                "Cuenta lo que ofrecéis para parejas y te deja el recado con el día que querían, para que les llames y cuadres las dos cabinas.",
            },
            {
              icono: MessageSquareText,
              titulo: "«Quiero regalar un masaje»",
              texto:
                "No vende bonos ni cobra. Informa de precios y de cómo se compran en tu centro, si se lo has escrito, y si el cliente quiere que le llaméis, te deja el recado.",
            },
            {
              icono: Clock,
              titulo: "«Voy a llegar tarde»",
              texto:
                "No acorta ni mueve la cita por su cuenta. Toma el recado y te llega por WhatsApp, para que decidas tú si la sesión se acorta o se mueve.",
            },
          ]}
        />
      </Seccion>

      <Seccion
        id="llamada"
        titulo="Un bono regalo para el sábado por la tarde"
        entradilla={<p>La clienta quiere la hora más pedida del fin de semana, y ya está cogida.</p>}
        fondo
      >
        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-start">
          <Conversacion
            etiqueta="Ejemplo de llamada a un spa"
            turnos={[
              {
                quien: "recepcionista",
                texto: "Spa Alameda, te atiende una inteligencia artificial. ¿En qué puedo ayudarte?",
              },
              {
                quien: "cliente",
                texto: "Hola. Me regalaron un bono para el ritual de chocolate y quería usarlo el sábado por la tarde.",
              },
              {
                quien: "recepcionista",
                texto:
                  "El ritual de chocolate dura noventa minutos. A las cinco ya no queda hueco; tengo a las siete con Lucía. ¿Te va bien, o prefieres que te avise por WhatsApp si se libera la de las cinco?",
              },
              { quien: "cliente", texto: "A las siete me viene bien." },
              { quien: "recepcionista", texto: "Perfecto. ¿A nombre de quién lo reservo?" },
              { quien: "cliente", texto: "De Carmen." },
              {
                quien: "recepcionista",
                texto:
                  "Reservado, Carmen: sábado a las siete, ritual de chocolate con Lucía. Trae el bono ese día, que lo comprueban en recepción. ¿Quieres la confirmación por WhatsApp?",
              },
              { quien: "cliente", texto: "Sí, por favor. ¿Tengo que llevar algo?" },
              {
                quien: "recepcionista",
                texto: "No hace falta: allí te dan albornoz, toalla y zapatillas. Solo te piden llegar diez minutos antes.",
              },
            ]}
          />
          <Texto>
            <p>
              Fíjate en lo que no hace. No comprueba el bono, porque no puede: lo deja para recepción. Y la respuesta
              sobre qué llevar sale tal cual de lo que el spa escribió en «Información para responder». Lo que no
              esté escrito ahí no lo puede contestar.
            </p>
            <p>
              Si Carmen hubiera preferido esperar a las cinco, quedaría apuntada: en cuanto alguien anule esa hora, se
              le ofrece por WhatsApp para quedársela con un botón.
            </p>
          </Texto>
        </div>
      </Seccion>

      <Seccion
        titulo="Así se configura un spa en Alhabla"
        entradilla={
          <p>
            Todo se hace desde el apartado Agente del panel. El alta te guía en orden; esto es lo que conviene cuidar
            en un spa.
          </p>
        }
      >
        <Tarjetas
          columnas={2}
          items={[
            {
              icono: Flower2,
              titulo: "Tipo de negocio: «Otros»",
              texto:
                "Los spas aún no tienen plantilla propia, así que el alta te propone servicios genéricos para empezar. Al terminar, en Servicios, cámbialos por tu carta de masajes y rituales, con su precio.",
            },
            {
              icono: UserCheck,
              titulo: "Terapeutas y lo que domina cada uno",
              texto:
                "Crea una ficha por terapeuta y dile, servicio a servicio, si es su especialidad, si lo hace o si solo debe reservarse cuando lo pidan por su nombre. Así, quien mejor trabaja con piedras calientes recibe esas citas cuando el cliente no pide a nadie.",
            },
            {
              icono: BedDouble,
              titulo: "Cabinas: la capacidad",
              texto:
                "En Capacidad indica cuántas citas caben a la vez, que en un spa suele ser el número de cabinas. Tres terapeutas y dos cabinas: capacidad dos, y la recepcionista no colocará un tercer masaje a esa hora.",
            },
            {
              icono: CalendarDays,
              titulo: "Horario, calendario y WhatsApp",
              texto: (
                <>
                  Tu horario, tu calendario de Google, Outlook o Apple (lo apuntado ahí cuenta como ocupado) y tu móvil
                  para los avisos y el Gestor. Las llamadas que no coges llegan con un{" "}
                  <Link href="/desvio-de-llamadas" className="font-semibold text-morado-tinta underline underline-offset-4">
                    desvío desde tu operador
                  </Link>
                  .
                </>
              ),
            },
          ]}
        />
      </Seccion>

      <Seccion titulo="Recordatorios, huecos que se liberan y una carta al día" fondo estrecha>
        <Texto>
          <p>
            Un ritual de noventa minutos al que nadie se presenta deja una cabina parada hora y media. Todos los planes
            envían la confirmación por WhatsApp en cuanto se reserva, a quien acepta recibir mensajes. Pro y Scale
            añaden el recordatorio: sale un día antes de la cita, si se pidió con más de 24 horas de margen, y el
            cliente responde ahí mismo para confirmar, cambiar la hora o anular.
          </p>
          <p>
            Si alguien anula, la hora no tiene por qué quedarse vacía: si otra persona la había pedido y se quedó sin
            ella, recibe un WhatsApp para reservarla con un botón. Es en las tardes de fin de semana y en las semanas de
            regalos, antes de Navidad o del Día de la Madre, cuando más se agradece.
          </p>
          <p>
            Y cuando algo cambia en el spa —un terapeuta que no viene, un cierre el 24 por la tarde, una tarifa
            nueva—, se lo escribes al <Link href="/agenda-por-whatsapp">Gestor</Link> por WhatsApp. También puedes
            preguntarle qué no supo contestar la recepcionista esta semana y darle la respuesta para la próxima vez.
            Nada se aplica hasta que pulsas «Confirmar».
          </p>
        </Texto>
      </Seccion>
    </PaginaGuia>
  );
}
