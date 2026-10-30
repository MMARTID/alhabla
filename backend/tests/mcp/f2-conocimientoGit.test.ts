import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  comprobarGuardasDeGit,
  comprobarGuardasPrevias,
} from "../../mcp/growth/conocimiento/git.js";

/**
 * Revisión 1b (conocimiento M4 y M5): sin red, producción no se sincroniza
 * (antes solo avisaba), y las guardas de git que no necesitan leer nada se
 * pueden pasar ANTES de ejecutar `web/`.
 */

const FUENTES = ["PRODUCT.md", "web/src/lib/plans.ts"];

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

/** Un clon cuyo origin ya no responde (sin red, repositorio borrado…). */
function clonSinRed(nombre: string): string {
  const clon = clonar(nombre);
  git(clon, "remote", "set-url", "origin", join(base, "no-existe.git"));
  return clon;
}

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "alhabla-f2-git-"));
  remoto = join(base, "remoto.git");
  git(base, "init", "-q", "--bare", "-b", "main", remoto);
  const trabajo = join(base, "trabajo");
  git(base, "init", "-q", "-b", "main", trabajo);
  git(trabajo, "remote", "add", "origin", remoto);
  escribir(trabajo, "PRODUCT.md", "# Producto\n");
  escribir(trabajo, "web/src/lib/plans.ts", "export const plans = [];\n");
  escribir(trabajo, "web/tsconfig.json", "{}\n");
  escribir(trabajo, "otro.txt", "no es una fuente\n");
  git(trabajo, "add", "-A");
  git(trabajo, "commit", "-q", "-m", "inicial");
  git(trabajo, "push", "-q", "-u", "origin", "main");
});

afterAll(() => {
  rmSync(base, { recursive: true, force: true });
});

describe("sin red hacia origin/main", () => {
  it("producción ABORTA: no compara con una copia local que puede ser de hace días", async () => {
    const clon = clonSinRed("sin-red-prod");
    await expect(
      comprobarGuardasDeGit(clon, FUENTES, { permitirRamaLocal: false })
    ).rejects.toThrow(
      /No se pudo consultar origin\/main .*producción no se sincroniza/
    );
  });

  it("las guardas previas también abortan, antes de leer nada", async () => {
    const clon = clonSinRed("sin-red-previas");
    await expect(
      comprobarGuardasPrevias(clon, { permitirRamaLocal: false })
    ).rejects.toThrow(/No se pudo consultar origin\/main/);
  });

  it("en dev no hace falta red: se sincroniza la rama que haya", async () => {
    const clon = clonSinRed("sin-red-dev");
    await expect(
      comprobarGuardasDeGit(clon, FUENTES, { permitirRamaLocal: true })
    ).resolves.toMatchObject({ commitSha: git(clon, "rev-parse", "HEAD") });
    await expect(
      comprobarGuardasPrevias(clon, { permitirRamaLocal: true })
    ).resolves.toEqual({ avisos: [] });
  });

  it("con red y todo en orden, producción pasa", async () => {
    const clon = clonar("con-red-prod");
    await expect(
      comprobarGuardasDeGit(clon, FUENTES, { permitirRamaLocal: false })
    ).resolves.toMatchObject({ commitSha: git(clon, "rev-parse", "HEAD") });
  });

  it("omitirFetch no vuelve a tocar la red cuando las guardas previas ya la usaron", async () => {
    const clon = clonSinRed("omitir-fetch");
    await expect(
      comprobarGuardasDeGit(clon, FUENTES, {
        permitirRamaLocal: false,
        omitirFetch: true,
      })
    ).resolves.toMatchObject({ commitSha: git(clon, "rev-parse", "HEAD") });
  });
});

describe("comprobarGuardasPrevias (antes de ejecutar web/)", () => {
  it("producción con el árbol limpio e idéntico a main pasa", async () => {
    const clon = clonar("previas-limpio");
    await expect(
      comprobarGuardasPrevias(clon, { permitirRamaLocal: false })
    ).resolves.toEqual({ avisos: [] });
  });

  it("producción rechaza un cambio sin commitear en web/ (es código que se ejecutaría)", async () => {
    const clon = clonar("previas-web-sucio");
    escribir(clon, "web/src/lib/plans.ts", "export const plans = [1];\n");
    await expect(
      comprobarGuardasPrevias(clon, { permitirRamaLocal: false })
    ).rejects.toThrow(/cambios sin commitear en lo que se lee .*plans\.ts/);
  });

  it("producción rechaza un fichero nuevo bajo web/ sin seguimiento", async () => {
    const clon = clonar("previas-web-nuevo");
    escribir(clon, "web/src/lib/malo.ts", "export const malo = 1;\n");
    await expect(
      comprobarGuardasPrevias(clon, { permitirRamaLocal: false })
    ).rejects.toThrow(/sin commitear/);
  });

  it("producción rechaza una rama que no está en origin/main", async () => {
    const clon = clonar("previas-rama");
    git(clon, "checkout", "-q", "-b", "mi-rama");
    escribir(clon, "otro.txt", "otro\n");
    git(clon, "add", "-A");
    git(clon, "commit", "-q", "-m", "solo en mi rama");
    await expect(
      comprobarGuardasPrevias(clon, { permitirRamaLocal: false })
    ).rejects.toThrow(/HEAD todavía no está en origin\/main/);
  });

  it("producción no se fija en lo que no se lee", async () => {
    const clon = clonar("previas-ajeno");
    escribir(clon, "otro.txt", "cambio que no es una fuente\n");
    await expect(
      comprobarGuardasPrevias(clon, { permitirRamaLocal: false })
    ).resolves.toEqual({ avisos: [] });
  });

  it("dev deja pasar un árbol sucio, pero un clon superficial se rechaza siempre", async () => {
    const clon = clonar("previas-dev");
    escribir(clon, "web/src/lib/plans.ts", "export const plans = [1];\n");
    await expect(
      comprobarGuardasPrevias(clon, { permitirRamaLocal: true })
    ).resolves.toEqual({ avisos: [] });

    const superficial = join(base, "previas-superficial");
    git(base, "clone", "-q", "--depth", "1", `file://${remoto}`, superficial);
    await expect(
      comprobarGuardasPrevias(superficial, { permitirRamaLocal: true })
    ).rejects.toThrow(/superficial/);
    await expect(
      comprobarGuardasPrevias(superficial, { permitirRamaLocal: false })
    ).rejects.toThrow(/superficial/);
  });
});
