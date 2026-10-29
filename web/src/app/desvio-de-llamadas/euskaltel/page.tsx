import Link from "next/link";
import { Wrench } from "lucide-react";
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
 * Desvío en Euskaltel (datos del 2026-10-20), con euskaltel.com/ayuda-clientes
 * y su PDF de tarifas de agosto de 2026. Lo propio de Euskaltel: el texto
 * visible de su ayuda del móvil muestra los códigos sin asteriscos (los datos
 * estructurados de la misma página traen la forma buena), el buzón es el 2242
 * y en el fijo los tres desvíos no tienen cuota, con 4.000 minutos a fijos
 * incluidos.
 */

const ruta = "/desvio-de-llamadas/euskaltel";
const titulo = "Desviar llamadas en Euskaltel a tu recepcionista de IA";
const descripcion =
  "Los códigos de Euskaltel bien escritos (su web pierde asteriscos), los segundos de 5 a 30, el buzón 2242 y lo que cuesta desviar el fijo.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

const faqs = [
  {
    question: "¿Qué es el «Desvío Estático» que sale en las tarifas?",
    answer:
      "Una línea aparte de las tarifas del fijo, con 0,726 € de alta en telefonía digital. Euskaltel no explica en qué se diferencia de los otros desvíos, que figuran sin cuota.",
  },
  {
    question: "Doy el móvil y el fijo. ¿Desvío los dos?",
    answer:
      "Puedes desviar los dos al mismo número de Alhabla. «Comprobar desvío» llama a la línea de clientes que tengas en tu panel; la otra, pruébala llamándola desde otro teléfono sin cogerla.",
  },
  {
    question: "¿La recepcionista atiende en euskera?",
    answer:
      "Si tu negocio está en Euskadi, sí: el euskera se activa solo con el código postal de la dirección de tu negocio. Si la dirección no lo lleva, elige el euskera como idioma principal en tu panel, en «Cómo atiende».",
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
          href: "/desvio-de-llamadas",
          titulo: "Todos los operadores",
          texto: "Desviar o dar el número de Alhabla, y cómo quitarlo.",
        },
        {
          href: "/recepcionista-ia-en-euskera",
          titulo: "Atención en euskera",
          texto: "En Euskadi, en euskera con el código postal de tu dirección.",
        },
        {
          href: "/desvio-de-llamadas/telecable",
          titulo: "Desvío en Telecable",
          texto: "Del mismo grupo, también con segundos de 5 a 30.",
        },
      ]}
      cierre="Con Euskaltel, en castellano o en euskera, ninguna llamada sin atender."
    >
      <ConNumeroDeAlhabla>
        <Seccion
          id="movil"
          titulo="En tu móvil Euskaltel, con los asteriscos que faltan"
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
              titulo="Móvil Euskaltel"
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
            />
          </div>
          <div className="mt-8">
            <Texto>
              <p>
                <strong>Qué pagas.</strong> Para el móvil, Euskaltel dice que es
                un servicio gratuito. No aclara el precio de la llamada
                desviada, que dependerá de lo que incluya tu tarifa.
              </p>
            </Texto>
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Nota
              tipo="importante"
              titulo="Su web pierde asteriscos, y el buzón es el 2242"
            >
              <p>
                En la ayuda de Euskaltel los códigos salen con asteriscos de
                menos, y un código con asteriscos de menos ya no es el mismo
                código: usa los de la tabla. Además, su buzón (el 2242) se
                activa con estos mismos desvíos: cambia los tres, o las
                llamadas que entren mientras comunicas o sin cobertura seguirán
                yendo al buzón. Para volver a él, marca{" "}
                <Codigo>**61*2242#</Codigo>.
              </p>
            </Nota>
            <ComprobarDesvio>
              <p>
                Marca <Codigo>*#61#</Codigo>: tiene que salir el número de
                Alhabla y los segundos que elegiste.
              </p>
            </ComprobarDesvio>
          </div>
        </Seccion>

        <Seccion
          id="fijo"
          fondo
          titulo="El fijo de Euskaltel, sin cuota"
          entradilla={
            <p>
              En el fijo, los códigos de la ayuda sí están completos. Descuelga,
              marca y cuelga.
            </p>
          }
        >
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
            nota="Euskaltel no publica código de consulta para el fijo: la prueba es «Comprobar desvío»."
          />
          <div className="mt-8">
            <Texto>
              <p>
                <strong>Qué pagas.</strong> En las tarifas de agosto de 2026,
                los tres desvíos del fijo van sin cuota mensual, y la línea
                incluye 4.000 minutos a fijos. El número de Alhabla es un fijo:
                el tramo desviado sale de esa bolsa. Y si tu negocio está en
                Euskadi, la recepcionista contesta en euskera a quien llama en
                euskera:{" "}
                <Link href="/recepcionista-ia-en-euskera">cómo funciona</Link>.
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
