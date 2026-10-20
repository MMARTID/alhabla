import type { Metadata } from "next";
import { SiteLanding } from "@/components/site-landing";
import { HOME_QUICK_FAQS } from "@/lib/home-faqs";
import { absoluteUrl, buildFaqPageStructuredData, defaultDescription, landingStructuredData, ogImages, seoKeywords, siteName } from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: "Alhabla: recepcionista de IA que contesta y reserva citas" },
  description: defaultDescription,
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
    description: defaultDescription,
    url: absoluteUrl("/"),
    siteName,
    locale: "es_ES",
    type: "website",
    images: ogImages(),
  },
  twitter: {
    card: "summary_large_image",
    title: "Alhabla: recepcionista de IA que contesta y reserva citas",
    description: defaultDescription,
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
      <SiteLanding />
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
