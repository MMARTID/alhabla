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
  Texto,
} from "@/components/pagina-guia";
import { metadataDePagina } from "@/lib/seo";

/**
 * Desvío en Orange y Amena (2026-10-20), con ayuda.orange.es (particulares y
 * empresas) y amena.com. Lo propio de Orange: publica los segundos de espera
 * (5 a 20 en particulares, 5 a 30 en empresas, una contradicción que se
 * cuenta tal cual) y el fijo tiene dos juegos de códigos según la cobertura
 * sea directa o indirecta. Amena redirige a Orange: que valgan los mismos
 * códigos es una deducción y se dice así.
 */

const ruta = "/desvio-de-llamadas/orange";
const titulo = "Desviar llamadas en Orange y Amena a tu recepcionista de IA";
const descripcion =
  "En Orange eliges los segundos de espera del desvío. Los códigos del móvil, los dos del fijo según tu cobertura y qué cambia si eras de Amena.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

const faqs = [
  {
    question:
      "¿Cómo sé si mi fijo de Orange tiene cobertura directa o indirecta?",
    answer:
      "Orange dice que es indirecta cuando tienes el teléfono conectado a un microfiltro en la roseta de la pared. Su explicación de la directa está en una imagen que no hemos podido leer, así que, si dudas, pregúntaselo a Orange o prueba el juego de códigos de la indirecta y compruébalo.",
  },
  {
    question: "¿Qué segundos de espera pongo?",
    answer:
      "Depende de cuánto margen quieras para coger tú. En una línea de particulares, Orange admite 5, 10, 15 o 20 segundos. Con pocos segundos, casi todas las llamadas pasan a la recepcionista; con 20, te da tiempo a soltar lo que tengas entre manos.",
  },
  {
    question:
      "¿Por qué la web de empresas de Orange dice que hasta 30 segundos?",
    answer:
      "Porque su página de desvíos para empresas da un margen de 5 a 30, y la de particulares, de 5 a 20. Orange no explica la diferencia. Si pruebas 25 o 30 en una línea de particulares, marca *#61# para ver qué ha guardado la red.",
  },
  {
    question: "Era cliente de Amena. ¿Me sirven estos códigos?",
    answer:
      "amena.com ya redirige a Orange: los clientes pasan a Orange, gestionan su línea en Mi Orange y Orange dice que mantienen la configuración de sus servicios. Por eso deberían valer los códigos de Orange, aunque no lo hemos podido comprobar en una línea que aún no se haya migrado.",
  },
  {
    question: "¿Qué quita ##002# en Orange?",
    answer:
      "Orange lo describe como «Desactivar todos los desvíos al buzón de voz». Para quitar solo el desvío a tu recepcionista, marca ##61#.",
  },
  {
    question: "¿Cuánto cuesta el desvío en Orange?",
    answer:
      "Activarlo es gratis. Lo que pagas es la llamada desde tu móvil al número al que desvías, según tu tarifa. Para el fijo, Orange no indica precio en su ayuda.",
  },
  {
    question: "¿Se desvían también los SMS?",
    answer: "No. Orange lo dice expresamente: solo se desvían las llamadas.",
  },
];

export default function DesvioOrangePage() {
  return (
    <PaginaGuia
      ruta={ruta}
      migas={[
        { name: "Desvío de llamadas", path: "/desvio-de-llamadas" },
        { name: "Orange y Amena", path: ruta },
      ]}
      etiqueta={{ icono: Timer, texto: "Orange · Amena" }}
      titulo={titulo}
      entradilla={
        <p>
          Orange es de los pocos operadores que explican cómo elegir cuánto
          suena el móvil antes de desviar:{" "}
          <Codigo>**61*número**segundos#</Codigo>, de 5 a 20. En el fijo hay dos
          juegos de códigos, según tu línea tenga cobertura directa o indirecta.
        </p>
      }
      descripcion={descripcion}
      ctaSecundario={{ texto: "Ir al fijo", href: "#fijo" }}
      ubicacion="desvio_orange"
      faqs={faqs}
      tituloFaqs="Preguntas sobre el desvío en Orange y Amena"
      relacionadas={[
        {
          href: "/desvio-de-llamadas",
          titulo: "Guía general del desvío",
          texto: "Qué tres desvíos poner y cómo comprobarlos.",
        },
        {
          href: "/desvio-de-llamadas/jazztel",
          titulo: "Desvío en Jazztel",
          texto:
            "Del mismo grupo, con una sintaxis de los segundos que no cuadra.",
        },
        {
          href: "/desvio-de-llamadas/simyo",
          titulo: "Desvío en Simyo",
          texto: "También publica los segundos, de 5 a 30.",
        },
        {
          href: "/desvio-de-llamadas/iphone-y-android",
          titulo: "En iPhone y Android",
          texto: "Si prefieres el menú del teléfono al código.",
        },
      ]}
      cierre="Tú eliges los segundos; lo que no llegas a coger, lo coge ella."
    >
      <ConNumeroDeAlhabla>
        <Seccion
          id="movil"
          titulo="En el móvil Orange, con los segundos que elijas"
          entradilla={
            <p>
              Orange publica el código del desvío si no contestas con los
              segundos incluidos, en múltiplos de 5 y entre 5 y 20. Elige el
              valor y copia el código.
            </p>
          }
        >
          <div className="grid gap-6">
            <CampoNumeroDeAlhabla />
            <TablaDeCodigos
              titulo="Móvil Orange (particulares)"
              filas={[
                {
                  tipo: "Si no contestas",
                  recomendado: true,
                  activar: "**61*{N}**{T}#",
                  quitar: "##61#",
                  consultar: "*#61#",
                  segundos: { opciones: [5, 10, 15, 20], inicial: 20 },
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
                  tipo: "Todas las llamadas",
                  activar: "**21*{N}#",
                  quitar: "##21#",
                  consultar: "*#21#",
                },
                {
                  tipo: "Desactivar todos los desvíos al buzón de voz",
                  quitar: "##002#",
                  detalle:
                    "Así lo llama Orange. No lo uses para quitar solo el de Alhabla.",
                },
              ]}
            />
          </div>
          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <Texto>
              <p>
                <strong>Cuántos segundos.</strong> Es la única decisión que
                Orange te deja tomar y merece un minuto. Con 5 segundos, la
                recepcionista coge casi todo; con 20, el teléfono suena el
                tiempo suficiente para que dejes las tijeras o te quites los
                guantes, y solo pasan las que de verdad no puedes atender. Si no
                pones segundos, la red mantiene los que hubiera.
              </p>
              <p>
                <strong>Líneas de empresa.</strong> La página de Orange para
                empresas da el mismo código con un margen distinto:{" "}
                <Codigo>**61*prefijo y número**(5 a 30)#</Codigo>. La de
                particulares dice de 5 a 20. Si tu línea es de empresa y quieres
                25 o 30, pruébalo y comprueba con <Codigo>*#61#</Codigo> lo que
                ha guardado la red.
              </p>
            </Texto>
            <Texto>
              <p>
                <strong>Qué pagas.</strong> Activar el desvío es gratis. En
                palabras de Orange, «eres tú quien paga el coste de la llamada
                desde tu móvil al número» al que desvías, según tu tarifa.
                Orange confirma que se puede desviar a un fijo, que es lo que es
                el número de Alhabla. En empresas excluye los números
                especiales, de emergencia, gratuitos, de tarificación especial e
                internacionales.
              </p>
              <p>
                <strong>En Mi Orange.</strong> Productos › Llamadas nacionales,
                donde están juntos el buzón y el desvío. Solo se desvían
                llamadas; los SMS siguen llegando al móvil.
              </p>
            </Texto>
          </div>
        </Seccion>

        <Seccion
          id="fijo"
          fondo
          titulo="El fijo Orange: dos juegos de códigos"
          entradilla={
            <p>
              Lo que marcas depende de cómo te llega la línea. Orange lo llama
              cobertura directa e indirecta, y los códigos no se parecen.
            </p>
          }
        >
          <div className="grid gap-6">
            <TablaDeCodigos
              titulo="Cobertura directa"
              subtitulo="El código va pegado al número, sin asterisco ni almohadilla final."
              filas={[
                {
                  tipo: "Si no contesta",
                  recomendado: true,
                  activar: "*23{N}",
                  quitar: "*231*",
                },
                { tipo: "Si comunica", activar: "*22{N}", quitar: "*221*" },
                { tipo: "Todas", activar: "*21{N}", quitar: "*211*" },
              ]}
            />
            <TablaDeCodigos
              titulo="Cobertura indirecta"
              subtitulo="Los de casi todos los fijos: asterisco, código, asterisco, número y almohadilla."
              filas={[
                {
                  tipo: "Si no contesta",
                  recomendado: true,
                  activar: "*61*{N}#",
                  quitar: "#61#",
                },
                { tipo: "Si comunica", activar: "*67*{N}#", quitar: "#67#" },
                { tipo: "Todas", activar: "*21*{N}#", quitar: "#21#" },
              ]}
            />
          </div>
          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <Texto>
              <p>
                <strong>Cuál es la tuya.</strong> Orange explica en la página de
                su buzón del fijo que la cobertura es indirecta «cuando tengas
                el [teléfono] conectado a un microfiltro en la roseta de la
                pared». Lo que define la directa lo pone en una imagen. Si tu
                teléfono va enchufado a un microfiltro, usa la columna de la
                indirecta; si no, lo más probable es la directa, pero es una
                deducción: si dudas, pregúntaselo a Orange.
              </p>
              <p>
                <strong>Cómo salir de dudas sin llamar a nadie.</strong> Marca
                el juego que creas y pulsa{" "}
                <Link href="/desvio-de-llamadas#comprobar">
                  «Comprobar desvío»
                </Link>
                . Si dice que no ha saltado el desvío, quítalo y prueba el otro.
              </p>
            </Texto>
            <Texto>
              <p>
                <strong>El buzón del fijo.</strong> En Orange viene desactivado
                de fábrica, y activarlo o quitarlo es en sí mismo un desvío. Si
                un día lo encendiste, está ocupando el hueco que necesita tu
                recepcionista: pon el desvío a Alhabla en su lugar.
              </p>
              <p>
                <strong>El precio del fijo.</strong> La ayuda de Orange para el
                fijo no dice cuánto cuestan las llamadas desviadas.
              </p>
            </Texto>
          </div>
          <div className="mt-8">
            <Nota tipo="info" titulo="Si tu fijo es una centralita Big Pyme">
              Las centralitas de empresa usan otra familia de códigos. Según un
              extracto de la ayuda de Orange que no hemos podido guardar:{" "}
              <Codigo>*92</Codigo> y el número para no contesta (se quita con{" "}
              <Codigo>*93</Codigo>), <Codigo>*90</Codigo> / <Codigo>*91</Codigo>{" "}
              para ocupado, <Codigo>*94</Codigo> / <Codigo>*95</Codigo> para
              apagado y <Codigo>*72</Codigo> / <Codigo>*73</Codigo> para todas.
              Confírmalos con Orange antes de usarlos.
            </Nota>
          </div>
        </Seccion>

        <Seccion id="amena" titulo="Si eras de Amena">
          <Texto>
            <p>
              Hoy amena.com te lleva a una página de Orange que explica el paso:
              los clientes de Amena pasan a Orange, gestionan su línea desde Mi
              Orange y, según Orange, «mantendrás la configuración de los
              servicios». Si tenías un desvío puesto, debería seguir ahí;
              compruébalo con <Codigo>*#61#</Codigo>.
            </p>
            <p>
              Para activar uno nuevo, lo razonable es usar los códigos de Orange
              de esta página. Es una deducción a partir de esa migración: no
              hemos podido verificarlo en una línea de Amena que aún no haya
              pasado a Orange. Después de marcarlo, «Comprobar desvío» te
              confirma si llega a tu recepcionista.
            </p>
          </Texto>
        </Seccion>

        <Fuentes
          consultadas="2026-10-20"
          fuentes={[
            {
              nombre: "Orange: desvía las llamadas de tu móvil a otro número",
              url: "https://ayuda.orange.es/particulares/mi-orange/activar-servicios/777-desvia-las-llamadas-que-recibes-en-tu-movil-a-otro-numero",
            },
            {
              nombre: "Orange: desvía las llamadas de tu fijo",
              url: "https://ayuda.orange.es/particulares/internet-y-wi-fi/servicios/2055-desvia-las-llamadas-de-tu-telefono-fijo-de-orange-a-otro-fijo-o-a-un-movil",
            },
            {
              nombre: "Orange: el buzón de voz del fijo",
              url: "https://ayuda.orange.es/particulares/internet-y-wi-fi/servicios/1693-todo-lo-que-debes-saber-sobre-el-buzon-de-voz-de-tu-telefono-fijo-de-orange",
            },
            {
              nombre: "Orange Empresas: desvío de llamadas",
              url: "https://www.orange.es/empresas/movil/servicios/desvio-llamadas",
            },
            {
              nombre: "Amena (redirige a Orange)",
              url: "https://www.amena.com/",
            },
          ]}
        />
      </ConNumeroDeAlhabla>
    </PaginaGuia>
  );
}
