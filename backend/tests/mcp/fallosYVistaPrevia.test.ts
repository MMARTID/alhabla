import { describe, expect, it } from "vitest";
import { fallosDeCi, resumirLogFallido } from "../../mcp/fallosDeCi.js";
import { elegirWorktree, leerWorktrees } from "../../mcp/vistaPreviaRama.js";

const JOB = "Backend — typecheck, lint, test";
const PASO = "Run npm run test";
/** Como lo da `gh run view --log-failed`: colores en texto literal. */
const linea = (texto: string, job = JOB, paso = PASO) =>
  `${job}\t${paso}\t2026-11-06T04:14:17.0043781Z ${texto}`;

const LOG_DE_VITEST = [
  linea("^[[90mstderr^[[2m | tests/modules/calendar/service.test.ts > lanza"),
  linea("[Calendar] Failed to list Outlook calendars: Error: invalid_grant"),
  linea("^[[31m⎯⎯⎯⎯⎯⎯^[[39m^[[1m^[[41m Failed Tests 1 ^[[49m^[[22m^[[31m⎯⎯⎯⎯⎯⎯⎯^[[39m"),
  linea(""),
  linea("^[[41m^[[1m FAIL ^[[22m^[[49m tests/mcp/mapa.test.ts^[[2m > ^[[22mel mapa sobre el repo real"),
  linea("^[[31mAssertionError^[[22m: expected 1 to be 2"),
  linea("^[[36m ^[[2m❯^[[22m tests/mcp/mapa.test.ts:^[[2m56:17^[[22m^[[39m"),
  linea("    ^[[90m55|^[[39m   const x = 1;"),
  linea("    ^[[90m   |^[[39m          ^[[31m^^[[39m"),
  linea("^[[31m^[[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯^[[22m^[[39m"),
  linea("^[[2m Test Files ^[[22m ^[[1m^[[31m1 failed^[[39m^[[22m | 221 passed (222)"),
  linea("Duration 12s"),
].join("\n");

describe("fallos_ci: resumen del log", () => {
  it("de vitest se queda con el bloque de fallos, sin colores, código ni ruido", () => {
    expect(resumirLogFallido(LOG_DE_VITEST)).toEqual([
      {
        job: JOB,
        pasos: [PASO],
        resumen: [
          "⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯",
          " FAIL  tests/mcp/mapa.test.ts > el mapa sobre el repo real",
          "AssertionError: expected 1 to be 2",
          " ❯ tests/mcp/mapa.test.ts:56:17",
          " Test Files  1 failed | 221 passed (222)",
        ],
      },
    ]);
  });

  it("de otra cosa, las líneas de error y el final del paso, sin repetir", () => {
    const log = [
      linea("> next build", "Web — lint, test, build", "Run npm run build"),
      linea("Type error: Property 'x' does not exist", "Web — lint, test, build", "Run npm run build"),
      linea("Error: Command failed", "Web — lint, test, build", "Run npm run build"),
      linea("##[error]Process completed with exit code 1.", "Web — lint, test, build", "Run npm run build"),
    ].join("\n");
    const [web] = resumirLogFallido(log);
    expect(web.pasos).toEqual(["Run npm run build"]);
    expect(web.resumen[0]).toBe("Type error: Property 'x' does not exist");
    expect(web.resumen.filter((l) => l === "Error: Command failed")).toHaveLength(1);
    expect(web.resumen).toContain("##[error]Process completed with exit code 1.");
  });

  it("de un PR: los jobs en rojo con su resumen, y lo que sigue en curso", async () => {
    const pedidas: string[][] = [];
    const gh = async (argumentos: string[]) => {
      pedidas.push(argumentos);
      const [orden, sub] = argumentos;
      if (orden === "pr") return JSON.stringify({ number: 7, headRefOid: "abc123def4567890" });
      if (sub === "list") {
        return JSON.stringify([
          { databaseId: 1, workflowName: "CI", status: "completed", conclusion: "failure", url: "u1" },
          { databaseId: 2, workflowName: "Deploy", status: "in_progress", conclusion: "", url: "u2" },
        ]);
      }
      if (argumentos.includes("--log-failed")) return LOG_DE_VITEST;
      return JSON.stringify({
        jobs: [
          { name: JOB, conclusion: "failure", url: "job-url" },
          { name: "Web — lint, test, build", conclusion: "success", url: "otro" },
        ],
      });
    };

    const resultado = await fallosDeCi({ pr: 7 }, gh);
    expect(pedidas).toContainEqual([
      "run", "list", "--commit", "abc123def4567890", "--limit", "20", "--json",
      "databaseId,workflowName,status,conclusion,url",
    ]);
    expect(resultado.commit).toBe("abc123def456");
    expect(resultado.fallidos).toHaveLength(1);
    expect(resultado.fallidos[0]).toMatchObject({ workflow: "CI", job: JOB, url: "job-url" });
    expect(resultado.fallidos[0].resumen).toContain("AssertionError: expected 1 to be 2");
    expect(resultado.ejecuciones.map((e) => e.estado)).toEqual(["failure", "in_progress"]);
  });

  it("sin pr ni rama, o con una rama sin ejecuciones, lo dice", async () => {
    await expect(fallosDeCi({}, async () => "[]")).rejects.toThrow(/pr o rama/);
    await expect(fallosDeCi({ rama: "nueva" }, async () => "[]")).rejects.toThrow(
      /No hay ejecuciones de CI de la rama nueva/
    );
  });
});

const PORCELANA = `worktree /Users/u/AsistAI
HEAD 1111111
branch refs/heads/main

worktree /Users/u/AsistAI/.claude/worktrees/mcp-mejoras
HEAD 2222222
branch refs/heads/feat/mcp-mejoras-pruebas

worktree /Users/u/.alhabla-sim
HEAD 3333333
detached
`;

describe("vista_previa_rama: elegir el worktree", () => {
  const worktrees = leerWorktrees(PORCELANA);

  it("lee el listado de git, también los detached", () => {
    expect(worktrees).toEqual([
      { ruta: "/Users/u/AsistAI", rama: "main", commit: "1111111" },
      {
        ruta: "/Users/u/AsistAI/.claude/worktrees/mcp-mejoras",
        rama: "feat/mcp-mejoras-pruebas",
        commit: "2222222",
      },
      { ruta: "/Users/u/.alhabla-sim", rama: null, commit: "3333333" },
    ]);
  });

  it("por rama, por ruta o por una carpeta de dentro (gana el más concreto)", () => {
    expect(elegirWorktree(worktrees, "feat/mcp-mejoras-pruebas").commit).toBe("2222222");
    expect(elegirWorktree(worktrees, "/Users/u/AsistAI/").commit).toBe("1111111");
    expect(
      elegirWorktree(worktrees, "/Users/u/AsistAI/.claude/worktrees/mcp-mejoras/backend").commit
    ).toBe("2222222");
  });

  it("nada que no sea un worktree del repo", () => {
    expect(() => elegirWorktree(worktrees, "/tmp/otra")).toThrow(/no es la ruta ni la rama/);
    expect(() => elegirWorktree(worktrees, "/Users/u/AsistAIx")).toThrow(/no es la ruta/);
    expect(() => elegirWorktree(worktrees, "no-existe")).toThrow(/Hay: main/);
  });
});
