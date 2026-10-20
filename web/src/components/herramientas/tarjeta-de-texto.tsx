import type { LucideIcon } from "lucide-react";
import { BotonCopiar } from "@/components/herramientas/boton-copiar";

/**
 * Un texto listo para usar, con su botón de copiar. Es un componente de
 * servidor: el texto va en el HTML y solo el botón es de cliente, así que
 * sin JavaScript la tarjeta se lee igual y el texto se selecciona a mano.
 */
export function TarjetaDeTexto({
  titulo,
  texto,
  icono: Icono,
  etiquetaCopiar,
  destacada = false,
}: {
  titulo: string;
  texto: string;
  icono?: LucideIcon;
  /** Qué se copia, para el lector de pantalla. */
  etiquetaCopiar: string;
  /** Fondo lavado (lo que se lee en un móvil) en vez de borde. */
  destacada?: boolean;
}) {
  return (
    <div className={`rounded-2xl p-4 ${destacada ? "bg-lavado" : "border border-linea bg-superficie"}`}>
      <div className="flex items-center justify-between gap-3">
        <p className={`flex items-center gap-2 text-xs font-semibold ${destacada ? "text-morado-tinta" : "text-apagado"}`}>
          {Icono ? <Icono className="h-3.5 w-3.5" aria-hidden="true" /> : null}
          {titulo}
        </p>
        <BotonCopiar texto={texto} etiqueta={etiquetaCopiar} />
      </div>
      <p className="mt-2 text-sm leading-6 text-tinta">{texto}</p>
    </div>
  );
}
