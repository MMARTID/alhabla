"use client";

import { commitCorto, formatearFecha } from "@/lib/formato";
import { Insignia } from "@/components/insignia";
import { EstadoDeConsulta } from "@/components/estado-de-consulta";
import { useHistorialDeAfirmacion } from "@/lib/consultas";
import { valorComoTexto } from "./utilidades";

/**
 * Todas las versiones de una clave, la más reciente primero: cuándo cambió un
 * precio o se retiró una prohibición, y desde qué commit. Solo se pide al
 * abrirlo.
 */
export function HistorialDeAfirmacion({ clave }: { clave: string }) {
  const consulta = useHistorialDeAfirmacion(clave);
  return (
    <EstadoDeConsulta
      consulta={consulta}
      titulo="No se pudo cargar el historial de esta afirmación"
      filas={2}
      alto="h-16"
    >
      {({ versiones }) => (
        <ol aria-label={`Versiones de ${clave}`} className="space-y-3">
          {versiones.map((version) => {
            const valor = valorComoTexto(version.valor);
            return (
              <li
                key={version.id}
                className="rounded-[10px] border border-linea bg-relleno p-3"
              >
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                  <Insignia tono={version.vigenteHasta ? "neutro" : "exito"}>
                    {version.vigenteHasta ? "Cerrada" : "Vigente"}
                  </Insignia>
                  <span>
                    Desde {formatearFecha(version.vigenteDesde)}
                    {version.vigenteHasta
                      ? ` hasta ${formatearFecha(version.vigenteHasta)}`
                      : ""}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    commit{" "}
                    <code className="font-mono">
                      {commitCorto(version.commitSha)}
                    </code>
                  </span>
                </p>
                <p className="mt-2 break-words text-sm text-tinta">
                  {version.texto}
                </p>
                <p className="mt-1 break-all text-xs text-muted">
                  Fuente{" "}
                  <code className="font-mono text-tinta-2">
                    {version.fuente}
                  </code>
                </p>
                {valor ? (
                  <details className="mt-1 text-xs">
                    <summary className="flex min-h-11 cursor-pointer items-center font-medium text-apagado hover:text-tinta">
                      Valor
                    </summary>
                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-[10px] bg-superficie p-3 font-mono text-tinta-2">
                      {valor}
                    </pre>
                  </details>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </EstadoDeConsulta>
  );
}
