import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt = "Alhabla vs Retell AI | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Comparativa",
    titulo: "Alhabla vs Retell AI",
    subtitulo: "Construir tu agente de voz pieza a pieza o tener la recepcionista hecha.",
    derecha: { tipo: "panel", grande: "Retell AI", pequeno: "Datos de su web, con fuentes" },
  });
}
