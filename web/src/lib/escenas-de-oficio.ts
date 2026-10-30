import type { SectorSlug } from "@/lib/sectores/tipos";

/**
 * Las escenas del oficio de la portada (components/escenas-de-oficio.tsx):
 * una por sector, en el orden del menú (lib/sectores/index.ts). Cada una es
 * el segundo en que suena el teléfono en ese oficio y la cita que sale de la
 * llamada; al desplegarse, una cosa que Alhabla hace de verdad en él.
 *
 * Quien llama, el servicio y el profesional son los del guion de su landing
 * (`GUIONES_SECTOR` en lib/relato-guiones.ts), para que la clienta de la
 * portada sea la misma que llama en la landing. La hora cambia de una a otra
 * (siempre jueves, porque piden «mañana»): ocho citas a la misma hora se
 * leían como una plantilla repetida.
 *
 * Cada `detalle` sale de lo que hace el producto: el reparto por
 * especialidad, la regla de quien piden por su nombre, la capacidad del
 * negocio, las preguntas que el prompt del oficio permite y las que no
 * (fisioterapia no pide historial ni detalles médicos). Va tuteando a la
 * dueña y no en primera persona, que se leería como un testimonio que no
 * tenemos. tests/lib/escenas-de-oficio.test.ts vigila los límites.
 */
export type EscenaDeOficio = {
  /** El de la landing: la tarjeta entera lleva a `/${slug}`. */
  slug: SectorSlug;
  /** Plural, como en el menú: «Peluquerías». */
  oficio: string;
  /** ≤ 6 palabras: qué tiene entre manos cuando suena. Sigue a «Suena y
   * estás», con la inicial en minúscula (`enFrase`). */
  momento: string;
  /** Quien llama y su primera frase (≤ 12 palabras). */
  llamada: { quien: string; dice: string };
  /** La cita que sale: servicio, «Jue 10:00» y con quién. */
  cita: { servicio: string; cuando: string; con: string };
  /** ≤ 18 palabras: lo que se despliega, dicho como lo diría la dueña. */
  detalle: string;
  /** ≤ 4 palabras: el texto del enlace a la landing. */
  enlace: string;
};

export const ESCENAS_DE_OFICIO: readonly EscenaDeOficio[] = [
  {
    slug: "peluqueria",
    oficio: "Peluquerías",
    momento: "Con el tinte a media cabeza",
    llamada: {
      quien: "Carmen R.",
      dice: "Hola, ¿tenéis hueco mañana para corte y color?",
    },
    cita: { servicio: "Corte y color", cuando: "Jue 10:00", con: "Marta" },
    detalle:
      "Reserva el color con tu colorista y solo en huecos donde cabe entero.",
    enlace: "Ver peluquerías",
  },
  {
    slug: "barberia",
    oficio: "Barberías",
    momento: "A mitad de un degradado",
    llamada: {
      quien: "Javier M.",
      dice: "Oye, ¿me podéis hacer corte y barba mañana?",
    },
    cita: { servicio: "Corte y barba", cuando: "Jue 20:00", con: "Luis" },
    detalle:
      "Respeta el barbero que piden: si es Luis, busca hora solo con Luis.",
    enlace: "Ver barberías",
  },
  {
    slug: "centro-de-estetica",
    oficio: "Centros de estética",
    momento: "Con cera caliente en la espátula",
    llamada: {
      quien: "Cristina P.",
      dice: "¿Queda algo mañana para un facial con peeling?",
    },
    cita: { servicio: "Facial con peeling", cuando: "Jue 12:30", con: "Sara" },
    detalle:
      "Cuenta tus tratamientos como tú los has escrito; de salud no opina, te deja recado.",
    enlace: "Ver centros de estética",
  },
  {
    slug: "salon-de-unas",
    oficio: "Salones de uñas",
    momento: "Con la lámpara de gel encendida",
    llamada: {
      quien: "Paula D.",
      dice: "Buenas, quiero una semipermanente en manos mañana, ¿hay hora?",
    },
    cita: {
      servicio: "Manicura semipermanente",
      cuando: "Jue 18:15",
      con: "Laura",
    },
    detalle:
      "Si no queda claro, pregunta si es nueva, mantenimiento o retirada, para dar el tiempo justo.",
    enlace: "Ver salones de uñas",
  },
  {
    slug: "fisioterapia",
    oficio: "Clínicas de fisioterapia",
    momento: "En mitad de una punción seca",
    llamada: {
      quien: "Andrés L.",
      dice: "Hola, quería una primera consulta para mañana, ¿hay hueco?",
    },
    cita: { servicio: "Primera consulta", cuando: "Jue 17:30", con: "Pablo" },
    detalle:
      "Pregunta lo justo (primera visita o seguimiento) y no pide historial ni detalles médicos.",
    enlace: "Ver clínicas de fisioterapia",
  },
  {
    slug: "pestanas-y-cejas",
    oficio: "Pestañas y cejas",
    momento: "Pegando extensiones pelo a pelo",
    llamada: {
      quien: "Irene G.",
      dice: "Necesito un relleno de pestañas, ¿tenéis algo mañana?",
    },
    cita: {
      servicio: "Relleno de pestañas",
      cuando: "Jue 16:00",
      con: "Nerea",
    },
    detalle:
      "Tu regla de rellenos (por ejemplo, solo sobre pestañas tuyas) se la explica a quien pide uno.",
    enlace: "Ver pestañas y cejas",
  },
  {
    slug: "spa-y-masajes",
    oficio: "Spas y masajes",
    momento: "Con las manos llenas de aceite",
    llamada: {
      quien: "Sonia O.",
      dice: "Quería reservar el ritual de chocolate para mañana.",
    },
    cita: {
      servicio: "Ritual de chocolate",
      cuando: "Jue 19:00",
      con: "Lucía",
    },
    detalle: "Con dos cabinas, no te mete tres masajes a la misma hora.",
    enlace: "Ver spas y masajes",
  },
  {
    slug: "peluqueria-canina",
    oficio: "Peluquerías caninas",
    momento: "Con un perro lleno de espuma",
    llamada: {
      quien: "Lucía P.",
      dice: "¿Podéis bañar mañana a mi caniche mediano?",
    },
    cita: { servicio: "Baño perro mediano", cuando: "Jue 11:30", con: "Álex" },
    detalle:
      "Con un servicio por tamaño, pregunta cómo es el perro antes de darle hora.",
    enlace: "Ver peluquerías caninas",
  },
];

/** «Con el tinte…» → «con el tinte…», para que siga a «Suena y estás». */
export function enFrase(momento: string): string {
  return momento.charAt(0).toLocaleLowerCase("es-ES") + momento.slice(1);
}
