import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt = "Que ningún negocio de barrio pierda un cliente por tener las manos ocupadas | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Sobre Alhabla",
    titulo: "Que ningún negocio de barrio pierda un cliente por tener las manos ocupadas",
    subtitulo: "Hecho en Sant Celoni (Barcelona).",
    derecha: { tipo: "panel", grande: "Desde 2026" },
  });
}
