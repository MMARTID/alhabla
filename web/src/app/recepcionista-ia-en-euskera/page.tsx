import { Languages } from "lucide-react";
import { Conversacion, Fuentes, ListaCheck, Nota, PaginaGuia, Seccion, Tabla, Texto } from "@/components/pagina-guia";
import { metadataDePagina } from "@/lib/seo";

/**
 * Atención en euskera (2026-10-20). Hechos del producto:
 * backend/src/lib/idiomas/zona.ts activa el euskera por código postal en
 * Euskadi (no en Navarra); catalogo.ts da el saludo («Kaixo, {negocio}.
 * Adimen artifizial bat naiz.») y las voces de Soniox. Cifras: VII Encuesta
 * Sociolingüística 2021 del Gobierno Vasco. Ley: Ley 4/2023 de Euskadi.
 */
const ruta = "/recepcionista-ia-en-euskera";
const titulo = "Recepcionista de IA que atiende en euskera";
const descripcion =
  "En Euskadi tu recepcionista de IA entiende y contesta en euskera a quien llama en euskera, y en castellano a quien prefiere el castellano. Sin configurar nada.";

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
          En una peluquería de Tolosa o una barbería de Getxo, una parte de la clientela llama en euskera y otra en
          castellano, y a veces la misma persona cambia a mitad de frase. Tu recepcionista de IA sigue el idioma de quien
          llama: si le hablan en euskera, contesta en euskera; si le hablan en castellano, en castellano.
        </p>
      }
      faqs={[
        {
          question: "¿Tengo que activar algo para que hable euskera?",
          answer:
            "No, si tu negocio está en Euskadi: se activa solo por el código postal de tu dirección. Si quieres que además salude en euskera, elige el euskera como idioma principal en Ajustes.",
        },
        {
          question: "Mi negocio está en Navarra. ¿Puede atender en euskera?",
          answer:
            "Sí, pero no se activa solo, porque en buena parte de Navarra la clientela habla castellano. Elige el euskera como idioma principal y saludará en euskera y entenderá también a quien hable en castellano.",
        },
        {
          question: "¿Qué euskera habla, batua o el de mi zona?",
          answer:
            "Habla euskera batua, el estándar que se enseña en la escuela y que entiende todo el mundo.",
        },
        {
          question: "¿Las confirmaciones de WhatsApp también van en euskera?",
          answer:
            "La conversación por teléfono sí. Los mensajes automáticos de WhatsApp salen de plantillas que aprueba Meta idioma por idioma; las vamos ampliando y hoy pueden llegar en castellano.",
        },
        {
          question: "¿Puedo hablar en euskera con el Gestor por WhatsApp?",
          answer:
            "Sí. Si le escribes en euskera para cambiar tu agenda, te contesta en euskera.",
        },
        {
          question: "¿Cuesta más?",
          answer: "No. El euskera va incluido en todos los planes, también en el de entrada.",
        },
      ]}
      relacionadas={[
        { href: "/recepcionista-ia-en-catalan", titulo: "Atención en catalán" },
        { href: "/recepcionista-ia-en-gallego", titulo: "Atención en gallego" },
        { href: "/guias/ley-y-recepcionista-de-ia", titulo: "La ley y la recepcionista de IA", texto: "Los derechos lingüísticos de cada comunidad, con su artículo." },
        { href: "/desvio-de-llamadas/euskaltel", titulo: "Desviar llamadas en Euskaltel" },
        { href: "/peluqueria", titulo: "Recepcionista de IA para peluquerías" },
      ]}
      cierre="Euskaraz edo gazteleraz: que te llamen como quieran."
    >
      <Seccion titulo="Por qué seguir el idioma de quien llama" entradilla={<p>Los datos oficiales explican por qué no conviene imponer ninguno de los dos.</p>}>
        <Tabla
          cabecera={["Dato de la Comunidad Autónoma de Euskadi (2021)", "Valor"]}
          filas={[
            ["Población de 16 años o más que habla euskera", "36,2 %"],
            ["En Gipuzkoa / Bizkaia / Álava", "51,8 % / 30,6 % / 22,4 %"],
            ["Jóvenes de 16 a 24 años que lo hablan", "74,5 %"],
            ["Vascohablantes que se expresan con más facilidad en castellano", "44,3 %"],
            ["Población que usa el euskera tanto o más que el castellano", "22 %"],
          ]}
          nota="Fuente: VII Encuesta Sociolingüística 2021, Gobierno Vasco (informe resumen)."
        />
        <div className="mt-6">
          <Texto>
            <p>
              Casi la mitad de quienes saben euskera se manejan mejor en castellano, y en Gipuzkoa la mitad de la gente lo
              habla. Una recepción que solo atiende en un idioma deja a alguien incómodo; una que cambia al idioma de cada
              cliente, no. Por eso la recepcionista no pregunta «¿en qué idioma prefieres?»: escucha y responde.
            </p>
          </Texto>
        </div>
      </Seccion>

      <Seccion fondo titulo="Así suena en una peluquería de Donostia">
        <div className="grid gap-8 lg:grid-cols-2">
          <Texto>
            <p>
              El negocio tiene el castellano como idioma principal, así que el saludo es en castellano. La clienta
              contesta en euskera y la recepcionista sigue en euskera: mira la agenda real y reserva con la estilista que
              tiene hueco.
            </p>
            <p>
              Con el euskera como idioma principal, el saludo es este: <strong>«Kaixo, Itziar ile-apaindegia. Adimen
              artifizial bat naiz. Zertan lagun zaitzaket?»</strong>. Dice el nombre del negocio y que es una
              inteligencia artificial, como pide la ley desde agosto de 2026.
            </p>
          </Texto>
          <Conversacion
            etiqueta="Ejemplo de llamada en euskera"
            turnos={[
              { quien: "recepcionista", texto: "Peluquería Itziar, te atiende su asistente de inteligencia artificial. ¿En qué te ayudo?" },
              { quien: "cliente", texto: "Kaixo! Bihar arratsalderako hitzordua nahi nuke ilea mozteko." },
              { quien: "recepcionista", texto: "Noski. Bihar bost eta erdietan Anerekin badago hutsune bat. Zein izenetan jarriko dut?" },
              { quien: "cliente", texto: "Miren Etxeberriaren izenean." },
            ]}
          />
        </div>
      </Seccion>

      <Seccion titulo="Lo que dice la ley en Euskadi" estrecha>
        <Texto>
          <p>
            La <strong>Ley 4/2023, de 27 de abril, del Estatuto de las personas consumidoras y usuarias</strong> de Euskadi,
            que sustituyó a la Ley 6/2003, reconoce en su artículo 79 el derecho a usar el euskera o el castellano en las
            relaciones de consumo. El artículo 83 concreta a quién obliga a tener los dos idiomas: a los servicios básicos
            y a los grandes establecimientos comerciales; para el resto, la administración debe ir extendiéndolo de forma
            progresiva. Quien recibe subvenciones para integrar el euskera sí debe atender en la lengua elegida (art. 84).
          </p>
          <p>
            Para una peluquería o un centro de estética de barrio no es, por tanto, una obligación legal general. Es una
            forma de tratar bien a la mitad de tus clientes, y una recepcionista que lo hace sola te lo pone fácil.
          </p>
        </Texto>
        <div className="mt-6">
          <Nota titulo="Y el resto de idiomas">
            Además del euskera y el castellano, habla inglés, francés, alemán, italiano, portugués, neerlandés y ruso en
            todos los planes: útil en Donostia o en Bilbao, donde llaman turistas.
          </Nota>
        </div>
      </Seccion>

      <Seccion fondo titulo="Qué necesitas para empezar">
        <ListaCheck
          items={[
            "La dirección del negocio con su código postal de Euskadi: con eso se activa el euskera.",
            "Si quieres que salude en euskera, elegirlo como idioma principal en Ajustes.",
            "El desvío de llamadas de tu operador al número de Alhabla, para conservar tu número de siempre.",
            "Tus servicios, profesionales y horario, que puedes escribir en euskera o en castellano.",
          ]}
        />
      </Seccion>

      <Fuentes
        consultadas="2026-10-20"
        fuentes={[
          { nombre: "Gobierno Vasco: VII Encuesta Sociolingüística 2021 (informe resumen)", url: "https://bideoak2.euskadi.eus/2023/03/20/news_84431/VII_ENCUESTA_SOCIOLING%C3%9C%C3%8DSTICA_resumen.pdf" },
          { nombre: "Eustat: conocimiento de euskera en 2021", url: "https://www.eustat.eus/elementos/el-624-de-las-personas-que-residen-en-la-ca-de-euskadi-tiene-algun-conocimiento-de-euskera-en-2021/not0020231_c.html" },
          { nombre: "Ley 4/2023 del Estatuto de las personas consumidoras y usuarias (Euskadi)", url: "https://www.boe.es/buscar/act.php?id=BOE-A-2023-13537" },
        ]}
      />
    </PaginaGuia>
  );
}
