import type { MetadataRoute } from "next";
import { listarArticulos } from "@/lib/blog";
import { PAGINAS } from "@/lib/paginas";
import { absoluteUrl, escaparXml } from "@/lib/seo";

/** Una imagen propia en absoluto y escapada: Next escribe el XML sin
 * escapar, y un `&` suelto deja el sitemap entero ilegible para Google. */
function imagen(src: string) {
  return escaparXml(absoluteUrl(src));
}

/** Solo las imágenes de public/: las de banco (Unsplash, Pexels) están en
 * un dominio que no podemos verificar en Search Console, y Google solo
 * admite imágenes de otro dominio si lo verificas. */
function esPropia(src: string) {
  return src.startsWith("/");
}

export default function sitemap(): MetadataRoute.Sitemap {
  // Solo páginas SEO reales, todas desde el registro de lib/paginas.ts: ni
  // /register (noindex) ni nada de la app, que vive en app.alhabla.ai y no
  // se indexa. Sin páginas sector × ciudad desde el 2026-10-20 (301 a su
  // sector en next.config.mjs).
  //
  // Sin `priority` ni `changefreq`, que Google y Bing ignoran (2026-10-22).
  // `lastModified` solo con una fecha real de revisión de fondo, y como
  // AAAA-MM-DD tal cual (Next no la convierte): un lastmod igual en todas,
  // o con una hora inventada, hace que Google deje de fiarse de él.
  const articulos = listarArticulos();
  // /blog cambia cuando cambia su artículo más reciente.
  const ultimoArticulo = articulos
    .map((a) => a.actualizado ?? a.fecha)
    .sort()
    .at(-1);

  return [
    // Sin las comparativas desde el 2026-10-28 (decisión del dueño, tras la
    // revisión de docs/auditorias/2026-10-27-competencia-y-comparativas.md):
    // siguen publicadas y enlazadas, pero no se anuncian a los buscadores.
    ...PAGINAS.filter((p) => p.seccion !== "comparativas").map((p) => {
      const fecha = p.ruta === "/blog" ? ultimoArticulo : p.actualizado;
      const imagenes = (p.imagenes ?? []).filter(esPropia);
      return {
        url: absoluteUrl(p.ruta),
        ...(fecha ? { lastModified: fecha } : {}),
        ...(imagenes.length ? { images: imagenes.map(imagen) } : {}),
      };
    }),
    ...articulos.map((a) => ({
      url: absoluteUrl(`/blog/${a.slug}`),
      lastModified: a.actualizado ?? a.fecha,
      ...(a.imagen && esPropia(a.imagen) ? { images: [imagen(a.imagen)] } : {}),
    })),
  ];
}
