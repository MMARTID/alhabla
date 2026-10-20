import Link from "next/link";
import { ArrowRight, BookOpen, CircleAlert, Clock, ListChecks, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import type { GuiaSector } from "@/lib/niche-landings";
import { Reveal } from "@/components/scroll-reveal";

/**
 * «Guía para [sector]»: el bloque de contenido propio de cada landing de
 * sector (2026-10-20). Las cinco landings compartían más de la mitad del
 * texto y Google solo indexaba una (scripts/auditar-similitud.mjs); esto es
 * lo que cuenta cada una y las demás no: las llamadas típicas del oficio,
 * sus servicios con tiempos, el reparto por especialidad aplicado a ese
 * oficio, cuándo llaman y los errores al ponerla en marcha.
 *
 * Todo el texto llega por `guia` desde lib/niche-landings.ts. El componente
 * solo pone el andamiaje (los encabezados de la tabla y el pie de los
 * ejemplos): cada frase fija aquí sería texto repetido en las cinco páginas.
 *
 * Sistema visual de siempre con tokens (sin hex): `.panel`, `rounded-3xl`,
 * iconos Lucide en `bg-lavado text-morado`. Sin el acento de color del
 * sector a propósito: es contenido de lectura, no un bloque de marca.
 */

const CABECERA_SERVICIOS = ["Servicio", "Duración orientativa", "Quién suele hacerlo"] as const;

function Icono({ icono: I }: { icono: LucideIcon }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lavado text-morado">
      <I className="h-5 w-5" aria-hidden="true" />
    </span>
  );
}

export function GuiaDelSector({ guia }: { guia: GuiaSector }) {
  return (
    <section id="guia" aria-labelledby="guia-titulo" className="scroll-m-20 border-y border-linea py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="max-w-3xl">
          <span className="badge-soft gap-2">
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
            {guia.etiqueta}
          </span>
          <h2 id="guia-titulo" className="mt-5 text-balance text-3xl font-black leading-tight tracking-tight text-tinta sm:text-4xl">
            {guia.titulo}
          </h2>
          <p className="mt-4 text-base leading-7 text-muted">{guia.entradilla}</p>
        </Reveal>

        {/* Las seis llamadas: lo que dice quien llama y lo que hace la
            recepcionista. Numeradas porque son un recorrido, no un menú. */}
        <div className="mt-12">
          <Reveal>
            <h3 className="text-xl font-bold tracking-tight text-tinta sm:text-2xl">{guia.llamadasTitulo}</h3>
          </Reveal>
          <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {guia.llamadas.map((llamada, i) => (
              <li key={llamada.titulo}>
                <Reveal delay={(i % 3) * 0.08} y={14} className="h-full">
                  <article className="panel flex h-full flex-col p-6">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lavado text-sm font-bold text-morado-tinta">
                        {i + 1}
                      </span>
                      <h4 className="text-base font-bold leading-6 text-tinta">{llamada.titulo}</h4>
                    </div>
                    <p className="mt-4 rounded-2xl bg-relleno px-4 py-3 text-sm italic leading-6 text-tinta-2">
                      <span className="sr-only">Quien llama: </span>
                      {llamada.pide}
                    </p>
                    <p className="mt-4 text-sm leading-6 text-muted">{llamada.hace}</p>
                  </article>
                </Reveal>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs leading-5 text-muted">Ejemplos ilustrativos: las frases y los nombres son inventados.</p>
        </div>

        {guia.salud ? (
          <Reveal className="mt-8">
            <aside className="panel flex flex-col gap-4 p-6 sm:flex-row sm:p-8">
              <Icono icono={ShieldCheck} />
              <div className="max-w-3xl">
                <h3 className="text-lg font-bold text-tinta">{guia.salud.titulo}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{guia.salud.texto}</p>
                <Link
                  href={guia.salud.href}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-tinta underline-offset-4 hover:underline"
                >
                  {guia.salud.enlace}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </aside>
          </Reveal>
        ) : null}

        {/* Servicios y tiempos: texto a la izquierda, tabla a la derecha en
            escritorio; en móvil la tabla puede desplazarse dentro de su
            borde sin mover la página. */}
        <div className="mt-14 grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-12">
          <Reveal>
            <Icono icono={ListChecks} />
            <h3 className="mt-5 text-xl font-bold tracking-tight text-tinta sm:text-2xl">{guia.serviciosTitulo}</h3>
            <p className="mt-3 text-base leading-7 text-muted">{guia.serviciosEntradilla}</p>
          </Reveal>
          <Reveal delay={0.08} y={14}>
            <div className="overflow-x-auto rounded-3xl border border-linea bg-superficie">
              <table className="w-full min-w-[30rem] border-collapse text-left text-sm">
                <caption className="sr-only">{guia.serviciosTitulo}</caption>
                <thead>
                  <tr className="bg-relleno">
                    {CABECERA_SERVICIOS.map((columna) => (
                      <th key={columna} scope="col" className="border-b border-linea px-4 py-3 font-semibold text-apagado">
                        {columna}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {guia.servicios.map((fila) => (
                    <tr key={fila.servicio} className="border-b border-linea-suave last:border-0">
                      <th scope="row" className="px-4 py-3 align-top font-semibold text-tinta">
                        {fila.servicio}
                      </th>
                      <td className="whitespace-nowrap px-4 py-3 align-top tabular-nums text-apagado">{fila.duracion}</td>
                      <td className="px-4 py-3 align-top leading-6 text-apagado">{fila.quien}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted">{guia.serviciosNota}</p>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-5 lg:grid-cols-2">
          <Reveal className="h-full">
            <article className="panel h-full p-6 sm:p-8">
              <Icono icono={Users} />
              <h3 className="mt-5 text-xl font-bold tracking-tight text-tinta">{guia.repartoTitulo}</h3>
              <div className="mt-3 space-y-3 text-sm leading-6 text-muted">
                {guia.reparto.map((parrafo) => (
                  <p key={parrafo}>{parrafo}</p>
                ))}
              </div>
            </article>
          </Reveal>
          <Reveal delay={0.08} className="h-full">
            <article className="panel h-full p-6 sm:p-8">
              <Icono icono={Clock} />
              <h3 className="mt-5 text-xl font-bold tracking-tight text-tinta">{guia.horasTitulo}</h3>
              <div className="mt-3 space-y-3 text-sm leading-6 text-muted">
                {guia.horas.map((parrafo) => (
                  <p key={parrafo}>{parrafo}</p>
                ))}
              </div>
            </article>
          </Reveal>
        </div>

        <div className="mt-14">
          <Reveal>
            <h3 className="text-xl font-bold tracking-tight text-tinta sm:text-2xl">{guia.erroresTitulo}</h3>
          </Reveal>
          <ul className="mt-6 grid gap-3 md:grid-cols-2">
            {guia.errores.map((error, i) => (
              <li key={error.titulo}>
                <Reveal delay={(i % 2) * 0.08} y={12} className="h-full">
                  <div className="flex h-full items-start gap-4 rounded-2xl border border-linea bg-superficie p-5">
                    <Icono icono={CircleAlert} />
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold leading-5 text-tinta">{error.titulo}</h4>
                      <p className="mt-1.5 text-sm leading-6 text-muted">{error.texto}</p>
                    </div>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>

        {/* Enlaces internos al final de la guía: lo siguiente que necesita
            quien ya ha decidido probar (desvío, calendario, plantillas) y la
            comparación que se hace quien aún duda. */}
        <div className="mt-14">
          <Reveal>
            <h3 className="text-xl font-bold tracking-tight text-tinta sm:text-2xl">{guia.enlacesTitulo}</h3>
          </Reveal>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {guia.enlaces.map((enlace) => (
              <li key={enlace.href}>
                <Link
                  href={enlace.href}
                  className="group flex h-full flex-col rounded-2xl border border-linea bg-superficie p-5 transition hover:border-lavado-borde"
                >
                  <span className="flex items-start justify-between gap-3 text-sm font-semibold leading-6 text-tinta">
                    {enlace.titulo}
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-morado transition group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                  <span className="mt-1 text-sm leading-6 text-muted">{enlace.texto}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
