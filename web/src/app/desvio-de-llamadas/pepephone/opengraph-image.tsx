import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt =
  "Desviar llamadas en Pepephone a tu recepcionista de IA | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Desvío en Pepephone",
    titulo: "Desviar llamadas en Pepephone a tu recepcionista de IA",
    subtitulo:
      "Sin códigos: en Mi Pepephone eliges «otro número» para cada situación.",
    pie: "Paso a paso",
    derecha: {
      tipo: "panel",
      grande: "3 pasos",
      pequeno: "En Ajustes de la línea",
    },
  });
}
