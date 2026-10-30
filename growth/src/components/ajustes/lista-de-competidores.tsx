"use client";

import { Swords } from "lucide-react";
import { EstadoDeConsulta } from "@/components/estado-de-consulta";
import { EstadoVacio } from "@/components/estado-vacio";
import { useCompetidores } from "@/lib/consultas";

/**
 * Los competidores que conoce el sistema, en solo lectura. Sirven para
 * descartar solas las páginas de un competidor al calificar y para exigir una
 * comparativa con fuente cuando un borrador los nombra. Nombre, dominio y
 * notas vienen de la base: se pintan como texto, nunca como enlace.
 */
export function ListaDeCompetidores() {
  const consulta = useCompetidores();
  return (
    <section aria-labelledby="ajustes-competidores" className="mt-5">
      <h2
        id="ajustes-competidores"
        className="text-base font-semibold text-tinta"
      >
        Competidores
      </h2>
      <p className="mb-3 mt-1 text-sm text-muted">
        Solo lectura. Se usan para descartar solas las páginas de un competidor
        y para exigir una comparativa con fuente cuando un borrador los nombra.
        Añadir o quitar a mano llegará más adelante.
      </p>
      <EstadoDeConsulta
        consulta={consulta}
        titulo="No se pudieron cargar los competidores"
        filas={2}
        alto="h-16"
      >
        {({ data }) =>
          data.length === 0 ? (
            <EstadoVacio icono={Swords} titulo="Todavía no hay competidores">
              Mientras la lista esté vacía, la regla de comparativas con fuente
              no tiene con qué comparar. La rellena el sincronizador del
              conocimiento a partir de las comparativas de la web.
            </EstadoVacio>
          ) : (
            <ul className="panel divide-y divide-linea-suave overflow-hidden">
              {data.map((competidor) => (
                <li
                  key={competidor.id}
                  className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 py-3.5 sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium text-tinta">
                      {competidor.nombre}
                    </p>
                    <p className="break-all font-mono text-xs text-muted">
                      {competidor.dominio}
                    </p>
                    {competidor.notas ? (
                      <p className="mt-1 whitespace-pre-line break-words text-xs text-muted">
                        {competidor.notas}
                      </p>
                    ) : null}
                  </div>
                  <p className="shrink-0 text-xs text-muted">
                    {competidor.oportunidades}{" "}
                    {competidor.oportunidades === 1
                      ? "oportunidad"
                      : "oportunidades"}
                  </p>
                </li>
              ))}
            </ul>
          )
        }
      </EstadoDeConsulta>
    </section>
  );
}
