import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt = "Tu recepcionista de IA también atiende en gallego | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Tamén en galego",
    titulo: "Tu recepcionista de IA también atiende en gallego",
    subtitulo: "En Galicia, desde la primera llamada.",
    derecha: { tipo: "panel", grande: "Ola!" },
  });
}
