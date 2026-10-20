import Link from "next/link";
import { Scale } from "lucide-react";
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
 * Desvío en Lowi (2026-10-20), con lowi.es/asistencia. Lo propio de Lowi:
 * dos páginas de su ayuda se contradicen sobre el coste (se citan las dos),
 * nombra los «XX segundos» del desvío sin dar la sintaxis, y ##002# es su
 * forma de quitar el contestador. No tiene ayuda sobre el desvío del fijo.
 */

const ruta = "/desvio-de-llamadas/lowi";
const titulo = "Desviar llamadas en Lowi a tu recepcionista de IA";
const descripcion =
  "Códigos de Lowi para desviar el móvil a tu recepcionista de IA, lo que dicen sus dos páginas de ayuda sobre el coste y cómo no perder el contestador.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

const faqs = [
  {
    question: "¿Desviar llamadas en Lowi cuesta dinero?",
    answer:
      "Su ayuda da dos respuestas: una página dice que, sin una tarifa con llamadas Sin Límite, el servicio puede tener costes; otra, que no tiene ningún sobrecoste en tu factura. Si tu tarifa es Sin Límite, las dos coinciden en que no pagas de más. Si no lo es, pregúntaselo a Lowi.",
  },
  {
    question: "¿Puedo elegir cuántos segundos suena antes de desviar?",
    answer:
      "Lowi habla de un desvío «si no contesta en XX segundos», pero el código que da no lleva los segundos. La norma GSM los añade así: **61*número**20#. Si lo pruebas, marca *#61# para ver qué ha guardado la red.",
  },
  {
    question: "¿Dónde veo los desvíos en Mi Lowi?",
    answer:
      "Lowi indica que desde Mi Lowi se gestionan el contestador y los desvíos. Es la alternativa si prefieres no marcar códigos.",
  },
  {
    question: "¿Cómo quito el desvío a Alhabla sin perder el contestador?",
    answer:
      "Con ##61#, ##67# o ##62#, solo el que pusiste. No uses ##002#: en Lowi es justo el código para quitar el contestador. Después, vuelve a activar el contestador desde Mi Lowi.",
  },
  {
    question: "¿Puedo desviar un fijo de Lowi?",
    answer:
      "Lowi no tiene ayuda publicada sobre el desvío del fijo. Pregúntaselo o, si tu número de cara al público es ese fijo, usa el número de Alhabla como principal.",
  },
  {
    question: "¿Cómo compruebo un desvío en Lowi?",
    answer:
      "Lowi da la fórmula *#código#: *#61# para el de no contestas, *#67# para comunicando, *#62# para apagado y *#21# para todas.",
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
          href: "/desvio-de-llamadas/vodafone",
          titulo: "Desvío en Vodafone",
          texto: "Allí el coste por llamada desviada sí está publicado.",
        },
        {
          href: "/desvio-de-llamadas",
          titulo: "Desvío de llamadas",
          texto: "Qué tres desvíos conviene poner.",
        },
        {
          href: "/desvio-de-llamadas/pepephone",
          titulo: "Desvío en Pepephone",
          texto: "Otro que se gestiona desde el área de cliente.",
        },
        {
          href: "/desvio-de-llamadas/iphone-y-android",
          titulo: "Desvío en iPhone y Android",
          texto: "Si prefieres el menú del teléfono.",
        },
      ]}
      cierre="Tu Lowi suena; lo que no coges, se atiende."
    >
      <ConNumeroDeAlhabla>
        <Seccion
          id="movil"
          titulo="Los códigos del móvil Lowi"
          entradilla={
            <p>
              Lowi los publica con el destino entre corchetes:{" "}
              <Codigo>**61*[Destino]#</Codigo>. El destino es el número de
              Alhabla, con sus 9 cifras.
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
              nota="Lowi da la consulta como *#código#; aquí ya está escrita para cada tipo."
            />
          </div>
          <div className="mt-8">
            <Texto>
              <p>
                <strong>Los «XX segundos».</strong> En la página de Lowi sobre
                llamada en espera, contestador e identificador aparece un
                «desvío condicional si no contesta en XX segundos», pero el
                código que lo acompaña es el normal, sin segundos. La norma GSM
                los añade al final con doble asterisco:{" "}
                <Codigo>**61*número**20#</Codigo>, de 5 a 30 en pasos de 5. Lowi
                no confirma que su red lo acepte; si lo pruebas,{" "}
                <Codigo>*#61#</Codigo> te enseñará el número y los segundos
                guardados.
              </p>
            </Texto>
          </div>
        </Seccion>

        <Seccion
          id="coste"
          fondo
          titulo="Lo que dice Lowi del coste, en sus dos versiones"
          entradilla={<p>Citamos las dos tal cual, porque no coinciden.</p>}
        >
          <div className="grid gap-8">
            <Tabla
              cabecera={["Página de la ayuda", "Lo que dice"]}
              filas={[
                [
                  "Cómo activo el desvío",
                  "«Si no tienes una tarifa con llamadas Sin Límite, este servicio puede tener costes»",
                ],
                [
                  "Cómo desactivo el desvío",
                  "«No tiene ningún sobre coste en tu factura»",
                ],
              ]}
            />
            <Texto>
              <p>
                Una forma de leerlas juntas: activar el servicio no se cobra
                aparte, pero cada llamada desviada es una llamada que sale de tu
                línea hacia el número de Alhabla, y sin llamadas ilimitadas se
                paga como cualquier otra. Es nuestra interpretación, no la de
                Lowi.
              </p>
              <p>
                Si tu tarifa es Sin Límite, las dos páginas llevan a lo mismo:
                no pagas de más. Si no lo es, merece la pena preguntárselo a
                Lowi antes de desviar, o revisar la primera factura.
              </p>
            </Texto>
          </div>
        </Seccion>

        <Seccion
          id="contestador"
          titulo="Mi Lowi y el contestador"
          entradilla={
            <p>
              Lowi dice que desde Mi Lowi se gestionan el contestador y los
              desvíos. Y da un detalle que conviene recordar: el contestador se
              quita con <Codigo>##002#</Codigo>.
            </p>
          }
        >
          <div className="grid gap-8 lg:grid-cols-2">
            <Texto>
              <p>
                Eso tiene dos consecuencias. La primera, que el contestador de
                Lowi es en realidad un desvío más, y ocupa el mismo hueco que el
                de tu recepcionista: lo normal es que, cuando pones{" "}
                <Codigo>**61*</Codigo>
                con el número de Alhabla, el contestador deje de coger esas
                llamadas.
              </p>
              <p>
                La segunda, que <Codigo>##002#</Codigo> no es un buen código
                para quitar el desvío a Alhabla: se lleva también el contestador
                de las situaciones que no tocaste. Quita los tuyos uno a uno,
                como explicamos en{" "}
                <Link href="/desvio-de-llamadas#quitar">
                  quitar el desvío sin perder el buzón
                </Link>
                , y vuelve a activar el contestador desde Mi Lowi si lo quieres.
              </p>
            </Texto>
            <Nota tipo="info" titulo="¿Y el fijo?">
              Lowi no tiene ayuda publicada sobre cómo desviar un fijo. Si tu
              número de cara al público es un fijo de Lowi, pregúntaselo, y si
              consigues activarlo, confírmalo con{" "}
              <Link
                href="/desvio-de-llamadas#comprobar"
                className="font-semibold underline underline-offset-4"
              >
                «Comprobar desvío»
              </Link>
              . Si no, puedes publicar el número de Alhabla como principal.
            </Nota>
          </div>
        </Seccion>

        <Seccion
          id="pasos"
          fondo
          titulo="Paso a paso desde el teclado"
          entradilla={
            <p>Cinco minutos, desde el móvil Lowi que das a tus clientes.</p>
          }
        >
          <Pasos
            pasos={[
              {
                titulo: "Mira qué hay ahora",
                texto: (
                  <>
                    Marca <code>*#61#</code>, <code>*#67#</code> y{" "}
                    <code>*#62#</code>. Si tienes el contestador de Lowi, lo más
                    probable es que esas situaciones ya apunten a un número: el
                    del contestador.
                  </>
                ),
              },
              {
                titulo: "Activa los tres con el número de Alhabla",
                texto: (
                  <>
                    <code>**61*número#</code>, <code>**67*número#</code> y{" "}
                    <code>**62*número#</code>, pulsando llamar después de cada
                    uno.
                  </>
                ),
              },
              {
                titulo: "Vuelve a consultar",
                texto:
                  "Ahora las tres consultas tienen que enseñar el número de Alhabla.",
              },
              {
                titulo: "Haz la prueba real",
                texto:
                  "Pulsa «Comprobar desvío» en tu panel y no cojas la llamada que te entra.",
              },
            ]}
          />
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
