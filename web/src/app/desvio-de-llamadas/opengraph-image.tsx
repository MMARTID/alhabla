import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt =
  "Desvío de llamadas a tu recepcionista de IA, por operador | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Desvío de llamadas",
    titulo: "Las llamadas que no coges, a tu recepcionista de IA",
    subtitulo:
      "Qué desvío poner y los códigos de cada operador, en móvil y en fijo.",
    pie: "Con tu número de siempre",
    derecha: { tipo: "panel", grande: "**61*", pequeno: "Si no contestas" },
  });
}
