import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt = "¿Es legal que una IA conteste el teléfono de tu negocio? | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Guía legal",
    titulo: "¿Es legal que una IA conteste el teléfono de tu negocio?",
    subtitulo: "Aviso de IA, grabación, Ley 10/2025 y recordatorios.",
    derecha: { tipo: "panel", grande: "Art. 50" },
  });
}
