import { paginasDeLaSeccion } from "@/lib/paginas";
import { SECTORES } from "@/lib/sectores";

/**
 * Lo que queda de los datos antiguos de las landings de sector: los tipos y
 * los enlaces que usa el resto de la web (menús, blog, guiones, simulación
 * de tu asistente). Los textos de cada landing viven en lib/sectores/, un
 * fichero por sector.
 */

/** Los cinco sectores con demo de voz y guiones propios (relato y tu
 * asistente). Los ocho de las landings son `SectorSlug` (lib/sectores). */
export type NicheSlug =
  | "peluqueria"
  | "centro-de-estetica"
  | "salon-de-unas"
  | "barberia"
  | "fisioterapia";

export type NicheAccent = {
  /** Iconos, bordes y pulsos: 3:1 sobre blanco y sobre el panel negro. */
  strong: string;
  /** Fondo suave tintado para chips y botones pulsados. */
  soft: string;
  /** Texto sobre blanco o sobre `soft` (AA). */
  deep: string;
};

/**
 * Lo que enseña la simulación de tu asistente (gestor-simulacion.tsx):
 * tres situaciones, en el orden de los escenarios del guion
 * (lib/gestor-guiones.ts), y una línea de cierre.
 */
export type OwnerAssistantExample = { title: string; description: string };

export type OwnerAssistant = {
  /** Pastilla sobre el título (la portada); las landings de sector no la
   * llevan. */
  badge?: string;
  title: string;
  description: string;
  examples: [
    OwnerAssistantExample,
    OwnerAssistantExample,
    OwnerAssistantExample,
  ];
  /** Línea de cierre: qué pasa de verdad con lo que se confirma por WhatsApp. */
  closing: string;
};

/** Nombre y acento de los cinco sectores con guion, para el blog, la vista
 * previa y los tests de los guiones (que comprueban que hay uno por sector). */
export const nicheLandings: Record<
  NicheSlug,
  { slug: NicheSlug; name: string; accent: NicheAccent }
> = Object.fromEntries(
  (
    [
      "peluqueria",
      "centro-de-estetica",
      "salon-de-unas",
      "barberia",
      "fisioterapia",
    ] as const
  ).map((slug) => [
    slug,
    { slug, name: SECTORES[slug].nombre, accent: SECTORES[slug].acento },
  ])
) as Record<NicheSlug, { slug: NicheSlug; name: string; accent: NicheAccent }>;

/**
 * Los enlaces a las ocho páginas de sector (menús y portada), del registro
 * de páginas.
 */
export const nicheLinks = paginasDeLaSeccion("sectores").map(
  ({ ruta, nombre }) => ({ href: ruta, label: nombre })
);
