import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt = "Alhabla vs fonio | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Comparativa",
    titulo: "Alhabla vs fonio",
    subtitulo: "Qué incluye cada recepcionista de IA para un negocio en España.",
    derecha: { tipo: "panel", grande: "20-10-2026" },
  });
}
