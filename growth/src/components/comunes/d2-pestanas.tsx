"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";

export type OpcionDePestana<T extends string> = {
  valor: T;
  etiqueta: string;
  /** Un número al lado de la etiqueta («Decisiones 24»). */
  cuenta?: number;
};

/** Pestañas con teclado completo (flechas, Inicio y Fin) y objetivos de 44 px. */
export function D2Pestanas<T extends string>({
  etiqueta,
  idBase,
  opciones,
  valor,
  alCambiar,
}: {
  /** Nombre de la lista de pestañas para lectores de pantalla. */
  etiqueta: string;
  /** Prefijo de los `id` que enlazan cada pestaña con su panel. */
  idBase: string;
  opciones: readonly OpcionDePestana<T>[];
  valor: T;
  alCambiar: (valor: T) => void;
}) {
  const botones = useRef(new Map<T, HTMLButtonElement>());

  function alPulsar(evento: KeyboardEvent<HTMLButtonElement>, indice: number) {
    let destino: number | null = null;
    if (evento.key === "ArrowRight") destino = (indice + 1) % opciones.length;
    else if (evento.key === "ArrowLeft") {
      destino = (indice - 1 + opciones.length) % opciones.length;
    } else if (evento.key === "Home") destino = 0;
    else if (evento.key === "End") destino = opciones.length - 1;
    if (destino === null) return;
    evento.preventDefault();
    const siguiente = opciones[destino];
    alCambiar(siguiente.valor);
    botones.current.get(siguiente.valor)?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={etiqueta}
      className="mb-5 flex flex-wrap gap-2"
    >
      {opciones.map((opcion, indice) => {
        const activa = opcion.valor === valor;
        return (
          <button
            key={opcion.valor}
            ref={(nodo) => {
              if (nodo) botones.current.set(opcion.valor, nodo);
              else botones.current.delete(opcion.valor);
            }}
            type="button"
            role="tab"
            id={`${idBase}-pestana-${opcion.valor}`}
            aria-selected={activa}
            aria-controls={activa ? `${idBase}-panel` : undefined}
            tabIndex={activa ? 0 : -1}
            onClick={() => alCambiar(opcion.valor)}
            onKeyDown={(evento) => alPulsar(evento, indice)}
            className={`inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado ${
              activa
                ? "border-lavado-borde bg-lavado text-morado-tinta"
                : "border-linea bg-superficie text-apagado hover:bg-relleno hover:text-tinta"
            }`}
          >
            {opcion.etiqueta}
            {opcion.cuenta !== undefined ? (
              <span className="text-xs font-medium opacity-80">
                {opcion.cuenta}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** El panel de la pestaña activa: lo enlaza con su pestaña para los lectores de pantalla. */
export function D2PanelDePestana<T extends string>({
  idBase,
  valor,
  children,
}: {
  idBase: string;
  valor: T;
  children: ReactNode;
}) {
  return (
    <div
      role="tabpanel"
      id={`${idBase}-panel`}
      aria-labelledby={`${idBase}-pestana-${valor}`}
    >
      {children}
    </div>
  );
}
