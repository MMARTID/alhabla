import type { BusinessType } from "../businessType.js";

/**
 * Lo que cambia de la recepcionista según el sector (F4 de
 * PLAN-PROMPT-DINAMICO.md). Abrir un sector nuevo es añadir su slug en
 * BUSINESS_TYPES y un perfil aquí, no una rama de código: el prompt, el
 * saludo, la detección por Google Places y la etiqueta del Gestor salen de
 * él.
 *
 * Los textos de los seis sectores de antes son los que ya tenía el prompt,
 * letra por letra (sus instantáneas no cambian); los tres nuevos (pestañas
 * y cejas, spa y masajes, peluquería canina) son los que la web ya vendía y
 * en el alta caían en «Otros».
 */
export interface PerfilDeSector {
  /** Como lo ve el dueño: Ajustes, el Gestor, el nombre del agente. */
  etiqueta: string;
  /** Qué preguntar además de los datos de la reserva y qué no prometer; va
   * en «## Límites» del prompt. */
  pautas: string;
  /** El saludo de un cliente conocido no nombra su último servicio: puede
   * ser un dato de salud y el teléfono puede usarlo otra persona de la casa
   * (contextoDeLlamada.ts). */
  datoSensible: boolean;
  /** Trozos de los `types` de Google Places que lo identifican, mirados en
   * el orden de ORDEN_DE_DETECCION_EN_PLACES. */
  palabrasDePlaces: readonly string[];
  /** Ejemplos de «## Lo que ofrece el negocio»: preguntas de sí o no y
   * tres nombres del mismo servicio en idiomas distintos. */
  catalogo: {
    preguntas: string;
    sinonimos: string;
  };
}

/** Los ejemplos del catálogo con los que se midió (288 de 288 primeras
 * respuestas, 07-10): los sectores de antes los conservan. */
const CATALOGO_DE_SIEMPRE = {
  preguntas: "«¿hacéis mechas?», «do you do beard trims?»",
  sinonimos: "highlights, metxes y mechas",
} as const;

export const PERFILES_DE_SECTOR: Readonly<
  Record<BusinessType, PerfilDeSector>
> = {
  peluqueria: {
    etiqueta: "Peluquería",
    pautas:
      'Si la petición es ambigua (por ejemplo, "quiero cambiar de look"), pregunta primero si busca corte, color o peinado. Si ya sabe lo que quiere, no le interrogues de nuevo. Para trabajos técnicos o dudas sobre el resultado, no prometas un resultado: ofrece una valoración o que el equipo le oriente.',
    datoSensible: false,
    palabrasDePlaces: ["hair_care", "hair_salon"],
    catalogo: CATALOGO_DE_SIEMPRE,
  },
  "centro-de-estetica": {
    etiqueta: "Centro de estética",
    pautas:
      "Aclara el tratamiento que busca y pregunta si es la primera vez únicamente cuando sea relevante para una valoración previa. No asegures resultados estéticos ni aconsejes sobre contraindicaciones: si la duda requiere valoración profesional, toma el recado o ofrece que el centro contacte con la persona.",
    datoSensible: true,
    // «spa» es de spa y masajes, que se mira después.
    palabrasDePlaces: ["beauty_salon"],
    catalogo: CATALOGO_DE_SIEMPRE,
  },
  "salon-de-unas": {
    etiqueta: "Salón de uñas",
    pautas:
      "Aclara solo si es manicura o pedicura, el acabado principal y, cuando aplique, si es una aplicación nueva, mantenimiento o retirada. Si el servicio está claro, pasa a la cita sin repasar todos los acabados ni decoraciones posibles.",
    datoSensible: false,
    palabrasDePlaces: ["nail_salon", "nail"],
    catalogo: CATALOGO_DE_SIEMPRE,
  },
  barberia: {
    etiqueta: "Barbería",
    pautas:
      "Aclara solo lo necesario entre corte, barba o ambos. Si pide un estilo sin concretar, pregunta una sola preferencia útil (por ejemplo, si quiere mantener largo o un degradado); no recomiendes ni prometas un resultado técnico que el barbero deba valorar en persona.",
    datoSensible: false,
    palabrasDePlaces: ["barber_shop", "barber"],
    catalogo: CATALOGO_DE_SIEMPRE,
  },
  fisioterapia: {
    etiqueta: "Fisioterapia",
    // El motivo en términos generales a propósito: no se piden datos de
    // salud estructurados.
    pautas:
      "Pregunta el motivo de la consulta en términos generales (primera visita, seguimiento, rehabilitación o descarga), sin solicitar historial clínico ni detalles médicos innecesarios. No diagnostiques, no pautes ejercicios ni afirmes qué lesión tiene. Si describe una urgencia clara, indícale que contacte con emergencias o un profesional sanitario sin demorar esa atención.",
    datoSensible: true,
    // Sin «health»: casaba con cualquier sanitario (un dentista salía fisio).
    palabrasDePlaces: ["physiotherapist"],
    catalogo: CATALOGO_DE_SIEMPRE,
  },
  "pestanas-y-cejas": {
    etiqueta: "Pestañas y cejas",
    pautas:
      "Aclara si busca pestañas (extensiones, lifting o tinte) o cejas (diseño, laminado o tinte) y, cuando aplique, si es un juego nuevo, un relleno o una retirada. No prometas un relleno sobre el trabajo de otro centro ni un resultado concreto: si el catálogo no lo aclara, ofrece que el estudio se lo confirme. No aconsejes sobre alergias ni sobre los ojos: si lo pregunta, ofrece que el equipo le oriente.",
    datoSensible: false,
    // Google no tiene un tipo propio: se elige en el alta.
    palabrasDePlaces: [],
    catalogo: {
      preguntas: "«¿hacéis lifting de pestañas?», «do you do brow lamination?»",
      sinonimos: "lash lift, lifting de pestanyes y lifting de pestañas",
    },
  },
  "spa-y-masajes": {
    etiqueta: "Spa y masajes",
    pautas:
      "Aclara qué masaje o tratamiento busca y si es para una persona o para dos a la vez; para dos, reserva solo si el catálogo tiene ese servicio y, si no, ofrece que el centro se lo confirme. No aconsejes sobre contraindicaciones, embarazo o lesiones ni prometas efectos terapéuticos: si la duda requiere valoración, toma el recado o ofrece que el centro contacte con la persona.",
    datoSensible: true,
    palabrasDePlaces: ["massage", "spa"],
    catalogo: {
      preguntas: "«¿hacéis masaje con piedras?», «do you do reflexology?»",
      sinonimos:
        "hot stone massage, massatge amb pedres y masaje con piedras calientes",
    },
  },
  "peluqueria-canina": {
    etiqueta: "Peluquería canina",
    pautas:
      "Aclara qué necesita (baño, corte, deslanado...) y pregunta la raza o el tamaño del perro solo si el catálogo distingue servicios o duraciones por tamaño. La reserva va a nombre de la persona, no del perro. No des consejos veterinarios ni opines sobre la salud del animal: si lo pregunta, dile que lo consulte con su veterinario o con el equipo.",
    datoSensible: false,
    palabrasDePlaces: ["pet_groom", "pet_care"],
    catalogo: {
      preguntas: "«¿bañáis perros grandes?», «do you do dog grooming?»",
      sinonimos: "dog grooming, perruqueria canina y peluquería canina",
    },
  },
  other: {
    etiqueta: "Otros",
    pautas:
      "Aclara con una pregunta breve qué necesita antes de hablar de una cita. Si no existe un servicio verificable que encaje, no lo inventes: toma un recado o propone que el equipo le contacte.",
    datoSensible: true,
    palabrasDePlaces: [],
    catalogo: CATALOGO_DE_SIEMPRE,
  },
};

/**
 * De más específico a más genérico: gana el primero cuyas palabras casen
 * con un `type` de la ficha. Barbería antes que peluquería (una barbería
 * también trae `hair_care`) y la peluquería canina también. Estética antes
 * que spa: una ficha con `beauty_salon` y `spa` sigue siendo estética, como
 * hasta ahora; un spa entra por su `primaryType` (detectBusinessTypeFromPlace).
 */
export const ORDEN_DE_DETECCION_EN_PLACES: readonly BusinessType[] = [
  "barberia",
  "salon-de-unas",
  "peluqueria-canina",
  "peluqueria",
  "centro-de-estetica",
  "spa-y-masajes",
  "fisioterapia",
];
