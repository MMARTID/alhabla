import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt = "Glosario de la recepcionista de IA | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Glosario",
    titulo: "Glosario de la recepcionista de IA",
    subtitulo: "Desvío condicional, contraseña de aplicación, no-show y más.",
    derecha: { tipo: "panel", grande: "A–Z" },
  });
}
