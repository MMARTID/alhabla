import type { Metadata } from "next";
import { plans } from "@/lib/plans";
import {
  absoluteUrl,
  buildFaqPageStructuredData,
  ogImages,
  organizationId,
  PRECIO_MAXIMO,
  PRECIO_MINIMO,
  siteName,
  websiteId,
} from "@/lib/seo";
import { barberia } from "@/lib/sectores/barberia";
import { centroDeEstetica } from "@/lib/sectores/centro-de-estetica";
import { fisioterapia } from "@/lib/sectores/fisioterapia";
import { peluqueria } from "@/lib/sectores/peluqueria";
import { peluqueriaCanina } from "@/lib/sectores/peluqueria-canina";
import { pestanasYCejas } from "@/lib/sectores/pestanas-y-cejas";
import { salonDeUnas } from "@/lib/sectores/salon-de-unas";
import { spaYMasajes } from "@/lib/sectores/spa-y-masajes";
import type { SectorLanding, SectorSlug } from "@/lib/sectores/tipos";

export type { SectorLanding, SectorSlug } from "@/lib/sectores/tipos";

/** Las ocho landings de sector, en el orden del menú. */
export const SECTORES: Record<SectorSlug, SectorLanding> = {
  peluqueria,
  barberia,
  "centro-de-estetica": centroDeEstetica,
  "salon-de-unas": salonDeUnas,
  fisioterapia,
  "pestanas-y-cejas": pestanasYCejas,
  "spa-y-masajes": spaYMasajes,
  "peluqueria-canina": peluqueriaCanina,
};

/** «Recepcionista de IA para peluquerías»: H1, título y nombre del servicio. */
export function tituloDeSector(sector: SectorLanding): string {
  return `Recepcionista de IA para ${sector.paraQuien}`;
}

export function metadatosDeSector(sector: SectorLanding): Metadata {
  const url = absoluteUrl(`/${sector.slug}`);
  const titulo = `${tituloDeSector(sector)} | ${siteName}`;

  return {
    title: { absolute: titulo },
    description: sector.descripcion,
    alternates: { canonical: url },
    category: "business software",
    openGraph: {
      title: titulo,
      description: sector.descripcion,
      url,
      siteName,
      locale: "es_ES",
      type: "website",
      images: ogImages(`/${sector.slug}`, titulo),
    },
    twitter: {
      card: "summary_large_image",
      title: titulo,
      description: sector.descripcion,
      images: ogImages(`/${sector.slug}`, titulo),
    },
  };
}

/** El grafo de la landing: la página, el servicio, sus preguntas y las migas. */
export function datosEstructuradosDeSector(sector: SectorLanding) {
  const url = absoluteUrl(`/${sector.slug}`);
  const titulo = tituloDeSector(sector);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        name: `${titulo} | ${siteName}`,
        headline: titulo,
        description: sector.descripcion,
        url,
        inLanguage: "es-ES",
        // Misma entidad que declara la portada (seo.ts).
        isPartOf: { "@id": websiteId() },
        about: { "@id": `${url}#service` },
      },
      {
        "@type": "Service",
        "@id": `${url}#service`,
        name: titulo,
        serviceType:
          "Recepción telefónica con inteligencia artificial y gestión de citas",
        provider: { "@id": organizationId() },
        areaServed: { "@type": "Country", name: "España" },
        audience: { "@type": "BusinessAudience", audienceType: sector.nombre },
        description: sector.descripcion,
        url,
        offers: {
          "@type": "AggregateOffer",
          lowPrice: PRECIO_MINIMO,
          highPrice: PRECIO_MAXIMO,
          priceCurrency: "EUR",
          offerCount: String(plans.length),
          url: absoluteUrl("/planes"),
        },
      },
      buildFaqPageStructuredData(sector.faqs),
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Inicio",
            item: absoluteUrl("/"),
          },
          { "@type": "ListItem", position: 2, name: sector.nombre, item: url },
        ],
      },
    ],
  };
}
