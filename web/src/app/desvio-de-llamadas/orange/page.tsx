import { Timer } from "lucide-react";
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
 * Desvío en Orange y Amena (datos del 2026-10-20), con ayuda.orange.es
 * (particulares y empresas) y amena.com. Lo propio de Orange: publica los
 * segundos de espera (5 a 20 en particulares, 5 a 30 en empresas) y el fijo
 * tiene dos juegos de códigos según la cobertura sea directa o indirecta.
 * Amena redirige a Orange: que valgan los mismos códigos es una deducción y
 * se dice así.
 */

const ruta = "/desvio-de-llamadas/orange";
const titulo = "Desviar llamadas en Orange y Amena a tu recepcionista de IA";
const descripcion =
  "En Orange eliges los segundos de espera del desvío. Los códigos del móvil, los dos del fijo según tu cobertura y qué cambia si eras de Amena.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

const faqs = [
  {
    question: "Era cliente de Amena. ¿Me sirven estos códigos?",
    answer:
      "amena.com ya redirige a Orange: los clientes pasan a Orange, gestionan su línea en Mi Orange y Orange dice que mantienen la configuración de sus servicios. Si tenías un desvío, debería seguir ahí (compruébalo con *#61#), y para uno nuevo deberían valer los códigos de Orange, aunque no lo hemos podido probar en una línea que aún no se haya migrado.",
  },
  {
    question: "¿Por qué la web de empresas de Orange dice que hasta 30 segundos?",
    answer:
      "Su página para empresas da el mismo código, **61*prefijo y número**(5 a 30)#, y la de particulares, de 5 a 20. Orange no explica la diferencia. Si pruebas 25 o 30, marca *#61# para ver qué ha guardado la red.",
  },
  {
    question: "¿Y si el fijo es una centralita de empresa?",
    answer:
      "Las centralitas Big Pyme de Orange usan otra familia de códigos: *92 y el número para no contesta (se quita con *93), *90 / *91 para ocupado, *94 / *95 para apagado y *72 / *73 para todas. Confírmalos con Orange antes de usarlos.",
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
          En Orange eliges cuánto suena el móvil antes de desviar:{" "}
          <Codigo>**61*número**segundos#</Codigo>, de 5 a 20. En el fijo hay dos
          juegos de códigos, según tu línea tenga cobertura directa o
          indirecta.
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
          texto: "Desviar o dar el número de Alhabla, y cómo quitarlo.",
        },
        {
          href: "/desvio-de-llamadas/jazztel",
          titulo: "Desvío en Jazztel",
          texto: "Del mismo grupo, también con segundos de espera.",
        },
        {
          href: "/desvio-de-llamadas/simyo",
          titulo: "Desvío en Simyo",
          texto: "También publica los segundos, de 5 a 30.",
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
              Elige los segundos y copia el código. Se marca desde el móvil que
              quieres desviar, en el teclado de la app Teléfono.
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
          <div className="mt-8">
            <Texto>
              <p>
                <strong>Cuántos segundos.</strong> Con 5, la recepcionista coge
                casi todo; con 20, el teléfono suena lo justo para que dejes las
                tijeras o te quites los guantes, y solo pasan las que de verdad
                no puedes atender. Si no pones segundos, la red mantiene los que
                hubiera.
              </p>
              <p>
                <strong>Qué pagas.</strong> Activarlo es gratis; cada llamada
                desviada la pagas tú, desde tu móvil hasta el número de Alhabla,
                según tu tarifa. Orange confirma que se puede desviar a un fijo,
                y también lo gestiona en Mi Orange › Productos › Llamadas
                nacionales, junto al buzón.
              </p>
            </Texto>
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Nota tipo="importante" titulo="En el fijo, mira antes tu cobertura">
              Orange tiene dos juegos de códigos para el fijo y no se parecen:
              si marcas el que no es, el desvío no salta.{" "}
              <a
                href="#fijo"
                className="font-semibold underline underline-offset-4"
              >
                Cuál es el tuyo
              </a>
              .
            </Nota>
            <ComprobarDesvio>
              <p>
                Marca <Codigo>*#61#</Codigo>: verás el número y los segundos
                que ha guardado la red.
              </p>
            </ComprobarDesvio>
          </div>
        </Seccion>

        <Seccion
          id="fijo"
          fondo
          titulo="El fijo Orange: dos juegos de códigos"
          entradilla={
            <p>
              Si el teléfono va enchufado a un microfiltro en la roseta de la
              pared, tu cobertura es indirecta. Si no, lo más probable es la
              directa. Si dudas, marca un juego, pulsa «Comprobar desvío» y, si
              no salta, quítalo y prueba el otro.
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
          <div className="mt-8">
            <Texto>
              <p>
                <strong>El buzón del fijo</strong> viene desactivado de fábrica,
                y activarlo es en sí mismo un desvío: si un día lo encendiste,
                ocupa el hueco que necesita tu recepcionista. Pon el desvío a
                Alhabla en su lugar. Orange no publica cuánto cuestan las
                llamadas desviadas desde el fijo.
              </p>
            </Texto>
          </div>
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
