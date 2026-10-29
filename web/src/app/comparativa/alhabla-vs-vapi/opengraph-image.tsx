import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt = "Alhabla vs Vapi | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Comparativa",
    titulo: "Alhabla vs Vapi",
    subtitulo: "Un agente de voz por piezas, en dólares, o la recepcionista de IA lista.",
    derecha: { tipo: "panel", grande: "Vapi", pequeno: "Datos de su web, con fuentes" },
  });
}
