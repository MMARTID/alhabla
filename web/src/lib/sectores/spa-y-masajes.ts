import { ausenciaDe } from "@/lib/gestor-guiones";
import { NICHE_ACCENTS } from "@/lib/niche-accents";
import type { SectorLanding } from "@/lib/sectores/tipos";

/**
 * Sonia llama con un bono regalo para el ritual de chocolate del sábado: la
 * hora que quería está cogida y entra a las siete con Lucía (la llamada, de
 * la página-artículo anterior); luego lo pasa al domingo contestando al
 * WhatsApp. La ausencia es otra tarde: Irene se va y su masaje de piedras
 * de las seis pasa a Lucía.
 *
 * Solo masajes de relajación y rituales, nada terapéutico. En el backend un
 * spa se da de alta como «Otros» (sin plantilla de servicios propia), así
 * que aquí no se promete ninguna. Límites que se dicen sin rodeos: cada
 * llamada termina en una cita y cada cita es de una persona
 * (voiceTools/service.ts, `numberPeople: 1`), sin notas en la cita; la
 * capacidad es una para todo el negocio (`Business.bookingCapacity`, que en
 * un spa son las cabinas), así que un circuito por turnos con aforo no se
 * lleva aparte; no ve bonos ni cobra; el recado llega por WhatsApp
 * (modules/whatsapp/recados.ts). Los móviles empiezan por 79, un rango sin
 * atribuir. Fechas del calendario de 2026: el sábado es el 31 de octubre.
 */
export const spaYMasajes: SectorLanding = {
  slug: "spa-y-masajes",
  nombre: "Spas y masajes",
  paraQuien: "spas y centros de masaje",
  negocio: "Spa Alameda",
  clientes: "clientes",
  acento: NICHE_ACCENTS["spa-y-masajes"],

  descripcion:
    "Recepcionista de IA para tu spa: atiende las llamadas mientras estás en cabina, reserva masajes y rituales, y tú lo llevas por WhatsApp o el panel.",

  hero: {
    frase:
      "Mientras estás en cabina, atiende las llamadas, informa de masajes y rituales y reserva con quien toca. Tú lo llevas por WhatsApp o el panel.",
  },

  llamada: {
    pregunta: "¿Y si suena mientras doy un masaje?",
    respuesta:
      "Ya no eliges entre dejar el masaje a medias o perder la llamada. En cabina solo se oye la música: fuera contesta la recepcionista, da la hora y la confirma por WhatsApp.",
    quien: "Sonia O.",
    duracion: "1 min 25 s",
    lineas: [
      {
        de: "cliente",
        texto:
          "Me regalaron un bono para el ritual de chocolate. ¿Tenéis algo el sábado por la tarde?",
      },
      {
        accion:
          "Mira tu agenda: el ritual son 90 min; a las 19:00 Lucía está libre",
        icono: "agenda",
      },
      {
        de: "recepcionista",
        texto:
          "A media tarde está completo; a las siete, con Lucía. ¿Te encaja?",
      },
      { de: "cliente", texto: "A las siete, perfecto. Soy Sonia." },
      {
        de: "recepcionista",
        texto:
          "Reservado, Sonia: sábado a las 19:00, ritual de chocolate con Lucía. Trae el bono, que lo comprobamos en recepción.",
      },
      {
        accion: "Cita en tu agenda: sábado, 19:00, ritual con Lucía",
        icono: "reserva",
      },
      { de: "cliente", texto: "¿Tengo que llevar algo más?" },
      {
        de: "recepcionista",
        texto:
          "Nada: albornoz y zapatillas te los damos aquí. Te llega todo por WhatsApp.",
      },
      { accion: "Confirmación por WhatsApp a Sonia", icono: "whatsapp" },
    ],
  },

  asistente: {
    pregunta: "¿Y si a mediodía falta una terapeuta?",
    respuesta:
      "Se lo escribes a tu asistente al salir de cabina. Marca la ausencia, te dice qué citas tenía, las pasa a quien tú elijas y avisa a cada cliente. Sin tu «Confirmar», no se mueve nada.",
    turnos: ausenciaDe({
      aviso: "Irene se encuentra mal y se va a casa. Esta tarde no vuelve",
      profesional: "Irene",
      cuando: "esta tarde",
      motivo: "se encuentra mal",
      respuesta: "El de piedras de las 6, que lo haga Lucía",
      cita: "la cita de Elena V.",
      servicio: "Masaje con piedras calientes",
      hora: "18:00",
      otra: "Lucía",
      cliente: "Elena",
      telefono: "+34 793 62 07 41",
    }),
  },

  whatsapp: {
    pregunta: "¿Mis clientes tienen que bajarse algo?",
    respuesta:
      "No, y dejas de educarlos para que usen una app: llaman como siempre y la cita les llega por WhatsApp. Si se les complica el día, contestan al mensaje y la recepcionista la mueve o la anula.",
    confirmacion: {
      servicio: "Ritual de chocolate, con Lucía",
      cuando: "sábado 7 de noviembre a las 19:00",
    },
    conversacion: [
      {
        de: "cliente",
        texto:
          "Me ha surgido una comida familiar el sábado. ¿Hay algo el domingo por la mañana?",
      },
      {
        de: "recepcionista",
        texto:
          "El domingo a las 11:00 Lucía tiene hueco para el ritual. ¿Lo paso ahí?",
      },
      { de: "cliente", texto: "Sí, genial" },
      {
        de: "recepcionista",
        texto:
          "Cambiado, Sonia: ritual de chocolate el domingo 8 de noviembre a las 11:00 con Lucía. El sábado queda libre.",
      },
    ],
  },

  oficio: {
    pregunta: "¿Sabe cómo funciona un spa?",
    respuesta:
      "Sabe lo que le enseñas: cada masaje, su duración y quién lo da; lo que no sabe, no se lo inventa.",
    equipo: ["Lucía", "Irene", "Óscar"],
    servicios: [
      {
        servicio: "Ritual de chocolate",
        minutos: 90,
        niveles: ["especialista", "lo-hace", "lo-hace"],
      },
      {
        servicio: "Masaje relajante",
        minutos: 60,
        niveles: ["lo-hace", "lo-hace", "especialista"],
      },
      {
        servicio: "Piedras calientes",
        minutos: 75,
        niveles: ["lo-hace", "especialista", "no-sugerir"],
      },
      {
        servicio: "Reflexología",
        minutos: 45,
        niveles: ["lo-hace", "especialista", "no-sugerir"],
      },
    ],
    reparto: "Con dos cabinas, nunca coloca tres masajes a la vez.",
  },

  faqs: [
    {
      question: "¿Puede aconsejar qué masaje le va mejor a cada cliente?",
      answer:
        "No hace de terapeuta ni aconseja. Explica cada masaje o ritual con lo que tú le escribas, con su duración y su precio, y reserva el que elija el cliente.",
    },
    {
      question: "¿Sabe si un bono regalo es válido?",
      answer:
        "No: no ve tus bonos ni cobra. Reserva el servicio regalado y, si se lo has escrito, recuerda traer el bono. La cita no lleva notas: lo del bono queda en la transcripción y lo compruebas tú en recepción.",
    },
    {
      question: "¿Y los circuitos de aguas con aforo?",
      answer:
        "Si se reserva como una cita con hora de entrada y alguien del equipo, es un servicio más. Si va por turnos con aforo, informa de horarios y precio y te deja el recado.",
    },
    {
      question: "Muchos clientes son extranjeros. ¿Les atiende?",
      answer:
        "Sí. Además del castellano habla inglés, francés, alemán, italiano, portugués, neerlandés y ruso en todos los planes. En Cataluña y Baleares, también catalán; en Euskadi, euskera; en Galicia, gallego.",
    },
    {
      question: "¿Tengo que dejar mi programa de reservas?",
      answer:
        "No hace falta. Reserva en tu Google Calendar, Outlook o iCloud, y lo que tu programa vuelque ahí cuenta como ocupado. Si no usas ninguno, las citas van a la agenda de Alhabla, que ves en el panel.",
    },
  ],

  cierre: "Que en cabina solo se oiga la música.",
};
