"use client";

import { Search } from "lucide-react";
import { useState, type FormEvent } from "react";

/** La etiqueta visible de un campo de filtro. */
const CLASES_DE_ETIQUETA = "text-sm font-medium text-tinta-2";

export type OpcionDeSelector = {
  valor: string;
  etiqueta: string;
};

/** Un `<select>` con su etiqueta; la primera opción (valor vacío) es «todos». */
export function D2CampoSelector({
  etiqueta,
  valor,
  alCambiar,
  opciones,
  textoDeTodos = "Todos",
  className = "",
}: {
  etiqueta: string;
  valor: string;
  alCambiar: (valor: string) => void;
  opciones: readonly OpcionDeSelector[];
  textoDeTodos?: string;
  className?: string;
}) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <span className={CLASES_DE_ETIQUETA}>{etiqueta}</span>
      <select
        className="field w-full"
        value={valor}
        onChange={(evento) => alCambiar(evento.target.value)}
      >
        <option value="">{textoDeTodos}</option>
        {opciones.map((opcion) => (
          <option key={opcion.valor} value={opcion.valor}>
            {opcion.etiqueta}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Un selector de día (`AAAA-MM-DD`). */
export function D2CampoDeFecha({
  etiqueta,
  valor,
  alCambiar,
  invalido = false,
  descripcionDelErrorId,
}: {
  etiqueta: string;
  valor: string;
  alCambiar: (valor: string) => void;
  invalido?: boolean;
  descripcionDelErrorId?: string;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className={CLASES_DE_ETIQUETA}>{etiqueta}</span>
      <input
        type="date"
        className="field w-full px-3"
        value={valor}
        aria-invalid={invalido || undefined}
        aria-describedby={invalido ? descripcionDelErrorId : undefined}
        onChange={(evento) => alCambiar(evento.target.value)}
      />
    </label>
  );
}

/**
 * Un campo de texto que aplica el filtro al pulsar Intro (o «Buscar» del
 * teclado del móvil) o al salir del campo, no en cada letra: el backend corta
 * a 100 peticiones por minuto. Para vaciarlo desde fuera, cambia su `key`.
 */
export function D2CampoDeFiltroDeTexto({
  etiqueta,
  valorAplicado,
  alAplicar,
  placeholder,
  ayuda,
  className = "",
  normalizar = (texto) => texto,
}: {
  etiqueta: string;
  valorAplicado: string;
  alAplicar: (valor: string) => void;
  placeholder?: string;
  ayuda?: string;
  className?: string;
  /** Deja el texto como lo entiende el backend; el campo enseña el resultado. */
  normalizar?: (texto: string) => string;
}) {
  const [borrador, setBorrador] = useState(valorAplicado);

  function aplicar() {
    const limpio = normalizar(borrador.trim());
    setBorrador(limpio);
    if (limpio !== valorAplicado) alAplicar(limpio);
  }

  function alEnviar(evento: FormEvent) {
    evento.preventDefault();
    aplicar();
  }

  return (
    <form role="search" onSubmit={alEnviar} className={`min-w-0 ${className}`}>
      <label className="flex min-w-0 flex-col gap-1.5">
        <span className={CLASES_DE_ETIQUETA}>{etiqueta}</span>
        <span className="relative block">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-tenue"
            aria-hidden="true"
          />
          <input
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            className="field w-full pl-10"
            value={borrador}
            placeholder={placeholder}
            onChange={(evento) => setBorrador(evento.target.value)}
            onBlur={aplicar}
          />
        </span>
      </label>
      {ayuda ? <p className="mt-1 text-xs text-muted">{ayuda}</p> : null}
    </form>
  );
}

/** Una casilla con su texto, con un objetivo táctil de 44 px. */
export function D2CasillaDeVerificacion({
  etiqueta,
  marcada,
  alCambiar,
}: {
  etiqueta: string;
  marcada: boolean;
  alCambiar: (marcada: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-tinta-2">
      <input
        type="checkbox"
        className="h-5 w-5 shrink-0 cursor-pointer rounded-md border-linea-fuerte accent-morado-tinta"
        checked={marcada}
        onChange={(evento) => alCambiar(evento.target.checked)}
      />
      {etiqueta}
    </label>
  );
}
