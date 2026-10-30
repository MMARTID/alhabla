import type { ReactNode } from "react";

/** Los `id` del texto de ayuda y del error de un campo. */
export function idsDeCampo(id: string) {
  return { ayuda: `${id}-ayuda`, error: `${id}-error` };
}

/** Para `aria-describedby` del control: solo lo que de verdad se pinta. */
export function describedByDeCampo(
  id: string,
  { ayuda, error }: { ayuda?: ReactNode; error?: string | null }
): string | undefined {
  const ids = idsDeCampo(id);
  const lista = [ayuda ? ids.ayuda : null, error ? ids.error : null].filter(
    Boolean
  );
  return lista.length > 0 ? lista.join(" ") : undefined;
}

/**
 * Etiqueta, ayuda y error de un control de formulario. El control (un
 * `<input>`, `<select>` o `<textarea>` con el mismo `id`) va de hijo y quien lo
 * pinta le pone `aria-invalid` y `aria-describedby={describedByDeCampo(...)}`.
 */
export function Campo({
  id,
  etiqueta,
  opcional = false,
  ayuda,
  error,
  children,
}: {
  id: string;
  etiqueta: string;
  opcional?: boolean;
  ayuda?: ReactNode;
  error?: string | null;
  children: ReactNode;
}) {
  const ids = idsDeCampo(id);
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-semibold text-tinta"
      >
        <span>{etiqueta}</span>
        {opcional ? " " : null}
        {opcional ? (
          <span className="text-xs font-normal text-muted">Opcional</span>
        ) : null}
      </label>
      {children}
      {ayuda ? (
        <p id={ids.ayuda} className="mt-1.5 text-xs text-muted">
          {ayuda}
        </p>
      ) : null}
      {error ? (
        <p
          id={ids.error}
          role="alert"
          className="mt-1.5 text-xs font-semibold text-error"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
