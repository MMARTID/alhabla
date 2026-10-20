import Link from "next/link";
import { BellOff, Plane, Smartphone, Voicemail } from "lucide-react";
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
  Tarjetas,
  Texto,
} from "@/components/pagina-guia";
import { metadataDePagina } from "@/lib/seo";

/**
 * Desvío en Digi (2026-10-20), con digimobil.es (servicios adicionales y
 * preguntas frecuentes). Lo propio de Digi: el desvío del móvil es
 * incompatible con la itinerancia, con el aviso de llamada perdida (activo de
 * serie) y con el desvío de todas al buzón; su fijo no tiene «si comunica».
 */

const ruta = "/desvio-de-llamadas/digi";
const titulo = "Desviar llamadas en Digi a tu recepcionista de IA";
const descripcion =
  "Códigos de Digi para móvil y fijo, y lo que no funciona a la vez que el desvío: la itinerancia, el aviso de llamada perdida y el desvío al buzón.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

const faqs = [
  {
    question: "¿Funciona el desvío de Digi si estoy en el extranjero?",
    answer:
      "Digi dice que el desvío es incompatible con la itinerancia. No explica más, así que, si viajas con tu línea de Digi, no des por hecho que las llamadas que no coges seguirán llegando a tu recepcionista.",
  },
  {
    question:
      "¿Por qué me dice Digi que el desvío es incompatible con el aviso de llamada perdida?",
    answer:
      "Porque los dos servicios no pueden funcionar a la vez, y el aviso viene activado de serie. Si el código de desvío te da error, pregúntale a Digi por ese aviso.",
  },
  {
    question: "¿Puedo desviar el fijo de Digi cuando comunica?",
    answer:
      "Digi no lo publica. Para el fijo solo explica el desvío de todas (*21*número#) y el de no contestas (*61*número#).",
  },
  {
    question: "¿Cuánto cuesta desviar con Digi?",
    answer:
      "Para el móvil, Digi dice que depende del plan de precios y del producto. Para el fijo no da precio.",
  },
  {
    question: "¿Cómo quito el desvío sin perder el buzón?",
    answer:
      "Con ##61# (y ##67# o ##62# si los pusiste), uno a uno. ##002# quita todos los desvíos y también el contestador; luego tendrías que volver a activarlo en Mi DIGI o llamando al 1200.",
  },
  {
    question: "¿Se desvían los SMS?",
    answer: "No. Digi lo deja claro: el desvío no afecta a los mensajes.",
  },
  {
    question: "¿A qué números puedo desviar?",
    answer:
      "A móviles y fijos nacionales, como el de Alhabla. No a números internacionales, cortos, de emergencia ni de tarificación especial.",
  },
];

export default function DesvioDigiPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      migas={[
        { name: "Desvío de llamadas", path: "/desvio-de-llamadas" },
        { name: "Digi", path: ruta },
      ]}
      etiqueta={{ icono: Smartphone, texto: "Digi · móvil y fijo" }}
      titulo={titulo}
      entradilla={
        <p>
          Digi publica los cuatro desvíos del móvil con su código de consulta, y
          dos para el fijo. Lo que lo distingue es la lista de cosas con las que
          el desvío no puede convivir, empezando por la itinerancia.
        </p>
      }
      descripcion={descripcion}
      ctaSecundario={{
        texto: "Lo que no es compatible",
        href: "#incompatible",
      }}
      ubicacion="desvio_digi"
      faqs={faqs}
      tituloFaqs="Preguntas sobre el desvío en Digi"
      relacionadas={[
        {
          href: "/desvio-de-llamadas",
          titulo: "Desvío de llamadas por operador",
          texto: "Los códigos estándar y la tabla de todos.",
        },
        {
          href: "/desvio-de-llamadas/iphone-y-android",
          titulo: "El desvío desde los ajustes del móvil",
          texto: "Digi también lo permite: la ruta en cada marca.",
        },
        {
          href: "/desvio-de-llamadas/lowi",
          titulo: "Desvío en Lowi",
          texto: "Otro operador donde ##002# quita también el contestador.",
        },
        {
          href: "/blog/desvio-de-llamadas-si-no-contesta",
          titulo: "El desvío si no contesta",
          texto: "Errores típicos al activarlo.",
        },
      ]}
      cierre="Con Digi, las llamadas que no coges también tienen quien las atienda."
    >
      <ConNumeroDeAlhabla>
        <Seccion
          id="movil"
          titulo="Los códigos del móvil Digi"
          entradilla={
            <p>
              Desde el teclado de la app Teléfono. Digi también deja activarlos
              desde los ajustes del propio móvil, si lo prefieres.
            </p>
          }
        >
          <div className="grid gap-6">
            <CampoNumeroDeAlhabla />
            <TablaDeCodigos
              titulo="Móvil Digi"
              filas={[
                {
                  tipo: "Si no contestas",
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
                  tipo: "Todas",
                  activar: "**21*{N}#",
                  quitar: "##21#",
                  consultar: "*#21#",
                },
                {
                  tipo: "Todos a la vez",
                  quitar: "##002#",
                  detalle: "Quita todos los desvíos, el contestador incluido.",
                },
              ]}
              nota="Digi no publica cómo elegir los segundos de espera antes de desviar."
            />
          </div>
          <div className="mt-8">
            <Texto>
              <p>
                <strong>Coste y destinos.</strong> Digi dice que el precio
                depende «del plan de precios y del producto», sin más detalle.
                Se puede desviar a móviles y fijos nacionales; el de Alhabla es
                un fijo geográfico, así que entra. No a internacionales, números
                cortos, de emergencia ni de tarificación especial.
              </p>
            </Texto>
          </div>
        </Seccion>

        <Seccion
          id="incompatible"
          fondo
          titulo="Lo que no puede convivir con el desvío"
          entradilla={
            <p>
              La página de servicios adicionales de Digi enumera lo que es
              incompatible con el desvío del móvil. Para un negocio, conviene
              leerlo antes de activarlo.
            </p>
          }
        >
          <Tarjetas
            items={[
              {
                icono: Plane,
                titulo: "La itinerancia",
                texto:
                  "Si estás fuera de España con tu línea en itinerancia, el desvío no es compatible. Digi no detalla qué pasa con las llamadas en ese caso: si viajas, no cuentes con que lleguen a tu recepcionista.",
              },
              {
                icono: BellOff,
                titulo: "El aviso de llamada perdida",
                texto:
                  "Viene activado de serie y no puede funcionar a la vez que el desvío. Si al marcar el código te da error, es un buen sitio por el que empezar a preguntar a Digi.",
              },
              {
                icono: Voicemail,
                titulo: "El desvío de todas al buzón",
                texto:
                  "Si un día mandaste todas tus llamadas al buzón, ese desvío choca con los demás. Quítalo antes de poner los tuyos a Alhabla.",
              },
            ]}
          />
          <div className="mt-8">
            <Nota tipo="consejo" titulo="Si viajas a menudo">
              Cuando tu línea de Digi está en itinerancia, el desvío no te
              protege. Si pasas temporadas fuera, la alternativa que no depende
              del desvío es{" "}
              <Link
                href="/desvio-de-llamadas#cual"
                className="font-semibold underline underline-offset-4"
              >
                publicar el número de Alhabla como principal
              </Link>
              : la recepcionista contesta siempre, estés donde estés.
            </Nota>
          </div>
        </Seccion>

        <Seccion
          id="buzon"
          titulo="El buzón de Digi"
          entradilla={
            <p>
              Según Digi, el buzón guarda mensajes «cuando estás comunicando,
              sin cobertura o con el móvil apagado». No menciona el caso de no
              contestar.
            </p>
          }
        >
          <Texto>
            <p>
              Con esa descripción no queda claro si el buzón de Digi recoge
              también las llamadas que no contestas. Lo que sí dice es que
              recoge las de comunicando y sin cobertura: si solo pones el 61
              hacia Alhabla, esas seguirán acabando en el buzón. Pon también el
              67 y el 62 con el mismo número.
            </p>
            <p>
              El buzón se activa en Mi DIGI › Servicios › Servicios de tu línea
              o llamando al 1200, y Digi lo quita con <Codigo>##002#</Codigo>.
              Por eso mismo no uses ese código para quitar el desvío a Alhabla:
              te llevarías el buzón por delante. Mira{" "}
              <Link href="/desvio-de-llamadas#quitar">
                cómo quitar solo el desvío
              </Link>
              .
            </p>
          </Texto>
        </Seccion>

        <Seccion
          id="fijo"
          fondo
          titulo="El fijo de Digi"
          entradilla={
            <p>
              Para el fijo, Digi publica dos desvíos y un código para quitarlos
              todos. No hay desvío «si comunica».
            </p>
          }
        >
          <div className="grid gap-6">
            <TablaDeCodigos
              titulo="Fijo Digi"
              filas={[
                {
                  tipo: "Si no contestas",
                  recomendado: true,
                  activar: "*61*{N}#",
                  quitar: "#61#",
                },
                { tipo: "Todas", activar: "*21*{N}#", quitar: "#21#" },
                {
                  tipo: "Todos a la vez",
                  quitar: "#002#",
                  detalle:
                    "Con una sola almohadilla delante, como lo publica Digi.",
                },
              ]}
              nota="Digi no indica precio para el desvío del fijo."
            />
          </div>
          <div className="mt-8">
            <Texto>
              <p>
                Sin desvío «si comunica», una llamada que entra mientras el fijo
                está ocupado no llega a tu recepcionista. Si en tu local el fijo
                comunica a menudo, valora desviar también el móvil o dar el
                número de Alhabla. Y como en el fijo no hay código de consulta
                publicado, la prueba es{" "}
                <Link href="/desvio-de-llamadas#comprobar">
                  «Comprobar desvío»
                </Link>
                .
              </p>
            </Texto>
          </div>
        </Seccion>

        <Fuentes
          consultadas="2026-10-20"
          fuentes={[
            {
              nombre: "Digi: servicios adicionales",
              url: "https://www.digimobil.es/servicios-adicionales",
            },
            {
              nombre: "Digi: preguntas frecuentes sobre tus servicios",
              url: "https://www.digimobil.es/preguntas-frecuentes/mis-servicios-contratados",
            },
          ]}
        />
      </ConNumeroDeAlhabla>
    </PaginaGuia>
  );
}
