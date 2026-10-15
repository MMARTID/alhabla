/**
 * Solo en el entorno de desarrollo fijo (scripts/dev/servir.sh pone estas
 * variables al arrancar la app): dice qué rama enseña la app y lleva al
 * panel de desarrollo. En producción y en las vistas previas de las sesiones
 * no existen y no se pinta nada.
 *
 * Una pastilla flotante y no una barra: no empuja el contenido ni tapa la
 * cabecera; en móvil queda por encima de la barra de pestañas.
 */
export function FranjaDev() {
  const rama = process.env.NEXT_PUBLIC_DEV_RAMA;
  if (!rama) return null;
  const commit = process.env.NEXT_PUBLIC_DEV_COMMIT;
  const panel = process.env.NEXT_PUBLIC_DEV_PANEL_URL ?? "http://localhost:3005";
  return (
    <a
      href={panel}
      target="_blank"
      rel="noreferrer"
      title="Entorno de desarrollo: abre el panel"
      className="fixed bottom-20 left-3 z-[60] inline-flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-full bg-tinta px-3 py-1.5 text-xs font-semibold text-sobre-tinta shadow-lg lg:bottom-3"
    >
      <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-morado" />
      <span>DEV</span>
      <span className="truncate font-mono font-normal">
        {rama}
        {commit ? ` · ${commit}` : ""}
      </span>
    </a>
  );
}
