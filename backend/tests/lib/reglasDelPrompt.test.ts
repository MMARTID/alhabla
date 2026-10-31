import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  buildManagedAgentPrompt,
  DEFAULT_AGENT_SETTINGS,
  VERSIONES_DEL_PROMPT,
  type VersionDelPrompt,
} from "../../src/lib/managedAgentPrompt.js";
import {
  buildTelnyxAssistantPayload,
  buildTelnyxVoiceTools,
} from "../../src/lib/telnyxAssistantPayload.js";
import { BUSINESS_TYPES } from "../../src/lib/businessType.js";
import {
  idiomasQueHabla,
  componerSaludo,
  mencionaLaIA,
} from "../../src/lib/idiomas/catalogo.js";
import { resolverIdiomas } from "../../src/lib/idiomas/resolver.js";
import {
  cuandoParaDecir,
  normalizeVoiceToolDateTime,
} from "../../src/lib/voiceDateTime.js";
import type { TransferenciaAlDueno } from "../../src/lib/transferenciaAlDueno.js";
import { reglasDelChat } from "../../src/lib/seccionesDelPrompt.js";

/**
 * Censo de reglas del prompt de la recepcionista (F0 de
 * PLAN-PROMPT-DINAMICO.md). Cada regla que salió de un bug, de una llamada
 * real o de la ley está en una tabla con el motivo por el que existe y los
 * sitios donde vive HOY: el prompt, la descripción de una tool, la respuesta
 * de una tool o una guarda del backend. El test comprueba contra el código
 * actual que está de verdad en cada sitio y exige que ninguna regla se quede
 * sin ninguno.
 *
 * Para qué sirve: mover una regla del prompt a la respuesta de una tool (F1 y
 * F2 del plan) o recortar una descripción (F3) no puede perderla en silencio
 * (lección del #58: censo antes y después). Quien mueva una regla, edita aquí
 * su lugar en el mismo cambio: si el censo falla, la regla se ha quedado sin
 * sitio o la tabla ya no dice la verdad.
 *
 * Solo depende de lo que ya existe en origin/main (no de siguiente_paso,
 * di_al_cliente, como_decirlo, pautas ni abierto_ahora), así vale antes y
 * después de F1.
 */

// ---------------------------------------------------------------------------
// El código bajo censo
// ---------------------------------------------------------------------------

/** La raíz de backend/, para leer el código fuente de lo que no se exporta. */
const RAIZ_DEL_BACKEND = fileURLToPath(new URL("../..", import.meta.url));

function leerFuente(fichero: string): string {
  return readFileSync(`${RAIZ_DEL_BACKEND}${fichero}`, "utf8");
}

/**
 * El código fuente sin comentarios y, con `cadenas: false`, con el texto de
 * las cadenas vaciado (se quedan las comillas y las expresiones `${…}` de
 * las plantillas). Así un campo o un símbolo que solo sale en un comentario
 * o dentro de un texto no cuenta como código. No entiende las expresiones
 * regulares literales: basta para el código del backend.
 */
function soloCodigo(fuente: string, { cadenas }: { cadenas: boolean }): string {
  let salida = "";
  let i = 0;
  /** Lee código hasta el final o hasta la `}` que cierra un `${`. */
  const leerCodigo = (dentroDePlantilla: boolean): void => {
    let llaves = 0;
    while (i < fuente.length) {
      const c = fuente[i]!;
      const siguiente = fuente[i + 1];
      if (c === "/" && siguiente === "/") {
        while (i < fuente.length && fuente[i] !== "\n") i++;
      } else if (c === "/" && siguiente === "*") {
        const fin = fuente.indexOf("*/", i + 2);
        i = fin === -1 ? fuente.length : fin + 2;
        salida += " ";
      } else if (c === '"' || c === "'") {
        salida += c;
        i++;
        while (i < fuente.length && fuente[i] !== c && fuente[i] !== "\n") {
          const avance = fuente[i] === "\\" ? 2 : 1;
          if (cadenas) salida += fuente.slice(i, i + avance);
          i += avance;
        }
        salida += c;
        i++;
      } else if (c === "`") {
        salida += c;
        i++;
        leerPlantilla();
      } else {
        if (c === "{") llaves++;
        if (c === "}") {
          if (dentroDePlantilla && llaves === 0) {
            salida += c;
            i++;
            return;
          }
          llaves--;
        }
        salida += c;
        i++;
      }
    }
  };
  /** Lee el resto de una plantilla, ya pasada la ` de apertura. */
  const leerPlantilla = (): void => {
    while (i < fuente.length) {
      const c = fuente[i]!;
      if (c === "\\") {
        if (cadenas) salida += fuente.slice(i, i + 2);
        i += 2;
      } else if (c === "`") {
        salida += c;
        i++;
        return;
      } else if (c === "$" && fuente[i + 1] === "{") {
        salida += "${";
        i += 2;
        leerCodigo(true);
      } else {
        if (cadenas) salida += c;
        i++;
      }
    }
  };
  leerCodigo(false);
  return salida;
}

/** Tipos con los que un `campo: …` es una anotación, no un valor devuelto. */
const ANOTACION_DE_TIPO =
  /^\s*(?:(?:string|number|boolean|null|undefined|unknown|Date|Record|Array|ReadonlyArray)\b|""|'')/;

/** ¿Devuelve el código `campo` como clave de un objeto (`campo: valor` o
 * `{ campo, … }`), fuera de comentarios, cadenas, declaraciones y tipos? */
function devuelveElCampo(fuente: string, campo: string): boolean {
  const codigo = soloCodigo(fuente, { cadenas: false });
  const patron = new RegExp(
    `(?<!\\b(?:let|const|var)\\s+)\\b${campo}\\b\\s*([:,}])`,
    "g"
  );
  for (const encontrado of codigo.matchAll(patron)) {
    if (encontrado[1] !== ":") return true;
    const resto = codigo.slice(encontrado.index + encontrado[0].length);
    if (!ANOTACION_DE_TIPO.test(resto)) return true;
  }
  return false;
}

/** ¿Sigue el código imponiendo la guarda? Un código de error tiene que
 * salir como `code: "X"`; un identificador, en el código (no en un
 * comentario ni en un texto); una frase, en un texto del código. */
function tieneLaGuarda(fuente: string, simbolo: string): boolean {
  if (/^[A-Z][A-Z0-9_]+$/.test(simbolo)) {
    return new RegExp(`\\bcode:\\s*"${simbolo}"`).test(
      soloCodigo(fuente, { cadenas: true })
    );
  }
  if (/^[A-Za-z_$][\w$]*$/.test(simbolo)) {
    return new RegExp(`\\b${simbolo}\\b`).test(
      soloCodigo(fuente, { cadenas: false })
    );
  }
  return soloCodigo(fuente, { cadenas: true }).includes(simbolo);
}

const SERVICIO_DE_VOZ = "src/modules/voiceTools/service.ts";

const transferencia = (
  modo: TransferenciaAlDueno["modo"]
): TransferenciaAlDueno => ({
  modo,
  origen: "+34910000000",
  destino: "+34600000000",
  activa: true,
});

type EntradaDelPrompt = Parameters<typeof buildManagedAgentPrompt>[0];

const BASE: EntradaDelPrompt = {
  businessName: "Peluquería Ana",
  businessType: "peluqueria",
  businessDetails: "Aceptamos tarjeta y Bizum.",
  settings: DEFAULT_AGENT_SETTINGS,
};

/** Del orden del Brain to Train de producción (897 caracteres): lo más largo
 * que el prompt lleva hoy de información del negocio. */
const INFORMACION_LARGA = `${"Abrimos de lunes a sábado. Aceptamos tarjeta, Bizum y efectivo. Hay parking gratuito detrás del local. ".repeat(9)}Las tarifas están en la web.`;

/**
 * Las variantes del prompt que cambian de texto: lo que activa el dueño
 * (privacidad, transferencia, precios), su plan (lista de espera y
 * recordatorio), el idioma y el nicho. «base» es la de un negocio sin nada
 * especial.
 */
const VARIANTES = {
  base: BASE,
  sinListaDeEsperaNiRecordatorio: {
    ...BASE,
    listaDeEspera: false,
    recordatorioPorWhatsapp: false,
  },
  conPrivacidad: { ...BASE, ocultarNumeroDelNegocio: true },
  transferenciaSiLoPide: {
    ...BASE,
    transferenciaAlDueno: transferencia("si_lo_pide"),
  },
  transferenciaSiempre: {
    ...BASE,
    transferenciaAlDueno: transferencia("siempre"),
  },
  preciosSiempre: {
    ...BASE,
    settings: { ...DEFAULT_AGENT_SETTINGS, darPrecios: "siempre" },
  },
  preciosNunca: {
    ...BASE,
    settings: { ...DEFAULT_AGENT_SETTINGS, darPrecios: "nunca" },
  },
  conRestricciones: {
    ...BASE,
    minAdvanceBookingMinutes: 120,
    maxAppointmentDurationMinutes: 90,
  },
  unSoloIdioma: { ...BASE, idiomas: ["es-ES"] },
  catalanPrincipal: {
    ...BASE,
    settings: {
      ...DEFAULT_AGENT_SETTINGS,
      voiceLanguage: "ca-ES",
      languages: idiomasQueHabla("ca-ES"),
    },
  },
  fisioterapia: { ...BASE, businessType: "fisioterapia" },
  centroDeEstetica: { ...BASE, businessType: "centro-de-estetica" },
  // Lo más pesado que hay hoy en producción (Brain to Train: un gimnasio
  // «other» con 897 caracteres de información del negocio y la cooficial de
  // su zona), sin lo que ningún negocio vivo tiene activo.
  cargada: {
    ...BASE,
    businessType: "other",
    businessDetails: INFORMACION_LARGA,
    settings: {
      ...DEFAULT_AGENT_SETTINGS,
      voiceLanguage: "ca-ES",
      languages: idiomasQueHabla("ca-ES"),
    },
  },
  // El techo teórico: todo lo condicional a la vez, con el ajuste y el nicho
  // que más pesan. No existe en producción (ninguna cuenta tiene privacidad
  // ni transferencia activas), pero es lo que un dueño puede llegar a activar.
  todoActivo: {
    ...BASE,
    businessType: "fisioterapia",
    businessDetails: INFORMACION_LARGA,
    settings: {
      ...DEFAULT_AGENT_SETTINGS,
      tone: "professional",
      primaryGoal: "lead_capture",
      responseStyle: "balanced",
      escalation: "request_callback",
      darPrecios: "siempre",
      voiceLanguage: "ca-ES",
      languages: idiomasQueHabla("ca-ES"),
    },
    minAdvanceBookingMinutes: 120,
    maxAppointmentDurationMinutes: 90,
    listaDeEspera: true,
    recordatorioPorWhatsapp: true,
    ocultarNumeroDelNegocio: true,
    transferenciaAlDueno: transferencia("siempre"),
  },
} satisfies Record<string, EntradaDelPrompt>;

type IdDeVariante = keyof typeof VARIANTES;

/** La variante con su versión del prompt (agentSettings.versionDelPrompt). */
function conVersion(
  entrada: EntradaDelPrompt,
  version: VersionDelPrompt
): EntradaDelPrompt {
  return {
    ...entrada,
    settings: {
      ...(entrada.settings as Record<string, unknown>),
      versionDelPrompt: version,
    },
  };
}

/** El prompt de cada variante en cada versión. */
const PROMPTS_POR_VERSION: Record<
  VersionDelPrompt,
  Record<IdDeVariante, string>
> = Object.fromEntries(
  VERSIONES_DEL_PROMPT.map((version) => [
    version,
    Object.fromEntries(
      (Object.keys(VARIANTES) as IdDeVariante[]).map((id) => [
        id,
        buildManagedAgentPrompt(conVersion(VARIANTES[id], version)),
      ])
    ),
  ])
) as Record<VersionDelPrompt, Record<IdDeVariante, string>>;

/** Los de v1, el prompt de siempre. */
const PROMPTS = PROMPTS_POR_VERSION.v1;

/** El prompt partido por secciones: «Rol» → «## Rol\n\n…». Un título es la
 * primera línea de cada bloque que empieza por «## ». */
function seccionesDe(prompt: string): Map<string, string> {
  const secciones = new Map<string, string>();
  for (const bloque of prompt.split(/\n\n(?=## )/)) {
    const titulo = bloque.split("\n", 1)[0].replace(/^## /, "");
    secciones.set(titulo, bloque);
  }
  return secciones;
}

/** Todo lo que el modelo lee de una tool de webhook, hangup o transfer: su
 * descripción y el esquema de sus parámetros (nombres y descripciones). */
function textosDeLasTools(): Map<string, string> {
  const textos = new Map<string, string>();
  const recoger = (valor: unknown, salida: string[]): void => {
    if (typeof valor === "string") salida.push(valor);
    else if (Array.isArray(valor)) valor.forEach((v) => recoger(v, salida));
    else if (valor && typeof valor === "object") {
      for (const [clave, v] of Object.entries(valor)) {
        salida.push(clave);
        recoger(v, salida);
      }
    }
  };

  for (const tool of buildTelnyxVoiceTools("https://api.alhabla.test")) {
    const salida: string[] = [tool.name, tool.description];
    recoger(tool.properties, salida);
    textos.set(tool.name, salida.join("\n"));
  }

  const payload = buildTelnyxAssistantPayload({
    businessId: "negocio",
    agentId: "agente",
    businessName: "Peluquería Ana",
    instructions: "i",
    greeting: "",
    idiomas: resolverIdiomas({
      languages: ["es-ES"],
      voiceLanguage: "es-ES",
      voiceGender: "femenina",
    }),
    voice: "Telnyx.Ultra.isabel",
    transferenciaAlDueno: { from: "+34910000000", to: "+34600000000" },
  });
  for (const tool of payload.tools ?? []) {
    const salida: string[] = [];
    recoger(tool, salida);
    textos.set(tool.type, salida.join("\n"));
  }
  return textos;
}

const TEXTOS_DE_LAS_TOOLS = textosDeLasTools();
const NOMBRES_DE_LAS_TOOLS = new Set(
  buildTelnyxVoiceTools("https://api.alhabla.test").map((tool) => tool.name)
);

// ---------------------------------------------------------------------------
// La tabla de reglas
// ---------------------------------------------------------------------------

/** Dónde vive una regla hoy. */
type Lugar =
  /** Una frase del prompt, dentro de la sección `seccion` ("Rol", sin las
   * almohadillas), en cada variante de `variantes` (por defecto, solo la
   * base; «todas» las recorre) y en cada versión de `versiones` (por
   * defecto, solo v1). `alFinal`: además tiene que ser la última sección
   * del prompt. Los demás lugares valen para todas las versiones. */
  | {
      en: "prompt";
      seccion: string;
      texto: string;
      variantes?: readonly IdDeVariante[] | "todas";
      versiones?: readonly VersionDelPrompt[];
      alFinal?: boolean;
    }
  /** Una frase de la descripción de la tool o del esquema de sus parámetros
   * (también `hangup` y `transfer`). */
  | { en: "descripcionDeTool"; tool: string; texto: string }
  /** Una frase de las reglas que el chat de WhatsApp antepone al primer
   * mensaje de cada conversación con el prompt v2 (reglasDelChat). Solo
   * cuenta para v2: con v1 van en el prompt. */
  | { en: "reglasDelChat"; texto: string; ocultarNumero?: boolean }
  /** Un campo que la respuesta de la tool devuelve: se busca como clave de
   * un objeto en el código de voiceTools/service.ts (o en `fichero`), sin
   * contar comentarios, textos, declaraciones ni tipos (devuelveElCampo). */
  | { en: "respuestaDeTool"; tool: string; campo: string; fichero?: string }
  /** Un símbolo del código del backend que impone la regla aunque el modelo
   * la ignore (tieneLaGuarda: un código de error como `code: "X"`, un
   * identificador en el código o una frase en un texto, nunca en un
   * comentario). `comprueba` ejecuta la guarda si es una función pura. */
  | {
      en: "guardaDelBackend";
      simbolo: string;
      fichero: string;
      comprueba?: () => boolean;
    };

interface Regla {
  /** Id corto y estable. */
  id: string;
  /** Qué exige la regla. */
  descripcion: string;
  /** Por qué existe: el PR, el commit o el bug del que salió. */
  origen: string;
  lugares: readonly Lugar[];
}

const REGLAS: readonly Regla[] = [
  {
    id: "aviso-ia",
    descripcion:
      "Quien llama o escribe sabe desde el principio que habla con una IA; si se presenta, dice «recepcionista de IA» con la sigla.",
    origen:
      "Reglamento europeo de IA, art. 50 (obligatorio desde el 2-8-2026): PR #286 (4253247) y PR #290 (321283f, 12-10); «recepcionista de IA» con la sigla: PR #373 (cf7ba8c, 29-10).",
    lugares: [
      {
        en: "prompt",
        seccion: "Rol",
        texto:
          "Eres la recepcionista de IA de {{nombre_negocio}}: una inteligencia artificial.",
      },
      {
        en: "prompt",
        seccion: "Rol",
        texto: "Si te presentas, di «recepcionista de IA», con la sigla.",
      },
      {
        en: "prompt",
        seccion: "Chat por WhatsApp",
        texto:
          "en tu primera respuesta di, en una frase corta, que le atiende la recepcionista de IA de {{nombre_negocio}}",
      },
      {
        en: "guardaDelBackend",
        simbolo: "componerSaludo",
        fichero: "src/lib/idiomas/catalogo.ts",
        comprueba: () =>
          mencionaLaIA(componerSaludo("es-ES", "Peluquería Ana")),
      },
      {
        en: "guardaDelBackend",
        simbolo: "avisoDeIA",
        fichero: "src/modules/whatsapp/chatCliente.ts",
      },
    ],
  },
  {
    id: "verdad-persona-o-maquina",
    descripcion:
      "Si le preguntan si es una persona o una máquina, dice siempre la verdad; nunca lo niega.",
    origen:
      "Reglamento europeo de IA, art. 50: PR #286 (4253247) y PR #290 (321283f, 12-10); hasta entonces el prompt mandaba no mencionarlo.",
    lugares: [
      {
        en: "prompt",
        versiones: ["v1", "v2"],
        seccion: "Rol",
        texto:
          "Si te preguntan si eres una persona o una máquina, di siempre la verdad.",
      },
    ],
  },
  {
    id: "no-repetir-el-saludo",
    descripcion:
      "En la llamada el saludo lo dice el sistema al descolgar: la recepcionista no lo repite.",
    origen:
      "Llamadas del 05 y 07-10: con «empieza con el saludo» lo repetía en su primera respuesta (idiomas/resolver.ts, instruccionesDeIdioma).",
    lugares: [
      {
        en: "prompt",
        versiones: ["v1", "v2"],
        seccion: "Rol",
        texto:
          "En las llamadas el saludo ya lo dice al descolgar: no lo repitas.",
      },
      {
        en: "prompt",
        versiones: ["v1", "v2"],
        seccion: "Rol",
        texto: "no lo repitas. Desde tu primera respuesta",
      },
    ],
  },
  {
    id: "no-inventar",
    descripcion:
      "No inventa servicios, precios, disponibilidad, profesionales ni políticas; sin información verificada, lo dice y escala.",
    origen:
      "Base del prompt desde 2c28b7c/865b05a (sep-2026); reforzada por #339 (4fb772f) y #343 (59db942) cuando con get_catalog sin precio se inventaba uno.",
    lugares: [
      {
        en: "prompt",
        seccion: "Límites",
        texto:
          "No inventes precios, servicios, disponibilidad, profesionales ni políticas. Si falta información verificada, dilo y escala.",
      },
      {
        en: "prompt",
        seccion: "Lo que ofrece el negocio",
        texto: "solo lo sabes por get_catalog",
      },
      {
        en: "descripcionDeTool",
        tool: "get_catalog",
        texto: "Única fuente de lo que ofrece el negocio",
      },
    ],
  },
  {
    id: "get-catalog-antes-de-contestar",
    descripcion:
      "Ante la primera pregunta por servicios, profesionales u horario (también de sí o no y en cualquier idioma) llama a get_catalog en ese mismo turno; no dice «sí», «no» ni «ahora lo miro» antes de tener la respuesta.",
    origen:
      "PR #259 (1cd2e99, 07-10): el 05-10 contestó «yes, we do highlights» en un negocio sin servicios; por chat solo consultaba 27 de 72 preguntas de sí o no, con el bloque nuevo 288/288 y 13 llamadas reales. Redacción medida: no se toca.",
    lugares: [
      {
        en: "prompt",
        seccion: "Lo que ofrece el negocio",
        texto: "llama a get_catalog en ese mismo turno antes de contestar",
      },
      {
        en: "prompt",
        seccion: "Lo que ofrece el negocio",
        texto:
          "No digas «sí», «no» ni «ahora lo miro» antes de tener su respuesta",
      },
      {
        en: "descripcionDeTool",
        tool: "get_catalog",
        texto:
          "Llámala antes de confirmar o negar un servicio, un profesional o el horario, también ante una pregunta de sí o no",
      },
    ],
  },
  {
    id: "catalogo-una-sola-vez",
    descripcion:
      "Contesta las preguntas siguientes con la respuesta de get_catalog, sin volver a llamarla en la misma conversación (salvo ID inexistente).",
    origen:
      "PR #259 (1cd2e99): con la primera redacción la llamaba en cada pregunta, hasta 3 veces por llamada.",
    lugares: [
      {
        en: "prompt",
        versiones: ["v1", "v2"],
        seccion: "Lo que ofrece el negocio",
        texto:
          "sin volver a llamarla en la misma conversación (salvo que una herramienta te diga que un ID no existe)",
      },
    ],
  },
  {
    id: "sinonimo-es-el-mismo-servicio",
    descripcion:
      "Un sinónimo o una traducción es el mismo servicio del catálogo; si no encaja con ninguno, no se confirma y se ofrece que el negocio lo confirme.",
    origen:
      "PR #259 (1cd2e99): las llamadas del 05-10 y las mediciones por chat del 07-10 (highlights, metxes y mechas).",
    lugares: [
      {
        en: "prompt",
        versiones: ["v1", "v2"],
        seccion: "Lo que ofrece el negocio",
        texto: "aunque lo llame de otra forma o en otro idioma",
      },
      {
        en: "prompt",
        versiones: ["v1", "v2"],
        seccion: "Lo que ofrece el negocio",
        texto: "dile que ese servicio no lo tenéis",
      },
    ],
  },
  {
    id: "precio-solo-de-get-catalog",
    descripcion:
      "El precio solo sale de get_catalog; sin precio no se inventa ni se calcula (se cuenta cómo se fija si el negocio lo explica) y el total es la suma exacta.",
    origen:
      "PR #339 (4fb772f, 084a081, 20-10) y PR #343 (59db942, 21-10): con get_catalog sin precio se inventaba uno.",
    lugares: [
      {
        en: "prompt",
        seccion: "Precios",
        texto: "no lo inventes ni lo calcules",
      },
      {
        en: "prompt",
        seccion: "Precios",
        texto: "que sea la suma exacta de esos precios",
      },
      { en: "respuestaDeTool", tool: "get_catalog", campo: "precios" },
    ],
  },
  {
    id: "precios-segun-dar-precios",
    descripcion:
      "Dar precios siempre, solo si preguntan o nunca, según el ajuste del dueño; con «nunca» el precio ni siquiera llega a la llamada.",
    origen:
      "Decisión del dueño del producto del 20-10 (PR #339, 4fb772f): hasta entonces la recepcionista no daba precios aunque la web y el Gestor lo prometían.",
    lugares: [
      {
        en: "prompt",
        seccion: "Precios",
        texto:
          "Di el precio de un servicio solo si el cliente pregunta cuánto cuesta; si no lo pregunta, no lo menciones.",
      },
      {
        en: "prompt",
        seccion: "Precios",
        texto:
          "Di el precio de cada servicio la primera vez que lo ofrezcas o lo confirmes, aunque no te lo pregunten",
        variantes: ["preciosSiempre"],
      },
      {
        en: "prompt",
        seccion: "Precios",
        texto:
          "No des precios, ni aproximados ni de la información del negocio.",
        variantes: ["preciosNunca"],
      },
      { en: "respuestaDeTool", tool: "get_catalog", campo: "precios" },
      {
        en: "guardaDelBackend",
        simbolo: "modoDeDarPrecios",
        fichero: "src/lib/managedAgentPrompt.ts",
      },
      {
        en: "descripcionDeTool",
        tool: "get_catalog",
        texto: "en precios, cuándo decirlos",
      },
    ],
  },
  {
    id: "no-elegir-la-hora",
    descripcion:
      "Si el cliente no ha dicho una hora ni ha pedido la primera disponible, se la pregunta: nunca elige ella la hora.",
    origen:
      "1199385 (15-09): ofrecía la próxima hora libre y reservaba sin servicio; llamada real a la Barbería del 14-09 (PR #33/#48).",
    lugares: [
      {
        en: "prompt",
        versiones: ["v1", "v2"],
        seccion: "Reserva",
        texto: "nunca elijas tú una hora",
      },
    ],
  },
  {
    id: "no-preguntar-duracion-ni-con-quien",
    descripcion:
      "No pregunta la duración (solo la menciona si pasa de 80 minutos o la piden), ni con quién quiere la cita; si le da igual el servicio, busca con el más corto.",
    origen:
      "Llamada real del 14-09 (PR #33/#48): preguntaba la duración y pedía confirmaciones sueltas; PR #65 (f7c6b31, asignación por especialidad).",
    lugares: [
      {
        en: "respuestaDeTool",
        tool: "get_catalog",
        campo: "pautas",
      },
      {
        en: "prompt",
        versiones: ["v1", "v2"],
        seccion: "Reserva",
        texto: "No preguntes con quién quiere la cita",
      },
      {
        en: "prompt",
        seccion: "Reserva",
        texto: "La duración es un dato interno de get_catalog: no la preguntes",
      },
      {
        en: "prompt",
        seccion: "Reserva",
        texto: "busca con la duración del servicio más corto de get_catalog",
      },
    ],
  },
  {
    id: "alternativa-ya-comprobada",
    descripcion:
      "Si no hay hueco y la respuesta trae una alternativa (suggestedNextSlot con su token), la ofrece tal cual: ya está comprobada.",
    origen:
      "3c1546b (PR #24): la hora alternativa la calcula el backend; PR #271/#272 corrigieron el hueco sugerido desplazado por la zona horaria.",
    lugares: [
      {
        en: "prompt",
        seccion: "Reserva",
        texto: "esa alternativa ya está comprobada: ofrécela",
      },
      {
        en: "respuestaDeTool",
        tool: "check_availability",
        campo: "suggestedNextSlot",
      },
    ],
  },
  {
    id: "resumen-unica-confirmacion",
    descripcion:
      "El resumen de servicio, día, hora y nombre y la pregunta del WhatsApp van en UN solo turno y son la única confirmación de la reserva; sin confirmaciones sueltas.",
    origen:
      "PR #295 (861046a, 14-10): con el texto anterior reservaba sin resumen en 14 de 30; con este, resumen en 29 de 29 y ninguna confirmación repetida. Redacción medida: no se toca.",
    lugares: [
      {
        en: "prompt",
        seccion: "Reserva",
        texto:
          "en un solo turno resume servicio, día, hora y nombre y pregunta si lo reservas",
      },
      {
        en: "prompt",
        seccion: "Reserva",
        texto:
          "Es la única confirmación de la reserva: aceptar una hora o una alternativa no lo es",
      },
      {
        en: "prompt",
        seccion: "Reserva",
        texto: "Mientras recoges datos no pidas confirmaciones sueltas",
      },
      {
        en: "descripcionDeTool",
        tool: "book_appointment",
        texto: "Úsala solo tras confirmación explícita",
      },
    ],
  },
  {
    id: "consentimiento-de-whatsapp",
    descripcion:
      "Un sí claro a la reserva y al WhatsApp da smsConsent true; si no acepta el WhatsApp o duda, false y sin insistir.",
    origen:
      "PR #24 (d56198f, consentimiento) y PR #295 (861046a, 14-10): la llamada real del 14-09 preguntaba por SMS en vez de WhatsApp.",
    lugares: [
      {
        en: "prompt",
        seccion: "Reserva",
        texto: "Un sí claro confirma las dos cosas (smsConsent true).",
      },
      {
        en: "prompt",
        seccion: "Reserva",
        texto: "smsConsent es false: no insistas",
      },
      {
        en: "descripcionDeTool",
        tool: "book_appointment",
        texto:
          "true si el cliente dijo que sí a recibir la confirmación y un recordatorio por WhatsApp",
      },
    ],
  },
  {
    id: "recordatorio-solo-si-el-plan",
    descripcion:
      "Solo promete el recordatorio por WhatsApp si el plan lo incluye; si no, ofrece solo la confirmación.",
    origen:
      "PR #339 (4fb772f, 20-10): antes el plan Inicio prometía un recordatorio que no tenía.",
    lugares: [
      {
        en: "prompt",
        versiones: ["v1", "v2"],
        seccion: "Reserva",
        texto: "la confirmación y un recordatorio por WhatsApp a este número",
      },
      {
        en: "prompt",
        versiones: ["v1", "v2"],
        seccion: "Reserva",
        texto:
          "pregunta si lo reservas y le envías la confirmación por WhatsApp a este número",
        variantes: ["sinListaDeEsperaNiRecordatorio"],
      },
    ],
  },
  {
    id: "whatsapp-de-alhabla-solo-si-mensajeCliente",
    descripcion:
      "Dice «te llegará un WhatsApp de Alhabla» solo si aceptó y book_appointment devuelve mensajeCliente = whatsapp; con «ninguno», no menciona ningún mensaje.",
    origen:
      "PR #116 (f6e490b) y PR #339 (4fb772f): mensajeCliente solo es whatsapp cuando la confirmación quedó programada de verdad.",
    lugares: [
      {
        en: "prompt",
        seccion: "Reserva",
        texto: 'mensajeCliente = "whatsapp"',
      },
      {
        en: "respuestaDeTool",
        tool: "book_appointment",
        campo: "mensajeCliente",
      },
    ],
  },
  {
    id: "reserva-con-token-y-exito",
    descripcion:
      "Reserva solo tras el sí, con clientName y el availabilityToken de la opción aceptada, y da la cita por hecha solo si book_appointment devuelve éxito.",
    origen:
      "Flujo de reserva desde PR #24 (sep-2026); el token caduca a los 5 minutos y el backend lo comprueba aunque el modelo reserve a ciegas.",
    lugares: [
      {
        en: "prompt",
        seccion: "Reserva",
        texto: "Da la cita por hecha solo si devuelve éxito",
      },
      {
        en: "descripcionDeTool",
        tool: "book_appointment",
        texto: "con el availabilityToken de check_availability",
      },
      {
        en: "guardaDelBackend",
        simbolo: "readAvailabilityDraft",
        fichero: SERVICIO_DE_VOZ,
      },
    ],
  },
  {
    id: "nombre-real-del-cliente",
    descripcion:
      "Reserva con el nombre real del cliente en clientName: nunca vacío ni «el mismo de antes».",
    origen:
      "PR #312 (de12e69, auditoría del 16-10): al recrear una cita se reservaba con descripciones en vez de un nombre.",
    lugares: [
      {
        en: "prompt",
        seccion: "Reserva",
        texto: "con su nombre en clientName (nunca vacío",
      },
      {
        en: "prompt",
        seccion: "Cita existente",
        texto:
          "Nunca reserves con descripciones como 'el mismo de antes' en lugar de un nombre real.",
      },
      {
        en: "descripcionDeTool",
        tool: "find_my_appointment",
        texto: "clientName (el nombre con el que se reservó",
      },
    ],
  },
  {
    id: "restricciones-del-negocio",
    descripcion:
      "No ofrece ni confirma citas con menos antelación que la mínima ni más largas que la máxima que fijó el dueño.",
    origen:
      "Ajustes del dueño (antelación mínima y duración máxima): el prompt los anuncia y el backend los impone aunque el modelo los ignore.",
    lugares: [
      {
        en: "prompt",
        seccion: "Reserva",
        texto:
          "No ofrezcas ni confirmes citas con menos de 2 horas de antelación.",
        variantes: ["conRestricciones"],
      },
      {
        en: "prompt",
        seccion: "Reserva",
        texto: "Ninguna cita puede durar más de 90 minutos.",
        variantes: ["conRestricciones"],
      },
      {
        en: "guardaDelBackend",
        simbolo: "checkBookingRestrictions",
        fichero: "src/lib/businessSchedule.ts",
      },
    ],
  },
  {
    id: "una-cita-por-llamada",
    descripcion:
      "Solo se cierra una cita por llamada: si pide otra, no comprueba ni promete nada y le dice que vuelva a llamar; cambiar la recién reservada se hace con replacesBookingId.",
    origen:
      "PR #362 (b9ef5c6, hallazgo 7 de la auditoría del 28-10): una segunda reserva sustituía a la primera en silencio.",
    lugares: [
      {
        en: "prompt",
        seccion: "Reserva",
        texto: "Solo puedes cerrar una cita por llamada.",
      },
      {
        en: "descripcionDeTool",
        tool: "book_appointment",
        texto: "Solo se puede reservar una cita por llamada",
      },
      {
        en: "guardaDelBackend",
        simbolo: "YA_HAY_CITA_EN_ESTA_LLAMADA",
        fichero: SERVICIO_DE_VOZ,
      },
    ],
  },
  {
    id: "cambiar-cita-sin-anular-antes",
    descripcion:
      "Para cambiar una cita: find_my_appointment sin argumentos, confirmársela en voz alta, NO anularla y comprobar la nueva con replacesBookingId; la antigua se anula solo si la nueva se reserva y, si no, sigue en pie.",
    origen:
      "PR #312 (de12e69, auditoría del 16-10): en un chat real del 13-10 la reserva nueva falló con la vieja ya cancelada.",
    lugares: [
      {
        en: "prompt",
        seccion: "Cita existente",
        texto: "Para cambiarla no la canceles",
      },
      {
        en: "prompt",
        seccion: "Cita existente",
        texto: "pasando su bookingId en replacesBookingId a check_availability",
      },
      {
        en: "prompt",
        seccion: "Cita existente",
        texto: "Si la nueva no se puede reservar, la que tenía sigue en pie",
      },
      {
        en: "descripcionDeTool",
        tool: "check_availability",
        texto:
          "el sistema anula la cita antigua (solo si la nueva queda reservada)",
      },
      {
        en: "descripcionDeTool",
        tool: "cancel_appointment",
        texto: "Para cambiarla no la uses",
      },
    ],
  },
  {
    id: "cancelar-solo-con-si-explicito",
    descripcion:
      "Confirma la cita en voz alta antes de tocarla y solo la cancela tras un sí explícito del cliente.",
    origen:
      "PR #24 (d56198f, gestión de cita por el número de quien llama) y PR #312 (de12e69).",
    lugares: [
      {
        en: "prompt",
        seccion: "Cita existente",
        texto: "confírmasela en voz alta antes de tocarla",
      },
      {
        en: "prompt",
        seccion: "Cita existente",
        texto:
          "para cancelarla usa cancel_appointment con su id tras confirmación explícita del cliente",
      },
      {
        en: "descripcionDeTool",
        tool: "cancel_appointment",
        texto: "tras su confirmación explícita",
      },
    ],
  },
  {
    id: "no-insinuar-citas-a-otro-nombre",
    descripcion:
      "Si find_my_appointment no encuentra la cita, pide los datos sin dar a entender que pueda existir una cita a otro nombre.",
    origen: "PR #312 (de12e69, auditoría del 16-10, datos del cliente).",
    lugares: [
      {
        en: "prompt",
        seccion: "Cita existente",
        texto: "sin dar a entender que pueda existir una cita a otro nombre",
      },
      {
        en: "guardaDelBackend",
        simbolo: "APPOINTMENT_NOT_FOUND",
        fichero: SERVICIO_DE_VOZ,
      },
    ],
  },
  {
    id: "professionalId-solo-si-lo-nombro",
    descripcion:
      "Envía professionalId solo si el cliente pidió a alguien por su nombre; si no, no elige: el sistema asigna.",
    origen:
      "PR #65 (f7c6b31, 17-09, asignación por especialidad); llamada real del 14-09.",
    lugares: [
      {
        en: "prompt",
        seccion: "Profesionales",
        texto:
          "Envía professionalId a check_availability solo si el cliente ha pedido a alguien por su nombre.",
      },
      {
        en: "descripcionDeTool",
        tool: "check_availability",
        texto:
          "solo si el cliente pidió a un profesional concreto por su nombre",
      },
    ],
  },
  {
    id: "proponer-recomendacion-una-vez",
    descripcion:
      "Si check_availability recomienda a otra persona, la propone UNA sola vez; si el cliente insiste, reserva con professionalConfirmed true sin explicar nada.",
    origen:
      "PR #65 (f7c6b31, 17-09): el backend frena la reserva con PROFESSIONAL_CONFIRMATION_REQUIRED si no se propuso.",
    lugares: [
      {
        en: "prompt",
        seccion: "Profesionales",
        texto:
          "propón UNA sola vez, en positivo, reservar con la persona recomendada",
      },
      {
        en: "prompt",
        seccion: "Profesionales",
        texto: "professionalConfirmed: true",
      },
      {
        en: "respuestaDeTool",
        tool: "check_availability",
        campo: "recommendation",
      },
      {
        en: "descripcionDeTool",
        tool: "book_appointment",
        texto: "la propusiste una vez",
      },
      {
        en: "guardaDelBackend",
        simbolo: "PROFESSIONAL_CONFIRMATION_REQUIRED",
        fichero: SERVICIO_DE_VOZ,
      },
    ],
  },
  {
    id: "profesionales-en-positivo",
    descripcion:
      "Nunca dice ni insinúa que un profesional no hace o no domina un servicio, ni habla de niveles, categorías o recomendaciones del sistema.",
    origen:
      "PR #65 (f7c6b31, 17-09, especialista / lo hace / no sugerir): la jerarquía interna no se enseña al cliente.",
    lugares: [
      {
        en: "prompt",
        seccion: "Profesionales",
        texto:
          "Nunca digas ni insinúes que un profesional no hace un servicio, no lo domina o no se le da bien.",
      },
      {
        en: "prompt",
        seccion: "Profesionales",
        texto:
          "Nunca menciones niveles, categorías ni recomendaciones del sistema.",
      },
      {
        en: "guardaDelBackend",
        simbolo: "instruccionesDeRecomendacion",
        fichero: SERVICIO_DE_VOZ,
      },
    ],
  },
  {
    id: "especialista-solo-con-isSpecialist",
    descripcion:
      "Dice que alguien es especialista solo si isSpecialist es true, en positivo y nombrando el servicio del catálogo, sin ejemplo literal que copiar.",
    origen:
      "PR #293 (337d6f8, llamadas de prueba del 14-10): con el ejemplo literal dijo «especialista en color» de un corte.",
    lugares: [
      {
        en: "prompt",
        seccion: "Profesionales",
        texto:
          "Si isSpecialist es true, al confirmar puedes decir en positivo que esa persona es especialista en el servicio que ha pedido, nombrándolo como en el catálogo",
      },
      {
        en: "respuestaDeTool",
        tool: "check_availability",
        campo: "isSpecialist",
      },
    ],
  },
  {
    id: "grabacion-solo-con-permiso",
    descripcion:
      "La transcripción se guarda siempre; el audio solo si quien llama lo acepta. No pregunta nunca por su cuenta si puede grabar; en el chat no se graba.",
    origen:
      "PR #290 (12-10) y PR #293 (d0175e9, 5adf69b, e39288c, 965370c, 13-14/10): con la regla en el prompt volvía a preguntar a quien ya había aceptado (4 de 4 llamadas del 14-10); lo decide el backend.",
    lugares: [
      {
        en: "prompt",
        seccion: "Grabación",
        texto:
          "La transcripción se guarda siempre; el audio, solo si quien llama lo acepta. No preguntes nunca por tu cuenta si puedes grabar.",
      },
      {
        en: "guardaDelBackend",
        simbolo: "tocaPreguntarPorGrabar",
        fichero: "src/lib/grabacion.ts",
      },
      {
        en: "guardaDelBackend",
        simbolo: "En el chat no se graba nada",
        fichero: SERVICIO_DE_VOZ,
      },
    ],
  },
  {
    id: "grabacion-pregunta-de-check-availability",
    descripcion:
      "Si check_availability trae pregunta_de_grabacion, dice solo esa pregunta (en el idioma de la conversación) y espera; con un sí o un no claro llama a preferencia_de_grabacion (true o false); si no es claro, no la llama.",
    origen:
      "PR #293 (d0175e9, 5adf69b, e39288c, 965370c): la pregunta en positivo (con «¿te importa…?» contestaban «No» queriendo decir sí) y decidida por el backend.",
    lugares: [
      {
        en: "prompt",
        seccion: "Grabación",
        texto:
          "Si la respuesta de check_availability trae pregunta_de_grabacion, no contestes todavía a lo que te pidió: di solo esa pregunta",
      },
      {
        en: "prompt",
        seccion: "Grabación",
        texto: "llama a preferencia_de_grabacion con acepta true",
      },
      {
        en: "respuestaDeTool",
        tool: "check_availability",
        campo: "pregunta_de_grabacion",
      },
      {
        en: "descripcionDeTool",
        tool: "preferencia_de_grabacion",
        texto:
          "cuando conteste con claridad a la pregunta_de_grabacion que te dio check_availability",
      },
    ],
  },
  {
    id: "grabacion-pide-no-grabar",
    descripcion:
      "Si en cualquier momento dice que no quiere que se grabe, llama a preferencia_de_grabacion con acepta false en ese mismo turno; fuera de ese caso y del anterior no la usa ni habla de grabar.",
    origen:
      "PR #293 (965370c, 14-10): en el laboratorio la llamó 3 veces en 60 conversaciones sin que nadie hablara de grabar, y guardaba un «no».",
    lugares: [
      {
        en: "prompt",
        seccion: "Grabación",
        texto:
          "llama a preferencia_de_grabacion con acepta false en ese mismo turno",
      },
      {
        en: "prompt",
        seccion: "Grabación",
        texto: "Fuera de esos dos casos",
      },
      {
        en: "descripcionDeTool",
        tool: "preferencia_de_grabacion",
        texto: "o cuando pida con sus palabras que no se grabe",
      },
      {
        en: "descripcionDeTool",
        tool: "preferencia_de_grabacion",
        texto: "Nunca en otro momento",
      },
    ],
  },
  {
    id: "grabacion-datos-del-cliente",
    descripcion:
      "Si pregunta qué se hace con sus datos, el negocio los usa solo para gestionar sus citas y puede pedir verlos o borrarlos; si le graban solo se dice si el saludo lo dijo o lo aceptó.",
    origen:
      "PR #290 (321283f, 12-10): la finalidad real, sin explicaciones legales salvo que pregunten.",
    lugares: [
      {
        en: "prompt",
        versiones: ["v1", "v2"],
        seccion: "Grabación",
        texto: "{{nombre_negocio}} los usa solo para gestionar sus citas",
      },
      {
        en: "prompt",
        versiones: ["v1", "v2"],
        seccion: "Grabación",
        texto:
          "Si pregunta si le estás grabando: solo si el saludo lo dijo o si lo ha aceptado en esta llamada.",
      },
    ],
  },
  {
    id: "no-colgar-por-frase-mal-entendida",
    descripcion:
      "Una orden de colgar en el PRIMER turno, o que no encaja con lo que pedía, no cuelga: pregunta una vez y cuelga solo si lo confirma.",
    origen:
      "PR #88 (f4df5b1, llamada real del 19-09): «quiero que me cuelguen como jamón» y colgó a los 10 s; quedó como NO_ANSWER con comprehension_issue.",
    lugares: [
      {
        en: "prompt",
        versiones: ["v1", "v2"],
        seccion: "Cierre",
        texto: "Si esa petición de colgar llega en el PRIMER turno",
      },
      {
        en: "prompt",
        versiones: ["v1", "v2"],
        seccion: "Cierre",
        texto: "NO cuelgues",
      },
      {
        en: "prompt",
        versiones: ["v1", "v2"],
        seccion: "Cierre",
        texto: "Pregunta una sola vez",
      },
    ],
  },
  {
    id: "despedida-en-una-frase-y-colgar",
    descripcion:
      "Ante una despedida normal dice una sola frase y cuelga en ese turno; si ordenan colgar con claridad y no queda nada pendiente, cuelga sin despedida.",
    origen:
      "PR #24 (9351ca3, eaa8008, 857355f) y 3be1e12: sin colgar la llamada seguía abierta hasta que colgaba el cliente o se agotaba el límite.",
    lugares: [
      {
        en: "prompt",
        seccion: "Cierre",
        texto: "Ante una despedida normal, di una sola frase breve",
      },
      {
        en: "prompt",
        seccion: "Cierre",
        texto: "Si ordenan colgar con claridad y no queda nada pendiente",
      },
      {
        en: "descripcionDeTool",
        tool: "hangup",
        texto: "Cuelga la llamada",
      },
    ],
  },
  {
    id: "campo-cuando",
    descripcion:
      "Dice el día y la hora de una cita con el campo cuando que devuelven las tools, sin calcular ella el día de la semana ni del mes.",
    origen:
      "PR #296 (9053c0b, llamada de producción del 14-10): dijo «dijous setze» de una cita del jueves 15.",
    lugares: [
      {
        en: "prompt",
        seccion: "Uso de herramientas",
        texto: "usa el campo cuando que te devuelven las herramientas",
      },
      { en: "respuestaDeTool", tool: "check_availability", campo: "cuando" },
      { en: "respuestaDeTool", tool: "book_appointment", campo: "cuando" },
      { en: "respuestaDeTool", tool: "find_my_appointment", campo: "cuando" },
      {
        en: "guardaDelBackend",
        simbolo: "cuandoParaDecir",
        fichero: "src/lib/voiceDateTime.ts",
        comprueba: () =>
          (
            cuandoParaDecir(
              "2026-10-15T15:00:00.000Z",
              "Europe/Madrid",
              new Date("2026-10-10T10:00:00.000Z")
            ) ?? ""
          ).includes("jueves"),
      },
    ],
  },
  {
    id: "startDateTime-hora-local-nunca-utc",
    descripcion:
      "Todo startDateTime que envía a una tool va en la hora local del negocio con su offset; nunca en UTC (+00:00 o Z).",
    origen:
      "PR #271 y #272 (hueco sugerido desplazado por la zona horaria): las cuatro de la tarde son 16:00 local, no 16:00Z.",
    lugares: [
      {
        en: "prompt",
        seccion: "Uso de herramientas",
        texto: "Nunca lo envíes en UTC (+00:00 o Z)",
      },
      {
        en: "descripcionDeTool",
        tool: "check_availability",
        texto: "Nunca en UTC (+00:00/Z)",
      },
      {
        en: "descripcionDeTool",
        tool: "notify_when_available",
        texto: "(nunca UTC)",
      },
      {
        en: "guardaDelBackend",
        simbolo: "normalizeVoiceToolDateTime",
        fichero: "src/lib/voiceDateTime.ts",
        comprueba: () =>
          normalizeVoiceToolDateTime(
            "2026-09-18T16:00:00Z",
            "Europe/Madrid"
          ) === "2026-09-18T16:00:00+02:00",
      },
    ],
  },
  {
    id: "referencia-temporal",
    descripcion:
      "El prompt lleva el momento actual en la zona del negocio con la zona escrita literal ({{current_time_<zona>}}); sin él «mañana» acaba en una fecha inventada.",
    origen:
      "857355f (PR #24) y issue #122: sin fecha, «mañana» acababa en un día inventado; la variable anidada no está documentada.",
    lugares: [
      {
        en: "prompt",
        seccion: "Referencia temporal",
        texto: "{{current_time_Europe/Madrid}}",
      },
      {
        en: "guardaDelBackend",
        simbolo: "adaptManagedPromptForTelnyx",
        fichero: "src/lib/telnyxAssistantPayload.ts",
      },
    ],
  },
  {
    id: "privacidad-caso-c",
    descripcion:
      "Con el número del negocio oculto, nunca dice el teléfono del negocio ni del dueño (ni en el chat): toma recado y el negocio llama.",
    origen:
      "PR #153 (7286a25, fase 0 de telefonía, 21-09; docs/historico/PLAN-TELEFONIA-UX.md § 3): móvil personal como línea de clientes.",
    lugares: [
      {
        en: "reglasDelChat",
        texto: "no le des ningún teléfono",
        ocultarNumero: true,
      },
      {
        en: "prompt",
        versiones: ["v1", "v2"],
        seccion: "Privacidad",
        texto:
          "No digas nunca el número de teléfono del negocio ni del propietario",
        variantes: ["conPrivacidad"],
      },
      {
        en: "prompt",
        seccion: "Chat por WhatsApp",
        texto: "no le des ningún teléfono",
        variantes: ["conPrivacidad"],
      },
    ],
  },
  {
    id: "transferencia-al-dueno",
    descripcion:
      "Solo pasa la llamada si la tool transfer existe y según el modo (si lo pide / siempre, esta en horario); avisa antes, una vez por llamada y, si falla, sigue con recado sin reintentar.",
    origen:
      "PR #157 (ec76a1a, 69acd53, fase 4, 22-09): la tool nunca viaja sin su regla, ni siquiera en un prompt editado a mano.",
    lugares: [
      {
        en: "prompt",
        seccion: "Pasar la llamada",
        texto: "Pásala una sola vez por llamada.",
        variantes: ["transferenciaSiLoPide", "transferenciaSiempre"],
      },
      {
        en: "prompt",
        seccion: "Pasar la llamada",
        texto:
          "Pásala solo si el cliente pide de forma clara hablar con una persona o con el responsable.",
        variantes: ["transferenciaSiLoPide"],
      },
      {
        en: "prompt",
        seccion: "Pasar la llamada",
        texto: "Solo dentro del horario de apertura del negocio",
        variantes: ["transferenciaSiempre"],
      },
      {
        en: "prompt",
        seccion: "Pasar la llamada",
        texto: "No vuelvas a intentar pasarla en la misma llamada.",
        variantes: ["transferenciaSiLoPide", "transferenciaSiempre"],
      },
      {
        en: "guardaDelBackend",
        simbolo: "promptManualConSuRegla",
        fichero: "src/lib/telnyxAgentSync.ts",
      },
      {
        en: "guardaDelBackend",
        simbolo: "buildTelnyxTransferTool",
        fichero: "src/lib/telnyxAssistantPayload.ts",
      },
    ],
  },
  {
    id: "recados-con-telefono-confirmado",
    descripcion:
      "Un recado lleva el nombre y el motivo con sus palabras; antes de dar por bueno el teléfono pregunta si le llaman a este número o a otro y nunca usa el de la llamada sin que lo confirme. Un recado no sustituye a una reserva.",
    origen:
      "PR #118 (c807bc2, fase 0.5 del 19-09): apuntaba el número desde el que llamaba sin preguntar y el usuario se quejó en la propia llamada.",
    lugares: [
      {
        en: "prompt",
        seccion: "Recados",
        texto: "nunca uses el número desde el que llama sin que lo confirme",
      },
      {
        en: "prompt",
        seccion: "Recados",
        texto: "Un recado no sustituye a una reserva",
      },
      {
        en: "descripcionDeTool",
        tool: "informar_al_negocio",
        texto: "Nunca lo rellenes por tu cuenta.",
      },
    ],
  },
  {
    id: "telefono-dictado-en-grupos-de-tres",
    descripcion:
      "Un teléfono dictado se repite en grupos de tres cifras y se usa solo cuando el cliente lo confirma; si corrige una cifra, se repite el número entero.",
    origen:
      "PR #312 (de12e69, auditoría del 16-10): se guardaba tal cual lo había entendido el modelo, sin que el cliente confirmara ninguna cifra.",
    lugares: [
      {
        en: "prompt",
        seccion: "Conversación",
        texto: "repítelo en grupos de tres cifras",
      },
      {
        en: "prompt",
        seccion: "Conversación",
        texto: "úsalo solo cuando lo confirme",
      },
      {
        en: "descripcionDeTool",
        tool: "book_appointment",
        texto: "tal como lo confirmó al repetírselo",
      },
    ],
  },
  {
    id: "transcripcion-dudosa",
    descripcion:
      "Si una frase llega confusa, cortada o sin sentido, pide que la repita; no trata una palabra dudosa como dato de la reserva ni la busca en el catálogo.",
    origen:
      "PR #48 (eb5e859, 16-09): 3 fallos reales en transcripciones de Telnyx; PR #259.",
    lugares: [
      {
        en: "prompt",
        versiones: ["v1", "v2"],
        seccion: "Conversación",
        texto:
          "La transcripción puede fallar: si una frase te llega confusa, cortada o sin sentido, pide con naturalidad que la repita.",
      },
      {
        en: "prompt",
        versiones: ["v1", "v2"],
        seccion: "Conversación",
        texto: "No trates una palabra dudosa como un dato real de la reserva",
      },
    ],
  },
  {
    id: "una-pregunta-por-turno-y-sin-formato",
    descripcion:
      "Habla como por teléfono: una sola pregunta útil por turno, respuestas cortas y sin etiquetas, emojis ni formato (se lee en voz alta tal cual).",
    origen:
      "Reglas de voz del prompt desde sep-2026; sin ellas los textos se leían con símbolos y listas.",
    lugares: [
      {
        en: "prompt",
        versiones: ["v1", "v2"],
        seccion: "Conversación",
        texto: "haz una sola pregunta útil por turno",
      },
      {
        en: "prompt",
        versiones: ["v1", "v2"],
        seccion: "Conversación",
        texto: "Lo que escribas se lee en voz alta tal cual",
      },
    ],
  },
  {
    id: "sin-muletilla-antes-de-una-tool",
    descripcion:
      "No anuncia ni rellena con muletillas antes de llamar a una herramienta: la llama sin avisar.",
    origen:
      "PR #259 (1cd2e99) y refactor del prompt, paso 4 (3322f04, 14-10): el «ahora lo miro» sin llamar a la tool era uno de los fallos medidos.",
    lugares: [
      {
        en: "prompt",
        versiones: ["v2"],
        seccion: "Herramientas",
        texto:
          "No anuncies ni rellenes con muletillas antes de usar una herramienta.",
      },
      {
        en: "prompt",
        seccion: "Uso de herramientas",
        texto:
          "No anuncies ni generes una muletilla antes de llamar a una herramienta.",
      },
      {
        en: "prompt",
        versiones: ["v1", "v2"],
        seccion: "Lo que ofrece el negocio",
        texto: "llama a la herramienta en ese turno sin anunciarlo",
      },
    ],
  },
  {
    id: "idioma-del-cliente",
    descripcion:
      "Contesta cada turno en el idioma de quien llama (entre los que habla), desde la primera respuesta, y dice los nombres de servicio y las frases entre comillas traducidos.",
    origen:
      "PR #257 (804a5ab, 05-10, tanda «A2 inglés»: 5 de 19 respuestas en castellano a un cliente que hablaba inglés) y PR #293 (producción del 14-10: «el servei seria Peinado»).",
    lugares: [
      {
        en: "prompt",
        seccion: "Rol",
        texto:
          "contesta y continúa exclusivamente en el idioma en que te habla quien llama",
      },
      {
        en: "prompt",
        seccion: "Rol",
        texto: "dilos traducidos a ese idioma, no tal cual",
      },
      {
        en: "prompt",
        seccion: "Rol",
        texto: "Habla siempre en español de España.",
        variantes: ["unSoloIdioma"],
      },
      {
        en: "guardaDelBackend",
        simbolo: "instruccionesDeIdioma",
        fichero: "src/lib/idiomas/resolver.ts",
      },
    ],
  },
  {
    id: "recordatorio-final-de-idioma",
    descripcion:
      "El recordatorio de idioma cierra el prompt («aunque te conteste en castellano») y manda no cambiar de idioma por su cuenta.",
    origen:
      "PR #257 (804a5ab, 05-10): con la regla solo en «## Rol» volvía al castellano tras una tool cuya respuesta viene en castellano; por eso va AL FINAL.",
    lugares: [
      {
        en: "prompt",
        versiones: ["v1", "v2"],
        seccion: "Idioma",
        texto: "(aunque te conteste en castellano)",
        alFinal: true,
      },
      {
        en: "prompt",
        versiones: ["v1", "v2"],
        seccion: "Idioma",
        texto:
          "No cambies de idioma por tu cuenta mientras siga hablando en el suyo.",
        alFinal: true,
      },
    ],
  },
  {
    id: "lista-de-espera",
    descripcion:
      "Con la plantilla hueco_libre aprobada ofrece el aviso por WhatsApp para la hora ORIGINAL; sin ella no promete avisos ni usa notify_when_available.",
    origen:
      "PR #116 (f6e490b, fase 1 PR 4 de WhatsApp, 20-09): la oferta solo entra con la plantilla aprobada en Meta.",
    lugares: [
      {
        en: "prompt",
        seccion: "Uso de herramientas",
        texto:
          "usa notify_when_available con la hora original pedida (no la alternativa)",
      },
      {
        en: "prompt",
        seccion: "Uso de herramientas",
        texto:
          "No prometas avisos por WhatsApp para cuando se libere una hora y no uses notify_when_available.",
        variantes: ["sinListaDeEsperaNiRecordatorio"],
      },
      {
        en: "descripcionDeTool",
        tool: "notify_when_available",
        texto: "Úsala solo cuando lo pida explícitamente",
      },
      {
        en: "guardaDelBackend",
        simbolo: "listaDeEsperaDisponible",
        fichero: "src/modules/whatsapp/service.ts",
      },
    ],
  },
  {
    id: "cliente-conocido",
    descripcion:
      "Si el saludo ya llamó al cliente por su nombre y dice que quiere repetir, no le pide nombre ni servicio; no nombra el servicio si el saludo no lo hizo; si no es esa persona, se disculpa.",
    origen:
      "PR #293 (d0175e9, 13-10, saludo por cliente); el nombre y el servicio los resuelve el backend antes de descolgar.",
    lugares: [
      {
        en: "prompt",
        seccion: "Cliente",
        texto:
          "Si hay nombre, el saludo ya le ha llamado por él y le ha preguntado si quiere repetir",
      },
      {
        en: "prompt",
        seccion: "Cliente",
        texto: "Si dice que no es esa persona, discúlpate",
      },
      {
        en: "guardaDelBackend",
        simbolo: "resolverContextoDeLlamada",
        fichero: "src/lib/contextoDeLlamada.ts",
      },
    ],
  },
  {
    id: "informacion-del-negocio",
    descripcion:
      "La información que el dueño escribe (pagos, cómo llegar, políticas) viaja en el prompt y es de lo único que la recepcionista contesta sobre eso.",
    origen:
      "Desde que el dueño la amplía por WhatsApp (actualizar_informacion del Gestor) es lo que la recepcionista consulta para dudas de pagos, cómo llegar o políticas.",
    lugares: [
      {
        en: "respuestaDeTool",
        tool: "get_catalog",
        campo: "informacion",
      },
      {
        en: "prompt",
        versiones: ["v2"],
        seccion: "Este negocio",
        texto: "Información del negocio: Aceptamos tarjeta y Bizum.",
      },
      {
        en: "prompt",
        seccion: "Información del negocio",
        texto: "Aceptamos tarjeta y Bizum.",
      },
    ],
  },
  {
    id: "limites-por-nicho-sanitario",
    descripcion:
      "Fisioterapia y estética: no pide historial clínico, no diagnostica ni promete resultados; ante una urgencia, emergencias o un profesional sanitario.",
    origen:
      "Nota del RGPD (art. 9): no hay DPA con Telnyx para datos de salud; NICHE_INSTRUCTIONS desde 1202ec2.",
    lugares: [
      {
        en: "prompt",
        versiones: ["v2"],
        seccion: "Este negocio",
        texto: "No diagnostiques, no pautes ejercicios",
        variantes: ["fisioterapia"],
      },
      {
        en: "prompt",
        versiones: ["v2"],
        seccion: "Este negocio",
        texto: "contacte con emergencias",
        variantes: ["fisioterapia"],
      },
      {
        en: "prompt",
        versiones: ["v2"],
        seccion: "Este negocio",
        texto: "No asegures resultados estéticos",
        variantes: ["centroDeEstetica"],
      },
      {
        en: "prompt",
        seccion: "Límites",
        texto: "No diagnostiques, no pautes ejercicios",
        variantes: ["fisioterapia"],
      },
      {
        en: "prompt",
        seccion: "Límites",
        texto: "contacte con emergencias",
        variantes: ["fisioterapia"],
      },
      {
        en: "prompt",
        seccion: "Límites",
        texto: "No asegures resultados estéticos",
        variantes: ["centroDeEstetica"],
      },
    ],
  },
  {
    id: "chat-marcador-manda-sobre-la-hora",
    descripcion:
      "En el chat de WhatsApp, el marcador [WhatsApp · número · fecha] que antepone el sistema da el teléfono del cliente y manda sobre cualquier otra hora.",
    origen:
      "PR #121 (4c2e252, 20-09): en el chat la hora del sistema llega en UTC y el número del cliente no viene como variable.",
    lugares: [
      {
        en: "prompt",
        seccion: "Chat por WhatsApp",
        texto:
          "Si el mensaje empieza por [WhatsApp · número · fecha y hora], estás en un chat de WhatsApp, no en una llamada.",
      },
      {
        en: "prompt",
        seccion: "Chat por WhatsApp",
        texto: "por encima de cualquier otra hora que tengas",
      },
      {
        en: "guardaDelBackend",
        simbolo: "marcadorDeChat",
        fichero: "src/modules/whatsapp/chatCliente.ts",
      },
    ],
  },
  {
    id: "chat-sin-grabar-ni-colgar",
    descripcion:
      "En el chat de WhatsApp no se graba ni se cuelga: no habla de grabar, de colgar ni de audio y no usa preferencia_de_grabacion ni la tool de colgar.",
    origen:
      "PR #121 (4c2e252) y PR #290: sin una llamada de voz no hay audio que grabar ni llamada que colgar; el backend responde «En el chat no se graba nada».",
    lugares: [
      {
        en: "prompt",
        seccion: "Chat por WhatsApp",
        texto: "En el chat no se graba ni se cuelga",
      },
      {
        en: "descripcionDeTool",
        tool: "preferencia_de_grabacion",
        texto: "No la uses en el chat de WhatsApp.",
      },
      {
        en: "guardaDelBackend",
        simbolo: "En el chat no se graba nada",
        fichero: SERVICIO_DE_VOZ,
      },
    ],
  },
  {
    id: "chat-nombre-y-sin-pregunta-del-whatsapp",
    descripcion:
      "En el chat pide el nombre antes de ofrecer reservar (aunque el perfil muestre uno), no pregunta por el WhatsApp (smsConsent true) y la confirmación le llega por el mismo chat.",
    origen:
      "PR #295 (fc4c4d9, 14-10): el nombre del perfil de WhatsApp no es el que quiere para la reserva; ya escribe por WhatsApp.",
    lugares: [
      {
        en: "reglasDelChat",
        texto:
          "Al reservar pregúntale su nombre antes de ofrecerle reservar, aunque su perfil de WhatsApp muestre uno",
      },
      {
        en: "reglasDelChat",
        texto: "usa smsConsent true",
      },
      {
        en: "prompt",
        seccion: "Chat por WhatsApp",
        texto:
          "Al reservar pregúntale su nombre antes de ofrecerle reservar, aunque su perfil de WhatsApp muestre uno",
      },
      {
        en: "prompt",
        seccion: "Chat por WhatsApp",
        texto: "usa smsConsent true",
      },
      {
        en: "prompt",
        versiones: ["v1", "v2"],
        seccion: "Reserva",
        texto: "también en el chat aunque veas el de su perfil",
      },
    ],
  },
  {
    id: "chat-cambiar-desde-el-recordatorio",
    descripcion:
      "Si el cliente pulsó Cambiar en el recordatorio, busca la cita con find_my_appointment y la cambia con el flujo normal (replacesBookingId); si prefiere hablar con alguien, el teléfono del negocio solo si no está oculto.",
    origen:
      "PR #121 y PR #153 (7286a25): el botón Cambiar de la plantilla de recordatorio entra por el chat.",
    lugares: [
      {
        en: "reglasDelChat",
        texto: "Si dice que ha pulsado Cambiar en el recordatorio de una cita",
      },
      {
        en: "reglasDelChat",
        texto: "dale el teléfono del negocio",
      },
      {
        en: "prompt",
        seccion: "Chat por WhatsApp",
        texto: "Si dice que ha pulsado Cambiar en el recordatorio de una cita",
      },
      {
        en: "prompt",
        seccion: "Chat por WhatsApp",
        texto: "dale el teléfono del negocio",
      },
    ],
  },
  {
    id: "informar-al-negocio-al-terminar",
    descripcion:
      "Llama UNA sola vez a informar_al_negocio, solo cuando la llamada ya ha terminado y nunca durante la conversación; apunta en dudas_sin_respuesta lo que no pudo responder.",
    origen:
      "PR #118 y #210 (6bd7347): Telnyx dispara la post-conversación dos veces (AGENTS.md, 19-09); la idempotencia la hace procesarInformeFinal.",
    lugares: [
      {
        en: "prompt",
        versiones: ["v1", "v2"],
        seccion: "Al terminar la llamada",
        texto: "llama UNA sola vez a informar_al_negocio",
      },
      {
        en: "prompt",
        versiones: ["v1", "v2"],
        seccion: "Al terminar la llamada",
        texto: "dudas_sin_respuesta",
      },
      {
        en: "descripcionDeTool",
        tool: "informar_al_negocio",
        texto:
          "Llámala UNA sola vez, solo cuando la llamada ya ha terminado (post-conversación), nunca durante la conversación.",
      },
      {
        en: "descripcionDeTool",
        tool: "informar_al_negocio",
        texto: "Preguntas del cliente que no pudiste responder",
      },
      {
        en: "guardaDelBackend",
        simbolo: "procesarInformeFinal",
        fichero: "src/modules/whatsapp/recados.ts",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// La comprobación
// ---------------------------------------------------------------------------

interface Resultado {
  ok: boolean;
  /** Qué falló, para el mensaje. */
  detalle: string;
}

function describirLugar(lugar: Lugar): string {
  switch (lugar.en) {
    case "prompt":
      return `prompt ${(lugar.versiones ?? ["v1"]).join("+")} › ## ${lugar.seccion} › «${lugar.texto}»`;
    case "descripcionDeTool":
      return `descripción de ${lugar.tool} › «${lugar.texto}»`;
    case "reglasDelChat":
      return `reglas del chat (v2)${lugar.ocultarNumero ? " con el número oculto" : ""} › «${lugar.texto}»`;
    case "respuestaDeTool":
      return `respuesta de ${lugar.tool} › campo ${lugar.campo}`;
    case "guardaDelBackend":
      return `guarda del backend › ${lugar.simbolo} (${lugar.fichero})`;
  }
}

function evaluarLugar(lugar: Lugar): Resultado {
  switch (lugar.en) {
    case "prompt": {
      const variantes =
        lugar.variantes === "todas"
          ? (Object.keys(VARIANTES) as IdDeVariante[])
          : (lugar.variantes ?? (["base"] as const));
      const fallos: string[] = [];
      for (const version of lugar.versiones ?? (["v1"] as const)) {
        for (const variante of variantes) {
          const donde = `${version}, variante ${variante}`;
          const secciones = seccionesDe(PROMPTS_POR_VERSION[version][variante]);
          const cuerpo = secciones.get(lugar.seccion);
          if (cuerpo === undefined) {
            fallos.push(`${donde}: no hay sección «${lugar.seccion}»`);
          } else if (!cuerpo.includes(lugar.texto)) {
            fallos.push(`${donde}: la sección no dice ese texto`);
          } else if (
            lugar.alFinal &&
            [...secciones.keys()].at(-1) !== lugar.seccion
          ) {
            fallos.push(`${donde}: la sección ya no cierra el prompt`);
          }
        }
      }
      return { ok: fallos.length === 0, detalle: fallos.join("; ") };
    }
    case "descripcionDeTool": {
      const texto = TEXTOS_DE_LAS_TOOLS.get(lugar.tool);
      if (texto === undefined) {
        return { ok: false, detalle: `la tool ${lugar.tool} no existe` };
      }
      return texto.includes(lugar.texto)
        ? { ok: true, detalle: "" }
        : { ok: false, detalle: "ni la descripción ni el esquema lo dicen" };
    }
    case "reglasDelChat": {
      const reglas = reglasDelChat({
        nombreDelNegocio: "Peluquería Ana",
        ocultarNumero: lugar.ocultarNumero === true,
      });
      return reglas.includes(lugar.texto)
        ? { ok: true, detalle: "" }
        : { ok: false, detalle: "las reglas del chat no lo dicen" };
    }
    case "respuestaDeTool": {
      if (!NOMBRES_DE_LAS_TOOLS.has(lugar.tool)) {
        return { ok: false, detalle: `la tool ${lugar.tool} no existe` };
      }
      const fuente = leerFuente(lugar.fichero ?? SERVICIO_DE_VOZ);
      return devuelveElCampo(fuente, lugar.campo)
        ? { ok: true, detalle: "" }
        : { ok: false, detalle: "el código ya no devuelve ese campo" };
    }
    case "guardaDelBackend": {
      if (!tieneLaGuarda(leerFuente(lugar.fichero), lugar.simbolo)) {
        return { ok: false, detalle: "el símbolo ya no está en el fichero" };
      }
      if (lugar.comprueba && !lugar.comprueba()) {
        return { ok: false, detalle: "la guarda ya no hace lo que dice" };
      }
      return { ok: true, detalle: "" };
    }
  }
}

describe("censo de reglas del prompt", () => {
  it("tiene al menos las ~27 reglas del plan, con ids únicos y su origen", () => {
    expect(REGLAS.length).toBeGreaterThanOrEqual(27);
    const ids = REGLAS.map((regla) => regla.id);
    expect(new Set(ids).size, `ids repetidos en ${ids.join(", ")}`).toBe(
      ids.length
    );
    for (const regla of REGLAS) {
      expect(
        regla.origen.length,
        `la regla ${regla.id} no dice su origen`
      ).toBeGreaterThan(20);
      expect(
        regla.lugares.length,
        `la regla ${regla.id} no tiene lugares`
      ).toBeGreaterThan(0);
    }
  });

  it("detecta una regla que se ha quedado sin sitio", () => {
    const inexistentes: Lugar[] = [
      {
        en: "prompt",
        seccion: "Rol",
        texto: "una frase que ningún prompt dice",
      },
      { en: "prompt", seccion: "Sección que no existe", texto: "Eres" },
      { en: "descripcionDeTool", tool: "get_catalog", texto: "nada de esto" },
      { en: "descripcionDeTool", tool: "tool_que_no_existe", texto: "x" },
      { en: "respuestaDeTool", tool: "get_catalog", campo: "campo_inventado" },
      {
        en: "guardaDelBackend",
        simbolo: "SIMBOLO_QUE_NO_EXISTE",
        fichero: SERVICIO_DE_VOZ,
      },
    ];
    for (const lugar of inexistentes) {
      expect(evaluarLugar(lugar).ok, describirLugar(lugar)).toBe(false);
    }
  });

  it("no cuenta un campo ni una guarda que solo salen en un comentario, un texto o un tipo", () => {
    const fuente = [
      "// devuelve cuando: y mensajeCliente, readAvailabilityDraft",
      "type Respuesta = { cuando: string | null };",
      'let mensajeCliente: "whatsapp" | "ninguno" = "ninguno";',
      "const texto = `ofrécela con su cuando, sin más`;",
      'const aviso = "YA_HAY_CITA_EN_ESTA_LLAMADA";',
    ].join("\n");
    expect(devuelveElCampo(fuente, "cuando")).toBe(false);
    expect(devuelveElCampo(fuente, "mensajeCliente")).toBe(false);
    expect(tieneLaGuarda(fuente, "readAvailabilityDraft")).toBe(false);
    expect(tieneLaGuarda(fuente, "YA_HAY_CITA_EN_ESTA_LLAMADA")).toBe(false);

    const devuelto = [
      "return { cuando: cuandoParaDecir(x, zona), mensajeCliente };",
      "const r = `${readAvailabilityDraft(token)}`;",
      'return { code: "YA_HAY_CITA_EN_ESTA_LLAMADA" };',
    ].join("\n");
    expect(devuelveElCampo(devuelto, "cuando")).toBe(true);
    expect(devuelveElCampo(devuelto, "mensajeCliente")).toBe(true);
    expect(tieneLaGuarda(devuelto, "readAvailabilityDraft")).toBe(true);
    expect(tieneLaGuarda(devuelto, "YA_HAY_CITA_EN_ESTA_LLAMADA")).toBe(true);
  });

  /** Los lugares que cuentan para una versión: los del prompt de esa
   * versión y todos los demás (tools y guardas valen para las dos). */
  const lugaresDe = (regla: Regla, version: VersionDelPrompt): Lugar[] =>
    regla.lugares.filter((lugar) =>
      lugar.en === "prompt"
        ? (lugar.versiones ?? ["v1"]).includes(version)
        : lugar.en === "reglasDelChat"
          ? version === "v2"
          : true
    );

  describe.each(VERSIONES_DEL_PROMPT)(
    "cada regla vive en algún sitio (%s)",
    (version) => {
      for (const regla of REGLAS) {
        it(regla.id, () => {
          const resultados = lugaresDe(regla, version).map((lugar) => ({
            lugar,
            ...evaluarLugar(lugar),
          }));
          const sitios = resultados
            .map(
              (r) =>
                `  ${r.ok ? "sí  " : "NO  "}${describirLugar(r.lugar)}${r.ok ? "" : ` -> ${r.detalle}`}`
            )
            .join("\n");
          expect(
            resultados.some((r) => r.ok),
            `La regla «${regla.id}» se ha quedado sin sitio en ${version}: ${regla.descripcion}\nOrigen: ${regla.origen}\n${sitios}`
          ).toBe(true);
        });
      }
    }
  );

  describe("la tabla dice la verdad: cada sitio declarado existe", () => {
    for (const regla of REGLAS) {
      it(regla.id, () => {
        const fallos = regla.lugares
          .map((lugar) => ({ lugar, ...evaluarLugar(lugar) }))
          .filter((r) => !r.ok)
          .map((r) => `  ${describirLugar(r.lugar)} -> ${r.detalle}`);
        expect(
          fallos,
          `La tabla de «${regla.id}» ya no coincide con el código; actualiza el lugar o quita el que sobra:\n${fallos.join("\n")}`
        ).toEqual([]);
      });
    }
  });
});

// ---------------------------------------------------------------------------
// Límite de caracteres
// ---------------------------------------------------------------------------

/**
 * Techo de caracteres del prompt por versión. v1 es el prompt de hoy: el
 * techo es de seguridad, para que no siga creciendo mientras se recorta.
 * `techo` vale para cada variante realista (la más cargada incluida);
 * `techoConTodoActivo`, para la teórica con privacidad, transferencia,
 * restricciones e información larga a la vez.
 *
 * Medidas de v1 (30-10-2026, caracteres): base 16.287; sin lista de espera ni
 * recordatorio 16.040; con privacidad 16.691; transferencia si lo pide 17.025
 * y siempre 17.194; precios siempre 16.317 y nunca 15.668; con restricciones
 * 16.399; un solo idioma 15.008; catalán de principal 16.375; fisioterapia
 * 16.360; centro de estética 16.292; «cargada» (como Brain to Train: «other»,
 * 955 caracteres de información y catalán) 17.195; con todo activo 18.870.
 * En producción (BD del 30-10): El petit saló 16.427, Brain to Train 17.129.
 */
const LIMITES_DEL_PROMPT: Record<
  VersionDelPrompt,
  { techo: number; techoConTodoActivo: number }
> = {
  v1: { techo: 18_000, techoConTodoActivo: 19_500 },
  // F2 (PLAN-PROMPT-DINAMICO.md): el prompt compacto, por debajo de 12.000
  // en cualquier combinación de ajustes. Medidas del 31-10: base 9.316,
  // catalán de principal 9.405, un solo idioma 8.700, «cargada» 9.257 y con
  // todo activo unos 10.700.
  v2: { techo: 12_000, techoConTodoActivo: 12_000 },
};

describe.each(VERSIONES_DEL_PROMPT)("tamaño del prompt (%s)", (version) => {
  const prompts = PROMPTS_POR_VERSION[version];
  const limites = LIMITES_DEL_PROMPT[version];
  const medidas = (Object.keys(prompts) as IdDeVariante[]).map((id) => ({
    id,
    caracteres: prompts[id].length,
  }));
  const techoDe = (id: IdDeVariante): number =>
    id === "todoActivo" ? limites.techoConTodoActivo : limites.techo;

  for (const { id, caracteres } of medidas) {
    it(`la variante «${id}» queda por debajo de ${techoDe(id)} caracteres`, () => {
      expect(
        caracteres,
        `El prompt de «${id}» mide ${caracteres} caracteres y el techo de ${version} es ${techoDe(id)}: el prompt no debe seguir creciendo (PLAN-PROMPT-DINAMICO.md).`
      ).toBeLessThan(techoDe(id));
    });
  }

  it("la variante más cargada de producción es «cargada» o una con una opción activa, y cabe en el techo", () => {
    const reales = medidas.filter(({ id }) => id !== "todoActivo");
    const mayor = reales.reduce((a, b) =>
      b.caracteres > a.caracteres ? b : a
    );
    expect(
      mayor.caracteres,
      `La más cargada es «${mayor.id}» con ${mayor.caracteres}`
    ).toBeLessThan(limites.techo);
  });

  it("con todo activo, ningún nicho pasa del techo teórico", () => {
    for (const businessType of BUSINESS_TYPES) {
      const largo = buildManagedAgentPrompt(
        conVersion({ ...VARIANTES.todoActivo, businessType }, version)
      ).length;
      expect(
        largo,
        `El prompt de «${businessType}» con todo activo mide ${largo}`
      ).toBeLessThan(limites.techoConTodoActivo);
    }
  });
});
