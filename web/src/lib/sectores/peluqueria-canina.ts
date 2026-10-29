import { NICHE_ACCENTS } from "@/lib/niche-accents";
import type { SectorLanding } from "@/lib/sectores/tipos";

/**
 * Lucía llama y reserva baño perro mediano con Álex (la escena del iPhone:
 * GUIONES_SECTOR, lib/relato-guiones.ts) y luego la cambia contestando al
 * WhatsApp (sus mensajes). En la escena de tu asistente (GUIONES_GESTOR,
 * lib/gestor-guiones.ts) Álex falta y su cita pasa a Iván, quien mejor lo
 * hace de los libres. Los móviles empiezan por 79, un rango sin atribuir.
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
  },

  asistente: {
    pregunta: "¿Y si a mediodía falta un peluquero?",
    respuesta:
      "Se lo dices a tu asistente por WhatsApp. Marca la ausencia, te dice qué perros tenía citados y te propone al compañero libre que mejor hace cada servicio. Nada cambia hasta que pulsas «Confirmar».",
    situaciones: [
      {
        titulo: "Si un peluquero no viene",
        texto:
          "«Álex no viene hoy, se ha torcido un tobillo»: deja de recibir citas y tu asistente propone pasar sus baños a Iván, el especialista libre.",
      },
      {
        titulo: "Las vacunas, al día",
        texto:
          "«Dile que sin vacunas no los atendemos»: lo apunta y la recepcionista pide la cartilla desde la siguiente llamada.",
      },
      {
        titulo: "Una tarifa nueva",
        texto:
          "«El baño de perro pequeño sube a 28 €»: cambia en tu catálogo y la recepcionista lo dice así.",
      },
    ],
  },

  whatsapp: {
    pregunta: "¿Mis clientes tienen que bajarse algo?",
    respuesta:
      "No, y se acabó convencerlos de usar una app: llaman como siempre y la cita les llega al WhatsApp que ya usan. Si al perro le surge algo, contestan al mensaje y la recepcionista la mueve o la anula.",
    confirmacion: {
      servicio: "Baño perro mediano, con Álex",
      cuando: "jueves 5 de noviembre a las 17:30",
    },
    conversacion: [
      {
        de: "cliente",
        texto:
          "A Toby le toca vacuna el jueves por la tarde. ¿Lo pasamos al viernes por la tarde?",
      },
      {
        de: "recepcionista",
        texto: "El viernes a las 16:30 Álex está libre. ¿Te la cambio?",
      },
      { de: "cliente", texto: "Sí, genial" },
      {
        de: "recepcionista",
        texto:
          "Listo, Lucía: baño el viernes 6 a las 16:30 con Álex. La del jueves queda anulada.",
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
