import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt =
  "Desviar llamadas en Euskaltel a tu recepcionista de IA | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Desvío en Euskaltel",
    titulo: "Desviar llamadas en Euskaltel a tu recepcionista de IA",
    subtitulo:
      "Los códigos bien escritos, los segundos de 5 a 30, el buzón 2242 y el fijo sin cuota.",
    pie: "Y atención en euskera",
    derecha: {
      tipo: "panel",
      grande: "**61*",
      pequeno: "Con los dos asteriscos",
    },
  });
}
