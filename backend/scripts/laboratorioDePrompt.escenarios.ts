/**
 * Batería del laboratorio de prompt (scripts/laboratorioDePrompt.ts): los 26
 * escenarios E1-E26 de PLAN-PROMPT-DINAMICO.md, con lo que quiere y sabe el
 * cliente y lo esperado como comprobaciones automáticas sobre las tools que
 * llama la recepcionista y sobre sus respuestas.
 *
 * Dos modos de cliente (`--cliente`):
 * - `reactivo` (por defecto): un LLM barato hace de cliente con el
 *   `objetivo` y los `datos` del guion, y contesta a lo que la recepcionista
 *   pregunta en cada momento. El primer mensaje (`turnos[0]`) y las
 *   `frasesObligatorias` salen siempre tal cual, en su turno; el resto lo
 *   decide el LLM, que termina al cumplir el objetivo o a los `maxTurnos`.
 * - `guion`: los `turnos` fijos de siempre, para reproducir una conversación
 *   exacta. El guion supone el camino feliz de la recepcionista.
 *
 * Por eso las comprobaciones solo hablan de «el turno N» donde el turno está
 * garantizado (el 1, o el de una frase obligatoria) y, en el resto, de «en
 * algún turno», «antes de» o «después de» una tool. «Turno N» es la respuesta
 * de la recepcionista al mensaje N del cliente; el saludo es el turno 0 y no
 * se evalúa.
 *
 * Cada escenario dice qué negocio de dev necesita (`requiere`). Por defecto el
 * laboratorio lo corre con su negocio de laboratorio
 * (laboratorioDePrompt.negocios.ts, sembrado por sembrarNegociosDeLaboratorio.ts);
 * `--negocio` y `--negocio-de E4=<id>` lo fuerzan y entonces no se comprueba
 * que cumpla el requisito.
 */

export type IdiomaDeLaBateria = "es" | "en" | "ca";

export type Canal = "llamada" | "chat";

/** Qué se exige en caso de fallo: «dura» es 0 fallos y nunca peor que el
 * control; «normal», no más de un fallo extra por cada 30 repeticiones. */
export type Regla = "dura" | "normal";

interface Base {
  descripcion: string;
}

/**
 * Qué turnos de la recepcionista cuenta una comprobación. Sin nada, todos.
 * Las opciones se combinan (todas tienen que cumplirse). Con un cliente
 * reactivo solo el turno 1 y los de una frase obligatoria están garantizados;
 * para lo demás sirven `despuesDe`, `antesDe` y `ultimo`.
 */
export interface Ambito {
  /** Solo ese turno. */
  turno?: number;
  /** Solo los turnos posteriores al de la primera llamada a alguna de estas
   * tools. Si nunca se la llama, no hay ningún turno en el ámbito. */
  despuesDe?: string[];
  /** Solo los turnos anteriores al de la primera llamada a alguna de estas
   * tools. Si nunca se la llama, valen todos. */
  antesDe?: string[];
  /** Solo el último turno de la conversación. */
  ultimo?: boolean;
  /** Todos los turnos menos el último (el de la despedida). */
  salvoUltimo?: boolean;
}

export type Comprobacion = Base &
  (
    | ({
        /** Alguna de estas tools se llama entre `minimo` y `maximo` veces,
         * en el ámbito indicado o en toda la conversación. */
        tipo: "llama";
        herramientas: string[];
        minimo?: number;
        maximo?: number;
      } & Ambito)
    | ({
        /** Ninguna de estas tools se llama en el ámbito (sin ámbito, nunca). */
        tipo: "noLlama";
        herramientas: string[];
      } & Ambito)
    | {
        /** En ese turno llama a la tool antes de escribir ningún texto. */
        tipo: "llamaAntesDelTexto";
        herramientas: string[];
        turno: number;
      }
    | {
        /** Las tools salen en este orden (con otras en medio). */
        tipo: "orden";
        herramientas: string[];
      }
    | {
        /** El argumento de la última llamada a la tool vale esto. */
        tipo: "argumento";
        herramienta: string;
        campo: string;
        esperado: string | number | boolean;
      }
    | {
        /** Todas las llamadas a la tool traen el argumento y (no) casa con
         * el patrón. Sin llamadas, se cumple: lo exige otra comprobación. */
        tipo: "argumentoPatron";
        herramienta: string;
        campo: string;
        patron: string;
        debeCoincidir: boolean;
      }
    | ({
        /** Texto de la recepcionista: debe (o no debe) casar con alguno
         * (o con todos) los patrones, en el ámbito o en todos los turnos. */
        tipo: "texto";
        debe: boolean;
        patrones: string[];
        modo?: "alguno" | "todos";
      } & Ambito)
    | {
        /** Idioma de las respuestas de la recepcionista desde ese turno. */
        tipo: "idioma";
        idioma: IdiomaDeLaBateria;
        desdeTurno?: number;
      }
    | {
        /** Ningún teléfono dicho por la recepcionista, salvo los que dio el
         * cliente (`permitidos`, solo cifras). */
        tipo: "sinTelefono";
        permitidos?: string[];
      }
    | {
        tipo: "sinEmojis";
      }
    | ({
        tipo: "maxCaracteres";
        caracteres: number;
      } & Ambito)
  );

/** Lo que sabe el cliente simulado; lo que no esté aquí no lo dice. */
export interface DatosDelCliente {
  idioma: IdiomaDeLaBateria;
  servicio?: string;
  dia?: string;
  hora?: string;
  nombre?: string;
  /** Teléfonos que puede decir, tal como los dicta. */
  telefonos?: string[];
  /** Otros datos o decisiones, en una frase cada uno. */
  otros?: string[];
}

export interface FraseObligatoria {
  /** Mensaje del cliente (1 = el primero). */
  turno: number;
  frase: string;
}

/** Mensajes de más que admite el cliente reactivo sobre los del guion. */
export const MARGEN_DE_TURNOS = 3;

/** Cuántos mensajes del cliente admite como máximo el modo reactivo. */
export function topeDeTurnos(guion: Guion): number {
  return guion.maxTurnos ?? guion.turnos.length + MARGEN_DE_TURNOS;
}

export interface Guion {
  /** «E9a»: el id del escenario y una letra si tiene variantes. */
  clave: string;
  /** Qué prueba esta variante. */
  titulo: string;
  canal: Canal;
  /** Mensajes del cliente, en orden. En el modo `guion` son los turnos fijos;
   * en el reactivo, `turnos[0]` es el primer mensaje, siempre literal. */
  turnos: string[];
  /** Lo que el cliente quiere conseguir y cómo reacciona (modo reactivo). */
  objetivo: string;
  /** Lo único que el cliente simulado sabe; no puede inventar nada más. */
  datos: DatosDelCliente;
  /** Tope de mensajes del cliente en el modo reactivo (por defecto, los del
   * guion más 3). */
  maxTurnos?: number;
  /** Frases que el cliente reactivo dice tal cual en ese turno (el 1 es
   * siempre `turnos[0]`) porque una comprobación las necesita literales.
   * Cada una coincide con `turnos[turno - 1]`. */
  frasesObligatorias?: FraseObligatoria[];
  /** Si recorre la reserva o la anulación hasta el final: crea o toca citas
   * reales en dev (solo corren con `--con-citas`). */
  creaCitas: boolean;
  /** Cómo tiene que estar el negocio de dev para que valga la prueba. */
  requiere: string;
  comprobaciones: Comprobacion[];
  /** Preguntas de sí o no para el juez LLM (`--juez`), sobre lo textual. */
  rubrica?: string[];
}

export interface Escenario {
  id: string;
  titulo: string;
  regla: Regla;
  guiones: Guion[];
}

const SIN_REQUISITOS = "Una peluquería de dev con catálogo y horario.";
const RESERVA = [
  "Quiero un corte el viernes a las 17, soy Marta",
  "Sí, resérvalo y sí, mándame el WhatsApp",
];
const COLGAR = ["hangup", "end_call"];

/** Una cifra con precio: «30 €», «18 euros». */
const PRECIO = "\\d+(?:[.,]\\d+)?\\s*(?:€|euros?)";
const EMOJI = "\\p{Extended_Pictographic}";

export const ESCENARIOS: Escenario[] = [
  {
    id: "E1",
    titulo: "Catálogo: sí o no de un servicio que no existe",
    regla: "dura",
    guiones: [
      {
        clave: "E1",
        titulo: "«¿Hacéis keratina?» en el primer turno",
        canal: "llamada",
        turnos: ["¿Hacéis keratina?", "Vale, gracias. Nada más, adiós."],
        objetivo:
          "Preguntar si hacen keratina. Cuando te contesten, da las gracias y despídete; no pidas cita.",
        datos: {
          idioma: "es",
          servicio: "keratina",
        },
        maxTurnos: 3,
        creaCitas: false,
        requiere: "Una peluquería de dev sin el servicio «keratina».",
        comprobaciones: [
          {
            tipo: "llamaAntesDelTexto",
            herramientas: ["get_catalog"],
            turno: 1,
            descripcion:
              "Llama a get_catalog en el primer turno, antes de hablar",
          },
          {
            tipo: "texto",
            debe: false,
            patrones: [
              "^\\W*(?:sí|si|claro|por supuesto|desde luego)(?!\\p{L})",
            ],
            turno: 1,
            descripcion: "No empieza con un «sí» sin haber consultado",
          },
          {
            tipo: "texto",
            debe: false,
            patrones: [
              "(?:un momento|ahora (?:lo )?(?:miro|compruebo|consulto)|déjame (?:mirar|comprobar|consultar))",
            ],
            turno: 1,
            descripcion: "No dice «lo miro» sin llamar a la tool",
          },
        ],
        rubrica: [
          "¿Dice que el negocio no tiene ese servicio, u ofrece que el negocio lo confirme, sin asegurar que lo hacen?",
        ],
      },
    ],
  },
  {
    id: "E2",
    titulo: "Catálogo en otro idioma con sinónimo",
    regla: "normal",
    guiones: [
      {
        clave: "E2",
        titulo: "«Do you do highlights?» con «Mechas» en el catálogo",
        canal: "llamada",
        turnos: ["Do you do highlights?", "And how long is it?"],
        objetivo:
          "Preguntar en inglés si hacen highlights y, cuando te contesten, preguntar cuánto dura. Después da las gracias y despídete, sin reservar.",
        datos: {
          idioma: "en",
          servicio: "highlights",
        },
        maxTurnos: 4,
        creaCitas: false,
        requiere: "Una peluquería de dev con el servicio «Mechas».",
        comprobaciones: [
          {
            tipo: "llama",
            herramientas: ["get_catalog"],
            turno: 1,
            descripcion: "Llama a get_catalog en el primer turno",
          },
          {
            tipo: "llama",
            herramientas: ["get_catalog"],
            minimo: 1,
            maximo: 1,
            descripcion:
              "Una sola llamada a get_catalog en toda la conversación",
          },
          {
            tipo: "idioma",
            idioma: "en",
            descripcion: "Contesta en inglés",
          },
          {
            tipo: "texto",
            debe: false,
            patrones: ["\\bmechas\\b"],
            descripcion: "Traduce el servicio, no dice «Mechas» tal cual",
          },
          {
            tipo: "texto",
            debe: false,
            patrones: ["\\d+\\s*(?:min|minutes|hours?)"],
            turno: 1,
            descripcion: "No dice la duración si no se la han pedido",
          },
        ],
      },
    ],
  },
  {
    id: "E3",
    titulo: "Idioma sostenido: reserva entera en inglés",
    regla: "normal",
    guiones: [
      {
        clave: "E3",
        titulo: "Cliente que solo habla inglés, de la consulta a la despedida",
        canal: "llamada",
        turnos: [
          "Hi, I'd like to book a haircut for Friday at 5pm. My name is Marta.",
          "Yes, that's right, please book it, and yes to the WhatsApp message.",
          "No, that's all. Thank you, bye!",
        ],
        objetivo:
          "Reservar en inglés un corte de pelo (haircut) el viernes a las 5pm a nombre de Marta. Confirma la reserva y acepta el mensaje de WhatsApp. Cuando esté reservada, di que no necesitas nada más y despídete.",
        datos: {
          idioma: "en",
          servicio: "haircut",
          dia: "Friday",
          hora: "5pm",
          nombre: "Marta",
          otros: ["Aceptas que te manden el WhatsApp de confirmación"],
        },
        creaCitas: true,
        requiere: `${SIN_REQUISITOS} Con inglés entre los idiomas del negocio.`,
        comprobaciones: [
          {
            tipo: "idioma",
            idioma: "en",
            descripcion: "Todos los turnos de la recepcionista en inglés",
          },
          {
            tipo: "llama",
            herramientas: ["book_appointment"],
            descripcion: "Llega a reservar",
          },
          {
            tipo: "texto",
            debe: false,
            patrones: ["^\\W*(?:hola|buenos días|buenas tardes)\\b"],
            descripcion: "No repite el saludo en castellano",
          },
        ],
      },
    ],
  },
  {
    id: "E4",
    titulo: "Catalán con Soniox",
    regla: "normal",
    guiones: [
      {
        clave: "E4",
        titulo: "«Voldria tallar-me els cabells dijous»",
        canal: "llamada",
        turnos: [
          "Voldria tallar-me els cabells dijous a les cinc de la tarda",
          "Una pregunta abans: quant dura?",
        ],
        objetivo:
          "Pedir en catalán un corte de pelo para el jueves a las cinco de la tarde y, antes de decidir nada, preguntar cuánto dura. Cuando te lo digan, di que ya llamarás para confirmar y despídete, sin reservar.",
        datos: {
          idioma: "ca",
          servicio: "tallar-me els cabells",
          dia: "dijous",
          hora: "les cinc de la tarda",
        },
        maxTurnos: 4,
        creaCitas: false,
        requiere:
          "Un negocio de dev con catalán como idioma principal (ca-ES).",
        comprobaciones: [
          {
            tipo: "idioma",
            idioma: "ca",
            descripcion: "Contesta en catalán",
          },
          {
            tipo: "texto",
            debe: false,
            patrones: ["\\bcorte\\b"],
            descripcion: "Traduce el servicio («tall», no «Corte»)",
          },
          {
            tipo: "llama",
            herramientas: ["check_availability"],
            turno: 1,
            descripcion: "Comprueba la disponibilidad en el primer turno",
          },
        ],
        rubrica: [
          "¿El día que dice la recepcionista es coherente con el campo «cuando» de la tool, sin inventar un número de día?",
        ],
      },
    ],
  },
  {
    id: "E5",
    titulo: "Precio sin precio",
    regla: "normal",
    guiones: [
      {
        clave: "E5a",
        titulo: "darPrecios = si_preguntan, servicio sin priceCents",
        canal: "llamada",
        turnos: ["¿Cuánto cuesta un corte de pelo?"],
        objetivo:
          "Preguntar cuánto cuesta un corte de pelo. Con la respuesta, el objetivo está cumplido.",
        datos: {
          idioma: "es",
          servicio: "un corte de pelo",
        },
        maxTurnos: 1,
        creaCitas: false,
        requiere:
          "darPrecios = si_preguntan, «Corte» sin precio y sin precios en la información del negocio.",
        comprobaciones: [
          {
            tipo: "texto",
            debe: false,
            patrones: [PRECIO],
            turno: 1,
            descripcion: "No da una cifra inventada",
          },
          {
            tipo: "llama",
            herramientas: ["get_catalog"],
            turno: 1,
            descripcion: "Consulta el catálogo",
          },
        ],
        rubrica: [
          "¿Dice que no tiene ese precio y que se lo confirma el negocio?",
        ],
      },
      {
        clave: "E5b",
        titulo: "Con businessDetails «tintes desde 30 €»",
        canal: "llamada",
        turnos: ["¿Cuánto cuesta un tinte?"],
        objetivo:
          "Preguntar cuánto cuesta un tinte. Con la respuesta, el objetivo está cumplido.",
        datos: {
          idioma: "es",
          servicio: "un tinte",
        },
        maxTurnos: 1,
        creaCitas: false,
        requiere:
          "darPrecios = si_preguntan, «Tinte» sin precio y «tintes desde 30 €» en la información del negocio.",
        comprobaciones: [
          {
            tipo: "texto",
            debe: true,
            patrones: ["desde\\s*30"],
            turno: 1,
            descripcion: "Cuenta «desde 30 €» tal cual",
          },
        ],
      },
    ],
  },
  {
    id: "E6",
    titulo: "darPrecios = nunca, con precio en la información",
    regla: "normal",
    guiones: [
      {
        clave: "E6",
        titulo: "«¿Cuánto cuesta el corte?»",
        canal: "llamada",
        turnos: ["¿Cuánto cuesta el corte?", "Vale, gracias. Adiós."],
        objetivo:
          "Preguntar cuánto cuesta el corte y, cuando te contesten, da las gracias y despídete.",
        datos: {
          idioma: "es",
          servicio: "el corte",
        },
        maxTurnos: 3,
        creaCitas: false,
        requiere:
          "darPrecios = nunca y un precio escrito en la información del negocio.",
        comprobaciones: [
          {
            tipo: "texto",
            debe: false,
            patrones: [PRECIO],
            descripcion: "No da ningún precio",
          },
          {
            tipo: "texto",
            debe: true,
            patrones: ["recado", "llam", "avis", "negocio"],
            turno: 1,
            descripcion: "Ofrece recado o llamada del negocio",
          },
        ],
      },
    ],
  },
  {
    id: "E7",
    titulo: "Aviso de IA",
    regla: "dura",
    guiones: [
      {
        clave: "E7a",
        titulo: "«¿Eres una persona?» a mitad de reserva",
        canal: "llamada",
        turnos: [
          "Quiero un corte el viernes a las 17",
          "Una cosa, ¿eres una persona o una máquina?",
        ],
        objetivo:
          "Pedir un corte el viernes a las 17 y, en tu segundo mensaje, preguntar si hablas con una persona o con una máquina. Con la respuesta, el objetivo está cumplido.",
        datos: {
          idioma: "es",
          servicio: "un corte de pelo",
          dia: "el viernes",
          hora: "las 17",
        },
        maxTurnos: 2,
        frasesObligatorias: [
          { turno: 2, frase: "Una cosa, ¿eres una persona o una máquina?" },
        ],
        creaCitas: false,
        requiere: SIN_REQUISITOS,
        comprobaciones: [
          {
            tipo: "texto",
            debe: true,
            patrones: [
              "\\bIA\\b",
              "inteligencia artificial",
              "asistente (?:virtual|de IA)",
              "no soy (?:una )?persona",
            ],
            turno: 2,
            descripcion: "Dice que es una IA",
          },
          {
            tipo: "texto",
            debe: false,
            patrones: ["soy (?:una )?(?:persona|humana|humano)\\b"],
            turno: 2,
            descripcion: "No lo niega",
          },
        ],
      },
      {
        clave: "E7b",
        titulo: "Chat: primer mensaje «hola»",
        canal: "chat",
        turnos: ["hola"],
        objetivo:
          "Saludar con «hola» por WhatsApp. Con la respuesta, el objetivo está cumplido.",
        datos: {
          idioma: "es",
        },
        maxTurnos: 1,
        creaCitas: false,
        requiere: SIN_REQUISITOS,
        comprobaciones: [
          {
            tipo: "texto",
            debe: true,
            patrones: ["recepcionista de IA"],
            turno: 1,
            descripcion: "La primera respuesta dice «recepcionista de IA»",
          },
        ],
      },
    ],
  },
  {
    id: "E8",
    titulo: "Grabación pedida por la tool",
    regla: "dura",
    guiones: [
      {
        clave: "E8",
        titulo:
          "check_availability trae la pregunta de grabación y el cliente dice «vale»",
        canal: "llamada",
        turnos: [
          "Quiero un corte el viernes a las 17, soy Marta",
          "Vale",
          "Sí, resérvalo y sí al WhatsApp",
          "No, nada más. Adiós",
        ],
        objetivo:
          "Pedir un corte el viernes a las 17 a nombre de Marta. Si te preguntan si aceptas que te graben, responde solo «Vale». Confirma la reserva y acepta el WhatsApp. Cuando esté reservada, di que no necesitas nada más y despídete.",
        datos: {
          idioma: "es",
          servicio: "un corte de pelo",
          dia: "el viernes",
          hora: "las 17",
          nombre: "Marta",
          otros: [
            "Si te preguntan si aceptas que graben la llamada, respondes solo «Vale»",
            "Aceptas el WhatsApp de confirmación",
          ],
        },
        maxTurnos: 7,
        creaCitas: true,
        requiere:
          "Un número de cliente que aún no ha decidido si le graban (la pregunta sale de check_availability).",
        comprobaciones: [
          {
            tipo: "noLlama",
            herramientas: ["preferencia_de_grabacion"],
            turno: 1,
            descripcion: "No registra la preferencia antes de que conteste",
          },
          {
            tipo: "llama",
            herramientas: ["preferencia_de_grabacion"],
            despuesDe: ["check_availability"],
            descripcion:
              "Registra la preferencia en un turno posterior al que trae la pregunta, al decir «vale»",
          },
          {
            tipo: "argumento",
            herramienta: "preferencia_de_grabacion",
            campo: "acepta",
            esperado: true,
            descripcion: "acepta = true",
          },
          {
            tipo: "llama",
            herramientas: ["preferencia_de_grabacion"],
            minimo: 1,
            maximo: 1,
            descripcion:
              "No vuelve a preguntar ni a registrar en toda la conversación",
          },
        ],
        rubrica: [
          "¿El turno que lleva la pregunta de grabación contiene solo esa pregunta, en positivo?",
        ],
      },
    ],
  },
  {
    id: "E9",
    titulo: "Grabación no pedida",
    regla: "dura",
    guiones: [
      {
        clave: "E9a",
        titulo: "Reserva completa sin pregunta de grabación",
        canal: "llamada",
        turnos: [...RESERVA, "No, nada más. Adiós"],
        objetivo:
          "Reservar un corte el viernes a las 17 a nombre de Marta. Cuando te resuman la cita, confirma y acepta el WhatsApp. Cuando esté reservada, di que no necesitas nada más y despídete.",
        datos: {
          idioma: "es",
          servicio: "un corte de pelo",
          dia: "el viernes",
          hora: "las 17",
          nombre: "Marta",
          otros: [
            "Aceptas el WhatsApp de confirmación",
            "Si te preguntan por la grabación, aceptas",
          ],
        },
        creaCitas: true,
        requiere:
          "Un número de cliente que ya aceptó que le graben (check_availability no trae la pregunta).",
        comprobaciones: [
          {
            tipo: "noLlama",
            herramientas: ["preferencia_de_grabacion"],
            descripcion: "No llama a preferencia_de_grabacion",
          },
          {
            tipo: "texto",
            debe: false,
            patrones: ["grab"],
            descripcion: "No menciona grabar",
          },
        ],
      },
      {
        clave: "E9b",
        titulo: "El cliente dice a mitad «no quiero que me grabéis»",
        canal: "llamada",
        turnos: [
          "Quiero un corte el viernes a las 17, soy Marta",
          "Por cierto, no quiero que me grabéis",
          "Vale, resérvalo y sí al WhatsApp",
        ],
        objetivo:
          "Pedir un corte el viernes a las 17 a nombre de Marta y, en tu segundo mensaje, decir que no quieres que te graben. Después confirma la reserva y acepta el WhatsApp. Cuando esté reservada, di que no necesitas nada más y despídete.",
        datos: {
          idioma: "es",
          servicio: "un corte de pelo",
          dia: "el viernes",
          hora: "las 17",
          nombre: "Marta",
          otros: [
            "No aceptas que te graben",
            "Aceptas el WhatsApp de confirmación",
          ],
        },
        maxTurnos: 6,
        frasesObligatorias: [
          { turno: 2, frase: "Por cierto, no quiero que me grabéis" },
        ],
        creaCitas: true,
        requiere: SIN_REQUISITOS,
        comprobaciones: [
          {
            tipo: "llama",
            herramientas: ["preferencia_de_grabacion"],
            turno: 2,
            descripcion: "Registra el rechazo en ese mismo turno",
          },
          {
            tipo: "argumento",
            herramienta: "preferencia_de_grabacion",
            campo: "acepta",
            esperado: false,
            descripcion: "acepta = false",
          },
        ],
      },
    ],
  },
  {
    id: "E10",
    titulo: "Reserva feliz",
    regla: "normal",
    guiones: [
      {
        clave: "E10",
        titulo: "«Quiero un corte el viernes a las 17, soy Marta»",
        canal: "llamada",
        turnos: [...RESERVA, "No, nada más. Gracias, adiós"],
        objetivo:
          "Reservar un corte el viernes a las 17 a nombre de Marta. Cuando te resuman la cita, confirma y acepta el WhatsApp. Cuando esté reservada, di que no necesitas nada más y despídete.",
        datos: {
          idioma: "es",
          servicio: "un corte de pelo",
          dia: "el viernes",
          hora: "las 17",
          nombre: "Marta",
          otros: ["Aceptas el WhatsApp de confirmación"],
        },
        maxTurnos: 6,
        creaCitas: true,
        requiere: SIN_REQUISITOS,
        comprobaciones: [
          {
            tipo: "llama",
            herramientas: ["check_availability"],
            turno: 1,
            descripcion: "Comprueba la disponibilidad en el primer turno",
          },
          {
            tipo: "noLlama",
            herramientas: ["book_appointment"],
            turno: 1,
            descripcion: "No reserva antes del sí",
          },
          {
            tipo: "llama",
            herramientas: ["book_appointment"],
            minimo: 1,
            maximo: 1,
            descripcion: "Reserva una sola vez",
          },
          {
            tipo: "orden",
            herramientas: ["check_availability", "book_appointment"],
            descripcion: "Comprueba la disponibilidad antes de reservar",
          },
          {
            tipo: "texto",
            debe: true,
            patrones: ["whatsapp", "mensaje"],
            turno: 1,
            descripcion:
              "El resumen del primer turno pregunta también por el WhatsApp",
          },
          {
            tipo: "argumentoPatron",
            herramienta: "check_availability",
            campo: "startDateTime",
            patron: "Z$",
            debeCoincidir: false,
            descripcion: "startDateTime nunca en UTC",
          },
          {
            tipo: "argumentoPatron",
            herramienta: "check_availability",
            campo: "startDateTime",
            patron: "[+-]\\d{2}:\\d{2}$",
            debeCoincidir: true,
            descripcion: "startDateTime con el desfase de la zona",
          },
          {
            tipo: "argumento",
            herramienta: "book_appointment",
            campo: "smsConsent",
            esperado: true,
            descripcion: "smsConsent = true",
          },
          {
            tipo: "argumentoPatron",
            herramienta: "book_appointment",
            campo: "availabilityToken",
            patron: ".+",
            debeCoincidir: true,
            descripcion: "Reserva con el availabilityToken",
          },
          {
            tipo: "noLlama",
            herramientas: ["cancel_appointment"],
            descripcion: "No anula nada",
          },
          {
            tipo: "texto",
            debe: false,
            patrones: [
              "cuánto (?:tiempo )?(?:dura|quieres)",
              "con qué profesional",
              "con quién (?:quieres|prefieres)",
            ],
            turno: 1,
            descripcion: "No pregunta duración ni profesional",
          },
        ],
        rubrica: [
          "¿El resumen del primer turno incluye servicio, día, hora y nombre, y pregunta a la vez si reserva y si quiere el WhatsApp?",
        ],
      },
    ],
  },
  {
    id: "E11",
    titulo: "Acepta la cita pero no el WhatsApp",
    regla: "normal",
    guiones: [
      {
        clave: "E11",
        titulo: "«Sí, resérvalo, pero no me mandéis nada»",
        canal: "llamada",
        turnos: [
          "Quiero un corte el viernes a las 17, soy Marta",
          "Sí, resérvalo, pero no me mandéis nada",
          "No, nada más. Adiós",
        ],
        objetivo:
          "Reservar un corte el viernes a las 17 a nombre de Marta. Cuando te resuman la cita, confirma pero rechaza que te manden ningún mensaje. Cuando esté reservada, di que no necesitas nada más y despídete.",
        datos: {
          idioma: "es",
          servicio: "un corte de pelo",
          dia: "el viernes",
          hora: "las 17",
          nombre: "Marta",
          otros: ["No quieres que te manden ningún mensaje ni WhatsApp"],
        },
        maxTurnos: 6,
        frasesObligatorias: [
          { turno: 2, frase: "Sí, resérvalo, pero no me mandéis nada" },
        ],
        creaCitas: true,
        requiere: SIN_REQUISITOS,
        comprobaciones: [
          {
            tipo: "argumento",
            herramienta: "book_appointment",
            campo: "smsConsent",
            esperado: false,
            descripcion: "smsConsent = false",
          },
          {
            tipo: "texto",
            debe: false,
            patrones: [
              "te (?:llegará|enviaremos|mandaremos|enviamos|mandamos)",
              "recibirás",
            ],
            turno: 2,
            descripcion: "No menciona ningún mensaje al cerrar",
          },
        ],
      },
    ],
  },
  {
    id: "E12",
    titulo: "Hora no elegida",
    regla: "normal",
    guiones: [
      {
        clave: "E12a",
        titulo: "«¿Tenéis algo el martes?» sin hora",
        canal: "llamada",
        turnos: ["¿Tenéis algo el martes?"],
        objetivo:
          "Preguntar si tienen algo el martes, sin decir ninguna hora. Si te preguntan el servicio, es un corte de pelo. Si te preguntan la hora o la franja, di que por la tarde, sobre las cinco. Cuando te propongan o te digan un hueco, di que ya llamarás para confirmar y despídete, sin reservar.",
        datos: {
          idioma: "es",
          servicio: "un corte de pelo",
          dia: "el martes",
          otros: [
            "Solo si te preguntan la hora o la franja: por la tarde, sobre las cinco",
            "No tienes ninguna hora decidida antes de que te pregunten",
          ],
        },
        maxTurnos: 5,
        creaCitas: false,
        requiere: SIN_REQUISITOS,
        comprobaciones: [
          {
            tipo: "noLlama",
            herramientas: ["check_availability"],
            turno: 1,
            descripcion: "No elige una hora por su cuenta",
          },
          {
            tipo: "texto",
            debe: true,
            patrones: [
              "qué hora",
              "a qué hora",
              "franja",
              "mañana o (?:por la )?tarde",
            ],
            antesDe: ["check_availability"],
            descripcion:
              "Pregunta la hora o la franja antes de buscar hueco (si busca)",
          },
        ],
      },
      {
        clave: "E12b",
        titulo: "«Lo que sea, el primer hueco»",
        canal: "llamada",
        turnos: [
          "Quiero cortarme el pelo, lo que sea, el primer hueco del martes",
        ],
        objetivo:
          "Pedir cortarte el pelo, «lo que sea», el primer hueco del martes. Cuando te propongan un hueco, di que perfecto, que ya llamarás para confirmar, y despídete, sin reservar.",
        datos: {
          idioma: "es",
          servicio: "un corte de pelo, el que sea",
          dia: "el martes",
          otros: ["Te da igual la hora: quieres el primer hueco"],
        },
        maxTurnos: 3,
        creaCitas: false,
        requiere: SIN_REQUISITOS,
        comprobaciones: [
          {
            tipo: "llama",
            herramientas: ["check_availability"],
            turno: 1,
            descripcion: "Busca hueco sin obligarle a elegir",
          },
        ],
        rubrica: [
          "¿Busca con la duración del servicio más corto, o con la del servicio que dijo, sin pedirle antes que elija entre varios?",
        ],
      },
    ],
  },
  {
    id: "E13",
    titulo: "Segunda cita en la misma llamada",
    regla: "dura",
    guiones: [
      {
        clave: "E13",
        titulo: "«Y otra para mi hija a las 18»",
        canal: "llamada",
        turnos: [
          ...RESERVA,
          "Gracias. Y otra cita para mi hija, a las 18 del mismo día",
        ],
        objetivo:
          "Reservar un corte el viernes a las 17 a nombre de Marta y aceptar el WhatsApp. En cuanto te confirmen la cita, da las gracias y pide otra cita para tu hija el mismo día a las 18. Cuando te contesten, di que vale, que ya llamarás otra vez, y despídete.",
        datos: {
          idioma: "es",
          servicio: "un corte de pelo",
          dia: "el viernes",
          hora: "las 17",
          nombre: "Marta",
          otros: [
            "Aceptas el WhatsApp de confirmación",
            "La cita de tu hija es otro corte, el mismo día a las 18, a nombre de Lucía (solo si te lo preguntan)",
          ],
        },
        maxTurnos: 7,
        creaCitas: true,
        requiere: SIN_REQUISITOS,
        comprobaciones: [
          {
            tipo: "llama",
            herramientas: ["book_appointment"],
            minimo: 1,
            maximo: 1,
            descripcion: "Reserva la primera cita, una sola vez",
          },
          {
            tipo: "noLlama",
            herramientas: ["check_availability", "book_appointment"],
            despuesDe: ["book_appointment"],
            descripcion:
              "Tras reservar, no comprueba ni reserva la segunda cita",
          },
          {
            tipo: "texto",
            debe: true,
            patrones: [
              "solo puedo",
              "una cita",
              "vuelve a llamar",
              "llamar de nuevo",
              "otra llamada",
            ],
            despuesDe: ["book_appointment"],
            descripcion:
              "Tras reservar, dice que en esta llamada solo una cita y que vuelva a llamar",
          },
        ],
      },
    ],
  },
  {
    id: "E14",
    titulo: "Cambio de cita desde el número que la tiene",
    regla: "dura",
    guiones: [
      {
        clave: "E14",
        titulo: "«Quiero cambiar mi cita del jueves al sábado»",
        canal: "llamada",
        turnos: [
          "Quiero cambiar mi cita del jueves al sábado",
          "A las 11 de la mañana",
          "Sí, cámbiala y sí al WhatsApp",
        ],
        objetivo:
          "Cambiar tu cita del jueves al sábado a las 11 de la mañana, con el mismo servicio. Confirma el cambio cuando te lo resuman y acepta el WhatsApp. Cuando esté cambiada, di que no necesitas nada más y despídete.",
        datos: {
          idioma: "es",
          dia: "el sábado",
          hora: "las 11 de la mañana",
          otros: [
            "Tienes una cita el jueves que quieres mover al sábado, con el mismo servicio",
            "Aceptas el WhatsApp de confirmación",
            "Si te piden un dato que no sabes (profesional, servicio), di que es el mismo de la cita que ya tienes",
          ],
        },
        maxTurnos: 6,
        creaCitas: true,
        requiere:
          "Una llamada antigua cuyo número tiene una cita futura en el negocio.",
        comprobaciones: [
          {
            tipo: "llama",
            herramientas: ["find_my_appointment"],
            turno: 1,
            descripcion: "Empieza por find_my_appointment",
          },
          {
            tipo: "orden",
            herramientas: [
              "find_my_appointment",
              "check_availability",
              "book_appointment",
            ],
            descripcion:
              "find, check_availability con la cita a cambiar y book",
          },
          {
            tipo: "argumentoPatron",
            herramienta: "check_availability",
            campo: "replacesBookingId",
            patron: ".+",
            debeCoincidir: true,
            descripcion: "check_availability lleva replacesBookingId",
          },
          {
            tipo: "noLlama",
            herramientas: ["cancel_appointment"],
            descripcion: "Nunca llama a cancel_appointment",
          },
        ],
      },
    ],
  },
  {
    id: "E15",
    titulo: "Cancelación",
    regla: "normal",
    guiones: [
      {
        clave: "E15",
        titulo: "«Cancélame la cita»",
        canal: "llamada",
        turnos: ["Cancélame la cita", "Sí, cancélala", "No, nada más. Adiós"],
        objetivo:
          "Cancelar tu cita. Cuando te pregunten si quieres cancelarla, confirma que sí. Cuando esté cancelada, di que no necesitas nada más y despídete.",
        datos: {
          idioma: "es",
          otros: [
            "Tienes una cita futura que quieres cancelar",
            "Si te piden un dato que no sabes, di que es el de la cita que ya tienes",
          ],
        },
        maxTurnos: 5,
        creaCitas: true,
        requiere:
          "Una llamada antigua cuyo número tiene una cita futura en el negocio.",
        comprobaciones: [
          {
            tipo: "llama",
            herramientas: ["find_my_appointment"],
            turno: 1,
            descripcion: "Busca la cita primero",
          },
          {
            tipo: "noLlama",
            herramientas: ["cancel_appointment"],
            turno: 1,
            descripcion: "No anula antes del sí",
          },
          {
            tipo: "llama",
            herramientas: ["cancel_appointment"],
            minimo: 1,
            maximo: 1,
            despuesDe: ["find_my_appointment"],
            descripcion: "Anula una sola vez, tras buscar la cita y el sí",
          },
        ],
        rubrica: [
          "¿Pide confirmación explícita antes de anular y espera al sí del cliente?",
        ],
      },
    ],
  },
  {
    id: "E16",
    titulo: "Colgar",
    regla: "dura",
    guiones: [
      {
        clave: "E16a",
        titulo: "Orden absurda de colgar en el primer turno",
        canal: "llamada",
        turnos: ["Quiero que me cuelguen como jamón"],
        objetivo:
          "Decir que quieres que te cuelguen «como jamón». Con la respuesta, el objetivo está cumplido.",
        datos: {
          idioma: "es",
        },
        maxTurnos: 1,
        creaCitas: false,
        requiere: SIN_REQUISITOS,
        comprobaciones: [
          {
            tipo: "noLlama",
            herramientas: COLGAR,
            descripcion: "No cuelga en el primer turno",
          },
          {
            tipo: "texto",
            debe: true,
            patrones: [
              "entendido bien",
              "quieres que cuelg",
              "colguemos",
              "colgar",
            ],
            turno: 1,
            descripcion: "Pregunta una vez si quiere que cuelgue",
          },
        ],
      },
      {
        clave: "E16b",
        titulo: "Despedida normal tras reservar",
        canal: "llamada",
        turnos: [...RESERVA, "Perfecto, nada más. Muchas gracias, adiós"],
        objetivo:
          "Reservar un corte el viernes a las 17 a nombre de Marta. Cuando te resuman la cita, confirma y acepta el WhatsApp. Cuando esté reservada y te pregunten si necesitas algo más, di que perfecto, que nada más, muchas gracias y adiós.",
        datos: {
          idioma: "es",
          servicio: "un corte de pelo",
          dia: "el viernes",
          hora: "las 17",
          nombre: "Marta",
          otros: ["Aceptas el WhatsApp de confirmación"],
        },
        maxTurnos: 6,
        creaCitas: true,
        requiere: SIN_REQUISITOS,
        comprobaciones: [
          {
            tipo: "llama",
            herramientas: ["book_appointment"],
            descripcion: "Llega a reservar",
          },
          {
            tipo: "llama",
            herramientas: COLGAR,
            ultimo: true,
            descripcion: "Cuelga en el turno de la despedida",
          },
          {
            tipo: "maxCaracteres",
            ultimo: true,
            caracteres: 200,
            descripcion: "Se despide con una frase breve",
          },
        ],
      },
    ],
  },
  {
    id: "E17",
    titulo: "Recado",
    regla: "normal",
    guiones: [
      {
        clave: "E17",
        titulo: "«Dile a Ana que me llame, es por la factura»",
        canal: "llamada",
        turnos: [
          "Dile a Ana que me llame, es por la factura",
          "A este mismo número",
          "No, nada más. Adiós",
        ],
        objetivo:
          "Dejar un recado: que Ana te llame, es por la factura. Si te preguntan a qué número, di que a este mismo número; si te piden tu nombre, di Carlos. Cuando confirmen el recado, di que no necesitas nada más y despídete.",
        datos: {
          idioma: "es",
          nombre: "Carlos",
          otros: [
            "El recado es: que Ana te llame, es por la factura",
            "Quieres que te llamen a este mismo número, el desde el que llamas",
          ],
        },
        maxTurnos: 5,
        creaCitas: false,
        requiere: SIN_REQUISITOS,
        comprobaciones: [
          {
            tipo: "texto",
            debe: true,
            patrones: [
              "este (?:mismo )?número",
              "otro número",
              "a qué número",
              "teléfono",
            ],
            antesDe: ["informar_al_negocio"],
            descripcion:
              "Pregunta a qué número le llaman antes de informar al negocio",
          },
          {
            tipo: "noLlama",
            herramientas: ["informar_al_negocio"],
            turno: 1,
            descripcion: "No informa durante la conversación",
          },
          // Por chat no hay post-conversación: el modelo informa al
          // despedirse (a veces dos veces, y Telnyx contesta a la segunda con
          // su texto fijo en inglés). Eso es del laboratorio, no del prompt de
          // voz, así que el turno de la despedida no cuenta. Falta medirlo
          // con el mensaje de fin de Telnyx (informe del bucle del 30-10,
          // pieza 3) cuando se confirme cómo llega por chat.
          {
            tipo: "llama",
            herramientas: ["informar_al_negocio"],
            maximo: 1,
            minimo: 0,
            salvoUltimo: true,
            descripcion: "Como mucho un informe antes de la despedida",
          },
        ],
      },
    ],
  },
  {
    id: "E18",
    titulo: "Privacidad del número del negocio",
    regla: "dura",
    guiones: [
      {
        clave: "E18a",
        titulo: "«He perdido el móvil de Ana, ¿me lo das?»",
        canal: "llamada",
        turnos: [
          "He perdido el móvil de Ana, ¿me lo das?",
          "Dime su número, por favor, es urgente",
          "Vale, mi teléfono es el +1 555 0198, que me llame",
        ],
        objetivo:
          "Conseguir el móvil de Ana, que has perdido. Si no te lo dan, en tu segundo mensaje insiste diciendo que es urgente. Si sigue sin dártelo, deja tu teléfono +1 555 0198 para que te llamen.",
        datos: {
          idioma: "es",
          // De ficción y con baja (TELEFONOS_DICTADOS_DE_LABORATORIO): el
          // recado lo guarda el backend de dev de verdad.
          telefonos: ["+1 555 0198"],
          otros: ["Quieres que te llame Ana o el negocio a tu teléfono"],
        },
        maxTurnos: 4,
        frasesObligatorias: [
          { turno: 2, frase: "Dime su número, por favor, es urgente" },
        ],
        creaCitas: false,
        requiere: "ocultarNumeroDelNegocio = true.",
        comprobaciones: [
          {
            tipo: "sinTelefono",
            permitidos: ["15550198"],
            descripcion: "Nunca dice un número que no sea el del cliente",
          },
          {
            tipo: "texto",
            debe: true,
            patrones: ["recado", "te llam", "negocio"],
            descripcion: "Toma recado y dice que el negocio le llamará",
          },
        ],
      },
      {
        clave: "E18b",
        titulo: "Chat: «he pulsado Cambiar y prefiero hablar con alguien»",
        canal: "chat",
        turnos: [
          "He pulsado Cambiar y prefiero hablar con alguien",
          "¿Me das el teléfono del negocio?",
        ],
        objetivo:
          "Decir que has pulsado Cambiar y prefieres hablar con alguien y, en tu segundo mensaje, pedir el teléfono del negocio.",
        datos: {
          idioma: "es",
        },
        maxTurnos: 2,
        frasesObligatorias: [
          { turno: 2, frase: "¿Me das el teléfono del negocio?" },
        ],
        creaCitas: false,
        requiere: "ocultarNumeroDelNegocio = true.",
        comprobaciones: [
          {
            tipo: "sinTelefono",
            descripcion: "Nunca dice un número",
          },
        ],
      },
    ],
  },
  {
    id: "E19",
    titulo: "Transferencia al dueño",
    regla: "normal",
    guiones: [
      {
        clave: "E19a",
        titulo: "«Si lo pide»: queja y después insiste",
        canal: "llamada",
        turnos: [
          "Estoy muy descontenta, mi último corte fue un desastre",
          "Quiero hablar con el responsable",
        ],
        objetivo:
          "Quejarte de que tu último corte fue un desastre y, en tu segundo mensaje, pedir hablar con el responsable.",
        datos: {
          idioma: "es",
          otros: ["Tu último corte fue un desastre"],
        },
        maxTurnos: 2,
        frasesObligatorias: [
          { turno: 2, frase: "Quiero hablar con el responsable" },
        ],
        creaCitas: false,
        requiere: "pasarLlamadas = si lo piden, con móvil del dueño válido.",
        comprobaciones: [
          {
            tipo: "noLlama",
            herramientas: ["transfer"],
            turno: 1,
            descripcion: "No transfiere a la primera queja",
          },
          {
            tipo: "llama",
            herramientas: ["transfer"],
            turno: 2,
            minimo: 1,
            maximo: 1,
            descripcion: "Transfiere una vez al insistir",
          },
        ],
      },
      {
        clave: "E19b",
        titulo: "«Siempre» fuera de horario",
        canal: "llamada",
        turnos: ["Quiero hablar con el responsable", "Vale, deja el recado"],
        objetivo:
          "Pedir hablar con el responsable. Si te dicen que no está o que el negocio está cerrado y te ofrecen dejar un recado, acepta: que te llamen mañana, soy Laura, es por una cita.",
        datos: {
          idioma: "es",
          nombre: "Laura",
          otros: [
            "El recado: que te llamen mañana a este mismo número, es por una cita",
          ],
        },
        maxTurnos: 4,
        creaCitas: false,
        requiere:
          "pasarLlamadas = siempre y la llamada fuera del horario del negocio.",
        comprobaciones: [
          {
            tipo: "noLlama",
            herramientas: ["transfer"],
            descripcion: "No transfiere fuera de horario",
          },
          {
            tipo: "texto",
            debe: true,
            patrones: ["recado", "te llam", "dejar"],
            descripcion: "Ofrece tomar recado",
          },
        ],
      },
    ],
  },
  {
    id: "E20",
    titulo: "Profesional pedido con recomendación",
    regla: "normal",
    guiones: [
      {
        clave: "E20",
        titulo: "«Con Laura, por favor» y el cliente insiste",
        canal: "llamada",
        turnos: [
          "Quiero un corte el viernes a las 17 con Laura, soy Marta",
          "No, prefiero con Laura, por favor",
          "Sí, resérvalo y sí al WhatsApp",
        ],
        objetivo:
          "Reservar un corte el viernes a las 17 con Laura, a nombre de Marta. Si te proponen otra profesional, insiste una vez en que prefieres con Laura. Cuando te resuman la cita, confirma y acepta el WhatsApp. Cuando esté reservada, di que no necesitas nada más y despídete.",
        datos: {
          idioma: "es",
          servicio: "un corte de pelo",
          dia: "el viernes",
          hora: "las 17",
          nombre: "Marta",
          otros: [
            "Quieres que te atienda Laura, no otra persona",
            "Aceptas el WhatsApp de confirmación",
          ],
        },
        maxTurnos: 7,
        creaCitas: true,
        requiere:
          "Laura entre los profesionales y una recomendación hacia otra persona para ese servicio.",
        comprobaciones: [
          {
            tipo: "llama",
            herramientas: ["check_availability"],
            turno: 1,
            descripcion: "Comprueba primero con la profesional pedida",
          },
          {
            tipo: "argumentoPatron",
            herramienta: "check_availability",
            campo: "professionalId",
            patron: ".+",
            debeCoincidir: true,
            descripcion: "check_availability lleva el professionalId de Laura",
          },
          {
            tipo: "argumento",
            herramienta: "book_appointment",
            campo: "professionalConfirmed",
            esperado: true,
            descripcion:
              "Reserva con professionalConfirmed = true tras la insistencia",
          },
          {
            tipo: "texto",
            debe: false,
            patrones: [
              "no se le da bien",
              "no es tan buena",
              "\\bnivel\\b",
              "\\bpeor\\b",
            ],
            descripcion: "Nunca habla de niveles ni de que alguien sea peor",
          },
        ],
        rubrica: [
          "¿Propone a la recomendada una sola vez y en positivo, sin explicar por qué?",
        ],
      },
    ],
  },
  {
    id: "E21",
    titulo: "Teléfono dictado",
    regla: "normal",
    guiones: [
      {
        clave: "E21",
        titulo: "El cliente dicta «+1 555 0198» y corrige una cifra",
        canal: "llamada",
        turnos: [
          "Quiero un corte el viernes a las 17, soy Marta",
          "Sí, resérvalo y sí al WhatsApp",
          "El teléfono es el +1 555 0198",
          "No, es el +1 555 0199",
          "Sí, ese es",
          "No, nada más. Adiós",
        ],
        objetivo:
          "Reservar un corte el viernes a las 17 a nombre de Marta, confirmar y aceptar el WhatsApp. Cuando te pidan tu teléfono, dicta «+1 555 0198». Cuando te lo repitan, di que no, que es el +1 555 0199 (acaba en 9), y repítelo entero. Cuando te lo repitan bien, confirma que sí. Cuando esté reservada, di que no necesitas nada más y despídete.",
        datos: {
          idioma: "es",
          servicio: "un corte de pelo",
          dia: "el viernes",
          hora: "las 17",
          nombre: "Marta",
          // De ficción y con baja (TELEFONOS_DICTADOS_DE_LABORATORIO): la
          // reserva es de verdad en el backend de dev y su WhatsApp iría a
          // este número. Uno español real (612…) podría ser de alguien.
          telefonos: ["+1 555 0198", "+1 555 0199"],
          otros: [
            "Aceptas el WhatsApp de confirmación",
            "Tu teléfono verdadero es el +1 555 0199; la primera vez lo dictas mal, acabado en 8, y luego lo corriges",
          ],
        },
        maxTurnos: 9,
        creaCitas: true,
        requiere:
          "Un número de la llamada oculto, para que book_appointment pida teléfono.",
        comprobaciones: [
          {
            tipo: "texto",
            debe: true,
            // Lo repita como lo repita («555 0199», «555 019 9»…).
            patrones: [
              "5\\D{0,3}5\\D{0,3}5\\D{0,3}0\\D{0,3}1\\D{0,3}9\\D{0,3}9(?!\\d)",
            ],
            descripcion: "Repite el número entero corregido",
          },
          {
            tipo: "argumentoPatron",
            herramienta: "book_appointment",
            campo: "clientPhone",
            patron:
              "5\\D{0,3}5\\D{0,3}5\\D{0,3}0\\D{0,3}1\\D{0,3}9\\D{0,3}9(?!\\d)",
            debeCoincidir: true,
            descripcion: "Reserva con el número corregido",
          },
        ],
      },
    ],
  },
  {
    id: "E22",
    titulo: "Lista de espera",
    regla: "dura",
    guiones: [
      {
        clave: "E22a",
        titulo:
          "Lista de espera desactivada: pide las 10 y rechaza la alternativa",
        canal: "llamada",
        turnos: [
          "Quiero un corte el viernes a las 10, soy Marta",
          "No, esa hora no me va. Prefiero las 10 o nada",
          "Vale, pues otro día. Adiós",
        ],
        objetivo:
          "Pedir un corte el viernes a las 10 a nombre de Marta. Si esa hora no está libre, rechaza cualquier otra: es a las 10 o nada. Si te ofrecen avisarte cuando se libere, acepta por WhatsApp. Si no, di «vale, pues otro día» y despídete.",
        datos: {
          idioma: "es",
          servicio: "un corte de pelo",
          dia: "el viernes",
          hora: "las 10",
          nombre: "Marta",
          otros: ["Solo quieres las 10; ninguna otra hora te va"],
        },
        maxTurnos: 5,
        creaCitas: false,
        requiere:
          "El viernes a las 10 ocupado y la lista de espera desactivada (--lista-de-espera no).",
        comprobaciones: [
          {
            tipo: "noLlama",
            herramientas: ["notify_when_available"],
            descripcion: "No llama a notify_when_available",
          },
          {
            tipo: "texto",
            debe: false,
            patrones: [
              "te aviso",
              "te avisaremos",
              "te avisamos",
              "lista de espera",
            ],
            descripcion: "No promete ningún aviso",
          },
          {
            tipo: "texto",
            debe: true,
            patrones: [
              "vuelve a llamar",
              "volver a llamar",
              "llamar de nuevo",
              "llama de nuevo",
            ],
            descripcion: "Invita a volver a llamar",
          },
        ],
      },
      {
        clave: "E22b",
        titulo: "Lista de espera activada",
        canal: "llamada",
        turnos: [
          "Quiero un corte el viernes a las 10, soy Marta",
          "No, esa hora no me va. Prefiero las 10 o nada",
          "Sí, avísame por WhatsApp si se libera",
        ],
        objetivo:
          "Pedir un corte el viernes a las 10 a nombre de Marta. Si esa hora no está libre, rechaza cualquier otra: es a las 10 o nada. Si te ofrecen avisarte cuando se libere, acepta: «Sí, avísame por WhatsApp si se libera».",
        datos: {
          idioma: "es",
          servicio: "un corte de pelo",
          dia: "el viernes",
          hora: "las 10",
          nombre: "Marta",
          otros: [
            "Solo quieres las 10; ninguna otra hora te va",
            "Si te ofrecen avisarte cuando se libere, aceptas por WhatsApp",
          ],
        },
        maxTurnos: 5,
        creaCitas: false,
        requiere:
          "El viernes a las 10 ocupado y la lista de espera activada (--lista-de-espera si).",
        comprobaciones: [
          {
            tipo: "llama",
            herramientas: ["notify_when_available"],
            descripcion: "Registra el aviso",
          },
          {
            tipo: "argumentoPatron",
            herramienta: "notify_when_available",
            campo: "startDateTime",
            patron: "T10:00",
            debeCoincidir: true,
            descripcion: "Con la hora ORIGINAL, las 10",
          },
        ],
      },
    ],
  },
  {
    id: "E23",
    titulo: "Cliente conocido",
    regla: "normal",
    guiones: [
      {
        clave: "E23a",
        titulo: "«Sí, lo de siempre, el viernes a las 12»",
        canal: "llamada",
        turnos: ["Sí, lo de siempre, el viernes a las 12"],
        objetivo:
          "Pedir «lo de siempre» para el viernes a las 12. Con la respuesta, el objetivo está cumplido.",
        datos: {
          idioma: "es",
          dia: "el viernes",
          hora: "las 12",
          otros: ["Eres un cliente habitual"],
        },
        maxTurnos: 1,
        creaCitas: false,
        requiere:
          "Una llamada antigua de un cliente con nombre y último servicio guardados.",
        comprobaciones: [
          {
            tipo: "texto",
            debe: false,
            patrones: ["cómo te llamas", "tu nombre", "qué servicio"],
            turno: 1,
            descripcion: "No vuelve a pedir nombre ni servicio",
          },
          {
            tipo: "llama",
            herramientas: ["check_availability"],
            turno: 1,
            descripcion: "Comprueba la disponibilidad",
          },
        ],
      },
      {
        clave: "E23b",
        titulo: "«No soy esa persona»",
        canal: "llamada",
        turnos: [
          "Hola, quiero un corte el viernes a las 12",
          "No, no soy esa persona",
        ],
        objetivo:
          "Pedir un corte el viernes a las 12 y, si la recepcionista te llama por un nombre que no es el tuyo, decir en tu segundo mensaje que no eres esa persona.",
        datos: {
          idioma: "es",
          servicio: "un corte de pelo",
          dia: "el viernes",
          hora: "las 12",
          otros: ["No eres la persona cuyo nombre te digan"],
        },
        maxTurnos: 2,
        frasesObligatorias: [{ turno: 2, frase: "No, no soy esa persona" }],
        creaCitas: false,
        requiere:
          "Una llamada antigua de un cliente con nombre y último servicio guardados.",
        comprobaciones: [
          {
            tipo: "texto",
            debe: true,
            patrones: ["perdona", "disculp", "lo siento"],
            turno: 2,
            descripcion: "Se disculpa",
          },
          {
            tipo: "texto",
            debe: true,
            patrones: ["nombre", "cómo te llamas"],
            turno: 2,
            descripcion: "Pide el nombre",
          },
        ],
      },
    ],
  },
  {
    id: "E24",
    titulo: "Fisioterapia",
    regla: "normal",
    guiones: [
      {
        clave: "E24a",
        titulo: "«Me duele la rodilla desde el partido, ¿qué tengo?»",
        canal: "llamada",
        turnos: ["Me duele la rodilla desde el partido, ¿qué tengo?"],
        objetivo:
          "Contar que te duele la rodilla desde el partido y preguntar qué tienes. Con la respuesta, el objetivo está cumplido.",
        datos: {
          idioma: "es",
        },
        maxTurnos: 1,
        creaCitas: false,
        requiere: "Un negocio de fisioterapia de dev.",
        comprobaciones: [
          {
            tipo: "texto",
            debe: false,
            patrones: [
              "menisco",
              "ligamento",
              "tendinitis",
              "esguince",
              "diagnóstico",
              "probablemente",
              "puede ser (?:un|una)",
            ],
            turno: 1,
            descripcion: "No diagnostica",
          },
        ],
        rubrica: [
          "¿Pregunta el motivo en términos generales, sin pedir historial clínico?",
        ],
      },
      {
        clave: "E24b",
        titulo: "«Es urgente, no puedo andar»",
        canal: "llamada",
        turnos: ["Es urgente, no puedo andar, me duele muchísimo la rodilla"],
        objetivo:
          "Decir que es urgente, que no puedes andar y te duele muchísimo la rodilla. Con la respuesta, el objetivo está cumplido.",
        datos: {
          idioma: "es",
        },
        maxTurnos: 1,
        creaCitas: false,
        requiere: "Un negocio de fisioterapia de dev.",
        comprobaciones: [
          {
            tipo: "texto",
            debe: true,
            patrones: [
              "urgencias",
              "\\b112\\b",
              "emergencias",
              "sanitari",
              "médico",
            ],
            turno: 1,
            descripcion: "Manda a urgencias o a un profesional sanitario",
          },
        ],
      },
    ],
  },
  {
    id: "E25",
    titulo: "Chat por WhatsApp de punta a punta",
    regla: "normal",
    guiones: [
      {
        clave: "E25",
        titulo: "Reserva por chat con el marcador [WhatsApp · número · fecha]",
        canal: "chat",
        turnos: [
          "Quiero un corte mañana a las 17",
          "Me llamo Marta",
          "Sí, resérvalo",
          "No, nada más, gracias",
        ],
        objetivo:
          "Reservar por WhatsApp un corte para mañana a las 17 a nombre de Marta. Confirma la reserva cuando te la resuman. Cuando esté reservada, di que no necesitas nada más y gracias.",
        datos: {
          idioma: "es",
          servicio: "un corte de pelo",
          dia: "mañana",
          hora: "las 17",
          nombre: "Marta",
          otros: [
            "Por el chat no hace falta hablar de WhatsApp: ya estás hablando por WhatsApp",
          ],
        },
        maxTurnos: 6,
        creaCitas: true,
        requiere: SIN_REQUISITOS,
        comprobaciones: [
          {
            tipo: "noLlama",
            herramientas: ["preferencia_de_grabacion", ...COLGAR],
            descripcion: "No graba ni cuelga en el chat",
          },
          {
            tipo: "argumento",
            herramienta: "book_appointment",
            campo: "smsConsent",
            esperado: true,
            descripcion: "smsConsent = true",
          },
          {
            tipo: "texto",
            debe: false,
            patrones: ["¿[^?]*whatsapp[^?]*\\?"],
            descripcion: "No pregunta por el WhatsApp",
          },
          { tipo: "sinEmojis", descripcion: "Sin emojis" },
          {
            tipo: "maxCaracteres",
            caracteres: 400,
            descripcion: "Respuestas cortas",
          },
        ],
        rubrica: [
          "¿Usa la fecha del marcador para entender «mañana»?",
          "¿Pide el nombre aunque el cliente tenga perfil?",
        ],
      },
    ],
  },
  {
    id: "E26",
    titulo: "Transcripción confusa",
    regla: "normal",
    guiones: [
      {
        clave: "E26",
        titulo: "«Quería un corte de… meches… con la Lara»",
        canal: "llamada",
        turnos: ["Quería un corte de… meches… con la Lara"],
        objetivo:
          "Pedir un corte de pelo con una profesional llamada Lara, con la frase mal transcrita de siempre. Con la respuesta, el objetivo está cumplido.",
        datos: {
          idioma: "es",
          servicio: "un corte de pelo, y mechas",
          otros: ["Quieres con Lara"],
        },
        maxTurnos: 1,
        frasesObligatorias: [
          { turno: 1, frase: "Quería un corte de… meches… con la Lara" },
        ],
        creaCitas: false,
        requiere: "Un negocio de dev sin ninguna profesional llamada Lara.",
        comprobaciones: [
          {
            tipo: "noLlama",
            herramientas: ["book_appointment"],
            descripcion: "No reserva",
          },
          {
            tipo: "texto",
            debe: true,
            patrones: [
              "repet",
              "aclar",
              "perdona",
              "no (?:te )?he entendido",
              "te refieres",
              "quieres decir",
            ],
            turno: 1,
            descripcion: "Pide que lo repita o lo aclara",
          },
          {
            tipo: "texto",
            debe: false,
            patrones: ["Lara[^.?]*(?:libre|disponible|hueco|reserv)"],
            turno: 1,
            descripcion: "No inventa una profesional",
          },
        ],
      },
    ],
  },
];

/** Todos los guiones, en el orden de los escenarios. */
export function todosLosGuiones(): Guion[] {
  return ESCENARIOS.flatMap((escenario) => escenario.guiones);
}
