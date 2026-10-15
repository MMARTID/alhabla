import { describe, expect, it } from "vitest";
import {
  convertirEntrada,
  convertirPeticion,
  filtroDeLogs,
  filtroDePeticiones,
  leerLogsDeProd,
  leerPeticionesDeProd,
  literal,
} from "../../mcp/logsDeProd.js";

const AHORA = Date.parse("2026-10-15T12:00:00Z");

describe("filtroDeLogs", () => {
  it("por defecto: el servicio, la última hora, sin peticiones ni el ruido de Fastify", () => {
    expect(filtroDeLogs({}, AHORA)).toBe(
      [
        'resource.type="cloud_run_revision" AND resource.labels.service_name="alhabla-api"',
        'NOT logName:"run.googleapis.com%2Frequests"',
        'timestamp>="2026-10-15T11:00:00.000Z"',
        'NOT jsonPayload.msg="incoming request"',
        'NOT jsonPayload.msg="request completed"',
      ].join(" AND ")
    );
  });

  it("busca el texto en console.* y en el logger de Fastify a la vez", () => {
    const filtro = filtroDeLogs({ texto: "[Gestor]" }, AHORA);
    expect(filtro).toContain(
      '(textPayload:"[Gestor]" OR jsonPayload.msg:"[Gestor]" OR jsonPayload.err.message:"[Gestor]")'
    );
  });

  it("con varios textos basta con uno", () => {
    const filtro = filtroDeLogs({ texto: ["[Reaper]", "[Purga]"] }, AHORA);
    expect(filtro).toContain('textPayload:"[Reaper]" OR');
    expect(filtro).toContain('jsonPayload.msg:"[Purga]"');
  });

  it("escapa las comillas: un texto no puede cerrar el filtro", () => {
    expect(literal('a" OR "b')).toBe('"a\\" OR \\"b"');
    expect(
      filtroDeLogs({ texto: 'x" OR severity>=DEFAULT OR "' }, AHORA)
    ).toContain('textPayload:"x\\" OR severity>=DEFAULT OR \\""');
  });

  it("solo errores incluye stderr y el nivel de pino, porque console.error no trae severity", () => {
    expect(filtroDeLogs({ soloErrores: true }, AHORA)).toContain(
      '(severity>=WARNING OR logName:"run.googleapis.com%2Fstderr" OR jsonPayload.level>=40)'
    );
  });

  it("franja, revisión y ruido a petición", () => {
    const filtro = filtroDeLogs(
      {
        desde: "2026-10-14T00:14:00Z",
        hasta: "2026-10-14T00:20:00Z",
        revision: "alhabla-api-00251-xz7",
        incluirRuido: true,
      },
      AHORA
    );
    expect(filtro).toContain('timestamp>="2026-10-14T00:14:00.000Z"');
    expect(filtro).toContain('timestamp<="2026-10-14T00:20:00.000Z"');
    expect(filtro).toContain(
      'resource.labels.revision_name="alhabla-api-00251-xz7"'
    );
    expect(filtro).not.toContain("incoming request");
  });
});

describe("convertirEntrada", () => {
  it("console.log (stdout), console.error (stderr) y Fastify con su error y su petición", () => {
    expect(
      convertirEntrada({
        timestamp: "2026-10-15T11:30:27Z",
        logName: "projects/p/logs/run.googleapis.com%2Fstdout",
        textPayload: "[TelnyxReconciler] 2 agente(s) revisados, sin hallazgos.",
        resource: { labels: { revision_name: "alhabla-api-00251-xz7" } },
      })
    ).toEqual({
      hora: "2026-10-15T11:30:27Z",
      revision: "alhabla-api-00251-xz7",
      origen: "stdout",
      mensaje: "[TelnyxReconciler] 2 agente(s) revisados, sin hallazgos.",
    });

    expect(
      convertirEntrada({
        logName: "projects/p/logs/run.googleapis.com%2Fstderr",
        textPayload: "[Cerrojo] algo",
      }).origen
    ).toBe("stderr");

    expect(
      convertirEntrada({
        timestamp: "t",
        jsonPayload: {
          msg: "telnyx-health-check job failed",
          level: 50,
          err: { type: "Error", message: "boom" },
          req: { method: "POST", url: "/internal/jobs/telnyx-health-check" },
        },
      })
    ).toMatchObject({
      origen: "fastify",
      nivel: "error",
      mensaje: "telnyx-health-check job failed",
      error: "Error: boom",
      peticion: "POST /internal/jobs/telnyx-health-check",
    });
  });
});

describe("leerLogsDeProd", () => {
  it("pide JSON con el límite, devuelve en orden cronológico y enmascara teléfonos", async () => {
    const llamadas: string[][] = [];
    const resultado = await leerLogsDeProd(
      { texto: "[WhatsApp]", limite: 2 },
      {
        ahora: AHORA,
        gcloudFn: async (argumentos) => {
          llamadas.push(argumentos);
          return JSON.stringify([
            {
              timestamp: "2026-10-15T11:59:00Z",
              textPayload: "[WhatsApp] segundo a +34600123572",
            },
            {
              timestamp: "2026-10-15T11:58:00Z",
              textPayload: "[WhatsApp] primero",
            },
          ]);
        },
      }
    );
    expect(llamadas[0].slice(0, 2)).toEqual(["logging", "read"]);
    expect(llamadas[0]).toContain("--limit=2");
    expect(llamadas[0]).toContain("--format=json");
    expect(resultado.lineas.map((l) => l.mensaje)).toEqual([
      "[WhatsApp] primero",
      "[WhatsApp] segundo a +34••••••572",
    ]);
  });

  it("con mostrarTelefonos los deja tal cual", async () => {
    const resultado = await leerLogsDeProd(
      { mostrarTelefonos: true },
      {
        ahora: AHORA,
        gcloudFn: async () => JSON.stringify([{ textPayload: "+34600123572" }]),
      }
    );
    expect(resultado.lineas[0].mensaje).toBe("+34600123572");
  });
});

describe("peticiones", () => {
  it("por defecto quita /health, /internal/ y OPTIONS", () => {
    const filtro = filtroDePeticiones({}, AHORA);
    expect(filtro).toContain('logName:"run.googleapis.com%2Frequests"');
    expect(filtro).toContain('NOT httpRequest.requestUrl:"/health"');
    expect(filtro).toContain('NOT httpRequest.requestUrl:"/internal/"');
    expect(filtro).toContain('NOT httpRequest.requestMethod="OPTIONS"');
  });

  it("filtra por ruta, método y estado", () => {
    const filtro = filtroDePeticiones(
      {
        ruta: "/booking-settings/professionals",
        metodo: "patch",
        estadoMinimo: 400,
        incluirInternas: true,
      },
      AHORA
    );
    expect(filtro).toContain(
      'httpRequest.requestUrl:"/booking-settings/professionals"'
    );
    expect(filtro).toContain('httpRequest.requestMethod="PATCH"');
    expect(filtro).toContain("httpRequest.status>=400");
    expect(filtro).not.toContain("/health");
  });

  it("deja la ruta sin el dominio", async () => {
    expect(
      convertirPeticion({
        timestamp: "t",
        httpRequest: {
          requestMethod: "PATCH",
          requestUrl:
            "https://api.alhabla.ai/booking-settings/professionals/abc?x=1",
          status: 200,
          latency: "0.05s",
        },
        resource: { labels: { revision_name: "r" } },
      })
    ).toEqual({
      hora: "t",
      metodo: "PATCH",
      estado: 200,
      ruta: "/booking-settings/professionals/abc?x=1",
      latencia: "0.05s",
      revision: "r",
    });
    const { peticiones } = await leerPeticionesDeProd(
      {},
      { ahora: AHORA, gcloudFn: async () => "[]" }
    );
    expect(peticiones).toEqual([]);
  });
});
