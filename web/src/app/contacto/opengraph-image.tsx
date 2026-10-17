import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt = "Hablar con el equipo de Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Contacto",
    titulo: "Habla con una persona del equipo antes de empezar",
    subtitulo: "Varias sedes, una franquicia o dudas sobre los planes: cuéntanos tu caso.",
    pastilla: null,
    pie: "hola@alhabla.ai",
    derecha: {
      tipo: "panel",
      grande: "Contacto",
      pequeno: "Te contesta una persona, no un bot",
    },
  });
}
