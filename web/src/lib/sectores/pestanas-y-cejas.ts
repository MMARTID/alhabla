import { NICHE_ACCENTS } from "@/lib/niche-accents";
import type { SectorLanding } from "@/lib/sectores/tipos";

/**
 * Irene llama y reserva relleno de pestañas con Nerea (la escena del iPhone:
 * GUIONES_SECTOR, lib/relato-guiones.ts) y luego la cambia contestando al
 * WhatsApp (sus mensajes). En la escena de tu asistente (GUIONES_GESTOR,
 * lib/gestor-guiones.ts) Nerea falta y su cita pasa a Alba, la especialista
 * libre. Los móviles empiezan por 79, un rango sin atribuir.
 *
 * En el alta, los estudios de pestañas entran como negocio «Otros»
 * (backend/src/lib/businessType.ts) con servicios genéricos: aquí no se
 * promete plantilla de servicios propia. El recordatorio de 24 h solo va en
 * Pro y Scale (lib/planFeatures.ts). Los móviles empiezan por 79, un rango
 * sin atribuir.
 */
export const pestanasYCejas: SectorLanding = {
  slug: "pestanas-y-cejas",
  nombre: "Pestañas y cejas",
  paraQuien: "estudios de pestañas y cejas",
  negocio: "Estudio Lía",
  clientes: "clientas",
  acento: NICHE_ACCENTS["pestanas-y-cejas"],

  descripcion:
    "Recepcionista de IA para tu estudio de pestañas: contesta las llamadas que no coges con las pinzas en la mano y tú lo gestionas por WhatsApp.",

  hero: {
    frase:
      "Contesta las llamadas que no coges mientras pones un juego y reserva con la técnica que toca. Tú lo gestionas por WhatsApp o el panel.",
  },

  llamada: {
    pregunta: "¿Y si suena mientras pongo un juego de volumen?",
    respuesta:
      "Ya no eliges entre soltar las pinzas o perder la llamada. Contesta la recepcionista, aplica tu regla de rellenos, reserva con quien toca y le manda la cita por WhatsApp.",
  },

  asistente: {
    pregunta: "¿Y si a mediodía falta una técnica?",
    respuesta:
      "Se lo escribes a tu asistente entre clienta y clienta. Marca la ausencia, te dice qué citas tenía y te propone a la técnica libre que mejor hace cada servicio. Nada cambia sin tu «Confirmar».",
    situaciones: [
      {
        titulo: "Si una técnica no viene",
        texto:
          "«Nerea no viene hoy, tiene fiebre»: deja de recibir citas y tu asistente propone pasar su lifting a Alba, la especialista libre.",
      },
      {
        titulo: "Una regla del estudio",
        texto:
          "«Dile que el relleno solo vale con pestañas nuestras»: lo apunta y la recepcionista lo explica en la siguiente llamada.",
      },
      {
        titulo: "Un precio nuevo",
        texto:
          "«El lifting sube a 45 €»: cambia en tu catálogo y la recepcionista ya lo dice así.",
      },
    ],
  },

  whatsapp: {
    pregunta: "¿Mis clientas tienen que bajarse algo?",
    respuesta:
      "No. Dejas de pedirles que reserven por una app o por Instagram: llaman como siempre y la cita les llega por WhatsApp. Si no pueden venir, contestan al mensaje y la recepcionista la mueve o la anula.",
    confirmacion: {
      servicio: "Relleno de pestañas, con Nerea",
      cuando: "jueves 5 de noviembre a las 17:30",
    },
    conversacion: [
      {
        de: "cliente",
        texto: "Me ha surgido algo el jueves. ¿Tenéis el viernes por la tarde?",
      },
      {
        de: "recepcionista",
        texto:
          "El viernes a las 16:00 Nerea tiene la hora libre. ¿Te la cambio?",
      },
      { de: "cliente", texto: "Sí, genial" },
      {
        de: "recepcionista",
        texto:
          "Listo, Irene: relleno el viernes 6 a las 16:00 con Nerea, y anulada la del jueves.",
      },
    ],
  },

  oficio: {
    pregunta: "¿Sabe cómo funciona un estudio de pestañas?",
    respuesta:
      "Sabe lo que le enseñas: cada servicio con su tiempo y qué técnica lo hace. Laminado y tinte van en una cita con los tiempos sumados, y no elige por la clienta.",
    equipo: ["Nerea", "Alba", "Carla"],
    servicios: [
      {
        servicio: "Juego de volumen",
        minutos: 150,
        niveles: ["especialista", "lo-hace", "no-sugerir"],
      },
      {
        servicio: "Relleno",
        minutos: 60,
        niveles: ["lo-hace", "lo-hace", "lo-hace"],
      },
      {
        servicio: "Lifting de pestañas",
        minutos: 60,
        niveles: ["lo-hace", "especialista", "lo-hace"],
      },
      {
        servicio: "Retirada",
        minutos: 30,
        niveles: ["lo-hace", "lo-hace", "lo-hace"],
      },
    ],
    reparto:
      "El volumen, con tu especialista; a quien está en formación, solo si la piden por su nombre.",
  },

  faqs: [
    {
      question:
        "Muchas citas me llegan por Instagram. ¿Se pisan con las del teléfono?",
      answer:
        "No, si las apuntas en tu agenda: Google Calendar, Outlook, iCloud o la de Alhabla, en el panel. La recepcionista la mira antes de dar hora y no ofrece lo ocupado. Con Instagram no se conecta.",
    },
    {
      question: "¿Guarda la ficha de cada clienta, con la curva y el grosor?",
      answer:
        "No. La cita guarda nombre, teléfono, servicio y técnica, sin notas. Lo que la clienta cuente por teléfono queda en la transcripción de la llamada, en el panel. La ficha técnica sigue donde la tengas ahora.",
    },
    {
      question: "Trabajo sola en una cabina. ¿Me sirve?",
      answer:
        "Sí, y es donde más se nota: mientras pones un juego no hay nadie más para coger el teléfono. Das de alta una sola técnica, tú, y la recepcionista solo ofrece las horas en las que estás libre.",
    },
    {
      question: "¿Le recuerda la cita el día antes?",
      answer:
        "En Pro y Scale, sí: si reservó con más de un día de margen, le llega un WhatsApp 24 horas antes y puede confirmar, cambiar o anular contestando.",
    },
    {
      question: "¿Y si llama una turista?",
      answer:
        "Le contesta en su idioma y cambia si ella cambia: inglés, francés, alemán, italiano, portugués, neerlandés o ruso, en cualquier plan. Si el estudio está en Cataluña o Baleares, también en catalán; en Euskadi, en euskera, y en Galicia, en gallego.",
    },
  ],

  cierre:
    "Que el próximo relleno quede reservado aunque tengas las dos pinzas ocupadas.",
};
