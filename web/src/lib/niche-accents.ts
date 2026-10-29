import type { NicheAccent } from "./niche-landings";
import type { SectorSlug } from "./sectores/tipos";

/**
 * Colores de acento por sector, separados de los datos de cada landing para
 * que un consumidor que solo necesita el color (p. ej. la pastilla de
 * categoría de la demo) no cargue el copy completo. Un acento por página
 * (DESIGN.md, La Regla del Acento Único).
 *
 * `strong` es el de iconos, bordes y pulsos: pasa 3:1 sobre blanco y sobre
 * el panel negro de la transcripción. Para texto, `deep`, que pasa AA sobre
 * blanco y sobre `soft` en los ocho.
 */
export const NICHE_ACCENTS: Record<SectorSlug, NicheAccent> = {
  peluqueria: { strong: "#b23a68", soft: "#fbe9f1", deep: "#7c2547" },
  "centro-de-estetica": { strong: "#6c4bd8", soft: "#eee9fb", deep: "#46308f" },
  "salon-de-unas": { strong: "#c95c3f", soft: "#fbeae2", deep: "#8e3a24" },
  barberia: { strong: "#a86a1c", soft: "#f7ecd8", deep: "#71470f" },
  fisioterapia: { strong: "#0e7f78", soft: "#e0f1ee", deep: "#0a5751" },
  "pestanas-y-cejas": { strong: "#8f3d97", soft: "#f5e9f6", deep: "#5f2865" },
  "spa-y-masajes": { strong: "#87654a", soft: "#f3ece5", deep: "#5a4231" },
  "peluqueria-canina": { strong: "#2f63b5", soft: "#e7eef9", deep: "#1f437c" },
};
