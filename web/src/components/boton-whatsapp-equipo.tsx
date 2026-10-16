import { MessageCircle } from "lucide-react";
import { enlaceDeWhatsappDelEquipo } from "@/lib/contacto";

/**
 * WhatsApp con una persona del equipo. No pinta nada mientras no haya número
 * (`WHATSAPP_DEL_EQUIPO` en lib/contacto.ts). Abre en otra pestaña, así que
 * el evento `clic_whatsapp` sale sin esperar (lo mide MedicionDeClics).
 */
export function BotonWhatsappEquipo({
  ubicacion,
  className = "btn-secondary",
}: {
  /** Dónde está el botón, para el evento: «contacto», «planes»… */
  ubicacion: string;
  className?: string;
}) {
  const enlace = enlaceDeWhatsappDelEquipo();
  if (!enlace) return null;
  return (
    <a
      href={enlace}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      data-evento="clic_whatsapp"
      data-ubicacion={ubicacion}
    >
      <MessageCircle className="h-4 w-4" aria-hidden="true" />
      Escríbenos por WhatsApp
    </a>
  );
}
