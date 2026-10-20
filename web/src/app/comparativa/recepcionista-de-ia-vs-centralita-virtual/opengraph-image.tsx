import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt = "Menos «pulse 1» y más citas cerradas | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Centralita virtual",
    titulo: "Menos «pulse 1» y más citas cerradas",
    subtitulo: "Qué resuelve una centralita y qué una recepcionista de IA.",
    derecha: { tipo: "panel", grande: "Pulse 1" },
  });
}
