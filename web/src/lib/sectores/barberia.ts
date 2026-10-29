import { ausenciaDe } from "@/lib/gestor-guiones";
import { NICHE_ACCENTS } from "@/lib/niche-accents";
import type { SectorLanding } from "@/lib/sectores/tipos";

/**
 * Javier llama con las sillas llenas para cortarse esa misma tarde y entra
 * con Sergio (la llamada); al rato retrasa la hora contestando al WhatsApp.
 * La ausencia es otro día: Luis se va a mediodía y su corte y barba de las
 * cinco pasa a Dani. Los barberos son los de lib/relato-guiones.ts y
 * lib/gestor-guiones.ts; los móviles empiezan por 79, un rango sin atribuir.
 */
export const barberia: SectorLanding = {
  slug: "barberia",
  nombre: "Barberías",
  paraQuien: "barberías",
  negocio: "Barbería Santos",
  clientes: "clientes",
  acento: NICHE_ACCENTS.barberia,
  demo: "barberia",

  descripcion:
    "Recepcionista de IA para tu barbería: coge el teléfono con las sillas llenas, da hueco para hoy con el barbero que piden y tú lo llevas por WhatsApp.",

  hero: {
    frase:
      "Coge el teléfono con las sillas llenas y da hora con el barbero que piden. Tú lo llevas por WhatsApp entre corte y corte.",
  },

  llamada: {
    pregunta: "¿Y si suena con todas las sillas llenas?",
    respuesta:
      "No sueltas la máquina ni dejas sonar el móvil. Contesta la recepcionista, busca el primer hueco en el que cabe el servicio entero y le manda la hora por WhatsApp.",
    quien: "Javier M.",
    duracion: "48 s",
    lineas: [
      { de: "cliente", texto: "¿Tenéis algo esta tarde para corte y barba?" },
      {
        accion:
          "Mira tu agenda: corte y barba son 45 min; a las 18:00 cabe con Sergio",
        icono: "agenda",
      },
      {
        de: "recepcionista",
        texto: "Esta tarde tengo a las 18:00 con Sergio. ¿Te la reservo?",
      },
      { de: "cliente", texto: "Venga, a las seis. Javier." },
      {
        de: "recepcionista",
        texto:
          "Hecho, Javier: corte y barba hoy a las 18:00 con Sergio. Te llega la confirmación por WhatsApp.",
      },
      { accion: "Cita en tu agenda: hoy, 18:00, con Sergio", icono: "reserva" },
      { accion: "Confirmación por WhatsApp a Javier", icono: "whatsapp" },
    ],
  },

  asistente: {
    pregunta: "¿Y si a mediodía falta un barbero?",
    respuesta:
      "Se lo escribes a tu asistente entre corte y corte. Marca la ausencia, te dice qué citas tenía, las pasa al barbero que tú digas y avisa a cada cliente. Nada se mueve sin tu «Confirmar».",
    turnos: ausenciaDe({
      aviso: "Luis se ha ido, le ha surgido algo. Esta tarde no viene",
      profesional: "Luis",
      cuando: "esta tarde",
      motivo: "imprevisto",
      respuesta: "El corte y barba de las 5, pásaselo a Dani",
      cita: "la cita de Marcos P.",
      servicio: "Corte y barba",
      hora: "17:00",
      otra: "Dani",
      cliente: "Marcos",
      telefono: "+34 792 55 31 84",
    }),
  },

  whatsapp: {
    pregunta: "¿Mis clientes tienen que bajarse algo?",
    respuesta:
      "No. Nada de apps ni de pedir cita por un canal concreto: llaman como siempre y la hora les llega por WhatsApp. Si se les tuerce la tarde, contestan y la recepcionista la mueve.",
    confirmacion: {
      servicio: "Corte y barba, con Sergio",
      cuando: "hoy, miércoles 4 de noviembre, a las 18:00",
    },
    conversacion: [
      { de: "cliente", texto: "Salgo más tarde del curro, ¿hay algo a las 7?" },
      {
        de: "recepcionista",
        texto: "A las 19:00 Sergio está libre. ¿Te la paso a esa hora?",
      },
      { de: "cliente", texto: "Sí" },
      {
        de: "recepcionista",
        texto:
          "Listo, Javier: corte y barba hoy a las 19:00 con Sergio. La de las 18:00 queda anulada.",
      },
    ],
  },

  oficio: {
    pregunta: "¿Sabe cómo funciona una barbería?",
    respuesta:
      "Sabe lo que le enseñas: cada servicio, su tiempo y qué barbero lo hace. Si piden a Luis, busca con él; si preguntan el horario, no insiste.",
    equipo: ["Sergio", "Luis", "Hugo"],
    servicios: [
      {
        servicio: "Corte",
        minutos: 30,
        niveles: ["lo-hace", "lo-hace", "lo-hace"],
      },
      {
        servicio: "Corte degradado",
        minutos: 45,
        niveles: ["especialista", "lo-hace", "no-sugerir"],
      },
      {
        servicio: "Corte y barba",
        minutos: 45,
        niveles: ["lo-hace", "especialista", "lo-hace"],
      },
      {
        servicio: "Afeitado a navaja",
        minutos: 30,
        niveles: ["lo-hace", "especialista", "no-sugerir"],
      },
    ],
    reparto:
      "El degradado, a tu especialista; el aprendiz, solo si lo piden.",
  },

  faqs: [
    {
      question: "¿Me puede pasar a un cliente que quiere hablar conmigo?",
      answer:
        "Si publicas el número de Alhabla como el de la barbería, sí: eliges si te pasa llamadas nunca, solo si el cliente lo pide o siempre. Si desvías desde tu número, toma el recado y te llega por WhatsApp.",
    },
    {
      question: "¿Respeta las citas que me entran por otra app?",
      answer:
        "Si esa app las copia en el calendario que conectas (Google, Outlook o iCloud), sí: antes de dar una hora lo mira y no ofrece lo que ya está ocupado. Con otras apps de reservas no se conecta directamente.",
    },
    {
      question: "¿Qué dice si le preguntan precios?",
      answer:
        "El precio que tenga cada servicio en tu catálogo, y si es un pack, el del pack. Si subes una tarifa, se lo dices a tu asistente por WhatsApp y desde la siguiente llamada ya da la nueva.",
    },
    {
      question: "¿Atiende a clientes que no hablan castellano?",
      answer:
        "Sí, en cualquier plan: inglés, francés, alemán, italiano, portugués, neerlandés y ruso, y cambia al del cliente en cuanto lo oye. En Cataluña y Baleares también habla catalán; en Euskadi, euskera; en Galicia, gallego.",
    },
    {
      question: "¿Me entero de cada cita nueva?",
      answer:
        "Sí: con tu WhatsApp dado de alta te llega un aviso con cada reserva y cada recado, y lo puedes apagar. En el panel tienes además cada llamada transcrita y, si el cliente dio permiso, la grabación.",
    },
  ],

  cierre: "Que la silla libre de las seis se ocupe aunque estés con la navaja.",
};
