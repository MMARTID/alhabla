import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt =
  "Desviar llamadas en Yoigo a tu recepcionista de IA | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Desvío en Yoigo",
    titulo: "Desviar llamadas en Yoigo a tu recepcionista de IA",
    subtitulo:
      "Lo que publica Yoigo para el móvil y el fijo, y qué hacer con el contestador 633 y el aviso 556.",
    pie: "Del fijo a un fijo, ilimitado",
    derecha: {
      tipo: "panel",
      grande: "633",
      pequeno: "Su contestador, tu pista",
    },
  });
}
