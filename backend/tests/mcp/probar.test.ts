import { describe, expect, it } from "vitest";
import { INSTRUCCIONES_DE_DEV } from "../../mcp/instruccionesDev.js";
import {
  conectarAlServidor,
  interpretarArgumentos,
  textoDelResultado,
} from "../../mcp/probar.js";

/** Claude Code corta a 2 KB las instructions y las descripciones. */
const LIMITE_DE_CLAUDE_CODE = 2048;

describe("npm run mcp:probar: argumentos", () => {
  it("sin nada lista; con una herramienta la describe; con JSON la llama", () => {
    expect(interpretarArgumentos([])).toEqual({ tipo: "listar", servidor: "servidorDev" });
    expect(interpretarArgumentos(["agenda_dev"])).toEqual({
      tipo: "describir",
      servidor: "servidorDev",
      herramienta: "agenda_dev",
    });
    expect(interpretarArgumentos(["agenda_dev", '{"businessId":"n1"}'])).toEqual({
      tipo: "llamar",
      servidor: "servidorDev",
      herramienta: "agenda_dev",
      argumentos: { businessId: "n1" },
    });
  });

  it("lee los argumentos de @fichero y acepta otro servidor del repo", () => {
    expect(
      interpretarArgumentos(
        ["--servidor", "growth/servidorGrowth", "estado_growth", "@args.json"],
        (ruta) => (ruta === "args.json" ? '{"a":1}' : "")
      )
    ).toEqual({
      tipo: "llamar",
      servidor: "growth/servidorGrowth",
      herramienta: "estado_growth",
      argumentos: { a: 1 },
    });
    expect(interpretarArgumentos(["--instrucciones"])).toEqual({
      tipo: "instrucciones",
      servidor: "servidorDev",
    });
  });

  it("rechaza servidores fuera de mcp/, JSON roto y argumentos sueltos", () => {
    expect(() => interpretarArgumentos(["--servidor", "../src/server"])).toThrow(
      /Servidor no válido/
    );
    expect(() => interpretarArgumentos(["--servidor"])).toThrow(/Servidor no válido/);
    expect(() => interpretarArgumentos(["agenda_dev", "{businessId:1}"])).toThrow(
      /no son JSON/
    );
    expect(() => interpretarArgumentos(["agenda_dev", "[1]"])).toThrow(/objeto JSON/);
    expect(() => interpretarArgumentos(["agenda_dev", "{}", "otro"])).toThrow(
      /Sobran argumentos/
    );
  });

  it("sangra el JSON de la respuesta y deja el texto como viene", () => {
    expect(
      textoDelResultado([
        { type: "text", text: '{"a":1}' },
        { type: "text", text: "sin json" },
      ])
    ).toBe('{\n  "a": 1\n}\nsin json');
  });
});

describe("alhabla-dev arrancado como lo arranca Claude Code", () => {
  it(
    "sus instructions caben en 2 KB y nombran todas las herramientas",
    async () => {
      const cliente = await conectarAlServidor("servidorDev");
      try {
        expect(cliente.getInstructions()).toBe(INSTRUCCIONES_DE_DEV);
        expect(INSTRUCCIONES_DE_DEV.length).toBeLessThanOrEqual(LIMITE_DE_CLAUDE_CODE);
        const { tools } = await cliente.listTools();
        expect(tools.length).toBeGreaterThan(20);
        const sinMencionar = tools
          .map((tool) => tool.name)
          .filter((nombre) => !new RegExp(`\\b${nombre}\\b`).test(INSTRUCCIONES_DE_DEV));
        expect(sinMencionar).toEqual([]);
        const largas = tools
          .filter((tool) => (tool.description ?? "").length > LIMITE_DE_CLAUDE_CODE)
          .map((tool) => tool.name);
        expect(largas).toEqual([]);
      } finally {
        await cliente.close();
      }
    },
    60_000
  );
});
