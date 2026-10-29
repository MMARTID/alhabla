import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt = "No quiero que nadie pierda ninguna llamada | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Sobre Alhabla",
    titulo: "«No quiero que nadie pierda ninguna llamada.»",
    subtitulo: "Hecho en Sant Celoni (Barcelona).",
    derecha: { tipo: "panel", grande: "Desde 2026" },
  });
}
