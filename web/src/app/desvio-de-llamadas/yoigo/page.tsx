import Link from "next/link";
import { Voicemail } from "lucide-react";
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
 * Desvío en Yoigo (2026-10-20), con yoigo.com/ayuda. Yoigo solo publica el
 * desvío de todas para el móvil; los condicionales salen únicamente en la
 * guía de su contestador (633) y del aviso de llamadas perdidas (556). Que
 * el estándar `**61*número#` funcione hacia Alhabla es una deducción
 * razonable a partir de eso, y la página la marca como tal.
 */

const ruta = "/desvio-de-llamadas/yoigo";
const titulo = "Desviar llamadas en Yoigo a tu recepcionista de IA";
const descripcion =
  "Lo que Yoigo publica del desvío en móvil y fijo, por qué su contestador 633 te da la pista del código y qué pasa con el aviso de llamadas del 556.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

const faqs = [
  {
    question: "¿Yoigo deja desviar las llamadas que no contesto a otro número?",
    answer:
      "Su ayuda no lo publica: para el móvil solo explica el desvío de todas. Pero su guía del contestador usa los códigos condicionales estándar (**61*, **67*, **62*) con el 633, así que con el número de Alhabla deberían funcionar igual. Es una deducción: compruébalo con «Comprobar desvío».",
  },
  {
    question: "¿Qué es el 633 que sale en los códigos de Yoigo?",
    answer:
      "Es el número de su contestador. Los códigos **61*633#, **67*633# y **62*633# mandan al contestador las llamadas que no coges, cuando comunicas o cuando estás apagado.",
  },
  {
    question: "¿Y el 556?",
    answer:
      "El aviso de llamadas perdidas. Cuando quitas el contestador, Yoigo propone dejar los condicionales apuntando al 556 (*61*556#, *67*556#, *62*556#) para recibir el aviso. Si pones Alhabla, sustituye a ese aviso.",
  },
  {
    question: "¿Cuánto me cuesta desviar el móvil?",
    answer:
      "Lo que te cobre tu tarifa. Yoigo lo explica así: es como si estuvieras llamando a ese número.",
  },
  {
    question: "¿Y si desvío el fijo?",
    answer:
      "Del fijo a otro fijo es ilimitado, y el de Alhabla es un fijo. Si desviaras a un móvil, gastarías los 60 minutos a móviles de la tarifa y después pagarías 0,20 € el minuto más 0,30 € de establecimiento, impuestos incluidos.",
  },
  {
    question: "¿Puedo elegir cuántos segundos suena antes de desviar?",
    answer:
      "Para su contestador sí: **61*633**30# hace que salte a los 30 segundos. Para otro número no lo publica. Puedes probar **61*número**20# y mirar con *#61# si la red lo ha guardado. En el fijo, Yoigo dice que no se pueden alargar los tonos del contestador.",
  },
  {
    question: "¿Cómo vuelvo a mi contestador si quito el desvío?",
    answer:
      "Quita tus desvíos (Yoigo pide desactivarlos todos antes de activar el contestador) y vuelve a marcar **61*633#, **67*633# y **62*633#.",
  },
];

export default function DesvioYoigoPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      migas={[
        { name: "Desvío de llamadas", path: "/desvio-de-llamadas" },
        { name: "Yoigo", path: ruta },
      ]}
      etiqueta={{ icono: Voicemail, texto: "Yoigo · móvil y fijo" }}
      titulo={titulo}
      entradilla={
        <p>
          Yoigo solo publica el desvío de todas las llamadas para el móvil. Los
          condicionales, los que interesan para una recepcionista, aparecen en
          otra página suya: la de su contestador. Ahí está la pista.
        </p>
      }
      descripcion={descripcion}
      ctaSecundario={{ texto: "Ir al fijo", href: "#fijo" }}
      ubicacion="desvio_yoigo"
      faqs={faqs}
      tituloFaqs="Preguntas sobre el desvío en Yoigo"
      relacionadas={[
        {
          href: "/desvio-de-llamadas/masmovil",
          titulo: "Desvío en MásMóvil",
          texto:
            "Mismas condiciones del fijo que Yoigo, otra forma de publicar el móvil.",
        },
        {
          href: "/desvio-de-llamadas",
          titulo: "Guía de desvío por operador",
          texto: "Los códigos estándar y cuál poner.",
        },
        {
          href: "/desvio-de-llamadas/iphone-y-android",
          titulo: "Desvío desde los ajustes del móvil",
          texto: "Samsung, Xiaomi, Huawei y el caso del iPhone.",
        },
        {
          href: "/blog/desviar-llamadas-sin-cambiar-de-numero",
          titulo: "Qué pasa después del desvío",
          texto: "La llamada desviada, de principio a fin.",
        },
      ]}
      cierre="Que ninguna llamada a tu Yoigo acabe en el 633."
    >
      <ConNumeroDeAlhabla>
        <Seccion
          id="movil"
          titulo="Lo que publica Yoigo para el móvil, y lo que se deduce"
          entradilla={
            <p>
              En su ayuda del desvío solo aparece el de todas:{" "}
              <Codigo>*21*número#</Codigo>, que se quita con{" "}
              <Codigo>#21#</Codigo>. El móvil deja de sonar, así que no es el
              que quieres.
            </p>
          }
        >
          <Texto>
            <p>
              La guía del contestador de Yoigo, en cambio, usa los tres
              condicionales de la norma GSM con el 633, que es el número del
              contestador: <Codigo>**61*633#</Codigo> para las que no coges,{" "}
              <Codigo>**67*633#</Codigo> para cuando comunicas y{" "}
              <Codigo>**62*633#</Codigo> para cuando estás apagado o sin
              cobertura. Si la red de Yoigo acepta esos códigos con el 633, lo
              razonable es que los acepte con otro número. Por eso la tabla de
              abajo usa los mismos códigos con el de Alhabla.
            </p>
            <p>
              Es una <strong>deducción</strong>, no algo que Yoigo diga. Después
              de marcarlos, haz la prueba de{" "}
              <Link href="/desvio-de-llamadas#comprobar">
                «Comprobar desvío»
              </Link>
              : si el panel dice «Desvío funcionando», ya no hay duda.
            </p>
          </Texto>
          <div className="mt-8 grid gap-6">
            <CampoNumeroDeAlhabla />
            <TablaDeCodigos
              titulo="Móvil Yoigo"
              subtitulo="Los tres primeros, deducidos de su guía del contestador; el último, como lo publica Yoigo."
              filas={[
                {
                  tipo: "Si no coges",
                  recomendado: true,
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
                  tipo: "Todas (publicado por Yoigo)",
                  activar: "*21*{N}#",
                  quitar: "#21#",
                },
              ]}
              nota="Los códigos de quitar y consultar de los condicionales son los de la norma; Yoigo no los publica para un número que no sea el suyo."
            />
          </div>
          <div className="mt-8">
            <Texto>
              <p>
                <strong>El coste.</strong> Yoigo dice que el desvío cuesta lo de
                tu tarifa, «como si estuvieras llamando a ese número». Con una
                tarifa de llamadas ilimitadas a fijos y móviles nacionales, ese
                tramo entra en ella; si la tuya tiene minutos contados, cada
                llamada desviada los gasta.
              </p>
              <p>
                <strong>Los segundos.</strong> En la misma guía,{" "}
                <Codigo>**61*633**30#</Codigo> hace que el contestador salte a
                los 30 segundos. O sea, la red de Yoigo admite el parámetro de
                los segundos. Para un número distinto del 633 no lo publica:
                puedes probar <Codigo>**61*número**20#</Codigo> y mirar con{" "}
                <Codigo>*#61#</Codigo> qué ha quedado guardado.
              </p>
            </Texto>
          </div>
        </Seccion>

        <Seccion
          id="buzon"
          fondo
          titulo="El 633, el 556 y cómo no liarte"
          entradilla={
            <p>
              Antes de que pongas a tu recepcionista, esos tres desvíos ya
              apuntaban a algún sitio: al contestador o al aviso de llamadas
              perdidas.
            </p>
          }
        >
          <div className="grid gap-8">
            <Tabla
              cabecera={["Destino", "Qué hace", "Códigos"]}
              filas={[
                [
                  "633",
                  "Contestador de Yoigo",
                  "**61*633#, **67*633#, **62*633#",
                ],
                [
                  "556",
                  "Aviso de llamadas perdidas",
                  "*61*556#, *67*556#, *62*556#",
                ],
                [
                  "Alhabla",
                  "Tu recepcionista contesta y reserva",
                  "**61*número#, **67*número#, **62*número#",
                ],
              ]}
              nota="Los del 556 llevan un solo asterisco al principio: así los publica Yoigo."
            />
            <Texto>
              <p>
                Cada situación (no coges, comunicas, apagado) solo puede apuntar
                a un destino a la vez. Al poner a Alhabla, sustituyes lo que
                hubiera: el contestador o el aviso del 556.
              </p>
              <p>
                Yoigo quita el contestador con <Codigo>#002#</Codigo>, con una
                sola almohadilla delante, y avisa de que, para activar el
                contestador, «primero tendrás que desactivar todos los desvíos».
                Si un día quieres volver al 633, quita los tuyos y marca de
                nuevo los del contestador. Lo de por qué conviene quitarlos uno
                a uno está en{" "}
                <Link href="/desvio-de-llamadas#quitar">
                  quitar el desvío sin perder el buzón
                </Link>
                .
              </p>
            </Texto>
          </div>
        </Seccion>

        <Seccion
          id="fijo"
          titulo="El fijo de Yoigo"
          entradilla={
            <p>
              Aquí Yoigo sí publica los condicionales. Descuelga, marca y pulsa
              la tecla de llamada.
            </p>
          }
        >
          <div className="grid gap-6">
            <TablaDeCodigos
              titulo="Fijo Yoigo"
              filas={[
                {
                  tipo: "Si no contestas",
                  recomendado: true,
                  activar: "*61*{N}#",
                  quitar: "#61#",
                },
                { tipo: "Si comunicas", activar: "*67*{N}#", quitar: "#67#" },
                { tipo: "Todas", activar: "*21*{N}#", quitar: "#21#" },
              ]}
            />
          </div>
          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <Texto>
              <p>
                <strong>Por qué al fijo de Alhabla te sale a cuenta.</strong> La
                tarifa del fijo incluye 60 minutos a móviles; pasados, cada
                minuto cuesta 0,20 € más 0,30 € de establecimiento, impuestos
                incluidos. De fijo a fijo, en cambio, es ilimitado. Como el
                número de Alhabla es un fijo, desviar tu fijo a la recepcionista
                no gasta esos 60 minutos. Desviarlo a tu móvil, sí.
              </p>
            </Texto>
            <Nota tipo="info" titulo="Los tonos del fijo no se alargan">
              Yoigo dice que en el fijo «no es posible alargar los tonos de
              marcado en el contestador». Para el desvío a otro número tampoco
              publica cómo cambiar los segundos.
            </Nota>
          </div>
        </Seccion>

        <Fuentes
          consultadas="2026-10-20"
          fuentes={[
            {
              nombre: "Yoigo: desvío de llamadas en el móvil",
              url: "https://www.yoigo.com/ayuda/desvio-de-llamadas-en-el-movil",
            },
            {
              nombre: "Yoigo: desviar llamadas del fijo",
              url: "https://www.yoigo.com/ayuda/como-puedo-desviar-llamadas-de-fijo-a-movil",
            },
            {
              nombre: "Yoigo: guía rápida del contestador del móvil",
              url: "https://www.yoigo.com/ayuda/guia-rapida-de-uso-del-contestador-de-mi-movil",
            },
          ]}
        />
      </ConNumeroDeAlhabla>
    </PaginaGuia>
  );
}
