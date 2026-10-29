import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt = "Alhabla vs ElevenLabs | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Comparativa",
    titulo: "Alhabla vs ElevenLabs",
    subtitulo: "Su plataforma de agentes, su recepcionista Reception y una hecha para España.",
    derecha: { tipo: "panel", grande: "ElevenLabs", pequeno: "ElevenAgents y Reception, con fuentes" },
  });
}
