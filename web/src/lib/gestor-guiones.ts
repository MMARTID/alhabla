import type { NicheSlug } from "@/lib/niche-landings";

/**
 * Los guiones de tu asistente en acción (`components/gestor-simulacion.tsx`;
 * en el backend, «el Gestor»): la conversación del dueño con Alhabla por
 * WhatsApp y lo que el panel del portátil enseña a cada cambio, uno por
 * landing (la portada general y cada sector). Lo que cambia de un negocio a
 * otro —nombres, servicios, cómo se llama a quien reserva, qué dos
 * situaciones cuenta cada landing además de la ausencia— vive aquí;
 * `ausenciaDe` arma la ausencia, que es la misma cadena en los seis, con el
 * vocabulario de cada uno. Es la única copia: el mockup quieto de la página
 * de tu asistente (`owner-assistant-chat.tsx`
 * en /agenda-por-whatsapp) pinta la ausencia de peluquería de aquí.
 *
 * Honestidad (2026-10-22, contrastado con backend/src/modules/gestor/ y
 * modules/whatsapp/router.ts): cada acción es una PROPUESTA con «Confirmar
 * · Cancelar» (`registrarPropuesta` + `textoDeConfirmacion` en
 * acciones.ts) y solo el botón ejecuta; una propuesta a la vez; el «Hecho:»
 * lo escribe la acción al ejecutarse (`ResultadoDeEjecucion.mensaje`); tras
 * mover o apuntar una cita con móvil, el sistema pregunta con botones si
 * avisa al cliente (`siguiente` en accionesAgenda.ts, `preguntarTrasAccion`
 * en router.ts) y «Le aviso a … al …» es la respuesta de `avisar_cliente`.
 * Las descripciones siguen las del backend acortando la fecha larga
 * («el miércoles 30 de septiembre» → «hoy») y sin el paréntesis del móvil
 * en la propuesta de mover, que aquí va en la pregunta de avisar:
 *
 * - marcar_ausencia: «marcar a X como ausente <tramo> (motivo): la
 *   recepcionista no le reservará nada en ese tramo. Ojo: ya tiene N citas
 *   ahí, que no se mueven solas» → «Hecho: X no está <tramo>; … Tiene N
 *   citas en ese tramo: dime si las movemos o las cancelamos.»
 * - mover_cita: «mover la cita de C del <fecha> (servicio) con P al <fecha>
 *   con Q» → «Hecho: la cita de C … pasa al <fecha> con Q. El calendario ya
 *   está al día.» + «¿Le aviso a C por WhatsApp de la nueva hora? Si
 *   prefieres llamarle tú: <móvil>.» [Sí, avísale · Le llamo yo].
 * - añadir_cita: «apuntar a C el <fecha>, servicio (N min) con P» → «Hecho:
 *   C queda apuntado el <fecha>, servicio con P. Ya está en tu calendario.»
 *   + «¿Le mando a C la confirmación por WhatsApp al <móvil>?» [Sí,
 *   mándasela · No] → «Le mando a C la confirmación al <móvil>.»
 * - cerrar_dia: «cerrar el <fecha> (motivo): la recepcionista no reservará
 *   ese día» → «Hecho: el <fecha> queda cerrado. Las citas ya reservadas ese
 *   día no se cancelan solas: revísalas en la agenda.»
 * - editar_servicio: «cambiar el servicio S: 18 €» → «Hecho: S, 30 min,
 *   18 €. La recepcionista ya lo dice así si se lo preguntan.»
 *   (`fraseDelPrecio`, modo «si preguntan»).
 * - crear_servicios: «dar de alta el servicio S (20 min, 10 €)» → «Hecho:
 *   he creado S. La recepcionista ya lo ofrece.»
 * - actualizar_informacion: «añadir a lo que sabe la recepcionista «…»» →
 *   «Hecho: la recepcionista ya lo tiene en cuenta en las próximas
 *   llamadas.» (accionesInformacion.ts).
 * - buscar_hueco, dudas_sin_respuesta y resumen_llamadas solo leen
 *   (tools.ts): lo que contesta el Gestor es texto libre del modelo con los
 *   datos que devuelven, sin botones.
 *
 * Los profesionales de cada sector son los de `relato-guiones.ts`, para que
 * no cambien de nombre de una sección a otra. Los móviles empiezan por 79:
 * un rango sin atribuir en el Plan Nacional de Numeración, no son de nadie.
 */

export type Hito = string;

export type Turno =
  /** Lo escribe el dueño: se teclea en tiempo real y se envía. */
  | { de: "dueno"; texto: string }
  /** Lo escribe el Gestor; `seguido`: viene justo detrás de otro mensaje
   * suyo (la pregunta del sistema tras un «Hecho»), casi sin espera.
   * `hito`: una consulta que el panel resalta al leerse (no cambia nada). */
  | { de: "gestor"; texto: string; botones?: [string, string]; seguido?: boolean; hito?: Hito }
  /** El dueño pulsa un botón del mensaje anterior; `hito` es el cambio que
   * ejecuta y que el panel refleja. */
  | { de: "boton"; texto: string; hito?: Hito };

export type CitaAgenda = {
  /** Columna de profesional (0–2) y fila de media hora desde `desdeHora`. */
  col: number;
  fila: number;
  filas: number;
  titulo: string;
  cliente: string;
};

/** La agenda del día por profesional. */
export type VistaAgenda = {
  tipo: "agenda";
  desdeHito?: Hito;
  /** «Miércoles, 30 de septiembre». */
  dia: string;
  /** Hora de la primera fila (9 → 9:00); diez filas de media hora. */
  desdeHora: number;
  profesionales: [string, string, string];
  /** Las citas que no cambian. */
  citas: CitaAgenda[];
  /** Alguien del equipo deja de estar: su columna se raya (entera o un tramo). */
  ausencia?: { col: number; etiqueta: string; fila?: number; filas?: number; hito: Hito };
  /** La cita que cambia (la que se mueve o la que se apunta). */
  cita?: {
    cita: CitaAgenda;
    /** «11:00 – 12:00». */
    horas: string;
    /** Existe desde el principio y, al alcanzar el hito, pasa a otra
     * columna o a otro día (`destino`: «viernes 2 · 16:00»). */
    movida?: { hito: Hito; col?: number; destino?: string };
    /** No existe hasta que se apunta (añadir_cita). */
    nueva?: Hito;
    /** Etiqueta de WhatsApp sobre la cita al alcanzar el hito. */
    whatsapp?: { hito: Hito; etiqueta: string };
  };
};

export type DiaEspecial = { fecha: [string, string]; titulo: string; detalle: string; chip: string };

/** «Tu recepcionista» › Disponibilidad: la semana y los días especiales. */
export type VistaHorario = {
  tipo: "horario";
  desdeHito?: Hito;
  semana: Array<[string, string | null]>;
  especiales: DiaEspecial[];
  nuevo: DiaEspecial & { hito: Hito };
};

export type ServicioFila = { nombre: string; duracion: number; precio: number };

/** «Tu recepcionista» › Catálogo: los servicios con duración y precio. */
export type VistaServicios = {
  tipo: "servicios";
  desdeHito?: Hito;
  servicios: ServicioFila[];
  /** Un servicio cambia de precio o de duración. */
  cambio?: { nombre: string; precio?: number; duracion?: number; hito: Hito };
  /** Un servicio nuevo entra en la lista. */
  nuevo?: ServicioFila & { hito: Hito };
};

/** «Tu recepcionista» › Información del negocio: lo que la recepcionista sabe. */
export type VistaInformacion = {
  tipo: "informacion";
  desdeHito?: Hito;
  lineas: string[];
  nueva: { texto: string; hito: Hito };
};

/** El panel de inicio: las cifras de la semana que el Gestor resume. */
export type VistaResumen = {
  tipo: "resumen";
  desdeHito?: Hito;
  cifras: [string, string][];
  hito: Hito;
};

export type Vista = VistaAgenda | VistaHorario | VistaServicios | VistaInformacion | VistaResumen;

export type Escenario = {
  id: string;
  /** Hora del reloj del teléfono y del portátil al empezar, y el día. */
  reloj: string;
  diaCorto: string;
  turnos: Turno[];
  /** El panel: la primera vista desde el principio y las demás desde su
   * `desdeHito` (dos pantallas en una situación). */
  vistas: Vista[];
  /** Lo que anuncia el panel (y los chips de móvil) al alcanzar un hito.
   * Un hito sin aviso (una consulta) solo resalta la vista. */
  avisos: Record<Hito, { titulo: string; detalle: string }>;
};

export type GuionGestor = {
  /** El negocio de la historia: sale en el panel. */
  negocio: string;
  /** En el orden de `examples` de la landing. */
  escenarios: [Escenario, Escenario, Escenario];
};

/* ── El ritmo ──────────────────────────────────────────────────── */

/**
 * Milisegundos de cada cosa. Más rápido que una conversación real a
 * propósito: el visitante tiene que entender la cadena en segundos. El
 * tiempo de lectura crece con el largo del mensaje; en los que llevan
 * botones es más corto, porque el texto sigue a la vista cuando el dueño
 * pulsa y el «Hecho» que viene detrás es lo que importa.
 */
export const RITMO = {
  /** Cada letra que teclea el dueño. */
  letra: 22,
  /** Entre el último carácter y la burbuja enviada. */
  enviado: 300,
  /** Los puntos de «escribiendo» del Gestor; menos si va seguido. */
  escribiendo: 420,
  escribiendoSeguido: 220,
  /** Lectura: base + por letra, con tope. */
  lecturaBase: 450,
  lecturaPorLetra: 10,
  lecturaMax: 1900,
  /** Con botones: base + por letra (tope) + ver los botones. */
  lecturaConBotonesPorLetra: 6,
  lecturaConBotonesMax: 1350,
  botones: 300,
  /** El botón pulsado, hasta que el Gestor contesta. */
  pulsado: 460,
  /** Antes del primer turno y después del último (el aviso del panel). */
  inicial: 300,
  final: 1400,
} as const;

export type Paso =
  | { turno: number; fase: "tecleando"; letras: number; espera: number }
  | { turno: number; fase: "enviado"; espera: number }
  | { turno: number; fase: "escribiendo"; espera: number }
  | { turno: number; fase: "visible"; espera: number }
  | { turno: number; fase: "pulsado"; espera: number };

/** Los pasos de una situación, en orden; `espera` es lo que pasa después
 * de cada uno. */
export function pasosDe(escenario: Escenario): Paso[] {
  const pasos: Paso[] = [];
  escenario.turnos.forEach((turno, i) => {
    if (turno.de === "dueno") {
      for (let letras = 1; letras <= turno.texto.length; letras++) {
        pasos.push({ turno: i, fase: "tecleando", letras, espera: RITMO.letra });
      }
      pasos.push({ turno: i, fase: "enviado", espera: RITMO.enviado });
      return;
    }
    if (turno.de === "gestor") {
      pasos.push({
        turno: i,
        fase: "escribiendo",
        espera: turno.seguido ? RITMO.escribiendoSeguido : RITMO.escribiendo,
      });
      const letras = turno.texto.length;
      const lectura = turno.botones
        ? Math.min(RITMO.lecturaConBotonesMax, RITMO.lecturaBase + letras * RITMO.lecturaConBotonesPorLetra) + RITMO.botones
        : Math.min(RITMO.lecturaMax, RITMO.lecturaBase + letras * RITMO.lecturaPorLetra);
      pasos.push({ turno: i, fase: "visible", espera: lectura });
      return;
    }
    pasos.push({ turno: i, fase: "pulsado", espera: RITMO.pulsado });
  });
  return pasos;
}

/** Lo que dura una situación entera, con sus pausas. */
export function duracionDe(escenario: Escenario): number {
  return pasosDe(escenario).reduce((total, p) => total + p.espera, RITMO.inicial + RITMO.final);
}

/** Lo que dura una vuelta completa (las tres situaciones). */
export function duracionDelGuion(guion: GuionGestor): number {
  return guion.escenarios.reduce((total, e) => total + duracionDe(e), 0);
}

/** Cuánto ha pasado de la situación (0–1) con `paso` pasos aplicados. */
export function progresoEn(pasos: Paso[], paso: number, total: number): number {
  let transcurrido = RITMO.inicial;
  for (let i = 0; i < Math.min(paso, pasos.length); i++) transcurrido += pasos[i].espera;
  return Math.min(1, transcurrido / total);
}

export type EstadoDeTurno = "oculto" | "tecleando" | "escribiendo" | "visible";

/**
 * Qué se ve de cada turno con `paso` pasos aplicados (0 = nada aún;
 * `pasos.length` = todo), y cuántas letras lleva tecleadas el dueño.
 */
export function estadoDeTurnos(
  escenario: Escenario,
  pasos: Paso[],
  paso: number
): { estados: EstadoDeTurno[]; letras: number } {
  const estados: EstadoDeTurno[] = escenario.turnos.map(() => "oculto");
  let letras = 0;
  for (const p of pasos.slice(0, paso)) {
    if (p.fase === "tecleando") {
      estados[p.turno] = "tecleando";
      letras = p.letras;
    } else if (p.fase === "escribiendo") {
      estados[p.turno] = "escribiendo";
    } else {
      estados[p.turno] = "visible";
      letras = 0;
    }
  }
  return { estados, letras };
}

/** Los hitos ya alcanzados: los botones pulsados que ejecutan algo y las
 * consultas del Gestor ya leídas. */
export function hitosAlcanzados(escenario: Escenario, estados: EstadoDeTurno[]): Hito[] {
  const hitos: Hito[] = [];
  escenario.turnos.forEach((turno, i) => {
    if (turno.de !== "dueno" && turno.hito && estados[i] === "visible") hitos.push(turno.hito);
  });
  return hitos;
}

/** La vista del panel que toca: la última cuyo `desdeHito` ya se alcanzó. */
export function vistaActiva(escenario: Escenario, hitos: Hito[]): Vista {
  let activa = escenario.vistas[0];
  for (const vista of escenario.vistas) {
    if (vista.desdeHito && hitos.includes(vista.desdeHito)) activa = vista;
  }
  return activa;
}

/** La hora de cada burbuja: el reloj de la situación, que avanza un
 * minuto cada pocos turnos, como una conversación de verdad. */
export function horaDelTurno(reloj: string, indice: number): string {
  const [h, m] = reloj.split(":").map(Number);
  const total = h * 60 + m + Math.floor(indice / 4);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/* ── La ausencia, igual en los seis guiones ────────────────────── */

function mayuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * La cadena entera de una ausencia (PRODUCT.md § «Mañana falta Marta»):
 * `marcar_ausencia` → «dime si las movemos» → el dueño dice a quién →
 * `mover_cita` → «¿Le aviso…?» → `avisar_cliente`. Tres «Confirmar», uno
 * por acción; nada se reparte ni se avisa solo.
 */
export function ausenciaDe(c: {
  /** Lo que escribe el dueño: «Marta está de baja hoy». */
  aviso: string;
  profesional: string;
  /** «hoy», «mañana». */
  cuando: string;
  /** El motivo que dio el dueño, si lo dio; va entre paréntesis. */
  motivo?: string;
  /** A quién se pasa, como lo diría el dueño. */
  respuesta: string;
  /** La cita, como la describe el Gestor: «la cita de Rosa M.». */
  cita: string;
  servicio: string;
  hora: string;
  otra: string;
  /** El nombre con el que se avisa al cliente y su móvil. */
  cliente: string;
  telefono: string;
}): Turno[] {
  return [
    { de: "dueno", texto: c.aviso },
    {
      de: "gestor",
      texto: `¿Confirmas? Marcar a ${c.profesional} como ausente ${c.cuando}${c.motivo ? ` (${c.motivo})` : ""}: la recepcionista no le reservará nada. Ojo: ya tiene 1 cita ahí, que no se mueve sola.`,
      botones: ["Confirmar", "Cancelar"],
    },
    { de: "boton", texto: "Confirmar", hito: "ausente" },
    {
      de: "gestor",
      texto: `Hecho: ${c.profesional} no está ${c.cuando}. Tiene 1 cita en ese tramo: dime si las movemos o las cancelamos.`,
    },
    { de: "dueno", texto: c.respuesta },
    {
      de: "gestor",
      texto: `¿Confirmas? Mover ${c.cita} de ${c.cuando} a las ${c.hora} (${c.servicio}) con ${c.profesional}, a la misma hora con ${c.otra}.`,
      botones: ["Confirmar", "Cancelar"],
    },
    { de: "boton", texto: "Confirmar", hito: "movida" },
    {
      de: "gestor",
      texto: `Hecho: ${c.cita} (${c.servicio}) pasa a las ${c.hora} con ${c.otra}. El calendario ya está al día.`,
    },
    {
      de: "gestor",
      texto: `¿Le aviso a ${c.cliente} por WhatsApp de la nueva hora? Si prefieres llamarle tú: ${c.telefono}.`,
      botones: ["Sí, avísale", "Le llamo yo"],
      seguido: true,
    },
    { de: "boton", texto: "Sí, avísale", hito: "avisada" },
    { de: "gestor", texto: `Le aviso a ${c.cliente} al ${c.telefono}.` },
  ];
}

/** Los avisos del panel de una ausencia, con el vocabulario del sector. */
function avisosDeAusencia(c: {
  profesional: string;
  motivo: string;
  cita: string;
  cliente: string;
  hora: string;
  otra: string;
  avisada: string;
}): Escenario["avisos"] {
  return {
    ausente: { titulo: `${c.profesional}, ausente hoy`, detalle: `${mayuscula(c.motivo)} · sin citas nuevas` },
    movida: { titulo: `${mayuscula(c.cita)} → ${c.otra}`, detalle: `${c.cliente} · ${c.hora}` },
    avisada: { titulo: `${c.cliente}, ${c.avisada}`, detalle: "Nueva hora enviada" },
  };
}

const SEMANA_TIPO: VistaHorario["semana"] = [
  ["Lunes", "10:00 – 14:00 · 16:00 – 20:00"],
  ["Martes", "10:00 – 14:00 · 16:00 – 20:00"],
  ["Miércoles", "10:00 – 14:00 · 16:00 – 20:00"],
  ["Jueves", "10:00 – 14:00 · 16:00 – 20:00"],
  ["Viernes", "10:00 – 14:00 · 16:00 – 21:00"],
  ["Sábado", "9:30 – 14:00"],
  ["Domingo", null],
];

const JUEVES_1: DiaEspecial = {
  fecha: ["JUE", "1"],
  titulo: "Jueves 1 de octubre",
  detalle: "10:00 – 14:00 · 16:00 – 18:00",
  chip: "Cierra antes",
};

const LUNES_12: DiaEspecial = {
  fecha: ["LUN", "12"],
  titulo: "Lunes 12 de octubre",
  detalle: "Festivo",
  chip: "Cerrado",
};

/** «El lunes 12 cerramos»: `cerrar_dia`, igual en la portada y en la barbería. */
function cierreDeFestivo(c: { aviso: string; semana: VistaHorario["semana"] }): Escenario {
  return {
    id: "cierre",
    reloj: "20:12",
    diaCorto: "Mié",
    turnos: [
      { de: "dueno", texto: c.aviso },
      {
        de: "gestor",
        texto: "¿Confirmas? Cerrar el lunes 12 de octubre (festivo): la recepcionista no reservará ese día.",
        botones: ["Confirmar", "Cancelar"],
      },
      { de: "boton", texto: "Confirmar", hito: "cerrado" },
      {
        de: "gestor",
        texto:
          "Hecho: el lunes 12 de octubre queda cerrado. Las citas ya reservadas ese día no se cancelan solas: revísalas en la agenda.",
      },
    ],
    vistas: [{ tipo: "horario", semana: c.semana, especiales: [JUEVES_1], nuevo: { ...LUNES_12, hito: "cerrado" } }],
    avisos: { cerrado: { titulo: "Lunes 12 de octubre, cerrado", detalle: "Festivo · día especial" } },
  };
}

/** «El corte sube a 18 €»: `editar_servicio` con precio nuevo. */
function cambioDePrecio(c: {
  aviso: string;
  servicio: string;
  duracion: number;
  antes: number;
  despues: number;
  servicios: ServicioFila[];
}): Escenario {
  return {
    id: "precio",
    reloj: "20:15",
    diaCorto: "Mié",
    turnos: [
      { de: "dueno", texto: c.aviso },
      {
        de: "gestor",
        texto: `¿Confirmas? Cambiar el servicio ${c.servicio}: ${c.despues} €.`,
        botones: ["Confirmar", "Cancelar"],
      },
      { de: "boton", texto: "Confirmar", hito: "precio" },
      {
        de: "gestor",
        texto: `Hecho: ${c.servicio}, ${c.duracion} min, ${c.despues} €. La recepcionista ya lo dice así si se lo preguntan.`,
      },
    ],
    vistas: [
      {
        tipo: "servicios",
        servicios: c.servicios,
        cambio: { nombre: c.servicio, precio: c.despues, hito: "precio" },
      },
    ],
    avisos: {
      precio: { titulo: `${c.servicio}: ${c.despues} €`, detalle: `Antes ${c.antes} € · catálogo al día` },
    },
  };
}

/* ── La portada ────────────────────────────────────────────────── */

const SERVICIOS_PELUQUERIA: ServicioFila[] = [
  { nombre: "Corte caballero", duracion: 30, precio: 15 },
  { nombre: "Corte señora", duracion: 45, precio: 24 },
  { nombre: "Corte y color", duracion: 90, precio: 58 },
  { nombre: "Mechas", duracion: 120, precio: 75 },
  { nombre: "Alisado", duracion: 90, precio: 98 },
  { nombre: "Peinado", duracion: 45, precio: 22 },
];

/** La agenda de una peluquería a media mañana (la ausencia de la portada
 * y la de peluquería comparten el día; cambian los nombres). */
function agendaDePeluqueria(c: {
  profesionales: [string, string, string];
  cita: CitaAgenda;
  horas: string;
}): VistaAgenda {
  return {
    tipo: "agenda",
    dia: "Miércoles, 30 de septiembre",
    desdeHora: 9,
    profesionales: c.profesionales,
    citas: [
      { col: 1, fila: 2, filas: 4, titulo: "Mechas", cliente: "Elena S." },
      { col: 1, fila: 7, filas: 1, titulo: "Corte caballero", cliente: "Sergio P." },
      { col: 2, fila: 1, filas: 3, titulo: "Alisado", cliente: "Rosa M." },
      { col: 2, fila: 8, filas: 2, titulo: "Peinado", cliente: "Paula V." },
    ],
    ausencia: { col: 0, etiqueta: "Ausente hoy", hito: "ausente" },
    cita: {
      cita: c.cita,
      horas: c.horas,
      movida: { hito: "movida", col: 2 },
      whatsapp: { hito: "avisada", etiqueta: "Avisada" },
    },
  };
}

export const GUION_GESTOR_GENERAL: GuionGestor = {
  negocio: "Peluquería Nuria",
  escenarios: [
    {
      id: "ausencia",
      reloj: "8:41",
      diaCorto: "Mié",
      turnos: ausenciaDe({
        aviso: "Marta está de baja hoy",
        profesional: "Marta",
        cuando: "hoy",
        motivo: "baja",
        respuesta: "La de las 11, pásasela a Lucía",
        cita: "la cita de Carmen R.",
        servicio: "Corte y color",
        hora: "11:00",
        otra: "Lucía",
        cliente: "Carmen",
        telefono: "+34 791 32 55 57",
      }),
      vistas: [
        agendaDePeluqueria({
          profesionales: ["Marta", "Ana", "Lucía"],
          cita: { col: 0, fila: 4, filas: 3, titulo: "Corte y color", cliente: "Carmen R." },
          horas: "11:00 – 12:30",
        }),
      ],
      avisos: avisosDeAusencia({
        profesional: "Marta",
        motivo: "baja",
        cita: "la cita de Carmen",
        cliente: "Carmen R.",
        hora: "11:00",
        otra: "Lucía",
        avisada: "avisada",
      }),
    },
    cierreDeFestivo({ aviso: "El lunes 12 cerramos, es festivo", semana: SEMANA_TIPO }),
    cambioDePrecio({
      aviso: "El corte de caballero sube a 18 €",
      servicio: "Corte caballero",
      duracion: 30,
      antes: 15,
      despues: 18,
      servicios: SERVICIOS_PELUQUERIA,
    }),
  ],
};

/* ── Los sectores ──────────────────────────────────────────────── */

const INFORMACION_ESTETICA = [
  "Estamos en la calle Mayor 12, con parking en la plaza.",
  "Se puede pagar con tarjeta y Bizum.",
  "Para un facial, venir sin maquillaje.",
];

const INFORMACION_UNAS = [
  "Estamos en la calle Real 8, junto al mercado.",
  "Pagamos con tarjeta y Bizum.",
  "El nail art se cobra por uña, desde 2 €.",
];

export const GUIONES_GESTOR: Record<NicheSlug, GuionGestor> = {
  peluqueria: {
    negocio: "Peluquería Nuria",
    escenarios: [
      {
        id: "ausencia",
        reloj: "8:41",
        diaCorto: "Mié",
        turnos: ausenciaDe({
          aviso: "Marta está de baja hoy",
          profesional: "Marta",
          cuando: "hoy",
          motivo: "baja",
          respuesta: "Las mechas de las 11, pásaselas a Laura",
          cita: "la cita de Rosa M.",
          servicio: "Mechas",
          hora: "11:00",
          otra: "Laura",
          cliente: "Rosa",
          telefono: "+34 791 58 06 33",
        }),
        vistas: [
          agendaDePeluqueria({
            profesionales: ["Marta", "Ana", "Laura"],
            cita: { col: 0, fila: 4, filas: 4, titulo: "Mechas", cliente: "Rosa M." },
            horas: "11:00 – 13:00",
          }),
        ],
        avisos: avisosDeAusencia({
          profesional: "Marta",
          motivo: "baja",
          cita: "las mechas de Rosa",
          cliente: "Rosa M.",
          hora: "11:00",
          otra: "Laura",
          avisada: "avisada",
        }),
      },
      {
        id: "cita",
        reloj: "13:20",
        diaCorto: "Mié",
        turnos: [
          { de: "dueno", texto: "Apunta a Rosa el jueves 29 a las 5, mechas. Su móvil: 791 58 06 33" },
          {
            de: "gestor",
            texto: "¿Confirmas? Apuntar a Rosa el jueves 29 de octubre a las 17:00, Mechas (120 min) con Marta.",
            botones: ["Confirmar", "Cancelar"],
          },
          { de: "boton", texto: "Confirmar", hito: "apuntada" },
          {
            de: "gestor",
            texto: "Hecho: Rosa queda apuntada el jueves 29 de octubre a las 17:00, Mechas con Marta. Ya está en tu calendario.",
          },
          {
            de: "gestor",
            texto: "¿Le mando a Rosa la confirmación por WhatsApp al +34 791 58 06 33?",
            botones: ["Sí, mándasela", "No"],
            seguido: true,
          },
          { de: "boton", texto: "Sí, mándasela", hito: "confirmada" },
          { de: "gestor", texto: "Le mando a Rosa la confirmación al +34 791 58 06 33." },
        ],
        vistas: [
          {
            tipo: "agenda",
            dia: "Jueves, 29 de octubre",
            desdeHora: 15,
            profesionales: ["Marta", "Ana", "Laura"],
            citas: [
              { col: 1, fila: 0, filas: 3, titulo: "Corte y color", cliente: "Elena S." },
              { col: 2, fila: 2, filas: 2, titulo: "Corte señora", cliente: "Paula V." },
              { col: 0, fila: 0, filas: 2, titulo: "Corte señora", cliente: "Nerea V." },
              { col: 1, fila: 6, filas: 2, titulo: "Peinado", cliente: "Irene C." },
            ],
            cita: {
              cita: { col: 0, fila: 4, filas: 4, titulo: "Mechas", cliente: "Rosa" },
              horas: "17:00 – 19:00",
              nueva: "apuntada",
              whatsapp: { hito: "confirmada", etiqueta: "Confirmación enviada" },
            },
          },
        ],
        avisos: {
          apuntada: { titulo: "Mechas de Rosa, apuntadas", detalle: "Jueves 29 · 17:00 · con Marta" },
          confirmada: { titulo: "Rosa, confirmada", detalle: "Confirmación enviada" },
        },
      },
      cambioDePrecio({
        aviso: "El alisado pasa a 120 €",
        servicio: "Alisado",
        duracion: 90,
        antes: 98,
        despues: 120,
        servicios: SERVICIOS_PELUQUERIA,
      }),
    ],
  },

  "centro-de-estetica": {
    negocio: "Centro de estética Alba",
    escenarios: [
      {
        id: "ausencia",
        reloj: "9:05",
        diaCorto: "Mié",
        turnos: ausenciaDe({
          aviso: "Sara no puede venir hoy",
          profesional: "Sara",
          cuando: "hoy",
          respuesta: "El facial de las 12, a Elena",
          cita: "la cita de Inés G.",
          servicio: "Facial con peeling",
          hora: "12:00",
          otra: "Elena",
          cliente: "Inés",
          telefono: "+34 794 52 18 60",
        }),
        vistas: [
          {
            tipo: "agenda",
            dia: "Miércoles, 30 de septiembre",
            desdeHora: 9,
            profesionales: ["Sara", "Paula", "Elena"],
            citas: [
              { col: 1, fila: 1, filas: 2, titulo: "Higiene facial", cliente: "Lorena G." },
              { col: 1, fila: 5, filas: 2, titulo: "Masaje relajante", cliente: "Marina F." },
              { col: 2, fila: 0, filas: 2, titulo: "Depilación láser", cliente: "Silvia R." },
              { col: 2, fila: 3, filas: 2, titulo: "Presoterapia", cliente: "Beatriz N." },
            ],
            ausencia: { col: 0, etiqueta: "Ausente hoy", hito: "ausente" },
            cita: {
              cita: { col: 0, fila: 6, filas: 3, titulo: "Facial con peeling", cliente: "Inés G." },
              horas: "12:00 – 13:15",
              movida: { hito: "movida", col: 2 },
              whatsapp: { hito: "avisada", etiqueta: "Avisada" },
            },
          },
        ],
        avisos: avisosDeAusencia({
          profesional: "Sara",
          motivo: "no viene",
          cita: "el facial de Inés",
          cliente: "Inés G.",
          hora: "12:00",
          otra: "Elena",
          avisada: "avisada",
        }),
      },
      {
        id: "mover",
        reloj: "15:48",
        diaCorto: "Mié",
        turnos: [
          { de: "dueno", texto: "Pasa la presoterapia de Beatriz al viernes a la misma hora" },
          {
            de: "gestor",
            texto:
              "¿Confirmas? Mover la cita de Beatriz N. de hoy a las 16:30 (Presoterapia) al viernes 2 de octubre a las 16:30 con Paula.",
            botones: ["Confirmar", "Cancelar"],
          },
          { de: "boton", texto: "Confirmar", hito: "movida" },
          {
            de: "gestor",
            texto:
              "Hecho: la cita de Beatriz N. (Presoterapia) pasa al viernes 2 de octubre a las 16:30 con Paula. El calendario ya está al día.",
          },
          {
            de: "gestor",
            texto: "¿Le aviso a Beatriz por WhatsApp de la nueva hora? Si prefieres llamarle tú: +34 794 61 08 25.",
            botones: ["Sí, avísale", "Le llamo yo"],
            seguido: true,
          },
          { de: "boton", texto: "Sí, avísale", hito: "avisada" },
          { de: "gestor", texto: "Le aviso a Beatriz al +34 794 61 08 25." },
        ],
        vistas: [
          {
            tipo: "agenda",
            dia: "Miércoles, 30 de septiembre",
            desdeHora: 15,
            profesionales: ["Sara", "Paula", "Elena"],
            citas: [
              { col: 0, fila: 0, filas: 3, titulo: "Facial con peeling", cliente: "Cristina P." },
              { col: 0, fila: 5, filas: 2, titulo: "Depilación láser", cliente: "Silvia R." },
              { col: 2, fila: 1, filas: 2, titulo: "Masaje relajante", cliente: "Marina F." },
              { col: 2, fila: 6, filas: 2, titulo: "Higiene facial", cliente: "Lorena G." },
            ],
            cita: {
              cita: { col: 1, fila: 3, filas: 2, titulo: "Presoterapia", cliente: "Beatriz N." },
              horas: "16:30 – 17:15",
              movida: { hito: "movida", destino: "viernes 2 · 16:30" },
              whatsapp: { hito: "avisada", etiqueta: "Avisada" },
            },
          },
        ],
        avisos: {
          movida: { titulo: "Presoterapia de Beatriz → viernes", detalle: "Viernes 2 · 16:30 · con Paula" },
          avisada: { titulo: "Beatriz N., avisada", detalle: "Nueva hora enviada" },
        },
      },
      {
        id: "ensenar",
        reloj: "20:05",
        diaCorto: "Mié",
        turnos: [
          { de: "dueno", texto: "Dile que los bonos se pagan en el centro, no por teléfono" },
          {
            de: "gestor",
            texto: "¿Confirmas? Añadir a lo que sabe la recepcionista «Los bonos se pagan en el centro, no por teléfono».",
            botones: ["Confirmar", "Cancelar"],
          },
          { de: "boton", texto: "Confirmar", hito: "ensenado" },
          { de: "gestor", texto: "Hecho: la recepcionista ya lo tiene en cuenta en las próximas llamadas." },
        ],
        vistas: [
          {
            tipo: "informacion",
            lineas: INFORMACION_ESTETICA,
            nueva: { texto: "Los bonos se pagan en el centro, no por teléfono.", hito: "ensenado" },
          },
        ],
        avisos: {
          ensenado: { titulo: "La recepcionista ya lo sabe", detalle: "Bonos: se pagan en el centro" },
        },
      },
    ],
  },

  "salon-de-unas": {
    negocio: "Estudio de uñas Vega",
    escenarios: [
      {
        id: "ausencia",
        reloj: "9:12",
        diaCorto: "Mié",
        turnos: ausenciaDe({
          aviso: "Laura tiene hoy el día libre",
          profesional: "Laura",
          cuando: "hoy",
          motivo: "día libre",
          respuesta: "La semipermanente de las 11, que la haga Noa",
          cita: "la cita de Carla D.",
          servicio: "Semipermanente",
          hora: "11:00",
          otra: "Noa",
          cliente: "Carla",
          telefono: "+34 793 40 72 19",
        }),
        vistas: [
          {
            tipo: "agenda",
            dia: "Miércoles, 30 de septiembre",
            desdeHora: 9,
            profesionales: ["Laura", "Julia", "Noa"],
            citas: [
              { col: 1, fila: 0, filas: 3, titulo: "Uñas de gel", cliente: "Irene C." },
              { col: 1, fila: 6, filas: 2, titulo: "Pedicura spa", cliente: "Marta B." },
              { col: 2, fila: 1, filas: 2, titulo: "Relleno de gel", cliente: "Sofía L." },
              { col: 2, fila: 7, filas: 1, titulo: "Manicura clásica", cliente: "Nerea V." },
            ],
            ausencia: { col: 0, etiqueta: "Ausente hoy", hito: "ausente" },
            cita: {
              cita: { col: 0, fila: 4, filas: 2, titulo: "Semipermanente", cliente: "Carla D." },
              horas: "11:00 – 12:00",
              movida: { hito: "movida", col: 2 },
              whatsapp: { hito: "avisada", etiqueta: "Avisada" },
            },
          },
        ],
        avisos: avisosDeAusencia({
          profesional: "Laura",
          motivo: "día libre",
          cita: "la semipermanente de Carla",
          cliente: "Carla D.",
          hora: "11:00",
          otra: "Noa",
          avisada: "avisada",
        }),
      },
      {
        id: "dudas",
        reloj: "20:40",
        diaCorto: "Mié",
        turnos: [
          { de: "dueno", texto: "¿Qué te han preguntado hoy que no supieras?" },
          {
            de: "gestor",
            texto: "Hoy, una cosa, dos veces: si hacéis uñas press-on. ¿Se lo enseño? Dime qué les contesto.",
          },
          { de: "dueno", texto: "Sí, hacemos press-on: 35 € y con cita" },
          {
            de: "gestor",
            texto: "¿Confirmas? Añadir a lo que sabe la recepcionista «Hacemos uñas press-on: 35 €, con cita previa».",
            botones: ["Confirmar", "Cancelar"],
          },
          { de: "boton", texto: "Confirmar", hito: "ensenado" },
          { de: "gestor", texto: "Hecho: la recepcionista ya lo tiene en cuenta en las próximas llamadas." },
        ],
        vistas: [
          {
            tipo: "informacion",
            lineas: INFORMACION_UNAS,
            nueva: { texto: "Hacemos uñas press-on: 35 €, con cita previa.", hito: "ensenado" },
          },
        ],
        avisos: {
          ensenado: { titulo: "Press-on: ya lo contesta", detalle: "35 € · con cita previa" },
        },
      },
      {
        id: "servicio",
        reloj: "20:44",
        diaCorto: "Mié",
        turnos: [
          { de: "dueno", texto: "Añade retirada de acrílico, 20 minutos, 10 €" },
          {
            de: "gestor",
            texto: "¿Confirmas? Dar de alta el servicio Retirada de acrílico (20 min, 10 €).",
            botones: ["Confirmar", "Cancelar"],
          },
          { de: "boton", texto: "Confirmar", hito: "creado" },
          { de: "gestor", texto: "Hecho: he creado Retirada de acrílico. La recepcionista ya lo ofrece." },
        ],
        vistas: [
          {
            tipo: "servicios",
            servicios: [
              { nombre: "Manicura clásica", duracion: 30, precio: 18 },
              { nombre: "Semipermanente", duracion: 45, precio: 28 },
              { nombre: "Uñas de gel", duracion: 90, precio: 45 },
              { nombre: "Relleno de gel", duracion: 60, precio: 30 },
              { nombre: "Pedicura spa", duracion: 60, precio: 35 },
              { nombre: "Nail art", duracion: 30, precio: 12 },
            ],
            nuevo: { nombre: "Retirada de acrílico", duracion: 20, precio: 10, hito: "creado" },
          },
        ],
        avisos: {
          creado: { titulo: "Retirada de acrílico, en la carta", detalle: "20 min · 10 € · ya se ofrece" },
        },
      },
    ],
  },

  barberia: {
    negocio: "Barbería Santos",
    escenarios: [
      {
        id: "ausencia",
        reloj: "9:30",
        diaCorto: "Mié",
        turnos: ausenciaDe({
          aviso: "Hoy Luis no viene, está malo",
          profesional: "Luis",
          cuando: "hoy",
          motivo: "está malo",
          respuesta: "El de las 12, pásaselo a Dani",
          cita: "la cita de Javier M.",
          servicio: "Corte y barba",
          hora: "12:00",
          otra: "Dani",
          cliente: "Javier",
          telefono: "+34 792 18 40 63",
        }),
        vistas: [
          {
            tipo: "agenda",
            dia: "Miércoles, 30 de septiembre",
            desdeHora: 9,
            profesionales: ["Luis", "Sergio", "Dani"],
            citas: [
              { col: 1, fila: 0, filas: 1, titulo: "Corte clásico", cliente: "Álex R." },
              { col: 1, fila: 3, filas: 2, titulo: "Corte y barba", cliente: "Marcos P." },
              { col: 1, fila: 8, filas: 1, titulo: "Arreglo de barba", cliente: "Iván S." },
              { col: 2, fila: 1, filas: 1, titulo: "Corte degradado", cliente: "Hugo L." },
              { col: 2, fila: 8, filas: 1, titulo: "Corte infantil", cliente: "Leo R." },
            ],
            ausencia: { col: 0, etiqueta: "Ausente hoy", hito: "ausente" },
            cita: {
              cita: { col: 0, fila: 6, filas: 2, titulo: "Corte y barba", cliente: "Javier M." },
              horas: "12:00 – 12:45",
              movida: { hito: "movida", col: 2 },
              whatsapp: { hito: "avisada", etiqueta: "Avisado" },
            },
          },
        ],
        avisos: avisosDeAusencia({
          profesional: "Luis",
          motivo: "está malo",
          cita: "el corte y barba de Javier",
          cliente: "Javier M.",
          hora: "12:00",
          otra: "Dani",
          avisada: "avisado",
        }),
      },
      {
        id: "hueco",
        reloj: "18:36",
        diaCorto: "Mié",
        turnos: [
          { de: "dueno", texto: "¿Hay hueco mañana a las 6 para un corte y barba?" },
          {
            de: "gestor",
            texto: "Sí: mañana jueves a las 18:00 hay hueco para corte y barba (45 min), con Dani libre. ¿Te lo apunto?",
          },
          { de: "dueno", texto: "Apúntale a Javier" },
          {
            de: "gestor",
            texto: "¿Confirmas? Apuntar a Javier el jueves 1 de octubre a las 18:00, Corte y barba (45 min) con Dani.",
            botones: ["Confirmar", "Cancelar"],
          },
          { de: "boton", texto: "Confirmar", hito: "apuntada" },
          {
            de: "gestor",
            texto: "Hecho: Javier queda apuntado el jueves 1 de octubre a las 18:00, Corte y barba con Dani. Ya está en tu calendario.",
          },
        ],
        vistas: [
          {
            tipo: "agenda",
            dia: "Jueves, 1 de octubre",
            desdeHora: 16,
            profesionales: ["Luis", "Sergio", "Dani"],
            citas: [
              { col: 0, fila: 0, filas: 1, titulo: "Corte clásico", cliente: "Álex R." },
              { col: 0, fila: 4, filas: 2, titulo: "Corte y barba", cliente: "Marcos P." },
              { col: 1, fila: 1, filas: 1, titulo: "Corte degradado", cliente: "Hugo L." },
              { col: 1, fila: 5, filas: 1, titulo: "Afeitado a navaja", cliente: "Iván S." },
              { col: 2, fila: 0, filas: 2, titulo: "Corte y barba", cliente: "Leo R." },
              { col: 2, fila: 7, filas: 1, titulo: "Corte infantil", cliente: "Pau M." },
            ],
            cita: {
              cita: { col: 2, fila: 4, filas: 2, titulo: "Corte y barba", cliente: "Javier" },
              horas: "18:00 – 18:45",
              nueva: "apuntada",
            },
          },
        ],
        avisos: {
          apuntada: { titulo: "Javier, apuntado con Dani", detalle: "Jueves 1 · 18:00 · corte y barba" },
        },
      },
      cierreDeFestivo({
        aviso: "El lunes 12 cerramos, festivo",
        semana: [
          ["Lunes", null],
          ["Martes", "10:00 – 14:00 · 16:30 – 20:30"],
          ["Miércoles", "10:00 – 14:00 · 16:30 – 20:30"],
          ["Jueves", "10:00 – 14:00 · 16:30 – 20:30"],
          ["Viernes", "10:00 – 14:00 · 16:30 – 21:00"],
          ["Sábado", "9:00 – 15:00"],
          ["Domingo", null],
        ],
      }),
    ],
  },

  fisioterapia: {
    negocio: "Fisioterapia Rivas",
    escenarios: [
      {
        id: "ausencia",
        reloj: "8:50",
        diaCorto: "Mié",
        turnos: ausenciaDe({
          aviso: "Pablo está de baja hoy",
          profesional: "Pablo",
          cuando: "hoy",
          motivo: "baja",
          respuesta: "La sesión de las 11, que la lleve Irene",
          cita: "la cita de Andrés L.",
          servicio: "Sesión de seguimiento",
          hora: "11:00",
          otra: "Irene",
          cliente: "Andrés",
          telefono: "+34 795 40 12 86",
        }),
        vistas: [
          {
            tipo: "agenda",
            dia: "Miércoles, 30 de septiembre",
            desdeHora: 9,
            profesionales: ["Pablo", "Clara", "Irene"],
            citas: [
              { col: 1, fila: 0, filas: 2, titulo: "Primera visita", cliente: "Teresa M." },
              { col: 1, fila: 5, filas: 2, titulo: "Rehabilitación", cliente: "Jorge A." },
              { col: 2, fila: 1, filas: 1, titulo: "Punción seca", cliente: "Nuria S." },
              { col: 2, fila: 7, filas: 2, titulo: "Masaje deportivo", cliente: "Óscar B." },
            ],
            ausencia: { col: 0, etiqueta: "Ausente hoy", hito: "ausente" },
            cita: {
              cita: { col: 0, fila: 4, filas: 2, titulo: "Sesión de seguimiento", cliente: "Andrés L." },
              horas: "11:00 – 11:45",
              movida: { hito: "movida", col: 2 },
              whatsapp: { hito: "avisada", etiqueta: "Avisado" },
            },
          },
        ],
        avisos: avisosDeAusencia({
          profesional: "Pablo",
          motivo: "baja",
          cita: "la sesión de Andrés",
          cliente: "Andrés L.",
          hora: "11:00",
          otra: "Irene",
          avisada: "avisado",
        }),
      },
      {
        id: "manana",
        reloj: "14:10",
        diaCorto: "Mié",
        turnos: [
          { de: "dueno", texto: "Irene no está el jueves de 9 a 12, tiene formación" },
          {
            de: "gestor",
            texto:
              "¿Confirmas? Marcar a Irene como ausente el jueves 1 de octubre de 09:00 a 12:00 (formación): la recepcionista no le reservará nada en ese tramo.",
            botones: ["Confirmar", "Cancelar"],
          },
          { de: "boton", texto: "Confirmar", hito: "ausente" },
          {
            de: "gestor",
            texto: "Hecho: Irene no está el jueves 1 de octubre de 09:00 a 12:00; la recepcionista no le reservará nada ahí.",
          },
        ],
        vistas: [
          {
            tipo: "agenda",
            dia: "Jueves, 1 de octubre",
            desdeHora: 9,
            profesionales: ["Pablo", "Clara", "Irene"],
            citas: [
              { col: 0, fila: 0, filas: 2, titulo: "Primera visita", cliente: "Marta B." },
              { col: 0, fila: 4, filas: 2, titulo: "Sesión de seguimiento", cliente: "Jorge A." },
              { col: 1, fila: 1, filas: 2, titulo: "Rehabilitación", cliente: "Teresa M." },
              { col: 1, fila: 6, filas: 1, titulo: "Punción seca", cliente: "Nuria S." },
              { col: 2, fila: 7, filas: 2, titulo: "Masaje deportivo", cliente: "Óscar B." },
            ],
            ausencia: { col: 2, etiqueta: "Ausente 9–12 · formación", fila: 0, filas: 6, hito: "ausente" },
          },
        ],
        avisos: {
          ausente: { titulo: "Irene, fuera el jueves de 9 a 12", detalle: "Formación · sin citas en ese tramo" },
        },
      },
      {
        id: "semana",
        reloj: "21:02",
        diaCorto: "Vie",
        turnos: [
          { de: "dueno", texto: "¿Cuántas llamadas y citas llevamos esta semana?" },
          {
            de: "gestor",
            texto:
              "Esta semana, 39 llamadas: 31 resueltas, 5 con recado y 3 derivadas a la clínica. 34 citas reservadas y 2 canceladas. Te queda 1 cita pendiente de resolver y ningún recado sin atender.",
            hito: "resumen",
          },
          { de: "dueno", texto: "Y el seguimiento pasa a 50 minutos" },
          {
            de: "gestor",
            texto: "¿Confirmas? Cambiar el servicio Sesión de seguimiento: 50 min.",
            botones: ["Confirmar", "Cancelar"],
          },
          { de: "boton", texto: "Confirmar", hito: "duracion" },
          { de: "gestor", texto: "Hecho: Sesión de seguimiento, 50 min, 45 €." },
        ],
        vistas: [
          {
            tipo: "resumen",
            cifras: [
              ["Llamadas atendidas", "39"],
              ["Citas reservadas", "34"],
              ["Citas canceladas", "2"],
              ["Pendientes de resolver", "1"],
            ],
            hito: "resumen",
          },
          {
            tipo: "servicios",
            desdeHito: "duracion",
            servicios: [
              { nombre: "Primera visita", duracion: 60, precio: 55 },
              { nombre: "Sesión de seguimiento", duracion: 45, precio: 45 },
              { nombre: "Punción seca", duracion: 30, precio: 35 },
              { nombre: "Rehabilitación", duracion: 45, precio: 45 },
              { nombre: "Masaje deportivo", duracion: 60, precio: 50 },
              { nombre: "Suelo pélvico", duracion: 45, precio: 50 },
            ],
            cambio: { nombre: "Sesión de seguimiento", duracion: 50, hito: "duracion" },
          },
        ],
        avisos: {
          duracion: { titulo: "Seguimiento: 50 minutos", detalle: "Antes 45 min · catálogo al día" },
        },
      },
    ],
  },
};

/** El guion de una landing: el de su sector, o el general en la portada. */
export function guionDelGestor(sector?: NicheSlug): GuionGestor {
  return sector ? GUIONES_GESTOR[sector] : GUION_GESTOR_GENERAL;
}
