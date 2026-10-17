/**
 * Catálogo único de los idiomas de la recepcionista. Todo lo que depende
 * del idioma —voz, transcripción, saludo, prompt y panel— sale de
 * aquí a través de resolverIdiomas (resolver.ts): ningún otro módulo
 * guarda listas de idiomas ni decide por su cuenta. Módulo puro: sin E/S ni
 * dependencias de adapters.
 *
 * Añadir un idioma: su código al final de CODIGOS_DE_IDIOMA, su entrada en
 * IDIOMAS y ofrecerlo en un mercado (MERCADOS). Los tests de invariantes
 * (tests/lib/idiomas/catalogo.test.ts) fallan si le falta algo.
 *
 * Datos de partida (AGENTS.md § «Idiomas de atención y voz en Telnyx»):
 * ninguna voz Ultra ni deepgram/flux cubre catalán, euskera ni gallego;
 * Soniox sí (63 idiomas por voz). Con llamadas reales (2026-10-03), la voz
 * apenas cambia la espera; lo que la alarga es la transcripción sin flux.
 * Solo la síntesis de la Ultra va incluida en el precio del assistant: las
 * demás se cobran por carácter (facturación del 2026-10-03).
 *
 * El dueño solo elige el idioma principal (`voiceLanguage`) y la voz
 * (decisión del usuario del 2026-10-05, «nos hemos complicado»): en él
 * saluda y de él salen la voz y los idiomas que habla (idiomasQueHabla).
 * Con un principal cooficial (catalán, euskera, gallego) atienden las voces
 * de Soniox de esa lengua; con cualquier otro, sus Ultra nativas
 * (familiaDeVoces).
 */
import { VOCES_ULTRA } from "./vocesUltra.js";
import type { IdiomaConVocesUltra } from "./curacionDeVoces.js";

/**
 * Orden canónico de los idiomas. Los seis primeros no se mueven: alimentan,
 * en este orden, las pistas de transcripción, la lista del prompt y el
 * JSON guardado, y cambiarlo cambiaría el
 * hash del payload de Telnyx de todos los negocios multilingües. Los nuevos
 * van al final.
 */
export const CODIGOS_DE_IDIOMA = [
  "es-ES",
  "en-GB",
  "fr-FR",
  "ca-ES",
  "eu-ES",
  "gl-ES",
  "de-DE",
  "it-IT",
  "pt-PT",
  "nl-NL",
  "ru-RU",
] as const;

export type CodigoDeIdioma = (typeof CODIGOS_DE_IDIOMA)[number];

export const GENEROS_DE_VOZ = ["femenina", "masculina"] as const;

export type GeneroDeVoz = (typeof GENEROS_DE_VOZ)[number];

/** Proveedores de las voces del catálogo, como los nombra Telnyx al
 * listarlas (`listVoices`). Las de Azure y MiniMax se retiraron el
 * 2026-10-05 (se cobran aparte por carácter). */
export type ProveedorDeVoz = "telnyx" | "soniox";

export interface VozDelCatalogo {
  /** Identificador de Telnyx: `Telnyx.Ultra.<uuid>` o
   * `Soniox.tts-rt-v2.<Nombre>`. */
  id: string;
  proveedor: ProveedorDeVoz;
  /** Nombre visible, único dentro de su idioma. */
  nombre: string;
  genero: GeneroDeVoz;
  /** Cómo suena, en español y en 2–5 palabras: lo enseña el panel. No
   * entra en el payload. */
  descripcion: string;
  /** De atención al cliente: el panel la enseña sin desplegar «Ver todas
   * las voces». No entra en el payload. */
  recomendada: boolean;
  /** Idiomas que pronuncia bien (escuchados en el laboratorio de voces).
   * Las de Soniox hablan cualquiera y arrancan en el de
   * `voice_settings.language`; las Ultra, los de ULTRA_HABLA. La voz que
   * atiende tiene que hablar todos los que habla su principal
   * (idiomasQueHabla). */
  habla: "todos" | readonly CodigoDeIdioma[];
}

/** Texto que cambia con el género de la voz que atiende, o el mismo para
 * las dos. */
export type TextoConGenero = string | Readonly<Record<GeneroDeVoz, string>>;

/**
 * Las piezas del saludo de un idioma: `{negocio}`, `{nombre}` y `{servicio}`
 * se sustituyen al componerlo. Todas dicen «inteligencia artificial» con esas
 * palabras: el Reglamento europeo de IA (art. 50, desde el 2-8-2026) pide
 * avisar al principio de cada llamada y «asistente» a secas no basta. Fuera
 * del español se evita el género con giros neutros («una intelligence
 * artificielle»); en español va con el de la voz. Ver
 * lib/contextoDeLlamada.ts.
 */
export interface PartesDelSaludo {
  /** A quien llama por primera vez o no se conoce. */
  presentacion: string;
  /** La primera semana desde la primera llamada del negocio. */
  presentacionNueva: TextoConGenero;
  /** A quien ya reservó con ese teléfono: con su nombre. */
  presentacionAlCliente: TextoConGenero;
  /** Solo si ese cliente aceptó que se graben sus llamadas: se graba desde
   * que se descuelga y puede decir que no. */
  avisoDeGrabacion: string;
  /** Cierre del saludo a quien no se conoce. */
  pregunta: string;
  /** Cierre del saludo a un cliente, con su último servicio. */
  repetir: string;
  /** Cierre del saludo a un cliente sin nombrar el servicio (fisioterapia,
   * estética…: puede ser un dato de salud y el teléfono, de otra persona). */
  repetirLoDeLaUltimaVez: string;
}

export interface IdiomaDelCatalogo {
  /** ISO 639-1: pistas de Soniox y `voice_settings.language`. */
  iso: string;
  /** Cómo lo nombra el prompt: «… si es uno de estos: catalán, …». */
  nombreEnPrompt: string;
  /** Cómo lo ve el dueño en el panel. */
  etiqueta: string;
  /** Las piezas del saludo al descolgar cuando saluda en este idioma
   * (componerSaludo y componerSaludoDeLlamada). */
  saludo: PartesDelSaludo;
  /** Pista de cada motor de transcripción de Telnyx, o null si no lo
   * entiende. flux es el rápido (fin de turno anticipado); Soniox entiende
   * todos. */
  transcripcion: { flux: string | null; soniox: string };
  /** Lengua cooficial (catalán, euskera, gallego): ninguna Ultra la habla,
   * así que solo es principal, con sus voces de Soniox (que arrancan en
   * ella: `voice_settings.language`), y solo así la habla la
   * recepcionista. */
  cooficial: boolean;
  /** Voces de este idioma, en orden de preferencia: por género, la de por
   * defecto primero (sin elección, atiende la primera de su género), luego
   * las recomendadas y luego el resto. Atienden cuando es el principal. Sin
   * voces, el idioma no puede ser principal. */
  voces: readonly VozDelCatalogo[] | null;
  /** Frase extra del prompt mientras la recepcionista lo habla. */
  notaParaElPrompt?: string;
}

/**
 * Lo que habla cualquier voz Ultra: su idioma y los extranjeros que se
 * ofrecen (alemán, italiano, portugués y neerlandés, aprobados de oído por
 * el usuario el 2026-10-03 en el laboratorio de voces; el ruso, el
 * 2026-10-14, tras escuchar a Blanca y Marcos hablándolo). Ni catalán, ni
 * euskera, ni gallego. Desde el 2026-10-05 la recepcionista los habla
 * todos, sea cual sea el principal (idiomasQueHabla).
 */
export const ULTRA_HABLA = [
  "es-ES",
  "en-GB",
  "fr-FR",
  "de-DE",
  "it-IT",
  "pt-PT",
  "nl-NL",
  "ru-RU",
] as const;

/**
 * Las voces Ultra nativas de un idioma, de vocesUltra.ts (generado por
 * scripts/generarVocesUltra.ts con la API de Telnyx y la curación a mano
 * de curacionDeVoces.ts; decisión del usuario del 2026-10-05). En español,
 * las 29 de España, con Blanca («Graceful Host», desde el 2026-09-12) y
 * Marcos primeras de su género: son las de siempre y cambiarlas cambiaría
 * el payload de Telnyx de todos los negocios que no han elegido voz.
 */
const ultra = (idioma: IdiomaConVocesUltra): VozDelCatalogo[] =>
  VOCES_ULTRA[idioma].map((voz) => ({
    ...voz,
    proveedor: "telnyx",
    habla: ULTRA_HABLA,
  }));

/**
 * Voces de Soniox: cada una habla los 63 idiomas de Soniox, así que son las
 * de catalán, euskera y gallego (atienden también el español, el inglés o
 * el alemán de quien llama). Marta y Sergio, con acento español, elegidas
 * por el usuario el 2026-10-02 escuchando muestras.
 */
const MARTA: VozDelCatalogo = {
  id: "Soniox.tts-rt-v2.Marta",
  proveedor: "soniox",
  nombre: "Marta",
  genero: "femenina",
  descripcion: "Cercana y natural",
  recomendada: true,
  habla: "todos",
};
const SERGIO: VozDelCatalogo = {
  id: "Soniox.tts-rt-v2.Sergio",
  proveedor: "soniox",
  nombre: "Sergio",
  genero: "masculina",
  descripcion: "Cercano y natural",
  recomendada: true,
  habla: "todos",
};

export const IDIOMAS: Record<CodigoDeIdioma, IdiomaDelCatalogo> = {
  "es-ES": {
    iso: "es",
    nombreEnPrompt: "español de España",
    etiqueta: "Español",
    saludo: {
      presentacion:
        "{negocio}, te atiende su asistente de inteligencia artificial.",
      presentacionNueva: {
        femenina:
          "{negocio}, te atiende su nueva asistente de inteligencia artificial.",
        masculina:
          "{negocio}, te atiende su nuevo asistente de inteligencia artificial.",
      },
      presentacionAlCliente: {
        femenina:
          "Hola, {nombre}, soy la asistente de inteligencia artificial de {negocio}.",
        masculina:
          "Hola, {nombre}, soy el asistente de inteligencia artificial de {negocio}.",
      },
      avisoDeGrabacion: "La llamada se graba; si prefieres que no, dímelo.",
      pregunta: "¿En qué te ayudo?",
      repetir: "¿Quieres repetir {servicio} o prefieres algo nuevo?",
      repetirLoDeLaUltimaVez:
        "¿Quieres repetir lo de la última vez o prefieres algo nuevo?",
    },
    transcripcion: { flux: "es", soniox: "es" },
    cooficial: false,
    voces: ultra("es-ES"),
  },
  "en-GB": {
    iso: "en",
    nombreEnPrompt: "inglés",
    etiqueta: "Inglés",
    saludo: {
      presentacion:
        "{negocio}, you're speaking with an artificial intelligence assistant.",
      presentacionNueva:
        "{negocio}, you're speaking with a new artificial intelligence assistant.",
      presentacionAlCliente:
        "Hi {nombre}, this is the artificial intelligence assistant at {negocio}.",
      avisoDeGrabacion:
        "This call is recorded; if you'd rather it wasn't, just tell me.",
      pregunta: "How can I help?",
      repetir: "Would you like {servicio} again, or something new?",
      repetirLoDeLaUltimaVez:
        "Would you like the same as last time, or something new?",
    },
    transcripcion: { flux: "en", soniox: "en" },
    cooficial: false,
    voces: ultra("en-GB"),
  },
  "fr-FR": {
    iso: "fr",
    nombreEnPrompt: "francés",
    etiqueta: "Francés",
    saludo: {
      presentacion:
        "{negocio}, vous êtes en ligne avec une intelligence artificielle.",
      presentacionNueva:
        "{negocio}, vous êtes en ligne avec une nouvelle intelligence artificielle.",
      presentacionAlCliente:
        "Bonjour {nombre}, ici l'intelligence artificielle de {negocio}.",
      avisoDeGrabacion:
        "L'appel est enregistré ; si vous ne le souhaitez pas, dites-le-moi.",
      pregunta: "Comment puis-je vous aider ?",
      repetir: "Vous souhaitez reprendre {servicio}, ou autre chose ?",
      repetirLoDeLaUltimaVez:
        "Vous souhaitez la même chose que la dernière fois, ou autre chose ?",
    },
    transcripcion: { flux: "fr", soniox: "fr" },
    cooficial: false,
    voces: ultra("fr-FR"),
  },
  "ca-ES": {
    iso: "ca",
    nombreEnPrompt: "catalán",
    etiqueta: "Catalán",
    saludo: {
      presentacion: "{negocio}, t'atén una intel·ligència artificial.",
      presentacionNueva:
        "{negocio}, t'atén una nova intel·ligència artificial.",
      presentacionAlCliente:
        "Hola, {nombre}, sóc la intel·ligència artificial de {negocio}.",
      avisoDeGrabacion: "La trucada s'enregistra; si no vols, digues-m'ho.",
      pregunta: "En què et puc ajudar?",
      repetir: "Vols repetir {servicio} o prefereixes una altra cosa?",
      repetirLoDeLaUltimaVez:
        "Vols repetir el de l'última vegada o prefereixes una altra cosa?",
    },
    transcripcion: { flux: null, soniox: "ca" },
    cooficial: true,
    // Las nativas de Azure y las de MiniMax se ofrecieron del 03 al 05-10 y
    // se retiraron por decisión del usuario: se cobran aparte por carácter
    // (hasta +0,014 $/min) y no mejoraban la espera. Ningún negocio llegó a
    // elegirlas (inventario de producción del 2026-10-05).
    voces: [MARTA, SERGIO],
    // Valenciano y balear son el mismo idioma (un solo modelo «ca»); el
    // cliente debe sentir que se le atiende en su variedad.
    notaParaElPrompt:
      "Si quien llama usa formas valencianas o baleares del catalán, adáptate a ellas.",
  },
  "eu-ES": {
    iso: "eu",
    nombreEnPrompt: "euskera",
    etiqueta: "Euskera",
    // Sin «llamar a»: el nombre del negocio iría declinado.
    saludo: {
      presentacion: "Kaixo, {negocio}. Adimen artifizial bat naiz.",
      presentacionNueva: "Kaixo, {negocio}. Adimen artifizial berri bat naiz.",
      presentacionAlCliente:
        "Kaixo, {nombre}. Hemen {negocio}, adimen artifizial bat naiz.",
      avisoDeGrabacion: "Deia grabatu egiten da; nahi ez baduzu, esadazu.",
      pregunta: "Zertan lagun zaitzaket?",
      repetir: "{servicio} berriro nahi duzu, ala beste zerbait?",
      repetirLoDeLaUltimaVez:
        "Azken aldikoa berriro nahi duzu, ala beste zerbait?",
    },
    transcripcion: { flux: null, soniox: "eu" },
    cooficial: true,
    voces: [MARTA, SERGIO],
  },
  "gl-ES": {
    iso: "gl",
    nombreEnPrompt: "gallego",
    etiqueta: "Gallego",
    saludo: {
      presentacion: "{negocio}, atendete unha intelixencia artificial.",
      presentacionNueva:
        "{negocio}, atendete unha nova intelixencia artificial.",
      presentacionAlCliente:
        "Ola, {nombre}, son a intelixencia artificial de {negocio}.",
      avisoDeGrabacion: "A chamada grávase; se non queres, dimo.",
      pregunta: "En que te axudo?",
      repetir: "Queres repetir {servicio} ou prefires outra cousa?",
      repetirLoDeLaUltimaVez:
        "Queres repetir o da última vez ou prefires outra cousa?",
    },
    transcripcion: { flux: null, soniox: "gl" },
    cooficial: true,
    voces: [MARTA, SERGIO],
  },
  "de-DE": {
    iso: "de",
    nombreEnPrompt: "alemán",
    etiqueta: "Alemán",
    saludo: {
      presentacion:
        "{negocio}, Sie sprechen mit einer künstlichen Intelligenz.",
      presentacionNueva:
        "{negocio}, Sie sprechen mit einer neuen künstlichen Intelligenz.",
      presentacionAlCliente:
        "Hallo {nombre}, hier ist die künstliche Intelligenz von {negocio}.",
      avisoDeGrabacion:
        "Das Gespräch wird aufgezeichnet; wenn Sie das nicht möchten, sagen Sie es mir.",
      pregunta: "Wie kann ich Ihnen helfen?",
      repetir: "Möchten Sie wieder {servicio} oder etwas anderes?",
      repetirLoDeLaUltimaVez:
        "Möchten Sie dasselbe wie beim letzten Mal oder etwas anderes?",
    },
    transcripcion: { flux: "de", soniox: "de" },
    cooficial: false,
    voces: ultra("de-DE"),
  },
  "it-IT": {
    iso: "it",
    nombreEnPrompt: "italiano",
    etiqueta: "Italiano",
    saludo: {
      presentacion: "{negocio}, sta parlando con un'intelligenza artificiale.",
      presentacionNueva:
        "{negocio}, sta parlando con una nuova intelligenza artificiale.",
      presentacionAlCliente:
        "Buongiorno {nombre}, sono l'intelligenza artificiale di {negocio}.",
      avisoDeGrabacion:
        "La chiamata viene registrata; se non vuole, me lo dica.",
      pregunta: "Come posso aiutarla?",
      repetir: "Vuole ripetere {servicio} o preferisce qualcos'altro?",
      repetirLoDeLaUltimaVez:
        "Vuole ripetere come l'ultima volta o preferisce qualcos'altro?",
    },
    transcripcion: { flux: "it", soniox: "it" },
    cooficial: false,
    voces: ultra("it-IT"),
  },
  "pt-PT": {
    iso: "pt",
    nombreEnPrompt: "portugués",
    etiqueta: "Portugués",
    // «Obrigado/a» concuerda con quien habla, y la voz puede ser de mujer o
    // de hombre: un saludo sin él vale para las dos.
    saludo: {
      presentacion: "{negocio}, está a falar com uma inteligência artificial.",
      presentacionNueva:
        "{negocio}, está a falar com uma nova inteligência artificial.",
      presentacionAlCliente:
        "Olá {nombre}, fala a inteligência artificial de {negocio}.",
      avisoDeGrabacion: "A chamada é gravada; se não quiser, diga-me.",
      pregunta: "Em que posso ajudar?",
      repetir: "Quer repetir {servicio} ou prefere outra coisa?",
      repetirLoDeLaUltimaVez:
        "Quer repetir o da última vez ou prefere outra coisa?",
    },
    transcripcion: { flux: "pt", soniox: "pt" },
    cooficial: false,
    voces: ultra("pt-PT"),
  },
  "nl-NL": {
    iso: "nl",
    nombreEnPrompt: "neerlandés",
    etiqueta: "Neerlandés",
    saludo: {
      presentacion: "{negocio}, u spreekt met een kunstmatige intelligentie.",
      presentacionNueva:
        "{negocio}, u spreekt met een nieuwe kunstmatige intelligentie.",
      presentacionAlCliente:
        "Hallo {nombre}, u spreekt met de kunstmatige intelligentie van {negocio}.",
      avisoDeGrabacion:
        "Het gesprek wordt opgenomen; als u dat niet wilt, zeg het me dan.",
      pregunta: "Waarmee kan ik u helpen?",
      repetir: "Wilt u weer {servicio} of liever iets anders?",
      repetirLoDeLaUltimaVez:
        "Wilt u hetzelfde als de vorige keer of liever iets anders?",
    },
    transcripcion: { flux: "nl", soniox: "nl" },
    cooficial: false,
    voces: ultra("nl-NL"),
  },
  // Decisión del usuario del 2026-10-14: lo hablan las voces Ultra de
  // cualquier principal (Blanca y Marcos, escuchados), y flux lo entiende.
  // Sin voces propias, así que no puede ser principal; su saludo sirve para
  // saludar en ruso a quien ya llamó hablándolo. De usted, como se atiende
  // en ruso; sin género, como en los demás idiomas que no son el español.
  "ru-RU": {
    iso: "ru",
    nombreEnPrompt: "ruso",
    etiqueta: "Ruso",
    saludo: {
      presentacion: "{negocio}, с вами говорит искусственный интеллект.",
      presentacionNueva:
        "{negocio}, с вами говорит наш новый помощник на основе искусственного интеллекта.",
      presentacionAlCliente:
        "Здравствуйте, {nombre}! С вами говорит помощник {negocio} на основе искусственного интеллекта.",
      avisoDeGrabacion:
        "Разговор записывается; если вы не хотите, скажите мне.",
      pregunta: "Чем могу помочь?",
      repetir: "Хотите повторить {servicio} или что-то другое?",
      repetirLoDeLaUltimaVez:
        "Хотите повторить то же, что в прошлый раз, или что-то другое?",
    },
    transcripcion: { flux: "ru", soniox: "ru" },
    cooficial: false,
    voces: null,
  },
};

/**
 * Qué se ofrece en cada mercado: el idioma describe lo que se puede hacer y
 * el mercado lo que se ofrece. Fuera de la oferta, un idioma guardado sigue
 * funcionando.
 *
 * España (decisiones del usuario del 2026-10-03 y del 2026-10-05, con
 * datos del INE, Frontur y las encuestas lingüísticas): de principal,
 * español, catalán, euskera, gallego (en Cataluña es obligatorio poder
 * atender en catalán: Codi de consum, art. 128-1) o, para negocios de
 * clientela extranjera, inglés, francés, alemán, italiano, portugués o
 * neerlandés. Con cualquiera habla además los siete de ULTRA_HABLA
 * (idiomasQueHabla).
 */
export interface Mercado {
  /** Lo habla siempre, sea cual sea el principal. */
  obligatorio: CodigoDeIdioma;
  /** Los que pueden ser el principal, en el orden del panel. */
  principales: readonly CodigoDeIdioma[];
}

export const MERCADOS = {
  ES: {
    obligatorio: "es-ES",
    principales: [
      "es-ES",
      "ca-ES",
      "eu-ES",
      "gl-ES",
      "en-GB",
      "fr-FR",
      "de-DE",
      "it-IT",
      "pt-PT",
      "nl-NL",
    ],
  },
} as const satisfies Record<string, Mercado>;

export type CodigoDeMercado = keyof typeof MERCADOS;

export const MERCADO_POR_DEFECTO: CodigoDeMercado = "ES";

export function esCodigoDeIdioma(valor: unknown): valor is CodigoDeIdioma {
  return (CODIGOS_DE_IDIOMA as readonly unknown[]).includes(valor);
}

/** Puede ser el principal: tiene voces propias. */
export function puedeSerPrincipal(codigo: CodigoDeIdioma): boolean {
  return IDIOMAS[codigo].voces !== null;
}

export function esCooficial(codigo: CodigoDeIdioma): boolean {
  return IDIOMAS[codigo].cooficial;
}

/**
 * Los idiomas que habla la recepcionista con `principal`, en orden
 * canónico (decisión del usuario del 2026-10-05): el dueño ya no los elige.
 * Los siete de ULTRA_HABLA con cualquier principal y, si es una lengua
 * cooficial, también ella (con sus voces de Soniox, que hablan todos). Se
 * guardan así en `languages`, para que lo que lo lee siga igual, y
 * alimentan la transcripción y la lista del prompt.
 */
export function idiomasQueHabla(principal: CodigoDeIdioma): CodigoDeIdioma[] {
  return CODIGOS_DE_IDIOMA.filter(
    (codigo) =>
      codigo === principal ||
      (ULTRA_HABLA as readonly CodigoDeIdioma[]).includes(codigo)
  );
}

export function hablaIdioma(
  voz: VozDelCatalogo,
  idioma: CodigoDeIdioma
): boolean {
  return voz.habla === "todos" || voz.habla.includes(idioma);
}

/** Las de `voces` que hablan todos `idiomas`, en el mismo orden. */
export function vocesQueHablan(
  voces: readonly VozDelCatalogo[],
  idiomas: readonly CodigoDeIdioma[]
): VozDelCatalogo[] {
  return voces.filter((voz) =>
    idiomas.every((idioma) => hablaIdioma(voz, idioma))
  );
}

/** «ultra»: las Ultra nativas del principal; «soniox»: las de un principal
 * cooficial (Marta y Sergio). */
export type FamiliaDeVoces = "ultra" | "soniox";

export interface VocesDeLaFamilia {
  familia: FamiliaDeVoces;
  /** Las voces que pueden atender, en el orden del catálogo. */
  voces: readonly VozDelCatalogo[];
}

/**
 * Qué voces pueden atender con `principal`: las suyas. Las de una lengua
 * cooficial son de Soniox (hablan todos los idiomas); las de cualquier otro,
 * sus Ultra nativas (español → las 29 de España; inglés → las británicas;
 * etc.).
 */
export function familiaDeVoces(principal: CodigoDeIdioma): VocesDeLaFamilia {
  return {
    familia: esCooficial(principal) ? "soniox" : "ultra",
    voces: IDIOMAS[principal].voces ?? [],
  };
}

const IDS_DEL_CATALOGO: ReadonlySet<string> = new Set(
  Object.values(IDIOMAS).flatMap((idioma) =>
    (idioma.voces ?? []).map((voz) => voz.id)
  )
);

/** ¿Es el identificador de una voz del catálogo (de cualquier idioma)? */
export function esVozDelCatalogo(id: unknown): id is string {
  return typeof id === "string" && IDS_DEL_CATALOGO.has(id);
}

function rellenar(texto: string, valores: Record<string, string>): string {
  return Object.entries(valores).reduce(
    (resultado, [clave, valor]) => resultado.split(`{${clave}}`).join(valor),
    texto
  );
}

function conGenero(texto: TextoConGenero, genero: GeneroDeVoz): string {
  return typeof texto === "string" ? texto : texto[genero];
}

/**
 * El saludo fijo del assistant: a quien no se conoce y sin grabar. Es el que
 * queda guardado en Telnyx; en cada llamada
 * de Telnyx el backend manda el suyo (componerSaludoDeLlamada).
 */
export function componerSaludo(
  codigo: CodigoDeIdioma,
  negocio: string
): string {
  const partes = IDIOMAS[codigo].saludo;
  return rellenar(`${partes.presentacion} ${partes.pregunta}`, { negocio });
}

/**
 * El aviso de IA del chat de WhatsApp cuando la primera respuesta no lo da
 * (modules/whatsapp/chatCliente.ts): la presentación del saludo, sin la
 * pregunta.
 */
export function avisoDeIA(codigo: CodigoDeIdioma, negocio: string): string {
  return rellenar(IDIOMAS[codigo].saludo.presentacion, { negocio });
}

/** ¿Dice el texto que es una inteligencia artificial, en alguno de los
 * idiomas del catálogo? */
export function mencionaLaIA(texto: string): boolean {
  return /inteligencia artificial|intel·ligència artificial|intelixencia artificial|adimen artifizial|artificial intelligence|intelligence artificielle|künstliche[nr]? intelligenz|intelligenza artificiale|inteligência artificial|kunstmatige intelligentie|искусственн(?:ый|ого) интеллект|(?<![\p{L}])(IA|AI|KI)(?![\p{L}])/iu.test(
    texto
  );
}

/**
 * El saludo de una llamada concreta (lib/contextoDeLlamada.ts): con el
 * nombre de quien ya reservó y su último servicio (o «lo de la última vez»),
 * «nueva» la primera semana, y el aviso de grabación solo si ese cliente
 * aceptó que se graben sus llamadas.
 */
export function componerSaludoDeLlamada(
  codigo: CodigoDeIdioma,
  entrada: {
    negocio: string;
    genero: GeneroDeVoz;
    primeraSemana: boolean;
    cliente: { nombre: string; servicio: string | null } | null;
    grabando: boolean;
  }
): string {
  const partes = IDIOMAS[codigo].saludo;
  const piezas = entrada.cliente
    ? [
        conGenero(partes.presentacionAlCliente, entrada.genero),
        entrada.grabando ? partes.avisoDeGrabacion : null,
        entrada.cliente.servicio
          ? partes.repetir
          : partes.repetirLoDeLaUltimaVez,
      ]
    : [
        entrada.primeraSemana
          ? conGenero(partes.presentacionNueva, entrada.genero)
          : partes.presentacion,
        entrada.grabando ? partes.avisoDeGrabacion : null,
        partes.pregunta,
      ];
  return rellenar(piezas.filter(Boolean).join(" "), {
    negocio: entrada.negocio,
    nombre: entrada.cliente?.nombre ?? "",
    servicio: entrada.cliente?.servicio ?? "",
  });
}
