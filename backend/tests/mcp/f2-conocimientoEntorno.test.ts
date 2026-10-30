import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  cargarDatosDeWeb,
  entornoMinimoDelHijo,
} from "../../mcp/growth/conocimiento/cargarWeb.js";

/**
 * Revisión 1b (conocimiento M4): `web/` es TypeScript que se ejecuta en un
 * proceso hijo; el hijo no recibe el token ni ningún secreto del padre. Aquí el
 * `plans.ts` es falso y lo único que hace es devolver su propio entorno.
 */

let raiz: string;

function escribir(ruta: string, contenido: string) {
  const completa = join(raiz, ruta);
  mkdirSync(join(completa, ".."), { recursive: true });
  writeFileSync(completa, contenido);
}

/** Un `web/` mínimo, válido para `volcarDatosDeWeb`. */
function webFalsa(planes: string) {
  escribir("web/tsconfig.json", "{}\n");
  escribir(
    "web/src/lib/plans.ts",
    `${planes}
export const IVA_PORCENTAJE = 21;
export const TRIAL_DAYS = 14;
export const TRIAL_REASSURANCE = "x";
export const PRECIO_DESDE = "desde 1 €";
`
  );
  escribir("web/src/lib/paginas.ts", "export const PAGINAS = [];\n");
  escribir(
    "web/src/lib/comparativas.ts",
    `export const CONSULTADAS = "2026-01-01";
export const RESUMEN_PLATAFORMAS = [];
export const FUENTES_DEL_RESUMEN = [];
export const FUENTE_LEY = { nombre: "x", url: "https://x.example" };
`
  );
  escribir(
    "web/src/lib/sectores/index.ts",
    "export const SECTORES = {};\nexport const tituloDeSector = () => 'x';\n"
  );
}

const SECRETOS = {
  GROWTH_CONOCIMIENTO_TOKEN: "gta_token-de-conocimiento",
  GROWTH_API_URL: "http://localhost:3000",
  GROWTH_ADMIN_EMAILS: "admin@alhabla.ai",
  DATABASE_URL: "postgresql://u:clave-secreta@host/base",
  STRIPE_SECRET_KEY: "sk_live_x",
};

const guardado: Record<string, string | undefined> = {};

beforeAll(() => {
  raiz = mkdtempSync(join(tmpdir(), "alhabla-f2-entorno-"));
  for (const [k, v] of Object.entries(SECRETOS)) {
    guardado[k] = process.env[k];
    process.env[k] = v;
  }
});

afterAll(() => {
  rmSync(raiz, { recursive: true, force: true });
  for (const [k, v] of Object.entries(guardado)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("entornoMinimoDelHijo", () => {
  const BASE = {
    PATH: "/usr/bin",
    HOME: "/home/x",
    TMPDIR: "/tmp",
    LANG: "es_ES.UTF-8",
    NODE_OPTIONS: "--max-old-space-size=512",
    NODE_ENV: "test",
    ...SECRETOS,
    GROWTH_OTRA: "valor",
    AWS_SECRET_ACCESS_KEY: "x",
  };

  it("deja pasar lo imprescindible y las NODE_*, y fija el tsconfig de web/", () => {
    const entorno = entornoMinimoDelHijo("/repo", BASE);
    expect(entorno).toEqual({
      PATH: "/usr/bin",
      HOME: "/home/x",
      TMPDIR: "/tmp",
      LANG: "es_ES.UTF-8",
      NODE_OPTIONS: "--max-old-space-size=512",
      NODE_ENV: "test",
      TSX_TSCONFIG_PATH: "/repo/web/tsconfig.json",
    });
  });

  it("nunca pasa GROWTH_*, ni secretos de base de datos, Stripe o la nube", () => {
    const claves = Object.keys(entornoMinimoDelHijo("/repo", BASE));
    expect(claves.filter((c) => /^GROWTH_/.test(c))).toEqual([]);
    for (const c of [
      "DATABASE_URL",
      "STRIPE_SECRET_KEY",
      "AWS_SECRET_ACCESS_KEY",
    ]) {
      expect(claves).not.toContain(c);
    }
  });

  it("no hereda un TSX_TSCONFIG_PATH ajeno", () => {
    const entorno = entornoMinimoDelHijo("/repo", {
      ...BASE,
      TSX_TSCONFIG_PATH: "/otro/tsconfig.json",
    });
    expect(entorno.TSX_TSCONFIG_PATH).toBe("/repo/web/tsconfig.json");
  });
});

describe("el proceso hijo que ejecuta web/", () => {
  it("un plans.ts que imprime su entorno no ve el token ni ningún GROWTH_*", async () => {
    webFalsa(`export const plans = [{
  id: "espia", name: JSON.stringify(process.env), price: 1, founderPrice: 1,
  minutes: 1, extraPerMinute: 1, features: [],
}];`);

    expect(process.env.GROWTH_CONOCIMIENTO_TOKEN).toBe(
      SECRETOS.GROWTH_CONOCIMIENTO_TOKEN
    );
    const datos = await cargarDatosDeWeb(raiz);
    const visto = JSON.parse(datos.plans[0].name) as Record<string, string>;

    expect(Object.keys(visto).filter((c) => /^GROWTH_/.test(c))).toEqual([]);
    for (const secreto of Object.values(SECRETOS)) {
      expect(JSON.stringify(visto)).not.toContain(secreto);
    }
    expect(visto.DATABASE_URL).toBeUndefined();
    expect(visto.STRIPE_SECRET_KEY).toBeUndefined();
    // Y lo que necesita para arrancar sí está.
    expect(visto.PATH).toBeTruthy();
    expect(visto.TSX_TSCONFIG_PATH).toBe(join(raiz, "web", "tsconfig.json"));
  }, 30_000);
});
