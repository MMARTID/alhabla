import Link from "next/link";
import { MousePointerClick } from "lucide-react";
import { Codigo } from "@/components/desvio/codigo";
import {
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
 * Desvío en Pepephone (2026-10-20), con pepephone.com/ayuda. Pepephone no
 * publica códigos de desvío: los tres condicionales se eligen en Mi
 * Pepephone › Ajustes de la línea, y esa misma pantalla es la del buzón. El
 * único código que publica es el de alargar los tonos antes de su buzón
 * (22177), que demuestra que la red admite los segundos; para otro número
 * no lo documenta. El fijo «a lo Pepe» va por la red móvil y su desvío no
 * está documentado.
 */

const ruta = "/desvio-de-llamadas/pepephone";
const titulo = "Desviar llamadas en Pepephone a tu recepcionista de IA";
const descripcion =
  "Pepephone no usa códigos: el desvío si no atiendes, comunicando o sin cobertura se elige en Mi Pepephone. Paso a paso, y qué pasa con tu buzón.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

const faqs = [
  {
    question: "¿Pepephone tiene códigos para desviar llamadas?",
    answer:
      "Su ayuda no publica ninguno para el desvío. Lo que explica es la pantalla de Mi Pepephone en la que eliges qué hacer con cada llamada que no atiendes, cuando comunicas o cuando no tienes cobertura.",
  },
  {
    question: "¿Dónde se configura exactamente?",
    answer:
      "En Mi Pepephone, eligiendo tu línea y entrando en «Ajustes de la línea». Para cada situación eliges SMS de aviso, buzón, otro número o nada.",
  },
  {
    question: "Si pongo otro número, ¿pierdo el buzón?",
    answer:
      "En esas situaciones, sí: Pepephone avisa de que esa configuración aplica a tu buzón de voz. Cada caso va a un solo destino, así que si eliges el número de Alhabla, el buzón deja de coger esas llamadas. Para recuperarlo, vuelve a elegir «buzón».",
  },
  {
    question: "¿Puedo elegir cuántos segundos suena antes?",
    answer:
      "Pepephone publica *61*22177**30# para que su buzón salte a los 30 segundos. Para el desvío a otro número no lo documenta. Si quieres probar con el número de Alhabla, comprueba después con *#61# lo que ha guardado la red.",
  },
  {
    question: "¿Cuánto cuesta el desvío en Pepephone?",
    answer:
      "Su ayuda no lo dice. Pregúntalo antes de activarlo si tu tarifa no tiene llamadas ilimitadas.",
  },
  {
    question: "Tengo el «Teléfono fijo a lo Pepe». ¿Se puede desviar?",
    answer:
      "Pepephone no lo documenta. Ese fijo es una caja de voz con una SIM que va por la red móvil. Pregúntaselo a Pepephone o usa el número de Alhabla como principal.",
  },
];

export default function DesvioPepephonePage() {
  return (
    <PaginaGuia
      ruta={ruta}
      migas={[
        { name: "Desvío de llamadas", path: "/desvio-de-llamadas" },
        { name: "Pepephone", path: ruta },
      ]}
      etiqueta={{ icono: MousePointerClick, texto: "Pepephone · Mi Pepephone" }}
      titulo={titulo}
      entradilla={
        <p>
          En Pepephone no hace falta marcar nada: el desvío se elige en Mi
          Pepephone, en «Ajustes de la línea», para tres situaciones. En las
          tres eliges «otro número» y escribes el de tu recepcionista.
        </p>
      }
      descripcion={descripcion}
      ctaSecundario={{ texto: "Ver los pasos", href: "#pasos" }}
      ubicacion="desvio_pepephone"
      faqs={faqs}
      tituloFaqs="Preguntas sobre el desvío en Pepephone"
      relacionadas={[
        {
          href: "/desvio-de-llamadas",
          titulo: "Desvío por operador",
          texto: "Los códigos estándar, por si los necesitas.",
        },
        {
          href: "/desvio-de-llamadas/iphone-y-android",
          titulo: "El ajuste del iPhone que se come llamadas",
          texto: "Silenciar desconocidos y el Buzón de voz en vivo.",
        },
        {
          href: "/desvio-de-llamadas/lowi",
          titulo: "Desvío en Lowi",
          texto: "También se gestiona desde su área de cliente.",
        },
        {
          href: "/blog/desviar-llamadas-sin-cambiar-de-numero",
          titulo: "Desviar sin cambiar de número",
          texto: "Qué ocurre con la llamada después.",
        },
      ]}
      cierre="Tres opciones en Mi Pepephone, y tus llamadas atendidas."
    >
      <ConNumeroDeAlhabla>
        <Seccion
          id="pasos"
          titulo="En Mi Pepephone, paso a paso"
          entradilla={
            <p>
              Ten a mano tu número de Alhabla: lo vas a escribir tres veces.
            </p>
          }
        >
          <Pasos
            pasos={[
              {
                titulo: "Entra en Mi Pepephone y elige tu línea",
                texto: "La del móvil que das a tus clientes.",
              },
              {
                titulo: "Abre «Ajustes de la línea»",
                texto:
                  "Ahí están las tres situaciones: «si no atiendo», «comunicando» y «sin cobertura».",
              },
              {
                titulo: "En «si no atiendo», elige «otro número»",
                texto:
                  "Escribe el número de Alhabla con sus 9 cifras, sin espacios.",
              },
              {
                titulo: "Repite en «comunicando» y en «sin cobertura»",
                texto:
                  "Así ninguna de las tres situaciones sigue yendo al buzón ni al SMS de aviso.",
              },
              {
                titulo: "Compruébalo",
                texto: (
                  <>
                    Desde el móvil, marca <code>*#61#</code> para ver a dónde va
                    el desvío si no atiendes, y haz la prueba de «Comprobar
                    desvío» en tu panel de Alhabla.
                  </>
                ),
              },
            ]}
          />
        </Seccion>

        <Seccion
          id="opciones"
          fondo
          titulo="Las cuatro opciones de cada situación"
          entradilla={
            <p>
              Para cada una de las tres situaciones, Pepephone te deja elegir
              entre SMS de aviso, buzón, otro número o nada. Esto es lo que pasa
              con el cliente en cada caso.
            </p>
          }
        >
          <div className="grid gap-8">
            <Tabla
              cabecera={["Opción", "Qué le pasa al cliente"]}
              filas={[
                [
                  "SMS de aviso",
                  "Tú sabes que llamó, pero él se queda sin respuesta hasta que le devuelvas la llamada",
                ],
                [
                  "Buzón",
                  "Puede dejarte un mensaje, y tú le llamas cuando puedas",
                ],
                [
                  "Otro número (Alhabla)",
                  "Le atiende tu recepcionista, mira tu agenda y le reserva",
                ],
                ["Nada", "La llamada no se desvía a ningún sitio"],
              ]}
            />
            <Tabla
              cabecera={["En Mi Pepephone", "Equivale a", "Código de la norma"]}
              filas={[
                [
                  "Si no atiendo",
                  "Si no contesta",
                  <Codigo key="a">61</Codigo>,
                ],
                [
                  "Comunicando",
                  "Si comunica o rechazas",
                  <Codigo key="b">67</Codigo>,
                ],
                [
                  "Sin cobertura",
                  "Apagado o sin cobertura",
                  <Codigo key="c">62</Codigo>,
                ],
              ]}
              nota="La equivalencia es nuestra: Pepephone no usa los nombres ni los números de la norma."
            />
          </div>
          <div className="mt-8">
            <Texto>
              <p>
                <strong>
                  «Esta configuración aplicará a tu buzón de voz».
                </strong>{" "}
                Lo dice Pepephone en esa misma pantalla, y es la clave: cada
                situación solo puede ir a un destino. Si eliges el número de
                Alhabla, el buzón deja de coger esas llamadas. Si un día quieres
                volver atrás, entra en la misma pantalla y elige «buzón» otra
                vez; no hace falta ningún código.
              </p>
            </Texto>
          </div>
        </Seccion>

        <Seccion
          id="segundos"
          titulo="Los segundos de espera"
          entradilla={
            <p>
              Pepephone explica cómo alargar los tonos antes de que salte su
              buzón, que es el 22177. Para otro número no lo documenta.
            </p>
          }
        >
          <div className="grid gap-6">
            <TablaDeCodigos
              titulo="Lo que sí publica Pepephone, y cómo comprobarlo"
              filas={[
                {
                  tipo: "Que su buzón salte a los 30 segundos",
                  activar: "*61*22177**30#",
                  detalle: "Código de Pepephone para su propio buzón.",
                },
                {
                  tipo: "Ver el desvío si no atiendo",
                  consultar: "*#61#",
                  detalle: "Código de la norma GSM.",
                },
                { tipo: "Ver el desvío comunicando", consultar: "*#67#" },
                { tipo: "Ver el desvío sin cobertura", consultar: "*#62#" },
              ]}
            />
          </div>
          <div className="mt-8">
            <Texto>
              <p>
                Ese código enseña dos cosas: que la red de Pepephone acepta el
                parámetro de los segundos y que lo hace con el formato de la
                norma (doble asterisco antes del 30). Con el número de Alhabla
                en lugar del 22177 funcionaría igual en teoría, pero Pepephone
                no lo dice. Si lo pruebas, consulta después con{" "}
                <Codigo>*#61#</Codigo> qué ha quedado guardado. Y el coste del
                desvío, Pepephone no lo publica: pregúntalo si tu tarifa no
                tiene llamadas ilimitadas.
              </p>
            </Texto>
          </div>
        </Seccion>

        <Seccion id="fijo" fondo titulo="El «Teléfono fijo a lo Pepe»">
          <div className="grid gap-8 lg:grid-cols-2">
            <Texto>
              <p>
                El fijo de Pepephone es una caja de voz con una SIM dentro, que
                funciona por la red móvil. Su ayuda no explica cómo desviarlo,
                así que no podemos darte un código que sepamos que funciona.
              </p>
            </Texto>
            <Nota
              tipo="info"
              titulo="Si tu número de cara al público es ese fijo"
            >
              Pregunta a Pepephone si admite el desvío condicional. Mientras
              tanto, la opción segura es{" "}
              <Link
                href="/desvio-de-llamadas#cual"
                className="font-semibold underline underline-offset-4"
              >
                publicar el número de Alhabla como principal
              </Link>{" "}
              y que te pase al móvil las llamadas que quieras. Si lo consigues
              desviar, «Comprobar desvío» te dirá si llega.
            </Nota>
          </div>
        </Seccion>

        <Fuentes
          consultadas="2026-10-20"
          fuentes={[
            {
              nombre: "Pepephone: activar y desactivar el desvío de llamadas",
              url: "https://www.pepephone.com/ayuda/como-activar-y-desactivar-desvio-de-llamadas",
            },
            {
              nombre: "Pepephone: alargar los tonos antes del contestador",
              url: "https://www.pepephone.com/ayuda/como-puedo-alargar-los-tonos-de-llamada-en-mi-linea-de-pepephone-antes-de-que-salte-el-contestador",
            },
            {
              nombre: "Pepephone: cómo funciona el teléfono fijo",
              url: "https://www.pepephone.com/ayuda/como-funciona-el-servicio-de-telefono-fijo-de-pepephone",
            },
          ]}
        />
      </ConNumeroDeAlhabla>
    </PaginaGuia>
  );
}
