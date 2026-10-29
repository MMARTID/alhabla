"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, ScissorsLineDashed, UserRoundCheck, type LucideIcon } from "lucide-react";
import { getBookingSettings } from "@/lib/api";
import { AGENT_CONFIGURATION_STEPS } from "@/lib/agent-configuration";
import { datosPorCompletar, listaDeNombres } from "@/lib/datos-por-completar";
import type { Business } from "@/lib/types";
import { AzulejoIcono } from "@/components/movil/piezas";

function destino(clave: "professionals" | "services", movil: boolean) {
  const paso = AGENT_CONFIGURATION_STEPS.find((candidato) => candidato.key === clave);
  return (movil ? paso?.hrefMovil : paso?.href) ?? "/agente";
}

/**
 * Aviso discreto de Inicio y del Panel: profesionales que siguen con el
 * nombre provisional del alta y servicios sin precio. La recepcionista
 * atiende igual, así que no va en ámbar como lo que la deja sin reservar:
 * blanco, con el icono lavanda, y un enlace a donde se arregla cada cosa.
 */
export function DatosPorCompletar({ business, movil }: { business: Business; movil: boolean }) {
  const ajustes = useQuery({ queryKey: ["booking-settings"], queryFn: getBookingSettings });
  if (!ajustes.data) return null;

  const { profesionalesSinNombre, serviciosSinPrecio } = datosPorCompletar(
    ajustes.data,
    business.agentSettings?.darPrecios
  );
  if (profesionalesSinNombre.length === 0 && serviciosSinPrecio.length === 0) return null;

  const unProfesional = profesionalesSinNombre.length === 1;
  const unServicio = serviciosSinPrecio.length === 1;

  return (
    <section className="rounded-[20px] border border-linea bg-superficie p-2" aria-labelledby="datos-por-completar">
      <h2 id="datos-por-completar" className="px-2 pb-1 pt-1.5 text-[13px] font-semibold text-muted">
        Para que tu recepcionista responda bien
      </h2>
      <ul>
        {profesionalesSinNombre.length > 0 ? (
          <FilaPorCompletar
            href={destino("professionals", movil)}
            icono={UserRoundCheck}
            titulo={unProfesional ? "Ponle nombre a tu profesional" : "Ponles nombre a tu equipo"}
            texto={`${listaDeNombres(profesionalesSinNombre.map((profesional) => profesional.name))} ${
              unProfesional ? "sigue" : "siguen"
            } con el nombre del alta. Si un cliente pide cita con Marta, la recepcionista no sabe quién es Marta y no puede dársela con ella.`}
          />
        ) : null}
        {serviciosSinPrecio.length > 0 ? (
          <FilaPorCompletar
            href={destino("services", movil)}
            icono={ScissorsLineDashed}
            titulo="Pon precio a tus servicios"
            texto={`${unServicio ? "Un servicio no tiene" : `${serviciosSinPrecio.length} servicios no tienen`} precio: si un cliente pregunta cuánto cuesta, la recepcionista no puede decírselo.`}
          />
        ) : null}
      </ul>
    </section>
  );
}

function FilaPorCompletar({
  href,
  icono,
  titulo,
  texto,
}: {
  href: string;
  icono: LucideIcon;
  titulo: string;
  texto: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-16 items-center gap-3 rounded-[14px] px-2 py-2.5 transition hover:bg-relleno focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado"
      >
        <AzulejoIcono icono={icono} tamaño="sm" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold leading-snug text-tinta">{titulo}</span>
          <span className="mt-0.5 block text-[13px] leading-[1.45] text-apagado">{texto}</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-morado-tinta" aria-hidden="true" />
      </Link>
    </li>
  );
}
