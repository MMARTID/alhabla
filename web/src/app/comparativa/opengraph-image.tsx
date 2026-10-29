import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt = "Alhabla frente a plataformas de agentes de voz | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Comparativas",
    titulo: "Alhabla frente a plataformas de agentes de voz",
    subtitulo: "Retell AI, Vapi, Bland AI, Synthflow y ElevenLabs: montar tu agente o tener la recepcionista hecha.",
    derecha: { tipo: "panel", grande: "5 plataformas", pequeno: "Con fuentes" },
  });
}
