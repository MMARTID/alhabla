"use client";

import { Check, Copy } from "lucide-react";
import { useRef, useState, useSyncExternalStore } from "react";

/**
 * Botón de copiar de las herramientas gratis (/herramientas/…).
 *
 * Sin JavaScript no se pinta: el texto ya está en la página y se puede
 * seleccionar a mano, y un botón que no hace nada confunde más que ayuda.
 * Se sabe si hay JavaScript con `useSyncExternalStore` (falso en el
 * servidor y en la hidratación, verdadero después) en vez de un setState
 * dentro de un efecto.
 */
const sinSuscripcion = () => () => {};

export function useHayJavascript() {
  return useSyncExternalStore(
    sinSuscripcion,
    () => true,
    () => false
  );
}

/** Copia con la API del portapapeles y, si no está (http, navegador viejo),
 * con un textarea temporal. Devuelve si lo ha conseguido. */
export async function copiarAlPortapapeles(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    // Permiso denegado o contexto no seguro: se prueba el método antiguo.
  }
  try {
    const area = document.createElement("textarea");
    area.value = texto;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const hecho = document.execCommand("copy");
    document.body.removeChild(area);
    return hecho;
  } catch {
    return false;
  }
}

export function BotonCopiar({
  texto,
  etiqueta,
  className = "",
}: {
  texto: string;
  /** Qué se copia, para el lector de pantalla: «la confirmación por WhatsApp». */
  etiqueta: string;
  className?: string;
}) {
  const hayJs = useHayJavascript();
  const [estado, setEstado] = useState<"copiado" | "error" | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!hayJs) return null;

  const copiar = async () => {
    const hecho = await copiarAlPortapapeles(texto);
    setEstado(hecho ? "copiado" : "error");
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setEstado(null), 2500);
  };

  return (
    <span className={`inline-flex items-center ${className}`}>
      <button
        type="button"
        onClick={copiar}
        className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-linea bg-superficie px-3 text-xs font-semibold text-tinta transition hover:border-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado focus-visible:ring-offset-2 print:hidden"
        aria-label={`Copiar ${etiqueta}`}
      >
        {estado === "copiado" ? (
          <Check className="h-3.5 w-3.5 text-exito" aria-hidden="true" />
        ) : (
          <Copy className="h-3.5 w-3.5 text-morado" aria-hidden="true" />
        )}
        {estado === "copiado" ? "Copiado" : estado === "error" ? "Cópialo a mano" : "Copiar"}
      </button>
      <span className="sr-only" aria-live="polite">
        {estado === "copiado"
          ? `Copiado: ${etiqueta}`
          : estado === "error"
            ? "No se ha podido copiar. Selecciona el texto y cópialo a mano."
            : ""}
      </span>
    </span>
  );
}
