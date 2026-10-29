import { imagenOg, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/plantilla";
import { tituloDeSector } from "@/lib/sectores";
import { centroDeEstetica as sector } from "@/lib/sectores/centro-de-estetica";

export const runtime = "nodejs";
export const alt = `${tituloDeSector(sector)} | Alhabla`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return imagenOg({
    etiqueta: sector.nombre,
    titulo: tituloDeSector(sector),
    subtitulo: sector.hero.frase,
    pie: "7 días de prueba · Sin permanencia",
    acento: sector.acento,
    derecha: {
      tipo: "foto",
      fichero: "centro-de-estetica.jpg",
      acento: sector.acento,
    },
  });
}
