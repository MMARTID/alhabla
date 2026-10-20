import type { ReactNode } from "react";

/**
 * Un código de desvío dentro de un párrafo (`**61*número#`). `Texto` de la
 * plantilla no da estilo a `<code>` y en estas guías salen en casi cada
 * frase: monoespaciada y sin cortar el código a media línea si cabe entero.
 */
export function Codigo({ children }: { children: ReactNode }) {
  return (
    <code className="whitespace-nowrap rounded bg-relleno-fuerte px-1.5 py-0.5 font-mono text-[0.92em] font-semibold text-tinta">
      {children}
    </code>
  );
}
