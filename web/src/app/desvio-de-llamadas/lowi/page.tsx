import Link from "next/link";
import { Scale } from "lucide-react";
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
 * Desvío en Lowi (datos del 2026-10-20), con lowi.es/asistencia. Lo propio de
 * Lowi: dos páginas de su ayuda se contradicen sobre el coste (se citan las
 * dos), nombra los «XX segundos» del desvío sin dar la sintaxis, y ##002# es
 * su forma de quitar el contestador. No tiene ayuda sobre el desvío del fijo.
 */

const ruta = "/desvio-de-llamadas/lowi";
const titulo = "Desviar llamadas en Lowi a tu recepcionista de IA";
const descripcion =
  "Códigos de Lowi para desviar el móvil a tu recepcionista de IA, lo que dicen sus dos páginas de ayuda sobre el coste y cómo no perder el contestador.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

const faqs = [
  {
    question: "¿Puedo elegir cuántos segundos suena antes de desviar?",
    answer:
      "Lowi habla de un desvío «si no contesta en XX segundos», pero el código que da no lleva los segundos. Puedes probar **61*número**20# (de 5 a 30, en pasos de 5) y marcar *#61# para ver qué ha guardado la red.",
  },
  {
    question: "¿Se puede hacer desde Mi Lowi, sin códigos?",
    answer:
      "Lowi indica que desde Mi Lowi se gestionan el contestador y los desvíos. Es la alternativa si prefieres no marcar nada.",
  },
  {
    question: "¿Puedo desviar un fijo de Lowi?",
    answer:
      "Lowi no tiene ayuda publicada sobre el desvío del fijo. Pregúntaselo o, si tu número de cara al público es ese fijo, usa el número de Alhabla como principal.",
  },
];

export default function DesvioLowiPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      migas={[
        { name: "Desvío de llamadas", path: "/desvio-de-llamadas" },
        { name: "Lowi", path: ruta },
      ]}
      etiqueta={{ icono: Scale, texto: "Lowi · móvil" }}
      titulo={titulo}
      entradilla={
        <p>
          Lowi publica los cuatro códigos de desvío para el móvil y el de
          consulta. Lo que no está tan claro es el coste: dos páginas de su
          propia ayuda dicen cosas distintas.
        </p>
      }
      descripcion={descripcion}
      ctaSecundario={{ texto: "Lo que dice del coste", href: "#coste" }}
      ubicacion="desvio_lowi"
      faqs={faqs}
      tituloFaqs="Preguntas sobre el desvío en Lowi"
      relacionadas={[
        {
          href: "/desvio-de-llamadas",
          titulo: "Todos los operadores",
          texto: "Desviar o dar el número de Alhabla, y cómo quitarlo.",
        },
        {
          href: "/desvio-de-llamadas/vodafone",
          titulo: "Desvío en Vodafone",
          texto: "Allí el coste por llamada desviada sí está publicado.",
        },
        {
          href: "/desvio-de-llamadas/pepephone",
          titulo: "Desvío en Pepephone",
          texto: "Otro que se gestiona desde el área de cliente.",
        },
      ]}
      cierre="Tu Lowi suena como siempre; si no llegas, la llamada la coge ella."
    >
      <ConNumeroDeAlhabla>
        <Seccion
          id="movil"
          titulo="En tu móvil Lowi"
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
              titulo="Móvil Lowi"
              filas={[
                {
                  tipo: "Si no contesta",
                  recomendado: true,
                  activar: "**61*{N}#",
                  quitar: "##61#",
                  consultar: "*#61#",
                },
                {
                  tipo: "Si comunica",
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
                <strong>El contestador es un desvío más.</strong> Lowi lo quita
                con <Codigo>##002#</Codigo>, así que no uses ese código para
                quitar el de Alhabla: te llevarías el contestador por delante.
                Quita los tuyos uno a uno y vuelve a activarlo desde Mi Lowi si
                lo quieres.
              </p>
            </Texto>
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div id="coste" className="scroll-m-20">
              <Nota tipo="importante" titulo="El coste, en sus dos versiones">
                <p>
                  En «Cómo activo el desvío», Lowi dice que sin una tarifa con
                  llamadas Sin Límite «este servicio puede tener costes». En
                  «Cómo desactivo el desvío», que «no tiene ningún sobre coste
                  en tu factura». Con tarifa Sin Límite, las dos llevan a lo
                  mismo: no pagas de más. Si no la tienes, pregúntaselo a Lowi
                  o revisa la primera factura.
                </p>
              </Nota>
            </div>
            <ComprobarDesvio>
              <p>
                Marca <Codigo>*#61#</Codigo>, <Codigo>*#67#</Codigo> y{" "}
                <Codigo>*#62#</Codigo>: las tres tienen que enseñar el número
                de Alhabla.
              </p>
            </ComprobarDesvio>
          </div>
          <p className="mt-6 max-w-3xl text-sm leading-6 text-muted">
            ¿Tu número de cara al público es un fijo de Lowi? No publica cómo
            desviarlo: pregúntaselo, o{" "}
            <Link
              href="/desvio-de-llamadas#cual"
              className="font-semibold text-morado-tinta underline underline-offset-4"
            >
              da el número de Alhabla como principal
            </Link>
            .
          </p>
        </Seccion>

        <Fuentes
          consultadas="2026-10-20"
          fuentes={[
            {
              nombre: "Lowi: cómo activo el desvío de llamadas",
              url: "https://www.lowi.es/asistencia/llamadas/como-activo-el-desvio-de-llamadas",
            },
            {
              nombre: "Lowi: cómo desactivo el desvío de llamadas",
              url: "https://www.lowi.es/asistencia/llamadas/como-desactivo-el-desvio-de-llamadas",
            },
            {
              nombre: "Lowi: llamada en espera, contestador e identificador",
              url: "https://www.lowi.es/asistencia/atencion-al-cliente/hay-servicio-de-llamada-en-espera-contestador-o-identificador-de-llamadas",
            },
          ]}
        />
      </ConNumeroDeAlhabla>
    </PaginaGuia>
  );
}
