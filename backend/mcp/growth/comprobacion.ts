import { crearClienteDeGrowth, ErrorDeGrowthApi } from "./cliente.js";
import {
  comandoParaGuardarElToken,
  crearCredenciales,
  ErrorDeCredenciales,
  type Credenciales,
  type LeerLlavero,
  type OrigenDelToken,
} from "./credenciales.js";

/**
 * ¿Puede este proceso hablar con la API de Growth? Una sola petición de
 * lectura (`GET /growth/agente/contexto`) comprueba a la vez que el servidor
 * responde, que la URL está permitida y que el token vale y puede leer. La usan
 * `estado_growth` (estricta) y la pieza de `diagnostico_mcp` (opcional hasta
 * que haya token). Nunca devuelve el token.
 */

export type EstadoDeLaComprobacion =
  | "ok"
  | "sin_configurar"
  | "url_no_permitida"
  | "token_mal_formado"
  | "token_invalido"
  | "sin_permiso"
  | "api_caida";

export type ResultadoDeComprobacion = {
  estado: EstadoDeLaComprobacion;
  /** `false` solo cuando hay algo que arreglar (sin token NO lo es: es opcional). */
  ok: boolean;
  detalle: string;
  arreglo?: string;
  origen?: string;
  origenDelToken?: OrigenDelToken;
  ms?: number;
  /** El `contexto` tal como lo devolvió la API (solo si respondió). */
  contexto?: Record<string, unknown>;
};

export const DETALLE_SIN_CONFIGURAR =
  "sin configurar (opcional hasta la Fase 2)";

export async function comprobarGrowth(
  opciones: {
    credenciales?: Credenciales;
    env?: Record<string, string | undefined>;
    leerLlavero?: LeerLlavero;
    fetchFn?: typeof fetch;
  } = {}
): Promise<ResultadoDeComprobacion> {
  const credenciales =
    opciones.credenciales ??
    crearCredenciales({ env: opciones.env, leerLlavero: opciones.leerLlavero });

  let origen: string;
  let host: string;
  let origenDelToken: OrigenDelToken;
  try {
    const destino = credenciales.destino();
    origen = destino.base;
    host = destino.host;
    origenDelToken = (await credenciales.token()).origen;
  } catch (error) {
    if (error instanceof ErrorDeCredenciales) {
      if (error.tipo === "sin_token") {
        return {
          estado: "sin_configurar",
          ok: true,
          detalle: DETALLE_SIN_CONFIGURAR,
          arreglo: error.message,
        };
      }
      return {
        estado: error.tipo,
        ok: false,
        detalle: error.message,
        arreglo:
          error.tipo === "url_no_permitida"
            ? "Quita GROWTH_API_URL del entorno (usa https://api.alhabla.ai) o apúntala a http://localhost:3000."
            : "Vuelve a guardar el token (te pide el valor por terminal) con el comando de `security add-generic-password` o corrige GROWTH_AGENT_TOKEN.",
      };
    }
    throw error;
  }

  const cliente = crearClienteDeGrowth({
    credenciales,
    fetchFn: opciones.fetchFn,
    // Un diagnóstico no espera reintentos: dice lo que ve a la primera.
    esperasDeReintento: [],
  });

  const inicio = Date.now();
  try {
    const { datos } = await cliente.peticion<Record<string, unknown>>(
      "GET",
      "/growth/agente/contexto",
      { consulta: { sinAfirmaciones: true }, timeoutMs: 10_000 }
    );
    return {
      estado: "ok",
      ok: true,
      detalle: `API de Growth en ${origen} responde y el token (${origenDelToken}) es válido`,
      origen,
      origenDelToken,
      ms: Date.now() - inicio,
      contexto: datos && typeof datos === "object" ? datos : undefined,
    };
  } catch (error) {
    const ms = Date.now() - inicio;
    const base = { ok: false, origen, origenDelToken, ms } as const;
    if (error instanceof ErrorDeGrowthApi) {
      if (error.status === 401) {
        return {
          ...base,
          estado: "token_invalido",
          detalle: error.message,
          arreglo: `Crea otro token con el script de tokens y guárdalo: ${comandoParaGuardarElToken(host)}`,
        };
      }
      if (error.status === 403) {
        return {
          ...base,
          estado: "sin_permiso",
          detalle: error.message,
          arreglo:
            "El token no tiene el alcance «leer»: crea otro con los alcances leer, escribir y conocimiento.",
        };
      }
      return {
        ...base,
        estado: "api_caida",
        detalle: error.message,
        arreglo:
          origen === "https://api.alhabla.ai"
            ? "Mira estado_prod / errores_prod (alhabla-dev): la API de producción no responde bien."
            : "Levanta el backend de dev (`estado_dev`) y comprueba GROWTH_API_URL.",
      };
    }
    throw error;
  }
}
