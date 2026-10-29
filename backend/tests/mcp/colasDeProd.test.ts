import { describe, expect, it } from "vitest";
import {
  decodificarCuerpo,
  estadoDeTarea,
  resumirTarea,
  verColasDeProd,
} from "../../mcp/colasDeProd.js";

const AHORA = Date.parse("2026-10-29T12:00:00Z");

describe("colas de Cloud Tasks", () => {
  const RECORDATORIO = {
    name: "projects/p/locations/europe-west1/queues/send-whatsapp/tasks/booking-cmv1a1wyj006as601eexrt629-recordatorio-1796286600",
    createTime: "2026-10-09T18:06:55Z",
    scheduleTime: "2026-11-07T18:06:55Z",
    httpRequest: {
      httpMethod: "POST",
      url: "https://api.alhabla.ai/internal/jobs/send-whatsapp",
    },
  };

  it("clasifica las tareas: programada, en cola, atascada y reintentando", () => {
    expect(estadoDeTarea(RECORDATORIO, AHORA)).toBe("programada");
    expect(estadoDeTarea({ scheduleTime: "2026-10-29T11:58:00Z" }, AHORA)).toBe(
      "en_cola"
    );
    expect(estadoDeTarea({ scheduleTime: "2026-10-29T11:00:00Z" }, AHORA)).toBe(
      "atascada"
    );
    expect(
      estadoDeTarea(
        { scheduleTime: "2026-10-29T12:05:00Z", dispatchCount: "3" },
        AHORA
      )
    ).toBe("reintentando");
  });

  it("resume una tarea con su ruta y su último intento", () => {
    expect(resumirTarea(RECORDATORIO, "send-whatsapp", AHORA)).toEqual({
      id: "booking-cmv1a1wyj006as601eexrt629-recordatorio-1796286600",
      cola: "send-whatsapp",
      metodo: "POST",
      ruta: "/internal/jobs/send-whatsapp",
      estado: "programada",
      programadaPara: "2026-11-07T18:06:55Z",
      creada: "2026-10-09T18:06:55Z",
      intentos: 0,
      respuestas: 0,
    });
    const fallida = resumirTarea(
      {
        ...RECORDATORIO,
        dispatchCount: 2,
        responseCount: 2,
        lastAttempt: {
          dispatchTime: "2026-10-29T11:59:00Z",
          responseTime: "2026-10-29T11:59:01Z",
          responseStatus: { code: 14, message: "UNAVAILABLE" },
        },
      },
      "send-whatsapp",
      AHORA
    );
    expect(fallida.estado).toBe("reintentando");
    expect(fallida.ultimoIntento).toEqual({
      despachado: "2026-10-29T11:59:00Z",
      respondido: "2026-10-29T11:59:01Z",
      codigo: 14,
      nombre: "UNAVAILABLE",
      http: 503,
      mensaje: "UNAVAILABLE",
    });
    // Si el mensaje trae el estado HTTP, manda ese.
    expect(
      resumirTarea(
        {
          lastAttempt: {
            responseStatus: { code: 2, message: "HTTP status code 502" },
          },
        },
        "send-email",
        AHORA
      ).ultimoIntento?.http
    ).toBe(502);
  });

  it("decodifica el cuerpo: JSON si lo es; si no, texto recortado", () => {
    const json = Buffer.from(
      '{"proposito":"recordatorio","saltos":0}'
    ).toString("base64");
    expect(decodificarCuerpo(json)).toEqual({
      proposito: "recordatorio",
      saltos: 0,
    });
    expect(decodificarCuerpo(Buffer.from("hola").toString("base64"))).toBe(
      "hola"
    );
    expect(
      decodificarCuerpo(Buffer.from("x".repeat(2_500)).toString("base64"))
    ).toMatch(/… \(2500 caracteres\)$/);
    expect(decodificarCuerpo(undefined)).toBeNull();
  });

  it("lista todas las colas, ordena por fecha y lee el cuerpo enmascarado con conCuerpo", async () => {
    const llamadas: string[][] = [];
    const resultado = await verColasDeProd(
      { conCuerpo: true },
      {
        ahora: AHORA,
        gcloudFn: async (argumentos) => {
          llamadas.push(argumentos);
          const comando = argumentos.slice(0, 3).join(" ");
          if (comando === "tasks queues list") {
            return JSON.stringify([
              { name: "projects/p/queues/send-whatsapp", state: "RUNNING" },
              { name: "projects/p/queues/send-email", state: "RUNNING" },
            ]);
          }
          if (comando === "tasks list --queue=send-whatsapp") {
            return JSON.stringify([RECORDATORIO]);
          }
          if (comando === "tasks list --queue=send-email") {
            return JSON.stringify([
              {
                name: "projects/p/queues/send-email/tasks/123",
                scheduleTime: "2026-10-29T11:00:00Z",
                httpRequest: {
                  httpMethod: "POST",
                  url: "https://api.alhabla.ai/internal/jobs/send-email",
                },
              },
            ]);
          }
          if (comando.startsWith("tasks describe")) {
            return JSON.stringify({
              httpRequest: {
                body: Buffer.from(
                  JSON.stringify({ toNumber: "+34600123456" })
                ).toString("base64"),
              },
            });
          }
          throw new Error(`inesperado: ${comando}`);
        },
      }
    );
    expect(resultado.colas).toEqual([
      {
        cola: "send-whatsapp",
        estado: "RUNNING",
        tareas: 1,
        porEstado: { programada: 1 },
      },
      {
        cola: "send-email",
        estado: "RUNNING",
        tareas: 1,
        porEstado: { atascada: 1 },
      },
    ]);
    expect(resultado.tareas.map((tarea) => tarea.id)).toEqual([
      "123",
      "booking-cmv1a1wyj006as601eexrt629-recordatorio-1796286600",
    ]);
    expect(resultado.tareas[0]!.cuerpo).toEqual({ toNumber: "+34••••••456" });
    const describe = llamadas.find((a) => a[1] === "describe")!;
    expect(describe).toEqual([
      "tasks",
      "describe",
      "123",
      "--queue=send-email",
      "--location=europe-west1",
      "--response-view=full",
      "--format=json(httpRequest.body)",
    ]);
  });

  it("no acepta un nombre de cola que no lo es", async () => {
    await expect(
      verColasDeProd(
        { cola: "send-sms --project=otro" },
        {
          gcloudFn: async () => {
            throw new Error("no debería llamarse");
          },
        }
      )
    ).rejects.toThrow(/no es un nombre de cola/);
  });
});
