import { describe, expect, it } from "vitest";
import {
  estadoDeProd,
  resumirJobs,
  resumirServicio,
} from "../../mcp/estadoDeProd.js";
import {
  JOBS_QUE_NO,
  JOBS_QUE_SE_PUEDEN_LANZAR,
  lanzarJobDeProd,
} from "../../mcp/jobsDeProd.js";

const SERVICIO = {
  metadata: { annotations: { "run.googleapis.com/maxScale": "11" } },
  spec: {
    template: {
      metadata: { annotations: { "autoscaling.knative.dev/maxScale": "20" } },
      spec: {
        containers: [
          {
            image:
              "europe-west1-docker.pkg.dev/p/alhabla/backend:eb0402e044ee6b12ca1d94b3169d0aa7645e38a9",
          },
        ],
      },
    },
  },
  status: {
    url: "https://alhabla-api-x.run.app",
    latestReadyRevisionName: "alhabla-api-00251-xz7",
    latestCreatedRevisionName: "alhabla-api-00251-xz7",
    traffic: [{ revisionName: "alhabla-api-00251-xz7", percent: 100 }],
    conditions: [
      { type: "Ready", status: "True" },
      { type: "RoutesReady", status: "False", message: "algo" },
    ],
  },
};

describe("resumirServicio", () => {
  it("saca revisión, tráfico, commit de la imagen, máximos y lo que no está bien", () => {
    expect(resumirServicio(SERVICIO)).toEqual({
      url: "https://alhabla-api-x.run.app",
      revisionLista: "alhabla-api-00251-xz7",
      revisionCreada: "alhabla-api-00251-xz7",
      trafico: [{ revision: "alhabla-api-00251-xz7", porcentaje: 100 }],
      imagen:
        "europe-west1-docker.pkg.dev/p/alhabla/backend:eb0402e044ee6b12ca1d94b3169d0aa7645e38a9",
      commit: "eb0402e044ee6b12ca1d94b3169d0aa7645e38a9",
      maxInstanciasDelServicio: "11",
      maxInstanciasDeLaPlantilla: "20",
      condicionesQueNoEstanBien: [
        { tipo: "RoutesReady", estado: "False", mensaje: "algo" },
      ],
    });
  });
});

describe("resumirJobs", () => {
  it("marca el fallo del último intento solo si lo hubo", () => {
    expect(
      resumirJobs([
        {
          name: "projects/p/locations/europe-west1/jobs/telnyx-reconciler",
          schedule: "0 4 * * *",
          state: "ENABLED",
          lastAttemptTime: "2026-10-15T04:00:00Z",
          status: {},
        },
        {
          name: "projects/p/locations/europe-west1/jobs/retry-usage-reports",
          schedule: "15 * * * *",
          state: "ENABLED",
          status: { code: 13, message: "INTERNAL" },
        },
      ])
    ).toEqual([
      {
        job: "telnyx-reconciler",
        horario: "0 4 * * *",
        estado: "ENABLED",
        ultimoIntento: "2026-10-15T04:00:00Z",
      },
      {
        job: "retry-usage-reports",
        horario: "15 * * * *",
        estado: "ENABLED",
        ultimoIntento: null,
        fallo: { codigo: 13, mensaje: "INTERNAL" },
      },
    ]);
  });
});

describe("estadoDeProd", () => {
  it("junta las partes; si una falla, sale su error y el resto se devuelve", async () => {
    const estado = await estadoDeProd({
      gcloudFn: async (argumentos) => {
        const comando = argumentos.slice(0, 3).join(" ");
        if (comando === "run services describe")
          return JSON.stringify(SERVICIO);
        if (comando === "tasks queues list") {
          return JSON.stringify([
            { name: "projects/p/queues/send-whatsapp", state: "RUNNING" },
          ]);
        }
        if (comando === "tasks list --queue=send-whatsapp") return "t1\nt2\n";
        if (comando === "scheduler jobs list")
          throw new Error(
            "[MCP] gcloud scheduler jobs list falló: sin permiso"
          );
        throw new Error(`inesperado: ${comando}`);
      },
      ghFn: async () =>
        JSON.stringify([
          {
            databaseId: 2,
            headSha: "otro",
            status: "in_progress",
            conclusion: "",
            createdAt: "b",
            url: "u2",
          },
          {
            databaseId: 1,
            headSha: "eb0402e044ee6b12ca1d94b3169d0aa7645e38a9",
            status: "completed",
            conclusion: "success",
            createdAt: "a",
            url: "u1",
          },
        ]),
      fetchFn: (async () =>
        new Response(JSON.stringify({ status: "ok" }), {
          status: 200,
        })) as typeof fetch,
    });

    expect(estado.salud).toEqual({ codigo: 200, cuerpo: { status: "ok" } });
    expect(estado.colas).toEqual([
      { cola: "send-whatsapp", estado: "RUNNING", tareas: 2 },
    ]);
    expect(estado.jobs).toEqual({
      error: "[MCP] gcloud scheduler jobs list falló: sin permiso",
    });
    expect(estado.sirveElUltimoDeployBueno).toBe(true);
  });
});

describe("lanzarJobDeProd", () => {
  it("no lanza los que tienen efectos y dice por qué; tampoco los que no conoce", async () => {
    const gcloudFn = async () => {
      throw new Error("no debería llamarse");
    };
    await expect(
      lanzarJobDeProd("send-weekly-summaries", { gcloudFn })
    ).rejects.toThrow(/no se lanza desde aquí: manda el resumen semanal/);
    await expect(lanzarJobDeProd("inventado", { gcloudFn })).rejects.toThrow(
      /No conozco el job «inventado»/
    );
    // Ninguno está en las dos listas.
    for (const job of Object.keys(JOBS_QUE_SE_PUEDEN_LANZAR)) {
      expect(JOBS_QUE_NO[job]).toBeUndefined();
    }
  });

  it("lo lanza, espera a su intento y devuelve resultado y logs con sus prefijos", async () => {
    let reloj = Date.parse("2026-10-15T11:30:00Z");
    const llamadas: string[][] = [];
    let describes = 0;
    const resultado = await lanzarJobDeProd("cleanup-zombie-calls", {
      ahora: () => reloj,
      pausa: async (ms) => {
        reloj += ms;
      },
      gcloudFn: async (argumentos) => {
        llamadas.push(argumentos);
        const comando = argumentos.slice(0, 3).join(" ");
        if (comando === "scheduler jobs run") return "";
        if (comando === "scheduler jobs describe") {
          describes++;
          // El primer describe aún ve el intento anterior.
          return JSON.stringify(
            describes === 1
              ? { lastAttemptTime: "2026-10-15T11:15:00Z", status: {} }
              : { lastAttemptTime: "2026-10-15T11:30:04Z", status: {} }
          );
        }
        if (comando.startsWith("logging read")) {
          return JSON.stringify([
            {
              timestamp: "2026-10-15T11:30:03Z",
              textPayload: "[Reaper] No se encontraron llamadas zombie.",
            },
          ]);
        }
        throw new Error(`inesperado: ${comando}`);
      },
    });

    expect(llamadas[0]).toEqual([
      "scheduler",
      "jobs",
      "run",
      "cleanup-zombie-calls",
      "--location=europe-west1",
    ]);
    expect(describes).toBe(2);
    expect(resultado).toMatchObject({
      job: "cleanup-zombie-calls",
      resultado: "ok",
      ultimoIntento: "2026-10-15T11:30:04Z",
      logs: [{ mensaje: "[Reaper] No se encontraron llamadas zombie." }],
    });
    const filtro = llamadas.find((a) => a[0] === "logging")![2];
    expect(filtro).toContain('textPayload:"[Reaper]"');
    expect(filtro).toContain('textPayload:"[Purga]"');
  });

  it("si el intento falla lo dice con su código", async () => {
    let reloj = Date.parse("2026-10-15T11:30:00Z");
    const resultado = await lanzarJobDeProd("telnyx-reconciler", {
      ahora: () => reloj,
      pausa: async (ms) => {
        reloj += ms;
      },
      gcloudFn: async (argumentos) => {
        if (argumentos[2] === "describe") {
          return JSON.stringify({
            lastAttemptTime: "2026-10-15T11:30:10Z",
            status: { code: 2, message: "UNKNOWN" },
          });
        }
        return argumentos[0] === "logging" ? "[]" : "";
      },
    });
    expect(resultado).toMatchObject({
      resultado: "fallo",
      fallo: { codigo: 2, mensaje: "UNKNOWN" },
      nota: expect.stringContaining("[TelnyxReconciler]"),
    });
  });
});
