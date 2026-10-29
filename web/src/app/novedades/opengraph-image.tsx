import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt = "Lo que ha cambiado en Alhabla, mes a mes | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Novedades",
    titulo: "Lo que ha cambiado en Alhabla, mes a mes",
    subtitulo: "La agenda de Alhabla, tu asistente por WhatsApp, idiomas y aviso de IA.",
    derecha: { tipo: "panel", grande: "Octubre 2026" },
  });
}
