import type { Metadata } from "next";
import { Building2, CircleHelp, Mail, PhoneCall } from "lucide-react";
import { BotonWhatsappEquipo } from "@/components/boton-whatsapp-equipo";
import { FormularioDeContacto } from "@/components/formulario-de-contacto";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  absoluteUrl,
  buildBreadcrumbStructuredData,
  contactEmail,
  ogImages,
  siteName,
  websiteId,
} from "@/lib/seo";

const contactoTitle = "Hablar con nosotros";
const contactoDescription =
  "Te enseñamos Alhabla funcionando con tu negocio o te resolvemos las dudas antes de elegir plan. Te contesta una persona del equipo.";

export const metadata: Metadata = {
  title: contactoTitle,
  description: contactoDescription,
  alternates: {
    canonical: absoluteUrl("/contacto"),
  },
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: absoluteUrl("/contacto"),
    siteName,
    title: `${contactoTitle} | ${siteName}`,
    description: contactoDescription,
    images: ogImages("/contacto", `${contactoTitle} | ${siteName}`),
  },
  twitter: {
    card: "summary_large_image",
    title: `${contactoTitle} | ${siteName}`,
    description: contactoDescription,
    images: ogImages("/contacto", `${contactoTitle} | ${siteName}`),
  },
};

const contactoStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    buildBreadcrumbStructuredData([{ name: contactoTitle, path: "/contacto" }]),
    {
      "@type": "ContactPage",
      "@id": `${absoluteUrl("/contacto")}#webpage`,
      name: `${contactoTitle} | ${siteName}`,
      description: contactoDescription,
      url: absoluteUrl("/contacto"),
      inLanguage: "es-ES",
      isPartOf: { "@id": websiteId() },
    },
  ],
};

// Primero lo que más convence: verla funcionando. Nada de funciones que el
// producto no tenga: con varias sedes se habla del caso, no se promete un
// panel multi-sede.
const motivos = [
  {
    titulo: "Te lo enseñamos funcionando",
    texto: "Con los servicios y el horario de tu negocio: oyes cómo atiende una llamada y cómo le pides cambios a tu asistente por WhatsApp.",
    icono: PhoneCall,
  },
  {
    titulo: "Dudas antes de elegir plan",
    texto: "Minutos, calendario, desvío de llamadas o qué pasa al acabar la prueba: pregúntanos lo que necesites.",
    icono: CircleHelp,
  },
  {
    titulo: "Varias sedes o una franquicia",
    texto: "Cuéntanos cómo trabajáis en cada local y vemos juntos cómo encaja Alhabla antes de que pagues nada.",
    icono: Building2,
  },
] as const;

export default function ContactoPage() {
  return (
    <>
      <SiteHeader inicio="/" />
      <main className="min-h-screen bg-white text-tinta">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 lg:px-8 lg:py-16">
          <section>
            <span className="badge-soft">Contacto</span>
            <h1 className="mt-4 text-4xl font-extrabold tracking-[-0.025em] sm:text-5xl">Hablar con nosotros</h1>
            <p className="mt-4 text-base leading-7 text-muted sm:text-lg">
              Te contesta una persona del equipo. Déjanos tus datos y te escribimos o te llamamos, como prefieras.
            </p>

            <ul className="mt-8 space-y-6">
              {motivos.map(({ titulo, texto, icono: Icono }) => (
                <li key={titulo} className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lavado text-morado">
                    <Icono className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="font-bold text-tinta">{titulo}</h2>
                    <p className="mt-1 text-sm leading-6 text-muted">{texto}</p>
                  </div>
                </li>
              ))}
              <li className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lavado text-morado">
                  <Mail className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="font-bold text-tinta">¿Prefieres el correo?</h2>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    Escríbenos a{" "}
                    <a
                      href={`mailto:${contactEmail}`}
                      className="rounded font-semibold text-morado-tinta underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado"
                    >
                      {contactEmail}
                    </a>
                    .
                  </p>
                </div>
              </li>
            </ul>

            <BotonWhatsappEquipo ubicacion="contacto" className="btn-secondary mt-8" />
          </section>

          <section aria-label="Formulario de contacto" className="panel p-6 sm:p-8">
            <FormularioDeContacto />
          </section>
        </div>
      </main>
      <SiteFooter />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactoStructuredData) }}
      />
    </>
  );
}
