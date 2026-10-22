import type { MetadataRoute } from "next";

// La app no se indexa: todo lo público está en la web (alhabla.ai). Pero se
// deja RASTREAR (2026-10-22): con `Disallow: /` Google y Bing no podían leer
// el `noindex` de cada página (layout.tsx y la cabecera X-Robots-Tag de
// next.config.mjs), así que app.alhabla.ai/login salía en Bing al buscar
// «alhabla» sin descripción y Search Console avisaba de «Bloqueada por
// robots.txt». Rastrear + noindex es lo que la saca de los resultados.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
  };
}
