import { ausenciaDe } from "@/lib/gestor-guiones";
import { NICHE_ACCENTS } from "@/lib/niche-accents";
import type { SectorLanding } from "@/lib/sectores/tipos";

/**
 * Paula llama con gel de otro salón: la recepcionista entiende que es
 * retirada y semi, reserva los 75 minutos con Laura (la llamada) y Paula la
 * pasa al sábado con Noa contestando al WhatsApp (sus mensajes). La ausencia
 * es otra tarde: Laura se va enferma y el gel de Irene pasa a Julia. Las
 * técnicas son las de lib/relato-guiones.ts y lib/gestor-guiones.ts; los
 * móviles empiezan por 79, un rango sin atribuir.
 *
 * Contrastado con el backend: el prompt del sector pregunta si es aplicación
 * nueva, mantenimiento o retirada (seccionesDelPrompt.ts) y conoce el último
 * servicio de quien ya reservó con ese móvil; el recordatorio es de Pro y
 * Scale (planFeatures.ts). Una cita por llamada y sin notas en la cita.
 */
export const salonDeUnas: SectorLanding = {
  slug: "salon-de-unas",
  nombre: "Salones de uñas",
  paraQuien: "salones de uñas",
  negocio: "Estudio de uñas Vega",
  clientes: "clientas",
  acento: NICHE_ACCENTS["salon-de-unas"],
  demo: "salon-de-unas",

  descripcion:
    "Recepcionista de IA para tu salón de uñas: coge el teléfono mientras limas, pregunta si hay retirada, reserva con su tiempo y tú lo llevas por WhatsApp.",

  hero: {
    frase:
      "Coge el teléfono mientras limas y reserva cada técnica con su tiempo. Tú lo llevas por WhatsApp o desde el panel.",
  },

  llamada: {
    pregunta: "¿Y si suena mientras estoy esmaltando?",
    respuesta:
      "Ya no eliges entre dejar una mano a medio esmaltar o perder la llamada. Contesta la recepcionista, pregunta si hay retirada, guarda el tiempo justo y le manda la cita por WhatsApp.",
    quien: "Paula D.",
    duracion: "1 min 4 s",
    lineas: [
      {
        de: "cliente",
        texto:
          "Hola, quería semipermanente el jueves. Ahora llevo gel de otro sitio.",
      },
      {
        de: "recepcionista",
        texto:
          "Entonces es retirada y semi, unos 75 minutos. ¿Te viene mejor por la mañana o por la tarde?",
      },
      { de: "cliente", texto: "Por la tarde, al salir de trabajar." },
      {
        accion:
          "Mira tu agenda: el jueves a las 17:30 caben los 75 min con Laura",
        icono: "agenda",
      },
      {
        de: "recepcionista",
        texto: "El jueves a las 17:30 con Laura. ¿Me dices tu nombre?",
      },
      { de: "cliente", texto: "Paula." },
      {
        de: "recepcionista",
        texto:
          "Apuntada, Paula: retirada y semi el jueves a las 17:30 con Laura. Ahora te llega por WhatsApp.",
      },
      {
        accion: "Cita en tu agenda: jueves, 17:30, con Laura",
        icono: "reserva",
      },
      { accion: "Confirmación por WhatsApp a Paula", icono: "whatsapp" },
    ],
  },

  asistente: {
    pregunta: "¿Y si a mediodía falta una técnica?",
    respuesta:
      "Escríbeselo a tu asistente en la pausa. Marca su ausencia, te enseña qué citas tenía, las mueve a la técnica que tú elijas y avisa a cada clienta. Nada cambia sin tu «Confirmar».",
    turnos: ausenciaDe({
      aviso: "Laura se va a casa, no se encuentra bien. Esta tarde no vuelve",
      profesional: "Laura",
      cuando: "esta tarde",
      motivo: "enferma",
      respuesta: "El gel de las cuatro y media, que se lo haga Julia",
      cita: "la cita de Irene C.",
      servicio: "Uñas de gel",
      hora: "16:30",
      otra: "Julia",
      cliente: "Irene",
      telefono: "+34 793 18 47 52",
    }),
  },

  whatsapp: {
    pregunta: "¿Mis clientas tienen que bajarse algo?",
    respuesta:
      "No, y dejas de insistirles para que usen una app de reservas: llaman como siempre y la cita les llega por WhatsApp. Si les surge algo, contestan al mensaje y la recepcionista la mueve o la anula.",
    confirmacion: {
      servicio: "Retirada y semi, con Laura",
      cuando: "jueves 5 de noviembre a las 17:30",
    },
    conversacion: [
      {
        de: "cliente",
        texto: "Me viene mejor el sábado por la mañana, ¿hay algo?",
      },
      {
        de: "recepcionista",
        texto:
          "El sábado a las 10:00 Noa tiene libres los 75 minutos. ¿Te la paso con ella?",
      },
      { de: "cliente", texto: "Vale, con Noa" },
      {
        de: "recepcionista",
        texto:
          "Listo, Paula: retirada y semi el sábado 7 de noviembre a las 10:00 con Noa. La del jueves queda anulada.",
      },
    ],
  },

  oficio: {
    pregunta: "¿Sabe cómo funciona un salón de uñas?",
    respuesta:
      "Sabe lo que le enseñas: cada servicio con su tiempo y qué técnica lo hace. Manicura y pedicura van en una cita seguida, y el diseño de la foto lo lees en la transcripción.",
    equipo: ["Laura", "Noa", "Julia"],
    servicios: [
      {
        servicio: "Semipermanente",
        minutos: 45,
        niveles: ["lo-hace", "lo-hace", "lo-hace"],
      },
      {
        servicio: "Retirada y semi",
        minutos: 75,
        niveles: ["especialista", "lo-hace", "lo-hace"],
      },
      {
        servicio: "Uñas de gel",
        minutos: 90,
        niveles: ["lo-hace", "especialista", "lo-hace"],
      },
      {
        servicio: "Acrílico esculpido",
        minutos: 120,
        niveles: ["lo-hace", "especialista", "no-sugerir"],
      },
    ],
    reparto:
      "El acrílico esculpido va a quien mejor lo trabaja, aunque la clienta no sepa su nombre; a la que está aprendiendo, solo si la piden a ella.",
  },

  faqs: [
    {
      question: "Cierro muchas citas por Instagram, ¿pasa algo?",
      answer:
        "Puedes seguir igual. La recepcionista no lee tus mensajes, pero sí tu agenda: Google Calendar, Outlook, iCloud o, si no usas ninguno, la de Alhabla. Apunta ahí lo que cierras por Instagram, o pídeselo a tu asistente por WhatsApp, y esa hora ya no se ofrece por teléfono.",
    },
    {
      question: "¿Da el precio si hay retirada o decoración?",
      answer:
        "Da el de cada servicio de tu catálogo. Si un extra lo cambia (la retirada, el largo, el nail art por uña), escríbelo en la información del negocio y lo explica antes de reservar. Si subes una tarifa, se lo dices a tu asistente y desde la siguiente llamada da la nueva.",
    },
    {
      question: "¿Y si una clienta no viene?",
      answer:
        "Alhabla no cobra señales ni penaliza a nadie. En Pro y Scale le llega un recordatorio por WhatsApp antes de la cita y, si no puede, la cambia o la anula contestando, así el hueco vuelve a tu agenda. Si escribes tu política de cancelación, la explica por teléfono.",
    },
    {
      question: "¿Puede reservar manos y pies a la vez con dos técnicas?",
      answer:
        "Cada llamada deja una cita, y cada cita va con una sola técnica. Si en tu salón manos y pies se hacen a la vez entre dos, reserva una de las dos y la otra la apuntas tú desde el panel o se la pides a tu asistente por WhatsApp.",
    },
    {
      question: "¿Atiende en catalán?",
      answer:
        "Sí, si el salón está en Cataluña o Baleares, desde la primera llamada; el euskera, en Euskadi, y el gallego, en Galicia. En la Comunidad Valenciana y Navarra, no. En cualquier plan habla además siete idiomas, como inglés o francés, y pasa al de la clienta en cuanto lo oye.",
    },
  ],

  cierre:
    "Que el relleno de la semana que viene quede reservado sin soltar la lima.",
};
