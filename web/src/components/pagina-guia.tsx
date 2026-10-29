import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, ExternalLink, Info, Lightbulb, TriangleAlert, type LucideIcon } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TRIAL_DAYS, TRIAL_REASSURANCE } from "@/lib/plans";
import { paginaDe } from "@/lib/paginas";
import {
  absoluteUrl,
  buildBreadcrumbStructuredData,
  buildFaqPageStructuredData,
  organizationId,
  websiteId,
} from "@/lib/seo";

/**
 * Plantilla de las páginas de valor de alhabla.ai que no son landings de
 * sector ni artículos del blog: integraciones, desvío por operador,
 * comparativas, herramientas, guías y empresa (lib/paginas.ts).
 *
 * Da la estructura que repiten todas (migas, cabecera, FAQ, páginas
 * relacionadas, cierre, JSON-LD) y deja el cuerpo a cada página, que es lo
 * que tiene que ser único: la plantilla en sí no lleva texto de relleno, así
 * que no sube el parecido entre páginas (scripts/auditar-similitud.mjs).
 */

export type Miga = { name: string; path: string };
export type Pregunta = { question: string; answer: string };
export type Relacionada = { href: string; titulo: string; texto?: string };
export type ImagenDeCabecera = {
  src: string;
  alt: string;
  ancho: number;
  alto: number;
  /** Autor y enlace de la foto de banco (Unsplash o Pexels). */
  credito?: { autor: string; url: string; banco: "Unsplash" | "Pexels" };
};

const FECHA = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export function fechaLarga(iso: string) {
  return FECHA.format(new Date(`${iso}T12:00:00Z`));
}

type Props = {
  ruta: string;
  /** Migas sin «Inicio», que se añade sola. La última es la propia página. */
  migas: Miga[];
  etiqueta: { icono: LucideIcon; texto: string };
  titulo: string;
  entradilla: ReactNode;
  /** Texto plano de la entradilla para el JSON-LD (la de metadata). */
  descripcion: string;
  /** Foto de cabecera opcional (de banco, con su crédito). Por defecto
   * ninguna: las páginas enseñan el producto con `pieza`. */
  imagen?: ImagenDeCabecera;
  /** Una pieza del producto (el chat con tu asistente, la cita en el
   * calendario, el WhatsApp que recibe el cliente) que va junto a la
   * cabecera en lugar de la foto: con ella no se pinta foto ninguna. */
  pieza?: ReactNode;
  cta?: { texto: string; href: string } | null;
  ctaSecundario?: { texto: string; href: string };
  /** Identificador de la página en los eventos de clic (`data-ubicacion`). */
  ubicacion: string;
  children: ReactNode;
  faqs?: Pregunta[];
  tituloFaqs?: string;
  relacionadas?: Relacionada[];
  cierre?: string;
  /** Nodos extra del grafo (HowTo, SoftwareApplication, VideoObject…). */
  grafo?: object[];
  /** Tipo de la página en schema.org. */
  tipo?: "WebPage" | "Article" | "CollectionPage" | "AboutPage" | "ContactPage";
};

export function PaginaGuia({
  ruta,
  migas,
  etiqueta,
  titulo,
  entradilla,
  descripcion,
  imagen: imagenPropia,
  pieza,
  cta = { texto: `Probar ${TRIAL_DAYS} días gratis`, href: "/planes" },
  ctaSecundario,
  ubicacion,
  children,
  faqs,
  tituloFaqs = "Preguntas frecuentes",
  relacionadas,
  cierre,
  grafo = [],
  tipo = "WebPage",
}: Props) {
  const { actualizado } = paginaDe(ruta);
  const imagen = pieza ? undefined : imagenPropia;
  const Icono = etiqueta.icono;
  const url = absoluteUrl(ruta);

  const nodoPrincipal: Record<string, unknown> = {
    "@type": tipo,
    "@id": `${url}#webpage`,
    name: titulo,
    headline: tipo === "Article" ? titulo : undefined,
    description: descripcion,
    url,
    inLanguage: "es-ES",
    isPartOf: { "@id": websiteId() },
    publisher: { "@id": organizationId() },
    ...(actualizado ? { dateModified: actualizado } : {}),
    ...(imagen ? { primaryImageOfPage: { "@type": "ImageObject", url: absoluteUrl(imagen.src), caption: imagen.alt } } : {}),
  };

  const datosEstructurados = {
    "@context": "https://schema.org",
    "@graph": [
      nodoPrincipal,
      buildBreadcrumbStructuredData(migas),
      ...(faqs?.length ? [buildFaqPageStructuredData(faqs)] : []),
      ...grafo,
    ],
  };

  return (
    <>
      <SiteHeader />
      <main id="main-content" className="min-h-screen bg-lienzo text-tinta">
        <nav aria-label="Migas de pan" className="mx-auto max-w-5xl px-4 pt-6 text-sm text-muted sm:px-6 lg:px-8">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/" className="hover:text-tinta">
                Inicio
              </Link>
            </li>
            {migas.map((miga, i) => (
              <li key={miga.path} className="flex items-center gap-1.5">
                <span aria-hidden="true">/</span>
                {i === migas.length - 1 ? (
                  <span aria-current="page" className="text-tinta">
                    {miga.name}
                  </span>
                ) : (
                  <Link href={miga.path} className="hover:text-tinta">
                    {miga.name}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </nav>

        <header className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <div
            className={
              pieza ? "grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] lg:gap-12" : undefined
            }
          >
            <div>
              <span className="badge-soft gap-2">
                <Icono className="h-3.5 w-3.5" aria-hidden="true" />
                {etiqueta.texto}
              </span>
              <h1 className="mt-5 max-w-3xl text-balance text-4xl font-black leading-[1.05] tracking-[-0.03em] sm:text-5xl">
                {titulo}
              </h1>
              <div className="mt-5 max-w-2xl space-y-4 text-lg leading-8 text-muted">{entradilla}</div>
              {actualizado ? (
                <p className="mt-4 text-sm text-tenue">
                  Actualizado el <time dateTime={actualizado}>{fechaLarga(actualizado)}</time>
                </p>
              ) : null}
              {cta || ctaSecundario ? (
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  {cta ? (
                    <Link href={cta.href} className="btn-primary h-12 px-6" data-evento="clic_probar" data-ubicacion={ubicacion}>
                      {cta.texto} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  ) : null}
                  {ctaSecundario ? (
                    <Link href={ctaSecundario.href} className="btn-secondary h-12 px-6">
                      {ctaSecundario.texto}
                    </Link>
                  ) : null}
                </div>
              ) : null}
              {cta?.href === "/planes" ? <p className="mt-3 text-sm text-muted">{TRIAL_REASSURANCE}</p> : null}
            </div>
            {pieza ? <div className="lg:pt-2">{pieza}</div> : null}
          </div>
          {imagen ? (
            <figure className="mt-10">
              <Image
                src={imagen.src}
                alt={imagen.alt}
                width={imagen.ancho}
                height={imagen.alto}
                priority
                sizes="(min-width: 1024px) 960px, 100vw"
                className="aspect-[16/7] w-full rounded-3xl border border-linea object-cover"
              />
              {imagen.credito ? (
                <figcaption className="mt-2 text-xs text-tenue">
                  Foto: <a href={imagen.credito.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">{imagen.credito.autor}</a> en {imagen.credito.banco}
                </figcaption>
              ) : null}
            </figure>
          ) : null}
        </header>

        {children}

        {faqs?.length ? (
          <section className="border-t border-linea py-14 sm:py-16">
            <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
              <h2 className="text-2xl font-black tracking-tight sm:text-3xl">{tituloFaqs}</h2>
              <div className="mt-8 grid items-start gap-3 sm:grid-cols-2">
                {faqs.map(({ question, answer }) => (
                  <details key={question} className="group rounded-2xl border border-linea bg-lienzo p-5">
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-sm font-semibold leading-6 text-tinta marker:content-none">
                      {question}
                      <span className="mt-1 text-lg leading-none text-morado transition group-open:rotate-45" aria-hidden="true">
                        +
                      </span>
                    </summary>
                    <p className="mt-3 border-t border-linea pt-3 text-sm leading-6 text-muted">{answer}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {relacionadas?.length ? (
          <section className="border-t border-linea bg-relleno py-14 sm:py-16">
            <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
              <h2 className="text-xl font-bold text-tinta">Sigue leyendo</h2>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {relacionadas.map(({ href, titulo: t, texto }) => (
                  <li key={href}>
                    <Link href={href} className="group flex h-full flex-col rounded-2xl border border-linea bg-lienzo p-5 transition hover:border-lavado-borde">
                      <span className="flex items-start justify-between gap-3 text-sm font-semibold leading-6 text-tinta">
                        {t}
                        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-morado transition group-hover:translate-x-0.5" aria-hidden="true" />
                      </span>
                      {texto ? <span className="mt-1 text-sm leading-6 text-muted">{texto}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        {cierre ? (
          <section className="bg-oscuro text-white">
            <div className="mx-auto flex max-w-5xl flex-col items-start gap-6 px-4 py-14 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
              <h2 className="max-w-xl text-balance text-3xl font-black tracking-tight sm:text-4xl">{cierre}</h2>
              <Link href="/planes" className="btn-purple" data-evento="clic_probar" data-ubicacion={`${ubicacion}_cierre`}>
                Empezar ahora <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </section>
        ) : null}
      </main>
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datosEstructurados) }} />
    </>
  );
}

/* ----------------------------------------------------------------------- */
/* Bloques del cuerpo                                                       */
/* ----------------------------------------------------------------------- */

export function Seccion({
  id,
  titulo,
  entradilla,
  children,
  fondo = false,
  estrecha = false,
}: {
  id?: string;
  titulo: string;
  entradilla?: ReactNode;
  children?: ReactNode;
  /** Fondo gris suave con bordes, para alternar secciones. */
  fondo?: boolean;
  /** Columna de lectura (texto largo) en vez del ancho completo. */
  estrecha?: boolean;
}) {
  return (
    <section id={id} className={`scroll-m-20 py-12 sm:py-16 ${fondo ? "border-y border-linea bg-relleno" : ""}`}>
      <div className={`mx-auto px-4 sm:px-6 lg:px-8 ${estrecha ? "max-w-3xl" : "max-w-5xl"}`}>
        <h2 className="max-w-3xl text-balance text-2xl font-black tracking-tight sm:text-3xl">{titulo}</h2>
        {entradilla ? <div className="mt-3 max-w-2xl space-y-3 text-base leading-7 text-muted">{entradilla}</div> : null}
        {children ? <div className="mt-8">{children}</div> : null}
      </div>
    </section>
  );
}

/** Texto corrido dentro de una sección: párrafos con el ritmo del blog. */
export function Texto({ children }: { children: ReactNode }) {
  return <div className="max-w-3xl space-y-4 text-base leading-7 text-apagado [&_a]:font-semibold [&_a]:text-morado-tinta [&_a]:underline [&_a]:underline-offset-4 [&_strong]:font-semibold [&_strong]:text-tinta">{children}</div>;
}

export function Tarjetas({
  items,
  columnas = 3,
}: {
  items: { titulo: string; texto: ReactNode; icono?: LucideIcon; antetitulo?: string }[];
  columnas?: 2 | 3;
}) {
  return (
    <ul className={`grid gap-4 ${columnas === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2"}`}>
      {items.map(({ titulo, texto, icono: Icono, antetitulo }) => (
        <li key={titulo} className="panel p-6">
          {Icono ? (
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-lavado text-morado">
              <Icono className="h-5 w-5" aria-hidden="true" />
            </span>
          ) : null}
          {antetitulo ? <p className={`${Icono ? "mt-4" : ""} text-sm font-semibold text-morado-tinta`}>{antetitulo}</p> : null}
          <h3 className={`${Icono || antetitulo ? "mt-2" : ""} text-lg font-bold text-tinta`}>{titulo}</h3>
          <div className="mt-2 text-sm leading-6 text-muted">{texto}</div>
        </li>
      ))}
    </ul>
  );
}

export function ListaCheck({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-3 text-base leading-7 text-tinta">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3">
          <Check className="mt-1.5 h-4 w-4 shrink-0 text-morado" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function Pasos({ pasos }: { pasos: { titulo: string; texto: ReactNode }[] }) {
  return (
    <ol className="grid gap-4">
      {pasos.map(({ titulo, texto }, i) => (
        <li key={titulo} className="flex gap-4 rounded-2xl border border-linea bg-lienzo p-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lavado text-sm font-bold text-morado-tinta">
            {i + 1}
          </span>
          <div>
            <h3 className="text-base font-bold text-tinta">{titulo}</h3>
            <div className="mt-1 text-sm leading-6 text-muted [&_code]:rounded [&_code]:bg-relleno-fuerte [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-tinta">
              {texto}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Tabla({
  cabecera,
  filas,
  nota,
  resaltarPrimeraColumna = true,
  destacada,
}: {
  cabecera: string[];
  filas: ReactNode[][];
  nota?: ReactNode;
  resaltarPrimeraColumna?: boolean;
  /** Índice de la columna que va resaltada (la de Alhabla en una comparativa). */
  destacada?: number;
}) {
  // Con cuatro columnas o más (ElevenAgents y Reception frente a Alhabla), a
  // 560 px cada celda se queda en una palabra por línea: mejor desplazar.
  const anchoMinimo = cabecera.length > 3 ? "min-w-[760px]" : "min-w-[560px]";

  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-linea">
        <table className={`w-full ${anchoMinimo} border-collapse text-left text-sm`}>
          <thead>
            <tr className="bg-relleno">
              {cabecera.map((c, i) => (
                <th
                  key={c}
                  scope="col"
                  className={`border-b border-linea px-4 py-3 font-semibold ${i === destacada ? "bg-lavado text-morado-tinta" : "text-apagado"}`}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila, i) => (
              <tr key={i} className="border-b border-linea-suave last:border-0">
                {fila.map((celda, j) =>
                  j === 0 && resaltarPrimeraColumna ? (
                    <th key={j} scope="row" className="px-4 py-3 align-top font-semibold text-tinta">
                      {celda}
                    </th>
                  ) : (
                    <td key={j} className={`px-4 py-3 align-top leading-6 text-apagado ${j === destacada ? "bg-lavado/50 text-tinta" : ""}`}>
                      {celda}
                    </td>
                  )
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {nota ? <p className="mt-3 max-w-3xl text-xs leading-5 text-muted">{nota}</p> : null}
    </div>
  );
}

/** Una conversación de ejemplo, turno a turno (recepcionista a la izquierda). */
export function Conversacion({
  turnos,
  pie = "Ejemplo ilustrativo; el negocio y los nombres son inventados.",
  etiqueta,
}: {
  turnos: { quien: "recepcionista" | "cliente" | "dueno"; texto: string }[];
  pie?: string;
  etiqueta: string;
}) {
  return (
    <figure className="panel p-6" aria-label={etiqueta}>
      <ol className="space-y-3 text-sm leading-6">
        {turnos.map(({ quien, texto }, i) => (
          <li
            key={i}
            className={
              quien === "recepcionista"
                ? "mr-8 rounded-2xl bg-lavado px-4 py-3 text-tinta"
                : "ml-8 rounded-2xl border border-linea px-4 py-3 text-tinta"
            }
          >
            <span className="sr-only">{quien === "recepcionista" ? "Recepcionista: " : quien === "dueno" ? "Dueño: " : "Cliente: "}</span>
            {texto}
          </li>
        ))}
      </ol>
      <figcaption className="mt-4 text-xs leading-5 text-muted">{pie}</figcaption>
    </figure>
  );
}

const ESTILO_NOTA = {
  consejo: { icono: Lightbulb, clase: "border-lavado-borde bg-lavado", color: "text-morado-tinta" },
  importante: { icono: TriangleAlert, clase: "border-aviso-borde bg-aviso-fondo", color: "text-aviso" },
  info: { icono: Info, clase: "border-linea bg-relleno", color: "text-apagado" },
} as const;

export function Nota({ tipo = "info", titulo, children }: { tipo?: keyof typeof ESTILO_NOTA; titulo: string; children: ReactNode }) {
  const { icono: Icono, clase, color } = ESTILO_NOTA[tipo];
  return (
    <aside className={`flex gap-3 rounded-2xl border p-5 ${clase}`}>
      <Icono className={`mt-0.5 h-5 w-5 shrink-0 ${color}`} aria-hidden="true" />
      <div>
        <p className={`text-sm font-bold ${color}`}>{titulo}</p>
        <div className="mt-1 text-sm leading-6 text-tinta">{children}</div>
      </div>
    </aside>
  );
}

/** Las fuentes de una página, con fecha de consulta: lo que la hace citable. */
export function Fuentes({ fuentes, consultadas }: { fuentes: { nombre: string; url: string }[]; consultadas: string }) {
  return (
    <section className="border-t border-linea py-10">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-base font-bold text-tinta">Fuentes</h2>
        <p className="mt-1 text-xs text-muted">Consultadas el {fechaLarga(consultadas)}.</p>
        <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          {fuentes.map(({ nombre, url }) => (
            <li key={url}>
              <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1.5 text-apagado underline underline-offset-4 hover:text-tinta">
                {nombre}
                <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Índice de una sección: tarjetas a sus páginas hijas, con su resumen. */
export function IndiceDePaginas({ paginas }: { paginas: { ruta: string; nombre: string; resumen: string }[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {paginas.map(({ ruta, nombre, resumen }) => (
        <li key={ruta}>
          <Link href={ruta} className="group flex h-full flex-col rounded-3xl border border-linea bg-lienzo p-6 transition hover:border-lavado-borde">
            <span className="flex items-start justify-between gap-3 text-lg font-bold text-tinta">
              {nombre}
              <ArrowRight className="mt-1.5 h-4 w-4 shrink-0 text-morado transition group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
            <span className="mt-2 text-sm leading-6 text-muted">{resumen}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* ----------------------------------------------------------------------- */
/* Piezas del producto para la cabecera (`pieza`)                           */
/* ----------------------------------------------------------------------- */

/** Alto de una hora en la vista de día de `CitaEnElCalendario`, en rem. */
const ALTO_HORA = 2.75;

function horaEnTexto(hora: number) {
  const minutos = Math.round((hora % 1) * 60);
  return `${Math.floor(hora)}:${String(minutos).padStart(2, "0")}`;
}

type Tramo = { inicio: number; fin: number; titulo: string };

/**
 * La cita que apunta la recepcionista, como se ve en el calendario del
 * negocio: una franja del día con lo que ya estaba apuntado (que cuenta
 * como ocupado) y la cita nueva con su descripción. El título («Servicio —
 * Cliente») y las líneas de la descripción son los que escribe Alhabla
 * (backend/src/adapters/calendar/eventoDeCalendario.ts).
 */
export function CitaEnElCalendario({
  calendario,
  dia,
  desde,
  hasta,
  ocupado,
  cita,
  pie = "Ejemplo; el negocio y los nombres son inventados.",
}: {
  calendario: { icono: ReactNode; nombre: string };
  /** «Jueves, 5 de noviembre». */
  dia: string;
  /** Primera y última hora de la franja (16 → 16:00). */
  desde: number;
  hasta: number;
  /** Lo que ya tenías apuntado a mano: esas horas no se ofrecen. */
  ocupado?: Tramo;
  cita: Tramo & { detalle: [string, string][] };
  pie?: string;
}) {
  const horas = Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);
  const posicion = ({ inicio, fin }: Tramo) => ({
    top: `${(inicio - desde) * ALTO_HORA}rem`,
    height: `${(fin - inicio) * ALTO_HORA}rem`,
  });
  return (
    <figure>
      <div className="overflow-hidden rounded-3xl border border-linea bg-superficie">
        <div className="flex items-center gap-3 border-b border-linea bg-relleno px-5 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-linea bg-superficie">
            {calendario.icono}
          </span>
          <p className="min-w-0 text-sm font-semibold text-tinta">{calendario.nombre}</p>
          <p className="ml-auto text-xs text-apagado">{dia}</p>
        </div>
        <div className="px-5 pb-5 pt-4">
          <div className="relative" style={{ height: `${(hasta - desde) * ALTO_HORA}rem` }}>
            {horas.map((hora) => (
              <div
                key={hora}
                className="absolute inset-x-0 flex items-center gap-3"
                style={{ top: `${(hora - desde) * ALTO_HORA}rem`, transform: "translateY(-50%)" }}
                aria-hidden="true"
              >
                <span className="w-10 text-right text-xs tabular-nums text-tenue">{horaEnTexto(hora)}</span>
                <span className="h-px flex-1 bg-linea-suave" />
              </div>
            ))}
            {ocupado ? (
              <div
                className="absolute left-[3.25rem] right-0 rounded-xl border border-linea bg-relleno-fuerte px-3 py-1.5 text-xs text-apagado"
                style={posicion(ocupado)}
              >
                <span className="font-semibold text-tinta">{ocupado.titulo}</span> · {horaEnTexto(ocupado.inicio)}
              </div>
            ) : null}
            <div
              className="absolute left-[3.25rem] right-0 rounded-xl border border-lavado-borde bg-lavado px-3 py-2"
              style={posicion(cita)}
            >
              <p className="text-sm font-bold leading-5 text-morado-tinta">{cita.titulo}</p>
              <p className="text-xs tabular-nums text-morado-tinta">
                {horaEnTexto(cita.inicio)} – {horaEnTexto(cita.fin)}
              </p>
            </div>
          </div>
          <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t border-linea-suave pt-4 text-sm leading-6">
            {cita.detalle.map(([etiqueta, valor]) => (
              <div key={etiqueta} className="contents">
                <dt className="text-apagado">{etiqueta}</dt>
                <dd className="text-tinta">{valor}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <figcaption className="mt-3 px-1 text-xs leading-5 text-tenue">{pie}</figcaption>
    </figure>
  );
}
