import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt = "Recepcionista de IA para peluquería canina | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Peluquería canina",
    titulo: "Recepcionista de IA para peluquerías caninas",
    subtitulo: "Pregunta el tamaño del perro, elige el baño o el corte que toca y confirma la cita al dueño por WhatsApp.",
    pie: "Reserva en Google, Outlook o iCloud",
    derecha: { tipo: "panel", grande: "¿Qué tamaño tiene?", pequeno: "Y reserva el servicio con la duración justa." },
  });
}
