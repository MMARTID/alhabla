import Link from "next/link";
import { appUrl } from "@/lib/app-url";
import { BrandMark } from "@/components/brand-mark";
import { MobileNav } from "@/components/mobile-nav";
import { SectorsMenu } from "@/components/sectors-menu";
import type { SectorSlug } from "@/lib/sectores/tipos";

function buildPlansHref(niche?: SectorSlug) {
  return niche ? `/planes?niche=${encodeURIComponent(niche)}` : "/planes";
}

/**
 * Cabecera única de la web pública: antes vivía duplicada (una versión en
 * `site-landing.tsx` para las landings de nicho, otra con animación propia
 * de ocultado en móvil en `main-landing.tsx`). Esa animación se llevaba el
 * botón de menú por delante mientras el visitante hacía scroll por "Cómo
 * funciona" en móvil — el propio menú quedaba inalcanzable. Aquí la cabecera
 * es siempre visible y el menú, siempre disponible.
 */
/**
 * `inicio`: en las landings el ancla «Cómo funciona» es de la propia página;
 * en el blog y demás páginas apunta a la portada («/»).
 */
export function SiteHeader({ niche, inicio = "" }: { niche?: SectorSlug; inicio?: string }) {
  const plansHref = buildPlansHref(niche);

  return (
    <header className="sticky top-0 z-50 border-b border-[#e5e5e5] bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:h-[4.5rem] lg:px-8">
        {/* Misma marca que la barra lateral de la app (app-shell.tsx):
            isotipo de 44 px y «Alhabla» en negrita normal, no en black.
            Entre 768 y 840 px, solo el isotipo: con los enlaces y los dos
            botones la fila no cabe (medido el 29-10). */}
        <Link href="/" aria-label="Ir al inicio de Alhabla" className="flex min-w-0 items-center gap-3">
          <BrandMark className="h-10 w-10 shrink-0 lg:h-11 lg:w-11" />
          <p className="text-base font-bold leading-none text-[#0a0a0a] md:max-[839px]:hidden">Alhabla</p>
        </Link>

        {/* Enlaces con aire entre ellos (gap-5/7) y los botones en su propio
            grupo, separados del último enlace. */}
        <nav className="hidden items-center md:flex" aria-label="Navegación principal">
          <div className="flex items-center gap-5 lg:gap-7">
            <SectorsMenu />
            <a href={`${inicio}#como-funciona`} className="enlace-nav">
              Cómo funciona
            </a>
            <Link href="/agenda-por-whatsapp" className="enlace-nav">
              Tu asistente
            </Link>
            <Link href={plansHref} className="enlace-nav">
              Precios
            </Link>
            {/* Blog desde 1024 px y Contacto desde 1100 px: por debajo la
                fila no cabe en una línea (medido el 16-10 y otra vez el 29-10
                con «Tu asistente»: a 768 px la marca ya quedaba aplastada).
                Los dos siguen en el pie y en el menú móvil. */}
            <Link href="/blog" className="enlace-nav hidden lg:inline">
              Blog
            </Link>
            <Link href="/contacto" className="enlace-nav hidden min-[1100px]:inline">
              Contacto
            </Link>
          </div>
          <div className="ml-6 flex items-center gap-3 lg:ml-10">
            <a href={appUrl("/login")} className="btn-secondary h-10 px-4">
              Iniciar sesión
            </a>
            <Link
              href={plansHref}
              className="btn-primary h-10 px-4"
              data-evento="clic_probar"
              data-ubicacion="cabecera"
            >
              {/* Entre 768 y 1024 px el texto entero no cabe: ahí, el corto. */}
              <span className="lg:hidden">Probar gratis</span>
              <span className="hidden lg:inline">Probar 7 días gratis</span>
            </Link>
          </div>
        </nav>

        <MobileNav niche={niche} inicio={inicio} />
      </div>
    </header>
  );
}
