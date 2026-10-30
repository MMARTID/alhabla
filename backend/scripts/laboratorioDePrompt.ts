/**
 * Laboratorio de prompt: mide por chat, sin llamadas, si un cambio del prompt
 * de la recepcionista se porta peor que el actual (PLAN-PROMPT-DINAMICO.md,
 * F0). Es la receta de la PR #259 convertida en script.
 *
 * Por cada variante crea un assistant temporal «alhabla-lab-prompt-<fecha>-
 * <variante>» con `buildTelnyxAssistantPayload` y el código de este checkout
 * (mismas tools y mismo modelo que producción; `control` es la
 * `versionDelPrompt` «v1», `v2` la del prompt compacto de F2). Después corre
 * la batería de escenarios E1-E26 (laboratorioDePrompt.escenarios.ts), `--n`
 * veces cada uno: una conversación nueva con el `call_control_id` de una
 * llamada antigua del negocio (así las tools de voz llegan de verdad al
 * backend de dev), el saludo como mensaje del assistant y los turnos del
 * cliente con `chatWithAssistant`. Las tools que llamó salen de
 * `listConversationMessages`. Cada repetición se evalúa con comprobaciones
 * automáticas (tools llamadas o no, textos, idioma) y, con `--juez`, con un
 * modelo barato que no es el del assistant. Escribe un informe JSON y una
 * tabla Markdown control frente a candidato.
 *
 * Seguridad:
 * - Solo toca lo suyo: antes de borrar un assistant comprueba que su nombre
 *   empieza por «alhabla-lab-prompt-». Nunca el assistant de dev compartido
 *   ni los de producción.
 * - Limpia siempre al acabar, también con Ctrl+C: assistants, su app TeXML
 *   «ai-<id>» y las conversaciones.
 * - La BD es solo de lectura y tiene que ser local (como el MCP de dev); el
 *   BASE_URL de las tools no puede ser el de producción.
 * - Las tools las atiende el backend de dev: las reservas, las anulaciones y
 *   los avisos (también el WhatsApp de confirmación al número de la llamada
 *   antigua) ocurren de verdad en dev. Por eso los guiones con `creaCitas`
 *   solo corren con `--con-citas`, que exige además `--si`; el `--dry-run`
 *   enumera los números (enmascarados) que recibirían mensajes. La tool
 *   `transfer` va a un destino inerte.
 * - Los guiones de chat usan una conversación de WhatsApp antigua del negocio
 *   (Call `whatsapp:chat:<id>`), no una llamada: el backend decide el canal
 *   por ese prefijo. Sin ninguna, se saltan con un aviso.
 *
 * Uso (con TELNYX_API_KEY y BASE_URL del .env de dev en el entorno, o se
 * leen del .env del checkout principal):
 *   npx tsx scripts/laboratorioDePrompt.ts --negocio <businessId> \
 *     [--n 10] [--escenarios E1,E3] [--variantes control,v2] \
 *     [--negocio-de E4=<id>,E18=<id>] [--salida <dir>] [--juez [modelo]] \
 *     [--paralelo 3] [--con-citas] [--lista-de-espera si|no|auto] \
 *     [--dry-run] [--si]
 * Con más de 300 turnos o con `--con-citas` hace falta `--si`. `--dry-run` no llama a Telnyx:
 * construye los payloads y cuenta lo que haría.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";
import {
  telnyxAiAdapter,
  type CreateTelnyxAssistantInput,
  type TelnyxConversationMessage,
} from "../src/adapters/telnyx/TelnyxAiAdapter.js";
import { cargarEnv, urlDeBdDeDev } from "../mcp/entorno.js";
import {
  ESCENARIOS,
  todosLosGuiones,
  type Comprobacion,
  type Escenario,
  type Guion,
  type IdiomaDeLaBateria,
} from "./laboratorioDePrompt.escenarios.js";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Todo lo que crea el laboratorio empieza así; es lo único que borra. */
export const PREFIJO_DEL_LABORATORIO = "alhabla-lab-prompt-";

/** Por encima de estos turnos hace falta `--si`. */
export const TOPE_DE_TURNOS_SIN_CONFIRMAR = 300;

/** El juez es un modelo alojado por Telnyx y distinto del del assistant
 * (`openai/gpt-5.6-luna` no se sirve por la inferencia pública). */
export const MODELO_DEL_JUEZ = "moonshotai/Kimi-K2.6";
const MODELO_DEL_ASSISTANT = "openai/gpt-5.6-luna";

/** Voz Ultra cualquiera: el chat no habla, pero el payload la exige. */
const VOZ_DEL_LABORATORIO = "Telnyx.Ultra.538a8872-3799-4df5-b373-b78493b766c6";

/** Destino de la tool `transfer` en el laboratorio: ninguna prueba por chat
 * puede hacer sonar el móvil del dueño. */
const DESTINO_INERTE_DE_TRANSFERENCIA = "+34000000000";

const CLAVE_LISTA_DE_ESPERA = "hueco_libre";

/** Cómo se llama cada variante y qué `versionDelPrompt` lleva. */
export const VARIANTES = {
  control: { version: "v1" },
  v2: { version: "v2" },
} as const;
export type NombreDeVariante = keyof typeof VARIANTES;

// ---------------------------------------------------------------------------
// Argumentos
// ---------------------------------------------------------------------------

export class ErrorDeUso extends Error {}

export interface Opciones {
  ayuda: boolean;
  negocio: string;
  /** Escenario («E4») o guion («E9a») → negocio distinto del general. */
  negociosPorEscenario: Record<string, string>;
  n: number;
  /** null = todos. Ids de escenario o claves de guion, ya validados. */
  escenarios: string[] | null;
  variantes: NombreDeVariante[];
  salida: string;
  dryRun: boolean;
  si: boolean;
  /** Modelo del juez, o null sin juez. */
  juez: string | null;
  paralelo: number;
  /** Corre también los guiones que reservan o anulan (`--con-citas`). */
  conCitas: boolean;
  listaDeEspera: "si" | "no" | "auto";
}

export const SALIDA_POR_DEFECTO = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../.laboratorio-de-prompt"
);

const BANDERAS_CON_VALOR = new Set([
  "negocio",
  "negocio-de",
  "n",
  "escenarios",
  "variantes",
  "salida",
  "paralelo",
  "lista-de-espera",
]);
const BANDERAS_SUELTAS = new Set(["dry-run", "si", "con-citas", "ayuda"]);

function lista(valor: string): string[] {
  return valor
    .split(",")
    .map((parte) => parte.trim())
    .filter(Boolean);
}

/** Los ids de escenario y de guion que existen, para validar `--escenarios`. */
function identificadoresConocidos(): Set<string> {
  return new Set([
    ...ESCENARIOS.map((escenario) => escenario.id),
    ...todosLosGuiones().map((guion) => guion.clave),
  ]);
}

export function parsearArgumentos(argv: string[]): Opciones {
  const valores = new Map<string, string>();
  const sueltas = new Set<string>();
  let juez: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const argumento = argv[i]!;
    if (!argumento.startsWith("--")) {
      throw new ErrorDeUso(`Argumento inesperado: ${argumento}`);
    }
    const [nombre = "", valorEnLinea] = argumento.slice(2).split(/=(.*)/s);
    if (nombre === "juez") {
      // El modelo es opcional: --juez solo, o --juez <modelo>.
      const siguiente = argv[i + 1];
      if (valorEnLinea !== undefined) juez = valorEnLinea || MODELO_DEL_JUEZ;
      else if (siguiente !== undefined && !siguiente.startsWith("--")) {
        juez = siguiente;
        i++;
      } else juez = MODELO_DEL_JUEZ;
    } else if (BANDERAS_SUELTAS.has(nombre)) {
      sueltas.add(nombre);
    } else if (BANDERAS_CON_VALOR.has(nombre)) {
      const valor = valorEnLinea ?? argv[++i];
      if (valor === undefined || valor.startsWith("--")) {
        throw new ErrorDeUso(`Falta el valor de --${nombre}`);
      }
      valores.set(nombre, valor);
    } else {
      throw new ErrorDeUso(`Opción desconocida: --${nombre}`);
    }
  }

  const ayuda = sueltas.has("ayuda");
  const numero = (
    nombre: string,
    porDefecto: number,
    min: number,
    max: number
  ) => {
    const bruto = valores.get(nombre);
    if (bruto === undefined) return porDefecto;
    const resultado = z.coerce
      .number()
      .int()
      .min(min)
      .max(max)
      .safeParse(bruto);
    if (!resultado.success) {
      throw new ErrorDeUso(
        `--${nombre} tiene que ser un entero entre ${min} y ${max}`
      );
    }
    return resultado.data;
  };

  const negocio = valores.get("negocio");
  if (!negocio && !ayuda) throw new ErrorDeUso("Falta --negocio <businessId>");

  const conocidos = identificadoresConocidos();
  const escenarios = valores.has("escenarios")
    ? lista(valores.get("escenarios")!)
    : null;
  for (const id of escenarios ?? []) {
    if (!conocidos.has(id))
      throw new ErrorDeUso(`Escenario desconocido: ${id}`);
  }

  const negociosPorEscenario: Record<string, string> = {};
  for (const par of lista(valores.get("negocio-de") ?? "")) {
    const [id, idDelNegocio] = par.split("=");
    if (!id || !idDelNegocio || !conocidos.has(id)) {
      throw new ErrorDeUso(`--negocio-de espera E4=<businessId>, no «${par}»`);
    }
    negociosPorEscenario[id] = idDelNegocio;
  }

  const variantes = lista(valores.get("variantes") ?? "control");
  for (const variante of variantes) {
    if (!(variante in VARIANTES)) {
      throw new ErrorDeUso(
        `Variante desconocida: ${variante} (hay ${Object.keys(VARIANTES).join(", ")})`
      );
    }
  }
  if (variantes.length === 0) throw new ErrorDeUso("--variantes está vacío");

  const listaDeEspera = valores.get("lista-de-espera") ?? "auto";
  if (!["si", "no", "auto"].includes(listaDeEspera)) {
    throw new ErrorDeUso("--lista-de-espera es si, no o auto");
  }

  return {
    ayuda,
    negocio: negocio ?? "",
    negociosPorEscenario,
    n: numero("n", 10, 1, 200),
    escenarios,
    variantes: [...new Set(variantes)] as NombreDeVariante[],
    salida: resolve(valores.get("salida") ?? SALIDA_POR_DEFECTO),
    dryRun: sueltas.has("dry-run"),
    si: sueltas.has("si"),
    juez,
    paralelo: numero("paralelo", 3, 1, 8),
    conCitas: sueltas.has("con-citas"),
    listaDeEspera: listaDeEspera as Opciones["listaDeEspera"],
  };
}

export const AYUDA = `Laboratorio de prompt (PLAN-PROMPT-DINAMICO.md, F0)

  npx tsx scripts/laboratorioDePrompt.ts --negocio <businessId> [opciones]

  --negocio <id>            negocio de dev del que salen las llamadas antiguas
  --negocio-de E4=<id>,...  otro negocio para un escenario o un guion
  --n <10>                  repeticiones por guion y variante
  --escenarios E1,E3        solo esos escenarios (o guiones: E9a)
  --variantes control,v2    control = prompt v1; v2 solo cuando exista (F2)
  --salida <dir>            informe (por defecto backend/.laboratorio-de-prompt/)
  --juez [modelo]           juez LLM para lo textual (por defecto ${MODELO_DEL_JUEZ})
  --paralelo <3>            conversaciones a la vez
  --con-citas               corre también los guiones que reservan o anulan
                            citas en dev (y mandan WhatsApp); exige --si
  --lista-de-espera si|no|auto
  --dry-run                 no llama a Telnyx: construye payloads y cuenta
  --si                      imprescindible con más de ${TOPE_DE_TURNOS_SIN_CONFIRMAR} turnos o con --con-citas`;

// ---------------------------------------------------------------------------
// Guardas
// ---------------------------------------------------------------------------

/** ¿Es un assistant que creó el laboratorio? Lo único que se borra. */
export function esNombreDeLaboratorio(nombre: string | null | undefined) {
  return (
    typeof nombre === "string" && nombre.startsWith(PREFIJO_DEL_LABORATORIO)
  );
}

function dosDigitos(valor: number): string {
  return String(valor).padStart(2, "0");
}

/** «20261030-1542», en hora local. */
export function fechaDelLaboratorio(ahora: Date): string {
  return (
    `${ahora.getFullYear()}${dosDigitos(ahora.getMonth() + 1)}` +
    `${dosDigitos(ahora.getDate())}-` +
    `${dosDigitos(ahora.getHours())}${dosDigitos(ahora.getMinutes())}`
  );
}

export function nombreDelAssistant(
  fecha: string,
  variante: NombreDeVariante,
  sufijo?: string
): string {
  return `${PREFIJO_DEL_LABORATORIO}${fecha}-${variante}${sufijo ? `-${sufijo}` : ""}`;
}

/**
 * La `DATABASE_URL` de dev vista desde el Mac, o error si no es local: el
 * laboratorio nunca lee de una BD remota. Es la misma regla de
 * mcp/entorno.ts (`urlDeBdDeDev`), con el aviso en nuestro idioma.
 */
export function exigirBdLocal(url: string | undefined): string {
  if (!url) throw new Error("[Laboratorio] Falta DATABASE_URL");
  try {
    return urlDeBdDeDev({ DATABASE_URL: url });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    throw new Error(`[Laboratorio] ${mensaje.replace(/^\[MCP\]\s*/, "")}`);
  }
}

const HOSTS_DE_PRODUCCION = new Set(["api.alhabla.ai"]);

/** Las tools del assistant de prueba solo pueden apuntar al backend de dev. */
export function exigirBaseUrlDeDev(baseUrl: string | undefined): string {
  if (!baseUrl)
    throw new Error("[Laboratorio] Falta BASE_URL (el túnel de dev)");
  const host = new URL(baseUrl).hostname;
  if (HOSTS_DE_PRODUCCION.has(host) || host.endsWith(".run.app")) {
    throw new Error(
      `[Laboratorio] BASE_URL (${host}) es producción; las tools del laboratorio solo van al backend de dev`
    );
  }
  return baseUrl;
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

export interface Tarea {
  guion: Guion;
  escenarioId: string;
  variante: NombreDeVariante;
  repeticion: number;
  negocioId: string;
}

export interface Plan {
  guiones: Guion[];
  tareas: Tarea[];
  negocios: string[];
  turnosTotales: number;
  /** Repeticiones que recorren una reserva o una anulación. */
  repeticionesConCitas: number;
}

function escenarioDe(guion: Guion): Escenario {
  return ESCENARIOS.find((escenario) =>
    escenario.guiones.some((g) => g.clave === guion.clave)
  )!;
}

export function planificar(opciones: Opciones): Plan {
  const seleccion = opciones.escenarios;
  const guiones = todosLosGuiones().filter((guion) => {
    if (!opciones.conCitas && guion.creaCitas) return false;
    if (!seleccion) return true;
    return (
      seleccion.includes(guion.clave) ||
      seleccion.includes(escenarioDe(guion).id)
    );
  });

  const tareas: Tarea[] = [];
  for (const guion of guiones) {
    const escenarioId = escenarioDe(guion).id;
    const negocioId =
      opciones.negociosPorEscenario[guion.clave] ??
      opciones.negociosPorEscenario[escenarioId] ??
      opciones.negocio;
    // Las variantes de una repetición seguidas: corren en condiciones
    // parecidas y la comparación no depende de la hora.
    for (let repeticion = 1; repeticion <= opciones.n; repeticion++) {
      for (const variante of opciones.variantes) {
        tareas.push({ guion, escenarioId, variante, repeticion, negocioId });
      }
    }
  }

  return {
    guiones,
    tareas,
    negocios: [...new Set(tareas.map((tarea) => tarea.negocioId))],
    turnosTotales: tareas.reduce((suma, t) => suma + t.guion.turnos.length, 0),
    repeticionesConCitas: tareas.filter((t) => t.guion.creaCitas).length,
  };
}

/** Falla si el plan pasa del tope, o reserva citas, y no se pasó `--si`. */
export function exigirConfirmacion(plan: Plan, opciones: Opciones): void {
  if (opciones.si) return;
  if (plan.turnosTotales > TOPE_DE_TURNOS_SIN_CONFIRMAR) {
    throw new ErrorDeUso(
      `Va a hacer ${plan.turnosTotales} turnos de chat (más de ${TOPE_DE_TURNOS_SIN_CONFIRMAR}); añade --si para seguir o baja --n / --escenarios`
    );
  }
  if (plan.repeticionesConCitas > 0) {
    throw new ErrorDeUso(
      `Va a reservar o anular citas en dev en ${plan.repeticionesConCitas} repeticiones (y mandar sus WhatsApp); mira los números con --dry-run y añade --si para seguir`
    );
  }
}

/**
 * Qué llamada antigua usa cada tarea. Las que reservan o anulan gastan una
 * llamada cada una (una Call solo admite una cita), desde el principio; las
 * de solo lectura reparten, desde el final, solo las que no va a usar
 * ninguna reserva: en una llamada con cita, check_availability contesta
 * YA_HAY_CITA_EN_ESTA_LLAMADA y saldría como fallo del prompt. Lo que no
 * alcanza se repite y se cuenta en `reutilizadas`, para avisar.
 */
export function repartirLlamadas<T>(
  llamadas: T[],
  tareas: Array<{ creaCitas: boolean }>
): { asignadas: T[]; reutilizadas: number } {
  if (llamadas.length === 0) {
    throw new Error(
      "[Laboratorio] El negocio no tiene llamadas antiguas sin cita; haz una llamada de prueba o usa otro negocio"
    );
  }
  const conCitas = tareas.filter((tarea) => tarea.creaCitas).length;
  const libres = llamadas.slice(Math.min(conCitas, llamadas.length));
  let siguienteConCita = 0;
  let siguienteDeLectura = 0;
  let reutilizadas = 0;
  const asignadas = tareas.map((tarea) => {
    if (tarea.creaCitas) {
      if (siguienteConCita >= llamadas.length) reutilizadas++;
      return llamadas[siguienteConCita++ % llamadas.length]!;
    }
    if (libres.length > 0) {
      return libres[
        libres.length - 1 - (siguienteDeLectura++ % libres.length)
      ]!;
    }
    // Ninguna libre: comparte una con las que reservan.
    reutilizadas++;
    return llamadas[
      llamadas.length - 1 - (siguienteDeLectura++ % llamadas.length)
    ]!;
  });
  return { asignadas, reutilizadas };
}

/** «+34•••••5678»: lo justo para reconocer el número en el `--dry-run`. */
export function enmascararTelefono(telefono: string | null): string {
  if (!telefono) return "(sin número)";
  if (telefono.length <= 7) return "•".repeat(telefono.length);
  return `${telefono.slice(0, 3)}${"•".repeat(telefono.length - 7)}${telefono.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// La conversación leída de Telnyx
// ---------------------------------------------------------------------------

export interface LlamadaAHerramienta {
  nombre: string;
  argumentos: Record<string, unknown>;
  argumentosCrudos: string;
  /** Respuesta del cliente a la que contesta (1 = el primer mensaje). */
  turno: number;
  /** ¿Escribió algo antes de llamarla, en ese turno? */
  textoPrevio: boolean;
  resultado?: string;
}

export interface TurnoRegistrado {
  turno: number;
  cliente: string;
  /** Todo lo que dijo la recepcionista en el turno. */
  respuesta: string;
  duracionMs: number;
}

export interface Conversacion {
  turnos: TurnoRegistrado[];
  llamadas: LlamadaAHerramienta[];
  avisos: string[];
}

function leerArgumentos(crudos: string): Record<string, unknown> {
  try {
    const valor: unknown = JSON.parse(crudos);
    return valor && typeof valor === "object" && !Array.isArray(valor)
      ? (valor as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function enOrdenCronologico(
  mensajes: TelnyxConversationMessage[]
): TelnyxConversationMessage[] {
  const marcas = mensajes.map((m) => Date.parse(m.createdAt ?? m.sentAt ?? ""));
  if (marcas.some(Number.isNaN)) return mensajes;
  return mensajes
    .map((mensaje, indice) => ({ mensaje, indice, marca: marcas[indice]! }))
    .sort((a, b) => a.marca - b.marca || a.indice - b.indice)
    .map(({ mensaje }) => mensaje);
}

/**
 * Parte los mensajes de la conversación en turnos (cada mensaje del cliente
 * abre uno) y apunta las tools que llamó la recepcionista en cada uno.
 * `entrada` trae lo que ya sabe el laboratorio de cada turno (el mensaje del
 * cliente, la respuesta que devolvió el chat y lo que tardó).
 */
export function reconstruirConversacion(
  mensajes: TelnyxConversationMessage[],
  entrada: Array<{
    cliente: string;
    respuestaDelChat: string;
    duracionMs: number;
  }>
): Conversacion {
  const llamadas: LlamadaAHerramienta[] = [];
  const textos: string[][] = entrada.map(() => []);
  const avisos: string[] = [];
  let turno = 0;
  let textoPrevio = false;

  for (const mensaje of enOrdenCronologico(mensajes)) {
    if (mensaje.role === "user") {
      turno++;
      textoPrevio = false;
    } else if (mensaje.role === "assistant") {
      const texto = mensaje.text?.trim() ?? "";
      if (texto) {
        textoPrevio = true;
        if (turno >= 1) textos[turno - 1]?.push(texto);
      }
      for (const llamada of mensaje.toolCalls ?? []) {
        llamadas.push({
          nombre: llamada.nombre,
          argumentos: leerArgumentos(llamada.argumentos),
          argumentosCrudos: llamada.argumentos,
          turno,
          textoPrevio,
        });
      }
    } else if (mensaje.role === "tool") {
      const sinResultado = llamadas.find(
        (llamada) => llamada.turno === turno && llamada.resultado === undefined
      );
      if (sinResultado) sinResultado.resultado = mensaje.text ?? "";
    }
  }

  if (turno !== entrada.length) {
    avisos.push(
      `Telnyx devolvió ${turno} mensajes del cliente y el guion tiene ${entrada.length}`
    );
  }

  return {
    turnos: entrada.map((dato, indice) => ({
      turno: indice + 1,
      cliente: dato.cliente,
      respuesta: textos[indice]?.length
        ? textos[indice]!.join("\n")
        : dato.respuestaDelChat,
      duracionMs: dato.duracionMs,
    })),
    llamadas,
    avisos,
  };
}

// ---------------------------------------------------------------------------
// Idioma y teléfonos
// ---------------------------------------------------------------------------

/** Palabras gramaticales propias de cada idioma (una cadena por idioma). */
const PALABRAS: Record<IdiomaDeLaBateria, string> = {
  es:
    "y por con los las tengo puedo para tu su quieres vale gracias pero qué " +
    "está hay también claro perdona muy más nombre reserva hueco sí te un es " +
    "esto ese esa lo se me le necesito servicio viernes jueves martes mañana " +
    "tarde puedes podemos dime cuál cómo donde dónde",
  ca:
    "i per amb les els tinc puc vols gràcies però què hi també perfecte " +
    "entesos molt més nom dijous divendres dimarts tens fer aquest aquesta " +
    "és em et teva seva servei vull tall perruqueria matí tarda sí dia cap " +
    "quan on",
  en:
    "the and you your is are for with would like book booked appointment " +
    "haircut please thank thanks what time can have name confirm great sure " +
    "how long minutes hello there that this we our at on friday tomorrow yes " +
    "no i me it of to",
};

const PALABRAS_POR_IDIOMA = Object.fromEntries(
  Object.entries(PALABRAS).map(([idioma, palabras]) => [
    idioma,
    new Set(palabras.split(" ")),
  ])
) as Record<IdiomaDeLaBateria, Set<string>>;

/**
 * Idioma de un texto por palabras gramaticales propias de cada uno. Es una
 * heurística para la batería, no un detector: con poca evidencia dice
 * «desconocido» y el escenario no falla por ello (para eso está el juez).
 */
export function detectarIdioma(
  texto: string
): IdiomaDeLaBateria | "desconocido" {
  const normalizado = texto.toLowerCase().replace(/[’`]/g, "'");
  const palabras = normalizado.match(/\p{L}+/gu) ?? [];
  const puntos: Record<IdiomaDeLaBateria, number> = { es: 0, ca: 0, en: 0 };
  for (const palabra of palabras) {
    for (const idioma of ["es", "ca", "en"] as const) {
      if (PALABRAS_POR_IDIOMA[idioma].has(palabra)) puntos[idioma]++;
    }
  }
  // Los apóstrofos de contracción (l', d', s', m', t') solo son catalanes.
  puntos.ca += (normalizado.match(/\b[ldsmt]'\p{L}/gu) ?? []).length;

  const ordenados = (
    Object.entries(puntos) as Array<[IdiomaDeLaBateria, number]>
  ).sort((a, b) => b[1] - a[1]);
  const [mejor, segundo] = ordenados;
  if (!mejor || mejor[1] < 2 || mejor[1] - (segundo?.[1] ?? 0) < 2) {
    return "desconocido";
  }
  return mejor[0];
}

function normalizarTelefono(cifras: string): string {
  const soloCifras = cifras.replace(/\D/g, "");
  if (soloCifras.startsWith("0034")) return soloCifras.slice(4);
  if (soloCifras.length === 11 && soloCifras.startsWith("34")) {
    return soloCifras.slice(2);
  }
  return soloCifras;
}

/** Los teléfonos (9 cifras o más, con espacios o guiones) de un texto. */
export function telefonosDelTexto(texto: string): string[] {
  return (texto.match(/\+?\d(?:[\s.-]?\d){8,}/g) ?? []).map(normalizarTelefono);
}

// ---------------------------------------------------------------------------
// Evaluación
// ---------------------------------------------------------------------------

export interface ResultadoDeComprobacion {
  descripcion: string;
  ok: boolean;
  detalle?: string;
  /** Viene del juez LLM y no de una comprobación automática. */
  juez?: boolean;
}

function llamadasDe(
  conversacion: Conversacion,
  herramientas: string[],
  turno?: number
): LlamadaAHerramienta[] {
  return conversacion.llamadas.filter(
    (llamada) =>
      herramientas.includes(llamada.nombre) &&
      (turno === undefined || llamada.turno === turno)
  );
}

function turnosEnAmbito(
  conversacion: Conversacion,
  turno?: number
): TurnoRegistrado[] {
  return turno === undefined
    ? conversacion.turnos
    : conversacion.turnos.filter((t) => t.turno === turno);
}

function coincide(patron: string, texto: string): boolean {
  return new RegExp(patron, "iu").test(texto);
}

function valorComoTexto(valor: unknown): string {
  return valor === undefined || valor === null
    ? ""
    : typeof valor === "string"
      ? valor
      : JSON.stringify(valor);
}

function enTurno(turno?: number): string {
  return turno === undefined ? "en la conversación" : `en el turno ${turno}`;
}

/** Evalúa una comprobación sobre la conversación. Nunca lanza. */
export function evaluarComprobacion(
  comprobacion: Comprobacion,
  conversacion: Conversacion
): ResultadoDeComprobacion {
  const { descripcion } = comprobacion;
  const resultado = (ok: boolean, detalle?: string) => ({
    descripcion,
    ok,
    ...(detalle && !ok ? { detalle } : {}),
  });

  switch (comprobacion.tipo) {
    case "llama": {
      const veces = llamadasDe(
        conversacion,
        comprobacion.herramientas,
        comprobacion.turno
      ).length;
      const minimo = comprobacion.minimo ?? 1;
      const maximo = comprobacion.maximo ?? Infinity;
      return resultado(
        veces >= minimo && veces <= maximo,
        `${comprobacion.herramientas.join("/")} se llamó ${veces} veces ${enTurno(comprobacion.turno)}`
      );
    }
    case "noLlama": {
      const llamadas = llamadasDe(
        conversacion,
        comprobacion.herramientas,
        comprobacion.turno
      );
      return resultado(
        llamadas.length === 0,
        `llamó a ${llamadas.map((l) => `${l.nombre} (turno ${l.turno})`).join(", ")}`
      );
    }
    case "llamaAntesDelTexto": {
      const llamadas = llamadasDe(
        conversacion,
        comprobacion.herramientas,
        comprobacion.turno
      );
      return resultado(
        llamadas.some((llamada) => !llamada.textoPrevio),
        llamadas.length === 0
          ? `no llamó a ${comprobacion.herramientas.join("/")} en el turno ${comprobacion.turno}`
          : "habló antes de llamar a la tool"
      );
    }
    case "orden": {
      const nombres = conversacion.llamadas.map((llamada) => llamada.nombre);
      let posicion = 0;
      for (const nombre of nombres) {
        if (nombre === comprobacion.herramientas[posicion]) posicion++;
      }
      return resultado(
        posicion === comprobacion.herramientas.length,
        `orden real: ${nombres.join(" > ") || "ninguna tool"}`
      );
    }
    case "argumento": {
      const llamadas = llamadasDe(conversacion, [comprobacion.herramienta]);
      const ultima = llamadas[llamadas.length - 1];
      if (!ultima) {
        return resultado(false, `no se llamó a ${comprobacion.herramienta}`);
      }
      const real = ultima.argumentos[comprobacion.campo];
      return resultado(
        valorComoTexto(real) === String(comprobacion.esperado),
        `${comprobacion.campo} = ${valorComoTexto(real) || "(ausente)"}`
      );
    }
    case "argumentoPatron": {
      const llamadas = llamadasDe(conversacion, [comprobacion.herramienta]);
      const malas = llamadas.filter(
        (llamada) =>
          coincide(
            comprobacion.patron,
            valorComoTexto(llamada.argumentos[comprobacion.campo])
          ) !== comprobacion.debeCoincidir
      );
      return resultado(
        malas.length === 0,
        malas
          .map(
            (llamada) =>
              `${comprobacion.campo} = ${valorComoTexto(llamada.argumentos[comprobacion.campo]) || "(ausente)"}`
          )
          .join("; ")
      );
    }
    case "texto": {
      const ambito = turnosEnAmbito(conversacion, comprobacion.turno);
      const modo = comprobacion.modo ?? "alguno";
      const casa = (turno: TurnoRegistrado) =>
        modo === "todos"
          ? comprobacion.patrones.every((p) => coincide(p, turno.respuesta))
          : comprobacion.patrones.some((p) => coincide(p, turno.respuesta));
      if (comprobacion.debe) {
        return resultado(
          ambito.some(casa),
          `no aparece ${comprobacion.patrones.join(" | ")} ${enTurno(comprobacion.turno)}`
        );
      }
      const culpables = ambito.filter((turno) =>
        comprobacion.patrones.some((p) => coincide(p, turno.respuesta))
      );
      return resultado(
        culpables.length === 0,
        `aparece en el turno ${culpables.map((t) => t.turno).join(", ")}`
      );
    }
    case "idioma": {
      const desde = comprobacion.desdeTurno ?? 1;
      const fallados = conversacion.turnos
        .filter((turno) => turno.turno >= desde)
        .map((turno) => ({
          turno: turno.turno,
          detectado: detectarIdioma(turno.respuesta),
        }))
        .filter(
          ({ detectado }) =>
            detectado !== "desconocido" && detectado !== comprobacion.idioma
        );
      return resultado(
        fallados.length === 0,
        fallados.map((f) => `turno ${f.turno} en ${f.detectado}`).join(", ")
      );
    }
    case "sinTelefono": {
      const permitidos = (comprobacion.permitidos ?? []).map(
        normalizarTelefono
      );
      const dichos = conversacion.turnos.flatMap((turno) =>
        telefonosDelTexto(turno.respuesta).filter(
          (telefono) => !permitidos.includes(telefono)
        )
      );
      return resultado(dichos.length === 0, `dijo ${dichos.join(", ")}`);
    }
    case "sinEmojis": {
      const culpables = conversacion.turnos.filter((turno) =>
        /\p{Extended_Pictographic}/u.test(turno.respuesta)
      );
      return resultado(
        culpables.length === 0,
        `emojis en el turno ${culpables.map((t) => t.turno).join(", ")}`
      );
    }
    case "maxCaracteres": {
      const largos = turnosEnAmbito(conversacion, comprobacion.turno).filter(
        (turno) => turno.respuesta.length > comprobacion.caracteres
      );
      return resultado(
        largos.length === 0,
        largos.map((t) => `turno ${t.turno}: ${t.respuesta.length}`).join(", ")
      );
    }
  }
}

export function evaluarGuion(
  guion: Guion,
  conversacion: Conversacion
): ResultadoDeComprobacion[] {
  return guion.comprobaciones.map((comprobacion) => {
    try {
      return evaluarComprobacion(comprobacion, conversacion);
    } catch (error) {
      return {
        descripcion: comprobacion.descripcion,
        ok: false,
        detalle: `la comprobación falló: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  });
}

// ---------------------------------------------------------------------------
// Juez LLM (opcional)
// ---------------------------------------------------------------------------

const RespuestaDelJuez = z.object({
  respuestas: z.array(
    z.object({
      cumple: z.boolean(),
      motivo: z.string().optional(),
    })
  ),
});

export function transcripcionParaElJuez(conversacion: Conversacion): string {
  const llamadasPorTurno = (turno: number) =>
    conversacion.llamadas
      .filter((llamada) => llamada.turno === turno)
      .map(
        (llamada) => `   [tool ${llamada.nombre} ${llamada.argumentosCrudos}]`
      );
  return conversacion.turnos
    .flatMap((turno) => [
      `CLIENTE: ${turno.cliente}`,
      ...llamadasPorTurno(turno.turno),
      `RECEPCIONISTA: ${turno.respuesta}`,
    ])
    .join("\n");
}

/** Saca el JSON de la respuesta del juez aunque venga entre comillas de código. */
export function leerVeredictoDelJuez(
  texto: string,
  preguntas: string[]
): ResultadoDeComprobacion[] {
  const inicio = texto.indexOf("{");
  const fin = texto.lastIndexOf("}");
  const analizado = RespuestaDelJuez.safeParse(
    inicio >= 0 && fin > inicio
      ? (() => {
          try {
            return JSON.parse(texto.slice(inicio, fin + 1));
          } catch {
            return null;
          }
        })()
      : null
  );
  if (
    !analizado.success ||
    analizado.data.respuestas.length !== preguntas.length
  ) {
    throw new Error("el juez no contestó con una respuesta por pregunta");
  }
  return preguntas.map((pregunta, indice) => {
    const { cumple, motivo } = analizado.data.respuestas[indice]!;
    return {
      descripcion: `Juez: ${pregunta}`,
      ok: cumple,
      juez: true,
      ...(!cumple && motivo ? { detalle: motivo } : {}),
    };
  });
}

// ---------------------------------------------------------------------------
// Resultados y veredicto
// ---------------------------------------------------------------------------

export interface ResultadoDeRepeticion {
  repeticion: number;
  llamadaUsada: string;
  conversacionId?: string;
  /** Falló la ejecución (Telnyx, tiempo...), no el prompt: no cuenta en la tasa. */
  error?: string;
  ok: boolean;
  comprobaciones: ResultadoDeComprobacion[];
  juezError?: string;
  turnos: TurnoRegistrado[];
  herramientas: Array<{ nombre: string; turno: number; argumentos: string }>;
  avisos: string[];
  metricas: {
    llamadasAHerramientas: number;
    getCatalog: number;
    caracteresDeRespuestas: number;
    duracionMs: number;
  };
}

export interface ResumenDeCelda {
  guion: string;
  escenario: string;
  regla: "dura" | "normal";
  variante: NombreDeVariante;
  total: number;
  ok: number;
  fallos: number;
  errores: number;
  mediaDeHerramientas: number;
  mediaDeGetCatalog: number;
  mediaDeCaracteres: number;
}

export function resumirCelda(
  guion: Guion,
  escenario: Escenario,
  variante: NombreDeVariante,
  repeticiones: ResultadoDeRepeticion[]
): ResumenDeCelda {
  const validas = repeticiones.filter((r) => !r.error);
  const media = (valor: (r: ResultadoDeRepeticion) => number) =>
    validas.length === 0
      ? 0
      : Math.round(
          (validas.reduce((suma, r) => suma + valor(r), 0) / validas.length) *
            10
        ) / 10;
  return {
    guion: guion.clave,
    escenario: escenario.id,
    regla: escenario.regla,
    variante,
    total: repeticiones.length,
    ok: validas.filter((r) => r.ok).length,
    fallos: validas.filter((r) => !r.ok).length,
    errores: repeticiones.length - validas.length,
    mediaDeHerramientas: media((r) => r.metricas.llamadasAHerramientas),
    mediaDeGetCatalog: media((r) => r.metricas.getCatalog),
    mediaDeCaracteres: media((r) => r.metricas.caracteresDeRespuestas),
  };
}

/**
 * El criterio de aceptación del plan: en las reglas duras el candidato no
 * puede fallar nunca ni peor que el control; en el resto, su tasa de acierto
 * no baja de la del control más de 1 fallo por cada 30.
 */
export function veredicto(
  control: ResumenDeCelda,
  candidato: ResumenDeCelda
): "OK" | "FALLA" | "SIN DATOS" {
  const validasControl = control.ok + control.fallos;
  const validasCandidato = candidato.ok + candidato.fallos;
  if (validasControl === 0 || validasCandidato === 0) return "SIN DATOS";
  if (control.regla === "dura") {
    return candidato.fallos === 0 && candidato.fallos <= control.fallos
      ? "OK"
      : "FALLA";
  }
  const tasaControl = control.ok / validasControl;
  const tasaCandidato = candidato.ok / validasCandidato;
  return tasaCandidato >= tasaControl - 1 / 30 ? "OK" : "FALLA";
}

// ---------------------------------------------------------------------------
// Informe
// ---------------------------------------------------------------------------

export interface Informe {
  meta: {
    fecha: string;
    negocio: string;
    negociosPorEscenario: Record<string, string>;
    n: number;
    variantes: NombreDeVariante[];
    juez: string | null;
    turnosTotales: number;
    assistants: Array<{
      variante: NombreDeVariante;
      nombre: string;
      id: string;
    }>;
    avisos: string[];
  };
  resumen: ResumenDeCelda[];
  repeticiones: Array<{
    guion: string;
    variante: NombreDeVariante;
    resultados: ResultadoDeRepeticion[];
  }>;
}

function celda(resumen: ResumenDeCelda | undefined): string {
  if (!resumen) return "-";
  const errores = resumen.errores ? ` (+${resumen.errores} err)` : "";
  return `${resumen.ok}/${resumen.ok + resumen.fallos}${errores}`;
}

/** La tabla Markdown control frente a candidato (o solo control). */
export function tablaMarkdown(informe: Informe): string {
  const { variantes } = informe.meta;
  const hayCandidato = variantes.length > 1;
  const candidato = variantes.find((v) => v !== "control");
  const guiones = [...new Set(informe.resumen.map((r) => r.guion))];
  const de = (guion: string, variante?: NombreDeVariante) =>
    informe.resumen.find((r) => r.guion === guion && r.variante === variante);

  const cabecera = [
    "Guion",
    "Regla",
    ...variantes.map((v) => `${v} (acierto)`),
    ...(hayCandidato ? ["Veredicto"] : []),
    "get_catalog/conv (control)",
    "tools/conv (control)",
    "caracteres (control)",
  ];
  const filas = guiones.map((guion) => {
    const control = de(guion, "control") ?? de(guion, variantes[0]);
    const cand = candidato ? de(guion, candidato) : undefined;
    return [
      guion,
      control?.regla ?? "",
      ...variantes.map((v) => celda(de(guion, v))),
      ...(hayCandidato
        ? [control && cand ? veredicto(control, cand) : "SIN DATOS"]
        : []),
      String(control?.mediaDeGetCatalog ?? "-"),
      String(control?.mediaDeHerramientas ?? "-"),
      String(control?.mediaDeCaracteres ?? "-"),
    ];
  });
  const linea = (columnas: string[]) => `| ${columnas.join(" | ")} |`;
  return [
    linea(cabecera),
    linea(cabecera.map(() => "---")),
    ...filas.map(linea),
  ].join("\n");
}

export function informeMarkdown(informe: Informe): string {
  const { meta } = informe;
  const fallos = informe.repeticiones.flatMap(
    ({ guion, variante, resultados }) =>
      resultados
        .filter((r) => !r.error && !r.ok)
        .slice(0, 3)
        .map((r) => {
          const rotas = r.comprobaciones
            .filter((c) => !c.ok)
            .map(
              (c) => `${c.descripcion}${c.detalle ? ` (${c.detalle})` : ""}`
            );
          return `- ${guion} ${variante} #${r.repeticion}: ${rotas.join("; ")}`;
        })
  );
  return [
    `# Laboratorio de prompt ${meta.fecha}`,
    "",
    `Negocio ${meta.negocio}, n = ${meta.n}, variantes ${meta.variantes.join(", ")}` +
      `${meta.juez ? `, juez ${meta.juez}` : ", sin juez"}. ${meta.turnosTotales} turnos de chat.`,
    "",
    tablaMarkdown(informe),
    "",
    "## Primeros fallos (hasta 3 por guion y variante)",
    "",
    ...(fallos.length ? fallos : ["Ninguno."]),
    ...(meta.avisos.length
      ? ["", "## Avisos", "", ...meta.avisos.map((a) => `- ${a}`)]
      : []),
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Limpieza
// ---------------------------------------------------------------------------

/** Lo del adaptador que usa el laboratorio (y lo que se simula en los tests). */
export type AdaptadorDelLaboratorio = Pick<
  typeof telnyxAiAdapter,
  | "createAssistant"
  | "getAssistant"
  | "deleteAssistant"
  | "deleteTexmlAppOfAssistant"
  | "createConversation"
  | "addConversationMessage"
  | "chatWithAssistant"
  | "listConversationMessages"
  | "deleteConversation"
  | "completarChat"
>;

export interface ResumenDeLimpieza {
  conversaciones: number;
  assistants: number;
  appsTexml: number;
  errores: string[];
}

export interface RegistroDeLimpieza {
  anotarAssistant(id: string, nombre: string): void;
  anotarConversacion(id: string): void;
  /**
   * Crea algo en Telnyx y lo anota en cuanto vuelve. La limpieza espera a
   * las creaciones en marcha (un Ctrl+C a mitad de un createAssistant no
   * deja el assistant sin borrar) y, una vez empezada, no deja crear nada.
   */
  crear<T>(crear: () => Promise<T>, anotar: (creado: T) => void): Promise<T>;
  /** Idempotente: la segunda llamada devuelve lo mismo que la primera. */
  limpiar(): Promise<ResumenDeLimpieza>;
}

export function crearRegistroDeLimpieza(
  adaptador: AdaptadorDelLaboratorio,
  log: (mensaje: string) => void
): RegistroDeLimpieza {
  const assistants = new Map<string, string>();
  const conversaciones = new Set<string>();
  const resumen: ResumenDeLimpieza = {
    conversaciones: 0,
    assistants: 0,
    appsTexml: 0,
    errores: [],
  };
  /** Creaciones en marcha: la limpieza las espera. */
  const enMarcha = new Set<Promise<unknown>>();
  /** Borrados de lo que se anotó con la limpieza ya empezada. */
  const tardios: Array<Promise<void>> = [];
  let limpieza: Promise<ResumenDeLimpieza> | null = null;

  const fallo = (que: string, error: unknown) => {
    const mensaje = `${que}: ${error instanceof Error ? error.message : String(error)}`;
    resumen.errores.push(mensaje);
    console.error(`[Laboratorio] No se pudo limpiar ${mensaje}`);
  };

  const borrarConversacion = async (id: string): Promise<void> => {
    try {
      await adaptador.deleteConversation(id);
      resumen.conversaciones++;
    } catch (error) {
      fallo(`la conversación ${id}`, error);
    }
  };

  const borrarAssistant = async (id: string, nombre: string): Promise<void> => {
    try {
      // Doble comprobación: el nombre que apuntamos y el que tiene ahora
      // en Telnyx. Si no empieza por el prefijo, no se toca.
      const actual = await adaptador.getAssistant(id);
      if (
        !esNombreDeLaboratorio(nombre) ||
        !esNombreDeLaboratorio(actual.name)
      ) {
        fallo(
          `el assistant ${id}`,
          new Error(
            `su nombre («${actual.name}») no es de este laboratorio; no se borra`
          )
        );
        return;
      }
      await adaptador.deleteAssistant(id);
      resumen.assistants++;
      resumen.appsTexml += await adaptador.deleteTexmlAppOfAssistant(id);
    } catch (error) {
      fallo(`el assistant ${id} (${nombre})`, error);
    }
  };

  const limpiar = async (): Promise<ResumenDeLimpieza> => {
    for (const id of conversaciones) await borrarConversacion(id);
    for (const [id, nombre] of assistants) await borrarAssistant(id, nombre);
    // Lo que se estaba creando cuando empezó: se espera y, como ya hay
    // limpieza, su anotación lo borra al momento.
    while (enMarcha.size > 0 || tardios.length > 0) {
      await Promise.allSettled([...enMarcha]);
      await Promise.allSettled(tardios.splice(0));
    }
    log(
      `[Laboratorio] Limpieza: ${resumen.assistants} assistants, ${resumen.appsTexml} apps TeXML, ${resumen.conversaciones} conversaciones` +
        (resumen.errores.length ? `, ${resumen.errores.length} errores` : "")
    );
    return resumen;
  };

  const registro: RegistroDeLimpieza = {
    anotarAssistant(id, nombre) {
      if (!esNombreDeLaboratorio(nombre)) {
        throw new Error(
          `[Laboratorio] «${nombre}» no empieza por ${PREFIJO_DEL_LABORATORIO}`
        );
      }
      if (limpieza) tardios.push(borrarAssistant(id, nombre));
      else assistants.set(id, nombre);
    },
    anotarConversacion(id) {
      if (limpieza) tardios.push(borrarConversacion(id));
      else conversaciones.add(id);
    },
    crear(crear, anotar) {
      if (limpieza) {
        return Promise.reject(
          new Error("[Laboratorio] Limpieza en curso: no se crea nada más")
        );
      }
      const creacion = crear().then((creado) => {
        anotar(creado);
        return creado;
      });
      enMarcha.add(creacion);
      void creacion.then(
        () => enMarcha.delete(creacion),
        () => enMarcha.delete(creacion)
      );
      return creacion;
    },
    limpiar() {
      limpieza ??= limpiar();
      return limpieza;
    },
  };
  return registro;
}

// ---------------------------------------------------------------------------
// Orquestación
// ---------------------------------------------------------------------------

export interface ContextoDelNegocio {
  negocioId: string;
  nombre: string;
  zonaHoraria: string;
  saludo: string;
  /** Un payload por variante pedida, ya con el nombre del laboratorio. */
  payloads: Record<NombreDeVariante, CreateTelnyxAssistantInput>;
  /** `callId` de llamadas antiguas sin cita, las más recientes primero. */
  llamadas: string[];
  /** El `fromNumber` de esas llamadas: a él va el WhatsApp de una reserva. */
  telefonos: Record<string, string | null>;
  /** Conversaciones de WhatsApp antiguas sin cita (Call `whatsapp:chat:…`),
   * para los guiones de chat; `telefono` es el del cliente. */
  chats: LlamadaAsignada[];
  avisos: string[];
}

/** La Call antigua con la que corre una repetición. */
export interface LlamadaAsignada {
  callId: string;
  telefono: string | null;
}

/**
 * Qué Call usa cada tarea: las de voz, llamadas antiguas; las de chat,
 * conversaciones de WhatsApp antiguas (el backend decide el canal por el
 * prefijo `whatsapp:chat:` del callId). Sin chats, las de chat se quedan
 * sin Call y no se ejecutan; los avisos lo dicen.
 */
export function asignarLlamadas(
  tareas: Tarea[],
  contextos: Map<string, ContextoDelNegocio>
): { porTarea: Map<Tarea, LlamadaAsignada>; avisos: string[] } {
  const porTarea = new Map<Tarea, LlamadaAsignada>();
  const avisos: string[] = [];
  for (const [negocioId, contexto] of contextos) {
    const deNegocio = tareas.filter((t) => t.negocioId === negocioId);
    const deVoz = deNegocio.filter((t) => t.guion.canal !== "chat");
    const deChat = deNegocio.filter((t) => t.guion.canal === "chat");
    if (deVoz.length > 0) {
      const { asignadas, reutilizadas } = repartirLlamadas(
        contexto.llamadas,
        deVoz.map((t) => ({ creaCitas: t.guion.creaCitas }))
      );
      deVoz.forEach((tarea, i) =>
        porTarea.set(tarea, {
          callId: asignadas[i]!,
          telefono: contexto.telefonos[asignadas[i]!] ?? null,
        })
      );
      if (reutilizadas > 0) {
        avisos.push(
          `Negocio ${negocioId}: ${reutilizadas} repeticiones comparten una llamada que ya pudo tener cita (hay ${contexto.llamadas.length}); pueden dar YA_HAY_CITA_EN_ESTA_LLAMADA sin que sea culpa del prompt`
        );
      }
    }
    if (deChat.length > 0 && contexto.chats.length === 0) {
      const claves = [...new Set(deChat.map((t) => t.guion.clave))];
      avisos.push(
        `Negocio ${negocioId}: no tiene conversaciones de WhatsApp antiguas sin cita; se saltan los guiones de chat (${claves.join(", ")})`
      );
    } else if (deChat.length > 0) {
      const { asignadas, reutilizadas } = repartirLlamadas(
        contexto.chats,
        deChat.map((t) => ({ creaCitas: t.guion.creaCitas }))
      );
      deChat.forEach((tarea, i) => porTarea.set(tarea, asignadas[i]!));
      if (reutilizadas > 0) {
        avisos.push(
          `Negocio ${negocioId}: ${reutilizadas} repeticiones de chat comparten una conversación que ya pudo tener cita (hay ${contexto.chats.length}); pueden dar YA_HAY_CITA_EN_ESTA_LLAMADA sin que sea culpa del prompt`
        );
      }
    }
  }
  return { porTarea, avisos };
}

export interface DependenciasDelLaboratorio {
  adaptador: AdaptadorDelLaboratorio;
  /** Lee la BD de dev (solo lectura) y construye los payloads. */
  cargarContexto(input: {
    negocioId: string;
    variantes: NombreDeVariante[];
    fecha: string;
    sufijo?: string;
    listaDeEspera: Opciones["listaDeEspera"];
  }): Promise<ContextoDelNegocio>;
  marcadorDeChat(input: {
    clientPhone: string;
    timezone: string;
  }): Promise<string> | string;
  escribirInforme(ruta: string, contenido: string): Promise<void>;
  ahora(): Date;
  dormir(ms: number): Promise<void>;
  log(mensaje: string): void;
}

export interface ResultadoDelLaboratorio {
  plan: Plan;
  informe: Informe | null;
  rutaDelInforme: string | null;
  limpieza: ResumenDeLimpieza | null;
}

function esLimiteDeTelnyx(error: unknown): boolean {
  const estado = (error as { status?: number } | null)?.status;
  return estado === 429 || /\b429\b/.test(String((error as Error)?.message));
}

async function conReintentos<T>(
  deps: Pick<DependenciasDelLaboratorio, "dormir">,
  accion: () => Promise<T>
): Promise<T> {
  for (let intento = 1; ; intento++) {
    try {
      return await accion();
    } catch (error) {
      if (!esLimiteDeTelnyx(error) || intento >= 4) throw error;
      await deps.dormir(2_000 * intento);
    }
  }
}

function mensajeDeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface Entorno {
  assistantId: string;
  contexto: ContextoDelNegocio;
}

async function ejecutarRepeticion(
  tarea: Tarea,
  llamada: LlamadaAsignada,
  entorno: Entorno,
  opciones: Opciones,
  deps: DependenciasDelLaboratorio,
  registro: RegistroDeLimpieza
): Promise<ResultadoDeRepeticion> {
  const { guion } = tarea;
  const { adaptador } = deps;
  const llamadaUsada = llamada.callId;
  // En el chat, el móvil del cliente de esa conversación: a él irían los
  // mensajes de una reserva, como en el chat real.
  const telefonoDelCliente = llamada.telefono ?? "+34600000000";
  const base = { repeticion: tarea.repeticion, llamadaUsada };
  const vacio: ResultadoDeRepeticion = {
    ...base,
    ok: false,
    comprobaciones: [],
    turnos: [],
    herramientas: [],
    avisos: [],
    metricas: {
      llamadasAHerramientas: 0,
      getCatalog: 0,
      caracteresDeRespuestas: 0,
      duracionMs: 0,
    },
  };
  const inicio = Date.now();
  let conversacionId: string | undefined;

  try {
    const creada = await registro.crear(
      () =>
        conReintentos(deps, () =>
          adaptador.createConversation({
            name: `lab-prompt:${guion.clave}:${tarea.variante}:${tarea.repeticion}`,
            metadata: {
              call_control_id: llamadaUsada,
              laboratorio: "prompt",
              ...(guion.canal === "chat"
                ? {
                    business_id: tarea.negocioId,
                    client_phone: telefonoDelCliente,
                    role: "client",
                    channel: "whatsapp",
                  }
                : {}),
            },
          })
        ),
      (conversacion) => registro.anotarConversacion(conversacion.id)
    );
    conversacionId = creada.id;

    // En una llamada el saludo lo dice el sistema; en el chat no hay.
    if (guion.canal === "llamada" && entorno.contexto.saludo) {
      await conReintentos(deps, () =>
        adaptador.addConversationMessage(creada.id, {
          role: "assistant",
          content: entorno.contexto.saludo,
        })
      );
    }

    const entrada: Array<{
      cliente: string;
      respuestaDelChat: string;
      duracionMs: number;
    }> = [];
    for (const [indice, mensaje] of guion.turnos.entries()) {
      const contenido =
        guion.canal === "chat" && indice === 0
          ? `${await deps.marcadorDeChat({
              clientPhone: telefonoDelCliente,
              timezone: entorno.contexto.zonaHoraria,
            })} ${mensaje}`
          : mensaje;
      const desde = Date.now();
      const respuesta = await conReintentos(deps, () =>
        adaptador.chatWithAssistant(entorno.assistantId, {
          content: contenido,
          conversationId: creada.id,
        })
      );
      entrada.push({
        cliente: mensaje,
        respuestaDelChat: respuesta,
        duracionMs: Date.now() - desde,
      });
    }

    const mensajes = await conReintentos(deps, () =>
      adaptador.listConversationMessages(creada.id)
    );
    const conversacion = reconstruirConversacion(mensajes, entrada);
    const comprobaciones = evaluarGuion(guion, conversacion);

    let juezError: string | undefined;
    if (opciones.juez && guion.rubrica?.length) {
      try {
        comprobaciones.push(
          ...(await juzgar(opciones.juez, guion.rubrica, conversacion, deps))
        );
      } catch (error) {
        juezError = mensajeDeError(error);
      }
    }

    return {
      ...base,
      conversacionId,
      ok: comprobaciones.every((c) => c.ok),
      comprobaciones,
      ...(juezError ? { juezError } : {}),
      turnos: conversacion.turnos,
      herramientas: conversacion.llamadas.map((llamada) => ({
        nombre: llamada.nombre,
        turno: llamada.turno,
        argumentos: llamada.argumentosCrudos,
      })),
      avisos: conversacion.avisos,
      metricas: {
        llamadasAHerramientas: conversacion.llamadas.length,
        getCatalog: conversacion.llamadas.filter(
          (l) => l.nombre === "get_catalog"
        ).length,
        caracteresDeRespuestas: conversacion.turnos.reduce(
          (suma, turno) => suma + turno.respuesta.length,
          0
        ),
        duracionMs: Date.now() - inicio,
      },
    };
  } catch (error) {
    console.error(
      `[Laboratorio] ${guion.clave} ${tarea.variante} #${tarea.repeticion} (negocio ${tarea.negocioId}, llamada ${llamadaUsada}): ${mensajeDeError(error)}`
    );
    return { ...vacio, conversacionId, error: mensajeDeError(error) };
  }
}

async function juzgar(
  modelo: string,
  rubrica: string[],
  conversacion: Conversacion,
  deps: DependenciasDelLaboratorio
): Promise<ResultadoDeComprobacion[]> {
  const respuesta = await conReintentos(deps, () =>
    deps.adaptador.completarChat({
      modelo,
      temperatura: 0,
      mensajes: [
        {
          role: "system",
          content:
            "Eres un evaluador estricto de conversaciones de una recepcionista de IA de un negocio. " +
            "Responde cada pregunta con sí o no según la transcripción, sin suponer nada que no esté en ella. " +
            'Devuelve SOLO un JSON: {"respuestas":[{"cumple":true|false,"motivo":"una frase"}]}, ' +
            "con exactamente una respuesta por pregunta y en el mismo orden.",
        },
        {
          role: "user",
          content: `Transcripción:\n${transcripcionParaElJuez(conversacion)}\n\nPreguntas:\n${rubrica
            .map((pregunta, i) => `${i + 1}. ${pregunta}`)
            .join("\n")}`,
        },
      ],
    })
  );
  return leerVeredictoDelJuez(respuesta, rubrica);
}

async function enParalelo<T>(
  elementos: T[],
  paralelo: number,
  trabajo: (elemento: T, indice: number) => Promise<void>,
  cancelado: () => boolean
): Promise<void> {
  let siguiente = 0;
  const hilo = async () => {
    while (!cancelado()) {
      const indice = siguiente++;
      if (indice >= elementos.length) return;
      await trabajo(elementos[indice]!, indice);
    }
  };
  await Promise.all(Array.from({ length: paralelo }, hilo));
}

/** Lo que haría el laboratorio, sin hacer nada (`--dry-run`). */
export function describirPlan(
  plan: Plan,
  contextos: ContextoDelNegocio[],
  opciones: Opciones,
  asignacion?: ReturnType<typeof asignarLlamadas>
): string {
  const lineas: string[] = [
    `Laboratorio de prompt (--dry-run: no se llama a Telnyx)`,
    `Guiones: ${plan.guiones.map((g) => g.clave).join(", ") || "ninguno"}`,
    `Variantes: ${opciones.variantes.join(", ")}; n = ${opciones.n}`,
    `Conversaciones: ${plan.tareas.length}; turnos de chat: ${plan.turnosTotales}` +
      (plan.turnosTotales > TOPE_DE_TURNOS_SIN_CONFIRMAR
        ? ` (pasa de ${TOPE_DE_TURNOS_SIN_CONFIRMAR}: haría falta --si)`
        : ""),
    `Repeticiones que reservan o anulan citas en dev: ${plan.repeticionesConCitas}` +
      (plan.repeticionesConCitas > 0 && !opciones.si
        ? " (haría falta --si)"
        : ""),
    `Juez: ${opciones.juez ?? "no"}`,
    "",
    "Assistants que crearía (y borraría al acabar, con su app TeXML):",
  ];
  for (const contexto of contextos) {
    for (const variante of opciones.variantes) {
      const payload = contexto.payloads[variante];
      const herramientas = (payload.tools ?? []).map((tool) => {
        const t = tool as { type?: string; webhook?: { name?: string } };
        return t.webhook?.name ?? t.type ?? "?";
      });
      lineas.push(
        `- ${payload.name} (negocio ${contexto.nombre}): modelo ${payload.model}, ` +
          `${payload.instructions.length} caracteres de instrucciones, tools ${herramientas.join(", ")}`
      );
    }
    lineas.push(
      `  llamadas antiguas disponibles: ${contexto.llamadas.length}; chats de WhatsApp: ${contexto.chats.length}` +
        (contexto.avisos.length
          ? ` | avisos: ${contexto.avisos.join("; ")}`
          : "")
    );
  }
  if (asignacion) {
    // A estos números irían los WhatsApp de las reservas (smsConsent).
    const conCitas = plan.tareas
      .filter((tarea) => tarea.guion.creaCitas)
      .map((tarea) => asignacion.porTarea.get(tarea))
      .filter((llamada): llamada is LlamadaAsignada => Boolean(llamada));
    if (conCitas.length > 0) {
      const telefonos = [
        ...new Set(conCitas.map((l) => enmascararTelefono(l.telefono))),
      ];
      lineas.push(
        "",
        `Números que recibirían el WhatsApp de una reserva (${conCitas.length} repeticiones): ${telefonos.join(", ")}`
      );
    }
    if (asignacion.avisos.length > 0) {
      lineas.push("", "Avisos:", ...asignacion.avisos.map((a) => `- ${a}`));
    }
  }
  const requisitos = [
    ...new Set(plan.guiones.map((g) => `${g.clave}: ${g.requiere}`)),
  ];
  lineas.push(
    "",
    "Cada guion necesita (no se comprueba):",
    ...requisitos.map((r) => `- ${r}`)
  );
  return lineas.join("\n");
}

/**
 * El laboratorio entero. Con `dryRun` solo construye los payloads (leyendo la
 * BD de dev) y los cuenta; si no, crea los assistants, corre la batería y
 * escribe el informe. La limpieza la hace el `finally` de quien llama o, si
 * se corta, el manejador de SIGINT con el mismo `registro`.
 */
export async function ejecutarLaboratorio(
  opciones: Opciones,
  deps: DependenciasDelLaboratorio,
  registro: RegistroDeLimpieza = crearRegistroDeLimpieza(
    deps.adaptador,
    deps.log
  ),
  cancelado: () => boolean = () => false
): Promise<ResultadoDelLaboratorio> {
  const plan = planificar(opciones);
  if (plan.tareas.length === 0) {
    throw new ErrorDeUso(
      "Ningún guion cumple los filtros (--escenarios; los que reservan, solo con --con-citas)"
    );
  }
  if (!opciones.dryRun) exigirConfirmacion(plan, opciones);

  const fecha = fechaDelLaboratorio(deps.ahora());
  const contextos = new Map<string, ContextoDelNegocio>();
  for (const negocioId of plan.negocios) {
    contextos.set(
      negocioId,
      await deps.cargarContexto({
        negocioId,
        variantes: opciones.variantes,
        fecha,
        sufijo: plan.negocios.length > 1 ? negocioId.slice(-6) : undefined,
        listaDeEspera: opciones.listaDeEspera,
      })
    );
  }

  // Una Call antigua por tarea, por negocio y canal.
  const asignacion = asignarLlamadas(plan.tareas, contextos);

  if (opciones.dryRun) {
    deps.log(
      describirPlan(plan, [...contextos.values()], opciones, asignacion)
    );
    return { plan, informe: null, rutaDelInforme: null, limpieza: null };
  }

  const avisos = [
    ...[...contextos.values()].flatMap((c) => c.avisos),
    ...asignacion.avisos,
  ];
  const assistants: Informe["meta"]["assistants"] = [];
  const entornos = new Map<string, Entorno>();
  const resultados: Array<{ tarea: Tarea; resultado: ResultadoDeRepeticion }> =
    [];
  const salida: ResultadoDelLaboratorio = {
    plan,
    informe: null,
    rutaDelInforme: null,
    limpieza: null,
  };

  try {
    for (const contexto of contextos.values()) {
      for (const variante of opciones.variantes) {
        const payload = contexto.payloads[variante];
        if (!esNombreDeLaboratorio(payload.name)) {
          throw new Error(
            `[Laboratorio] Nombre de assistant no permitido: ${payload.name}`
          );
        }
        const creado = await registro.crear(
          () => deps.adaptador.createAssistant(payload),
          (assistant) => registro.anotarAssistant(assistant.id, payload.name)
        );
        entornos.set(`${contexto.negocioId}:${variante}`, {
          assistantId: creado.id,
          contexto,
        });
        assistants.push({ variante, nombre: payload.name, id: creado.id });
        deps.log(
          `[Laboratorio] Assistant ${payload.name} creado (${creado.id})`
        );
      }
    }

    // Las que no tienen Call (guiones de chat sin chats antiguos) se saltan.
    const ejecutables = plan.tareas.filter((tarea) =>
      asignacion.porTarea.has(tarea)
    );
    let hechas = 0;
    await enParalelo(
      ejecutables,
      opciones.paralelo,
      async (tarea) => {
        const entorno = entornos.get(`${tarea.negocioId}:${tarea.variante}`)!;
        const resultado = await ejecutarRepeticion(
          tarea,
          asignacion.porTarea.get(tarea)!,
          entorno,
          opciones,
          deps,
          registro
        );
        resultados.push({ tarea, resultado });
        hechas++;
        if (hechas % 10 === 0 || hechas === ejecutables.length) {
          deps.log(
            `[Laboratorio] ${hechas}/${ejecutables.length} conversaciones`
          );
        }
      },
      cancelado
    );
    if (cancelado()) avisos.push("Interrumpido: el informe es parcial");

    const resumen: ResumenDeCelda[] = [];
    const repeticiones: Informe["repeticiones"] = [];
    for (const guion of plan.guiones) {
      for (const variante of opciones.variantes) {
        const deLaCelda = resultados
          .filter(
            (r) => r.tarea.guion === guion && r.tarea.variante === variante
          )
          .map((r) => r.resultado)
          .sort((a, b) => a.repeticion - b.repeticion);
        if (deLaCelda.length === 0) continue;
        resumen.push(
          resumirCelda(guion, escenarioDe(guion), variante, deLaCelda)
        );
        repeticiones.push({
          guion: guion.clave,
          variante,
          resultados: deLaCelda,
        });
      }
    }

    const informe: Informe = {
      meta: {
        fecha,
        negocio: opciones.negocio,
        negociosPorEscenario: opciones.negociosPorEscenario,
        n: opciones.n,
        variantes: opciones.variantes,
        juez: opciones.juez,
        turnosTotales: plan.turnosTotales,
        assistants,
        avisos,
      },
      resumen,
      repeticiones,
    };
    const carpeta = join(opciones.salida, fecha);
    await deps.escribirInforme(
      join(carpeta, "informe.json"),
      JSON.stringify(informe, null, 2)
    );
    await deps.escribirInforme(
      join(carpeta, "informe.md"),
      informeMarkdown(informe)
    );
    deps.log(`\n${tablaMarkdown(informe)}\n`);
    deps.log(`[Laboratorio] Informe en ${carpeta}`);
    salida.informe = informe;
    salida.rutaDelInforme = carpeta;
  } finally {
    const limpieza = await registro.limpiar();
    salida.limpieza = limpieza;
    if (limpieza.errores.length > 0) {
      console.error(
        `[Laboratorio] Quedaron restos en Telnyx (assistants «${PREFIJO_DEL_LABORATORIO}…» y sus apps «ai-<id>»); bórralos a mano:\n` +
          limpieza.errores.join("\n")
      );
    }
  }
  return salida;
}

// ---------------------------------------------------------------------------
// Dependencias reales (BD de dev y Telnyx)
// ---------------------------------------------------------------------------

/** Lo mínimo de `parseAgentSettings` que necesita saber si `v2` existe. */
export function versionDelPromptSoportada(
  parsear: (valor: unknown) => unknown,
  version: string
): boolean {
  const leidos = parsear({ versionDelPrompt: version }) as {
    versionDelPrompt?: unknown;
  } | null;
  return leidos?.versionDelPrompt === version;
}

/** Deja el assistant de prueba sin forma de llamar al móvil del dueño. */
export function neutralizarTransferencia(
  payload: CreateTelnyxAssistantInput
): CreateTelnyxAssistantInput {
  return {
    ...payload,
    tools: payload.tools?.map((tool) => {
      if ((tool as { type?: string }).type !== "transfer") return tool;
      const transfer = (
        tool as { transfer: { targets: Array<{ to: string }> } }
      ).transfer;
      return {
        ...tool,
        transfer: {
          ...transfer,
          targets: transfer.targets.map((destino) => ({
            ...destino,
            to: DESTINO_INERTE_DE_TRANSFERENCIA,
          })),
        },
      } as typeof tool;
    }),
  };
}

async function cargarContextoReal(input: {
  negocioId: string;
  variantes: NombreDeVariante[];
  fecha: string;
  sufijo?: string;
  listaDeEspera: Opciones["listaDeEspera"];
}): Promise<ContextoDelNegocio> {
  // Imports tardíos: el módulo se importa en los tests sin BD ni Prisma.
  const [
    { prisma },
    prompt,
    payloadLib,
    idiomasLib,
    zonaLib,
    transferLib,
    planLib,
    { getPublicWebhookBaseUrl },
    { isBusinessType },
  ] = await Promise.all([
    import("../src/lib/prisma.js"),
    import("../src/lib/managedAgentPrompt.js"),
    import("../src/lib/telnyxAssistantPayload.js"),
    import("../src/lib/idiomas/resolver.js"),
    import("../src/lib/idiomas/zona.js"),
    import("../src/lib/transferenciaAlDueno.js"),
    import("../src/lib/planFeatures.js"),
    import("../src/lib/serverUrl.js"),
    import("../src/lib/businessType.js"),
  ]);

  const negocio = await prisma.business.findUnique({
    where: { id: input.negocioId },
    select: {
      id: true,
      name: true,
      timezone: true,
      address: true,
      businessDetails: true,
      businessType: true,
      agentSettings: true,
      minAdvanceBookingMinutes: true,
      maxAppointmentDurationMinutes: true,
      hideOwnerNumberFromClients: true,
      customerLineType: true,
      phone: true,
      telnyxPhoneNumber: true,
      ownerWhatsappNumber: true,
      ownerPhoneIsCustomerLine: true,
      plan: true,
      stripePriceId: true,
    },
  });
  if (!negocio)
    throw new Error(`[Laboratorio] No existe el negocio ${input.negocioId}`);

  const avisos: string[] = [];
  const agente = await prisma.agent.findFirst({
    where: { businessId: negocio.id, deletedAt: null },
    select: { promptManuallyEdited: true },
  });
  if (agente?.promptManuallyEdited) {
    avisos.push(
      `El negocio ${negocio.name} tiene el prompt editado a mano; el laboratorio usa el gestionado`
    );
  }

  let listaDeEspera = input.listaDeEspera === "si";
  if (input.listaDeEspera === "auto") {
    const plantilla = await prisma.whatsappTemplate.findUnique({
      where: { key: CLAVE_LISTA_DE_ESPERA },
      select: { status: true },
    });
    listaDeEspera = plantilla?.status === "APPROVED";
  }

  const agentSettings = prompt.parseAgentSettings(negocio.agentSettings);
  const idiomas = idiomasLib.resolverIdiomas({
    ...agentSettings,
    zona: zonaLib.cooficialDeLaZona(negocio),
  });
  const transferencia = transferLib.resolverTransferenciaAlDueno(
    negocio,
    agentSettings.pasarLlamadas
  );
  const baseUrl = exigirBaseUrlDeDev(getPublicWebhookBaseUrl());
  const businessType = isBusinessType(negocio.businessType)
    ? negocio.businessType
    : "other";
  // Hasta que exista versionDelPrompt (o su valor «v2») el código solo
  // tiene el prompt de siempre.
  const conVersionDelPrompt = versionDelPromptSoportada(
    prompt.parseAgentSettings,
    "v1"
  );
  const v2Disponible = versionDelPromptSoportada(
    prompt.parseAgentSettings,
    "v2"
  );

  const payloads = {} as ContextoDelNegocio["payloads"];
  for (const variante of input.variantes) {
    const { version } = VARIANTES[variante];
    if (version !== "v1" && !v2Disponible) {
      throw new ErrorDeUso(
        `La variante ${variante} (versionDelPrompt «${version}») todavía no existe en este código: llega con F2`
      );
    }
    // El control es siempre «v1», aunque el negocio tenga otra guardada.
    const ajustes = conVersionDelPrompt
      ? { ...agentSettings, versionDelPrompt: version }
      : agentSettings;
    const instrucciones = prompt.buildManagedAgentPrompt({
      businessName: negocio.name,
      businessDetails: negocio.businessDetails,
      businessType,
      settings: ajustes,
      timezone: negocio.timezone,
      minAdvanceBookingMinutes: negocio.minAdvanceBookingMinutes,
      maxAppointmentDurationMinutes: negocio.maxAppointmentDurationMinutes,
      listaDeEspera,
      recordatorioPorWhatsapp: planLib.recordatorioIncluido(negocio),
      ocultarNumeroDelNegocio: negocio.hideOwnerNumberFromClients,
      transferenciaAlDueno: transferencia,
      idiomas: idiomas.idiomas,
    });
    const construido = payloadLib.buildTelnyxAssistantPayload({
      businessId: negocio.id,
      agentId: "laboratorio",
      businessName: negocio.name,
      timezone: negocio.timezone,
      instructions: instrucciones,
      greeting: idiomasLib.saludoDelNegocio(idiomas, negocio.name),
      idiomas,
      voice: VOZ_DEL_LABORATORIO,
      tools: payloadLib.buildTelnyxVoiceTools(baseUrl),
      transferenciaAlDueno: transferencia.activa
        ? { from: transferencia.origen!, to: transferencia.destino! }
        : null,
    });
    payloads[variante] = neutralizarTransferencia({
      ...construido,
      name: nombreDelAssistant(input.fecha, variante, input.sufijo),
    });
    if (payloads[variante].model !== MODELO_DEL_ASSISTANT) {
      avisos.push(`El modelo del payload es ${payloads[variante].model}`);
    }
  }

  const textos = input.variantes.map((v) => payloads[v].instructions);
  if (new Set(textos).size < textos.length) {
    throw new ErrorDeUso(
      `Las variantes ${input.variantes.join(" y ")} generan el mismo prompt: compararlas no mediría nada`
    );
  }

  // Llamadas antiguas y cerradas, sin cita: una Call solo admite una.
  const llamadas = await prisma.call.findMany({
    where: {
      businessId: negocio.id,
      voiceProvider: "telnyx",
      status: { not: "IN_PROGRESS" },
      booking: { is: null },
    },
    orderBy: { startedAt: "desc" },
    take: 300,
    select: { callId: true, fromNumber: true },
  });
  // Y conversaciones de WhatsApp antiguas sin cita, para los guiones de
  // chat: con el callId de una llamada el backend los trataría como voz.
  const chats = await prisma.call.findMany({
    where: {
      businessId: negocio.id,
      voiceProvider: "whatsapp",
      callId: { startsWith: "whatsapp:chat:" },
      fromNumber: { not: null },
      booking: { is: null },
    },
    orderBy: { startedAt: "desc" },
    take: 100,
    select: { callId: true, fromNumber: true },
  });

  return {
    negocioId: negocio.id,
    nombre: negocio.name,
    zonaHoraria: negocio.timezone,
    saludo: payloads[input.variantes[0]!].greeting ?? "",
    payloads,
    llamadas: llamadas.map((llamada) => llamada.callId),
    telefonos: Object.fromEntries(
      llamadas.map((llamada) => [llamada.callId, llamada.fromNumber])
    ),
    chats: chats.map((chat) => ({
      callId: chat.callId,
      telefono: chat.fromNumber,
    })),
    avisos,
  };
}

function dependenciasReales(): DependenciasDelLaboratorio {
  return {
    adaptador: telnyxAiAdapter,
    cargarContexto: cargarContextoReal,
    marcadorDeChat: async (input) => {
      // El mismo marcador que antepone el chat real (modules/whatsapp).
      const { marcadorDeChat } =
        await import("../src/modules/whatsapp/chatCliente.js");
      return marcadorDeChat(input);
    },
    escribirInforme: async (ruta, contenido) => {
      await mkdir(dirname(ruta), { recursive: true });
      await writeFile(ruta, contenido, "utf8");
    },
    ahora: () => new Date(),
    dormir: (ms) => new Promise((resolver) => setTimeout(resolver, ms)),
    log: (mensaje) => console.log(mensaje),
  };
}

/** Las variables de entorno que hacen falta, leídas del .env de dev si no están. */
export function prepararEntorno(dryRun: boolean): void {
  const delEnv = (): Record<string, string> => {
    try {
      return cargarEnv();
    } catch {
      return {};
    }
  };
  let env: Record<string, string> | null = null;
  const leer = (nombre: string): string | undefined => {
    if (process.env[nombre]) return process.env[nombre];
    env ??= delEnv();
    return env[nombre];
  };

  process.env.DATABASE_URL = exigirBdLocal(leer("DATABASE_URL"));
  process.env.BASE_URL = exigirBaseUrlDeDev(leer("BASE_URL"));
  if (!dryRun) {
    const clave = leer("TELNYX_API_KEY");
    if (!clave) throw new Error("[Laboratorio] Falta TELNYX_API_KEY");
    process.env.TELNYX_API_KEY = clave;
  }
}

async function main(): Promise<void> {
  const opciones = parsearArgumentos(process.argv.slice(2));
  if (opciones.ayuda) {
    console.log(AYUDA);
    return;
  }
  prepararEntorno(opciones.dryRun);

  const deps = dependenciasReales();
  const registro = crearRegistroDeLimpieza(deps.adaptador, deps.log);
  let interrumpido = false;
  const alInterrumpir = (senal: NodeJS.Signals) => {
    if (interrumpido) return;
    interrumpido = true;
    console.error(`\n[Laboratorio] ${senal}: limpiando antes de salir...`);
    void registro.limpiar().finally(() => process.exit(130));
  };
  process.once("SIGINT", alInterrumpir);
  process.once("SIGTERM", alInterrumpir);

  try {
    await ejecutarLaboratorio(opciones, deps, registro, () => interrumpido);
  } finally {
    const { prisma } = await import("../src/lib/prisma.js");
    await prisma.$disconnect();
  }
}

const esElPrincipal =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (esElPrincipal) {
  main().catch((error) => {
    console.error(
      error instanceof ErrorDeUso
        ? `${error.message}\n\n${AYUDA}`
        : mensajeDeError(error).startsWith("[Laboratorio]")
          ? mensajeDeError(error)
          : `[Laboratorio] ${mensajeDeError(error)}`
    );
    process.exit(1);
  });
}
