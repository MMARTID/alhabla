import { Languages } from "lucide-react";
import { Conversacion, PaginaGuia, Seccion, Texto } from "@/components/pagina-guia";
import { metadataDePagina } from "@/lib/seo";

/**
 * Atención en euskera (2026-10-20; recortada el 2026-10-29: fuera las
 * cifras de la encuesta y casi toda la ley). Hechos del producto:
 * backend/src/lib/idiomas/zona.ts activa el euskera por código postal en
 * Euskadi (no en Navarra); catalogo.ts da el saludo («Kaixo, {negocio}.
 * Adimen artifizial bat naiz.») y las voces que lo hablan. Ley: Ley 4/2023
 * de Euskadi, arts. 79 y 83.
 */
const ruta = "/recepcionista-ia-en-euskera";
const titulo = "Recepcionista de IA que atiende en euskera";
const descripcion =
  "Sí: tu recepcionista de IA atiende en euskera batua y en castellano, según hable quien llama. En Euskadi se activa sola; en Navarra la eliges tú.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

export default function EuskeraPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      migas={[{ name: "Atención en euskera", path: ruta }]}
      etiqueta={{ icono: Languages, texto: "Euskaraz ere bai" }}
      titulo={titulo}
      descripcion={descripcion}
      ubicacion="euskera"
      entradilla={
        <p>
          Sí. Atiende en euskera batua y en castellano: si le hablan en euskera, contesta en euskera; si le hablan en
          castellano, en castellano. En Euskadi se activa sola; en Navarra la eliges tú.
        </p>
      }
      pieza={
        <Conversacion
          etiqueta="Ejemplo de llamada en euskera"
          turnos={[
            { quien: "recepcionista", texto: "Kaixo, Itziar ile-apaindegia. Adimen artifizial bat naiz. Zertan lagun zaitzaket?" },
            { quien: "cliente", texto: "Kaixo! Bihar arratsalderako hitzordua nahi nuke ilea mozteko." },
            { quien: "recepcionista", texto: "Noski. Bihar bost eta erdietan Anerekin badago hutsune bat. Zein izenetan jarriko dut?" },
            { quien: "cliente", texto: "Miren Etxeberriaren izenean." },
          ]}
          pie="Ejemplo con el euskera como idioma principal, en una peluquería de Donostia; los nombres son inventados."
        />
      }
      faqs={[
        {
          question: "¿Qué euskera habla, batua o el de mi zona?",
          answer: "Batua, el estándar que se enseña en la escuela y que entiende todo el mundo.",
        },
        {
          question: "¿Las confirmaciones por WhatsApp también van en euskera?",
          answer:
            "La llamada, sí. Los mensajes automáticos de WhatsApp salen de plantillas que Meta aprueba idioma por idioma, y hoy pueden llegar en castellano.",
        },
        {
          question: "¿Puedo escribirle a tu asistente en euskera?",
          answer: "Sí. Si le escribes en euskera para cambiar tu agenda, te contesta en euskera.",
        },
        {
          question: "¿Cuesta más?",
          answer: "No. El euskera va en todos los planes, también en el de entrada.",
        },
      ]}
      relacionadas={[
        { href: "/recepcionista-ia-en-catalan", titulo: "Atención en catalán" },
        { href: "/recepcionista-ia-en-gallego", titulo: "Atención en gallego" },
        { href: "/desvio-de-llamadas/euskaltel", titulo: "Desviar llamadas en Euskaltel" },
      ]}
      cierre="Euskaraz edo gazteleraz: que te llamen como quieran."
    >
      <Seccion titulo="Cómo se pone en euskera">
        <ul className="grid gap-8 sm:grid-cols-2 sm:gap-12">
          <li className="border-t border-linea-fuerte pt-5">
            <p className="text-base font-bold text-tinta">En Álava, Bizkaia y Gipuzkoa</p>
            <p className="mt-2 max-w-md text-base leading-7 text-apagado">
              No tocas nada: el código postal de tu negocio la activa. Saluda en castellano y sigue en euskera con quien
              le contesta en euskera. Si prefieres que salude en euskera, lo eliges como idioma principal.
            </p>
          </li>
          <li className="border-t border-linea-fuerte pt-5">
            <p className="text-base font-bold text-tinta">En Navarra</p>
            <p className="mt-2 max-w-md text-base leading-7 text-apagado">
              No se activa sola, porque en buena parte de Navarra se llama en castellano. Eliges el euskera como idioma
              principal: saluda en euskera y entiende igual a quien habla en castellano.
            </p>
          </li>
        </ul>
      </Seccion>

      <Seccion fondo titulo="¿Es obligatorio atender en euskera?">
        <Texto>
          <p>
            Para una peluquería o un centro de barrio, no. La{" "}
            <a href="https://www.boe.es/buscar/act.php?id=BOE-A-2023-13537" target="_blank" rel="noreferrer">
              Ley 4/2023 de Euskadi
            </a>{" "}
            reconoce el derecho a usar las dos lenguas, pero solo obliga a los servicios básicos y a los grandes
            establecimientos. Lo demás es tratar bien a quien llama en euskera, y eso la recepcionista lo hace sola.
          </p>
        </Texto>
      </Seccion>
    </PaginaGuia>
  );
}
