import { execFile } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const ejecutar = promisify(execFile);

const AQUI = dirname(fileURLToPath(import.meta.url));
const BACKEND = resolve(AQUI, "../..");
const RAIZ = resolve(BACKEND, "..");
const CARPETA = join(BACKEND, "mcp", "growth");

/** Los .ts de la carpeta de Growth, sin los de `conocimiento/` (el extractor, que es un programa aparte). */
function ficheros(): { nombre: string; texto: string }[] {
  return readdirSync(CARPETA)
    .filter((f) => f.endsWith(".ts") && statSync(join(CARPETA, f)).isFile())
    .map((nombre) => ({
      nombre,
      texto: readFileSync(join(CARPETA, nombre), "utf8"),
    }));
}

// La cadena prohibida se arma aquí para que este fichero no la contenga entera.
const RUTA_DE_ADMINISTRACION = ["/growth", "admin"].join("/");

describe("alhabla-growth: barreras estáticas del código", () => {
  it("hay código que revisar", () => {
    const nombres = ficheros().map((f) => f.nombre);
    for (const esperado of [
      "servidorGrowth.ts",
      "herramientas.ts",
      "cliente.ts",
      "credenciales.ts",
      "comprobacion.ts",
      "sincronizar.ts",
    ]) {
      expect(nombres).toContain(esperado);
    }
  });

  it("ningún fichero nombra la API de administración", () => {
    for (const { nombre, texto } of ficheros()) {
      expect(texto, nombre).not.toContain(RUTA_DE_ADMINISTRACION);
    }
  });

  it("ninguno conoce la sesión de administrador (ID token de Google, lista de correos)", () => {
    for (const { nombre, texto } of ficheros()) {
      expect(texto, nombre).not.toMatch(
        /GROWTH_ADMIN_EMAILS|GROWTH_GOOGLE_CLIENT_ID/
      );
      expect(texto, nombre).not.toMatch(/autenticarAdminGrowth|verifyIdToken/);
    }
  });

  it("solo importan módulos puros de src: nunca el servicio, las rutas ni Prisma", () => {
    const importaciones =
      /from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
    for (const { nombre, texto } of ficheros()) {
      for (const m of texto.matchAll(importaciones)) {
        const modulo = m[1] ?? m[2]!;
        expect(modulo, `${nombre} importa ${modulo}`).not.toMatch(
          /prisma|\/service(\.js)?$|routes|plugins\/|modules\/growth\/(contextoDeCumplimiento|estados)/i
        );
        if (modulo.includes("src/")) {
          // Lo único de src que puede entrar:
          expect(modulo, `${nombre} importa ${modulo}`).toMatch(
            /src\/modules\/growth\/(esquemas|tokens|conocimiento\/esquemas)\.js$/
          );
        }
      }
    }
  });

  it("stdout es del protocolo: nada escribe en él", () => {
    for (const { nombre, texto } of ficheros()) {
      expect(texto, nombre).not.toMatch(/console\.(log|info|debug)\(/);
      expect(texto, nombre).not.toMatch(/process\.stdout/);
    }
  });

  it("todo el HTTP pasa por cliente.ts (las guardas de ruta y de método)", () => {
    for (const { nombre, texto } of ficheros()) {
      if (nombre === "cliente.ts") continue;
      // Pueden recibir un fetch para pasárselo al cliente, pero no llamarlo.
      expect(texto, nombre).not.toMatch(/\bfetch\(/);
      expect(texto, nombre).not.toMatch(/\bfetchFn\(/);
      expect(texto, nombre).not.toMatch(/node:https?|XMLHttpRequest|undici/);
    }
  });

  it("el token solo se lee en credenciales.ts, y de ahí solo del entorno o del llavero", () => {
    for (const { nombre, texto } of ficheros()) {
      if (nombre === "credenciales.ts") continue;
      expect(texto, nombre).not.toMatch(/process\.env\.GROWTH_AGENT_TOKEN/);
      expect(texto, nombre).not.toMatch(/find-generic-password/);
      expect(texto, nombre).not.toMatch(/dotenv/);
    }
    const credenciales = readFileSync(join(CARPETA, "credenciales.ts"), "utf8");
    expect(credenciales).not.toMatch(/dotenv|readFile/);
  });

  it("ninguna herramienta pide confirmación a una persona (bloquearía la tarea desatendida)", () => {
    const herramientas = readFileSync(join(CARPETA, "herramientas.ts"), "utf8");
    expect(herramientas).not.toMatch(/requiresUserInteraction/);
  });
});

describe("arranque", () => {
  it(".mcp.json registra alhabla-growth sin token ni variables", () => {
    const bruto = readFileSync(join(RAIZ, ".mcp.json"), "utf8");
    const config = JSON.parse(bruto) as {
      mcpServers: Record<
        string,
        { command: string; args?: string[]; env?: unknown }
      >;
    };
    expect(Object.keys(config.mcpServers).sort()).toEqual([
      "alhabla-dev",
      "alhabla-growth",
    ]);
    expect(config.mcpServers["alhabla-dev"]).toEqual({
      command: "backend/mcp/arrancar.sh",
    });
    expect(config.mcpServers["alhabla-growth"]).toEqual({
      command: "backend/mcp/arrancar.sh",
      args: ["growth/servidorGrowth"],
    });
    expect(bruto).not.toMatch(/gta_/);
    expect(
      existsSync(join(BACKEND, "mcp", "growth", "servidorGrowth.ts"))
    ).toBe(true);
  });

  describe("arrancar.sh solo lanza servidores de backend/mcp/", () => {
    const script = join(BACKEND, "mcp", "arrancar.sh");

    async function lanzar(argumento: string) {
      return ejecutar("sh", [script, argumento]).then(
        () => ({ codigo: 0, stderr: "" }),
        (e: { code: number; stderr: string }) => ({
          codigo: e.code,
          stderr: e.stderr,
        })
      );
    }

    it.each([
      "../servidorDev",
      "growth/../servidorDev",
      "/etc/passwd",
      "growth//servidorGrowth",
      "growth/",
      "growth/servidorGrowth.ts",
      "x;touch /tmp/no-debe-existir",
      "$(id)",
      "a b",
    ])("rechaza «%s» sin lanzar nada", async (argumento) => {
      const r = await lanzar(argumento);
      expect(r.codigo).toBe(1);
      expect(r.stderr).toContain("Servidor no válido");
    });

    it("un nombre válido pero que no existe también falla", async () => {
      const r = await lanzar("growth/noExiste");
      expect(r.codigo).toBe(1);
      expect(r.stderr).toContain("No existe mcp/growth/noExiste.ts");
    });

    it("el script es POSIX sh y válido", async () => {
      await expect(ejecutar("sh", ["-n", script])).resolves.toBeTruthy();
    });
  });
});
