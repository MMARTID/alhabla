import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { LandingHero } from "@/components/landing-hero";
import { OwnerAssistantChatMockup } from "@/components/owner-assistant-chat";
import { OficioDelSector } from "@/components/sector/oficio-del-sector";
import { PreciosDelSector } from "@/components/sector/precios-del-sector";
import { Pregunta } from "@/components/sector/pregunta";
import { TranscripcionLlamada } from "@/components/sector/transcripcion-llamada";
import { WhatsappDelCliente } from "@/components/sector/whatsapp-del-cliente";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import type { NicheAccent } from "@/lib/niche-landings";
import type { SectorLanding } from "@/lib/sectores/tipos";

/**
 * La landing de sector, «Las preguntas de la dueña» (PLAN-WEB-CONTENIDO.md y
 * el contrato de .impeccable/surfaces/web-src-components-site-landing-tsx.md):
 * las preguntas que se hace la dueña antes de probar, cada una contestada en
 * dos líneas y demostrada con una pieza del producto. Ocho bloques fijos:
 * hero, la llamada, tu asistente (con la regla de confianza), el WhatsApp
 * del cliente, el oficio, el precio, cinco preguntas y el cierre. Lo que
 * cambia de un oficio a otro está en lib/sectores/<sector>.ts. La portada
 * es otra (main-landing.tsx).
 */
export function SiteLanding({ sector }: { sector: SectorLanding }) {
  const acento = sector.acento;
  const planesHref = `/planes?niche=${encodeURIComponent(sector.slug)}`;

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

      {/* «Cómo funciona» de la cabecera salta aquí. */}
      <Pregunta
        id="como-funciona"
        primera
        pregunta={sector.llamada.pregunta}
        respuesta={sector.llamada.respuesta}
        lado="derecha"
        prueba={
          <TranscripcionLlamada
            negocio={sector.negocio}
            quien={sector.llamada.quien}
            duracion={sector.llamada.duracion}
            lineas={sector.llamada.lineas}
            acento={acento}
          />
        }
      />

      <Pregunta
        id="tu-asistente"
        pregunta={sector.asistente.pregunta}
        respuesta={sector.asistente.respuesta}
        lado="izquierda"
        prueba={
          <OwnerAssistantChatMockup
            escenario={{
              id: "ausencia",
              reloj: "",
              diaCorto: "",
              turnos: sector.asistente.turnos,
              vistas: [],
              avisos: {},
            }}
            accent={acento}
            pie="Ejemplo con nombres inventados."
            entrada={false}
          />
        }
      >
        <ReglaDeConfianza clientes={sector.clientes} acento={acento} />
        <Link
          href="/agenda-por-whatsapp"
          className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-tinta underline decoration-linea-fuerte underline-offset-4 transition hover:decoration-tinta"
        >
          Todo lo que le puedes pedir a tu asistente
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </Pregunta>

      <Pregunta
        id="whatsapp"
        pregunta={sector.whatsapp.pregunta}
        respuesta={sector.whatsapp.respuesta}
        lado="derecha"
        prueba={
          <WhatsappDelCliente
            negocio={sector.negocio}
            quien={sector.llamada.quien}
            confirmacion={sector.whatsapp.confirmacion}
            conversacion={sector.whatsapp.conversacion}
            acento={acento}
          />
        }
      />

      <OficioDelSector oficio={sector.oficio} acento={acento} />

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
 * «Alhabla concilia y el negocio confirma», en las palabras del fundador:
 * lo único que hace sin preguntar es atender a los clientes; lo que toca el
 * negocio pide «Confirmar» (el mismo botón del chat de al lado).
 */
function ReglaDeConfianza({
  clientes,
  acento,
}: {
  clientes: string;
  acento: NicheAccent;
}) {
  return (
    <div className="mt-8 rounded-3xl border border-linea p-6">
      <p className="text-xl font-black leading-7 tracking-[-0.01em] text-tinta">
        Con tus {clientes} manda Alhabla.
      </p>
      <p className="mt-1.5 text-sm leading-6 text-apagado">
        Reserva, cambia o anula la cita que te piden, sin preguntarte.
      </p>
      <p className="mt-5 text-xl font-black leading-7 tracking-[-0.01em] text-tinta">
        Con tu agenda mandas tú.
      </p>
      <p className="mt-1.5 text-sm leading-6 text-apagado">
        Ausencias, citas, precios u horario: nada cambia hasta que pulsas{" "}
        <span
          className="inline-block rounded-full border px-2.5 text-xs font-semibold leading-5"
          style={{
            borderColor: acento.strong,
            backgroundColor: acento.soft,
            color: acento.deep,
          }}
        >
          Confirmar
        </span>
        .
      </p>
    </div>
  );
}
