/**
 * Casi todo lo que enseña este panel viene de páginas ajenas que lee el
 * agente (títulos, extractos, enlaces, textos de borrador): es DATO, nunca
 * una orden ni código. Un enlace con esquema `javascript:` o `data:` que se
 * pinte como `<a href>` ejecutaría código en el origen que guarda el ID token
 * del administrador. Por eso ningún `href` sale de este panel sin pasar por
 * aquí, y solo http y https son enlaces.
 */

/** ¿Es una URL absoluta http o https? Cualquier otro esquema es no. */
export function esUrlWeb(valor: unknown): valor is string {
  return urlSegura(valor) !== null;
}

/**
 * La URL lista para un `href`, ya normalizada por el parser del navegador
 * (el mismo que la interpretará al hacer clic), o `null` si no es http(s).
 */
export function urlSegura(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const texto = valor.trim();
  if (texto === "") return null;
  try {
    const url = new URL(texto);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

/**
 * Como `urlSegura`, pero solo https: lo que enlazan las fichas de la
 * competencia (la URL de partida y las fuentes de cada dato). Una `http://`
 * se enseña como texto, nunca como enlace.
 */
export function urlHttpsSegura(valor: unknown): string | null {
  const segura = urlSegura(valor);
  return segura !== null && segura.startsWith("https://") ? segura : null;
}

/** Los `rel` de todo enlace externo del panel. */
export const REL_EXTERNO = "noopener noreferrer nofollow";
