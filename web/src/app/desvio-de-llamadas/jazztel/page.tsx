import { Asterisk } from "lucide-react";
import { Codigo } from "@/components/desvio/codigo";
import {
  CampoNumeroDeAlhabla,
  ConNumeroDeAlhabla,
  TablaDeCodigos,
} from "@/components/desvio/codigos-de-desvio";
import { ComprobarDesvio } from "@/components/desvio/comprobar-desvio";
import {
  Fuentes,
  Nota,
  PaginaGuia,
  Seccion,
  Texto,
} from "@/components/pagina-guia";
import { metadataDePagina } from "@/lib/seo";

/**
 * Desvío en Jazztel (datos del 2026-10-20), con ayuda.jazztel.com (móvil y
 * servicios del fijo). Lo propio de Jazztel: publica los segundos de 5 a 30
 * pero con un solo asterisco antes (`*ss#`), distinto del estándar `**ss#`
 * que usa Orange, de su mismo grupo; probable errata, sin verificar en red.
 * Su tabla del móvil omite almohadillas finales y el fijo se quita sin
 * almohadilla final.
 */

const ruta = "/desvio-de-llamadas/jazztel";
const titulo = "Desviar llamadas en Jazztel a tu recepcionista de IA";
const descripcion =
  "Códigos de Jazztel para móvil y fijo, cómo poner los segundos de espera (su ayuda trae una errata probable) y cómo apartar el contestador del fijo.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

const faqs = [
  {
    question: "En su tabla, el código del 61 no lleva # al final. ¿Lo pongo?",
    answer:
      "Sí. En la tabla del móvil de Jazztel faltan las almohadillas finales del 61 y del 62, pero los demás códigos de esa misma tabla las llevan. Marca **61*número#.",
  },
  {
    question: "Mi fijo no desvía con estos códigos. ¿Por qué?",
    answer:
      "Jazztel dice que los códigos del fijo cambian según tengas cobertura directa o no, pero solo publica una tabla. Si en tu línea no funcionan, pregúntale cuál te corresponde.",
  },
  {
    question: "¿Me cobra algo el fijo por los servicios?",
    answer:
      "Los servicios del fijo son gratuitos, salvo escuchar los mensajes del contestador si tu acceso es indirecto o AMLT: 0,24 € por llamada, con un máximo de 4,84 € al mes.",
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
          href: "/desvio-de-llamadas",
          titulo: "Todos los operadores",
          texto: "Desviar o dar el número de Alhabla, y cómo quitarlo.",
        },
        {
          href: "/desvio-de-llamadas/orange",
          titulo: "Desvío en Orange",
          texto: "Su mismo grupo, con la forma estándar de los segundos.",
        },
        {
          href: "/desvio-de-llamadas/iphone-y-android",
          titulo: "Desvío en iPhone y Android",
          texto: "Por si prefieres el menú del teléfono.",
        },
      ]}
      cierre="Tú eliges cuánto suena; si no llegas, contesta ella."
    >
      <ConNumeroDeAlhabla>
        <Seccion
          id="movil"
          titulo="En el móvil Jazztel, con los segundos que elijas"
          entradilla={
            <p>
              Elige los segundos y copia el código. Se marca desde el móvil que
              quieres desviar, en el teclado de la app Teléfono.
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
                    "Con dos asteriscos antes de los segundos, como en Orange.",
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
          <div className="mt-8">
            <Texto>
              <p>
                <strong>Qué pagas.</strong> Activarlo es gratis. La llamada
                desviada la pagas según tu tarifa; con tarifa plana de voz y sin
                pasar de su límite, Jazztel dice que es gratuito.
              </p>
            </Texto>
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Nota tipo="importante" titulo="El asterisco que falta">
              <p>
                Jazztel escribe <Codigo>**61*número*20#</Codigo>, con un solo
                asterisco antes de los segundos. Orange, de su mismo grupo, usa
                dos: <Codigo>**61*número**20#</Codigo>. Con uno, la red podría
                no leer el 20 como segundos. No lo hemos podido probar en una
                línea de Jazztel: usa la forma con dos, la de la tabla.
              </p>
            </Nota>
            <ComprobarDesvio>
              <p>
                Marca <Codigo>*#61#</Codigo>: tiene que salir el número de
                Alhabla y los segundos que elegiste. Si salen otros, vuelve a
                marcar el código.
              </p>
            </ComprobarDesvio>
          </div>
        </Seccion>

        <Seccion
          id="fijo"
          fondo
          titulo="El fijo de Jazztel"
          entradilla={
            <p>
              En el fijo, Jazztel pega el código al número, sin asterisco entre
              medias, y lo quita sin almohadilla al final. Descuelga y márcalo
              tal cual.
            </p>
          }
        >
          <TablaDeCodigos
            titulo="Fijo Jazztel"
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
            nota="Jazztel no publica código de consulta para el fijo: la prueba es «Comprobar desvío»."
          />
          <div className="mt-8">
            <Texto>
              <p>
                <strong>Aparta antes el contestador.</strong> Tiene dos modos:
                ausencia (<Codigo>*10</Codigo> lo activa, <Codigo>#10</Codigo>{" "}
                lo quita) y ocupado (<Codigo>*11</Codigo> /{" "}
                <Codigo>#11</Codigo>). Si alguno está puesto, cogerá él las
                llamadas que debería coger tu recepcionista.
              </p>
            </Texto>
          </div>
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
