import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt = "Alhabla vs Bland AI | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Comparativa",
    titulo: "Alhabla vs Bland AI",
    subtitulo: "IA de voz para sectores regulados o la recepcionista ya hecha para tu negocio con cita.",
    derecha: { tipo: "panel", grande: "Bland AI", pequeno: "Datos de su web, con fuentes" },
  });
}
