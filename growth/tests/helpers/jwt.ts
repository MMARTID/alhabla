/** Un ID token de Google de mentira: cabecera y cuerpo reales, firma falsa. */
function codificar(objeto: object): string {
  const bytes = new TextEncoder().encode(JSON.stringify(objeto));
  let binario = "";
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function crearJwt(
  opciones: { email?: string; exp?: number } & Record<string, unknown> = {}
): string {
  const {
    email = "admin@alhabla.ai",
    exp = Math.floor(Date.now() / 1000) + 3600,
    ...resto
  } = opciones;
  return `${codificar({ alg: "RS256", typ: "JWT" })}.${codificar({ email, exp, ...resto })}.firma`;
}
