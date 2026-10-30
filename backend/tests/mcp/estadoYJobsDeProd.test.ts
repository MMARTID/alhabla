import { describe, expect, it } from "vitest";
import {
  despliegueDeWeb,
  desplieguesDeLasWebs,
  estadoDeProd,
  frenteAMain,
  resumirJobs,
  resumirMigraciones,
  resumirServicio,
  type GhApi,
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
      consultarBd: async () => ({
        columnas: [],
        filas: [
          {
            migration_name: "20261028210000_modo_de_agenda",
            started_at: "2026-10-28T20:58:57Z",
            finished_at: "2026-10-28T20:58:58Z",
            rolled_back_at: null,
          },
        ],
        totalFilas: 1,
        truncado: false,
      }),
      migracionesLocales: async () => [
        "20261028210000_modo_de_agenda",
        "20261028220000_ical_token",
      ],
      ghApiFn: async () => {
        throw new Error("[MCP] gh api repos/x/commits/main falló: sin red");
      },
    });

    expect(estado.salud).toEqual({ codigo: 200, cuerpo: { status: "ok" } });
    expect(estado.migraciones).toMatchObject({
      aplicadas: 1,
      pendientes: ["20261028220000_ical_token"],
    });
    expect(estado.webs).toEqual({
      error: "[MCP] gh api repos/x/commits/main falló: sin red",
    });
    expect(estado.colas).toEqual([
      { cola: "send-whatsapp", estado: "RUNNING", tareas: 2 },
    ]);
    expect(estado.jobs).toEqual({
      error: "[MCP] gcloud scheduler jobs list falló: sin permiso",
    });
    expect(estado.sirveElUltimoDeployBueno).toBe(true);
  });
});

describe("resumirMigraciones", () => {
  const fila = (
    migration_name: string,
    finished_at: string | null,
    rolled_back_at: string | null = null
  ) => ({
    migration_name,
    started_at: "2026-10-01T00:00:00Z",
    finished_at,
    rolled_back_at,
  });

  it("aplicadas, la última, las fallidas, las revertidas y las que faltan en cada lado", () => {
    expect(
      resumirMigraciones(
        [
          fila("20260901_inicial", "2026-09-01T10:00:00Z"),
          // Falló, se marcó como revertida y se volvió a aplicar: está bien.
          fila("20261001_columna", null, "2026-10-01T10:05:00Z"),
          fila("20261001_columna", "2026-10-01T10:10:00Z"),
          fila("20261010_rota", null),
          fila("20261012_quitada", null, "2026-10-12T10:00:00Z"),
          fila("20261020_vieja_del_checkout", "2026-10-20T10:00:00Z"),
        ],
        [
          "20260901_inicial",
          "20261001_columna",
          "20261010_rota",
          "20261012_quitada",
          "20261029_nueva",
        ]
      )
    ).toEqual({
      aplicadas: 3,
      ultima: {
        nombre: "20261020_vieja_del_checkout",
        aplicada: "2026-10-20T10:00:00Z",
      },
      fallidasOAMedias: [
        { nombre: "20261010_rota", empezada: "2026-10-01T00:00:00Z" },
      ],
      revertidasSinVolverAAplicar: ["20261012_quitada"],
      pendientes: ["20261010_rota", "20261012_quitada", "20261029_nueva"],
      soloEnProduccion: ["20261020_vieja_del_checkout"],
    });
  });
});

describe("webs de Vercel", () => {
  const MAIN = "m".repeat(40);

  it("frenteAMain: al día si es main o si ningún commit posterior toca su carpeta", () => {
    expect(frenteAMain("web", null)).toEqual({
      esElUltimoDeMain: true,
      alDia: true,
    });
    expect(
      frenteAMain("web", {
        ahead_by: 3,
        archivos: ["backend/src/server.ts", "frontend/src/app/page.tsx"],
      })
    ).toEqual({
      esElUltimoDeMain: false,
      commitsDeMainDespues: 3,
      archivosDeSuCarpetaSinDesplegar: 0,
      alDia: true,
    });
    expect(
      frenteAMain("frontend", {
        ahead_by: 3,
        archivos: ["backend/src/server.ts", "frontend/src/app/page.tsx"],
      })
    ).toMatchObject({ archivosDeSuCarpetaSinDesplegar: 1, alDia: false });
  });

  /** gh api falso: responde por ruta y apunta las que se pidieron. */
  function ghFalso(respuestas: Record<string, unknown>) {
    const rutas: string[] = [];
    const ghApiFn: GhApi = async (ruta) => {
      rutas.push(ruta);
      const clave = Object.keys(respuestas).find((prefijo) =>
        ruta.startsWith(prefijo)
      );
      if (!clave) throw new Error(`inesperado: ${ruta}`);
      return JSON.stringify(respuestas[clave]);
    };
    return { rutas, ghApiFn };
  }

  it("el último despliegue de producción; si falló, también el último que salió bien y su comparación con main", async () => {
    const { rutas, ghApiFn } = ghFalso({
      "repos/MMARTID/alhabla/deployments?environment=Production%20%E2%80%93%20alhabla-web":
        [
          { id: 2, sha: "b".repeat(40), created_at: "2026-10-29T01:06:09Z" },
          { id: 1, sha: "a".repeat(40), created_at: "2026-10-28T21:07:50Z" },
        ],
      "repos/MMARTID/alhabla/deployments/2/statuses": [
        { state: "error", created_at: "2026-10-29T01:07:00Z" },
      ],
      "repos/MMARTID/alhabla/deployments/1/statuses": [
        {
          state: "success",
          created_at: "2026-10-28T21:09:00Z",
          environment_url: "https://alhabla-x.vercel.app",
        },
      ],
      [`repos/MMARTID/alhabla/compare/${"a".repeat(40)}...${MAIN}`]: {
        ahead_by: 2,
        archivos: ["web/src/app/page.tsx"],
      },
    });
    const web = await despliegueDeWeb(
      { proyecto: "alhabla-web", dominio: "alhabla.ai", carpeta: "web" },
      { sha: MAIN },
      ghApiFn
    );
    expect(web).toEqual({
      proyecto: "alhabla-web",
      dominio: "alhabla.ai",
      ultimoDespliegue: {
        estado: "error",
        commit: "b".repeat(40),
        creado: "2026-10-29T01:06:09Z",
        actualizado: "2026-10-29T01:07:00Z",
        url: null,
      },
      ultimoQueSalioBien: {
        estado: "success",
        commit: "a".repeat(40),
        creado: "2026-10-28T21:07:50Z",
        actualizado: "2026-10-28T21:09:00Z",
        url: "https://alhabla-x.vercel.app",
      },
      esElUltimoDeMain: false,
      commitsDeMainDespues: 2,
      archivosDeSuCarpetaSinDesplegar: 1,
      alDia: false,
    });
    expect(rutas[0]).toContain("&per_page=5");
  });

  it("desplieguesDeLasWebs: main y las dos webs, cada una por separado", async () => {
    const { ghApiFn } = ghFalso({
      "repos/MMARTID/alhabla/commits/main": {
        sha: MAIN,
        fecha: "2026-10-29T01:04:00Z",
      },
      "repos/MMARTID/alhabla/deployments?environment=Production%20%E2%80%93%20alhabla-frontend":
        [{ id: 7, sha: MAIN, created_at: "2026-10-29T01:05:09Z" }],
      "repos/MMARTID/alhabla/deployments/7/statuses": [
        { state: "success", created_at: "2026-10-29T01:06:00Z" },
      ],
      "repos/MMARTID/alhabla/deployments?environment=Production%20%E2%80%93%20alhabla-web":
        [],
    });
    const resultado = await desplieguesDeLasWebs(ghApiFn);
    expect(resultado.main).toEqual({
      commit: MAIN,
      fecha: "2026-10-29T01:04:00Z",
    });
    expect(resultado.webs[0]).toMatchObject({
      proyecto: "alhabla-frontend",
      esElUltimoDeMain: true,
      alDia: true,
    });
    expect(resultado.webs[1]).toEqual({
      proyecto: "alhabla-web",
      dominio: "alhabla.ai",
      error: "No hay ningún despliegue de producción de Vercel en GitHub",
    });
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
