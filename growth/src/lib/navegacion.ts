import {
  Activity,
  BookOpen,
  FileText,
  History,
  Inbox,
  ListChecks,
  Settings,
  Swords,
  type LucideIcon,
} from "lucide-react";

export type Destino = {
  href: string;
  etiqueta: string;
  icono: LucideIcon;
  /** Otras rutas que cuentan como «estar aquí» (la Revisión cuelga de la Bandeja). */
  tambien?: readonly string[];
};

/**
 * Las ocho vistas del panel (las seis de la Fase 1b, la Competencia de la 2a
 * y las Tareas a mano). Las otras del plan (Analítica, Backlinks…) llegan
 * después.
 */
export const DESTINOS: readonly Destino[] = [
  {
    href: "/bandeja",
    etiqueta: "Bandeja",
    icono: Inbox,
    tambien: ["/oportunidad"],
  },
  { href: "/borradores", etiqueta: "Borradores", icono: FileText },
  { href: "/historial", etiqueta: "Historial", icono: History },
  { href: "/conocimiento", etiqueta: "Conocimiento", icono: BookOpen },
  { href: "/competencia", etiqueta: "Competencia", icono: Swords },
  { href: "/tareas", etiqueta: "Tareas", icono: ListChecks },
  { href: "/ejecuciones", etiqueta: "Ejecuciones", icono: Activity },
  { href: "/ajustes", etiqueta: "Ajustes", icono: Settings },
];

/**
 * En la barra inferior del móvil caben cuatro; el resto (Competencia, Tareas,
 * Ejecuciones y Ajustes) va en «Más».
 */
export const DESTINOS_DE_LA_BARRA = DESTINOS.slice(0, 4);
export const DESTINOS_DE_MAS = DESTINOS.slice(4);

function coincide(pathname: string, ruta: string): boolean {
  return pathname === ruta || pathname.startsWith(`${ruta}/`);
}

export function estaActivo(pathname: string, destino: Destino): boolean {
  return (
    coincide(pathname, destino.href) ||
    (destino.tambien ?? []).some((ruta) => coincide(pathname, ruta))
  );
}
