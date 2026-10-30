import { TriangleAlert } from "lucide-react";
import { analizarError } from "@/lib/api-errors";

/**
 * Lo que se enseña cuando falla una consulta. El texto sale de
 * `analizarError`: el 503 dice «Growth no está configurado.» y un 5xx, el
 * respaldo (nunca el volcado del servidor).
 */
export function ErrorDeCarga({
  error,
  titulo = "No se pudo cargar",
  alReintentar,
}: {
  error: unknown;
  titulo?: string;
  alReintentar?: () => void;
}) {
  const { mensaje } = analizarError(
    error,
    "Inténtalo de nuevo en unos segundos."
  );
  return (
    <div
      role="alert"
      className="panel flex items-start gap-3 border-error-borde bg-error-fondo p-5"
    >
      <TriangleAlert
        className="mt-0.5 h-5 w-5 shrink-0 text-error"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-error">{titulo}</p>
        <p className="mt-1 text-sm text-tinta-2">{mensaje}</p>
        {alReintentar ? (
          <button
            type="button"
            onClick={alReintentar}
            className="btn-secondary mt-4 h-11"
          >
            Reintentar
          </button>
        ) : null}
      </div>
    </div>
  );
}
