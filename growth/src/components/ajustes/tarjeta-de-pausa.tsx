"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Pause, Play } from "lucide-react";
import { useId, useState } from "react";
import { D2DialogoDeConfirmacion } from "@/components/comunes/d2-dialogo-de-confirmacion";
import { D2Interruptor } from "@/components/comunes/d2-interruptor";
import { mensajeDeError } from "@/lib/api-errors";
import { claves, useGuardarAjustes } from "@/lib/consultas";
import { formatearDistancia } from "@/lib/formato";
import type { Ajustes } from "@/lib/types";

/**
 * El interruptor general de pausa. No guarda al tocarlo: abre un diálogo que
 * dice lo que hace y solo cambia si confirmas. El interruptor refleja lo que
 * el backend guardó, no lo que se pidió.
 */
export function TarjetaDePausa({ ajustes }: { ajustes: Ajustes }) {
  const pausa = ajustes.valores.pausa;
  const ultimoCambio = ajustes.actualizadoEn.pausa ?? null;
  const idDescripcion = useId();
  const queryClient = useQueryClient();
  const guardar = useGuardarAjustes();
  const [confirmando, setConfirmando] = useState(false);

  function cancelar() {
    guardar.reset();
    setConfirmando(false);
  }

  function confirmar() {
    guardar.mutate(
      { pausa: !pausa },
      {
        onSuccess: (nuevos) => {
          queryClient.setQueryData(claves.ajustes(), nuevos);
          setConfirmando(false);
        },
      }
    );
  }

  const Icono = pausa ? Pause : Play;

  return (
    <section
      aria-labelledby={`${idDescripcion}-titulo`}
      className={`panel p-5 sm:p-6 ${pausa ? "border-aviso-borde bg-aviso-fondo" : ""}`}
    >
      <div className="flex items-start gap-4">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${pausa ? "bg-superficie text-aviso" : "bg-lavado text-morado"}`}
        >
          <Icono className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id={`${idDescripcion}-titulo`}
            className="text-base font-semibold text-tinta"
          >
            Pausa general
          </h2>
          <p
            className={`mt-0.5 text-sm font-medium ${pausa ? "text-aviso" : "text-exito"}`}
            aria-live="polite"
          >
            {pausa
              ? "En pausa: el agente no puede escribir"
              : "En marcha: el agente puede escribir"}
          </p>
          {ultimoCambio ? (
            <p className="mt-0.5 text-xs text-muted">
              Último cambio {formatearDistancia(ultimoCambio)}.
            </p>
          ) : null}
        </div>
        <D2Interruptor
          activo={pausa}
          alCambiar={() => setConfirmando(true)}
          etiqueta="Pausar el agente"
          descripcionId={idDescripcion}
        />
      </div>
      <p id={idDescripcion} className="mt-3 text-sm text-tinta-2">
        Con la pausa activada el backend rechaza todo lo que intente escribir el
        agente: no puede añadir oportunidades, calificarlas, guardar
        investigaciones, redactar borradores, abrir ejecuciones ni sincronizar
        el conocimiento. Tú sigues pudiendo revisar, aprobar y gestionar lo que
        ya tienes.
      </p>

      <D2DialogoDeConfirmacion
        abierto={confirmando}
        titulo={pausa ? "¿Reanudar el agente?" : "¿Pausar el agente?"}
        etiquetaDeConfirmar={pausa ? "Reanudar" : "Pausar"}
        guardando={guardar.isPending}
        error={
          guardar.isError
            ? mensajeDeError(
                guardar.error,
                "No se pudo cambiar la pausa. Inténtalo de nuevo."
              )
            : null
        }
        alConfirmar={confirmar}
        alCancelar={cancelar}
      >
        {pausa ? (
          <>
            <p>
              El agente volverá a poder escribir: añadir oportunidades, redactar
              borradores, abrir ejecuciones y sincronizar el conocimiento.
            </p>
            <p>Queda anotado en el Historial.</p>
          </>
        ) : (
          <>
            <p>
              Mientras esté en pausa, el backend rechaza cualquier escritura del
              agente: no podrá añadir oportunidades, calificarlas, guardar
              investigaciones, redactar borradores, abrir ejecuciones ni
              sincronizar el conocimiento. Puede seguir leyendo y cerrar una
              ejecución que ya estuviera abierta.
            </p>
            <p>
              Tú puedes seguir revisando, aprobando y gestionando lo que ya
              tienes. Queda anotado en el Historial.
            </p>
          </>
        )}
      </D2DialogoDeConfirmacion>
    </section>
  );
}
