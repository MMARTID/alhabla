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
  Tabla,
  Texto,
} from "@/components/pagina-guia";
import { metadataDePagina } from "@/lib/seo";

/**
 * El desvío desde el propio teléfono (datos del 2026-10-20): rutas oficiales
 * de Apple y Samsung, las de Huawei y Xiaomi según O2, y la de Pixel, que solo
 * publica la comunidad (se marca como no oficial). Lo que no está en ninguna
 * ficha de operador va primero: «Silenciar desconocidos» manda a los
 * desconocidos al Buzón de voz en vivo sin sonar (cómo convive eso con el
 * desvío de la red no está verificado: se recomienda el ajuste prudente), y
 * el menú del iPhone solo hace el desvío de todas.
 */

const ruta = "/desvio-de-llamadas/iphone-y-android";
const titulo = "Desvío de llamadas en iPhone y Android, paso a paso";
const descripcion =
  "Dónde está el desvío en iPhone, Samsung, Huawei, Xiaomi y Pixel, por qué el iPhone solo desvía todas y el ajuste que puede quitarte llamadas.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

const faqs = [
  {
    question: "¿Puedo elegir los segundos de espera en el iPhone?",
    answer:
      "Desde Ajustes, no. Con el código sí, si tu operador lo admite: **61*número**20# pide 20 segundos. Orange, Simyo, Telecable, Euskaltel y Jazztel publican un margen; los demás, no.",
  },
  {
    question: "Tengo dos SIM. ¿Cuál desvío?",
    answer:
      "La del número que das a tus clientes. En un Samsung, el menú de desvío te pregunta por SIM1 o SIM2; con códigos, marca desde esa línea.",
  },
  {
    question: "¿Cómo veo si tengo un desvío activo?",
    answer:
      "En el iPhone, el desvío de todas muestra un icono en la barra de estado. Para los demás, en cualquier teléfono, marca *#61#, *#67# o *#62#.",
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
          Si se te siguen perdiendo llamadas, mira primero dos ajustes del
          iPhone. Después, el desvío: en el iPhone se marca con un código,
          porque su menú solo desvía todas; en Android, el menú suele traer los
          cuatro tipos.
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
      ]}
      cierre="Tu teléfono suena; lo que no coges, llega a tu recepcionista."
    >
      <ConNumeroDeAlhabla>
        <Seccion
          id="desconocidos"
          titulo="El ajuste del iPhone que se queda las llamadas de clientes nuevos"
          entradilla={
            <p>
              Con «Silenciar desconocidos», las llamadas de números que no
              tienes guardados van directas al Buzón de voz en vivo, sin sonar.
              Y un cliente nuevo es, casi siempre, un número que tu iPhone no
              conoce.
            </p>
          }
        >
          <Tabla
            cabecera={["Ajustes › Apps › Teléfono", "Opciones", "Déjalo en"]}
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
          <div className="mt-8">
            <Texto>
              <p>
                Ese buzón es del iPhone, no de tu operador: sigue funcionando
                aunque quites el contestador de la línea. Qué hace el desvío de
                tu operador cuando el iPhone ya ha mandado la llamada a su
                buzón no lo hemos podido verificar, así que lo prudente es
                dejarlo como en la tabla. Si «Comprobar desvío» dice que alguien
                ha cogido la llamada y tú no la has tocado, mira aquí primero:
                la llamada de prueba llega desde tu número de Alhabla, un
                desconocido para tu iPhone.
              </p>
            </Texto>
          </div>
        </Seccion>

        <Seccion
          id="iphone"
          fondo
          titulo="En el iPhone, el desvío se marca con un código"
          entradilla={
            <p>
              Ajustes › Apps › Teléfono › Desvío de llamadas solo desvía todas
              las llamadas: tu iPhone dejaría de sonar. Para el resto, abre la
              app Teléfono, ve al teclado, marca cada código y pulsa llamar.
            </p>
          }
        >
          <div className="grid gap-6">
            <CampoNumeroDeAlhabla />
            <TablaDeCodigos
              titulo="Los tres que se marcan en el iPhone"
              subtitulo="Valen en casi todos los operadores. Si el tuyo tiene los suyos, están en su ficha."
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
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Nota tipo="importante" titulo="Si el código da error: VoLTE">
              <p>
                Con VoLTE (la voz por 4G), algunos operadores avisan de que los
                códigos pueden no entrar. En Android, el menú del teléfono lo
                arregla; en un iPhone, no hay alternativa en el teléfono. No
                pongas el desvío de todas para salir del paso: pregunta a tu
                operador o{" "}
                <Link
                  href="/desvio-de-llamadas#cual"
                  className="font-semibold underline underline-offset-4"
                >
                  da el número de Alhabla como principal
                </Link>
                .
              </p>
            </Nota>
            <ComprobarDesvio>
              <p>
                Marca <Codigo>*#61#</Codigo>: la pantalla dice a qué número va
                el desvío.
              </p>
            </ComprobarDesvio>
          </div>
        </Seccion>

        <Seccion
          id="android"
          titulo="En Android, la ruta de cada marca"
          entradilla={
            <p>
              El menú de desvío está en la app Teléfono, no en los ajustes
              generales, y cambia de sitio según la marca y la versión. Si no lo
              encuentras, el código <Codigo>**61*número#</Codigo> hace lo mismo.
            </p>
          }
        >
          <Tabla
            cabecera={["Teléfono", "Ruta", "Quién la publica"]}
            filas={[
              [
                "Samsung Galaxy",
                "Teléfono › Más (⋮) › Ajustes › Servicios adicionales › Desvío de llamadas › SIM1 o SIM2 › Desviar si no respondes › número › Habilitar",
                "Samsung",
              ],
              [
                "Huawei",
                "Teléfono › ⋮ › Ajustes › Desvío de llamadas",
                "O2, en su ayuda",
              ],
              [
                "Xiaomi",
                "Teléfono › ≡ › Ajustes de desvío de llamadas",
                "O2, en su ayuda",
              ],
              [
                "Google Pixel",
                "Teléfono › ⋮ › Ajustes › Cuentas de llamada › tu operador › Desvío de llamadas",
                "La comunidad de Pixel (no oficial)",
              ],
            ]}
            nota="En Samsung, el menú trae los cuatro tipos: desviar siempre, cuando esté ocupado, si no respondes y si no estás disponible. Pon los tres últimos."
          />
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
