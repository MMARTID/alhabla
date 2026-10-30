/** @type {import('next').NextConfig} */
const enProduccion = process.env.NODE_ENV === "production";

const nextConfig = {
  // La raíz del repo tiene su propio package-lock.json (Playwright) y, desde
  // Next 15, eso hace que Next tome el repo entero como raíz del proyecto.
  // El dashboard de Growth es su propio proyecto de Vercel con root `growth`:
  // la raíz es esta carpeta, para Turbopack y para el trazado de ficheros.
  turbopack: { root: import.meta.dirname },
  outputFileTracingRoot: import.meta.dirname,
  // `next dev` escribe un AGENTS.md con reglas genéricas cuando detecta a un
  // agente de código. La documentación técnica del repo es la de la raíz.
  agentRules: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Nada de esto se indexa. Va con robots.txt abierto (app/robots.ts):
          // con `Disallow` los buscadores no pueden leer el `noindex` (lo que
          // pasó con la app el 2026-10-22), y la propiedad de Search Console
          // es de dominio, así que cubre este subdominio.
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          // Botones de aprobar: que nadie pueda enmarcar el panel en otra web
          // y hacer clic por encima (clickjacking).
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Sin Cross-Origin-Opener-Policy a propósito: el inicio de sesión
          // con Google puede abrirse en una ventana emergente y `same-origin`
          // a secas la rompería.
        ],
      },
    ];
  },
  async rewrites() {
    // En desarrollo, sin NEXT_PUBLIC_API_BASE_URL, el navegador habla con su
    // propio origen y Next reenvía al backend local (sin CORS). En producción
    // la variable es obligatoria (src/lib/config.ts) y no hay proxy a
    // localhost.
    if (enProduccion) return [];
    return [
      {
        source: "/api/backend/:path*",
        destination: "http://localhost:3000/:path*",
      },
    ];
  },
};

export default nextConfig;
