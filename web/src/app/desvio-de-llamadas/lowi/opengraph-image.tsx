import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt =
  "Desviar llamadas en Lowi a tu recepcionista de IA | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Desvío en Lowi",
    titulo: "Desviar llamadas en Lowi a tu recepcionista de IA",
    subtitulo:
      "Los códigos del móvil, la gestión en Mi Lowi y lo que dice su ayuda sobre el coste.",
    pie: "Sin perder el contestador",
    derecha: { tipo: "panel", grande: "**61*", pequeno: "Si no contesta" },
  });
}
