import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  blobsDe,
  comprobarGuardasDeGit,
  esClonSuperficial,
  headEstaEnOrigenMain,
  headSha,
  rutasIgualesAOrigenMain,
  rutasSinCommitear,
  ultimoCommitQueToca,
} from "../../mcp/growth/conocimiento/git.js";

/**
 * Las guardas de git contra repositorios de verdad (en una carpeta temporal
 * con su "origin" local): lo que protege es que no se afirme algo que no está
 * en main ni respaldado por el commit que se cita.
 */

const FUENTES = ["PRODUCT.md", "web/src/lib/plans.ts"];

let base: string;
let remoto: string;
let trabajo: string;

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

function confirmar(raiz: string, mensaje: string): string {
  git(raiz, "add", "-A");
  git(raiz, "commit", "-q", "-m", mensaje);
  return git(raiz, "rev-parse", "HEAD");
}

/** Un clon nuevo de main, para cada prueba que ensucia el árbol. */
function clonar(nombre: string): string {
  const destino = join(base, nombre);
  git(base, "clone", "-q", remoto, destino);
  return destino;
}

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "alhabla-conocimiento-"));
  remoto = join(base, "remoto.git");
  git(base, "init", "-q", "--bare", "-b", "main", remoto);

  trabajo = join(base, "trabajo");
  git(base, "init", "-q", "-b", "main", trabajo);
  git(trabajo, "remote", "add", "origin", remoto);
  escribir(trabajo, "PRODUCT.md", "# Producto\n");
  escribir(trabajo, "web/src/lib/plans.ts", "export const plans = [];\n");
  escribir(trabajo, "otro.txt", "no es una fuente\n");
  confirmar(trabajo, "inicial");
  git(trabajo, "push", "-q", "-u", "origin", "main");
});

afterAll(() => {
  rmSync(base, { recursive: true, force: true });
});

describe("git del extractor", () => {
  it("blobsDe da el SHA del contenido, igual que git rev-parse con el árbol limpio", async () => {
    const blobs = await blobsDe(trabajo, FUENTES);
    expect(blobs).toEqual(
      FUENTES.map((ruta) => ({
        ruta,
        blobSha: git(trabajo, "rev-parse", `HEAD:${ruta}`),
      }))
    );
  });

  it("blobsDe refleja un fichero modificado, que HEAD:ruta no vería", async () => {
    const clon = clonar("blob-modificado");
    const antes = (await blobsDe(clon, ["PRODUCT.md"]))[0].blobSha;
    escribir(clon, "PRODUCT.md", "# Producto distinto\n");
    const despues = (await blobsDe(clon, ["PRODUCT.md"]))[0].blobSha;
    expect(despues).not.toBe(antes);
    expect(despues).not.toBe(git(clon, "rev-parse", "HEAD:PRODUCT.md"));
  });

  it("ultimoCommitQueToca devuelve el commit de la última fuente tocada, no HEAD", async () => {
    const clon = clonar("ultimo-commit");
    const primero = git(clon, "rev-parse", "HEAD");
    escribir(clon, "otro.txt", "cambia algo que no es fuente\n");
    const hasta = confirmar(clon, "algo ajeno");
    expect(hasta).not.toBe(primero);
    expect(await headSha(clon)).toBe(hasta);
    expect(await ultimoCommitQueToca(clon, FUENTES)).toBe(primero);

    escribir(clon, "PRODUCT.md", "# Producto v2\n");
    const conCambio = confirmar(clon, "toca una fuente");
    expect(await ultimoCommitQueToca(clon, FUENTES)).toBe(conCambio);
  });

  it("ultimoCommitQueToca devuelve null si ninguna ruta está en git", async () => {
    expect(await ultimoCommitQueToca(trabajo, ["no-existe.md"])).toBeNull();
  });

  it("detecta cambios sin commitear y ficheros sin seguimiento", async () => {
    const clon = clonar("sucio");
    expect(await rutasSinCommitear(clon, FUENTES)).toEqual([]);
    escribir(clon, "PRODUCT.md", "# Cambiado\n");
    escribir(clon, "web/src/lib/nuevo.ts", "export {};\n");
    const sucias = await rutasSinCommitear(clon, [
      ...FUENTES,
      "web/src/lib/nuevo.ts",
    ]);
    expect(sucias.some((l) => l.includes("PRODUCT.md"))).toBe(true);
    expect(
      sucias.some((l) => l.startsWith("??") && l.includes("nuevo.ts"))
    ).toBe(true);
    // Lo que no es una fuente no cuenta.
    escribir(clon, "otro.txt", "ruido\n");
    expect(await rutasSinCommitear(clon, ["PRODUCT.md"])).toHaveLength(1);
  });

  it("un clon normal no es superficial y uno --depth 1 sí", async () => {
    expect(await esClonSuperficial(trabajo)).toBe(false);
    const superficial = join(base, "superficial");
    git(base, "clone", "-q", "--depth", "1", `file://${remoto}`, superficial);
    expect(await esClonSuperficial(superficial)).toBe(true);
  });

  describe("comprobarGuardasDeGit", () => {
    it("en dev, un árbol limpio en main da el commit de las fuentes", async () => {
      const clon = clonar("dev-limpio");
      const resultado = await comprobarGuardasDeGit(clon, FUENTES, {
        permitirRamaLocal: true,
      });
      expect(resultado.commitSha).toBe(git(clon, "rev-parse", "HEAD"));
      expect(resultado.avisos).toEqual([]);
    });

    it("en dev, un árbol sucio se permite pero avisa de que el commit no es exacto", async () => {
      const clon = clonar("dev-sucio");
      escribir(clon, "PRODUCT.md", "# Sin commitear\n");
      const resultado = await comprobarGuardasDeGit(clon, FUENTES, {
        permitirRamaLocal: true,
      });
      expect(resultado.avisos.join(" ")).toMatch(/sin commitear/);
    });

    it("en producción, un árbol idéntico a origin/main pasa", async () => {
      const clon = clonar("prod-limpio");
      const resultado = await comprobarGuardasDeGit(clon, FUENTES, {
        permitirRamaLocal: false,
      });
      expect(resultado.commitSha).toBe(git(clon, "rev-parse", "HEAD"));
    });

    it("en producción, cambios sin commitear en las fuentes se rechazan", async () => {
      const clon = clonar("prod-sucio");
      escribir(clon, "web/src/lib/plans.ts", "export const plans = [1];\n");
      await expect(
        comprobarGuardasDeGit(clon, FUENTES, { permitirRamaLocal: false })
      ).rejects.toThrow(/cambios sin commitear/);
    });

    it("en producción, ensuciar algo que no es una fuente no importa", async () => {
      const clon = clonar("prod-ajeno");
      escribir(clon, "otro.txt", "ruido\n");
      await expect(
        comprobarGuardasDeGit(clon, FUENTES, { permitirRamaLocal: false })
      ).resolves.toMatchObject({ commitSha: expect.any(String) });
    });

    it("en producción, un commit local que no está en origin/main se rechaza", async () => {
      const clon = clonar("prod-rama");
      git(clon, "checkout", "-q", "-b", "mi-rama");
      escribir(clon, "PRODUCT.md", "# Una capacidad que aún no está en main\n");
      confirmar(clon, "en mi rama");
      expect(await headEstaEnOrigenMain(clon)).toBe(false);
      expect(await rutasIgualesAOrigenMain(clon, FUENTES)).toBe(false);
      await expect(
        comprobarGuardasDeGit(clon, FUENTES, { permitirRamaLocal: false })
      ).rejects.toThrow(/todavía no está en origin\/main/);
    });

    it("en producción, si main avanzó sobre las fuentes y este árbol se quedó atrás, se rechaza", async () => {
      const antiguo = clonar("prod-atrasado");
      // Otro clon sube un cambio a main.
      const otro = clonar("prod-otro");
      escribir(otro, "PRODUCT.md", "# main avanzó\n");
      confirmar(otro, "avanza main");
      git(otro, "push", "-q", "origin", "main");
      // El antiguo sigue en su commit: HEAD está en main, pero las fuentes difieren.
      await expect(
        comprobarGuardasDeGit(antiguo, FUENTES, { permitirRamaLocal: false })
      ).rejects.toThrow(/difieren de origin\/main/);
      // Restablecer main para no afectar al resto.
      git(trabajo, "pull", "-q", "origin", "main");
    });

    it("un clon superficial se rechaza siempre", async () => {
      const superficial = join(base, "superficial");
      await expect(
        comprobarGuardasDeGit(superficial, FUENTES, { permitirRamaLocal: true })
      ).rejects.toThrow(/clon es superficial/);
    });

    it("sin ninguna fuente en git no hay commit que citar", async () => {
      await expect(
        comprobarGuardasDeGit(trabajo, ["no-existe.md"], {
          permitirRamaLocal: true,
        })
      ).rejects.toThrow(/Ninguna de las fuentes está en git/);
    });
  });
});
