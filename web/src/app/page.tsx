import type { Metadata } from "next";
import { MainLanding } from "@/components/main-landing";
import { HOME_QUICK_FAQS } from "@/lib/home-faqs";
import { absoluteUrl, buildFaqPageStructuredData, landingStructuredData, ogImages, seoKeywords, siteName } from "@/lib/seo";

// La frase de calle, con las dos promesas en su orden: no perder llamadas y
// llevarlo todo por WhatsApp o desde el panel.
const descripcion =
  "Recepcionista de IA para tu negocio: atiende tus llamadas para que no pierdas ninguna y tú lo gestionas todo por WhatsApp o desde el panel.";

export const metadata: Metadata = {
  title: { absolute: "Alhabla: recepcionista de IA que contesta y reserva citas" },
  description: descripcion,
  keywords: [
    ...seoKeywords,
    "recepcionista de IA para peluquerías",
    "IA para centros de estética",
    "recepcionista de IA para salones de uñas",
    "IA para barberías",
    "recepcionista de IA para fisioterapia",
  ],
  alternates: {
    canonical: absoluteUrl("/"),
  },
  openGraph: {
    title: "Alhabla: recepcionista de IA que contesta y reserva citas",
    description: descripcion,
    url: absoluteUrl("/"),
    siteName,
    locale: "es_ES",
    type: "website",
    images: ogImages(),
  },
  twitter: {
    card: "summary_large_image",
    title: "Alhabla: recepcionista de IA que contesta y reserva citas",
    description: descripcion,
    images: ogImages(),
  },
};

const faqStructuredData = {
  "@context": "https://schema.org",
  ...buildFaqPageStructuredData(HOME_QUICK_FAQS),
};

export default function LandingPage() {
  return (
    <>
      <MainLanding />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(landingStructuredData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
      />
    </>
  );
}
