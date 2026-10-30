import { readFileSync } from "node:fs";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { estadoDeBackendSim } from "../backendSim.js";
import { verColasDeProd } from "../colasDeProd.js";
import { diagnosticarMcp } from "../diagnostico.js";
import { leerEnviosSimulados } from "../enviosSimulados.js";
import { leerErroresDeProd } from "../erroresDeProd.js";
import { estadoDeProd } from "../estadoDeProd.js";
import {
  ErrorDeInventario,
  borrarFantasma,
  buscarFantasmas,
  editar,
  enlaceDeEntrada,
  leerInventario,
  simularBorrado,
  urlDeBdDelEntorno,
} from "../inventario.js";
import { panoramaDePlataforma } from "../panoramaDePlataforma.js";
import { visitasWeb } from "../visitasWeb.js";
import {
  DIR_HERRAMIENTAS,
  HERRAMIENTAS,
  PIEZAS_QUE_SE_REINICIAN,
  actualizarHerramientas,
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
 * vistazo (errores agrupados, colas, panorama de la plataforma, visitas), los
 * envíos que backend-sim no mandó y el inventario de cuentas, números y
 * assistants de Telnyx (/inventario, inventario.ts). Lo arranca launchd
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
  plataforma: () => Promise<unknown>;
  visitas: () => Promise<unknown>;
  diagnostico: () => Promise<unknown>;
  sim: () => Promise<unknown>;
  inventario: (entorno: "dev" | "prod") => Promise<unknown>;
  fantasmas: () => Promise<unknown>;
  simularBorrado: (id: string) => Promise<unknown>;
  borrarFantasma: (cuerpo: {
    id: string;
    confirmacion: string;
    cuentaCompartida: boolean;
  }) => Promise<unknown>;
  editar: (cuerpo: unknown) => Promise<unknown>;
  entrar: (businessId: string) => Promise<unknown>;
};

/** Lo que falla en una parte no tumba la sección entera. */
function aparte<T>(trabajo: () => Promise<T>) {
  return trabajo().catch((error: Error) => ({
    error: error.message.replace(/^\[MCP\] /, ""),
  }));
}

/** Sin el systemPrompt: va en el inventario, no en la lista de fantasmas. */
async function fantasmasParaLaPagina() {
  const { referencias: _referencias, ...fantasmas } = await buscarFantasmas();
  return fantasmas;
}

const DEPENDENCIAS: Dependencias = {
  estadoDelEntorno,
  prsAbiertos,
  verRamaEnDev,
  reiniciar,
  ultimasLineasDelRegistro,
  produccion: async () => {
    const [estado, errores, colas] = await Promise.all([
      estadoDeProd(),
      aparte(() => leerErroresDeProd({ desde: "24h" })),
      aparte(() => verColasDeProd({})),
    ]);
    return { ...estado, errores, colasDetalle: colas };
  },
  envios: () => leerEnviosSimulados({ desde: "24h", limite: 30 }),
  plataforma: async () =>
    panoramaDePlataforma(await urlDeBdDelEntorno("prod"), { dias: 14 }),
  visitas: () => visitasWeb({ desde: "7d" }),
  diagnostico: () => diagnosticarMcp(),
  sim: () => estadoDeBackendSim(),
  inventario: (entorno) => leerInventario(entorno),
  fantasmas: fantasmasParaLaPagina,
  simularBorrado: (id) => simularBorrado(id),
  borrarFantasma: (cuerpo) => borrarFantasma(cuerpo),
  editar: (cuerpo) => editar(cuerpo),
  entrar: (businessId) => enlaceDeEntrada(businessId),
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
    // Un systemPrompt entero (inventario) pasa de 15 000 caracteres.
    if (texto.length > 300_000) throw new Error("Cuerpo demasiado grande");
  }
  const valor = JSON.parse(texto || "{}") as unknown;
  return valor && typeof valor === "object"
    ? (valor as Record<string, unknown>)
    : {};
}

const AQUI = dirname(fileURLToPath(import.meta.url));
const PAGINAS: Record<string, string> = {
  "/": join(AQUI, "pagina.html"),
  "/inventario": join(AQUI, "inventario.html"),
};

export function crearServidorDelPanel(
  deps: Dependencias = DEPENDENCIAS,
  puerto = PUERTO
): Server {
  return createServer(async (req, res) => {
    if (!hostPermitido(req.headers.host, puerto)) {
      return enviar(res, 403, { error: "Host no permitido" });
    }
    const url = new URL(req.url ?? "/", "http://localhost");
    const ruta = url.pathname;
    try {
      if (req.method === "GET") {
        if (PAGINAS[ruta]) {
          res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
          });
          return res.end(readFileSync(PAGINAS[ruta]));
        }
        switch (ruta) {
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
          case "/api/plataforma":
            return enviar(res, 200, await deps.plataforma());
          case "/api/visitas":
            return enviar(res, 200, await deps.visitas());
          case "/api/diagnostico":
            return enviar(res, 200, await deps.diagnostico());
          case "/api/sim":
            return enviar(res, 200, await deps.sim());
          case "/api/inventario": {
            const entorno = url.searchParams.get("entorno") ?? "dev";
            if (entorno !== "dev" && entorno !== "prod") {
              return enviar(res, 400, { error: "entorno: dev o prod" });
            }
            return enviar(res, 200, await deps.inventario(entorno));
          }
          case "/api/fantasmas":
            return enviar(res, 200, await deps.fantasmas());
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
        if (ruta === "/api/fantasmas/simular") {
          return enviar(
            res,
            200,
            await deps.simularBorrado(String(cuerpo.id ?? ""))
          );
        }
        if (ruta === "/api/fantasmas/borrar") {
          return enviar(
            res,
            200,
            await deps.borrarFantasma({
              id: String(cuerpo.id ?? ""),
              confirmacion: String(cuerpo.confirmacion ?? ""),
              cuentaCompartida: cuerpo.cuentaCompartida === true,
            })
          );
        }
        if (ruta === "/api/inventario/editar") {
          return enviar(res, 200, await deps.editar(cuerpo));
        }
        if (ruta === "/api/entrar") {
          return enviar(
            res,
            200,
            await deps.entrar(String(cuerpo.businessId ?? ""))
          );
        }
        return enviar(res, 404, { error: "No existe" });
      }
      return enviar(res, 405, { error: "Método no permitido" });
    } catch (error) {
      const codigo = error instanceof ErrorDeInventario ? error.codigo : 500;
      return enviar(res, codigo, {
        error: (error as Error).message.replace(/^\[MCP\] /, ""),
      });
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
  // Las herramientas al día aunque el Mac no se reinicie en días: si
  // cambian, el panel sale y launchd (KeepAlive) lo relanza con el código
  // nuevo. Solo el panel de la carpeta fija, no uno lanzado a mano.
  if (resolve(HERRAMIENTAS) === resolve(DIR_HERRAMIENTAS)) {
    setInterval(() => {
      actualizarHerramientas()
        .then(({ cambiaron, despues }) => {
          if (!cambiaron) return;
          console.log(
            `[Panel] Herramientas en ${despues?.slice(0, 7)}: se relanza el panel`
          );
          process.exit(0);
        })
        .catch((error) =>
          console.error(
            `[Panel] No se pudieron actualizar las herramientas: ${(error as Error).message}`
          )
        );
    }, 15 * 60_000);
  }
}
