import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CARPETA = join(process.cwd(), "content", "blog");
const articulos = readdirSync(CARPETA)
  .filter((f) => f.endsWith(".mdx"))
  .map((f) => ({
    slug: f.replace(/\.mdx$/, ""),
    texto: readFileSync(join(CARPETA, f), "utf-8"),
  }))
  .filter(({ texto }) => !/^borrador:\s*true\s*$/m.test(texto));

describe("preguntas frecuentes de los artículos del blog", () => {
  it("cada artículo publicado lleva un bloque <Faq> (así se declara también como FAQPage)", () => {
    const sin = articulos.filter(({ texto }) => !texto.includes("<Faq ")).map((a) => a.slug);
    expect(sin, `sin <Faq>: ${sin.join(", ")}`).toEqual([]);
  });

  it("tras el título «Preguntas frecuentes» va el bloque <Faq>, no preguntas en Markdown suelto (no declaran nada a Google)", () => {
    const apano = articulos
      .filter(({ texto }) => /^## Preguntas frecuentes/m.test(texto))
      .filter(({ texto }) => !texto.split(/^## Preguntas frecuentes/m)[1].includes("<Faq "))
      .map((a) => a.slug);
    expect(apano, `preguntas en Markdown suelto: ${apano.join(", ")}`).toEqual([]);
  });

  it("cada <Faq> tiene su título «Preguntas frecuentes», para que salga en el índice y tenga ancla", () => {
    const sin = articulos
      .filter(({ texto }) => texto.includes("<Faq ") && !/^## Preguntas frecuentes/m.test(texto))
      .map((a) => a.slug);
    expect(sin, `<Faq> sin título: ${sin.join(", ")}`).toEqual([]);
  });

  it("cada <Faq> tiene al menos cuatro preguntas, con pregunta y respuesta no vacías", () => {
    for (const { slug, texto } of articulos) {
      const preguntas = [...texto.matchAll(/pregunta:\s*"((?:[^"\\]|\\.)+)",\s*respuesta:\s*"((?:[^"\\]|\\.)+)"/g)];
      expect(preguntas.length, `${slug} tiene solo ${preguntas.length} preguntas`).toBeGreaterThanOrEqual(4);
    }
  });

  it("los enlaces de las respuestas están bien formados: `[texto](/ruta)` o `[texto](https://…)`, sin restos de marcado", () => {
    const enlace = /\[[^\]]+\]\((?:\/[^)\s]*|https:\/\/[^)\s]+)\)/g;
    for (const { slug, texto } of articulos) {
      const faq = texto.split(/^## Preguntas frecuentes/m)[1] ?? "";
      const respuestas = [...faq.matchAll(/respuesta:\s*"((?:[^"\\]|\\.)+)"/g)].map((m) => m[1]);
      for (const r of respuestas) {
        const sinEnlaces = r.replace(enlace, "");
        expect(sinEnlaces, `${slug}: marcado de enlace roto en «${r.slice(0, 60)}…»`).not.toMatch(/\]\(|\[[^\]]*\]/);
      }
    }
  });
});
