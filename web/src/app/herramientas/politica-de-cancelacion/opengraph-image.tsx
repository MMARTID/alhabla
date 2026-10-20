import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt = "Política de cancelación: generador gratis para salones | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Generador gratis",
    titulo: "Tu política de cancelación, escrita en dos minutos",
    subtitulo: "Plazo, señal y ausencias, con los textos para el cartel, la web y la confirmación, y la ley explicada.",
    pie: "Sin email y sin registro",
    derecha: { tipo: "panel", grande: "24 h", pequeno: "Para anular o cambiar la cita sin coste" },
  });
}
