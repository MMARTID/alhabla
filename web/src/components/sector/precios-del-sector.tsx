import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AvisoDeFundador, PrecioDePlan } from "@/components/precio-de-plan";
import type { NicheAccent } from "@/lib/niche-landings";
import { formatIncludedMinutes, plans, TRIAL_REASSURANCE } from "@/lib/plans";

/** El resumen del plan sin los minutos, que ya van en su propia línea. */
function loQueIncluye(resumen: string): string {
  return resumen
    .split(" · ")
    .filter((parte) => !parte.includes("minutos"))
    .join(" · ");
}

/**
 * «¿Cuánto cuesta?»: los tres planes en una sola pieza (precio, minutos y
 * una línea), la prueba y el fundador una vez, y la comparación entera en
 * /planes. La calculadora de llamadas perdidas va justo encima, en pequeño
 * (CalculadoraCompacta), así que aquí ya no lleva enlace.
 */
export function PreciosDelSector({
  slug,
  acento,
}: {
  slug: string;
  acento: NicheAccent;
}) {
  const planesHref = `/planes?niche=${encodeURIComponent(slug)}`;

  return (
    <section
      id="precios"
      aria-labelledby="precios-titulo"
      className="scroll-m-20 py-14 sm:py-20 lg:py-24"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2
            id="precios-titulo"
            className="text-3xl font-black leading-[1.1] tracking-[-0.02em] text-tinta sm:text-4xl"
          >
            ¿Cuánto cuesta?
          </h2>
          <p className="mt-5 text-lg leading-8 text-apagado">
            Una cuota al mes con los minutos de llamadas incluidos.{" "}
            {TRIAL_REASSURANCE}
          </p>
          <AvisoDeFundador className="mt-3" acento={acento} />
        </div>

        <div>
          <ul className="mt-10 grid overflow-hidden rounded-3xl border border-linea lg:grid-cols-3">
            {plans.map((plan, i) => (
              <li
                key={plan.id}
                className={`relative flex flex-col p-6 sm:p-7 ${
                  i > 0 ? "border-t border-linea lg:border-l lg:border-t-0" : ""
                }`}
              >
                {/* La franja solo con las tres en fila: apiladas, parecía
                    un separador entre tarjetas; ahí basta «Recomendado». */}
                {plan.featured ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 top-0 hidden h-1 lg:block"
                    style={{ backgroundColor: acento.strong }}
                  />
                ) : null}
                <p className="flex items-center gap-2 text-lg font-bold text-tinta">
                  {plan.name}
                  {plan.featured ? (
                    <span
                      className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{
                        backgroundColor: acento.soft,
                        color: acento.deep,
                      }}
                    >
                      Recomendado
                    </span>
                  ) : null}
                </p>
                <div className="mt-4">
                  <PrecioDePlan plan={plan} acento={acento} />
                </div>
                <p className="mt-4 text-sm font-semibold text-tinta">
                  {formatIncludedMinutes(plan.minutes)} minutos al mes
                </p>
                <p className="mt-1 text-sm leading-6 text-apagado">
                  {loQueIncluye(plan.summary)}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8">
          <Link href={planesHref} className="btn-secondary w-full sm:w-auto">
            Comparar los planes
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
