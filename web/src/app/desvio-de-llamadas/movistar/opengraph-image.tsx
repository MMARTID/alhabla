import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt =
  "Desviar llamadas en Movistar a tu recepcionista de IA | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Desvío en Movistar",
    titulo: "Desviar llamadas en Movistar a tu recepcionista de IA",
    subtitulo:
      "Móvil: 0 € por activarlo. Fijo: 4 € al mes por cada tipo de desvío.",
    pie: "Códigos de móvil y fijo",
    derecha: { tipo: "panel", grande: "**61*", pequeno: "Si no respondes" },
  });
}
