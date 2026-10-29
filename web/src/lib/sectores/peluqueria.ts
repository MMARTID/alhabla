import { ausenciaDe } from "@/lib/gestor-guiones";
import { NICHE_ACCENTS } from "@/lib/niche-accents";
import type { SectorLanding } from "@/lib/sectores/tipos";

/**
 * Carmen llama y reserva corte y color con Marta (la llamada), recibe la
 * confirmación y la pasa al viernes contestando al WhatsApp (sus mensajes).
 * La ausencia es otra tarde: Ana se va y sus mechas pasan a Laura. Los
 * nombres son los del relato de la portada (lib/relato-guiones.ts); los
 * móviles empiezan por 79, un rango sin atribuir.
 */
export const peluqueria: SectorLanding = {
  slug: "peluqueria",
  nombre: "Peluquerías",
  paraQuien: "peluquerías",
  negocio: "Peluquería Nuria",
  clientes: "clientas",
  acento: NICHE_ACCENTS.peluqueria,
  demo: "peluqueria",

  descripcion:
    "Recepcionista de IA para tu peluquería: contesta las llamadas que no coges mientras cortas, reserva con la estilista que toca y tú lo llevas por WhatsApp.",

  hero: {
    frase:
      "Atiende las llamadas que no coges mientras cortas y reserva en tu agenda. Tú lo gestionas por WhatsApp o desde el panel.",
  },

  llamada: {
    pregunta: "¿Y si suena mientras estoy con un tinte?",
    respuesta:
      "Ya no eliges entre dejar a la clienta a medias o perder la llamada. Contesta la recepcionista: mira tu agenda, reserva con quien toca y le manda la cita por WhatsApp.",
    quien: "Carmen R.",
    duracion: "1 min 12 s",
    lineas: [
      {
        de: "cliente",
        texto: "Hola, ¿tenéis hueco mañana para corte y color?",
      },
      {
        de: "recepcionista",
        texto:
          "Sí. Corte y color son unos 90 minutos. ¿A qué hora te viene mejor?",
      },
      { de: "cliente", texto: "Por la tarde, si puede ser." },
      {
        accion:
          "Mira tu agenda: a las 17:00 no cabe; a las 17:30, Marta está libre",
        icono: "agenda",
      },
      {
        de: "recepcionista",
        texto: "Mañana a las 17:30 con Marta. ¿A nombre de quién la pongo?",
      },
      { de: "cliente", texto: "Carmen." },
      {
        de: "recepcionista",
        texto:
          "Hecho, Carmen: corte y color mañana a las 17:30 con Marta. Te mando la confirmación por WhatsApp.",
      },
      {
        accion: "Cita en tu agenda: jueves, 17:30, con Marta",
        icono: "reserva",
      },
      { accion: "Confirmación por WhatsApp a Carmen", icono: "whatsapp" },
    ],
  },

  asistente: {
    pregunta: "¿Y si a mediodía falta una estilista?",
    respuesta:
      "Se lo dices a tu asistente por WhatsApp. Marca la ausencia, te dice qué citas tenía y te propone pasarlas a la estilista libre que mejor hace cada servicio. Cada cambio, y cada aviso a la clienta, con tu «Confirmar».",
    turnos: ausenciaDe({
      aviso: "Ana se ha tenido que ir, una urgencia. Hoy ya no vuelve",
      profesional: "Ana",
      cuando: "esta tarde",
      motivo: "urgencia",
      cita: "la cita de Rosa M.",
      servicio: "Mechas",
      hora: "17:00",
      otra: "Laura",
      cliente: "Rosa",
      telefono: "+34 791 48 20 16",
    }),
  },

  whatsapp: {
    pregunta: "¿Mis clientas tienen que bajarse algo?",
    respuesta:
      "No, y dejas de educarlas: llaman como siempre y la cita les llega por WhatsApp. Si no pueden venir, contestan al mensaje y la recepcionista la cambia o la anula.",
    confirmacion: {
      servicio: "Corte y color, con Marta",
      cuando: "jueves 5 de noviembre a las 17:30",
    },
    conversacion: [
      {
        de: "cliente",
        texto: "¿Me la puedes pasar al viernes a la misma hora?",
      },
      {
        de: "recepcionista",
        texto: "Sí, el viernes a las 17:30 Marta está libre. ¿Te la cambio?",
      },
      { de: "cliente", texto: "Sí, porfa" },
      {
        de: "recepcionista",
        texto:
          "Listo, Carmen: corte y color el viernes 6 a las 17:30 con Marta. La del jueves queda anulada.",
      },
    ],
  },

  oficio: {
    pregunta: "¿Sabe cómo funciona una peluquería?",
    respuesta:
      "Sabe lo que le enseñas: cada servicio, su duración y quién lo hace. Corte y color, con el tiempo de ambos; cómo quedará, no lo promete.",
    equipo: ["Marta", "Ana", "Sofía"],
    servicios: [
      {
        servicio: "Corte de señora",
        minutos: 45,
        niveles: ["lo-hace", "especialista", "lo-hace"],
      },
      {
        servicio: "Corte y color",
        minutos: 90,
        niveles: ["especialista", "lo-hace", "no-sugerir"],
      },
      {
        servicio: "Mechas o balayage",
        minutos: 150,
        niveles: ["especialista", "lo-hace", "no-sugerir"],
      },
      {
        servicio: "Peinado",
        minutos: 45,
        niveles: ["especialista", "lo-hace", "lo-hace"],
      },
    ],
    reparto: "Las mechas, con tu colorista; quien empieza, solo si la piden.",
  },

  faqs: [
    {
      question: "¿Tengo que cambiar de agenda?",
      answer:
        "No. Si llevas las citas en Google Calendar, Outlook o iCloud, reserva ahí y respeta lo que ya está ocupado. Si no usas ninguno, reserva en la agenda de Alhabla, que ves en el panel y en el calendario del móvil.",
    },
    {
      question: "¿Mis clientas siguen llamando al número de siempre?",
      answer:
        "Sí. Activas el desvío en tu operador y la llamada que no coges salta a la recepcionista; si la coges tú, no cambia nada. Funciona igual a mediodía, por la noche y en festivos.",
    },
    {
      question: "¿Le dice el precio a la clienta?",
      answer:
        "Si el servicio tiene precio en tu catálogo, sí. Si depende del largo o del producto, déjalo sin precio y escribe cómo lo calculáis: lo explica sin dar una cifra cerrada. Una tarifa nueva se la dices a tu asistente por WhatsApp.",
    },
    {
      question: "¿Y si llaman en catalán o en inglés?",
      answer:
        "Contesta en su idioma: inglés y otros seis en cualquier plan, y cambia si la clienta cambia. El catalán se activa solo si el salón está en Cataluña o Baleares; igual el euskera en Euskadi y el gallego en Galicia.",
    },
    {
      question: "¿Graba las llamadas de mis clientas?",
      answer:
        "Solo si la clienta acepta: se lo pregunta durante la llamada y, a quien ya aceptó, se lo recuerda al descolgar. Si dice que no, queda solo la transcripción, que lees en el panel.",
    },
  ],

  cierre: "Que la próxima clienta reserve aunque tengas las manos en un tinte.",
};
