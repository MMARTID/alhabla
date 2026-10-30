import type {
  Comprobacion,
  Objetivo,
  Resultado,
  TipoDeBorrador,
} from "../types";

/**
 * El motor de reglas de la demostración: una COPIA del motor del backend
 * (`backend/src/modules/growth/cumplimiento.ts › evaluarCumplimiento` y
 * `similitud.ts`) con las mismas 12 reglas duras y 5 blandas, en el mismo
 * orden y con los mismos mensajes, para que lo que enseña la Revisión en la
 * demostración sea lo que verías con el servidor de verdad. Un test
 * (tests/lib/paridad-de-reglas.test.ts) lee el fichero del backend y falla si
 * los nombres, el orden o los textos se separan: si falla, copia el cambio
 * aquí.
 *
 * Lo único que no es una copia es el contexto: el backend lo construye con
 * Prisma y la demostración, con su almacén en memoria (`cliente-demo.ts`).
 *
 * No se copia el endurecimiento contra textos hostiles (tabla de homoglifos de
 * otros alfabetos): la demostración solo escribe lo que teclea la persona.
 */

export const DIAS_ENTRE_CONTACTOS_AL_MISMO_DOMINIO = 90;
export const UMBRAL_DE_AVISO_DE_SIMILITUD = 0.4;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Los nombres de las reglas, copiados del backend. */
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
 * texto: no bloquean el borrador, devuelven su propio 409 sin tocar nada.
 */
export const REGLAS_DE_AGENDA: readonly string[] = [
  "un_contacto_por_dominio",
  "tope_semanal",
];

/** ¿Depende la regla de la agenda y no del texto? */
export function esReglaDeAgenda(regla: string): boolean {
  return REGLAS_DE_AGENDA.includes(regla);
}

// --- Similitud (copia de similitud.ts) ------------------------------------

const PALABRAS_POR_GRUPO = 3;

function palabras(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function grupos(lista: string[]): Set<string> {
  if (lista.length < PALABRAS_POR_GRUPO) return new Set(lista);
  const resultado = new Set<string>();
  for (let i = 0; i <= lista.length - PALABRAS_POR_GRUPO; i += 1) {
    resultado.add(lista.slice(i, i + PALABRAS_POR_GRUPO).join(" "));
  }
  return resultado;
}

/** Parecido entre dos textos, de 0 a 1 (Jaccard de grupos de tres palabras). */
export function similitudDeTextos(a: string, b: string): number {
  const ga = grupos(palabras(a));
  const gb = grupos(palabras(b));
  if (ga.size === 0 || gb.size === 0) return 0;
  let comunes = 0;
  for (const g of ga) if (gb.has(g)) comunes += 1;
  return comunes / (ga.size + gb.size - comunes);
}

/** El mayor parecido del texto con cualquiera de los anteriores. */
export function maximaSimilitud(
  texto: string,
  anteriores: readonly string[]
): number {
  let maxima = 0;
  for (const anterior of anteriores) {
    maxima = Math.max(maxima, similitudDeTextos(texto, anterior));
  }
  return maxima;
}

// --- Texto ------------------------------------------------------------------

// Se aplican sobre el texto NORMALIZADO (minúsculas, sin acentos): «dólares»
// llega como «dolares». `€` y `$` no son caracteres de palabra, así que un `\b`
// justo después nunca casaría.
const NUMEROS_EN_LETRA =
  "(?:un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciseis|diecisiete|dieciocho|diecinueve|veinte|veinti\\w+|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|doscientos|trescientos|cuatrocientos|quinientos|seiscientos|setecientos|ochocientos|novecientos|mil|medio|media)";
const MONEDA = "(?:euros?|eur|dolares?|usd)";

const PRECIO_O_MINUTOS_PATRONES: readonly RegExp[] = [
  new RegExp(`\\d[\\d.,]*\\s?(?:€|${MONEDA}\\b|us\\$|\\$)`),
  /[€$]\s?\d/,
  /\b\d[\d.,]*\s?(?:minutos|minutes|mins?)\b/,
  new RegExp(
    `\\b${NUMEROS_EN_LETRA}\\b(?:\\s+(?:y\\s+)?\\w+){0,3}?\\s+(?:${MONEDA}|minutos|mins)\\b`
  ),
  /\bgratis\b|\bgratuit[oa]s?\b|\bgratuitamente\b|\bsin\s+(?:coste|costo|cargo)\b|\bfree\s+(?:trial|plan|tier)\b/,
];

/** ¿Habla de dinero, de minutos o de que algo es gratis? (sobre texto ya normalizado) */
export function hablaDePrecioOMinutos(textoNormalizado: string): boolean {
  return PRECIO_O_MINUTOS_PATRONES.some((patron) =>
    patron.test(textoNormalizado)
  );
}

/** Para quien solo tiene el texto sin normalizar (los datos de la demostración). */
export function mencionaPrecio(texto: string): boolean {
  return hablaDePrecioOMinutos(normalizar(texto));
}

const ESQUEMA_DE_ENLACES =
  /intercambi\w*\s+(de\s+)?(enlaces|links)|link\s+exchange|enlaces?\s+(de\s+pago|patrocinad\w+)|(pago|pagamos|pagar\w*)\s+por\s+(el\s+|un\s+)?(enlace|link)|compr\w+\s+(de\s+)?(un\s+)?(enlaces?|links?)/i;

const CORREO = /[\w.+-]+@([\w-]+\.)+[a-z]{2,}/gi;
const TELEFONO = /\+?\d[\d\s().-]{7,}\d/g;
// Una URL con esquema, o «www.»: lo que alguien pegaría para que se pulse.
const URL_EN_TEXTO = /(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;

/** Quita los caracteres invisibles (espacio de ancho cero…) y pliega la compatibilidad Unicode. */
function limpiarInvisibles(texto: string): string {
  return texto.normalize("NFKC").replace(/\p{Cf}/gu, "");
}

function normalizar(texto: string): string {
  return limpiarInvisibles(texto)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** Menos de tres caracteres casan con medio diccionario: no se aplican. */
export const LONGITUD_MINIMA_DE_TERMINO = 3;

function escaparParaRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * ¿Aparece el término en un texto que YA está normalizado? Palabra entera
 * (límites Unicode) por defecto: «API» no casa con «fisioterapia».
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

/** ¿Menciona el texto el término? Sin mayúsculas, acentos ni caracteres invisibles. */
export function mencionaPalabra(
  texto: string,
  termino: string,
  opciones: { palabraEntera?: boolean } = {}
): boolean {
  return mencionaEnNormalizado(normalizar(texto), termino, opciones);
}

/** Un host sin el punto final de un FQDN. */
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

/** Las URL del texto que NO son de `alhabla.ai`, tal como están escritas. */
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
 * Las formas en que se nombra a un competidor («Retell» es «Retell AI»): el
 * nombre con y sin espacios, sin el sufijo `AI`/`Labs`, el dominio y su
 * primera etiqueta. Se buscan siempre como palabra entera.
 */
export function aliasesDeCompetidor(competidor: {
  nombre: string;
  dominio: string;
}): string[] {
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

  if (dominio) anadir(dominio, LONGITUD_MINIMA_DE_TERMINO);
  if (etiqueta && tld) anadir(`${etiqueta} ${tld}`, LONGITUD_MINIMA_DE_TERMINO);
  for (const forma of [nombre, separado]) {
    anadir(forma, LONGITUD_MINIMA_DE_TERMINO);
    anadir(forma.replace(/\s+/g, ""), LONGITUD_MINIMA_DE_TERMINO);
  }
  if (sinSufijo !== separado) {
    anadir(sinSufijo, 4);
    anadir(sinSufijo.replace(/\s+/g, ""), 4);
  }
  if (etiqueta) anadir(etiqueta, 4);
  return [...alias];
}

function competidorDeLaAfirmacion(valor: unknown): string | null {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;
  const dominio = (valor as Record<string, unknown>).competidorDominio;
  return typeof dominio === "string" && dominio.trim()
    ? normalizarDominio(dominio)
    : null;
}

// --- Contexto -----------------------------------------------------------------

export type TerminoProhibido = { termino: string; palabraEntera: boolean };

/** Los términos que fija una afirmación `prohibida` (`valor.terminos`). */
export function terminosProhibidosDe(a: {
  texto: string;
  valor: unknown;
}): TerminoProhibido[] {
  const valor = a.valor;
  if (
    valor &&
    typeof valor === "object" &&
    !Array.isArray(valor) &&
    Array.isArray((valor as { terminos?: unknown }).terminos)
  ) {
    const palabraEntera =
      (valor as { palabrasEnteras?: unknown }).palabrasEnteras !== false;
    return (valor as { terminos: unknown[] }).terminos
      .filter((t): t is string => typeof t === "string")
      .map((termino) => ({ termino, palabraEntera }));
  }
  return [{ termino: a.texto, palabraEntera: true }];
}

export type BorradorAEvaluar = {
  tipo: TipoDeBorrador;
  objetivo: Objetivo;
  asunto?: string | null;
  texto: string;
  enlaceUrl?: string | null;
  afirmaciones: readonly string[];
};

export type ContextoDeReglas = {
  clavesVigentes: ReadonlySet<string>;
  afirmacionesCitadas: ReadonlyArray<{
    clave: string;
    tipo: string;
    valor: unknown;
  }>;
  terminosProhibidos: readonly TerminoProhibido[];
  competidores: ReadonlyArray<{ nombre: string; dominio: string }>;
  textosAnteriores: readonly string[];
  textosDeLaMismaOportunidad: readonly string[];
  gestionesDelDominio: readonly Date[];
  aprobadasDelDominio: number;
  contactosEstaSemana: number;
  topeSemanal: number;
  umbralDeSimilitud: number;
  ahora: Date;
};

const TIPOS_POR_OBJETIVO: Record<Objetivo, readonly TipoDeBorrador[]> = {
  TRAFICO_MARCA: ["ficha_directorio", "formulario", "email"],
  LEADS: ["email", "formulario"],
  BACKLINKS: ["email", "formulario", "ficha_directorio", "texto_invitado"],
};

const TIPOS_QUE_SE_FIRMAN: readonly TipoDeBorrador[] = [
  "email",
  "formulario",
  "texto_invitado",
];

function comprobacion(
  regla: string,
  dura: boolean,
  ok: boolean,
  detalleOk: string,
  detalleFallo: string
): Comprobacion {
  return { regla, dura, ok, detalle: ok ? detalleOk : detalleFallo };
}

export type OpcionesDeEvaluacion = {
  /**
   * `true`: las reglas de agenda se anotan como avisos (`dura: false`) y no
   * bloquean el resultado. Es lo que piden aprobar y editar a mano, que tienen
   * su propio 409; crear un borrador no lo usa.
   */
  agendaComoAviso?: boolean;
};

/** Las reglas del backend sobre un borrador, con el contexto de la demostración. */
export function evaluarReglasDeDemo(
  borrador: BorradorAEvaluar,
  contexto: ContextoDeReglas,
  opciones: OpcionesDeEvaluacion = {}
): { resultado: Resultado; comprobaciones: Comprobacion[] } {
  const texto = `${borrador.asunto ?? ""}\n${borrador.texto}`;
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
  // competidor.
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
  // los que vayan en el asunto o en el texto.
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

  // El aviso de la versión anterior usa el umbral de los ajustes (0,6 por
  // defecto), el mismo que la regla dura de plantilla repetida.
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

  const conEnlace = borrador.enlaceUrl != null && borrador.enlaceUrl !== "";
  comprobaciones.push(
    comprobacion(
      "enlace_con_utm",
      false,
      !conEnlace || /[?&]utm_source=/.test(borrador.enlaceUrl as string),
      conEnlace ? "El enlace lleva UTM." : "No lleva enlace.",
      "El enlace no lleva `utm_source` en la URL: no se podrá medir el tráfico."
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

  const resultado: Resultado = finales.some((c) => c.dura && !c.ok)
    ? "bloquea"
    : finales.some((c) => !c.dura && !c.ok)
      ? "aviso"
      : "pasa";

  return { resultado, comprobaciones: finales };
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
