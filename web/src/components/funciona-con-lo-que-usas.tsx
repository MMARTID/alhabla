import Link from "next/link";
import { ArrowRight, Phone } from "lucide-react";
import { SiWhatsapp } from "@icons-pack/react-simple-icons";

import { Reveal } from "@/components/scroll-reveal";
import {
  IconoApple,
  IconoGoogleCalendar,
  IconoMicrosoft,
} from "@/app/integraciones/iconos-de-calendario";

/**
 * «Funciona con lo que ya usas» (PLAN-AGENDA-PRINCIPAL.md, fase 5): en las
 * páginas de venta, la compatibilidad va en una franja discreta de iconos con
 * un subtítulo, al estilo de otras plataformas (Calendly, Setmore), nunca
 * como título, FAQ ni fila propia. Cada icono lleva a su guía, donde sí se
 * cuenta todo (qué pasa si un calendario se desconecta, cómo se conecta).
 * Sin Telnyx ni ningún proveedor interno.
 */

const PIEZAS = [
  {
    nombre: "Tu operador",
    href: "/desvio-de-llamadas",
    icono: (
      <Phone className="h-5 w-5 text-morado" aria-hidden="true" />
    ),
  },
  {
    nombre: "WhatsApp",
    href: "/agenda-por-whatsapp",
    icono: <SiWhatsapp className="h-5 w-5" color="#25D366" aria-hidden="true" />,
  },
  {
    nombre: "Google Calendar",
    href: "/integraciones/google-calendar",
    icono: <IconoGoogleCalendar className="h-5 w-5" />,
  },
  {
    nombre: "Outlook",
    href: "/integraciones/outlook",
    icono: <IconoMicrosoft className="h-5 w-5" />,
  },
  {
    nombre: "Calendario de Apple",
    href: "/integraciones/icloud",
    icono: <IconoApple className="h-5 w-5" />,
  },
] as const;

function Iconos({ ubicacion }: { ubicacion: string }) {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
      {PIEZAS.map(({ nombre, href, icono }) => (
        <li key={nombre}>
          <Link
            href={href}
            data-evento="clic_franja_integraciones"
            data-ubicacion={ubicacion}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-linea bg-superficie px-4 text-sm font-semibold text-tinta transition hover:border-morado focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado focus-visible:ring-offset-2"
          >
            {icono}
            {nombre}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function FuncionaConLoQueUsas({
  ubicacion,
  compacta = false,
}: {
  /** Para `data-ubicacion` del evento de analítica: «portada», el sector… */
  ubicacion: string;
  /** En /planes: sin título, bajo las tarjetas. */
  compacta?: boolean;
}) {
  if (compacta) {
    return (
      <div className="mt-10 text-center">
        <p className="text-sm text-apagado">En todos los planes, con lo que ya usas:</p>
        <div className="mt-3">
          <Iconos ubicacion={ubicacion} />
        </div>
      </div>
    );
  }
  return (
    <section
      aria-labelledby="funciona-con-titulo"
      className="border-t border-linea py-12 sm:py-16"
    >
      <Reveal className="mx-auto max-w-5xl px-4 text-center sm:px-6">
        <h2
          id="funciona-con-titulo"
          className="text-xl font-bold tracking-tight text-tinta sm:text-2xl"
        >
          Funciona con lo que ya usas
        </h2>
        <p className="mt-2 text-base leading-7 text-apagado">
          Tu número de siempre, tu WhatsApp y tu calendario, si llevas uno. No tienes que cambiar nada.
        </p>
        <div className="mt-6">
          <Iconos ubicacion={ubicacion} />
        </div>
        <Link
          href="/integraciones"
          className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-morado-tinta underline-offset-4 hover:underline"
        >
          Ver integraciones
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </Reveal>
    </section>
  );
}
