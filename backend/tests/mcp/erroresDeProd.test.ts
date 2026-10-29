import { describe, expect, it } from "vitest";
import {
  agruparErrores,
  leerErroresDeProd,
  normalizarMensaje,
} from "../../mcp/erroresDeProd.js";
import type { LineaDeLog } from "../../mcp/logsDeProd.js";

const AHORA = Date.parse("2026-10-29T12:00:00Z");

describe("normalizarMensaje", () => {
  it("cambia por marcadores lo que varía de una línea a otra del mismo error", () => {
    expect(
      normalizarMensaje(
        "[Telnyx] llamada v3:zHPiaAv_0kAmt1n3i77k5fFWJ9oelScC-TQx_x2NlSKtQh8HGOKmrw no existía en la base de datos al colgar"
      )
    ).toBe(
      "[Telnyx] llamada <llamada> no existía en la base de datos al colgar"
    );
    expect(
      normalizarMensaje(
        '[WhatsApp] Estado "delivery_unconfirmed" no reconocido en message.finalized para 4031a134-9819-46f4-800c-e53fd28979bd'
      )
    ).toBe(
      '[WhatsApp] Estado "delivery_unconfirmed" no reconocido en message.finalized para <uuid>'
    );
    expect(
      normalizarMensaje(
        "[Booking] Negocio cmu71ux6j0006s6012cfggjby: cita de +34600123456 (ana@example.com) el 2026-10-29T09:30:00.000Z, intento 12345"
      )
    ).toBe(
      "[Booking] Negocio <id>: cita de <tel> (<email>) el <fecha>, intento <n>"
    );
  });

  it("deja los números cortos y las palabras sin cifras", () => {
    expect(
      normalizarMensaje(
        "[Límite] La sentencia de 1 claves no ha vuelto a tiempo (plazo de 500 ms vencido)"
      )
    ).toBe(
      "[Límite] La sentencia de 1 claves no ha vuelto a tiempo (plazo de 500 ms vencido)"
    );
    expect(
      normalizarMensaje(
        "[TelnyxHealth] TELNYX_STATUS_COMPONENT_IDS no está configurado"
      )
    ).toBe("[TelnyxHealth] TELNYX_STATUS_COMPONENT_IDS no está configurado");
  });

  it("junta los espacios y los saltos de línea", () => {
    expect(normalizarMensaje("  a\n   b\tc ")).toBe("a b c");
  });
});

function linea(parcial: Partial<LineaDeLog>): LineaDeLog {
  return {
    hora: "2026-10-29T10:00:00Z",
    revision: "alhabla-api-00300-abc",
    origen: "stderr",
    mensaje: "",
    ...parcial,
  };
}

describe("agruparErrores", () => {
  it("cuenta por mensaje normalizado, con primera, última, revisiones y el ejemplo más reciente", () => {
    const grupos = agruparErrores([
      linea({
        hora: "2026-10-29T10:00:00Z",
        mensaje:
          "[Telnyx] llamada v3:aaaaaaaaaaaaaaaaaaaa1 no existía al colgar",
      }),
      linea({
        hora: "2026-10-29T11:00:00Z",
        revision: "alhabla-api-00301-def",
        mensaje:
          "[Telnyx] llamada v3:bbbbbbbbbbbbbbbbbbbb2 no existía al colgar",
      }),
      linea({
        hora: "2026-10-29T09:00:00Z",
        mensaje:
          "[Telnyx] llamada v3:cccccccccccccccccccc3 no existía al colgar",
      }),
      linea({
        hora: "2026-10-29T11:30:00Z",
        origen: "fastify",
        nivel: "error",
        mensaje: "send-sms job failed",
        error: "Error: 403 Forbidden\n    at algo",
      }),
    ]);
    expect(grupos).toEqual([
      {
        mensaje: "[Telnyx] llamada <llamada> no existía al colgar",
        veces: 3,
        primera: "2026-10-29T09:00:00Z",
        ultima: "2026-10-29T11:00:00Z",
        revisiones: {
          "alhabla-api-00300-abc": 2,
          "alhabla-api-00301-def": 1,
        },
        origen: "stderr",
        ejemplo:
          "[Telnyx] llamada v3:bbbbbbbbbbbbbbbbbbbb2 no existía al colgar",
      },
      {
        // El error de pino entra en el mensaje (solo su primera línea).
        mensaje: "send-sms job failed — Error: 403 Forbidden",
        veces: 1,
        primera: "2026-10-29T11:30:00Z",
        ultima: "2026-10-29T11:30:00Z",
        revisiones: { "alhabla-api-00300-abc": 1 },
        origen: "fastify",
        nivel: "error",
        ejemplo: "send-sms job failed — Error: 403 Forbidden",
      },
    ]);
  });

  it("a igualdad de veces, primero el que salió más tarde", () => {
    const grupos = agruparErrores([
      linea({ hora: "2026-10-29T08:00:00Z", mensaje: "viejo" }),
      linea({ hora: "2026-10-29T09:00:00Z", mensaje: "nuevo" }),
    ]);
    expect(grupos.map((grupo) => grupo.mensaje)).toEqual(["nuevo", "viejo"]);
  });
});

describe("leerErroresDeProd", () => {
  it("lee con el filtro de soloErrores, agrupa, enmascara y avisa si se llegó al límite", async () => {
    const llamadas: string[][] = [];
    const resultado = await leerErroresDeProd(
      { limiteEntradas: 2 },
      {
        ahora: AHORA,
        gcloudFn: async (argumentos) => {
          llamadas.push(argumentos);
          return JSON.stringify([
            {
              timestamp: "2026-10-29T11:00:00Z",
              logName: "projects/p/logs/run.googleapis.com%2Fstderr",
              textPayload:
                "[Telnyx] No hay negocio registrado para el número +34600123456",
              resource: { labels: { revision_name: "alhabla-api-00300-abc" } },
            },
            {
              timestamp: "2026-10-29T10:00:00Z",
              logName: "projects/p/logs/run.googleapis.com%2Fstderr",
              textPayload:
                "[Telnyx] No hay negocio registrado para el número +34600999888",
              resource: { labels: { revision_name: "alhabla-api-00300-abc" } },
            },
          ]);
        },
      }
    );
    const filtro = llamadas[0]![2]!;
    expect(filtro).toContain('timestamp>="2026-10-28T12:00:00.000Z"');
    expect(filtro).toContain('logName:"run.googleapis.com%2Fstderr"');
    expect(llamadas[0]).toContain("--limit=2");
    expect(llamadas[0]!.at(-1)).toMatch(/^--format=json\(timestamp,/);
    expect(resultado).toMatchObject({
      entradasLeidas: 2,
      truncado: true,
      totalGrupos: 1,
      grupos: [
        {
          mensaje: "[Telnyx] No hay negocio registrado para el número <tel>",
          veces: 2,
          ejemplo:
            "[Telnyx] No hay negocio registrado para el número +34••••••456",
        },
      ],
    });
  });
});
