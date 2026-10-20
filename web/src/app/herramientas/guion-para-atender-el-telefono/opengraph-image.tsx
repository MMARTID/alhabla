import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt = "Guion para atender el teléfono en un salón o clínica | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Guion gratis",
    titulo: "Guion para atender el teléfono del salón",
    subtitulo: "Seis pasos para que cada llamada termine en una cita bien apuntada. Con variante por sector y versión para imprimir.",
    pie: "Para imprimir",
    derecha: { tipo: "panel", grande: "6 pasos", pequeno: "Del saludo a la cita confirmada" },
  });
}
