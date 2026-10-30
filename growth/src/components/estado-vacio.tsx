import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** «Aquí no hay nada», dicho con honestidad y sin adornos. */
export function EstadoVacio({
  icono: Icono,
  titulo,
  children,
  accion,
}: {
  icono?: LucideIcon;
  titulo: string;
  children?: ReactNode;
  accion?: ReactNode;
}) {
  return (
    <div className="panel flex flex-col items-center px-6 py-12 text-center">
      {Icono ? (
        <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-lavado text-morado">
          <Icono className="h-5 w-5" aria-hidden="true" />
        </span>
      ) : null}
      <h2 className="text-base font-semibold text-tinta">{titulo}</h2>
      {children ? (
        <div className="mt-2 max-w-md text-sm text-muted">{children}</div>
      ) : null}
      {accion ? <div className="mt-5">{accion}</div> : null}
    </div>
  );
}
