import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { GET as llms } from "@/app/llms.txt/route";
import { FOTOS } from "@/lib/fotos";
import { PAGINAS, paginaDe, paginasBajo } from "@/lib/paginas";

const APP = path.join(process.cwd(), "src", "app");

/** Rutas de `app/` con page.tsx que no son páginas SEO (noindex, editor,
 * vistas previas o dinámicas del blog, que salen de content/blog). */
const NO_INDEXABLES = new Set(["/register", "/keystatic/[[...params]]", "/vista-previa/[slug]", "/blog/[slug]"]);

function rutasConPagina(dir = APP, base = ""): string[] {
  const rutas: string[] = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entrada.isDirectory() || entrada.name.startsWith("_") || entrada.name === "api") continue;
    const ruta = `${base}/${entrada.name}`;
    const carpeta = path.join(dir, entrada.name);
    if (fs.existsSync(path.join(carpeta, "page.tsx"))) rutas.push(ruta);
    rutas.push(...rutasConPagina(carpeta, ruta));
  }
  return rutas;
}

describe("registro de páginas indexables", () => {
  it("cada ruta del registro tiene su page.tsx", () => {
    for (const { ruta } of PAGINAS) {
      const fichero = ruta === "/" ? path.join(APP, "page.tsx") : path.join(APP, ruta, "page.tsx");
      expect(fs.existsSync(fichero), `${ruta} no tiene page.tsx`).toBe(true);
    }
  });

  it("ninguna página indexable se queda fuera del registro", () => {
    const registradas = new Set(PAGINAS.map((p) => p.ruta));
    const fuera = rutasConPagina().filter((r) => !NO_INDEXABLES.has(r) && !r.startsWith("/preview") && !registradas.has(r));
    expect(fuera).toEqual([]);
  });

  it("no repite rutas y cada foto existe en el catálogo", () => {
    const rutas = PAGINAS.map((p) => p.ruta);
    expect(new Set(rutas).size).toBe(rutas.length);
    for (const p of PAGINAS) {
      if (p.foto) expect(FOTOS[p.foto], `${p.ruta}: foto ${p.foto}`).toBeDefined();
    }
  });

  it("los resúmenes caben en una tarjeta y en /llms.txt", () => {
    for (const p of PAGINAS) {
      expect(p.resumen.length, p.ruta).toBeLessThanOrEqual(160);
      expect(p.resumen.length, p.ruta).toBeGreaterThan(20);
    }
  });

  it("los índices de sección tienen hijas", () => {
    for (const indice of ["/integraciones", "/desvio-de-llamadas", "/comparativa", "/herramientas"]) {
      expect(paginaDe(indice)).toBeDefined();
      expect(paginasBajo(indice).length, indice).toBeGreaterThan(0);
    }
  });

  it("el sitemap lista todas las páginas del registro y sus imágenes propias", () => {
    const entradas = sitemap();
    const urls = entradas.map((e) => new URL(e.url).pathname);
    for (const { ruta } of PAGINAS) expect(urls).toContain(ruta);
    for (const p of PAGINAS.filter((pagina) => pagina.imagenes?.length)) {
      const entrada = entradas.find((e) => new URL(e.url).pathname === p.ruta);
      expect(entrada?.images, p.ruta).toHaveLength(p.imagenes!.length);
    }
  });

  it("cada página lleva su fecha de revisión en AAAA-MM-DD", () => {
    for (const p of PAGINAS) {
      // /blog la toma de su último artículo y /contacto no tiene fecha de fondo.
      if (p.ruta === "/blog" || p.ruta === "/contacto") continue;
      expect(p.actualizado, p.ruta).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("las imágenes del registro son propias (rutas bajo public/)", () => {
    for (const p of PAGINAS) {
      for (const src of p.imagenes ?? []) expect(src, p.ruta).toMatch(/^\//);
    }
  });
});

describe("/llms.txt", () => {
  it("resume el sitio con precios y enlaces a cada sección", async () => {
    const res = llms();
    expect(res.headers.get("Content-Type")).toContain("text/plain");
    const texto = await res.text();
    expect(texto).toMatch(/^# Alhabla/);
    expect(texto).toContain("## Precios");
    expect(texto).toContain("/desvio-de-llamadas");
    expect(texto).toContain("/integraciones/google-calendar");
  });
});
