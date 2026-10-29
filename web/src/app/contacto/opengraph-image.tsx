import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";

export const runtime = "nodejs";
export const alt = "Hablar con el equipo de Alhabla";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: "Contacto",
    titulo: "Habla con una persona del equipo antes de empezar",
    subtitulo: "Te lo enseñamos funcionando con tu negocio o te resolvemos las dudas.",
    pastilla: null,
    pie: "hola@alhabla.ai",
    derecha: {
      tipo: "panel",
      grande: "Contacto",
      pequeno: "Te contesta una persona del equipo",
    },
  });
}
