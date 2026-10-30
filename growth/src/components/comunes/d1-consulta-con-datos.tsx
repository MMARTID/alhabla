import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ErrorDeCarga } from "@/components/error-de-carga";
import { EsqueletoDeLista } from "@/components/esqueleto";
import { analizarError } from "@/lib/api-errors";

/**
 * Como `EstadoDeConsulta`, pero **no tira lo que ya se ve** cuando falla un
 * refresco en segundo plano.
 *
 * `EstadoDeConsulta` cambia a la pantalla de error en cuanto `isError` es
 * cierto, y TanStack Query lo deja cierto también cuando el refresco falla
 * teniendo ya datos (la sesión caducó, se cortó la red…). En una pantalla con
 * un borrador a medio escribir eso desmontaría el formulario y se perdería el
 * texto. Aquí, con datos, se sigue pintando lo último que llegó y el fallo sale
 * como un aviso aparte, con «Reintentar». Solo sin datos de ningún tipo se
 * enseña la pantalla de error completa.
 */
export function ConsultaConDatos<T>({
  consulta,
  titulo,
  filas = 4,
  alto,
  children,
}: {
  consulta: UseQueryResult<T, Error>;
  titulo?: string;
  filas?: number;
  alto?: string;
  children: (datos: T) => ReactNode;
}) {
  if (consulta.data === undefined) {
    if (consulta.isError) {
      return (
        <ErrorDeCarga
          error={consulta.error}
          titulo={titulo}
          alReintentar={() => void consulta.refetch()}
        />
      );
    }
    return <EsqueletoDeLista filas={filas} alto={alto} />;
  }
  return (
    <>
      {consulta.isError ? (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-aviso-borde bg-aviso-fondo p-3 text-sm"
        >
          <p className="min-w-0 text-aviso">
            <span className="font-semibold">
              No se pudo actualizar lo que ves.
            </span>{" "}
            {analizarError(consulta.error, "Inténtalo de nuevo.").mensaje} Lo
            que hay en pantalla es lo último que llegó.
          </p>
          <button
            type="button"
            onClick={() => void consulta.refetch()}
            disabled={consulta.isFetching}
            className="btn-secondary h-11 shrink-0"
          >
            Reintentar
          </button>
        </div>
      ) : null}
      {children(consulta.data)}
    </>
  );
}
