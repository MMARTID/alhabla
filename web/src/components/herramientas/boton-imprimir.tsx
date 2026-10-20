"use client";

import { Printer } from "lucide-react";
import { useHayJavascript } from "@/components/herramientas/boton-copiar";

/**
 * Imprime la página; lo que sale en el papel lo decide el CSS de impresión
 * de cada página (en el guion, solo el bloque `#guion-imprimible`). Sin
 * JavaScript no se pinta: queda el Ctrl+P de siempre, que da lo mismo.
 */
export function BotonImprimir({ texto = "Imprimir el guion" }: { texto?: string }) {
  const hayJs = useHayJavascript();
  if (!hayJs) return null;
  return (
    <button type="button" onClick={() => window.print()} className="btn-secondary h-11 px-5 print:hidden">
      <Printer className="h-4 w-4" aria-hidden="true" />
      {texto}
    </button>
  );
}
