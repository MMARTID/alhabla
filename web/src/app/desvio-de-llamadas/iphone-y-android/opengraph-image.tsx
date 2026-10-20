import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt =
  "Desvío de llamadas en iPhone y Android, paso a paso | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "iPhone y Android",
    titulo: "Desvío de llamadas en iPhone y Android, paso a paso",
    subtitulo:
      "Dónde está el menú en cada marca, por qué el iPhone solo desvía todas y qué ajuste revisar.",
    pie: "Samsung, Huawei, Xiaomi y Pixel",
    derecha: { tipo: "panel", grande: "**61*", pequeno: "Desde el teclado" },
  });
}
