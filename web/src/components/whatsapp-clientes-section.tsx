import { BellRing, CalendarCheck2, CalendarSync, ListOrdered, MessagesSquare } from "lucide-react";
import { SiWhatsapp } from "@icons-pack/react-simple-icons";

import { Reveal } from "@/components/scroll-reveal";

/**
 * Lo que recibe el cliente final por WhatsApp (2026-09-26), con el titular
 * de la visión desde el 2026-10-29: el negocio se adapta al cliente, que no
 * se baja nada ni aprende un canal nuevo. Una línea de detalle por ventaja y
 * el plan donde aplica.
 */
const VENTAJAS = [
  {
    Icono: CalendarCheck2,
    titulo: "Confirmación al momento",
    texto: "Nada más colgar le llega su cita por escrito: servicio, día, hora y con quién.",
  },
  {
    Icono: BellRing,
    titulo: "Recordatorio antes de la cita",
    texto: "Un aviso antes de su cita para que no se le olvide: menos huecos vacíos de clientes que no vienen.",
    plan: "Pro y Scale",
  },
  {
    Icono: CalendarSync,
    titulo: "Cambiar o cancelar sin llamar",
    texto: "Responde al mensaje y listo. El hueco que deja vuelve a estar libre para otro cliente.",
  },
  {
    Icono: ListOrdered,
    titulo: "Lista de espera",
    texto: "Si la hora que quiere está ocupada, se apunta. Si esa hora se libera por una cancelación, le avisa por WhatsApp para que la coja.",
  },
  {
    Icono: MessagesSquare,
    titulo: "Escribir en vez de llamar",
    texto: "Si ya ha reservado antes contigo, puede pedir o mover su cita escribiendo a la misma recepcionista por WhatsApp.",
  },
] as const;

export function WhatsAppClientesSection() {
  return (
    <section className="border-b border-[#e5e5e5] py-16 sm:py-24" aria-labelledby="whatsapp-clientes-titulo">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16 lg:px-8">
        <Reveal>
          <span className="badge-soft gap-2">
            <SiWhatsapp className="h-3.5 w-3.5" color="#25D366" aria-hidden="true" />
            Para tus clientes
          </span>
          <h2 id="whatsapp-clientes-titulo" className="mt-5 text-3xl font-black tracking-tight text-[#0a0a0a] sm:text-4xl">
            Deja de educar a tus clientes.
          </h2>
          <p className="mt-4 max-w-md text-base leading-7 text-[#52525b] sm:text-lg sm:leading-8">
            Ni aplicaciones que descargar ni un canal que aprender: llaman como siempre y reciben su cita por WhatsApp, que ya usan. Lo que cambian desde ahí acaba en tu agenda sin que toques nada.
          </p>
        </Reveal>

        <ul className="grid gap-x-8 gap-y-7 sm:grid-cols-2">
          {VENTAJAS.map(({ Icono, titulo, texto, ...resto }, i) => (
            <li key={titulo}>
              <Reveal delay={i * 0.05} y={10} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f3eeff] text-[#8b5cf6]">
                  <Icono className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-bold text-[#0a0a0a]">
                    {titulo}
                    {"plan" in resto ? (
                      <span className="rounded-full bg-[#f4f4f5] px-2 py-0.5 text-xs font-semibold text-[#52525b]">{resto.plan}</span>
                    ) : null}
                  </h3>
                  <p className="mt-1.5 text-sm leading-6 text-[#52525b]">{texto}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
