import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt = "Recepcionista de IA frente a las alternativas | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Comparativas",
    titulo: "Recepcionista de IA frente a las alternativas",
    subtitulo: "Otras IAs, una persona, una secretaria externa o una centralita.",
    derecha: { tipo: "panel", grande: "Con datos" },
  });
}
