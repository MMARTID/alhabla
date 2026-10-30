"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useId, useState } from "react";
import { commitCorto, formatearFecha } from "@/lib/formato";
import type { Afirmacion } from "@/lib/types";
import { HistorialDeAfirmacion } from "./historial-de-afirmacion";
import { terminosProhibidos } from "./utilidades";

/**
 * Una afirmación vigente: su clave (la que cita un borrador), el texto, de
 * dónde sale (`ruta#ancla`) y desde qué commit. Las prohibidas enseñan los
 * términos que bloquean. Todo es texto: nada de lo que llega se interpreta.
 */
export function FilaDeAfirmacion({ afirmacion }: { afirmacion: Afirmacion }) {
  const [abierta, setAbierta] = useState(false);
  const idHistorial = useId();
  const prohibida =
    afirmacion.tipo === "prohibida"
      ? terminosProhibidos(afirmacion.valor)
      : null;

  return (
    <li className="px-4 py-4 sm:px-5">
      <p className="break-all font-mono text-xs text-muted">
        {afirmacion.clave}
      </p>
      <p className="mt-1 break-words text-sm text-tinta">{afirmacion.texto}</p>

      {afirmacion.tipo === "prohibida" ? (
        prohibida ? (
          <div className="mt-2">
            <ul
              aria-label="Términos que bloquean un borrador"
              className="flex flex-wrap gap-1.5"
            >
              {prohibida.terminos.map((termino) => (
                <li key={termino}>
                  <span className="inline-flex max-w-full break-all rounded-full border border-error-borde bg-error-fondo px-2.5 py-0.5 text-xs font-semibold text-error">
                    {termino}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-xs text-muted">
              {prohibida.palabrasEnteras
                ? "Se busca como palabra entera."
                : "Se busca dentro de cualquier palabra."}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-xs text-aviso">
            Sin lista de términos: solo cuenta la frase completa.
          </p>
        )
      ) : null}

      <p className="mt-2 break-words text-xs text-muted">
        Fuente{" "}
        <code className="break-all font-mono text-tinta-2">
          {afirmacion.fuente}
        </code>
        {" · commit "}
        <code className="font-mono text-tinta-2">
          {commitCorto(afirmacion.commitSha)}
        </code>
        {" · vigente desde "}
        {formatearFecha(afirmacion.vigenteDesde)}
        {afirmacion.nichoSlug ? ` · sector ${afirmacion.nichoSlug}` : ""}
      </p>

      <button
        type="button"
        aria-expanded={abierta}
        aria-controls={idHistorial}
        onClick={() => setAbierta((valor) => !valor)}
        className="mt-1 -ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-[10px] px-2 text-sm font-medium text-apagado hover:text-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado"
      >
        {abierta ? (
          <ChevronUp className="h-4 w-4" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        )}
        {abierta ? "Ocultar el historial" : "Ver el historial"}{" "}
        <span className="sr-only">de {afirmacion.clave}</span>
      </button>
      <div id={idHistorial} className={abierta ? "mt-2" : "hidden"}>
        {abierta ? <HistorialDeAfirmacion clave={afirmacion.clave} /> : null}
      </div>
    </li>
  );
}
