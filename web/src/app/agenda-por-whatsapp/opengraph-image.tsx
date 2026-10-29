import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt = "Tu asistente por WhatsApp, la que trabaja para ti | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Tu asistente por WhatsApp",
    titulo: "Tu asistente por WhatsApp, la que trabaja para ti",
    subtitulo: "Si falta alguien, te dice qué citas tenía, comprueba dónde caben y avisa a cada cliente.",
    pie: "Incluida en todos los planes",
    derecha: { tipo: "panel", grande: "«Marta está de baja hoy»", pequeno: "¿Confirmas? Marcar a Marta como ausente" },
  });
}
