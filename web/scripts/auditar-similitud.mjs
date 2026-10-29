#!/usr/bin/env node
/**
 * Auditoría de contenido duplicado entre las páginas del sitemap.
 *
 * Por qué (2026-10-20): de las 30 páginas sector × ciudad Google indexó 2,
 * y las 5 landings de sector compartían entre el 55 y el 60 % del texto. Un
 * buscador agrupa las páginas casi iguales y solo indexa una; lo que cuenta
 * es el contenido principal (`<main>`), no la cabecera ni el pie.
 *
 * Qué mide: para cada par de páginas del sitemap, la «contención» de su
 * texto principal — la parte de la página más corta que aparece tal cual en
 * la otra, en secuencias de 5 palabras. 0,5 = la mitad de una página está
 * copiada en otra.
 *
 * No cuenta lo marcado `aria-hidden="true"` (desde el 2026-10-29): las
 * maquetas del producto dentro de las escenas 3D (las pantallas del iPhone,
 * el panel del portátil, el chat de tu asistente) y las copias animadas de
 * los pasos son ilustración, la misma interfaz en la portada y en los ocho
 * sectores; la página misma dice que no son contenido. El texto que se lee
 * (preguntas, pasos, respuestas) sí cuenta.
 *
 * Uso (después de `npm run build`):
 *   npm run seo:similitud                 # falla si algún par ≥ 0,50
 *   UMBRAL=0.4 npm run seo:similitud      # más estricto
 *   BASE_URL=https://alhabla.ai npm run seo:similitud   # contra producción
 *
 * Lee el HTML prerenderizado de `.next/server/app` (todas las páginas de la
 * web son estáticas) o, con BASE_URL, descarga cada página.
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const UMBRAL = Number(process.env.UMBRAL ?? "0.5");
const AVISO = Math.min(UMBRAL, 0.4);
const BASE_URL = process.env.BASE_URL?.replace(/\/$/, "");
const N = 5;
const MIN_PALABRAS = 300;
const APP = path.join(process.cwd(), ".next", "server", "app");

async function leer(ruta) {
  if (BASE_URL) {
    const r = await fetch(`${BASE_URL}${ruta}`, { headers: { "user-agent": "alhabla-auditoria-similitud" } });
    if (!r.ok) throw new Error(`[Similitud] ${ruta}: HTTP ${r.status}`);
    return r.text();
  }
  const fichero = path.join(APP, ruta === "/" ? "index.html" : `${ruta.slice(1)}.html`);
  if (!existsSync(fichero)) throw new Error(`[Similitud] No está prerenderizada: ${ruta} (${fichero}). ¿Has hecho npm run build?`);
  return readFile(fichero, "utf8");
}

async function rutasDelSitemap() {
  const xml = BASE_URL
    ? await (await fetch(`${BASE_URL}/sitemap.xml`)).text()
    : await readFile(path.join(APP, "sitemap.xml.body"), "utf8");
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => new URL(m[1].replace(/&amp;/g, "&")).pathname)
    // Las <loc> de <image:image> también son <loc>: solo las páginas.
    .filter((p) => !/\.(jpe?g|png|webp|avif)$/i.test(p) && !p.startsWith("/_next/"))
    .filter((p, i, todas) => todas.indexOf(p) === i);
}

const IGNORAR = new Set(["script", "style", "noscript", "svg", "template"]);
const VACIOS = new Set(["br", "img", "meta", "link", "input", "hr", "source", "wbr", "area", "col", "embed", "track"]);

/** Texto de `<main>` sin `nav`, `header`, `footer` ni lo `aria-hidden`. */
function textoPrincipal(html) {
  const pila = [];
  const trozos = [];
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*?)(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[5] !== undefined) {
      if (pila.some((e) => e.tag === "main") && !pila.some((e) => e.oculto || IGNORAR.has(e.tag) || e.tag === "nav" || e.tag === "header" || e.tag === "footer")) {
        trozos.push(m[5]);
      }
      continue;
    }
    if (!m[2]) continue;
    const tag = m[2].toLowerCase();
    if (m[1]) {
      const i = pila.findLastIndex((e) => e.tag === tag);
      if (i !== -1) pila.length = i;
    } else if (!m[4] && !VACIOS.has(tag)) {
      pila.push({ tag, oculto: /\saria-hidden="true"/.test(m[3]) });
    }
  }
  return trozos
    .join(" ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&[a-z]+;|&#\d+;/g, " ");
}

function palabras(texto) {
  return texto.toLowerCase().match(/[a-záéíóúüñç0-9€%]+/g) ?? [];
}

function tejas(ps) {
  const s = new Set();
  for (let i = 0; i + N <= ps.length; i++) s.add(ps.slice(i, i + N).join(" "));
  return s;
}

const rutas = await rutasDelSitemap();
const paginas = [];
for (const ruta of rutas) {
  const ps = palabras(textoPrincipal(await leer(ruta)));
  paginas.push({ ruta, palabras: ps.length, tejas: tejas(ps) });
}

const pares = [];
for (let i = 0; i < paginas.length; i++) {
  for (let j = i + 1; j < paginas.length; j++) {
    const a = paginas[i];
    const b = paginas[j];
    if (!a.tejas.size || !b.tejas.size) continue;
    const [menor, mayor] = a.tejas.size <= b.tejas.size ? [a.tejas, b.tejas] : [b.tejas, a.tejas];
    let comunes = 0;
    for (const t of menor) if (mayor.has(t)) comunes++;
    pares.push({ a: a.ruta, b: b.ruta, contencion: comunes / menor.size });
  }
}
pares.sort((x, y) => y.contencion - x.contencion);

console.log(`[Similitud] ${paginas.length} páginas del sitemap, umbral ${UMBRAL.toFixed(2)} (aviso desde ${AVISO.toFixed(2)})\n`);

const finas = paginas.filter((p) => p.palabras < MIN_PALABRAS && !p.ruta.startsWith("/legal"));
if (finas.length) {
  console.log(`Páginas con menos de ${MIN_PALABRAS} palabras de contenido principal:`);
  for (const p of finas) console.log(`  ${String(p.palabras).padStart(5)}  ${p.ruta}`);
  console.log("");
}

const altos = pares.filter((p) => p.contencion >= AVISO);
console.log(altos.length ? "Pares más parecidos:" : "Ningún par llega al aviso.");
for (const p of altos.slice(0, 40)) {
  const marca = p.contencion >= UMBRAL ? "✗" : "!";
  console.log(`  ${marca} ${p.contencion.toFixed(2)}  ${p.a}  ↔  ${p.b}`);
}

const maximo = new Map();
for (const p of pares) {
  for (const [r, otra] of [[p.a, p.b], [p.b, p.a]]) {
    if (!maximo.has(r) || maximo.get(r).contencion < p.contencion) maximo.set(r, { contencion: p.contencion, otra });
  }
}
console.log("\nParecido máximo de cada página:");
for (const pg of paginas) {
  const m = maximo.get(pg.ruta);
  console.log(`  ${(m?.contencion ?? 0).toFixed(2)}  ${String(pg.palabras).padStart(5)} palabras  ${pg.ruta}${m ? `  (con ${m.otra})` : ""}`);
}

const fallos = pares.filter((p) => p.contencion >= UMBRAL);
if (fallos.length) {
  console.error(`\n[Similitud] ${fallos.length} par(es) comparten el ${Math.round(UMBRAL * 100)} % o más del texto principal. Dale contenido propio a la página más corta de cada par.`);
  process.exit(1);
}
console.log("\n[Similitud] OK");
