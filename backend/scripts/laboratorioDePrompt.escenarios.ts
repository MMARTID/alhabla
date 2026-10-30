/**
 * Batería del laboratorio de prompt (scripts/laboratorioDePrompt.ts): los 26
 * escenarios E1-E26 de PLAN-PROMPT-DINAMICO.md, con los turnos del cliente
 * guionizados y lo esperado como comprobaciones automáticas sobre las tools
 * que llama la recepcionista y sobre sus respuestas.
 *
 * Los turnos del cliente son fijos (no hay un cliente reactivo): el guion
 * supone el camino feliz de la recepcionista, así que un guion cuyo turno 2
 * ya no encaja con lo que ella preguntó falla y se mira a mano en el informe.
 * «Turno N» es la respuesta de la recepcionista al mensaje N del cliente; el
 * saludo es el turno 0 y no se evalúa.
 *
 * Cada escenario dice qué negocio de dev necesita (`requiere`): el laboratorio
 * lo corre con el que se le pase (`--negocio`, o `--negocio-de E4=<id>`) y
 * no comprueba que cumpla el requisito.
 */

export type IdiomaDeLaBateria = "es" | "en" | "ca";

export type Canal = "llamada" | "chat";

/** Qué se exige en caso de fallo: «dura» es 0 fallos y nunca peor que el
 * control; «normal», no más de un fallo extra por cada 30 repeticiones. */
export type Regla = "dura" | "normal";

interface Base {
  descripcion: string;
}

export type Comprobacion = Base &
  (
    | {
        /** Alguna de estas tools se llama entre `minimo` y `maximo` veces,
         * en el turno indicado o en toda la conversación. */
        tipo: "llama";
        herramientas: string[];
        turno?: number;
        minimo?: number;
        maximo?: number;
      }
    | {
        tipo: "noLlama";
        herramientas: string[];
        /** Sin turno, en ninguno. */
        turno?: number;
      }
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
    | {
        /** Texto de la recepcionista: debe (o no debe) casar con alguno
         * (o con todos) los patrones, en un turno o en todos. */
        tipo: "texto";
        debe: boolean;
        patrones: string[];
        turno?: number;
        modo?: "alguno" | "todos";
      }
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
    | {
        tipo: "maxCaracteres";
        turno?: number;
        caracteres: number;
      }
  );

export interface Guion {
  /** «E9a»: el id del escenario y una letra si tiene variantes. */
  clave: string;
  /** Qué prueba esta variante. */
  titulo: string;
  canal: Canal;
  /** Mensajes del cliente, en orden. */
  turnos: string[];
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
            turno: 2,
            descripcion: "Registra la preferencia al decir «vale»",
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
            turno: 2,
            minimo: 1,
            maximo: 1,
            descripcion: "Reserva una vez, tras el sí",
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
            turno: 1,
            descripcion: "Pregunta la hora o la franja",
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
        creaCitas: true,
        requiere: SIN_REQUISITOS,
        comprobaciones: [
          {
            tipo: "noLlama",
            herramientas: ["check_availability", "book_appointment"],
            turno: 3,
            descripcion: "No comprueba ni reserva la segunda cita",
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
            turno: 3,
            descripcion:
              "Dice que en esta llamada solo una cita y que vuelva a llamar",
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
            turno: 2,
            descripcion: "Anula tras el sí explícito",
          },
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
        creaCitas: true,
        requiere: SIN_REQUISITOS,
        comprobaciones: [
          {
            tipo: "llama",
            herramientas: COLGAR,
            turno: 3,
            descripcion: "Cuelga en el turno de la despedida",
          },
          {
            tipo: "maxCaracteres",
            turno: 3,
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
            turno: 1,
            descripcion: "Pregunta a qué número le llaman",
          },
          {
            tipo: "noLlama",
            herramientas: ["informar_al_negocio"],
            turno: 1,
            descripcion: "No informa durante la conversación",
          },
          {
            tipo: "llama",
            herramientas: ["informar_al_negocio"],
            maximo: 1,
            minimo: 0,
            descripcion: "Como mucho un informe",
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
          "Vale, mi teléfono es 612 345 678, que me llame",
        ],
        creaCitas: false,
        requiere: "ocultarNumeroDelNegocio = true.",
        comprobaciones: [
          {
            tipo: "sinTelefono",
            permitidos: ["612345678"],
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
        titulo: "El cliente dicta «612 345 678» y corrige una cifra",
        canal: "llamada",
        turnos: [
          "Quiero un corte el viernes a las 17, soy Marta",
          "Sí, resérvalo y sí al WhatsApp",
          "El teléfono es 612 345 678",
          "No, es 612 345 679",
          "Sí, ese es",
          "No, nada más. Adiós",
        ],
        creaCitas: true,
        requiere:
          "Un número de la llamada oculto, para que book_appointment pida teléfono.",
        comprobaciones: [
          {
            tipo: "texto",
            debe: true,
            patrones: ["612\\D{0,3}345\\D{0,3}679"],
            turno: 4,
            descripcion: "Repite el número entero corregido",
          },
          {
            tipo: "argumentoPatron",
            herramienta: "book_appointment",
            campo: "clientPhone",
            patron: "612\\s*345\\s*679",
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
