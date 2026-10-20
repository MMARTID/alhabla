#!/usr/bin/env node
/**
 * Avisa por IndexNow (Bing, Yandex, Seznam, Naver…) de las URLs del sitemap
 * de producción. Bing alimenta a ChatGPT Search y a Copilot, así que es la
 * vía más rápida de que una página nueva aparezca en esas respuestas. Google
 * no usa IndexNow: para Google, Search Console (reenviar el sitemap y pedir
 * la indexación de las páginas nuevas).
 *
 * La clave es pública por diseño: su fichero está en
 * public/36dd951327300353ad396b40d72dbd75.txt y IndexNow lo descarga para
 * comprobar que el sitio es nuestro.
 *
 * Uso, después de que Vercel publique:
 *   npm run seo:indexnow                       # todas las URLs del sitemap
 *   npm run seo:indexnow -- /planes /integraciones   # solo estas rutas
 */
const SITIO = "https://alhabla.ai";
const CLAVE = "36dd951327300353ad396b40d72dbd75";

async function urlsDelSitemap() {
  const r = await fetch(`${SITIO}/sitemap.xml`);
  if (!r.ok) throw new Error(`[IndexNow] sitemap: HTTP ${r.status}`);
  const xml = await r.text();
  return [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, "&"));
}

const rutas = process.argv.slice(2);
const urls = rutas.length ? rutas.map((r) => new URL(r, SITIO).toString()) : await urlsDelSitemap();

const r = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: "alhabla.ai", key: CLAVE, keyLocation: `${SITIO}/${CLAVE}.txt`, urlList: urls }),
});

// 200 = recibido; 202 = recibido, la clave se valida después.
console.log(`[IndexNow] ${urls.length} URL(s) → HTTP ${r.status} ${r.statusText}`);
if (r.status >= 400) {
  console.error(await r.text());
  process.exit(1);
}
