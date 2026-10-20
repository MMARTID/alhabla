import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Languages, MapPin, Scale } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { nicheLinks } from "@/lib/niche-landings";
import { TRIAL_REASSURANCE } from "@/lib/plans";
import {
  absoluteUrl,
  buildBreadcrumbStructuredData,
  buildFaqPageStructuredData,
  ogImages,
  siteName,
  websiteId,
} from "@/lib/seo";

/**
 * Atención en catalán (y euskera y gallego), 2026-10-20: nadie de la
 * competencia tiene una página así y el autocompletado sí muestra búsquedas
 * por idioma («recepcionista ia valenciano»), no por ciudad.
 *
 * Todo lo que dice sale del backend, no de AGENTS.md:
 * - lengua cooficial automática por el código postal del negocio:
 *   backend/src/lib/idiomas/zona.ts (Cataluña y Baleares → catalán, Euskadi →
 *   euskera, Galicia → gallego; sin la Comunitat Valenciana ni Navarra);
 * - el catalán, el euskera y el gallego pueden ser el idioma principal, y con
 *   cualquier principal habla además los siete de ULTRA_HABLA:
 *   backend/src/lib/idiomas/catalogo.ts (MERCADOS.ES, idiomasQueHabla);
 * - los saludos son los de `IDIOMAS[…].saludo` en ese mismo fichero, y la
 *   nota del prompt del catalán pide adaptarse a las formas valencianas y
 *   baleares.
 */

const titulo = "Recepcionista de IA que atiende en catalán";
const descripcion =
  "En Cataluña y Baleares, tu recepcionista de IA entiende y contesta en catalán desde la primera llamada. Y en castellano y siete idiomas más, en cualquier plan.";
const ruta = "/recepcionista-ia-en-catalan";

export const metadata: Metadata = {
  title: titulo,
  description: descripcion,
  alternates: { canonical: absoluteUrl(ruta) },
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: absoluteUrl(ruta),
    siteName,
    title: `${titulo} | ${siteName}`,
    description: descripcion,
    images: ogImages(ruta, `${titulo} | ${siteName}`),
  },
  twitter: {
    card: "summary_large_image",
    title: `${titulo} | ${siteName}`,
    description: descripcion,
    images: ogImages(ruta, `${titulo} | ${siteName}`),
  },
};

const zonas = [
  {
    zona: "Cataluña y Baleares",
    idioma: "Catalán",
    texto:
      "Si quien llama habla en catalán, la recepcionista le contesta en catalán, con una voz que lo habla de verdad. Si habla en castellano, sigue en castellano.",
  },
  {
    zona: "Euskadi",
    idioma: "Euskera",
    texto: "Lo mismo con el euskera: lo entiende desde el primer momento y contesta en euskera a quien lo habla.",
  },
  {
    zona: "Galicia",
    idioma: "Gallego",
    texto: "Y con el gallego: quien llama en gallego es atendido en gallego, sin pedir que cambie de idioma.",
  },
] as const;

const faqs = [
  {
    question: "¿Tengo que configurar algo para que atienda en catalán?",
    answer:
      "No, si tu negocio está en Cataluña o Baleares: se activa solo por el código postal de tu dirección. Si quieres que además salude en catalán, lo eliges como idioma principal en Ajustes.",
  },
  {
    question: "¿Y si mis clientes hablan valenciano?",
    answer:
      "En la Comunitat Valenciana no se activa solo, porque en buena parte del territorio la clientela habla castellano. Si la tuya habla valenciano, eliges el catalán como idioma principal: saluda en catalán y se adapta a las formas valencianas de quien llama. Lo mismo con el balear.",
  },
  {
    question: "¿Puede saludar en catalán y atender también en castellano?",
    answer:
      "Sí. Con el catalán como idioma principal saluda en catalán, y si quien llama prefiere el castellano, sigue en castellano. Con el castellano como principal pasa al revés.",
  },
  {
    question: "¿Qué otros idiomas habla?",
    answer:
      "En todos los planes, castellano, inglés, francés, alemán, italiano, portugués, neerlandés y ruso. Útil si tu negocio está en una zona turística o tiene clientela extranjera.",
  },
  {
    question: "¿Cuesta más atender en catalán, euskera o gallego?",
    answer: "No. Los idiomas van incluidos en todos los planes, también en el de entrada.",
  },
];

const datosEstructurados = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": `${absoluteUrl(ruta)}#webpage`,
      name: `${titulo} | ${siteName}`,
      description: descripcion,
      url: absoluteUrl(ruta),
      inLanguage: "es-ES",
      isPartOf: { "@id": websiteId() },
    },
    buildBreadcrumbStructuredData([{ name: "Atención en catalán", path: ruta }]),
    buildFaqPageStructuredData(faqs),
  ],
};

export default function RecepcionistaEnCatalanPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="min-h-screen bg-white text-tinta">
        <nav aria-label="Migas de pan" className="mx-auto max-w-5xl px-4 pt-6 text-sm text-muted sm:px-6 lg:px-8">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/" className="hover:text-tinta">
                Inicio
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-tinta">
              Atención en catalán
            </li>
          </ol>
        </nav>

        <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <span className="badge-soft gap-2">
            <Languages className="h-3.5 w-3.5" aria-hidden="true" />
            Català · Euskara · Galego
          </span>
          <h1 className="mt-5 max-w-3xl text-balance text-4xl font-black leading-[1.05] tracking-[-0.03em] sm:text-5xl">
            {titulo}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted">
            Si tu negocio está en Cataluña o Baleares, tu recepcionista de IA entiende y contesta en catalán desde la
            primera llamada, sin que configures nada. Y si quieres, saluda en catalán.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/planes" className="btn-primary h-12 px-6" data-evento="clic_probar" data-ubicacion="catalan">
              Probar Alhabla 7 días <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="#como-suena" className="btn-secondary h-12 px-6">
              Cómo suena una llamada
            </Link>
          </div>
          <p className="mt-3 text-sm text-muted">{TRIAL_REASSURANCE}</p>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-14 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-black tracking-tight sm:text-3xl">La lengua de tu zona, sin tocar nada.</h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
            Alhabla mira el código postal de tu negocio y activa la lengua cooficial que toca. Tu recepcionista sigue
            hablando castellano; además entiende y responde en la lengua de quien llama.
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-3">
            {zonas.map(({ zona, idioma, texto }) => (
              <li key={zona} className="panel p-6">
                <p className="flex items-center gap-2 text-sm font-semibold text-muted">
                  <MapPin className="h-4 w-4 text-morado" aria-hidden="true" />
                  {zona}
                </p>
                <p className="mt-3 text-xl font-bold text-tinta">{idioma}</p>
                <p className="mt-2 text-sm leading-6 text-muted">{texto}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="como-suena" className="scroll-m-20 border-y border-[#e5e5e5] py-14 sm:py-16">
          <div className="mx-auto grid max-w-5xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div>
              <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Así suena en una peluquería de Barcelona.</h2>
              <p className="mt-3 text-base leading-7 text-muted">
                El negocio saluda en castellano, que es su idioma principal. La clienta contesta en catalán y la
                recepcionista sigue en catalán: busca hueco en la agenda real y reserva con quien toca.
              </p>
              <p className="mt-4 text-base leading-7 text-muted">
                Si eliges el catalán como idioma principal, el saludo también es en catalán:{" "}
                <span className="font-medium text-tinta">«Perruqueria Núria, t&apos;atén una intel·ligència artificial. En què et puc ajudar?»</span>
              </p>
            </div>
            <figure className="panel p-6" aria-label="Ejemplo de llamada en catalán">
              <ol className="space-y-3 text-sm leading-6">
                <li className="rounded-2xl bg-lavado px-4 py-3 text-tinta">
                  Perruqueria Núria, te atiende su asistente de inteligencia artificial. ¿En qué te ayudo?
                </li>
                <li className="ml-8 rounded-2xl border border-[#e5e5e5] px-4 py-3 text-tinta">
                  Hola! Voldria hora per tallar-me els cabells demà a la tarda.
                </li>
                <li className="rounded-2xl bg-lavado px-4 py-3 text-tinta">
                  És clar. Demà tinc lloc a les cinc i mitja amb la Marta. A quin nom la reservo?
                </li>
                <li className="ml-8 rounded-2xl border border-[#e5e5e5] px-4 py-3 text-tinta">A nom de la Carme.</li>
              </ol>
              <figcaption className="mt-4 text-xs leading-5 text-muted">
                Ejemplo ilustrativo de una conversación; el negocio y los nombres son inventados.
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="panel p-6 sm:p-8">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-lavado text-morado">
                <Scale className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="mt-5 text-xl font-bold text-tinta">Lo que dice el Codi de consum</h2>
              <p className="mt-3 text-sm leading-6 text-muted">
                En Cataluña, el artículo 128-1 del Código de consumo (Ley 22/2010) reconoce a los consumidores el
                derecho a ser atendidos, oralmente y por escrito, en la lengua oficial que escojan, en los términos
                que ha interpretado el Tribunal Constitucional (STC 88/2017). Una recepcionista que entiende y
                contesta en catalán y en castellano te ayuda a que el teléfono no sea la excepción.
              </p>
              <a
                href="https://www.boe.es/buscar/act.php?id=BOE-A-2010-13115"
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-block text-sm font-semibold text-morado-tinta underline underline-offset-4"
              >
                Leer la Ley 22/2010 en el BOE
              </a>
            </div>
            <div className="panel p-6 sm:p-8">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-lavado text-morado">
                <Languages className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="mt-5 text-xl font-bold text-tinta">Y ocho idiomas más, en toda España</h2>
              <p className="mt-3 text-sm leading-6 text-muted">
                Castellano, inglés, francés, alemán, italiano, portugués, neerlandés y ruso en todos los planes. Si un
                turista llama a tu negocio en Sitges, en Palma o en Donostia, se le atiende en su idioma y la cita
                queda igual de bien reservada.
              </p>
              <ul className="mt-4 space-y-2 text-sm leading-6 text-tinta">
                {["Incluido en todos los planes", "Mismo número de siempre, con el desvío de tu operador", "Reserva en Google Calendar, Outlook o iCloud"].map(
                  (texto) => (
                    <li key={texto} className="flex items-start gap-2">
                      <Check className="mt-1 h-4 w-4 shrink-0 text-morado" aria-hidden="true" />
                      {texto}
                    </li>
                  )
                )}
              </ul>
            </div>
          </div>
        </section>

        <section className="border-t border-[#e5e5e5] py-14 sm:py-16">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Preguntas sobre los idiomas</h2>
            <div className="mt-8 grid items-start gap-3 sm:grid-cols-2">
              {faqs.map(({ question, answer }) => (
                <details key={question} className="group rounded-2xl border border-[#e5e5e5] bg-white p-5">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-sm font-semibold leading-6 text-tinta marker:content-none">
                    {question}
                    <span className="mt-1 text-lg leading-none text-morado transition group-open:rotate-45" aria-hidden="true">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 border-t border-[#e5e5e5] pt-3 text-sm leading-6 text-muted">{answer}</p>
                </details>
              ))}
            </div>

            <h2 className="mt-14 text-xl font-bold text-tinta">Cómo trabaja en tu sector</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {nicheLinks.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="btn-secondary h-10 px-4 text-sm">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="bg-[#0a0a0a] text-white">
          <div className="mx-auto flex max-w-5xl flex-col items-start gap-6 px-4 py-14 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <h2 className="max-w-xl text-3xl font-black tracking-tight sm:text-4xl">
              Que te llamen en el idioma que quieran.
            </h2>
            <Link href="/planes" className="btn-purple" data-evento="clic_probar" data-ubicacion="catalan_cierre">
              Empezar ahora <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datosEstructurados) }} />
    </>
  );
}
