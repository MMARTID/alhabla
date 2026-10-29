import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { SERVICIO, gcloud, type Gcloud } from "./gcloud.js";
import { literal } from "./logsDeProd.js";
import { recortar } from "./privacidad.js";
import { momentoDesde } from "./tiempo.js";

/**
 * Visitas a la web pública (alhabla.ai), de dos fuentes que se complementan:
 *
 * - `api`: cada carga humana de una página con precios (portada, sectores,
 *   planes) pide `GET /billing/fundadores` al API (web/src/lib/cupo-fundador.ts),
 *   así que el log de peticiones de Cloud Run tiene la hora, la IP, el user
 *   agent y el referer de TODA visita, acepte o no las cookies. api.alhabla.ai
 *   no pasa por el proxy de Cloudflare: la IP es la del visitante. El referer
 *   llega sin ruta (solo el origen), así que no dice qué página se vio. Se
 *   quitan los bots (Googlebot, bingbot, facebookexternalhit,
 *   meta-externalads…) y, salvo que se pidan, las visitas de desarrollo
 *   (referer de localhost o de una preview *.vercel.app, o el navegador de
 *   la app de Claude).
 * - `vercel`: Vercel Web Analytics por la CLI (`vercel metrics`), que solo
 *   cuenta a quien acepta las cookies (desde el 23-09, #170). visitor_id es
 *   un hash con sal diaria: quien vuelve otro día cuenta otra vez. La CLI se
 *   ejecuta en /private/tmp, fuera del repo, para que no tome el proyecto
 *   enlazado del checkout.
 *
 * Cada fuente falla por separado: sin CLI de Vercel o sin sesión, esa parte
 * dice cómo arreglarlo y la otra se devuelve igual.
 */

// ── Fuente «api»: el log de peticiones de Cloud Run ─────────────────────

const LIMITE_DE_PETICIONES = 5_000;
const MAX_VISITAS = 200;
const MAX_IPS = 50;

export function filtroDeVisitas(
  desde: string,
  hasta: string | undefined,
  ahora = Date.now()
): string {
  const partes = [
    `resource.type="cloud_run_revision" AND resource.labels.service_name=${literal(SERVICIO)}`,
    'logName:"run.googleapis.com%2Frequests"',
    'httpRequest.requestUrl:"/billing/fundadores"',
    // Sin los OPTIONS del CORS: cada visita contaría dos veces.
    'httpRequest.requestMethod="GET"',
    `timestamp>="${momentoDesde(desde, ahora)}"`,
  ];
  if (hasta) partes.push(`timestamp<="${momentoDesde(hasta, ahora)}"`);
  return partes.join(" AND ");
}

/** Bots por familia. El orden importa: el primero que casa da el nombre.
 * Ojo con «apple»: casaría con AppleWebKit (por eso «Applebot»). */
const BOTS: [string, RegExp][] = [
  [
    "Googlebot",
    /Googlebot|Google-InspectionTool|GoogleOther|AdsBot-Google|Mediapartners-Google|Storebot-Google|APIs-Google|Google-Extended/i,
  ],
  ["Lighthouse/PageSpeed", /Chrome-Lighthouse|Lighthouse|PageSpeed|GTmetrix/i],
  ["bingbot", /bingbot|BingPreview|msnbot|adidxbot/i],
  ["facebookexternalhit", /facebookexternalhit|facebookcatalog/i],
  [
    "meta-externalads",
    /meta-externalads|meta-externalagent|meta-externalfetcher|meta-webindexer/i,
  ],
  ["Applebot", /Applebot/i],
  ["HeadlessChrome", /HeadlessChrome|PhantomJS|Puppeteer|Playwright/i],
  [
    "bots de IA",
    /GPTBot|ChatGPT-User|OAI-SearchBot|ClaudeBot|Claude-User|Claude-SearchBot|anthropic-ai|PerplexityBot|Perplexity-User|CCBot|Bytespider|Amazonbot|cohere-ai|Diffbot|YouBot/i,
  ],
  [
    "otros buscadores",
    /DuckDuckBot|YandexBot|Baiduspider|PetalBot|Sogou|SeznamBot|Qwantify|ia_archiver/i,
  ],
  [
    "SEO",
    /AhrefsBot|SemrushBot|MJ12bot|DotBot|DataForSeoBot|BLEXBot|serpstatbot|Screaming Frog/i,
  ],
  [
    "previsualización de enlaces",
    /Twitterbot|LinkedInBot|Slackbot|Discordbot|TelegramBot|WhatsApp\/|Pinterestbot|redditbot|SkypeUriPreview/i,
  ],
  [
    "clientes HTTP",
    /curl\/|Wget|python-requests|python-urllib|aiohttp|Go-http-client|node-fetch|axios|undici|okhttp|Java\/|libwww-perl/i,
  ],
  ["otro bot", /bot\b|crawler|spider|crawl|slurp|uptime|monitor/i],
];

/** La familia del bot, o null si parece una persona. Sin user agent, bot. */
export function tipoDeBot(agente: string | undefined): string | null {
  if (!agente?.trim()) return "sin user agent";
  return BOTS.find(([, patron]) => patron.test(agente))?.[0] ?? null;
}

/** Redes de Meta: sus rastreadores de anuncios y enlaces también llegan con
 * el user agent de un navegador normal (medido el 28-10: «Chrome 139 ·
 * Windows» desde 2a03:2880:…). */
const RED_DE_META =
  /^(?:2a03:2880:|69\.63\.(?:17[6-9]|18\d|19[01])\.|66\.220\.(?:14[4-9]|15\d)\.|69\.171\.(?:22[4-9]|2[34]\d|25[0-5])\.|173\.252\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|31\.13\.(?:2[4-9]|3[01]|6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|157\.240\.)/i;

/** El bot por su red, aunque el user agent parezca un navegador. */
export function botPorRed(ip: string | undefined): string | null {
  return ip && RED_DE_META.test(ip) ? "Meta (por su red)" : null;
}

function hostDe(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

/** Visitas del propio equipo: la web en local o en una preview de Vercel, o
 * el navegador integrado de la app de Claude. */
export function esDeDesarrollo(
  referer: string | undefined,
  agente: string | undefined
): boolean {
  const host = hostDe(referer);
  if (
    /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host) ||
    host.endsWith(".vercel.app") ||
    host.endsWith(".localhost") ||
    host.endsWith(".local")
  ) {
    return true;
  }
  return /\bClaude\/\d/.test(agente ?? "");
}

function expandirIpv6(ip: string): string[] {
  const [cabeza = "", cola] = ip.split("::");
  const delante = cabeza ? cabeza.split(":") : [];
  if (cola === undefined) return delante;
  const detras = cola ? cola.split(":") : [];
  return [
    ...delante,
    ...Array<string>(Math.max(8 - delante.length - detras.length, 0)).fill("0"),
    ...detras,
  ];
}

/** IPv4 sin el último octeto; IPv6 con solo su primera mitad (el prefijo
 * de red). Basta para ver si dos visitas vienen de la misma red. */
export function enmascararIp(ip: string | undefined): string {
  if (!ip) return "";
  const v4 = /^(?:::ffff:)?(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/i.exec(ip);
  if (v4) return `${v4[1]}.x`;
  if (ip.includes(":")) return `${expandirIpv6(ip).slice(0, 4).join(":")}:…`;
  return "?";
}

const NAVEGADORES: [string, RegExp][] = [
  ["Instagram (app)", /Instagram/],
  ["Facebook (app)", /FBAN|FBAV|FB_IAB/],
  ["LinkedIn (app)", /LinkedInApp/],
  ["Edge", /Edg(?:e|A|iOS)?\/(\d+)/],
  ["Opera", /OPR\/(\d+)/],
  ["Samsung Internet", /SamsungBrowser\/(\d+)/],
  ["Firefox", /(?:Firefox|FxiOS)\/(\d+)/],
  ["Chrome", /(?:CriOS|Chrome)\/(\d+)/],
  ["Safari", /Version\/(\d+)[\d.]* (?:Mobile\/\w+ )?Safari\//],
  ["Safari", /Safari\//],
];

const SISTEMAS: [string, RegExp][] = [
  ["iOS", /iPhone|iPad|iPod/],
  ["Android", /Android/],
  ["Windows", /Windows/],
  ["ChromeOS", /CrOS/],
  ["macOS", /Macintosh|Mac OS X/],
  ["Linux", /Linux/],
];

/** Navegador (con su versión mayor), sistema y tipo de dispositivo. */
export function resumirAgente(agente: string | undefined): {
  navegador: string;
  sistema: string;
  dispositivo: "móvil" | "tableta" | "ordenador";
} {
  const ua = agente ?? "";
  let navegador = "otro";
  for (const [nombre, patron] of NAVEGADORES) {
    const coincidencia = patron.exec(ua);
    if (coincidencia) {
      navegador = coincidencia[1] ? `${nombre} ${coincidencia[1]}` : nombre;
      break;
    }
  }
  const sistema = SISTEMAS.find(([, patron]) => patron.test(ua))?.[0] ?? "otro";
  const dispositivo =
    /iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))
      ? "tableta"
      : /Mobi|iPhone|iPod/.test(ua)
        ? "móvil"
        : "ordenador";
  return { navegador, sistema, dispositivo };
}

const FORMATO_DE_MADRID = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Madrid",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** «2026-10-29T09:11:12Z» → «2026-10-29 10:11:12» (hora de Madrid). */
export function horaDeMadrid(iso: string): string {
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? iso : FORMATO_DE_MADRID.format(fecha);
}

export type PeticionDeVisita = {
  timestamp?: string;
  httpRequest?: {
    remoteIp?: string;
    userAgent?: string;
    referer?: string;
    status?: number;
  };
};

export type Visita = {
  hora: string;
  ip: string;
  navegador: string;
  sistema: string;
  dispositivo: string;
  /** Host del referer: el navegador solo manda el origen, no la página. */
  desde: string;
  desarrollo?: true;
};

export function analizarVisitas(
  peticiones: PeticionDeVisita[],
  {
    mostrarIps = false,
    incluirDesarrollo = false,
  }: { mostrarIps?: boolean; incluirDesarrollo?: boolean } = {}
) {
  const bots: Record<string, number> = {};
  let deDesarrollo = 0;
  const visitas: Visita[] = [];
  const dias = new Map<string, { cargas: number; ips: Set<string> }>();
  const ips = new Map<
    string,
    {
      cargas: number;
      primera: string;
      ultima: string;
      dias: Set<string>;
      navegadores: Set<string>;
    }
  >();

  // gcloud las da de la más nueva a la más vieja.
  const ordenadas = [...peticiones].sort((a, b) =>
    (a.timestamp ?? "").localeCompare(b.timestamp ?? "")
  );
  for (const peticion of ordenadas) {
    const agente = peticion.httpRequest?.userAgent;
    const referer = peticion.httpRequest?.referer;
    const bot = tipoDeBot(agente) ?? botPorRed(peticion.httpRequest?.remoteIp);
    if (bot) {
      bots[bot] = (bots[bot] ?? 0) + 1;
      continue;
    }
    const desarrollo = esDeDesarrollo(referer, agente);
    if (desarrollo) {
      deDesarrollo += 1;
      if (!incluirDesarrollo) continue;
    }
    const ipReal = peticion.httpRequest?.remoteIp ?? "";
    const ip = mostrarIps ? ipReal : enmascararIp(ipReal);
    const hora = horaDeMadrid(peticion.timestamp ?? "");
    const dia = hora.slice(0, 10);
    const agenteResumido = resumirAgente(agente);
    visitas.push({
      hora,
      ip,
      ...agenteResumido,
      desde: hostDe(referer) || "sin referer",
      ...(desarrollo ? { desarrollo: true as const } : {}),
    });

    const deEseDia = dias.get(dia) ?? { cargas: 0, ips: new Set<string>() };
    deEseDia.cargas += 1;
    deEseDia.ips.add(ipReal);
    dias.set(dia, deEseDia);

    // Se agrupa por la IP real y se enseña enmascarada: dos IPs de la misma
    // red salen en filas distintas con la misma etiqueta.
    const deEsaIp = ips.get(ipReal) ?? {
      cargas: 0,
      primera: hora,
      ultima: hora,
      dias: new Set<string>(),
      navegadores: new Set<string>(),
    };
    deEsaIp.cargas += 1;
    deEsaIp.ultima = hora;
    deEsaIp.dias.add(dia);
    deEsaIp.navegadores.add(
      `${agenteResumido.navegador} · ${agenteResumido.sistema}`
    );
    ips.set(ipReal, deEsaIp);
  }

  const porIp = [...ips.entries()]
    .map(([ipReal, datos]) => ({
      ip: mostrarIps ? ipReal : enmascararIp(ipReal),
      cargas: datos.cargas,
      dias: datos.dias.size,
      primera: datos.primera,
      ultima: datos.ultima,
      navegadores: [...datos.navegadores],
    }))
    .sort((a, b) => b.cargas - a.cargas || b.ultima.localeCompare(a.ultima));

  return {
    peticionesLeidas: peticiones.length,
    bots: {
      total: Object.values(bots).reduce((suma, n) => suma + n, 0),
      porTipo: bots,
    },
    deDesarrollo: {
      total: deDesarrollo,
      incluidas: incluirDesarrollo,
    },
    cargas: visitas.length,
    ipsDistintas: ips.size,
    porDia: [...dias.entries()]
      .map(([dia, datos]) => ({
        dia,
        cargas: datos.cargas,
        ipsDistintas: datos.ips.size,
      }))
      .sort((a, b) => b.dia.localeCompare(a.dia)),
    porIp: porIp.slice(0, MAX_IPS),
    ...(porIp.length > MAX_IPS
      ? { ipsSinMostrar: porIp.length - MAX_IPS }
      : {}),
    // Las más recientes, en orden.
    visitas: visitas.slice(-MAX_VISITAS),
  };
}

const PROYECCION_DE_VISITAS =
  "json(timestamp,httpRequest.remoteIp,httpRequest.userAgent,httpRequest.referer,httpRequest.status)";

export async function visitasDesdeElApi(
  opciones: {
    desde: string;
    hasta?: string;
    mostrarIps?: boolean;
    incluirDesarrollo?: boolean;
  },
  {
    gcloudFn = gcloud,
    ahora = Date.now(),
  }: { gcloudFn?: Gcloud; ahora?: number } = {}
) {
  const filtro = filtroDeVisitas(opciones.desde, opciones.hasta, ahora);
  const salida = await gcloudFn([
    "logging",
    "read",
    filtro,
    `--limit=${LIMITE_DE_PETICIONES}`,
    `--format=${PROYECCION_DE_VISITAS}`,
  ]);
  const peticiones = JSON.parse(salida || "[]") as PeticionDeVisita[];
  return {
    nota: "Una carga = una página con precios (portada, sectores, planes) abierta en un navegador; el referer no trae la página. Horas en Europe/Madrid. Una IP de un proveedor en la nube (AWS 3.x, 52.x, 54.x; Google Cloud 34.x, 35.x…) con user agent de navegador suele ser una previsualización o un bot que no se identifica.",
    truncado: peticiones.length >= LIMITE_DE_PETICIONES,
    ...analizarVisitas(peticiones, opciones),
  };
}

// ── Fuente «vercel»: Vercel Web Analytics por la CLI ────────────────────

export const PROYECTOS_DE_VERCEL = {
  web: "alhabla-web",
  app: "alhabla-frontend",
} as const;

/** Dimensiones de vercel.analytics_pageview.count (`vercel metrics schema`)
 * más «dia», que no es una dimensión sino la granularidad diaria. */
export const DIMENSIONES_DE_VERCEL = [
  "dia",
  "request_path",
  "referrer_hostname",
  "country",
  "device_type",
  "browser_name",
  "os_name",
  "request_hostname",
  "route",
] as const;
export type DimensionDeVercel = (typeof DIMENSIONES_DE_VERCEL)[number];

const METRICA = "vercel.analytics_pageview.count";
const CARPETA_DE_VERCEL = "/private/tmp";
const PLAZO_DE_VERCEL_MS = 60_000;

/** Firma de un ejecutor de la CLI de Vercel: se inyecta en los tests. */
export type Vercel = (argumentos: string[]) => Promise<string>;

/** Un fallo de la CLI con el comando que lo arregla. */
export class FalloDeVercel extends Error {
  constructor(
    mensaje: string,
    readonly arreglo: string
  ) {
    super(mensaje);
  }
}

const SIN_SESION =
  /No existing credentials|Waiting for authentication|Please log in|not logged in/i;

function lanzarVercel(binario: string, argumentos: string[]): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const proceso = spawn(binario, [...argumentos, "--no-color"], {
      cwd: CARPETA_DE_VERCEL,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let salida = "";
    let errores = "";
    // Sin sesión, la CLI abre el login por dispositivo y se queda esperando:
    // se corta en cuanto lo dice.
    const vigilar = () => {
      if (SIN_SESION.test(salida + errores)) proceso.kill();
    };
    const plazo = setTimeout(() => proceso.kill(), PLAZO_DE_VERCEL_MS);
    proceso.stdout.on("data", (trozo: Buffer) => {
      salida += trozo.toString();
      vigilar();
    });
    proceso.stderr.on("data", (trozo: Buffer) => {
      errores += trozo.toString();
      vigilar();
    });
    proceso.on("error", (error) => {
      clearTimeout(plazo);
      rechazar(error);
    });
    proceso.on("close", (codigo, senal) => {
      clearTimeout(plazo);
      if (SIN_SESION.test(salida + errores)) {
        rechazar(
          new FalloDeVercel(
            "[MCP] La CLI de Vercel no tiene sesión",
            "vercel login (en una terminal del Mac; la cuenta es mmartid)"
          )
        );
      } else if (senal) {
        rechazar(
          new FalloDeVercel(
            `[MCP] vercel ${argumentos[0]} no respondió en ${PLAZO_DE_VERCEL_MS / 1000} s`,
            "vercel whoami (desde /private/tmp) para ver si la CLI responde"
          )
        );
      } else if (codigo !== 0 && !salida.includes("{")) {
        rechazar(
          new Error(
            `[MCP] vercel ${argumentos[0]} falló: ${recortar(errores.trim().split("\n").slice(-3).join(" "), 500)}`
          )
        );
      } else {
        // Con un error de la consulta, la CLI sale con 1 y deja un JSON
        // { error } en stdout: lo interpreta leerSalidaDeVercel.
        resolver(salida);
      }
    });
  });
}

/** `vercel <argumentos>` desde /private/tmp. Si no está en el PATH del MCP,
 * prueba la instalación global de npm del usuario. */
export const vercel: Vercel = async (argumentos) => {
  const candidatos = ["vercel", join(homedir(), ".npm-global/bin/vercel")];
  for (const binario of candidatos) {
    try {
      return await lanzarVercel(binario, argumentos);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  throw new FalloDeVercel(
    "[MCP] No está la CLI de Vercel",
    "npm i -g vercel && vercel login"
  );
};

type FilaDeMetrica = Record<string, unknown> & { timestamp?: string };

export type RespuestaDeMetricas = {
  query?: {
    groupBy?: string[];
    startTime?: string;
    endTime?: string;
    granularity?: Record<string, number>;
  };
  summary?: FilaDeMetrica[];
  data?: FilaDeMetrica[];
  error?: { code?: string; message?: string };
};

/** La salida de `vercel metrics … -F json`: el JSON (aunque llegue con
 * algo delante) o un error con el mensaje de Vercel. */
export function leerSalidaDeVercel(texto: string): RespuestaDeMetricas {
  const inicio = texto.indexOf("{");
  if (inicio < 0) {
    throw new Error(
      `[MCP] vercel metrics no devolvió JSON: ${recortar(texto.trim(), 300)}`
    );
  }
  const respuesta = JSON.parse(texto.slice(inicio)) as RespuestaDeMetricas;
  if (respuesta.error) {
    throw new Error(
      `[MCP] vercel metrics: ${respuesta.error.message ?? respuesta.error.code ?? "error"}`
    );
  }
  return respuesta;
}

/** El valor de una fila: la única clave que no es la hora ni una dimensión
 * (vercel_analytics_pageview_count_sum, …_unique_visitor_id). null = sin
 * datos en ese tramo. */
export function valorDeFila(
  fila: FilaDeMetrica,
  dimensiones: string[] = []
): number {
  for (const [clave, valor] of Object.entries(fila)) {
    if (clave === "timestamp" || dimensiones.includes(clave)) continue;
    return typeof valor === "number" ? valor : 0;
  }
  return 0;
}

/** Visitantes y páginas vistas por día (UTC), del más reciente al más
 * antiguo; los días sin nada salen con 0. */
export function seriePorDia(
  visitantes: RespuestaDeMetricas,
  paginas: RespuestaDeMetricas
) {
  const dias = new Map<string, { visitantes: number; paginasVistas: number }>();
  const anotar = (
    respuesta: RespuestaDeMetricas,
    campo: "visitantes" | "paginasVistas"
  ) => {
    for (const fila of respuesta.data ?? []) {
      const dia = (fila.timestamp ?? "").slice(0, 10);
      if (!dia) continue;
      const deEseDia = dias.get(dia) ?? { visitantes: 0, paginasVistas: 0 };
      deEseDia[campo] += valorDeFila(fila);
      dias.set(dia, deEseDia);
    }
  };
  anotar(visitantes, "visitantes");
  anotar(paginas, "paginasVistas");
  return [...dias.entries()]
    .map(([dia, datos]) => ({ dia, ...datos }))
    .sort((a, b) => b.dia.localeCompare(a.dia));
}

/** Visitantes y páginas vistas por cada valor de la dimensión (del resumen
 * de toda la ventana), de más a menos visitantes. */
export function filasPorDimension(
  visitantes: RespuestaDeMetricas,
  paginas: RespuestaDeMetricas,
  dimension: string
) {
  const filas = new Map<
    string,
    { visitantes: number; paginasVistas: number }
  >();
  const anotar = (
    respuesta: RespuestaDeMetricas,
    campo: "visitantes" | "paginasVistas"
  ) => {
    for (const fila of respuesta.summary ?? []) {
      const valor = fila[dimension];
      const clave =
        typeof valor === "string" && valor !== "" ? valor : "(vacío)";
      const deEsa = filas.get(clave) ?? { visitantes: 0, paginasVistas: 0 };
      deEsa[campo] += valorDeFila(fila, [dimension]);
      filas.set(clave, deEsa);
    }
  };
  anotar(visitantes, "visitantes");
  anotar(paginas, "paginasVistas");
  return [...filas.entries()]
    .map(([valor, datos]) => ({ valor, ...datos }))
    .sort(
      (a, b) =>
        b.visitantes - a.visitantes ||
        b.paginasVistas - a.paginasVistas ||
        a.valor.localeCompare(b.valor)
    );
}

export async function visitasDesdeVercel(
  opciones: {
    desde: string;
    hasta?: string;
    proyecto?: keyof typeof PROYECTOS_DE_VERCEL;
    agruparPor?: DimensionDeVercel;
  },
  {
    vercelFn = vercel,
    ahora = Date.now(),
  }: { vercelFn?: Vercel; ahora?: number } = {}
) {
  const proyecto = PROYECTOS_DE_VERCEL[opciones.proyecto ?? "web"];
  const dimension = opciones.agruparPor ?? "request_path";
  const base = [
    "metrics",
    METRICA,
    "-p",
    proyecto,
    "--since",
    momentoDesde(opciones.desde, ahora),
    ...(opciones.hasta ? ["--until", momentoDesde(opciones.hasta, ahora)] : []),
    "-F",
    "json",
  ];
  const unicos = ["-a", "unique/visitor_id"];
  const diario = ["-g", "1d"];
  const agrupado = ["--group-by", dimension, "--limit", "50"];
  const leer = async (argumentos: string[]) =>
    leerSalidaDeVercel(await vercelFn(argumentos));

  const [visitantesPorDia, paginasPorDia, visitantesPorX, paginasPorX] =
    await Promise.all([
      leer([...base, ...unicos, ...diario]),
      leer([...base, ...diario]),
      dimension === "dia" ? null : leer([...base, ...unicos, ...agrupado]),
      dimension === "dia" ? null : leer([...base, ...agrupado]),
    ]);

  return {
    proyecto,
    desde: visitantesPorDia.query?.startTime ?? null,
    hasta: visitantesPorDia.query?.endTime ?? null,
    nota: "Solo cuenta a quien acepta las cookies; visitor_id cambia cada día (quien vuelve otro día cuenta otra vez). Días en UTC.",
    visitantesUnicos: valorDeFila(visitantesPorDia.summary?.[0] ?? {}),
    paginasVistas: valorDeFila(paginasPorDia.summary?.[0] ?? {}),
    porDia: seriePorDia(visitantesPorDia, paginasPorDia),
    ...(visitantesPorX && paginasPorX
      ? {
          [`por_${dimension}`]: filasPorDimension(
            visitantesPorX,
            paginasPorX,
            dimension
          ),
        }
      : {}),
  };
}

// ── Las dos juntas ──────────────────────────────────────────────────────

export type OpcionesDeVisitas = {
  fuente?: "api" | "vercel" | "ambas";
  desde?: string;
  hasta?: string;
  mostrarIps?: boolean;
  incluirDesarrollo?: boolean;
  proyecto?: keyof typeof PROYECTOS_DE_VERCEL;
  agruparPor?: DimensionDeVercel;
};

async function parte<T>(
  trabajo: () => Promise<T>
): Promise<T | { error: string; arreglo?: string }> {
  try {
    return await trabajo();
  } catch (error) {
    return {
      error: (error as Error).message,
      ...(error instanceof FalloDeVercel ? { arreglo: error.arreglo } : {}),
    };
  }
}

export async function visitasWeb(
  opciones: OpcionesDeVisitas,
  {
    gcloudFn = gcloud,
    vercelFn = vercel,
    ahora = Date.now(),
  }: { gcloudFn?: Gcloud; vercelFn?: Vercel; ahora?: number } = {}
) {
  const fuente = opciones.fuente ?? "ambas";
  const desde = opciones.desde ?? "7d";
  // Valida la ventana antes de lanzar nada.
  const desdeIso = momentoDesde(desde, ahora);
  const [api, deVercel] = await Promise.all([
    fuente === "vercel"
      ? null
      : parte(() =>
          visitasDesdeElApi({ ...opciones, desde }, { gcloudFn, ahora })
        ),
    fuente === "api"
      ? null
      : parte(() =>
          visitasDesdeVercel({ ...opciones, desde }, { vercelFn, ahora })
        ),
  ]);
  return {
    desde: desdeIso,
    ...(api ? { api } : {}),
    ...(deVercel ? { vercel: deVercel } : {}),
  };
}
