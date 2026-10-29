import { ausenciaDe } from "@/lib/gestor-guiones";
import { NICHE_ACCENTS } from "@/lib/niche-accents";
import type { SectorLanding } from "@/lib/sectores/tipos";

/**
 * Lucía llama para bañar y cortar a Toby, un caniche mediano: la
 * recepcionista pregunta el peso, reserva «baño y corte perro mediano» con
 * Álex y le manda la cita por WhatsApp (la llamada, la de la antigua página
 * de guía); luego la pasa al viernes contestando al mensaje. La ausencia es
 * otra tarde: Rosa se va y el deslanado de las cuatro pasa a Álex.
 *
 * Verdad del sector: en el alta es «Otros», sin servicios propios de
 * peluquería canina; el dueño da de alta un servicio por tamaño. La reserva
 * no lleva notas (Booking: dueño, teléfono, servicios y profesional): el
 * nombre del perro y lo que cuente el dueño quedan en la transcripción. Una
 * llamada, una cita, que puede llevar varios servicios seguidos. Los móviles
 * empiezan por 79, un rango sin atribuir.
 */
export const peluqueriaCanina: SectorLanding = {
  slug: "peluqueria-canina",
  nombre: "Peluquerías caninas",
  paraQuien: "peluquerías caninas",
  negocio: "Peluquería canina Trufa",
  clientes: "clientes",
  acento: NICHE_ACCENTS["peluqueria-canina"],

  descripcion:
    "Recepcionista de IA para peluquerías caninas: con el perro en la mesa, contesta, reserva el servicio de su tamaño y tú lo llevas por WhatsApp.",

  hero: {
    frase:
      "Con el perro en la mesa, atiende las llamadas que no coges, pregunta el tamaño y reserva. Tú lo gestionas por WhatsApp o el panel.",
  },

  llamada: {
    pregunta: "¿Y si suena mientras estoy secando a un perro?",
    respuesta:
      "Ya no eliges entre dejar al perro solo en la mesa o perder la llamada. Contesta la recepcionista: pregunta qué perro es, reserva el servicio de su tamaño y le manda la cita por WhatsApp.",
    quien: "Lucía P.",
    duracion: "1 min 05 s",
    lineas: [
      {
        de: "cliente",
        texto: "Hola, quería cita para bañar y cortar a mi perro.",
      },
      {
        de: "recepcionista",
        texto: "Claro. ¿Qué perro es y cuánto pesa, más o menos?",
      },
      {
        de: "cliente",
        texto: "Un caniche mediano, unos doce kilos. Se llama Toby.",
      },
      {
        accion:
          "Mira tu agenda: baño y corte perro mediano son 2 h; mañana a las 9:30 cabe con Álex",
        icono: "agenda",
      },
      {
        de: "recepcionista",
        texto:
          "Entonces es baño y corte de perro mediano, unas dos horas. Mañana a las 9:30 con Álex, ¿te va bien?",
      },
      {
        de: "cliente",
        texto: "Perfecto. Le dan miedo los secadores, por cierto. Soy Lucía.",
      },
      {
        de: "recepcionista",
        texto:
          "Queda dicho en la llamada para el equipo. Hecho, Lucía: mañana a las 9:30 con Álex; te llega la confirmación por WhatsApp.",
      },
      {
        accion: "Cita en tu agenda: jueves, 9:30, baño y corte perro mediano",
        icono: "reserva",
      },
      { accion: "Confirmación por WhatsApp a Lucía", icono: "whatsapp" },
    ],
  },

  asistente: {
    pregunta: "¿Y si a mediodía falta una peluquera?",
    respuesta:
      "Se lo dices a tu asistente por WhatsApp. Marca la ausencia, te dice qué perros tenía citados y te propone a la compañera libre que mejor hace cada servicio. Nada cambia hasta que pulsas «Confirmar».",
    turnos: ausenciaDe({
      aviso:
        "Rosa se ha tenido que ir al veterinario con su perra. Esta tarde no vuelve",
      profesional: "Rosa",
      cuando: "esta tarde",
      cita: "la cita de Diego F.",
      servicio: "Deslanado perro grande",
      hora: "16:00",
      otra: "Álex",
      cliente: "Diego",
      telefono: "+34 798 21 57 09",
    }),
  },

  whatsapp: {
    pregunta: "¿Mis clientes tienen que bajarse algo?",
    respuesta:
      "No, y se acabó convencerlos de usar una app: llaman como siempre y la cita les llega al WhatsApp que ya usan. Si al perro le surge algo, contestan al mensaje y la recepcionista la mueve o la anula.",
    confirmacion: {
      servicio: "Baño y corte perro mediano, con Álex",
      cuando: "jueves 5 de noviembre a las 9:30",
    },
    conversacion: [
      {
        de: "cliente",
        texto:
          "A Toby le toca vacuna el jueves por la mañana. ¿Lo pasamos al viernes por la tarde?",
      },
      {
        de: "recepcionista",
        texto: "El viernes a las 16:30 Álex está libre. ¿Te la cambio?",
      },
      { de: "cliente", texto: "Sí, genial" },
      {
        de: "recepcionista",
        texto:
          "Listo, Lucía: baño y corte el viernes 6 a las 16:30 con Álex. La del jueves queda anulada.",
      },
    ],
  },

  oficio: {
    pregunta: "¿Sabe cómo funciona una peluquería canina?",
    respuesta:
      "Sabe lo que le enseñas: un servicio por tamaño, su duración y quién lo hace. Por eso pregunta el peso.",
    equipo: ["Álex", "Rosa", "Iván"],
    servicios: [
      {
        servicio: "Baño perro pequeño",
        minutos: 60,
        niveles: ["lo-hace", "lo-hace", "especialista"],
      },
      {
        servicio: "Baño y corte perro mediano",
        minutos: 120,
        niveles: ["especialista", "lo-hace", "no-sugerir"],
      },
      {
        servicio: "Deslanado perro grande",
        minutos: 150,
        niveles: ["lo-hace", "especialista", "no-sugerir"],
      },
      {
        servicio: "Stripping",
        minutos: 90,
        niveles: ["lo-hace", "especialista", "no-sugerir"],
      },
    ],
    reparto:
      "El stripping, con quien lo domina; quien empieza, solo si lo piden.",
  },

  faqs: [
    {
      question: "¿Cómo sabe qué servicio reservar si no ve al perro?",
      answer:
        "Preguntando. Das de alta un servicio por tamaño o tipo de pelo, con su duración y su precio, y ella pregunta la raza o el peso para elegir. Los casos dudosos («con muchos nudos, baño y corte») los dejas escritos en «Información para responder».",
    },
    {
      question: "¿Apunta el nombre del perro en la cita?",
      answer:
        "La cita va a nombre del dueño, con su teléfono, el servicio y quién lo hace; no lleva notas. El nombre del perro y lo que cuente («le dan miedo los secadores») quedan en la transcripción de la llamada, que lees en el panel antes de que llegue.",
    },
    {
      question: "Un dueño quiere hablar conmigo. ¿Me pasa la llamada?",
      answer:
        "Con el desvío solo le llegan las que no coges, y si piden hablar contigo te deja el recado por WhatsApp. Si das a tus clientes el número de Alhabla, eliges cuándo te las pasa: nunca, si lo piden o siempre.",
    },
    {
      question: "¿Y si un perro necesita más tiempo del previsto?",
      answer:
        "La cita dura lo que dura su servicio. Si al verlo sabes que va para largo, escribe a tu asistente «pasa al perro de las doce a las doce y media»: te lo propone y no lo cambia hasta que confirmas. Después te pregunta si avisa al dueño.",
    },
    {
      question: "Trabajo sola con una mesa. ¿Me sirve?",
      answer:
        "Sí, y es donde más se nota, porque no hay nadie más que descuelgue. Con una sola persona en el equipo nunca te da dos perros a la misma hora: solo ofrece lo que está libre en tu agenda, sea Google, Outlook, iCloud o la de Alhabla.",
    },
  ],

  cierre: "El perro, en la mesa; el teléfono, atendido.",
};
