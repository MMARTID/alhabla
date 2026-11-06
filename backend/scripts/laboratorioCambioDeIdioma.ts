/**
 * Laboratorio del cambio de assistant por idioma (lib/cambioDeIdioma.ts) con
 * llamadas reales en dev, tal como va a producción: sin
 * `in_transit_data_locality`, con los assistants que crea syncAgentToTelnyx
 * para un negocio de zona cooficial (el de llamadas con flux y la voz Ultra,
 * y el de la lengua con Soniox y Marta).
 *
 * Historia: la primera versión (rama lab/assistant-ue-catalan, 06-11) creaba
 * sus propios assistants con la garantía de la UE y midió que el cambio
 * funciona (~1,4 s parar y arrancar), pero con un hueco de 9–12 s, el
 * cliente repitiendo lo que había pedido, el de flux llamando a tools
 * después de cambiar y un 500 al parar. Esta mide los arreglos.
 *
 * Solo toca dev: el agente de «Peluquería Mallorca» (+34930453236, en
 * Barcelona). Las llamadas salen del +34930453237 con un cliente simulado
 * que habla el idioma de la prueba (voz y transcripción de Soniox, que
 * hablan y entienden todos). Antes de cada llamada se quita el idioma
 * guardado de ese número, para que no conteste ya en el de la lengua.
 * Necesita que el backend de dev corra esta rama (MCP ver_en_dev).
 *
 * Uso (desde backend/; la BD de dev en localhost:5432):
 *   DB="postgresql://postgres:postgres@localhost:5432/botbook"
 *   DATABASE_URL=$DB npx tsx --env-file=../../../../.env scripts/laboratorioCambioDeIdioma.ts preparar
 *   … llamar es|ca|gl|eu|en|fr [--escenario conocido]
 *   … medir [--desde ISO]
 *   … restaurar
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { prisma } from "../src/lib/prisma.js";
import { getTelnyxClient } from "../src/lib/telnyx.js";
import { telnyxAiAdapter } from "../src/adapters/telnyx/TelnyxAiAdapter.js";
import { syncAgentToTelnyx } from "../src/lib/telnyxAgentSync.js";
import { getPublicWebhookBaseUrl } from "../src/lib/serverUrl.js";

const NEGOCIO_DE_DEV = "cmuiit0yn0000oi1xfrldp7kf"; // Peluquería Mallorca
const NUMERO_DEL_NEGOCIO = "+34930453236";
const NUMERO_DEL_CLIENTE = "+34930453237";
const CARPETA = join(homedir(), ".alhabla-laboratorio");
const ESTADO = join(CARPETA, "cambio-de-idioma-produccion.json");
const NOMBRE_DEL_CLIENTE = "alhabla-lab-cliente-idiomas";
const VOZ_DEL_CLIENTE = "Soniox.tts-rt-v2.Sergio";
const DURACION_MAXIMA_S = 150;

interface Estado {
  creadoEn: string;
  agentId: string;
  agenteActivoAntes: boolean;
  cliente: string;
  idiomasAntes?: Record<string, { idioma: string | null; idiomaAt: string | null }>;
}

type Json = Record<string, any>;

const IDIOMAS_DE_PRUEBA: Record<string, { iso: string; persona: string }> = {
  es: {
    iso: "es",
    persona:
      "Te llamas Jordi. Hablas SOLO en castellano. Llamas a una peluquería para pedir hora para cortarte el pelo mañana por la tarde. Di lo que quieres en tu primera frase.",
  },
  ca: {
    iso: "ca",
    persona:
      "Et dius Jordi. Parles NOMÉS en català, mai en castellà. Truques a una perruqueria per demanar hora per tallar-te els cabells demà a la tarda. Digues què vols a la primera frase, per exemple «Bon dia, voldria hora per tallar-me els cabells demà a la tarda».",
  },
  gl: {
    iso: "gl",
    persona:
      "Chámaste Xurxo. Falas SÓ en galego, nunca en castelán. Chamas a unha perruquería para pedir hora para cortar o pelo mañá pola tarde. Di o que queres na primeira frase, por exemplo «Bos días, quería hora para cortar o pelo mañá pola tarde».",
  },
  eu: {
    iso: "eu",
    persona:
      "Zure izena Jon da. EUSKARAZ BAKARRIK hitz egiten duzu, inoiz ez gaztelaniaz. Ile-apaindegi batera deitzen duzu bihar arratsaldean ilea mozteko txanda eskatzeko. Lehen esaldian esan zer nahi duzun, adibidez «Kaixo, egun on, bihar arratsalderako txanda nahi nuke ilea mozteko».",
  },
  en: {
    iso: "en",
    persona:
      "Your name is John. You speak ONLY English. You are calling a hair salon to book a haircut tomorrow afternoon. Say what you want in your first sentence.",
  },
  fr: {
    iso: "fr",
    persona:
      "Tu t'appelles Jean. Tu parles UNIQUEMENT français. Tu appelles un salon de coiffure pour prendre rendez-vous pour une coupe demain après-midi. Dis ce que tu veux dès ta première phrase.",
  },
};

const CIERRE_DE_LA_PERSONA =
  " Si te ofrecen una hora, acéptala. Si te piden el nombre, dalo. Si te preguntan si se puede grabar la llamada, di que no. Si te preguntan por WhatsApp, di que no. Cuando la cita esté reservada o te digan que no se puede, despídete y cuelga con la herramienta de colgar. Contesta corto, como una persona por teléfono.";

function soloDev(): void {
  const url = process.env.DATABASE_URL ?? "";
  if (process.env.NODE_ENV === "production" || !/@(localhost|127\.0\.0\.1):5432\/botbook/.test(url)) {
    throw new Error("Solo contra la BD de dev (botbook en localhost:5432).");
  }
}

function leerEstado(): Estado {
  if (!existsSync(ESTADO)) throw new Error(`No hay laboratorio preparado (${ESTADO}). Ejecuta «preparar».`);
  return JSON.parse(readFileSync(ESTADO, "utf8")) as Estado;
}

function guardarEstado(estado: Estado): void {
  mkdirSync(CARPETA, { recursive: true });
  writeFileSync(ESTADO, JSON.stringify(estado, null, 2));
}

async function agenteDeDev() {
  return prisma.agent.findFirstOrThrow({
    where: { businessId: NEGOCIO_DE_DEV, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      active: true,
      telnyxAssistantId: true,
      telnyxCooficialAssistantId: true,
      telnyxSyncError: true,
    },
  });
}

async function preparar(): Promise<void> {
  soloDev();
  const client: any = getTelnyxClient();
  const agente = await agenteDeDev();
  const anterior = existsSync(ESTADO) ? leerEstado() : null;
  await prisma.agent.update({ where: { id: agente.id }, data: { active: true } });
  // Con el código de esta rama: crea el de la lengua y quita el nodo.
  await syncAgentToTelnyx(NEGOCIO_DE_DEV);
  const despues = await agenteDeDev();
  if (despues.telnyxSyncError) throw new Error(`La sincronización falló: ${despues.telnyxSyncError}`);
  for (const [cual, id] of [
    ["llamadas", despues.telnyxAssistantId],
    ["lengua", despues.telnyxCooficialAssistantId],
  ] as const) {
    if (!id) throw new Error(`Falta el assistant de ${cual}`);
    const a: Json = await client.ai.assistants.retrieve(id);
    console.log(
      `[Lab] ${cual}: ${id} · stt ${a.transcription?.model}/${a.transcription?.language} · voz ${a.voice_settings?.voice} · nodos ${a.conversation_flow?.nodes?.length ?? 0} · cambiar_de_idioma ${(a.tools ?? []).some((t: Json) => t.webhook?.name === "cambiar_de_idioma")}`
    );
  }

  let cliente = anterior?.cliente;
  if (!cliente) {
    const creado: Json = await client.ai.assistants.create({
      name: NOMBRE_DEL_CLIENTE,
      instructions: "Eres un cliente simulado.",
      greeting: "",
      model: "zai-org/GLM-5.3-Flash",
      voice_settings: { voice: VOZ_DEL_CLIENTE, language: "es" },
      transcription: { model: "soniox/stt-rt-v5", language: "auto", settings: { language_hints: ["es"] } },
      telephony_settings: { time_limit_secs: DURACION_MAXIMA_S, user_idle_timeout_secs: 25 },
      tools: [{ type: "hangup", hangup: { description: "Cuelga la llamada cuando te has despedido." } }],
      privacy_settings: { data_retention: true },
    });
    cliente = creado.id as string;
    console.log(`[Lab] Cliente simulado: ${cliente}`);
  }
  guardarEstado({
    creadoEn: anterior?.creadoEn ?? new Date().toISOString(),
    agentId: agente.id,
    agenteActivoAntes: anterior?.agenteActivoAntes ?? agente.active,
    cliente,
    idiomasAntes: anterior?.idiomasAntes,
  });
}

/** Quita el idioma guardado del número del cliente simulado (si no, la
 * llamada empezaría ya en el assistant de la lengua). Se devuelve al
 * restaurar. */
async function sinIdioma(estado: Estado): Promise<Estado> {
  const ficha = await prisma.clienteDelNegocio.findFirst({
    where: { businessId: NEGOCIO_DE_DEV, telefono: NUMERO_DEL_CLIENTE },
    select: { id: true, idioma: true, idiomaAt: true },
  });
  if (!ficha) return estado;
  const idiomasAntes = { ...(estado.idiomasAntes ?? {}) };
  if (!(ficha.id in idiomasAntes)) {
    idiomasAntes[ficha.id] = { idioma: ficha.idioma, idiomaAt: ficha.idiomaAt?.toISOString() ?? null };
  }
  await prisma.clienteDelNegocio.update({ where: { id: ficha.id }, data: { idioma: null, idiomaAt: null } });
  const nuevo = { ...estado, idiomasAntes };
  guardarEstado(nuevo);
  if (ficha.idioma) console.log(`[Lab] ${NUMERO_DEL_CLIENTE}: idioma guardado (${ficha.idioma}) quitado.`);
  return nuevo;
}

async function llamar(clave: string | undefined, conocido: boolean): Promise<void> {
  soloDev();
  const prueba = IDIOMAS_DE_PRUEBA[clave ?? ""];
  if (!prueba) throw new Error(`llamar ${Object.keys(IDIOMAS_DE_PRUEBA).join("|")} [--escenario conocido]`);
  let estado = leerEstado();
  if (conocido) {
    // Quien ya habló en la lengua: la llamada debe empezar en su assistant.
    await prisma.clienteDelNegocio.updateMany({
      where: { businessId: NEGOCIO_DE_DEV, telefono: NUMERO_DEL_CLIENTE },
      data: { idioma: `${prueba.iso}-ES`, idiomaAt: new Date() },
    });
  } else {
    estado = await sinIdioma(estado);
  }
  const connectionId = process.env.TELNYX_CALL_CONTROL_APP_ID;
  const baseUrl = getPublicWebhookBaseUrl();
  if (!connectionId || !baseUrl) throw new Error("Faltan TELNYX_CALL_CONTROL_APP_ID o BASE_URL.");
  const client: any = getTelnyxClient();
  const desde = new Date();
  const respuesta: Json = await client.calls.dial({
    connection_id: connectionId,
    from: NUMERO_DEL_CLIENTE,
    to: NUMERO_DEL_NEGOCIO,
    webhook_url: `${baseUrl.replace(/\/$/, "")}/webhooks/telnyx-harness`,
    time_limit_secs: DURACION_MAXIMA_S,
    assistant: {
      id: estado.cliente,
      instructions: prueba.persona + CIERRE_DE_LA_PERSONA,
      voice_settings: { voice: VOZ_DEL_CLIENTE, language: prueba.iso },
      transcription: {
        model: "soniox/stt-rt-v5",
        language: "auto",
        settings: { language_hints: [...new Set([prueba.iso, "es"])] },
      },
    },
  });
  console.log(`[Lab] Llamada en ${clave}${conocido ? " (cliente que ya habló en ella)" : ""}: ${respuesta.data?.call_control_id}`);

  // Hasta que cuelgue y terminen todas sus conversaciones.
  const limite = Date.now() + (DURACION_MAXIMA_S + 90) * 1000;
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const call = await prisma.call.findFirst({
      where: { businessId: NEGOCIO_DE_DEV, startedAt: { gte: desde }, fromNumber: NUMERO_DEL_CLIENTE },
      orderBy: { startedAt: "desc" },
      select: { status: true, assistantsArrancados: true, conversacionesDeTelnyx: true },
    });
    const terminada =
      call &&
      call.status !== "IN_PROGRESS" &&
      call.conversacionesDeTelnyx.length >= call.assistantsArrancados;
    if (terminada || Date.now() > limite) break;
  }
  await new Promise((resolve) => setTimeout(resolve, 8000));
  await medir(desde.toISOString());
}

function mediana(xs: number[]): number | null {
  if (!xs.length) return null;
  const o = [...xs].sort((a, b) => a - b);
  return o[Math.floor(o.length / 2)];
}

const cuando = (m: Json) => new Date(m.sent_at ?? m.created_at).getTime();

async function medir(desde: string | undefined): Promise<void> {
  soloDev();
  const estado = leerEstado();
  const client: any = getTelnyxClient();
  const agente = await agenteDeDev();
  const nombres: Record<string, string> = {};
  if (agente.telnyxAssistantId) nombres[agente.telnyxAssistantId] = "flux";
  if (agente.telnyxCooficialAssistantId) nombres[agente.telnyxCooficialAssistantId] = "lengua";
  const llamadas = await prisma.call.findMany({
    where: {
      businessId: NEGOCIO_DE_DEV,
      fromNumber: NUMERO_DEL_CLIENTE,
      createdAt: { gte: new Date(desde ?? estado.creadoEn) },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      callId: true,
      status: true,
      durationSecs: true,
      createdAt: true,
      assistantsArrancados: true,
      conversacionesDeTelnyx: true,
      transcript: { select: { fullText: true } },
    },
  });
  if (!llamadas.length) console.log("[Lab] Ninguna llamada todavía.");
  for (const llamada of llamadas) {
    const conversaciones = await telnyxAiAdapter.conversacionesDeLaLlamada(llamada.callId);
    console.log(
      `\n=== ${llamada.createdAt.toISOString()} · ${llamada.status} · ${llamada.durationSecs ?? "?"} s · ${conversaciones.length} conversación(es) en Telnyx · ${llamada.conversacionesDeTelnyx.length}/${llamada.assistantsArrancados} en la Call`
    );
    let ultimaDelCliente: number | null = null;
    let cambioPedido: number | null = null;
    for (const conv of conversaciones) {
      const quien = nombres[conv.assistantId ?? ""] ?? conv.assistantId ?? "?";
      const r: Json = await client.ai.conversations.messages.list(conv.id);
      const mensajes: Json[] = [...(r.data ?? [])].sort((a, b) => cuando(a) - cuando(b));
      const esperas: number[] = [];
      let toolsTrasElCambio = 0;
      let cambiado = false;
      const primeraHablada = mensajes.find((m) => m.role === "assistant" && String(m.text ?? "").trim());
      if (cambioPedido && primeraHablada) {
        console.log(
          `  ⇢ cambio a ${quien}: ${cuando(primeraHablada) - (ultimaDelCliente ?? cambioPedido)} ms desde la última frase del cliente (${cuando(primeraHablada) - cambioPedido} ms desde la tool)`
        );
      }
      for (const m of mensajes) {
        const md = m.metadata ?? {};
        const texto = String(m.text ?? "").replace(/\s+/g, " ").slice(0, 160);
        if (m.role === "user") ultimaDelCliente = cuando(m);
        if (m.role === "assistant" && typeof md.end_user_perceived_latency_ms === "number") {
          esperas.push(md.end_user_perceived_latency_ms);
        }
        const tools = (m.tool_calls ?? []).map((t: Json) => `${t.function?.name}(${String(t.function?.arguments ?? "").slice(0, 200)})`);
        if (cambiado && tools.length) toolsTrasElCambio += tools.length;
        if (tools.some((t: string) => t.startsWith("cambiar_de_idioma"))) {
          cambiado = true;
          cambioPedido = cuando(m);
        }
        if (m.role === "system" && /ended/.test(texto)) continue;
        const lat =
          typeof md.end_user_perceived_latency_ms === "number"
            ? ` [${md.end_user_perceived_latency_ms} ms · stt ${md.transcription_duration_ms ?? "?"} · llm ${md.llm_first_token_duration_ms ?? "?"} · voz ${md.audio_first_token_duration_ms ?? "?"}]`
            : "";
        console.log(`  ${String(m.role).padEnd(9)} ${quien.padEnd(6)} ${texto}${tools.length ? ` → ${tools.join(", ")}` : ""}${lat}`);
      }
      console.log(
        `  → ${quien}: ${mensajes.length} mensajes; espera p50 ${mediana(esperas) ?? "-"} ms en ${esperas.length} turnos${cambiado ? `; tools tras cambiar_de_idioma: ${toolsTrasElCambio}` : ""}`
      );
    }
    console.log(`  --- transcripción guardada (${llamada.transcript?.fullText.split("\n").length ?? 0} líneas):`);
    console.log(
      (llamada.transcript?.fullText ?? "(ninguna)")
        .split("\n")
        .filter((linea) => /^(user|assistant): *\S/.test(linea))
        .map((linea) => `    ${linea.slice(0, 160)}`)
        .join("\n")
    );
  }
}

async function restaurar(): Promise<void> {
  soloDev();
  const estado = leerEstado();
  const client: any = getTelnyxClient();
  const agente = await agenteDeDev();
  for (const [id, antes] of Object.entries(estado.idiomasAntes ?? {})) {
    await prisma.clienteDelNegocio.update({
      where: { id },
      data: { idioma: antes.idioma, idiomaAt: antes.idiomaAt ? new Date(antes.idiomaAt) : null },
    });
    console.log(`[Lab] Idioma del cliente ${id} devuelto (${antes.idioma ?? "ninguno"}).`);
  }
  // El de la lengua no existe en main: se borra, y el hash se olvida para
  // que la siguiente sincronización (con main) devuelva el de llamadas a
  // como estaba.
  if (agente.telnyxCooficialAssistantId) {
    await client.ai.assistants.delete(agente.telnyxCooficialAssistantId).catch((e: any) =>
      console.error(`[Lab] No se pudo borrar ${agente.telnyxCooficialAssistantId}: ${e?.message ?? e}`)
    );
    await telnyxAiAdapter.deleteTexmlAppOfAssistant(agente.telnyxCooficialAssistantId).catch(() => 0);
  }
  await prisma.agent.update({
    where: { id: estado.agentId },
    data: {
      active: estado.agenteActivoAntes,
      telnyxCooficialAssistantId: null,
      telnyxCooficialConfigHash: null,
      telnyxConfigHash: null,
    },
  });
  await client.ai.assistants.delete(estado.cliente).catch(() => {});
  await telnyxAiAdapter.deleteTexmlAppOfAssistant(estado.cliente).catch(() => 0);
  rmSync(ESTADO);
  console.log(
    `[Lab] Restaurado: agente activo=${estado.agenteActivoAntes}. Falta sincronizar el de llamadas con main (dev en main y scripts/syncTelnyxAssistants.ts).`
  );
}

const [orden, arg] = process.argv.slice(2);
const opcion = (nombre: string) =>
  process.argv.includes(`--${nombre}`) ? process.argv[process.argv.indexOf(`--${nombre}`) + 1] : undefined;
const ordenes: Record<string, () => Promise<void>> = {
  preparar,
  llamar: () => llamar(arg, opcion("escenario") === "conocido"),
  medir: () => medir(opcion("desde")),
  restaurar,
};
const ejecutar = ordenes[orden ?? ""];
if (!ejecutar) {
  console.error("Uso: laboratorioCambioDeIdioma.ts preparar | llamar <idioma> [--escenario conocido] | medir [--desde ISO] | restaurar");
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
