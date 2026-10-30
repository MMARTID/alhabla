import { describe, expect, it } from "vitest";
// El mismo serializador que usa Next para /sitemap.xml.
import { resolveSitemap } from "next/dist/build/webpack/loaders/metadata/resolve-route-data.js";
import sitemap from "@/app/sitemap";
import { listarArticulos } from "@/lib/blog";
import { escaparXml } from "@/lib/seo";

const IMAGEN_NS = "http://www.google.com/schemas/sitemap-image/1.1";

function leerXml() {
  const xml = resolveSitemap(sitemap());
  return new DOMParser().parseFromString(xml, "application/xml");
}

describe("sitemap", () => {
  it("escapa los caracteres reservados de XML", () => {
    expect(escaparXml("https://x.com/a.jpg?auto=format&w=1600")).toBe(
      "https://x.com/a.jpg?auto=format&amp;w=1600"
    );
  });

  it("sale como XML bien formado y con imágenes", () => {
    const doc = leerXml();
    expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
    expect(doc.getElementsByTagNameNS(IMAGEN_NS, "loc").length).toBeGreaterThan(0);
  });

  it("solo declara imágenes propias de alhabla.ai, nunca de banco", () => {
    const imagenes = Array.from(
      leerXml().getElementsByTagNameNS(IMAGEN_NS, "loc")
    ).map((n) => n.textContent ?? "");
    for (const url of imagenes) {
      expect(url, url).toMatch(/^https:\/\/alhabla\.ai\//);
    }
  });

  it("la portada no declara fotos: sus sectores son escenas dibujadas", () => {
    const portada = sitemap().find((e) => e.url === "https://alhabla.ai/");
    expect(portada?.images).toBeUndefined();
  });

  it("no escribe priority ni changefreq, que Google ignora", () => {
    const doc = leerXml();
    expect(doc.getElementsByTagName("priority")).toHaveLength(0);
    expect(doc.getElementsByTagName("changefreq")).toHaveLength(0);
  });

  it("lastmod es una fecha AAAA-MM-DD, sin hora inventada", () => {
    const fechas = Array.from(leerXml().getElementsByTagName("lastmod")).map(
      (n) => n.textContent
    );
    expect(fechas.length).toBeGreaterThan(0);
    for (const fecha of fechas) expect(fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("/blog lleva la fecha de su artículo más reciente", () => {
    const ultimo = listarArticulos()
      .map((a) => a.actualizado ?? a.fecha)
      .sort()
      .at(-1);
    const blog = sitemap().find((e) => e.url === "https://alhabla.ai/blog");
    expect(blog?.lastModified).toBe(ultimo);
  });

  it("no lista las páginas sector × ciudad fusionadas y sí la de catalán", () => {
    const urls = sitemap().map((e) => e.url);
    expect(urls.some((u) => /\/(peluqueria|barberia|centro-de-estetica|salon-de-unas|fisioterapia)\/[a-z-]+$/.test(u))).toBe(false);
    expect(urls).toContain("https://alhabla.ai/recepcionista-ia-en-catalan");
  });

  it("lista el índice de comparativas y las de cada plataforma, no las retiradas", () => {
    const urls = sitemap().map((e) => e.url);
    for (const ruta of [
      "/comparativa",
      "/comparativa/alhabla-vs-retell-ai",
      "/comparativa/alhabla-vs-vapi",
      "/comparativa/alhabla-vs-bland-ai",
      "/comparativa/alhabla-vs-synthflow",
      "/comparativa/alhabla-vs-elevenlabs",
    ]) {
      expect(urls).toContain(`https://alhabla.ai${ruta}`);
    }
    expect(urls.some((u) => /heydiga|fonio|recepcionista-de-ia-vs-/.test(u))).toBe(false);
  });
});
