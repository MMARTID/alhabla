import Link from "next/link";
import { Mail, Signal, Smartphone } from "lucide-react";
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
 * Desvío en O2 (2026-10-20), con o2online.es/ayuda (móvil, fijo y VoLTE). Lo
 * propio de O2: confirma el desvío por correo y se ve en su app, el coste va
 * incluido en la tarifa, y con VoLTE los códigos pueden fallar; en un iPhone
 * la única ruta que da O2 es la de Ajustes, que es el desvío de todas.
 */

const ruta = "/desvio-de-llamadas/o2";
const titulo = "Desviar llamadas en O2 a tu recepcionista de IA";
const descripcion =
  "Códigos de O2 para móvil y fijo, cómo confirmarlo en su app y qué hacer si tu móvil tiene VoLTE o MultiSIM y los códigos de desvío no funcionan.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

const faqs = [
  {
    question: "¿Cuánto cuesta desviar con O2?",
    answer:
      "Si desvías a un móvil o a un fijo nacional, O2 dice que va incluido en tu tarifa. El número de Alhabla es un fijo nacional. En el fijo, O2 dice que el desvío es gratuito.",
  },
  {
    question: "¿Cómo sé que el desvío ha quedado activado?",
    answer:
      "O2 te manda la confirmación por correo, y en su app lo ves en Configura tu línea › Desvío de llamadas. También puedes marcar *#61# desde el móvil.",
  },
  {
    question: "He marcado el código y me da error. ¿Qué hago?",
    answer:
      "Si tu teléfono usa VoLTE, O2 avisa de que los códigos pueden no funcionar y propone hacerlo desde los ajustes del teléfono. En un Samsung, ese menú trae el desvío si no respondes; en un iPhone, el menú de Ajustes solo desvía todas las llamadas.",
  },
  {
    question: "Tengo MultiSIM. ¿Puedo usar el desvío si no contesto?",
    answer:
      "No. Con MultiSIM, O2 solo permite desviar todas las llamadas. Si quieres seguir cogiendo tú las que puedas, la alternativa es usar Alhabla como número principal.",
  },
  {
    question: "¿Puedo desviar el fijo de O2 a Alhabla?",
    answer:
      "Sí: O2 permite desviar el fijo a móviles y fijos nacionales, de forma gratuita e inmediata. Descuelga, marca *61*, el número y #, y espera el tono continuo.",
  },
  {
    question: "¿Cuántos segundos suena antes de desviar?",
    answer:
      "O2 no lo publica, ni para el móvil ni para el fijo. Con *#61# ves en el móvil los segundos que tiene guardados la red.",
  },
  {
    question: "¿A qué números no puedo desviar?",
    answer:
      "A los 90X, 80X ni a otros números especiales o de tarificación adicional.",
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
          href: "/desvio-de-llamadas/iphone-y-android",
          titulo: "Desvío en iPhone y Android",
          texto:
            "Las rutas de Huawei, Xiaomi y Samsung, y por qué el iPhone solo desvía todo.",
        },
        {
          href: "/desvio-de-llamadas/movistar",
          titulo: "Desvío en Movistar",
          texto: "También con la limitación de MultiSIM.",
        },
        {
          href: "/desvio-de-llamadas",
          titulo: "Todos los operadores",
          texto: "La tabla completa y cuál conviene.",
        },
        {
          href: "/glosario",
          titulo: "Glosario",
          texto: "Qué son VoLTE, MultiSIM y desvío condicional.",
        },
      ]}
      cierre="Incluido en tu tarifa de O2, y sin que se pierda ninguna llamada."
    >
      <ConNumeroDeAlhabla>
        <Seccion
          id="movil"
          titulo="En tu móvil O2"
          entradilla={
            <p>
              O2 publica los cuatro códigos con sus comprobaciones. Marca desde
              el móvil que quieres desviar y pulsa llamar.
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
          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <Texto>
              <p>
                <strong>Lo que pagas.</strong> Para O2, desviar a un móvil o a
                un fijo nacional va «incluido en tu tarifa». Su ayuda no
                menciona establecimiento de llamada ni cuota aparte. Los 90X,
                80X y demás números especiales quedan fuera.
              </p>
              <p>
                <strong>Los segundos.</strong> O2 no explica cómo cambiar cuánto
                suena antes de desviar. Con <Codigo>*#61#</Codigo> ves los que
                tiene guardados la red.
              </p>
            </Texto>
            <Tarjetas
              columnas={2}
              items={[
                {
                  icono: Mail,
                  titulo: "Te avisa por correo",
                  texto:
                    "Cuando activas un desvío, O2 te manda la confirmación por correo electrónico.",
                },
                {
                  icono: Smartphone,
                  titulo: "Y lo ves en la app",
                  texto:
                    "En la app de O2: Configura tu línea › Desvío de llamadas.",
                },
              ]}
            />
          </div>
        </Seccion>

        <Seccion
          id="volte"
          fondo
          titulo="Si tu móvil tiene VoLTE y el código no entra"
          entradilla={
            <p>
              VoLTE es la voz por la red 4G. O2 avisa de que, con VoLTE, «es
              posible que estos comandos no funcionen», y propone hacer el
              desvío desde los ajustes del teléfono.
            </p>
          }
        >
          <div className="grid gap-8 lg:grid-cols-2">
            <Texto>
              <p>
                <strong>En Android hay alternativa.</strong> La página de O2
                para VoLTE explica la ruta de Huawei (Teléfono › ⋮ › Ajustes ›
                Desvío de llamadas) y la de Xiaomi (Teléfono › ≡ › Ajustes de
                desvío de llamadas). Samsung documenta en su menú los cuatro
                tipos, también el de «si no respondes». Las rutas de cada marca
                las tienes en{" "}
                <Link href="/desvio-de-llamadas/iphone-y-android">
                  el desvío en iPhone y Android
                </Link>
                .
              </p>
              <p>
                <strong>En un iPhone, sí.</strong> Para el iPhone, O2 solo da la
                ruta de Ajustes, y el menú de Ajustes del iPhone es el desvío de
                todas las llamadas: tu teléfono dejaría de sonar. Si los códigos
                te fallan en un iPhone con VoLTE, ese menú no es la solución.
              </p>
            </Texto>
            <Nota tipo="importante" titulo="Si el código falla en un iPhone">
              No actives el desvío de todas por salir del paso. Tienes dos
              opciones: preguntar a O2 cómo activar el desvío si no contestas en
              tu línea, o{" "}
              <Link
                href="/desvio-de-llamadas#cual"
                className="font-semibold underline underline-offset-4"
              >
                usar Alhabla como número principal
              </Link>
              , que no necesita desvío. Si el código sí entra, confírmalo con
              «Comprobar desvío».
            </Nota>
          </div>
        </Seccion>

        <Seccion id="multisim" titulo="Con MultiSIM, solo el desvío de todas">
          <Texto>
            <p>
              O2 avisa de que con MultiSIM solo se puede desviar todo. Para una
              recepcionista de IA eso significa que tu móvil dejaría de sonar y
              todas las llamadas irían a ella. Si eso es lo que quieres, mejor
              publicar el número de Alhabla como principal y que te pase al
              móvil las llamadas que elijas con «Cuándo pasarme llamadas». Si
              no, la limitación viene del MultiSIM, no de Alhabla.
            </p>
          </Texto>
        </Seccion>

        <Seccion
          id="fijo"
          fondo
          titulo="El fijo de O2"
          entradilla={
            <p>
              Descuelga, marca el código, el número y <Codigo>#</Codigo>, y
              espera el tono continuo que confirma. O2 dice que se hace «de
              forma gratuita e inmediata».
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
            nota="Destinos: móviles y fijos nacionales; no números premium ni especiales."
          />
          <div className="mt-8">
            <Texto>
              <p>
                El fijo de O2 no tiene código de consulta publicado. Para saber
                si ha quedado bien, usa{" "}
                <Link href="/desvio-de-llamadas#comprobar">
                  «Comprobar desvío»
                </Link>{" "}
                desde tu panel de Alhabla: llama a tu fijo, no lo cojas y mira
                el resultado.
              </p>
            </Texto>
          </div>
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
