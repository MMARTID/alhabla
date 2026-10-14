import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import Retell from "retell-sdk";
import { TelnyxAiAdapter } from "../../src/adapters/telnyx/TelnyxAiAdapter.js";
import { generarClavesDeSimulacion } from "../../mcp/firmas.js";
import {
  enviarWebhookRetell,
  enviarWebhookTelnyx,
  urlDeWebhook,
} from "../../mcp/webhooks.js";

// Un servidor HTTP de verdad en localhost hace de backend: así se prueba lo
// que el MCP manda por la red (ruta, cabeceras, cuerpo exacto), no un mock.

type Recibida = { ruta: string; cabeceras: IncomingHttpHeaders; cuerpo: string };
let recibidas: Recibida[] = [];
let servidor: Server;
let base: string;

beforeAll(async () => {
  servidor = createServer((req, res) => {
    let cuerpo = "";
    req.on("data", (trozo) => (cuerpo += trozo));
    req.on("end", () => {
      if (req.url === "/health") {
        res.writeHead(503).end('{"status":"degraded"}');
        return;
      }
      recibidas.push({ ruta: req.url ?? "", cabeceras: req.headers, cuerpo });
      res.writeHead(200, { "content-type": "application/json" }).end('{"ok":true}');
    });
  });
  await new Promise<void>((listo) => servidor.listen(0, "127.0.0.1", listo));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});

afterAll(() => {
  servidor.close();
});

beforeEach(() => {
  recibidas = [];
});

describe("urlDeWebhook", () => {
  it("acepta una ruta del prefijo", () => {
    expect(
      urlDeWebhook("/webhooks/telnyx/tools/check_availability", base, "/webhooks/telnyx")
        .pathname
    ).toBe("/webhooks/telnyx/tools/check_availability");
  });

  it.each([
    "/webhooks/telnyx/../../billing/webhook",
    "/webhooks/telnyx/%2e%2e/%2e%2e/auth/login",
    "/webhooks/telnyx\\..\\..\\billing",
    "/webhooks/telnyx-harness",
    "/billing/webhook",
  ])("rechaza %s: se mira la ruta YA resuelta, no el texto", (ruta) => {
    expect(() => urlDeWebhook(ruta, base, "/webhooks/telnyx")).toThrow(
      /tiene que quedar dentro de \/webhooks\/telnyx/
    );
  });

  it("rechaza una ruta que cambia de máquina", () => {
    expect(() =>
      urlDeWebhook("//api.alhabla.ai/webhooks/telnyx", base, "/webhooks/telnyx")
    ).toThrow(/acaba en https?:\/\/api\.alhabla\.ai/);
    expect(() =>
      urlDeWebhook("https://api.alhabla.ai/webhooks/retell", base, "/webhooks/retell")
    ).toThrow(/tiene que quedar dentro/);
  });

  it("rechaza una base que no es local", () => {
    expect(() =>
      urlDeWebhook("/webhooks/telnyx", "https://dev-api.alhabla.ai", "/webhooks/telnyx")
    ).toThrow(/no es local/);
  });
});

describe("enviarWebhookTelnyx", () => {
  const claves = generarClavesDeSimulacion();

  it("firma el cuerpo exacto que envía y la verificación del backend lo acepta", async () => {
    const resultado = await enviarWebhookTelnyx({
      ruta: "/webhooks/telnyx/tools/check_availability",
      cuerpo: { startDateTime: "2026-10-15T09:00:00Z", durationMinutes: 30 },
      baseUrl: base,
      clavePrivada: claves.privada,
    });
    expect(resultado.status).toBe(200);
    const [recibida] = recibidas;
    expect(recibida!.ruta).toBe("/webhooks/telnyx/tools/check_availability");

    const claveOriginal = process.env.TELNYX_PUBLIC_KEY;
    process.env.TELNYX_PUBLIC_KEY = claves.publica;
    try {
      await expect(
        new TelnyxAiAdapter().verifyWebhookSignature(
          recibida!.cuerpo,
          recibida!.cabeceras["telnyx-signature-ed25519"] as string,
          recibida!.cabeceras["telnyx-timestamp"] as string
        )
      ).resolves.toBe(true);
    } finally {
      if (claveOriginal === undefined) delete process.env.TELNYX_PUBLIC_KEY;
      else process.env.TELNYX_PUBLIC_KEY = claveOriginal;
    }
  });

  it("crea la llamada solo si no viene callControlId, y la manda en la cabecera", async () => {
    const crearLlamada = vi.fn().mockResolvedValue("sim-mcp-nueva");
    const nueva = await enviarWebhookTelnyx({
      ruta: "/webhooks/telnyx/tools/check_availability",
      cuerpo: {},
      baseUrl: base,
      clavePrivada: claves.privada,
      crearLlamada,
    });
    expect(nueva.llamada).toBe("sim-mcp-nueva");
    expect(recibidas[0]!.cabeceras["x-alhabla-call-control-id"]).toBe("sim-mcp-nueva");

    const misma = await enviarWebhookTelnyx({
      ruta: "/webhooks/telnyx/tools/book_appointment",
      cuerpo: {},
      baseUrl: base,
      clavePrivada: claves.privada,
      callControlId: "sim-mcp-nueva",
      crearLlamada,
    });
    expect(misma.llamada).toBe("sim-mcp-nueva");
    expect(crearLlamada).toHaveBeenCalledTimes(1);
    expect(recibidas[1]!.cabeceras["x-alhabla-call-control-id"]).toBe("sim-mcp-nueva");
  });

  it("unas cabeceras extra no pueden sustituir la firma", async () => {
    await enviarWebhookTelnyx({
      ruta: "/webhooks/telnyx",
      cuerpo: {},
      baseUrl: base,
      clavePrivada: claves.privada,
      cabeceras: { "telnyx-signature-ed25519": "falsa", "telnyx-timestamp": "1" },
    });
    expect(recibidas[0]!.cabeceras["telnyx-signature-ed25519"]).not.toBe("falsa");
    expect(recibidas[0]!.cabeceras["telnyx-timestamp"]).not.toBe("1");
  });

  it("con una ruta inválida no crea la llamada ni envía nada", async () => {
    const crearLlamada = vi.fn().mockResolvedValue("sim-mcp-x");
    await expect(
      enviarWebhookTelnyx({
        ruta: "/webhooks/telnyx/../../billing/webhook",
        cuerpo: {},
        baseUrl: base,
        clavePrivada: claves.privada,
        crearLlamada,
      })
    ).rejects.toThrow(/tiene que quedar dentro/);
    expect(crearLlamada).not.toHaveBeenCalled();
    expect(recibidas).toHaveLength(0);
  });

  it("sin backend escuchando lo dice claro, sin crear la llamada", async () => {
    const apagado = createServer();
    await new Promise<void>((listo) => apagado.listen(0, "127.0.0.1", listo));
    const puerto = (apagado.address() as AddressInfo).port;
    await new Promise((cerrado) => apagado.close(cerrado));

    const crearLlamada = vi.fn().mockResolvedValue("sim-mcp-x");
    await expect(
      enviarWebhookTelnyx({
        ruta: "/webhooks/telnyx/tools/check_availability",
        cuerpo: {},
        baseUrl: `http://127.0.0.1:${puerto}`,
        clavePrivada: claves.privada,
        crearLlamada,
      })
    ).rejects.toThrow(
      /No hay ningún backend respondiendo en http:\/\/127\.0\.0\.1:\d+ \(ECONNREFUSED\)\. Levanta el backend de simulación con scripts\/backend-sim\.sh/
    );
    expect(crearLlamada).not.toHaveBeenCalled();
  });
});

describe("enviarWebhookRetell", () => {
  it("firma con la API key y Retell.verify lo acepta", async () => {
    const resultado = await enviarWebhookRetell({
      ruta: "/webhooks/retell/inbound",
      cuerpo: { event: "call_inbound" },
      baseUrl: base,
      apiKey: "key_de_prueba",
    });
    expect(resultado.status).toBe(200);
    expect(resultado.respuesta).toEqual({ ok: true });
    const [recibida] = recibidas;
    await expect(
      Retell.verify(
        recibida!.cuerpo,
        "key_de_prueba",
        recibida!.cabeceras["x-retell-signature"] as string
      )
    ).resolves.toBe(true);
  });

  it("sin backend apunta al perfil dev", async () => {
    await expect(
      enviarWebhookRetell({
        ruta: "/webhooks/retell",
        cuerpo: {},
        baseUrl: "http://127.0.0.1:1",
        apiKey: "k",
      })
    ).rejects.toThrow(/docker compose --profile dev up -d/);
  });
});
