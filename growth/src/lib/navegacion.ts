import {
  Activity,
  BookOpen,
  FileText,
  History,
  Inbox,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type Destino = {
  href: string;
  etiqueta: string;
  icono: LucideIcon;
  /** Otras rutas que cuentan como «estar aquí» (la Revisión cuelga de la Bandeja). */
  tambien?: readonly string[];
};

/** Las seis vistas de la Fase 1b. Las otras del plan (Analítica, Backlinks…) llegan después. */
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
  { href: "/ejecuciones", etiqueta: "Ejecuciones", icono: Activity },
  { href: "/ajustes", etiqueta: "Ajustes", icono: Settings },
];

/** En la barra inferior del móvil caben cuatro; el resto va en «Más». */
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
