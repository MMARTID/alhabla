import { exigirUrlLocal } from "./entorno.js";
import { firmarComoRetell, firmarComoTelnyx } from "./firmas.js";

export const BASE_TELNYX_SIMULACION = "http://localhost:3010";
export const BASE_RETELL_DEV = "http://localhost:3000";

const COMO_ARRANCAR = {
  "/webhooks/telnyx":
    "Levanta el backend de simulación con scripts/backend-sim.sh (desde la raíz del repo).",
  "/webhooks/retell":
    "Levanta el backend de dev con docker compose --profile dev up -d (desde la raíz del repo).",
} as const;

type Prefijo = keyof typeof COMO_ARRANCAR;

/**
 * URL final de un webhook simulado. Se comprueba la URL YA RESUELTA, no el
 * texto: `new URL` aplica los `..` (también `%2e%2e`) y las barras
 * invertidas, así que `/webhooks/telnyx/../../billing/webhook` acabaría en
 * `/billing/webhook` aunque el texto empiece por `/webhooks/telnyx`. Y una
 * ruta `//otro.host/...` cambiaría de máquina.
 */
export function urlDeWebhook(ruta: string, base: string, prefijo: Prefijo): URL {
  const origen = exigirUrlLocal(base);
  const url = new URL(ruta, origen);
  const permitida = new RegExp(`^${prefijo}(/|$)`);
  if (url.origin !== origen.origin || !permitida.test(url.pathname)) {
    throw new Error(
      `[MCP] La ruta tiene que quedar dentro de ${prefijo} en ${origen.origin}; «${ruta}» acaba en ${url.origin}${url.pathname}`
    );
  }
  return url;
}

/**
 * Antes de firmar nada: ¿hay backend escuchando? Sin esto, un backend-sim
 * apagado (o lanzado desde un worktree que ya se borró) devolvía un
 * `fetch failed` sin pista. Cualquier respuesta HTTP vale —un 503 de /health
 * es un backend vivo con alguna dependencia caída—; solo un fallo de red
 * cuenta como apagado.
 */
async function comprobarBackend(url: URL, prefijo: Prefijo): Promise<void> {
  try {
    await fetch(new URL("/health", url.origin), {
      signal: AbortSignal.timeout(3_000),
    });
  } catch (error) {
    const motivo =
      (error as { cause?: { code?: string } }).cause?.code ??
      (error as Error).message;
    throw new Error(
      `[MCP] No hay ningún backend respondiendo en ${url.origin} (${motivo}). ${COMO_ARRANCAR[prefijo]}`,
      { cause: error }
    );
  }
}

async function enviar(url: URL, cuerpo: string, cabeceras: Record<string, string>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...cabeceras },
    body: cuerpo,
  });
  const texto = await res.text();
  let respuesta: unknown = texto;
  try {
    respuesta = JSON.parse(texto);
  } catch {
    // No es JSON: se devuelve el texto tal cual.
  }
  return { url: url.toString(), status: res.status, respuesta };
}

export async function enviarWebhookTelnyx({
  ruta,
  cuerpo,
  baseUrl = BASE_TELNYX_SIMULACION,
  clavePrivada,
  callControlId,
  crearLlamada,
  cabeceras = {},
}: {
  ruta: string;
  cuerpo: Record<string, unknown>;
  baseUrl?: string;
  clavePrivada: string;
  callControlId?: string;
  /** Crea la llamada simulada si no viene callControlId. Se llama solo
   * cuando la ruta es válida y hay backend: un error antes no deja filas. */
  crearLlamada?: () => Promise<string>;
  cabeceras?: Record<string, string>;
}) {
  const url = urlDeWebhook(ruta, baseUrl, "/webhooks/telnyx");
  await comprobarBackend(url, "/webhooks/telnyx");
  const llamada = callControlId ?? (await crearLlamada?.());
  const texto = JSON.stringify(cuerpo);
  const { firma, marcaDeTiempo } = firmarComoTelnyx(texto, clavePrivada);
  // La firma va la última: unas cabeceras extra no pueden pisarla.
  const resultado = await enviar(url, texto, {
    ...(llamada ? { "x-alhabla-call-control-id": llamada } : {}),
    ...cabeceras,
    "telnyx-signature-ed25519": firma,
    "telnyx-timestamp": marcaDeTiempo,
  });
  return { ...resultado, llamada: llamada ?? null };
}

export async function enviarWebhookRetell({
  ruta,
  cuerpo,
  baseUrl = BASE_RETELL_DEV,
  apiKey,
}: {
  ruta: string;
  cuerpo: Record<string, unknown>;
  baseUrl?: string;
  apiKey: string;
}) {
  const url = urlDeWebhook(ruta, baseUrl, "/webhooks/retell");
  await comprobarBackend(url, "/webhooks/retell");
  const texto = JSON.stringify(cuerpo);
  const firma = await firmarComoRetell(texto, apiKey);
  return enviar(url, texto, { "x-retell-signature": firma });
}
