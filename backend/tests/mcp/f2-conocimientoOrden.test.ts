import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Revisión 1b (conocimiento M4): en el CLI las guardas de git van ANTES de
 * cargar `web/` (código TypeScript que se ejecuta). Aquí `cargarEntrada` es un
 * espía que falla si se llega a ella, y el repo es uno de verdad en una
 * carpeta temporal.
 */

const { cargarEntradaMock } = vi.hoisted(() => ({
  cargarEntradaMock: vi.fn(),
}));

vi.mock("../../mcp/growth/conocimiento/entrada.js", () => ({
  cargarEntrada: cargarEntradaMock,
  cargarProductMd: vi.fn(),
  raizPorDefecto: () => "/no/se/usa",
}));

const { prepararCarga } =
  await import("../../mcp/growth/conocimiento/index.js");

let base: string;
let remoto: string;

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Prueba",
      GIT_AUTHOR_EMAIL: "prueba@example.test",
      GIT_COMMITTER_NAME: "Prueba",
      GIT_COMMITTER_EMAIL: "prueba@example.test",
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_SYSTEM: "/dev/null",
    },
  }).trim();
}

function escribir(raiz: string, ruta: string, contenido: string) {
  const completa = join(raiz, ruta);
  mkdirSync(join(completa, ".."), { recursive: true });
  writeFileSync(completa, contenido);
}

function clonar(nombre: string): string {
  const destino = join(base, nombre);
  git(base, "clone", "-q", remoto, destino);
  return destino;
}

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "alhabla-f2-orden-"));
  remoto = join(base, "remoto.git");
  git(base, "init", "-q", "--bare", "-b", "main", remoto);
  const trabajo = join(base, "trabajo");
  git(base, "init", "-q", "-b", "main", trabajo);
  git(trabajo, "remote", "add", "origin", remoto);
  escribir(trabajo, "PRODUCT.md", "# Producto\n");
  escribir(trabajo, "web/src/lib/plans.ts", "export const plans = [];\n");
  git(trabajo, "add", "-A");
  git(trabajo, "commit", "-q", "-m", "inicial");
  git(trabajo, "push", "-q", "-u", "origin", "main");
});

afterAll(() => {
  rmSync(base, { recursive: true, force: true });
});

describe("prepararCarga: las guardas de git van antes de leer nada", () => {
  it("producción con web/ modificado se rechaza SIN haber cargado web/", async () => {
    cargarEntradaMock.mockReset();
    const clon = clonar("prod-sucio");
    escribir(clon, "web/src/lib/plans.ts", "console.log('código ajeno');\n");
    await expect(
      prepararCarga({ raiz: clon, permitirRamaLocal: false })
    ).rejects.toThrow(/sin commitear/);
    expect(cargarEntradaMock).not.toHaveBeenCalled();
  });

  it("producción desde una rama que no es main se rechaza SIN haber cargado web/", async () => {
    cargarEntradaMock.mockReset();
    const clon = clonar("prod-rama");
    git(clon, "checkout", "-q", "-b", "rama");
    escribir(clon, "PRODUCT.md", "# Otro\n");
    git(clon, "add", "-A");
    git(clon, "commit", "-q", "-m", "solo en la rama");
    await expect(
      prepararCarga({ raiz: clon, permitirRamaLocal: false })
    ).rejects.toThrow(/HEAD todavía no está en origin\/main/);
    expect(cargarEntradaMock).not.toHaveBeenCalled();
  });

  it("producción sin red se rechaza SIN haber cargado web/", async () => {
    cargarEntradaMock.mockReset();
    const clon = clonar("prod-sin-red");
    git(clon, "remote", "set-url", "origin", join(base, "no-existe.git"));
    await expect(
      prepararCarga({ raiz: clon, permitirRamaLocal: false })
    ).rejects.toThrow(/No se pudo consultar origin\/main/);
    expect(cargarEntradaMock).not.toHaveBeenCalled();
  });

  it("un clon superficial se rechaza también en dev, antes de cargar nada", async () => {
    cargarEntradaMock.mockReset();
    const superficial = join(base, "superficial");
    git(base, "clone", "-q", "--depth", "1", `file://${remoto}`, superficial);
    await expect(
      prepararCarga({ raiz: superficial, permitirRamaLocal: true })
    ).rejects.toThrow(/superficial/);
    expect(cargarEntradaMock).not.toHaveBeenCalled();
  });

  it("en dev con el árbol sucio sí se llega a cargar (se trabaja con lo que haya)", async () => {
    cargarEntradaMock.mockReset();
    cargarEntradaMock.mockRejectedValue(new Error("llegó a cargarEntrada"));
    const clon = clonar("dev-sucio");
    escribir(clon, "web/src/lib/plans.ts", "export const plans = [1];\n");
    await expect(
      prepararCarga({ raiz: clon, permitirRamaLocal: true })
    ).rejects.toThrow(/llegó a cargarEntrada/);
    expect(cargarEntradaMock).toHaveBeenCalledTimes(1);
  });

  it("producción limpia e idéntica a main sí llega a cargar", async () => {
    cargarEntradaMock.mockReset();
    cargarEntradaMock.mockRejectedValue(new Error("llegó a cargarEntrada"));
    const clon = clonar("prod-limpio");
    await expect(
      prepararCarga({ raiz: clon, permitirRamaLocal: false })
    ).rejects.toThrow(/llegó a cargarEntrada/);
  });
});
