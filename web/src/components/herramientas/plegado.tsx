import type { ReactNode } from "react";

/**
 * La explicación de una herramienta, plegada debajo de ella: el método, los
 * límites o la ley siguen en la página (y en el HTML, para buscadores) sin
 * empujar la herramienta fuera de la primera pantalla.
 */
export function Plegado({
  id,
  titulo,
  children,
}: {
  id?: string;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <details
      id={id}
      className="group scroll-m-24 rounded-3xl border border-linea bg-superficie"
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-3xl p-5 marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-morado sm:p-6">
        <h3 className="text-lg font-bold text-tinta">{titulo}</h3>
        <span
          className="text-xl leading-none text-morado transition group-open:rotate-45 motion-reduce:transition-none"
          aria-hidden="true"
        >
          +
        </span>
      </summary>
      <div className="space-y-6 border-t border-linea px-5 pb-6 pt-5 sm:px-6">
        {children}
      </div>
    </details>
  );
}
