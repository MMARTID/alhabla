import { describe, expect, it } from "vitest";
import {
  agregarPeticiones,
  latenciaEnMs,
  leerLatenciasDeProd,
  normalizarRuta,
} from "../../mcp/latenciasDeProd.js";
import type { Peticion } from "../../mcp/logsDeProd.js";
import {
  enmascararEmail,
  enmascararIdDeCuenta,
  resumenDeNegocio,
} from "../../mcp/resumenDeNegocio.js";
import {
  PROBLEMAS_DE_LLAMADA,
  agruparPorDia,
  cteDeLlamadasMarcadas,
  saludDeLlamadas,
} from "../../mcp/saludDeLlamadas.js";
import {
  duracionDeLaLlamada,
  lineasQueMencionan,
  peticionesDeToolsEnVolcado,
  trazaDeLlamada,
  ventanaDeLaLlamada,
} from "../../mcp/trazaDeLlamada.js";
import type { ResultadoDeConsulta } from "../../mcp/sqlDeSoloLectura.js";

const AHORA = Date.parse("2026-10-16T12:00:00Z");

function resultado(filas: Record<string, unknown>[]): ResultadoDeConsulta {
  return {
    columnas: Object.keys(filas[0] ?? {}),
    filas,
    totalFilas: filas.length,
    truncado: false,
  };
}

/** Ejecutor falso: devuelve las respuestas en orden y apunta las consultas. */
function ejecutorEnOrden(respuestas: Record<string, unknown>[][]) {
  const consultas: { sql: string; parametros: unknown[] }[] = [];
  let i = 0;
  const ejecutar = async (sql: string, parametros: unknown[]) => {
    consultas.push({ sql, parametros });
    return resultado(respuestas[i++] ?? []);
  };
  return { ejecutar, consultas };
}

function peticion(datos: Partial<Peticion>): Peticion {
  return {
    hora: "2026-10-16T10:00:00Z",
    metodo: "POST",
    estado: 200,
    ruta: "/webhooks/telnyx/tools/book_appointment",
    latencia: "1.000s",
    revision: "alhabla-api-00260-abc",
    ...datos,
  };
}

describe("normalizarRuta", () => {
  it("cambia los ids por :id y quita la query string", () => {
    expect(normalizarRuta("/calls/cmu71ux6j0006s6012cfggjby?page=2")).toBe(
      "/calls/:id"
    );
    expect(
      normalizarRuta(
        "/recordings/0b8c4f7e-1d2a-4c3b-9e8f-123456789abc/audio"
      )
    ).toBe("/recordings/:id/audio");
    expect(normalizarRuta("/bookings/42")).toBe("/bookings/:id");
    expect(
      normalizarRuta(
        "/webhooks/retell/tools/agent_7f3a9b2c4d5e6f7a8b9c0d1e/book_appointment"
      )
    ).toBe("/webhooks/retell/tools/:id/book_appointment");
    expect(normalizarRuta("/calls/v3%3AabcDEF-123_xyz")).toBe("/calls/:id");
  });

  it("deja los nombres de las tools y las rutas sin ids", () => {
    for (const ruta of [
      "/webhooks/telnyx/tools/check_availability",
      "/webhooks/telnyx/tools/preferencia_de_grabacion",
      "/booking-settings/professionals",
      "/business/me",
    ]) {
      expect(normalizarRuta(ruta)).toBe(ruta);
    }
  });
});

describe("latenciaEnMs", () => {
  it("lee la latencia de Cloud Run en segundos", () => {
    expect(latenciaEnMs("0.061101271s")).toBe(61.1);
    expect(latenciaEnMs("2.5s")).toBe(2500);
    expect(latenciaEnMs(undefined)).toBeNull();
    expect(latenciaEnMs("rápido")).toBeNull();
  });
});

describe("agregarPeticiones", () => {
  it("agrupa por método y ruta, cuenta estados y calcula p50/p95/máx", () => {
    const peticiones = [
      ...Array.from({ length: 19 }, (_, i) =>
        peticion({ latencia: `${(i + 1) / 10}s`, hora: `2026-10-16T10:${String(i).padStart(2, "0")}:00Z` })
      ),
      peticion({ latencia: "6.159s", estado: 500, hora: "2026-10-16T11:00:00Z" }),
      peticion({ ruta: "/webhooks/telnyx/tools/get_catalog", latencia: "0.05s" }),
    ];
    const [book, catalogo] = agregarPeticiones(peticiones);

    expect(book).toEqual({
      metodo: "POST",
      ruta: "/webhooks/telnyx/tools/book_appointment",
      total: 20,
      estados: { "2xx": 19, "5xx": 1 },
      latenciaMs: { p50: 1000, p95: 1900, max: 6159 },
      primera: "2026-10-16T10:00:00Z",
      ultima: "2026-10-16T11:00:00Z",
    });
    expect(catalogo?.total).toBe(1);
  });

  it("con porRevision, antes y después de un deploy van separados", () => {
    const grupos = agregarPeticiones(
      [
        peticion({ revision: "alhabla-api-1" }),
        peticion({ revision: "alhabla-api-2" }),
        peticion({ revision: "alhabla-api-2" }),
      ],
      { porRevision: true }
    );
    expect(grupos.map((g) => [g.revision, g.total])).toEqual([
      ["alhabla-api-2", 2],
      ["alhabla-api-1", 1],
    ]);
  });

  it("una petición sin estado ni latencia cuenta, pero no entra en los percentiles", () => {
    const [grupo] = agregarPeticiones([
      peticion({ estado: null, latencia: undefined }),
    ]);
    expect(grupo?.estados).toEqual({ "?": 1 });
    expect(grupo?.latenciaMs).toEqual({ p50: null, p95: null, max: null });
  });
});

describe("leerLatenciasDeProd", () => {
  it("lee solo los campos que necesita, por defecto 24 h, y avisa si se llegó al tope", async () => {
    let argumentos: string[] = [];
    const entradas = [
      {
        timestamp: "2026-10-16T10:00:00Z",
        httpRequest: {
          requestMethod: "POST",
          requestUrl: "https://api.alhabla.ai/webhooks/telnyx/tools/book_appointment",
          status: 200,
          latency: "2.0s",
        },
        resource: { labels: { revision_name: "alhabla-api-00260-abc" } },
      },
    ];
    const resultadoDeLatencias = await leerLatenciasDeProd(
      { ruta: "/webhooks/telnyx/tools/", limitePeticiones: 1 },
      {
        ahora: AHORA,
        gcloudFn: async (args) => {
          argumentos = args;
          return JSON.stringify(entradas);
        },
      }
    );
    expect(argumentos).toContain("--limit=1");
    expect(argumentos.find((a) => a.startsWith("--format="))).toMatch(
      /^--format=json\(timestamp,httpRequest\./
    );
    expect(resultadoDeLatencias.filtro).toContain(
      'timestamp>="2026-10-15T12:00:00.000Z"'
    );
    expect(resultadoDeLatencias.truncado).toBe(true);
    expect(resultadoDeLatencias.grupos[0]).toMatchObject({
      ruta: "/webhooks/telnyx/tools/book_appointment",
      latenciaMs: { p50: 2000 },
    });
  });
});

describe("salud de las llamadas", () => {
  it("la CTE marca cada problema con su nombre y excluye chats y simuladas", () => {
    const cte = cteDeLlamadasMarcadas();
    for (const problema of Object.keys(PROBLEMAS_DE_LLAMADA)) {
      expect(cte).toContain(`THEN '${problema}' END`);
    }
    expect(cte).toContain(`c."callId" NOT LIKE 'whatsapp:%'`);
    expect(cte).toContain(`c."callId" NOT LIKE 'sim-mcp-%'`);
  });

  it("agruparPorDia suma los estados como llamadas y deja los problemas aparte", () => {
    expect(
      agruparPorDia([
        { dia: "2026-10-14", tipo: "estado", clave: "COMPLETED", n: "3" },
        { dia: "2026-10-15", tipo: "estado", clave: "COMPLETED", n: "5" },
        { dia: "2026-10-15", tipo: "estado", clave: "FAILED", n: "1" },
        { dia: "2026-10-15", tipo: "problema", clave: "sin_coste", n: "2" },
      ])
    ).toEqual([
      {
        dia: "2026-10-15",
        llamadas: 6,
        estados: { COMPLETED: 5, FAILED: 1 },
        problemas: { sin_coste: 2 },
      },
      { dia: "2026-10-14", llamadas: 3, estados: { COMPLETED: 3 }, problemas: {} },
    ]);
  });

  it("pasa la ventana y el negocio a cada consulta, y con ejemplos=0 no los pide", async () => {
    const { ejecutar, consultas } = ejecutorEnOrden([[], [], [], []]);
    const salud = await saludDeLlamadas(
      "postgres://falsa",
      { desde: "1d", businessId: "negocio-1", ejemplos: 0 },
      { ahora: AHORA, ejecutar }
    );
    expect(consultas).toHaveLength(4);
    expect(consultas[0]?.parametros).toEqual([
      "2026-10-15T12:00:00.000Z",
      "negocio-1",
    ]);
    // Los eventos de webhook no tienen negocio: solo la ventana.
    expect(consultas[1]?.parametros).toEqual(["2026-10-15T12:00:00.000Z"]);
    expect(salud).not.toHaveProperty("ejemplos");
    expect(salud.businessId).toBe("negocio-1");
  });
});

describe("traza de una llamada", () => {
  const LLAMADA = {
    id: "cmcall0000000000000000001",
    callId: "v3:abc",
    businessId: "negocio-1",
    negocio: "Peluquería",
    startedAt: "2026-10-14T10:00:00.000Z",
    endedAt: "2026-10-14T10:05:00.000Z",
    fromNumber: "+34600111222",
    providerConversationId: "conv-1",
  };

  it("la ventana va de 2 min antes a 20 min después (30 min si no acabó)", () => {
    expect(ventanaDeLaLlamada(LLAMADA)).toEqual({
      desde: "2026-10-14T09:58:00.000Z",
      hasta: "2026-10-14T10:25:00.000Z",
    });
    expect(ventanaDeLaLlamada({ ...LLAMADA, endedAt: null }).hasta).toBe(
      "2026-10-14T10:50:00.000Z"
    );
  });

  it("las tools se buscan solo mientras duró la llamada, con 30 s de margen", () => {
    expect(duracionDeLaLlamada(LLAMADA)).toEqual({
      desde: "2026-10-14T10:00:00.000Z",
      hasta: "2026-10-14T10:05:30.000Z",
    });
  });

  it("en dev saca las peticiones a tools del log de Fastify, casando entrada y salida por reqId", () => {
    const linea = (hora: string, datos: object) =>
      `${hora} ${JSON.stringify({ level: 30, ...datos })}`;
    const volcado = [
      linea("2026-10-14T10:01:00.123456789Z", {
        reqId: "req-1",
        req: { method: "POST", url: "/webhooks/telnyx/tools/check_availability" },
        msg: "incoming request",
      }),
      linea("2026-10-14T10:01:00.200Z", {
        reqId: "req-2",
        req: { method: "GET", url: "/health" },
        msg: "incoming request",
      }),
      linea("2026-10-14T10:01:00.500Z", {
        reqId: "req-1",
        res: { statusCode: 200 },
        responseTime: 412.6,
        msg: "request completed",
      }),
      // Ya había colgado: es de otra llamada.
      linea("2026-10-14T10:09:00Z", {
        reqId: "req-3",
        req: { method: "POST", url: "/webhooks/telnyx/tools/book_appointment" },
        msg: "incoming request",
      }),
      "2026-10-14T10:01:01Z [VoiceTools] texto suelto",
    ].join("\n");
    expect(
      peticionesDeToolsEnVolcado(volcado, duracionDeLaLlamada(LLAMADA))
    ).toEqual([
      {
        hora: "2026-10-14T10:01:00.123456789Z",
        metodo: "POST",
        estado: 200,
        ruta: "/webhooks/telnyx/tools/check_availability",
        latencia: "0.413s",
      },
    ]);
  });

  it("de un volcado de docker logs se queda con las líneas que la mencionan, en orden", () => {
    const volcado = [
      "2026-10-14T10:00:02Z [Telnyx] Inició llamada v3:abc → +34911",
      "2026-10-14T10:00:01Z [Telnyx] Inició llamada v3:otra",
      "2026-10-14T10:00:00Z [VoiceTools] cita de cmcall0000000000000000001",
    ].join("\n");
    expect(lineasQueMencionan(volcado, ["v3:abc", LLAMADA.id], 10)).toEqual([
      {
        hora: "2026-10-14T10:00:00Z",
        mensaje: "[VoiceTools] cita de cmcall0000000000000000001",
      },
      { hora: "2026-10-14T10:00:02Z", mensaje: "[Telnyx] Inició llamada v3:abc → +34911" },
    ]);
  });

  it("en prod junta la fila, la cita, los logs y solo las peticiones a tools; enmascara teléfonos", async () => {
    const { ejecutar, consultas } = ejecutorEnOrden([
      [LLAMADA],
      [{ id: "cita-1", clientPhone: "+34600111222", externalCalendarProvider: "caldav" }],
      [{ id: "lead-1", codigoDeFallo: "CALENDAR_UNAVAILABLE" }],
      [{ transcripcion: { mensajes: 12 }, grabacion: null, llamadasSolapadas: "0" }],
    ]);
    let textosBuscados: unknown;
    const traza = await trazaDeLlamada(
      "prod",
      "postgres://falsa",
      { llamada: "v3:abc" },
      {
        ejecutar,
        leerLogs: async (opciones) => {
          textosBuscados = opciones.texto;
          return { filtro: "f", total: 1, lineas: [] };
        },
        leerPeticiones: async () => ({
          filtro: "f",
          total: 2,
          peticiones: [
            { hora: "h", metodo: "POST", estado: 200, ruta: "/webhooks/telnyx/tools/book_appointment", revision: "r" },
            { hora: "h", metodo: "POST", estado: 200, ruta: "/webhooks/telnyx", revision: "r" },
          ],
        }),
      }
    );
    expect(consultas[0]?.parametros).toEqual(["v3:abc"]);
    expect(consultas[1]?.parametros).toEqual([LLAMADA.id]);
    expect(textosBuscados).toEqual(["v3:abc", LLAMADA.id]);
    expect(traza.cita).toMatchObject({ id: "cita-1", clientPhone: "+34••••••222" });
    expect(traza.llamada.fromNumber).toBe("+34••••••222");
    expect(traza.reservasPendientes).toEqual([
      { id: "lead-1", codigoDeFallo: "CALENDAR_UNAVAILABLE" },
    ]);
    expect(traza.peticionesDeTools).toHaveLength(1);
    expect(traza).toMatchObject({ transcripcion: { mensajes: 12 }, llamadasSolapadas: "0" });
  });

  it("en dev lee docker logs: de backend-sim si la llamada es simulada", async () => {
    const { ejecutar } = ejecutorEnOrden([
      [{ ...LLAMADA, callId: "sim-mcp-1" }],
      [],
      [],
      [{}],
    ]);
    let contenedorLeido = "";
    const traza = await trazaDeLlamada(
      "dev",
      "postgres://falsa",
      { llamada: "sim-mcp-1" },
      {
        ejecutar,
        leerDocker: async (contenedor) => {
          contenedorLeido = contenedor;
          return {
            contenedor,
            lineas: [],
            peticionesDeTools: [
              { hora: "h", metodo: "POST", estado: 200, ruta: "/webhooks/telnyx/tools/get_catalog", revision: "" },
            ],
          };
        },
      }
    );
    expect(contenedorLeido).toBe("alhabla_backend_sim");
    expect(traza.peticionesDeTools).toHaveLength(1);
    expect(traza.logs).toEqual({ contenedor: "alhabla_backend_sim", lineas: [] });
  });

  it("dice cómo se busca cuando la llamada no existe", async () => {
    const { ejecutar } = ejecutorEnOrden([[]]);
    await expect(
      trazaDeLlamada("dev", "postgres://falsa", { llamada: "no-existe" }, { ejecutar })
    ).rejects.toThrow(/No hay ninguna llamada no-existe en dev/);
  });
});

describe("resumen de un negocio", () => {
  it("tapa el número de la cuenta de Apple en la URL del calendario", () => {
    expect(
      enmascararIdDeCuenta("https://caldav.icloud.com/17137020032/calendars/092BF708/")
    ).toBe("https://caldav.icloud.com/•••032/calendars/092BF708/");
  });

  it("enmascara el email dejando el dominio", () => {
    expect(enmascararEmail("miguel@icloud.com")).toBe("m•••@icloud.com");
    expect(enmascararEmail(null)).toBeNull();
    expect(enmascararEmail("sin-arroba")).toBe("•••");
  });

  it("sin negocio y con varios que coinciden, devuelve la lista para elegir", async () => {
    const { ejecutar, consultas } = ejecutorEnOrden([
      [
        { id: "a", nombre: "Peluquería A", numero: "+34911222333" },
        { id: "b", nombre: "Peluquería B", numero: null },
      ],
    ]);
    const resumen = await resumenDeNegocio(
      "postgres://falsa",
      { buscar: "Peluquería" },
      { ejecutar }
    );
    expect(consultas).toHaveLength(1);
    expect(consultas[0]?.parametros).toEqual(["Peluquería"]);
    expect(resumen).toMatchObject({
      negocios: [{ id: "a", numero: "+34••••••333" }, { id: "b" }],
    });
  });

  it("si solo uno coincide lo resume, sin credenciales y con el email enmascarado", async () => {
    const { ejecutar, consultas } = ejecutorEnOrden([
      [{ id: "a" }],
      [{ id: "a", nombre: "Peluquería A" }],
      [
        {
          proveedor: "caldav",
          conectado: true,
          tieneCredenciales: true,
          calendarId: "https://caldav.icloud.com/1/calendars/x/",
          accountEmail: "dueno@icloud.com",
          ultimoError: null,
        },
      ],
      [{ id: "agente-1", errorDeSincronizacion: "x".repeat(400) }],
      [{ profesionales: "3" }],
    ]);
    const resumen = (await resumenDeNegocio(
      "postgres://falsa",
      { buscar: "Peluquería A" },
      { ejecutar }
    )) as {
      calendarios: Record<string, unknown>[];
      agentes: Record<string, string>[];
    };
    expect(consultas.slice(1).every((c) => c.parametros[0] === "a")).toBe(true);
    expect(consultas[2]?.sql).not.toMatch(/SELECT[^;]*\bcredentials\b\s*(,|AS\s+credentials)/i);
    expect(resumen.calendarios[0]).toMatchObject({
      tieneCredenciales: true,
      accountEmail: "d•••@icloud.com",
    });
    expect(resumen.agentes[0]?.errorDeSincronizacion).toMatch(/… \(400 caracteres\)$/);
  });
});
