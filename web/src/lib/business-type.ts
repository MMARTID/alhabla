import type { BusinessType } from "./types";

export type { BusinessType };

export const BUSINESS_TYPES: BusinessType[] = [
  "peluqueria",
  "centro-de-estetica",
  "salon-de-unas",
  "barberia",
  "fisioterapia",
  "pestanas-y-cejas",
  "spa-y-masajes",
  "peluqueria-canina",
  "other",
];

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  peluqueria: "Peluquería",
  "centro-de-estetica": "Centro de estética",
  "salon-de-unas": "Salón de uñas",
  barberia: "Barbería",
  fisioterapia: "Fisioterapia",
  "pestanas-y-cejas": "Pestañas y cejas",
  "spa-y-masajes": "Spa y masajes",
  "peluqueria-canina": "Peluquería canina",
  other: "Otros",
};

export const NICHE_SLUG_TO_BUSINESS_TYPE: Record<string, BusinessType> = {
  peluqueria: "peluqueria",
  "centro-de-estetica": "centro-de-estetica",
  "salon-de-unas": "salon-de-unas",
  barberia: "barberia",
  fisioterapia: "fisioterapia",
  "pestanas-y-cejas": "pestanas-y-cejas",
  "spa-y-masajes": "spa-y-masajes",
  "peluqueria-canina": "peluqueria-canina",
};

// El mismo orden y las mismas palabras que el backend
// (backend/src/lib/sectores/perfiles.ts): se mira de arriba abajo.
export const BUSINESS_TYPE_PLACE_KEYWORDS: Record<BusinessType, string[]> = {
  barberia: ["barber_shop", "barber"],
  "salon-de-unas": ["nail_salon", "nail"],
  "peluqueria-canina": ["pet_groom", "pet_care"],
  peluqueria: ["hair_care", "hair_salon"],
  "centro-de-estetica": ["beauty_salon"],
  "spa-y-masajes": ["massage", "spa"],
  fisioterapia: ["physiotherapist"],
  "pestanas-y-cejas": [],
  other: [],
};

export function isBusinessType(value: unknown): value is BusinessType {
  return (
    typeof value === "string" && BUSINESS_TYPES.includes(value as BusinessType)
  );
}

export function normalizeBusinessType(value: unknown): BusinessType {
  if (isBusinessType(value)) return value;
  if (
    typeof value === "string" &&
    value in NICHE_SLUG_TO_BUSINESS_TYPE
  ) {
    return NICHE_SLUG_TO_BUSINESS_TYPE[value];
  }
  return "other";
}

export function detectBusinessTypeFromPlaceTypes(
  placeTypes: string[] | null | undefined
): BusinessType {
  if (!Array.isArray(placeTypes)) return "other";

  for (const [businessType, keywords] of Object.entries(BUSINESS_TYPE_PLACE_KEYWORDS)) {
    if (businessType === "other") continue;
    for (const placeType of placeTypes) {
      for (const keyword of keywords) {
        if (placeType.toLowerCase().includes(keyword.toLowerCase())) {
          return businessType as BusinessType;
        }
      }
    }
  }

  return "other";
}
