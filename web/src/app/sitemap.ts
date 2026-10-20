import type { MetadataRoute } from "next";
import { listarArticulos, urlAbsolutaDeImagen } from "@/lib/blog";
import { FOTOS } from "@/lib/fotos";
import { PAGINAS } from "@/lib/paginas";
import { absoluteUrl, escaparXml } from "@/lib/seo";

/** Una imagen del registro (ruta local o URL de banco) en absoluto y
 * escapada: Next escribe el XML sin escapar y un `&` suelto de Unsplash
 * deja el sitemap entero ilegible para Google. */
function imagen(src: string) {
  return escaparXml(src.startsWith("http") ? src : absoluteUrl(src));
}

export default function sitemap(): MetadataRoute.Sitemap {
  // Solo páginas SEO reales, todas desde el registro de lib/paginas.ts: ni
  // /register (noindex) ni nada de la app, que vive en app.alhabla.ai y no
  // se indexa. Sin páginas sector × ciudad desde el 2026-10-20 (301 a su
  // sector en next.config.mjs).
  //
  // `lastModified` solo donde hay una fecha real de revisión de fondo
  // (`actualizado`): un lastmod que siempre es «hoy» hace que Google deje de
  // fiarse de él. Las imágenes son las que se ven en la página, para Google
  // Imágenes.
  return [
    ...PAGINAS.map((p) => ({
      url: absoluteUrl(p.ruta),
      ...(p.actualizado ? { lastModified: new Date(`${p.actualizado}T08:00:00Z`) } : {}),
      changeFrequency: p.frecuencia,
      priority: p.prioridad,
      ...(p.foto || p.imagenes?.length
        ? { images: [...(p.foto ? [FOTOS[p.foto].src] : []), ...(p.imagenes ?? [])].map(imagen) }
        : {}),
    })),
    ...listarArticulos().map((a) => ({
      url: absoluteUrl(`/blog/${a.slug}`),
      lastModified: new Date(`${a.actualizado ?? a.fecha}T08:00:00Z`),
      changeFrequency: "monthly" as const,
      priority: 0.5,
      ...(a.imagen ? { images: [escaparXml(urlAbsolutaDeImagen(a.imagen))] } : {}),
    })),
  ];
}
