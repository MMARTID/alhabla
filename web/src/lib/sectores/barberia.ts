import { NICHE_ACCENTS } from "@/lib/niche-accents";
import type { SectorLanding } from "@/lib/sectores/tipos";

/**
 * Javier llama y reserva corte y barba con Luis (la escena del iPhone:
 * GUIONES_SECTOR, lib/relato-guiones.ts) y luego la cambia contestando al
 * WhatsApp (sus mensajes). En la escena de tu asistente (GUIONES_GESTOR,
 * lib/gestor-guiones.ts) Luis falta y su cita pasa a Dani, quien mejor lo
 * hace de los libres. Los móviles empiezan por 79, un rango sin atribuir.
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
  },

  asistente: {
    pregunta: "¿Y si a mediodía falta un barbero?",
    respuesta:
      "Se lo escribes a tu asistente entre corte y corte. Marca la ausencia, te dice qué citas tenía y te propone pasarlas al barbero libre que mejor hace cada servicio. Con tu «Confirmar», las mueve y avisa a cada cliente.",
    situaciones: [
      {
        titulo: "Si un barbero no viene",
        texto:
          "«Hoy Luis no viene, está malo»: deja de recibir citas y tu asistente propone pasar sus cortes a Dani, que está libre. Confirmas y avisa al cliente.",
      },
      {
        titulo: "¿Hay hueco a las 6?",
        texto:
          "Te dice si cabe y con quién; con un «apúntale a Javier», lo deja en tu agenda.",
      },
      {
        titulo: "Un festivo",
        texto:
          "«El lunes 12 cerramos»: ese día queda cerrado y la recepcionista no reserva nada.",
      },
    ],
  },

  whatsapp: {
    pregunta: "¿Mis clientes tienen que bajarse algo?",
    respuesta:
      "No. Nada de apps ni de pedir cita por un canal concreto: llaman como siempre y la hora les llega por WhatsApp. Si se les tuerce la tarde, contestan y la recepcionista la mueve.",
    confirmacion: {
      servicio: "Corte y barba, con Luis",
      cuando: "jueves 5 de noviembre a las 17:30",
    },
    conversacion: [
      { de: "cliente", texto: "Salgo más tarde del curro, ¿hay algo a las 7?" },
      {
        de: "recepcionista",
        texto: "A las 19:00 Luis está libre. ¿Te la paso a esa hora?",
      },
      { de: "cliente", texto: "Sí" },
      {
        de: "recepcionista",
        texto:
          "Listo, Javier: corte y barba el jueves a las 19:00 con Luis. La de las 17:30 queda anulada.",
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
    reparto: "El degradado, a tu especialista; el aprendiz, solo si lo piden.",
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
