import { readFileSync } from "node:fs";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { leerEnviosSimulados } from "../enviosSimulados.js";
import { estadoDeProd } from "../estadoDeProd.js";
import { leerLogsDeProd } from "../logsDeProd.js";
import {
  PIEZAS_QUE_SE_REINICIAN,
  estadoDelEntorno,
  prsAbiertos,
  ramaValida,
  reiniciar,
  ultimasLineasDelRegistro,
  verRamaEnDev,
  type PiezaReiniciable,
} from "./entornoDev.js";

/**
 * Panel de desarrollo (http://localhost:3005): qué enseña el entorno fijo y
 * si cada pieza responde, los PR abiertos con «Ver en dev», producción de un
 * vistazo y los envíos que backend-sim no mandó. Lo arranca launchd
 * (scripts/dev/servir.sh panel) desde las herramientas (~/.alhabla-mcp).
 *
 * Solo escucha en 127.0.0.1 y, aun así, cualquier web abierta en el
 * navegador podría mandarle peticiones: se rechaza todo lo que no traiga un
 * Host local (contra DNS rebinding) y las acciones solo se aceptan con el
 * Origin del propio panel y cuerpo JSON (otra web no puede poner las dos
 * cosas sin una preflight que aquí no se contesta).
 */
export const PUERTO = Number(process.env.ALHABLA_PANEL_PUERTO ?? 3005);

export function hostPermitido(
  host: string | undefined,
  puerto = PUERTO
): boolean {
  return host === `localhost:${puerto}` || host === `127.0.0.1:${puerto}`;
}

export function accionPermitida(
  req: IncomingMessage,
  puerto = PUERTO
): boolean {
  const origen = req.headers.origin;
  return (
    (origen === `http://localhost:${puerto}` ||
      origen === `http://127.0.0.1:${puerto}`) &&
    (req.headers["content-type"] ?? "").startsWith("application/json")
  );
}

export type Dependencias = {
  estadoDelEntorno: typeof estadoDelEntorno;
  prsAbiertos: typeof prsAbiertos;
  verRamaEnDev: typeof verRamaEnDev;
  reiniciar: typeof reiniciar;
  ultimasLineasDelRegistro: typeof ultimasLineasDelRegistro;
  produccion: () => Promise<unknown>;
  envios: () => Promise<unknown>;
};

const DEPENDENCIAS: Dependencias = {
  estadoDelEntorno,
  prsAbiertos,
  verRamaEnDev,
  reiniciar,
  ultimasLineasDelRegistro,
  produccion: async () => {
    const [estado, errores] = await Promise.all([
      estadoDeProd(),
      leerLogsDeProd({ soloErrores: true, desde: "24h", limite: 15 }).catch(
        (error: Error) => ({ error: error.message })
      ),
    ]);
    return { ...estado, errores };
  },
  envios: () => leerEnviosSimulados({ desde: "24h", limite: 30 }),
};

function enviar(res: ServerResponse, codigo: number, cuerpo: unknown) {
  res.writeHead(codigo, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(cuerpo));
}

async function leerJson(
  req: IncomingMessage
): Promise<Record<string, unknown>> {
  let texto = "";
  for await (const trozo of req) {
    texto += trozo;
    if (texto.length > 10_000) throw new Error("Cuerpo demasiado grande");
  }
  const valor = JSON.parse(texto || "{}") as unknown;
  return valor && typeof valor === "object"
    ? (valor as Record<string, unknown>)
    : {};
}

const PAGINA = join(dirname(fileURLToPath(import.meta.url)), "pagina.html");

export function crearServidorDelPanel(
  deps: Dependencias = DEPENDENCIAS,
  puerto = PUERTO
): Server {
  return createServer(async (req, res) => {
    if (!hostPermitido(req.headers.host, puerto)) {
      return enviar(res, 403, { error: "Host no permitido" });
    }
    const ruta = new URL(req.url ?? "/", "http://localhost").pathname;
    try {
      if (req.method === "GET") {
        switch (ruta) {
          case "/":
            res.writeHead(200, {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "no-store",
            });
            return res.end(readFileSync(PAGINA));
          case "/api/estado":
            return enviar(res, 200, await deps.estadoDelEntorno());
          case "/api/prs":
            return enviar(res, 200, await deps.prsAbiertos());
          case "/api/produccion":
            return enviar(res, 200, await deps.produccion());
          case "/api/envios":
            return enviar(res, 200, await deps.envios());
          case "/api/registro":
            return enviar(res, 200, {
              lineas: deps.ultimasLineasDelRegistro(),
            });
        }
        return enviar(res, 404, { error: "No existe" });
      }

      if (req.method === "POST") {
        if (!accionPermitida(req, puerto)) {
          return enviar(res, 403, { error: "Solo desde el propio panel" });
        }
        const cuerpo = await leerJson(req);
        if (ruta === "/api/ver") {
          const rama = String(cuerpo.rama ?? "");
          if (!ramaValida(rama))
            return enviar(res, 400, {
              error: `«${rama}» no es una rama válida`,
            });
          deps.verRamaEnDev(rama);
          return enviar(res, 202, {
            mensaje: `Poniendo el entorno en ${rama}…`,
          });
        }
        if (ruta === "/api/reiniciar") {
          const pieza = String(cuerpo.pieza ?? "");
          if (!(PIEZAS_QUE_SE_REINICIAN as readonly string[]).includes(pieza)) {
            return enviar(res, 400, { error: `No sé reiniciar «${pieza}»` });
          }
          return enviar(res, 200, {
            mensaje: await deps.reiniciar(pieza as PiezaReiniciable),
          });
        }
        return enviar(res, 404, { error: "No existe" });
      }
      return enviar(res, 405, { error: "Método no permitido" });
    } catch (error) {
      return enviar(res, 500, { error: (error as Error).message });
    }
  });
}

// Solo escucha si se lanza directamente (tsx mcp/panel/servidorPanel.ts),
// no al importarlo en los tests.
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  crearServidorDelPanel().listen(PUERTO, "127.0.0.1", () => {
    console.log(`[Panel] Panel de desarrollo en http://localhost:${PUERTO}`);
  });
}
