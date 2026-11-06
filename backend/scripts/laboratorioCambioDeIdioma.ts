/**
 * Laboratorio: recepcionista procesada en la UE que, si quien llama habla
 * catalán, gallego o euskera, cambia en la misma llamada a un assistant de
 * esa lengua (sesión del 2026-11-06; lib/cambioDeIdioma.ts).
 *
 * Lo medido antes de montarlo (llamadas reales en dev, 06-11), con
 * `privacy_settings.in_transit_data_locality`:
 * - Funcionan GLM-5.3-Flash, deepgram/flux «multi», la voz Ultra, el audio
 *   de fondo y la supresión de ruido, con 530–730 ms por turno.
 * - Cortan la llamada (`data_locality_unavailable`) AssemblyAI y nova-3: en
 *   la UE no hay transcripción ni voz para ca, gl ni eu.
 * - El traspaso (tool `handoff`) a un assistant sin la garantía también:
 *   la garantía vale para toda la conversación. Por eso el cambio lo hace el
 *   backend: para el assistant y arranca otro (`startAIAssistant` con
 *   `message_history`), que es una conversación nueva.
 * - flux deforma el catalán, pero GLM lo reconoció a la primera.
 *
 * Assistants (clonados del de «Peluquería Mallorca» en dev: prompt, tools y
 * saludo iguales):
 * - UE: flux multi, voz Ultra, con la garantía y sin el respaldo Kimi (no
 *   está en la UE). Atiende castellano, inglés, francés, alemán, italiano,
 *   portugués, neerlandés y ruso. Tiene la tool `cambiar_de_idioma`.
 * - Uno por lengua cooficial (ca, gl, eu): Soniox con [es, lengua] y la voz
 *   Marta en esa lengua, sin la garantía, como el nodo «cooficial» de hoy.
 *
 * Qué mide `medir`: cada conversación de cada llamada con su assistant, lo
 * que entendió la transcripción, la espera por turno y el hueco del cambio.
 *
 * Solo toca dev: el agente de «Peluquería Mallorca» (+34930453236) apunta al
 * assistant que se prueba. `borrar` deja agente, idiomas de clientes y
 * cuenta de Telnyx como estaban. Necesita que el backend de dev corra la
 * rama con lib/cambioDeIdioma.ts (MCP ver_en_dev).
 *
 * Uso (desde backend/, con DATABASE_URL a localhost:5432):
 *   npx tsx --env-file=../.env scripts/laboratorioCambioDeIdioma.ts crear
 *   npx tsx --env-file=../.env scripts/laboratorioCambioDeIdioma.ts usar ue|control
 *   npx tsx --env-file=../.env scripts/laboratorioCambioDeIdioma.ts sin-idioma +34XXXXXXXXX
 *   npx tsx --env-file=../.env scripts/laboratorioCambioDeIdioma.ts medir [--desde ISO]
 *   npx tsx --env-file=../.env scripts/laboratorioCambioDeIdioma.ts borrar
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { prisma } from "../src/lib/prisma.js";
import { getTelnyxClient } from "../src/lib/telnyx.js";
import { telnyxAiAdapter } from "../src/adapters/telnyx/TelnyxAiAdapter.js";
import { IDIOMAS } from "../src/lib/idiomas/catalogo.js";
import { IDIOMAS_CON_CAMBIO, type IdiomaConCambio } from "../src/lib/cambioDeIdioma.js";

const NEGOCIO_DE_DEV = "cmuiit0yn0000oi1xfrldp7kf"; // Peluquería Mallorca
const CARPETA = join(homedir(), ".alhabla-laboratorio");
const ESTADO = join(CARPETA, "cambio-de-idioma.json");
const NOMBRE_UE = "alhabla-lab-idioma-ue";
const NOMBRE_LENGUA = (idioma: IdiomaConCambio) => `alhabla-lab-idioma-${IDIOMAS[idioma].iso}`;

interface Estado {
  creadoEn: string;
  agentId: string;
  assistantBase: string;
  agenteActivoAntes: boolean;
  ue: string;
  lenguas: Record<IdiomaConCambio, string>;
  apps: string[];
  usando?: "ue" | "control";
  /** Idiomas de clientes quitados con «sin-idioma», para devolverlos. */
  idiomasAntes?: Record<string, { idioma: string | null; idiomaAt: string | null }>;
}

type Assistant = Record<string, any>;

function soloDev(): void {
  const url = process.env.DATABASE_URL ?? "";
  if (process.env.NODE_ENV === "production" || !/@(localhost|127\.0\.0\.1):5432\/botbook/.test(url)) {
    throw new Error("Solo contra la BD de dev (botbook en localhost:5432). Pon DATABASE_URL con @localhost:5432.");
  }
}

function leerEstado(): Estado {
  if (!existsSync(ESTADO)) throw new Error(`No hay laboratorio creado (${ESTADO}). Ejecuta «crear».`);
  return JSON.parse(readFileSync(ESTADO, "utf8")) as Estado;
}

function guardarEstado(estado: Estado): void {
  mkdirSync(CARPETA, { recursive: true });
  writeFileSync(ESTADO, JSON.stringify(estado, null, 2));
}

function toolsParaCrear(base: Assistant): Assistant[] {
  return (base.tools ?? []).map(({ tool_id: _id, shared: _shared, ...tool }: Assistant) => tool);
}

function comun(base: Assistant, nombre: string): Assistant {
  const t = base.telephony_settings ?? {};
  return {
    name: nombre,
    model: base.model,
    greeting: base.greeting,
    dynamic_variables: base.dynamic_variables,
    enabled_features: ["telephony"],
    telephony_settings: {
      noise_suppression: "disabled",
      time_limit_secs: t.time_limit_secs,
      user_idle_timeout_secs: t.user_idle_timeout_secs,
      user_idle_reply_secs: t.user_idle_reply_secs,
      recording_settings: t.recording_settings,
      send_conversation_message_events: t.send_conversation_message_events,
      conversation_ended_full_history: t.conversation_ended_full_history,
    },
    interruption_settings: base.interruption_settings,
    insight_settings: { insight_group_id: base.insight_settings?.insight_group_id },
    post_conversation_settings: base.post_conversation_settings,
  };
}

function nombreDeLengua(idioma: IdiomaConCambio): string {
  return IDIOMAS[idioma].nombreEnPrompt;
}

function instruccionesUe(base: Assistant): string {
  const lenguas = IDIOMAS_CON_CAMBIO.map((i) => `${nombreDeLengua(i)} (${i})`).join(", ");
  return `${base.instructions}

## Catalán, gallego y euskera

Tu transcripción no entiende el catalán, el gallego ni el euskera: cuando quien llama habla en una de ellas, te llega deformado, como si fuera italiano, portugués o un castellano con palabras raras o sin sentido (en catalán, por ejemplo, «bon dia», «voldria», «demà», «si us plau», «gràcies»; en gallego, «bos días», «quería», «mañá», «grazas», «onte»; en euskera, «kaixo», «egun on», «eskerrik asko», «bihar», «ordua»). Si te llega algo así, o pide que le atiendas en una de esas lenguas, llama a cambiar_de_idioma con su idioma (${lenguas}) en ese mismo turno, sin decir nada antes y sin pedirle que lo repita. No le digas que le pasas con nadie: para quien llama es la misma recepcionista.

Con el resto de idiomas que hablas (inglés, francés, alemán, italiano, portugués, neerlandés, ruso) no cambies nada: contesta tú en su idioma. Si dudas entre italiano y catalán o entre portugués y gallego, y las frases llegan enteras y con sentido en italiano o portugués, es italiano o portugués.`;
}

function instruccionesLengua(base: Assistant, idioma: IdiomaConCambio): string {
  const lengua = nombreDeLengua(idioma);
  const frase = IDIOMAS[idioma].fraseAlCambiar;
  return `${base.instructions}

## Idioma

Esta conversación viene de la recepcionista que atendía en castellano: quien llama ha hablado en ${lengua} o lo ha pedido. Ya le has dicho «${frase}». Sigue tú en ${lengua}, con naturalidad, sin repetir el saludo ni lo que ya se ha dicho. Si su última frase pedía algo, contéstale a eso enseguida. Si en la conversación aún no se ha dicho en ${lengua} que eres una inteligencia artificial, dilo brevemente en tu primera frase. Si después cambia a castellano u otro idioma, contesta en el suyo.`;
}

function toolCambiarDeIdioma(base: Assistant, destinos: Record<string, string>): Assistant {
  const algunaTool = (base.tools ?? []).find((t: Assistant) => t.type === "webhook");
  const url = new URL(algunaTool.webhook.url);
  url.pathname = "/webhooks/telnyx/tools/cambiar_de_idioma";
  url.search = new URLSearchParams(destinos).toString();
  return {
    type: "webhook",
    timeout_ms: 5000,
    webhook: {
      name: "cambiar_de_idioma",
      description:
        "Sigue la llamada en catalán, gallego o euskera, que tu transcripción no entiende. Llámala en el mismo turno en que notes que quien llama habla una de esas lenguas (te llega deformada) o lo pide, sin decir nada antes. No la uses para ningún otro idioma.",
      url: url.toString(),
      method: "POST",
      body_parameters: {
        type: "object",
        properties: {
          idioma: {
            type: "string",
            enum: [...IDIOMAS_CON_CAMBIO],
            description: "ca-ES catalán, gl-ES gallego, eu-ES euskera.",
          },
        },
        required: ["idioma"],
      },
      headers: [{ name: "X-Alhabla-Call-Control-Id", value: "{{call_control_id}}" }],
    },
  };
}

async function crear(): Promise<void> {
  soloDev();
  if (existsSync(ESTADO)) throw new Error(`Ya hay un laboratorio (${ESTADO}). Ejecuta «borrar» antes.`);
  const client: any = getTelnyxClient();
  const agente = await prisma.agent.findFirstOrThrow({
    where: { businessId: NEGOCIO_DE_DEV, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, active: true, telnyxAssistantId: true },
  });
  if (!agente.telnyxAssistantId) throw new Error("El agente de dev no tiene assistant.");
  const base: Assistant = await client.ai.assistants.retrieve(agente.telnyxAssistantId);
  const nodo = base.conversation_flow?.nodes?.find((n: Assistant) => n.id === "cooficial");
  const voz = nodo?.voice_settings;
  if (!voz?.voice?.startsWith("Soniox.")) throw new Error("El assistant de dev no tiene el nodo «cooficial» con voz de Soniox.");
  const sttBase = base.transcription ?? {};

  const apps: string[] = [];
  const creados: string[] = [];
  const lenguas = {} as Record<IdiomaConCambio, string>;
  try {
    for (const idioma of IDIOMAS_CON_CAMBIO) {
      const iso = IDIOMAS[idioma].iso;
      const a: Assistant = await client.ai.assistants.create({
        ...comun(base, NOMBRE_LENGUA(idioma)),
        instructions: instruccionesLengua(base, idioma),
        tools: toolsParaCrear(base),
        voice_settings: { voice: voz.voice, language: iso, background_audio: voz.background_audio },
        transcription: {
          model: "soniox/stt-rt-v5",
          language: "auto",
          settings: { ...sttBase.settings, language_hints: ["es", iso] },
          fallback_models: sttBase.fallback_models,
        },
        fallback_config: base.fallback_config?.model ? { model: base.fallback_config.model } : undefined,
        // Sin la garantía (Soniox es de terceros). Sin redacción de datos, para
        // leer lo que entendió la transcripción (solo llamadas de prueba).
        privacy_settings: { data_retention: true, pii_redaction: "disabled", in_transit_data_locality: false },
      });
      creados.push(a.id);
      lenguas[idioma] = a.id;
      if (a.telephony_settings?.default_texml_app_id) apps.push(a.telephony_settings.default_texml_app_id);
      console.log(`[Lab] ${idioma}: ${a.id}`);
    }

    const ue: Assistant = await client.ai.assistants.create({
      ...comun(base, NOMBRE_UE),
      instructions: instruccionesUe(base),
      tools: toolsParaCrear(base),
      voice_settings: {
        voice: base.voice_settings.voice,
        expressive_mode: base.voice_settings.expressive_mode,
        background_audio: base.voice_settings.background_audio,
      },
      transcription: {
        model: "deepgram/flux",
        language: "multi",
        settings: { keyterm: sttBase.settings?.context ?? undefined },
      },
      privacy_settings: { data_retention: true, pii_redaction: "disabled", in_transit_data_locality: true },
    });
    creados.push(ue.id);
    if (ue.telephony_settings?.default_texml_app_id) apps.push(ue.telephony_settings.default_texml_app_id);
    // La tool lleva en la URL los destinos y el propio assistant de la UE
    // (para volver a él si el cambio falla): hace falta su id.
    await client.ai.assistants.update(ue.id, {
      tools: [...toolsParaCrear(base), toolCambiarDeIdioma(base, { ...lenguas, ue: ue.id })],
    });
    console.log(`[Lab] UE: ${ue.id}`);

    for (const app of apps) await telnyxAiAdapter.anclarConexionEnEuropa("texml", app);

    guardarEstado({
      creadoEn: new Date().toISOString(),
      agentId: agente.id,
      assistantBase: agente.telnyxAssistantId,
      agenteActivoAntes: agente.active,
      ue: ue.id,
      lenguas,
      apps,
    });
    const leido: Assistant = await client.ai.assistants.retrieve(ue.id);
    console.log(
      `[Lab] UE: garantía=${leido.privacy_settings?.in_transit_data_locality} stt=${leido.transcription?.model}/${leido.transcription?.language} respaldo=${leido.fallback_config?.model ?? "ninguno"} cambio=${(leido.tools ?? []).some((t: Assistant) => t.webhook?.name === "cambiar_de_idioma")}`
    );
    console.log(`[Lab] Estado en ${ESTADO}. «usar ue» para que el número de dev conteste con él.`);
  } catch (error) {
    for (const id of creados.reverse()) await client.ai.assistants.delete(id, { hard_delete: true }).catch(() => {});
    throw error;
  }
}

async function usar(cual: string | undefined): Promise<void> {
  soloDev();
  if (cual !== "ue" && cual !== "control") throw new Error("usar ue | usar control");
  const estado = leerEstado();
  const assistantId = cual === "ue" ? estado.ue : estado.assistantBase;
  await prisma.agent.update({ where: { id: estado.agentId }, data: { active: true, telnyxAssistantId: assistantId } });
  guardarEstado({ ...estado, usando: cual });
  console.log(`[Lab] El +34930453236 contesta ahora con ${cual === "ue" ? "el de la UE" : "el de siempre (control)"} (${assistantId}).`);
}

/** Quita el idioma guardado de un teléfono (el saludo saldría en ese idioma
 * y, en una lengua cooficial, con la voz de Soniox, que la garantía rechaza).
 * Se devuelve al borrar. */
async function sinIdioma(telefono: string | undefined): Promise<void> {
  soloDev();
  if (!telefono?.startsWith("+")) throw new Error("sin-idioma +34XXXXXXXXX");
  const estado = leerEstado();
  const cliente = await prisma.clienteDelNegocio.findFirst({
    where: { businessId: NEGOCIO_DE_DEV, telefono },
    select: { id: true, idioma: true, idiomaAt: true },
  });
  if (!cliente) {
    console.log(`[Lab] ${telefono} no tiene ficha en el negocio de dev: el saludo ya sale en castellano.`);
    return;
  }
  const idiomasAntes = { ...(estado.idiomasAntes ?? {}) };
  if (!(cliente.id in idiomasAntes)) {
    idiomasAntes[cliente.id] = { idioma: cliente.idioma, idiomaAt: cliente.idiomaAt?.toISOString() ?? null };
  }
  await prisma.clienteDelNegocio.update({ where: { id: cliente.id }, data: { idioma: null, idiomaAt: null } });
  guardarEstado({ ...estado, idiomasAntes });
  console.log(`[Lab] ${telefono}: idioma guardado (${cliente.idioma ?? "ninguno"}) quitado hasta «borrar».`);
}

function mediana(xs: number[]): number | null {
  if (!xs.length) return null;
  const o = [...xs].sort((a, b) => a - b);
  return o[Math.floor(o.length / 2)];
}

async function medir(desde: string | undefined): Promise<void> {
  soloDev();
  const estado = leerEstado();
  const client: any = getTelnyxClient();
  const nombres: Record<string, string> = { [estado.ue]: "UE", [estado.assistantBase]: "control" };
  for (const [idioma, id] of Object.entries(estado.lenguas)) nombres[id] = idioma;
  const llamadas = await prisma.call.findMany({
    where: { businessId: NEGOCIO_DE_DEV, createdAt: { gte: new Date(desde ?? estado.creadoEn) } },
    orderBy: { createdAt: "asc" },
    select: { callId: true, status: true, durationSecs: true, createdAt: true },
  });
  if (!llamadas.length) console.log("[Lab] Ninguna llamada todavía.");
  for (const llamada of llamadas) {
    const conversaciones = await telnyxAiAdapter.conversacionesDeLaLlamada(llamada.callId);
    console.log(`\n=== ${llamada.createdAt.toISOString()} · ${llamada.status} · ${llamada.durationSecs ?? "?"} s · ${conversaciones.length} conversación(es)`);
    let finAnterior: number | null = null;
    for (const conv of conversaciones) {
      const quien = nombres[conv.assistantId ?? ""] ?? conv.assistantId ?? "?";
      const r: Assistant = await client.ai.conversations.messages.list(conv.id);
      const mensajes: Assistant[] = [...(r.data ?? [])].sort(
        (a, b) => new Date(a.sent_at ?? a.created_at).getTime() - new Date(b.sent_at ?? b.created_at).getTime()
      );
      const esperas: number[] = [];
      let delCliente = 0;
      const primerHablado = mensajes.find((m) => m.role === "assistant" && String(m.text ?? "").trim());
      if (finAnterior && primerHablado) {
        const hueco = new Date(primerHablado.sent_at ?? primerHablado.created_at).getTime() - finAnterior;
        console.log(`  ⇢ cambio a ${quien}: ${hueco} ms desde la última frase del cliente hasta la primera de ${quien}`);
      }
      for (const m of mensajes) {
        const md = m.metadata ?? {};
        const texto = String(m.text ?? "").replace(/\s+/g, " ").slice(0, 150);
        if (m.role === "user") {
          delCliente++;
          finAnterior = new Date(m.sent_at ?? m.created_at).getTime();
        }
        if (m.role === "assistant" && typeof md.end_user_perceived_latency_ms === "number") esperas.push(md.end_user_perceived_latency_ms);
        const lat = typeof md.end_user_perceived_latency_ms === "number"
          ? ` [${md.end_user_perceived_latency_ms} ms · stt ${md.transcription_duration_ms ?? "?"} · llm ${md.llm_first_token_duration_ms ?? "?"} · voz ${md.audio_first_token_duration_ms ?? "?"}]`
          : "";
        const tools = (m.tool_calls ?? []).map((t: Assistant) => `${t.function?.name}(${t.function?.arguments ?? ""})`);
        if (m.role === "system" && /ended/.test(texto)) continue;
        console.log(`  ${String(m.role).padEnd(9)} ${quien.padEnd(7)} ${texto}${tools.length ? ` → ${tools.join(", ")}` : ""}${lat}`);
      }
      console.log(`  → ${quien}: ${mensajes.length} mensajes, ${delCliente} del cliente; espera p50 ${mediana(esperas) ?? "-"} ms en ${esperas.length} turnos`);
    }
  }
}

async function borrar(): Promise<void> {
  soloDev();
  const estado = leerEstado();
  const client: any = getTelnyxClient();
  await prisma.agent.update({
    where: { id: estado.agentId },
    data: { active: estado.agenteActivoAntes, telnyxAssistantId: estado.assistantBase },
  });
  console.log(`[Lab] Agente de dev restaurado: assistant ${estado.assistantBase}, activo=${estado.agenteActivoAntes}.`);
  for (const [id, antes] of Object.entries(estado.idiomasAntes ?? {})) {
    await prisma.clienteDelNegocio.update({
      where: { id },
      data: { idioma: antes.idioma, idiomaAt: antes.idiomaAt ? new Date(antes.idiomaAt) : null },
    });
    console.log(`[Lab] Idioma del cliente ${id} devuelto (${antes.idioma ?? "ninguno"}).`);
  }
  for (const id of [estado.ue, ...Object.values(estado.lenguas)]) {
    try {
      await client.ai.assistants.delete(id, { hard_delete: true });
      console.log(`[Lab] Borrado ${id}`);
    } catch (error: any) {
      console.error(`[Lab] No se pudo borrar ${id}: ${error?.message ?? error}`);
      process.exitCode = 1;
    }
  }
  for (const app of estado.apps) {
    try {
      await client.texmlApplications.delete(app);
    } catch (error: any) {
      // Con hard_delete Telnyx suele borrarla con el assistant: 404 es lo normal.
      if (error?.status !== 404) {
        console.error(`[Lab] No se pudo borrar la app TeXML ${app}: ${error?.message ?? error}`);
        process.exitCode = 1;
      }
    }
  }
  if (!process.exitCode) rmSync(ESTADO);
}

const [orden, arg] = process.argv.slice(2);
const desde = process.argv.includes("--desde") ? process.argv[process.argv.indexOf("--desde") + 1] : undefined;
const ordenes: Record<string, () => Promise<void>> = {
  crear,
  usar: () => usar(arg),
  "sin-idioma": () => sinIdioma(arg),
  medir: () => medir(desde),
  borrar,
};
const ejecutar = ordenes[orden ?? ""];
if (!ejecutar) {
  console.error("Uso: laboratorioCambioDeIdioma.ts crear | usar ue|control | sin-idioma +34… | medir [--desde ISO] | borrar");
  process.exit(1);
}
ejecutar()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(process.exitCode ?? 0))
  .catch(async (error) => {
    console.error("[Lab] Fallo:", error?.error ?? error);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
