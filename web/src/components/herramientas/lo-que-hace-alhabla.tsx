import type { ReactNode } from "react";

/**
 * El bloque final de cada herramienta: dos líneas con lo que Alhabla hace en
 * ese mismo problema, sin repetir la página. La regla de confianza solo se
 * pasa donde encaja (mensajes a clientes, cambios de cita).
 */
export function LoQueHaceAlhabla({
  titulo,
  children,
  regla = false,
}: {
  titulo: string;
  children: ReactNode;
  /** Añade «Con tus clientes manda Alhabla. Con tu agenda mandas tú.» */
  regla?: boolean;
}) {
  return (
    <section className="py-12 sm:py-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-lavado-borde bg-lavado p-6 sm:p-8">
          <h2 className="max-w-2xl text-balance text-2xl font-black tracking-tight text-tinta">
            {titulo}
          </h2>
          <div className="mt-3 max-w-2xl space-y-3 text-base leading-7 text-apagado [&_a]:font-semibold [&_a]:text-morado-tinta [&_a]:underline [&_a]:underline-offset-4 [&_strong]:font-semibold [&_strong]:text-tinta">
            {children}
          </div>
          {regla ? (
            <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-tinta">
              Con tus clientes manda Alhabla. Con tu agenda mandas tú.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
