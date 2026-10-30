"use client";

export type OpcionDeChip<T extends string> = {
  /** `null` es la opción «todos». */
  valor: T | null;
  etiqueta: string;
  cuenta?: number;
};

/**
 * Filtro de una sola opción a la vez, en pastillas con contador. Cada una es
 * un botón con `aria-pressed` (no una pestaña: no cambia de panel, filtra).
 */
export function D2Chips<T extends string>({
  etiqueta,
  opciones,
  valor,
  alCambiar,
}: {
  etiqueta: string;
  opciones: readonly OpcionDeChip<T>[];
  valor: T | null;
  alCambiar: (valor: T | null) => void;
}) {
  return (
    <div role="group" aria-label={etiqueta} className="flex flex-wrap gap-2">
      {opciones.map((opcion) => {
        const activa = opcion.valor === valor;
        return (
          <button
            key={opcion.valor ?? "todos"}
            type="button"
            aria-pressed={activa}
            onClick={() => alCambiar(opcion.valor)}
            className={`inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado ${
              activa
                ? "border-lavado-borde bg-lavado text-morado-tinta"
                : "border-linea bg-superficie text-apagado hover:bg-relleno hover:text-tinta"
            }`}
          >
            {opcion.etiqueta}
            {opcion.cuenta !== undefined ? (
              <span className="text-xs font-medium opacity-80">
                {opcion.cuenta}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
