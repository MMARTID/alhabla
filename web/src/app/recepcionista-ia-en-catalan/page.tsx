import { Languages } from "lucide-react";
import { Conversacion, PaginaGuia, Seccion } from "@/components/pagina-guia";
import { metadataDePagina } from "@/lib/seo";

/**
 * Atención en catalán (2026-10-20; corta y sobre PaginaGuia desde el
 * 2026-10-29). La búsqueda que la motivó es «recepcionista ia valenciano».
 *
 * Todo lo que dice sale del backend:
 * - lengua cooficial automática por el código postal del negocio:
 *   backend/src/lib/idiomas/zona.ts (Cataluña y Baleares → catalán; sin la
 *   Comunitat Valenciana);
 * - el catalán puede ser el idioma principal, y con cualquier principal
 *   habla además los siete de ULTRA_HABLA: lib/idiomas/catalogo.ts
 *   (MERCADOS.ES, idiomasQueHabla);
 * - el saludo es `IDIOMAS["ca-ES"].saludo` y su `notaParaElPrompt` pide
 *   adaptarse a las formas valencianas y baleares;
 * - tu asistente contesta en catalán si le escriben en catalán
 *   (lib/gestorPayload.ts).
 */
const ruta = "/recepcionista-ia-en-catalan";
const titulo = "Recepcionista de IA que atiende en catalán";
const descripcion =
  "Sí: tu recepcionista de IA entiende y contesta en catalán, y se adapta al valenciano y al balear de quien llama. En Cataluña y Baleares se activa sola.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

export default function RecepcionistaEnCatalanPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      migas={[{ name: "Atención en catalán", path: ruta }]}
      etiqueta={{ icono: Languages, texto: "Català" }}
      titulo={titulo}
      descripcion={descripcion}
      ubicacion="catalan"
      entradilla={
        <p>
          Sí. Entiende y contesta en catalán, y se adapta al valenciano y al balear de quien llama. En Cataluña y
          Baleares se activa sola; en la Comunitat Valenciana la eliges tú.
        </p>
      }
      pieza={
        <Conversacion
          etiqueta="Ejemplo de llamada en catalán"
          turnos={[
            { quien: "recepcionista", texto: "Perruqueria Núria, t'atén una intel·ligència artificial. En què et puc ajudar?" },
            { quien: "cliente", texto: "Hola! Voldria hora per tallar-me els cabells demà a la tarda." },
            { quien: "recepcionista", texto: "És clar. Demà tinc lloc a les cinc i mitja amb la Marta. A quin nom la reservo?" },
            { quien: "cliente", texto: "A nom de la Carme." },
          ]}
          pie="Ejemplo con el catalán como idioma principal; el negocio y los nombres son inventados."
        />
      }
      faqs={[
        {
          question: "¿Puede saludar en catalán y atender también en castellano?",
          answer:
            "Sí. Con el catalán como idioma principal saluda en catalán, y si quien llama habla en castellano, sigue en castellano. Con el castellano como principal pasa al revés.",
        },
        {
          question: "¿Las confirmaciones por WhatsApp llegan en catalán?",
          answer:
            "La llamada, sí. Los mensajes automáticos de WhatsApp los aprueba Meta idioma por idioma y hoy pueden llegar en castellano.",
        },
        {
          question: "¿Puedo escribirle a tu asistente en catalán?",
          answer: "Sí. Si le escribes en catalán para cambiar tu agenda, te contesta en catalán.",
        },
        {
          question: "¿Cuesta más?",
          answer: "No. El catalán va en todos los planes, también en el de entrada.",
        },
      ]}
      relacionadas={[
        { href: "/recepcionista-ia-en-euskera", titulo: "Atención en euskera" },
        { href: "/recepcionista-ia-en-gallego", titulo: "Atención en gallego" },
        {
          href: "/desvio-de-llamadas",
          titulo: "Desvío de llamadas",
          texto: "Para que las llamadas que no coges lleguen a tu recepcionista.",
        },
      ]}
      cierre="Que cap trucada es quedi sense atendre."
    >
      <Seccion titulo="Dónde se activa sola y dónde la eliges">
        <dl className="grid gap-8 sm:grid-cols-2 sm:gap-12">
          <div className="border-t border-linea-fuerte pt-5">
            <dt className="text-base font-bold text-tinta">Cataluña y Baleares</dt>
            <dd className="mt-2 max-w-md text-base leading-7 text-apagado">
              Basta el código postal de tu negocio. Saluda en castellano y contesta en catalán a quien le habla en
              catalán. Para que salude en catalán, lo eliges como idioma principal.
            </dd>
          </div>
          <div className="border-t border-linea-fuerte pt-5">
            <dt className="text-base font-bold text-tinta">Comunitat Valenciana</dt>
            <dd className="mt-2 max-w-md text-base leading-7 text-apagado">
              No se activa sola, porque en buena parte de la Comunitat se llama en castellano. Si tu clientela habla
              valenciano, eliges el catalán como idioma principal y listo.
            </dd>
          </div>
        </dl>
      </Seccion>

      <Seccion
        fondo
        titulo="Valenciano y balear, con las palabras de quien llama."
        entradilla={
          <>
            <p>
              Para la recepcionista son el mismo idioma que el catalán. Lo entiende, y tiene la instrucción de seguir las
              formas valencianas o baleares de cada cliente: nadie tiene que cambiar su manera de hablar para pedir hora.
            </p>
            <p>
              En Cataluña, además, que te atiendan en catalán es un derecho del consumidor (
              <a
                href="https://www.boe.es/buscar/act.php?id=BOE-A-2010-13115"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-morado-tinta underline underline-offset-4"
              >
                Codi de consum, art. 128-1
              </a>
              ).
            </p>
          </>
        }
      />

      <Seccion
        titulo="Y nadie se queda sin atender por el idioma."
        entradilla={
          <p>
            Con cualquier idioma principal habla también castellano, inglés, francés, alemán, italiano, portugués,
            neerlandés y ruso. El turista que llama desde Sitges o desde Palma tiene su cita igual.
          </p>
        }
      />
    </PaginaGuia>
  );
}
