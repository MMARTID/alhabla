import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt = "Mensajes para confirmar y recordar citas: plantillas | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Plantillas gratis",
    titulo: "Mensajes para confirmar y recordar citas",
    subtitulo: "WhatsApp y SMS de 160 caracteres para ocho sectores: confirmación, recordatorio, cambio, cancelación y hueco libre.",
    pie: "Listas para copiar",
    derecha: { tipo: "panel", grande: "Jueves 17:30", pequeno: "Si no puedes venir, responde a este mensaje" },
  });
}
