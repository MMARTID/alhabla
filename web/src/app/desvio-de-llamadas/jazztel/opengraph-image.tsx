import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt =
  "Desviar llamadas en Jazztel a tu recepcionista de IA | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Desvío en Jazztel",
    titulo: "Desviar llamadas en Jazztel a tu recepcionista de IA",
    subtitulo:
      "Los códigos del móvil y del fijo, y la forma correcta de poner los segundos de espera.",
    pie: "De 5 a 30 segundos",
    derecha: {
      tipo: "panel",
      grande: "**20#",
      pequeno: "Dos asteriscos, no uno",
    },
  });
}
