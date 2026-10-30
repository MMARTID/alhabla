import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * «51–100 de 230» con Anterior y Siguiente. No pinta nada si todo cabe en una
 * página. `pagina` empieza en 1, como en la API.
 */
export function Paginacion({
  pagina,
  limite,
  total,
  alCambiar,
  cargando = false,
}: {
  pagina: number;
  limite: number;
  total: number;
  alCambiar: (pagina: number) => void;
  cargando?: boolean;
}) {
  if (total <= limite) return null;
  const desde = (pagina - 1) * limite + 1;
  const hasta = Math.min(pagina * limite, total);
  const ultima = Math.ceil(total / limite);
  return (
    <nav
      aria-label="Paginación"
      className="mt-6 flex items-center justify-between gap-3"
    >
      <p className="text-sm text-muted" aria-live="polite">
        {desde}–{hasta} de {total}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-secondary h-11 px-4"
          disabled={pagina <= 1 || cargando}
          onClick={() => alCambiar(pagina - 1)}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Anterior
        </button>
        <button
          type="button"
          className="btn-secondary h-11 px-4"
          disabled={pagina >= ultima || cargando}
          onClick={() => alCambiar(pagina + 1)}
        >
          Siguiente
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
