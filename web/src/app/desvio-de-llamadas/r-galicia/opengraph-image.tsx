import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt =
  "Desviar llamadas en R (Galicia) a tu recepcionista de IA | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Desvío en R",
    titulo: "Desviar llamadas en R a tu recepcionista de IA",
    subtitulo:
      "Desde la app de R o con los códigos completos, en el móvil y en el fijo.",
    pie: "Y atención en gallego",
    derecha: { tipo: "panel", grande: "App R", pequeno: "Configurar desvíos" },
  });
}
