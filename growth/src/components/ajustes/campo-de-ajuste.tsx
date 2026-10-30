"use client";

import { useId } from "react";
import { formatearDistancia } from "@/lib/formato";

/**
 * Un campo numérico del formulario de Ajustes: etiqueta, entrada con su
 * unidad, ayuda y, si no vale, el motivo (enlazado con `aria-describedby`).
 * Es texto con teclado numérico y no `type="number"`: así se valida igual en
 * todos los navegadores y se acepta la coma decimal.
 */
export function CampoDeAjuste({
  etiqueta,
  valor,
  alCambiar,
  error,
  ayuda,
  unidad,
  decimal = false,
  ultimoCambio,
}: {
  etiqueta: string;
  valor: string;
  alCambiar: (texto: string) => void;
  error?: string;
  ayuda?: string;
  unidad?: string;
  decimal?: boolean;
  /** Cuándo se cambió por última vez; `null` si sigue en su valor inicial. */
  ultimoCambio?: string | null;
}) {
  const id = useId();
  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-tinta">
        {etiqueta}
      </label>
      <div className="mt-1.5 flex items-center gap-2">
        <input
          id={id}
          type="text"
          inputMode={decimal ? "decimal" : "numeric"}
          autoComplete="off"
          spellCheck={false}
          className="field w-28"
          value={valor}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            [ayuda ? idAyuda : null, error ? idError : null]
              .filter(Boolean)
              .join(" ") || undefined
          }
          onChange={(evento) => alCambiar(evento.target.value)}
        />
        {unidad ? <span className="text-sm text-muted">{unidad}</span> : null}
      </div>
      {error ? (
        <p id={idError} className="mt-1.5 text-sm text-error">
          {error}
        </p>
      ) : null}
      {ayuda ? (
        <p id={idAyuda} className="mt-1.5 text-xs text-muted">
          {ayuda}
        </p>
      ) : null}
      {ultimoCambio !== undefined ? (
        <p className="mt-1 text-xs text-muted">
          {ultimoCambio
            ? `Último cambio ${formatearDistancia(ultimoCambio)}.`
            : "Sin cambios desde el valor inicial."}
        </p>
      ) : null}
    </div>
  );
}
