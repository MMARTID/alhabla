import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { crearClienteDeGrowth } from "../../mcp/growth/cliente.js";
import { crearCredenciales } from "../../mcp/growth/credenciales.js";

/**
 * El `fetch` de verdad contra un servidor HTTP en 127.0.0.1 (sin salir del
 * equipo): lo que los demás tests simulan, aquí lo hace Node.
 */

const TOKEN = "gta_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG";

type Visto = {
  metodo: string;
  url: string;
  autorizacion?: string;
  tipo?: string;
  cuerpo: string;
};

let servidor: Server;
let puerto: number;
let vistas: Visto[];
let responder: (
  visto: Visto,
  n: number
) => { status: number; cuerpo?: unknown; cabeceras?: Record<string, string> };

async function leerCuerpo(req: IncomingMessage) {
  const trozos: Buffer[] = [];
  for await (const t of req) trozos.push(t as Buffer);
  return Buffer.concat(trozos).toString("utf8");
}

beforeAll(async () => {
  servidor = createServer(async (req, res) => {
    const visto: Visto = {
      metodo: req.method ?? "",
      url: req.url ?? "",
      autorizacion: req.headers.authorization,
      tipo: req.headers["content-type"],
      cuerpo: await leerCuerpo(req),
    };
    vistas.push(visto);
    const r = responder(visto, vistas.length);
    res.writeHead(r.status, {
      "content-type": "application/json",
      ...(r.cabeceras ?? {}),
    });
    res.end(r.cuerpo === undefined ? "" : JSON.stringify(r.cuerpo));
  });
  await new Promise<void>((ok) => servidor.listen(0, "127.0.0.1", ok));
  puerto = (servidor.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise((ok) => servidor.close(ok));
});

beforeEach(() => {
  vistas = [];
  responder = () => ({ status: 200, cuerpo: { ok: true } });
});

function cliente() {
  return crearClienteDeGrowth({
    credenciales: crearCredenciales({
      env: {
        GROWTH_API_URL: `http://127.0.0.1:${puerto}`,
        GROWTH_AGENT_TOKEN: TOKEN,
      },
    }),
    esperar: async () => undefined,
  });
}

describe("cliente de Growth con fetch de verdad", () => {
  it("GET: la ruta, la consulta y el token solo en la cabecera", async () => {
    responder = () => ({ status: 200, cuerpo: { data: [], total: 0 } });
    const r = await cliente().peticion("GET", "/growth/agente/oportunidades", {
      consulta: { estado: ["detectada", "devuelta"], limite: 5 },
    });
    expect(r).toEqual({ status: 200, datos: { data: [], total: 0 } });
    expect(vistas).toHaveLength(1);
    expect(vistas[0]!.metodo).toBe("GET");
    expect(vistas[0]!.url).toBe(
      "/growth/agente/oportunidades?estado=detectada%2Cdevuelta&limite=5"
    );
    expect(vistas[0]!.autorizacion).toBe(`Bearer ${TOKEN}`);
    expect(vistas[0]!.url).not.toContain(TOKEN);
    expect(vistas[0]!.cuerpo).toBe("");
  });

  it("POST sin cuerpo envía {} y con cuerpo, JSON", async () => {
    await cliente().peticion("POST", "/growth/agente/ejecuciones", {
      cuerpo: { disparador: "manual" },
    });
    await cliente().peticion("POST", "/growth/agente/oportunidades/abc/estado");
    expect(vistas[0]!.tipo).toBe("application/json");
    expect(JSON.parse(vistas[0]!.cuerpo)).toEqual({ disparador: "manual" });
    expect(vistas[1]!.cuerpo).toBe("{}");
  });

  it("no sigue una redirección ni manda el token a donde apunta", async () => {
    responder = (_v, n) =>
      n === 1
        ? {
            status: 302,
            cabeceras: {
              location: `http://127.0.0.1:${puerto}/growth/agente/otra`,
            },
          }
        : { status: 200, cuerpo: { ok: true } };
    await expect(
      cliente().peticion("GET", "/growth/agente/contexto")
    ).rejects.toThrow(/redirección/);
    expect(vistas).toHaveLength(1);
  });

  it("un error con cuerpo JSON de Zod se explica", async () => {
    responder = () => ({
      status: 400,
      cuerpo: { error: [{ path: ["puntLeads"], message: "Demasiado alto" }] },
    });
    await expect(
      cliente().peticion("POST", "/growth/agente/oportunidades", { cuerpo: {} })
    ).rejects.toThrow(/puntLeads: Demasiado alto/);
  });

  it("reintenta un 503 en una lectura y acaba bien", async () => {
    responder = (_v, n) =>
      n < 3
        ? { status: 503, cuerpo: { error: "Error interno." } }
        : { status: 200, cuerpo: { ok: "ya" } };
    const r = await cliente().peticion("GET", "/growth/agente/contexto");
    expect(r.datos).toEqual({ ok: "ya" });
    expect(vistas).toHaveLength(3);
  });

  it("no reintenta un POST que no es idempotente", async () => {
    responder = () => ({ status: 503, cuerpo: { error: "Error interno." } });
    await expect(
      cliente().peticion(
        "POST",
        "/growth/agente/oportunidades/abc/borradores",
        {
          cuerpo: { texto: "x" },
        }
      )
    ).rejects.toThrow(/No se sabe si se llegó a aplicar/);
    expect(vistas).toHaveLength(1);
  });

  it("un cuerpo vacío en un 200 es null, no un fallo", async () => {
    responder = () => ({ status: 200 });
    const r = await cliente().peticion("GET", "/growth/agente/contexto");
    expect(r.datos).toBeNull();
  });

  it("sin nadie escuchando: «No responde»", async () => {
    const libre = createServer();
    await new Promise<void>((ok) => libre.listen(0, "127.0.0.1", ok));
    const puertoLibre = (libre.address() as AddressInfo).port;
    await new Promise((ok) => libre.close(ok));
    const c = crearClienteDeGrowth({
      credenciales: crearCredenciales({
        env: {
          GROWTH_API_URL: `http://127.0.0.1:${puertoLibre}`,
          GROWTH_AGENT_TOKEN: TOKEN,
        },
      }),
      esperar: async () => undefined,
    });
    await expect(c.peticion("GET", "/growth/agente/contexto")).rejects.toThrow(
      new RegExp(`No responde http://127.0.0.1:${puertoLibre}`)
    );
  });
});
