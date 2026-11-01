import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { articulosParaSector, listarArticulos } from "@/lib/blog";
import type { SectorLanding } from "@/lib/sectores/tipos";

/**
 * Tres guías del blog al pie de la landing de un sector (2026-11-01), entre
 * «Más preguntas» y el cierre: solo títulos, sin fotos ni tarjetas, porque la
 * landing quedó corta a propósito el 29-10 («demasiado texto junto»). Existe
 * por el enlazado: 15 de los 18 artículos seguían sin rastrear en Search
 * Console y las landings son lo que Google ya tiene indexado y visita. Se
 * pinta en el servidor, así que los enlaces están en el HTML.
 */
export function GuiasDelSector({ sector }: { sector: SectorLanding }) {
  const articulos = articulosParaSector(sector.slug, listarArticulos());
  if (articulos.length === 0) return null;

  return (
    <section
      id="guias"
      aria-labelledby="guias-titulo"
      className="scroll-m-20 border-t border-linea py-10 sm:py-14"
    >
      <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:px-6 lg:grid-cols-12 lg:gap-16 lg:px-8">
        <div className="lg:col-span-4">
          <h2
            id="guias-titulo"
            className="text-xl font-bold leading-snug tracking-[-0.01em] text-tinta sm:text-2xl"
          >
            Guías para {sector.paraQuien}
          </h2>
          <Link
            href="/blog"
            className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] text-sm font-semibold text-morado-tinta hover:text-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado focus-visible:ring-offset-2"
          >
            Todo el blog
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <ul className="divide-y divide-linea border-y border-linea lg:col-span-8">
          {articulos.map((articulo) => (
            <li key={articulo.slug}>
              <Link
                href={`/blog/${articulo.slug}`}
                className="group flex min-h-14 items-center justify-between gap-6 rounded-[10px] py-4 text-base font-semibold leading-6 text-tinta hover:text-morado-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado focus-visible:ring-offset-2"
              >
                <span>{articulo.titulo}</span>
                <span className="shrink-0 text-sm font-normal text-apagado">
                  {articulo.minutosDeLectura} min
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
