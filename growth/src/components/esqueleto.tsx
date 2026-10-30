/** Un bloque gris que respira mientras llegan los datos. */
export function Esqueleto({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-xl bg-relleno-fuerte motion-reduce:animate-none ${className}`}
    />
  );
}

/** Varias tarjetas de carga, con un aviso para lectores de pantalla. */
export function EsqueletoDeLista({
  filas = 4,
  alto = "h-24",
}: {
  filas?: number;
  alto?: string;
}) {
  return (
    <div role="status" className="space-y-3">
      <span className="sr-only">Cargando…</span>
      {Array.from({ length: filas }, (_, i) => (
        <Esqueleto key={i} className={`${alto} w-full`} />
      ))}
    </div>
  );
}
