"use client";

import { Check, Loader2, X } from "lucide-react";
import { useState } from "react";
import { D2DialogoDeConfirmacion } from "@/components/comunes/d2-dialogo-de-confirmacion";
import { useAceptarCompetidor, useQuitarCompetidor } from "@/lib/consultas";
import { AvisoDeErrorDeCompetencia } from "./aviso-de-error";
import { textoDeErrorDeCompetencia } from "./utilidades";

/**
 * «Aceptar» y «Rechazar» de un competidor que propuso el agente. Un propuesto
 * no aplica ninguna regla: aceptarlo lo pasa a «por analizar» (y empieza a
 * contar como competidor) y rechazarlo lo borra. Rechazar pide confirmación.
 * El nombre es texto de un tercero: solo se pinta como texto.
 */
export function AccionesDePropuesta({
  id,
  nombre,
  alRechazar,
  className = "",
}: {
  id: string;
  nombre: string;
  /** Después de rechazarlo (la ficha vuelve a la lista). */
  alRechazar?: () => void;
  className?: string;
}) {
  const aceptar = useAceptarCompetidor(id);
  const quitar = useQuitarCompetidor(id);
  const [rechazando, setRechazando] = useState(false);

  function cancelarRechazo() {
    quitar.reset();
    setRechazando(false);
  }

  function confirmarRechazo() {
    quitar.mutate(undefined, {
      onSuccess: () => {
        setRechazando(false);
        alRechazar?.();
      },
    });
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => aceptar.mutate()}
          disabled={aceptar.isPending}
          className="btn-primary h-11"
        >
          {aceptar.isPending ? (
            <Loader2
              className="h-4 w-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : (
            <Check className="h-4 w-4" aria-hidden="true" />
          )}
          Aceptar <span className="sr-only">a {nombre}</span>
        </button>
        <button
          type="button"
          onClick={() => setRechazando(true)}
          disabled={aceptar.isPending}
          className="btn-secondary h-11"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          Rechazar <span className="sr-only">a {nombre}</span>
        </button>
      </div>
      <AvisoDeErrorDeCompetencia
        className="mt-3"
        error={aceptar.error}
        respaldo="No se pudo aceptar. Inténtalo de nuevo."
      />
      <D2DialogoDeConfirmacion
        abierto={rechazando}
        titulo="¿Rechazar esta propuesta?"
        etiquetaDeConfirmar="Rechazar"
        guardando={quitar.isPending}
        error={
          quitar.isError
            ? textoDeErrorDeCompetencia(
                quitar.error,
                "No se pudo rechazar. Inténtalo de nuevo."
              )
            : null
        }
        alConfirmar={confirmarRechazo}
        alCancelar={cancelarRechazo}
      >
        <p>
          Se borra la propuesta de <strong>{nombre}</strong>. Si el agente lo
          vuelve a encontrar en otra ejecución, podrá proponerlo otra vez.
        </p>
      </D2DialogoDeConfirmacion>
    </div>
  );
}
