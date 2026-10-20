import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt = "Desviar llamadas en O2 a tu recepcionista de IA | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Desvío en O2",
    titulo: "Desviar llamadas en O2 a tu recepcionista de IA",
    subtitulo:
      "Los códigos del móvil y del fijo, la confirmación en la app y qué hacer con VoLTE o MultiSIM.",
    pie: "Incluido en tu tarifa",
    derecha: { tipo: "panel", grande: "**61*", pequeno: "Cuando no contesto" },
  });
}
