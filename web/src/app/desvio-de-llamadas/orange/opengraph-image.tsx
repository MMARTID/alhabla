import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt =
  "Desviar llamadas en Orange y Amena a tu recepcionista de IA | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Desvío en Orange y Amena",
    titulo: "Desviar llamadas en Orange a tu recepcionista de IA",
    subtitulo:
      "Eliges los segundos de espera, y el fijo tiene dos juegos de códigos según tu cobertura.",
    pie: "También si eras de Amena",
    derecha: {
      tipo: "panel",
      grande: "5–20 s",
      pequeno: "Tú eliges cuándo salta",
    },
  });
}
