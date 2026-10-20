import Link from "next/link";
import { Building2, Phone } from "lucide-react";
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
 * Desvío en Telecable (2026-10-20), con telecable.es/ayuda-clientes (móvil,
 * fijo y restricción de llamadas del fijo). Lo propio de Telecable: los datos
 * estructurados de su ayuda del móvil traen los códigos completos con los
 * segundos de 5 a 30 (el texto visible pierde asteriscos), y en el fijo el
 * tramo desviado se factura con la tarifa, que trae 4.000 minutos a fijos.
 * Lo de Big Pyme viene de un extracto, igual que en Orange, y se dice.
 */

const ruta = "/desvio-de-llamadas/telecable";
const titulo = "Desviar llamadas en Telecable a tu recepcionista de IA";
const descripcion =
  "Códigos de Telecable para el móvil con segundos de 5 a 30 y para el fijo, y cómo se factura el desvío: 4.000 minutos a fijos, móviles aparte.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

const faqs = [
  {
    question: "¿Por qué en la web de Telecable los códigos se ven raros?",
    answer:
      "En el texto visible de su ayuda del móvil se pierden asteriscos. Los datos estructurados de la misma página, los que leen los buscadores, traen los códigos enteros: son los de esta página.",
  },
  {
    question: "¿Puedo elegir cuántos segundos suena antes de desviar?",
    answer:
      "Sí, en el móvil: Telecable indica una espera de 5 a 30 segundos con **61*número**segundos#. Para el fijo no publica cómo hacerlo.",
  },
  {
    question: "¿Cuánto cuesta desviar el fijo a Alhabla?",
    answer:
      "El tramo desviado se factura con tu tarifa. La línea fija de Telecable incluye 4.000 minutos a otros fijos, y el número de Alhabla es un fijo: esos minutos salen de ahí.",
  },
  {
    question: "¿Y si desvío el fijo a mi móvil?",
    answer:
      "Las llamadas del fijo a móviles se pagan, salvo que tengas un bono. Desviar el fijo a tu móvil sí puede costarte; a la recepcionista, que es un fijo, entra en los 4.000 minutos.",
  },
  {
    question: "¿Cuánto cuesta desviar el móvil?",
    answer:
      "La ayuda del móvil de Telecable no lo dice. Depende de lo que incluya tu tarifa móvil.",
  },
  {
    question: "Mi empresa tiene centralita Big Pyme. ¿Valen estos códigos?",
    answer:
      "No. Según un extracto de su ayuda, Big Pyme usa la misma familia de códigos que en Orange (*92 y el número para no contesta, *93 para quitarlo…). Confírmalo con Telecable.",
  },
];

export default function DesvioTelecablePage() {
  return (
    <PaginaGuia
      ruta={ruta}
      migas={[
        { name: "Desvío de llamadas", path: "/desvio-de-llamadas" },
        { name: "Telecable", path: ruta },
      ]}
      etiqueta={{ icono: Phone, texto: "Telecable · móvil y fijo" }}
      titulo={titulo}
      entradilla={
        <p>
          Telecable publica el desvío del móvil con los segundos de espera, de 5
          a 30, y el del fijo con los tres códigos de siempre. Desde el fijo,
          desviar a tu recepcionista gasta minutos a fijos, que la tarifa trae
          de sobra.
        </p>
      }
      descripcion={descripcion}
      ctaSecundario={{ texto: "Ir al fijo", href: "#fijo" }}
      ubicacion="desvio_telecable"
      faqs={faqs}
      tituloFaqs="Preguntas sobre el desvío en Telecable"
      relacionadas={[
        {
          href: "/desvio-de-llamadas/euskaltel",
          titulo: "Desvío en Euskaltel",
          texto: "Del mismo grupo: también con 4.000 minutos a fijos.",
        },
        {
          href: "/desvio-de-llamadas/r-galicia",
          titulo: "Desvío en R",
          texto: "La app de R hace el desvío del fijo sin códigos.",
        },
        {
          href: "/desvio-de-llamadas",
          titulo: "Todos los operadores",
          texto: "La tabla del desvío si no contesta.",
        },
        {
          href: "/desvio-de-llamadas/orange",
          titulo: "Desvío en Orange",
          texto: "Los mismos códigos de centralita Big Pyme.",
        },
      ]}
      cierre="Tu Telecable sigue sonando; si no llegas, contesta ella."
    >
      <ConNumeroDeAlhabla>
        <Seccion
          id="movil"
          titulo="El móvil Telecable, con segundos de espera"
          entradilla={
            <p>
              La ayuda del móvil describe el desvío si no contestas con «espera
              un tiempo de 5-30 segundos». Elige el valor y el código sale con
              él.
            </p>
          }
        >
          <div className="grid gap-6">
            <CampoNumeroDeAlhabla />
            <TablaDeCodigos
              titulo="Móvil Telecable"
              subtitulo="Como vienen en los datos estructurados de su ayuda."
              filas={[
                {
                  tipo: "Si no contestas",
                  recomendado: true,
                  activar: "**61*{N}**{T}#",
                  quitar: "##61#",
                  consultar: "*#61#",
                  segundos: { opciones: [5, 10, 15, 20, 25, 30], inicial: 15 },
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
          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <Texto>
              <p>
                <strong>Lo que se ve y lo que hay debajo.</strong> En el texto
                de la página de Telecable, los códigos pierden asteriscos al
                mostrarse. Debajo, en los datos estructurados que la página
                ofrece a los buscadores, están completos:{" "}
                <Codigo>**61*número**segundos#</Codigo>. Les pasa lo mismo a las
                webs de Euskaltel y de R, del mismo grupo; la de Telecable es la
                que mejor los conserva.
              </p>
            </Texto>
            <Texto>
              <p>
                <strong>Comprobar los segundos.</strong> Cuando marques{" "}
                <Codigo>*#61#</Codigo>, la respuesta incluye el número de
                destino y la espera que ha guardado la red. Si no aparece el
                tiempo que elegiste, vuelve a marcar el código. Y para estar
                seguro de que la llamada llega, usa{" "}
                <Link href="/desvio-de-llamadas#comprobar">
                  «Comprobar desvío»
                </Link>
                .
              </p>
              <p>
                <strong>El coste del móvil.</strong> La ayuda del móvil no lo
                menciona; dependerá de tu tarifa.
              </p>
            </Texto>
          </div>
        </Seccion>

        <Seccion
          id="fijo"
          fondo
          titulo="El fijo de Telecable"
          entradilla={
            <p>
              Tres códigos, con su asterisco y su almohadilla. Descuelga, marca
              y cuelga.
            </p>
          }
        >
          <div className="grid gap-6">
            <TablaDeCodigos
              titulo="Fijo Telecable"
              filas={[
                {
                  tipo: "Si no contestas",
                  recomendado: true,
                  activar: "*61*{N}#",
                  quitar: "#61#",
                },
                {
                  tipo: "Si comunicas",
                  recomendado: true,
                  activar: "*67*{N}#",
                  quitar: "#67#",
                },
                { tipo: "Todas", activar: "*21*{N}#", quitar: "#21#" },
              ]}
              nota="Telecable no publica cómo elegir los segundos en el fijo."
            />
          </div>
          <div className="mt-8 grid gap-8">
            <Texto>
              <p>
                <strong>Cómo se factura.</strong> Telecable dice que el tramo
                desviado «se factura con tu tarifa». Es una llamada que sale de
                tu fijo hacia el número de destino, y lo que cuesta depende de a
                dónde va.
              </p>
              <p>
                La línea fija trae 4.000 minutos a otros fijos; las llamadas a
                móviles se pagan, salvo que tengas un bono. El número de Alhabla
                es un fijo, así que el tramo hasta tu recepcionista sale de esos
                4.000 minutos, que comparte con las llamadas a fijos que hagas
                tú.
              </p>
            </Texto>
            <Tabla
              cabecera={["Desvías el fijo a…", "Qué gasta"]}
              filas={[
                [
                  "Tu recepcionista (fijo de Alhabla)",
                  "Minutos de los 4.000 a fijos",
                ],
                ["Tu móvil", "Llamadas a móviles: se pagan, salvo bono"],
                ["Otro fijo", "Minutos de los 4.000 a fijos"],
              ]}
            />
          </div>
          <div className="mt-8">
            <Nota tipo="info" titulo="Centralita Big Pyme">
              <span className="inline-flex items-center gap-1.5">
                <Building2
                  className="h-4 w-4 text-apagado"
                  aria-hidden="true"
                />
                Si tu empresa tiene la centralita Big Pyme, los códigos no son
                estos.
              </span>{" "}
              Según un extracto de la ayuda que no hemos podido guardar, Big
              Pyme usa la misma familia que en Orange: <Codigo>*92</Codigo> y el
              número para no contesta y <Codigo>*93</Codigo> para quitarlo,
              entre otros. Pídeselos a Telecable.
            </Nota>
          </div>
        </Seccion>

        <Seccion
          id="dos-lineas"
          titulo="Fijo y móvil, al mismo número de Alhabla"
          entradilla={
            <p>
              Muchos negocios dan el fijo en el cartel y el móvil en WhatsApp.
              Puedes desviar las dos líneas al mismo número de tu recepcionista.
            </p>
          }
        >
          <div className="grid gap-8 lg:grid-cols-2">
            <Texto>
              <p>
                La recepcionista atiende igual venga la llamada de una o de
                otra. Lo que cambia es cómo se cobra cada tramo: el del fijo
                sale de los 4.000 minutos a fijos; el del móvil, de lo que
                incluya tu tarifa móvil, que la ayuda de Telecable no detalla
                para el desvío.
              </p>
              <p>
                Si solo vas a desviar una, elige la que más suena. Si el fijo es
                el que conoce todo el mundo, empieza por él: es el que tiene las
                condiciones más claras.
              </p>
            </Texto>
            <Texto>
              <p>
                <strong>Comprobar las dos.</strong>{" "}
                <Link href="/desvio-de-llamadas#comprobar">
                  «Comprobar desvío»
                </Link>{" "}
                llama a la línea de clientes que tengas en tu panel. Para la
                otra, llámala desde otro teléfono, no la cojas y espera: si te
                atiende tu recepcionista, está bien puesta. En el móvil, además,{" "}
                <Codigo>*#61#</Codigo> te dice a qué número va el desvío.
              </p>
            </Texto>
          </div>
        </Seccion>

        <Fuentes
          consultadas="2026-10-20"
          fuentes={[
            {
              nombre: "Telecable: desvío de llamadas en el móvil",
              url: "https://telecable.es/ayuda-clientes/desvio-llamadas-movil",
            },
            {
              nombre: "Telecable: desviar llamadas del fijo",
              url: "https://telecable.es/ayuda-clientes/desviar-llamadas-fijo",
            },
            {
              nombre: "Telecable: restricción de llamadas salientes del fijo",
              url: "https://telecable.es/ayuda-clientes/restriccion-llamadas-salientes-fijo",
            },
          ]}
        />
      </ConNumeroDeAlhabla>
    </PaginaGuia>
  );
}
