import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { tablasDePrisma } from "../../mcp/esquema.js";
import {
  buscarEnJson,
  resumirAssistant,
  resumirMensajes,
  verAssistant,
  verConversacion,
} from "../../mcp/telnyx.js";

// Con la forma de la respuesta real de GET /v2/ai/assistants/{id} (15-10).
const ASSISTANT = {
  id: "assistant-8d996b50",
  name: "INFINITY Hair Salon",
  model: "gpt-5.6-luna",
  version_id: "v-1",
  greeting: "Hola, soy la recepcionista con IA de INFINITY.",
  instructions: "x".repeat(5000),
  tools: [
    {
      tool_id: "tool-1",
      type: "webhook",
      timeout_ms: 20000,
      webhook: {
        name: "get_catalog",
        url: "https://api.alhabla.ai/webhooks/telnyx/tools/get_catalog",
        method: "POST",
      },
    },
    { type: "hangup", hangup: { description: "Cuelga" } },
  ],
  voice_settings: { voice: "Telnyx.Ultra.x" },
  transcription: {
    model: "soniox",
    settings: { context: "Corte,Mechas,Marta,Pedro,Sergio" },
  },
  dynamic_variables: { nombre_cliente: "", ultimo_servicio: "" },
  dynamic_variables_webhook_url:
    "https://api.alhabla.ai/webhooks/telnyx/dynamic",
  conversation_flow: {
    nodes: [
      { id: "inicio", type: "conversation" },
      {
        id: "catalan",
        type: "conversation",
        voice_settings: { voice: "Soniox.tts-rt-v2.Sergio" },
      },
    ],
  },
  telephony_settings: {
    recording_settings: { format: "mp3", channels: "dual" },
  },
};

describe("resumirAssistant", () => {
  it("resume tools, flujo, transcripción y grabación sin las instrucciones enteras", () => {
    const resumen = resumirAssistant(ASSISTANT);
    expect(resumen.instrucciones.caracteres).toBe(5000);
    expect(resumen.instrucciones.inicio.length).toBeLessThan(400);
    expect(resumen.tools).toEqual([
      {
        tipo: "webhook",
        nombre: "get_catalog",
        url: "https://api.alhabla.ai/webhooks/telnyx/tools/get_catalog",
        metodo: "POST",
        timeoutMs: 20000,
      },
      { tipo: "hangup", nombre: "hangup" },
    ]);
    expect(resumen.variablesDinamicas).toEqual([
      "nombre_cliente",
      "ultimo_servicio",
    ]);
    expect(resumen.flujo).toEqual([
      { id: "inicio", tipo: "conversation" },
      { id: "catalan", tipo: "conversation", voz: "Soniox.tts-rt-v2.Sergio" },
    ]);
    expect(resumen.grabacion).toEqual({ format: "mp3", channels: "dual" });
  });
});

describe("buscarEnJson", () => {
  it("encuentra un texto en cualquier rincón, sin mayúsculas, con contexto", () => {
    expect(buscarEnJson(ASSISTANT, "sergio", { contexto: 6 })).toEqual([
      { ruta: "transcription.settings.context", fragmento: "…Pedro,Sergio" },
      {
        ruta: "conversation_flow.nodes[1].voice_settings.voice",
        fragmento: "…rt-v2.Sergio",
      },
    ]);
  });
});

describe("resumirMensajes", () => {
  const MENSAJES = [
    {
      role: "assistant",
      created_at: "2026-10-13T17:00:07Z",
      tool_calls: [
        {
          function: {
            name: "proponer_accion",
            arguments: '{"tipo":"marcar_ausencia"}',
          },
        },
      ],
    },
    {
      role: "user",
      created_at: "2026-10-13T17:00:03Z",
      text: "Laura no viene el viernes",
    },
    {
      role: "tool",
      created_at: "2026-10-13T17:00:07.5Z",
      text: '{"ok":true}',
      tool_call_id: "c1",
    },
  ];

  it("los ordena y saca las tools con sus argumentos ya como JSON", () => {
    expect(resumirMensajes(MENSAJES)).toEqual([
      {
        hora: "2026-10-13T17:00:03Z",
        rol: "user",
        texto: "Laura no viene el viernes",
      },
      {
        hora: "2026-10-13T17:00:07Z",
        rol: "assistant",
        tools: [
          {
            nombre: "proponer_accion",
            argumentos: { tipo: "marcar_ausencia" },
          },
        ],
      },
      { hora: "2026-10-13T17:00:07.5Z", rol: "tool", texto: '{"ok":true}' },
    ]);
  });

  it("sin los resultados de las tools si se pide", () => {
    expect(
      resumirMensajes(MENSAJES, { conResultadosDeTools: false }).map(
        (m) => m.rol
      )
    ).toEqual(["user", "assistant"]);
  });
});

describe("verAssistant y verConversacion (dev, con fetch falso)", () => {
  const CLAVE = "clave-de-prueba-que-no-debe-salir";
  let envAnterior: string | undefined;

  beforeAll(() => {
    envAnterior = process.env.ALHABLA_ENV_FILE;
    const dir = mkdtempSync(join(tmpdir(), "mcp-telnyx-"));
    const ruta = join(dir, ".env");
    writeFileSync(ruta, `TELNYX_API_KEY=${CLAVE}\n`);
    process.env.ALHABLA_ENV_FILE = ruta;
  });

  afterAll(() => {
    if (envAnterior === undefined) delete process.env.ALHABLA_ENV_FILE;
    else process.env.ALHABLA_ENV_FILE = envAnterior;
  });

  it("verAssistant usa la clave en la cabecera, no la devuelve y busca dentro", async () => {
    const pedidas: { url: string; auth: string | null }[] = [];
    const fetchFn = (async (url: string, init?: RequestInit) => {
      pedidas.push({
        url,
        auth: new Headers(init?.headers).get("authorization"),
      });
      return new Response(JSON.stringify(ASSISTANT), { status: 200 });
    }) as typeof fetch;

    const resultado = await verAssistant(
      { entorno: "dev", assistantId: "assistant-8d996b50", buscar: "Marta" },
      { fetchFn }
    );
    expect(pedidas).toEqual([
      {
        url: "https://api.telnyx.com/v2/ai/assistants/assistant-8d996b50",
        auth: `Bearer ${CLAVE}`,
      },
    ]);
    expect(JSON.stringify(resultado)).not.toContain(CLAVE);
    expect(resultado.coincidencias).toEqual([
      expect.objectContaining({ ruta: "transcription.settings.context" }),
    ]);
  });

  it("un id raro no llega a la URL", async () => {
    await expect(
      verAssistant(
        { entorno: "dev", assistantId: "../numbers" },
        { fetchFn: (async () => new Response("{}")) as typeof fetch }
      )
    ).rejects.toThrow(/no parece un id/);
  });

  it("verConversacion lee todas las páginas, se queda con los últimos y enmascara teléfonos", async () => {
    const fetchFn = (async (url: string) => {
      if (url.endsWith("/conversations/conv-1")) {
        return new Response(
          JSON.stringify({
            data: {
              name: "whatsapp:gestor:biz",
              created_at: "c",
              metadata: { role: "owner" },
            },
          })
        );
      }
      const pagina = Number(new URL(url).searchParams.get("page[number]"));
      // Telnyx pagina de la más reciente a la más antigua.
      const datos =
        pagina === 1
          ? [
              {
                role: "user",
                created_at: "2026-10-13T17:00:03Z",
                text: "llama a +34600123572",
              },
            ]
          : [
              {
                role: "user",
                created_at: "2026-10-12T10:00:00Z",
                text: "antiguo",
              },
            ];
      return new Response(
        JSON.stringify({ data: datos, meta: { total_pages: 2 } })
      );
    }) as typeof fetch;

    const resultado = await verConversacion(
      { entorno: "dev", conversationId: "conv-1", ultimos: 1 },
      { fetchFn }
    );
    expect(resultado.totalDeMensajes).toBe(2);
    expect(resultado.conversacion).toMatchObject({
      nombre: "whatsapp:gestor:biz",
    });
    expect(resultado.mensajes).toEqual([
      {
        hora: "2026-10-13T17:00:03Z",
        rol: "user",
        texto: "llama a +34••••••572",
      },
    ]);
  });
});

describe("tablasDePrisma", () => {
  it("traduce los modelos del schema.prisma real a sus tablas", () => {
    const tablas = tablasDePrisma(
      readFileSync(
        new URL("../../prisma/schema.prisma", import.meta.url),
        "utf8"
      )
    );
    expect(tablas.get("bookings")).toBe("Booking");
    expect(tablas.get("claves_temporales")).toBe("ClaveTemporal");
    expect(tablas.get("salud_telnyx")).toBe("SaludTelnyx");
    expect(tablas.get("owner_pending_actions")).toBe("OwnerPendingAction");
  });

  it("sin @@map, la tabla se llama como el modelo", () => {
    expect(tablasDePrisma("model Foo {\n  id String @id\n}\n").get("Foo")).toBe(
      "Foo"
    );
  });
});
