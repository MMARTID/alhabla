import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt =
  "Desviar llamadas en Simyo a tu recepcionista de IA | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Desvío en Simyo",
    titulo: "Desviar llamadas en Simyo a tu recepcionista de IA",
    subtitulo:
      "Códigos con segundos de espera de 5 a 30, y el desvío si comunicas que su ayuda no menciona.",
    pie: "Solo móvil",
    derecha: { tipo: "panel", grande: "5–30 s", pequeno: "Antes de desviar" },
  });
}
