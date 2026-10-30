/**
 * Las URL y los dominios como los trata el backend, para la demostración:
 * `dominioDe` (minúsculas, sin `www.` ni punto final), `claveDeUrl` (la misma
 * página con otro seguimiento es la misma) y `limpiarUrl` (la URL que se
 * guarda, sin parámetros de seguimiento ni ancla).
 */

export function dominioDe(url: string): string {
  return new URL(url).hostname
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/\.$/, "");
}

/** Los parámetros de seguimiento que el backend quita para saber si una URL ya existe. */
const PARAMETROS_DE_SEGUIMIENTO = /^(utm_|gclid$|fbclid$|mc_|ref$)/i;

/**
 * La clave de una URL, como `normalizarUrl` del backend: la misma página con
 * distinto seguimiento (`utm_*`, `gclid`, `fbclid`, `mc_*`, `ref`), `www`,
 * barra final, puerto o ancla es la misma.
 */
export function claveDeUrl(url: string): string {
  const u = new URL(url);
  const parametros = [...u.searchParams.entries()]
    .filter(([clave]) => !PARAMETROS_DE_SEGUIMIENTO.test(clave))
    .sort(([a], [b]) => a.localeCompare(b));
  const consulta = new URLSearchParams(parametros).toString();
  const ruta =
    u.pathname.length > 1 ? u.pathname.replace(/\/+$/, "") : u.pathname;
  return `${u.protocol}//${dominioDe(url)}${ruta}${consulta ? `?${consulta}` : ""}`;
}

/** La URL tal como se guarda: sin parámetros de seguimiento y sin ancla. */
export function limpiarUrl(url: string): string {
  const u = new URL(url);
  for (const clave of [...u.searchParams.keys()]) {
    if (PARAMETROS_DE_SEGUIMIENTO.test(clave)) u.searchParams.delete(clave);
  }
  u.hash = "";
  u.hostname = u.hostname.replace(/\.$/, "");
  return u.href;
}

export function esDominioPropio(dominio: string): boolean {
  return dominio === "alhabla.ai" || dominio.endsWith(".alhabla.ai");
}

export function esDominioPropioOInterno(dominio: string): boolean {
  return (
    esDominioPropio(dominio) ||
    dominio === "localhost" ||
    dominio.endsWith(".local") ||
    dominio.endsWith(".internal") ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(dominio)
  );
}
