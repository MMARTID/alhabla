import { esModoDemo } from "@/lib/modo-demo";

/**
 * Solo con la demostración activa (`npm run dev:demo`): una pastilla fija que
 * dice que nada de lo que se ve es real. A 5 rem del borde en el móvil, por
 * encima de la barra inferior; en el escritorio, abajo a la derecha.
 */
export function FranjaDemo() {
  if (!esModoDemo()) return null;
  return (
    <div
      role="status"
      className="fixed bottom-20 left-3 z-[60] inline-flex items-center gap-2 rounded-full bg-tinta px-3 py-1.5 text-xs font-semibold text-sobre-tinta shadow-lg lg:bottom-4 lg:left-auto lg:right-4"
    >
      <span
        aria-hidden="true"
        className="h-2 w-2 shrink-0 rounded-full bg-morado"
      />
      DEMOSTRACIÓN · datos de prueba
    </div>
  );
}
