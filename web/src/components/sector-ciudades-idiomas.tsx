import Link from "next/link";
import { ArrowRight, Languages, MapPin } from "lucide-react";
import type { CiudadesTextos, NicheAccent, NicheSlug } from "@/lib/niche-landings";
import { Reveal } from "@/components/scroll-reveal";
import { CITIES, CITY_NICHE_STATS, CITY_SLUGS } from "@/lib/sector-ciudades";

const formateador = new Intl.NumberFormat("es-ES");

/**
 * La frase de entrada con la cifra de Madrid: propia de cada sector (venía de
 * las antiguas páginas `/[sector]/[ciudad]`, fusionadas el 2026-10-20).
 */
const ENTRADA_POR_NICHO: Record<NicheSlug, (cifra: string, unidad: string) => string> = {
  peluqueria: (cifra, unidad) =>
    `Con ${cifra} ${unidad}, quien no coge el teléfono a la primera pierde la cita frente a la de al lado.`,
  barberia: (cifra, unidad) =>
    `Con ${cifra} ${unidad} compitiendo por el mismo cliente, la que contesta primero se queda con el corte.`,
  "salon-de-unas": (cifra, unidad) =>
    `Con ${cifra} ${unidad}, cada llamada que no coges es una clienta que reserva en otro sitio.`,
  "centro-de-estetica": (cifra, unidad) =>
    `Entre ${cifra} ${unidad}, el que responde al momento es el que se lleva la consulta.`,
  fisioterapia: (cifra, unidad) =>
    `Con ${cifra} ${unidad}, un paciente que no consigue cita prueba en la siguiente clínica de la lista.`,
};

// Castellano primero y el resto por orden alfabético: la portada ya los
// enumera en su orden, y repetir la misma secuencia en las cinco landings era
// texto duplicado para la auditoría de parecido.
const IDIOMAS_SIEMPRE = ["Castellano", "Alemán", "Francés", "Inglés", "Italiano", "Neerlandés", "Portugués", "Ruso"];

/** «más de 235» (cota, Google Maps) o «13.279» (cifra exacta, INE). */
function formatearCifra(cifra: number, esCota: boolean) {
  const texto = formateador.format(cifra);
  return esCota ? `más de ${texto}` : texto;
}

/**
 * «En tu ciudad y en tu idioma»: lo que de verdad cambia según dónde esté el
 * negocio. Las cifras del sector en las seis grandes ciudades
 * (lib/sector-ciudades.ts) y los idiomas: la recepcionista habla siempre
 * castellano y siete idiomas más, y la lengua cooficial de la provincia del
 * negocio se activa sola por su código postal
 * (backend/src/lib/idiomas/zona.ts: Cataluña y Baleares, Euskadi, Galicia).
 *
 * Los textos llegan por sector (`content.ciudades`, 2026-10-20): con un copy
 * fijo, esta sección era idéntica en las cinco landings y subía su parecido.
 */
export function SectorCiudadesIdiomas({
  nicho,
  accent,
  textos,
}: {
  nicho: NicheSlug;
  accent: NicheAccent;
  textos: CiudadesTextos;
}) {
  const madrid = CITY_NICHE_STATS.madrid[nicho];
  const fuente = madrid.fuente;

  return (
    <section id="ciudades-e-idiomas" className="scroll-m-20 py-16 sm:py-20 lg:py-24">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1.25fr_1fr] lg:gap-12 lg:px-8">
        <div>
          <Reveal className="max-w-2xl">
            <span className="badge-soft gap-2" style={{ backgroundColor: accent.soft, color: accent.deep }}>
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              En tu ciudad y en tu idioma
            </span>
            <h2 className="mt-5 text-3xl font-black leading-tight tracking-tight text-[#0a0a0a] sm:text-4xl">
              {textos.titulo}
            </h2>
            <p className="mt-4 text-base leading-7 text-[#52525b]">
              {ENTRADA_POR_NICHO[nicho](formatearCifra(madrid.cifra, madrid.esCota), madrid.unidad)} {textos.intro}
            </p>
          </Reveal>

          <Reveal delay={0.08} y={12}>
            <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {CITY_SLUGS.map((ciudad) => {
                const stat = CITY_NICHE_STATS[ciudad][nicho];
                return (
                  <div key={ciudad} className="rounded-2xl border border-[#e5e5e5] bg-white p-4">
                    <dt className="text-sm font-semibold text-[#0a0a0a]">{CITIES[ciudad].name}</dt>
                    <dd className="mt-1 text-2xl font-black tracking-tight tabular-nums text-[#0a0a0a]">
                      {formatearCifra(stat.cifra, stat.esCota)}
                    </dd>
                    <dd className="mt-1 text-xs leading-5 text-[#52525b]">{stat.unidad}</dd>
                  </div>
                );
              })}
            </dl>
            <p className="mt-3 text-xs leading-5 text-[#52525b]">
              {madrid.esCota ? `Cota mínima, ${fuente}.` : `Cifras ${fuente}.`}
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.12} y={14}>
          <div className="panel h-full p-6 sm:p-8">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl"
              style={{ backgroundColor: accent.soft, color: accent.strong }}
            >
              <Languages className="h-5 w-5" aria-hidden="true" />
            </div>
            <h3 className="mt-5 text-xl font-bold text-[#0a0a0a]">{textos.idiomasTitulo}</h3>
            <p className="mt-3 text-sm leading-6 text-[#52525b]">{textos.idiomasTexto}</p>
            <ul className="mt-5 flex flex-wrap gap-2" aria-label="Idiomas en todos los planes">
              {IDIOMAS_SIEMPRE.map((idioma) => (
                <li key={idioma} className="rounded-full border border-[#e5e5e5] px-3 py-1 text-xs font-medium text-[#27272a]">
                  {idioma}
                </li>
              ))}
            </ul>
            <Link
              href="/recepcionista-ia-en-catalan"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[#0a0a0a] underline-offset-4 hover:underline"
            >
              {textos.enlace}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
