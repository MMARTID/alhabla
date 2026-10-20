import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt = "Confirmar y recordar citas por WhatsApp | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "WhatsApp",
    titulo: "Confirmar y recordar citas por WhatsApp",
    subtitulo: "Y que el cliente la cambie respondiendo al mensaje.",
    derecha: { tipo: "panel", grande: "Confirmado ✓" },
  });
}
