import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { TarjetaDeArticulo } from "@/components/blog/tarjeta-de-articulo";
import { Reveal } from "@/components/scroll-reveal";
import { articulosParaSector, listarArticulos } from "@/lib/blog";
import type { NicheLandingContent } from "@/lib/niche-landings";

/**
 * Artículos del blog en la landing de un sector (2026-10-22): primero los
 * del sector y luego guías para todos (lib/blog.ts). Las landings son lo que
 * Google ya tiene indexado y no enlazaban ningún artículo; los de septiembre
 * solo los conocía por el sitemap y seguían sin rastrear. Se pinta en el
 * servidor, así que los enlaces están en el HTML.
 */
export function ArticulosDelSector({ content }: { content: NicheLandingContent }) {
  const articulos = articulosParaSector(content.slug, listarArticulos());
  if (articulos.length === 0) return null;

  return (
    <section aria-labelledby="guias-del-sector" className="py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h2 id="guias-del-sector" className="max-w-2xl text-3xl font-black tracking-tight text-tinta sm:text-4xl">
            Guías para {content.name.toLowerCase()}
          </h2>
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-sm font-semibold text-morado-tinta hover:text-tinta"
          >
            Todo el blog
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Reveal>
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {articulos.map((articulo, index) => (
            <li key={articulo.slug}>
              <Reveal delay={index * 0.1} className="h-full">
                <TarjetaDeArticulo articulo={articulo} encabezado="h3" />
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
