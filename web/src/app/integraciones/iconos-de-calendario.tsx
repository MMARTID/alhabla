import { SiApple, SiGooglecalendar } from "@icons-pack/react-simple-icons";

/**
 * Los logotipos de los tres calendarios que conecta Alhabla, para las piezas
 * de producto de /integraciones y sus guías. Cada uno con su color de marca,
 * como en el alta de la app (frontend/src/app/bienvenida/calendar).
 */

export function IconoGoogleCalendar({ className = "h-4 w-4" }: { className?: string }) {
  return <SiGooglecalendar className={className} color="#4285F4" aria-hidden="true" />;
}

export function IconoApple({ className = "h-4 w-4" }: { className?: string }) {
  return <SiApple className={`${className} text-tinta`} aria-hidden="true" />;
}

/** El logotipo de Microsoft: cuatro cuadrados. */
export function IconoMicrosoft({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="1" y="1" width="10.5" height="10.5" fill="#F25022" />
      <rect x="12.5" y="1" width="10.5" height="10.5" fill="#7FBA00" />
      <rect x="1" y="12.5" width="10.5" height="10.5" fill="#00A4EF" />
      <rect x="12.5" y="12.5" width="10.5" height="10.5" fill="#FFB900" />
    </svg>
  );
}
