import { request, type IncomingMessage, type Server } from "node:http";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { ErrorDeInventario } from "../../mcp/inventario.js";
import { ramaValida, resumirPrs } from "../../mcp/panel/entornoDev.js";
import {
  accionPermitida,
  crearServidorDelPanel,
  hostPermitido,
  type Dependencias,
} from "../../mcp/panel/servidorPanel.js";

describe("barreras del panel", () => {
  it("solo un Host local con su puerto (contra DNS rebinding)", () => {
    expect(hostPermitido("localhost:3005", 3005)).toBe(true);
    expect(hostPermitido("127.0.0.1:3005", 3005)).toBe(true);
    expect(hostPermitido("evil.com:3005", 3005)).toBe(false);
    expect(hostPermitido("localhost:3006", 3005)).toBe(false);
    expect(hostPermitido(undefined, 3005)).toBe(false);
  });

  it("las acciones, solo con el Origin del panel y cuerpo JSON", () => {
    const req = (headers: Record<string, string>) =>
      ({ headers }) as unknown as IncomingMessage;
    expect(
      accionPermitida(
        req({
          origin: "http://localhost:3005",
          "content-type": "application/json",
        }),
        3005
      )
    ).toBe(true);
    expect(
      accionPermitida(req({ "content-type": "application/json" }), 3005)
    ).toBe(false);
    expect(
      accionPermitida(
        req({ origin: "https://evil.com", "content-type": "application/json" }),
        3005
      )
    ).toBe(false);
    // Un formulario de otra web no necesita preflight: por eso se exige JSON.
    expect(
      accionPermitida(
        req({ origin: "http://localhost:3005", "content-type": "text/plain" }),
        3005
      )
    ).toBe(false);
  });
});

describe("ramaValida", () => {
  it("acepta ramas normales, main y números de PR", () => {
    for (const rama of [
      "main",
      "feat/aviso-ia",
      "dev/entorno-fijo",
      "fix/x_1.2",
      "#303",
      "303",
    ]) {
      expect(ramaValida(rama), rama).toBe(true);
    }
  });

  it("rechaza lo que podría colarse en un comando o salir de refs", () => {
    for (const rama of [
      "",
      "../x",
      "a..b",
      "-rf",
      "x;rm -rf /",
      "$(id)",
      "a b",
      "x.lock",
      "/abs",
    ]) {
      expect(ramaValida(rama), rama).toBe(false);
    }
  });
});

describe("resumirPrs", () => {
  it("resume el CI: falla si alguno falla, en marcha si alguno no ha terminado", () => {
    expect(
      resumirPrs([
        {
          number: 1,
          title: "A",
          headRefName: "a",
          url: "u",
          isDraft: false,
          updatedAt: "t",
          author: { login: "MMARTID" },
          statusCheckRollup: [
            { conclusion: "SUCCESS", status: "COMPLETED" },
            { conclusion: "FAILURE", status: "COMPLETED" },
          ],
        },
        {
          number: 2,
          title: "B",
          headRefName: "b",
          url: "u",
          isDraft: true,
          updatedAt: "t",
          statusCheckRollup: [{ conclusion: null, status: "IN_PROGRESS" }],
        },
        {
          number: 3,
          title: "C",
          headRefName: "c",
          url: "u",
          isDraft: false,
          updatedAt: "t",
          statusCheckRollup: [],
        },
      ]).map((pr) => [pr.numero, pr.ci, pr.borrador, pr.autor])
    ).toEqual([
      [1, "fallo", false, "MMARTID"],
      [2, "pendiente", true, null],
      [3, null, false, null],
    ]);
  });
});

describe("servidor del panel", () => {
  const PUERTO = 40_000 + Math.floor(Math.random() * 9_000);
  const deps: Dependencias = {
    estadoDelEntorno: vi.fn(async () => ({
      rama: "main",
    })) as unknown as Dependencias["estadoDelEntorno"],
    prsAbiertos: vi.fn(
      async () => []
    ) as unknown as Dependencias["prsAbiertos"],
    verRamaEnDev: vi.fn(),
    reiniciar: vi.fn(async () => "hecho"),
    ultimasLineasDelRegistro: vi.fn(() => ["una línea"]),
    produccion: vi.fn(async () => ({})),
    envios: vi.fn(async () => ({ envios: [] })),
    plataforma: vi.fn(async () => ({ negocios: 3 })),
    visitas: vi.fn(async () => ({})),
    diagnostico: vi.fn(async () => ({ comprobaciones: [] })),
    sim: vi.fn(async () => ({ enMarcha: false })),
    inventario: vi.fn(async (entorno) => ({ entorno, cuentas: [] })),
    fantasmas: vi.fn(async () => ({ assistants: [], numeros: [] })),
    simularBorrado: vi.fn(async (id) => ({ esFantasma: false, id })),
    borrarFantasma: vi.fn(async () => {
      throw new ErrorDeInventario("Escribe el id exacto para confirmar", 400);
    }),
    editar: vi.fn(async () => ({ mensaje: "Guardado en dev" })),
    entrar: vi.fn(async () => ({ url: "http://localhost:3001/auth/entrar" })),
    asignarNumero: vi.fn(async () => ({ mensaje: "asignado" })),
    pedirNumero: vi.fn(async () => ({ mensaje: "comprado" })),
  };
  let servidor: Server;

  beforeAll(async () => {
    servidor = crearServidorDelPanel(deps, PUERTO);
    await new Promise<void>((resolver) =>
      servidor.listen(PUERTO, "127.0.0.1", resolver)
    );
  });
  afterAll(
    () => new Promise<void>((resolver) => servidor.close(() => resolver()))
  );
  beforeEach(() => vi.clearAllMocks());

  function pedir(
    metodo: string,
    ruta: string,
    {
      headers = {},
      cuerpo,
    }: { headers?: Record<string, string>; cuerpo?: string } = {}
  ): Promise<{ estado: number; texto: string }> {
    return new Promise((resolver, rechazar) => {
      const req = request(
        {
          host: "127.0.0.1",
          port: PUERTO,
          method: metodo,
          path: ruta,
          headers: { host: `localhost:${PUERTO}`, ...headers },
        },
        (res) => {
          let texto = "";
          res.on("data", (trozo) => (texto += trozo));
          res.on("end", () => resolver({ estado: res.statusCode ?? 0, texto }));
        }
      );
      req.on("error", rechazar);
      if (cuerpo) req.write(cuerpo);
      req.end();
    });
  }
  const json = {
    origin: `http://localhost:${PUERTO}`,
    "content-type": "application/json",
  };

  it("sirve la página y el estado", async () => {
    const pagina = await pedir("GET", "/");
    expect(pagina.estado).toBe(200);
    expect(pagina.texto).toContain("<title>Alhabla · Desarrollo</title>");
    expect(JSON.parse((await pedir("GET", "/api/estado")).texto)).toEqual({
      rama: "main",
    });
  });

  it("rechaza un Host ajeno aunque llegue a 127.0.0.1", async () => {
    const respuesta = await pedir("GET", "/api/estado", {
      headers: { host: "evil.com" },
    });
    expect(respuesta.estado).toBe(403);
    expect(deps.estadoDelEntorno).not.toHaveBeenCalled();
  });

  it("una acción sin el Origin del panel no hace nada", async () => {
    const respuesta = await pedir("POST", "/api/ver", {
      headers: { "content-type": "application/json" },
      cuerpo: '{"rama":"main"}',
    });
    expect(respuesta.estado).toBe(403);
    expect(deps.verRamaEnDev).not.toHaveBeenCalled();
  });

  it("ver una rama: valida y la lanza", async () => {
    const mala = await pedir("POST", "/api/ver", {
      headers: json,
      cuerpo: '{"rama":"x;rm"}',
    });
    expect(mala.estado).toBe(400);
    expect(deps.verRamaEnDev).not.toHaveBeenCalled();

    const buena = await pedir("POST", "/api/ver", {
      headers: json,
      cuerpo: '{"rama":"feat/x"}',
    });
    expect(buena.estado).toBe(202);
    expect(deps.verRamaEnDev).toHaveBeenCalledWith("feat/x");
  });

  it("reiniciar solo las piezas conocidas", async () => {
    expect(
      (
        await pedir("POST", "/api/reiniciar", {
          headers: json,
          cuerpo: '{"pieza":"postgres"}',
        })
      ).estado
    ).toBe(400);
    const ok = await pedir("POST", "/api/reiniciar", {
      headers: json,
      cuerpo: '{"pieza":"app"}',
    });
    expect(ok.estado).toBe(200);
    expect(deps.reiniciar).toHaveBeenCalledWith("app");
  });

  it("sirve el inventario y valida el entorno", async () => {
    const pagina = await pedir("GET", "/inventario");
    expect(pagina.estado).toBe(200);
    expect(pagina.texto).toContain("<title>Alhabla · Inventario</title>");
    expect(
      JSON.parse((await pedir("GET", "/api/inventario?entorno=prod")).texto)
    ).toEqual({ entorno: "prod", cuentas: [] });
    expect((await pedir("GET", "/api/inventario?entorno=x")).estado).toBe(400);
    expect(deps.inventario).toHaveBeenCalledTimes(1);
  });

  it("borrar o editar sin el Origin del panel no hace nada", async () => {
    for (const ruta of [
      "/api/fantasmas/borrar",
      "/api/fantasmas/simular",
      "/api/inventario/editar",
      "/api/inventario/asignar-numero",
      "/api/inventario/pedir-numero",
      "/api/entrar",
    ]) {
      const respuesta = await pedir("POST", ruta, {
        headers: { "content-type": "application/json" },
        cuerpo: '{"id":"assistant-x","confirmacion":"assistant-x"}',
      });
      expect(respuesta.estado, ruta).toBe(403);
    }
    expect(deps.borrarFantasma).not.toHaveBeenCalled();
    expect(deps.editar).not.toHaveBeenCalled();
    expect(deps.asignarNumero).not.toHaveBeenCalled();
    expect(deps.pedirNumero).not.toHaveBeenCalled();
  });

  it("el dry-run y el borrado pasan id, confirmación y la marca", async () => {
    const simulado = await pedir("POST", "/api/fantasmas/simular", {
      headers: json,
      cuerpo: '{"id":"assistant-x"}',
    });
    expect(JSON.parse(simulado.texto)).toEqual({
      esFantasma: false,
      id: "assistant-x",
    });
    const borrado = await pedir("POST", "/api/fantasmas/borrar", {
      headers: json,
      cuerpo:
        '{"id":"assistant-x","confirmacion":"otro","cuentaCompartida":"true"}',
    });
    // El error del inventario sale con su código, no como un 500.
    expect(borrado.estado).toBe(400);
    expect(deps.borrarFantasma).toHaveBeenCalledWith({
      id: "assistant-x",
      confirmacion: "otro",
      // Solo el booleano true cuenta como marcada.
      cuentaCompartida: false,
    });
  });

  it("acepta un systemPrompt largo", async () => {
    const respuesta = await pedir("POST", "/api/inventario/editar", {
      headers: json,
      cuerpo: JSON.stringify({
        tipo: "agente",
        systemPrompt: "x".repeat(40_000),
      }),
    });
    expect(respuesta.estado).toBe(200);
  });
});
