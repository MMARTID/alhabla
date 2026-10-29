import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { exigirUrlLocal, variable } from "./entorno.js";
import pg from "./pg.js";
import { recortar } from "./privacidad.js";
import { ejecutarSoloLectura } from "./sqlDeSoloLectura.js";
import { BASE_DEV, BASE_TELNYX_SIMULACION } from "./webhooks.js";

/**
 * Entrar en dev como un negocio sin contraseña: el JWT que emite /auth (para
 * curl o llamar_api_dev) y el enlace que abre la app de dev con su sesión.
 * Solo contra la BD de dev (la URL llega comprobada como local) y backends de
 * localhost.
 */
export const URL_APP_DEV = "http://localhost:3001";

export type UsuarioDeDev = {
  id: string;
  email: string;
  businessId: string;
  tokenVersion: number;
};

/** Por email o por negocio (el usuario más antiguo del negocio). */
export async function buscarUsuarioDeDev(
  urlDeBdDeDev: string,
  { email, businessId }: { email?: string; businessId?: string }
): Promise<UsuarioDeDev> {
  if (!email && !businessId) {
    throw new Error("[MCP] Indica email o businessId");
  }
  const { filas } = await ejecutarSoloLectura(
    urlDeBdDeDev,
    `SELECT id, email, "businessId", "tokenVersion"
       FROM users
      WHERE ($1::text IS NULL OR email = $1)
        AND ($2::text IS NULL OR "businessId" = $2)
      ORDER BY "createdAt"
      LIMIT 1`,
    { parametros: [email ?? null, businessId ?? null] }
  );
  const usuario = filas[0] as UsuarioDeDev | undefined;
  if (!usuario) {
    throw new Error("[MCP] No hay ningún usuario así en la BD de dev");
  }
  return usuario;
}

/** Mismo payload que createToken (modules/auth/routes.ts): `tv` tiene que
 * coincidir con tokenVersion o plugins/auth.ts lo rechaza. */
export function firmarSesionDeDev(
  env: Record<string, string>,
  usuario: UsuarioDeDev,
  expiraEn = "1h"
): string {
  return jwt.sign(
    { id: usuario.id, businessId: usuario.businessId, tv: usuario.tokenVersion },
    variable(env, "JWT_SECRET"),
    { expiresIn: expiraEn as jwt.SignOptions["expiresIn"] }
  );
}

const MAX_CARACTERES_DE_RESPUESTA = 60_000;

/**
 * Una petición a la API de dev (o de backend-sim) con la sesión de un
 * usuario. La ruta se resuelve contra la base y tiene que quedarse en ella:
 * «//otro.host» o una URL absoluta no salen del Mac.
 */
export async function llamarApiDeDev({
  env,
  urlDeBdDeDev,
  metodo,
  ruta,
  cuerpo,
  email,
  businessId,
  backend = "dev",
  sinSesion = false,
  fetchFn = fetch,
}: {
  env: Record<string, string>;
  urlDeBdDeDev: string;
  metodo: string;
  ruta: string;
  cuerpo?: unknown;
  email?: string;
  businessId?: string;
  backend?: "dev" | "sim";
  sinSesion?: boolean;
  fetchFn?: typeof fetch;
}) {
  const base = exigirUrlLocal(backend === "sim" ? BASE_TELNYX_SIMULACION : BASE_DEV);
  const url = new URL(ruta, base);
  if (url.origin !== base.origin || !ruta.startsWith("/")) {
    throw new Error(
      `[MCP] La ruta tiene que empezar por «/» y quedarse en ${base.origin}; «${ruta}» acaba en ${url.origin}`
    );
  }
  const usuario = sinSesion
    ? null
    : await buscarUsuarioDeDev(urlDeBdDeDev, { email, businessId });
  const cabeceras: Record<string, string> = {};
  if (usuario) {
    cabeceras.authorization = `Bearer ${firmarSesionDeDev(env, usuario, "10m")}`;
  }
  if (cuerpo !== undefined) cabeceras["content-type"] = "application/json";

  const inicio = Date.now();
  const res = await fetchFn(url, {
    method: metodo.toUpperCase(),
    headers: cabeceras,
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(60_000),
  }).catch((error) => {
    throw new Error(
      `[MCP] No responde ${base.origin} (${(error as { cause?: { code?: string } }).cause?.code ?? (error as Error).message}). ${backend === "sim" ? "Levántalo con backend_sim." : "Mira estado_dev."}`,
      { cause: error }
    );
  });
  const texto = await res.text();
  let respuesta: unknown = recortar(texto, MAX_CARACTERES_DE_RESPUESTA);
  if (texto.length <= MAX_CARACTERES_DE_RESPUESTA) {
    try {
      respuesta = JSON.parse(texto);
    } catch {
      // No es JSON: se devuelve el texto.
    }
  }
  return {
    peticion: `${metodo.toUpperCase()} ${url.toString()}`,
    ...(usuario
      ? { comoUsuario: { email: usuario.email, businessId: usuario.businessId } }
      : {}),
    status: res.status,
    ms: Date.now() - inicio,
    respuesta,
  };
}

/** Clave del pase en el almacén temporal: la misma que modules/auth/pase.ts. */
export function claveDePase(codigo: string): string {
  return `auth:pase:${codigo}`;
}

/** Solo rutas de la propia app («/agenda», «/llamadas?x=1»). */
export function destinoDeLaApp(destino: string | undefined): string {
  if (!destino) return "/";
  if (!destino.startsWith("/") || destino.startsWith("//") || destino.includes("\\")) {
    throw new Error(`[MCP] «${destino}» no es una ruta de la app (empieza por «/»)`);
  }
  return destino;
}

/**
 * Enlace que abre la app de dev con la sesión de un usuario: guarda en la BD
 * de dev un pase de un solo uso como el del registro (claves_temporales,
 * mismo formato que crearPase) y lo canjea /auth/entrar. El JWT nunca va en
 * la URL. Vale 10 minutos y una sola vez.
 */
export async function crearEnlaceDeEntradaDeDev(
  urlDeBdDeDev: string,
  usuario: UsuarioDeDev,
  destino?: string,
  minutos = 10
): Promise<{ url: string; caduca: string }> {
  const ruta = destinoDeLaApp(destino);
  const codigo = randomBytes(32).toString("hex");
  const cliente = new pg.Client({ connectionString: urlDeBdDeDev });
  await cliente.connect();
  try {
    const { rows } = await cliente.query<{ expiraEn: Date }>(
      `INSERT INTO claves_temporales (clave, valor, "businessId", "expiraEn")
       VALUES ($1, to_jsonb($2::text), $3, now() + $4 * interval '1 minute')
       RETURNING "expiraEn"`,
      [
        claveDePase(codigo),
        JSON.stringify({ id: usuario.id, businessId: usuario.businessId }),
        usuario.businessId,
        minutos,
      ]
    );
    const url = new URL("/auth/entrar", URL_APP_DEV);
    url.searchParams.set("pase", codigo);
    // Siempre: sin destino, /auth/entrar sigue al alta (/bienvenida).
    url.searchParams.set("destino", ruta);
    return { url: url.toString(), caduca: rows[0].expiraEn.toISOString() };
  } finally {
    await cliente.end();
  }
}
