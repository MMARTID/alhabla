import Link from "next/link";
import { Smartphone } from "lucide-react";
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
 * Desvío en R, el operador gallego (2026-10-20), con mundo-r.com/ayuda-clientes
 * y su blog. Lo propio de R: el texto de su ayuda del móvil enseña los
 * códigos incompletos (se dan los de la norma), deja hacerlo todo desde la
 * app (móvil y fijo), cobra el desvío a otro número como llamada de tu línea
 * pero no el desvío al contestador, y en el fijo no publica cómo quitar el
 * «si comunicas».
 */

const ruta = "/desvio-de-llamadas/r-galicia";
const titulo = "Desviar llamadas en R (Galicia) a tu recepcionista de IA";
const descripcion =
  "Códigos de R para el móvil y el fijo, y la forma más fácil: la app de R, que desvía el fijo si no contestas «en un tiempo determinado».";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

const faqs = [
  {
    question: "Los códigos de la web de R no me funcionan. ¿Qué pasa?",
    answer:
      "En el texto de su página del desvío del móvil, varios códigos aparecen incompletos, como «*21… #». El único que sale entero es el de no contesta, **61*número#. Usa los de la norma GSM que tienes aquí o, más fácil, la app de R.",
  },
  {
    question: "¿Cuánto cuesta desviar las llamadas a Alhabla?",
    answer:
      "R dice que las llamadas desviadas a otro número se cobran como llamadas realizadas desde tu línea. Si tu tarifa incluye las llamadas a fijos nacionales, el tramo hasta Alhabla entra ahí. Desviar al contestador es gratis.",
  },
  {
    question: "¿Puedo hacerlo todo desde la app de R?",
    answer:
      "Sí. Para el móvil: configurar › configurar móbilR › configurar desvíos. Para el fijo: Teléfono › Configurar teléfono › Configurar desvíos del teléfono fijo. También desde el área de clientes de la web.",
  },
  {
    question: "¿Cómo quito el desvío si comunica del fijo?",
    answer:
      "R publica cómo activarlo (*67*número#) pero no el código para quitarlo. Hazlo desde la app o el área de clientes, en el mismo sitio donde se configura.",
  },
  {
    question: "¿Cuánto tarda en activarse desde la app?",
    answer: "R dice que la confirmación llega en 20 o 30 segundos.",
  },
  {
    question: "¿Puedo elegir cuántos segundos suena?",
    answer:
      "R no publica un código para eso. En la app y en el área de clientes, el desvío del fijo si no contestas se configura «en un tiempo determinado»; para el móvil no da detalles.",
  },
  {
    question: "¿La recepcionista habla gallego?",
    answer:
      "Si tu negocio está en Galicia y su dirección lleva el código postal, sí: atiende en gallego a quien llama en gallego, sin que tengas que configurar nada más. Si la dirección no lo lleva, elige el gallego como idioma principal en Agente › Cómo atiende.",
  },
];

export default function DesvioRGaliciaPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      migas={[
        { name: "Desvío de llamadas", path: "/desvio-de-llamadas" },
        { name: "R (Galicia)", path: ruta },
      ]}
      etiqueta={{ icono: Smartphone, texto: "R · móvil y fijo" }}
      titulo={titulo}
      entradilla={
        <p>
          Con R puedes desviar tanto el móvil como el fijo desde su app, sin
          marcar ningún código. Si prefieres el teclado, aquí tienes los códigos
          completos: en la web de R algunos aparecen a medias.
        </p>
      }
      descripcion={descripcion}
      ctaSecundario={{ texto: "Desde la app de R", href: "#app" }}
      ubicacion="desvio_r"
      faqs={faqs}
      tituloFaqs="Preguntas sobre el desvío en R"
      relacionadas={[
        {
          href: "/recepcionista-ia-en-gallego",
          titulo: "Atención en gallego",
          texto: "En Galicia atiende en gallego a quien llama en gallego.",
        },
        {
          href: "/desvio-de-llamadas/telecable",
          titulo: "Desvío en Telecable",
          texto:
            "Del mismo grupo, con los códigos enteros en sus datos estructurados.",
        },
        {
          href: "/desvio-de-llamadas/euskaltel",
          titulo: "Desvío en Euskaltel",
          texto: "La otra web con asteriscos perdidos.",
        },
        {
          href: "/desvio-de-llamadas",
          titulo: "Guía del desvío",
          texto: "Los tres desvíos que conviene poner.",
        },
      ]}
      cierre="Con R, en castellano o en gallego, cada llamada tiene respuesta."
    >
      <ConNumeroDeAlhabla>
        <Seccion
          id="app"
          titulo="Lo más fácil: la app de R"
          entradilla={
            <p>
              R deja configurar los desvíos de las dos líneas desde su app y
              desde el área de clientes de la web. Es la vía más segura, porque
              no dependes de cómo se vean los códigos en su página.
            </p>
          }
        >
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <h3 className="text-lg font-bold text-tinta">Para el móvil</h3>
              <div className="mt-4">
                <Pasos
                  pasos={[
                    {
                      titulo: "Abre la app de R",
                      texto: "O entra en el área de clientes de mundo-r.com.",
                    },
                    {
                      titulo: "Configurar › configurar móbilR",
                      texto: "Así lo llama R en su ayuda.",
                    },
                    {
                      titulo: "Configurar desvíos",
                      texto:
                        "Activa los que quieras y escribe el número de Alhabla como destino.",
                    },
                  ]}
                />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold text-tinta">Para el fijo</h3>
              <div className="mt-4">
                <Pasos
                  pasos={[
                    {
                      titulo: "Teléfono › Configurar teléfono",
                      texto: "Dentro de la app de R.",
                    },
                    {
                      titulo: "Configurar desvíos del teléfono fijo",
                      texto: "Todas, si comunicas o si no contestas.",
                    },
                    {
                      titulo: "Elige «a un número»",
                      texto:
                        "En lugar del contestador, y escribe el de tu recepcionista. La confirmación llega en 20 o 30 segundos.",
                    },
                  ]}
                />
              </div>
            </div>
          </div>
          <div className="mt-8">
            <Texto>
              <p>
                En la app, el desvío del fijo si no contestas se hace «en un
                tiempo determinado». R no publica cuál es ese tiempo ni si se
                puede cambiar; para el móvil no dice nada de segundos.
              </p>
            </Texto>
          </div>
        </Seccion>

        <Seccion
          id="movil"
          fondo
          titulo="Los códigos del móvil, completos"
          entradilla={
            <p>
              En la página de R, el inmediato aparece como «*21… #», y el de
              comunicando y el de apagado, también cortados. Solo el de no
              contesta sale entero: <Codigo>**61*número#</Codigo>. Estos son los
              de la norma GSM.
            </p>
          }
        >
          <div className="grid gap-6">
            <CampoNumeroDeAlhabla />
            <TablaDeCodigos
              titulo="Móvil R"
              filas={[
                {
                  tipo: "Si no contestas",
                  recomendado: true,
                  activar: "**61*{N}#",
                  quitar: "##61#",
                  consultar: "*#61#",
                  detalle: "El único que la web de R muestra entero.",
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
                  tipo: "Inmediato",
                  activar: "**21*{N}#",
                  quitar: "##21#",
                  consultar: "*#21#",
                },
              ]}
            />
          </div>
        </Seccion>

        <Seccion
          id="fijo"
          titulo="Los códigos del fijo"
          entradilla={
            <p>
              Para el fijo, R los publica completos, salvo uno: el de quitar el
              desvío si comunicas.
            </p>
          }
        >
          <div className="grid gap-6">
            <TablaDeCodigos
              titulo="Fijo R"
              filas={[
                {
                  tipo: "Si no contestas",
                  recomendado: true,
                  activar: "*61*{N}#",
                  quitar: "#61#",
                },
                {
                  tipo: "Si comunicas",
                  activar: "*67*{N}#",
                  detalle:
                    "R no publica el código para quitarlo: hazlo desde la app o el área de clientes.",
                },
                { tipo: "Todas", activar: "*21*{N}#", quitar: "#21#" },
              ]}
            />
          </div>
        </Seccion>

        <Seccion
          id="coste"
          fondo
          titulo="Lo que cobra R"
          entradilla={
            <p>
              R lo explica en una frase: «Las llamadas desviadas a otro número
              se cobran como llamadas realizadas desde tu línea». Los desvíos al
              contestador, en cambio, son gratis.
            </p>
          }
        >
          <div className="grid gap-8">
            <Tabla
              cabecera={["Destino del desvío", "Cómo se cobra"]}
              filas={[
                ["Contestador de R", "Gratis"],
                [
                  "Otro número (Alhabla)",
                  "Como una llamada desde tu línea a ese número",
                ],
              ]}
            />
            <Texto>
              <p>
                El número de Alhabla es un fijo geográfico español. Si tu tarifa
                incluye las llamadas a fijos nacionales, el tramo desviado entra
                en ella. Si no, cada llamada que pasa a tu recepcionista se
                cobra como una llamada tuya a un fijo.
              </p>
            </Texto>
          </div>
          <div className="mt-8">
            <Nota tipo="info" titulo="En Galicia, también en gallego">
              Con el código postal de Galicia en la dirección de tu negocio, tu
              recepcionista atiende en gallego a quien llama en gallego, y en
              castellano a quien prefiere el castellano. Si la dirección no lo
              lleva, elige el gallego como idioma principal en Agente › Cómo
              atiende.{" "}
              <Link
                href="/recepcionista-ia-en-gallego"
                className="font-semibold underline underline-offset-4"
              >
                Cómo funciona
              </Link>
              . Cuando lo tengas activado, compruébalo con{" "}
              <Link
                href="/desvio-de-llamadas#comprobar"
                className="font-semibold underline underline-offset-4"
              >
                «Comprobar desvío»
              </Link>
              .
            </Nota>
          </div>
        </Seccion>

        <Seccion
          id="contestador"
          titulo="Del contestador de R a tu recepcionista"
          entradilla={
            <p>
              Si hoy tus desvíos van al contestador de R, no te cuestan nada. Al
              cambiarlos al número de Alhabla, pasan a cobrarse como llamadas de
              tu línea.
            </p>
          }
        >
          <div className="grid gap-8 lg:grid-cols-2">
            <Texto>
              <p>
                Con una tarifa que incluya las llamadas a fijos nacionales no
                notarás la diferencia. Si la tuya no las incluye, tenlo en
                cuenta al decidir qué desvíos pones: el de no contestas es el
                que más llamadas recoge, y el de comunicas, el que salva al
                cliente que llama mientras hablas con otro.
              </p>
              <p>
                Cada situación solo puede ir a un destino. No puedes tener a la
                vez el contestador y a tu recepcionista para las llamadas que no
                coges, pero sí repartir: por ejemplo, Alhabla si no contestas y
                el contestador si comunicas. No es lo que recomendamos, porque
                quien llama mientras hablas también quiere su cita.
              </p>
            </Texto>
            <Texto>
              <p>
                <strong>Volver atrás.</strong> En el fijo, la app de R ofrece en
                la misma pantalla las dos opciones, «a un número» o «al
                contestador»: basta con cambiar de una a otra. En el móvil,
                quita el desvío con <Codigo>##61#</Codigo> (o desde la app) y
                vuelve a poner el contestador desde la app de R o el área de
                clientes.
              </p>
            </Texto>
          </div>
        </Seccion>

        <Fuentes
          consultadas="2026-10-20"
          fuentes={[
            {
              nombre: "R: desvío de llamadas del móvil",
              url: "https://mundo-r.com/es/ayuda-clientes/desvio-movil-r",
            },
            {
              nombre: "R: desvío de llamadas del fijo",
              url: "https://mundo-r.com/es/ayuda-clientes/desvio-llamadas",
            },
            {
              nombre: "Blog de R: configurar el desvío del fijo",
              url: "https://blog.mundo-r.com/es/como-configurar-desvio-llamadas-telefono-fijo-r",
            },
          ]}
        />
      </ConNumeroDeAlhabla>
    </PaginaGuia>
  );
}
