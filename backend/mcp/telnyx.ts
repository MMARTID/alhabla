import { cargarEnv, urlDeBdDeDev, variable } from "./entorno.js";
import { leerSecreto } from "./gcloud.js";
import { enmascararEnTodo, recortar } from "./privacidad.js";
import { urlDeBdDeProd } from "./prod.js";
import { ejecutarSoloLectura } from "./sqlDeSoloLectura.js";

/**
 * Lectura (solo GET) de la API de Telnyx AI: la configuración de un
 * assistant y los mensajes de una conversación (la del Gestor, la de una
 * llamada o la de un chat de cliente). La clave de dev sale del `.env`; la
 * de producción, de Secret Manager. Ninguna sale en una respuesta.
 */
const BASE = "https://api.telnyx.com/v2/ai";
export type Entorno = "dev" | "prod";

let claveDeProd: string | null = null;

async function claveDeTelnyx(entorno: Entorno): Promise<string> {
  if (entorno === "dev") return variable(cargarEnv(), "TELNYX_API_KEY");
  claveDeProd ??= await leerSecreto("TELNYX_API_KEY");
  return claveDeProd;
}

export async function urlDeBd(entorno: Entorno): Promise<string> {
  return entorno === "dev" ? urlDeBdDeDev(cargarEnv()) : urlDeBdDeProd();
}

async function getDeTelnyx(
  ruta: string,
  entorno: Entorno,
  fetchFn: typeof fetch
): Promise<unknown> {
  const respuesta = await fetchFn(`${BASE}${ruta}`, {
    headers: { Authorization: `Bearer ${await claveDeTelnyx(entorno)}` },
    signal: AbortSignal.timeout(20_000),
  });
  const texto = await respuesta.text();
  if (!respuesta.ok) {
    throw new Error(
      `[MCP] Telnyx respondió ${respuesta.status} a GET ${ruta}: ${recortar(texto, 300)}`
    );
  }
  return JSON.parse(texto) as unknown;
}

// ---------------------------------------------------------------------------
// Assistant
// ---------------------------------------------------------------------------

type HerramientaDeTelnyx = {
  type?: string;
  timeout_ms?: number;
  webhook?: {
    name?: string;
    url?: string;
    method?: string;
    timeout_ms?: number;
  };
  [tipo: string]: unknown;
};

type AssistantDeTelnyx = {
  id?: string;
  name?: string;
  model?: string;
  version_id?: string;
  greeting?: string;
  instructions?: string;
  tools?: HerramientaDeTelnyx[];
  voice_settings?: unknown;
  transcription?: unknown;
  dynamic_variables?: Record<string, unknown>;
  dynamic_variables_webhook_url?: string;
  conversation_flow?: {
    nodes?: {
      id?: string;
      type?: string;
      name?: string;
      voice_settings?: { voice?: string };
    }[];
  };
  telephony_settings?: {
    recording_settings?: unknown;
    [clave: string]: unknown;
  };
  privacy_settings?: unknown;
  enabled_features?: unknown;
  insight_settings?: unknown;
  interruption_settings?: unknown;
};

/** Recorta las cadenas largas de un valor (para no devolver 30 KB). */
function recortarEnTodo(valor: unknown, maximo: number): unknown {
  if (typeof valor === "string") return recortar(valor, maximo);
  if (Array.isArray(valor)) return valor.map((v) => recortarEnTodo(v, maximo));
  if (valor && typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor).map(([clave, v]) => [
        clave,
        recortarEnTodo(v, maximo),
      ])
    );
  }
  return valor;
}

export function resumirAssistant(assistant: AssistantDeTelnyx) {
  return {
    id: assistant.id ?? null,
    nombre: assistant.name ?? null,
    modelo: assistant.model ?? null,
    version: assistant.version_id ?? null,
    saludo: assistant.greeting ?? null,
    instrucciones: {
      caracteres: assistant.instructions?.length ?? 0,
      inicio: recortar(assistant.instructions ?? "", 300),
    },
    tools: (assistant.tools ?? []).map((tool) => {
      const tipo = tool.type ?? "";
      const datos = (tool.webhook ?? tool[tipo] ?? {}) as {
        name?: string;
        url?: string;
        method?: string;
        timeout_ms?: number;
      };
      return {
        tipo,
        nombre: datos.name ?? tipo,
        ...(datos.url ? { url: datos.url } : {}),
        ...(datos.method ? { metodo: datos.method } : {}),
        ...((tool.timeout_ms ?? datos.timeout_ms)
          ? { timeoutMs: tool.timeout_ms ?? datos.timeout_ms }
          : {}),
      };
    }),
    voz: assistant.voice_settings ?? null,
    transcripcion: recortarEnTodo(assistant.transcription ?? null, 600),
    variablesDinamicas: Object.keys(assistant.dynamic_variables ?? {}),
    webhookDeVariables: assistant.dynamic_variables_webhook_url ?? null,
    flujo: (assistant.conversation_flow?.nodes ?? []).map((nodo) => ({
      id: nodo.id ?? null,
      tipo: nodo.type ?? null,
      ...(nodo.name ? { nombre: nodo.name } : {}),
      ...(nodo.voice_settings?.voice ? { voz: nodo.voice_settings.voice } : {}),
    })),
    grabacion: assistant.telephony_settings?.recording_settings ?? null,
    privacidad: assistant.privacy_settings ?? null,
    funcionalidades: assistant.enabled_features ?? null,
    insights: assistant.insight_settings ?? null,
    interrupciones: assistant.interruption_settings ?? null,
  };
}

/** Dónde aparece un texto (sin distinguir mayúsculas) en un JSON, con algo
 * de contexto alrededor. */
export function buscarEnJson(
  valor: unknown,
  texto: string,
  { contexto = 150, maximo = 50 }: { contexto?: number; maximo?: number } = {}
): { ruta: string; fragmento: string }[] {
  const buscado = texto.toLowerCase();
  const encontrados: { ruta: string; fragmento: string }[] = [];
  const recorrer = (v: unknown, ruta: string) => {
    if (encontrados.length >= maximo) return;
    if (typeof v === "string") {
      const minusculas = v.toLowerCase();
      let desde = minusculas.indexOf(buscado);
      while (desde !== -1 && encontrados.length < maximo) {
        const inicio = Math.max(0, desde - contexto);
        const fin = Math.min(v.length, desde + buscado.length + contexto);
        encontrados.push({
          ruta: ruta || "(raíz)",
          fragmento: `${inicio > 0 ? "…" : ""}${v.slice(inicio, fin)}${fin < v.length ? "…" : ""}`,
        });
        desde = minusculas.indexOf(buscado, desde + buscado.length);
      }
    } else if (Array.isArray(v)) {
      v.forEach((elemento, i) => recorrer(elemento, `${ruta}[${i}]`));
    } else if (v && typeof v === "object") {
      for (const [clave, elemento] of Object.entries(v)) {
        recorrer(elemento, ruta ? `${ruta}.${clave}` : clave);
      }
    }
  };
  recorrer(valor, "");
  return encontrados;
}

async function assistantDelNegocio(
  entorno: Entorno,
  businessId: string
): Promise<string> {
  const { filas } = await ejecutarSoloLectura(
    await urlDeBd(entorno),
    `SELECT "telnyxAssistantId" FROM agents
      WHERE "businessId" = $1 AND "telnyxAssistantId" IS NOT NULL
      ORDER BY active DESC, "createdAt" DESC
      LIMIT 1`,
    { parametros: [businessId] }
  );
  const id = (filas[0] as { telnyxAssistantId?: string } | undefined)
    ?.telnyxAssistantId;
  if (!id) {
    throw new Error(
      `[MCP] El negocio ${businessId} no tiene assistant de Telnyx en ${entorno}`
    );
  }
  return id;
}

export async function verAssistant(
  {
    entorno,
    assistantId,
    businessId,
    buscar,
    completo = false,
    mostrarTelefonos = false,
  }: {
    entorno: Entorno;
    assistantId?: string;
    businessId?: string;
    buscar?: string;
    completo?: boolean;
    mostrarTelefonos?: boolean;
  },
  { fetchFn = fetch }: { fetchFn?: typeof fetch } = {}
) {
  if (!assistantId && !businessId) {
    throw new Error("[MCP] Indica assistantId o businessId");
  }
  const id = assistantId ?? (await assistantDelNegocio(entorno, businessId!));
  if (!/^[\w-]+$/.test(id))
    throw new Error(`[MCP] «${id}» no parece un id de assistant`);
  const crudo = (await getDeTelnyx(`/assistants/${id}`, entorno, fetchFn)) as
    AssistantDeTelnyx | { data: AssistantDeTelnyx };
  const assistant = "data" in crudo ? crudo.data : crudo;

  const resultado: Record<string, unknown> = completo
    ? { assistant: recortarEnTodo(assistant, 4_000) }
    : { assistant: resumirAssistant(assistant) };
  if (buscar) resultado.coincidencias = buscarEnJson(assistant, buscar);
  return mostrarTelefonos ? resultado : enmascararEnTodo(resultado);
}

// ---------------------------------------------------------------------------
// Conversación
// ---------------------------------------------------------------------------

type MensajeDeTelnyx = {
  role?: string;
  text?: string;
  created_at?: string;
  sent_at?: string;
  tool_call_id?: string;
  tool_calls?: {
    id?: string;
    function?: { name?: string; arguments?: string };
  }[];
};

export type MensajeResumido = {
  hora: string;
  rol: string;
  texto?: string;
  tools?: { nombre: string; argumentos: unknown }[];
};

function momentoDelMensaje(mensaje: MensajeDeTelnyx): number {
  const momento = Date.parse(mensaje.created_at ?? mensaje.sent_at ?? "");
  return Number.isNaN(momento) ? 0 : momento;
}

export function resumirMensajes(
  mensajes: MensajeDeTelnyx[],
  { conResultadosDeTools = true }: { conResultadosDeTools?: boolean } = {}
): MensajeResumido[] {
  return (
    [...mensajes]
      // Por fecha, no como texto: «…07.5Z» va después de «…07Z».
      .sort((a, b) => momentoDelMensaje(a) - momentoDelMensaje(b))
      .filter((mensaje) => conResultadosDeTools || mensaje.role !== "tool")
      .map((mensaje) => {
        const resumido: MensajeResumido = {
          hora: mensaje.created_at ?? mensaje.sent_at ?? "",
          rol: mensaje.role ?? "",
        };
        if (mensaje.text) {
          resumido.texto = recortar(
            mensaje.text,
            mensaje.role === "tool" ? 600 : 1_500
          );
        }
        if (mensaje.tool_calls?.length) {
          resumido.tools = mensaje.tool_calls.map((llamada) => {
            let argumentos: unknown = llamada.function?.arguments ?? "";
            try {
              argumentos = JSON.parse(String(argumentos));
            } catch {
              // Se deja el texto tal cual.
            }
            return { nombre: llamada.function?.name ?? "", argumentos };
          });
        }
        return resumido;
      })
  );
}

/** El id de la conversación a partir de lo que se tenga a mano. */
async function conversacionDe(
  entorno: Entorno,
  {
    llamada,
    businessId,
    telefonoCliente,
  }: { llamada?: string; businessId?: string; telefonoCliente?: string }
): Promise<string> {
  const url = await urlDeBd(entorno);
  if (llamada) {
    const { filas } = await ejecutarSoloLectura(
      url,
      `SELECT "providerConversationId" AS id FROM calls
        WHERE id = $1 OR "callId" = $1 OR "providerCallId" = $1
        LIMIT 1`,
      { parametros: [llamada] }
    );
    const id = (filas[0] as { id?: string } | undefined)?.id;
    if (!id)
      throw new Error(
        `[MCP] La llamada ${llamada} no tiene conversación de Telnyx en ${entorno}`
      );
    return id;
  }
  if (businessId && telefonoCliente) {
    const { filas } = await ejecutarSoloLectura(
      url,
      `SELECT "conversationId" AS id FROM client_conversations
        WHERE "businessId" = $1 AND "clientPhone" = $2
        LIMIT 1`,
      { parametros: [businessId, telefonoCliente] }
    );
    const id = (filas[0] as { id?: string } | undefined)?.id;
    if (!id)
      throw new Error(
        `[MCP] No hay chat de ese cliente con el negocio ${businessId} en ${entorno}`
      );
    return id;
  }
  if (businessId) {
    const { filas } = await ejecutarSoloLectura(
      url,
      `SELECT "ownerConversationId" AS id FROM businesses WHERE id = $1`,
      { parametros: [businessId] }
    );
    const id = (filas[0] as { id?: string } | undefined)?.id;
    if (!id)
      throw new Error(
        `[MCP] El negocio ${businessId} no tiene conversación con el Gestor en ${entorno}`
      );
    return id;
  }
  throw new Error(
    "[MCP] Indica conversationId, llamada (id de la Call o su callId), businessId (la del Gestor) o businessId + telefonoCliente (la del chat de ese cliente)"
  );
}

const TAMANO_DE_PAGINA = 100;
const MAX_PAGINAS = 10;

export async function verConversacion(
  {
    entorno,
    conversationId,
    llamada,
    businessId,
    telefonoCliente,
    ultimos = 60,
    buscar,
    conResultadosDeTools = true,
    mostrarTelefonos = false,
  }: {
    entorno: Entorno;
    conversationId?: string;
    llamada?: string;
    businessId?: string;
    telefonoCliente?: string;
    ultimos?: number;
    buscar?: string;
    conResultadosDeTools?: boolean;
    mostrarTelefonos?: boolean;
  },
  { fetchFn = fetch }: { fetchFn?: typeof fetch } = {}
) {
  const id =
    conversationId ??
    (await conversacionDe(entorno, { llamada, businessId, telefonoCliente }));
  if (!/^[\w-]+$/.test(id))
    throw new Error(`[MCP] «${id}» no parece un id de conversación`);

  const cabecera = (await getDeTelnyx(
    `/conversations/${id}`,
    entorno,
    fetchFn
  )) as {
    data?: { name?: string; created_at?: string; metadata?: unknown };
  };

  const mensajes: MensajeDeTelnyx[] = [];
  let totalDePaginas = 1;
  for (
    let pagina = 1;
    pagina <= Math.min(totalDePaginas, MAX_PAGINAS);
    pagina++
  ) {
    const respuesta = (await getDeTelnyx(
      `/conversations/${id}/messages?page%5Bsize%5D=${TAMANO_DE_PAGINA}&page%5Bnumber%5D=${pagina}`,
      entorno,
      fetchFn
    )) as { data?: MensajeDeTelnyx[]; meta?: { total_pages?: number } };
    mensajes.push(...(respuesta.data ?? []));
    totalDePaginas = respuesta.meta?.total_pages ?? 1;
  }

  let resumidos = resumirMensajes(mensajes, { conResultadosDeTools });
  if (buscar) {
    const buscado = buscar.toLowerCase();
    resumidos = resumidos.filter((mensaje) =>
      JSON.stringify(mensaje).toLowerCase().includes(buscado)
    );
  }
  const resultado = {
    conversacion: {
      id,
      nombre: cabecera.data?.name ?? null,
      creada: cabecera.data?.created_at ?? null,
      metadata: cabecera.data?.metadata ?? null,
    },
    totalDeMensajes: mensajes.length,
    ...(totalDePaginas > MAX_PAGINAS
      ? {
          // Telnyx pagina de la más reciente a la más antigua.
          aviso: `Solo se leyeron los ${MAX_PAGINAS * TAMANO_DE_PAGINA} mensajes más recientes (${totalDePaginas} páginas en total)`,
        }
      : {}),
    mensajes: resumidos.slice(-ultimos),
  };
  return mostrarTelefonos ? resultado : enmascararEnTodo(resultado);
}
