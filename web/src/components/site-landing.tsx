import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { EnTuNegocioScroll } from "@/components/en-tu-negocio";
import { GestorSimulacionSection } from "@/components/gestor-simulacion";
import { CalculadoraCompacta } from "@/components/herramientas/calculadora-compacta";
import { LandingHero } from "@/components/landing-hero";
import { LlamadaScroll } from "@/components/llamada-scroll";
import { Reveal } from "@/components/scroll-reveal";
import { OficioDelSector } from "@/components/sector/oficio-del-sector";
import { PreciosDelSector } from "@/components/sector/precios-del-sector";
import { Pregunta } from "@/components/sector/pregunta";
import { WhatsappDelCliente } from "@/components/sector/whatsapp-del-cliente";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { GUIONES_GESTOR } from "@/lib/gestor-guiones";
import type { OwnerAssistant } from "@/lib/niche-landings";
import { GUIONES_SECTOR } from "@/lib/relato-guiones";
import type { SectorLanding } from "@/lib/sectores/tipos";

/**
 * La landing de sector: las preguntas de la dueña, con texto y 3D
 * compensados (decisión del fundador del 29-10-2026; el contrato está en
 * .impeccable/surfaces/web-src-components-site-landing-tsx.md). Las dos
 * preguntas grandes se contestan con las escenas de la portada movidas por
 * el guion del oficio: la llamada que pasa del iPhone al panel del portátil
 * (LlamadaScroll + EnTuNegocioScroll, GUIONES_SECTOR) y tu asistente
 * resolviendo una ausencia por WhatsApp con el panel al lado
 * (GestorSimulacionSection, GUIONES_GESTOR). Entre escena y escena, dos
 * líneas y una pieza plana: el WhatsApp de la clienta, sus servicios, la
 * calculadora compacta con su oficio, el precio y cinco preguntas. Lo que cambia de un oficio a otro está en
 * lib/sectores/<sector>.ts y en esos dos guiones. La portada es otra
 * (main-landing.tsx).
 */
export function SiteLanding({ sector }: { sector: SectorLanding }) {
  const acento = sector.acento;
  const planesHref = `/planes?niche=${encodeURIComponent(sector.slug)}`;
  const relato = GUIONES_SECTOR[sector.slug];
  const asistente: OwnerAssistant = {
    title: sector.asistente.pregunta,
    description: sector.asistente.respuesta,
    examples: sector.asistente.situaciones.map(({ titulo, texto }) => ({
      title: titulo,
      description: texto,
    })) as OwnerAssistant["examples"],
    closing: `Con tus ${sector.clientes} manda Alhabla. Con tu agenda mandas tú.`,
  };

  return (
    <main
      id="main-content"
      className="relative isolate min-h-screen w-full bg-lienzo text-tinta"
      data-landing="alhabla"
    >
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-[10px] focus:bg-tinta focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-sobre-tinta"
      >
        Saltar al contenido
      </a>

      <SiteHeader niche={sector.slug} />

      <div id="contenido" tabIndex={-1} className="outline-none">
        <LandingHero
          slug={sector.slug}
          paraQuien={sector.paraQuien}
          frase={sector.hero.frase}
          acento={acento}
          demo={sector.demo}
        />
      </div>

      {/* La primera pregunta abre la escena del iPhone («Cómo funciona» de
          la cabecera salta a la escena, que lleva el id). */}
      <EntradaDeEscena
        pregunta={sector.llamada.pregunta}
        respuesta={sector.llamada.respuesta}
        color={acento.strong}
      />
      <LlamadaScroll guion={relato} acento={acento} antetitulo={false} />
      <EnTuNegocioScroll guion={relato} acento={acento} antetitulo={false} />

      <Pregunta
        id="whatsapp"
        pregunta={sector.whatsapp.pregunta}
        respuesta={sector.whatsapp.respuesta}
        lado="derecha"
        prueba={
          <WhatsappDelCliente
            quien={`${relato.cliente.nombre} ${relato.cliente.apellido}`}
            confirmacion={sector.whatsapp.confirmacion}
            conversacion={sector.whatsapp.conversacion}
            acento={acento}
          />
        }
      />

      <div id="tu-asistente" className="scroll-m-20">
        <GestorSimulacionSection
          data={asistente}
          guion={GUIONES_GESTOR[sector.slug]}
          accent={acento}
          masInfoHref="/agenda-por-whatsapp"
          numerar={false}
        />
      </div>

      <OficioDelSector oficio={sector.oficio} acento={acento} />

      {/* Su cuenta antes del precio: con sus llamadas y su precio de cita,
          qué plan se paga con cuántas citas. */}
      <CalculadoraCompacta sector={sector} />

      <PreciosDelSector slug={sector.slug} acento={acento} />

      <section
        id="preguntas"
        aria-labelledby="preguntas-titulo"
        className="scroll-m-20 border-t border-linea py-14 sm:py-20 lg:py-24"
      >
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-12 lg:gap-16 lg:px-8">
          <div className="lg:col-span-4">
            <h2
              id="preguntas-titulo"
              className="text-3xl font-black leading-[1.1] tracking-[-0.02em] text-tinta sm:text-4xl"
            >
              Más preguntas
            </h2>
          </div>
          <div className="lg:col-span-8">
            <div className="divide-y divide-linea border-y border-linea">
              {sector.faqs.map(({ question, answer }) => (
                <details key={question} className="group">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 rounded-[10px] py-4 text-base font-semibold leading-6 text-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
                    {question}
                    <Plus
                      className="h-5 w-5 shrink-0 transition-transform duration-200 group-open:rotate-45"
                      style={{ color: acento.strong }}
                      aria-hidden="true"
                    />
                  </summary>
                  <p className="max-w-2xl pb-5 text-base leading-7 text-apagado">
                    {answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-oscuro text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-8 px-4 py-16 sm:px-6 sm:py-20 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <h2 className="max-w-2xl text-balance text-3xl font-black leading-[1.1] tracking-[-0.02em] sm:text-4xl">
            {sector.cierre}
          </h2>
          <Link
            href={planesHref}
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-[10px] bg-white px-6 text-sm font-semibold text-tinta transition duration-200 hover:-translate-y-0.5 hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-oscuro"
            data-evento="clic_probar"
            data-ubicacion="sector_cierre"
          >
            Empezar ahora
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

/**
 * Dos líneas antes de una escena 3D: la pregunta de la dueña y su respuesta,
 * centradas, para que la escena llegue contestando algo y no sola.
 */
function EntradaDeEscena({
  pregunta,
  respuesta,
  color,
}: {
  pregunta: string;
  respuesta: string;
  color: string;
}) {
  return (
    <section aria-labelledby="entrada-llamada" className="pb-6 pt-4 sm:pb-10 sm:pt-6">
      <Reveal className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <span
          className="mx-auto block h-10 w-px"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
        <h2
          id="entrada-llamada"
          className="mt-8 text-balance text-3xl font-black leading-[1.1] tracking-[-0.02em] text-tinta sm:text-5xl"
        >
          {pregunta}
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg leading-8 text-apagado">
          {respuesta}
        </p>
      </Reveal>
    </section>
  );
}
