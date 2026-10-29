import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt = "Alhabla vs Synthflow | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Comparativa",
    titulo: "Alhabla vs Synthflow",
    subtitulo: "Un contrato anual de gran empresa o una recepcionista hecha para tu negocio.",
    derecha: { tipo: "panel", grande: "Synthflow", pequeno: "Datos de su web, con fuentes" },
  });
}
