import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/**
 * Probar un MCP del repo con el código de ESTE checkout, antes de fusionar.
 *
 * El alhabla-dev de las sesiones corre la copia fija ~/.alhabla-mcp, siempre
 * en main: una herramienta nueva o cambiada en una rama no existe para la
 * sesión hasta que se fusiona (en la prueba de la agenda de Alhabla, el
 * 06-11, hubo que improvisar un script en el scratchpad para llamar a
 * calendario_falso). Esto arranca el servidor de este checkout por stdio,
 * como Claude Code, y le hace la misma petición:
 *
 *   npm run mcp:probar                                  # las herramientas
 *   npm run mcp:probar -- --instrucciones               # sus instructions
 *   npm run mcp:probar -- calendario_falso              # descripción y argumentos
 *   npm run mcp:probar -- agenda_dev '{"businessId":"…"}'
 *   npm run mcp:probar -- simular_conversacion @pasos.json
 *   npm run mcp:probar -- --servidor growth/servidorGrowth estado_growth
 *
 * Con ALHABLA_MCP_PRUEBA=1 el servidor no pone al día ~/.alhabla-mcp al
 * arrancar (podría recrear backend-sim a mitad de una prueba). Lo que corre
 * DENTRO de backend-sim (scripts/sim/…) sigue siendo el código de donde se
 * levantó: para una rama, backend_sim levantar <rama>.
 *
 * stdout lleva solo el resultado (para `| jq`); lo demás va a stderr.
 */

const BACKEND = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/** Lo que más tarda (backend_sim reconstruir, lanzar_job_prod) cabe aquí. */
const TIEMPO_MAXIMO_MS = 10 * 60_000;

export type PeticionDePrueba =
  | { tipo: "listar"; servidor: string }
  | { tipo: "instrucciones"; servidor: string }
  | { tipo: "describir"; servidor: string; herramienta: string }
  | {
      tipo: "llamar";
      servidor: string;
      herramienta: string;
      argumentos: Record<string, unknown>;
    };

/** Como arrancar.sh: una ruta bajo mcp/ sin extensión, sin `..`. */
const SERVIDOR_VALIDO = /^[A-Za-z0-9]+(\/[A-Za-z0-9]+)*$/;

export function interpretarArgumentos(
  argv: string[],
  leerFichero: (ruta: string) => string = (ruta) => readFileSync(ruta, "utf8")
): PeticionDePrueba {
  const resto = [...argv];
  let servidor = "servidorDev";
  let instrucciones = false;
  const posicionales: string[] = [];
  while (resto.length > 0) {
    const arg = resto.shift() as string;
    if (arg === "--servidor") {
      servidor = resto.shift() ?? "";
      if (!SERVIDOR_VALIDO.test(servidor)) {
        throw new Error(`Servidor no válido: «${servidor}» (p. ej. growth/servidorGrowth)`);
      }
    } else if (arg === "--instrucciones") {
      instrucciones = true;
    } else {
      posicionales.push(arg);
    }
  }
  if (instrucciones) return { tipo: "instrucciones", servidor };
  const [herramienta, json, ...sobra] = posicionales;
  if (sobra.length > 0) {
    throw new Error(
      "Sobran argumentos: los de la herramienta van en UN JSON entre comillas simples, o en @fichero.json"
    );
  }
  if (!herramienta) return { tipo: "listar", servidor };
  if (json === undefined) return { tipo: "describir", servidor, herramienta };
  const texto = json.startsWith("@") ? leerFichero(json.slice(1)) : json;
  let argumentos: unknown;
  try {
    argumentos = JSON.parse(texto);
  } catch (error) {
    throw new Error(`Los argumentos no son JSON: ${(error as Error).message}`, {
      cause: error,
    });
  }
  if (!argumentos || typeof argumentos !== "object" || Array.isArray(argumentos)) {
    throw new Error("Los argumentos van en un objeto JSON: '{\"clave\":\"valor\"}'");
  }
  return {
    tipo: "llamar",
    servidor,
    herramienta,
    argumentos: argumentos as Record<string, unknown>,
  };
}

/** El texto de cada bloque, con el JSON sangrado si lo es. */
export function textoDelResultado(contenido: unknown): string {
  if (!Array.isArray(contenido)) return JSON.stringify(contenido, null, 2);
  return contenido
    .map((bloque: { type?: string; text?: string }) => {
      if (bloque.type !== "text" || typeof bloque.text !== "string") {
        return JSON.stringify(bloque, null, 2);
      }
      try {
        return JSON.stringify(JSON.parse(bloque.text), null, 2);
      } catch {
        return bloque.text;
      }
    })
    .join("\n");
}

/** Arranca el servidor de este checkout y devuelve el cliente conectado. */
export async function conectarAlServidor(servidor: string): Promise<Client> {
  const entorno = Object.fromEntries(
    Object.entries(process.env).filter(
      (par): par is [string, string] => typeof par[1] === "string"
    )
  );
  const transporte = new StdioClientTransport({
    command: resolve(BACKEND, "node_modules/.bin/tsx"),
    args: [`mcp/${servidor}.ts`],
    cwd: BACKEND,
    env: { ...entorno, ALHABLA_MCP_PRUEBA: "1" },
    stderr: "inherit",
  });
  const cliente = new Client({ name: "mcp-probar", version: "1.0.0" });
  await cliente.connect(transporte);
  return cliente;
}

async function ejecutar(peticion: PeticionDePrueba): Promise<number> {
  const cliente = await conectarAlServidor(peticion.servidor);
  try {
    if (peticion.tipo === "instrucciones") {
      process.stdout.write(`${cliente.getInstructions() ?? "(sin instructions)"}\n`);
      return 0;
    }
    const { tools } = await cliente.listTools();
    if (peticion.tipo === "listar") {
      for (const tool of tools) {
        process.stdout.write(`${tool.name.padEnd(28)} ${tool.title ?? ""}\n`);
      }
      process.stderr.write(`\n${tools.length} herramientas en mcp/${peticion.servidor}.ts\n`);
      return 0;
    }
    const tool = tools.find((t) => t.name === peticion.herramienta);
    if (!tool) {
      process.stderr.write(
        `No existe «${peticion.herramienta}» en mcp/${peticion.servidor}.ts. Hay: ${tools.map((t) => t.name).join(", ")}\n`
      );
      return 2;
    }
    if (peticion.tipo === "describir") {
      process.stdout.write(
        `${JSON.stringify({ nombre: tool.name, titulo: tool.title, descripcion: tool.description, argumentos: tool.inputSchema }, null, 2)}\n`
      );
      return 0;
    }
    const resultado = await cliente.callTool(
      { name: peticion.herramienta, arguments: peticion.argumentos },
      undefined,
      { timeout: TIEMPO_MAXIMO_MS }
    );
    process.stdout.write(`${textoDelResultado(resultado.content)}\n`);
    return resultado.isError ? 1 : 0;
  } finally {
    await cliente.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = await ejecutar(interpretarArgumentos(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(`[MCP] ${(error as Error).message}\n`);
    process.exitCode = 2;
  }
}
