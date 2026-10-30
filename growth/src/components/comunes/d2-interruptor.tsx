"use client";

/**
 * Interruptor de 52×32 dentro de un objetivo táctil de 44 px. Es controlado:
 * pinta lo que le dicen (`activo`) y avisa de lo que se pide (`alCambiar`),
 * sin cambiar solo. Así la pausa solo se ve activada cuando el backend la
 * guardó de verdad.
 */
export function D2Interruptor({
  activo,
  alCambiar,
  etiqueta,
  deshabilitado = false,
  descripcionId,
}: {
  activo: boolean;
  alCambiar: (activo: boolean) => void;
  etiqueta: string;
  deshabilitado?: boolean;
  /** `id` del texto que explica qué hace. */
  descripcionId?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      aria-describedby={descripcionId}
      disabled={deshabilitado}
      onClick={() => alCambiar(!activo)}
      className="group flex h-11 w-[52px] shrink-0 items-center justify-end focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span
        className={`relative h-8 w-[52px] rounded-full transition-colors duration-200 group-focus-visible:ring-2 group-focus-visible:ring-morado group-focus-visible:ring-offset-2 ${
          activo ? "bg-tinta" : "bg-linea-fuerte"
        }`}
      >
        <span
          className={`absolute top-[3px] h-[26px] w-[26px] rounded-full bg-superficie shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-[left] duration-200 ${
            activo ? "left-[23px]" : "left-[3px]"
          }`}
        />
      </span>
    </button>
  );
}
