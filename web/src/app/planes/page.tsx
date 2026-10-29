import type { Metadata } from "next";
import Link from "next/link";
import { appUrl } from "@/lib/app-url";
import { ArrowRight } from "lucide-react";
import { PlansWithRoi } from "@/components/plans-with-roi";
import { PlansHeadline } from "@/components/plans-headline";
import { BackLink } from "@/components/back-link";
import { BotonWhatsappEquipo } from "@/components/boton-whatsapp-equipo";
import { SiteFooter } from "@/components/site-footer";
import { datosDePrecios, PlanesDetalle, PREGUNTAS_DE_FACTURACION } from "@/components/planes-detalle";
import { absoluteUrl, buildBreadcrumbStructuredData, buildFaqPageStructuredData, ogImages, siteName, websiteId } from "@/lib/seo";
import { formatIncludedMinutes, plans, starterPlan, TRIAL_DAYS } from "@/lib/plans";
import { paginaDe } from "@/lib/paginas";

// Título con la palabra clave y el precio de entrada, que es lo que busca
// quien llega por «recepcionista ia precio»: «Planes y precios» a secas no
// dice de qué. El precio sale de lib/plans.ts para que no se quede viejo
// (Bing llegó a enseñar «desde 79 €» meses después del cambio).
const planesTitle = `Precios de la recepcionista de IA, desde ${starterPlan.price} €`;
const planesDescription = `Desde ${starterPlan.price} € + IVA al mes con ${plans.map((plan) => formatIncludedMinutes(plan.minutes)).join(", ").replace(/, ([^,]*)$/, " o $1")} minutos incluidos: tu recepcionista de IA contesta y reserva citas. ${TRIAL_DAYS} días de prueba, sin permanencia.`;

// Canónica propia: sin ella, esta página heredaba la canónica global del
// root layout (la home) y Google la trataba como duplicada.
export const metadata: Metadata = {
  title: planesTitle,
  description: planesDescription,
  alternates: {
    canonical: absoluteUrl("/planes"),
  },
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: absoluteUrl("/planes"),
    siteName,
    title: planesTitle,
    description: planesDescription,
    images: ogImages("/planes", `${planesTitle} | ${siteName}`),
  },
  twitter: {
    card: "summary_large_image",
    title: planesTitle,
    description: planesDescription,
    images: ogImages("/planes", `${planesTitle} | ${siteName}`),
  },
};

const planesStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    buildBreadcrumbStructuredData([{ name: "Planes y precios", path: "/planes" }]),
    {
      "@type": "WebPage",
      "@id": `${absoluteUrl("/planes")}#webpage`,
      name: `${planesTitle} | ${siteName}`,
      description: planesDescription,
      url: absoluteUrl("/planes"),
      inLanguage: "es-ES",
      isPartOf: { "@id": websiteId() },
    },
    datosDePrecios(),
    buildFaqPageStructuredData(PREGUNTAS_DE_FACTURACION),
  ],
};

/** Las tres dudas de quien está a punto de elegir: cuántas llamadas pierde,
 * cómo se pone en marcha sin cambiar de número y si le sale mejor montarse
 * su propio agente. `paginaDe` hace fallar el build si alguna sale del
 * registro. */
const ANTES_DE_DECIDIR = [
  {
    ruta: "/herramientas/calculadora-de-llamadas-perdidas",
    titulo: "¿Cuántas llamadas pierdes?",
    texto: "Calcula lo que se va cada mes por las llamadas que no coges, con tus cifras.",
  },
  {
    ruta: "/desvio-de-llamadas",
    titulo: "Con tu número de siempre",
    texto: "Desvías a la recepcionista las llamadas que no coges, con el código de tu operador.",
  },
  {
    ruta: "/comparativa",
    titulo: "¿Y si me monto yo un agente?",
    texto: "Alhabla frente a Retell AI, Vapi y otras plataformas para construir tu propio agente de voz.",
  },
].map(({ ruta, ...resto }) => ({ href: paginaDe(ruta).ruta, ...resto }));

export default function PlansPage() {
  return (
    <main className="min-h-screen bg-lienzo text-tinta">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-6 lg:px-8">
        <header className="flex items-center justify-between gap-4">
          <BackLink fallbackHref="/" />
          <a href={appUrl("/login")} className="btn-secondary px-4">
            Ya tengo cuenta
          </a>
        </header>

        <section className="flex flex-1 items-center py-10 lg:py-16">
          <div className="w-full space-y-10">
            <div className="mx-auto max-w-3xl text-center">
              <PlansHeadline />
              <p className="mt-5 text-lg leading-8 text-muted">
                Los tres planes cogen tus llamadas, reservan en tu agenda y traen a tu asistente por WhatsApp.
                Cambian los minutos incluidos, cuántos profesionales caben y algunos extras, como los recordatorios.
              </p>
              <p className="mt-3 text-sm text-muted">Precios sin IVA.</p>
            </div>

            <PlansWithRoi />

            {/* Quien tiene varios locales o dudas no encuentra aquí su caso
                y se iba sin preguntar (estudio comercial del 16-10: 24
                visitas a /planes, ninguna alta, ninguna vía para hablar con
                una persona). */}
            <section className="flex flex-col gap-5 rounded-3xl border border-lavado-borde bg-lavado p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
              <div className="max-w-2xl">
                <h2 className="text-xl font-bold tracking-tight text-tinta sm:text-2xl">
                  ¿Varias sedes, una franquicia o dudas antes de elegir?
                </h2>
                <p className="mt-2 text-base leading-7 text-muted">
                  Cuéntanos tu caso y te contesta una persona del equipo antes de que pagues nada.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 lg:shrink-0">
                <Link href="/contacto" className="btn-primary px-6">
                  Hablar con nosotros
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <BotonWhatsappEquipo ubicacion="planes" className="btn-secondary px-6" />
              </div>
            </section>

            <PlanesDetalle />

            <section aria-labelledby="antes-de-decidir">
              <h2 id="antes-de-decidir" className="text-2xl font-black tracking-tight text-tinta sm:text-3xl">
                Antes de decidir
              </h2>
              <ul className="mt-6 grid gap-4 md:grid-cols-3">
                {ANTES_DE_DECIDIR.map(({ href, titulo, texto }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="group panel landing-card-hover flex h-full flex-col p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado"
                    >
                      <span className="flex items-start justify-between gap-3 font-bold text-tinta">
                        {titulo}
                        <ArrowRight
                          className="mt-1 h-4 w-4 shrink-0 text-morado transition group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </span>
                      <span className="mt-2 text-sm leading-6 text-muted">{texto}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </section>
      </div>
      <SiteFooter />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(planesStructuredData) }}
      />
    </main>
  );
}
