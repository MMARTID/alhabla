import type { ReactNode } from "react";

/** El título de cada vista del panel, con su descripción y sus acciones. */
export function EncabezadoDePagina({
  titulo,
  descripcion,
  acciones,
}: {
  titulo: string;
  descripcion?: ReactNode;
  acciones?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-tinta text-balance">
          {titulo}
        </h1>
        {descripcion ? (
          <p className="mt-1 max-w-2xl text-sm text-muted">{descripcion}</p>
        ) : null}
      </div>
      {acciones ? <div className="flex flex-wrap gap-2">{acciones}</div> : null}
    </header>
  );
}
