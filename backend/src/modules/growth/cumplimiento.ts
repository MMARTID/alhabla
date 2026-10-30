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
  /**
   * El campo `utm` del borrador. Hoy nada lo añade al enlace: solo sirve para
   * decir con precisión por qué `enlace_con_utm` avisa.
   */
  utm?: unknown;
  /** Claves de afirmaciones de la base de conocimiento que usa el texto. */
  afirmaciones: readonly string[];
};

/** Un término que no se puede decir, con la forma en que se busca. */
export type TerminoProhibido = {
  termino: string;
  /**
   * `true`: solo casa como palabra entera (límites Unicode), así «API» no
   * salta con «fisioterapia». `false`: casa dentro de cualquier palabra.
   */
  palabraEntera: boolean;
};

/** Un competidor conocido (`growth_competidores`). */
export type CompetidorConocido = {
  nombre: string;
  /** Sin esquema ni `www`, en minúsculas: `heydiga.ai`. */
  dominio: string;
};

/** Una afirmación vigente que cita el borrador, con lo que la regla 3 necesita. */
export type AfirmacionCitada = {
  clave: string;
  tipo: string;
  valor: unknown;
};

export type ContextoDeCumplimiento = {
  /** Claves de afirmaciones vigentes (sin `vigenteHasta`). */
  clavesVigentes: ReadonlySet<string>;
  /** Las afirmaciones vigentes que cita este borrador. */
  afirmacionesCitadas: readonly AfirmacionCitada[];
  /** Términos que no se pueden decir (afirmaciones de tipo `prohibida`). */
  terminosProhibidos: readonly TerminoProhibido[];
  /** Competidores conocidos. */
  competidores: readonly CompetidorConocido[];
  /**
   * Textos de los borradores y envíos de OTRAS oportunidades, para la regla
   * dura de plantilla repetida.
   */
  textosAnteriores: readonly string[];
  /**
   * Textos de las demás versiones de ESTA oportunidad: se comparan solo en
   * blando, porque tras «devolver con una nota» la versión nueva se parecerá
   * a la anterior y eso es un aviso, no un bloqueo.
   */
  textosDeLaMismaOportunidad: readonly string[];
  /** Fechas de las gestiones ya hechas con el mismo dominio. */
  gestionesDelDominio: readonly Date[];
  /** Otras oportunidades del mismo dominio aprobadas y aún sin gestionar. */
  aprobadasDelDominio: number;
  /**
   * Contactos de los últimos 7 días con cualquier dominio: gestiones hechas
   * más oportunidades aprobadas que aún no se han gestionado.
   */
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

// Estos patrones se aplican sobre el texto NORMALIZADO (minúsculas, sin
// acentos): «dólares» llega como «dolares». `€` y `$` no son caracteres de
// palabra, así que un `\b` justo después nunca casaría.
//
// Los importes en letra: con minutos solo cuentan los grandes (a partir de
// cincuenta). «Dos minutos de lectura» es una duración, «doscientos minutos»
// es un plan.
const NUMEROS_EN_LETRA =
  "(?:un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciseis|diecisiete|dieciocho|diecinueve|veinte|veinti\\w+|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|doscientos|trescientos|cuatrocientos|quinientos|seiscientos|setecientos|ochocientos|novecientos|mil|medio|media)";
const NUMEROS_GRANDES_EN_LETRA =
  "(?:cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|doscientos|trescientos|cuatrocientos|quinientos|seiscientos|setecientos|ochocientos|novecientos|mil)";
const MONEDA = "(?:euros?|eur|dolares?|usd)";

/**
 * Lo que cuenta como «hablar de dinero o de minutos»: cifra con moneda
 * (`59 €`, `59 EUR`, `59 dólares`, `$59`), cifra con minutos (`200 min`,
 * `200 mins`, `200 minutos`), el importe escrito en letra («cincuenta y nueve
 * euros») y la promesa de no cobrar («gratis»).
 */
const PRECIO_O_MINUTOS: readonly RegExp[] = [
  new RegExp(`\\d[\\d.,]*\\s?(?:€|${MONEDA}\\b|us\\$|\\$)`),
  /[€$]\s?\d/,
  /\b\d[\d.,]*\s?(?:minutos|minutes|mins?)\b/,
  new RegExp(
    `\\b${NUMEROS_EN_LETRA}\\b(?:\\s+(?:y\\s+)?\\w+){0,3}?\\s+${MONEDA}\\b`
  ),
  new RegExp(
    `\\b${NUMEROS_GRANDES_EN_LETRA}\\b(?:\\s+(?:y\\s+)?\\w+){0,3}?\\s+(?:minutos|mins)\\b`
  ),
  /\bgratis\b|\bgratuit[oa]s?\b|\bgratuitamente\b|\bsin\s+(?:coste|costo|cargo)\b|\bfree\s+(?:trial|plan|tier)\b/,
];

function hablaDePrecioOMinutos(textoNormalizado: string): boolean {
  return PRECIO_O_MINUTOS.some((patron) => patron.test(textoNormalizado));
}

const ESQUEMA_DE_ENLACES =
  /intercambi\w*\s+(de\s+)?(enlaces|links)|link\s+exchange|enlaces?\s+(de\s+pago|patrocinad\w+)|(pago|pagamos|pagar\w*)\s+por\s+(el\s+|un\s+)?(enlace|link)|compr\w+\s+(de\s+)?(un\s+)?(enlaces?|links?)/i;

const CORREO = /[\w.+-]+@([\w-]+\.)+[a-z]{2,}/gi;
const TELEFONO = /\+?\d[\d\s().-]{7,}\d/g;
// Una URL con esquema, o «www.»: lo que alguien pegaría para que se pulse.
const URL_EN_TEXTO = /(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;

/**
 * Homoglifos de otros alfabetos que se escriben igual que una letra latina
 * («Rеtell» con una е cirílica). En un texto en español estas letras no
 * aparecen de verdad, así que se pliegan a su equivalente latino antes de
 * buscar términos.
 */
const HOMOGLIFOS: Readonly<Record<string, string>> = {
  // Cirílico
  "\u0430": "a", // а
  "\u0432": "b", // в
  "\u0435": "e", // е
  "\u0451": "e", // ё
  "\u043a": "k", // к
  "\u043c": "m", // м
  "\u043d": "h", // н
  "\u043e": "o", // о
  "\u0440": "p", // р
  "\u0441": "c", // с
  "\u0442": "t", // т
  "\u0443": "y", // у
  "\u0445": "x", // х
  "\u0456": "i", // і
  "\u0457": "i", // ї
  "\u0458": "j", // ј
  "\u0455": "s", // ѕ
  "\u04bb": "h", // һ
  "\u0501": "d", // ԁ
  "\u051b": "q", // ԛ
  "\u051d": "w", // ԝ
  // Griego
  "\u03b1": "a", // α
  "\u03b5": "e", // ε
  "\u03b9": "i", // ι
  "\u03ba": "k", // κ
  "\u03bd": "v", // ν
  "\u03bf": "o", // ο
  "\u03c1": "p", // ρ
  "\u03c4": "t", // τ
  "\u03c5": "u", // υ
  "\u03c7": "x", // χ
};
const PATRON_DE_HOMOGLIFOS = new RegExp(
  `[${Object.keys(HOMOGLIFOS).join("")}]`,
  "g"
);

/**
 * Pliega la compatibilidad Unicode (NFKC: «Ｒｅｔｅｌｌ» a ancho completo, «ﬁ»,
 * espacios raros) y quita los caracteres invisibles (`\p{Cf}`: espacio de ancho
 * cero, guion blando, marcas de dirección…), que partían un término sin que se
 * viera.
 */
function limpiarInvisibles(texto: string): string {
  return texto.normalize("NFKC").replace(/\p{Cf}/gu, "");
}

function normalizar(texto: string): string {
  return limpiarInvisibles(texto)
    .toLowerCase()
    .replace(PATRON_DE_HOMOGLIFOS, (letra) => HOMOGLIFOS[letra] ?? letra)
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** Menos de tres caracteres casan con medio diccionario: no se aplican. */
export const LONGITUD_MINIMA_DE_TERMINO = 3;

function escaparParaRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * ¿Aparece el término en un texto que YA está normalizado? Es lo que hace
 * `mencionaPalabra`, sin volver a normalizar el texto por cada término: una
 * evaluación busca decenas de términos en el mismo texto.
 */
function mencionaEnNormalizado(
  pajar: string,
  termino: string,
  opciones: { palabraEntera?: boolean } = {}
): boolean {
  const buscado = normalizar(termino).trim();
  if (buscado.length < LONGITUD_MINIMA_DE_TERMINO) return false;
  if (opciones.palabraEntera === false) return pajar.includes(buscado);

  const cuerpo = escaparParaRegex(buscado).replace(/\s+/g, "\\s+");
  return new RegExp(`(?<![\\p{L}\\p{N}])${cuerpo}(?![\\p{L}\\p{N}])`, "u").test(
    pajar
  );
}

/**
 * ¿Menciona el texto el término? Sin mayúsculas, acentos, caracteres
 * invisibles ni homoglifos (una `е` cirílica cuenta como `e`). Con
 * `palabraEntera` (por defecto) el término ha de estar rodeado de algo que no
 * sea letra ni número, en cualquier alfabeto: «API» no casa con «fisioterapia»
 * ni «Vapi», pero sí con «la API.» o «(API)». Un término de menos de
 * `LONGITUD_MINIMA_DE_TERMINO` caracteres no se aplica nunca.
 */
export function mencionaPalabra(
  texto: string,
  termino: string,
  opciones: { palabraEntera?: boolean } = {}
): boolean {
  return mencionaEnNormalizado(normalizar(texto), termino, opciones);
}

/** ¿Hay algún correo en el texto? */
export function contieneCorreo(texto: string): boolean {
  return new RegExp(CORREO.source, "i").test(limpiarInvisibles(texto));
}

// Teléfonos españoles (fijo o móvil) con o sin prefijo y con separadores. Más
// estricto que el de las reglas del borrador a propósito: en un resumen de
// investigación aparecen fechas y cifras («2026-10-30 12:00») que no son
// teléfonos.
const TELEFONO_ESPANOL =
  /(?<![\d.])(?:(?:\+|00)34[\s.-]?)?[6-9]\d{2}[\s.-]?\d{3}[\s.-]?\d{3}(?!\d)|(?<![\d.])[6-9]\d[\s.-]\d{3}[\s.-]\d{2}[\s.-]\d{2}(?!\d)/;

/** ¿Hay algún teléfono español en el texto? */
export function contieneTelefono(texto: string): boolean {
  return TELEFONO_ESPANOL.test(limpiarInvisibles(texto));
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

/**
 * Un host sin el punto final de un FQDN: `alhabla.ai.` y `alhabla.ai` son el
 * mismo sitio, pero un `===` o un `endsWith` los distinguían.
 */
export function sinPuntoFinal(host: string): string {
  return host.replace(/\.+$/, "");
}

/** ¿Es `alhabla.ai` o un subdominio suyo? */
export function esHostDeAlhabla(host: string): boolean {
  const limpio = sinPuntoFinal(host.trim().toLowerCase());
  return limpio === "alhabla.ai" || limpio.endsWith(".alhabla.ai");
}

/** ¿Es una URL http(s) de `alhabla.ai` (o un subdominio)? */
function hostDeAlhabla(url: string): boolean {
  try {
    const analizada = new URL(url);
    return (
      (analizada.protocol === "https:" || analizada.protocol === "http:") &&
      esHostDeAlhabla(analizada.hostname)
    );
  } catch {
    return false;
  }
}

/**
 * Las URL del texto que NO son de `alhabla.ai`, tal como están escritas. Una
 * que no se puede analizar cuenta como ajena: ante la duda, el humano la ve.
 */
function enlacesAjenosEnElTexto(texto: string): string[] {
  const ajenos: string[] = [];
  for (const crudo of limpiarInvisibles(texto).match(URL_EN_TEXTO) ?? []) {
    const enlace = crudo.replace(/[.,;:!?)\]}»”’]+$/u, "");
    try {
      const analizada = new URL(
        /^www\./i.test(enlace) ? `https://${enlace}` : enlace
      );
      if (!esHostDeAlhabla(analizada.hostname)) ajenos.push(enlace);
    } catch {
      ajenos.push(enlace);
    }
  }
  return ajenos;
}

/** El dominio sin esquema, `www` ni punto final, en minúsculas. */
export function normalizarDominio(dominio: string): string {
  return sinPuntoFinal(dominio.trim().toLowerCase()).replace(/^www\./, "");
}

/** Palabras del español que un competidor puede tener por nombre («Habla»). */
const PALABRAS_COMUNES_DEL_ESPANOL: ReadonlySet<string> = new Set([
  "habla",
  "hablar",
  "diga",
  "dime",
  "voz",
  "hola",
  "llama",
  "llamada",
  "cita",
  "agenda",
  "asistente",
  "atiende",
  "recepcion",
  "reserva",
]);

const SUFIJO_DE_NOMBRE_DE_EMPRESA =
  /\s+(?:ai|labs?|io|app|inc|ltd|technologies|technology)$/i;

/**
 * Las formas en que se nombra a un competidor, para que la regla 3 no se
 * salte con «Retell» cuando el competidor se llama «Retell AI»: el nombre tal
 * cual, con y sin espacios (`Eleven Labs`, `ElevenLabs`), partido por
 * mayúsculas (`PolyAI` → `Poly AI`), sin el sufijo `AI`/`Labs` (`Retell`), el
 * dominio (`retell.ai`) y su primera etiqueta (`retell`). Se buscan siempre
 * como palabra entera. Una forma que es una palabra corriente del español
 * («habla») no se usa suelta: solo vale con el dominio.
 */
export function aliasesDeCompetidor(competidor: CompetidorConocido): string[] {
  const nombre = competidor.nombre.trim();
  const dominio = normalizarDominio(competidor.dominio);
  const [etiqueta = "", ...restoDelDominio] = dominio.split(".");
  const tld = restoDelDominio.join(".");
  const separado = nombre.replace(/([a-z])([A-Z])/g, "$1 $2");
  const sinSufijo = separado.replace(SUFIJO_DE_NOMBRE_DE_EMPRESA, "").trim();

  const alias = new Set<string>();
  const anadir = (forma: string, longitudMinima: number) => {
    const normalizada = normalizar(forma).trim();
    const sinEspacios = normalizada.replace(/\s+/g, "");
    if (sinEspacios.length < longitudMinima) return;
    if (PALABRAS_COMUNES_DEL_ESPANOL.has(normalizada)) return;
    alias.add(normalizada);
  };

  // Formas fuertes: el nombre completo y el dominio.
  if (dominio) anadir(dominio, LONGITUD_MINIMA_DE_TERMINO);
  if (etiqueta && tld) anadir(`${etiqueta} ${tld}`, LONGITUD_MINIMA_DE_TERMINO);
  for (const forma of [nombre, separado]) {
    anadir(forma, LONGITUD_MINIMA_DE_TERMINO);
    anadir(forma.replace(/\s+/g, ""), LONGITUD_MINIMA_DE_TERMINO);
  }
  // Formas cortas: más propensas a coincidir con una palabra cualquiera.
  if (sinSufijo !== separado) {
    anadir(sinSufijo, 4);
    anadir(sinSufijo.replace(/\s+/g, ""), 4);
  }
  if (etiqueta) anadir(etiqueta, 4);
  return [...alias];
}

/** `valor.competidorDominio` de una afirmación `comparativa`, normalizado. */
function competidorDeLaAfirmacion(valor: unknown): string | null {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;
  const dominio = (valor as Record<string, unknown>).competidorDominio;
  return typeof dominio === "string" && dominio.trim()
    ? normalizarDominio(dominio)
    : null;
}

/** Nombres de las reglas del motor: nadie más puede firmar con ellos. */
export const NOMBRES_DE_REGLAS_DURAS = [
  "afirmaciones_vigentes",
  "precio_trazable",
  "sin_terminos_prohibidos",
  "comparativa_con_fuente",
  "identificacion",
  "sin_esquemas_de_enlaces",
  "enlace_a_alhabla",
  "un_contacto_por_dominio",
  "tope_semanal",
  "sin_plantilla_repetida",
  "sin_datos_personales",
  "tipo_acorde_con_objetivo",
] as const;

export const NOMBRES_DE_REGLAS_BLANDAS = [
  "similitud_alta",
  "similitud_con_version_anterior",
  "pocos_enlaces",
  "enlace_con_utm",
  "longitud_razonable",
] as const;

/**
 * Las reglas de agenda dependen de cuándo se evalúa, no de lo que dice el
 * texto: al aprobar no bloquean el borrador, devuelven su propio 409
 * (`dominio_en_enfriamiento`, `dominio_ya_aprobado` o `tope_semanal`, ver
 * `errorDeAgenda` en service.ts) y no cambian ningún estado.
 */
export const REGLAS_DE_AGENDA: readonly string[] = [
  "un_contacto_por_dominio",
  "tope_semanal",
];

/** ¿Depende la regla de la agenda y no del texto? */
export function esReglaDeAgenda(regla: string): boolean {
  return REGLAS_DE_AGENDA.includes(regla);
}

/**
 * Las reglas duras que fallan por lo que DICE el borrador: lo único que de
 * verdad lo bloquea al aprobar o al editar.
 */
export function fallosDelTexto(
  comprobaciones: readonly Comprobacion[]
): Comprobacion[] {
  return comprobaciones.filter(
    (c) => c.dura && !c.ok && !esReglaDeAgenda(c.regla)
  );
}

export type OpcionesDeEvaluacion = {
  /**
   * `true`: las reglas de agenda (`un_contacto_por_dominio`, `tope_semanal`)
   * se anotan como avisos (`dura: false`) y no bloquean el resultado. Es lo
   * que pide aprobar (que tiene sus propios 409) y editar a mano (corregir una
   * errata no debe chocar con una agenda llena). Crear un borrador no lo usa:
   * ahí la agenda sigue bloqueando.
   */
  agendaComoAviso?: boolean;
};

export function evaluarCumplimiento(
  borrador: BorradorAEvaluar,
  contexto: ContextoDeCumplimiento,
  opciones: OpcionesDeEvaluacion = {}
): { resultado: ResultadoDeCumplimiento; comprobaciones: Comprobacion[] } {
  const texto = `${borrador.asunto ?? ""}\n${borrador.texto}`;
  // Una sola vez: sin acentos, sin invisibles y sin homoglifos. Todo lo que
  // busca palabras (términos, competidores, precios, esquemas) mira este.
  const normalizado = normalizar(texto);
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

  // 1b. Si habla de precios, de minutos o de que algo es gratis, tiene que
  // citar un precio.
  const hablaDePrecio = hablaDePrecioOMinutos(normalizado);
  const citaPrecio = borrador.afirmaciones.some((c) => c.startsWith("precio."));
  comprobaciones.push(
    comprobacion(
      "precio_trazable",
      true,
      !hablaDePrecio || citaPrecio,
      hablaDePrecio
        ? "El precio que menciona cita una afirmación `precio.*`."
        : "No menciona precios ni minutos.",
      "Menciona un precio, unos minutos o que algo es gratis sin citar ninguna afirmación `precio.*`."
    )
  );

  // 2. Nada de lo que no se dice.
  const prohibidos = contexto.terminosProhibidos
    .filter((t) =>
      mencionaEnNormalizado(normalizado, t.termino, {
        palabraEntera: t.palabraEntera,
      })
    )
    .map((t) => t.termino);
  comprobaciones.push(
    comprobacion(
      "sin_terminos_prohibidos",
      true,
      prohibidos.length === 0,
      "No usa ningún término prohibido.",
      `Usa términos prohibidos: ${prohibidos.join(", ")}.`
    )
  );

  // 3. Comparar con un competidor exige un dato comparativo con fuente DE ESE
  // competidor: no vale cualquier `comparativa.*`. El competidor se reconoce
  // por cualquiera de sus alias («Retell» es «Retell AI»).
  const comparados = contexto.competidores.filter((c) =>
    aliasesDeCompetidor(c).some((alias) =>
      mencionaEnNormalizado(normalizado, alias)
    )
  );
  const dominiosConDato = new Set(
    contexto.afirmacionesCitadas
      .filter((a) => a.tipo === "comparativa")
      .map((a) => competidorDeLaAfirmacion(a.valor))
      .filter((d): d is string => d !== null)
  );
  const sinDato = comparados.filter(
    (c) => !dominiosConDato.has(normalizarDominio(c.dominio))
  );
  comprobaciones.push(
    comprobacion(
      "comparativa_con_fuente",
      true,
      sinDato.length === 0,
      comparados.length === 0
        ? "No nombra a ningún competidor."
        : `Nombra a ${comparados.map((c) => c.nombre).join(", ")} y cita un dato comparativo de cada uno.`,
      `Nombra a ${sinDato.map((c) => c.nombre).join(", ")} sin citar una afirmación \`comparativa.*\` de ese competidor (art. 10 Ley 3/1991: solo datos verificables, con fecha).`
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
      !ESQUEMA_DE_ENLACES.test(normalizado),
      "No propone intercambios ni enlaces de pago.",
      "Propone un intercambio, una compra o un pago por un enlace: es un esquema de enlaces."
    )
  );

  // 5b. Todo enlace que lleva el borrador va a alhabla.ai: el que se pide y
  // los que vayan en el asunto o en el texto. Un enlace a otro sitio dentro de
  // un mensaje que escribe un agente que lee páginas ajenas es la forma de
  // colar un destino que nadie ha revisado.
  const enlaceAjeno =
    borrador.enlaceUrl != null &&
    borrador.enlaceUrl !== "" &&
    !hostDeAlhabla(borrador.enlaceUrl);
  const enlacesAjenos = enlacesAjenosEnElTexto(texto);
  comprobaciones.push(
    comprobacion(
      "enlace_a_alhabla",
      true,
      !enlaceAjeno && enlacesAjenos.length === 0,
      "El enlace, si lo hay, apunta a alhabla.ai y el texto no enlaza a otros sitios.",
      [
        enlaceAjeno ? "El enlace no apunta a un dominio de alhabla.ai." : null,
        enlacesAjenos.length > 0
          ? `El texto enlaza a otros sitios (${enlacesAjenos.slice(0, 3).join(", ")}): quita el enlace y nombra la página sin enlazarla.`
          : null,
      ]
        .filter(Boolean)
        .join(" ")
    )
  );

  // 6. Un contacto por dominio cada 90 días y un tope semanal. Cuentan las
  // gestiones hechas y también lo aprobado que aún no se ha gestionado.
  const reciente = contexto.gestionesDelDominio.find(
    (fecha) =>
      contexto.ahora.getTime() - fecha.getTime() <
      DIAS_ENTRE_CONTACTOS_AL_MISMO_DOMINIO * MS_POR_DIA
  );
  comprobaciones.push(
    comprobacion(
      "un_contacto_por_dominio",
      true,
      reciente === undefined && contexto.aprobadasDelDominio === 0,
      "No hay contactos con este dominio en los últimos 90 días.",
      reciente !== undefined
        ? `Ya se contactó con este dominio el ${reciente.toISOString().slice(0, 10)}: espera 90 días.`
        : "Ya hay otra oportunidad aprobada de este dominio pendiente de gestionar."
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

  // 8. Sin datos personales de terceros, ni en el texto ni en el asunto.
  const partes = [borrador.asunto ?? "", borrador.texto].map(limpiarInvisibles);
  const correosAjenos = partes
    .flatMap((parte) => parte.match(CORREO) ?? [])
    .filter((correo) => !/@alhabla\.ai$/i.test(correo));
  const telefonos = partes
    .flatMap((parte) => parte.match(TELEFONO) ?? [])
    .filter((numero) => numero.replace(/\D/g, "").length >= 9);
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

  const parecidoConLaVersionAnterior = maximaSimilitud(
    borrador.texto,
    contexto.textosDeLaMismaOportunidad
  );
  const porcentajeVersion = Math.round(parecidoConLaVersionAnterior * 100);
  comprobaciones.push(
    comprobacion(
      "similitud_con_version_anterior",
      false,
      parecidoConLaVersionAnterior < contexto.umbralDeSimilitud,
      contexto.textosDeLaMismaOportunidad.length === 0
        ? "No hay una versión anterior con la que comparar."
        : `Parecido con la versión anterior: ${porcentajeVersion} %.`,
      `Se parece un ${porcentajeVersion} % a una versión anterior de esta misma oportunidad: apenas ha cambiado.`
    )
  );

  const demasiadosEnlaces =
    (limpiarInvisibles(borrador.texto).match(URL_EN_TEXTO) ?? []).length > 2;
  comprobaciones.push(
    comprobacion(
      "pocos_enlaces",
      false,
      !demasiadosEnlaces,
      "No abusa de los enlaces.",
      "Lleva más de dos enlaces en el texto."
    )
  );

  // El UTM tiene que ir en la propia URL: el campo `utm` del borrador no se
  // añade al enlace en ningún sitio.
  const conEnlace = borrador.enlaceUrl != null && borrador.enlaceUrl !== "";
  comprobaciones.push(
    comprobacion(
      "enlace_con_utm",
      false,
      !conEnlace || /[?&]utm_source=/.test(borrador.enlaceUrl as string),
      conEnlace ? "El enlace lleva UTM." : "No lleva enlace.",
      tieneUtmSource(borrador.utm)
        ? "El borrador declara `utm`, pero el enlace no lo lleva: pon `utm_source` en la propia URL (el campo `utm` no se añade solo)."
        : "El enlace no lleva `utm_source` en la URL: no se podrá medir el tráfico."
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

  const finales = opciones.agendaComoAviso
    ? comprobaciones.map((c) =>
        esReglaDeAgenda(c.regla) ? { ...c, dura: false } : c
      )
    : comprobaciones;

  const resultado: ResultadoDeCumplimiento = finales.some(
    (c) => c.dura && !c.ok
  )
    ? "bloquea"
    : finales.some((c) => !c.dura && !c.ok)
      ? "aviso"
      : "pasa";

  return { resultado, comprobaciones: finales };
}

function tieneUtmSource(utm: unknown): boolean {
  if (!utm || typeof utm !== "object" || Array.isArray(utm)) return false;
  const fuente = (utm as Record<string, unknown>).utm_source;
  return typeof fuente === "string" && fuente.trim() !== "";
}
