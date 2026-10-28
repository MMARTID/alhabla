import type { Metadata } from "next";
import { plans } from "@/lib/plans";

export const siteName = "Alhabla";
export const defaultTitle = "Alhabla: recepcionista de IA que contesta llamadas y reserva citas";
export const defaultDescription =
  "Alhabla es la recepcionista de IA de tu negocio: coge el teléfono cuando tú no puedes, reserva en tu calendario y confirma cada cita por WhatsApp.";

/** Rango de cuotas mensuales sin IVA, para los `AggregateOffer` del grafo. */
export const PRECIO_MINIMO = String(Math.min(...plans.map((plan) => plan.price)));
export const PRECIO_MAXIMO = String(Math.max(...plans.map((plan) => plan.price)));

const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

// Con respaldo (2026-10-22): sin la variable, absoluteUrl() devolvía rutas
// relativas y el sitemap dejaba de ser válido sin que nada fallara.
export const siteUrl = (rawSiteUrl || "https://alhabla.ai").replace(/\/$/, "");

export const seoKeywords = [
  // Categoría principal: «de IA», no «virtual» (decisión del 2026-10-20).
  "recepcionista de IA",
  "recepcionista con IA para negocios",
  "IA que contesta llamadas",
  "IA para atender llamadas",
  "asistente telefónico con IA",
  "reservar citas por teléfono con IA",
  "confirmación de citas por WhatsApp",
  "atención de llamadas fuera de horario",
  "integración con Google Calendar, Outlook e iCloud",
  siteName,
];

export function absoluteUrl(path = "/") {
  return new URL(path, siteUrl).toString();
}

/** Correo público (el del pie de la web). */
export const contactEmail = "hola@alhabla.ai";

/**
 * Imagen de Open Graph / Twitter de una página: cada ruta indexable tiene
 * su `opengraph-image.tsx` (portada, sectores, planes, blog, artículos,
 * legales) generado con la plantilla de lib/og/plantilla.tsx. La ruta de
 * fichero solo se hereda cuando la página no declara `openGraph`; como
 * todas lo hacen (título y canónica propios), la imagen se referencia aquí
 * explícitamente con la ruta de la propia página.
 */
export const ogImageAlt = "Alhabla — Recepción telefónica para negocios con cita previa";
export function ogImages(path = "/", alt = ogImageAlt) {
  const base = path === "/" ? "" : path.replace(/\/$/, "");
  return [{ url: absoluteUrl(`${base}/opengraph-image`), width: 1200, height: 630, alt }];
}

/**
 * Metadata de una página de valor (lib/paginas.ts): título, descripción,
 * canónica propia y OG/Twitter con la imagen de su `opengraph-image.tsx`.
 * El `title` lleva la plantilla «… | Alhabla» del layout raíz.
 */
export function metadataDePagina({ ruta, titulo, descripcion }: { ruta: string; titulo: string; descripcion: string }): Metadata {
  const tituloCompleto = `${titulo} | ${siteName}`;
  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: absoluteUrl(ruta) },
    openGraph: {
      type: "website",
      locale: "es_ES",
      url: absoluteUrl(ruta),
      siteName,
      title: tituloCompleto,
      description: descripcion,
      images: ogImages(ruta, tituloCompleto),
    },
    twitter: {
      card: "summary_large_image",
      title: tituloCompleto,
      description: descripcion,
      images: ogImages(ruta, tituloCompleto),
    },
  };
}

/** Identificadores estables del grafo: los nichos y el blog los referencian
 * con `isPartOf`/`publisher`, así que TODAS las páginas comparten la misma
 * entidad de organización y de sitio web. */
export const organizationId = () => `${absoluteUrl("/")}#organization`;
export const websiteId = () => `${absoluteUrl("/")}#website`;

export function organizationStructuredData() {
  return {
    "@type": "Organization",
    "@id": organizationId(),
    name: siteName,
    url: absoluteUrl("/"),
    logo: { "@type": "ImageObject", url: absoluteUrl("/icon.png"), width: 512, height: 512 },
    description: defaultDescription,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: contactEmail,
      availableLanguage: ["es"],
      areaServed: "ES",
    },
  } as const;
}

/** Migas para el grafo de cualquier página interior (Inicio → … → página). */
export function buildBreadcrumbStructuredData(items: readonly { name: string; path: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: [{ name: "Inicio", path: "/" }, ...items].map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  } as const;
}

export const landingStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    organizationStructuredData(),
    {
      "@type": "WebSite",
      "@id": websiteId(),
      name: siteName,
      url: absoluteUrl("/"),
      inLanguage: "es-ES",
      description: defaultDescription,
      publisher: { "@id": organizationId() },
    },
    {
      "@type": "SoftwareApplication",
      name: siteName,
      description:
        "Recepcionista de IA que contesta las llamadas de negocios con cita previa, reserva en su calendario de Google, Outlook o iCloud y confirma por WhatsApp.",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      // Lo que hace de verdad, comprobado contra el código el 2026-10-20
      // (la misma lista que «Qué hace distinto» de /llms.txt).
      featureList: [
        "Contesta las llamadas que el negocio no coge, con su número de siempre (desvío)",
        "Comprueba el hueco en Google Calendar, Outlook o iCloud antes de reservar",
        "Reparto de citas por especialidad de cada profesional",
        "Confirmación de la cita por WhatsApp y recordatorio con botones (Pro y Scale)",
        "Lista de espera: aviso por WhatsApp si se libera por una cancelación la hora que pidió el cliente",
        "El Gestor: el dueño cambia citas, horario, precios y equipo por WhatsApp, con notas de voz",
        "Ausencias del equipo: recoloca las citas y avisa a cada cliente, con la confirmación del dueño",
        "Castellano y siete idiomas más, y catalán, euskera o gallego según la zona",
        "Aviso de inteligencia artificial al descolgar y grabación solo con permiso",
      ],
      audience: {
        "@type": "Audience",
        audienceType: "Peluquerías, barberías, salones de uñas, centros de estética, fisioterapia, pestañas y cejas, spa y masajes, peluquería canina y otros negocios con cita previa",
      },
      url: absoluteUrl("/"),
      offers: {
        "@type": "AggregateOffer",
        lowPrice: PRECIO_MINIMO,
        highPrice: PRECIO_MAXIMO,
        priceCurrency: "EUR",
        offerCount: String(plans.length),
      },
    },
    {
      "@type": "Service",
      serviceType: "Recepcionista de IA para negocios con cita previa",
      provider: { "@id": organizationId() },
      areaServed: "ES",
      audience: {
        "@type": "Audience",
        audienceType: "Peluquerías, barberías, salones de uñas, centros de estética, fisioterapia, pestañas y cejas, spa y masajes y peluquería canina",
      },
      description:
        "Atiende las llamadas que el negocio no puede coger, con su número de siempre, y reserva la cita en su agenda real; el dueño gestiona los cambios por WhatsApp.",
      url: absoluteUrl("/"),
    },
  ],
} as const;

/**
 * Bloque FAQPage reutilizable: mismo formato para la portada (FAQ corta) y
 * cada landing de nicho (FAQ completa) — antes vivía duplicado inline. Sin
 * `@context` propio porque va anidado dentro de un `@graph` que ya lo
 * declara; para usarlo como `<script>` suelto hay que añadirlo aparte.
 */
export function buildFaqPageStructuredData(faqs: readonly { question: string; answer: string }[]) {
  return {
    "@type": "FAQPage",
    mainEntity: faqs.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  } as const;
}

/**
 * Metadata para páginas privadas (panel, login, registro, checkout...):
 * fuera del índice de Google y sin heredar canónicas ni OG del root layout.
 */
export const noindexMetadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
} as const;

// Next (16.4) escribe las entradas del sitemap en el XML tal cual, sin
// escapar. Las portadas de Unsplash llevan `?auto=format&fit=crop…`, y un `&`
// suelto deja el sitemap entero ilegible para Google («Error de análisis»,
// 0 páginas descubiertas).
export function escaparXml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
