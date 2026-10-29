import Link from "next/link";
import { ArrowRight, PhoneForwarded } from "lucide-react";
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
  Seccion,
  Tabla,
  Texto,
} from "@/components/pagina-guia";
import { appUrl } from "@/lib/app-url";
import { metadataDePagina } from "@/lib/seo";

/**
 * Índice y página pilar del desvío de llamadas. Todo dato de operador sale de
 * su ayuda oficial o de la norma 3GPP, consultadas el 2026-10-20; las fichas
 * de cada operador cuelgan de aquí (lib/paginas.ts, sección «desvio»). Lo que
 * es común a todas (los tres condicionales, «Comprobar desvío», quitarlo sin
 * perder el buzón, el número principal) vive solo en esta página y las fichas
 * lo enlazan por sus anclas (#comprobar, #cual, #quitar).
 */

const ruta = "/desvio-de-llamadas";
const titulo = "Desvío de llamadas a tu recepcionista de IA, por operador";
const descripcion =
  "Los tres códigos de desvío con tu número de Alhabla listos para copiar, cómo comprobar que funciona y lo que cambia en Movistar, Vodafone, Orange, Digi y el resto.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

const op = (slug: string) => `${ruta}/${slug}`;

const faqs = [
  {
    question: "¿Cuántos segundos suena antes de que salte?",
    answer:
      "Lo que tenga tu operador por defecto. La norma admite de 5 a 30 segundos, de 5 en 5, con el código **61*número**20# (el doble asterisco es un hueco que se deja vacío). Lo publican Orange, Simyo, Telecable, Euskaltel y Jazztel. Marca *#61# y verás el número y los segundos que tienes.",
  },
  {
    question: "¿Puedo activar los tres desvíos con un solo código?",
    answer:
      "La norma tiene uno, **004*número#, que activa a la vez el de no contesta, el de comunica y el de apagado. Ningún operador español lo publica en su ayuda, así que si lo usas, compruébalo después con *#61#, *#67# y *#62#.",
  },
  {
    question: "¿Cuánto me cobra el operador por desviar?",
    answer:
      "Activarlo suele ser gratis, pero cada llamada desviada sale de tu línea hacia el número de Alhabla y se cobra según tu tarifa. Las excepciones están en la tarjeta de cada operador: el fijo de Movistar, por ejemplo, cobra una cuota por cada tipo de desvío.",
  },
  {
    question: "¿Se desvían también los SMS?",
    answer:
      "No. El desvío solo afecta a las llamadas; Orange y Digi lo dicen expresamente en su ayuda. Los mensajes siguen llegando a tu móvil.",
  },
  {
    question: "¿Y si mi operador no aparece en la lista?",
    answer:
      "Prueba los tres códigos de arriba, que son los de la norma, y mira si tu área de cliente tiene un apartado de desvíos. Después, «Comprobar desvío» te dice si la llamada llega de verdad a tu recepcionista.",
  },
];

/** Lo propio de cada operador, en una línea; el detalle está en su ficha. */
const operadores: { slug: string; nombre: string; ojo: string }[] = [
  {
    slug: "movistar",
    nombre: "Movistar",
    ojo: "El fijo se contrata antes: 4 € al mes por cada tipo de desvío.",
  },
  {
    slug: "vodafone",
    nombre: "Vodafone",
    ojo: "El fijo solo dice desviar a números de Vodafone y a móviles de otros, y el de Alhabla es un fijo.",
  },
  {
    slug: "orange",
    nombre: "Orange y Amena",
    ojo: "Deja elegir los segundos. El fijo tiene dos juegos de códigos según tu cobertura.",
  },
  {
    slug: "yoigo",
    nombre: "Yoigo",
    ojo: "Para el móvil solo publica el desvío de todas. Del fijo a otro fijo, ilimitado.",
  },
  {
    slug: "masmovil",
    nombre: "MásMóvil",
    ojo: "Para el móvil solo publica el desvío de todas. Del fijo a otro fijo, ilimitado.",
  },
  {
    slug: "o2",
    nombre: "O2",
    ojo: "Con VoLTE los códigos pueden fallar; con MultiSIM solo se desvía todo.",
  },
  {
    slug: "jazztel",
    nombre: "Jazztel",
    ojo: "Segundos de 5 a 30, con una forma de escribirlos que no es la de siempre.",
  },
  {
    slug: "digi",
    nombre: "Digi",
    ojo: "No se puede desviar en itinerancia, y el fijo no tiene «si comunica».",
  },
  {
    slug: "pepephone",
    nombre: "Pepephone",
    ojo: "Sin códigos: se elige en Mi Pepephone, situación por situación.",
  },
  {
    slug: "lowi",
    nombre: "Lowi",
    ojo: "Códigos de siempre en el móvil, o desde Mi Lowi.",
  },
  {
    slug: "simyo",
    nombre: "Simyo",
    ojo: "Segundos de 5 a 30. No tiene fijo, y su lista no trae el 67.",
  },
  {
    slug: "euskaltel",
    nombre: "Euskaltel",
    ojo: "Segundos de 5 a 30. El fijo no paga cuota mensual por desviar.",
  },
  {
    slug: "r-galicia",
    nombre: "R (Galicia)",
    ojo: "También se desvía desde la app de R, el móvil y el fijo.",
  },
  {
    slug: "telecable",
    nombre: "Telecable",
    ojo: "Segundos de 5 a 30. El fijo trae 4.000 minutos a otros fijos.",
  },
  {
    slug: "iphone-y-android",
    nombre: "iPhone y Android",
    ojo: "El ajuste del iPhone que se queda las llamadas de clientes nuevos.",
  },
];

export default function DesvioDeLlamadasPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      migas={[{ name: "Desvío de llamadas", path: ruta }]}
      etiqueta={{ icono: PhoneForwarded, texto: "Guía por operador" }}
      titulo={titulo}
      entradilla={
        <p>
          No hace falta cambiar de número: con tres códigos en tu móvil, las
          llamadas que no coges pasan a tu recepcionista de IA. Escribe tu
          número de Alhabla y cópialos.
        </p>
      }
      descripcion={descripcion}
      ctaSecundario={{ texto: "Elegir mi operador", href: "#operadores" }}
      ubicacion="desvio_indice"
      tipo="CollectionPage"
      faqs={faqs}
      tituloFaqs="Dudas habituales sobre el desvío"
      relacionadas={[
        {
          href: op("iphone-y-android"),
          titulo: "El desvío en iPhone y Android",
          texto:
            "El ajuste del iPhone que se queda llamadas y el menú de cada marca.",
        },
        {
          href: "/blog/desvio-de-llamadas-si-no-contesta",
          titulo: "Desvío de llamadas si no contesta",
          texto: "El artículo del blog con el 61 en móvil y fijo.",
        },
        {
          href: "/blog/desviar-llamadas-sin-cambiar-de-numero",
          titulo: "Desviar llamadas sin cambiar de número",
          texto:
            "Qué pasa con una llamada desde que no la coges hasta que queda reservada.",
        },
      ]}
      cierre="Tu número de siempre, y ninguna llamada sin contestar."
    >
      <ConNumeroDeAlhabla>
        <Seccion
          id="codigos"
          titulo="Los tres códigos, con tu número"
          entradilla={
            <p>
              Se marcan desde el móvil que quieres desviar, en el teclado de la
              app Teléfono, como una llamada. Pon los tres: muchas líneas traen
              esos desvíos apuntando al buzón, y si solo cambias el 61, el
              buzón se sigue quedando las llamadas cuando comunicas o no tienes
              cobertura.
            </p>
          }
        >
          <div className="grid gap-6">
            <CampoNumeroDeAlhabla />
            <TablaDeCodigos
              titulo="En el móvil, en casi todos los operadores"
              subtitulo="En un fijo cambian: mira la ficha de tu operador."
              filas={[
                {
                  tipo: "Si no contesta",
                  recomendado: true,
                  activar: "**61*{N}#",
                  quitar: "##61#",
                  consultar: "*#61#",
                  detalle:
                    "Tu teléfono suena como siempre y, si no llegas, salta a la recepcionista.",
                },
                {
                  tipo: "Si comunica o la rechazas",
                  recomendado: true,
                  activar: "**67*{N}#",
                  quitar: "##67#",
                  consultar: "*#67#",
                  detalle:
                    "Con la llamada en espera activada no comunicas: entonces se aplica el de no contesta.",
                },
                {
                  tipo: "Apagado o sin cobertura",
                  recomendado: true,
                  activar: "**62*{N}#",
                  quitar: "##62#",
                  consultar: "*#62#",
                },
                {
                  tipo: "Si no contesta, eligiendo los segundos",
                  activar: "**61*{N}**{T}#",
                  quitar: "##61#",
                  consultar: "*#61#",
                  segundos: { opciones: [5, 10, 15, 20, 25, 30], inicial: 20 },
                  detalle:
                    "En lugar del primero. No todos los operadores lo aceptan.",
                },
                {
                  tipo: "Todas las llamadas",
                  activar: "**21*{N}#",
                  quitar: "##21#",
                  consultar: "*#21#",
                  detalle:
                    "Tu teléfono deja de sonar. Es el único que trae el menú de Ajustes del iPhone.",
                },
              ]}
              nota="Fuentes: 3GPP TS 22.030 (anexo B) y TS 22.082 V19.0.0, § 3."
            />
          </div>
        </Seccion>

        <Seccion
          id="comprobar"
          fondo
          titulo="Comprueba que funciona"
          entradilla={
            <p>
              Primero preguntas a la red y luego Alhabla hace una llamada real
              a tu línea para ver si el desvío salta.
            </p>
          }
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="panel p-6">
              <h3 className="text-lg font-bold text-tinta">
                1. Pregunta a la red
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted">
                Marca <Codigo>*#61#</Codigo> y pulsa llamar: la pantalla dice a
                qué número va el desvío y con cuántos segundos. Lo mismo con{" "}
                <Codigo>*#67#</Codigo> y <Codigo>*#62#</Codigo>. Si sale otro
                número (el del buzón), el tuyo no se guardó.
              </p>
            </div>
            <div className="panel p-6">
              <h3 className="text-lg font-bold text-tinta">
                2. «Comprobar desvío» en tu panel
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted">
                En Ajustes › Teléfono, Alhabla llama a la línea de tu negocio
                desde tu número de Alhabla. No la cojas: si el desvío funciona,
                vuelve a entrar por la recepcionista y el panel dice «Desvío
                funcionando». Si no, te dice el motivo: la has cogido tú (o un
                contestador), la línea comunicaba o no ha saltado el desvío.
              </p>
              <a
                href={appUrl("/ajustes/telefono")}
                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-morado-tinta underline underline-offset-4 hover:text-tinta"
              >
                Abrir Ajustes › Teléfono
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          </div>
          <div className="mt-6">
            <ListaCheck
              items={[
                "No gasta minutos de tu plan de Alhabla, y puedes repetirla hasta 3 veces por hora.",
                "Funciona con fijos y móviles españoles: es la prueba que vale cuando tu operador no publica un código.",
                "Si a las 24 horas de tener tu número aún no lo has comprobado y no te ha entrado ninguna llamada, Alhabla te lo recuerda por WhatsApp o por correo.",
                "A partir de ahí, lo que no coges lo atiende la recepcionista y tú lo ves por WhatsApp o en el panel.",
              ]}
            />
          </div>
        </Seccion>

        <Seccion
          id="operadores"
          titulo="Lo que cambia en tu operador"
          entradilla={
            <p>
              El código del móvil es casi siempre el mismo. Lo que cambia es el
              fijo, el precio y los segundos: cada ficha trae sus códigos, su
              coste y cómo volver a su buzón.
            </p>
          }
        >
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {operadores.map(({ slug, nombre, ojo }) => (
              <li key={slug}>
                <Link
                  href={op(slug)}
                  className="group flex h-full flex-col rounded-2xl border border-linea bg-lienzo p-5 transition hover:border-lavado-borde"
                >
                  <span className="flex items-center justify-between gap-3 font-bold text-tinta">
                    {nombre}
                    <ArrowRight
                      className="h-4 w-4 shrink-0 text-morado transition group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </span>
                  <span className="mt-1.5 text-sm leading-6 text-muted">
                    {ojo}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <Texto>
              <p>
                <strong>Finetwork</strong> no usa códigos: el desvío está en su
                app o en el área de cliente, en los ajustes de llamadas, y gasta
                minutos de tu tarifa (sin minutos, se cobra como llamada
                nacional). Su «TU FIJO» desvía al móvil asociado del titular; a
                otro número, no lo documenta. <strong>Avatel</strong> publica{" "}
                <Codigo>*61*número#</Codigo>, con un solo asterisco, y deja
                configurarlo en la app Avatel Móvil; del fijo no publica nada.
              </p>
            </Texto>
          </div>
        </Seccion>

        <Seccion
          id="cual"
          fondo
          titulo="Desviar, o dar el número de Alhabla"
          entradilla={
            <p>
              Si quieres que la recepcionista conteste siempre, no pongas el
              desvío de todas: publica el número de Alhabla como principal.
            </p>
          }
        >
          <Tabla
            cabecera={["", "Desvío condicional", "Alhabla como número principal"]}
            filas={[
              [
                "Qué número das",
                "El tuyo de siempre",
                "El fijo de Alhabla, en Google, tu web y tus tarjetas",
              ],
              [
                "Quién coge primero",
                "Tú; si no llegas, la recepcionista",
                "La recepcionista, siempre",
              ],
              [
                "Pasar la llamada a tu móvil",
                "No la pasa: si puedes cogerla, ya la coges tú",
                "Con «Cuándo pasarme llamadas»: nunca, si el cliente lo pide o, solo dentro de tu horario, también ante una queja o una urgencia",
              ],
              [
                "Qué cobra tu operador",
                "Cada llamada desviada sale de tu línea",
                "Nada por desviar: no hay desvío",
              ],
            ]}
            nota="El número de Alhabla es un fijo geográfico español."
          />
          <div className="mt-6">
            <Nota
              tipo="importante"
              titulo="El móvil al que te pasan llamadas no puede desviar"
            >
              Si la recepcionista te pasa una llamada al móvil y ese móvil tiene
              un desvío hacia Alhabla, la llamada vuelve a ella. Deja sin
              desvíos el móvil que pones en «Cuándo pasarme llamadas».
            </Nota>
          </div>
        </Seccion>

        <Seccion
          id="quitar"
          titulo="Quitar el desvío sin perder el buzón"
          entradilla={
            <p>
              Marca <Codigo>##61#</Codigo>, y <Codigo>##67#</Codigo> y{" "}
              <Codigo>##62#</Codigo> si los pusiste. No uses{" "}
              <Codigo>##002#</Codigo>.
            </p>
          }
        >
          <Texto>
            <p>
              <Codigo>##002#</Codigo> borra todos los desvíos de la línea de una
              vez, también los que mandan al buzón las llamadas en situaciones
              que tú no tocaste; Movistar, Orange y Digi lo avisan en su ayuda.
              Quitarlos uno a uno solo deshace lo tuyo.
            </p>
            <p>
              Quitar el 61 no devuelve el buzón por sí solo: es el mismo hueco
              que ocupó Alhabla. Si quieres que vuelva, actívalo otra vez con el
              método de tu operador, que está en su ficha.
            </p>
          </Texto>
        </Seccion>

        <Fuentes
          consultadas="2026-10-20"
          fuentes={[
            {
              nombre: "3GPP TS 22.030: códigos de los servicios suplementarios",
              url: "https://www.etsi.org/deliver/etsi_ts/122000_122099/122030/19.00.00_60/ts_122030v190000p.pdf",
            },
            {
              nombre: "3GPP TS 22.082: desvío de llamadas",
              url: "https://www.3gpp.org/ftp/Specs/archive/22_series/22.082/22082-j00.zip",
            },
            {
              nombre: "Movistar: servicios de móvil",
              url: "https://www.movistar.es/mas-servicios/servicios-de-movil",
            },
            {
              nombre: "Movistar: servicios de fijo",
              url: "https://www.movistar.es/mas-servicios/servicios-de-fijo",
            },
            {
              nombre: "Vodafone: desviar llamadas en el móvil",
              url: "https://ayudacliente.vodafone.es/particulares/movil/opciones-de-llamada-y-voz/como-desviar-llamadas-en-tu-movil/",
            },
            {
              nombre: "Vodafone: desviar llamadas en el fijo",
              url: "https://ayudacliente.vodafone.es/particulares/internet-y-fijo/fijo/como-desviar-llamadas-en-tu-fijo/",
            },
            {
              nombre: "Orange: desvío en el móvil",
              url: "https://ayuda.orange.es/particulares/mi-orange/activar-servicios/777-desvia-las-llamadas-que-recibes-en-tu-movil-a-otro-numero",
            },
            {
              nombre: "Orange: desvío en el fijo",
              url: "https://ayuda.orange.es/particulares/internet-y-wi-fi/servicios/2055-desvia-las-llamadas-de-tu-telefono-fijo-de-orange-a-otro-fijo-o-a-un-movil",
            },
            {
              nombre: "Yoigo: desvío en el móvil",
              url: "https://www.yoigo.com/ayuda/desvio-de-llamadas-en-el-movil",
            },
            {
              nombre: "Yoigo: desvío en el fijo",
              url: "https://www.yoigo.com/ayuda/como-puedo-desviar-llamadas-de-fijo-a-movil",
            },
            {
              nombre: "MásMóvil: desvío en el móvil",
              url: "https://www.masmovil.es/ayuda-clientes/como-activo-el-desvio-de-llamadas",
            },
            {
              nombre: "MásMóvil: desvío en el fijo",
              url: "https://www.masmovil.es/ayuda-clientes/como-desviar-llamadas-desde-numero-fijo",
            },
            {
              nombre: "O2: desvío en el móvil",
              url: "https://o2online.es/ayuda/desvio-llamadas-movil/",
            },
            {
              nombre: "O2: desvío en el fijo",
              url: "https://o2online.es/ayuda/desvio-de-llamadas-desde-el-fijo/",
            },
            {
              nombre: "Jazztel: desvío en el móvil",
              url: "https://ayuda.jazztel.com/movil/servicios/1743-desvio-de-llamadas",
            },
            {
              nombre: "Jazztel: servicios de la línea fija",
              url: "https://ayuda.jazztel.com/fijo/1815-servicios-de-valor-anadido-en-tu-linea-fija",
            },
            {
              nombre: "Digi: servicios adicionales",
              url: "https://www.digimobil.es/servicios-adicionales",
            },
            {
              nombre: "Pepephone: activar y desactivar el desvío",
              url: "https://www.pepephone.com/ayuda/como-activar-y-desactivar-desvio-de-llamadas",
            },
            {
              nombre: "Lowi: activar el desvío",
              url: "https://www.lowi.es/asistencia/llamadas/como-activo-el-desvio-de-llamadas",
            },
            {
              nombre: "Simyo: preguntas sobre tu línea",
              url: "https://www.simyo.es/preguntas-frecuentes/mi-linea.html",
            },
            {
              nombre: "Finetwork: desviar las llamadas a otro número",
              url: "https://www.finetwork.com/ayuda/configuracion-y-gestion/como-puedo-desviar-las-llamadas-a-otro-numero",
            },
            {
              nombre: "Finetwork: condiciones del servicio TU FIJO",
              url: "https://www.finetwork.com/ayuda/condiciones-generales-de-contratacion-de-los-servicios/condiciones-generales-del-servicio-tufijo",
            },
            {
              nombre: "Euskaltel: desvío en el móvil",
              url: "https://www.euskaltel.com/ayuda-clientes/activar-servicio-desvio-llamadas",
            },
            {
              nombre: "Euskaltel: desvío en el fijo",
              url: "https://www.euskaltel.com/ayuda-clientes/como-configurar-un-desvio-de-llamada",
            },
            {
              nombre: "R: desvío en el móvil",
              url: "https://mundo-r.com/es/ayuda-clientes/desvio-movil-r",
            },
            {
              nombre: "R: desvío en el fijo",
              url: "https://mundo-r.com/es/ayuda-clientes/desvio-llamadas",
            },
            {
              nombre: "Telecable: desvío en el móvil",
              url: "https://telecable.es/ayuda-clientes/desvio-llamadas-movil",
            },
            {
              nombre: "Telecable: desvío en el fijo",
              url: "https://telecable.es/ayuda-clientes/desviar-llamadas-fijo",
            },
            {
              nombre: "Avatel: configurar el buzón de voz y los desvíos",
              url: "https://avatel.es/ayuda/faq/quiero-configurar-mi-buzon-de-voz-como-puedo-hacerlo",
            },
            {
              nombre: "Avatel: app Avatel Móvil",
              url: "https://avatel.es/app-movil",
            },
          ]}
        />
      </ConNumeroDeAlhabla>
    </PaginaGuia>
  );
}
