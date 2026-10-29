import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import {
  PROYECTO,
  REGION,
  explicarFalloDeGcloud,
  leerSecreto as leerSecretoDeGcloud,
} from "./gcloud.js";

/**
 * Lectura de la BD de PRODUCCIÓN desde el Mac, con dos barreras:
 *
 * 1. El usuario `alhabla_lectura` de Cloud SQL solo tiene `pg_read_all_data`
 *    y `default_transaction_read_only = on`: aunque la consulta lo intente,
 *    Postgres no le deja escribir.
 * 2. Cada consulta va además en una transacción READ ONLY de una sola
 *    sentencia (sqlDeSoloLectura.ts).
 *
 * La contraseña vive en Secret Manager (`DB_LECTURA_PASSWORD`) y se lee con
 * las credenciales de gcloud del Mac; la conexión va por Cloud SQL Auth Proxy
 * con esas mismas credenciales (`--gcloud-auth`). El proxy se arranca la
 * primera vez que hace falta y muere con el MCP.
 */
const INSTANCIA = `${PROYECTO}:${REGION}:alhabla-db`;
const BASE_DE_DATOS = "alhabla";
export const USUARIO_DE_LECTURA = "alhabla_lectura";
export const SECRETO_DE_LECTURA = "DB_LECTURA_PASSWORD";

let proxy: { proceso: ChildProcess; puerto: number } | null = null;
let contrasena: string | null = null;

export async function urlDeBdDeProd(): Promise<string> {
  const puerto = await arrancarProxy();
  contrasena ??= await leerSecreto(SECRETO_DE_LECTURA);
  return `postgresql://${USUARIO_DE_LECTURA}:${encodeURIComponent(contrasena)}@127.0.0.1:${puerto}/${BASE_DE_DATOS}?sslmode=disable`;
}

async function leerSecreto(nombre: string): Promise<string> {
  try {
    return await leerSecretoDeGcloud(nombre);
  } catch (error) {
    throw new Error(
      `[MCP] No se pudo leer el secreto ${nombre} con gcloud: ${(error as Error).message.replace(/^\[MCP\] /, "")}`,
      { cause: error }
    );
  }
}

async function arrancarProxy(): Promise<number> {
  if (proxy && proxy.proceso.exitCode === null) return proxy.puerto;

  const puerto = await puertoLibre();
  const proceso = spawn(
    "cloud-sql-proxy",
    ["--gcloud-auth", "--address", "127.0.0.1", "--port", String(puerto), INSTANCIA],
    { stdio: ["ignore", "pipe", "pipe"] }
  );

  await new Promise<void>((resolver, rechazar) => {
    let salida = "";
    const plazo = setTimeout(() => {
      proceso.kill();
      rechazar(new Error(`[MCP] Cloud SQL Auth Proxy no arrancó en 30 s:\n${salida}`));
    }, 30_000);
    const alLeer = (trozo: Buffer) => {
      salida += trozo.toString();
      if (salida.includes("ready for new connections")) {
        clearTimeout(plazo);
        resolver();
      }
    };
    proceso.stdout?.on("data", alLeer);
    proceso.stderr?.on("data", alLeer);
    proceso.on("error", (error) => {
      clearTimeout(plazo);
      rechazar(new Error(`[MCP] No se pudo lanzar cloud-sql-proxy: ${error.message}`));
    });
    proceso.on("exit", (codigo) => {
      clearTimeout(plazo);
      rechazar(
        new Error(
          `[MCP] cloud-sql-proxy terminó (código ${codigo}): ${explicarFalloDeGcloud(salida.trim())}`
        )
      );
    });
  });

  proxy = { proceso, puerto };
  console.error(`[MCP] Cloud SQL Auth Proxy escuchando en 127.0.0.1:${puerto}`);
  return puerto;
}

export function pararProxy(): void {
  proxy?.proceso.kill();
  proxy = null;
}

function puertoLibre(): Promise<number> {
  return new Promise((resolver, rechazar) => {
    const servidor = createServer();
    servidor.unref();
    servidor.on("error", rechazar);
    servidor.listen(0, "127.0.0.1", () => {
      const direccion = servidor.address();
      servidor.close(() => {
        if (direccion && typeof direccion === "object") resolver(direccion.port);
        else rechazar(new Error("[MCP] Sin puerto libre"));
      });
    });
  });
}
