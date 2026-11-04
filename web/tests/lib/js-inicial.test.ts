import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const leer = (ruta: string) =>
  readFileSync(join(process.cwd(), "src", ruta), "utf-8");

// Importaciones que arrastran su módulo al JS inicial de la página (las de
// solo tipos, `import type`, no cuentan: TypeScript las borra).
const importaciones = (fuente: string) =>
  [...fuente.matchAll(/^import\s+(?!type\b)[^;]*?from\s+["']([^"']+)["']/gm)].map(
    (m) => m[1]
  );

describe("JS inicial de la portada y de los sectores (medido el 2026-11-04)", () => {
  it("el crédito del modelo 3D no importa three", () => {
    expect(importaciones(leer("lib/portatil-3d-credito.ts"))).toEqual([]);
  });

  it.each([
    "components/en-tu-negocio.tsx",
    "components/gestor-simulacion.tsx",
    "components/main-landing.tsx",
    "components/landing-hero.tsx",
  ])("%s no importa three ni las escenas 3D de forma estática", (fichero) => {
    const rutas = importaciones(leer(fichero));
    for (const ruta of rutas) {
      expect(ruta, `${fichero} importa ${ruta}`).not.toMatch(
        /^three(\/|$)|portatil-3d$|-escena$/
      );
    }
  });

  it.each([
    "components/main-landing.tsx",
    "components/landing-hero.tsx",
    "app/blog/escuchar-una-llamada.tsx",
  ])("%s carga la demo de voz bajo demanda", (fichero) => {
    expect(importaciones(leer(fichero))).not.toContain(
      "@/components/demo-voice-call"
    );
  });

  it("el hero de la portada no depende de framer-motion para verse", () => {
    const hero = leer("components/main-landing.tsx").split('id="contenido"')[1]
      .split("</section>")[0];
    expect(hero).not.toContain("<Reveal");
    expect(hero).toContain("entrada-hero");
  });
});
