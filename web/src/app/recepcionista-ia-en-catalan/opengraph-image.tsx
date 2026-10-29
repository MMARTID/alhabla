import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt = "Recepcionista de IA que atiende en catalán | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Català",
    titulo: "Tu recepcionista de IA también atiende en catalán",
    subtitulo: "Y se adapta al valenciano y al balear de quien llama.",
    pie: "Incluido en todos los planes",
    derecha: { tipo: "panel", grande: "Bon dia!", pequeno: "En què et puc ajudar?" },
  });
}
