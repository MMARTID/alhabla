import type { SectorSlug } from "@/lib/sectores/tipos";

/**
 * El guion del relato «En tu bolsillo» → «En tu negocio» (la llamada en el
 * iPhone, la pantalla de bloqueo del relevo y el panel en el portátil), uno
 * por landing: la portada general y cada sector. Lo que cambia de un negocio
 * a otro (nombres, servicios, duraciones, cómo se llama a quien
 * reserva) vive aquí; las frases que se repiten se arman en `relato` a partir
 * de estos datos, para que los seis guiones cuenten exactamente la misma
 * historia con su vocabulario.
 *
 * Los profesionales de cada sector son los mismos que salen en el resto de
 * su landing (reparto por especialidad y tu asistente), para que no cambien de
 * nombre de una sección a otra. Los números de teléfono empiezan por 79: un
 * rango sin atribuir en el Plan Nacional de Numeración, no son de nadie.
 */

export type Servicio = { nombre: string; minutos: number };

export type GuionRelato = {
  /** El negocio de la historia: lo dice el saludo y sale en el panel. */
  negocio: string;
  /** Cómo se nombra a quien reserva, ya con su artículo. */
  palabras: {
    /** «tu clienta», «tu cliente», «tu paciente» */
    tuCliente: string;
    /** «Tus clientes», «Tus pacientes» (en mayúscula: abre frase) */
    tusClientes: string;
    /** «el cliente», «el paciente» */
    elCliente: string;
    /** Lo que hacías tú mientras llamaban: «estabas con una clienta». */
    mientras: string;
  };
  /** Quien llama. */
  cliente: { nombre: string; apellido: string; telefono: string };
  /** Con quién reserva, y quien la sustituye cuando falta (tu asistente). */
  profesional: string;
  companera: string;
  servicio: Servicio;
  /** Lo que pide al llamar, tal cual lo diría. */
  pide: string;
  /** Otros clientes y servicios del día, para la agenda y el panel. */
  otrosClientes: [string, string, string, string];
  otrosServicios: [Servicio, Servicio, Servicio, Servicio];
  /**
   * El texto de cada paso de las dos escenas en el idioma del oficio
   * (LlamadaScroll: contesta, busca hueco, confirma; EnTuNegocioScroll:
   * panel, llamada, tu asistente). Sin él, el texto general de la portada.
   * Que cada sector tenga el suyo es también lo que mantiene las ocho
   * landings por debajo de la auditoría de parecido (seo:similitud).
   */
  pasos?: {
    llamada: [string, string, string];
    negocio: [string, string, string];
  };
  /** Las cifras de la semana en el panel. */
  semana: {
    citas: number;
    masQueAntes: number;
    llamadas: number;
    ingresos: number;
  };
};

export const GUION_GENERAL: GuionRelato = {
  negocio: "Peluquería Nuria",
  palabras: {
    tuCliente: "tu clienta",
    tusClientes: "Tus clientes",
    elCliente: "el cliente",
    mientras: "estabas con una clienta",
  },
  cliente: { nombre: "Laura", apellido: "G.", telefono: "+34 790 24 61 75" },
  profesional: "Marta",
  companera: "Lucía",
  servicio: { nombre: "Corte y color", minutos: 90 },
  pide: "¿Tenéis hueco mañana para corte y color?",
  otrosClientes: ["Carmen R.", "Sergio P.", "Rosa M.", "Elena S."],
  otrosServicios: [
    { nombre: "Mechas", minutos: 120 },
    { nombre: "Corte caballero", minutos: 30 },
    { nombre: "Alisado", minutos: 90 },
    { nombre: "Peinado", minutos: 45 },
  ],
  semana: { citas: 23, masQueAntes: 6, llamadas: 41, ingresos: 1186 },
};

export const GUIONES_SECTOR: Record<SectorSlug, GuionRelato> = {
  peluqueria: {
    ...GUION_GENERAL,
    cliente: { nombre: "Carmen", apellido: "R.", telefono: "+34 791 32 55 57" },
    profesional: "Marta",
    companera: "Laura",
    otrosClientes: ["Ana T.", "Sergio P.", "Rosa M.", "Elena S."],
    pasos: {
      llamada: [
        "Con las manos en un tinte no coges el teléfono: a los pocos tonos contesta Alhabla, dice el nombre del salón y atiende a la clienta como lo harías tú en el mostrador.",
        "Corte y color son 90 minutos: busca dónde caben enteros con la estilista que lo hace y descarta los huecos cortos entre dos clientas.",
        "Carmen tiene su hora con Marta y tú no has soltado el pincel. La confirmación le llega al móvil por WhatsApp.",
      ],
      negocio: [
        "Entre clienta y clienta abres el panel: ves si la recepción está atendiendo, cuántas llamadas ha cogido hoy y qué citas quedan por la tarde.",
        "Abres la llamada de Carmen: qué pidió, por qué le dio las 17:30 con Marta y la cita que salió de ella.",
        "Si mañana falta una estilista, se lo escribes como a una compañera de mostrador, aquí o en tu WhatsApp.",
      ],
    },
  },
  barberia: {
    negocio: "Barbería Santos",
    palabras: {
      tuCliente: "tu cliente",
      tusClientes: "Tus clientes",
      elCliente: "el cliente",
      mientras: "estabas con la navaja",
    },
    cliente: { nombre: "Javier", apellido: "M.", telefono: "+34 792 18 40 63" },
    profesional: "Luis",
    companera: "Dani",
    servicio: { nombre: "Corte y barba", minutos: 45 },
    pide: "¿Tenéis hueco mañana para corte y barba?",
    otrosClientes: ["Álex R.", "Marcos P.", "Hugo L.", "Iván S."],
    otrosServicios: [
      { nombre: "Corte degradado", minutos: 30 },
      { nombre: "Afeitado a navaja", minutos: 30 },
      { nombre: "Arreglo de barba", minutos: 20 },
      { nombre: "Corte infantil", minutos: 20 },
    ],
    pasos: {
      llamada: [
        "Con la navaja en la mano no se coge el móvil. Tras unos tonos contesta Alhabla con el nombre de la barbería y atiende al cliente sin hacerle esperar.",
        "Corte y barba son 45 minutos: mira qué barbero está libre y el primer hueco en el que cabe entero, sin pisar el corte de nadie.",
        "Javier tiene su hora con Luis y tú no has parado el degradado. Le llega la cita por WhatsApp.",
      ],
      negocio: [
        "Cuando se vacía una silla, abres el panel: si la recepción está atendiendo, cuántas llamadas ha cogido y quién se sienta después.",
        "Abres la llamada de Javier y lees qué pidió, por qué le tocó Luis a esa hora y la reserva que quedó.",
        "¿Falta un barbero o cambias un precio? Se lo dices desde el panel o desde tu WhatsApp: es la misma asistente.",
      ],
    },
    semana: { citas: 58, masQueAntes: 9, llamadas: 74, ingresos: 1102 },
  },
  "salon-de-unas": {
    negocio: "Estudio de uñas Vega",
    palabras: {
      tuCliente: "tu clienta",
      tusClientes: "Tus clientas",
      elCliente: "la clienta",
      mientras: "estabas limando",
    },
    cliente: { nombre: "Paula", apellido: "D.", telefono: "+34 793 66 21 08" },
    profesional: "Laura",
    companera: "Noa",
    servicio: { nombre: "Manicura semipermanente", minutos: 60 },
    pide: "¿Tenéis hueco mañana para una semipermanente en manos?",
    otrosClientes: ["Irene C.", "Marta B.", "Sofía L.", "Nerea V."],
    otrosServicios: [
      { nombre: "Uñas de gel", minutos: 90 },
      { nombre: "Pedicura spa", minutos: 60 },
      { nombre: "Retirada y semi", minutos: 75 },
      { nombre: "Nail art", minutos: 45 },
    ],
    pasos: {
      llamada: [
        "Con la lima en la mano y la lámpara encendida no puedes contestar. Lo hace Alhabla al poco de sonar, con el nombre del estudio de uñas.",
        "Una semipermanente es una hora: busca cuándo la tiene libre la técnica que la hace y no la encaja en un hueco de media hora.",
        "Paula tiene su hora con Laura y tú no has dejado la mesa. Le llega el aviso de la cita por WhatsApp.",
      ],
      negocio: [
        "Mientras seca un esmalte, abres el panel: si la recepción atiende, cuántas llamadas ha cogido y qué clientas vienen después.",
        "Abres la llamada de Paula y ves qué servicio quería, por qué fue con Laura a esa hora y la cita que salió.",
        "El día libre de una técnica o un servicio nuevo: se lo escribes a tu asistente, la misma de tu WhatsApp.",
      ],
    },
    semana: { citas: 41, masQueAntes: 7, llamadas: 52, ingresos: 1148 },
  },
  "centro-de-estetica": {
    negocio: "Centro de estética Alba",
    palabras: {
      tuCliente: "tu clienta",
      tusClientes: "Tus clientes",
      elCliente: "el cliente",
      mientras: "estabas en cabina",
    },
    cliente: {
      nombre: "Cristina",
      apellido: "P.",
      telefono: "+34 794 27 93 51",
    },
    profesional: "Sara",
    companera: "Elena",
    servicio: { nombre: "Facial con peeling", minutos: 75 },
    pide: "¿Tenéis hueco mañana para un facial con peeling?",
    otrosClientes: ["Beatriz N.", "Lorena G.", "Marina F.", "Silvia R."],
    otrosServicios: [
      { nombre: "Presoterapia", minutos: 45 },
      { nombre: "Depilación láser", minutos: 30 },
      { nombre: "Masaje relajante", minutos: 60 },
      { nombre: "Higiene facial", minutos: 60 },
    ],
    pasos: {
      llamada: [
        "En cabina no sales a coger el teléfono. A los pocos tonos contesta Alhabla con el nombre del centro y atiende a la clienta como tu recepción.",
        "Un facial con peeling son 75 minutos y no lo hace cualquiera: busca el hueco de la esteticista que lo hace y respeta lo que ya está reservado.",
        "Cristina tiene su facial con Sara y tú no has salido de cabina. Recibe la confirmación por WhatsApp.",
      ],
      negocio: [
        "Entre tratamiento y tratamiento miras el panel: si la recepción atiende, cuántas llamadas ha cogido y qué tratamientos quedan por la tarde.",
        "Abres la llamada de Cristina: qué tratamiento pidió, por qué se lo dio con Sara y la cita que salió.",
        "Una baja, un bono o un tratamiento nuevo: se lo pides a tu asistente desde el panel, como en WhatsApp.",
      ],
    },
    semana: { citas: 27, masQueAntes: 5, llamadas: 46, ingresos: 1593 },
  },
  fisioterapia: {
    negocio: "Fisioterapia Rivas",
    palabras: {
      tuCliente: "tu paciente",
      tusClientes: "Tus pacientes",
      elCliente: "el paciente",
      mientras: "estabas en sesión",
    },
    cliente: { nombre: "Andrés", apellido: "L.", telefono: "+34 795 40 12 86" },
    profesional: "Pablo",
    companera: "Irene",
    servicio: { nombre: "Primera consulta", minutos: 60 },
    pide: "¿Tenéis hueco mañana para una primera consulta? Me duele la espalda.",
    otrosClientes: ["Teresa M.", "Jorge A.", "Nuria S.", "Óscar B."],
    otrosServicios: [
      { nombre: "Sesión de seguimiento", minutos: 45 },
      { nombre: "Punción seca", minutos: 30 },
      { nombre: "Masaje deportivo", minutos: 60 },
      { nombre: "Rehabilitación de rodilla", minutos: 45 },
    ],
    pasos: {
      llamada: [
        "En plena sesión no se coge el teléfono. Contesta Alhabla con el nombre de la clínica y atiende al paciente sin preguntarle por su historial.",
        "Una primera consulta es una hora: busca cuándo la tiene libre el fisio que la hace y no la parte entre dos sesiones.",
        "Andrés tiene su primera consulta con Pablo y tú no has dejado la camilla. La confirmación le llega por WhatsApp.",
      ],
      negocio: [
        "Entre paciente y paciente abres el panel: si la recepción atiende, cuántas llamadas ha cogido y qué sesiones quedan hoy.",
        "Abres la llamada de Andrés y lees qué consulta pidió, por qué le tocó Pablo a esa hora y la cita que salió.",
        "Una baja o una mañana de formación: se la cuentas a tu asistente desde el panel o por WhatsApp.",
      ],
    },
    semana: { citas: 34, masQueAntes: 4, llamadas: 39, ingresos: 1530 },
  },
  "pestanas-y-cejas": {
    negocio: "Estudio Lía",
    palabras: {
      tuCliente: "tu clienta",
      tusClientes: "Tus clientas",
      elCliente: "la clienta",
      mientras: "tenías las pinzas en la mano",
    },
    cliente: { nombre: "Irene", apellido: "G.", telefono: "+34 794 51 30 88" },
    profesional: "Nerea",
    companera: "Alba",
    servicio: { nombre: "Relleno de pestañas", minutos: 60 },
    pide: "¿Tenéis hueco mañana para un relleno de pestañas?",
    otrosClientes: ["Sonia R.", "Paula C.", "Marta L.", "Eva M."],
    otrosServicios: [
      { nombre: "Juego de volumen", minutos: 150 },
      { nombre: "Laminado de cejas", minutos: 45 },
      { nombre: "Lifting de pestañas", minutos: 60 },
      { nombre: "Diseño de cejas", minutos: 30 },
    ],
    pasos: {
      llamada: [
        "Pegando extensiones pelo a pelo no hay mano libre para el móvil. Responde Alhabla tras unos tonos y presenta el estudio por su nombre.",
        "Un relleno es una hora: lo pone donde la técnica que lo hace tiene la hora entera, nunca a caballo entre dos juegos.",
        "Irene tiene su relleno con Nerea y tú sigues con el juego de volumen. Su cita le llega por WhatsApp.",
      ],
      negocio: [
        "Al terminar un juego miras el panel: recepción en marcha, llamadas cogidas y quién se tumba en la camilla después.",
        "Abres la llamada de Irene: qué pidió, por qué fue con Nerea a esa hora y qué cita quedó.",
        "Una técnica que se pone mala o un precio que sube: díselo a tu asistente, la que tienes en WhatsApp.",
      ],
    },
    semana: { citas: 36, masQueAntes: 6, llamadas: 44, ingresos: 1410 },
  },
  "spa-y-masajes": {
    negocio: "Spa Alameda",
    palabras: {
      tuCliente: "tu cliente",
      tusClientes: "Tus clientes",
      elCliente: "el cliente",
      mientras: "estabas dando un masaje",
    },
    cliente: { nombre: "Sonia", apellido: "O.", telefono: "+34 793 27 84 15" },
    profesional: "Lucía",
    companera: "Óscar",
    servicio: { nombre: "Ritual de chocolate", minutos: 90 },
    pide: "¿Tenéis hueco mañana para el ritual de chocolate?",
    otrosClientes: ["Elena V.", "Marcos T.", "Raquel D.", "Jorge P."],
    otrosServicios: [
      { nombre: "Masaje relajante", minutos: 60 },
      { nombre: "Piedras calientes", minutos: 75 },
      { nombre: "Reflexología", minutos: 45 },
      { nombre: "Masaje descontracturante", minutos: 60 },
    ],
    pasos: {
      llamada: [
        "En cabina solo suena la música. Fuera, a los pocos tonos, responde Alhabla con el nombre del spa y atiende sin prisa.",
        "El ritual de chocolate son 90 minutos: busca cuándo lo tiene libre quien lo hace y no lo encaja en un hueco corto.",
        "Sonia tiene su ritual con Lucía y tú no has interrumpido el masaje. La reserva le llega por WhatsApp.",
      ],
      negocio: [
        "Al salir de cabina echas un vistazo al panel: si la recepción atiende, las llamadas del día y los masajes que quedan.",
        "Abres la llamada de Sonia y lees qué ritual quería, por qué le dio las 17:30 con Lucía y la reserva que salió.",
        "Una terapeuta con gripe o un ritual que cambia de precio: se lo cuentas a tu asistente, la de tu WhatsApp.",
      ],
    },
    semana: { citas: 31, masQueAntes: 5, llamadas: 38, ingresos: 1865 },
  },
  "peluqueria-canina": {
    negocio: "Peluquería canina Trufa",
    palabras: {
      tuCliente: "tu cliente",
      tusClientes: "Tus clientes",
      elCliente: "el cliente",
      mientras: "estabas secando a un perro",
    },
    cliente: { nombre: "Lucía", apellido: "P.", telefono: "+34 798 46 02 19" },
    profesional: "Álex",
    companera: "Iván",
    servicio: { nombre: "Baño perro mediano", minutos: 60 },
    pide: "¿Tenéis hueco mañana para bañar a mi perro? Es un caniche mediano.",
    otrosClientes: ["Diego F.", "Marta S.", "Carlos R.", "Ana B."],
    otrosServicios: [
      { nombre: "Deslanado perro grande", minutos: 150 },
      { nombre: "Baño perro pequeño", minutos: 60 },
      { nombre: "Stripping", minutos: 90 },
      { nombre: "Corte de uñas", minutos: 15 },
    ],
    pasos: {
      llamada: [
        "Con un perro mojado en la mesa no sueltas la ducha. Tras unos tonos contesta Alhabla con el nombre de la peluquería y pregunta qué perro es.",
        "Un baño de perro mediano es una hora: busca cuándo está libre quien lo hace y no lo mete entre dos perros en media hora.",
        "Lucía tiene el baño de Toby con Álex y tú sigues con el secador. La cita le llega por WhatsApp.",
      ],
      negocio: [
        "Mientras se seca un perro, miras el panel: si la recepción atiende, las llamadas que ha cogido y los perros que quedan hoy.",
        "Abres la llamada de Lucía: qué perro es, qué pidió y por qué le tocó Álex a esa hora.",
        "Un peluquero que se tuerce un tobillo o un baño que sube de precio: se lo escribes a tu asistente.",
      ],
    },
    semana: { citas: 29, masQueAntes: 4, llamadas: 36, ingresos: 1235 },
  },
};

/** El guion de una landing: el de su sector, o el general en la portada. */
export function guionDe(sector?: SectorSlug): GuionRelato {
  return sector ? GUIONES_SECTOR[sector] : GUION_GENERAL;
}

/** «17:30» + 90 min → «19:00». */
export function sumarMinutos(hora: string, minutos: number): string {
  const [h, m] = hora.split(":").map(Number);
  const total = h * 60 + m + minutos;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Minúscula inicial, para meter un servicio a media frase. */
export const enFrase = (texto: string) =>
  texto.charAt(0).toLowerCase() + texto.slice(1);

/** La hora de la cita que se reserva en la historia (siempre la misma). */
export const HORA_CITA = "17:30";

/**
 * Las frases del relato armadas desde el guion: lo que se dice en la
 * llamada, la agenda que se revisa, el WhatsApp, las notificaciones de la
 * pantalla de bloqueo y el panel. Todo lo que no depende del sector está
 * escrito aquí una sola vez.
 */
export function relato(g: GuionRelato) {
  const { cliente, profesional, companera, servicio } = g;
  const finCita = sumarMinutos(HORA_CITA, servicio.minutos);
  const nombre = (completo: string) => completo.split(" ")[0];
  const [s0, s1, s2, s3] = g.otrosServicios;
  const [c0, c1, c2, c3] = g.otrosClientes;
  // El saludo real (backend/src/lib/idiomas/catalogo.ts, `presentacion`):
  // avisa de que es una IA, como pide el art. 50 del Reglamento de IA.
  const saludo = `${g.negocio}, te atiende su recepcionista de IA. ¿En qué te ayudo?`;
  // La recepcionista solo menciona la duración si es una cita larga.
  const ofrece =
    servicio.minutos > 80
      ? `Claro. Es una cita larga, de unos ${servicio.minutos} minutos. ¿A qué hora te viene mejor?`
      : "Claro. ¿A qué hora te viene mejor?";
  const franja = "Por la tarde, si puede ser.";
  return {
    saludo,
    pide: g.pide,
    ofrece,
    franja,
    /**
     * La llamada entera, turno a turno, como la lleva de verdad la
     * recepcionista (sus instrucciones, backend/src/lib/seccionesDelPrompt.ts):
     * saluda con el nombre del negocio y el aviso de IA; solo dice la
     * duración si pasa de 80 minutos; a quien llama por primera vez le pide
     * permiso para grabar mientras comprueba el hueco (voiceTools,
     * `pregunta_de_grabacion`); recoge el nombre; en un solo turno resume y
     * pregunta si reserva y manda la confirmación por WhatsApp; y avisa de
     * que le llega un WhatsApp de Alhabla. El recordatorio no se nombra: solo
     * sale en Pro y Scale.
     */
    turnos: [
      { agente: true, texto: saludo },
      { agente: false, texto: g.pide },
      { agente: true, texto: ofrece },
      { agente: false, texto: franja },
      {
        agente: true,
        texto: `Mientras lo compruebo, ¿te parece bien que grabe tus llamadas para que ${g.negocio} pueda revisarlas?`,
      },
      { agente: false, texto: "Sí, vale." },
      {
        agente: true,
        texto: `Mañana tengo a las ${HORA_CITA} con ${profesional}. ¿A nombre de quién la pongo?`,
      },
      { agente: false, texto: `${cliente.nombre}.` },
      {
        agente: true,
        texto: `Entonces, ${enFrase(servicio.nombre)} mañana jueves a las ${HORA_CITA} con ${profesional}, a nombre de ${cliente.nombre}. ¿Te la reservo y te mando la confirmación por WhatsApp a este número?`,
      },
      { agente: false, texto: "Sí, perfecto." },
      {
        agente: true,
        texto: "Hecho. Te llegará un WhatsApp de Alhabla con la confirmación.",
      },
    ],
    /** La agenda de mañana que repasa el buscador: la cuarta fila es la buena. */
    agenda: [
      {
        hora: "15:00",
        titulo: "Ocupado",
        detalle: `${s0.nombre} · ${nombre(c0)}`,
      },
      {
        hora: "16:00",
        titulo: "Ocupado",
        detalle: `${s1.nombre} · ${nombre(c1)}`,
      },
      {
        hora: "17:00",
        titulo: "Hueco corto",
        detalle: "30 min libres: no cabe",
      },
      {
        hora: HORA_CITA,
        titulo: "Libre",
        detalle: `${servicio.minutos} min · con ${profesional}`,
      },
      {
        hora: "19:00",
        titulo: "Ocupado",
        detalle: `${s3.nombre} · ${nombre(c3)}`,
      },
      { hora: "20:00", titulo: "Cerrado", detalle: "Fin de la jornada" },
    ],
    cita: `Jueves a las ${HORA_CITA} con ${profesional}`,
    finCita,
    /**
     * Lo que le llega al dueño de la cita nueva: el aviso de WhatsApp de
     * Alhabla, con el texto real de `avisoNuevaReserva` (backend,
     * modules/whatsapp/mensajes.ts) y sus dos botones. Es lo que sale en la
     * pantalla de bloqueo del relevo, como una notificación de WhatsApp en el
     * Mac. Solo llega si el dueño ha conectado su WhatsApp.
     */
    avisos: [
      {
        app: "WhatsApp",
        titulo: "Alhabla",
        texto: `${g.negocio}: nueva cita. ${cliente.nombre}, jueves ${HORA_CITA}, ${servicio.nombre}, con ${profesional}. Ya está en tu agenda.`,
        botones: ["Vale", "Ver agenda de hoy"],
        hace: "ahora",
      },
    ],
    /** Panel: próximas citas (la nueva, la última). */
    proximas: [
      {
        dia: "Hoy",
        hora: "17:30",
        servicio: s0.nombre,
        quien: `${c0} · con ${companera}`,
        minutos: s0.minutos,
      },
      {
        dia: "Hoy",
        hora: "18:15",
        servicio: s1.nombre,
        quien: `${c1} · con ${profesional}`,
        minutos: s1.minutos,
      },
      {
        dia: "Jue",
        hora: "10:00",
        servicio: s2.nombre,
        quien: `${c2} · con ${profesional}`,
        minutos: s2.minutos,
      },
    ],
    /**
     * Panel: llamadas de antes de la de hoy (la de hoy va la primera). Como
     * en el panel real: por número de teléfono, y con etiqueta solo si la
     * llamada creó o cambió una cita.
     */
    llamadas: [
      { quien: "+34 797 80 30 74", cuando: "Hoy, 13:41 · 1m 2s", chip: null },
      {
        quien: "+34 796 54 12 90",
        cuando: "Hoy, 11:20 · 1m 48s",
        chip: "Reserva modificada",
      },
      {
        quien: "+34 795 08 98 37",
        cuando: "Mar, 21:12 · 1m 31s",
        chip: "Reserva creada",
      },
      {
        quien: "+34 798 33 07 45",
        cuando: "Mar, 19:27 · 58s",
        chip: "Reserva creada",
      },
      { quien: "+34 796 21 88 17", cuando: "Mar, 14:39 · 35s", chip: null },
      {
        quien: "+34 797 61 24 03",
        cuando: "Lun, 10:05 · 1m 12s",
        chip: "Reserva creada",
      },
    ] as { quien: string; cuando: string; chip: string | null }[],
    /**
     * Panel: la conversación con tu asistente (una baja y sus citas), con sus
     * tools reales: `listar_agenda` (las citas, no los huecos), `buscar_hueco`
     * para cada hora y una propuesta a la vez con «Confirmar».
     */
    asistente: {
      pregunta: "¿Cómo tenemos mañana?",
      respuesta: `Mañana, jueves, hay 9 citas. ${profesional} tiene 3: a las 10:00, a las 12:30 y a las ${HORA_CITA}.`,
      baja: `${profesional} no viene mañana, está con fiebre. ¿${companera} puede quedarse sus citas?`,
      analisis: `${companera} tiene hueco a las 10:00 y a las 12:30; a las ${HORA_CITA} no.`,
      tabla: [
        { hora: "10:00", cita: `${s2.nombre} · ${c2}`, libre: true },
        { hora: "12:30", cita: `${s3.nombre} · ${c3}`, libre: true },
        {
          hora: HORA_CITA,
          cita: `${servicio.nombre} · ${cliente.nombre} ${cliente.apellido}`,
          libre: false,
        },
      ],
      orden: `Vale. Márcala ausente y luego pásale esas dos a ${companera}.`,
      /**
       * Como en el producto: una propuesta cada vez, y nada cambia hasta que
       * el dueño pulsa «Confirmar» (textos de modules/gestor/accionesAgenda.ts).
       */
      propuesta: `¿Confirmas? Marcar a ${profesional} como ausente el jueves: la recepcionista no le reservará nada. Ojo: ya tiene 3 citas ahí, que no se mueven solas.`,
      hecho: {
        texto: `Hecho: ${profesional} no está el jueves; la recepcionista no le reservará nada ahí.`,
        etiqueta: `${profesional}, ausente el jueves`,
      },
      siguiente: `¿Confirmas? Mover la cita de ${nombre(c2)} (${enFrase(s2.nombre)}) del jueves a las 10:00 con ${companera}.`,
    },
  };
}

export type Relato = ReturnType<typeof relato>;
