import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Revisión 1b (conocimiento M1, B7, M3): el cuerpo lleva SIEMPRE `tipos`, el
 * CLI no manda el token por http:// a dev-api.alhabla.ai, y cuenta qué
 * prohibidas se debilitarían.
 */

const { prepararCargaMock } = vi.hoisted(() => ({
  prepararCargaMock: vi.fn(),
}));

vi.mock("../../mcp/growth/conocimiento/index.js", async (importarOriginal) => ({
  ...(await importarOriginal<
    typeof import("../../mcp/growth/conocimiento/index.js")
  >()),
  prepararCarga: prepararCargaMock,
}));

const { analizarArgumentos, ejecutar, urlDelBackend } =
  await import("../../mcp/growth/conocimiento/cli.js");
const { cuerpoDeSincronizacion } =
  await import("../../mcp/growth/conocimiento/index.js");
const { construirAfirmaciones } =
  await import("../../mcp/growth/conocimiento/construir.js");
const { cargarEntrada } =
  await import("../../mcp/growth/conocimiento/entrada.js");
const { analizarCuerpoDeSincronizacion } =
  await import("../../src/modules/growth/conocimiento/esquemas.js");

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const hayRepo =
  existsSync(join(RAIZ, "PRODUCT.md")) &&
  existsSync(join(RAIZ, "web", "src", "lib", "plans.ts"));

const TOKEN = "gta_token-de-prueba-f2";

const CARGA = {
  commitSha: "a".repeat(40),
  tipos: ["precio", "funcion", "limite"],
  afirmaciones: [
    {
      clave: "precio.plan.pro",
      tipo: "precio",
      texto: "Plan Pro: 139 € + IVA al mes.",
      fuente: "web/src/lib/plans.ts#plans.pro",
    },
  ],
  competidores: [],
  nichos: [],
  paginas: [],
  fuentesLeidas: [{ ruta: "web/src/lib/plans.ts", blobSha: "b".repeat(40) }],
  avisos: [],
};

describe("el cuerpo de la sincronización lleva siempre los tipos", () => {
  it("cuerpoDeSincronizacion incluye `tipos` de la carga", () => {
    const cuerpo = cuerpoDeSincronizacion(CARGA as never);
    expect(cuerpo.tipos).toEqual(["precio", "funcion", "limite"]);
  });

  it.skipIf(!hayRepo)(
    "con el repo real: los siete tipos, y el servidor los acepta",
    async () => {
      const resultado = construirAfirmaciones(await cargarEntrada(RAIZ));
      const cuerpo = cuerpoDeSincronizacion({
        commitSha: "c".repeat(40),
        tipos: resultado.tipos,
        afirmaciones: resultado.afirmaciones,
        competidores: resultado.competidores,
        nichos: resultado.nichos,
        paginas: resultado.paginas,
        fuentesLeidas: [],
        avisos: [],
      });
      expect([...cuerpo.tipos].sort()).toEqual([
        "comparativa",
        "funcion",
        "limite",
        "pagina",
        "precio",
        "prohibida",
        "sector",
      ]);
      const { body } = analizarCuerpoDeSincronizacion(
        JSON.parse(JSON.stringify(cuerpo))
      );
      expect(body.tipos).toHaveLength(7);
    },
    30_000
  );

  describe("lo que el CLI envía por la red", () => {
    const fetchMock = vi.fn();
    const ttyOriginal = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");

    beforeEach(() => {
      vi.resetAllMocks();
      Object.defineProperty(process.stdin, "isTTY", {
        value: false,
        configurable: true,
      });
      vi.spyOn(console, "log").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.stubGlobal("fetch", fetchMock);
      process.env.GROWTH_CONOCIMIENTO_TOKEN = TOKEN;
      prepararCargaMock.mockResolvedValue(CARGA);
    });

    afterEach(() => {
      if (ttyOriginal)
        Object.defineProperty(process.stdin, "isTTY", ttyOriginal);
      else delete (process.stdin as { isTTY?: boolean }).isTTY;
      delete process.env.GROWTH_CONOCIMIENTO_TOKEN;
      vi.unstubAllGlobals();
    });

    it("tanto la simulación como la aplicación mandan `tipos`", async () => {
      fetchMock.mockImplementation(
        async (url: string) =>
          new Response(
            JSON.stringify({
              commitSha: CARGA.commitSha,
              simulado: url.includes("simular=true"),
              sinCambios: true,
              aplicable: true,
              motivoNoAplicable: null,
              nuevas: [],
              modificadas: [],
              retiradas: [],
              iguales: 1,
              competidoresNuevos: [],
              nichosNuevos: [],
              paginasNuevas: [],
              paginasActualizadas: [],
              borradoresBloqueados: [],
              avisos: [],
            }),
            { status: 200 }
          )
      );
      expect(await ejecutar(analizarArgumentos(["--aplicar"]))).toBe(0);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      for (const [, init] of fetchMock.mock.calls) {
        expect(JSON.parse(init.body).tipos).toEqual([
          "precio",
          "funcion",
          "limite",
        ]);
      }
    });

    it("una simulación que debilitaría prohibidas se enseña y sale con error", async () => {
      const salida: string[] = [];
      vi.spyOn(console, "log").mockImplementation((...a) => {
        salida.push(a.join(" "));
      });
      fetchMock.mockResolvedValue(
        new Response(
          JSON.stringify({
            commitSha: CARGA.commitSha,
            simulado: true,
            sinCambios: false,
            aplicable: false,
            motivoNoAplicable:
              "Se debilitarían las reglas duras: prohibida.proveedores (se quitan términos: Telnyx).",
            prohibidasDebilitadas: [
              {
                clave: "prohibida.proveedores",
                motivo: "terminos_quitados",
                terminos: ["Telnyx"],
              },
            ],
            nuevas: [],
            modificadas: [],
            retiradas: [],
            iguales: 0,
            competidoresNuevos: [],
            nichosNuevos: [],
            paginasNuevas: [],
            paginasActualizadas: [],
            borradoresBloqueados: [],
            avisos: [],
          }),
          { status: 200 }
        )
      );
      expect(await ejecutar(analizarArgumentos(["--dry-run"]))).toBe(1);
      const texto = salida.join("\n");
      expect(texto).toMatch(
        /Prohibidas que se debilitarían \(1\): prohibida\.proveedores \[terminos_quitados: Telnyx\]/
      );
      expect(texto).toMatch(/hace falta un administrador/);
    });
  });
});

describe("urlDelBackend: dev-api.alhabla.ai solo por https", () => {
  it("rechaza http://dev-api.alhabla.ai: el token viajaría en claro", () => {
    expect(() =>
      urlDelBackend({ entorno: "dev", url: "http://dev-api.alhabla.ai/x" }, {})
    ).toThrow(/solo se admite por https/);
    expect(() =>
      urlDelBackend(
        { entorno: "dev", url: null },
        { GROWTH_API_URL: "http://dev-api.alhabla.ai" }
      )
    ).toThrow(/solo se admite por https/);
  });

  it("acepta https://dev-api.alhabla.ai y localhost por http o https", () => {
    expect(
      urlDelBackend({ entorno: "dev", url: "https://dev-api.alhabla.ai" }, {})
    ).toBe("https://dev-api.alhabla.ai");
    expect(
      urlDelBackend({ entorno: "dev", url: "http://localhost:3000" }, {})
    ).toBe("http://localhost:3000");
    expect(
      urlDelBackend({ entorno: "dev", url: "http://127.0.0.1:3010" }, {})
    ).toBe("http://127.0.0.1:3010");
    expect(
      urlDelBackend({ entorno: "dev", url: "https://localhost:3443" }, {})
    ).toBe("https://localhost:3443");
  });

  it("no se cuela con otros protocolos", () => {
    expect(() =>
      urlDelBackend({ entorno: "dev", url: "ftp://localhost:3000" }, {})
    ).toThrow(/solo se admite por https/);
  });
});

describe("modos --huellas y --actualizar-huellas", () => {
  it("se entienden y son excluyentes con los demás", () => {
    expect(analizarArgumentos(["--huellas"]).modo).toBe("huellas");
    expect(analizarArgumentos(["--actualizar-huellas"]).modo).toBe(
      "actualizar-huellas"
    );
    expect(() => analizarArgumentos(["--huellas", "--aplicar"])).toThrow(
      /solo uno/
    );
  });

  it.skipIf(!hayRepo)(
    "--huellas sobre el repo real sale con 0 porque todas coinciden",
    async () => {
      const lineas: string[] = [];
      const log = vi.spyOn(console, "log").mockImplementation((...a) => {
        lineas.push(a.join(" "));
      });
      try {
        expect(await ejecutar(analizarArgumentos(["--huellas"]))).toBe(0);
      } finally {
        log.mockRestore();
      }
      expect(lineas.join("\n")).toMatch(
        /Todas las huellas coinciden con PRODUCT\.md/
      );
    }
  );
});
