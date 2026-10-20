import { Languages } from "lucide-react";
import { Conversacion, Fuentes, Nota, PaginaGuia, Seccion, Tabla, Tarjetas, Texto } from "@/components/pagina-guia";
import { metadataDePagina } from "@/lib/seo";

/**
 * Atención en gallego (2026-10-20). Hechos del producto:
 * backend/src/lib/idiomas/zona.ts activa el gallego por código postal en
 * Galicia; catalogo.ts da el saludo («{negocio}, atendete unha intelixencia
 * artificial. En que te axudo?»). Cifras: IGE, Enquisa estrutural a fogares
 * 2023. Ley: Lei 2/2012 gallega de protección de consumidores.
 */
const ruta = "/recepcionista-ia-en-gallego";
const titulo = "Recepcionista de IA que atiende en gallego";
const descripcion =
  "En Galicia tu recepcionista de IA atiende en gallego a quien llama en gallego y en castellano a quien prefiere el castellano. Incluido en todos los planes.";

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
          En Galicia casi la mitad de la gente habla gallego a diario, y en muchas villas es lo normal al otro lado del
          teléfono. Tu recepcionista de IA entiende el gallego desde la primera palabra y contesta en gallego, sin pedir
          a nadie que cambie de idioma. A quien llama en castellano, le atiende en castellano.
        </p>
      }
      faqs={[
        {
          question: "¿Se activa solo el gallego?",
          answer:
            "Sí. Si la dirección de tu negocio está en Galicia, el código postal basta para que entienda y conteste en gallego. Para que además salude en gallego, elige el gallego como idioma principal en Ajustes.",
        },
        {
          question: "¿Y si mis clientes mezclan gallego y castellano?",
          answer:
            "Es lo más habitual y no pasa nada: la recepcionista sigue el idioma en que le hablan en cada momento y la cita queda igual de bien reservada.",
        },
        {
          question: "¿Puedo escribir en gallego al Gestor por WhatsApp?",
          answer:
            "Sí. Si le escribes en gallego para cambiar un horario o una ausencia, te contesta en gallego.",
        },
        {
          question: "¿Las confirmaciones por WhatsApp llegan en gallego?",
          answer:
            "La conversación por teléfono sí. Los mensajes automáticos de WhatsApp salen de plantillas que Meta aprueba idioma por idioma; las vamos ampliando y hoy pueden llegar en castellano.",
        },
        {
          question: "Tengo un negocio en el Bierzo o en Asturias occidental. ¿Puedo usarlo?",
          answer:
            "Sí, pero allí no se activa solo: elige el gallego como idioma principal y atenderá en gallego y en castellano.",
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
        { href: "/guias/ley-y-recepcionista-de-ia", titulo: "La ley y la recepcionista de IA" },
        { href: "/barberia", titulo: "Recepcionista de IA para barberías" },
      ]}
      cierre="Que ninguna chamada quede sen atender."
    >
      <Seccion titulo="El gallego al teléfono, en cifras" entradilla={<p>Lo que dice la última encuesta del Instituto Galego de Estatística.</p>}>
        <Tabla
          cabecera={["Galicia, 2023 (población de 5 años o más)", "Valor"]}
          filas={[
            ["Habla siempre en gallego", "24,37 %"],
            ["Habla más gallego que castellano", "21,86 %"],
            ["Habla más castellano que gallego", "24,11 %"],
            ["Niñas y niños de 5 a 14 años que hablan siempre en gallego", "7,04 %"],
          ]}
          nota="Fuente: IGE, Enquisa estrutural a fogares. Coñecemento e uso do galego (resumen del 11-10-2024)."
        />
        <div className="mt-6">
          <Texto>
            <p>
              Sumando las dos primeras filas, el 46,23 % de la población habla gallego de forma habitual, y entre los niños
              es mucho menos frecuente: el gallego pesa sobre todo en adultos y mayores. Es mucha de la clientela que
              prefiere llamar antes que reservar por una app, la que llama a la peluquería de toda la vida y espera que le
              contesten como siempre.
            </p>
          </Texto>
        </div>
      </Seccion>

      <Seccion fondo titulo="Así suena en una peluquería de Lugo">
        <div className="grid gap-8 lg:grid-cols-2">
          <Texto>
            <p>
              El negocio saluda en castellano, que es su idioma principal. La clienta habla en gallego y la recepcionista
              continúa en gallego, con la agenda delante: ofrece un hueco real y pide el nombre para la reserva.
            </p>
            <p>
              Con el gallego como idioma principal, el saludo es: <strong>«Perruquería Uxía, atendete unha intelixencia
              artificial. En que te axudo?»</strong>. Nombra el negocio y avisa de que es una IA en la primera frase.
            </p>
          </Texto>
          <Conversacion
            etiqueta="Ejemplo de llamada en gallego"
            turnos={[
              { quien: "recepcionista", texto: "Perruquería Uxía, te atiende su asistente de inteligencia artificial. ¿En qué te ayudo?" },
              { quien: "cliente", texto: "Ola! Quería unha cita para cortar o pelo mañá pola tarde." },
              { quien: "recepcionista", texto: "Claro. Mañá ás cinco e media hai oco con Uxía. A nome de quen a reservo?" },
              { quien: "cliente", texto: "A nome de Antía." },
            ]}
          />
        </div>
      </Seccion>

      <Seccion titulo="Dónde marca la diferencia">
        <Tarjetas
          items={[
            {
              titulo: "Villas y rural",
              texto: "Donde el gallego es la lengua de la calle, una recepción que contesta en castellano suena a centralita de fuera. En gallego suena a tu negocio.",
            },
            {
              titulo: "Clientela mayor",
              texto: "Mucha gente mayor prefiere llamar a usar una app, y habla más gallego. No tiene que adaptarse ella: se adapta la recepcionista.",
            },
            {
              titulo: "Ciudades bilingües",
              texto: "En A Coruña o Vigo se mezclan los dos idiomas. La recepcionista cambia con cada cliente, sin preguntar.",
            },
          ]}
        />
      </Seccion>

      <Seccion fondo titulo="Lo que dice la ley gallega" estrecha>
        <Texto>
          <p>
            La <strong>Lei 2/2012, de 28 de marzo, gallega de protección general de las personas consumidoras y
            usuarias</strong> reconoce en su artículo 46.1 el derecho a usar cualquiera de las dos lenguas oficiales en
            las relaciones de consumo, y deja a la administración el papel de incentivar el uso del gallego en las
            empresas (art. 46.3). Donde sí concreta una obligación es en las reclamaciones: la respuesta debe darse en la
            lengua del contrato y, en todo caso, en una lengua oficial de Galicia (art. 33.5).
          </p>
        </Texto>
        <div className="mt-6">
          <Nota titulo="Ocho idiomas más">
            Castellano, inglés, francés, alemán, italiano, portugués, neerlandés y ruso en todos los planes: útil en el
            Camino de Santiago o en las Rías Baixas en verano.
          </Nota>
        </div>
      </Seccion>

      <Fuentes
        consultadas="2026-10-20"
        fuentes={[
          { nombre: "IGE: Coñecemento e uso do galego, resumen de resultados 2023", url: "https://www.ige.gal/estatico/html/gl/OperacionsEstruturais/Resumo_resultados_EEF_Galego.html" },
          { nombre: "Lei 2/2012 gallega de protección de las personas consumidoras y usuarias", url: "https://www.boe.es/buscar/act.php?id=BOE-A-2012-5595" },
        ]}
      />
    </PaginaGuia>
  );
}
