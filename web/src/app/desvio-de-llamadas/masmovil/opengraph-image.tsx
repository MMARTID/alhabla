import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt =
  "Desviar llamadas en MásMóvil a tu recepcionista de IA | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Desvío en MásMóvil",
    titulo: "Desviar llamadas en MásMóvil a tu recepcionista de IA",
    subtitulo:
      "Los códigos del fijo y del móvil, y por qué del fijo a un fijo no gastas minutos.",
    pie: "Móvil y fijo",
    derecha: {
      tipo: "panel",
      grande: "*61*",
      pequeno: "Del fijo, sin gastar minutos",
    },
  });
}
