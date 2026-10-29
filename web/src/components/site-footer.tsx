import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { contactEmail } from "@/lib/seo";

/**
 * Pie común de la portada y las landings de sector. Además de lo legal (la
 * razón social va aquí porque las verificaciones de empresa de Meta piden
 * el titular publicado en la web), enlaza a todas las páginas indexables:
 * hasta ahora los sectores solo se alcanzaban desde el desplegable de la
 * cabecera, y un pie con enlaces es la forma más barata de que Google (y
 * quien llega por un artículo) recorra el sitio entero.
 */
const SECTORES = [
  { href: "/peluqueria", label: "Peluquerías" },
  { href: "/barberia", label: "Barberías" },
  { href: "/centro-de-estetica", label: "Centros de estética" },
  { href: "/salon-de-unas", label: "Salones de uñas" },
  { href: "/fisioterapia", label: "Fisioterapia" },
  { href: "/pestanas-y-cejas", label: "Pestañas y cejas" },
  { href: "/spa-y-masajes", label: "Spa y masajes" },
  { href: "/peluqueria-canina", label: "Peluquería canina" },
] as const;

/** Lo que hace Alhabla además de contestar (2026-10-22): estas páginas
 * solo se alcanzaban desde la portada o un sector concreto. */
const FUNCIONES = [
  { href: "/agenda-por-whatsapp", label: "Tu asistente por WhatsApp" },
  { href: "/recepcionista-ia-en-catalan", label: "En catalán" },
  { href: "/recepcionista-ia-en-euskera", label: "En euskera" },
  { href: "/recepcionista-ia-en-gallego", label: "En gallego" },
] as const;

/** Los índices de cada sección de guías (lib/paginas.ts): desde ellos se
 * llega a cada página hija en un clic, así que el pie enlaza a todo el
 * sitio sin ser una lista de 60 enlaces. */
const RECURSOS = [
  { href: "/integraciones", label: "Integraciones" },
  { href: "/desvio-de-llamadas", label: "Desvío de llamadas" },
  { href: "/herramientas", label: "Herramientas gratis" },
  { href: "/comparativa", label: "Comparativas" },
  { href: "/guias/ley-y-recepcionista-de-ia", label: "La ley y la IA" },
  { href: "/glosario", label: "Glosario" },
] as const;

/** La empresa, en la línea de abajo junto a lo legal: siguen enlazadas
 * desde todo el sitio, pero no compiten con lo que vende. */
const EMPRESA = [
  { href: "/sobre-alhabla", label: "Sobre Alhabla" },
  { href: "/prensa", label: "Prensa" },
  { href: "/novedades", label: "Novedades" },
] as const;

const enlace = "inline-flex h-11 items-center transition hover:text-white";

export function SiteFooter() {
  return (
    <footer className="bg-oscuro text-white/70">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <nav
            aria-label="Sectores"
            className="flex flex-wrap items-center gap-x-4 text-sm font-medium"
          >
            {SECTORES.map((sector) => (
              <Link key={sector.href} href={sector.href} className={enlace}>
                {sector.label}
              </Link>
            ))}
          </nav>
          <nav
            aria-label="Más de Alhabla"
            className="flex flex-wrap items-center gap-x-4 text-sm font-medium"
          >
            <Link href="/planes" className={enlace}>
              Planes y precios
            </Link>
            <Link href="/blog" className={enlace}>
              Blog
            </Link>
            <Link href="/contacto" className={enlace}>
              Contacto
            </Link>
          </nav>
        </div>
        <nav
          aria-label="Funciones"
          className="flex flex-wrap items-center gap-x-4 border-t border-white/10 pt-4 text-sm font-medium"
        >
          {FUNCIONES.map((funcion) => (
            <Link key={funcion.href} href={funcion.href} className={enlace}>
              {funcion.label}
            </Link>
          ))}
        </nav>
        <nav
          aria-label="Guías y recursos"
          className="flex flex-wrap items-center gap-x-4 border-t border-white/10 pt-4 text-sm font-medium"
        >
          {RECURSOS.map((recurso) => (
            <Link key={recurso.href} href={recurso.href} className={enlace}>
              {recurso.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-col gap-4 border-t border-white/10 pt-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <BrandMark className="h-8 w-8 shrink-0" />
            <div className="flex flex-col gap-1">
              <p className="text-sm">© 2026 Alhabla</p>
              <p className="text-sm">Titular: Miguel Martín Delgado</p>
            </div>
          </div>
          <nav
            aria-label="Empresa y enlaces legales"
            className="flex flex-wrap items-center gap-x-4 text-sm font-medium"
          >
            {EMPRESA.map((pagina) => (
              <Link key={pagina.href} href={pagina.href} className={enlace}>
                {pagina.label}
              </Link>
            ))}
            <Link href="/legal/privacidad" className={enlace}>
              Privacidad
            </Link>
            <Link href="/legal/aviso-legal" className={enlace}>
              Aviso legal
            </Link>
            <a href={`mailto:${contactEmail}`} className={enlace}>
              {contactEmail}
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
