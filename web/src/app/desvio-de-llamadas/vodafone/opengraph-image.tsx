import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt =
  "Desviar llamadas en Vodafone a tu recepcionista de IA | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Desvío en Vodafone",
    titulo: "Desviar llamadas en Vodafone a tu recepcionista de IA",
    subtitulo:
      "Los códigos del móvil y del fijo, lo que cuesta cada llamada desviada y a dónde deja desviar el fijo.",
    pie: "Móvil y fijo",
    derecha: { tipo: "panel", grande: "*61*", pequeno: "Fijo: sin # final" },
  });
}
