import type { Turno } from "@/lib/gestor-guiones";
import type { NicheAccent, NicheSlug } from "@/lib/niche-landings";

/**
 * Los datos de una landing de sector («Las preguntas de la dueña», ver
 * PLAN-WEB-CONTENIDO.md): un fichero por sector en esta carpeta, que se
 * escribe sin tocar nada común. La plantilla (components/site-landing.tsx)
 * pinta siempre los mismos ocho bloques en el mismo orden; lo que cambia de
 * un oficio a otro está aquí. tests/lib/sectores.test.ts vigila los límites
 * de palabras y el vocabulario.
 *
 * Todo lo que se dice tiene que ser lo que hace hoy el producto: la
 * recepcionista reserva, cambia o anula la cita que pide el cliente; tu
 * asistente marca la ausencia, te dice qué citas tenía y las recoloca con
 * quien TÚ digas, cada paso con «Confirmar». Nada de testimonios, clientes
 * ni cifras propias.
 */

/** Los cinco sectores con guion propio y los tres que vinieron después. */
export type SectorSlug =
  NicheSlug | "pestanas-y-cejas" | "spa-y-masajes" | "peluqueria-canina";

/** Una pregunta de la dueña y su respuesta de dos líneas (≤ 40 palabras). */
export type Pregunta = { pregunta: string; respuesta: string };

/**
 * Una línea de la transcripción, sin el saludo (lo pone la plantilla, que es
 * el aviso legal literal del backend): lo que dice cada uno o, entre medias,
 * lo que hace la recepcionista sin decirlo (mirar la agenda, reservar,
 * mandar el WhatsApp), en una línea corta sin punto final.
 */
export type LineaDeLlamada =
  | { de: "recepcionista" | "cliente"; texto: string }
  | { accion: string; icono: "agenda" | "reserva" | "whatsapp" };

/** Lo que el cliente escribe por WhatsApp y lo que le contesta la recepcionista. */
export type MensajeDeCliente = {
  de: "cliente" | "recepcionista";
  texto: string;
};

/**
 * El nivel de un profesional en un servicio, con las tres opciones de la
 * app (frontend/src/components/professional-service-levels.tsx):
 * «Especialista» (se le asigna primero), «Lo hace» y «No sugerir» (solo si
 * lo piden por su nombre; la recepcionista propone antes a otro).
 */
export type NivelDeServicio = "especialista" | "lo-hace" | "no-sugerir";

/** Una fila de la tabla de servicios de la app: el servicio, su duración y
 * el nivel de cada persona de `equipo`, en el mismo orden. */
export type ServicioDelOficio = {
  servicio: string;
  minutos: number;
  niveles: [NivelDeServicio, NivelDeServicio, NivelDeServicio];
};

export type Faq = { question: string; answer: string };

export type SectorLanding = {
  slug: SectorSlug;
  /** Plural con mayúscula, para menús, migas y JSON-LD: «Peluquerías». */
  nombre: string;
  /** Lo que va detrás de «Recepcionista de IA para» en el H1 y el título:
   * «peluquerías». */
  paraQuien: string;
  /** El negocio de la historia: lo dice el saludo y firma los WhatsApp. */
  negocio: string;
  /** «clientas», «clientes», «pacientes»: entra en la regla de confianza. */
  clientes: string;
  acento: NicheAccent;
  /** Demo de voz del hero. Sin ella, la demo general. */
  demo?: NicheSlug;

  /** Metadescripción y JSON-LD: la frase de calle, ≤ 160 caracteres. */
  descripcion: string;

  /** Frase de calle bajo el H1 (≤ 25 palabras). */
  hero: { frase: string };

  /** «¿Y si suena mientras…?»: la llamada de ejemplo, transcrita. */
  llamada: Pregunta & {
    /** Quien llama, como sale en la cabecera: «Carmen R.». */
    quien: string;
    /** «1 min 12 s». */
    duracion: string;
    lineas: LineaDeLlamada[];
  };

  /**
   * «¿Y si a mediodía falta alguien?»: el chat con tu asistente. Los turnos
   * se arman con `ausenciaDe` de lib/gestor-guiones.ts (la misma cadena que
   * el backend: tres «Confirmar»).
   */
  asistente: Pregunta & { turnos: Turno[] };

  /** «¿Mis clientas tienen que bajarse algo?»: el WhatsApp que recibe quien llamó. */
  whatsapp: Pregunta & {
    /** Los dos datos de la plantilla de confirmación: servicio con quien
     * lo hace («Corte y color, con Marta») y fecha con hora. */
    confirmacion: { servicio: string; cuando: string };
    /** Lo que escribe después para cambiarla o anularla, y lo que le contesta. */
    conversacion: MensajeDeCliente[];
  };

  /**
   * «¿Sabe cómo funciona una…?»: la respuesta de dos líneas (con lo que
   * hace en las llamadas típicas del oficio y lo que no promete), sus
   * servicios como se ven en la app (duración y nivel por profesional) y el
   * reparto.
   */
  oficio: Pregunta & {
    /** Las tres personas de las columnas de la tabla de servicios. */
    equipo: [string, string, string];
    /** Cuatro servicios reales del oficio, entre ellos los tres niveles. */
    servicios: [
      ServicioDelOficio,
      ServicioDelOficio,
      ServicioDelOficio,
      ServicioDelOficio,
    ];
    /** El reparto por especialidad en una frase. */
    reparto: string;
    /** Solo en los oficios con datos de salud (≤ 50 palabras). */
    salud?: { texto: string; enlace: { href: string; texto: string } };
  };

  /** Cinco preguntas del oficio, plegadas (≤ 60 palabras por respuesta). */
  faqs: [Faq, Faq, Faq, Faq, Faq];

  /** Titular del cierre negro. */
  cierre: string;
};
