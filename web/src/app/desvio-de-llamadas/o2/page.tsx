import Link from "next/link";
import { Signal } from "lucide-react";
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
 * Desvío en O2 (datos del 2026-10-20), con o2online.es/ayuda (móvil, fijo y
 * VoLTE). Lo propio de O2: confirma el desvío por correo y se ve en su app,
 * el coste va incluido en la tarifa, y con VoLTE los códigos pueden fallar;
 * en un iPhone la única ruta que da O2 es la de Ajustes, que es el desvío de
 * todas. Con MultiSIM solo hay desvío de todas.
 */

const ruta = "/desvio-de-llamadas/o2";
const titulo = "Desviar llamadas en O2 a tu recepcionista de IA";
const descripcion =
  "Códigos de O2 para móvil y fijo, cómo confirmarlo en su app y qué hacer si tu móvil tiene VoLTE o MultiSIM y los códigos de desvío no funcionan.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

const faqs = [
  {
    question: "¿Cómo lo hago desde el menú de un Android?",
    answer:
      "La ayuda de O2 para VoLTE da la ruta de Huawei (Teléfono › ⋮ › Ajustes › Desvío de llamadas) y la de Xiaomi (Teléfono › ≡ › Ajustes de desvío de llamadas). Samsung trae en su menú los cuatro tipos, también «si no respondes».",
  },
  {
    question: "¿Cuántos segundos suena antes de desviar?",
    answer:
      "O2 no lo publica, ni para el móvil ni para el fijo. Con *#61# ves en el móvil los segundos que tiene guardados la red.",
  },
  {
    question: "¿A qué números no puedo desviar?",
    answer:
      "A los 90X, 80X ni a otros números especiales o de tarificación adicional. El de Alhabla es un fijo nacional, así que entra.",
  },
];

export default function DesvioO2Page() {
  return (
    <PaginaGuia
      ruta={ruta}
      migas={[
        { name: "Desvío de llamadas", path: "/desvio-de-llamadas" },
        { name: "O2", path: ruta },
      ]}
      etiqueta={{ icono: Signal, texto: "O2 · móvil y fijo" }}
      titulo={titulo}
      entradilla={
        <p>
          En O2, el desvío a tu recepcionista se marca con los códigos de
          siempre y va incluido en la tarifa. Te llega la confirmación por
          correo y lo ves en la app. El único tropiezo: con VoLTE, los códigos
          pueden no entrar.
        </p>
      }
      descripcion={descripcion}
      ctaSecundario={{ texto: "Si tienes VoLTE", href: "#volte" }}
      ubicacion="desvio_o2"
      faqs={faqs}
      tituloFaqs="Preguntas sobre el desvío en O2"
      relacionadas={[
        {
          href: "/desvio-de-llamadas",
          titulo: "Todos los operadores",
          texto: "Desviar o dar el número de Alhabla, y cómo quitarlo.",
        },
        {
          href: "/desvio-de-llamadas/iphone-y-android",
          titulo: "Desvío en iPhone y Android",
          texto: "El menú de cada marca, y por qué el iPhone solo desvía todo.",
        },
        {
          href: "/desvio-de-llamadas/movistar",
          titulo: "Desvío en Movistar",
          texto: "También con la limitación de MultiSIM.",
        },
      ]}
      cierre="Tu O2 suena como siempre; lo que no llegas a coger, lo coge ella."
    >
      <ConNumeroDeAlhabla>
        <Seccion
          id="movil"
          titulo="En tu móvil O2"
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
              titulo="Móvil O2"
              subtitulo="Con las palabras de la ayuda de O2."
              filas={[
                {
                  tipo: "Cuando no contesto",
                  recomendado: true,
                  activar: "**61*{N}#",
                  quitar: "##61#",
                  consultar: "*#61#",
                },
                {
                  tipo: "Cuando comunico o si rechazo la llamada",
                  recomendado: true,
                  activar: "**67*{N}#",
                  quitar: "##67#",
                  consultar: "*#67#",
                },
                {
                  tipo: "Sin cobertura o apagado",
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
                <strong>Qué pagas.</strong> Para O2, desviar a un móvil o a un
                fijo nacional va incluido en tu tarifa, sin cuota aparte.
              </p>
              <p>
                <strong>Cómo sabes que está.</strong> O2 te manda la
                confirmación por correo, y en su app lo ves en Configura tu
                línea › Desvío de llamadas.
              </p>
            </Texto>
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div id="volte" className="scroll-m-20">
              <Nota tipo="importante" titulo="Con VoLTE o MultiSIM">
                <p>
                  Con VoLTE (la voz por 4G), O2 avisa de que los códigos pueden
                  no funcionar y propone el menú del teléfono. En Android
                  sirve; en un iPhone, ese menú solo desvía todas y tu móvil
                  dejaría de sonar: pregunta a O2 por el desvío si no
                  contestas.
                </p>
                <p className="mt-3">
                  <strong>Con MultiSIM</strong> solo hay desvío de todas. En
                  los dos casos, la salida es{" "}
                  <Link
                    href="/desvio-de-llamadas#cual"
                    className="font-semibold underline underline-offset-4"
                  >
                    dar el número de Alhabla como principal
                  </Link>
                  , sin desvío.
                </p>
              </Nota>
            </div>
            <ComprobarDesvio>
              <p>
                Marca <Codigo>*#61#</Codigo>: verás el número de Alhabla y los
                segundos que tiene guardados la red.
              </p>
            </ComprobarDesvio>
          </div>
        </Seccion>

        <Seccion
          id="fijo"
          fondo
          titulo="El fijo de O2"
          entradilla={
            <p>
              Descuelga, marca el código, el número y <Codigo>#</Codigo>, y
              espera el tono continuo que confirma. O2 dice que se hace de forma
              gratuita e inmediata.
            </p>
          }
        >
          <TablaDeCodigos
            titulo="Fijo O2"
            filas={[
              {
                tipo: "Cuando no contesto",
                recomendado: true,
                activar: "*61*{N}#",
                quitar: "#61#",
              },
              { tipo: "Cuando comunico", activar: "*67*{N}#", quitar: "#67#" },
              { tipo: "Todas", activar: "*21*{N}#", quitar: "#21#" },
            ]}
            nota="Destinos: móviles y fijos nacionales. O2 no publica código de consulta para el fijo: la prueba es «Comprobar desvío»."
          />
        </Seccion>

        <Fuentes
          consultadas="2026-10-20"
          fuentes={[
            {
              nombre: "O2: desvío de llamadas en el móvil",
              url: "https://o2online.es/ayuda/desvio-llamadas-movil/",
            },
            {
              nombre: "O2: desvío de llamadas desde el fijo",
              url: "https://o2online.es/ayuda/desvio-de-llamadas-desde-el-fijo/",
            },
            {
              nombre: "O2: desvío de llamadas con VoLTE",
              url: "https://o2online.es/ayuda/desvio-llamadas-volte/",
            },
          ]}
        />
      </ConNumeroDeAlhabla>
    </PaginaGuia>
  );
}
