import Link from "next/link";
import {
  ArrowRight,
  Check,
  Lightbulb,
  AlertTriangle,
  MessageCircle,
  MessageSquareQuote,
} from "lucide-react";
import { BotonCopiar } from "@/components/blog/boton-copiar";
import { nicheLandings, type NicheSlug } from "@/lib/niche-landings";

/**
 * Bloques de marca que se insertan desde el editor del blog (keystatic.config
 * › `bloquesDelEditor`) y que MDX renderiza aquí con los componentes reales
 * de la web. Mismo lenguaje visual que las landings: paneles redondeados,
 * lavado morado, iconos Lucide en contenedor rounded-xl. En el .mdx quedan
 * como etiquetas JSX (`<Cta … />`), así que también se pueden escribir a mano.
 */

const DESTINOS: Record<string, { href: string; texto: string }> = {
  planes: { href: "/planes", texto: "Ver planes" },
  demo: { href: "/#demo", texto: "Escuchar la demo" },
  como_funciona: { href: "/#como-funciona", texto: "Ver cómo funciona" },
  peluqueria: { href: "/peluqueria", texto: "Alhabla para peluquerías" },
  barberia: { href: "/barberia", texto: "Alhabla para barberías" },
  "centro-de-estetica": {
    href: "/centro-de-estetica",
    texto: "Alhabla para centros de estética",
  },
  "salon-de-unas": {
    href: "/salon-de-unas",
    texto: "Alhabla para salones de uñas",
  },
  fisioterapia: { href: "/fisioterapia", texto: "Alhabla para fisioterapia" },
  "desvio-de-llamadas": {
    href: "/desvio-de-llamadas",
    texto: "Ver cómo se desvía con tu operador",
  },
  "agenda-por-whatsapp": {
    href: "/agenda-por-whatsapp",
    texto: "Ver tu asistente por WhatsApp",
  },
};

export function Cta({
  titulo,
  texto,
  destino = "planes",
  boton,
}: {
  titulo: string;
  texto?: string;
  destino?: string;
  boton?: string;
}) {
  const d = DESTINOS[destino] ?? DESTINOS.planes;
  return (
    <aside className="not-prose my-10 rounded-3xl border border-[#ddd6fe] bg-[#f3eeff] p-6 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6d28d9]">
        Alhabla
      </p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-[#0a0a0a]">
        {titulo}
      </p>
      {texto ? (
        <p className="mt-2 text-base leading-7 text-muted">{texto}</p>
      ) : null}
      <Link
        href={d.href}
        className="btn-primary mt-5 inline-flex px-6"
        {...(d.href === "/planes"
          ? { "data-evento": "clic_probar", "data-ubicacion": "blog_cta" }
          : {})}
      >
        {boton || d.texto}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </aside>
  );
}

export function Dato({
  cifra,
  texto,
  fuente,
  fuenteUrl,
}: {
  cifra: string;
  texto: string;
  fuente?: string;
  fuenteUrl?: string;
}) {
  return (
    <figure className="not-prose my-8 rounded-3xl border border-[#e5e5e5] bg-white p-6 sm:p-8">
      <p className="text-5xl font-extrabold tracking-[-0.03em] text-[#0a0a0a] sm:text-6xl">
        {cifra}
      </p>
      <p className="mt-3 text-base leading-7 text-[#27272a]">{texto}</p>
      {fuente ? (
        <figcaption className="mt-3 text-xs text-muted">
          Fuente:{" "}
          {fuenteUrl ? (
            <a
              href={fuenteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              {fuente}
            </a>
          ) : (
            fuente
          )}
        </figcaption>
      ) : null}
    </figure>
  );
}

const AVISOS = {
  consejo: {
    Icon: Lightbulb,
    etiqueta: "Consejo",
    borde: "border-[#ddd6fe]",
    fondo: "bg-[#f3eeff]",
    color: "text-[#6d28d9]",
  },
  importante: {
    Icon: AlertTriangle,
    etiqueta: "Importante",
    borde: "border-[#f0dfa8]",
    fondo: "bg-[#fef8e7]",
    color: "text-[#9f7a15]",
  },
  ejemplo: {
    Icon: MessageSquareQuote,
    etiqueta: "Ejemplo real",
    borde: "border-[#e5e5e5]",
    fondo: "bg-[#fafafa]",
    color: "text-[#52525b]",
  },
} as const;

export function Aviso({
  tipo = "consejo",
  titulo,
  children,
}: {
  tipo?: keyof typeof AVISOS;
  titulo?: string;
  children?: React.ReactNode;
}) {
  const a = AVISOS[tipo] ?? AVISOS.consejo;
  return (
    <aside
      className={`not-prose my-8 flex gap-4 rounded-2xl border ${a.borde} ${a.fondo} p-5`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white ${a.color}`}
      >
        <a.Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 text-sm leading-6 text-[#27272a]">
        <p
          className={`text-xs font-semibold uppercase tracking-[0.12em] ${a.color}`}
        >
          {titulo || a.etiqueta}
        </p>
        <div className="mt-1 space-y-2 [&_p]:m-0">{children}</div>
      </div>
    </aside>
  );
}

export function Pasos({
  pasos = [],
}: {
  pasos?: { titulo: string; texto?: string }[];
}) {
  return (
    <ol className="not-prose my-8 space-y-3">
      {pasos.map((p, i) => (
        <li
          key={i}
          className="flex gap-4 rounded-2xl border border-[#e5e5e5] bg-white p-5"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0a0a0a] text-sm font-bold text-white">
            {i + 1}
          </span>
          <div>
            <p className="font-semibold text-[#0a0a0a]">{p.titulo}</p>
            {p.texto ? (
              <p className="mt-1 text-sm leading-6 text-muted">{p.texto}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Faq({
  preguntas = [],
}: {
  preguntas?: { pregunta: string; respuesta: string }[];
}) {
  return (
    <div className="not-prose my-8 divide-y divide-[#e5e5e5] overflow-hidden rounded-3xl border border-[#e5e5e5]">
      {preguntas.map((p, i) => (
        <details key={i} className="group p-5 open:bg-[#fafafa]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-[#0a0a0a]">
            {p.pregunta}
            <span
              className="text-[#8b5cf6] transition group-open:rotate-45"
              aria-hidden="true"
            >
              +
            </span>
          </summary>
          <p className="mt-3 text-sm leading-6 text-muted">{p.respuesta}</p>
        </details>
      ))}
    </div>
  );
}

type AutorMensaje = "negocio" | "alhabla" | "cliente";

const ETIQUETA_AUTOR: Record<AutorMensaje, string> = {
  negocio: "El negocio",
  alhabla: "Alhabla",
  cliente: "El cliente",
};

/**
 * Conversación simulada de WhatsApp. Sirve para enseñar el canal del dueño
 * («Marta está de baja hoy» → propuesta → confirmación) y los mensajes al
 * cliente (confirmación, recordatorio, hueco libre) con la voz real del
 * producto. Burbujas del negocio en tinta, las de Alhabla en lavado morado
 * y las del cliente en blanco con borde.
 */
export function ChatWhatsApp({
  titulo = "WhatsApp · Alhabla",
  mensajes = [],
}: {
  titulo?: string;
  mensajes?: { autor: AutorMensaje; texto: string }[];
}) {
  return (
    <figure className="not-prose my-8 overflow-hidden rounded-3xl border border-[#e5e5e5] bg-white">
      <figcaption className="flex items-center gap-2 border-b border-[#e5e5e5] bg-[#fafafa] px-5 py-3">
        <MessageCircle className="h-4 w-4 text-[#8b5cf6]" aria-hidden="true" />
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6d28d9]">
          {titulo}
        </span>
      </figcaption>
      <ol className="space-y-3 p-5 sm:p-6">
        {mensajes.map((m, i) => {
          const esNegocio = m.autor === "negocio";
          const burbuja = esNegocio
            ? "bg-[#0a0a0a] text-white"
            : m.autor === "alhabla"
              ? "bg-[#f3eeff] text-[#27272a]"
              : "border border-[#e5e5e5] bg-white text-[#27272a]";
          return (
            <li
              key={i}
              className={`flex ${esNegocio ? "justify-end" : "justify-start"}`}
            >
              <p className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-6 ${burbuja}`}>
                <span className="sr-only">{ETIQUETA_AUTOR[m.autor]}: </span>
                {m.texto}
              </p>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}

/**
 * Lista de comprobación con marca en azulejo morado. Para «qué pedir a tu
 * sistema», «antes de lanzar» y resúmenes accionables.
 */
export function Checklist({ items = [] }: { items?: { texto: string }[] }) {
  return (
    <ul className="not-prose my-8 space-y-2.5">
      {items.map((item, i) => (
        <li
          key={i}
          className="flex items-start gap-3 rounded-xl border border-[#e5e5e5] bg-white p-4"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[10px] bg-[#f3eeff]">
            <Check className="h-3.5 w-3.5 text-[#8b5cf6]" aria-hidden="true" />
          </span>
          <span className="text-sm leading-6 text-[#27272a]">{item.texto}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Texto plano de los hijos de un encabezado de MDX (puede llevar negritas o
 * enlaces dentro), para sacar su ancla.
 */
export function textoPlano(nodo: React.ReactNode): string {
  if (nodo === null || nodo === undefined || typeof nodo === "boolean") return "";
  if (typeof nodo === "string" || typeof nodo === "number") return String(nodo);
  if (Array.isArray(nodo)) return nodo.map(textoPlano).join("");
  if (typeof nodo === "object" && "props" in nodo) {
    return textoPlano((nodo.props as { children?: React.ReactNode }).children);
  }
  return "";
}

/**
 * Ancla de un apartado a partir de su título: «¿Cuánto cuesta en 2026?» →
 * «cuanto-cuesta-en-2026». La usan los `##` del artículo (que reciben este
 * `id`) y el bloque `Indice`, así que el índice no se escribe a mano.
 */
export function idDeApartado(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Los `##` del artículo con su ancla, para que el `Indice` pueda saltar. */
export function Apartado({ children }: { children?: React.ReactNode }) {
  return (
    <h2 id={idDeApartado(textoPlano(children))} className="scroll-mt-24">
      {children}
    </h2>
  );
}

/**
 * Índice del artículo: los títulos de sus `##`, tal cual, y cada uno salta a
 * su apartado. Para artículos largos; va después de la entradilla.
 */
export function Indice({ apartados = [] }: { apartados?: { texto: string }[] }) {
  return (
    <nav
      aria-label="En este artículo"
      className="not-prose my-8 rounded-3xl border border-[#e5e5e5] bg-[#fafafa] p-6"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6d28d9]">
        En este artículo
      </p>
      <ol className="mt-3 grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
        {apartados.map((a, i) => (
          <li key={i} className="flex gap-2 text-sm leading-6">
            <span className="w-5 shrink-0 font-semibold tabular-nums text-[#a1a1aa]">
              {i + 1}
            </span>
            <a
              href={`#${idDeApartado(a.texto)}`}
              className="font-medium text-[#27272a] hover:text-[#6d28d9]"
            >
              {a.texto}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * Celda de tabla: lo que va entre comillas invertidas (`##002#`) sale en
 * monoespaciado, aunque esté en mitad del texto («marca `##002#` o llama»).
 */
function Celda({ texto }: { texto: string }) {
  const trozos = texto.split(/`([^`]+)`/);
  return (
    <>
      {trozos.map((trozo, i) =>
        i % 2 === 1 ? (
          <code
            key={i}
            className="whitespace-nowrap rounded-md bg-[#f4f4f5] px-1.5 py-0.5 font-mono text-[13px] font-semibold text-[#0a0a0a]"
          >
            {trozo}
          </code>
        ) : (
          trozo
        )
      )}
    </>
  );
}

/**
 * Tabla de datos (el MDX del blog no lleva tablas de Markdown). La primera
 * columna va en negrita; en el móvil se desplaza en horizontal dentro de su
 * marco, sin mover la página. Los códigos para marcar, entre comillas
 * invertidas.
 */
export function Tabla({
  titulo,
  columnas = [],
  filas = [],
  nota,
}: {
  titulo?: string;
  columnas?: string[];
  filas?: { celdas: string[] }[];
  nota?: string;
}) {
  return (
    <figure className="not-prose my-8 overflow-hidden rounded-3xl border border-[#e5e5e5] bg-white">
      {titulo ? (
        <figcaption className="border-b border-[#e5e5e5] bg-[#fafafa] px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#6d28d9]">
          {titulo}
        </figcaption>
      ) : null}
      <div className="overflow-x-auto">
        {/* Ancho mínimo según las columnas: en el móvil la tabla se desliza
            dentro de su marco en vez de estrujar cinco columnas en 375 px. */}
        <table
          className="w-full border-collapse text-left text-sm"
          style={{ minWidth: `${Math.max(28, columnas.length * 9)}rem` }}
        >
          <thead>
            <tr>
              {columnas.map((c, i) => (
                <th
                  key={i}
                  scope="col"
                  className="border-b border-[#e5e5e5] px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#52525b]"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0f0f0]">
            {filas.map((f, i) => (
              <tr key={i} className="align-top">
                {f.celdas.map((c, j) =>
                  j === 0 ? (
                    <th
                      key={j}
                      scope="row"
                      className="px-4 py-3 font-semibold text-[#0a0a0a]"
                    >
                      <Celda texto={c} />
                    </th>
                  ) : (
                    <td key={j} className="px-4 py-3 leading-6 text-[#27272a]">
                      <Celda texto={c} />
                    </td>
                  )
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {nota ? (
        <p className="border-t border-[#e5e5e5] px-5 py-3 text-xs leading-5 text-muted">
          {nota}
        </p>
      ) : null}
    </figure>
  );
}

/**
 * Una cuenta paso a paso: conceptos con su importe y el total destacado en
 * tinta. Para enseñar de dónde sale una cifra (el coste de un sueldo, un
 * plan) en vez de darla sin más.
 */
export function Cuenta({
  titulo,
  lineas = [],
  totalConcepto = "Total",
  total,
  nota,
}: {
  titulo?: string;
  lineas?: { concepto: string; importe: string; detalle?: string }[];
  totalConcepto?: string;
  total: string;
  nota?: string;
}) {
  return (
    <figure className="not-prose my-8 overflow-hidden rounded-3xl border border-[#e5e5e5] bg-white">
      {titulo ? (
        <figcaption className="border-b border-[#e5e5e5] bg-[#fafafa] px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#6d28d9]">
          {titulo}
        </figcaption>
      ) : null}
      <dl className="divide-y divide-[#f0f0f0]">
        {lineas.map((l, i) => (
          <div key={i} className="flex items-start justify-between gap-6 px-5 py-3">
            <dt className="text-sm leading-6 text-[#27272a]">
              {l.concepto}
              {l.detalle ? (
                <span className="block text-xs leading-5 text-muted">{l.detalle}</span>
              ) : null}
            </dt>
            <dd className="shrink-0 text-sm font-semibold tabular-nums text-[#0a0a0a]">
              {l.importe}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex items-center justify-between gap-6 bg-[#0a0a0a] px-5 py-4 text-white">
        <span className="text-sm font-semibold">{totalConcepto}</span>
        <span className="text-xl font-extrabold tabular-nums tracking-tight">{total}</span>
      </div>
      {nota ? (
        <p className="px-5 py-3 text-xs leading-5 text-muted">{nota}</p>
      ) : null}
    </figure>
  );
}

/**
 * Un mensaje listo para copiar: para qué sirve, el texto como saldría en
 * WhatsApp y el botón «Copiar». Los saltos de línea del texto se respetan.
 */
export function Plantilla({
  titulo,
  cuando,
  texto,
}: {
  titulo: string;
  cuando?: string;
  texto: string;
}) {
  return (
    <figure className="not-prose my-6 rounded-3xl border border-[#e5e5e5] bg-white p-5 sm:p-6">
      <figcaption className="flex items-start justify-between gap-4">
        <span>
          <span className="block font-semibold text-[#0a0a0a]">{titulo}</span>
          {cuando ? (
            <span className="mt-0.5 block text-sm leading-6 text-muted">{cuando}</span>
          ) : null}
        </span>
        <BotonCopiar texto={texto} />
      </figcaption>
      <p className="mt-4 max-w-[85%] whitespace-pre-line rounded-2xl rounded-tl-md border border-[#ddd6fe] bg-[#f3eeff] px-4 py-3 text-sm leading-6 text-[#27272a]">
        {texto}
      </p>
    </figure>
  );
}

/** Para el bloque de sector del editor: nombre visible del sector. */
export function nombreDeSector(slug: string): string {
  return slug in nicheLandings ? nicheLandings[slug as NicheSlug].name : slug;
}
