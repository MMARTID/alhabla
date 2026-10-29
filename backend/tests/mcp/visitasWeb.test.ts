import { describe, expect, it } from "vitest";
import {
  FalloDeVercel,
  analizarVisitas,
  botPorRed,
  enmascararIp,
  esDeDesarrollo,
  filasPorDimension,
  filtroDeVisitas,
  horaDeMadrid,
  leerSalidaDeVercel,
  resumirAgente,
  seriePorDia,
  tipoDeBot,
  valorDeFila,
  visitasDesdeVercel,
  visitasWeb,
  type PeticionDeVisita,
} from "../../mcp/visitasWeb.js";

const AHORA = Date.parse("2026-10-29T12:00:00Z");

const CHROME_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36";
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const GOOGLEBOT =
  "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.8010.52 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

describe("tipoDeBot", () => {
  it("reconoce los bots que llegan a /billing/fundadores", () => {
    expect(tipoDeBot(GOOGLEBOT)).toBe("Googlebot");
    expect(tipoDeBot("facebookexternalhit/1.1")).toBe("facebookexternalhit");
    expect(
      tipoDeBot(
        "meta-externalads/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)"
      )
    ).toBe("meta-externalads");
    expect(
      tipoDeBot(
        "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/136.0.0.0 Safari/537.36"
      )
    ).toBe("bingbot");
    expect(
      tipoDeBot(
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.8010.0 Safari/537.36"
      )
    ).toBe("HeadlessChrome");
    expect(
      tipoDeBot(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)"
      )
    ).toBe("Applebot");
    expect(tipoDeBot("")).toBe("sin user agent");
  });

  it("no toma por bot a un navegador (AppleWebKit no es Applebot)", () => {
    expect(tipoDeBot(CHROME_MAC)).toBeNull();
    expect(tipoDeBot(SAFARI_IPHONE)).toBeNull();
  });
});

describe("botPorRed", () => {
  it("toma por bot a Meta aunque llegue con un user agent de navegador", () => {
    expect(botPorRed("2a03:2880:f806:8::1")).toBe("Meta (por su red)");
    expect(botPorRed("173.252.107.5")).toBe("Meta (por su red)");
    expect(botPorRed("92.56.68.184")).toBeNull();
    expect(botPorRed(undefined)).toBeNull();
  });
});

describe("esDeDesarrollo", () => {
  it("marca localhost, las previews de Vercel y el navegador de la app de Claude", () => {
    expect(esDeDesarrollo("http://localhost:3112/", CHROME_MAC)).toBe(true);
    expect(
      esDeDesarrollo(
        "https://alhabla-etjav0evb-mmartids-projects.vercel.app/",
        CHROME_MAC
      )
    ).toBe(true);
    expect(
      esDeDesarrollo(
        "https://alhabla.ai/",
        "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Claude/3.1623.0 Chrome/152.0.7977.167 Safari/537.36"
      )
    ).toBe(true);
    expect(esDeDesarrollo("https://alhabla.ai/", CHROME_MAC)).toBe(false);
    expect(esDeDesarrollo(undefined, SAFARI_IPHONE)).toBe(false);
  });
});

describe("enmascararIp", () => {
  it("quita el último octeto de una IPv4 y deja la mitad de una IPv6", () => {
    expect(enmascararIp("92.56.68.184")).toBe("92.56.68.x");
    expect(enmascararIp("::ffff:10.0.0.7")).toBe("10.0.0.x");
    expect(enmascararIp("2a03:2880:f800:1::face:b00c")).toBe(
      "2a03:2880:f800:1:…"
    );
    expect(enmascararIp("2a03:2880::1")).toBe("2a03:2880:0:0:…");
    expect(enmascararIp("")).toBe("");
  });
});

describe("resumirAgente", () => {
  it("navegador con versión mayor, sistema y dispositivo", () => {
    expect(resumirAgente(CHROME_MAC)).toEqual({
      navegador: "Chrome 156",
      sistema: "macOS",
      dispositivo: "ordenador",
    });
    expect(resumirAgente(SAFARI_IPHONE)).toEqual({
      navegador: "Safari 18",
      sistema: "iOS",
      dispositivo: "móvil",
    });
    expect(
      resumirAgente(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0"
      )
    ).toMatchObject({ navegador: "Edge 145", sistema: "Windows" });
    expect(
      resumirAgente(
        "Mozilla/5.0 (Linux; Android 16; SM-S921U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36 Instagram 350.0"
      )
    ).toEqual({
      navegador: "Instagram (app)",
      sistema: "Android",
      dispositivo: "móvil",
    });
  });
});

describe("horaDeMadrid", () => {
  it("pasa a la hora de Madrid (CET desde el 25-10)", () => {
    expect(horaDeMadrid("2026-10-29T09:11:12Z")).toBe("2026-10-29 10:11:12");
    expect(horaDeMadrid("2026-10-20T22:30:00Z")).toBe("2026-10-21 00:30:00");
  });
});

describe("filtroDeVisitas", () => {
  it("solo los GET a /billing/fundadores del log de peticiones, en la ventana", () => {
    const filtro = filtroDeVisitas("7d", undefined, AHORA);
    expect(filtro).toContain('resource.labels.service_name="alhabla-api"');
    expect(filtro).toContain('logName:"run.googleapis.com%2Frequests"');
    expect(filtro).toContain('httpRequest.requestUrl:"/billing/fundadores"');
    expect(filtro).toContain('httpRequest.requestMethod="GET"');
    expect(filtro).toContain('timestamp>="2026-10-22T12:00:00.000Z"');
  });
});

function peticion(
  timestamp: string,
  remoteIp: string,
  userAgent: string,
  referer = "https://alhabla.ai/"
): PeticionDeVisita {
  return { timestamp, httpRequest: { remoteIp, userAgent, referer } };
}

describe("analizarVisitas", () => {
  const PETICIONES = [
    // gcloud las da de la más nueva a la más vieja.
    peticion("2026-10-29T09:05:00Z", "92.56.68.184", CHROME_MAC),
    peticion("2026-10-29T09:00:00Z", "66.249.68.1", GOOGLEBOT),
    peticion("2026-10-28T20:48:42Z", "2a03:2880:f806:8::1", CHROME_MAC),
    peticion("2026-10-28T18:00:00Z", "80.1.2.3", SAFARI_IPHONE),
    peticion(
      "2026-10-28T17:00:00Z",
      "92.56.68.184",
      CHROME_MAC,
      "http://localhost:3112/"
    ),
    peticion("2026-10-28T08:00:00Z", "92.56.68.184", CHROME_MAC),
  ];

  it("quita bots y desarrollo, enmascara la IP y resume por día y por IP", () => {
    const resultado = analizarVisitas(PETICIONES);
    expect(resultado.peticionesLeidas).toBe(6);
    expect(resultado.bots).toEqual({
      total: 2,
      porTipo: { Googlebot: 1, "Meta (por su red)": 1 },
    });
    expect(resultado.deDesarrollo).toEqual({ total: 1, incluidas: false });
    expect(resultado.cargas).toBe(3);
    expect(resultado.ipsDistintas).toBe(2);
    expect(resultado.porDia).toEqual([
      { dia: "2026-10-29", cargas: 1, ipsDistintas: 1 },
      { dia: "2026-10-28", cargas: 2, ipsDistintas: 2 },
    ]);
    expect(resultado.porIp[0]).toEqual({
      ip: "92.56.68.x",
      cargas: 2,
      dias: 2,
      primera: "2026-10-28 09:00:00",
      ultima: "2026-10-29 10:05:00",
      navegadores: ["Chrome 156 · macOS"],
    });
    expect(resultado.visitas).toEqual([
      {
        hora: "2026-10-28 09:00:00",
        ip: "92.56.68.x",
        navegador: "Chrome 156",
        sistema: "macOS",
        dispositivo: "ordenador",
        desde: "alhabla.ai",
      },
      {
        hora: "2026-10-28 19:00:00",
        ip: "80.1.2.x",
        navegador: "Safari 18",
        sistema: "iOS",
        dispositivo: "móvil",
        desde: "alhabla.ai",
      },
      {
        hora: "2026-10-29 10:05:00",
        ip: "92.56.68.x",
        navegador: "Chrome 156",
        sistema: "macOS",
        dispositivo: "ordenador",
        desde: "alhabla.ai",
      },
    ]);
  });

  it("con mostrarIps e incluirDesarrollo enseña la IP entera y marca las de desarrollo", () => {
    const resultado = analizarVisitas(PETICIONES, {
      mostrarIps: true,
      incluirDesarrollo: true,
    });
    expect(resultado.cargas).toBe(4);
    expect(resultado.deDesarrollo).toEqual({ total: 1, incluidas: true });
    expect(resultado.visitas[1]).toMatchObject({
      ip: "92.56.68.184",
      desde: "localhost:3112",
      desarrollo: true,
    });
  });
});

// La forma real de `vercel metrics … -F json` (CLI 54.14.0).
const VISITANTES_POR_DIA = {
  query: {
    metric: "vercel.analytics_pageview.count",
    aggregation: "unique/visitor_id",
    groupBy: [],
    startTime: "2026-10-27T00:00:00.000Z",
    endTime: "2026-10-30T00:00:00.000Z",
    granularity: { days: 1 },
  },
  summary: [{ vercel_analytics_pageview_count_unique_visitor_id: 4 }],
  data: [
    {
      timestamp: "2026-10-27T00:00:00.000Z",
      vercel_analytics_pageview_count_unique_visitor_id: null,
    },
    {
      timestamp: "2026-10-28T00:00:00.000Z",
      vercel_analytics_pageview_count_unique_visitor_id: 3,
    },
    {
      timestamp: "2026-10-29T00:00:00.000Z",
      vercel_analytics_pageview_count_unique_visitor_id: 1,
    },
  ],
};
const PAGINAS_POR_DIA = {
  ...VISITANTES_POR_DIA,
  summary: [{ vercel_analytics_pageview_count_sum: 9 }],
  data: [
    {
      timestamp: "2026-10-28T00:00:00.000Z",
      vercel_analytics_pageview_count_sum: 7,
    },
    {
      timestamp: "2026-10-29T00:00:00.000Z",
      vercel_analytics_pageview_count_sum: 2,
    },
  ],
};
const VISITANTES_POR_RUTA = {
  query: { groupBy: ["request_path"] },
  summary: [
    {
      vercel_analytics_pageview_count_unique_visitor_id: 3,
      request_path: "/",
    },
    {
      vercel_analytics_pageview_count_unique_visitor_id: 1,
      request_path: "/planes",
    },
  ],
  data: [],
};
const PAGINAS_POR_RUTA = {
  query: { groupBy: ["request_path"] },
  summary: [
    { vercel_analytics_pageview_count_sum: 6, request_path: "/" },
    { vercel_analytics_pageview_count_sum: 3, request_path: "/planes" },
  ],
  data: [],
};

describe("salida de vercel metrics", () => {
  it("lee el JSON aunque llegue con algo delante y convierte un { error } en error", () => {
    expect(
      leerSalidaDeVercel(
        `Vercel CLI 54.14.0\n${JSON.stringify(VISITANTES_POR_DIA)}`
      ).summary
    ).toEqual([{ vercel_analytics_pageview_count_unique_visitor_id: 4 }]);
    expect(() =>
      leerSalidaDeVercel(
        JSON.stringify({
          error: {
            code: "invalid_query",
            message: 'does not expose dimension "projectName"',
          },
        })
      )
    ).toThrow(/vercel metrics: does not expose dimension/);
    expect(() => leerSalidaDeVercel("nada")).toThrow(/no devolvió JSON/);
  });

  it("el valor de una fila es la clave que no es hora ni dimensión (null = 0)", () => {
    expect(
      valorDeFila(
        { vercel_analytics_pageview_count_sum: 6, request_path: "/" },
        ["request_path"]
      )
    ).toBe(6);
    expect(
      valorDeFila({
        timestamp: "x",
        vercel_analytics_pageview_count_unique_visitor_id: null,
      })
    ).toBe(0);
  });

  it("serie por día y filas por dimensión", () => {
    expect(seriePorDia(VISITANTES_POR_DIA, PAGINAS_POR_DIA)).toEqual([
      { dia: "2026-10-29", visitantes: 1, paginasVistas: 2 },
      { dia: "2026-10-28", visitantes: 3, paginasVistas: 7 },
      { dia: "2026-10-27", visitantes: 0, paginasVistas: 0 },
    ]);
    expect(
      filasPorDimension(VISITANTES_POR_RUTA, PAGINAS_POR_RUTA, "request_path")
    ).toEqual([
      { valor: "/", visitantes: 3, paginasVistas: 6 },
      { valor: "/planes", visitantes: 1, paginasVistas: 3 },
    ]);
  });

  it("visitasDesdeVercel lanza las consultas con el proyecto y la ventana", async () => {
    const llamadas: string[][] = [];
    const resultado = await visitasDesdeVercel(
      { desde: "2d" },
      {
        ahora: AHORA,
        vercelFn: async (argumentos) => {
          llamadas.push(argumentos);
          const unicos = argumentos.includes("unique/visitor_id");
          const agrupado = argumentos.includes("--group-by");
          return JSON.stringify(
            agrupado
              ? unicos
                ? VISITANTES_POR_RUTA
                : PAGINAS_POR_RUTA
              : unicos
                ? VISITANTES_POR_DIA
                : PAGINAS_POR_DIA
          );
        },
      }
    );
    expect(llamadas).toHaveLength(4);
    expect(llamadas[0]).toEqual([
      "metrics",
      "vercel.analytics_pageview.count",
      "-p",
      "alhabla-web",
      "--since",
      "2026-10-27T12:00:00.000Z",
      "-F",
      "json",
      "-a",
      "unique/visitor_id",
      "-g",
      "1d",
    ]);
    expect(resultado).toMatchObject({
      proyecto: "alhabla-web",
      visitantesUnicos: 4,
      paginasVistas: 9,
      por_request_path: [
        { valor: "/", visitantes: 3, paginasVistas: 6 },
        { valor: "/planes", visitantes: 1, paginasVistas: 3 },
      ],
    });
  });
});

describe("visitasWeb", () => {
  it("si la CLI de Vercel no tiene sesión lo dice con el arreglo y devuelve la parte del API", async () => {
    const resultado = await visitasWeb(
      {},
      {
        ahora: AHORA,
        gcloudFn: async () =>
          JSON.stringify([
            peticion("2026-10-29T09:05:00Z", "80.1.2.3", SAFARI_IPHONE),
          ]),
        vercelFn: async () => {
          throw new FalloDeVercel(
            "[MCP] La CLI de Vercel no tiene sesión",
            "vercel login"
          );
        },
      }
    );
    expect(resultado.desde).toBe("2026-10-22T12:00:00.000Z");
    expect(resultado.vercel).toEqual({
      error: "[MCP] La CLI de Vercel no tiene sesión",
      arreglo: "vercel login",
    });
    expect(resultado.api).toMatchObject({ cargas: 1, ipsDistintas: 1 });
  });

  it("con una sola fuente no toca la otra", async () => {
    const resultado = await visitasWeb(
      { fuente: "api", desde: "1d" },
      {
        ahora: AHORA,
        gcloudFn: async () => "[]",
        vercelFn: async () => {
          throw new Error("no debería llamarse");
        },
      }
    );
    expect(resultado).not.toHaveProperty("vercel");
    expect(resultado.api).toMatchObject({ cargas: 0, truncado: false });
  });
});
