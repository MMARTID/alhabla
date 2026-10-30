"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useId, useState } from "react";
import { InsigniaDeEstadoDeEjecucion } from "@/components/insignia";
import {
  formatearDistancia,
  formatearDuracion,
  formatearFechaYHora,
} from "@/lib/formato";
import { etiquetaDeCodigoDeDescarte } from "@/lib/etiquetas";
import type { EjecucionResumen } from "@/lib/types";
import { DetalleDeEjecucionAbierto } from "./detalle-de-ejecucion";
import { ETIQUETA_DE_DISPARADOR, estaColgada, leerResumen } from "./utilidades";

/** Cuántos motivos de descarte caben en la fila; el resto, en el detalle. */
const MOTIVOS_EN_LA_FILA = 4;

/**
 * Una ejecución en la lista: cuándo empezó, cuánto tardó, con qué versión de
 * los prompts y qué resumen dejó. Se abre para ver el detalle (que solo se
 * pide al abrirla).
 */
export function FilaDeEjecucion({
  ejecucion,
}: {
  ejecucion: EjecucionResumen;
}) {
  const [abierta, setAbierta] = useState(false);
  const idDetalle = useId();
  const resumen = leerResumen(ejecucion.resumen);
  const enCurso = ejecucion.estado === "en_curso";
  const colgada = estaColgada(ejecucion);
  const Chevron = abierta ? ChevronUp : ChevronDown;

  return (
    <li className="panel overflow-hidden">
      <button
        type="button"
        aria-expanded={abierta}
        aria-controls={idDetalle}
        onClick={() => setAbierta((valor) => !valor)}
        className="block w-full p-4 text-left hover:bg-relleno focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-morado sm:p-5"
      >
        <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <span className="min-w-0 text-sm font-semibold text-tinta">
            {formatearFechaYHora(ejecucion.inicio)}
            <span className="font-normal text-muted">
              {" "}
              ·{" "}
              {ETIQUETA_DE_DISPARADOR[ejecucion.disparador] ??
                ejecucion.disparador}
            </span>
          </span>
          <span className="flex items-center gap-2">
            <InsigniaDeEstadoDeEjecucion estado={ejecucion.estado} />
            <Chevron className="h-4 w-4 text-apagado" aria-hidden="true" />
          </span>
        </span>

        <span className="mt-1 block text-xs text-muted">
          {enCurso
            ? `En curso desde ${formatearDistancia(ejecucion.inicio)}`
            : formatearDuracion(ejecucion.duracionSegundos)}
          {" · "}
          {ejecucion.oportunidades}{" "}
          {ejecucion.oportunidades === 1 ? "oportunidad" : "oportunidades"}
          {ejecucion.versionPrompts ? (
            <>
              {" · prompts "}
              <span className="font-mono">{ejecucion.versionPrompts}</span>
            </>
          ) : null}
        </span>

        {resumen.contadores.length > 0 ? (
          <span className="mt-2 block text-sm text-tinta-2">
            {resumen.contadores.map((c) => `${c.n} ${c.texto}`).join(" · ")}
          </span>
        ) : null}

        {resumen.motivos.length > 0 ? (
          <span className="mt-1 block break-words text-xs text-muted">
            Descartes:{" "}
            {resumen.motivos
              .slice(0, MOTIVOS_EN_LA_FILA)
              .map((m) => `${etiquetaDeCodigoDeDescarte(m.codigo)} ${m.n}`)
              .join(" · ")}
            {resumen.motivos.length > MOTIVOS_EN_LA_FILA ? " · …" : ""}
          </span>
        ) : null}

        {colgada ? (
          <span className="mt-2 block text-sm text-aviso">
            Lleva más de 6 h en curso: lo más probable es que se interrumpiera.
            La próxima ejecución que se abra la cerrará como error.
          </span>
        ) : null}
        {ejecucion.error ? (
          <span className="mt-2 line-clamp-2 break-words text-sm text-error">
            {ejecucion.error}
          </span>
        ) : null}
      </button>
      <div id={idDetalle} className={abierta ? "block" : "hidden"}>
        {abierta ? <DetalleDeEjecucionAbierto id={ejecucion.id} /> : null}
      </div>
    </li>
  );
}
