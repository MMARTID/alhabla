import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt = "Cuánto cuesta una recepcionista frente a una IA | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Coste de una recepcionista",
    titulo: "Cuánto cuesta una recepcionista frente a una IA",
    subtitulo: "Convenio de 2026 y cotización de empresa, con el cálculo.",
    derecha: { tipo: "panel", grande: "22.900 €/año" },
  });
}
