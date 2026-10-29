import Link from "next/link";
import { Smartphone } from "lucide-react";
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
 * Desvío en Digi (datos del 2026-10-20), con digimobil.es (servicios
 * adicionales y preguntas frecuentes). Lo propio de Digi: el desvío del móvil
 * es incompatible con la itinerancia, con el aviso de llamada perdida (activo
 * de serie) y con el desvío de todas al buzón; su fijo no tiene «si comunica».
 */

const ruta = "/desvio-de-llamadas/digi";
const titulo = "Desviar llamadas en Digi a tu recepcionista de IA";
const descripcion =
  "Códigos de Digi para móvil y fijo, y lo que no funciona a la vez que el desvío: la itinerancia, el aviso de llamada perdida y el desvío al buzón.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

const faqs = [
  {
    question: "¿Puedo poner el desvío desde los ajustes del móvil?",
    answer:
      "Sí, Digi también lo permite desde el menú del teléfono. La ruta cambia en cada marca, y en un iPhone ese menú solo desvía todas las llamadas.",
  },
  {
    question: "¿A qué números puedo desviar?",
    answer:
      "A móviles y fijos nacionales, como el de Alhabla. No a números internacionales, cortos, de emergencia ni de tarificación especial.",
  },
  {
    question: "¿Cómo vuelvo a tener el buzón?",
    answer:
      "Se activa en Mi DIGI › Servicios › Servicios de tu línea o llamando al 1200. Antes, quita tus desvíos a Alhabla uno a uno.",
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
          titulo: "Todos los operadores",
          texto: "Desviar o dar el número de Alhabla, y cómo quitarlo.",
        },
        {
          href: "/desvio-de-llamadas/iphone-y-android",
          titulo: "El desvío desde los ajustes del móvil",
          texto: "La ruta en cada marca.",
        },
        {
          href: "/desvio-de-llamadas/lowi",
          titulo: "Desvío en Lowi",
          texto: "Otro operador donde ##002# quita también el contestador.",
        },
      ]}
      cierre="Con Digi, las llamadas que no coges también tienen quien las atienda."
    >
      <ConNumeroDeAlhabla>
        <Seccion
          id="movil"
          titulo="En tu móvil Digi"
          entradilla={
            <p>
              Desde el móvil que quieres desviar, en el teclado de la app
              Teléfono, y pulsa llamar.
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
                  detalle:
                    "Quita todos los desvíos, el contestador incluido. No lo uses para quitar solo el de Alhabla.",
                },
              ]}
              nota="Digi no publica cómo elegir los segundos de espera antes de desviar."
            />
          </div>
          <div className="mt-8">
            <Texto>
              <p>
                <strong>Qué pagas.</strong> Digi dice que depende del plan de
                precios y del producto, sin más detalle.
              </p>
              <p>
                <strong>Tu buzón.</strong> Según Digi, guarda mensajes cuando
                comunicas, sin cobertura o con el móvil apagado. Si solo pones
                el 61, esas llamadas seguirán acabando en él: pon también el 67
                y el 62 con el mismo número.
              </p>
            </Texto>
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div id="incompatible" className="scroll-m-20">
              <Nota tipo="importante" titulo="Lo que no convive con el desvío">
                <p>
                  <strong>La itinerancia:</strong> fuera de España, el desvío
                  no funciona; si viajas a menudo,{" "}
                  <Link
                    href="/desvio-de-llamadas#cual"
                    className="font-semibold underline underline-offset-4"
                  >
                    da el número de Alhabla como principal
                  </Link>
                  . <strong>El aviso de llamada perdida</strong>, que viene
                  activado de serie: si el código te da error, pregunta a Digi
                  por él. <strong>El desvío de todas al buzón</strong>: quítalo
                  antes de poner los tuyos.
                </p>
              </Nota>
            </div>
            <ComprobarDesvio>
              <p>
                Marca <Codigo>*#61#</Codigo>: si sale el número de Alhabla, la
                red lo ha guardado.
              </p>
            </ComprobarDesvio>
          </div>
        </Seccion>

        <Seccion
          id="fijo"
          fondo
          titulo="El fijo de Digi, sin «si comunica»"
          entradilla={
            <p>
              Para el fijo, Digi publica dos desvíos y un código para quitarlos
              todos. Una llamada que entra mientras el fijo está ocupado no
              llega a tu recepcionista: si comunica a menudo, desvía también el
              móvil o da el número de Alhabla.
            </p>
          }
        >
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
            nota="Digi no indica precio ni código de consulta para el fijo: la prueba es «Comprobar desvío»."
          />
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
