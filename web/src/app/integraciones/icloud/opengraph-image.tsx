import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt = "Las citas, en el calendario de tu iPhone | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Calendario de Apple",
    titulo: "Las citas, en el calendario de tu iPhone",
    subtitulo: "Con tu Apple ID y una contraseña de aplicación.",
    derecha: { tipo: "panel", grande: "iCloud" },
  });
}
