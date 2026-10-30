import { describe, expect, it, vi } from "vitest";
import {
  censurar,
  comandoParaGuardarElToken,
  crearCredenciales,
  crearLectorDeLlavero,
  destinoDeGrowth,
  ErrorDeCredenciales,
} from "../../mcp/growth/credenciales.js";

const TOKEN = "gta_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG";
const OTRO_TOKEN = "gta_ZYXWVUTSRQPONMLKJIHGFEDCBA9876543210zyxwvu";

describe("destinoDeGrowth: a dónde puede viajar el token", () => {
  it("por defecto es la API de producción", () => {
    expect(destinoDeGrowth({})).toEqual({
      base: "https://api.alhabla.ai",
      host: "api.alhabla.ai",
      local: false,
    });
    expect(destinoDeGrowth({ GROWTH_API_URL: "  " }).base).toBe(
      "https://api.alhabla.ai"
    );
  });

  it.each([
    ["https://api.alhabla.ai", "https://api.alhabla.ai", false],
    ["https://api.alhabla.ai/", "https://api.alhabla.ai", false],
    ["https://api.alhabla.ai:443", "https://api.alhabla.ai", false],
    ["http://localhost:3000", "http://localhost:3000", true],
    ["http://localhost:3010", "http://localhost:3010", true],
    ["http://127.0.0.1:3000", "http://127.0.0.1:3000", true],
    ["http://[::1]:3000", "http://[::1]:3000", true],
    ["https://localhost:8443", "https://localhost:8443", true],
  ])("acepta %s", (url, base, local) => {
    const destino = destinoDeGrowth({ GROWTH_API_URL: url });
    expect(destino.base).toBe(base);
    expect(destino.local).toBe(local);
  });

  it.each([
    "https://dev-api.alhabla.ai",
    "http://api.alhabla.ai",
    "https://api.alhabla.ai.evil.com",
    "https://evil.com",
    "https://alhabla.ai",
    "https://api.alhabla.ai@evil.com",
    "https://usuario:clave@api.alhabla.ai",
    "https://user@localhost:3000",
    "https://api.alhabla.ai/otra-ruta",
    "https://api.alhabla.ai/?x=1",
    "http://localhost.evil.com:3000",
    "http://0.0.0.0:3000",
    "http://10.0.0.5:3000",
    "ftp://localhost",
    "javascript:alert(1)",
    "no es una url",
  ])("rechaza %s", (url) => {
    expect(() => destinoDeGrowth({ GROWTH_API_URL: url })).toThrow(
      ErrorDeCredenciales
    );
  });

  it("el error no repite usuario ni contraseña de la URL", () => {
    try {
      destinoDeGrowth({ GROWTH_API_URL: "https://pepe:secreto123@evil.com" });
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain("secreto123");
      expect((error as Error).message).not.toContain("pepe");
      expect((error as ErrorDeCredenciales).tipo).toBe("url_no_permitida");
    }
  });
});

describe("el token del agente", () => {
  it("prefiere el entorno y no toca el llavero", async () => {
    const leerLlavero = vi.fn();
    const credenciales = crearCredenciales({
      env: { GROWTH_AGENT_TOKEN: `  ${TOKEN}\n` },
      leerLlavero,
    });
    expect(await credenciales.token()).toEqual({
      valor: TOKEN,
      origen: "entorno",
    });
    expect(leerLlavero).not.toHaveBeenCalled();
  });

  it("sin entorno, cae al llavero con el host como cuenta", async () => {
    const leerLlavero = vi.fn().mockResolvedValue(`${TOKEN}\n`);
    const prod = crearCredenciales({ env: {}, leerLlavero });
    expect(await prod.token()).toEqual({ valor: TOKEN, origen: "llavero" });
    expect(leerLlavero).toHaveBeenCalledWith(
      "alhabla-growth",
      "api.alhabla.ai"
    );

    leerLlavero.mockClear();
    const local = crearCredenciales({
      env: { GROWTH_API_URL: "http://localhost:3000" },
      leerLlavero,
    });
    await local.token();
    // Un token de dev y uno de prod son elementos distintos del llavero.
    expect(leerLlavero).toHaveBeenCalledWith("alhabla-growth", "localhost");
  });

  it("sin token en ningún sitio dice cómo guardarlo, sin el valor", async () => {
    const credenciales = crearCredenciales({
      env: {},
      leerLlavero: vi.fn().mockResolvedValue(null),
    });
    const error = await credenciales.token().catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeCredenciales);
    expect(error.tipo).toBe("sin_token");
    expect(error.message).toContain(
      comandoParaGuardarElToken("api.alhabla.ai")
    );
    expect(comandoParaGuardarElToken("api.alhabla.ai")).toBe(
      "security add-generic-password -s alhabla-growth -a api.alhabla.ai -U -w"
    );
  });

  it("si el llavero falla lo dice, pero sigue siendo «sin token»", async () => {
    const credenciales = crearCredenciales({
      env: {},
      leerLlavero: vi
        .fn()
        .mockRejectedValue(new Error("El llavero no respondió")),
    });
    const error = await credenciales.token().catch((e) => e);
    expect(error.tipo).toBe("sin_token");
    expect(error.message).toContain("El llavero no respondió");
  });

  it.each([
    ["sin el prefijo gta_", "abcdefghijklmnopqrstuvwxyz0123456789"],
    ["con el prefijo de un JWT", "eyJhbGciOiJIUzI1NiJ9.cuerpo.firma0123456789"],
    ["demasiado corto", "gta_corto"],
    ["con espacios dentro", "gta_abcdefghijklmnop qrstuvwxyz0123"],
    [
      "con un salto de línea dentro (inyección de cabecera)",
      "gta_abcdefghijklmnopqrstuv\r\nX-Evil: 1",
    ],
  ])("rechaza un token %s sin repetir su valor", async (_nombre, valor) => {
    const credenciales = crearCredenciales({
      env: { GROWTH_AGENT_TOKEN: valor },
    });
    const error = await credenciales.token().catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeCredenciales);
    expect(error.tipo).toBe("token_mal_formado");
    expect(error.message).not.toContain(valor.slice(0, 12));
    expect(error.message).not.toContain("X-Evil");
  });

  it("un token del llavero con mala forma tampoco se usa", async () => {
    const credenciales = crearCredenciales({
      env: {},
      leerLlavero: vi.fn().mockResolvedValue("no-es-un-token"),
    });
    const error = await credenciales.token().catch((e) => e);
    expect(error.tipo).toBe("token_mal_formado");
    expect(error.message).not.toContain("no-es-un-token");
  });

  it("cachea el token y lo relee al invalidar (por si se rotó)", async () => {
    const leerLlavero = vi
      .fn()
      .mockResolvedValueOnce(TOKEN)
      .mockResolvedValueOnce(OTRO_TOKEN);
    const credenciales = crearCredenciales({ env: {}, leerLlavero });
    expect((await credenciales.token()).valor).toBe(TOKEN);
    expect((await credenciales.token()).valor).toBe(TOKEN);
    expect(leerLlavero).toHaveBeenCalledTimes(1);
    credenciales.invalidar();
    expect((await credenciales.token()).valor).toBe(OTRO_TOKEN);
    expect(leerLlavero).toHaveBeenCalledTimes(2);
  });

  it("una URL no permitida impide incluso leer el token", async () => {
    const leerLlavero = vi.fn().mockResolvedValue(TOKEN);
    const credenciales = crearCredenciales({
      env: { GROWTH_API_URL: "https://evil.com" },
      leerLlavero,
    });
    await expect(credenciales.token()).rejects.toMatchObject({
      tipo: "url_no_permitida",
    });
    expect(leerLlavero).not.toHaveBeenCalled();
  });
});

describe("el lector del llavero de macOS", () => {
  it("llama a `security` sin shell y con la cuenta pedida", async () => {
    const ejecutar = vi.fn().mockResolvedValue({ stdout: `${TOKEN}\n` });
    const leer = crearLectorDeLlavero({ plataforma: "darwin", ejecutar });
    expect(await leer("alhabla-growth", "api.alhabla.ai")).toBe(TOKEN);
    expect(ejecutar).toHaveBeenCalledWith(
      "security",
      [
        "find-generic-password",
        "-s",
        "alhabla-growth",
        "-a",
        "api.alhabla.ai",
        "-w",
      ],
      { timeout: 5_000, maxBuffer: 64 * 1024 }
    );
  });

  it("fuera de macOS no ejecuta nada", async () => {
    const ejecutar = vi.fn();
    const leer = crearLectorDeLlavero({ plataforma: "linux", ejecutar });
    expect(await leer("alhabla-growth", "api.alhabla.ai")).toBeNull();
    expect(ejecutar).not.toHaveBeenCalled();
  });

  it("«no existe» (código 44) o sin `security` es null, no un fallo", async () => {
    for (const code of [44, "ENOENT"]) {
      const leer = crearLectorDeLlavero({
        plataforma: "darwin",
        ejecutar: vi
          .fn()
          .mockRejectedValue(Object.assign(new Error("x"), { code })),
      });
      expect(await leer("alhabla-growth", "api.alhabla.ai")).toBeNull();
    }
  });

  it("un tiempo agotado y cualquier otro fallo se explican sin filtrar la salida", async () => {
    const agotado = crearLectorDeLlavero({
      plataforma: "darwin",
      ejecutar: vi
        .fn()
        .mockRejectedValue(Object.assign(new Error("boom"), { killed: true })),
    });
    await expect(agotado("a", "b")).rejects.toThrow(/no respondió en 5 s/);

    const otro = crearLectorDeLlavero({
      plataforma: "darwin",
      ejecutar: vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error(`salida con ${TOKEN}`), { code: 51 })
        ),
    });
    const error = await otro("a", "b").catch((e) => e);
    expect(error.message).toBe("No se pudo leer el llavero de macOS.");
    expect(error.message).not.toContain(TOKEN);
  });

  it("un llavero vacío es null", async () => {
    const leer = crearLectorDeLlavero({
      plataforma: "darwin",
      ejecutar: vi.fn().mockResolvedValue({ stdout: "\n" }),
    });
    expect(await leer("a", "b")).toBeNull();
  });
});

describe("censurar", () => {
  it("tapa tokens de agente, cabeceras Bearer y JWT", () => {
    const jwt =
      "eyJhbGciOiJSUzI1NiIsImtpZCI6IjEifQ.eyJlbWFpbCI6ImFAYi5jb20ifQ.firmaDeEjemplo123";
    const texto = `Authorization: Bearer ${TOKEN} y también ${OTRO_TOKEN}, ${jwt}`;
    const limpio = censurar(texto);
    expect(limpio).not.toContain(TOKEN);
    expect(limpio).not.toContain(OTRO_TOKEN);
    expect(limpio).not.toContain("eyJhbGciOiJSUzI1NiIsImtpZCI6IjEifQ");
    expect(limpio).toContain("Bearer …");
  });

  it("deja en paz el texto normal", () => {
    const texto =
      "Conflicto (HTTP 409) (código: pausa): Growth está en pausa. gta es un prefijo.";
    expect(censurar(texto)).toBe(texto);
  });
});
