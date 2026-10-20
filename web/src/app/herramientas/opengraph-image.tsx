import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt = "Herramientas gratis para salones, barberías y clínicas | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Herramientas gratis",
    titulo: "Herramientas gratis para el teléfono de tu negocio",
    subtitulo: "Calculadora de llamadas perdidas, plantillas de recordatorio, guion, contestador y política de cancelación.",
    pie: "Sin email y sin registro",
    derecha: { tipo: "panel", grande: "5 herramientas", pequeno: "Gratis, para usar hoy" },
  });
}
