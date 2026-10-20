import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt = "Secretaria virtual o recepcionista de IA | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Secretaria telefónica",
    titulo: "Secretaria virtual o recepcionista de IA",
    subtitulo: "Un recado o una cita cerrada: qué compras con cada una.",
    derecha: { tipo: "panel", grande: "Cita cerrada" },
  });
}
