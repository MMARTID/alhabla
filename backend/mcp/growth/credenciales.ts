import { execFile } from "node:child_process";
import { PREFIJO_DE_TOKEN } from "../../src/modules/growth/tokens.js";

/**
 * De dónde sale la URL de la API de Growth y el token del agente.
 *
 * El proceso del MCP corre en el Mac con el token de un agente que lee
 * páginas de terceros: el token solo puede viajar a un destino de una lista
 * cerrada (la API de producción o este mismo equipo) y no sale nunca en una
 * respuesta, un error ni un log. No se lee del `.env` del repo: o el entorno
 * del proceso (pruebas) o el llavero de macOS.
 */

export const ORIGEN_DE_PRODUCCION = "https://api.alhabla.ai";
export const SERVICIO_DEL_LLAVERO = "alhabla-growth";

const ANFITRIONES_LOCALES = new Set(["localhost", "127.0.0.1", "[::1]"]);

export type Destino = {
  /** Origen sin barra final: `https://api.alhabla.ai` o `http://localhost:3000`. */
  base: string;
  /** Nombre de host, que es la cuenta del llavero. */
  host: string;
  /** `true` si es este mismo equipo (backend de desarrollo). */
  local: boolean;
};

export type OrigenDelToken = "entorno" | "llavero";

export type Token = { valor: string; origen: OrigenDelToken };

export type ErrorDeCredencialesTipo =
  "url_no_permitida" | "sin_token" | "token_mal_formado";

export class ErrorDeCredenciales extends Error {
  constructor(
    readonly tipo: ErrorDeCredencialesTipo,
    mensaje: string
  ) {
    super(mensaje);
    this.name = "ErrorDeCredenciales";
  }
}

type Entorno = Record<string, string | undefined>;

/**
 * La URL de la API a la que se enviará el token. Solo se acepta exactamente
 * `https://api.alhabla.ai` o `http(s)` contra este equipo; cualquier otra (un
 * `dev-api`, un `http` sin cifrar, un host ajeno, una URL con usuario y
 * contraseña) se rechaza, para que un valor mal puesto no mande el token a
 * otro sitio. En el mensaje solo sale el nombre de host: nunca la URL entera,
 * que podría llevar credenciales.
 */
export function destinoDeGrowth(env: Entorno = process.env): Destino {
  const bruto = env.GROWTH_API_URL?.trim() || ORIGEN_DE_PRODUCCION;

  let url: URL;
  try {
    url = new URL(bruto);
  } catch {
    throw new ErrorDeCredenciales(
      "url_no_permitida",
      "GROWTH_API_URL no es una URL válida. Déjala sin definir (usa https://api.alhabla.ai) o apunta a http://localhost:3000."
    );
  }

  const rechazar = (motivo: string): never => {
    throw new ErrorDeCredenciales(
      "url_no_permitida",
      `GROWTH_API_URL apunta a «${url.hostname}», ${motivo}. Solo se permite ${ORIGEN_DE_PRODUCCION} o localhost / 127.0.0.1 / [::1].`
    );
  };

  if (url.username || url.password) {
    rechazar("y lleva usuario o contraseña");
  }
  if ((url.pathname !== "/" && url.pathname !== "") || url.search || url.hash) {
    rechazar("y lleva ruta o parámetros");
  }

  const local = ANFITRIONES_LOCALES.has(url.hostname);
  if (local) {
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      rechazar("con un protocolo que no es http(s)");
    }
  } else if (
    url.origin !== ORIGEN_DE_PRODUCCION ||
    url.hostname !== "api.alhabla.ai"
  ) {
    rechazar("que no es la API de Alhabla");
  }

  return { base: url.origin, host: url.hostname, local };
}

/** El comando para guardar el token: SIN el valor, que lo pide por terminal (`ps` lo vería). */
export function comandoParaGuardarElToken(host: string): string {
  return `security add-generic-password -s ${SERVICIO_DEL_LLAVERO} -a ${host} -U -w`;
}

const FORMA_DE_TOKEN = new RegExp(`^${PREFIJO_DE_TOKEN}[A-Za-z0-9_-]{16,200}$`);

/** Comprueba la forma del token sin repetir su valor en el mensaje. */
export function validarToken(token: string, origen: OrigenDelToken): Token {
  const limpio = token.trim();
  if (!FORMA_DE_TOKEN.test(limpio)) {
    const de = origen === "entorno" ? "GROWTH_AGENT_TOKEN" : "el llavero";
    throw new ErrorDeCredenciales(
      "token_mal_formado",
      `El token de ${de} no tiene la forma de un token de agente de Growth (empieza por «${PREFIJO_DE_TOKEN}», sin espacios ni saltos de línea).`
    );
  }
  return { valor: limpio, origen };
}

/**
 * Lee la contraseña del llavero de macOS con `security`, sin shell y con un
 * tope de 5 s (si el llavero pide una autorización que nadie ve, no se
 * queda colgado). Devuelve `null` si no hay elemento.
 */
export type LeerLlavero = (
  servicio: string,
  cuenta: string
) => Promise<string | null>;

type EjecutarSecurity = (
  programa: string,
  argumentos: string[],
  opciones: { timeout: number; maxBuffer: number }
) => Promise<{ stdout: string }>;

const ejecutarDeVerdad: EjecutarSecurity = (programa, argumentos, opciones) =>
  new Promise((resolver, rechazar) => {
    execFile(programa, argumentos, opciones, (error, stdout) => {
      if (error) rechazar(error);
      else resolver({ stdout: String(stdout) });
    });
  });

/** `security` sale con 44 cuando el elemento no existe. */
const CODIGO_DE_NO_ENCONTRADO = 44;

export function crearLectorDeLlavero(
  opciones: {
    plataforma?: string;
    ejecutar?: EjecutarSecurity;
  } = {}
): LeerLlavero {
  const plataforma = opciones.plataforma ?? process.platform;
  const ejecutar = opciones.ejecutar ?? ejecutarDeVerdad;
  return async (servicio, cuenta) => {
    if (plataforma !== "darwin") return null;
    try {
      const { stdout } = await ejecutar(
        "security",
        ["find-generic-password", "-s", servicio, "-a", cuenta, "-w"],
        { timeout: 5_000, maxBuffer: 64 * 1024 }
      );
      return stdout.trim() || null;
    } catch (error) {
      const e = error as { code?: number | string; killed?: boolean };
      if (e.code === CODIGO_DE_NO_ENCONTRADO) return null;
      if (e.code === "ENOENT") return null;
      if (e.killed) {
        throw new Error(
          "El llavero no respondió en 5 s (¿espera una autorización en pantalla?).",
          { cause: error }
        );
      }
      // El mensaje de `security` no lleva el valor, pero tampoco hace falta.
      throw new Error("No se pudo leer el llavero de macOS.", { cause: error });
    }
  };
}

export type Credenciales = {
  /** La URL permitida; lanza `ErrorDeCredenciales` si no lo es. No toca el token. */
  destino(): Destino;
  /** El token, de la caché si ya se leyó. */
  token(): Promise<Token>;
  /** Olvida el token cacheado (para releerlo tras un 401: quizá se rotó). */
  invalidar(): void;
};

export function crearCredenciales(
  opciones: { env?: Entorno; leerLlavero?: LeerLlavero } = {}
): Credenciales {
  const env = opciones.env ?? process.env;
  const leerLlavero = opciones.leerLlavero ?? crearLectorDeLlavero();
  let cacheado: Token | null = null;

  return {
    destino: () => destinoDeGrowth(env),

    async token() {
      if (cacheado) return cacheado;
      const destino = destinoDeGrowth(env);

      const delEntorno = env.GROWTH_AGENT_TOKEN?.trim();
      if (delEntorno) {
        cacheado = validarToken(delEntorno, "entorno");
        return cacheado;
      }

      let delLlavero: string | null = null;
      let fallo: string | null = null;
      try {
        // La cuenta es el host: un token de dev nunca viaja a prod ni al revés.
        delLlavero = await leerLlavero(SERVICIO_DEL_LLAVERO, destino.host);
      } catch (error) {
        fallo = error instanceof Error ? error.message : String(error);
      }
      if (delLlavero) {
        cacheado = validarToken(delLlavero, "llavero");
        return cacheado;
      }

      throw new ErrorDeCredenciales(
        "sin_token",
        `No hay token de agente de Growth para ${destino.host}. ` +
          `Guárdalo en el llavero (te pide el valor por terminal): ${comandoParaGuardarElToken(destino.host)} ` +
          "o define GROWTH_AGENT_TOKEN en el entorno del proceso." +
          (fallo ? ` (Llavero: ${fallo})` : "")
      );
    },

    invalidar() {
      cacheado = null;
    },
  };
}

// ── Censura ──────────────────────────────────────────────────────────────

const TOKEN_DE_AGENTE = new RegExp(`${PREFIJO_DE_TOKEN}[A-Za-z0-9_-]+`, "g");
const CABECERA_BEARER = /Bearer\s+[A-Za-z0-9._~+/=-]{8,}/gi;
const JWT = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/g;

/**
 * Tapa todo lo que parezca un token (de agente, cabecera Bearer o JWT) en un
 * texto que va a salir del proceso: respuestas de herramientas, errores y logs.
 * Un backend que devolviera la cabecera en un 500 no puede filtrarla.
 */
export function censurar(texto: string): string {
  return texto
    .replace(CABECERA_BEARER, "Bearer …")
    .replace(JWT, "jwt…")
    .replace(TOKEN_DE_AGENTE, `${PREFIJO_DE_TOKEN}…`);
}
