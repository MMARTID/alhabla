import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  crearGit,
  ErrorDeGit,
  esAscendiente,
  estadoDelRepo,
  versionDePrompts,
  type Git,
} from "../../mcp/growth/repo.js";
import {
  comprobarRepoParaSincronizar,
  construirCuerpoDeSincronizacion,
  ErrorDeSincronizacion,
  type CargaDeConocimiento,
} from "../../mcp/growth/sincronizar.js";

const ejecutar = promisify(execFile);

/** git de verdad contra repositorios temporales: sin red, sin tocar el repo del proyecto. */
async function git(cwd: string, ...argumentos: string[]): Promise<string> {
  const { stdout } = await ejecutar(
    "git",
    [
      "-c",
      "user.name=Prueba",
      "-c",
      "user.email=prueba@example.com",
      "-c",
      "commit.gpgsign=false",
      "-c",
      "init.defaultBranch=main",
      ...argumentos,
    ],
    { cwd }
  );
  return stdout.trim();
}

async function confirmar(cwd: string, fichero: string, contenido: string) {
  writeFileSync(join(cwd, fichero), contenido);
  await git(cwd, "add", fichero);
  await git(cwd, "commit", "-q", "-m", `cambia ${fichero}`);
  return git(cwd, "rev-parse", "HEAD");
}

let raiz: string;
let origen: string;
let trabajo: string;
let otra: string;
let g: Git;

beforeEach(async () => {
  raiz = mkdtempSync(join(tmpdir(), "growth-sincronizar-"));
  origen = join(raiz, "origen.git");
  trabajo = join(raiz, "trabajo");
  otra = join(raiz, "otra");
  mkdirSync(origen);
  await git(origen, "init", "-q", "--bare", "-b", "main");
  await git(raiz, "clone", "-q", origen, trabajo);
  await confirmar(trabajo, "PRODUCT.md", "# Producto\n");
  await git(trabajo, "push", "-q", "origin", "main");
  g = crearGit(trabajo);
});

afterEach(() => {
  rmSync(raiz, { recursive: true, force: true });
});

/** Un commit nuevo en main que llega por otra copia. */
async function avanzarMainDesdeOtraCopia() {
  await git(raiz, "clone", "-q", origen, otra);
  return confirmar(otra, "plans.ts", "export const plans = 1;\n").then(
    async (sha) => {
      await git(otra, "push", "-q", "origin", "main");
      return sha;
    }
  );
}

describe("comprobarRepoParaSincronizar (producción)", () => {
  it("HEAD en origin/main y árbol limpio: puede sincronizar", async () => {
    const head = await git(trabajo, "rev-parse", "HEAD");
    const r = await comprobarRepoParaSincronizar(g, {
      permitirRamaLocal: false,
    });
    expect(r).toEqual({
      commit: head,
      rama: "main",
      contraRama: false,
      avisos: [],
    });
  });

  it("un fichero seguido modificado: no sincroniza", async () => {
    writeFileSync(join(trabajo, "PRODUCT.md"), "# Producto distinto\n");
    const error = await comprobarRepoParaSincronizar(g, {
      permitirRamaLocal: false,
    }).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeSincronizacion);
    expect(error.message).toMatch(/1 fichero con cambios o sin seguir/);
  });

  it("un fichero nuevo sin seguir también cuenta (el extractor podría leerlo)", async () => {
    writeFileSync(join(trabajo, "nuevo.mdx"), "---\n---\n");
    await expect(
      comprobarRepoParaSincronizar(g, { permitirRamaLocal: false })
    ).rejects.toThrow(/cambios o sin seguir/);
  });

  it("por detrás de origin/main: dice el comando exacto para actualizar", async () => {
    await avanzarMainDesdeOtraCopia();
    const error = await comprobarRepoParaSincronizar(g, {
      permitirRamaLocal: false,
    }).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeSincronizacion);
    expect(error.message).toMatch(/va por detrás de origin\/main/);
    expect(error.message).toContain(
      "bash ~/.alhabla-mcp/scripts/dev/entorno.sh herramientas"
    );
  });

  it("con commits que main no tiene: no sincroniza (fijaría cosas no publicadas)", async () => {
    await confirmar(trabajo, "PRODUCT.md", "# Producto con funciones nuevas\n");
    const error = await comprobarRepoParaSincronizar(g, {
      permitirRamaLocal: false,
    }).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeSincronizacion);
    expect(error.message).toMatch(/tiene commits que no están en origin\/main/);
  });

  it("en una rama con cambios sin fusionar: no sincroniza", async () => {
    await git(trabajo, "switch", "-q", "-c", "code/mi-rama");
    await confirmar(trabajo, "plans.ts", "export const plans = 2;\n");
    await expect(
      comprobarRepoParaSincronizar(g, { permitirRamaLocal: false })
    ).rejects.toThrow(/no están en origin\/main/);
  });

  it("sin red para consultar origin/main: no se fía de lo que haya", async () => {
    await git(
      trabajo,
      "remote",
      "set-url",
      "origin",
      join(raiz, "no-existe.git")
    );
    const error = await comprobarRepoParaSincronizar(g, {
      permitirRamaLocal: false,
    }).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeSincronizacion);
    expect(error.message).toMatch(/No se pudo consultar origin\/main/);
  });
});

describe("comprobarRepoParaSincronizar (contra localhost)", () => {
  it("admite una rama con commits propios, con aviso", async () => {
    await git(trabajo, "switch", "-q", "-c", "code/mi-rama");
    const sha = await confirmar(
      trabajo,
      "plans.ts",
      "export const plans = 2;\n"
    );
    const r = await comprobarRepoParaSincronizar(g, {
      permitirRamaLocal: true,
    });
    expect(r.commit).toBe(sha);
    expect(r.rama).toBe("code/mi-rama");
    expect(r.contraRama).toBe(true);
    expect(r.avisos.join(" ")).toMatch(/nunca contra producción/);
  });

  it("admite estar por detrás, con aviso", async () => {
    await avanzarMainDesdeOtraCopia();
    const r = await comprobarRepoParaSincronizar(g, {
      permitirRamaLocal: true,
    });
    expect(r.contraRama).toBe(true);
    expect(r.avisos.join(" ")).toMatch(/por detrás de origin\/main/);
  });

  it("el árbol limpio se exige también contra localhost", async () => {
    writeFileSync(join(trabajo, "PRODUCT.md"), "cambio\n");
    await expect(
      comprobarRepoParaSincronizar(g, { permitirRamaLocal: true })
    ).rejects.toThrow(/cambios o sin seguir/);
  });

  it("sin red avisa pero deja seguir", async () => {
    await git(
      trabajo,
      "remote",
      "set-url",
      "origin",
      join(raiz, "no-existe.git")
    );
    const r = await comprobarRepoParaSincronizar(g, {
      permitirRamaLocal: true,
    });
    expect(r.avisos.join(" ")).toMatch(/No se pudo consultar origin\/main/);
    expect(r.contraRama).toBe(false);
  });
});

describe("construirCuerpoDeSincronizacion", () => {
  function carga(commitSha: string): CargaDeConocimiento {
    return {
      commitSha,
      afirmaciones: [
        {
          clave: "precio.plan.pro",
          tipo: "precio",
          texto: "El plan Pro cuesta 139 € al mes más IVA.",
          valor: { euros: 139 },
          fuente: "web/src/lib/plans.ts#pro",
        },
      ],
      competidores: [],
      nichos: [],
      fuentesLeidas: [],
      avisos: [],
    };
  }

  it("el cuerpo lleva solo lo necesario y omite competidores y nichos vacíos", async () => {
    const head = await git(trabajo, "rev-parse", "HEAD");
    const cuerpo = await construirCuerpoDeSincronizacion(g, carga(head), {
      commit: head,
      rama: "main",
      contraRama: false,
      avisos: [],
    });
    expect(Object.keys(cuerpo).sort()).toEqual(["afirmaciones", "commitSha"]);
    expect(cuerpo.commitSha).toBe(head);
  });

  it("un commit anterior de la historia vale (el último que tocó las fuentes)", async () => {
    const primero = await git(trabajo, "rev-parse", "HEAD");
    const head = await confirmar(trabajo, "otro.md", "x\n");
    const cuerpo = await construirCuerpoDeSincronizacion(g, carga(primero), {
      commit: head,
      rama: "main",
      contraRama: false,
      avisos: [],
    });
    expect(cuerpo.commitSha).toBe(primero);
  });

  it("un commit que no es de la historia de HEAD se rechaza", async () => {
    const head = await git(trabajo, "rev-parse", "HEAD");
    // Un commit real, pero de otra rama que HEAD no contiene.
    await git(trabajo, "switch", "-q", "-c", "otra");
    const ajeno = await confirmar(trabajo, "ajeno.md", "x\n");
    await git(trabajo, "switch", "-q", "main");
    await expect(
      construirCuerpoDeSincronizacion(g, carga(ajeno), {
        commit: head,
        rama: "main",
        contraRama: false,
        avisos: [],
      })
    ).rejects.toThrow(/no es ascendiente de HEAD/);
  });

  it.each(["no-es-un-sha", "", "g".repeat(40), "a".repeat(5)])(
    "un commitSha mal formado («%s») se rechaza",
    async (sha) => {
      const head = await git(trabajo, "rev-parse", "HEAD");
      await expect(
        construirCuerpoDeSincronizacion(g, carga(sha), {
          commit: head,
          rama: "main",
          contraRama: false,
          avisos: [],
        })
      ).rejects.toBeInstanceOf(ErrorDeSincronizacion);
    }
  );

  it("una carga que el backend rechazaría no se envía", async () => {
    const head = await git(trabajo, "rev-parse", "HEAD");
    const mala = carga(head);
    mala.afirmaciones.push({
      clave: "prohibida.garantia",
      tipo: "prohibida",
      texto: "No prometer garantías.",
      // Sin lista de términos no bloquea nada.
      valor: { palabrasEnteras: true },
      fuente: "growth/agentes/reglas/afirmaciones-prohibidas.md",
    });
    const error = await construirCuerpoDeSincronizacion(g, mala, {
      commit: head,
      rama: "main",
      contraRama: false,
      avisos: [],
    }).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeSincronizacion);
    expect(error.message).toMatch(/no cumple el esquema del backend/);
    expect(error.message).toMatch(/terminos/);
  });

  it("la clave debe empezar por su tipo y no repetirse", async () => {
    const head = await git(trabajo, "rev-parse", "HEAD");
    const mala = carga(head);
    mala.afirmaciones.push({ ...mala.afirmaciones[0]! });
    await expect(
      construirCuerpoDeSincronizacion(g, mala, {
        commit: head,
        rama: "main",
        contraRama: false,
        avisos: [],
      })
    ).rejects.toThrow(/viene repetida/);

    const otraClave = carga(head);
    otraClave.afirmaciones[0] = {
      ...otraClave.afirmaciones[0]!,
      clave: "funcion.plan.pro",
    };
    await expect(
      construirCuerpoDeSincronizacion(g, otraClave, {
        commit: head,
        rama: "main",
        contraRama: false,
        avisos: [],
      })
    ).rejects.toThrow(/debe empezar por «precio\.»/);
  });
});

describe("repo.ts", () => {
  it("estadoDelRepo: al día, limpio y después con cambios", async () => {
    const limpio = await estadoDelRepo(g);
    expect(limpio).toMatchObject({
      rama: "main",
      detrasDeMain: 0,
      delanteDeMain: 0,
      limpio: true,
      fetchHecho: true,
    });
    writeFileSync(join(trabajo, "PRODUCT.md"), "cambio\n");
    expect((await estadoDelRepo(g)).limpio).toBe(false);
  });

  it("estadoDelRepo cuenta los commits de diferencia con main", async () => {
    await avanzarMainDesdeOtraCopia();
    await confirmar(trabajo, "local.md", "x\n");
    const r = await estadoDelRepo(g);
    expect(r.detrasDeMain).toBe(1);
    expect(r.delanteDeMain).toBe(1);
  });

  it("estadoDelRepo sin red lo dice y no lanza", async () => {
    await git(
      trabajo,
      "remote",
      "set-url",
      "origin",
      join(raiz, "no-existe.git")
    );
    const r = await estadoDelRepo(g);
    expect(r.fetchHecho).toBe(false);
    expect(r.commit).toMatch(/^[0-9a-f]{40}$/);
  });

  it("estadoDelRepo en una carpeta que no es un repo no lanza", async () => {
    const r = await estadoDelRepo(crearGit(raiz));
    expect(r.commit).toBeNull();
    expect(r.limpio).toBeNull();
    expect(r.problema).toBeTruthy();
  });

  it("versionDePrompts es el SHA de HEAD, o nada", async () => {
    expect(await versionDePrompts(g)).toBe(
      await git(trabajo, "rev-parse", "HEAD")
    );
    expect(await versionDePrompts(crearGit(raiz))).toBeUndefined();
  });

  it("esAscendiente: sí, no (código 1) y error (ref inexistente)", async () => {
    const primero = await git(trabajo, "rev-parse", "HEAD");
    const segundo = await confirmar(trabajo, "otro.md", "x\n");
    expect(await esAscendiente(g, primero, segundo)).toBe(true);
    expect(await esAscendiente(g, segundo, primero)).toBe(false);
    await expect(
      esAscendiente(g, "f".repeat(40), primero)
    ).rejects.toBeInstanceOf(ErrorDeGit);
  });

  it("los argumentos van a git sin pasar por un shell", async () => {
    // Un `;` en un argumento es texto, no una orden: git falla por ref inválida.
    await expect(
      g(["rev-parse", "HEAD; touch /tmp/no-debe-existir"])
    ).rejects.toBeInstanceOf(ErrorDeGit);
  });
});
