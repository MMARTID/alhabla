import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt = "Gestiona tu agenda por WhatsApp con IA | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Tu Gestor por WhatsApp",
    titulo: "Gestiona tu agenda por WhatsApp con IA",
    subtitulo: "Marca una baja, mueve sus citas y avisa a cada cliente. Nada cambia sin tu «Confirmar».",
    pie: "Incluido en todos los planes",
    derecha: { tipo: "panel", grande: "«Marta no viene mañana»", pequeno: "¿Confirmas? Marcar a Marta como ausente" },
  });
}
