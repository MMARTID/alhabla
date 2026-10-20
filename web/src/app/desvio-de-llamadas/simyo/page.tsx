import Link from "next/link";
import { Timer } from "lucide-react";
import { Codigo } from "@/components/desvio/codigo";
import {
  CampoNumeroDeAlhabla,
  ConNumeroDeAlhabla,
  TablaDeCodigos,
} from "@/components/desvio/codigos-de-desvio";
import {
  Fuentes,
  Nota,
  PaginaGuia,
  Seccion,
  Tabla,
  Texto,
} from "@/components/pagina-guia";
import { metadataDePagina } from "@/lib/seo";

/**
 * Desvío en Simyo (2026-10-20), con simyo.es (preguntas frecuentes de la
 * línea y detalle de tarifas). Lo propio de Simyo: da la fórmula general
 * `**código*número#` y los segundos de 5 a 30, no menciona el desvío si
 * comunica (67) y su fibra va sin voz fija, así que no hay fijo que desviar.
 */

const ruta = "/desvio-de-llamadas/simyo";
const titulo = "Desviar llamadas en Simyo a tu recepcionista de IA";
const descripcion =
  "Códigos de Simyo con segundos de espera de 5 a 30, el desvío si comunica que su ayuda no menciona y qué hacer si tu fibra de Simyo va sin fijo.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

const faqs = [
  {
    question: "¿Simyo tiene desvío cuando estoy comunicando?",
    answer:
      "Su ayuda no lo menciona: lista el de no contesta (61), el de apagado (62) y el de todas (21). El de comunica de la norma es **67*número#; si lo activas, compruébalo con *#67#.",
  },
  {
    question: "¿Cuántos segundos puedo poner antes de que desvíe?",
    answer:
      "Entre 5 y 30. Simyo lo escribe así: **61*número**tiempo#. Por ejemplo, **61*número**25# desvía a los 25 segundos.",
  },
  {
    question: "¿Cuánto cuesta desviar en Simyo?",
    answer:
      "Simyo dice que los desvíos cuestan lo mismo que si hicieses esa llamada desde tu teléfono. Si tu tarifa incluye las llamadas a fijos nacionales, el tramo hasta Alhabla entra ahí.",
  },
  {
    question: "Tengo fibra de Simyo. ¿Puedo desviar el fijo?",
    answer:
      "No hay fijo que desviar: la fibra de Simyo va sin servicio de voz fija. Si quieres un fijo para el negocio, puedes dar el número de Alhabla, que es un fijo geográfico español.",
  },
  {
    question: "¿Cómo quito el desvío?",
    answer:
      "Con ##61# el de no contesta, ##62# el de apagado y ##67# el de comunica, si lo pusiste. Es la fórmula de Simyo: ##código#.",
  },
  {
    question: "¿Cómo sé que está activo?",
    answer:
      "Marca *#61#: te dice a qué número va el desvío y con cuántos segundos. Para estar seguro de que llega a tu recepcionista, usa «Comprobar desvío» en tu panel.",
  },
];

export default function DesvioSimyoPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      migas={[
        { name: "Desvío de llamadas", path: "/desvio-de-llamadas" },
        { name: "Simyo", path: ruta },
      ]}
      etiqueta={{ icono: Timer, texto: "Simyo · móvil" }}
      titulo={titulo}
      entradilla={
        <p>
          Simyo da una fórmula sencilla, <Codigo>**código*número#</Codigo>, y
          deja elegir entre 5 y 30 segundos antes de desviar. Le falta una cosa:
          no menciona el desvío cuando comunicas.
        </p>
      }
      descripcion={descripcion}
      ctaSecundario={{ texto: "Elegir los segundos", href: "#codigos" }}
      ubicacion="desvio_simyo"
      faqs={faqs}
      tituloFaqs="Preguntas sobre el desvío en Simyo"
      relacionadas={[
        {
          href: "/desvio-de-llamadas/orange",
          titulo: "Desvío en Orange",
          texto:
            "También publica los segundos, con un margen más corto en particulares.",
        },
        {
          href: "/desvio-de-llamadas#cual",
          titulo: "Alhabla como número principal",
          texto: "Si no tienes fijo y quieres darle uno a tu negocio.",
        },
        {
          href: "/desvio-de-llamadas/iphone-y-android",
          titulo: "Desvío en iPhone y Android",
          texto: "Dónde está el menú en cada marca.",
        },
        {
          href: "/herramientas/guion-para-atender-el-telefono",
          titulo: "Guion para atender el teléfono",
          texto: "Para las llamadas que sigas cogiendo tú.",
        },
      ]}
      cierre="De 5 a 30 segundos para cogerla tú; después, tu recepcionista."
    >
      <ConNumeroDeAlhabla>
        <Seccion
          id="codigos"
          titulo="Los códigos de Simyo"
          entradilla={
            <p>
              Simyo los resume en tres fórmulas:{" "}
              <Codigo>**código*número#</Codigo> para activar,{" "}
              <Codigo>##código#</Codigo> para quitar y{" "}
              <Codigo>*#código#</Codigo> para consultar. Aquí están ya escritos.
            </p>
          }
        >
          <div className="grid gap-6">
            <CampoNumeroDeAlhabla />
            <TablaDeCodigos
              titulo="Móvil Simyo"
              filas={[
                {
                  tipo: "Si no contestas",
                  recomendado: true,
                  activar: "**61*{N}**{T}#",
                  quitar: "##61#",
                  consultar: "*#61#",
                  segundos: { opciones: [5, 10, 15, 20, 25, 30], inicial: 20 },
                  detalle:
                    "Con los segundos que elijas, como lo publica Simyo.",
                },
                {
                  tipo: "Apagado o sin cobertura",
                  recomendado: true,
                  activar: "**62*{N}#",
                  quitar: "##62#",
                  consultar: "*#62#",
                },
                {
                  tipo: "Si comunicas (no lo menciona Simyo)",
                  recomendado: true,
                  activar: "**67*{N}#",
                  quitar: "##67#",
                  consultar: "*#67#",
                  detalle:
                    "Código de la norma GSM. Compruébalo después de activarlo.",
                },
                {
                  tipo: "Todas",
                  activar: "**21*{N}#",
                  quitar: "##21#",
                  consultar: "*#21#",
                },
              ]}
            />
          </div>
        </Seccion>

        <Seccion
          id="segundos"
          fondo
          titulo="Cuántos segundos poner"
          entradilla={
            <p>
              Simyo es de los operadores con más margen: de 5 a 30 segundos.
              Orange, por ejemplo, deja de 5 a 20 en sus líneas de particulares.
            </p>
          }
        >
          <div className="grid gap-8">
            <Tabla
              cabecera={["Segundos", "Qué pasa"]}
              filas={[
                [
                  "5 o 10",
                  "Casi todas las llamadas pasan a tu recepcionista; apenas te da tiempo a cogerla",
                ],
                [
                  "15 o 20",
                  "Te da margen para dejar lo que estés haciendo si puedes atender",
                ],
                [
                  "25 o 30",
                  "Solo pasan las que de verdad no puedes coger; el cliente espera más",
                ],
              ]}
              nota="Orientativo: lo que tarda cada uno en llegar al teléfono depende del negocio."
            />
            <Texto>
              <p>
                Si no pones segundos, la red mantiene los que hubiera
                configurados. Después de elegir, marca <Codigo>*#61#</Codigo>:
                la respuesta incluye los segundos guardados, y así sabes que el
                cambio ha entrado.
              </p>
              <p>
                <strong>Lo que cuesta.</strong> Según Simyo, los desvíos
                «cuestan lo mismo que si hicieses esa llamada desde tu
                teléfono». El tramo hasta Alhabla es una llamada a un fijo
                nacional: si tu tarifa las incluye, no pagas de más.
              </p>
            </Texto>
          </div>
        </Seccion>

        <Seccion
          id="comunica"
          titulo="El desvío si comunicas, el que falta en la lista"
          entradilla={
            <p>
              Simyo explica el 61, el 62 y el 21. El 67, el de cuando ya estás
              hablando o rechazas una llamada, no aparece.
            </p>
          }
        >
          <Texto>
            <p>
              Sin él, la llamada que entra mientras hablas con otro cliente no
              llega a tu recepcionista: va a donde tenga configurada la red esa
              situación, por ejemplo al buzón. En un negocio que usa mucho el
              teléfono, es justo la llamada que más fácil se pierde.
            </p>
            <p>
              El código de la norma es <Codigo>**67*número#</Codigo>. Que Simyo
              no lo mencione no quiere decir que no funcione, pero tampoco lo
              podemos asegurar. Actívalo, marca <Codigo>*#67#</Codigo> y mira si
              aparece el número de Alhabla. Si tienes la llamada en espera
              activada, ten en cuenta que entonces no «comunicas»: la segunda
              llamada suena en espera y, si no la coges, se aplica el desvío si
              no contestas.
            </p>
          </Texto>
        </Seccion>

        <Seccion id="fijo" fondo titulo="Simyo no tiene fijo">
          <div className="grid gap-8 lg:grid-cols-2">
            <Texto>
              <p>
                En el detalle de sus tarifas, Simyo dice que su fibra va «sin
                servicio de voz fija». No hay, por tanto, ningún fijo de Simyo
                que desviar: todo lo de esta página es para el móvil.
              </p>
            </Texto>
            <Nota tipo="consejo" titulo="Si quieres un fijo para el negocio">
              El número de Alhabla es un fijo geográfico español. Puedes{" "}
              <Link
                href="/desvio-de-llamadas#cual"
                className="font-semibold underline underline-offset-4"
              >
                publicarlo como número principal
              </Link>{" "}
              en Google y en tu web: la recepcionista contesta y, con «Cuándo
              pasarme llamadas», te pasa al móvil las que elijas.
            </Nota>
          </div>
        </Seccion>

        <Seccion
          id="antes"
          titulo="Antes de marcar, mira qué tienes puesto"
          entradilla={
            <p>
              Con la fórmula de consulta de Simyo, <Codigo>*#código#</Codigo>,
              ves en un minuto qué desvíos tiene ya tu línea.
            </p>
          }
        >
          <div className="grid gap-8 lg:grid-cols-2">
            <Texto>
              <p>
                Marca <Codigo>*#61#</Codigo>, <Codigo>*#62#</Codigo> y{" "}
                <Codigo>*#21#</Codigo>, uno detrás de otro. Si alguno enseña un
                número, esa situación ya va a algún sitio: un buzón u otro
                teléfono que pusiste hace tiempo. Apúntalo, por si un día
                quieres volver a dejarlo como estaba.
              </p>
              <p>
                Fíjate sobre todo en el 21. Si el desvío de todas está activo,
                tu móvil no suena nunca, así que los condicionales no llegan a
                entrar en juego. Quítalo con <Codigo>##21#</Codigo> antes de
                activar el 61.
              </p>
            </Texto>
            <Texto>
              <p>
                Después activa los tuyos y repite las consultas: ahora tiene que
                salir el número de Alhabla en el 61 y en el 62, y los segundos
                que elegiste en el 61. Si activaste también el 67, consúltalo
                con <Codigo>*#67#</Codigo>; es la forma más rápida de saber si
                la red de Simyo lo acepta aunque su ayuda no lo mencione.
              </p>
              <p>
                La prueba final es{" "}
                <Link href="/desvio-de-llamadas#comprobar">
                  «Comprobar desvío»
                </Link>
                : Alhabla llama a tu móvil, no lo coges y el panel te dice si la
                llamada ha llegado a tu recepcionista.
              </p>
            </Texto>
          </div>
        </Seccion>

        <Fuentes
          consultadas="2026-10-20"
          fuentes={[
            {
              nombre: "Simyo: preguntas frecuentes sobre tu línea",
              url: "https://www.simyo.es/preguntas-frecuentes/mi-linea.html",
            },
            {
              nombre: "Simyo: detalle de tarifas",
              url: "https://www.simyo.es/detalle-tarifas.html",
            },
          ]}
        />
      </ConNumeroDeAlhabla>
    </PaginaGuia>
  );
}
