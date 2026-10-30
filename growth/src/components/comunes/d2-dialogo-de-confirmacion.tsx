"use client";

import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";

const ENFOCABLES = "button:not([disabled]), [href], input:not([disabled])";

/**
 * Confirma algo que cambia cómo se comporta todo el sistema (la pausa
 * general). Es un diálogo modal de verdad: el foco entra en «Cancelar» (la
 * opción segura), Tab no se sale, Escape y el velo cancelan, y al cerrar el
 * foco vuelve a donde estaba. Mientras guarda no se puede cancelar a medias.
 */
export function D2DialogoDeConfirmacion({
  abierto,
  titulo,
  children,
  etiquetaDeConfirmar,
  etiquetaDeCancelar = "Cancelar",
  guardando = false,
  error,
  alConfirmar,
  alCancelar,
}: {
  abierto: boolean;
  titulo: string;
  /** Lo que va a pasar, dicho sin rodeos. */
  children: ReactNode;
  etiquetaDeConfirmar: string;
  etiquetaDeCancelar?: string;
  guardando?: boolean;
  /** Por qué falló el último intento, si falló. */
  error?: string | null;
  alConfirmar: () => void;
  alCancelar: () => void;
}) {
  const idTitulo = useId();
  const idTexto = useId();
  const dialogo = useRef<HTMLDivElement>(null);
  const cancelar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const previo =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    cancelar.current?.focus();
    return () => previo?.focus();
  }, [abierto]);

  // Los botones se desactivan al guardar y el foco caería a la página de
  // detrás: se queda en el propio diálogo.
  useEffect(() => {
    if (abierto && guardando) dialogo.current?.focus();
  }, [abierto, guardando]);

  if (!abierto || typeof document === "undefined") return null;

  function alPulsarTecla(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key === "Escape") {
      evento.stopPropagation();
      if (!guardando) alCancelar();
      return;
    }
    if (evento.key !== "Tab" || !dialogo.current) return;
    const enfocables = Array.from(
      dialogo.current.querySelectorAll<HTMLElement>(ENFOCABLES)
    );
    if (enfocables.length === 0) return;
    const primero = enfocables[0];
    const ultimo = enfocables[enfocables.length - 1];
    const activo = document.activeElement;
    if (evento.shiftKey && (activo === primero || activo === dialogo.current)) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && activo === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center">
      <div
        aria-hidden="true"
        onClick={guardando ? undefined : alCancelar}
        className="absolute inset-0 bg-black/40"
      />
      <div
        ref={dialogo}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={idTexto}
        tabIndex={-1}
        onKeyDown={alPulsarTecla}
        className="panel relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto bg-elevada p-6 shadow-lg focus:outline-none"
      >
        <h2 id={idTitulo} className="text-lg font-semibold text-tinta">
          {titulo}
        </h2>
        <div
          id={idTexto}
          className="mt-3 space-y-3 text-sm leading-6 text-tinta-2"
        >
          {children}
        </div>
        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-[10px] border border-error-borde bg-error-fondo p-3 text-sm text-error"
          >
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelar}
            type="button"
            className="btn-secondary"
            disabled={guardando}
            onClick={alCancelar}
          >
            {etiquetaDeCancelar}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={guardando}
            onClick={alConfirmar}
          >
            {guardando ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            {etiquetaDeConfirmar}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
