import { describe, expect, it } from "vitest";
// El mismo serializador que usa Next para /sitemap.xml.
import { resolveSitemap } from "next/dist/build/webpack/loaders/metadata/resolve-route-data.js";
import sitemap from "@/app/sitemap";
import { escaparXml } from "@/lib/seo";

describe("sitemap", () => {
  it("escapa los caracteres reservados de XML", () => {
    expect(escaparXml("https://x.com/a.jpg?auto=format&w=1600")).toBe(
      "https://x.com/a.jpg?auto=format&amp;w=1600"
    );
  });

  it("sale como XML bien formado aunque las portadas lleven &", () => {
    const entradas = sitemap();
    expect(entradas.some((e) => e.images?.length)).toBe(true);

    const xml = resolveSitemap(entradas);
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);

    // Lo que lee Google, ya desescapado, es la URL original con su &.
    const imagenes = Array.from(
      doc.getElementsByTagNameNS(
        "http://www.google.com/schemas/sitemap-image/1.1",
        "loc"
      )
    ).map((n) => n.textContent);
    expect(imagenes.length).toBeGreaterThan(0);
    expect(imagenes.some((u) => u?.includes("&fit=crop"))).toBe(true);
  });

  it("no lista las páginas sector × ciudad fusionadas y sí la de catalán", () => {
    const urls = sitemap().map((e) => e.url);
    expect(urls.some((u) => /\/(peluqueria|barberia|centro-de-estetica|salon-de-unas|fisioterapia)\/[a-z-]+$/.test(u))).toBe(false);
    expect(urls).toContain("/recepcionista-ia-en-catalan");
  });
});
