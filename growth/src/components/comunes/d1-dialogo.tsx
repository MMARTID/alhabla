"use client";

import { X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";

const SELECTOR_DE_FOCO =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Una ventana modal accesible para los formularios del panel.
 *
 * - `role="dialog"` con título y descripción enlazados, foco al primer campo
 *   (o al que lleve `data-autofocus`), el tabulador no se escapa y al cerrar
 *   el foco vuelve a quien la abrió.
 * - Escape y la X la cierran, **pero no mientras `ocupado`**: una decisión en
 *   vuelo no se puede abandonar a medias. Pulsar fuera NO la cierra: en el
 *   móvil un toque perdido tiraría a la basura lo escrito.
 * - Quien la use la monta solo mientras está abierta.
 */
export function Dialogo({
  titulo,
  descripcion,
  alCerrar,
  ocupado = false,
  ancho = "max-w-lg",
  children,
}: {
  titulo: string;
  descripcion?: ReactNode;
  alCerrar: () => void;
  ocupado?: boolean;
  ancho?: string;
  children: ReactNode;
}) {
  const idDelTitulo = useId();
  const idDeLaDescripcion = useId();
  const panel = useRef<HTMLDivElement>(null);
  const contenido = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const quienLaAbrio = document.activeElement as HTMLElement | null;
    const raiz = panel.current;
    // Al campo que lo pida; si no, al primer control del contenido (no a la X).
    const inicial =
      raiz?.querySelector<HTMLElement>("[data-autofocus]") ??
      contenido.current?.querySelector<HTMLElement>(SELECTOR_DE_FOCO) ??
      raiz;
    inicial?.focus();
    const desbordeAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = desbordeAnterior;
      quienLaAbrio?.focus?.();
    };
  }, []);

  function alPulsar(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key === "Escape") {
      evento.stopPropagation();
      if (!ocupado) alCerrar();
      return;
    }
    if (evento.key !== "Tab") return;
    const raiz = panel.current;
    if (!raiz) return;
    const enfocables = Array.from(
      raiz.querySelectorAll<HTMLElement>(SELECTOR_DE_FOCO)
    );
    if (enfocables.length === 0) {
      evento.preventDefault();
      return;
    }
    const primero = enfocables[0];
    const ultimo = enfocables[enfocables.length - 1];
    const activo = document.activeElement;
    if (evento.shiftKey && (activo === primero || activo === raiz)) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && activo === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-[62] flex items-end justify-center bg-oscuro/60 p-4 sm:items-center">
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idDelTitulo}
        aria-describedby={descripcion ? idDeLaDescripcion : undefined}
        aria-busy={ocupado || undefined}
        tabIndex={-1}
        onKeyDown={alPulsar}
        className={`panel max-h-[90dvh] w-full ${ancho} overflow-y-auto bg-elevada p-5 shadow-lg focus:outline-none sm:p-6`}
      >
        <div className="flex items-start justify-between gap-3">
          <h2
            id={idDelTitulo}
            className="text-lg font-semibold text-tinta text-balance"
          >
            {titulo}
          </h2>
          <button
            type="button"
            onClick={alCerrar}
            disabled={ocupado}
            aria-label="Cerrar"
            className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-apagado hover:bg-relleno hover:text-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado disabled:opacity-60"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {descripcion ? (
          <p id={idDeLaDescripcion} className="mt-1 text-sm text-muted">
            {descripcion}
          </p>
        ) : null}
        <div ref={contenido} className="mt-5">
          {children}
        </div>
      </div>
    </div>
  );
}
