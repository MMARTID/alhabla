import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { prepararCargaMock } = vi.hoisted(() => ({
  prepararCargaMock: vi.fn(),
}));

vi.mock("../../mcp/growth/conocimiento/index.js", async (importarOriginal) => ({
  ...(await importarOriginal<
    typeof import("../../mcp/growth/conocimiento/index.js")
  >()),
  prepararCarga: prepararCargaMock,
}));

const {
  ErrorDeUso,
  URL_DE_DEV,
  URL_DE_PRODUCCION,
  analizarArgumentos,
  ejecutar,
  urlDelBackend,
} = await import("../../mcp/growth/conocimiento/cli.js");

const TOKEN = "gta_token-que-no-debe-aparecer-en-ninguna-salida";

const CARGA = {
  commitSha: "a".repeat(40),
  tipos: ["precio", "funcion"],
  afirmaciones: [
    {
      clave: "precio.plan.pro",
      tipo: "precio",
      texto: "Plan Pro: 139 € + IVA al mes.",
      fuente: "web/src/lib/plans.ts#plans.pro",
    },
  ],
  competidores: [{ nombre: "Vapi", dominio: "vapi.ai" }],
  nichos: [{ slug: "peluqueria", nombre: "Peluquerías" }],
  paginas: [{ ruta: "/planes", nombre: "Planes", seccion: "principal" }],
  fuentesLeidas: [{ ruta: "web/src/lib/plans.ts", blobSha: "b".repeat(40) }],
  avisos: [],
};

const RESPUESTA = {
  commitSha: CARGA.commitSha,
  simulado: true,
  sinCambios: false,
  aplicable: true,
  motivoNoAplicable: null,
  nuevas: ["precio.plan.pro"],
  modificadas: [],
  retiradas: [],
  iguales: 0,
  competidoresNuevos: [],
  nichosNuevos: [],
  paginasNuevas: [],
  paginasActualizadas: [],
  borradoresBloqueados: [],
  avisos: [],
};

describe("analizarArgumentos", () => {
  it("exige exactamente un modo", () => {
    expect(() => analizarArgumentos([])).toThrow(/Falta --comprobar/);
    expect(() => analizarArgumentos(["--comprobar", "--aplicar"])).toThrow(
      /solo uno/
    );
    expect(analizarArgumentos(["--dry-run"]).modo).toBe("dry-run");
  });

  it("dev por defecto; solo dev o prod", () => {
    expect(analizarArgumentos(["--aplicar"]).entorno).toBe("dev");
    expect(analizarArgumentos(["--aplicar", "--entorno", "prod"]).entorno).toBe(
      "prod"
    );
    expect(() =>
      analizarArgumentos(["--aplicar", "--entorno", "staging"])
    ).toThrow(/dev o prod/);
    expect(() => analizarArgumentos(["--aplicar", "--entorno"])).toThrow(
      /necesita un valor/
    );
  });

  it("no hay forma de pedir la rama local en producción: ni existe el flag", () => {
    expect(() =>
      analizarArgumentos([
        "--aplicar",
        "--entorno",
        "prod",
        "--permitir-rama-local",
      ])
    ).toThrow(/Argumento desconocido/);
  });

  it("rechaza lo que no conoce, sobre todo un token por argumento", () => {
    expect(() =>
      analizarArgumentos(["--comprobar", "--token", "gta_x"])
    ).toThrow(/Argumento desconocido: --token/);
  });

  it("producción no admite otra URL", () => {
    expect(() =>
      analizarArgumentos([
        "--aplicar",
        "--entorno",
        "prod",
        "--url",
        "http://localhost:3000",
      ])
    ).toThrow(/no admite --url/);
  });
});

describe("urlDelBackend", () => {
  it("producción siempre va a api.alhabla.ai, aunque el entorno diga otra cosa", () => {
    expect(
      urlDelBackend(
        { entorno: "prod", url: null },
        { GROWTH_API_URL: "http://localhost:3000" }
      )
    ).toBe(URL_DE_PRODUCCION);
  });

  it("dev usa localhost por defecto y acepta solo hosts de dev", () => {
    expect(urlDelBackend({ entorno: "dev", url: null }, {})).toBe(URL_DE_DEV);
    expect(
      urlDelBackend({ entorno: "dev", url: "http://localhost:3010/x" }, {})
    ).toBe("http://localhost:3010");
    expect(
      urlDelBackend(
        { entorno: "dev", url: null },
        { GROWTH_API_URL: "https://dev-api.alhabla.ai" }
      )
    ).toBe("https://dev-api.alhabla.ai");
  });

  it("dev no manda el token a un host cualquiera, ni a la API de producción", () => {
    expect(() =>
      urlDelBackend({ entorno: "dev", url: "https://api.alhabla.ai" }, {})
    ).toThrow(ErrorDeUso);
    expect(() =>
      urlDelBackend({ entorno: "dev", url: "https://malo.example" }, {})
    ).toThrow(/solo se manda a localhost/);
    expect(() =>
      urlDelBackend({ entorno: "dev", url: "no es una url" }, {})
    ).toThrow(/no es válida/);
  });
});

describe("ejecutar (dry-run y aplicar contra el backend)", () => {
  const fetchMock = vi.fn();
  let salida: string;
  const ttyOriginal = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");

  beforeEach(() => {
    vi.resetAllMocks();
    // Sin una persona delante, aunque quien lance los tests esté en una terminal.
    Object.defineProperty(process.stdin, "isTTY", {
      value: false,
      configurable: true,
    });
    salida = "";
    vi.spyOn(console, "log").mockImplementation((...a) => {
      salida += `${a.join(" ")}\n`;
    });
    vi.spyOn(console, "error").mockImplementation((...a) => {
      salida += `${a.join(" ")}\n`;
    });
    vi.stubGlobal("fetch", fetchMock);
    process.env.GROWTH_CONOCIMIENTO_TOKEN = TOKEN;
    prepararCargaMock.mockResolvedValue(CARGA);
    fetchMock.mockImplementation(
      async (url: string) =>
        new Response(
          JSON.stringify({
            ...RESPUESTA,
            simulado: url.includes("simular=true"),
          }),
          {
            status: 200,
          }
        )
    );
  });

  afterEach(() => {
    if (ttyOriginal) Object.defineProperty(process.stdin, "isTTY", ttyOriginal);
    else delete (process.stdin as { isTTY?: boolean }).isTTY;
    delete process.env.GROWTH_CONOCIMIENTO_TOKEN;
    vi.unstubAllGlobals();
  });

  function opciones(extra: string[]) {
    return analizarArgumentos(extra);
  }

  it("dry-run: pide la simulación, con el token en la cabecera y la carga completa", async () => {
    const codigo = await ejecutar(opciones(["--dry-run", "--raiz", "/repo"]));
    expect(codigo).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://localhost:3000/growth/agente/conocimiento/sincronizar?simular=true"
    );
    expect(init.method).toBe("POST");
    expect(init.headers.authorization).toBe(`Bearer ${TOKEN}`);
    const cuerpo = JSON.parse(init.body);
    expect(cuerpo).toMatchObject({
      commitSha: CARGA.commitSha,
      // Siempre los tipos que cubre el extractor: sin ellos un tipo vaciado
      // en el repo no se retira de la base ni se detecta.
      tipos: CARGA.tipos,
      afirmaciones: CARGA.afirmaciones,
      competidores: CARGA.competidores,
      nichos: CARGA.nichos,
      paginas: CARGA.paginas,
      fuentes: CARGA.fuentesLeidas,
    });
    // El token nunca va en la URL ni en el cuerpo.
    expect(url).not.toContain(TOKEN);
    expect(init.body).not.toContain(TOKEN);
    // Dev admite la rama y el árbol que haya.
    expect(prepararCargaMock).toHaveBeenCalledWith({
      raiz: "/repo",
      permitirRamaLocal: true,
    });
  });

  it("la salida nunca incluye el token", async () => {
    await ejecutar(opciones(["--dry-run"]));
    expect(salida).not.toContain(TOKEN);
    expect(salida).toContain("precio.plan.pro");
  });

  it("aplicar en dev: primero simula, luego aplica, sin pedir confirmación y admitiendo la rama que haya", async () => {
    const codigo = await ejecutar(opciones(["--aplicar"]));
    expect(codigo).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain("?simular=true");
    expect(fetchMock.mock.calls[1][0]).not.toContain("simular");
    expect(prepararCargaMock).toHaveBeenCalledWith(
      expect.objectContaining({ permitirRamaLocal: true })
    );
  });

  it("aplicar en producción sin una persona delante NO aplica nada", async () => {
    const codigo = await ejecutar(opciones(["--aplicar", "--entorno", "prod"]));
    expect(codigo).toBe(1);
    // Solo la simulación: la segunda llamada, la que escribe, no se hace.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${URL_DE_PRODUCCION}/growth/agente/conocimiento/sincronizar?simular=true`
    );
    expect(salida).toMatch(/No se ha confirmado/);
    // Y producción exige main: nunca se pide la rama local.
    expect(prepararCargaMock).toHaveBeenCalledWith(
      expect.objectContaining({ permitirRamaLocal: false })
    );
  });

  it("si la guarda de cierres masivos impediría aplicar, no se aplica y sale con error", async () => {
    fetchMock.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            ...RESPUESTA,
            aplicable: false,
            motivoNoAplicable: "Se cerrarían 30.",
          }),
          { status: 200 }
        )
    );
    expect(await ejecutar(opciones(["--aplicar"]))).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(salida).toMatch(/NO SE PODRÍA APLICAR: Se cerrarían 30\./);
  });

  it("un dry-run con cierres masivos también sale con error", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          ...RESPUESTA,
          aplicable: false,
          motivoNoAplicable: "x",
        }),
        {
          status: 200,
        }
      )
    );
    expect(await ejecutar(opciones(["--dry-run"]))).toBe(1);
  });

  it("sin token explica cómo crearlo y no hace ninguna petición", async () => {
    delete process.env.GROWTH_CONOCIMIENTO_TOKEN;
    await expect(ejecutar(opciones(["--dry-run"]))).rejects.toThrow(
      /Falta GROWTH_CONOCIMIENTO_TOKEN/
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("un error del backend lleva su código y no revela el token", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "Se cerrarían 30.",
          codigo: "cierres_masivos",
        }),
        {
          status: 409,
        }
      )
    );
    const error = await ejecutar(opciones(["--dry-run"])).catch(
      (e: Error) => e
    );
    expect((error as Error).message).toMatch(
      /409 \[cierres_masivos\].*Se cerrarían 30/
    );
    expect((error as Error).message).not.toContain(TOKEN);
  });
});
