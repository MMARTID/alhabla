"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * Botón «Copiar» de las plantillas del blog (bloque `Plantilla`). Copia el
 * texto tal cual, con sus saltos de línea, para pegarlo en WhatsApp Business
 * o donde haga falta. Si el navegador no deja usar el portapapeles (http, un
 * iframe sin permiso), no hace nada: el texto sigue ahí para seleccionarlo.
 */
export function BotonCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de portapapeles: el texto se puede seleccionar a mano.
    }
  }

  return (
    <button
      type="button"
      onClick={copiar}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] border border-[#e5e5e5] bg-white px-3 text-xs font-semibold text-[#0a0a0a] transition hover:border-[#8b5cf6] hover:text-[#6d28d9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b5cf6]"
    >
      {copiado ? (
        <Check className="h-3.5 w-3.5 text-[#2c7334]" aria-hidden="true" />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      <span aria-live="polite">{copiado ? "Copiado" : "Copiar"}</span>
    </button>
  );
}
