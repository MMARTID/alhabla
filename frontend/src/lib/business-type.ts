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

type OnboardingStepTexts = {
  heading: string;
  subheading: string;
  cta: string;
};

export const BUSINESS_TYPE_ONBOARDING_TEXTS: Record<
  BusinessType,
  {
    services: OnboardingStepTexts;
    team: OnboardingStepTexts & { employeeLabel: string };
    calendar: OnboardingStepTexts & {
      /** Bajo «En papel o en otro programa»: cómo pasar a la agenda lo que
       * ya tiene apuntado (PLAN-AGENDA-PRINCIPAL.md: la agenda viene
       * puesta; el nombre de la clave es histórico). */
      sinCalendario: string;
    };
  }
> = {
  peluqueria: {
    services: {
      heading: "¿Qué servicios ofrece tu peluquería?",
      subheading: "Marca los cortes, tintes y tratamientos que sí ofreces, para que tu recepcionista pueda reservarlos por teléfono. Elige al menos 4 para continuar.",
      cta: "Continuar con {count} servicio{s}",
    },
    team: {
      heading: "¿Cuántas personas atienden en tu peluquería?",
      subheading: "Configuraremos un profesional por cada persona que coja citas. Podrás renombrarlos después en Agente.",
      cta: "Guardar equipo y continuar",
      employeeLabel: "Estilistas / peluqueros",
    },
    calendar: {
      heading: "Tu agenda ya está lista",
      subheading: "Tu recepcionista reservará citas en ella desde la primera llamada. ¿Tienes ya citas apuntadas en otro sitio?",
      cta: "Seguir",
      sinCalendario: "Cuando entres en el panel, apunta tus próximas citas o bloquea los días que ya tienes llenos. También puedes decírselo a tu asistente por WhatsApp.",
    },
  },
  barberia: {
    services: {
      heading: "¿Qué servicios ofrece tu barbería?",
      subheading: "Marca los cortes, arreglos de barba y packs que sí ofreces, para que tu recepcionista pueda reservarlos por teléfono. Elige al menos 4 para continuar.",
      cta: "Continuar con {count} servicio{s}",
    },
    team: {
      heading: "¿Cuántos barberos trabajan en tu barbería?",
      subheading: "Configuraremos un profesional por cada barbero que coja citas. Podrás renombrarlos después en Agente.",
      cta: "Guardar equipo y continuar",
      employeeLabel: "Barberos",
    },
    calendar: {
      heading: "Tu agenda ya está lista",
      subheading: "Tu recepcionista reservará cortes y barbas en ella desde la primera llamada. ¿Tienes ya citas apuntadas en otro sitio?",
      cta: "Seguir",
      sinCalendario: "Cuando entres en el panel, apunta tus próximas citas o bloquea los días que ya tienes llenos. También puedes decírselo a tu asistente por WhatsApp.",
    },
  },
  "centro-de-estetica": {
    services: {
      heading: "¿Qué servicios ofrece tu centro de estética?",
      subheading: "Marca los tratamientos faciales, masajes y depilaciones que sí ofreces, para que tu recepcionista pueda reservarlos por teléfono. Elige al menos 4 para continuar.",
      cta: "Continuar con {count} servicio{s}",
    },
    team: {
      heading: "¿Cuántas personas atienden en tu centro?",
      subheading: "Configuraremos un profesional por cada persona que coja citas. Podrás renombrarlos después en Agente.",
      cta: "Guardar equipo y continuar",
      employeeLabel: "Esteticistas / terapeutas",
    },
    calendar: {
      heading: "Tu agenda ya está lista",
      subheading: "Tu recepcionista reservará tratamientos en ella desde la primera llamada. ¿Tienes ya citas apuntadas en otro sitio?",
      cta: "Seguir",
      sinCalendario: "Cuando entres en el panel, apunta tus próximas citas o bloquea los días que ya tienes llenos. También puedes decírselo a tu asistente por WhatsApp.",
    },
  },
  "salon-de-unas": {
    services: {
      heading: "¿Qué servicios ofrece tu salón de uñas?",
      subheading: "Marca las manicuras, pedicuras y nail art que sí ofreces, para que tu recepcionista pueda reservarlos por teléfono. Elige al menos 4 para continuar.",
      cta: "Continuar con {count} servicio{s}",
    },
    team: {
      heading: "¿Cuántas personas atienden en tu salón de uñas?",
      subheading: "Configuraremos un profesional por cada persona que coja citas. Podrás renombrarlos después en Agente.",
      cta: "Guardar equipo y continuar",
      employeeLabel: "Técnicas de uñas",
    },
    calendar: {
      heading: "Tu agenda ya está lista",
      subheading: "Tu recepcionista reservará manicuras y pedicuras en ella desde la primera llamada. ¿Tienes ya citas apuntadas en otro sitio?",
      cta: "Seguir",
      sinCalendario: "Cuando entres en el panel, apunta tus próximas citas o bloquea los días que ya tienes llenos. También puedes decírselo a tu asistente por WhatsApp.",
    },
  },
  fisioterapia: {
    services: {
      heading: "¿Qué servicios ofrece tu clínica de fisioterapia?",
      subheading: "Marca las valoraciones, sesiones y rehabilitaciones que sí ofreces, para que tu recepcionista pueda reservarlas por teléfono. Elige al menos 4 para continuar.",
      cta: "Continuar con {count} servicio{s}",
    },
    team: {
      heading: "¿Cuántos fisioterapeutas trabajan en tu clínica?",
      subheading: "Configuraremos un profesional por cada fisioterapeuta que coja citas. Podrás renombrarlos después en Agente.",
      cta: "Guardar equipo y continuar",
      employeeLabel: "Fisioterapeutas",
    },
    calendar: {
      heading: "Tu agenda ya está lista",
      subheading: "Tu recepcionista reservará sesiones en ella desde la primera llamada. ¿Tienes ya citas apuntadas en otro sitio?",
      cta: "Seguir",
      sinCalendario: "Cuando entres en el panel, apunta tus próximas citas o bloquea los días que ya tienes llenos. También puedes decírselo a tu asistente por WhatsApp.",
    },
  },
  "pestanas-y-cejas": {
    services: {
      heading: "¿Qué servicios ofrece tu estudio?",
      subheading: "Marca las extensiones, liftings y tratamientos de cejas que sí ofreces, para que tu recepcionista pueda reservarlos por teléfono. Elige al menos 4 para continuar.",
      cta: "Continuar con {count} servicio{s}",
    },
    team: {
      heading: "¿Cuántas personas atienden en tu estudio?",
      subheading: "Configuraremos un profesional por cada persona que coja citas. Podrás renombrarlos después en Agente.",
      cta: "Guardar equipo y continuar",
      employeeLabel: "Técnicas de pestañas",
    },
    calendar: {
      heading: "Tu agenda ya está lista",
      subheading: "Tu recepcionista reservará citas en ella desde la primera llamada. ¿Tienes ya citas apuntadas en otro sitio?",
      cta: "Seguir",
      sinCalendario: "Cuando entres en el panel, apunta tus próximas citas o bloquea los días que ya tienes llenos. También puedes decírselo a tu asistente por WhatsApp.",
    },
  },
  "spa-y-masajes": {
    services: {
      heading: "¿Qué servicios ofrece tu centro?",
      subheading: "Marca los masajes, circuitos y tratamientos que sí ofreces, para que tu recepcionista pueda reservarlos por teléfono. Elige al menos 4 para continuar.",
      cta: "Continuar con {count} servicio{s}",
    },
    team: {
      heading: "¿Cuántas personas atienden en tu centro?",
      subheading: "Configuraremos un profesional por cada persona que coja citas. Podrás renombrarlos después en Agente.",
      cta: "Guardar equipo y continuar",
      employeeLabel: "Masajistas / terapeutas",
    },
    calendar: {
      heading: "Tu agenda ya está lista",
      subheading: "Tu recepcionista reservará tratamientos en ella desde la primera llamada. ¿Tienes ya citas apuntadas en otro sitio?",
      cta: "Seguir",
      sinCalendario: "Cuando entres en el panel, apunta tus próximas citas o bloquea los días que ya tienes llenos. También puedes decírselo a tu asistente por WhatsApp.",
    },
  },
  "peluqueria-canina": {
    services: {
      heading: "¿Qué servicios ofrece tu peluquería canina?",
      subheading: "Marca los baños, cortes y cuidados que sí ofreces, para que tu recepcionista pueda reservarlos por teléfono. Elige al menos 4 para continuar.",
      cta: "Continuar con {count} servicio{s}",
    },
    team: {
      heading: "¿Cuántas personas atienden en tu peluquería canina?",
      subheading: "Configuraremos un profesional por cada persona que coja citas. Podrás renombrarlos después en Agente.",
      cta: "Guardar equipo y continuar",
      employeeLabel: "Peluqueros caninos",
    },
    calendar: {
      heading: "Tu agenda ya está lista",
      subheading: "Tu recepcionista reservará citas en ella desde la primera llamada. ¿Tienes ya citas apuntadas en otro sitio?",
      cta: "Seguir",
      sinCalendario: "Cuando entres en el panel, apunta tus próximas citas o bloquea los días que ya tienes llenos. También puedes decírselo a tu asistente por WhatsApp.",
    },
  },
  other: {
    services: {
      heading: "¿Qué servicios ofreces?",
      subheading: "Marca los servicios que sí ofreces, para que tu recepcionista pueda reservarlos por teléfono. Elige al menos 4 para continuar.",
      cta: "Continuar con {count} servicio{s}",
    },
    team: {
      heading: "¿Cuántas personas atienden en tu negocio?",
      subheading: "Configuraremos un profesional por cada persona que coja citas. Podrás renombrarlos después en Agente.",
      cta: "Guardar equipo y continuar",
      employeeLabel: "Profesionales",
    },
    calendar: {
      heading: "Tu agenda ya está lista",
      subheading: "Tu recepcionista reservará citas en ella desde la primera llamada. ¿Tienes ya citas apuntadas en otro sitio?",
      cta: "Seguir",
      sinCalendario: "Cuando entres en el panel, apunta tus próximas citas o bloquea los días que ya tienes llenos. También puedes decírselo a tu asistente por WhatsApp.",
    },
  },
};
