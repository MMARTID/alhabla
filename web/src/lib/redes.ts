/** Perfiles oficiales de Alhabla. Los enlaza el pie de la web y van en el
 * `sameAs` de la organización (lib/seo.ts), que es lo que dice a Google y a
 * los asistentes de IA que esos perfiles son de esta empresa. Solo perfiles
 * con algo publicado: uno vacío resta confianza. URL canónicas, sin los
 * parámetros de los botones de compartir. */
export const REDES = [
  { red: "linkedin", nombre: "LinkedIn", url: "https://www.linkedin.com/company/alhabla-ai/" },
  { red: "instagram", nombre: "Instagram", url: "https://www.instagram.com/alhabla.ai/" },
  // La página no tiene nombre de usuario: su URL fija es la del identificador.
  { red: "facebook", nombre: "Facebook", url: "https://www.facebook.com/profile.php?id=61594137969498" },
  { red: "youtube", nombre: "YouTube", url: "https://www.youtube.com/@ALHABLA-AI" },
] as const;

export type Red = (typeof REDES)[number]["red"];
