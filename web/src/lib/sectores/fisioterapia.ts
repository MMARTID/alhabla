import { NICHE_ACCENTS } from "@/lib/niche-accents";
import type { SectorLanding } from "@/lib/sectores/tipos";

/**
 * Andrés llama y reserva primera consulta con Pablo (la escena del iPhone:
 * GUIONES_SECTOR, lib/relato-guiones.ts) y luego la cambia contestando al
 * WhatsApp (sus mensajes). En la escena de tu asistente (GUIONES_GESTOR,
 * lib/gestor-guiones.ts) Pablo falta y su cita pasa a Irene, quien mejor lo
 * hace de los libres. Los móviles empiezan por 79, un rango sin atribuir.
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
  },

  asistente: {
    pregunta: "¿Y si a mediodía falta un fisio?",
    respuesta:
      "Escríbeselo a tu asistente entre paciente y paciente. Marca la ausencia, te enseña qué sesiones tenía y propone pasarlas al fisio libre que mejor lleva cada tratamiento. Avisa a cada paciente cuando confirmas.",
    situaciones: [
      {
        titulo: "Si un fisio está de baja",
        texto:
          "«Pablo está de baja hoy»: deja de recibir pacientes y tu asistente propone pasar su sesión a Irene, la especialista libre. Confirmas y avisa al paciente.",
      },
      {
        titulo: "Una mañana fuera",
        texto:
          "«Irene no está el jueves de 9 a 12, tiene formación»: ese tramo se bloquea y la recepcionista no le da citas.",
      },
      {
        titulo: "Cómo va la semana",
        texto:
          "«¿Cuántas llamadas y citas llevamos?»: te lo resume y, sin salir del chat, cambias lo que dura una sesión.",
      },
    ],
  },

  whatsapp: {
    pregunta: "¿Mis pacientes tienen que bajarse algo?",
    respuesta:
      "No. Dejas de pedirles que usen una app o un canal concreto: llaman como siempre y la cita les llega por WhatsApp. Para cambiarla o anularla, contestan a ese mensaje.",
    confirmacion: {
      servicio: "Primera consulta, con Pablo",
      cuando: "jueves 5 de noviembre a las 17:30",
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
          "Hecho, Andrés: primera consulta el viernes 6 a las 18:00 con Pablo. La del jueves queda anulada.",
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
