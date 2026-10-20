import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt = "Recepcionista de IA para spa y masajes | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Spa y masajes",
    titulo: "Recepcionista de IA para spas y centros de masaje",
    subtitulo: "Atiende fuera de cabina y reserva masajes de relajación, rituales y circuitos con el terapeuta que toca.",
    pie: "Confirmación por WhatsApp al cliente",
    derecha: { tipo: "panel", grande: "Sin salir de cabina", pequeno: "Masajes y rituales reservados mientras trabajas." },
  });
}
