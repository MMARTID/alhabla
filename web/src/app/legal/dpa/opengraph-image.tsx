import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt = "Contrato de encargado del tratamiento (DPA) | Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Legal",
    titulo: "Contrato de encargado del tratamiento",
    subtitulo: "Qué hace Alhabla con los datos de tus clientes y cómo los protege.",
    pastilla: null,
    pie: "alhabla.ai",
    derecha: {
      tipo: "panel",
      grande: "DPA",
      pequeno: "Art. 28 del RGPD",
    },
  });
}
