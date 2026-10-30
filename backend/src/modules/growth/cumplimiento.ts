import type {
  GrowthObjetivo as Objetivo,
  GrowthTipoBorrador as TipoDeBorrador,
} from "@prisma/client";
import { maximaSimilitud } from "./similitud.js";

/**
 * Reglas duras de cumplimiento de Alhabla Growth (PLAN-GROWTH.md § 3.2).
 *
 * Viven aquí, en el backend, y no en el prompt de ningún agente: un agente
 * mal instruido, o con una página que le dice «ignora tus instrucciones», no
 * puede saltárselas. La API no deja pasar un borrador a `pendiente_aprobacion`
 * si alguna regla dura falla. Las blandas avisan y decide el fundador.
 */

export const DIAS_ENTRE_CONTACTOS_AL_MISMO_DOMINIO = 90;
export const TOPE_SEMANAL_POR_DEFECTO = 5;
export const UMBRAL_DE_SIMILITUD_POR_DEFECTO = 0.6;
export const UMBRAL_DE_AVISO_DE_SIMILITUD = 0.4;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

export type Comprobacion = {
  regla: string;
  ok: boolean;
  /** Dura = bloquea; blanda = avisa. */
  dura: boolean;
  detalle: string;
};

export type ResultadoDeCumplimiento = "pasa" | "aviso" | "bloquea";

export type BorradorAEvaluar = {
  tipo: TipoDeBorrador;
  objetivo: Objetivo;
  asunto?: string | null;
  texto: string;
  enlaceUrl?: string | null;
  /** Claves de afirmaciones de la base de conocimiento que usa el texto. */
  afirmaciones: readonly string[];
};

export type ContextoDeCumplimiento = {
  /** Claves de afirmaciones vigentes (sin `vigenteHasta`). */
  clavesVigentes: ReadonlySet<string>;
  /** Términos que no se pueden decir (afirmaciones de tipo `prohibida`). */
  terminosProhibidos: readonly string[];
  /** Nombres de los competidores conocidos. */
  competidores: readonly string[];
  /** Textos de los borradores y envíos anteriores, para la similitud. */
  textosAnteriores: readonly string[];
  /** Fechas de las gestiones ya hechas con el mismo dominio. */
  gestionesDelDominio: readonly Date[];
  /** Contactos hechos en los últimos 7 días, con cualquier dominio. */
  contactosEstaSemana: number;
  topeSemanal: number;
  umbralDeSimilitud: number;
  ahora: Date;
};

/** Qué tipo de borrador tiene sentido para cada objetivo. */
const TIPOS_POR_OBJETIVO: Record<Objetivo, readonly TipoDeBorrador[]> = {
  TRAFICO_MARCA: ["ficha_directorio", "formulario", "email"],
  LEADS: ["email", "formulario"],
  BACKLINKS: ["email", "formulario", "ficha_directorio", "texto_invitado"],
};

/** Los que identifican a quien escribe y de parte de quién. */
const TIPOS_QUE_SE_FIRMAN: readonly TipoDeBorrador[] = [
  "email",
  "formulario",
  "texto_invitado",
];

// `€` no es un carácter de palabra: un `\b` justo después nunca casaría.
const PRECIO_O_MINUTOS =
  /\d[\d.,]*\s?(?:€|euros?\b)|\b\d[\d.]*\s+minutos\b|€\s?\d/i;

const ESQUEMA_DE_ENLACES =
  /intercambi\w*\s+(de\s+)?(enlaces|links)|link\s+exchange|enlaces?\s+(de\s+pago|patrocinad\w+)|(pago|pagamos|pagar\w*)\s+por\s+(el\s+|un\s+)?(enlace|link)|compr\w+\s+(de\s+)?(un\s+)?(enlaces?|links?)/i;

const CORREO = /[\w.+-]+@([\w-]+\.)+[a-z]{2,}/gi;
const TELEFONO = /\+?\d[\d\s().-]{7,}\d/g;
const URLS = /https?:\/\/\S+/gi;

function normalizar(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function mencionaPalabra(texto: string, termino: string): boolean {
  return normalizar(texto).includes(normalizar(termino));
}

function comprobacion(
  regla: string,
  dura: boolean,
  ok: boolean,
  detalleOk: string,
  detalleFallo: string
): Comprobacion {
  return { regla, dura, ok, detalle: ok ? detalleOk : detalleFallo };
}

function hostDeAlhabla(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "alhabla.ai" || host.endsWith(".alhabla.ai");
  } catch {
    return false;
  }
}

export function evaluarCumplimiento(
  borrador: BorradorAEvaluar,
  contexto: ContextoDeCumplimiento
): { resultado: ResultadoDeCumplimiento; comprobaciones: Comprobacion[] } {
  const texto = `${borrador.asunto ?? ""}\n${borrador.texto}`;
  const comprobaciones: Comprobacion[] = [];

  // 1. Cada afirmación citada existe y sigue vigente.
  const obsoletas = borrador.afirmaciones.filter(
    (clave) => !contexto.clavesVigentes.has(clave)
  );
  comprobaciones.push(
    comprobacion(
      "afirmaciones_vigentes",
      true,
      obsoletas.length === 0,
      "Todas las afirmaciones citadas están vigentes.",
      `Afirmaciones que no existen o ya no valen: ${obsoletas.join(", ")}.`
    )
  );

  // 1b. Si habla de precios o minutos, tiene que citar un precio.
  const hablaDePrecio = PRECIO_O_MINUTOS.test(texto);
  const citaPrecio = borrador.afirmaciones.some((c) => c.startsWith("precio."));
  comprobaciones.push(
    comprobacion(
      "precio_trazable",
      true,
      !hablaDePrecio || citaPrecio,
      hablaDePrecio
        ? "El precio que menciona cita una afirmación `precio.*`."
        : "No menciona precios ni minutos.",
      "Menciona un precio o unos minutos sin citar ninguna afirmación `precio.*`."
    )
  );

  // 2. Nada de lo que no se dice.
  const prohibidos = contexto.terminosProhibidos.filter((t) =>
    mencionaPalabra(texto, t)
  );
  comprobaciones.push(
    comprobacion(
      "sin_terminos_prohibidos",
      true,
      prohibidos.length === 0,
      "No usa ningún término prohibido.",
      `Usa términos prohibidos: ${prohibidos.join(", ")}.`
    )
  );

  // 3. Comparar con un competidor exige un dato comparativo con fuente.
  const comparados = contexto.competidores.filter((c) =>
    mencionaPalabra(texto, c)
  );
  const citaComparativa = borrador.afirmaciones.some((c) =>
    c.startsWith("comparativa.")
  );
  comprobaciones.push(
    comprobacion(
      "comparativa_con_fuente",
      true,
      comparados.length === 0 || citaComparativa,
      comparados.length === 0
        ? "No nombra a ningún competidor."
        : "Nombra a un competidor y cita una afirmación `comparativa.*`.",
      `Nombra a ${comparados.join(", ")} sin citar una afirmación \`comparativa.*\` (art. 10 Ley 3/1991: solo datos verificables, con fecha).`
    )
  );

  // 4. Quien escribe se identifica.
  const seFirma = TIPOS_QUE_SE_FIRMAN.includes(borrador.tipo);
  const identificado =
    /alhabla/i.test(borrador.texto) &&
    /(fundador|fundadora|equipo de alhabla)/i.test(borrador.texto);
  comprobaciones.push(
    comprobacion(
      "identificacion",
      true,
      !seFirma || identificado,
      seFirma
        ? "Se identifica como parte de Alhabla."
        : "Una ficha no necesita firma.",
      "Un mensaje debe decir quién escribe y de parte de quién (por ejemplo, «soy el fundador de Alhabla»)."
    )
  );

  // 5. Sin esquemas de enlaces.
  comprobaciones.push(
    comprobacion(
      "sin_esquemas_de_enlaces",
      true,
      !ESQUEMA_DE_ENLACES.test(texto),
      "No propone intercambios ni enlaces de pago.",
      "Propone un intercambio, una compra o un pago por un enlace: es un esquema de enlaces."
    )
  );

  // 5b. El enlace que pedimos va a alhabla.ai.
  const enlaceAjeno =
    borrador.enlaceUrl != null &&
    borrador.enlaceUrl !== "" &&
    !hostDeAlhabla(borrador.enlaceUrl);
  comprobaciones.push(
    comprobacion(
      "enlace_a_alhabla",
      true,
      !enlaceAjeno,
      "El enlace, si lo hay, apunta a alhabla.ai.",
      "El enlace no apunta a un dominio de alhabla.ai."
    )
  );

  // 6. Un contacto por dominio cada 90 días y un tope semanal.
  const reciente = contexto.gestionesDelDominio.find(
    (fecha) =>
      contexto.ahora.getTime() - fecha.getTime() <
      DIAS_ENTRE_CONTACTOS_AL_MISMO_DOMINIO * MS_POR_DIA
  );
  comprobaciones.push(
    comprobacion(
      "un_contacto_por_dominio",
      true,
      reciente === undefined,
      "No hay contactos con este dominio en los últimos 90 días.",
      `Ya se contactó con este dominio el ${reciente?.toISOString().slice(0, 10)}: espera 90 días.`
    )
  );
  comprobaciones.push(
    comprobacion(
      "tope_semanal",
      true,
      contexto.contactosEstaSemana < contexto.topeSemanal,
      `Van ${contexto.contactosEstaSemana} de ${contexto.topeSemanal} contactos esta semana.`,
      `Se ha llegado al tope de ${contexto.topeSemanal} contactos esta semana.`
    )
  );

  // 7. No repetir plantillas.
  const parecido = maximaSimilitud(borrador.texto, contexto.textosAnteriores);
  const porcentaje = Math.round(parecido * 100);
  comprobaciones.push(
    comprobacion(
      "sin_plantilla_repetida",
      true,
      parecido < contexto.umbralDeSimilitud,
      `Parecido máximo con lo anterior: ${porcentaje} %.`,
      `Se parece un ${porcentaje} % a un mensaje anterior (tope ${Math.round(contexto.umbralDeSimilitud * 100)} %).`
    )
  );

  // 8. Sin datos personales de terceros.
  const correosAjenos = (borrador.texto.match(CORREO) ?? []).filter(
    (correo) => !/@alhabla\.ai$/i.test(correo)
  );
  const telefonos = (borrador.texto.match(TELEFONO) ?? []).filter(
    (numero) => numero.replace(/\D/g, "").length >= 9
  );
  comprobaciones.push(
    comprobacion(
      "sin_datos_personales",
      true,
      correosAjenos.length === 0 && telefonos.length === 0,
      "No incluye correos ni teléfonos de terceros.",
      "Incluye un correo o un teléfono que no es de Alhabla."
    )
  );

  // 9. Tipo de borrador acorde con el objetivo.
  comprobaciones.push(
    comprobacion(
      "tipo_acorde_con_objetivo",
      true,
      TIPOS_POR_OBJETIVO[borrador.objetivo].includes(borrador.tipo),
      `Un borrador de tipo ${borrador.tipo} encaja con el objetivo ${borrador.objetivo}.`,
      `Un borrador de tipo ${borrador.tipo} no encaja con el objetivo ${borrador.objetivo}.`
    )
  );

  // ── Reglas blandas ────────────────────────────────────────────────────
  comprobaciones.push(
    comprobacion(
      "similitud_alta",
      false,
      parecido < UMBRAL_DE_AVISO_DE_SIMILITUD,
      "Poco parecido con lo anterior.",
      `Se parece un ${porcentaje} % a un mensaje anterior.`
    )
  );

  const demasiadosEnlaces = (borrador.texto.match(URLS) ?? []).length > 2;
  comprobaciones.push(
    comprobacion(
      "pocos_enlaces",
      false,
      !demasiadosEnlaces,
      "No abusa de los enlaces.",
      "Lleva más de dos enlaces en el texto."
    )
  );

  const conEnlace = borrador.enlaceUrl != null && borrador.enlaceUrl !== "";
  comprobaciones.push(
    comprobacion(
      "enlace_con_utm",
      false,
      !conEnlace || /[?&]utm_source=/.test(borrador.enlaceUrl as string),
      conEnlace ? "El enlace lleva UTM." : "No lleva enlace.",
      "El enlace no lleva `utm_source`: no se podrá medir el tráfico."
    )
  );

  const longitud = borrador.texto.trim().length;
  comprobaciones.push(
    comprobacion(
      "longitud_razonable",
      false,
      longitud >= 80 && longitud <= 1500,
      `Longitud de ${longitud} caracteres.`,
      `Longitud de ${longitud} caracteres: lo razonable está entre 80 y 1.500.`
    )
  );

  const resultado: ResultadoDeCumplimiento = comprobaciones.some(
    (c) => c.dura && !c.ok
  )
    ? "bloquea"
    : comprobaciones.some((c) => !c.dura && !c.ok)
      ? "aviso"
      : "pasa";

  return { resultado, comprobaciones };
}
