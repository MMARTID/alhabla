import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt =
  "Desviar llamadas en Digi a tu recepcionista de IA | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Desvío en Digi",
    titulo: "Desviar llamadas en Digi a tu recepcionista de IA",
    subtitulo:
      "Los códigos del móvil y del fijo, y lo que no funciona a la vez que el desvío.",
    pie: "Ojo con la itinerancia",
    derecha: { tipo: "panel", grande: "**62*", pequeno: "Y el 61 y el 67" },
  });
}
