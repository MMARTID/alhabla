import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * La sentinela de los datos de prueba solo puede estar en
 * `src/lib/demo/datos.ts`: si apareciera en otro fichero, el paso de CI que
 * busca la sentinela en el build dejaría de ser una prueba de que el modo
 * demostración no se ha colado (se confundiría con una fuga legítima).
 */
const RAIZ = path.resolve(import.meta.dirname, "../..");

function ficheros(carpeta: string): string[] {
  return readdirSync(carpeta).flatMap((nombre) => {
    const ruta = path.join(carpeta, nombre);
    if (nombre === "node_modules" || nombre === ".next") return [];
    return statSync(ruta).isDirectory() ? ficheros(ruta) : [ruta];
  });
}

describe("la sentinela de la demostración", () => {
  it("solo está en lib/demo/datos.ts (y en los tests que la vigilan)", () => {
    const conSentinela = ficheros(RAIZ)
      .filter((ruta) => /\.(tsx?|mjs|json|md|css)$/.test(ruta))
      .filter((ruta) =>
        readFileSync(ruta, "utf8").includes("DEMO_ALHABLA_GROWTH_SENTINELA")
      )
      .map((ruta) => path.relative(RAIZ, ruta))
      .sort();
    expect(conSentinela).toEqual([
      "src/lib/demo/datos.ts",
      "tests/lib/cliente-demo.test.ts",
      "tests/lib/sentinela.test.ts",
    ]);
  });

  it("nada fuera de lib/demo importa los datos ni el cliente de demostración, salvo crear-cliente", () => {
    const importadores = ficheros(path.join(RAIZ, "src"))
      .filter((ruta) => /\.(tsx?)$/.test(ruta))
      .filter(
        (ruta) => !ruta.includes(`${path.sep}lib${path.sep}demo${path.sep}`)
      )
      .filter((ruta) =>
        /from\s+["'][^"']*demo\/|import\(\s*["'][^"']*demo\//.test(
          readFileSync(ruta, "utf8")
        )
      )
      .map((ruta) => path.relative(RAIZ, ruta));
    expect(importadores).toEqual(["src/lib/crear-cliente.ts"]);
  });

  it("los dos puntos de bifurcación llevan la condición escrita tal cual", () => {
    const condicion =
      /process\.env\.NODE_ENV\s*!==\s*"production"\s*&&\s*process\.env\.NEXT_PUBLIC_GROWTH_DEMO\s*===\s*"1"/;
    for (const ruta of [
      "src/lib/crear-cliente.ts",
      "src/components/puerta-de-sesion.tsx",
    ]) {
      expect(readFileSync(path.join(RAIZ, ruta), "utf8"), ruta).toMatch(
        condicion
      );
    }
  });
});
