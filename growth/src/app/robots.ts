import type { MetadataRoute } from "next";

// Como en la app (frontend/src/app/robots.ts): se deja RASTREAR y se pide
// `noindex`. Con `Disallow: /`, Google y Bing no pueden leer el `noindex` y el
// subdominio acaba en los resultados sin descripción (pasó con la app el
// 2026-10-22). La propiedad de Search Console es de dominio y cubre este
// subdominio.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
  };
}
