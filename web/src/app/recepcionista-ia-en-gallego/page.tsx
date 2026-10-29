import { Languages } from "lucide-react";
import { Conversacion, PaginaGuia, Seccion, Texto } from "@/components/pagina-guia";
import { metadataDePagina } from "@/lib/seo";

/**
 * Atención en gallego (2026-10-20; recortada el 2026-10-29: fuera las
 * cifras del IGE, las tarjetas y la ley). Hechos del producto:
 * backend/src/lib/idiomas/zona.ts activa el gallego por código postal en las
 * cuatro provincias de Galicia; catalogo.ts da el saludo («{negocio},
 * atendete unha intelixencia artificial. En que te axudo?»).
 */
const ruta = "/recepcionista-ia-en-gallego";
const titulo = "Recepcionista de IA que atiende en gallego";
const descripcion =
  "Sí: tu recepcionista de IA atiende en gallego a quien llama en gallego y en castellano a quien prefiere el castellano. En Galicia se activa sola.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

export default function GallegoPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      migas={[{ name: "Atención en gallego", path: ruta }]}
      etiqueta={{ icono: Languages, texto: "Tamén en galego" }}
      titulo={titulo}
      descripcion={descripcion}
      ubicacion="gallego"
      entradilla={
        <p>
          Sí. A quien llama en gallego le contesta en gallego, y a quien prefiere el castellano, en castellano. En
          Galicia se activa sola, con el código postal de tu negocio.
        </p>
      }
      pieza={
        <Conversacion
          etiqueta="Ejemplo de llamada en gallego"
          turnos={[
            { quien: "recepcionista", texto: "Perruquería Uxía, atendete unha intelixencia artificial. En que te axudo?" },
            { quien: "cliente", texto: "Ola! Quería unha cita para cortar o pelo mañá pola tarde." },
            { quien: "recepcionista", texto: "Claro. Mañá ás cinco e media hai oco con Uxía. A nome de quen a reservo?" },
            { quien: "cliente", texto: "A nome de Antía." },
          ]}
          pie="Ejemplo con el gallego como idioma principal, en una peluquería de Lugo; los nombres son inventados."
        />
      }
      faqs={[
        {
          question: "¿Y si mis clientes mezclan gallego y castellano?",
          answer:
            "Es lo más normal. La recepcionista contesta en el idioma en que le hablan, y la cita queda igual de bien reservada.",
        },
        {
          question: "¿Las confirmaciones por WhatsApp llegan en gallego?",
          answer:
            "La llamada, sí. Los mensajes automáticos de WhatsApp necesitan una plantilla aprobada por Meta en cada idioma, y hoy pueden llegar en castellano.",
        },
        {
          question: "¿Puedo escribirle a tu asistente en gallego?",
          answer: "Sí. Si le escribes en gallego para cerrar un día o marcar una ausencia, te contesta en gallego.",
        },
        {
          question: "¿Tiene coste aparte?",
          answer: "No. El gallego va incluido en todos los planes.",
        },
      ]}
      relacionadas={[
        { href: "/recepcionista-ia-en-catalan", titulo: "Atención en catalán" },
        { href: "/recepcionista-ia-en-euskera", titulo: "Atención en euskera" },
        { href: "/desvio-de-llamadas/r-galicia", titulo: "Desviar llamadas en R" },
      ]}
      cierre="Que ningunha chamada quede sen atender."
    >
      <Seccion titulo="La clientela de toda la vida, atendida como siempre.">
        <Texto>
          <p>
            Mucha gente prefiere llamar antes que reservar en una aplicación, y en Galicia buena parte de ella habla
            gallego. No tiene que adaptarse nadie: se adapta la recepcionista.
          </p>
          <p>
            En A Coruña, Lugo, Ourense y Pontevedra no configuras nada. Saluda en castellano y sigue en gallego con quien
            le habla en gallego; si quieres que también salude en gallego, lo eliges como idioma principal.
          </p>
        </Texto>
      </Seccion>

      <Seccion fondo titulo="¿Y en el Bierzo o en el occidente de Asturias?">
        <Texto>
          <p>
            Allí no se activa sola, porque el código postal no es de Galicia. Eliges el gallego como idioma principal y
            atiende en gallego y en castellano, igual que en Galicia.
          </p>
        </Texto>
      </Seccion>
    </PaginaGuia>
  );
}
