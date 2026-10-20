import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt = "Tu agenda de siempre, con alguien que la llena por teléfono | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Integraciones",
    titulo: "Tu agenda de siempre, con alguien que la llena por teléfono",
    subtitulo: "Google Calendar, Outlook, Calendario de Apple y WhatsApp.",
    derecha: { tipo: "panel", grande: "Google · Outlook · iCloud" },
  });
}
