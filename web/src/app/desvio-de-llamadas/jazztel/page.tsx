import Link from "next/link";
import { Asterisk } from "lucide-react";
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
  Pasos,
  Seccion,
  Tabla,
  Texto,
} from "@/components/pagina-guia";
import { metadataDePagina } from "@/lib/seo";

/**
 * Desvío en Jazztel (2026-10-20), con ayuda.jazztel.com (móvil y servicios del
 * fijo). Lo propio de Jazztel: publica los segundos de 5 a 30 pero con un
 * solo asterisco antes (`*ss#`), distinto del estándar `**ss#` que usa Orange,
 * de su mismo grupo; probable errata, sin verificar en red. Su tabla del móvil
 * omite almohadillas finales y el fijo se quita sin almohadilla final.
 */

const ruta = "/desvio-de-llamadas/jazztel";
const titulo = "Desviar llamadas en Jazztel a tu recepcionista de IA";
const descripcion =
  "Códigos de Jazztel para móvil y fijo, cómo poner los segundos de espera (su ayuda trae una errata probable) y cómo apartar el contestador del fijo.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

const faqs = [
  {
    question: "¿Qué código uso para elegir los segundos en Jazztel?",
    answer:
      "Jazztel escribe **61*número*ss#, con un solo asterisco antes de los segundos. La norma GSM, y Orange, que es de su mismo grupo, usan dos: **61*número**20#. Usa la forma estándar y marca *#61# para ver los segundos que ha guardado la red.",
  },
  {
    question: "¿Entre cuántos segundos puedo elegir?",
    answer: "Jazztel indica un mínimo de 5 y un máximo de 30 segundos.",
  },
  {
    question: "En su tabla, el código del 61 no lleva # al final. ¿Lo pongo?",
    answer:
      "Sí. En la tabla del móvil de Jazztel faltan las almohadillas finales del 61 y del 62, pero los demás códigos de esa misma tabla las llevan y la norma también. Marca **61*número#.",
  },
  {
    question: "¿Cuánto cuesta el desvío en Jazztel?",
    answer:
      "Activarlo es gratis. Pagas la llamada desviada según tu tarifa; con una tarifa plana de voz y sin pasar su límite, Jazztel dice que es gratuito.",
  },
  {
    question: "¿Cómo se quita el desvío del fijo?",
    answer:
      "Descuelga y marca #61 para el de no contestas, #67 para el de ocupado o #21 para el de todas. En el fijo, Jazztel los publica sin almohadilla al final.",
  },
  {
    question: "Tengo contestador en el fijo. ¿Me quita las llamadas?",
    answer:
      "Sí, si está activo. El de ausencia se quita con #10 y el de ocupado con #11. Hazlo antes de activar el desvío a tu recepcionista.",
  },
  {
    question: "¿Qué quita ##002# en el móvil?",
    answer:
      "Todos los desvíos de la línea a la vez. Para quitar solo el de Alhabla, mejor ##61# (y ##67# o ##62# si los pusiste).",
  },
];

export default function DesvioJazztelPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      migas={[
        { name: "Desvío de llamadas", path: "/desvio-de-llamadas" },
        { name: "Jazztel", path: ruta },
      ]}
      etiqueta={{ icono: Asterisk, texto: "Jazztel · móvil y fijo" }}
      titulo={titulo}
      entradilla={
        <p>
          Jazztel publica los cuatro desvíos del móvil y deja elegir entre 5 y
          30 segundos de espera. El problema es cómo lo escribe: a su código de
          los segundos le falta, casi seguro, un asterisco.
        </p>
      }
      descripcion={descripcion}
      ctaSecundario={{ texto: "Ir al fijo", href: "#fijo" }}
      ubicacion="desvio_jazztel"
      faqs={faqs}
      tituloFaqs="Preguntas sobre el desvío en Jazztel"
      relacionadas={[
        {
          href: "/desvio-de-llamadas/orange",
          titulo: "Desvío en Orange",
          texto: "Su mismo grupo, con la sintaxis estándar de los segundos.",
        },
        {
          href: "/desvio-de-llamadas",
          titulo: "El desvío en todos los operadores",
          texto: "Tabla resumen y cómo comprobarlo.",
        },
        {
          href: "/desvio-de-llamadas/iphone-y-android",
          titulo: "Desvío en iPhone y Android",
          texto: "Por si prefieres el menú del teléfono.",
        },
        {
          href: "/herramientas/mensajes-de-contestador",
          titulo: "Mensajes de contestador",
          texto: "Si quieres mantener el contestador en otra línea.",
        },
      ]}
      cierre="Tu línea de Jazztel, con alguien que coge siempre."
    >
      <ConNumeroDeAlhabla>
        <Seccion
          id="movil"
          titulo="En el móvil Jazztel"
          entradilla={
            <p>
              Los códigos son los de la norma GSM. Jazztel añade la consulta (
              <Codigo>*#61#</Codigo> y compañía) y <Codigo>##002#</Codigo> para
              quitarlos todos.
            </p>
          }
        >
          <div className="grid gap-6">
            <CampoNumeroDeAlhabla />
            <TablaDeCodigos
              titulo="Móvil Jazztel"
              subtitulo="Con la almohadilla final que a la tabla de Jazztel le falta en el 61 y en el 62."
              filas={[
                {
                  tipo: "Si no contestas, con segundos",
                  recomendado: true,
                  activar: "**61*{N}**{T}#",
                  quitar: "##61#",
                  consultar: "*#61#",
                  segundos: { opciones: [5, 10, 15, 20, 25, 30], inicial: 20 },
                  detalle:
                    "Forma estándar, con dos asteriscos antes de los segundos.",
                },
                {
                  tipo: "Si no contestas",
                  activar: "**61*{N}#",
                  quitar: "##61#",
                  consultar: "*#61#",
                },
                {
                  tipo: "Si comunicas",
                  recomendado: true,
                  activar: "**67*{N}#",
                  quitar: "##67#",
                  consultar: "*#67#",
                },
                {
                  tipo: "Apagado o sin cobertura",
                  recomendado: true,
                  activar: "**62*{N}#",
                  quitar: "##62#",
                  consultar: "*#62#",
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
          titulo="Los segundos: un asterisco que no cuadra"
          entradilla={
            <p>
              Jazztel da un mínimo de 5 segundos y un máximo de 30, y lo escribe
              así: <Codigo>**61*número de teléfono de destino*ss#</Codigo>.
            </p>
          }
        >
          <div className="grid gap-8">
            <Texto>
              <p>
                Entre el número y los segundos hay un hueco que la norma reserva
                para el tipo de servicio, y que casi nunca se rellena. Al
                quedarse vacío, salen dos asteriscos seguidos:{" "}
                <Codigo>**61*número**20#</Codigo>. Es lo que dice la
                especificación 3GPP y lo que publica Orange, que es del mismo
                grupo que Jazztel. Con un solo asterisco, la red podría leer el
                20 como ese tipo de servicio y no como segundos.
              </p>
              <p>
                Lo más probable es que sea una errata de su página. No lo hemos
                podido probar en una línea de Jazztel, así que la recomendación
                es la forma estándar y comprobar el resultado.
              </p>
            </Texto>
            <Tabla
              cabecera={["Forma", "Código", "Qué hacer"]}
              filas={[
                [
                  "Como la escribe Jazztel",
                  <Codigo key="j">**61*número*20#</Codigo>,
                  "No la uses",
                ],
                [
                  "Estándar (3GPP y Orange)",
                  <Codigo key="e">**61*número**20#</Codigo>,
                  "Úsala",
                ],
                [
                  "Comprobación",
                  <Codigo key="c">*#61#</Codigo>,
                  "Te dice el número y los segundos guardados",
                ],
              ]}
            />
          </div>
        </Seccion>

        <Seccion
          id="coste"
          titulo="Lo que cuesta"
          entradilla={
            <p>
              Activar el desvío en el móvil es gratis. La llamada desviada la
              pagas según tu tarifa y, si tienes tarifa plana de voz y no pasas
              de su límite, Jazztel dice que es «gratuito».
            </p>
          }
        />

        <Seccion
          id="fijo"
          fondo
          titulo="El fijo de Jazztel"
          entradilla={
            <p>
              En el fijo, Jazztel pega el código al número, sin asterisco entre
              medias, y lo quita sin almohadilla al final. Así lo publica:
            </p>
          }
        >
          <div className="grid gap-6">
            <TablaDeCodigos
              titulo="Fijo Jazztel"
              subtitulo="Descuelga y marca el código tal como lo publica Jazztel."
              filas={[
                {
                  tipo: "Si no contestas",
                  recomendado: true,
                  activar: "*61{N}#",
                  quitar: "#61",
                },
                { tipo: "Si comunicas", activar: "*67{N}#", quitar: "#67" },
                { tipo: "Todas", activar: "*21{N}#", quitar: "#21" },
              ]}
            />
          </div>
          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <Texto>
              <p>
                <strong>Una sola tabla para dos tipos de línea.</strong> La
                página de servicios del fijo dice que los códigos cambian según
                tengas cobertura directa o no, pero solo publica esta tabla. Si
                en tu línea no funciona, pregunta a Jazztel cuál te corresponde,
                y comprueba el resultado con{" "}
                <Link href="/desvio-de-llamadas#comprobar">
                  «Comprobar desvío»
                </Link>
                , que es la única prueba en un fijo sin código de consulta.
              </p>
              <p>
                <strong>Lo que cobra.</strong> Los servicios del fijo son
                gratuitos, salvo escuchar los mensajes del contestador si tu
                acceso es indirecto o AMLT: 0,24 € por llamada, con un máximo de
                4,84 € al mes.
              </p>
            </Texto>
            <Nota tipo="importante" titulo="Aparta antes el contestador">
              El contestador del fijo tiene dos modos: ausencia (
              <Codigo>*10</Codigo> lo activa, <Codigo>#10</Codigo> lo quita) y
              ocupado (<Codigo>*11</Codigo> / <Codigo>#11</Codigo>). Si alguno
              está puesto, cogerá él las llamadas que debería coger tu
              recepcionista.
            </Nota>
          </div>
        </Seccion>

        <Seccion
          id="pasos"
          titulo="En el móvil, paso a paso y con los segundos"
          entradilla={
            <p>
              Así queda bien puesto a la primera, sin depender de la errata.
            </p>
          }
        >
          <Pasos
            pasos={[
              {
                titulo: "Elige los segundos y copia el código",
                texto:
                  "En la tarjeta del móvil de arriba, con tu número de Alhabla escrito. Sale con dos asteriscos antes de los segundos.",
              },
              {
                titulo: "Márcalo en la app Teléfono",
                texto:
                  "Pégalo en el teclado del móvil de Jazztel que quieres desviar y pulsa llamar.",
              },
              {
                titulo: "Consulta con *#61#",
                texto:
                  "Debe salir el número de Alhabla y los segundos que elegiste. Si salen otros segundos, la red no ha cogido el parámetro: vuelve a marcarlo.",
              },
              {
                titulo: "Añade el 67 y el 62",
                texto:
                  "Para que tampoco se pierdan las llamadas que entran mientras hablas o con el móvil apagado.",
              },
              {
                titulo: "Haz la prueba",
                texto:
                  "«Comprobar desvío» en tu panel de Alhabla: te llama, no lo coges y te dice si ha llegado.",
              },
            ]}
          />
        </Seccion>

        <Fuentes
          consultadas="2026-10-20"
          fuentes={[
            {
              nombre: "Jazztel: desvío de llamadas en el móvil",
              url: "https://ayuda.jazztel.com/movil/servicios/1743-desvio-de-llamadas",
            },
            {
              nombre: "Jazztel: servicios de valor añadido de la línea fija",
              url: "https://ayuda.jazztel.com/fijo/1815-servicios-de-valor-anadido-en-tu-linea-fija",
            },
            {
              nombre: "3GPP TS 22.030: estructura de los códigos",
              url: "https://www.etsi.org/deliver/etsi_ts/122000_122099/122030/19.00.00_60/ts_122030v190000p.pdf",
            },
          ]}
        />
      </ConNumeroDeAlhabla>
    </PaginaGuia>
  );
}
