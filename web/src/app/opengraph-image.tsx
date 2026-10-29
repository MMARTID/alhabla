import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt =
  "Alhabla — Recepción telefónica con IA para negocios con cita previa";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Recepcionista de IA",
    titulo: "No pierdas otra reserva por no contestar el teléfono",
    subtitulo:
      "Atiende tus llamadas para que no pierdas ninguna, reserva en tu agenda y tú lo llevas por WhatsApp.",
    pie: "7 días de prueba · Sin permanencia",
    derecha: {
      tipo: "foto",
      fichero: "general.jpg",
      acento: { strong: "#8b5cf6", deep: "#4f27fc" },
    },
  });
}
