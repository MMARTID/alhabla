import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt =
  "Desviar llamadas en Telecable a tu recepcionista de IA | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Desvío en Telecable",
    titulo: "Desviar llamadas en Telecable a tu recepcionista de IA",
    subtitulo:
      "El móvil con segundos de espera de 5 a 30, el fijo con sus tres códigos y cómo se factura.",
    pie: "Móvil y fijo",
    derecha: { tipo: "panel", grande: "**61*", pequeno: "Con 5 a 30 segundos" },
  });
}
