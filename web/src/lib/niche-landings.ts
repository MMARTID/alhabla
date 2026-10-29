import type { Metadata } from "next";
import { paginasDeLaSeccion } from "@/lib/paginas";
import { plans } from "@/lib/plans";
import {
  absoluteUrl,
  buildFaqPageStructuredData,
  ogImages,
  organizationId,
  PRECIO_MAXIMO,
  PRECIO_MINIMO,
  siteName,
  websiteId,
} from "@/lib/seo";
import { NICHE_ACCENTS } from "@/lib/niche-accents";

export type NicheSlug = "peluqueria" | "centro-de-estetica" | "salon-de-unas" | "barberia" | "fisioterapia";

type Benefit = { title: string; description: string; result: string };
type Faq = { question: string; answer: string };

export type NicheAccent = {
  /** Color principal del nicho (texto, iconos, bordes) */
  strong: string;
  /** Fondo suave tintado para secciones y chips */
  soft: string;
  /** Variante oscura para degradados y tarjetas destacadas */
  deep: string;
};

/**
 * Referencia editorial que acompaña a una cifra o cita. Las referencias
 * heredadas pueden seguir siendo texto mientras se verifican, pero las nuevas
 * deben enlazar a la publicación concreta para que el lector pueda comprobar
 * el contexto sin salir a buscarlo.
 */
export type SectorSource = {
  publisher: string;
  title?: string;
  href?: string;
};

export type SectorStat = { value: string; label: string; source?: string | SectorSource };
export type SectorQuote = { text: string; source?: string | SectorSource };
export type SectorData = {
  eyebrow: string;
  title: string;
  description: string;
  stats: SectorStat[];
  quotes?: SectorQuote[];
  painPoint?: string;
};

/**
 * Reparto de citas por especialidad: cómo la recepcionista decide con quién
 * reserva cada servicio según lo que el negocio ha marcado por profesional
 * (especialista / lo hace / solo si lo piden). Regla de copy innegociable:
 * nunca en negativo hacia un profesional — el tercer nivel se cuenta como
 * «a quien prefieras reservar solo si lo piden», no como falta de nivel.
 */
export type TeamRoutingRule = { title: string; description: string };
export type TeamRouting = {
  badge: string;
  title: string;
  description: string;
  rules: [TeamRoutingRule, TeamRoutingRule, TeamRoutingRule];
  /** Línea de cierre: el desempate entre dos igual de preparados. */
  tieBreak: string;
};

/**
 * El Gestor: el negocio le habla a Alhabla por WhatsApp para cambiar su
 * propia agenda (una baja, un cierre, un cambio rápido) sin abrir el panel.
 * No es el canal de reservas del cliente — es con quien habla el dueño.
 * Mismo patrón que `TeamRouting`: tres ejemplos concretos y una línea de
 * cierre. Los tres ejemplos son las tres situaciones que reproduce la
 * simulación de la landing (`lib/gestor-guiones.ts`, en el mismo orden):
 * el guion de cada sector cuenta lo que su ejemplo describe.
 */
export type OwnerAssistantExample = { title: string; description: string };

export type OwnerAssistant = {
  badge: string;
  title: string;
  description: string;
  examples: [OwnerAssistantExample, OwnerAssistantExample, OwnerAssistantExample];
  /** Línea de cierre: qué pasa de verdad con lo que se confirma por WhatsApp. */
  closing: string;
};

/**
 * Guía del oficio (2026-10-20): el contenido propio de cada landing de
 * sector. Las cinco compartían más de la mitad del texto y Google solo
 * indexaba una; esto es lo que cada una cuenta y las otras no — las llamadas
 * típicas del oficio, sus servicios y tiempos, cómo encaja el reparto por
 * especialidad y los errores al ponerla en marcha. Todo lo que dice tiene que
 * ser lo que hace hoy la recepcionista (sin notas en la cita, una cita por
 * llamada, sin margen entre citas, grabación solo con permiso).
 */
export type GuiaLlamada = {
  /** El tipo de llamada, en pocas palabras. */
  titulo: string;
  /** Lo que diría quien llama (ejemplo ilustrativo). */
  pide: string;
  /** Lo que hace la recepcionista con esa llamada. */
  hace: string;
};
export type GuiaServicio = { servicio: string; duracion: string; quien: string };
export type GuiaError = { titulo: string; texto: string };
export type GuiaEnlace = { href: string; titulo: string; texto: string };
export type GuiaSector = {
  etiqueta: string;
  titulo: string;
  entradilla: string;
  llamadasTitulo: string;
  llamadas: [GuiaLlamada, GuiaLlamada, GuiaLlamada, GuiaLlamada, GuiaLlamada, GuiaLlamada];
  serviciosTitulo: string;
  serviciosEntradilla: string;
  servicios: GuiaServicio[];
  serviciosNota: string;
  repartoTitulo: string;
  reparto: string[];
  horasTitulo: string;
  horas: string[];
  erroresTitulo: string;
  errores: GuiaError[];
  /** Solo en los oficios con datos de salud (fisioterapia). */
  salud?: { titulo: string; texto: string; enlace: string; href: string };
  enlacesTitulo: string;
  enlaces: [GuiaEnlace, GuiaEnlace, GuiaEnlace, GuiaEnlace];
};

/** Copy por sector de «En tu ciudad y en tu idioma» (sector-ciudades-idiomas.tsx). */
export type CiudadesTextos = {
  titulo: string;
  /** Va detrás de la frase con la cifra de Madrid. */
  intro: string;
  idiomasTitulo: string;
  idiomasTexto: string;
  enlace: string;
};

/** Copy por sector de lo que recibe el cliente por WhatsApp (whatsapp-benefits-table.tsx). */
export type WhatsAppClientesTextos = {
  titulo: string;
  filas: [string, string, string, string];
};

export type NicheLandingContent = {
  slug: NicheSlug;
  name: string;
  eyebrow: string;
  title: string;
  description: string;
  primaryKeyword: string;
  keywords: string[];
  accent: NicheAccent;
  heroTitle: string;
  /** Frase del titular que va subrayada en el hero. Debe aparecer tal cual
   * en heroTitle; si no, el titular se muestra sin subrayar. */
  heroHighlight?: string;
  heroDescription: string;
  demoTitle: string;
  demoSteps: [string, string, string];
  sectionTitle: string;
  sectionDescription: string;
  highlights: [Benefit, Benefit, Benefit];
  benefitsTitle: string;
  benefitsDescription: string;
  benefits: [Benefit, Benefit, Benefit];
  teamRouting: TeamRouting;
  guia: GuiaSector;
  ownerAssistant: OwnerAssistant;
  ciudades: CiudadesTextos;
  whatsappClientes: WhatsAppClientesTextos;
  calculator: {
    badge: string;
    title: string;
    description: string;
    ticketLabel: string;
    appointmentsLabel: string;
    initialTicket: number;
    /** Textos fijos de la calculadora, por sector para que no se repitan
     * idénticos en las cinco landings. Sin ellos, los de siempre. */
    estimateTitle?: string;
    estimateHint?: string;
    footnote?: string;
  };
  planesTitulo: string;
  faqsTitulo: string;
  faqs: Faq[];
  closingTitle: string;
  sectorData?: SectorData;
};

export const nicheLandings: Record<NicheSlug, NicheLandingContent> = {
  peluqueria: {
    slug: "peluqueria",
    name: "Peluquerías",
    eyebrow: "78% de los clientes contrata al primer negocio que responde",
    title: "Recepcionista de IA para peluquerías",
    description: "Tu recepcionista de IA coge el teléfono mientras cortas: resuelve dudas de cortes y color, reserva en tu agenda y confirma la cita por WhatsApp.",
    primaryKeyword: "recepcionista de IA para peluquerías",
    keywords: [
      "recepcionista de IA para peluquerías",
      "IA para peluquerías",
      "inteligencia artificial para peluquerías",
      "asistente telefónico con IA para peluquerías",
      "contestador automático para peluquería",
      "atender llamadas en peluquería",
      "reservas de peluquería por teléfono",
      "citas de peluquería por WhatsApp",
      "agenda de peluquería con IA",
    ],
    accent: NICHE_ACCENTS.peluqueria,
    heroTitle: "Recepcionista de IA para peluquerías que contesta mientras cortas",
    heroHighlight: "que contesta mientras cortas",
    heroDescription: "Alhabla atiende llamadas, resuelve dudas sobre cortes y color, y agenda citas 24/7 — incluso cuando todo el equipo está con clientes.",
    demoTitle: "Así reserva un servicio de peluquería",
    demoSteps: ["Configura cortes, color, mechas y tratamientos.", "Conecta horarios, profesionales y calendario.", "Atiende llamadas incluso durante las horas punta."],
    sectionTitle: "Atiende cada llamada. Sin dejar a un cliente a medias.",
    sectionDescription: "El teléfono deja de competir con el trabajo en cabina y se convierte en un canal de reservas siempre disponible.",
    highlights: [
      { title: "Horas punta cubiertas", description: "Atiende llamadas cuando todo el equipo está con clientes.", result: "Menos llamadas perdidas" },
      { title: "Duraciones correctas", description: "Reserva cada corte, color o tratamiento con el tiempo que necesita.", result: "Una agenda mejor organizada" },
      { title: "Agenda conectada", description: "Consulta huecos reales antes de confirmar una cita.", result: "Menos solapes y esperas" },
    ],
    benefitsTitle: "Una recepción que conoce el ritmo de tu peluquería.",
    benefitsDescription: "Responde consultas frecuentes y organiza citas sin obligarte a dejar a un cliente a medias.",
    benefits: [
      { title: "Corte y peinado", description: "Explica disponibilidad y duración antes de reservar.", result: "Citas ajustadas al servicio" },
      { title: "Color y mechas", description: "Recoge la necesidad del cliente y deriva valoraciones complejas.", result: "Más contexto antes de atender" },
      { title: "Tratamientos", description: "Informa sobre opciones, precios y preparación previa.", result: "Consultas resueltas al instante" },
    ],
    teamRouting: {
      badge: "En los tres planes",
      title: "Las mechas, con quien tú se las confiarías.",
      description: "En la ficha de cada estilista marcas, servicio a servicio, si es especialista, si lo hace o si prefieres que se lo reserven solo cuando lo piden. Con eso la recepcionista organiza el día como lo harías tú desde el mostrador: unas mechas nuevas acaban en manos de tu colorista aunque la clienta no sepa ni cómo se llama.",
      rules: [
        { title: "Sin preferencia, a tu colorista", description: "Un alisado o unas mechas sin un nombre detrás van a quien hayas marcado como especialista en ese servicio." },
        { title: "Si pide a Marta, con Marta", description: "La clienta de toda la vida dice el nombre de su estilista y la cita se hace con ella, sin preguntas de más." },
        { title: "Lo que prefieres reservar solo bajo petición", description: "Primero propone, una sola vez, a quien tú propondrías con hueco; si la clienta insiste en otra persona, reserva con la que pidió." },
      ],
      tieBreak: "Cuando dos estilistas están igual de preparadas, gana la que lleva menos citas ese día.",
    },
    guia: {
      etiqueta: "Guía para peluquerías",
      titulo: "Cómo atiende tu recepcionista de IA las llamadas de una peluquería",
      entradilla: "En un salón casi todas las llamadas son variaciones de las mismas seis conversaciones. Si sabes cuáles son, sabes qué servicios dar de alta, con qué duración y a quién del equipo le toca cada uno. Esto es lo que pasa en cada caso, con lo que la recepcionista hace hoy y lo que deja en tus manos.",
      llamadasTitulo: "Las seis llamadas de cada semana en el salón",
      llamadas: [
        {
          titulo: "La clienta de siempre",
          pide: "«Hola, quería hora con Marta para lo de siempre.»",
          hace: "Si ya reservó antes por Alhabla, la reconoce por el número, la saluda por su nombre y, si la última vez fue un solo servicio, le pregunta si quiere repetirlo. Busca hueco con Marta; si Marta no tiene, le ofrece otro día con ella o, si la clienta prefiere no esperar, otra estilista.",
        },
        {
          titulo: "Corte y color juntos",
          pide: "«¿Me podéis hacer corte y color el sábado por la mañana?»",
          hace: "Reserva los dos servicios en la misma cita y bloquea la suma de sus duraciones, no solo la del corte. Si el sábado por la mañana no queda un hueco tan largo, propone el más cercano en el que cabe entero.",
        },
        {
          titulo: "El cambio de look sin decidir",
          pide: "«Quiero cambiar, pero no sé si cortar o hacerme algo de color.»",
          hace: "Le pregunta si busca corte, color o peinado, sin someterla a un interrogatorio. No promete cómo le quedará un rubio ni si su pelo aguanta una decoloración: si tienes un servicio de valoración dado de alta, se lo reserva; si no, toma el recado para que la llames tú.",
        },
        {
          titulo: "Primera vez con tinte",
          pide: "«Nunca he venido y quiero teñirme, ¿tengo que hacer algo antes?»",
          hace: "Le cuenta lo que hayas escrito en «Información para responder»: si pides prueba de sensibilidad, venir con el pelo sin lavar o llegar unos minutos antes. Si la prueba se hace en el salón, dala de alta como servicio corto. Cada llamada deja una sola cita, así que prueba y tinte se reservan en llamadas distintas.",
        },
        {
          titulo: "Peinado para una boda",
          pide: "«El día 14 tengo boda y necesito peinado a primera hora.»",
          hace: "Solo ofrece horas dentro de tu horario: si abres a las diez y la clienta quería las ocho, se lo dice claro y le da la primera hora libre. Si los peinados de novia van con presupuesto, escríbelo en la información del negocio y tomará el recado con su teléfono en vez de dar un precio que no es.",
        },
        {
          titulo: "Mover o anular",
          pide: "«No llego a la de las cinco, ¿me la pasas al jueves?»",
          hace: "Si llama desde el número con el que reservó, encuentra su cita, comprueba el jueves y la cambia; la hora que suelta vuelve a quedar libre para la siguiente que llame. Con el WhatsApp de la confirmación, la clienta también puede moverla contestando al mensaje.",
        },
      ],
      serviciosTitulo: "Servicios de peluquería y cuánto suelen durar",
      serviciosEntradilla: "La recepcionista reserva con la duración que tú pongas a cada servicio, así que esta tabla es solo un punto de partida. Los tiempos cambian con el largo del pelo y con la forma de trabajar de cada salón: configúralas con las tuyas.",
      servicios: [
        { servicio: "Corte de señora", duracion: "45 min", quien: "Cualquier estilista; especialista si alguien destaca con la tijera" },
        { servicio: "Corte de caballero", duracion: "30 min", quien: "Quien lleve los cortes rápidos" },
        { servicio: "Corte y color", duracion: "90 min", quien: "Tu colorista" },
        { servicio: "Mechas o balayage", duracion: "120–150 min", quien: "Colorista especialista" },
        { servicio: "Alisado o keratina", duracion: "90–120 min", quien: "Quien domine el tratamiento" },
        { servicio: "Peinado o recogido", duracion: "45 min", quien: "La estilista de peinados" },
        { servicio: "Lavado y secado", duracion: "30 min", quien: "Cualquiera del equipo" },
        { servicio: "Valoración de color", duracion: "15 min", quien: "Colorista" },
      ],
      serviciosNota: "Duraciones orientativas, no una norma del sector. Mide las tuyas durante una semana y ponlas tal cual: la recepcionista no añade minutos de margen entre una cita y la siguiente.",
      repartoTitulo: "El reparto por especialidad, en un salón",
      reparto: [
        "En una peluquería el color es lo que más se nota cuando sale mal y lo que más se repite cuando sale bien. Por eso conviene marcar como especialista en mechas, balayage y coloraciones a quien de verdad las domina, y dejar en «lo hace» al resto: si la colorista está ocupada, la recepcionista puede seguir reservando un color sencillo con otra compañera.",
        "«Solo si lo piden» sirve para quien está empezando o para quien prefieres que no coja trabajos largos: la recepcionista no le asigna esos servicios por iniciativa propia, pero si una clienta pide a esa estilista por su nombre, le propone una vez a la más indicada y, si insiste, reserva con quien pidió. Es una preferencia, no un bloqueo, y la clienta nunca oye cómo la tienes marcada.",
        "Un detalle que se olvida: en una cita con varios servicios, cuenta como especialista quien lo es en todos. Si tu colorista no está marcada también en corte, un «corte y color» puede ir a otra persona; márcala en los dos si quieres que se lo lleve ella.",
      ],
      horasTitulo: "Cuándo suena el teléfono en una peluquería",
      horas: [
        "Las llamadas se amontonan justo cuando todo el equipo tiene las manos ocupadas: antes del fin de semana, en temporada de bodas y comuniones, en las fiestas del pueblo y en los días previos a Navidad. No te damos porcentajes porque no hay un dato público que valga para todos los salones.",
        "Lo que sí puedes medir desde el primer día es tu caso: el historial de llamadas del panel enseña a qué hora entra cada una y cómo acabó. Con dos o tres semanas verás tus picos reales y sabrás si te conviene desviar solo cuando no contestas o también cuando comunica.",
        "También entra trabajo fuera de horario: la clienta que se acuerda a las once de la noche de que el viernes tiene una cena. Sin nadie al otro lado, esa llamada no deja ni rastro; con la recepcionista, la clienta cuelga con su hora.",
      ],
      erroresTitulo: "Errores típicos al poner una recepcionista de IA en una peluquería",
      errores: [
        { titulo: "Una sola duración para todo el color", texto: "Si das de alta «Color» con 60 minutos y tus mechas duran dos horas y media, la recepcionista reservará 60 minutos y la tarde se te descuadrará. Separa los servicios largos y ponles su tiempo real." },
        { titulo: "No decir lo que no hacéis", texto: "Si ya no haces keratina o no trabajas extensiones, escríbelo en la información del negocio. Lo que no está escrito, la recepcionista no lo sabe, y antes que inventar, toma el recado." },
        { titulo: "Esperar que apunte detalles en la cita", texto: "La reserva guarda nombre, teléfono, servicio y estilista. No hay un campo de notas: si la clienta cuenta que quiere cubrir canas o que trae el pelo por la cintura, eso queda en la transcripción de la llamada, que puedes leer en el panel antes de que llegue." },
        { titulo: "Dejar el calendario a medias", texto: "Si apuntas citas en una libreta o en un programa que no vuelca en el calendario conectado, la recepcionista no las ve y puede dar esa hora. Todo lo que ocupe un sillón tiene que estar ahí." },
        { titulo: "No probar el desvío antes del sábado", texto: "El desvío se activa en tu operador, no en Alhabla. Pulsa «Comprobar desvío» en el panel: Alhabla llama a tu línea y te dice si la llamada vuelve a entrar o por qué no." },
      ],
      enlacesTitulo: "Para dejarlo listo en tu salón",
      enlaces: [
        { href: "/desvio-de-llamadas", titulo: "Desvía las llamadas del salón", texto: "Los códigos de tu operador para que lo que no coges salte a la recepcionista, en fijo o en móvil." },
        { href: "/integraciones", titulo: "Conecta tu calendario", texto: "Google, Outlook o iCloud: dónde entran las citas y qué horas ocupadas respeta." },
        { href: "/herramientas/plantillas-recordatorio-de-cita", titulo: "Plantillas para recordar citas", texto: "Textos de confirmación y recordatorio para copiar, por si escribes tú a alguna clienta." },
        { href: "/comparativa/recepcionista-de-ia-vs-recepcionista-humana", titulo: "¿IA o una recepcionista en plantilla?", texto: "Lo que cuesta cada opción en un salón y cuándo tiene sentido combinarlas." },
      ],
    },
    ownerAssistant: {
      badge: "Con cualquier plan",
      title: "Y cuando algo cambia en el salón, se lo dices por WhatsApp.",
      description: "Tu línea directa con Alhabla es el Gestor: le escribes como a una compañera de mostrador y te deja el cambio preparado en la agenda. Sirve para lo que pasa entre clienta y clienta: una baja, la cita que te piden mientras cobras, una tarifa nueva.",
      examples: [
        { title: "Si una estilista no viene", description: "«Marta está de baja hoy»: en cuanto confirmas, deja de darle citas nuevas y te dice cuántas tenía. Le dices a quién pasar las mechas o el color, confirmas el cambio y te pregunta si avisa a la clienta por WhatsApp." },
        { title: "La cita que te piden en caja", description: "Mientras cobras, la clienta quiere hora para dentro de un mes: «apunta a Rosa el jueves 29 a las 5, mechas». El Gestor comprueba que el hueco existe y, si le das su móvil, puede mandarle a Rosa la confirmación por WhatsApp." },
        { title: "Una tarifa o un horario nuevo", description: "«El alisado pasa a 120 €» o «los martes abrimos a las 10»: cambia en tu catálogo y en tu horario, y la recepcionista lo dice así desde la siguiente llamada." },
      ],
      closing: "Hasta que no pulsas «Confirmar», tu agenda sigue tal cual.",
    },
    ciudades: {
      titulo: "En la capital o en tu barrio, la clienta llama al salón de siempre.",
      intro: "Para tu recepcionista de IA da igual la calle: tus clientas siguen marcando el número del salón, la llamada que no coges salta al número de Alhabla con el desvío de tu operador y la cita aparece en el calendario que ya usas.",
      idiomasTitulo: "Y si la clienta habla otro idioma, también.",
      idiomasTexto: "Si en tu zona hay residentes extranjeros o turistas que piden un peinado de paso, la recepcionista les contesta en su idioma: ocho en cualquier plan. Si el salón está en Cataluña o Baleares suma el catalán, en Euskadi el euskera y en Galicia el gallego, sin que configures nada.",
      enlace: "Así responde en catalán, euskera y gallego",
    },
    whatsappClientes: {
      titulo: "Lo que le llega a tu clienta por WhatsApp",
      filas: [
        "Al colgar, la confirmación con el servicio, el día, la hora y la estilista: «Corte y color, jueves 17:30, con Marta».",
        "En los planes Pro y Scale, además, le llega un aviso antes de la cita para que el hueco del tinte no se quede vacío por un despiste.",
        "Si no puede venir, contesta al mensaje para cambiar o anular la cita, sin tener que llamar al salón.",
        "Si la hora que quería estaba cogida, puede pedir que le avisen por WhatsApp si se libera; y si ya ha reservado antes en el salón, también puede escribir a la recepcionista para pedir otra.",
      ],
    },
    calculator: {
      badge: "Calcula las citas que se escapan",
      title: "¿Cuánto pierde tu peluquería por no contestar?",
      description: "Estima el valor de cortes, coloraciones y tratamientos que pueden terminar en otro salón.",
      ticketLabel: "Ticket medio por cita",
      appointmentsLabel: "Citas perdidas cada semana",
      initialTicket: 45,
      estimateTitle: "Pon números a tu salón",
      estimateHint: "Piensa en una semana normal: cuántas clientas no llegaron a reservar porque nadie cogió el teléfono.",
      footnote: "Cálculo orientativo con cuatro semanas por mes y un servicio por cita. No suma lo que deja una clienta fiel a lo largo del año.",
    },
    planesTitulo: "Lo que cuesta en tu peluquería, plan a plan.",
    faqsTitulo: "Lo que preguntan las peluquerías antes de probar.",
    faqs: [
      { question: "¿Necesito conectar un calendario?", answer: "No. Si llevas la agenda en Google Calendar, Outlook o iCloud, conéctalo y las citas entran ahí. Si no usas ninguno, elige la agenda de Alhabla: la recepcionista reserva en ella, tú la ves en el panel, apuntas lo que te entra por otros canales y te la suscribes en el calendario del móvil con un enlace de solo lectura." },
      { question: "¿Sabe la diferencia entre un corte y unas mechas?", answer: "Sí, porque la diferencia la pones tú: cada servicio tiene su nombre, su duración y, si quieres, su precio. Con eso reserva el hueco que necesita cada trabajo y sabe a qué estilista dárselo." },
      { question: "¿Qué hace si una clienta pide una valoración de color?", answer: "Si tienes un servicio de valoración, lo reserva como cualquier otro. Si no, no se inventa un diagnóstico del pelo: toma el recado con nombre, teléfono y motivo, y lo recibes por WhatsApp para llamarla tú." },
      { question: "¿Contesta cuando estamos todas con clientas?", answer: "Contesta las llamadas que tú no coges: con el desvío condicional de tu operador, si el teléfono suena y nadie lo atiende, salta a la recepcionista. Funciona igual a mediodía, por la noche y en festivos." },
      { question: "¿Una clienta puede cambiar su cita por teléfono?", answer: "Sí. Si llama desde el número con el que reservó, la recepcionista encuentra su próxima cita, comprueba la nueva hora y la cambia, o la anula si es lo que pide. También puede hacerlo contestando al WhatsApp de la confirmación." },
      { question: "Trabajo con Booksy o Treatwell, ¿lo puedo seguir usando?", answer: "Alhabla no se conecta con esos programas. Lo que hace es mirar el calendario que conectes antes de ofrecer una hora: si tu programa copia sus citas en ese calendario de Google, Outlook o iCloud, esas horas no se ofrecen por teléfono." },
      { question: "¿Puede reservar a madre e hija a la vez?", answer: "Cada llamada termina en una sola cita, aunque esa cita lleve varios servicios. Para dos personas, la segunda cita se pide en otra llamada o la apuntas tú escribiendo al Gestor por WhatsApp." },
      { question: "¿Le dice el precio a la clienta?", answer: "Si el servicio tiene precio en tu catálogo, sí. Si tus precios dependen del largo o del producto, puedes dejar el servicio sin precio y escribir en la información del negocio cómo lo calculáis, para que lo explique sin dar una cifra cerrada." },
      { question: "¿Y si llaman en catalán o en inglés?", answer: "El inglés y otros seis idiomas extranjeros van en cualquier plan, y la recepcionista cambia de idioma si la clienta lo hace. El catalán se activa sin que configures nada si el salón está en Cataluña o Baleares (por el código postal de su dirección), y en cualquier sitio puedes elegirlo como idioma principal; igual el euskera en Euskadi y el gallego en Galicia." },
      { question: "¿Graba las llamadas de mis clientas?", answer: "Únicamente si la clienta acepta: se lo pregunta durante la llamada y, a quien ya aceptó, se lo recuerda al descolgar. Si dice que no, solo queda la transcripción, que puedes leer en el panel." },
    ],
    closingTitle: "Que la próxima clienta reserve aunque tengas las manos en un tinte.",
    sectorData: {
      eyebrow: "El sector más competido de Europa",
      title: "1 peluquería cada 900 habitantes y cada llamada cuenta",
      description: "España lidera Europa en densidad de peluquerías. Con 500.000 clientes perdidos desde la pandemia y más de la mitad del sector sin digitalizar, cada llamada atendida es una ventaja competitiva.",
      stats: [
        { value: "1/900", label: "habitantes: la mayor concentración de peluquerías de Europa", source: "El Confidencial Digital" },
        { value: "78%", label: "de los clientes contrata al primer negocio que responde", source: "minute-call.com" },
        { value: "+50%", label: "de las peluquerías en España aún no están digitalizadas", source: "Estética Magazine" },
      ],
      quotes: [
        { text: "Las peluquerías y centros de estética en España pierden una media de 3 llamadas al día", source: "David Aranda, Estetical — Crónica Global" },
      ],
    },
  },
  "centro-de-estetica": {
    slug: "centro-de-estetica",
    name: "Centros de estética",
    eyebrow: "57% de los clientes reserva por teléfono — el canal más importante",
    title: "IA para centros de estética que atiende y reserva",
    description: "Recepcionista de IA para tu centro de estética: informa de tratamientos y bonos, reparte citas por profesional y reserva sin sacarte de cabina.",
    primaryKeyword: "IA para centros de estética",
    keywords: [
      "IA para centros de estética",
      "recepcionista de IA para centros de estética",
      "inteligencia artificial para centros de estética",
      "IA para clínicas estéticas",
      "IA para salones de belleza",
      "asistente telefónico con IA para estética",
      "reservas de tratamientos estéticos",
      "citas de estética por WhatsApp",
      "atención telefónica para centros de estética",
    ],
    accent: NICHE_ACCENTS["centro-de-estetica"],
    heroTitle: "Recepcionista de IA para centros de estética que no te saca de cabina",
    heroHighlight: "que no te saca de cabina",
    heroDescription: "Alhabla atiende llamadas, informa sobre tratamientos y agenda citas 24/7 — incluso mientras estás en cabina.",
    demoTitle: "Así gestiona una consulta estética",
    demoSteps: ["Carga tratamientos, bonos y preguntas frecuentes.", "Define qué consultas requieren valoración humana.", "Conecta profesionales, tratamientos y disponibilidad."],
    sectionTitle: "Atiende cada consulta. Sin interrumpir el tratamiento.",
    sectionDescription: "Responde con consistencia, filtra consultas y reserva sólo cuando se cumplen las reglas del tratamiento.",
    highlights: [
      { title: "Consultas informadas", description: "Explica tratamientos, duración y preparación con información aprobada.", result: "Más confianza antes de la visita" },
      { title: "Valoración segura", description: "Detecta cuándo una consulta debe pasar a un profesional.", result: "Sin promesas clínicas indebidas" },
      { title: "Agenda coordinada", description: "Reserva por esteticista según la disponibilidad real.", result: "Mayor ocupación sin solapes" },
    ],
    benefitsTitle: "Más tiempo para tratar. Menos tiempo filtrando llamadas.",
    benefitsDescription: "La IA atiende lo repetitivo y deja al equipo las consultas que realmente necesitan criterio profesional.",
    benefits: [
      { title: "Faciales", description: "Informa sobre duración, preparación y disponibilidad.", result: "Clientes mejor preparados" },
      { title: "Corporales", description: "Recoge objetivos y deriva dudas sensibles al equipo.", result: "Mejor cualificación de consultas" },
      { title: "Bonos y seguimiento", description: "Responde dudas habituales y organiza próximas sesiones.", result: "Más continuidad del tratamiento" },
    ],
    teamRouting: {
      badge: "Incluido en cada plan",
      title: "Cada tratamiento, en las manos que tú elegirías.",
      description: "En la ficha de cada esteticista indicas qué tratamientos son su especialidad, cuáles hace y cuáles prefieres que le reserven solo si el cliente la pide. La recepcionista organiza la agenda con esa misma lógica: el facial con peeling va a quien tú se lo darías, sin que nadie tenga que explicarlo al teléfono.",
      rules: [
        { title: "Si no hay preferencia, a la especialista", description: "Una higiene facial con peeling acaba en quien marcaste como especialista en faciales." },
        { title: "Si pide a Sara, con Sara", description: "Quien está a mitad de un bono y pide a su esteticista sigue con ella, sin preguntas." },
        { title: "Lo que reservas solo a petición", description: "Antes propone una vez a la profesional más indicada con hueco; si el cliente insiste en otra, reserva con la que pidió." },
      ],
      tieBreak: "A igual preparación, el tratamiento va a la esteticista con el día más libre.",
    },
    guia: {
      etiqueta: "Guía para centros de estética",
      titulo: "Las llamadas de un centro de estética y cómo las atiende tu recepcionista de IA",
      entradilla: "En estética, una llamada rara vez es solo «quiero hora»: hay quien pregunta antes de decidirse, quien está a mitad de un bono y quien necesita una valoración previa. Estas son las seis llamadas más habituales y lo que hace la recepcionista en cada una, con sus límites, que en este sector importan tanto como lo que resuelve.",
      llamadasTitulo: "Seis llamadas de un día normal en el centro",
      llamadas: [
        {
          titulo: "La que pregunta antes de decidirse",
          pide: "«¿Qué diferencia hay entre una higiene facial y un facial con peeling?»",
          hace: "Explica lo que hayas escrito sobre cada tratamiento: en qué consiste, cuánto dura y cuánto cuesta. No recomienda uno según la piel de la clienta ni promete resultados; si la duda pide criterio profesional, ofrece que el centro la llame y toma el recado.",
        },
        {
          titulo: "La siguiente sesión del bono",
          pide: "«Llevo cuatro de presoterapia, quiero pedir la siguiente.»",
          hace: "Reserva la siguiente sesión con su duración y, si pide a su esteticista, con ella. La recepcionista no lleva la cuenta de las sesiones que quedan en cada bono: eso sigue en tu sistema o en tu caja, y si la clienta pregunta cuántas le quedan, toma el recado.",
        },
        {
          titulo: "Primera vez con un tratamiento",
          pide: "«Nunca me he hecho láser, ¿me podéis dar cita?»",
          hace: "Pregunta si es la primera vez solo cuando eso cambia algo, por ejemplo si en tu centro hay una valoración previa. Si la tienes como servicio, reserva primero la valoración; el tratamiento va después, en otra llamada, porque cada llamada deja una sola cita.",
        },
        {
          titulo: "La pregunta de salud",
          pide: "«Estoy embarazada, ¿me puedo hacer el tratamiento?»",
          hace: "No contesta a eso: no aconseja sobre contraindicaciones. Ofrece que el centro la llame y toma el recado con su teléfono, que te llega por WhatsApp. Lo que la clienta cuente queda en la transcripción, y conviene que lo sepas: es un dato de salud.",
        },
        {
          titulo: "Un regalo para otra persona",
          pide: "«Quiero regalarle a mi madre un masaje, ¿cómo lo hago?»",
          hace: "Si vendéis tarjetas regalo, explica cómo se compran según lo que hayas escrito en la información del centro; no cobra ni emite la tarjeta. Si la madre ya quiere cita, se la reserva a su nombre.",
        },
        {
          titulo: "Mover una sesión",
          pide: "«Me ha salido un viaje, ¿puedo cambiar la cita del lunes?»",
          hace: "Si llama desde el número con el que reservó, localiza su próxima cita, busca otro hueco, con la misma esteticista si la pide, y la cambia. Si lo prefiere, puede hacerlo respondiendo al WhatsApp de la confirmación.",
        },
      ],
      serviciosTitulo: "Tratamientos de estética y su duración de referencia",
      serviciosEntradilla: "La recepcionista reserva cada tratamiento con el tiempo que le pongas, y en estética los tiempos varían mucho entre centros y aparatos. Toma esta tabla como borrador: configúralas con las tuyas, zona por zona cuando haga falta.",
      servicios: [
        { servicio: "Higiene facial", duracion: "60 min", quien: "La esteticista de faciales" },
        { servicio: "Facial con peeling", duracion: "75 min", quien: "Especialista en faciales" },
        { servicio: "Depilación láser, por zona", duracion: "15–45 min", quien: "Quien maneje el equipo de láser" },
        { servicio: "Depilación con cera", duracion: "15–45 min", quien: "Cualquier esteticista" },
        { servicio: "Presoterapia", duracion: "45 min", quien: "Cualquiera del equipo" },
        { servicio: "Masaje relajante", duracion: "60 min", quien: "Quien lleve los masajes" },
        { servicio: "Tratamiento corporal reductor", duracion: "60 min", quien: "Especialista en corporales" },
        { servicio: "Valoración previa", duracion: "20–30 min", quien: "La responsable del centro" },
      ],
      serviciosNota: "Duraciones de referencia. Si una cabina necesita preparación entre clientas, súmala al tratamiento: la recepcionista no reserva tiempo de cambio por su cuenta.",
      repartoTitulo: "El reparto por especialidad, cabina a cabina",
      reparto: [
        "En estética las especialidades están muy marcadas: no es lo mismo un facial con aparatología que un masaje o una depilación. Marca a cada esteticista como especialista en lo suyo y deja en «lo hace» lo que cualquiera puede cubrir, como la cera o la presoterapia; así la agenda no se para porque falte una persona concreta.",
        "En los bonos manda la continuidad: la clienta suele querer a la misma esteticista sesión tras sesión, y si la pide por su nombre la recepcionista la respeta. Si alguien del equipo está empezando con un tratamiento delicado, márcala como «solo si lo piden»: no se le asigna por iniciativa propia, aunque se reservará con ella si una clienta insiste después de oír otra propuesta.",
        "Ten en cuenta que Alhabla reparte por persona, no por cabina ni por aparato. Si en tu centro hay una sola máquina de láser, marca como especialista a quien trabaja con ella y como «solo si lo piden» al resto en esos tratamientos: así caen en su agenda, y con otra persona solo se reservan si una clienta la pide por su nombre.",
      ],
      horasTitulo: "Cuándo llaman a un centro de estética",
      horas: [
        "Muchos centros notan la temporada: antes del verano suben las consultas de depilación y de tratamientos corporales, y antes de Navidad, las de faciales y regalos. Las horas más difíciles coinciden con las de más ocupación, cuando todas las cabinas tienen a alguien dentro.",
        "En el panel tienes el historial de cada llamada con su hora y cómo acabó: tras unas semanas sabrás cuándo te llaman a ti, que es lo que importa, y si te compensa que el desvío salte también cuando la línea comunica.",
        "Hay consultas que llegan fuera de horario, de gente que mira tratamientos por la noche y llama cuando por fin se decide. Sin recepcionista, a esas no les contesta nadie.",
      ],
      erroresTitulo: "Errores típicos al poner una recepcionista de IA en un centro de estética",
      errores: [
        { titulo: "Dejar que improvise sobre tratamientos", texto: "Si no escribes en qué consiste cada tratamiento y qué hay que hacer antes, la recepcionista no lo sabe. Ponlo en la información del centro con frases cortas y revísalo como revisarías lo que dice una recepcionista nueva." },
        { titulo: "Esperar que lleve los bonos", texto: "La recepcionista reserva sesiones, no cuenta las que quedan ni cobra. Si vendes bonos, deja claro en la información del centro cómo se compran y quién lleva la cuenta." },
        { titulo: "Un mismo tiempo para todas las zonas", texto: "Una depilación de axilas no dura lo mismo que una de piernas enteras. Da de alta cada zona, o cada grupo de zonas, con su duración, o la agenda se llenará de huecos muertos o de retrasos." },
        { titulo: "Pedir datos que no hacen falta", texto: "No le pidas en la información del centro que pregunte por medicación, embarazo o enfermedades: no lo hará, y no conviene que esos datos pasen por el teléfono. Si un tratamiento exige valoración, que la valoración sea el servicio que se reserva." },
        { titulo: "Abrir sin comprobar el desvío", texto: "Sin desvío, la recepcionista no recibe nada. En el panel, «Comprobar desvío» llama a tu línea y te confirma si funciona; si no, te dice si la cogiste tú, si comunicaba o si no hay desvío puesto." },
      ],
      enlacesTitulo: "Para ponerla a trabajar en tu centro",
      enlaces: [
        { href: "/desvio-de-llamadas", titulo: "Configura el desvío del centro", texto: "Los pasos en tu operador para que las llamadas que no atiendes en cabina lleguen a la recepcionista." },
        { href: "/integraciones", titulo: "Calendarios con los que trabaja", texto: "Google, Outlook y iCloud: cómo entran los tratamientos y qué respeta de lo que ya tienes." },
        { href: "/herramientas/plantillas-recordatorio-de-cita", titulo: "Recordatorios de sesión listos", texto: "Textos para confirmar y recordar tratamientos, por si escribes tú a alguna clienta." },
        { href: "/comparativa/recepcionista-de-ia-vs-recepcionista-humana", titulo: "Una recepcionista en plantilla o de IA", texto: "Coste según convenio, qué cubre cada una y cuándo merece la pena tener las dos." },
      ],
    },
    ownerAssistant: {
      badge: "Incluido en cada plan",
      title: "Y cuando algo cambia en el centro, se lo dices por WhatsApp.",
      description: "Lo que cambia en un centro casi nunca puede esperar a que acabe la última cabina. Al Gestor se lo escribes por WhatsApp en cuanto lo sabes y prepara el cambio en tu agenda real; tú solo apruebas.",
      examples: [
        { title: "Si una esteticista falta", description: "«Sara no puede venir hoy»: al confirmar, deja de recibir citas y el Gestor te dice qué tenía. Le pasas el facial o la sesión de bono a otra compañera con un «Confirmar» y te pregunta si avisa a la clienta." },
        { title: "Mover una sesión y avisar", description: "«Pasa la presoterapia de Beatriz al viernes a la misma hora»: el Gestor comprueba el hueco y, cuando confirmas, te pregunta si avisa a Beatriz por WhatsApp." },
        { title: "Enseñarle algo a la recepcionista", description: "«Dile que los bonos se pagan en el centro, no por teléfono»: lo añade a lo que sabe del centro y lo cuenta en las llamadas, en vez de improvisar." },
      ],
      closing: "Ningún cambio llega a la agenda sin tu «Confirmar».",
    },
    ciudades: {
      titulo: "En pleno centro o en un barrio residencial, igual de atendido.",
      intro: "La recepcionista de IA no necesita que estés en una gran ciudad: tus clientas llaman al número del centro, lo que no puedes coger salta a Alhabla gracias al desvío de tu operador y el tratamiento queda reservado en tu calendario de Google, Outlook o Apple.",
      idiomasTitulo: "Y atiende en el idioma de cada clienta.",
      idiomasTexto: "Si tienes clientela de fuera, la recepcionista le habla en su idioma: ocho en cualquier plan, y cambia en cuanto la clienta lo hace. En Cataluña y Baleares añade el catalán, en Euskadi el euskera y en Galicia el gallego, sin que toques nada.",
      enlace: "Atención en catalán, euskera y gallego",
    },
    whatsappClientes: {
      titulo: "Del lado de tu clienta, todo por WhatsApp",
      filas: [
        "Al colgar, la confirmación con el tratamiento, el día, la hora y la esteticista: «Facial con peeling, miércoles 12:00, con Sara».",
        "En Pro y Scale, el recordatorio antes de cada sesión, útil cuando un bono tiene varias citas seguidas.",
        "Para cambiar una sesión o anularla, responde al mensaje: no tiene que llamar mientras estás en cabina.",
        "Si la hora que quería está ocupada, pide que le avisen por WhatsApp si se libera; si ya ha venido antes al centro, también puede escribir a la recepcionista para buscar otra.",
      ],
    },
    calculator: {
      badge: "Calcula oportunidades sin atender",
      title: "¿Cuánto valen las consultas que no puedes responder?",
      description: "Estima tratamientos y valoraciones que podrías recuperar con recepción continua.",
      ticketLabel: "Ticket medio por tratamiento",
      appointmentsLabel: "Consultas perdidas cada semana",
      initialTicket: 80,
      estimateTitle: "Estima lo que no entra por teléfono",
      estimateHint: "Basta con una idea: cuántas consultas de tratamientos no llegaron a reserva la última semana.",
      footnote: "Estimación con cuatro semanas al mes y un tratamiento por consulta. No cuenta las sesiones siguientes de un bono ni lo que se vende en cabina.",
    },
    planesTitulo: "Planes para tu centro de estética.",
    faqsTitulo: "Dudas frecuentes de los centros de estética.",
    faqs: [
      { question: "¿Necesito conectar un calendario?", answer: "No. Si llevas la agenda en Google Calendar, Outlook o iCloud, conéctalo y las citas entran ahí. Si no usas ninguno, elige la agenda de Alhabla: la recepcionista reserva en ella, tú la ves en el panel, apuntas lo que te entra por otros canales y te la suscribes en el calendario del móvil con un enlace de solo lectura." },
      { question: "¿Puede aconsejar a una clienta qué tratamiento le conviene?", answer: "No. Explica lo que hayas escrito sobre cada tratamiento (en qué consiste, duración, precio), pero no recomienda según la piel ni el cuerpo de nadie. Si la clienta necesita consejo, ofrece que la llaméis y toma el recado." },
      { question: "¿Sabe cuántas sesiones le quedan a una clienta en su bono?", answer: "No: no ve bonos ni cobra. Reserva la siguiente sesión con la duración del tratamiento y, si la clienta pregunta por su saldo, toma el recado para que se lo digas tú." },
      { question: "¿Reserva con la esteticista que lleva a cada clienta?", answer: "Sí, si la clienta la nombra. Si no nombra a nadie, la cita va a quien hayas marcado como especialista en ese tratamiento y, entre dos iguales, a la que tenga el día más libre." },
      { question: "¿Controla qué cabina o aparato está libre?", answer: "No. Alhabla reparte por profesional, no por cabina ni por máquina. Si un aparato solo lo usa una esteticista, márcala como especialista en esos tratamientos y al resto como «solo si lo piden»: así esas citas caen en su agenda." },
      { question: "¿Qué hace si alguien pregunta por contraindicaciones?", answer: "No responde sobre salud ni contraindicaciones. Ofrece que el centro la llame y toma el recado, que te llega por WhatsApp con el nombre, el teléfono y el motivo." },
      { question: "¿Tengo que dejar mi software de citas?", answer: "No. Alhabla no sustituye a tu programa ni se conecta con él; lo que mira es el calendario que conectes. Si tu programa vuelca las citas en Google, Outlook o iCloud, la recepcionista no ofrecerá esas horas." },
      { question: "¿Se graban las llamadas de mis clientas?", answer: "Solo con su permiso. La recepcionista lo pide durante la llamada; si la clienta no acepta, queda solo la transcripción. Según la política de privacidad, las grabaciones se guardan 30 días y las transcripciones 90." },
      { question: "¿Habla con clientas extranjeras?", answer: "Sí, en cualquier plan: además de castellano, entiende y responde en siete idiomas más, entre ellos inglés y francés. En Cataluña y Baleares atiende también en catalán, en Euskadi en euskera y en Galicia en gallego." },
      { question: "¿Puede reservar un tratamiento para dos personas a la vez?", answer: "Cada llamada deja una sola cita, con una sola esteticista. Para dos personas a la misma hora, la recepcionista reserva una y la otra se pide en otra llamada o la apuntas tú con el Gestor." },
    ],
    closingTitle: "Que la próxima consulta acabe en cita, aunque estés en cabina.",
    sectorData: {
      eyebrow: "Datos que duelen",
      title: "El 37% de las llamadas a centros de estética se pierden",
      description: "Mientras estás en cabina, el teléfono sigue sonando. Y cada llamada perdida no es solo una cita menos: es un cliente que llama a tu competencia.",
      stats: [
        { value: "37%", label: "de las llamadas a salones y centros de estética se pierden", source: "Zenoti" },
        { value: "57%", label: "de los clientes reserva por teléfono — el canal más importante", source: "Zenoti" },
        { value: "97%", label: "de quienes no contactan cuelga y llama a otro negocio", source: "Recepcionista.com" },
      ],
      quotes: [
        { text: "Cruzando dedos, así es como muchas profesionales entran en cabina para atender a sus clientes. Deseando que no suene el teléfono", source: "Estetical — Facebook" },
      ],
      painPoint: "Cuando estás con un cliente en cabina, no puedes atender el teléfono. Y las llamadas no esperan a que termines: suelen llegar justo en las horas en que la agenda está más llena.",
    },
  },
  "salon-de-unas": {
    slug: "salon-de-unas",
    name: "Salones de uñas",
    eyebrow: "85% de quienes no hablan con una persona real no vuelve a llamar",
    title: "Recepcionista de IA para salones de uñas",
    description: "Contesta el teléfono de tu salón de uñas mientras trabajas: da el precio de cada técnica, pregunta si hay retirada y reserva manicuras y pedicuras.",
    primaryKeyword: "recepcionista de IA para salones de uñas",
    keywords: [
      "recepcionista de IA para salones de uñas",
      "IA para salón de uñas",
      "inteligencia artificial para salón de uñas",
      "asistente telefónico con IA para salones de uñas",
      "atender llamadas en salón de uñas",
      "reservas de manicura por teléfono",
      "citas de manicura por WhatsApp",
      "recordatorio de cita de uñas",
      "reservas de manicura y pedicura",
    ],
    accent: NICHE_ACCENTS["salon-de-unas"],
    heroTitle: "Recepcionista de IA para salones de uñas que contesta mientras trabajas",
    heroHighlight: "que contesta mientras trabajas",
    heroDescription: "Alhabla atiende llamadas, responde precios y agenda citas 24/7 — incluso mientras trabajas en una uña.",
    demoTitle: "Así reserva una cita de uñas",
    demoSteps: ["Configura técnicas, retiradas y extras de nail art.", "Asigna duración y especialista a cada técnica.", "Recupera citas recurrentes incluso fuera de horario."],
    sectionTitle: "Atiende cada llamada. Sin parar el pincel.",
    sectionDescription: "Atiende consultas rápidas y reserva servicios recurrentes mientras el equipo sigue trabajando.",
    highlights: [
      { title: "Servicio exacto", description: "Distingue semipermanente, gel, retirada, pedicura y extras.", result: "Tiempo suficiente en agenda" },
      { title: "Precios claros", description: "Responde importes y condiciones desde tu catálogo real.", result: "Menos preguntas repetidas" },
      { title: "Alta recurrencia", description: "Facilita la próxima cita de clientes habituales.", result: "Más repetición mensual" },
    ],
    benefitsTitle: "Una agenda precisa para servicios llenos de detalles.",
    benefitsDescription: "Cada extra cambia el tiempo de la cita. Alhabla pregunta lo necesario antes de confirmar.",
    benefits: [
      { title: "Manicura", description: "Reserva clásica, semipermanente, gel o acrílico.", result: "El hueco correcto para cada técnica" },
      { title: "Retiradas y retoques", description: "Pregunta si hay retirada para reservar el servicio que toca, con la duración que le hayas dado.", result: "Menos retrasos en cadena" },
      { title: "Nail art", description: "Reserva el diseño con su tiempo; lo que describe la clienta queda en la transcripción.", result: "Citas mejor preparadas" },
    ],
    teamRouting: {
      badge: "Para Inicio, Pro y Scale",
      title: "El nail art, con la técnica que lo borda.",
      description: "Para cada técnica señalas qué servicios borda, cuáles hace sin problema y cuáles prefieres que le reserven solo si una clienta la pide. La recepcionista asigna las citas con ese mapa en la cabeza: el acrílico esculpido va a quien mejor lo trabaja, aunque la clienta no sepa su nombre.",
      rules: [
        { title: "Sin nombre, a la especialista", description: "Unas uñas esculpidas de acrílico caen en la técnica que marcaste como especialista en acrílico." },
        { title: "La clienta que pide a Laura", description: "Si una habitual pide a su técnica, la cita es con Laura y no se le pregunta nada más." },
        { title: "Lo que reservas solo cuando lo piden", description: "Sugiere una sola vez a la técnica más indicada que esté libre; si la clienta prefiere a otra, reserva con la que eligió." },
      ],
      tieBreak: "Entre dos técnicas con el mismo nivel, gana la que tiene la jornada más vacía.",
    },
    guia: {
      etiqueta: "Guía para salones de uñas",
      titulo: "Las llamadas de un salón de uñas y lo que hace con ellas tu recepcionista de IA",
      entradilla: "En un salón de uñas muchas clientas vuelven cada pocas semanas, y casi cada cita depende de un detalle: si hay retirada, si es gel o semipermanente, si lleva decoración. Estas son las seis llamadas que más vas a recibir y cómo las resuelve la recepcionista, para que sepas qué servicios dar de alta y con qué tiempo.",
      llamadasTitulo: "Seis llamadas que se repiten en cualquier salón de uñas",
      llamadas: [
        {
          titulo: "El relleno de siempre",
          pide: "«Me toca relleno, ¿tenéis hueco el jueves?»",
          hace: "Si ya reservó por Alhabla, la saluda por su nombre y le pregunta si repite el último servicio. Reserva el relleno con su duración y, si la clienta nombra a su técnica, con ella.",
        },
        {
          titulo: "Semipermanente de otro salón",
          pide: "«Llevo semi de otro sitio y me la quiero cambiar.»",
          hace: "Pregunta si es una aplicación nueva, un mantenimiento o una retirada, porque cambia el tiempo. Si tienes «retirada y semi» como un servicio con su duración, reserva ese; si son dos servicios, los pone en la misma cita y suma los tiempos.",
        },
        {
          titulo: "Manos y pies",
          pide: "«Quiero manicura y pedicura el sábado.»",
          hace: "Reserva los dos servicios en una sola cita y busca un hueco donde quepan seguidos con una técnica libre. Si el sábado no hay tanto tiempo, ofrece el hueco más cercano en el que sí caben las dos cosas.",
        },
        {
          titulo: "El diseño de una foto",
          pide: "«Quiero unas uñas como las de una foto que he visto, con dibujos.»",
          hace: "Reserva el servicio de nail art que tengas dado de alta, con su tiempo. Lo que describe la clienta no se guarda en la cita, porque no hay campo de notas, pero queda en la transcripción de la llamada, que puedes leer en el panel antes de que llegue.",
        },
        {
          titulo: "¿Cuánto cuesta el gel?",
          pide: "«¿Qué precio tiene el gel? ¿Y si ya llevo puesto?»",
          hace: "Da el precio de cada servicio tal como lo tienes en el catálogo y, si lo has escrito, qué extras lo cambian. Si la clienta solo quería saberlo, no la empuja a reservar.",
        },
        {
          titulo: "Cambiar el día",
          pide: "«Me ha surgido algo, ¿puedo pasar la del martes al viernes?»",
          hace: "Si llama desde su número, localiza la cita, comprueba el viernes y la cambia. Si el viernes está completo, la clienta puede pedir que le avisen por WhatsApp si se libera la hora que quería.",
        },
      ],
      serviciosTitulo: "Técnicas de uñas y tiempos habituales",
      serviciosEntradilla: "Cada técnica trabaja a su velocidad y la recepcionista reserva el tiempo que tú le digas. Estos son tiempos habituales para empezar, nada más: configúralas con las tuyas, y separa la retirada cuando cambie mucho la duración.",
      servicios: [
        { servicio: "Manicura clásica", duracion: "30 min", quien: "Cualquier técnica" },
        { servicio: "Manicura semipermanente", duracion: "45–60 min", quien: "Cualquier técnica" },
        { servicio: "Retirada y semipermanente", duracion: "60–75 min", quien: "Cualquier técnica" },
        { servicio: "Uñas de gel, aplicación nueva", duracion: "90 min", quien: "Especialista en gel" },
        { servicio: "Relleno de gel o acrílico", duracion: "60–75 min", quien: "La técnica habitual de la clienta" },
        { servicio: "Uñas esculpidas de acrílico", duracion: "90–120 min", quien: "Especialista en acrílico" },
        { servicio: "Pedicura spa", duracion: "60 min", quien: "Quien lleve los pies" },
        { servicio: "Nail art", duracion: "15–45 min", quien: "La técnica de diseño" },
      ],
      serviciosNota: "Tiempos habituales, no oficiales. Si entre clienta y clienta limpias la mesa y desinfectas, suma esos minutos al servicio: la recepcionista encadena las citas sin margen.",
      repartoTitulo: "El reparto por especialidad, en la mesa de uñas",
      reparto: [
        "En un salón de uñas la diferencia entre técnicas está en el acrílico, el gel esculpido y el diseño a mano alzada. Marca como especialista a quien mejor los domina y deja la manicura, la semipermanente y las retiradas en «lo hace» para todo el equipo: así una clienta sin preferencia siempre encuentra hueco.",
        "Las clientas de uñas suelen ser fieles a su técnica, y la recepcionista lo respeta: si pide a alguien por su nombre, reserva con esa persona. Para quien está aprendiendo esculpidas, «solo si lo piden» evita que le caiga una cita de dos horas sin que tú lo decidas; si una clienta la pide expresamente, se sugiere una vez a la especialista y, si insiste, se reserva con quien pidió.",
        "Ojo con las citas de varios servicios: para que una «manicura y pedicura» vaya a la especialista, tiene que estar marcada en los dos. Si solo lo está en manicura, la cita puede ir a cualquiera del equipo que haga ambas cosas.",
      ],
      horasTitulo: "Cuándo se llena la agenda de un salón de uñas",
      horas: [
        "Las semanas antes de fiestas, bodas y vacaciones suelen llenar la agenda de golpe, y los rellenos marcan un ritmo propio: cada clienta vuelve cuando le toca. Lo que más se pierde no es la llamada suelta, sino la clienta que, al no encontrarte, prueba otro salón y puede quedarse allí.",
        "No te damos porcentajes porque no hay un dato público que sirva para tu salón. El historial de llamadas del panel te enseña el tuyo: la hora de cada llamada, cuánto duró y si acabó en cita.",
        "Es habitual que las clientas llamen en su pausa del trabajo o al salir, cuando tú tienes las manos de otra encima de la mesa. Esas son justo las llamadas que coge la recepcionista.",
      ],
      erroresTitulo: "Errores típicos al poner una recepcionista de IA en un salón de uñas",
      errores: [
        { titulo: "No separar la retirada", texto: "Quitar un acrílico o un gel puede añadir bastante tiempo. Si no existe como servicio, o como parte de un servicio con su duración, la recepcionista reservará la aplicación sola y te quedarás corta." },
        { titulo: "Esperar notas en la cita", texto: "La reserva guarda nombre, teléfono, servicio y técnica. Si la clienta describe el diseño, eso queda en la transcripción, no en la cita: léela en el panel antes de prepararle la mesa." },
        { titulo: "Precios de diseño sin explicar", texto: "Si el nail art se cobra por uña o según el dibujo, déjalo dicho en la información del negocio. Sin eso, la recepcionista solo puede dar el precio que tenga el servicio o tomar el recado." },
        { titulo: "Citas de Instagram fuera del calendario", texto: "Si cierras citas por mensaje directo y no las pasas al calendario conectado, la recepcionista no las ve. Pásalas al calendario o díselas al Gestor por WhatsApp." },
        { titulo: "El tiempo de la técnica más rápida", texto: "La duración va por servicio, no por persona. Si una técnica con años de oficio hace un relleno en mucho menos tiempo que quien empieza, pon el tiempo de quien va más despacio, o la agenda se retrasará justo con ella." },
        { titulo: "Estrenarla sin comprobar el desvío", texto: "Con el botón «Comprobar desvío» del panel, Alhabla llama a tu línea y te dice si la llamada vuelve a entrar. Puedes repetirlo hasta tres veces por hora, así que pruébalo con calma antes del primer día." },
      ],
      enlacesTitulo: "Para que tu salón empiece bien",
      enlaces: [
        { href: "/desvio-de-llamadas", titulo: "Desvía las llamadas a la recepcionista", texto: "Cómo activar en tu operador el desvío de lo que no coges con las manos ocupadas." },
        { href: "/integraciones", titulo: "Elige dónde entran las citas", texto: "Conecta Google, Outlook o iCloud y mira qué citas respeta la recepcionista." },
        { href: "/herramientas/plantillas-recordatorio-de-cita", titulo: "Recordatorios para el relleno", texto: "Textos de WhatsApp y SMS para recordar la próxima cita, listos para copiar." },
        { href: "/comparativa/recepcionista-de-ia-vs-recepcionista-humana", titulo: "IA frente a recepcionista contratada", texto: "Qué cuesta cada una para un salón pequeño y qué hace mejor cada una." },
      ],
    },
    ownerAssistant: {
      badge: "Lo tienes en todos los planes",
      title: "Y cuando algo cambia en el salón, se lo dices por WhatsApp.",
      description: "Con las manos en una uña no se abre un panel; dos líneas de WhatsApp en la pausa, sí. Al Gestor le cuentas lo que ha cambiado en el salón y te lo deja preparado: solo falta tu visto bueno.",
      examples: [
        { title: "Si una técnica no viene", description: "«Laura tiene hoy el día libre»: al confirmar, deja de recibir citas y te dice cuántas manicuras tenía. Le dices a quién pasarlas, confirmas cada cambio y te pregunta si avisa a cada clienta por WhatsApp." },
        { title: "Lo que la recepcionista no supo contestar", description: "«¿Qué te han preguntado hoy que no supieras?» y te resume las dudas; si le contestas «sí, hacemos press-on», te propone enseñárselo para la próxima llamada." },
        { title: "Un servicio nuevo en la carta", description: "«Añade retirada de acrílico, 20 minutos, 10 €» y queda en tu catálogo; desde la siguiente llamada la recepcionista la ofrece y la reserva con su tiempo." },
      ],
      closing: "Tu agenda no se mueve hasta que tocas «Confirmar».",
    },
    ciudades: {
      titulo: "En una gran ciudad o en una calle de pueblo, la clienta llama igual.",
      intro: "Tu recepcionista de IA trabaja igual en cualquier sitio: la clienta marca el teléfono de siempre, la llamada que no puedes coger pasa al número de Alhabla por el desvío de tu operador y la manicura entra en el calendario que ya tienes.",
      idiomasTitulo: "Con la clienta extranjera, en su idioma.",
      idiomasTexto: "Si te llama una clienta que no habla castellano, la recepcionista le contesta en su idioma: son ocho en cualquier plan. Si tu salón está en Cataluña o Baleares, también en catalán desde el primer día; en Euskadi en euskera y en Galicia en gallego.",
      enlace: "Más sobre catalán, euskera y gallego",
    },
    whatsappClientes: {
      titulo: "Tus clientas, al día por WhatsApp",
      filas: [
        "Al colgar le llega la confirmación: «Semipermanente en manos, martes 17:30, con Laura».",
        "En Pro y Scale, además, un recordatorio antes de la cita, para que no se le olvide el relleno.",
        "Para cambiar o anular, le basta con responder al mensaje; no tiene que llamarte en mitad de otra manicura.",
        "Si la tarde que quería está llena, pide que le avisen si se libera y le llega un WhatsApp; y si ya es clienta tuya, también puede pedir o cambiar cita escribiendo a la recepcionista.",
      ],
    },
    calculator: {
      badge: "Calcula citas recurrentes perdidas",
      title: "¿Cuánto pierde tu salón cuando no responde?",
      description: "Mide el impacto mensual de manicuras y pedicuras que terminan reservándose en otro sitio.",
      ticketLabel: "Ticket medio por servicio",
      appointmentsLabel: "Citas perdidas cada semana",
      initialTicket: 30,
      estimateTitle: "Calcula lo que se te escapa",
      estimateHint: "No hace falta precisión: cuenta las clientas que no pudieron reservar en una semana cualquiera.",
      footnote: "Orientativo, con cuatro semanas al mes. No incluye los rellenos que esa clienta habría vuelto a hacerse ni los extras de decoración.",
    },
    planesTitulo: "Tres planes para tu salón de uñas.",
    faqsTitulo: "Preguntas de los salones de uñas.",
    faqs: [
      { question: "¿Necesito conectar un calendario?", answer: "No. Si llevas la agenda en Google Calendar, Outlook o iCloud, conéctalo y las citas entran ahí. Si no usas ninguno, elige la agenda de Alhabla: la recepcionista reserva en ella, tú la ves en el panel, apuntas lo que te entra por otros canales y te la suscribes en el calendario del móvil con un enlace de solo lectura." },
      { question: "¿Pregunta si la clienta trae algo puesto?", answer: "Sí: pregunta si es una aplicación nueva, un mantenimiento o una retirada cuando eso cambia el servicio. Si el servicio ya está claro, no repasa todos los acabados posibles." },
      { question: "¿Diferencia una manicura sencilla de un nail art?", answer: "Sí, si los tienes como servicios distintos, cada uno con su tiempo. La recepcionista reserva el que pide la clienta y no inventa técnicas que no estén en tu carta." },
      { question: "¿Puedo elegir quién se lleva el acrílico?", answer: "Sí. En la ficha de cada técnica marcas si es especialista, si lo hace o si prefieres reservarle ese servicio solo cuando la piden. La recepcionista reparte las citas siguiendo esas marcas y nunca le cuenta a la clienta cómo las tienes." },
      { question: "¿Puede dejar la próxima cita puesta?", answer: "Si la clienta llama para pedirla, sí, para el día que quiera. Si prefieres apuntarla tú al cobrar, escríbele al Gestor «apunta a Paula el martes 18 a las 5, relleno» y queda lista para confirmar." },
      { question: "¿Da el precio de cada técnica?", answer: "Da el que tengas en tu catálogo. Si un extra cambia el precio (retirada, decoración, largo), escríbelo en la información del negocio y lo explicará antes de reservar." },
      { question: "Recibo reservas por Instagram, ¿pasa algo?", answer: "Puedes seguir igual. La recepcionista no ve tus mensajes de Instagram, pero sí el calendario que conectas: si apuntas ahí lo que cierras por mensaje, esas horas no se ofrecen por teléfono." },
      { question: "¿Puede atender en catalán?", answer: "Sí, si tu salón está en Cataluña o Baleares: lo entiende y contesta en catalán desde la primera llamada, igual que el euskera en Euskadi y el gallego en Galicia. En toda España habla además castellano y otros siete idiomas." },
      { question: "¿Qué pasa si una clienta no se presenta?", answer: "Alhabla no cobra señales ni penaliza ausencias. Lo que ayuda es el recordatorio por WhatsApp de los planes Pro y Scale, con el que la clienta puede cambiar o anular respondiendo, y tu política de cancelación: si la escribes en la información del negocio, la recepcionista la explica por teléfono." },
      { question: "¿Puede reservar manos y pies a la vez con dos técnicas?", answer: "Una cita va con una sola técnica, y cada llamada deja una sola cita. Si en tu salón manos y pies se hacen a la vez con dos personas, la recepcionista reserva una de las dos citas y la otra se pide aparte o la apuntas tú con el Gestor." },
    ],
    closingTitle: "Que tus clientas reserven aunque estés limando.",
    sectorData: {
      eyebrow: "26.000 centros compiten por tu clientela",
      title: "En tu calle hay más salones de uñas que farmacias",
      description: "El sector mueve más de 600 millones de euros al año en España, pero la competencia es feroz. Si no contestas, el cliente tiene tres opciones más a una cuadra.",
      stats: [
        { value: "26.000", label: "centros en España ofrecen servicios de uñas", source: "STANPA / El Periódico" },
        { value: "600M\u20AC", label: "de facturación anual del sector", source: "STANPA / El Periódico" },
        { value: "85%", label: "de quienes no hablan con una persona real no vuelve a llamar", source: "safina.ai" },
      ],
      painPoint: "La mayoría de salones de uñas son microempresas de 1-2 personas. No puedes dejar la manicura a medias para coger el teléfono. Y contratar una recepcionista cuesta más de 1.100 \u20AC/mes.",
    },
  },
  barberia: {
    slug: "barberia",
    name: "Barberías",
    eyebrow: "150€ de pérdida media por cada llamada no atendida",
    title: "IA para barberías que contesta y reserva citas",
    description: "Inteligencia artificial que coge el teléfono de tu barbería con todas las sillas ocupadas y reserva corte, barba o pack con el barbero que te piden.",
    primaryKeyword: "IA para barberías",
    keywords: [
      "IA para barberías",
      "recepcionista de IA para barberías",
      "inteligencia artificial para barberías",
      "asistente telefónico con IA para barberías",
      "contestador automático para barbería",
      "atender llamadas en barbería",
      "reservas de barbería por teléfono",
      "citas de barbería por WhatsApp",
      "reservas de corte y barba",
    ],
    accent: NICHE_ACCENTS.barberia,
    heroTitle: "Recepcionista de IA para barberías que contesta con las sillas llenas",
    heroHighlight: "que contesta con las sillas llenas",
    heroDescription: "Alhabla atiende llamadas, resuelve dudas sobre servicios y agenda citas 24/7 — incluso con todas las sillas ocupadas.",
    demoTitle: "Así reserva una cita de barbería",
    demoSteps: ["Configura corte, barba, afeitado y packs.", "Asigna barberos, tiempos y horarios.", "Atiende llamadas rápidas durante las horas punta."],
    sectionTitle: "Atiende cada llamada. Sin detener una navaja.",
    sectionDescription: "Convierte consultas rápidas en citas confirmadas sin detener un corte ni perder ritmo en el local.",
    highlights: [
      { title: "Citas rápidas", description: "Responde y reserva en pocos pasos.", result: "Menos fricción para clientes" },
      { title: "Barbero preferido", description: "Si piden a su barbero por su nombre, reserva con él.", result: "Más fidelidad y recurrencia" },
      { title: "Packs bien agendados", description: "Reserva corte y barba con su duración completa.", result: "Sin retrasos entre clientes" },
    ],
    benefitsTitle: "Tu barbería sigue atendiendo incluso con todas las sillas ocupadas.",
    benefitsDescription: "Una recepción directa y rápida que entiende servicios, preferencias y franjas de mayor demanda.",
    benefits: [
      { title: "Corte", description: "Encuentra hueco por barbero y duración.", result: "Reserva rápida y precisa" },
      { title: "Barba y afeitado", description: "Informa sobre opciones y añade el tiempo adecuado.", result: "Agenda sin improvisaciones" },
      { title: "Packs", description: "Combina servicios y confirma el importe orientativo.", result: "Mayor ticket por visita" },
    ],
    teamRouting: {
      badge: "Va en todos los planes",
      title: "Cada corte, con el barbero que tú elegirías.",
      description: "Para cada barbero señalas en qué servicios es especialista, cuáles hace y cuáles prefieres que le reserven solo cuando el cliente le pide a él. La recepcionista reparte las sillas con ese criterio, como harías tú desde el mostrador: el degradado difícil nunca queda al azar.",
      rules: [
        { title: "Cliente sin barbero fijo, al especialista", description: "Un degradado o un afeitado a navaja van a quien marcaste como el mejor en ese servicio." },
        { title: "El que pide a Luis, se sienta con Luis", description: "Un habitual dice el nombre de su barbero y la cita se hace con él, sin vueltas." },
        { title: "Lo que reservas solo bajo petición", description: "Propone una vez al barbero más indicado que tenga hueco; si el cliente insiste en el suyo, reserva con el que pidió." },
      ],
      tieBreak: "Si dos barberos están igual de preparados, la cita va al que tiene menos trabajo ese día.",
    },
    guia: {
      etiqueta: "Guía para barberías",
      titulo: "Las llamadas de una barbería, una a una, y cómo las resuelve la recepcionista de IA",
      entradilla: "En una barbería las llamadas son cortas y van al grano: hueco, barbero y hora. Por eso duele perderlas, porque nadie suelta la máquina para una conversación de un minuto. Estas son las seis que más se repiten y lo que hace la recepcionista en cada una.",
      llamadasTitulo: "Las seis llamadas que más entran en una barbería",
      llamadas: [
        {
          titulo: "Hueco para hoy",
          pide: "«¿Tenéis algo esta tarde para cortarme?»",
          hace: "Mira la agenda real de esa tarde y ofrece la primera hora en la que cabe el corte con un barbero libre. Nunca mete un cliente encima de otro: si a las siete solo quedan quince minutos y el corte dura treinta, ese hueco ni lo menciona.",
        },
        {
          titulo: "El fijo con su barbero",
          pide: "«Ponme con Luis el sábado, lo de siempre.»",
          hace: "Si ya reservó antes por Alhabla, le saluda por su nombre y le pregunta si repite el mismo servicio. Reserva con Luis; si Luis tiene el sábado lleno, le ofrece otro día con él o esa hora con otro barbero, y elige el cliente.",
        },
        {
          titulo: "Corte y barba",
          pide: "«Quiero corte y arreglo de barba.»",
          hace: "Aclara solo lo que hace falta: si es corte, barba o las dos cosas. Con las dos, reserva una cita con ambos servicios y sus tiempos sumados, para que el siguiente cliente no espere de pie.",
        },
        {
          titulo: "El estilo que no sabe explicar",
          pide: "«Quiero un degradado como el de un futbolista, ¿me lo hacéis?»",
          hace: "Pregunta una sola preferencia útil, como si quiere mantener largo arriba o un degradado bajo, y reserva el servicio. No promete que quedará igual que en la foto: eso lo ve el barbero en la silla.",
        },
        {
          titulo: "Padre e hijo",
          pide: "«Somos dos, mi hijo y yo, ¿podemos ir juntos?»",
          hace: "Cada llamada deja una sola cita, para una persona: la del hijo se pide en otra llamada o la apuntas tú escribiendo al Gestor. Si haces corte infantil, dalo de alta con su propia duración para que esa segunda cita no ocupe más de la cuenta.",
        },
        {
          titulo: "¿Abrís el lunes?",
          pide: "«¿Abrís el lunes? ¿Hasta qué hora?»",
          hace: "Responde con tu horario y, si ese lunes lo has cerrado, no ofrece hora ese día. Si quien llama solo quería saber eso, la llamada acaba ahí, sin forzar una reserva.",
        },
      ],
      serviciosTitulo: "Servicios de barbería y tiempos de referencia",
      serviciosEntradilla: "Cada barbería trabaja a su ritmo y la recepcionista reserva exactamente lo que tú indiques. Estos tiempos son solo una referencia para empezar: configúralas con las tuyas y sepáralas cuando un servicio dure distinto según el barbero.",
      servicios: [
        { servicio: "Corte clásico", duracion: "30 min", quien: "Cualquier barbero" },
        { servicio: "Corte degradado", duracion: "30–45 min", quien: "Especialista en degradados" },
        { servicio: "Arreglo de barba", duracion: "20 min", quien: "Cualquier barbero" },
        { servicio: "Afeitado a navaja con toalla caliente", duracion: "30 min", quien: "Quien domine la navaja" },
        { servicio: "Corte y barba", duracion: "45–60 min", quien: "El barbero del cliente" },
        { servicio: "Corte infantil", duracion: "20 min", quien: "Quien tenga mano con los niños" },
        { servicio: "Diseño o perfilado con líneas", duracion: "15 min", quien: "El barbero más detallista" },
        { servicio: "Tinte de barba", duracion: "20–30 min", quien: "Quien trabaje el color" },
      ],
      serviciosNota: "Tiempos de referencia, no una regla. Si necesitas unos minutos para barrer o cobrar entre cliente y cliente, súmalos a la duración de cada servicio: la recepcionista no deja margen por su cuenta.",
      repartoTitulo: "El reparto por especialidad, entre sillas",
      reparto: [
        "En una barbería casi todos cortan de todo, y lo que cambia es la mano para ciertos trabajos: el degradado muy marcado, la navaja, el diseño con líneas. Marca como especialista a quien mejor los hace y deja al resto en «lo hace»: cuando el especialista esté ocupado, el cliente sin preferencia no se queda sin hora.",
        "Si tienes un aprendiz, «solo si lo piden» es la forma de que no le caigan afeitados a navaja por sorpresa mientras aprende. No es un muro: si un cliente le pide a él por su nombre, la recepcionista propone una vez al barbero más indicado y, si el cliente insiste, reserva con el aprendiz. Al cliente nunca le cuenta cómo lo tienes marcado.",
        "El desempate también cuenta en un local de sillas iguales: entre dos barberos del mismo nivel, la cita va a quien menos citas tiene ese día, y el trabajo se reparte sin que tengas que vigilarlo.",
      ],
      horasTitulo: "Cuándo te llaman a ti",
      horas: [
        "Muchas barberías se llenan a última hora de la tarde, cuando sale la gente del trabajo, y los sábados por la mañana: justo cuando todas las sillas están ocupadas y nadie puede coger el teléfono. Pero cada local es distinto, y el de un barrio de oficinas no tiene el ritmo de uno en una zona de ocio.",
        "Para saber el tuyo, mira el historial de llamadas del panel tras las primeras semanas: verás a qué hora llama cada cliente y si acabó en cita. Con eso decides si desvías solo cuando no contestas o también cuando la línea está ocupada.",
        "Y hay una franja que hoy no cubre nadie: el domingo por la noche, cuando el cliente se mira al espejo y decide que esta semana toca pasar por la barbería.",
      ],
      erroresTitulo: "Errores típicos al poner una recepcionista de IA en una barbería",
      errores: [
        { titulo: "Un solo «corte» para todo", texto: "Si el degradado dura cuarenta minutos y el corte clásico veinte, dalos de alta por separado. Con un único servicio, la recepcionista reserva el mismo tiempo para todo y la tarde se descuadra." },
        { titulo: "Contar con un margen entre clientes", texto: "La recepcionista reserva justo la duración del servicio, sin minutos extra entre uno y otro. Si necesitas tiempo para barrer o cobrar, inclúyelo en la duración de cada servicio." },
        { titulo: "Olvidar las citas que das en la silla", texto: "Si al cobrar apuntas la siguiente cita en una libreta, la recepcionista no la ve y puede dar esa hora. Apúntala en el calendario conectado o escríbesela al Gestor: «apunta a Javier el viernes a las 7, corte»." },
        { titulo: "Esperar que llame para llenar huecos", texto: "Alhabla contesta, no llama: no hace llamadas salientes para ofrecer horas ni promociones. Lo que sí manda es un WhatsApp a quien pidió que le avisaran si se liberaba su hora." },
        { titulo: "Prometer por teléfono lo que decide la silla", texto: "Si escribes en la información del negocio que «hacemos cualquier diseño», la recepcionista lo repetirá tal cual. Cuenta lo que hacéis de verdad y en cuánto tiempo, y deja que sea el barbero quien decida en la silla qué cabe en la cita reservada." },
        { titulo: "No probar el desvío", texto: "El desvío se activa en tu operador. Antes del primer sábado, usa «Comprobar desvío» en el panel: Alhabla llama a tu línea y te dice si funciona o por qué no (la cogiste tú, comunicaba o no hay desvío)." },
      ],
      enlacesTitulo: "Para ponerla en marcha en tu barbería",
      enlaces: [
        { href: "/desvio-de-llamadas", titulo: "Activa el desvío en tu operador", texto: "Paso a paso, operador por operador, para que la llamada que no coges en hora punta salte a la recepcionista." },
        { href: "/integraciones", titulo: "El calendario de tu barbería", texto: "Qué calendario conectar y cómo respeta Alhabla las citas que ya tienes apuntadas." },
        { href: "/herramientas/plantillas-recordatorio-de-cita", titulo: "Mensajes para recordar el corte", texto: "Plantillas de confirmación y recordatorio listas para copiar y mandar desde tu móvil." },
        { href: "/comparativa/recepcionista-de-ia-vs-recepcionista-humana", titulo: "Recepcionista de IA o alguien en el mostrador", texto: "Cuánto cuesta contratar a una persona y qué cubre cada opción." },
      ],
    },
    ownerAssistant: {
      badge: "Sin coste extra en cualquier plan",
      title: "Y cuando algo cambia en la barbería, se lo dices por WhatsApp.",
      description: "Entre corte y corte no hay tiempo para abrir un panel. Con el Gestor escribes por WhatsApp lo que ha cambiado, como se lo dirías a un compañero, y te devuelve el cambio preparado para que lo apruebes.",
      examples: [
        { title: "Si falta un barbero", description: "«Hoy Luis no viene»: al confirmar, deja de recibir citas nuevas y te dice cuántos cortes tenía. Le dices a qué barbero pasar cada uno, confirmas el cambio y te pregunta si avisa al cliente por WhatsApp." },
        { title: "¿Tengo hueco?", description: "«¿Hay hueco mañana a las 6 para un corte y barba?» y te lo dice mirando tu agenda real o te da la hora libre más cercana; si el cliente te lo pide en la silla, «apúntale a Javier» y queda listo para confirmar." },
        { title: "Un precio o un cierre nuevo", description: "«El corte y barba pasa a 22 €» o «el lunes festivo cerramos»: cambia en tu catálogo o queda cerrado en la agenda, y la recepcionista deja de ofrecer esa hora." },
      ],
      closing: "Lo que escribes no toca la agenda hasta que tú pulsas «Confirmar».",
    },
    ciudades: {
      titulo: "Barbería de barrio o de centro comercial, el mismo teléfono.",
      intro: "La recepcionista de IA no depende de dónde esté tu local: el cliente marca el número de la barbería, lo que no coges salta con el desvío de tu operador y el corte queda apuntado en tu calendario de Google, de Outlook o de Apple.",
      idiomasTitulo: "Y al cliente de fuera le contesta en su idioma.",
      idiomasTexto: "En una zona turística puede llamarte cualquiera. La recepcionista habla ocho idiomas en cualquier plan y pasa al del cliente en cuanto lo oye; en Cataluña y Baleares suma el catalán, en Euskadi el euskera y en Galicia el gallego.",
      enlace: "Cómo atiende en las lenguas cooficiales",
    },
    whatsappClientes: {
      titulo: "Y tu cliente lo recibe todo en el móvil",
      filas: [
        "La confirmación al colgar, con el servicio, la hora y el barbero que le toca: «Corte y barba, viernes 18:00, con Luis».",
        "Con Pro o Scale, también el recordatorio antes del corte, para que no se le pase.",
        "Si le surge algo, responde al mensaje y cambia o anula su hora sin llamar.",
        "Si el sábado está lleno, puede apuntarse para que le avisen por WhatsApp si se libera su hora; si ya ha reservado antes, también puede escribir a la recepcionista para buscar otra.",
      ],
    },
    calculator: {
      badge: "Calcula cortes que se escapan",
      title: "¿Cuánto pierde tu barbería en horas punta?",
      description: "Estima el valor de cortes y packs que no se reservan cuando nadie puede atender el teléfono.",
      ticketLabel: "Ticket medio por visita",
      appointmentsLabel: "Citas perdidas cada semana",
      initialTicket: 25,
      estimateTitle: "Haz la cuenta de tus sillas",
      estimateHint: "Vale una aproximación: piensa en los clientes que llamaron en hora punta y acabaron cortándose en otro sitio.",
      footnote: "Estimación con cuatro semanas al mes. No cuenta que un cliente fijo vuelve cada pocas semanas ni lo que vendes en productos.",
    },
    planesTitulo: "Lo que cuesta para tu barbería, mes a mes.",
    faqsTitulo: "Dudas habituales de las barberías.",
    faqs: [
      { question: "¿Necesito conectar un calendario?", answer: "No. Si llevas la agenda en Google Calendar, Outlook o iCloud, conéctalo y las citas entran ahí. Si no usas ninguno, elige la agenda de Alhabla: la recepcionista reserva en ella, tú la ves en el panel, apuntas lo que te entra por otros canales y te la suscribes en el calendario del móvil con un enlace de solo lectura." },
      { question: "¿Reserva con el barbero que pide el cliente?", answer: "Sí. Si el cliente dice un nombre, la cita va con ese barbero. Si él no tiene hueco, le ofrece otra hora con él o la misma hora con otro, y decide el cliente. Si no pide a nadie, va a tu especialista en ese servicio." },
      { question: "¿Bloquea más tiempo para corte y barba que para un corte?", answer: "Bloquea la suma de lo que dure cada servicio en tu catálogo. Si el corte son 30 minutos y la barba 20, un corte con barba reservado como dos servicios ocupa 50; si lo tienes como pack con su propia duración, ocupa la del pack." },
      { question: "¿Vale para un cliente que quiere cortarse hoy mismo?", answer: "Sí. Mira los huecos que quedan hoy en tu calendario y ofrece el primero en el que cabe el servicio entero." },
      { question: "¿Coge el teléfono con la barbería cerrada?", answer: "Sí, a cualquier hora: si el desvío está activo, la llamada de las once de la noche o la del domingo también la atiende, y el cliente sale con su hora reservada." },
      { question: "¿Me puede pasar al móvil a un cliente que quiere hablar conmigo?", answer: "Si publicas el número de Alhabla como el principal de la barbería, sí: en «Cuándo pasarme llamadas» eliges nunca, solo si el cliente lo pide o siempre. Si desvías desde tu propio número, la recepcionista toma el recado y te llega por WhatsApp." },
      { question: "¿Respeta las citas que me entran por otra app?", answer: "Si esa app las copia en el calendario que conectas (de Google, de Outlook o de Apple), sí: antes de ofrecer una hora, la recepcionista lo mira y no da lo que ya está ocupado. Alhabla no se conecta directamente con otras apps de reservas." },
      { question: "¿Qué dice si le preguntan precios?", answer: "El precio que tenga cada servicio en tu catálogo. Si cambias una tarifa con el Gestor por WhatsApp, desde la siguiente llamada ya da la nueva." },
      { question: "¿Atiende a clientes que no hablan castellano?", answer: "Sí, en cualquier plan: entiende y contesta en inglés, francés, alemán, italiano y otros tres idiomas, y cambia al del cliente en cuanto lo nota. En Cataluña y Baleares también habla catalán; en Euskadi, euskera; en Galicia, gallego." },
      { question: "¿Me entero de cada cita nueva?", answer: "Sí, si conectas tu WhatsApp: te llega un aviso con cada reserva y cada recado. En el panel tienes además la llamada transcrita y, si el cliente dio permiso, la grabación." },
    ],
    closingTitle: "Que la silla libre de las seis se llene aunque estés con la navaja.",
    sectorData: {
      eyebrow: "El problema real del sector",
      title: "Cada llamada perdida es un cliente que no vuelve",
      description: "Los datos del sector de servicios personales en España revelan una realidad difícil de ignorar: la mayoría de las llamadas que no contestas desaparecen para siempre.",
      stats: [
        { value: "60%", label: "de los clientes que no contactan no vuelve a llamar", source: "heilo.io" },
        { value: "42%", label: "de las reservas en servicios personales se hace por teléfono", source: "heilo.io" },
        { value: "150\u20AC", label: "de pérdida media por cada llamada no atendida", source: "gestiondellamadas.com" },
      ],
      quotes: [
        { text: "Antes el estar pendiente todo el rato al teléfono me limitaba muchos cortes al día, ahora puedo cortar a más gente y despreocuparme del móvil", source: "Excelsior Barber Studio, Palma — Diario de Mallorca" },
      ],
    },
  },
  fisioterapia: {
    slug: "fisioterapia",
    name: "Clínicas y consultas de fisioterapia",
    eyebrow: "Un problema que solo entiende quien lo vive",
    title: "Recepcionista de IA para clínicas de fisioterapia",
    description: "Atiende las llamadas de tu clínica mientras tratas: organiza primeras visitas y seguimientos con el fisioterapeuta adecuado y deriva lo clínico.",
    primaryKeyword: "recepcionista de IA para fisioterapia",
    keywords: [
      "recepcionista de IA para fisioterapia",
      "IA para fisioterapia",
      "IA para clínicas de fisioterapia",
      "IA para fisioterapeutas",
      "inteligencia artificial para fisioterapia",
      "asistente telefónico con IA para fisioterapia",
      "reservas para clínica de fisioterapia",
      "citas de fisioterapia por WhatsApp",
      "atención telefónica para fisioterapeutas",
    ],
    accent: NICHE_ACCENTS.fisioterapia,
    heroTitle: "Recepcionista de IA para fisioterapia que contesta mientras tratas",
    heroHighlight: "que contesta mientras tratas",
    heroDescription: "Alhabla atiende llamadas, recoge el motivo de consulta y agenda citas 24/7 — incluso mientras tratas a un paciente.",
    demoTitle: "Así gestiona una cita de fisioterapia",
    demoSteps: [
      "Configura primeras visitas, seguimientos y especialidades.",
      "Define qué consultas deben derivarse al fisioterapeuta.",
      "Conecta profesionales, duración de sesión y calendario.",
    ],
    sectionTitle: "Atiende cada llamada. Sin interrumpir la sesión.",
    sectionDescription: "El teléfono deja de interrumpir el tratamiento y sigue convirtiendo consultas en citas confirmadas durante todo el día.",
    highlights: [
      { title: "Sesiones sin interrupciones", description: "Atiende llamadas mientras estás tratando a un paciente.", result: "Más concentración en consulta" },
      { title: "Primera visita organizada", description: "Recoge el motivo general y reserva el tiempo adecuado sin realizar diagnósticos.", result: "Mejor contexto antes de recibir" },
      { title: "Seguimientos ágiles", description: "Facilita la reserva de próximas sesiones según disponibilidad real.", result: "Mayor continuidad terapéutica" },
    ],
    benefitsTitle: "Una recepción preparada para el ritmo de tu consulta.",
    benefitsDescription: "Resuelve preguntas administrativas, organiza la agenda y deriva al profesional cualquier consulta que requiera criterio clínico.",
    benefits: [
      { title: "Primera consulta", description: "Recoge datos básicos y el motivo general para reservar la duración correcta.", result: "Primera visita mejor preparada" },
      { title: "Sesiones de seguimiento", description: "Reserva con el fisioterapeuta habitual cuando el paciente lo pide por su nombre.", result: "Menos fricción entre sesiones" },
      { title: "Especialidades", description: "Lleva cada primera visita al fisioterapeuta que marques como especialista, sin emitir diagnósticos.", result: "Consultas correctamente derivadas" },
    ],
    teamRouting: {
      badge: "En cualquiera de los planes",
      title: "Cada paciente, con el fisioterapeuta que tú le asignarías.",
      description: "En la ficha de cada fisioterapeuta indicas, tipo de sesión a tipo de sesión, si es especialista, si la lleva o si prefieres que se la reserven solo cuando el paciente le pide. La recepcionista asigna con ese criterio y nada más: no pregunta por la lesión para decidir, porque el reparto lo has dejado tú resuelto en la ficha.",
      rules: [
        { title: "Sin preferencia, al especialista", description: "Una sesión de punción seca o de suelo pélvico va a quien marcaste como especialista en ese tipo de sesión." },
        { title: "El paciente que pide a Pablo", description: "Quien está en tratamiento y nombra a su fisioterapeuta sigue con él, sin más preguntas." },
        { title: "Lo que reservas solo si lo piden", description: "Propone una vez al fisioterapeuta más indicado con hueco; si el paciente prefiere a otro, reserva con el que pidió." },
      ],
      tieBreak: "Con dos fisioterapeutas igual de indicados, la sesión va a quien tenga menos pacientes ese día.",
    },
    guia: {
      etiqueta: "Guía para clínicas de fisioterapia",
      titulo: "Cómo atiende tu recepcionista de IA las llamadas de una clínica de fisioterapia",
      entradilla: "En una consulta de fisioterapia el teléfono suena mientras tienes las manos en un paciente, y casi siempre es por una de estas seis cosas. Aquí tienes qué hace la recepcionista en cada una y, sobre todo, lo que no hace: no pregunta síntomas, no diagnostica y no da pautas.",
      llamadasTitulo: "Las seis llamadas más habituales en una clínica",
      llamadas: [
        {
          titulo: "Primera visita",
          pide: "«Quería pedir cita, es la primera vez que voy.»",
          hace: "Pregunta el motivo solo en términos generales (primera visita, seguimiento, rehabilitación o descarga) para reservar el tipo de sesión y la duración correctos. No pide historial ni detalles médicos, y reserva con el fisioterapeuta que hayas marcado como especialista en primeras visitas.",
        },
        {
          titulo: "Seguimiento con su fisio",
          pide: "«Soy paciente de Irene, me toca la siguiente sesión.»",
          hace: "Si ya reservó por Alhabla, le saluda por su nombre y le pregunta si quiere repetir lo de la última vez, sin decir el servicio en voz alta. Reserva con Irene; si no tiene hueco, le ofrece otro día con ella u otro fisioterapeuta, y decide el paciente.",
        },
        {
          titulo: "El paciente que cuenta su lesión",
          pide: "«Me operaron de la rodilla hace un mes y me han mandado rehabilitación.»",
          hace: "No le pide más detalles ni opina sobre la lesión. Si tienes rehabilitación como tipo de sesión, la reserva con su duración. Lo que cuente queda en la transcripción de la llamada: es un dato de salud, trátalo con el mismo cuidado que el resto de datos de tus pacientes.",
        },
        {
          titulo: "Dolor fuerte o urgencia",
          pide: "«Me he hecho daño y no puedo moverme, ¿qué hago?»",
          hace: "No da pautas ni ejercicios. Si describe una urgencia clara, le indica que contacte con emergencias o con un profesional sanitario sin esperar; si lo que quiere es cita cuanto antes, le ofrece el primer hueco libre.",
        },
        {
          titulo: "La pregunta por la mutua",
          pide: "«¿Trabajáis con mi seguro médico?»",
          hace: "Responde con lo que hayas escrito en la información de la clínica: con qué seguros trabajáis, si hace falta autorización, cómo se paga. Si no lo has escrito, no lo supone: toma el recado para que el paciente tenga la respuesta por ti.",
        },
        {
          titulo: "Cambiar o anular una sesión",
          pide: "«No puedo ir el martes, ¿lo pasamos al jueves?»",
          hace: "Si llama desde el número con el que reservó, localiza su próxima sesión, comprueba el jueves y la cambia. También puede hacerlo respondiendo al WhatsApp de la confirmación, sin esperar a que salgas de la sala.",
        },
      ],
      serviciosTitulo: "Tipos de sesión y duraciones de partida",
      serviciosEntradilla: "Los tipos de sesión los defines tú, con su duración y su precio. No hace falta, ni conviene, crear servicios por diagnóstico: basta con tipos de sesión que el paciente pueda pedir sin explicar qué le pasa. Las duraciones son orientativas: configúralas con las tuyas.",
      servicios: [
        { servicio: "Primera visita con valoración", duracion: "45–60 min", quien: "Especialista en primeras visitas" },
        { servicio: "Sesión de seguimiento", duracion: "45 min", quien: "El fisioterapeuta del paciente" },
        { servicio: "Punción seca", duracion: "30 min", quien: "Quien tenga esa formación" },
        { servicio: "Rehabilitación postoperatoria", duracion: "45 min", quien: "Especialista en rehabilitación" },
        { servicio: "Masaje deportivo o descarga", duracion: "60 min", quien: "Cualquier fisioterapeuta" },
        { servicio: "Fisioterapia de suelo pélvico", duracion: "45–60 min", quien: "Especialista en suelo pélvico" },
        { servicio: "Fisioterapia pediátrica", duracion: "45 min", quien: "Especialista en pediatría" },
      ],
      serviciosNota: "Orientativo. Si entre paciente y paciente necesitas tiempo para cambiar la camilla o tomar notas, inclúyelo en la duración: la recepcionista reserva las sesiones una detrás de otra.",
      repartoTitulo: "El reparto por especialidad, en consulta",
      reparto: [
        "En fisioterapia el reparto tiene que ver con la formación de cada uno: punción seca, suelo pélvico, pediatría, deportiva. Marca como especialista a quien tiene esa formación y deja en «lo hace» las sesiones generales que cualquiera del equipo puede llevar. Así una primera visita sin preferencia va a quien mejor la puede valorar.",
        "La continuidad pesa más que en otros oficios: un paciente en tratamiento suele querer al mismo fisioterapeuta, y si lo nombra, la recepcionista reserva con él. Para quien acaba de incorporarse, «solo si lo piden» evita que le lleguen primeras visitas por defecto, sin cerrarle la puerta a un paciente que le pida expresamente.",
        "Lo importante es que el reparto no depende de que el paciente cuente qué le pasa. La recepcionista asigna por el tipo de sesión que se reserva y por lo que has marcado en cada ficha; el diagnóstico lo haces tú en la camilla.",
      ],
      horasTitulo: "Cuándo suena el teléfono de una clínica",
      horas: [
        "En muchas consultas los picos van con la vida de los pacientes: primera hora de la mañana y la salida del trabajo, cuando la gente puede escaparse, y el lunes, después de un fin de semana de deporte. Cada clínica es distinta y no hay un dato público que sirva para todas, así que no te damos porcentajes.",
        "Lo que sí puedes saber es lo tuyo: el historial del panel guarda la hora de cada llamada y si terminó en cita. En unas semanas verás cuántas entran a mitad de sesión, que son justo las que cubre la recepcionista.",
        "Piensa también en las sesiones largas: durante una hora de tratamiento el teléfono puede sonar varias veces, y dejar al paciente solo con los electrodos para cogerlo no es una opción.",
      ],
      erroresTitulo: "Errores típicos al poner una recepcionista de IA en una clínica de fisioterapia",
      errores: [
        { titulo: "Pedir más datos de la cuenta", texto: "No escribas en la información de la clínica que la recepcionista pregunte síntomas, medicación o antecedentes. No lo hará, y cuantos menos datos de salud pasen por el teléfono, mejor para ti y para el paciente." },
        { titulo: "Servicios con nombre de diagnóstico", texto: "Un servicio llamado «Hernia discal» obliga al paciente a decir su diagnóstico para reservar, y ese nombre aparece en su confirmación de WhatsApp. Usa tipos de sesión neutros: primera visita, seguimiento, rehabilitación." },
        { titulo: "La misma duración para la primera visita", texto: "La primera visita suele necesitar más tiempo que un seguimiento. Si las das de alta con la misma duración, la agenda se retrasa justo con los pacientes nuevos." },
        { titulo: "Dejar fuera las citas que das en consulta", texto: "Si al terminar una sesión apuntas la siguiente en papel, la recepcionista no la ve. Ponla en el calendario conectado o escríbesela al Gestor: «apunta a Teresa el lunes a las 9, seguimiento»." },
        { titulo: "No revisar el desvío", texto: "Antes de tu primer día con pacientes, usa «Comprobar desvío» en el panel: Alhabla llama a tu línea y te confirma si la llamada vuelve a entrar. Si a las 24 horas de tener el número aún no lo has comprobado, te lo recuerda por WhatsApp." },
      ],
      salud: {
        titulo: "Una cita de fisioterapia ya es un dato de salud",
        texto: "Para el RGPD, saber que alguien va a tu consulta ya revela algo de su salud. Por eso el saludo de la recepcionista nunca nombra el último servicio de un paciente (dice «lo de la última vez», porque el teléfono puede cogerlo otra persona de la casa), no pide síntomas y la reserva no guarda notas clínicas. Lo que te toca a ti como clínica, desde la base legal hasta el contrato de encargo, lo explicamos en la guía sobre la ley.",
        enlace: "La ley y la recepcionista de IA",
        href: "/guias/ley-y-recepcionista-de-ia",
      },
      enlacesTitulo: "Para dejar lista la clínica",
      enlaces: [
        { href: "/desvio-de-llamadas", titulo: "Desvía las llamadas de la consulta", texto: "Cómo hacer que lo que no coges durante una sesión salte a la recepcionista, operador por operador." },
        { href: "/integraciones", titulo: "Conecta la agenda de la clínica", texto: "Qué calendario usar y cómo respeta Alhabla las sesiones que ya tienes apuntadas." },
        { href: "/herramientas/plantillas-recordatorio-de-cita", titulo: "Textos para recordar sesiones", texto: "Plantillas de recordatorio para copiar, por si escribes tú a un paciente." },
        { href: "/comparativa/recepcionista-de-ia-vs-recepcionista-humana", titulo: "IA o personal de recepción", texto: "Lo que cuesta una persona en recepción frente a la recepcionista de IA, y cuándo combinar las dos." },
      ],
    },
    ownerAssistant: {
      badge: "En cualquiera de los planes",
      title: "Y cuando algo cambia en la consulta, se lo dices por WhatsApp.",
      description: "Entre paciente y paciente tienes dos minutos, no veinte. Al Gestor le escribes por WhatsApp lo que ha cambiado en la consulta y te devuelve el cambio listo; tú decides si se aplica.",
      examples: [
        { title: "Si un fisioterapeuta falta", description: "«Pablo está de baja hoy»: al confirmar, deja de recibir pacientes nuevos y te dice qué sesiones tenía. Decides a quién pasarlas, confirmas cada cambio y te pregunta si avisa al paciente por WhatsApp." },
        { title: "Una mañana fuera", description: "«Irene no está el jueves de 9 a 12, tiene formación»: queda marcada esa ausencia y no se le reserva nada en ese tramo." },
        { title: "¿Cómo va la semana?", description: "«¿Cuántas llamadas y citas llevamos estos días?» y te lo resume; y si un tipo de sesión cambia, «el seguimiento pasa a 50 minutos» y queda así en el catálogo." },
      ],
      closing: "Lo que propone el Gestor espera a tu «Confirmar»; antes, no cambia nada.",
    },
    ciudades: {
      titulo: "En una capital o en una consulta de pueblo, el paciente llama igual.",
      intro: "La recepcionista de IA funciona igual en cualquier punto de España: el paciente marca el teléfono de la clínica, lo que no puedes coger durante una sesión salta a Alhabla con el desvío de tu operador y la cita entra en tu calendario de Google, Outlook o Apple.",
      idiomasTitulo: "Con pacientes que hablan otro idioma, también.",
      idiomasTexto: "Residentes extranjeros, deportistas de paso o turistas con una molestia: la recepcionista les atiende en su idioma, entre los ocho que habla en cualquier plan. En Cataluña y Baleares suma el catalán, en Euskadi el euskera y en Galicia el gallego, activados por el código postal de la clínica.",
      enlace: "Cómo atiende en catalán, euskera y gallego",
    },
    whatsappClientes: {
      titulo: "Lo que recibe el paciente en su WhatsApp",
      filas: [
        "Al colgar, la confirmación con el tipo de sesión, el día, la hora y el fisioterapeuta: «Sesión de seguimiento, lunes 9:30, con Pablo».",
        "En Pro y Scale, el recordatorio antes de cada sesión, que en un tratamiento de varias semanas ayuda a no saltarse ninguna.",
        "Si no puede venir, responde al mensaje para cambiar la sesión o anularla, sin llamar a la clínica en plena consulta.",
        "Si la hora que quería está ocupada, puede pedir que le avisen por WhatsApp si se libera; si ya ha reservado antes en la clínica, también puede escribir a la recepcionista para buscar otra.",
      ],
    },
    calculator: {
      badge: "Calcula pacientes que no consiguen cita",
      title: "¿Cuánto pierde tu consulta por no responder?",
      description: "Estima el valor de primeras visitas y seguimientos que podrían reservarse en otra clínica cuando estás atendiendo.",
      ticketLabel: "Ticket medio por sesión",
      appointmentsLabel: "Citas perdidas cada semana",
      initialTicket: 45,
      estimateTitle: "Haz números con tu agenda",
      estimateHint: "Una cifra aproximada sirve: cuántos pacientes no consiguieron cita porque estabas en sesión.",
      footnote: "Orientativo, con cuatro semanas al mes y una sesión por paciente. No incluye las sesiones siguientes de un tratamiento que empieza con esa primera cita.",
    },
    planesTitulo: "Planes para tu clínica de fisioterapia.",
    faqsTitulo: "Preguntas de fisioterapeutas antes de empezar.",
    faqs: [
      { question: "¿Necesito conectar un calendario?", answer: "No. Si llevas la agenda en Google Calendar, Outlook o iCloud, conéctalo y las citas entran ahí. Si no usas ninguno, elige la agenda de Alhabla: la recepcionista reserva en ella, tú la ves en el panel, apuntas lo que te entra por otros canales y te la suscribes en el calendario del móvil con un enlace de solo lectura." },
      { question: "¿Organiza primeras visitas y seguimientos por separado?", answer: "Sí. Das de alta cada tipo de sesión con su duración y la recepcionista reserva el que corresponde, con el fisioterapeuta que hayas marcado como especialista en él." },
      { question: "¿Hace diagnósticos o da ejercicios?", answer: "Nunca. Pregunta el motivo de la visita en términos generales para reservar bien, no pide historial clínico y no da pautas. Si alguien describe una urgencia, le indica que contacte con emergencias o con un profesional sanitario." },
      { question: "¿Mantiene al paciente con su fisioterapeuta?", answer: "Sí. Si el paciente nombra a su fisioterapeuta, reserva con él; si no tiene hueco, le propone otro día con él o una alternativa, y elige el paciente." },
      { question: "¿Qué pasa con los datos de salud de mis pacientes?", answer: "La recepcionista toca los mínimos: no pide síntomas, el saludo no nombra servicios y la reserva solo guarda nombre, teléfono, tipo de sesión y fisioterapeuta. Lo que el paciente cuente queda en la transcripción, que se borra a los 90 días. Las obligaciones de la clínica las explicamos en la guía sobre la ley y la recepcionista de IA." },
      { question: "¿Puedo seguir con mi programa de gestión de la clínica?", answer: "Sí. Alhabla no se integra con programas de gestión clínica; mira el calendario que conectes (Google, Outlook o iCloud). Si tu programa sincroniza la agenda con ese calendario, la recepcionista no ofrecerá las horas ocupadas." },
      { question: "¿Qué contesta si le preguntan por la mutua o el seguro?", answer: "Lo que hayas escrito en la información de la clínica. Si no lo tienes escrito, no lo supone: toma el recado y te llega por WhatsApp para que respondas tú." },
      { question: "¿Atiende mientras estoy tratando a un paciente?", answer: "Para eso está: con el desvío condicional, la llamada que no coges en sesión salta a la recepcionista, igual que la de fuera de horario o la de un festivo." },
      { question: "¿Graba a mis pacientes?", answer: "Solo a quien da permiso: la recepcionista lo pide durante la llamada y, si el paciente lo aceptó en otra llamada, se lo recuerda al descolgar. Sin permiso, solo queda la transcripción." },
      { question: "¿Atiende a pacientes extranjeros?", answer: "Sí, en cualquier plan. Habla castellano y siete idiomas más, como inglés, alemán o ruso, y cambia al del paciente. Si la clínica está en Cataluña o Baleares, también catalán desde la primera llamada; en Euskadi, euskera, y en Galicia, gallego." },
    ],
    closingTitle: "Que la siguiente primera visita se reserve mientras sigues en la camilla.",
    sectorData: {
      eyebrow: "Un problema que solo entiende quien lo vive",
      title: "No puedes dejar a un paciente solo con electrodos para coger el teléfono",
      description: "La fisioterapia es una profesión regulada que exige atención continua. No hay estadísticas públicas sobre llamadas perdidas, pero el problema es evidente cada vez que suena el móvil a mitad de una sesión.",
      stats: [
        { value: "45-65\u20AC", label: "de ticket medio por sesión presencial", source: "Doctoralia" },
        { value: "60 min", label: "de duración típica de una primera visita", source: "Sector fisioterapia" },
      ],
      painPoint: "Cuando estás tratando a un paciente, no puedes interrumpir la sesión. Dejarlo solo con aparatos conectados o a mitad de una manipulación no es una opción. Mientras tanto, la llamada de una nueva primera visita se pierde.",
    },
  },
};

export function getNicheMetadata(content: NicheLandingContent): Metadata {
  const url = absoluteUrl(`/${content.slug}`);

  return {
    title: { absolute: `${content.title} | ${siteName}` },
    description: content.description,
    keywords: [...content.keywords, siteName],
    alternates: { canonical: url },
    category: "business software",
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    openGraph: {
      title: `${content.title} | ${siteName}`,
      description: content.description,
      url,
      siteName,
      locale: "es_ES",
      type: "website",
      images: ogImages(`/${content.slug}`, `${content.title} | ${siteName}`),
    },
    twitter: {
      card: "summary_large_image",
      title: `${content.title} | ${siteName}`,
      description: content.description,
      images: ogImages(`/${content.slug}`, `${content.title} | ${siteName}`),
    },
    other: {
      "geo.region": "ES",
      "geo.placename": "España",
      language: "es",
    },
  };
}

export function getNicheStructuredData(content: NicheLandingContent) {
  const url = absoluteUrl(`/${content.slug}`);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        name: `${content.title} | ${siteName}`,
        headline: content.heroTitle,
        description: content.description,
        url,
        inLanguage: "es-ES",
        // Misma entidad que declara la portada (seo.ts): sin repetir nombre
        // ni url para que Google no vea dos WebSite distintos.
        isPartOf: { "@id": websiteId() },
        about: { "@id": `${url}#service` },
        keywords: content.keywords.join(", "),
      },
      {
        "@type": "Service",
        "@id": `${url}#service`,
        name: content.primaryKeyword,
        serviceType: "Recepción telefónica con inteligencia artificial y gestión de citas",
        provider: { "@id": organizationId() },
        areaServed: { "@type": "Country", name: "España" },
        audience: { "@type": "BusinessAudience", audienceType: content.name },
        description: content.description,
        url,
        offers: {
          "@type": "AggregateOffer",
          lowPrice: PRECIO_MINIMO,
          highPrice: PRECIO_MAXIMO,
          priceCurrency: "EUR",
          offerCount: String(plans.length),
          url: absoluteUrl("/planes"),
        },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${url}#software`,
        name: siteName,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: content.description,
        url,
        audience: { "@type": "BusinessAudience", audienceType: content.name },
        offers: { "@type": "AggregateOffer", lowPrice: PRECIO_MINIMO, highPrice: PRECIO_MAXIMO, priceCurrency: "EUR", offerCount: String(plans.length) },
      },
      buildFaqPageStructuredData(content.faqs),
      { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Inicio", item: absoluteUrl("/") }, { "@type": "ListItem", position: 2, name: content.name, item: url }] },
    ],
  };
}

/**
 * Los enlaces a TODAS las páginas de sector (menús, el Gestor, la
 * calculadora), del registro de páginas: las cinco de aquí y las que se
 * hicieron después con su propia página (pestañas, spa, peluquería canina).
 */
export const nicheLinks = paginasDeLaSeccion("sectores").map(({ ruta, nombre }) => ({ href: ruta, label: nombre }));

/**
 * El Gestor para la landing genérica: «un profesional», sin oficio. Las
 * cinco landings de nicho llevan su propia variante en `ownerAssistant`, con
 * el sustantivo del oficio y ejemplos con servicios reales de cada sector.
 * Los nombres son los del relato general (`relato-guiones.ts`): Marta falta
 * y Lucía la cubre.
 */
export const generalOwnerAssistant: OwnerAssistant = {
  badge: "Incluido en todos los planes",
  title: "Y cuando algo cambia, se lo dices por WhatsApp.",
  description:
    "Alhabla no es solo quien contesta el teléfono: también es con quien hablas tú. Le pides por WhatsApp cambiar un precio, el horario o una cita, te propone el cambio y, cuando pulsas «Confirmar», queda en tu agenda.",
  examples: [
    {
      title: "Si un profesional falta",
      description: "«Marta está de baja hoy»: al confirmar, deja de recibir citas nuevas y te dice cuántas tenía. Le dices a quién pasar cada una, confirmas el cambio y te pregunta si avisa al cliente por WhatsApp.",
    },
    {
      title: "Si cierras antes o un día entero",
      description: "«cerramos el sábado por la tarde» o «vacaciones del 1 al 15» — queda bloqueado en tu agenda sin tocar el calendario a mano.",
    },
    {
      title: "Si cambias un precio o el horario",
      description: "«el servicio pasa a 30€» o «los lunes abrimos a las 10» — se actualiza en tu catálogo y tu horario al momento.",
    },
  ],
  closing: "Nunca cambia nada sin que pulses «Confirmar».",
};
