import Link from "next/link";
import { EarOff, Smartphone } from "lucide-react";
import { Codigo } from "@/components/desvio/codigo";
import {
  CampoNumeroDeAlhabla,
  ConNumeroDeAlhabla,
  TablaDeCodigos,
} from "@/components/desvio/codigos-de-desvio";
import {
  Fuentes,
  ListaCheck,
  Nota,
  PaginaGuia,
  Pasos,
  Seccion,
  Tabla,
  Texto,
} from "@/components/pagina-guia";
import { metadataDePagina } from "@/lib/seo";

/**
 * El desvío desde el propio teléfono (2026-10-20): rutas oficiales de Apple y
 * Samsung, las de Huawei y Xiaomi según O2, y la de Pixel, que solo publica la
 * comunidad (se marca como no oficial). Lo que no está en ninguna ficha de
 * operador: el menú del iPhone solo hace el desvío de todas, y «Silenciar
 * desconocidos» manda a los desconocidos al Buzón de voz en vivo sin sonar.
 * Cómo convive eso con el desvío de la red no está verificado: se dice y se
 * recomienda el ajuste prudente.
 */

const ruta = "/desvio-de-llamadas/iphone-y-android";
const titulo = "Desvío de llamadas en iPhone y Android, paso a paso";
const descripcion =
  "Dónde está el desvío en iPhone, Samsung, Huawei, Xiaomi y Pixel, por qué el iPhone solo desvía todas y el ajuste que puede quitarte llamadas.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

const faqs = [
  {
    question: "¿Por qué mi iPhone solo me deja desviar todas las llamadas?",
    answer:
      "Porque el menú Desvío de llamadas de Ajustes es el desvío incondicional. Para los demás, Apple remite a tu operador. El de no contestas se activa marcando **61*número# en el teclado de la app Teléfono.",
  },
  {
    question: "¿Puedo elegir los segundos de espera en el iPhone?",
    answer:
      "Desde Ajustes, no. Con el código sí, si tu operador lo admite: **61*número**20# pide 20 segundos. Orange, Simyo, Telecable, Euskaltel y Jazztel publican un margen; los demás, no.",
  },
  {
    question: "¿Qué ajuste del iPhone conviene revisar?",
    answer:
      "En Ajustes › Apps › Teléfono, el filtro de llamadas de números desconocidos: déjalo en «Nunca». Y si usas el desvío a tu recepcionista, desactiva el Buzón de voz en vivo.",
  },
  {
    question: "Tengo dos SIM. ¿Cuál desvío?",
    answer:
      "La del número que das a tus clientes. En un Samsung, el menú de desvío te pregunta por SIM1 o SIM2; con códigos, marca desde esa línea.",
  },
  {
    question: "No encuentro el menú de desvío en mi Android.",
    answer:
      "Samsung avisa de que los pasos cambian según el modelo y la versión del sistema. Si no lo encuentras, marca el código en el teclado de la app Teléfono: hace lo mismo.",
  },
  {
    question: "¿Cómo veo si tengo un desvío activo?",
    answer:
      "En el iPhone, el desvío de todas muestra un icono en la barra de estado. Para los condicionales, en cualquier teléfono, marca *#61#, *#67# o *#62#.",
  },
];

export default function DesvioIphoneAndroidPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      migas={[
        { name: "Desvío de llamadas", path: "/desvio-de-llamadas" },
        { name: "En iPhone y Android", path: ruta },
      ]}
      etiqueta={{
        icono: Smartphone,
        texto: "iPhone · Samsung · Xiaomi · Huawei · Pixel",
      }}
      titulo={titulo}
      entradilla={
        <p>
          En un iPhone, el menú de Ajustes solo desvía todas las llamadas; el
          desvío si no contestas se marca con un código. En Android, el menú
          suele traer los cuatro tipos. Y en los dos hay ajustes que conviene
          mirar.
        </p>
      }
      descripcion={descripcion}
      ctaSecundario={{ texto: "El ajuste del iPhone", href: "#desconocidos" }}
      ubicacion="desvio_telefonos"
      faqs={faqs}
      tituloFaqs="Preguntas sobre el desvío en el teléfono"
      relacionadas={[
        {
          href: "/desvio-de-llamadas",
          titulo: "Desvío por operador",
          texto: "Elige el tuyo: cada uno tiene sus códigos y su coste.",
        },
        {
          href: "/desvio-de-llamadas/o2",
          titulo: "O2 y VoLTE",
          texto: "El operador que avisa de que los códigos pueden fallar.",
        },
        {
          href: "/desvio-de-llamadas/vodafone",
          titulo: "Vodafone y el Buzón de voz en vivo",
          texto: "Sigue activo aunque quites el contestador de Vodafone.",
        },
        {
          href: "/desvio-de-llamadas/orange",
          titulo: "Orange: elegir los segundos",
          texto: "Para poner la espera exacta con el código.",
        },
        {
          href: "/blog/desvio-de-llamadas-si-no-contesta",
          titulo: "Desvío si no contesta",
          texto: "La tabla de códigos de móvil y fijo.",
        },
      ]}
      cierre="Tu teléfono suena; lo que no coges, llega a tu recepcionista."
    >
      <ConNumeroDeAlhabla>
        <Seccion
          id="iphone"
          titulo="En el iPhone, el menú solo desvía todas"
          entradilla={
            <p>
              La ruta de Apple es Ajustes › Apps › Teléfono › Desvío de llamadas
              › Desviar a. Lo que activa ahí es el desvío de todas las llamadas:
              tu iPhone deja de sonar y aparece un icono en la barra de estado.
            </p>
          }
        >
          <div className="grid gap-8 lg:grid-cols-2">
            <Texto>
              <p>
                Para lo demás, Apple remite a tu operador: «Si tu operador
                admite el desvío de llamadas cuando la línea está ocupada o no
                hay servicio, consúltale cómo configurarlo». Tampoco documenta
                los códigos de teclado. Esos códigos son de la red de tu
                operador, no del teléfono, así que en principio se marcan en el
                iPhone igual que en cualquier otro, con la salvedad de VoLTE que
                verás más abajo.
              </p>
              <p>
                No uses el menú de Ajustes para tu recepcionista, salvo que
                quieras que conteste ella todas las llamadas. Y en ese caso hay
                una opción mejor:{" "}
                <Link href="/desvio-de-llamadas#cual">
                  publicar el número de Alhabla como principal
                </Link>
                .
              </p>
            </Texto>
            <Pasos
              pasos={[
                {
                  titulo: "Abre la app Teléfono y ve al Teclado",
                  texto: "No a Ajustes: al teclado donde marcas los números.",
                },
                {
                  titulo: "Marca el código con el número de Alhabla",
                  texto: (
                    <>
                      <code>**61*número#</code> para cuando no contestas. Repite
                      con <code>**67*</code> y <code>**62*</code>.
                    </>
                  ),
                },
                {
                  titulo: "Pulsa el botón de llamar",
                  texto:
                    "La pantalla muestra si el desvío se ha activado. Si sale un error, mira el apartado de VoLTE.",
                },
              ]}
            />
          </div>
          <div className="mt-8 grid gap-6">
            <CampoNumeroDeAlhabla />
            <TablaDeCodigos
              titulo="Los tres que se marcan en el iPhone"
              subtitulo="Códigos de la norma GSM. Si tu operador tiene los suyos, están en su ficha."
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
              ]}
            />
          </div>
        </Seccion>

        <Seccion
          id="volte"
          fondo
          titulo="Si el código falla: VoLTE"
          entradilla={
            <p>
              O2 avisa de que, con VoLTE (la voz por 4G), «es posible que estos
              comandos no funcionen», y remite a los ajustes del teléfono.
            </p>
          }
        >
          <div className="grid gap-8 lg:grid-cols-2">
            <Texto>
              <p>
                En Android suele tener arreglo: el menú de Samsung, por ejemplo,
                incluye el desvío si no respondes. En un iPhone, no: para el
                iPhone, O2 solo da la ruta de Ajustes, que es el desvío de
                todas. Si en tu iPhone el código da error, no tienes en el
                teléfono una alternativa para el desvío condicional.
              </p>
            </Texto>
            <Nota tipo="importante" titulo="Si te pasa en un iPhone">
              Pregunta a tu operador cómo activar en tu línea el desvío si no
              contestas, o usa Alhabla como número principal, que no necesita
              desvío. No pongas el desvío de todas para salir del paso: tu
              teléfono dejaría de sonar.
            </Nota>
          </div>
        </Seccion>

        <Seccion
          id="desconocidos"
          titulo="El ajuste del iPhone que puede quedarse las llamadas de clientes nuevos"
          entradilla={
            <p>
              El Buzón de voz en vivo y el filtro de llamadas ya están
              disponibles en español de España, según la página de
              disponibilidad de funciones de Apple para iOS 27.
            </p>
          }
        >
          <div className="grid gap-8">
            <Texto>
              <p>
                Apple lo explica así: «Si tienes activada la opción “Silenciar
                desconocidos”, las llamadas de números desconocidos se envían
                directamente al buzón de voz en vivo sin sonar». Ese buzón es
                del propio iPhone, no de tu operador; Vodafone, por ejemplo,
                avisa de que sigue funcionando aunque desactives su contestador.
              </p>
              <p>
                El problema para un negocio es evidente: un cliente nuevo es,
                casi por definición, un número que tu iPhone no conoce. Qué hace
                el desvío si no contestas de la red cuando el iPhone ha mandado
                la llamada a su propio buzón sin sonar es algo que{" "}
                <strong>no hemos podido verificar</strong>. Lo prudente es no
                dejarlo al azar.
              </p>
            </Texto>
            <div className="panel p-6">
              <p className="flex items-center gap-2 text-sm font-semibold text-tinta">
                <EarOff className="h-4 w-4 text-morado" aria-hidden="true" />
                Qué ajuste dejar
              </p>
              <div className="mt-4">
                <Tabla
                  cabecera={[
                    "Ajustes › Apps › Teléfono",
                    "Opciones",
                    "Déjalo en",
                  ]}
                  filas={[
                    [
                      "Filtra las llamadas de números desconocidos",
                      "Nunca / Solicitar motivo / Silenciar",
                      "Nunca",
                    ],
                    [
                      "Buzón de voz en vivo",
                      "Activado / desactivado",
                      "Desactivado, si usas el desvío",
                    ],
                  ]}
                  resaltarPrimeraColumna={false}
                />
              </div>
            </div>
          </div>
          <div className="mt-8">
            <ListaCheck
              items={[
                "Si «Comprobar desvío» te dice que alguien ha cogido la llamada y tú no la has tocado, revisa estos dos ajustes: la llamada de prueba llega desde tu número de Alhabla, que para tu iPhone es un desconocido salvo que lo tengas en contactos.",
                "Apple tiene una página para cuando el iPhone no recibe llamadas; es la siguiente parada si algo no cuadra.",
                "Si quieres seguir filtrando desconocidos, la alternativa es dar el número de Alhabla como principal.",
              ]}
            />
          </div>
        </Seccion>

        <Seccion
          id="android"
          fondo
          titulo="En Android, ruta por marca"
          entradilla={
            <p>
              En Android el menú de desvío está en la app Teléfono, no en los
              ajustes generales. Cambia de sitio según la marca y la versión del
              sistema.
            </p>
          }
        >
          <Tabla
            cabecera={["Teléfono", "Ruta", "Quién la publica"]}
            filas={[
              [
                "Samsung Galaxy",
                "Teléfono › Más (⋮) › Ajustes › Servicios adicionales › Desvío de llamadas › SIM1 o SIM2 › Desviar si no respondes › número › Habilitar",
                "Samsung (oficial, 2023)",
              ],
              [
                "Huawei",
                "Teléfono › ⋮ › Ajustes › Desvío de llamadas",
                "O2 (oficial)",
              ],
              [
                "Xiaomi",
                "Teléfono › ≡ › Ajustes de desvío de llamadas",
                "O2 (oficial)",
              ],
              [
                "Google Pixel y app Teléfono de Google",
                "Teléfono › ⋮ › Ajustes › Cuentas de llamada › tu operador › Desvío de llamadas",
                "Solo la comunidad de Pixel: no oficial",
              ],
            ]}
          />
          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <Texto>
              <p>
                <strong>Samsung</strong> es el más completo: el menú trae los
                cuatro tipos con sus nombres (desviar siempre, cuando esté
                ocupado, si no respondes y si no estás disponible) y te pregunta
                por la SIM. La propia Samsung avisa de que «los pasos pueden
                variar según el sistema operativo y el modelo».
              </p>
              <p>
                <strong>Pixel</strong>: la ayuda oficial de la app Teléfono de
                Google no documenta dónde está el desvío. La ruta de la tabla es
                la que comparten los usuarios en la comunidad de Pixel; si en tu
                teléfono no está ahí, usa los códigos.
              </p>
            </Texto>
            <Texto>
              <p>
                <strong>Con dos SIM</strong>, desvía la del número que das a tus
                clientes. Si marcas códigos, hazlo desde esa línea; si el
                teléfono te pregunta con qué SIM llamar, elige esa.
              </p>
              <p>
                <strong>Menú o código, da igual.</strong> El desvío es un
                servicio de la red de tu operador; el menú del teléfono es otra
                forma de pedírselo. Si en el menú no aparece la opción, el
                código <Codigo>**61*número#</Codigo> sigue siendo válido, y lo
                compruebas con <Codigo>*#61#</Codigo>.
              </p>
            </Texto>
          </div>
        </Seccion>

        <Fuentes
          consultadas="2026-10-20"
          fuentes={[
            {
              nombre: "Apple: desviar llamadas en el iPhone",
              url: "https://support.apple.com/es-es/guide/iphone/iph7405291c4/ios",
            },
            {
              nombre: "Apple: buzón de voz en vivo",
              url: "https://support.apple.com/es-es/guide/iphone/iph3c99490e/ios",
            },
            {
              nombre: "Apple: silenciar llamadas de desconocidos",
              url: "https://support.apple.com/es-es/111106",
            },
            {
              nombre: "Apple: si no recibes llamadas en el iPhone",
              url: "https://support.apple.com/es-es/118427",
            },
            {
              nombre: "Apple: disponibilidad de funciones de iOS",
              url: "https://www.apple.com/ios/feature-availability/",
            },
            {
              nombre: "Samsung: desvío de llamadas en tu Galaxy",
              url: "https://www.samsung.com/es/support/mobile-devices/como-usar-el-desvio-de-llamadas-en-tu-smartphone-galaxy/",
            },
            {
              nombre: "Google: ayuda de la app Teléfono",
              url: "https://support.google.com/phoneapp/answer/2895524?hl=es",
            },
            {
              nombre: "O2: desvío de llamadas con VoLTE",
              url: "https://o2online.es/ayuda/desvio-llamadas-volte/",
            },
            {
              nombre: "Vodafone: gestionar tu contestador móvil",
              url: "https://ayudacliente.vodafone.es/particulares/movil/opciones-de-llamada-y-voz/como-gestionar-tu-contestador-movil/",
            },
          ]}
        />
      </ConNumeroDeAlhabla>
    </PaginaGuia>
  );
}
