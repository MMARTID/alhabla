/**
 * El registro crea el negocio con `name: "Negocio de <email>"`
 * (modules/auth/routes.ts) hasta que el dueño pone el suyo. Ese nombre
 * provisional no se le dice ni se le escribe nunca a nadie: ni en WhatsApp
 * (nombreParaCliente, nombreParaWhatsapp) ni en el saludo de voz
 * (lib/idiomas/catalogo.ts).
 */
export const PREFIJO_DE_NOMBRE_PROVISIONAL = "Negocio de ";

/**
 * Nombre del negocio sin saltos ni espacios seguidos, o null si no hay uno
 * que se pueda decir: vacío, el provisional del registro o cualquier cosa con
 * un email dentro. No recorta: cada canal pone su límite (WhatsApp, 60).
 */
export function nombreDelNegocioDecible(nombre: string): string | null {
  const limpio = nombre.replace(/\s+/g, " ").trim();
  if (
    !limpio ||
    limpio.startsWith(PREFIJO_DE_NOMBRE_PROVISIONAL) ||
    limpio.includes("@")
  ) {
    return null;
  }
  return limpio;
}
