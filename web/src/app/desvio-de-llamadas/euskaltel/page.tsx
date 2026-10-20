import Link from "next/link";
import { Wrench } from "lucide-react";
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
 * Desvío en Euskaltel (2026-10-20), con euskaltel.com/ayuda-clientes y su PDF
 * de tarifas de agosto de 2026. Lo propio de Euskaltel: el texto visible de
 * su ayuda del móvil muestra los códigos sin asteriscos (los datos
 * estructurados de la misma página traen la forma buena), el buzón es el
 * 2242 y en el fijo los tres desvíos no tienen cuota, con 4.000 minutos a
 * fijos incluidos.
 */

const ruta = "/desvio-de-llamadas/euskaltel";
const titulo = "Desviar llamadas en Euskaltel a tu recepcionista de IA";
const descripcion =
  "Los códigos de Euskaltel bien escritos (su web pierde asteriscos), los segundos de 5 a 30, el buzón 2242 y lo que cuesta desviar el fijo.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

const faqs = [
  {
    question:
      "He copiado el código de la web de Euskaltel y no funciona. ¿Por qué?",
    answer:
      "Porque en el texto visible de su página de ayuda del móvil faltan asteriscos. La versión que la misma página da a los buscadores sí trae la forma buena, que es la de la norma: **61*número# para el desvío si no contestas.",
  },
  {
    question: "¿Cuántos segundos puedo elegir?",
    answer:
      "Euskaltel indica una espera de 5 a 30 segundos. Se añade al final con doble asterisco: **61*número**20# desvía a los 20 segundos.",
  },
  {
    question: "¿Cuánto cuesta desviar el móvil?",
    answer:
      "Euskaltel dice que es un servicio gratuito. No aclara si la llamada desviada se cobra aparte: depende de lo que incluya tu tarifa.",
  },
  {
    question: "¿Y el fijo?",
    answer:
      "En sus tarifas de agosto de 2026, el desvío incondicional, el de si comunica y el de si no contesta van sin cuota mensual. La línea fija incluye 4.000 minutos a fijos, y el número de Alhabla es un fijo.",
  },
  {
    question: "¿Qué es el 2242?",
    answer:
      "El buzón de voz del móvil de Euskaltel. **61*2242# manda a él las llamadas que no coges; lo mismo con el 67, el 62 y el 21. Si pones Alhabla, el buzón deja de cogerlas.",
  },
  {
    question: "¿Qué es el «Desvío Estático» que sale en las tarifas?",
    answer:
      "Una línea aparte de las tarifas del fijo, con 0,726 € de alta en telefonía digital. Euskaltel no explica en qué se diferencia de los otros desvíos, que figuran sin cuota.",
  },
  {
    question: "¿La recepcionista atiende en euskera?",
    answer:
      "Si tu negocio está en Euskadi, sí: el euskera se activa solo por el código postal, y también puedes elegirlo como idioma principal.",
  },
];

export default function DesvioEuskaltelPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      migas={[
        { name: "Desvío de llamadas", path: "/desvio-de-llamadas" },
        { name: "Euskaltel", path: ruta },
      ]}
      etiqueta={{ icono: Wrench, texto: "Euskaltel · móvil y fijo" }}
      titulo={titulo}
      entradilla={
        <p>
          Si has copiado el código de la web de Euskaltel y no ha funcionado, no
          es culpa tuya: a su página de ayuda le faltan asteriscos. Aquí están
          bien escritos, con los segundos de 5 a 30 y el fijo, que no tiene
          cuota.
        </p>
      }
      descripcion={descripcion}
      ctaSecundario={{ texto: "Ir al fijo", href: "#fijo" }}
      ubicacion="desvio_euskaltel"
      faqs={faqs}
      tituloFaqs="Preguntas sobre el desvío en Euskaltel"
      relacionadas={[
        {
          href: "/recepcionista-ia-en-euskera",
          titulo: "Atención en euskera",
          texto:
            "En Euskadi entiende y contesta en euskera sin configurar nada.",
        },
        {
          href: "/desvio-de-llamadas/telecable",
          titulo: "Desvío en Telecable",
          texto: "Del mismo grupo, con los códigos completos en su ficha.",
        },
        {
          href: "/desvio-de-llamadas/r-galicia",
          titulo: "Desvío en R",
          texto: "Otra web del grupo con los códigos rotos.",
        },
        {
          href: "/desvio-de-llamadas",
          titulo: "Desvío en todos los operadores",
          texto: "Qué desvío conviene y cómo comprobarlo.",
        },
      ]}
      cierre="Con Euskaltel, en castellano o en euskera, ninguna llamada sin atender."
    >
      <ConNumeroDeAlhabla>
        <Seccion
          id="movil"
          titulo="Los códigos del móvil, con los asteriscos que faltan"
          entradilla={
            <p>
              En el texto visible de la ayuda de Euskaltel los códigos salen sin
              algunos de sus asteriscos. Los datos estructurados de esa misma
              página, lo que lee Google, dicen otra cosa: «61* … (espera un
              tiempo de 5-30 segundos) … #». Es la forma de la norma GSM.
            </p>
          }
        >
          <div className="grid gap-6">
            <CampoNumeroDeAlhabla />
            <TablaDeCodigos
              titulo="Móvil Euskaltel"
              subtitulo="Escritos según la norma GSM y los datos estructurados de su ayuda."
              filas={[
                {
                  tipo: "Si no contestas",
                  recomendado: true,
                  activar: "**61*{N}**{T}#",
                  quitar: "##61#",
                  consultar: "*#61#",
                  segundos: { opciones: [5, 10, 15, 20, 25, 30], inicial: 20 },
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
              nota="El 67 y el 62 son los que Euskaltel usa para mandar llamadas a su buzón; con el número de Alhabla deberían funcionar igual."
            />
          </div>
          <div className="mt-8">
            <Texto>
              <p>
                <strong>Por qué importa.</strong> Un código con asteriscos de
                menos ya no es el mismo código, y no tiene por qué hacer lo que
                esperas. Después de marcar el tuyo, comprueba con{" "}
                <Codigo>*#61#</Codigo> que aparece el número de Alhabla y los
                segundos que elegiste.
              </p>
              <p>
                <strong>Lo que cuesta.</strong> Para el móvil, Euskaltel dice
                que «es un servicio gratuito». Lo que no aclara es el precio de
                la llamada desviada, que dependerá de lo que incluya tu tarifa.
              </p>
            </Texto>
          </div>
        </Seccion>

        <Seccion
          id="buzon"
          fondo
          titulo="El buzón 2242"
          entradilla={
            <p>
              El buzón del móvil de Euskaltel es el 2242, y se activa con los
              mismos códigos de desvío: <Codigo>**61*2242#</Codigo>, y lo mismo
              con el 67, el 62 y el 21.
            </p>
          }
        >
          <div className="grid gap-8">
            <Texto>
              <p>
                Eso quiere decir que el buzón y tu recepcionista compiten por el
                mismo hueco. Si tenías el buzón en las tres situaciones y solo
                cambias el 61, las llamadas que entren mientras comunicas o con
                el móvil apagado seguirán yendo al 2242. Cambia los tres.
              </p>
              <p>
                Para volver al buzón algún día, quita el desvío con{" "}
                <Codigo>##61#</Codigo> y marca otra vez{" "}
                <Codigo>**61*2242#</Codigo>. El porqué de no usar un código que
                lo quite todo está en{" "}
                <Link href="/desvio-de-llamadas#quitar">
                  quitar el desvío sin perder el buzón
                </Link>
                .
              </p>
            </Texto>
            <Tabla
              cabecera={["Situación", "Al buzón", "A tu recepcionista"]}
              filas={[
                ["No contestas", "**61*2242#", "**61*número#"],
                ["Comunicas", "**67*2242#", "**67*número#"],
                ["Apagado", "**62*2242#", "**62*número#"],
              ]}
            />
          </div>
        </Seccion>

        <Seccion
          id="fijo"
          titulo="El fijo de Euskaltel"
          entradilla={
            <p>
              En el fijo, los códigos de la ayuda sí están completos. Descuelga,
              marca y cuelga.
            </p>
          }
        >
          <div className="grid gap-6">
            <TablaDeCodigos
              titulo="Fijo Euskaltel"
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
            />
          </div>
          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <Texto>
              <p>
                <strong>Sin cuota.</strong> En las tarifas de Euskaltel de
                agosto de 2026, el desvío incondicional, el de si comunica y el
                de si no contesta aparecen sin cuota mensual. Y la línea fija
                incluye 4.000 minutos a fijos: como el número de Alhabla es un
                fijo, el tramo desviado sale de esa bolsa.
              </p>
              <p>
                <strong>El «Desvío Estático».</strong> En las mismas tarifas hay
                una línea aparte, «Desvío Estático», con 0,726 € de alta en
                telefonía digital. Euskaltel no explica en ese documento en qué
                se diferencia de los otros tres.
              </p>
            </Texto>
            <Nota tipo="info" titulo="En Euskadi, también en euskera">
              Si tu negocio está en Euskadi, tu recepcionista entiende y
              contesta en euskera a quien llama en euskera, sin configurar nada.{" "}
              <Link
                href="/recepcionista-ia-en-euskera"
                className="font-semibold underline underline-offset-4"
              >
                Cómo funciona
              </Link>
            </Nota>
          </div>
        </Seccion>

        <Seccion
          id="cual"
          fondo
          titulo="¿Desvío el móvil o el fijo?"
          entradilla={
            <p>
              En Euskaltel, las dos líneas salen bien paradas. Desvía la que das
              a tus clientes, o las dos.
            </p>
          }
        >
          <Tabla
            cabecera={["", "Móvil Euskaltel", "Fijo Euskaltel"]}
            filas={[
              [
                "Coste del servicio",
                "«Es un servicio gratuito»",
                "Sin cuota mensual en los tres desvíos",
              ],
              [
                "Tramo desviado",
                "Según tu tarifa (no lo detalla)",
                "De los 4.000 minutos a fijos",
              ],
              ["Segundos de espera", "De 5 a 30", "No publicado"],
              [
                "Cómo comprobarlo",
                "*#61# y «Comprobar desvío»",
                "«Comprobar desvío»",
              ],
            ]}
          />
          <div className="mt-8">
            <Texto>
              <p>
                Si das las dos líneas, puedes desviar las dos al mismo número de
                Alhabla. «Comprobar desvío» llama a la línea de clientes que
                tengas en tu panel; la otra, pruébala llamándola desde otro
                teléfono sin cogerla. Y si lo que quieres es que la
                recepcionista coja siempre primero, tienes la alternativa de{" "}
                <Link href="/desvio-de-llamadas#cual">
                  publicar su número como principal
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
              nombre: "Euskaltel: activar el servicio de desvío de llamadas",
              url: "https://www.euskaltel.com/ayuda-clientes/activar-servicio-desvio-llamadas",
            },
            {
              nombre: "Euskaltel: configurar un desvío de llamada",
              url: "https://www.euskaltel.com/ayuda-clientes/como-configurar-un-desvio-de-llamada",
            },
            {
              nombre: "Euskaltel: contestador del móvil",
              url: "https://www.euskaltel.com/ayuda-clientes/contestador-movil-euskaltel",
            },
            {
              nombre: "Euskaltel: tarifas de agosto de 2026 (PDF)",
              url: "https://www.euskaltel.com/docs_prod/euskaltel-front/pdf/info_legal_particulares/vigentes/Euskaltel_tarifas_agosto_2026.pdf",
            },
          ]}
        />
      </ConNumeroDeAlhabla>
    </PaginaGuia>
  );
}
