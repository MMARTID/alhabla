"use client";

import { useMemo, useState } from "react";
import { Insignia } from "@/components/insignia";
import { ETIQUETA_DE_TIPO_DE_AFIRMACION } from "@/lib/etiquetas";
import { commitCorto, formatearFecha } from "@/lib/formato";
import type { Tono } from "@/lib/etiquetas";
import {
  agruparCambios,
  type CambioAgrupado,
  type CambioReciente,
} from "./utilidades";

const ETIQUETA_DE_CAMBIO: Record<CambioAgrupado["cambio"], string> = {
  alta: "Alta",
  cierre: "Retirada",
  modificada: "Modificada",
};

const TONO_DE_CAMBIO: Record<CambioAgrupado["cambio"], Tono> = {
  alta: "exito",
  cierre: "neutro",
  modificada: "morado",
};

/** Cuántos cambios se enseñan antes de pedir «Ver todos». */
const VISIBLES = 5;

/**
 * Lo que cambió en la base en los últimos 30 días: altas, retiradas y
 * modificaciones, con el commit en el que ocurrió. Para auditar cuándo cambió
 * un precio o se retiró una prohibición.
 */
export function CambiosRecientes({
  cambios,
}: {
  cambios: readonly CambioReciente[];
}) {
  const [todos, setTodos] = useState(false);
  const agrupados = useMemo(() => agruparCambios(cambios), [cambios]);
  const visibles = todos ? agrupados : agrupados.slice(0, VISIBLES);

  return (
    <section aria-labelledby="cambios-recientes" className="panel p-4 sm:p-5">
      <h2 id="cambios-recientes" className="text-base font-semibold text-tinta">
        Cambios de los últimos 30 días{" "}
        <span className="font-normal text-muted">{agrupados.length}</span>
      </h2>
      {agrupados.length === 0 ? (
        <p className="mt-2 text-sm text-muted">
          No ha cambiado nada en los últimos 30 días.
        </p>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-linea-suave">
            {visibles.map((cambio, indice) => (
              <li
                key={`${cambio.clave}-${cambio.cambio}-${cambio.en}-${indice}`}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-3"
              >
                <div className="min-w-0">
                  <p className="break-all font-mono text-xs text-tinta">
                    {cambio.clave}
                  </p>
                  <p className="text-xs text-muted">
                    {ETIQUETA_DE_TIPO_DE_AFIRMACION[cambio.tipo] ?? cambio.tipo}{" "}
                    · {formatearFecha(cambio.en)} · commit{" "}
                    <code className="font-mono">
                      {commitCorto(cambio.commitSha)}
                    </code>
                  </p>
                </div>
                <Insignia tono={TONO_DE_CAMBIO[cambio.cambio]}>
                  {ETIQUETA_DE_CAMBIO[cambio.cambio]}
                </Insignia>
              </li>
            ))}
          </ul>
          {agrupados.length > VISIBLES ? (
            <button
              type="button"
              aria-expanded={todos}
              onClick={() => setTodos((valor) => !valor)}
              className="btn-secondary mt-3 h-11 px-4"
            >
              {todos ? "Ver menos" : `Ver los ${agrupados.length} cambios`}
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}
