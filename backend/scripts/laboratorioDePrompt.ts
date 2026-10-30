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
 * cliente con `chatWithAssistant`. El saludo de cada llamada es el que
 * diría el backend al contestarla (lib/contextoDeLlamada.ts: cliente
 * conocido, aviso de grabación, negocio nuevo), y sus variables del prompt
 * van en el assistant si todas las llamadas del negocio comparten las mismas. Las tools que llamó salen de
 * `listConversationMessages`. Cada repetición se evalúa con comprobaciones
 * automáticas (tools llamadas o no, textos, idioma) y, con `--juez`, con un
 * modelo barato que no es el del assistant. Escribe un informe JSON y una
 * tabla Markdown control frente a candidato (y, con `--comparar-con`, frente
 * a otra ejecución de la misma variante).
 *
 * Negocios: cada escenario corre por defecto con su negocio de laboratorio
 * (laboratorioDePrompt.negocios.ts, sembrado por
 * sembrarNegociosDeLaboratorio.ts): un assistant temporal por (negocio,
 * variante), solo para los negocios que se usen. `--negocio` fuerza uno para
 * todos y `--negocio-de E4=<id>` otro para un escenario o guion. Si un
 * escenario no tiene negocio disponible, se salta y el informe lo avisa.
 *
 * Cliente: por defecto es reactivo (`--cliente reactivo`): un LLM barato, que
 * no es el del assistant, hace de cliente con el objetivo y los datos del
 * guion y contesta a lo que la recepcionista pregunta; termina al cumplir el
 * objetivo o al tope de turnos, y las frases que una comprobación necesita
 * literales salen tal cual. `--cliente guion` reproduce los turnos fijos.
 *
 * Seguridad:
 * - Solo toca lo suyo: antes de borrar un assistant comprueba que su nombre
 *   empieza por «alhabla-lab-prompt-». Nunca el assistant de dev compartido
 *   ni los de producción.
 * - Limpia siempre al acabar, también con Ctrl+C: assistants, su app TeXML
 *   «ai-<id>» y las conversaciones.
 * - La BD es la de dev y nada más: la DATABASE_URL sale solo del .env de dev
 *   (nunca de la shell), local, base «botbook» y el puerto del Docker de
 *   dev. Se lee, y solo se escribe para restablecer un negocio de
 *   laboratorio (restablecerPlan de la siembra) antes y después de cada
 *   repetición que reserva o anula en él; esas van de una en una en su
 *   negocio, y así cada una encuentra los huecos libres. El BASE_URL de las
 *   tools no puede ser el de producción.
 * - Las tools las atiende el backend de dev: las reservas, las anulaciones y
 *   los avisos (también el WhatsApp de confirmación al número de la llamada
 *   antigua) ocurren de verdad en dev. Por eso los guiones con `creaCitas`
 *   solo corren con `--con-citas`, que exige además `--si`; el `--dry-run`
 *   enumera los números (enmascarados) que recibirían mensajes. La tool
 *   `transfer` va a un destino inerte. Antes de empezar se comprueba que los
 *   teléfonos que dicta cualquier guion son de ficción y que, en los
 *   negocios de laboratorio, las llamadas que reservan tienen un número de
 *   cliente de laboratorio y el negocio sigue sin número de Telnyx propio:
 *   nada sale a un número real.
 * - Los guiones de chat usan una conversación de WhatsApp antigua del negocio
 *   (Call `whatsapp:chat:<id>`), no una llamada: el backend decide el canal
 *   por ese prefijo. Sin ninguna, se saltan con un aviso.
 *
 * Uso (con TELNYX_API_KEY y BASE_URL del .env de dev en el entorno, o se
 * leen del .env del checkout principal):
 *   npx tsx scripts/laboratorioDePrompt.ts [--negocio <businessId>] \
 *     [--n 10] [--escenarios E1,E3] [--variantes control,v2] \
 *     [--negocio-de E4=<id>,E18=<id>] [--salida <dir>] [--juez [modelo]] \
 *     [--cliente reactivo|guion] [--modelo-cliente <modelo>] \
 *     [--comparar-con <carpeta de otro informe>] [--etiqueta <texto>] \
 *     [--paralelo 3] [--con-citas] [--lista-de-espera si|no|auto] \
 *     [--dry-run] [--si]
 * Con más de 300 turnos o con `--con-citas` hace falta `--si`. `--dry-run` no
 * llama a Telnyx: construye los payloads y cuenta lo que haría, con el
 * negocio y el modo de cliente de cada escenario.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";
import {
  telnyxAiAdapter,
  type CreateTelnyxAssistantInput,
  type TelnyxConversationMessage,
} from "../src/adapters/telnyx/TelnyxAiAdapter.js";
import { cargarEnv, urlDeBdDeDev } from "../mcp/entorno.js";
import { normalizarTelefono as normalizarTelefonoDictado } from "../src/lib/phone.js";
import {
  ESCENARIOS,
  topeDeTurnos,
  todosLosGuiones,
  type Ambito,
  type Comprobacion,
  type DatosDelCliente,
  type Escenario,
  type Guion,
  type IdiomaDeLaBateria,
} from "./laboratorioDePrompt.escenarios.js";
import {
  ESCENARIOS_NO_DISPONIBLES,
  NEGOCIO_POR_ESCENARIO,
  NEGOCIOS_DE_LABORATORIO,
  PREFIJO_DEL_NOMBRE_DE_LABORATORIO,
  TELEFONOS_DE_CLIENTE_DE_LABORATORIO,
  TELEFONOS_DE_TRANSFERENCIA_DE_LABORATORIO,
  exigirBaseDeDatosDeDev,
  type NegocioDeLaboratorio,
} from "./laboratorioDePrompt.negocios.js";

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

/** El cliente reactivo también es un modelo barato alojado por Telnyx y
 * distinto del del assistant: por defecto, el mismo cliente que el juez. */
export const MODELO_DEL_CLIENTE = MODELO_DEL_JUEZ;

/** Cómo se genera lo que dice el cliente. */
export const MODOS_DE_CLIENTE = ["reactivo", "guion"] as const;
export type ModoDeCliente = (typeof MODOS_DE_CLIENTE)[number];

/** Voz Ultra cualquiera: el chat no habla, pero el payload la exige. */
const VOZ_DEL_LABORATORIO = "Telnyx.Ultra.538a8872-3799-4df5-b373-b78493b766c6";

/** Destino de la tool `transfer` en el laboratorio: ninguna prueba por chat
 * puede hacer sonar el móvil del dueño. Telnyx exige un teléfono o una URI
 * SIP válidos (+34000000000 lo rechaza con 10015); `.invalid` es un dominio
 * reservado que nunca resuelve (RFC 6761). */
export const DESTINO_INERTE_DE_TRANSFERENCIA =
  "sip:laboratorio@alhabla.invalid";

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
  /** Fuerza un negocio para todos los guiones; null = el de laboratorio de
   * cada escenario. */
  negocio: string | null;
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
  /** Quién habla por el cliente: un LLM con objetivo y datos, o los turnos
   * fijos del guion. */
  cliente: ModoDeCliente;
  /** Modelo del cliente reactivo (distinto del del assistant). */
  modeloDelCliente: string;
  /** Carpeta de otro informe (o su informe.json) con el que comparar. */
  compararCon: string | null;
  /** Nombre libre de esta ejecución, para distinguirla al comparar. */
  etiqueta: string | null;
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
  "cliente",
  "modelo-cliente",
  "comparar-con",
  "etiqueta",
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

  const negocio = valores.get("negocio") ?? null;

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

  const cliente = valores.get("cliente") ?? "reactivo";
  if (!(MODOS_DE_CLIENTE as readonly string[]).includes(cliente)) {
    throw new ErrorDeUso(
      `--cliente es ${MODOS_DE_CLIENTE.join(" o ")}, no «${cliente}»`
    );
  }
  const modeloDelCliente = valores.get("modelo-cliente") ?? MODELO_DEL_CLIENTE;
  if (modeloDelCliente === MODELO_DEL_ASSISTANT) {
    throw new ErrorDeUso(
      `--modelo-cliente no puede ser el del assistant (${MODELO_DEL_ASSISTANT}): el cliente tiene que ser otro modelo`
    );
  }

  return {
    ayuda,
    negocio,
    negociosPorEscenario,
    n: numero("n", 10, 1, 200),
    escenarios,
    variantes: [...new Set(variantes)] as NombreDeVariante[],
    salida: resolve(valores.get("salida") ?? SALIDA_POR_DEFECTO),
    dryRun: sueltas.has("dry-run"),
    si: sueltas.has("si"),
    juez,
    paralelo: numero("paralelo", 3, 1, 10),
    conCitas: sueltas.has("con-citas"),
    listaDeEspera: listaDeEspera as Opciones["listaDeEspera"],
    cliente: cliente as ModoDeCliente,
    modeloDelCliente,
    compararCon: valores.get("comparar-con") ?? null,
    etiqueta: valores.get("etiqueta") ?? null,
  };
}

export const AYUDA = `Laboratorio de prompt (PLAN-PROMPT-DINAMICO.md, F0)

  npx tsx scripts/laboratorioDePrompt.ts [opciones]

  Por defecto cada escenario corre con su negocio de laboratorio
  (laboratorioDePrompt.negocios.ts); el que no tiene negocio se salta.
  --negocio <id>            fuerza este negocio de dev para todos los guiones
  --negocio-de E4=<id>,...  otro negocio para un escenario o un guion
  --cliente reactivo|guion  reactivo (por defecto): un LLM hace de cliente con
                            el objetivo y los datos del guion; guion: turnos
                            fijos, para reproducir una conversación exacta
  --modelo-cliente <modelo> modelo del cliente reactivo (por defecto ${MODELO_DEL_CLIENTE});
                            no puede ser el del assistant
  --comparar-con <carpeta>  carpeta de otro informe: compara cada variante con
                            la misma variante de esa ejecución
  --etiqueta <texto>        nombre de esta ejecución en el informe
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
 * La `DATABASE_URL` de dev vista desde el Mac, o error si no es la BD de dev:
 * local (la regla de mcp/entorno.ts, `urlDeBdDeDev`), base «botbook» y el
 * puerto del Docker de dev. Cualquier Postgres en localhost pasaría la
 * primera (el de Homebrew, un Cloud SQL Auth Proxy de producción…), y el
 * laboratorio restablece los negocios de laboratorio entre repeticiones.
 */
export function exigirBdLocal(url: string | undefined): string {
  if (!url) throw new Error("[Laboratorio] Falta DATABASE_URL");
  let local: string;
  try {
    local = urlDeBdDeDev({ DATABASE_URL: url });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    throw new Error(`[Laboratorio] ${mensaje.replace(/^\[MCP\]\s*/, "")}`);
  }
  exigirBaseDeDatosDeDev(local);
  return local;
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

/** Los negocios de laboratorio y qué negocio usa cada escenario o guion. */
export interface CatalogoDeNegocios {
  negocios: readonly NegocioDeLaboratorio[];
  /** Id de escenario («E1») o clave de guion («E5a») → clave del negocio. */
  porEscenario: Readonly<Record<string, string>>;
  /** Los móviles de cliente sembrados: los únicos a los que pueden llegar
   * mensajes en un negocio de laboratorio. */
  telefonosDeCliente: readonly string[];
  /** Guion → por qué no se puede preparar con un negocio de laboratorio. */
  noDisponibles?: Readonly<Record<string, string>>;
}

export const CATALOGO_POR_DEFECTO: CatalogoDeNegocios = {
  negocios: NEGOCIOS_DE_LABORATORIO,
  porEscenario: NEGOCIO_POR_ESCENARIO,
  telefonosDeCliente: TELEFONOS_DE_CLIENTE_DE_LABORATORIO,
  noDisponibles: ESCENARIOS_NO_DISPONIBLES,
};

export interface Tarea {
  guion: Guion;
  escenarioId: string;
  variante: NombreDeVariante;
  repeticion: number;
  negocioId: string;
  /** `elegido`: lo pidió quien lanza el laboratorio (`--negocio`,
   * `--negocio-de`) y un fallo es un error; `laboratorio`: el de la
   * siembra, y si no está disponible el guion se salta con un aviso. */
  negocioOrigen: "elegido" | "laboratorio";
}

export interface GuionSaltado {
  guion: Guion;
  motivo: string;
}

export interface Plan {
  /** Los guiones que tienen negocio. */
  guiones: Guion[];
  tareas: Tarea[];
  negocios: string[];
  /** Guiones seleccionados que se saltan, y por qué. */
  saltados: GuionSaltado[];
  /** Turnos de chat como mucho: los del guion o, con el cliente reactivo,
   * el tope de cada guion. */
  turnosTotales: number;
  /** Repeticiones que recorren una reserva o una anulación. */
  repeticionesConCitas: number;
}

function escenarioDe(guion: Guion): Escenario {
  return ESCENARIOS.find((escenario) =>
    escenario.guiones.some((g) => g.clave === guion.clave)
  )!;
}

/** Los turnos del cliente que puede llegar a gastar un guion. */
export function turnosMaximosDelGuion(
  guion: Guion,
  cliente: ModoDeCliente
): number {
  return cliente === "guion" ? guion.turnos.length : topeDeTurnos(guion);
}

/** Qué negocio corre un guion, y por qué vía, o null si no tiene ninguno. */
export function negocioDelGuion(
  guion: Guion,
  opciones: Pick<Opciones, "negocio" | "negociosPorEscenario">,
  catalogo: CatalogoDeNegocios
): { id: string; origen: Tarea["negocioOrigen"] } | { motivo: string } {
  const escenarioId = escenarioDe(guion).id;
  const elegido =
    opciones.negociosPorEscenario[guion.clave] ??
    opciones.negociosPorEscenario[escenarioId] ??
    opciones.negocio;
  if (elegido) return { id: elegido, origen: "elegido" };

  const clave =
    catalogo.porEscenario[guion.clave] ?? catalogo.porEscenario[escenarioId];
  if (!clave) {
    const razon =
      catalogo.noDisponibles?.[guion.clave] ??
      catalogo.noDisponibles?.[escenarioId];
    return {
      motivo: razon
        ? `no se puede preparar en el laboratorio (usa --negocio-de ${guion.clave}=<id> si tienes uno): ${razon}`
        : `no hay negocio de laboratorio para ${guion.clave} (usa --negocio-de ${escenarioId}=<id> o --negocio)`,
    };
  }
  const negocio = catalogo.negocios.find((n) => n.clave === clave);
  if (!negocio) {
    return {
      motivo: `el negocio de laboratorio «${clave}» de ${guion.clave} no existe en el catálogo`,
    };
  }
  return { id: negocio.id, origen: "laboratorio" };
}

export function planificar(
  opciones: Opciones,
  catalogo: CatalogoDeNegocios = CATALOGO_POR_DEFECTO
): Plan {
  const seleccion = opciones.escenarios;
  const seleccionados = todosLosGuiones().filter((guion) => {
    if (!opciones.conCitas && guion.creaCitas) return false;
    if (!seleccion) return true;
    return (
      seleccion.includes(guion.clave) ||
      seleccion.includes(escenarioDe(guion).id)
    );
  });

  const guiones: Guion[] = [];
  const saltados: GuionSaltado[] = [];
  const tareas: Tarea[] = [];
  for (const guion of seleccionados) {
    const negocio = negocioDelGuion(guion, opciones, catalogo);
    if ("motivo" in negocio) {
      saltados.push({ guion, motivo: negocio.motivo });
      continue;
    }
    guiones.push(guion);
    const escenarioId = escenarioDe(guion).id;
    // Las variantes de una repetición seguidas: corren en condiciones
    // parecidas y la comparación no depende de la hora.
    for (let repeticion = 1; repeticion <= opciones.n; repeticion++) {
      for (const variante of opciones.variantes) {
        tareas.push({
          guion,
          escenarioId,
          variante,
          repeticion,
          negocioId: negocio.id,
          negocioOrigen: negocio.origen,
        });
      }
    }
  }

  return {
    guiones,
    tareas,
    negocios: [...new Set(tareas.map((tarea) => tarea.negocioId))],
    saltados,
    turnosTotales: tareas.reduce(
      (suma, t) => suma + turnosMaximosDelGuion(t.guion, opciones.cliente),
      0
    ),
    repeticionesConCitas: tareas.filter((t) => t.guion.creaCitas).length,
  };
}

/** Falla si el plan pasa del tope, o reserva citas, y no se pasó `--si`. */
export function exigirConfirmacion(plan: Plan, opciones: Opciones): void {
  if (opciones.si) return;
  if (plan.turnosTotales > TOPE_DE_TURNOS_SIN_CONFIRMAR) {
    throw new ErrorDeUso(
      `Va a hacer hasta ${plan.turnosTotales} turnos de chat (más de ${TOPE_DE_TURNOS_SIN_CONFIRMAR}); añade --si para seguir o baja --n / --escenarios`
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

/** El turno de la primera llamada a alguna de estas tools, si la hubo. */
function primerTurnoDeLlamada(
  conversacion: Conversacion,
  herramientas: string[]
): number | undefined {
  const turnos = conversacion.llamadas
    .filter((llamada) => herramientas.includes(llamada.nombre))
    .map((llamada) => llamada.turno);
  return turnos.length === 0 ? undefined : Math.min(...turnos);
}

/** Los números de los turnos de la recepcionista que entran en el ámbito. */
export function turnosDelAmbito(
  conversacion: Conversacion,
  ambito: Ambito
): number[] {
  let turnos = conversacion.turnos.map((t) => t.turno);
  if (ambito.turno !== undefined) {
    turnos = turnos.filter((t) => t === ambito.turno);
  }
  if (ambito.ultimo) {
    const ultimo = conversacion.turnos.at(-1)?.turno;
    turnos = turnos.filter((t) => t === ultimo);
  }
  if (ambito.salvoUltimo) {
    const ultimo = conversacion.turnos.at(-1)?.turno;
    turnos = turnos.filter((t) => t !== ultimo);
  }
  if (ambito.despuesDe) {
    const desde = primerTurnoDeLlamada(conversacion, ambito.despuesDe);
    turnos = desde === undefined ? [] : turnos.filter((t) => t > desde);
  }
  if (ambito.antesDe) {
    const hasta = primerTurnoDeLlamada(conversacion, ambito.antesDe);
    if (hasta !== undefined) turnos = turnos.filter((t) => t < hasta);
  }
  return turnos;
}

function llamadasDe(
  conversacion: Conversacion,
  herramientas: string[],
  ambito: Ambito = {}
): LlamadaAHerramienta[] {
  const turnos = new Set(turnosDelAmbito(conversacion, ambito));
  return conversacion.llamadas.filter(
    (llamada) =>
      herramientas.includes(llamada.nombre) && turnos.has(llamada.turno)
  );
}

function turnosEnAmbito(
  conversacion: Conversacion,
  ambito: Ambito = {}
): TurnoRegistrado[] {
  const turnos = new Set(turnosDelAmbito(conversacion, ambito));
  return conversacion.turnos.filter((t) => turnos.has(t.turno));
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

/** Dónde se mira, para el detalle de un fallo. */
function enAmbito(ambito: Ambito): string {
  const partes: string[] = [];
  if (ambito.turno !== undefined) partes.push(`en el turno ${ambito.turno}`);
  if (ambito.ultimo) partes.push("en el último turno");
  if (ambito.salvoUltimo) partes.push("antes del último turno");
  if (ambito.despuesDe) {
    partes.push(`después de ${ambito.despuesDe.join("/")}`);
  }
  if (ambito.antesDe) partes.push(`antes de ${ambito.antesDe.join("/")}`);
  return partes.length === 0 ? "en la conversación" : partes.join(" y ");
}

function ambitoDe(comprobacion: Ambito): Ambito {
  return {
    ...(comprobacion.turno !== undefined ? { turno: comprobacion.turno } : {}),
    ...(comprobacion.despuesDe ? { despuesDe: comprobacion.despuesDe } : {}),
    ...(comprobacion.antesDe ? { antesDe: comprobacion.antesDe } : {}),
    ...(comprobacion.ultimo ? { ultimo: true } : {}),
    ...(comprobacion.salvoUltimo ? { salvoUltimo: true } : {}),
  };
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
      const ambito = ambitoDe(comprobacion);
      const veces = llamadasDe(
        conversacion,
        comprobacion.herramientas,
        ambito
      ).length;
      const minimo = comprobacion.minimo ?? 1;
      const maximo = comprobacion.maximo ?? Infinity;
      return resultado(
        veces >= minimo && veces <= maximo,
        `${comprobacion.herramientas.join("/")} se llamó ${veces} veces ${enAmbito(ambito)}`
      );
    }
    case "noLlama": {
      const llamadas = llamadasDe(
        conversacion,
        comprobacion.herramientas,
        ambitoDe(comprobacion)
      );
      return resultado(
        llamadas.length === 0,
        `llamó a ${llamadas.map((l) => `${l.nombre} (turno ${l.turno})`).join(", ")}`
      );
    }
    case "llamaAntesDelTexto": {
      const llamadas = llamadasDe(conversacion, comprobacion.herramientas, {
        turno: comprobacion.turno,
      });
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
      const esperado = String(comprobacion.esperado);
      const antes = conversacion.llamadas.slice(
        0,
        conversacion.llamadas.indexOf(ultima)
      );
      const enUnaAnterior = antes.some(
        (llamada) =>
          comprobacion.oAntesEn?.includes(llamada.nombre) &&
          valorComoTexto(llamada.argumentos[comprobacion.campo]) === esperado
      );
      return resultado(
        valorComoTexto(real) === esperado || enUnaAnterior,
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
      const alcance = ambitoDe(comprobacion);
      const ambito = turnosEnAmbito(conversacion, alcance);
      const modo = comprobacion.modo ?? "alguno";
      const casa = (turno: TurnoRegistrado) =>
        modo === "todos"
          ? comprobacion.patrones.every((p) => coincide(p, turno.respuesta))
          : comprobacion.patrones.some((p) => coincide(p, turno.respuesta));
      if (comprobacion.debe) {
        return resultado(
          ambito.some(casa),
          `no aparece ${comprobacion.patrones.join(" | ")} ${enAmbito(alcance)}` +
            (ambito.length === 0 ? " (no hay turnos en ese ámbito)" : "")
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
      const largos = turnosEnAmbito(
        conversacion,
        ambitoDe(comprobacion)
      ).filter((turno) => turno.respuesta.length > comprobacion.caracteres);
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
// Cliente simulado
// ---------------------------------------------------------------------------

const NOMBRE_DEL_IDIOMA: Record<IdiomaDeLaBateria, string> = {
  es: "castellano",
  ca: "catalán",
  en: "inglés",
};

/** Lo que dice el cliente cuando no sabe lo que le piden. */
const NO_SE: Record<IdiomaDeLaBateria, string> = {
  es: "No lo sé, perdona.",
  ca: "No ho sé, perdona.",
  en: "I don't know, sorry.",
};

/** Lo que dice si el LLM quiere terminar antes de su frase obligatoria. */
const SEGUIR: Record<IdiomaDeLaBateria, string> = {
  es: "Sí, dime.",
  ca: "Sí, digues.",
  en: "Yes, go on.",
};

const TEMPERATURA_DEL_CLIENTE = 0.4;
const MAX_CARACTERES_DEL_CLIENTE = 400;

/** Lo que el cliente simulado sabe de sí mismo, una línea por dato. */
export function describirDatosDelCliente(datos: DatosDelCliente): string[] {
  return [
    `Idioma en el que hablas: ${NOMBRE_DEL_IDIOMA[datos.idioma]}`,
    ...(datos.servicio ? [`Servicio que quieres: ${datos.servicio}`] : []),
    ...(datos.dia ? [`Día: ${datos.dia}`] : []),
    ...(datos.hora ? [`Hora: ${datos.hora}`] : []),
    ...(datos.nombre ? [`Tu nombre: ${datos.nombre}`] : []),
    ...(datos.telefonos?.length
      ? [`Teléfonos que puedes decir: ${datos.telefonos.join("; ")}`]
      : []),
    ...(datos.otros ?? []),
  ];
}

export function instruccionesDelCliente(
  guion: Guion,
  opciones: { pendientes: boolean }
): string {
  const idioma = NOMBRE_DEL_IDIOMA[guion.datos.idioma];
  return [
    "Haces de CLIENTE de un negocio español en una conversación con su recepcionista de IA (por teléfono o por WhatsApp). " +
      "Tú eres el cliente: nunca hables como recepcionista ni ofrezcas información del negocio.",
    "",
    `Tu objetivo: ${guion.objetivo}`,
    "",
    "Lo único que sabes de ti:",
    ...describirDatosDelCliente(guion.datos).map((linea) => `- ${linea}`),
    "",
    "Reglas:",
    `1. Contesta en una sola frase corta, en ${idioma}, como hablaría una persona de verdad.`,
    "2. Contesta a lo que te preguntan ahora; no adelantes datos que no te han pedido, salvo que tu objetivo lo diga.",
    "3. No inventes ningún dato (nombre, teléfono, servicio, día, hora...) que no esté en lo que sabes. Si te piden algo que no sabes, di que no lo sabes o que te da igual.",
    "4. Termina cuando tu objetivo esté cumplido, o cuando la recepcionista se haya despedido o haya colgado.",
    ...(opciones.pendientes
      ? [
          "5. Todavía no has terminado: más adelante tienes algo importante que decir. No termines todavía.",
        ]
      : []),
    "",
    'Devuelve SOLO un JSON: {"mensaje":"lo que dices ahora","fin":false}.',
    '"fin" es true cuando, con este mensaje, tu objetivo queda cumplido (puede ser tu despedida). ' +
      'Si ya no te queda nada por decir, pon "mensaje":"" y "fin":true.',
  ].join("\n");
}

export function transcripcionParaElCliente(
  historial: Array<{ cliente: string; respuesta: string }>,
  saludo: string
): string {
  return [
    ...(saludo ? [`RECEPCIONISTA: ${saludo}`] : []),
    ...historial.flatMap((turno) => [
      `CLIENTE (tú): ${turno.cliente}`,
      `RECEPCIONISTA: ${turno.respuesta.trim() || "(sin texto)"}`,
    ]),
  ].join("\n");
}

const DecisionDelLlm = z.object({
  mensaje: z.string().optional().default(""),
  fin: z.boolean().optional().default(false),
});

/**
 * Lo que contestó el LLM del cliente: un JSON {mensaje, fin}, o (si el modelo
 * se salta el formato) la frase suelta. null si no hay nada utilizable.
 */
export function leerDecisionDelCliente(
  texto: string
): { mensaje: string; fin: boolean } | null {
  const sinPensar = texto.replace(/<think>[\s\S]*?<\/think>/gi, "");
  const inicio = sinPensar.indexOf("{");
  const fin = sinPensar.lastIndexOf("}");
  if (inicio >= 0 && fin > inicio) {
    try {
      const analizada = DecisionDelLlm.safeParse(
        JSON.parse(sinPensar.slice(inicio, fin + 1))
      );
      if (analizada.success) {
        return {
          mensaje: analizada.data.mensaje.trim(),
          fin: analizada.data.fin,
        };
      }
    } catch {
      // Sigue: puede ser una frase con llaves.
    }
    return null;
  }
  // Una llave sin cerrar: un JSON cortado, no una frase.
  if (inicio >= 0) return null;
  const suelto = sinPensar
    .replace(/^\s*(?:cliente|tú|you)\s*(?:\([^)]*\))?\s*[:：]\s*/i, "")
    .replace(/^["«“]+|["»”]+$/g, "")
    .trim();
  return suelto ? { mensaje: suelto, fin: false } : null;
}

const PRESENTACIONES =
  /(?:[Mm]e llamo|[Mm]i nombre es|[Ss]oy|[Mm]y name is|I'm|I am|[Ee]m dic|[Ss]óc)\s+(\p{Lu}\p{L}+)/gu;

/**
 * Datos que el cliente simulado no tiene y que sí se pueden comprobar sin un
 * LLM: teléfonos que no están en sus datos y nombres con los que se presenta
 * (o «me llamo X») distintos del suyo.
 */
export function datosInventados(
  mensaje: string,
  datos: DatosDelCliente
): string[] {
  const motivos: string[] = [];
  const permitidos = (datos.telefonos ?? []).map(normalizarTelefono);
  for (const telefono of telefonosDelTexto(mensaje)) {
    if (!permitidos.includes(telefono)) motivos.push(`el teléfono ${telefono}`);
  }
  for (const presentacion of mensaje.matchAll(PRESENTACIONES)) {
    const nombre = presentacion[1]!;
    if (nombre.toLowerCase() !== datos.nombre?.toLowerCase()) {
      motivos.push(`el nombre ${nombre}`);
    }
  }
  return motivos;
}

/** Por qué terminó el cliente. */
export type FinDelCliente = "objetivo" | "tope" | "guion";

/**
 * ¿Alguna comprobación del guion mira el último turno (`ultimo`) o lo deja
 * fuera (`salvoUltimo`)? Entonces ese turno tiene que ser la respuesta a la
 * despedida del cliente: si el cliente reactivo termina callado, o el tope
 * corta a mitad, el último turno sería otro y la comprobación fallaría sin
 * culpa del prompt.
 */
export function exigeDespedida(guion: Guion): boolean {
  return guion.comprobaciones.some(
    (comprobacion) =>
      ("ultimo" in comprobacion && comprobacion.ultimo === true) ||
      ("salvoUltimo" in comprobacion && comprobacion.salvoUltimo === true)
  );
}

const PARECE_DESPEDIDA =
  /adi[oó]s|ad[eé]u|agur|goodbye|\bbye\b|hasta luego|hasta pronto|nada m[aá]s|res m[eé]s|nothing else/iu;

/** ¿Suena a despedida este mensaje del cliente? */
export function pareceDespedida(mensaje: string): boolean {
  return PARECE_DESPEDIDA.test(mensaje);
}

export interface DecisionDelCliente {
  /** Lo que dice; null = no dice nada más y la conversación acaba. */
  mensaje: string | null;
  /** Tras este mensaje (y la respuesta a él) no hay más turnos. */
  fin: boolean;
  motivoDelFin?: FinDelCliente;
  /** Cosas raras del cliente simulado, para el informe. */
  avisos: string[];
  /** Cuántas veces se llamó al LLM del cliente. */
  llamadasAlLlm: number;
}

export interface MensajeDeChat {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface EntradaDelCliente {
  guion: Guion;
  modo: ModoDeCliente;
  /** El mensaje que toca escribir (1 = el primero). */
  turno: number;
  historial: Array<{ cliente: string; respuesta: string }>;
  saludo: string;
  modelo: string;
  completar: (input: {
    modelo: string;
    temperatura: number;
    mensajes: MensajeDeChat[];
  }) => Promise<string>;
}

/**
 * El siguiente mensaje del cliente. En el modo `guion`, el turno fijo. En el
 * reactivo, el primer mensaje del guion y las frases obligatorias tal cual,
 * y el resto lo pone el LLM del cliente con el objetivo y los datos; cortando
 * al cumplirse el objetivo o a los `maxTurnos`. Un mensaje con datos que el
 * cliente no tiene se pide de nuevo una vez; si insiste, dice que no lo sabe.
 */
export async function siguienteMensajeDelCliente(
  entrada: EntradaDelCliente
): Promise<DecisionDelCliente> {
  const { guion, turno } = entrada;
  const sinLlm = { avisos: [], llamadasAlLlm: 0 };

  if (entrada.modo === "guion") {
    const mensaje = guion.turnos[turno - 1];
    if (mensaje === undefined) {
      return { mensaje: null, fin: true, motivoDelFin: "guion", ...sinLlm };
    }
    const ultimo = turno >= guion.turnos.length;
    return {
      mensaje,
      fin: ultimo,
      ...(ultimo ? { motivoDelFin: "guion" as const } : {}),
      ...sinLlm,
    };
  }

  const tope = topeDeTurnos(guion);
  if (turno > tope) {
    return { mensaje: null, fin: true, motivoDelFin: "tope", ...sinLlm };
  }
  const cierraPorTope = turno >= tope;
  const literal =
    turno === 1
      ? guion.turnos[0]
      : guion.frasesObligatorias?.find((frase) => frase.turno === turno)?.frase;
  if (literal !== undefined) {
    return {
      mensaje: literal,
      fin: cierraPorTope,
      ...(cierraPorTope ? { motivoDelFin: "tope" as const } : {}),
      ...sinLlm,
    };
  }

  const pendientes = (guion.frasesObligatorias ?? []).some(
    (frase) => frase.turno > turno
  );
  const avisos: string[] = [];
  let llamadasAlLlm = 0;
  const mensajes: MensajeDeChat[] = [
    { role: "system", content: instruccionesDelCliente(guion, { pendientes }) },
    {
      role: "user",
      content:
        `Conversación hasta ahora:\n${transcripcionParaElCliente(entrada.historial, entrada.saludo)}\n\n` +
        `Escribe tu mensaje número ${turno} (como mucho ${tope}).` +
        (cierraPorTope ? " Es el último: cierra la conversación." : ""),
    },
  ];
  const preguntar = async () => {
    llamadasAlLlm++;
    const respuesta = await entrada.completar({
      modelo: entrada.modelo,
      temperatura: TEMPERATURA_DEL_CLIENTE,
      mensajes,
    });
    return { respuesta, decision: leerDecisionDelCliente(respuesta) };
  };

  let { respuesta, decision } = await preguntar();
  if (!decision) {
    mensajes.push(
      { role: "assistant", content: respuesta },
      {
        role: "user",
        content:
          'Tu respuesta no era un JSON {"mensaje":"...","fin":true|false}. Contesta de nuevo solo con el JSON.',
      }
    );
    ({ respuesta, decision } = await preguntar());
  }
  if (!decision) {
    throw new Error(
      "[Laboratorio] el cliente simulado no devolvió un mensaje válido"
    );
  }

  const inventados = datosInventados(decision.mensaje, guion.datos);
  if (inventados.length > 0) {
    mensajes.push(
      { role: "assistant", content: respuesta },
      {
        role: "user",
        content: `Has dicho datos que no sabes (${inventados.join(", ")}). Contesta de nuevo sin inventar nada: si no lo sabes, dilo.`,
      }
    );
    ({ decision } = await preguntar());
    const otraVez = decision
      ? datosInventados(decision.mensaje, guion.datos)
      : inventados;
    if (!decision || otraVez.length > 0) {
      avisos.push(
        `El cliente simulado insistió en datos que no tiene (${(otraVez.length > 0 ? otraVez : inventados).join(", ")}); se cambió por «no lo sé»`
      );
      decision = { mensaje: NO_SE[guion.datos.idioma], fin: false };
    }
  }

  let { mensaje, fin } = decision;
  const despedida = exigeDespedida(guion) ? guion.turnos.at(-1) : undefined;
  if (despedida !== undefined) {
    const ultimoDelCliente = entrada.historial.at(-1)?.cliente ?? "";
    if (!mensaje && !pareceDespedida(ultimoDelCliente)) {
      // Quiere terminar sin haberse despedido: se despide con la frase del
      // guion, que es la que miran las comprobaciones del último turno.
      mensaje = despedida;
      fin = true;
      avisos.push(
        "El cliente simulado terminó sin despedirse; se usó la despedida del guion"
      );
    } else if (mensaje && !pareceDespedida(mensaje)) {
      if (cierraPorTope) {
        avisos.push(
          "El tope de turnos llegó sin despedida; el último mensaje es la despedida del guion"
        );
        mensaje = despedida;
      } else if (fin) {
        // Cumplió el objetivo pero aún no se ha despedido: un turno más.
        fin = false;
      }
    }
  }
  if (fin && pendientes) {
    // Le queda una frase obligatoria por decir: no puede terminar todavía.
    fin = false;
    if (!mensaje) {
      mensaje = SEGUIR[guion.datos.idioma];
      avisos.push(
        "El cliente simulado quiso terminar antes de su frase obligatoria"
      );
    }
  }
  if (!mensaje) {
    // Sin nada más que decir: el objetivo está cumplido.
    return {
      mensaje: null,
      fin: true,
      motivoDelFin: "objetivo",
      avisos,
      llamadasAlLlm,
    };
  }
  const termina = fin || cierraPorTope;
  return {
    mensaje: mensaje.slice(0, MAX_CARACTERES_DEL_CLIENTE),
    fin: termina,
    ...(termina
      ? { motivoDelFin: fin ? ("objetivo" as const) : ("tope" as const) }
      : {}),
    avisos,
    llamadasAlLlm,
  };
}

// ---------------------------------------------------------------------------
// Resultados y veredicto
// ---------------------------------------------------------------------------

/** La repetición de un negocio cuyo assistant no se pudo crear: error de
 * ejecución, no del prompt. */
export function resultadoSinAssistant(
  tarea: Pick<Tarea, "repeticion">,
  llamadaUsada: string,
  motivo: string
): ResultadoDeRepeticion {
  return {
    repeticion: tarea.repeticion,
    llamadaUsada,
    error: motivo,
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
      turnos: 0,
      caracteresDeTools: 0,
      latenciaMediaPorTurnoMs: 0,
    },
  };
}

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
  /** Por qué dejó de escribir el cliente simulado. */
  terminoElCliente?: FinDelCliente;
  metricas: {
    llamadasAHerramientas: number;
    getCatalog: number;
    caracteresDeRespuestas: number;
    duracionMs: number;
    /** Mensajes del cliente (= turnos de la recepcionista). */
    turnos: number;
    /** Caracteres de las respuestas de las tools: se quedan en el historial. */
    caracteresDeTools: number;
    /** Media de lo que tardó el chat en contestar cada turno. */
    latenciaMediaPorTurnoMs: number;
  };
}

export interface FalloDeComprobacion {
  descripcion: string;
  fallos: number;
}

export interface ResumenDeCelda {
  guion: string;
  escenario: string;
  regla: "dura" | "normal";
  variante: NombreDeVariante;
  total: number;
  ok: number;
  fallos: number;
  /** Fallos de ejecución (Telnyx, tiempo...), aparte de los del prompt. */
  errores: number;
  mediaDeHerramientas: number;
  mediaDeGetCatalog: number;
  mediaDeCaracteres: number;
  mediaDeTurnos: number;
  mediaDeCaracteresDeTools: number;
  mediaDeLatenciaPorTurnoMs: number;
  /** Cuántas veces falló cada comprobación, de más a menos. */
  fallosPorComprobacion: FalloDeComprobacion[];
  /** Los primeros mensajes de error de ejecución distintos. */
  mensajesDeError: string[];
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
  const fallosPorDescripcion = new Map<string, number>();
  for (const repeticion of validas) {
    for (const comprobacion of repeticion.comprobaciones) {
      if (comprobacion.ok) continue;
      fallosPorDescripcion.set(
        comprobacion.descripcion,
        (fallosPorDescripcion.get(comprobacion.descripcion) ?? 0) + 1
      );
    }
  }
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
    mediaDeTurnos: media((r) => r.metricas.turnos),
    mediaDeCaracteresDeTools: media((r) => r.metricas.caracteresDeTools),
    mediaDeLatenciaPorTurnoMs: media((r) => r.metricas.latenciaMediaPorTurnoMs),
    fallosPorComprobacion: [...fallosPorDescripcion]
      .map(([descripcion, fallos]) => ({ descripcion, fallos }))
      .sort((a, b) => b.fallos - a.fallos),
    mensajesDeError: [
      ...new Set(
        repeticiones.flatMap((r) => (r.error ? [r.error.slice(0, 200)] : []))
      ),
    ].slice(0, 3),
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
    /** El negocio forzado con --negocio, si lo hubo. */
    negocio: string | null;
    negociosPorEscenario: Record<string, string>;
    /** Guion → negocio con el que corrió (todos los que corrieron). */
    negociosPorGuion: Record<string, string>;
    n: number;
    variantes: NombreDeVariante[];
    juez: string | null;
    /** Cómo se generó lo que dijo el cliente, y con qué modelo. */
    cliente: ModoDeCliente;
    modeloDelCliente: string | null;
    /** Nombre que se le dio a esta ejecución (--etiqueta). */
    etiqueta: string | null;
    /** Turnos de chat como mucho (los del guion o el tope del reactivo). */
    turnosTotales: number;
    /** Guiones que no se corrieron (sin negocio, sin llamadas...). */
    saltados: Array<{ guion: string; motivo: string }>;
    assistants: Array<{
      variante: NombreDeVariante;
      nombre: string;
      id: string;
      negocio?: string;
    }>;
    avisos: string[];
  };
  resumen: ResumenDeCelda[];
  repeticiones: Array<{
    guion: string;
    variante: NombreDeVariante;
    resultados: ResultadoDeRepeticion[];
  }>;
  /** Presente con `--comparar-con`: el resultado frente a la otra ejecución. */
  comparacion?: {
    con: string;
    fecha: string;
    etiqueta: string | null;
    filas: Array<{ guion: string; variante: string; veredicto: string }>;
    sinPareja: string[];
  };
}

function celda(resumen: ResumenDeCelda | undefined): string {
  if (!resumen) return "-";
  const errores = resumen.errores ? ` (+${resumen.errores} err)` : "";
  return `${resumen.ok}/${resumen.ok + resumen.fallos}${errores}`;
}

function linea(columnas: string[]): string {
  return `| ${columnas.join(" | ")} |`;
}

function tabla(cabecera: string[], filas: string[][]): string {
  return [
    linea(cabecera),
    linea(cabecera.map(() => "---")),
    ...filas.map(linea),
  ].join("\n");
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
    "turnos (control)",
    "caracteres de tools (control)",
    "ms/turno (control)",
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
      String(control?.mediaDeTurnos ?? "-"),
      String(control?.mediaDeCaracteresDeTools ?? "-"),
      String(Math.round(control?.mediaDeLatenciaPorTurnoMs ?? 0) || "-"),
    ];
  });
  return tabla(cabecera, filas);
}

/** Todas las cifras de cada guion y variante: aciertos, fallos, errores de
 * ejecución aparte, turnos, tools, caracteres de tools y latencia. */
export function tablaDeMetricas(informe: Informe): string {
  const filas = informe.resumen.map((r) => [
    r.guion,
    r.variante,
    String(r.ok),
    String(r.fallos),
    String(r.errores),
    String(r.mediaDeTurnos),
    String(r.mediaDeHerramientas),
    String(r.mediaDeGetCatalog),
    String(r.mediaDeCaracteres),
    String(r.mediaDeCaracteresDeTools),
    String(Math.round(r.mediaDeLatenciaPorTurnoMs)),
  ]);
  return tabla(
    [
      "Guion",
      "Variante",
      "Aciertos",
      "Fallos",
      "Errores de ejecución",
      "Turnos/conv",
      "Tools/conv",
      "get_catalog/conv",
      "Caracteres de respuestas",
      "Caracteres de tools",
      "ms/turno",
    ],
    filas
  );
}

/** Lo que se lee de otro informe para compararlo: solo meta y resumen. */
export interface InformeAnterior {
  meta: { fecha: string; etiqueta: string | null; variantes: string[] };
  resumen: ResumenDeCelda[];
}

const ResumenGuardado = z
  .object({
    guion: z.string(),
    escenario: z.string().default(""),
    regla: z.enum(["dura", "normal"]).default("normal"),
    variante: z.string(),
    total: z.number().default(0),
    ok: z.number(),
    fallos: z.number(),
    errores: z.number().default(0),
    mediaDeHerramientas: z.number().default(0),
    mediaDeGetCatalog: z.number().default(0),
    mediaDeCaracteres: z.number().default(0),
    mediaDeTurnos: z.number().default(0),
    mediaDeCaracteresDeTools: z.number().default(0),
    mediaDeLatenciaPorTurnoMs: z.number().default(0),
    fallosPorComprobacion: z
      .array(z.object({ descripcion: z.string(), fallos: z.number() }))
      .default([]),
    mensajesDeError: z.array(z.string()).default([]),
  })
  .passthrough();

const InformeGuardado = z.object({
  meta: z
    .object({
      fecha: z.string().default(""),
      etiqueta: z.string().nullable().default(null),
      variantes: z.array(z.string()).default([]),
    })
    .passthrough(),
  resumen: z.array(ResumenGuardado),
});

/** Lee un informe.json guardado (también los de antes de las métricas nuevas). */
export function leerInformeAnterior(contenido: string): InformeAnterior {
  let crudo: unknown;
  try {
    crudo = JSON.parse(contenido);
  } catch {
    throw new ErrorDeUso("--comparar-con: el informe no es un JSON válido");
  }
  const leido = InformeGuardado.safeParse(crudo);
  if (!leido.success) {
    throw new ErrorDeUso(
      "--comparar-con: el JSON no parece un informe del laboratorio (falta meta o resumen)"
    );
  }
  return {
    meta: {
      fecha: leido.data.meta.fecha,
      etiqueta: leido.data.meta.etiqueta,
      variantes: leido.data.meta.variantes,
    },
    resumen: leido.data.resumen as unknown as ResumenDeCelda[],
  };
}

/** La ruta del informe.json de lo que se pasa a --comparar-con. */
export function rutaDelInformeAnterior(ruta: string): string {
  return ruta.endsWith(".json") ? ruta : join(ruta, "informe.json");
}

export interface FilaDeComparacion {
  guion: string;
  regla: "dura" | "normal";
  variante: string;
  actual: ResumenDeCelda;
  anterior: ResumenDeCelda;
  /** Lo de ahora frente a lo de antes, con el criterio del plan. */
  veredicto: ReturnType<typeof veredicto>;
}

export interface Comparacion {
  filas: FilaDeComparacion[];
  /** Guion y variante que solo tiene uno de los dos informes. */
  sinPareja: string[];
}

/** Compara cada guion y variante de este informe con la misma de otro. */
export function compararInformes(
  actual: Pick<Informe, "resumen">,
  anterior: Pick<InformeAnterior, "resumen">
): Comparacion {
  const filas: FilaDeComparacion[] = [];
  const sinPareja: string[] = [];
  for (const ahora of actual.resumen) {
    const antes = anterior.resumen.find(
      (r) => r.guion === ahora.guion && r.variante === ahora.variante
    );
    if (!antes) {
      sinPareja.push(
        `${ahora.guion} ${ahora.variante} (solo en esta ejecución)`
      );
      continue;
    }
    filas.push({
      guion: ahora.guion,
      regla: ahora.regla,
      variante: ahora.variante,
      actual: ahora,
      anterior: antes,
      veredicto: veredicto(antes, ahora),
    });
  }
  for (const antes of anterior.resumen) {
    if (
      !actual.resumen.some(
        (r) => r.guion === antes.guion && r.variante === antes.variante
      )
    ) {
      sinPareja.push(`${antes.guion} ${antes.variante} (solo en la anterior)`);
    }
  }
  return { filas, sinPareja };
}

/** «antes → ahora»; con una flecha de más o menos cuando cambia. */
function cambio(antes: number, ahora: number): string {
  const redondear = (valor: number) => Math.round(valor * 10) / 10;
  return `${redondear(antes)} → ${redondear(ahora)}`;
}

export function tablaDeComparacion(comparacion: Comparacion): string {
  return tabla(
    [
      "Guion",
      "Regla",
      "Variante",
      "Antes (acierto)",
      "Ahora (acierto)",
      "Veredicto (ahora frente a antes)",
      "Errores de ejecución",
      "Tools/conv",
      "get_catalog/conv",
      "Caracteres de tools",
      "ms/turno",
    ],
    comparacion.filas.map((f) => [
      f.guion,
      f.regla,
      f.variante,
      celda(f.anterior),
      celda(f.actual),
      f.veredicto,
      `${f.anterior.errores} → ${f.actual.errores}`,
      cambio(f.anterior.mediaDeHerramientas, f.actual.mediaDeHerramientas),
      cambio(f.anterior.mediaDeGetCatalog, f.actual.mediaDeGetCatalog),
      cambio(
        f.anterior.mediaDeCaracteresDeTools,
        f.actual.mediaDeCaracteresDeTools
      ),
      cambio(
        f.anterior.mediaDeLatenciaPorTurnoMs,
        f.actual.mediaDeLatenciaPorTurnoMs
      ),
    ])
  );
}

export function informeMarkdown(
  informe: Informe,
  comparacion?: {
    contra: InformeAnterior;
    carpeta: string;
    resultado: Comparacion;
  }
): string {
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
  const porComprobacion = informe.resumen.flatMap((r) =>
    r.fallosPorComprobacion.map(
      (f) => `- ${r.guion} ${r.variante}: ${f.fallos} × ${f.descripcion}`
    )
  );
  const conErrores = informe.resumen.filter((r) => r.errores > 0);
  const negocios = [...new Set(Object.values(meta.negociosPorGuion))];
  return [
    `# Laboratorio de prompt ${meta.fecha}${meta.etiqueta ? ` · ${meta.etiqueta}` : ""}`,
    "",
    `${meta.negocio ? `Negocio forzado ${meta.negocio}` : `${negocios.length} negocios de laboratorio`}, n = ${meta.n}, variantes ${meta.variantes.join(", ")}, ` +
      `cliente ${meta.cliente}${meta.modeloDelCliente ? ` (${meta.modeloDelCliente})` : ""}` +
      `${meta.juez ? `, juez ${meta.juez}` : ", sin juez"}. Hasta ${meta.turnosTotales} turnos de chat.`,
    "",
    tablaMarkdown(informe),
    "",
    "## Cifras por guion y variante",
    "",
    tablaDeMetricas(informe),
    ...(comparacion
      ? [
          "",
          `## Comparación con ${comparacion.contra.meta.etiqueta ?? comparacion.carpeta} (${comparacion.contra.meta.fecha})`,
          "",
          comparacion.resultado.filas.length > 0
            ? tablaDeComparacion(comparacion.resultado)
            : "Ningún guion y variante en común.",
          ...(comparacion.resultado.sinPareja.length > 0
            ? [
                "",
                "Sin pareja:",
                ...comparacion.resultado.sinPareja.map((f) => `- ${f}`),
              ]
            : []),
        ]
      : []),
    "",
    "## Fallos por comprobación",
    "",
    ...(porComprobacion.length ? porComprobacion : ["Ninguno."]),
    "",
    "## Primeros fallos (hasta 3 por guion y variante)",
    "",
    ...(fallos.length ? fallos : ["Ninguno."]),
    ...(conErrores.length
      ? [
          "",
          "## Errores de ejecución (no cuentan como fallos del prompt)",
          "",
          ...conErrores.map(
            (r) =>
              `- ${r.guion} ${r.variante}: ${r.errores}${r.mensajesDeError.length ? ` (${r.mensajesDeError.join(" | ")})` : ""}`
          ),
        ]
      : []),
    ...(meta.saltados.length
      ? [
          "",
          "## Guiones saltados (no se corrieron)",
          "",
          ...meta.saltados.map((s) => `- ${s.guion}: ${s.motivo}`),
        ]
      : []),
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

/** Lo que el backend diría al contestar una llamada concreta
 * (lib/contextoDeLlamada.ts): su saludo y las variables del prompt. */
export interface ContextoDeLaLlamada {
  saludo: string;
  variables: Record<string, string>;
}

export interface ContextoDelNegocio {
  negocioId: string;
  nombre: string;
  zonaHoraria: string;
  /** El saludo guardado en el assistant (sin contexto de la llamada). */
  saludo: string;
  /** Por `callId` de las llamadas de voz: el saludo y las variables con que
   * se contestaría esa llamada en producción (cliente conocido, aviso de
   * grabación, negocio nuevo…). Sin entrada, el saludo del assistant. */
  porLlamada?: Record<string, ContextoDeLaLlamada>;
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
 * prefijo `whatsapp:chat:` del callId). Sin llamadas o sin chats, esas tareas
 * se quedan sin Call y no se ejecutan; los avisos lo dicen.
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
    if (deVoz.length > 0 && contexto.llamadas.length === 0) {
      const claves = [...new Set(deVoz.map((t) => t.guion.clave))];
      avisos.push(
        `Negocio ${negocioId}: no tiene llamadas antiguas sin cita; se saltan los guiones de voz (${claves.join(", ")})`
      );
    } else if (deVoz.length > 0) {
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
  /** El contenido de un informe.json guardado (para `--comparar-con`). */
  leerInforme(ruta: string): Promise<string>;
  ahora(): Date;
  dormir(ms: number): Promise<void>;
  log(mensaje: string): void;
  /** Los negocios de laboratorio; por defecto, los sembrados. */
  catalogo?: CatalogoDeNegocios;
  /**
   * Deja un negocio de laboratorio como lo sembró la siembra (citas,
   * recados, permisos de grabación: restablecerPlan de
   * sembrarNegociosDeLaboratorio.ts). Se llama antes y después de cada
   * repetición que reserva o anula en un negocio de laboratorio. Sin él, las
   * citas se acumulan y desde la cuarta reserva del mismo hueco la
   * conversación ya no es la del guion.
   */
  restablecerNegocio?(negocioId: string): Promise<void>;
}

/**
 * Cerrojos de lectura y escritura por negocio: una repetición que reserva o
 * anula (y restablece el negocio antes y después) va sola en su negocio; las
 * de solo lectura van juntas entre ellas. En orden de llegada, así que una
 * que reserva no espera para siempre.
 */
export function crearCerrojosPorNegocio() {
  interface Estado {
    lectores: number;
    escritor: boolean;
    cola: Array<{ exclusivo: boolean; despertar: () => void }>;
  }
  const estados = new Map<string, Estado>();
  const estadoDe = (id: string): Estado => {
    let estado = estados.get(id);
    if (!estado) {
      estado = { lectores: 0, escritor: false, cola: [] };
      estados.set(id, estado);
    }
    return estado;
  };
  const puede = (estado: Estado, exclusivo: boolean) =>
    exclusivo ? !estado.escritor && estado.lectores === 0 : !estado.escritor;
  const tomar = (estado: Estado, exclusivo: boolean) => {
    if (exclusivo) estado.escritor = true;
    else estado.lectores++;
  };
  return {
    async con<T>(
      negocioId: string,
      exclusivo: boolean,
      trabajo: () => Promise<T>
    ): Promise<T> {
      const estado = estadoDe(negocioId);
      if (estado.cola.length === 0 && puede(estado, exclusivo)) {
        tomar(estado, exclusivo);
      } else {
        await new Promise<void>((despertar) =>
          estado.cola.push({ exclusivo, despertar })
        );
      }
      try {
        return await trabajo();
      } finally {
        if (exclusivo) estado.escritor = false;
        else estado.lectores--;
        while (
          estado.cola.length > 0 &&
          puede(estado, estado.cola[0]!.exclusivo)
        ) {
          const siguiente = estado.cola.shift()!;
          tomar(estado, siguiente.exclusivo);
          siguiente.despertar();
        }
      }
    },
  };
}

/**
 * El negocio no existe (o no es utilizable) en la BD de dev. Con un negocio
 * de laboratorio es un aviso y sus guiones se saltan; con uno elegido a mano,
 * un error.
 */
export class NegocioNoDisponible extends Error {}

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

export function esPlazoAgotado(error: unknown): boolean {
  return /timed? ?out/i.test(mensajeDeError(error));
}

/**
 * Reintenta los 429 de Telnyx. Con `tambienPlazo`, también un plazo agotado:
 * solo para lo que se puede repetir sin efectos (el cliente simulado y el
 * juez); repetir un turno del assistant duplicaría el mensaje del cliente.
 */
async function conReintentos<T>(
  deps: Pick<DependenciasDelLaboratorio, "dormir">,
  accion: () => Promise<T>,
  { tambienPlazo = false }: { tambienPlazo?: boolean } = {}
): Promise<T> {
  for (let intento = 1; ; intento++) {
    try {
      return await accion();
    } catch (error) {
      const reintentable =
        esLimiteDeTelnyx(error) || (tambienPlazo && esPlazoAgotado(error));
      if (!reintentable || intento >= 4) throw error;
      await deps.dormir(2_000 * intento);
    }
  }
}

/** Dice en qué paso falló: el cliente simulado o el assistant. */
async function enElPaso<T>(paso: string, accion: () => Promise<T>): Promise<T> {
  try {
    return await accion();
  } catch (error) {
    throw new Error(`${paso}: ${mensajeDeError(error)}`, { cause: error });
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
  registro: RegistroDeLimpieza,
  /** Antes de empezar (restablecer el negocio); si falla, la repetición
   * sale con error de ejecución, no como fallo del prompt. */
  preparar?: () => Promise<void>
): Promise<ResultadoDeRepeticion> {
  const { guion } = tarea;
  const { adaptador } = deps;
  const llamadaUsada = llamada.callId;
  // En una llamada, el saludo y las variables con que el backend contestaría
  // esa llamada (cliente conocido, grabación…); si no se sabe, el saludo del
  // assistant. En el chat no hay saludo.
  const deLaLlamada =
    guion.canal === "llamada"
      ? entorno.contexto.porLlamada?.[llamadaUsada]
      : undefined;
  const saludo =
    guion.canal === "llamada"
      ? (deLaLlamada?.saludo ?? entorno.contexto.saludo)
      : "";
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
      turnos: 0,
      caracteresDeTools: 0,
      latenciaMediaPorTurnoMs: 0,
    },
  };
  const inicio = Date.now();
  let conversacionId: string | undefined;

  try {
    await preparar?.();
    const creada = await registro.crear(
      () =>
        conReintentos(deps, () =>
          adaptador.createConversation({
            name: `lab-prompt:${guion.clave}:${tarea.variante}:${tarea.repeticion}`,
            metadata: {
              call_control_id: llamadaUsada,
              laboratorio: "prompt",
              // Telnyx resuelve las claves de los metadata como variables
              // dinámicas: por si el prompt las toma de aquí. Las del
              // assistant (iguales para todas las llamadas del negocio) son
              // las que valen seguro.
              ...(deLaLlamada?.variables ?? {}),
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
    if (saludo) {
      await conReintentos(deps, () =>
        adaptador.addConversationMessage(creada.id, {
          role: "assistant",
          content: saludo,
        })
      );
    }

    const entrada: Array<{
      cliente: string;
      respuestaDelChat: string;
      duracionMs: number;
    }> = [];
    const avisosDelCliente: string[] = [];
    let terminoElCliente: FinDelCliente | undefined;
    // El cliente decide cada mensaje con lo que ya se ha dicho (en el modo
    // guion, es el turno fijo).
    for (let turno = 1; ; turno++) {
      const decision = await siguienteMensajeDelCliente({
        guion,
        modo: opciones.cliente,
        turno,
        historial: entrada.map((dato) => ({
          cliente: dato.cliente,
          respuesta: dato.respuestaDelChat,
        })),
        saludo,
        modelo: opciones.modeloDelCliente,
        completar: (peticion) =>
          enElPaso(`Cliente simulado (${peticion.modelo})`, () =>
            conReintentos(
              deps,
              () =>
                adaptador.completarChat({
                  modelo: peticion.modelo,
                  temperatura: peticion.temperatura,
                  mensajes: peticion.mensajes,
                }),
              { tambienPlazo: true }
            )
          ),
      });
      avisosDelCliente.push(...decision.avisos);
      if (decision.mensaje === null) {
        terminoElCliente = decision.motivoDelFin;
        break;
      }
      const mensaje = decision.mensaje;
      const contenido =
        guion.canal === "chat" && turno === 1
          ? `${await deps.marcadorDeChat({
              clientPhone: telefonoDelCliente,
              timezone: entorno.contexto.zonaHoraria,
            })} ${mensaje}`
          : mensaje;
      const desde = Date.now();
      const respuesta = await enElPaso(`Assistant (turno ${turno})`, () =>
        conReintentos(deps, () =>
          adaptador.chatWithAssistant(entorno.assistantId, {
            content: contenido,
            conversationId: creada.id,
          })
        )
      );
      entrada.push({
        cliente: mensaje,
        respuestaDelChat: respuesta,
        duracionMs: Date.now() - desde,
      });
      if (decision.fin) {
        terminoElCliente = decision.motivoDelFin;
        break;
      }
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
      avisos: [...conversacion.avisos, ...avisosDelCliente],
      ...(terminoElCliente ? { terminoElCliente } : {}),
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
        turnos: conversacion.turnos.length,
        caracteresDeTools: conversacion.llamadas.reduce(
          (suma, llamada) => suma + (llamada.resultado?.length ?? 0),
          0
        ),
        latenciaMediaPorTurnoMs:
          conversacion.turnos.length === 0
            ? 0
            : Math.round(
                conversacion.turnos.reduce(
                  (suma, turno) => suma + turno.duracionMs,
                  0
                ) / conversacion.turnos.length
              ),
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
  const respuesta = await conReintentos(
    deps,
    () =>
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
      }),
    { tambienPlazo: true }
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

/** Nombre legible del negocio de un id, con el catálogo o el contexto. */
function nombreDelNegocio(
  id: string,
  contextos: Map<string, ContextoDelNegocio>,
  catalogo: CatalogoDeNegocios
): string {
  return (
    contextos.get(id)?.nombre ??
    catalogo.negocios.find((n) => n.id === id)?.nombre ??
    id
  );
}

function descripcionDelCliente(guion: Guion, opciones: Opciones): string {
  return opciones.cliente === "guion"
    ? `cliente con guion (${guion.turnos.length} turnos fijos)`
    : `cliente reactivo (hasta ${topeDeTurnos(guion)} turno${
        topeDeTurnos(guion) === 1 ? "" : "s"
      }${
        guion.frasesObligatorias?.length
          ? `, frases obligatorias en ${guion.frasesObligatorias.map((f) => f.turno).join(", ")}`
          : ""
      })`;
}

/** ¿Restablece su negocio esta repetición? Solo las que reservan o anulan,
 * y solo en un negocio de laboratorio (nunca uno elegido a mano que no lo
 * sea). */
export function restableceElNegocio(
  tarea: Tarea,
  catalogo: CatalogoDeNegocios
): boolean {
  return (
    tarea.guion.creaCitas &&
    catalogo.negocios.some((negocio) => negocio.id === tarea.negocioId)
  );
}

/**
 * Ningún mensaje de una repetición puede llegar a una persona:
 * - los teléfonos que dicta el cliente del guion (`datos.telefonos`) son de
 *   ficción, en cualquier negocio: con `--negocio-de E21=<id>` en un negocio
 *   con número de Telnyx, el WhatsApp de la reserva iría al dictado
 *   (Booking.clientPhone manda sobre el de la llamada);
 * - las llamadas que reservan en un negocio de laboratorio tienen un móvil de
 *   cliente de laboratorio, que es a donde va el WhatsApp de la reserva. Una
 *   llamada sin número (número oculto) solo puede reservar con el teléfono
 *   que dicte el cliente, que ya se ha comprobado; si no dicta ninguno, la
 *   cita se guarda sin teléfono.
 * Devuelve lo que lo incumple (vacío si todo está bien).
 */
export function telefonosFueraDelLaboratorio(
  tareas: Tarea[],
  asignacion: ReturnType<typeof asignarLlamadas>,
  catalogo: CatalogoDeNegocios
): string[] {
  const idsDeLaboratorio = new Set(catalogo.negocios.map((n) => n.id));
  const permitidos = new Set(
    catalogo.telefonosDeCliente.map(normalizarTelefono)
  );
  const problemas = new Set<string>();
  for (const tarea of tareas) {
    for (const dictado of tarea.guion.datos.telefonos ?? []) {
      const e164 = normalizarTelefonoDictado(dictado);
      if (!e164 || !permitidos.has(normalizarTelefono(e164))) {
        problemas.add(
          `${tarea.guion.clave}: el cliente dicta ${enmascararTelefono(e164 ?? dictado)}, que no es de laboratorio`
        );
      }
    }
    if (!tarea.guion.creaCitas || !idsDeLaboratorio.has(tarea.negocioId)) {
      continue;
    }
    const llamada = asignacion.porTarea.get(tarea);
    if (!llamada?.telefono) continue;
    if (!permitidos.has(normalizarTelefono(llamada.telefono))) {
      problemas.add(
        `${tarea.guion.clave} (negocio ${tarea.negocioId}): la llamada ${llamada.callId} tiene el número ${enmascararTelefono(llamada.telefono)}, que no es de laboratorio`
      );
    }
  }
  return [...problemas];
}

/** Lo que haría el laboratorio, sin hacer nada (`--dry-run`). */
export function describirPlan(
  plan: Plan,
  contextos: ContextoDelNegocio[],
  opciones: Opciones,
  asignacion?: ReturnType<typeof asignarLlamadas>,
  extra: {
    catalogo?: CatalogoDeNegocios;
    problemas?: string[];
    comparaCon?: InformeAnterior;
    /** Repeticiones que restablecen su negocio antes y después. */
    restablecidas?: number;
    avisos?: string[];
  } = {}
): string {
  const catalogo = extra.catalogo ?? CATALOGO_POR_DEFECTO;
  const mapaDeContextos = new Map(contextos.map((c) => [c.negocioId, c]));
  const ejecutables = asignacion
    ? plan.tareas.filter((tarea) => asignacion.porTarea.has(tarea))
    : plan.tareas;
  const usados = new Set(
    ejecutables.map((tarea) => `${tarea.negocioId}:${tarea.variante}`)
  );
  const lineas: string[] = [
    `Laboratorio de prompt (--dry-run: no se llama a Telnyx)`,
    `Guiones: ${plan.guiones.map((g) => g.clave).join(", ") || "ninguno"}`,
    `Variantes: ${opciones.variantes.join(", ")}; n = ${opciones.n}`,
    `Cliente: ${
      opciones.cliente === "reactivo"
        ? `reactivo, con ${opciones.modeloDelCliente} (el assistant usa ${MODELO_DEL_ASSISTANT})`
        : "con guion (turnos fijos)"
    }`,
    `Conversaciones: ${plan.tareas.length}; turnos de chat: ${plan.turnosTotales}` +
      (opciones.cliente === "reactivo" ? " (como mucho)" : "") +
      (plan.turnosTotales > TOPE_DE_TURNOS_SIN_CONFIRMAR
        ? ` (pasa de ${TOPE_DE_TURNOS_SIN_CONFIRMAR}: haría falta --si)`
        : ""),
    `Repeticiones que reservan o anulan citas en dev: ${plan.repeticionesConCitas}` +
      (plan.repeticionesConCitas > 0 && !opciones.si
        ? " (haría falta --si)"
        : ""),
    ...(extra.restablecidas
      ? [
          `De ellas, ${extra.restablecidas} restablecen su negocio de laboratorio antes y después (citas, recados y permisos de grabación como los sembró la siembra) y van de una en una en su negocio`,
        ]
      : []),
    `Juez: ${opciones.juez ?? "no"}`,
    ...(extra.comparaCon
      ? [
          `Comparar con: ${extra.comparaCon.meta.etiqueta ?? opciones.compararCon} (${extra.comparaCon.meta.fecha})`,
        ]
      : []),
    "",
    "Negocio y cliente de cada guion:",
    ...plan.guiones.map((guion) => {
      const tarea = plan.tareas.find((t) => t.guion === guion)!;
      const ejecuta = ejecutables.some((t) => t.guion === guion);
      return (
        `- ${guion.clave} (${guion.canal}): negocio «${nombreDelNegocio(tarea.negocioId, mapaDeContextos, catalogo)}» ` +
        `(${tarea.negocioId}${tarea.negocioOrigen === "elegido" ? ", elegido a mano" : ""}), ` +
        `${descripcionDelCliente(guion, opciones)}` +
        (ejecuta ? "" : " · SE SALTA: sin llamada o conversación antigua")
      );
    }),
    ...plan.saltados.map(
      ({ guion, motivo }) => `- ${guion.clave}: SE SALTA, ${motivo}`
    ),
    "",
    "Assistants que crearía (y borraría al acabar, con su app TeXML):",
  ];
  for (const contexto of contextos) {
    for (const variante of opciones.variantes) {
      if (!usados.has(`${contexto.negocioId}:${variante}`)) continue;
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
    const todosLosAvisos = [...asignacion.avisos, ...(extra.avisos ?? [])];
    if (todosLosAvisos.length > 0) {
      lineas.push("", "Avisos:", ...todosLosAvisos.map((a) => `- ${a}`));
    }
  }
  if (extra.problemas?.length) {
    lineas.push(
      "",
      "No empezaría (en una ejecución real se para aquí):",
      ...extra.problemas.map((p) => `- ${p}`)
    );
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

/** El sufijo del nombre del assistant de un negocio: único entre los usados. */
function sufijoDelNegocio(
  negocioId: string,
  catalogo: CatalogoDeNegocios,
  usados: Set<string>
): string {
  const clave = catalogo.negocios.find((n) => n.id === negocioId)?.clave;
  const base = (clave ?? negocioId.slice(-6))
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 20);
  let sufijo = base || "negocio";
  for (let n = 2; usados.has(sufijo); n++) sufijo = `${base}-${n}`;
  usados.add(sufijo);
  return sufijo;
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
  const catalogo = deps.catalogo ?? CATALOGO_POR_DEFECTO;
  const plan = planificar(opciones, catalogo);
  if (plan.tareas.length === 0) {
    throw new ErrorDeUso(
      "Ningún guion se puede correr: " +
        (plan.saltados.length > 0
          ? plan.saltados
              .map(({ guion, motivo }) => `${guion.clave}: ${motivo}`)
              .join("; ")
          : "ninguno cumple los filtros (--escenarios; los que reservan, solo con --con-citas)")
    );
  }
  if (!opciones.dryRun) exigirConfirmacion(plan, opciones);

  // Lo anterior con lo que comparar, antes de gastar nada: si la ruta está
  // mal, que falle ya.
  let anterior: InformeAnterior | undefined;
  if (opciones.compararCon) {
    anterior = leerInformeAnterior(
      await deps.leerInforme(rutaDelInformeAnterior(opciones.compararCon))
    );
  }

  const fecha = fechaDelLaboratorio(deps.ahora());
  const avisos: string[] = [];
  const saltados: Array<{ guion: string; motivo: string }> = plan.saltados.map(
    ({ guion, motivo }) => ({ guion: guion.clave, motivo })
  );
  const contextos = new Map<string, ContextoDelNegocio>();
  const sufijosUsados = new Set<string>();
  for (const negocioId of plan.negocios) {
    try {
      contextos.set(
        negocioId,
        await deps.cargarContexto({
          negocioId,
          variantes: opciones.variantes,
          fecha,
          sufijo:
            plan.negocios.length > 1
              ? sufijoDelNegocio(negocioId, catalogo, sufijosUsados)
              : undefined,
          listaDeEspera: opciones.listaDeEspera,
        })
      );
    } catch (error) {
      const deNegocio = plan.tareas.filter((t) => t.negocioId === negocioId);
      const soloDeLaboratorio = deNegocio.every(
        (t) => t.negocioOrigen === "laboratorio"
      );
      if (!(error instanceof NegocioNoDisponible) || !soloDeLaboratorio) {
        throw error;
      }
      // Un negocio de laboratorio sin sembrar: sus guiones se saltan.
      const claves = [...new Set(deNegocio.map((t) => t.guion.clave))];
      avisos.push(
        `Negocio de laboratorio ${negocioId} no disponible (${mensajeDeError(error)}); se saltan ${claves.join(", ")}. ¿Falta sembrarlo?`
      );
      for (const clave of claves) {
        saltados.push({ guion: clave, motivo: "su negocio no está sembrado" });
      }
    }
  }
  const disponibles = plan.tareas.filter((t) => contextos.has(t.negocioId));

  // Una Call antigua por tarea, por negocio y canal.
  const asignacion = asignarLlamadas(disponibles, contextos);
  const ejecutables = disponibles.filter((tarea) =>
    asignacion.porTarea.has(tarea)
  );
  const clavesQueCorren = new Set(ejecutables.map((t) => t.guion.clave));
  for (const guion of plan.guiones) {
    if (
      !clavesQueCorren.has(guion.clave) &&
      !saltados.some((salto) => salto.guion === guion.clave)
    ) {
      saltados.push({
        guion: guion.clave,
        motivo: "su negocio no tiene llamada o conversación antigua sin cita",
      });
    }
  }
  const problemas = telefonosFueraDelLaboratorio(
    ejecutables,
    asignacion,
    catalogo
  );
  const queRestablecen = deps.restablecerNegocio
    ? ejecutables.filter((tarea) => restableceElNegocio(tarea, catalogo))
    : [];
  const sinRestablecer = ejecutables.filter(
    (tarea) => tarea.guion.creaCitas && !queRestablecen.includes(tarea)
  );
  if (sinRestablecer.length > 0) {
    const negocios = [...new Set(sinRestablecer.map((t) => t.negocioId))];
    avisos.push(
      `${sinRestablecer.length} repeticiones reservan o anulan en negocios que el laboratorio no restablece (${negocios.join(", ")}): las citas se acumulan y desde la cuarta reserva del mismo hueco la conversación puede no ser la del guion`
    );
  }

  if (opciones.dryRun) {
    deps.log(
      describirPlan(plan, [...contextos.values()], opciones, asignacion, {
        catalogo,
        problemas,
        comparaCon: anterior,
        restablecidas: queRestablecen.length,
        avisos,
      })
    );
    return { plan, informe: null, rutaDelInforme: null, limpieza: null };
  }

  if (ejecutables.length === 0) {
    throw new ErrorDeUso(
      "Ninguna conversación se puede correr: " +
        [...avisos, ...asignacion.avisos].join("; ")
    );
  }
  if (problemas.length > 0) {
    throw new Error(
      `[Laboratorio] No se empieza: una reserva mandaría un WhatsApp a un número que no es de laboratorio.\n${problemas.join("\n")}`
    );
  }

  avisos.push(
    ...[...contextos.values()].flatMap((c) => c.avisos),
    ...asignacion.avisos
  );
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
    // Un assistant por (negocio, variante), solo de los que se van a usar.
    const sinAssistant = new Map<string, string>();
    const usados = new Set(
      ejecutables.map((t) => `${t.negocioId}:${t.variante}`)
    );
    for (const contexto of contextos.values()) {
      for (const variante of opciones.variantes) {
        if (!usados.has(`${contexto.negocioId}:${variante}`)) continue;
        const payload = contexto.payloads[variante];
        if (!esNombreDeLaboratorio(payload.name)) {
          throw new Error(
            `[Laboratorio] Nombre de assistant no permitido: ${payload.name}`
          );
        }
        let creado: { id: string };
        try {
          creado = await registro.crear(
            () => deps.adaptador.createAssistant(payload),
            (assistant) => registro.anotarAssistant(assistant.id, payload.name)
          );
        } catch (error) {
          // Un negocio cuyo assistant Telnyx no acepta no para la tanda: sus
          // repeticiones salen como error de ejecución, no del prompt.
          const motivo = `No se pudo crear el assistant ${payload.name}: ${mensajeDeError(error)}`;
          sinAssistant.set(`${contexto.negocioId}:${variante}`, motivo);
          avisos.push(motivo);
          console.error(`[Laboratorio] ${motivo}`);
          continue;
        }
        entornos.set(`${contexto.negocioId}:${variante}`, {
          assistantId: creado.id,
          contexto,
        });
        assistants.push({
          variante,
          nombre: payload.name,
          id: creado.id,
          negocio: contexto.negocioId,
        });
        deps.log(
          `[Laboratorio] Assistant ${payload.name} creado (${creado.id})`
        );
      }
    }

    let hechas = 0;
    const cerrojos = crearCerrojosPorNegocio();
    const restablecer = deps.restablecerNegocio?.bind(deps);
    await enParalelo(
      ejecutables,
      opciones.paralelo,
      async (tarea) => {
        const clave = `${tarea.negocioId}:${tarea.variante}`;
        const entorno = entornos.get(clave);
        if (!entorno) {
          resultados.push({
            tarea,
            resultado: resultadoSinAssistant(
              tarea,
              asignacion.porTarea.get(tarea)?.callId ?? "",
              sinAssistant.get(clave) ?? "Sin assistant"
            ),
          });
          hechas++;
          return;
        }
        const restablece =
          restablecer !== undefined && restableceElNegocio(tarea, catalogo);
        const resultado = await cerrojos.con(
          tarea.negocioId,
          restablece,
          async () => {
            try {
              return await ejecutarRepeticion(
                tarea,
                asignacion.porTarea.get(tarea)!,
                entorno,
                opciones,
                deps,
                registro,
                restablece ? () => restablecer!(tarea.negocioId) : undefined
              );
            } finally {
              if (restablece) {
                // Que las de solo lectura que vienen detrás tampoco vean
                // la cita, y que dev quede como lo dejó la siembra.
                await restablecer!(tarea.negocioId).catch((error) => {
                  const aviso = `No se pudo restablecer ${tarea.negocioId} tras ${tarea.guion.clave} #${tarea.repeticion}: ${mensajeDeError(error)}`;
                  avisos.push(aviso);
                  console.error(`[Laboratorio] ${aviso}`);
                });
              }
            }
          }
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
        negociosPorGuion: Object.fromEntries(
          ejecutables.map((t) => [t.guion.clave, t.negocioId])
        ),
        n: opciones.n,
        variantes: opciones.variantes,
        juez: opciones.juez,
        cliente: opciones.cliente,
        modeloDelCliente:
          opciones.cliente === "reactivo" ? opciones.modeloDelCliente : null,
        etiqueta: opciones.etiqueta,
        turnosTotales: plan.turnosTotales,
        saltados,
        assistants,
        avisos,
      },
      resumen,
      repeticiones,
    };
    const comparacion = anterior
      ? {
          contra: anterior,
          carpeta: opciones.compararCon!,
          resultado: compararInformes(informe, anterior),
        }
      : undefined;
    if (comparacion) {
      informe.comparacion = {
        con: comparacion.carpeta,
        fecha: anterior!.meta.fecha,
        etiqueta: anterior!.meta.etiqueta,
        filas: comparacion.resultado.filas.map((f) => ({
          guion: f.guion,
          variante: f.variante,
          veredicto: f.veredicto,
        })),
        sinPareja: comparacion.resultado.sinPareja,
      };
    }
    const carpeta = join(opciones.salida, fecha);
    await deps.escribirInforme(
      join(carpeta, "informe.json"),
      JSON.stringify(informe, null, 2)
    );
    await deps.escribirInforme(
      join(carpeta, "informe.md"),
      informeMarkdown(informe, comparacion)
    );
    deps.log(`\n${tablaMarkdown(informe)}\n`);
    if (comparacion) {
      deps.log(`${tablaDeComparacion(comparacion.resultado)}\n`);
    }
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

/**
 * Los valores que el assistant guarda por defecto para las variables del
 * prompt que dependen de quien llama (`{{nombre_cliente}}`...). En una llamada
 * real las pone contextoDeLlamada.ts al contestar; en el chat del laboratorio
 * no hay quien lo haga, así que un negocio de cliente conocido (E23) las lleva
 * ya en el assistant.
 */
export function conVariablesDeLaLlamada(
  payload: CreateTelnyxAssistantInput,
  variables: Readonly<Record<string, string>> | undefined
): CreateTelnyxAssistantInput {
  if (!variables) return payload;
  return {
    ...payload,
    dynamicVariables: { ...payload.dynamicVariables, ...variables },
  };
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

/**
 * Las variables del prompt que comparten todas las llamadas (las del
 * assistant de prueba, que valen para todas sus conversaciones), undefined
 * si no hay ninguna con valor, o «distintas».
 */
export function variablesComunes(
  contextos: ContextoDeLaLlamada[]
): Record<string, string> | undefined | "distintas" {
  const conValor = (variables: Record<string, string>) =>
    Object.values(variables).some((valor) => valor !== "");
  const distintas = new Set(
    contextos.map((contexto) => JSON.stringify(contexto.variables))
  );
  if (distintas.size > 1) return "distintas";
  const unica = contextos[0]?.variables;
  return unica && conValor(unica) ? unica : undefined;
}

/**
 * Un negocio del catálogo de laboratorio tiene que seguir siendo lo que
 * sembró la siembra antes de mandarle reservas: «Lab · …» y sin número de
 * Telnyx desde el que enviar (salvo el origen inerte de los dos de
 * transferencia). Así la seguridad no depende de que nadie haya editado la
 * fila en dev. Los demás negocios no se comprueban aquí.
 */
export function exigirNegocioDeLaboratorioInerte(
  negocio: { id: string; name: string; telnyxPhoneNumber: string | null },
  catalogo: CatalogoDeNegocios = CATALOGO_POR_DEFECTO
): void {
  if (!catalogo.negocios.some((n) => n.id === negocio.id)) return;
  if (!negocio.name.startsWith(PREFIJO_DEL_NOMBRE_DE_LABORATORIO)) {
    throw new Error(
      `[Laboratorio] El negocio ${negocio.id} es del catálogo de laboratorio pero se llama «${negocio.name}»: no se usa`
    );
  }
  const origenesInertes: string[] = Object.values(
    TELEFONOS_DE_TRANSFERENCIA_DE_LABORATORIO
  ).map((telefonos) => telefonos.origen);
  if (
    negocio.telnyxPhoneNumber &&
    !origenesInertes.includes(negocio.telnyxPhoneNumber)
  ) {
    throw new Error(
      `[Laboratorio] El negocio de laboratorio ${negocio.id} tiene número de Telnyx (${enmascararTelefono(negocio.telnyxPhoneNumber)}): podría mandar mensajes de verdad. Vuelve a sembrarlo`
    );
  }
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
    contextoLib,
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
    import("../src/lib/contextoDeLlamada.js"),
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
    throw new NegocioNoDisponible(
      `[Laboratorio] No existe el negocio ${input.negocioId}`
    );
  exigirNegocioDeLaboratorioInerte(negocio);

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

  // Lo que el backend diría al contestar cada llamada (handleCallInitiated):
  // el saludo (cliente conocido, aviso de grabación, negocio nuevo) y las
  // variables del prompt. Se calcula una vez, con la BD como la dejó la
  // siembra: las repeticiones que reservan restablecen el negocio.
  const porLlamada: Record<string, ContextoDeLaLlamada> = {};
  const sinContexto: string[] = [];
  for (let i = 0; i < llamadas.length; i += 8) {
    await Promise.all(
      llamadas.slice(i, i + 8).map(async (llamada) => {
        try {
          const contexto = await contextoLib.resolverContextoDeLlamada({
            business: negocio,
            telefono: llamada.fromNumber,
          });
          porLlamada[llamada.callId] = {
            saludo: contexto.saludo,
            variables: { ...contexto.variables },
          };
        } catch (error) {
          // Como en producción: sin contexto, el saludo del assistant.
          sinContexto.push(`${llamada.callId} (${mensajeDeError(error)})`);
        }
      })
    );
  }
  if (sinContexto.length > 0) {
    avisos.push(
      `${negocio.name}: ${sinContexto.length} llamadas sin contexto de llamada (usan el saludo del assistant): ${sinContexto.slice(0, 3).join("; ")}`
    );
  }
  const variables = variablesComunes(Object.values(porLlamada));
  if (variables === "distintas") {
    avisos.push(
      `Las llamadas de ${negocio.name} tienen variables del prompt distintas (clientes conocidos distintos): el assistant no lleva ninguna y cada conversación las pasa en sus metadata, sin verificar que Telnyx las use en el prompt`
    );
  }
  const delContrato = CATALOGO_POR_DEFECTO.negocios.find(
    (n) => n.id === negocio.id
  )?.variablesDeLaLlamada;
  if (
    delContrato &&
    JSON.stringify(variables === "distintas" ? null : variables) !==
      JSON.stringify(delContrato)
  ) {
    avisos.push(
      `${negocio.name}: las llamadas no dan las variables del contrato (${JSON.stringify(delContrato)}); ¿falta volver a sembrarlo?`
    );
  }

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
    payloads[variante] = conVariablesDeLaLlamada(
      neutralizarTransferencia({
        ...construido,
        name: nombreDelAssistant(input.fecha, variante, input.sufijo),
      }),
      variables === "distintas" ? undefined : variables
    );
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

  return {
    negocioId: negocio.id,
    nombre: negocio.name,
    zonaHoraria: negocio.timezone,
    saludo: payloads[input.variantes[0]!].greeting ?? "",
    porLlamada,
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
    leerInforme: async (ruta) => {
      try {
        return await readFile(ruta, "utf8");
      } catch (error) {
        throw new ErrorDeUso(
          `--comparar-con: no se pudo leer ${ruta} (${mensajeDeError(error)})`
        );
      }
    },
    ahora: () => new Date(),
    dormir: (ms) => new Promise((resolver) => setTimeout(resolver, ms)),
    log: (mensaje) => console.log(mensaje),
    restablecerNegocio: async (negocioId) => {
      const negocio = CATALOGO_POR_DEFECTO.negocios.find(
        (n) => n.id === negocioId
      );
      if (!negocio) {
        throw new Error(
          `[Laboratorio] ${negocioId} no es un negocio de laboratorio: no se restablece`
        );
      }
      const [{ prisma }, siembra] = await Promise.all([
        import("../src/lib/prisma.js"),
        import("./sembrarNegociosDeLaboratorio.js"),
      ]);
      const ahora = new Date();
      // La lista de espera solo cambia el prompt del Agent, que restablecer
      // no toca.
      const [plan] = siembra.planificarTodo({ ahora, listaDeEspera: false }, [
        negocio.clave,
      ]);
      await siembra.restablecerPlan(prisma, plan!, ahora);
    },
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

  // La BD, solo del .env de dev: una DATABASE_URL exportada en la shell
  // puede ser la de producción tras un proxy en 127.0.0.1.
  const local = exigirBdLocal(delEnv().DATABASE_URL);
  if (process.env.DATABASE_URL && process.env.DATABASE_URL !== local) {
    console.warn(
      "[Laboratorio] Se ignora la DATABASE_URL de la shell: el laboratorio solo usa la del .env de dev"
    );
  }
  process.env.DATABASE_URL = local;
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
