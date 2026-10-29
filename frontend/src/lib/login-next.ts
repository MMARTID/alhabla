/** Una ruta interna de la app (`/checkout?plan=pro`), o null si no lo es:
 * una URL absoluta o `//host` sería un redirect abierto. */
export function rutaInterna(destino: string | null | undefined): string | null {
  if (!destino || !destino.startsWith("/")) return null;
  // El navegador trata `\` como `/` y descarta tabuladores y saltos de línea
  // al resolver la URL, así que `/\host` o `/<tab>/host` acaban en otro
  // dominio. Se resuelve contra un origen ficticio y solo vale si sigue en él.
  try {
    const base = "https://app.invalid";
    const url = new URL(destino, base);
    if (url.origin !== base) return null;
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
}

/** `?next=/checkout?plan=pro` tras un 401: solo rutas internas de la app. */
export function destinoTrasLogin(search: string): string {
  return rutaInterna(new URLSearchParams(search).get("next")) ?? "/";
}
