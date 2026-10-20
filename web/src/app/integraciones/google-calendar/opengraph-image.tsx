import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt = "Tu recepcionista de IA reserva en tu Google Calendar | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Google Calendar",
    titulo: "Tu recepcionista de IA reserva en tu Google Calendar",
    subtitulo: "Con permisos mínimos y respetando lo que ya tienes apuntado.",
    derecha: { tipo: "panel", grande: "Agenda conectada" },
  });
}
