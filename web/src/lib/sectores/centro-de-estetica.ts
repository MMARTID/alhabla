import { NICHE_ACCENTS } from "@/lib/niche-accents";
import type { SectorLanding } from "@/lib/sectores/tipos";

/**
 * Cristina llama y reserva facial con peeling con Sara (la escena del
 * iPhone: GUIONES_SECTOR, lib/relato-guiones.ts) y luego la cambia
 * contestando al WhatsApp (sus mensajes). En la escena de tu asistente
 * (GUIONES_GESTOR, lib/gestor-guiones.ts) Sara falta y su cita pasa a Elena,
 * la especialista libre. Los móviles empiezan por 79, un rango sin atribuir.
 */
export const centroDeEstetica: SectorLanding = {
  slug: "centro-de-estetica",
  nombre: "Centros de estética",
  paraQuien: "centros de estética",
  negocio: "Centro de estética Alba",
  clientes: "clientas",
  acento: NICHE_ACCENTS["centro-de-estetica"],
  demo: "centro-de-estetica",

  descripcion:
    "Recepcionista de IA para tu centro de estética: atiende las llamadas que no coges en cabina, explica tus tratamientos y tú lo llevas por WhatsApp.",

  hero: {
    frase:
      "Atiende las llamadas que no coges en cabina, explica tus tratamientos y reserva. Tú lo llevas por WhatsApp o desde el panel.",
  },

  llamada: {
    pregunta: "¿Y si suena mientras estoy en cabina?",
    respuesta:
      "Ya no eliges entre dejar a la clienta en la camilla o perder la llamada. Contesta la recepcionista: explica cada tratamiento con lo que le has escrito, busca hueco con la esteticista que toca y la cita llega por WhatsApp.",
  },

  asistente: {
    pregunta: "¿Y si a mediodía falta una esteticista?",
    respuesta:
      "Se lo escribes a tu asistente entre una clienta y otra. Marca la ausencia, te enseña qué citas tenía y te propone a la compañera libre que mejor hace cada tratamiento. Sin tu «Confirmar», no mueve nada.",
    situaciones: [
      {
        titulo: "Si una esteticista no viene",
        texto:
          "«Sara no puede venir hoy»: deja de recibir citas y tu asistente propone pasar su facial a Elena, la especialista libre. Confirmas y avisa a la clienta.",
      },
      {
        titulo: "Mover una cita",
        texto:
          "«Pasa la presoterapia de Beatriz al viernes»: comprueba que cabe, la mueve en tu agenda y te pregunta si avisa a Beatriz.",
      },
      {
        titulo: "Enseñarle algo a la recepcionista",
        texto:
          "«Los bonos se pagan en el centro, no por teléfono»: lo apunta y la recepcionista lo dice desde la siguiente llamada.",
      },
    ],
  },

  whatsapp: {
    pregunta: "¿Mis clientas tienen que bajarse algo?",
    respuesta:
      "No. Nada que instalar: llaman al centro como siempre y la cita les llega por WhatsApp. Dejas de explicar por dónde se pide hora; si no pueden venir, contestan al mensaje y la recepcionista la mueve.",
    confirmacion: {
      servicio: "Facial con peeling, con Sara",
      cuando: "jueves 5 de noviembre a las 17:30",
    },
    conversacion: [
      {
        de: "cliente",
        texto:
          "Me ha salido una reunión el jueves. ¿Hay algo el lunes por la mañana?",
      },
      {
        de: "recepcionista",
        texto: "El lunes 9 a las 11:00 Sara tiene hueco. ¿Te la cambio?",
      },
      { de: "cliente", texto: "Perfecto" },
      {
        de: "recepcionista",
        texto:
          "Listo, Cristina: facial con peeling el lunes 9 a las 11:00 con Sara. La del jueves queda anulada.",
      },
    ],
  },

  oficio: {
    pregunta: "¿Sabe cómo funciona un centro de estética?",
    respuesta:
      "Sabe lo que le enseñas: cada tratamiento con su duración y quién lo hace. No promete resultados ni contesta sobre salud: eso te llega como recado para que la llaméis.",
    equipo: ["Sara", "Elena", "Noelia"],
    servicios: [
      {
        servicio: "Higiene facial",
        minutos: 60,
        niveles: ["especialista", "lo-hace", "lo-hace"],
      },
      {
        servicio: "Facial con peeling",
        minutos: 75,
        niveles: ["especialista", "lo-hace", "no-sugerir"],
      },
      {
        servicio: "Láser, por zona",
        minutos: 30,
        niveles: ["no-sugerir", "especialista", "no-sugerir"],
      },
      {
        servicio: "Depilación con cera",
        minutos: 30,
        niveles: ["lo-hace", "lo-hace", "lo-hace"],
      },
    ],
    reparto:
      "El láser, con quien maneja el equipo; la cera, con cualquiera. Reparte por persona, no por cabina.",
  },

  faqs: [
    {
      question: "¿Tengo que dejar mi programa de citas?",
      answer:
        "No. Alhabla no se conecta con tu programa: mira el calendario que conectes (Google, Outlook o iCloud), y si tu programa copia ahí las citas, no ofrece esas horas. Si no usas ninguno, reserva en la agenda de Alhabla, que ves en el panel.",
    },
    {
      question: "¿Y si llaman de noche, con el centro cerrado?",
      answer:
        "La atiende igual: la llamada que nadie coge salta a la recepcionista por el desvío de tu operador. Da hora solo dentro de tu horario, y lo que no sepa contestar te llega como recado por WhatsApp.",
    },
    {
      question: "¿Puede reservar a dos amigas a la misma hora?",
      answer:
        "Cada llamada deja una cita, con una esteticista. La segunda la pide en otra llamada, o se la dices tú a tu asistente por WhatsApp y la apunta cuando le das a «Confirmar».",
    },
    {
      question: "¿Graba las llamadas? Hay clientas que cuentan cosas de salud.",
      answer:
        "Solo si la clienta acepta; si no, queda solo la transcripción en el panel. Por eso no pregunta por medicación ni embarazos: lo que alguien cuente queda escrito. Las grabaciones se guardan 30 días y las transcripciones, 90.",
    },
    {
      question: "¿Habla con clientas extranjeras?",
      answer:
        "Sí, en cualquier plan: inglés, francés, alemán y otros cuatro idiomas, y cambia en cuanto la clienta cambia. El catalán se activa solo en Cataluña y Baleares, el euskera en Euskadi y el gallego en Galicia.",
    },
  ],

  cierre:
    "Que la próxima clienta reserve su facial aunque tengas a otra en la camilla.",
};
