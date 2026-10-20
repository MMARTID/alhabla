import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt = "Las citas por teléfono, directas a tu Outlook | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Outlook · Microsoft 365",
    titulo: "Las citas por teléfono, directas a tu Outlook",
    subtitulo: "Cuentas personales y de Microsoft 365.",
    derecha: { tipo: "panel", grande: "Agenda conectada" },
  });
}
