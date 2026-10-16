"use client";

import { BadgeCheck } from "lucide-react";
import { useCupoDeFundador } from "@/lib/cupo-fundador";
import { formatPlanPrice, formatPriceWithVat, type Plan } from "@/lib/plans";

/**
 * El precio de una tarjeta de plan: la cuota sin IVA en grande, «+ IVA/mes»
 * al lado y el total con IVA debajo, que es lo que el checkout cobra
 * (los precios de Stripe son «exclusive»). Mientras quedan plazas de
 * fundador, el precio vigente va tachado y al lado el de fundador, que es el
 * que cobra el checkout (billing/service.ts usa el mismo recuento). Sin
 * plazas, o si la consulta falla, solo el precio vigente: nunca se anuncia un
 * descuento que quizá ya no existe.
 */
export function PrecioDePlan({
  plan,
  tamaño = "md",
  oscuro = false,
}: {
  plan: Plan;
  /** `md` en las landings (4xl), `lg` en /planes (5xl). */
  tamaño?: "md" | "lg";
  oscuro?: boolean;
}) {
  const cupo = useCupoDeFundador();
  const principal = oscuro ? "text-white" : "text-[#0a0a0a]";
  const apagado = oscuro ? "text-white/60" : "text-[#71717a]";
  const cifra = tamaño === "lg" ? "text-5xl" : "text-4xl";

  if (!cupo) {
    return (
      <div>
        <p className={`${cifra} font-black tracking-tight ${principal}`}>
          {formatPlanPrice(plan.price)}
          <span className={`text-base font-medium ${apagado}`}> + IVA/mes</span>
        </p>
        <p className={`mt-1 text-sm font-medium ${apagado}`}>{formatPriceWithVat(plan.price)}</p>
      </div>
    );
  }

  return (
    <div>
      <p className="flex flex-wrap items-baseline gap-x-2.5">
        <s className={`text-2xl font-bold decoration-2 ${apagado}`}>
          <span className="sr-only">Antes </span>
          {formatPlanPrice(plan.price)}
        </s>
        <span className={`${cifra} font-black tracking-tight ${principal}`}>
          <span className="sr-only">Ahora </span>
          {formatPlanPrice(plan.founderPrice)}
          <span className={`text-base font-medium ${apagado}`}> + IVA/mes</span>
        </span>
      </p>
      <p className={`mt-1 text-sm font-medium ${apagado}`}>{formatPriceWithVat(plan.founderPrice)}</p>
      <span
        className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
          oscuro ? "bg-white/10 text-[#ddd6fe]" : "bg-[#f3eeff] text-[#6d28d9] ring-1 ring-inset ring-[#ddd6fe]"
        }`}
      >
        <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
        Precio de fundador
      </span>
    </div>
  );
}

/**
 * La frase que explica el descuento, una vez por bloque de precios y no en
 * cada tarjeta. Desaparece con la última plaza.
 */
export function AvisoDeFundador({ className = "" }: { className?: string }) {
  const cupo = useCupoDeFundador();
  if (!cupo) return null;

  return (
    <p className={`text-base leading-7 text-[#27272a] ${className}`}>
      <strong className="font-semibold text-[#6d28d9]">Precio de fundador</strong> para los {cupo.total} primeros
      negocios: {cupo.restantes === 1 ? "queda 1 plaza" : `quedan ${cupo.restantes} plazas`}. Lo conservas mientras
      sigas suscrito.
    </p>
  );
}
