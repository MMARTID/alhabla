import { ausenciaDe } from "@/lib/gestor-guiones";
import { NICHE_ACCENTS } from "@/lib/niche-accents";
import type { SectorLanding } from "@/lib/sectores/tipos";

/**
 * Andrés llama por primera vez, cuenta que le molesta el hombro y la
 * recepcionista no le pregunta más: le reserva una primera visita con Pablo
 * (la llamada), y luego la pasa al viernes contestando al WhatsApp (sus
 * mensajes). La ausencia es otra tarde: Clara se va y su seguimiento pasa a
 * Irene. Los nombres son los del relato y la simulación de la portada
 * (lib/relato-guiones.ts, lib/gestor-guiones.ts); los móviles empiezan por
 * 79, un rango sin atribuir.
 *
 * Lo de salud es lo que hace el backend: el prompt de fisioterapia no pide
 * historial ni diagnostica y manda las urgencias a emergencias
 * (backend/src/lib/seccionesDelPrompt.ts), el saludo dice «lo de la última
 * vez» en vez del servicio (lib/contextoDeLlamada.ts) y la reserva no tiene
 * campo de notas.
 */
export const fisioterapia: SectorLanding = {
  slug: "fisioterapia",
  nombre: "Clínicas de fisioterapia",
  paraQuien: "clínicas de fisioterapia",
  negocio: "Fisioterapia Rivas",
  clientes: "pacientes",
  acento: NICHE_ACCENTS.fisioterapia,
  demo: "fisioterapia",

  descripcion:
    "Recepcionista de IA para tu clínica de fisioterapia: contesta mientras tratas, da hora al paciente con su fisio y tú lo llevas por WhatsApp.",

  hero: {
    frase:
      "Mientras tratas, contesta las llamadas que no coges y da hora al paciente con su fisio. Tú lo llevas por WhatsApp o desde el panel.",
  },

  llamada: {
    pregunta: "¿Y si suena mientras tengo a un paciente en la camilla?",
    respuesta:
      "Ya no eliges entre dejar al paciente a medias o perder la llamada. Responde la recepcionista, busca hueco con su fisio y le manda la cita por WhatsApp antes de que acabes la sesión.",
    quien: "Andrés L.",
    duracion: "1 min 04 s",
    lineas: [
      {
        de: "cliente",
        texto:
          "Hola, quería cita. Es la primera vez; me molesta el hombro desde hace semanas.",
      },
      {
        de: "recepcionista",
        texto:
          "Te busco una primera visita, que es de una hora. ¿Por la mañana o por la tarde?",
      },
      { de: "cliente", texto: "Temprano, antes de entrar a trabajar." },
      {
        accion:
          "Mira tu agenda: el jueves a las 8:30, Pablo tiene la hora libre",
        icono: "agenda",
      },
      {
        de: "recepcionista",
        texto: "El jueves a las 8:30 con Pablo. ¿Me dices tu nombre?",
      },
      { de: "cliente", texto: "Andrés Lozano." },
      {
        de: "recepcionista",
        texto: "Listo, Andrés. Ahora te llega la confirmación por WhatsApp.",
      },
      {
        accion: "Cita en tu agenda: jueves, 8:30, primera visita con Pablo",
        icono: "reserva",
      },
      { accion: "Confirmación por WhatsApp a Andrés", icono: "whatsapp" },
    ],
  },

  asistente: {
    pregunta: "¿Y si a mediodía falta un fisio?",
    respuesta:
      "Escríbeselo a tu asistente entre paciente y paciente. Marca la ausencia, te enseña qué sesiones tenía, las pasa al fisio que tú digas y avisa a cada paciente. Todo, con tu «Confirmar».",
    turnos: ausenciaDe({
      aviso: "Clara se ha puesto mala y se va a casa",
      profesional: "Clara",
      cuando: "esta tarde",
      motivo: "enferma",
      respuesta: "El seguimiento de las 5, que lo lleve Irene",
      cita: "la cita de Jorge A.",
      servicio: "Sesión de seguimiento",
      hora: "17:00",
      otra: "Irene",
      cliente: "Jorge",
      telefono: "+34 793 27 51 08",
    }),
  },

  whatsapp: {
    pregunta: "¿Mis pacientes tienen que bajarse algo?",
    respuesta:
      "No. Dejas de pedirles que usen una app o un canal concreto: llaman como siempre y la cita les llega por WhatsApp. Para cambiarla o anularla, contestan a ese mensaje.",
    confirmacion: {
      servicio: "Primera visita, con Pablo",
      cuando: "jueves 5 de noviembre a las 8:30",
    },
    conversacion: [
      {
        de: "cliente",
        texto: "El jueves no puedo. ¿Hay algo el viernes por la tarde?",
      },
      {
        de: "recepcionista",
        texto:
          "El viernes a las 18:00 Pablo tiene la hora libre. ¿Te la cambio?",
      },
      { de: "cliente", texto: "Perfecto" },
      {
        de: "recepcionista",
        texto:
          "Hecho, Andrés: primera visita el viernes 6 a las 18:00 con Pablo. La del jueves queda anulada.",
      },
    ],
  },

  oficio: {
    pregunta: "¿Sabe cómo funciona una clínica de fisioterapia?",
    respuesta:
      "Sabe lo que le enseñas: cada sesión con su duración y qué fisio la hace. No da pautas, y si le preguntan por un seguro que no has escrito, te deja el recado.",
    equipo: ["Pablo", "Irene", "Marcos"],
    servicios: [
      {
        servicio: "Primera visita",
        minutos: 60,
        niveles: ["especialista", "lo-hace", "no-sugerir"],
      },
      {
        servicio: "Sesión de seguimiento",
        minutos: 45,
        niveles: ["lo-hace", "lo-hace", "lo-hace"],
      },
      {
        servicio: "Punción seca",
        minutos: 30,
        niveles: ["especialista", "no-sugerir", "no-sugerir"],
      },
      {
        servicio: "Suelo pélvico",
        minutos: 45,
        niveles: ["no-sugerir", "especialista", "no-sugerir"],
      },
    ],
    reparto:
      "La punción seca o el suelo pélvico, con quien tiene esa formación; el fisio recién llegado, solo si lo piden.",
    salud: {
      texto:
        "Una cita de fisioterapia ya es un dato de salud. Por eso la recepcionista no pide síntomas, el saludo no nombra el tratamiento (puede coger el teléfono otra persona de la casa) y la cita no guarda notas clínicas.",
      enlace: {
        href: "/guias/ley-y-recepcionista-de-ia",
        texto: "La ley y la recepcionista de IA",
      },
    },
  },

  faqs: [
    {
      question: "¿Qué datos de mis pacientes se quedan en Alhabla?",
      answer:
        "Los de la cita: nombre, teléfono, tipo de sesión y fisio. Lo que el paciente cuente de más queda en la transcripción, que lees en el panel.",
    },
    {
      question: "¿Puedo seguir con mi programa de gestión clínica?",
      answer:
        "Sí, aunque Alhabla no se conecta con él: mira tu Google Calendar, Outlook o iCloud. Si tu programa vuelca ahí sus citas, la recepcionista no ofrece esas horas.",
    },
    {
      question: "¿Puede reservar todas las sesiones de un tratamiento?",
      answer:
        "Una cita por llamada. Las siguientes las pide el paciente en otra llamada o se las apuntas tú con tu asistente, una a una: «apunta a Andrés el jueves a las 8:30, seguimiento».",
    },
    {
      question: "¿Sabe cuántas sesiones le quedan del bono?",
      answer:
        "No ve bonos: reserva cada sesión como una cita más y, si el paciente pregunta por su bono, te deja el recado para que se lo digas tú.",
    },
    {
      question: "¿Graba a mis pacientes?",
      answer:
        "Solo si el paciente da permiso durante la llamada. Si dice que no, te queda solo la transcripción.",
    },
  ],

  cierre:
    "Que la próxima primera visita se reserve mientras tú sigues tratando.",
};
