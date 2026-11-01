import {
  ORDEN_DE_DETECCION_EN_PLACES,
  PERFILES_DE_SECTOR,
} from "./sectores/perfiles.js";

/**
 * Tipos de negocio soportados. Lo que cambia según el tipo (las pautas del
 * prompt, el saludo, la detección por Google Places, la etiqueta) vive en su
 * perfil (lib/sectores/perfiles.ts). La app y la web tienen su copia de la
 * lista (frontend/src/lib/business-type.ts y web/src/lib/business-type.ts).
 */
export const BUSINESS_TYPES = [
  "peluqueria",
  "centro-de-estetica",
  "salon-de-unas",
  "barberia",
  "fisioterapia",
  "pestanas-y-cejas",
  "spa-y-masajes",
  "peluqueria-canina",
  "other",
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const BUSINESS_TYPE_LABELS = Object.fromEntries(
  BUSINESS_TYPES.map((tipo) => [tipo, PERFILES_DE_SECTOR[tipo].etiqueta])
) as Record<BusinessType, string>;

export function isBusinessType(value: unknown): value is BusinessType {
  return (
    typeof value === "string" && BUSINESS_TYPES.includes(value as BusinessType)
  );
}

export function normalizeBusinessType(value: unknown): BusinessType {
  return isBusinessType(value) ? value : "other";
}

/**
 * Detecta el tipo de negocio a partir de la ficha de Google Places.
 *
 * `primaryType` es la categoría principal que Google asigna al sitio y es la
 * única señal fiable: `types` es un saco sin orden garantizado, así que una
 * peluquería que además hace manicuras («Peluquería X» con
 * `types: ["hair_salon", "nail_salon", ...]`) caía en «Salón de uñas» y la
 * landing le enseñaba la demo equivocada. Solo si Google no devuelve
 * `primaryType` se recurre a `types`.
 */
export function detectBusinessTypeFromPlace(place: {
  primaryType?: string | null;
  types?: string[] | null;
}): BusinessType {
  const fromPrimary = detectBusinessTypeFromPlaceTypes(
    place.primaryType ? [place.primaryType] : []
  );
  if (fromPrimary !== "other") return fromPrimary;
  return detectBusinessTypeFromPlaceTypes(place.types);
}

/** El primer tipo de ORDEN_DE_DETECCION_EN_PLACES con alguna de sus
 * palabras dentro de algún `type` de la ficha. */
export function detectBusinessTypeFromPlaceTypes(
  placeTypes: string[] | null | undefined
): BusinessType {
  if (!Array.isArray(placeTypes)) return "other";
  const tipos = placeTypes.map((tipo) => tipo.toLowerCase());
  return (
    ORDEN_DE_DETECCION_EN_PLACES.find((businessType) =>
      PERFILES_DE_SECTOR[businessType].palabrasDePlaces.some((palabra) =>
        tipos.some((tipo) => tipo.includes(palabra.toLowerCase()))
      )
    ) ?? "other"
  );
}
