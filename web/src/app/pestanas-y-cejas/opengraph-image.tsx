import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt = "Recepcionista de IA para pestañas y cejas | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Pestañas y cejas",
    titulo: "Recepcionista de IA para estudios de pestañas y cejas",
    subtitulo: "Contesta mientras trabajas con pinzas y reserva relleno, juego nuevo o lifting con quien lo domina.",
    pie: "Reserva en Google, Outlook o iCloud",
    derecha: { tipo: "panel", grande: "¿Relleno o juego nuevo?", pequeno: "Pregunta lo justo y reserva lo que toca." },
  });
}
