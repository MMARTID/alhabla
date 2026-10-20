import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt = "Mensaje fuera de horario y de contestador para negocios | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Textos gratis",
    titulo: "Mensajes de contestador y de fuera de horario",
    subtitulo: "Para el buzón del teléfono y el mensaje de ausencia de WhatsApp Business: vacaciones, festivos y con un cliente.",
    pie: "Por sector, listos para grabar",
    derecha: { tipo: "panel", grande: "Cerrado", pequeno: "Abrimos mañana a las diez. Deja tu nombre y tu teléfono." },
  });
}
