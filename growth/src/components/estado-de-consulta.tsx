import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ErrorDeCarga } from "@/components/error-de-carga";
import { EsqueletoDeLista } from "@/components/esqueleto";

/**
 * Los tres estados de una consulta (cargando, error, datos) en un solo
 * sitio. Con `placeholderData: keepPreviousData` (las listas paginadas) no
 * vuelve al esqueleto al cambiar de página.
 */
export function EstadoDeConsulta<T>({
  consulta,
  titulo,
  filas = 4,
  alto,
  children,
}: {
  consulta: UseQueryResult<T, Error>;
  /** Título del aviso de error: «No se pudo cargar la bandeja». */
  titulo?: string;
  filas?: number;
  alto?: string;
  children: (datos: T) => ReactNode;
}) {
  if (consulta.isPending) return <EsqueletoDeLista filas={filas} alto={alto} />;
  if (consulta.isError) {
    return (
      <ErrorDeCarga
        error={consulta.error}
        titulo={titulo}
        alReintentar={() => void consulta.refetch()}
      />
    );
  }
  return <>{children(consulta.data)}</>;
}
