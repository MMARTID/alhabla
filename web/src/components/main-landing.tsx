"use client";

import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { useState } from "react";
import { ArrowRight, Check, Headphones } from "lucide-react";

import { DemoVoiceCall } from "@/components/demo-voice-call";
import { HeroHilos } from "@/components/hero-hilos";
import { SiteHeader } from "@/components/site-header";
import { Reveal } from "@/components/scroll-reveal";
import { EnMarchaSection } from "@/components/en-marcha-section";
import { EscenasDeOficio } from "@/components/escenas-de-oficio";
import { CalculadoraCompacta } from "@/components/herramientas/calculadora-compacta";
import { EnTuNegocioScroll } from "@/components/en-tu-negocio";
import { LlamadaScroll } from "@/components/llamada-scroll";
import { GestorSimulacionSection } from "@/components/gestor-simulacion";
import { PuntosFuertesSection } from "@/components/puntos-fuertes-section";
import { WhatsAppClientesSection } from "@/components/whatsapp-clientes-section";
import type { OwnerAssistant } from "@/lib/niche-landings";
import { GUION_GESTOR_GENERAL } from "@/lib/gestor-guiones";
import { HOME_QUICK_FAQS } from "@/lib/home-faqs";
import { formatExtraMinute, formatIncludedMinutes, plans, TRIAL_REASSURANCE } from "@/lib/plans";
import { AvisoDeFundador, PrecioDePlan } from "@/components/precio-de-plan";

/**
 * Tu asistente en la portada: las tres situaciones van en el orden de
 * `GUION_GESTOR_GENERAL` (ausencia, cierre, precio). Lo que cuentan es lo que
 * hace el backend: marca la ausencia, dice cuántas citas tenía y propone
 * pasarlas a quien mejor hace el servicio de los libres, y cada paso espera
 * a su «Confirmar».
 */
const ASISTENTE_PORTADA: OwnerAssistant = {
  badge: "Incluida en todos los planes",
  title: "Y si a mediodía falta alguien, se lo dices a tu asistente.",
  description:
    "Tu asistente es la que trabaja para ti: le escribes por WhatsApp o desde el panel, como a una persona de confianza, y ella se encarga. Te propone cada cambio y lo hace cuando pulsas «Confirmar».",
  examples: [
    {
      title: "Si alguien del equipo falta",
      description:
        "«Marta está de baja hoy»: deja de recibir citas y tu asistente te propone pasar cada una a quien mejor la hace de los que están libres. Confirmas, la mueve y avisa al cliente por WhatsApp.",
    },
    {
      title: "Si cierras un día",
      description:
        "«El lunes 12 cerramos, es festivo»: ese día queda cerrado y la recepcionista no reserva nada, sin tocar el calendario a mano.",
    },
    {
      title: "Si cambias un precio",
      description:
        "«El corte de caballero sube a 18 €»: se actualiza en tu carta y la recepcionista ya lo dice así cuando se lo preguntan.",
    },
  ],
  closing: "Con tus clientes manda Alhabla. Con tu agenda mandas tú.",
};

export function MainLanding() {
  const [isDemoOpen, setIsDemoOpen] = useState(false);

  return (
    <main id="main-content" className="min-h-screen bg-white text-[#0a0a0a]" data-landing="alhabla" data-landing-variant="principal">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-[10px] focus:bg-[#0a0a0a] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white">Saltar al contenido</a>
      <SiteHeader />

      {/*
        Hero a una columna con el titular centrado y los hilos de voz detrás
        (2026-09-17): el pulso de llamada que ocupaba la columna derecha se
        retiró. `relative isolate` es obligatorio para que el canvas en
        `-z-10` quede por encima del fondo del <main> y no desaparezca; la
        sección no puede pintar fondo propio por lo mismo (ver DESIGN.md).
      */}
      <section id="contenido" className="relative isolate overflow-hidden border-b border-[#e5e5e5]" tabIndex={-1}>
        <HeroHilos />
        <div className="mx-auto flex max-w-4xl flex-col items-center space-y-7 px-4 py-16 text-center sm:px-6 sm:py-24 lg:px-8 lg:py-28">
          <Reveal y={14}>
            <span className="badge-soft">Recepcionista de IA para negocios con cita previa</span>
          </Reveal>
          <Reveal delay={0.06} y={16}>
            <h1 className="text-balance text-[2.75rem] font-black leading-[1.02] tracking-[-0.045em] text-[#0a0a0a] sm:text-6xl lg:text-[4.6rem]">
              Tu negocio no tiene que parar para atender el teléfono.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-[#52525b]">
              Alhabla atiende tus llamadas con IA para que no pierdas ninguna, y tú lo gestionas todo por WhatsApp o desde el panel.
            </p>
          </Reveal>
          <Reveal delay={0.12} y={16}>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
              <Link href="/planes" className="btn-primary h-12 px-6" data-evento="clic_probar" data-ubicacion="portada">Probar 7 días gratis <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
              <button type="button" onClick={() => setIsDemoOpen(true)} className="btn-secondary h-12 px-6"><Headphones className="h-4 w-4" aria-hidden="true" /> Escuchar cómo atiende</button>
            </div>
          </Reveal>
          <Reveal delay={0.18} y={12}>
            <p className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-medium text-[#3f3f46]">
              {["Tu número de siempre", "Con tu calendario o sin él", "Sin permanencia"].map((item) => <span key={item} className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-[#8b5cf6]" aria-hidden="true" />{item}</span>)}
            </p>
          </Reveal>
        </div>
      </section>


      {/*
        Orden (2026-10-29, el de las promesas): que no se pierda ninguna
        llamada (los tres pasos en el teléfono y, sin corte, lo que ve el
        dueño en el portátil: las dos secciones van siempre juntas, ver
        lib/transicion-bolsillo-negocio.ts) → tu asistente por WhatsApp →
        qué la hace distinta de un contestador → lo que recibe el cliente →
        puesta en marcha → sectores → su cuenta → precio → dudas.
      */}
      <LlamadaScroll />

      <EnTuNegocioScroll />

      {/* Tu asistente en acción: el WhatsApp del dueño en el teléfono y su
          panel en el portátil, reaccionando a cada cambio. Cada landing de
          sector monta la misma simulación con su guion (lib/gestor-guiones.ts). */}
      <GestorSimulacionSection data={ASISTENTE_PORTADA} guion={GUION_GESTOR_GENERAL} masInfoHref="/agenda-por-whatsapp" />

      <PuntosFuertesSection onEscuchar={() => setIsDemoOpen(true)} />

      <WhatsAppClientesSection />

      <EnMarchaSection />

      {/*
        Sectores justo encima del precio (2026-09-26, a petición del
        usuario; antes iban tras el hero): quien ya ha visto cómo funciona
        elige su oficio y ve la llamada que entra en él (las escenas
        sustituyeron a las fotos el 2026-10-30). Después, su cuenta con sus
        números, y el precio.
      */}
      <EscenasDeOficio />

      <CalculadoraCompacta />

      {/* Precio y FAQ compactos aquí mismo: la visitante que llega convencida
          por el relato anterior no tiene que salir de la página para ver un
          número o resolver la duda que la frena justo antes del CTA final. */}
      <section id="precios" className="scroll-m-20 border-t border-[#e5e5e5] py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="max-w-2xl">
            <h2 className="text-3xl font-black tracking-tight text-[#0a0a0a] sm:text-4xl">Planes claros, sin permanencia.</h2>
            <p className="mt-4 flex flex-wrap items-center gap-2 text-base font-semibold leading-7 text-[#27272a]">
              <Check className="h-5 w-5 shrink-0 text-[#8b5cf6]" aria-hidden="true" />
              {TRIAL_REASSURANCE}
            </p>
            <AvisoDeFundador className="mt-2" />
          </Reveal>

          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {plans.map((plan, index) => (
              <Reveal key={plan.id} delay={index * 0.1}>
                <article
                  className={
                    plan.featured
                      ? "landing-card-hover relative flex h-full flex-col rounded-3xl bg-white p-7 ring-2 ring-[#8b5cf6]"
                      : "landing-card-hover flex h-full flex-col rounded-3xl border border-[#e5e5e5] bg-white p-7"
                  }
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-bold text-[#0a0a0a]">{plan.name}</h3>
                    {plan.featured ? <span className="badge-soft">Recomendado</span> : null}
                  </div>
                  <div className="mt-6">
                    <PrecioDePlan plan={plan} />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-[#27272a]">{formatIncludedMinutes(plan.minutes)} minutos incluidos · {formatExtraMinute(plan.extraPerMinute)}</p>
                  <p className="mt-2 text-sm leading-6 text-[#52525b]">{plan.description}</p>
                  {/* Los minutos ya van bajo el precio: fuera de la lista. */}
                  <ul className="mb-7 mt-5 space-y-2.5 border-t border-[#e5e5e5] pt-5">
                    {plan.features.filter((feature) => !feature.endsWith("minutos de llamadas incluidos")).map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5 text-sm leading-6 text-[#27272a]">
                        <Check className="mt-1 h-4 w-4 shrink-0 text-[#8b5cf6]" aria-hidden="true" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={`/planes?plan=${plan.id}`}
                    className={plan.featured ? "btn-primary mt-auto" : "btn-secondary mt-auto"}
                    aria-label={`Probar 7 días gratis el plan ${plan.name}`}
                    data-evento="clic_probar"
                    data-ubicacion={`portada_plan_${plan.id}`}
                  >
                    Probar 7 días gratis
                  </Link>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="preguntas" className="scroll-m-20 border-y border-[#e5e5e5] py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-3xl font-black tracking-tight text-[#0a0a0a] sm:text-4xl">Resuelve tus dudas antes de empezar.</h2>
          </Reveal>
          <div className="mt-8 grid items-start gap-3 sm:grid-cols-2">
            {HOME_QUICK_FAQS.map(({ question, answer }, index) => (
              <Reveal key={question} delay={Math.min(index, 5) * 0.05} y={12}>
                <details className="group rounded-2xl border border-[#e5e5e5] bg-white p-5">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-sm font-semibold leading-6 text-[#0a0a0a] marker:content-none">
                    {question}
                    <span className="mt-1 text-lg leading-none text-[#8b5cf6] transition group-open:rotate-45" aria-hidden="true">+</span>
                  </summary>
                  <p className="mt-3 border-t border-[#e5e5e5] pt-3 text-sm leading-6 text-[#52525b]">{answer}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#0a0a0a] text-white"><Reveal className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-7 px-4 py-16 sm:px-6 sm:py-20 lg:flex-row lg:items-center lg:px-8"><div><h2 className="max-w-xl text-3xl font-black tracking-tight sm:text-5xl">Que ninguna llamada a tu negocio se quede sin respuesta.</h2></div><Link href="/planes" className="btn-purple shrink-0" data-evento="clic_probar" data-ubicacion="portada_cierre">Empezar ahora <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></Reveal></section>
      <SiteFooter />
      <DemoVoiceCall open={isDemoOpen} onClose={() => setIsDemoOpen(false)} />
    </main>
  );
}
