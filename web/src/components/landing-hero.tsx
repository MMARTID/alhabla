"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useState } from "react";
import { ArrowRight, Check, Headphones } from "lucide-react";

import { HeroHilos } from "@/components/hero-hilos";
import { DemoVoiceCall } from "@/components/demo-voice-call";
import type { NicheAccent, NicheSlug } from "@/lib/niche-landings";

/**
 * El hero de las landings de sector: H1 «Recepcionista de IA para …» con el
 * oficio subrayado en su acento, la frase de calle y las dos acciones —
 * probar (negra) y escuchar una llamada (la demo de voz del sector; sin
 * demo propia, la general). Sin badge de estadística (PLAN-WEB-CONTENIDO.md).
 *
 * `relative isolate` es obligatorio para que el canvas de los hilos en
 * `-z-10` quede por encima del fondo del <main>; la sección no puede pintar
 * fondo propio por lo mismo (ver DESIGN.md).
 */
export function LandingHero({
  slug,
  paraQuien,
  frase,
  acento,
  demo,
}: {
  slug: string;
  /** Lo que va tras «Recepcionista de IA para»; va subrayado. */
  paraQuien: string;
  frase: string;
  acento: NicheAccent;
  demo?: NicheSlug;
}) {
  const [demoAbierta, setDemoAbierta] = useState(false);
  const planesHref = `/planes?niche=${encodeURIComponent(slug)}`;
  // «clínicas de fisioterapia» o «spas y centros de masaje» no caben en dos
  // líneas al tamaño de «peluquerías»: con oficio largo, un punto menos.
  const largo = paraQuien.length > 12;

  return (
    <>
      <section className="relative isolate overflow-hidden">
        <HeroHilos color={acento.strong} />
        <div className="mx-auto flex max-w-4xl flex-col items-center px-4 pb-14 pt-14 text-center sm:px-6 sm:pb-16 sm:pt-20 lg:px-8 lg:pb-20 lg:pt-24">
          <h1
            className={`mx-auto max-w-4xl text-balance font-black leading-[1.05] tracking-[-0.03em] text-tinta ${
              largo
                ? "text-[2.15rem] sm:text-5xl lg:text-[3.6rem]"
                : "text-[2.65rem] sm:text-5xl lg:text-[4.25rem]"
            }`}
          >
            Recepcionista de IA para{" "}
            {/* `--purple-ring` es fijo en globals.css; aquí lo pisa el
                acento del sector para que el trazo no quede morado. */}
            <span
              className="titular-subrayado"
              style={{ "--purple-ring": acento.soft } as CSSProperties}
            >
              {paraQuien}
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-balance text-lg leading-8 text-apagado">
            {frase}
          </p>

          <div className="mt-9 w-full sm:w-auto">
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
              <Link
                href={planesHref}
                className="btn-primary w-full sm:w-auto"
                data-evento="clic_probar"
                data-ubicacion="sector"
              >
                Probar 7 días gratis
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <button
                type="button"
                onClick={() => setDemoAbierta(true)}
                className="btn-secondary w-full sm:w-auto"
              >
                <Headphones className="h-4 w-4" aria-hidden="true" />
                Escuchar una llamada
              </button>
            </div>
          </div>

          <ul className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-medium text-tinta-3">
            {["Tu número de siempre", "Sin permanencia"].map((marca) => (
              <li key={marca} className="inline-flex items-center gap-1.5">
                <Check
                  className="h-4 w-4"
                  style={{ color: acento.strong }}
                  aria-hidden="true"
                />
                {marca}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <DemoVoiceCall
        open={demoAbierta}
        onClose={() => setDemoAbierta(false)}
        niche={demo}
      />
    </>
  );
}
