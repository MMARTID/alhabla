import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt = "Tu recepcionista de IA, con la agenda que ya usas | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Integraciones",
    titulo: "La agenda viene incluida",
    subtitulo: "Y tu Google Calendar, Outlook o iPhone, si los usas, también.",
    derecha: { tipo: "panel", grande: "Google · Outlook · iCloud" },
  });
}
