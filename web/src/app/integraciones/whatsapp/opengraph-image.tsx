import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt = "Citas por WhatsApp: tus clientes no se bajan nada | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "WhatsApp",
    titulo: "Citas por WhatsApp: tus clientes no se bajan nada",
    subtitulo: "Y que el cliente la cambie respondiendo al mensaje.",
    derecha: { tipo: "panel", grande: "Confirmado ✓" },
  });
}
