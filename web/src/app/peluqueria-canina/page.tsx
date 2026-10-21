import type { Metadata } from "next";
import Link from "next/link";
import { Dog } from "lucide-react";
import {
  Conversacion,
  Fuentes,
  ListaCheck,
  Nota,
  PaginaGuia,
  Seccion,
  Tabla,
  Texto,
} from "@/components/pagina-guia";
import { metadataDePagina } from "@/lib/seo";

/**
 * Peluquería canina (2026-10-20), uno de los tres sectores con cita previa y
 * sin datos de salud. Lo que se refiere al perro no es un dato personal; el
 * nombre y el teléfono del dueño, sí, y es lo único suyo que guarda la
 * reserva (prisma/schema.prisma › Booking: nombre, teléfono, servicios y
 * profesional, sin notas).
 *
 * Por eso la página explica el truco que lo hace funcionar sin notas: un
 * servicio por tamaño o tipo de pelo, con su duración, para que la
 * recepcionista elija el correcto preguntando. El nombre del perro y lo que
 * contó el dueño quedan en la transcripción (Llamadas en la app).
 *
 * Límites que dice: una llamada termina en una cita (Booking.callId único),
 * aunque esa cita puede llevar varios servicios seguidos con la duración
 * sumada (book_appointment en modules/voiceTools/service.ts). Pasar la
 * llamada al móvil solo existe si el número de Alhabla es el principal.
 *
 * La única cifra del sector es la del Ministerio de Derechos Sociales
 * (adelanto de la Estadística Nacional sobre Protección Animal, nota del
 * 5 de junio de 2026), enlazada en <Fuentes>.
 */

const ruta = "/peluqueria-canina";
const titulo = "Recepcionista de IA para peluquería canina";
const descripcion =
  "Contesta el teléfono de tu peluquería canina con el perro en la mesa: pregunta el tamaño, elige el baño o el corte y confirma la cita por WhatsApp.";

export const metadata: Metadata = metadataDePagina({ ruta, titulo, descripcion });

const faqs = [
  {
    question: "¿Cómo sabe qué servicio reservar si no ve al perro?",
    answer:
      "Preguntando. Si tus servicios van por tamaño o tipo de pelo, le basta con saber la raza, el peso o si es pequeño, mediano o grande para escoger el que toca. Los casos dudosos los resuelves tú por escrito en «Información para responder».",
  },
  {
    question: "¿Apunta el nombre del perro en la cita?",
    answer:
      "No: la cita va a nombre del dueño y guarda su teléfono, el servicio y quién lo hace. El nombre del perro y lo que cuente el dueño están en la transcripción de la llamada, en el panel.",
  },
  {
    question: "¿Y si alguien trae dos perros?",
    answer:
      "Una llamada termina en una cita, pero esa cita puede llevar varios servicios seguidos con la misma persona: el baño del pequeño y el corte del mediano, por ejemplo, con la duración sumada. Si los quieres a la vez con dos peluqueros distintos, eso todavía lo cuadras tú.",
  },
  {
    question: "Un dueño insiste en hablar conmigo. ¿Me puede pasar la llamada?",
    answer:
      "Depende de cómo te llegan. Con el desvío, solo entran en Alhabla las llamadas que tú no coges. Si publicas el número de Alhabla como principal, eliges en «Cuándo pasarme llamadas»: nunca, si el cliente lo pide o siempre.",
  },
  {
    question: "¿Y si un perro necesita más tiempo del previsto?",
    answer:
      "La cita dura lo que dura su servicio. Si al recibirlo ves que va para largo, mueve la siguiente desde tu calendario o pídeselo al Gestor por WhatsApp: «pasa al perro de las doce a las doce y media». Te lo propone y no lo aplica hasta que confirmas.",
  },
  {
    question: "Trabajo sola con una mesa. ¿Tiene sentido?",
    answer:
      "Sí. Con una sola ficha de profesional y la capacidad en uno, nunca te dará dos perros a la misma hora: solo propone lo que está libre en tu calendario. Y como no hay nadie más que descuelgue, es donde más se nota.",
  },
];

export default function PeluqueriaCaninaPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      migas={[{ name: "Peluquería canina", path: ruta }]}
      etiqueta={{ icono: Dog, texto: "Peluquería canina" }}
      titulo="Recepcionista de IA para peluquerías caninas"
      entradilla={
        <p>
          Con un perro mojado en la mesa no se suelta la correa para coger el móvil. Tu recepcionista de IA atiende la
          llamada, pregunta el tamaño y el tipo de pelo, elige el servicio que toca y deja la cita en tu calendario, con
          la confirmación al dueño por WhatsApp.
        </p>
      }
      descripcion={descripcion}
      ctaSecundario={{ texto: "Ver una llamada de ejemplo", href: "#llamada" }}
      ubicacion="peluqueria_canina"
      faqs={faqs}
      tituloFaqs="Preguntas de peluquerías caninas"
      relacionadas={[
        {
          href: "/herramientas/plantillas-recordatorio-de-cita",
          titulo: "Plantillas de recordatorio de cita",
          texto: "Mensajes para confirmar y recordar la cita, listos para copiar.",
        },
        {
          href: "/integraciones/whatsapp",
          titulo: "WhatsApp",
          texto: "Qué recibe el dueño del perro y qué te llega a ti.",
        },
        {
          href: "/agenda-por-whatsapp",
          titulo: "El Gestor por WhatsApp",
          texto: "Cierra agosto o mueve una cita con un mensaje.",
        },
        {
          href: "/herramientas/calculadora-de-llamadas-perdidas",
          titulo: "Calculadora de llamadas perdidas",
          texto: "Cuánto se va cada mes en baños y cortes que no llegas a coger.",
        },
        {
          href: "/desvio-de-llamadas",
          titulo: "Desvío de llamadas",
          texto: "Conserva tu número y desvía solo lo que no coges.",
        },
      ]}
      cierre="El perro, en la mesa; el teléfono, atendido."
    >
      <Seccion titulo="Con el perro en la mesa, el teléfono espera" estrecha>
        <Texto>
          <p>
            En una peluquería canina las manos casi nunca están libres. Mientras secas, una sujeta la boquilla y la
            otra al perro, que no puede quedarse solo en la mesa ni un segundo. En la bañera estás empapada hasta los
            codos. Y con el secador de alta velocidad en marcha no oirías el teléfono aunque estuviera al lado.
          </p>
          <p>
            Además, dar una hora lleva más conversación que en otros oficios, porque primero hay que saber qué perro
            viene: no es lo mismo bañar a un chihuahua que deslanar a un pastor alemán. Tamaño, raza, si tiene muchos
            nudos, si es la primera vez. Atender eso con un perro a medio secar sale mal para los dos.
          </p>
          <p>
            Y luego están las llamadas que no son para reservar: «¿está ya Toby?», «¿a qué hora cerráis?», «¿cortáis
            las uñas sin cita?». Suenan a media mañana, con tres perros en marcha, que es justo cuando menos puedes
            hacer de recepcionista.
          </p>
          <p>
            No es un oficio pequeño. Según el adelanto de la Estadística Nacional sobre Protección Animal del
            Ministerio de Derechos Sociales, en 2025 había 7.562.893 perros inscritos en los registros autonómicos.
            Detrás de cada uno hay un dueño que, tarde o temprano, llama para pedir hora.
          </p>
        </Texto>
      </Seccion>

      <Seccion
        titulo="Un servicio por tamaño, para que acierte la duración"
        entradilla={
          <p>
            La reserva de Alhabla no tiene notas: guarda el nombre y el teléfono del dueño, el servicio y quién lo
            hace. Por eso el tamaño del perro no se apunta, se elige. Das de alta un servicio por tamaño o tipo de pelo,
            con su duración, y la recepcionista pregunta lo justo para escoger el correcto.
          </p>
        }
        fondo
      >
        <Tabla
          cabecera={["Servicio", "Duración de ejemplo", "Para qué perros"]}
          filas={[
            ["Baño y secado perro pequeño", "1 h", "Hasta unos 10 kg: yorkshire, chihuahua, bichón maltés."],
            ["Baño y secado perro mediano", "1 h 30 min", "De unos 10 a 25 kg."],
            ["Baño y secado perro grande", "2 h", "Más de 25 kg."],
            ["Baño y corte perro pequeño", "1 h 30 min", "Caniche toy, shih tzu, westie."],
            ["Baño y corte perro mediano", "2 h", "Caniche mediano, cocker, schnauzer mediano con tijera."],
            ["Baño y corte perro grande", "2 h 30 min", "Caniche gigante, perros de agua, mestizos grandes de pelo largo."],
            ["Deslanado", "2 h 30 min", "Pelo con subpelo que muda: husky, pastor alemán, golden retriever."],
            ["Stripping", "2 h", "Pelo duro que se arranca a mano: schnauzer o terriers de pelo duro."],
            ["Corte de uñas y limpieza de oídos", "15 min", "Sin baño; encaja entre dos perros."],
          ]}
          nota="Duraciones y pesos orientativos: configúralos con los tuyos. Si tu deslanado de un perro grande lleva una hora más que el de uno mediano, dalos de alta por separado, cada uno con su precio."
        />
        <div className="mt-8">
          <Texto>
            <p>
              Para los casos dudosos, escribe tus reglas en <strong>«Información para responder»</strong>, en el
              panel: «un caniche mediano cuenta como mediano», «si tiene muchos nudos, baño y corte aunque pidan solo
              baño», «gatos no atendemos». Con eso la recepcionista puede preguntar la raza o el peso y elegir. Si el
              dueño duda, se reserva lo que pida y tú lo corriges cuando veas al perro.
            </p>
          </Texto>
        </div>
      </Seccion>

      <Seccion titulo="El nombre del perro, en la transcripción" estrecha>
        <Texto>
          <p>
            La cita va a nombre del dueño, que es quien llama y quien recibe el WhatsApp. El nombre del perro y lo que
            cuente el dueño («le dan miedo los secadores», «la última vez se puso nervioso con las uñas») no van en la
            reserva: quedan en la transcripción de la llamada, que ves en el panel, en Llamadas. Si el dueño acepta que
            se grabe la llamada, también puedes escucharla.
          </p>
          <p>
            Un hábito que funciona: al abrir, repasa las llamadas del día anterior. Antes de que llegue cada perro ya
            sabrás lo que te contaron de él.
          </p>
        </Texto>
        <div className="mt-8">
          <Nota tipo="info" titulo="Los datos del perro y los del dueño">
            Lo que se refiere al perro (raza, tamaño, carácter) no es un dato personal. El nombre y el teléfono del
            dueño sí lo son: Alhabla los usa para la cita y, si el dueño lo acepta, para escribirle por WhatsApp sobre
            ella.
          </Nota>
        </div>
      </Seccion>

      <Seccion
        titulo="Llamadas de cada día y qué hace la recepcionista"
        entradilla={<p>Lo que más se oye al teléfono de una peluquería canina, con lo que resuelve y lo que deja para ti.</p>}
        fondo
      >
        <Tabla
          cabecera={["Lo que dice el dueño", "Qué hace la recepcionista"]}
          filas={[
            [
              "«Quiero bañar a mi perro»",
              "Pregunta tamaño o raza, elige el servicio, mira tu calendario y ofrece la primera hora en la que cabe entero, con quien lo hace.",
            ],
            [
              "«¿Ya está listo Toby?»",
              "No ve tu mesa de trabajo, así que no puede saberlo. Puede tomar el recado, que te llega por WhatsApp, para que llames tú al dueño cuando esté.",
            ],
            [
              "«¿Cuánto cuesta deslanar a un husky?»",
              "Da el precio y la duración que tienes en el catálogo para ese servicio.",
            ],
            [
              "«Tengo dos perros»",
              "Puede poner los dos servicios en la misma cita, uno detrás de otro, con la misma persona y la duración sumada.",
            ],
            [
              "«¿Puedo cambiar la cita del sábado?»",
              "La encuentra cuando la llamada viene del número con el que se pidió; entonces la pasa a otra hora o la anula. Responder al WhatsApp de la cita sirve igual.",
            ],
            [
              "«¿Venís a domicilio?»",
              "Contesta con lo que tengas en «Información para responder». Si no vas a domicilio, escríbelo ahí y lo dirá así.",
            ],
          ]}
        />
      </Seccion>

      <Seccion
        id="llamada"
        titulo="Un caniche mediano, de un martes cualquiera"
        entradilla={<p>El dueño llama para baño y corte. La peluquería tiene sus servicios dados de alta por tamaño.</p>}
      >
        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-start">
          <Conversacion
            etiqueta="Ejemplo de llamada a una peluquería canina"
            turnos={[
              {
                quien: "recepcionista",
                texto: "Peluquería canina Pelusa, te atiende una inteligencia artificial. Dime, ¿qué necesitas?",
              },
              { quien: "cliente", texto: "Hola, quería cita para bañar y cortar a mi perro." },
              { quien: "recepcionista", texto: "Claro. ¿Qué perro es, y más o menos cuánto pesa?" },
              { quien: "cliente", texto: "Es un caniche mediano, unos doce kilos. Se llama Toby." },
              {
                quien: "recepcionista",
                texto:
                  "Entonces es baño y corte de perro mediano, unas dos horas. Mañana tengo a las nueve y media con Álex, o el viernes a las once con Rosa. ¿Qué prefieres?",
              },
              { quien: "cliente", texto: "Mañana a las nueve y media. Ah, y le dan bastante miedo los secadores." },
              {
                quien: "recepcionista",
                texto: "Gracias por contarlo, queda en esta conversación para el equipo. ¿A nombre de quién pongo la cita?",
              },
              { quien: "cliente", texto: "De Marta." },
              {
                quien: "recepcionista",
                texto:
                  "Listo, Marta: mañana a las nueve y media, baño y corte de perro mediano con Álex. ¿Te confirmo la cita por WhatsApp en este número?",
              },
              { quien: "cliente", texto: "Sí, por favor." },
            ]}
          />
          <Texto>
            <p>
              La cita ha quedado como «baño y corte perro mediano», a nombre de Marta, con Álex y dos horas reservadas
              en el calendario. Ni «Toby» ni lo del secador están en ella.
            </p>
            <p>
              Los dos están en la transcripción de la llamada. Si Álex la lee antes de abrir, sabrá que el perro de
              las nueve y media necesita un secado con calma, y quizá prefiera empezar con toalla.
            </p>
          </Texto>
        </div>
      </Seccion>

      <Seccion titulo="Cómo se monta una peluquería canina en Alhabla" fondo estrecha>
        <Texto>
          <p>
            En el alta, elige <strong>«Otros»</strong> como tipo de negocio. La peluquería canina aún no tiene
            plantilla propia, así que el asistente del alta te enseña unos servicios genéricos. Marca los que te pida
            para seguir y luego, desde Agente › Servicios, sustitúyelos por los de la tabla de arriba con tus tiempos y
            tus precios. Lo demás:
          </p>
        </Texto>
        <div className="mt-6">
          <ListaCheck
            items={[
              "Profesionales: una ficha por peluquero. Quien mejor hace stripping, especialista en stripping; quien está empezando, «solo si lo piden» en los cortes con tijera.",
              "Capacidad: cuántos perros trabajáis a la vez, que normalmente son las mesas que tenéis en marcha.",
              "Horario: el de la peluquería. Los cierres de agosto o un festivo se los dices al Gestor por WhatsApp y quedan bloqueados.",
              "Calendario: Google Calendar, Outlook o el Calendario de Apple. Los perros que apuntas a mano ahí cuentan como hora ocupada.",
              "WhatsApp: el dueño recibe la confirmación de su cita; tú, un aviso de cada reserva y los recados.",
            ]}
          />
        </div>
        <div className="mt-6">
          <Texto>
            <p>
              Tu número no cambia: en tu operador desvías las llamadas que no coges al número de Alhabla y lo compruebas
              desde el panel. Tienes los pasos de cada compañía en{" "}
              <Link href="/desvio-de-llamadas">desvío de llamadas</Link>.
            </p>
          </Texto>
        </div>
      </Seccion>

      <Seccion titulo="Recordatorios y lista de espera para la temporada alta" estrecha>
        <Texto>
          <p>
            Un perro grande que no aparece deja la mesa parada dos horas y media. Para que no pase, el dueño recibe
            por WhatsApp la confirmación en cuanto se reserva, en cualquier plan, si ha aceptado los mensajes. Con Pro
            o Scale le llega también un aviso justo un día antes —siempre que pidiera la cita con más antelación— y,
            desde ese mismo mensaje, dice si viene, pide otra hora o la anula.
          </p>
          <p>
            Antes del verano, cuando muchos dueños piden el corte de calor, y antes de las fiestas, la agenda se llena
            con días de antelación. Ahí la lista de espera trabaja por ti: el dueño que se queda sin la hora que quería
            puede pedir que le avisen. Cuando alguien suelta justo esa hora, el aviso le llega por WhatsApp a quien
            lleva más tiempo esperando, que se la queda pulsando un botón.
          </p>
          <p>
            Si prefieres escribir tú algunos de esos mensajes, tienes ejemplos en las{" "}
            <Link href="/herramientas/plantillas-recordatorio-de-cita">plantillas de recordatorio de cita</Link>.
          </p>
        </Texto>
      </Seccion>

      <Fuentes
        consultadas="2026-10-20"
        fuentes={[
          {
            nombre:
              "Ministerio de Derechos Sociales: un estudio del Gobierno estima que en España hay más de 15 millones de animales de compañía (adelanto de la Estadística Nacional sobre Protección Animal)",
            url: "https://www.dsca.gob.es/es/comunicacion/notas-prensa/estudio-gobierno-estima-que-espana-hay-mas-15-millones-animales-compania",
          },
        ]}
      />
    </PaginaGuia>
  );
}
