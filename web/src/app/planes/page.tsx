import type { Metadata } from "next";
import Link from "next/link";
import { appUrl } from "@/lib/app-url";
import { ArrowRight, CalendarDays, Clock3, PhoneCall, Sparkles } from "lucide-react";
import { PlansWithRoi } from "@/components/plans-with-roi";
import { PlansHeadline } from "@/components/plans-headline";
import { BackLink } from "@/components/back-link";
import { BotonWhatsappEquipo } from "@/components/boton-whatsapp-equipo";
import { SiteFooter } from "@/components/site-footer";
import { absoluteUrl, buildBreadcrumbStructuredData, ogImages, siteName, websiteId } from "@/lib/seo";

// Título con la palabra clave: «Planes y precios» a secas no dice de qué.
const planesTitle = "Planes y precios del asistente telefónico con IA";
const planesDescription =
  "Planes de Alhabla desde 79€/mes: recepcionista telefónica con IA que atiende 24/7 y reserva citas en tu calendario. 7 días de prueba, sin permanencia.";

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
  ],
};

const benefits = [
  { title: "Sin fricción", description: "Elige plan primero y crea tu cuenta después.", icon: Sparkles },
  { title: "Agenda preparada", description: "Conecta calendario cuando accedas al panel.", icon: CalendarDays },
  { title: "Atención continua", description: "Tu asistente puede responder incluso fuera de horario.", icon: PhoneCall },
  { title: "Minutos claros", description: "Cada plan indica minutos incluidos y coste adicional.", icon: Clock3 },
] as const;

export default function PlansPage() {
  return (
    <main className="min-h-screen bg-white text-[#0a0a0a]">
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
              <span className="badge-soft">Planes Alhabla</span>
              <PlansHeadline />
              <p className="mt-5 text-lg leading-8 text-[#52525b]">
                Elige el plan que encaja hoy y déjanos la recepción: disponibilidad real, tono impecable y operativa lista para crecer.
              </p>
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

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {benefits.map(({ title, description, icon: Icon }) => (
                <article key={title} className="panel landing-card-hover p-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f3eeff] text-[#8b5cf6]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-bold text-[#0a0a0a]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#52525b]">{description}</p>
                </article>
              ))}
            </div>
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
