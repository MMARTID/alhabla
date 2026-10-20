import Link from "next/link";
import { CircleAlert, PhoneCall, Smartphone, Store } from "lucide-react";
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
  Tarjetas,
  Texto,
} from "@/components/pagina-guia";
import { metadataDePagina } from "@/lib/seo";

/**
 * Desvío en Vodafone (2026-10-20), con la ayuda oficial de ayudacliente.vodafone.es
 * y vodafone.es. Lo que no hay en ninguna otra ficha: el fijo de Vodafone
 * solo dice desviar a fijos y móviles de Vodafone o a móviles de otros
 * operadores. El número de Alhabla es un fijo geográfico de otro operador,
 * así que queda fuera de lo que Vodafone dice admitir; no lo hemos probado
 * en una línea real y la página lo dice claro, con las tres salidas.
 */

const ruta = "/desvio-de-llamadas/vodafone";
const titulo = "Desviar llamadas en Vodafone a tu recepcionista de IA";
const descripcion =
  "Códigos de Vodafone para móvil y fijo, los 0,182 € por llamada desviada y por qué el fijo de Vodafone puede no desviar al número de tu recepcionista.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

const faqs = [
  {
    question: "¿Puedo desviar mi fijo de Vodafone a Alhabla?",
    answer:
      "Vodafone dice que el fijo se puede desviar a cualquier móvil o fijo de Vodafone o a un móvil de otro operador. El número de Alhabla es un fijo de otro operador, así que no está en esa lista. No te prometemos que funcione: pruébalo con «Comprobar desvío», o desvía el móvil, o usa Alhabla como número principal.",
  },
  {
    question: "¿Cuánto me cuesta cada llamada desviada desde el móvil?",
    answer:
      "Activar el desvío es gratis, pero Vodafone indica que tiene coste de establecimiento de llamada (0,182 € con IVA) más el precio por minuto. Su ayuda no aclara si una tarifa con llamadas ilimitadas lo cubre: compruébalo en tu primera factura o pregúntaselo.",
  },
  {
    question: "¿Y desde el fijo?",
    answer:
      "0,182 € de establecimiento y 0,242 € por minuto en cada llamada desviada, IVA incluido. Activarlo no cuesta nada.",
  },
  {
    question: "No encuentro el desvío del fijo en Mi Vodafone. ¿Dónde está?",
    answer:
      "No está. Para el fijo, Mi Vodafone solo deja configurar el identificador, la llamada en espera, la retención y el contestador. El desvío del fijo se activa con los códigos desde el propio teléfono.",
  },
  {
    question: "¿Qué hace ##002# en Vodafone?",
    answer:
      "Vodafone lo llama «Desactivar todos los servicios»: quita todos los desvíos de la línea. Para quitar solo el de tu recepcionista, usa ##61# (y ##67# o ##62# si los pusiste).",
  },
  {
    question: "¿Puedo desviar el fijo a mi móvil y el móvil a Alhabla?",
    answer:
      "El primer salto, del fijo a tu móvil, sí entra en lo que Vodafone admite. El segundo es otro desvío encadenado y Vodafone no documenta cómo se comporta (entre sus incompatibilidades cita «4 desvíos en cadena»). Pagarías además los dos tramos. Si lo intentas, no lo des por bueno hasta que «Comprobar desvío» diga que funciona.",
  },
  {
    question: "Tengo control de consumo en la línea. ¿Puedo desviar?",
    answer:
      "No: Vodafone incluye el control de consumo en la línea desviada entre lo que es incompatible con el desvío.",
  },
];

export default function DesvioVodafonePage() {
  return (
    <PaginaGuia
      ruta={ruta}
      migas={[
        { name: "Desvío de llamadas", path: "/desvio-de-llamadas" },
        { name: "Vodafone", path: ruta },
      ]}
      etiqueta={{ icono: PhoneCall, texto: "Vodafone · móvil y fijo" }}
      titulo={titulo}
      entradilla={
        <>
          <p>
            En un móvil Vodafone, el desvío a tu recepcionista se marca con{" "}
            <Codigo>**61*número#</Codigo> y la tecla de llamada. Activarlo es
            gratis; cada llamada desviada tiene coste de establecimiento.
          </p>
          <p>
            Con el fijo, cuidado: Vodafone solo dice admitir como destino sus
            propios números y los móviles de otros operadores, y el de Alhabla
            es un fijo.
          </p>
        </>
      }
      descripcion={descripcion}
      ctaSecundario={{ texto: "El caso del fijo", href: "#fijo" }}
      ubicacion="desvio_vodafone"
      faqs={faqs}
      tituloFaqs="Preguntas sobre el desvío en Vodafone"
      relacionadas={[
        {
          href: "/desvio-de-llamadas#cual",
          titulo: "Alhabla como número principal",
          texto:
            "La alternativa al desvío, con las llamadas que te pasa al móvil.",
        },
        {
          href: "/desvio-de-llamadas/iphone-y-android",
          titulo: "iPhone y Android",
          texto:
            "El Buzón de voz en vivo del iPhone sigue aunque quites el de Vodafone.",
        },
        {
          href: "/desvio-de-llamadas/movistar",
          titulo: "Desvío en Movistar",
          texto:
            "El otro fijo con condiciones propias: allí se paga una cuota.",
        },
        {
          href: "/blog/desviar-llamadas-sin-cambiar-de-numero",
          titulo: "Desviar sin cambiar de número",
          texto: "Qué ocurre con la llamada una vez desviada.",
        },
      ]}
      cierre="Con Vodafone también: tu número, y nadie se queda sin respuesta."
    >
      <ConNumeroDeAlhabla>
        <Seccion
          id="movil"
          titulo="En el móvil Vodafone"
          entradilla={
            <p>
              Vodafone publica los cuatro desvíos con el código, el número y la
              tecla de llamada. Desde el móvil que quieres desviar, en el
              teclado de la app Teléfono.
            </p>
          }
        >
          <div className="grid gap-6">
            <CampoNumeroDeAlhabla />
            <TablaDeCodigos
              titulo="Móvil Vodafone"
              subtitulo="Vodafone no publica los códigos de consulta; el de la norma es *#61#."
              filas={[
                {
                  tipo: "Si no contestas",
                  recomendado: true,
                  activar: "**61*{N}#",
                  quitar: "##61#",
                },
                {
                  tipo: "Si comunicas",
                  recomendado: true,
                  activar: "**67*{N}#",
                  quitar: "##67#",
                },
                {
                  tipo: "Apagado o sin cobertura",
                  recomendado: true,
                  activar: "**62*{N}#",
                  quitar: "##62#",
                },
                {
                  tipo: "Todas las llamadas",
                  activar: "**21*{N}#",
                  quitar: "##21#",
                },
                {
                  tipo: "Desactivar todos los servicios",
                  quitar: "##002#",
                  detalle: "Quita todos los desvíos de la línea.",
                },
              ]}
            />
          </div>
          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <Texto>
              <p>
                <strong>El coste.</strong> Activarlo no se cobra, pero Vodafone
                avisa de que el desvío «tiene coste de establecimiento de
                llamada Vodafone (0,182 € IVA incluido) + el precio por minuto».
                Lo que no explica es si una tarifa con llamadas ilimitadas cubre
                ese tramo. Si no quieres sorpresas, pregúntalo o mira la primera
                factura con el desvío puesto.
              </p>
              <p>
                <strong>Los segundos.</strong> Vodafone no publica cómo cambiar
                cuánto suena antes de desviar. En Mi Vodafone sí se elige el
                plazo tras el que salta su contestador, pero eso es para el
                contestador, no para el desvío a otro número.
              </p>
            </Texto>
            <Texto>
              <p>
                <strong>En Mi Vodafone.</strong> Mis productos › Móvil, fibra y
                TV › tu línea › Mi tarifa › Ajustes de línea › Opciones de
                llamada › Desvíos de llamada › Gestiona tus desvíos.
              </p>
              <p>
                <strong>Lo que no se puede tener a la vez.</strong> Según
                Vodafone, el desvío es incompatible con el control de consumo en
                la línea desviada, con la restricción de llamadas en el destino
                y con la multiconferencia, y no se puede desviar a números
                internacionales, abreviados (como el 22123), cortos de Vodafone,
                118xx, 803, 806, 807, 905 ni 907. También cita «4 desvíos en
                cadena».
              </p>
            </Texto>
          </div>
        </Seccion>

        <Seccion
          id="fijo"
          fondo
          titulo="El fijo de Vodafone y el número de tu recepcionista"
          entradilla={
            <p>
              La ayuda del fijo dice que se puede desviar «a cualquier móvil o
              fijo de Vodafone o a un móvil de otro operador». De los fijos de
              otros operadores no dice nada.
            </p>
          }
        >
          <Texto>
            <p>
              El número de Alhabla es un fijo geográfico español que no es de
              Vodafone. Por tanto, queda fuera de lo que Vodafone dice admitir
              como destino del desvío del fijo. Puede que la red lo acepte
              igualmente, o puede que no: no lo hemos probado en una línea real
              de Vodafone y no vamos a decirte que funciona. Lo que sí podemos
              darte son tres caminos para que no dependas de ello.
            </p>
          </Texto>
          <div className="mt-8">
            <Tarjetas
              items={[
                {
                  icono: Smartphone,
                  titulo: "Desvía el móvil",
                  texto:
                    "Si tus clientes te llaman sobre todo al móvil, el desvío del móvil no tiene esa limitación de destinos. Es lo más sencillo.",
                },
                {
                  icono: Store,
                  titulo: "Usa Alhabla como número principal",
                  texto: (
                    <>
                      Publicas el número de Alhabla en Google, tu web y tus
                      tarjetas; no hay desvío, así que no hay limitación ni
                      coste por llamada desviada. La recepcionista te pasa al
                      móvil las que elijas.{" "}
                      <Link
                        href="/desvio-de-llamadas#cual"
                        className="font-semibold text-morado-tinta underline underline-offset-4"
                      >
                        Cómo funciona
                      </Link>
                    </>
                  ),
                },
                {
                  icono: CircleAlert,
                  titulo: "Pruébalo antes de darlo por hecho",
                  texto:
                    "Si quieres intentarlo con el fijo, marca el código y pulsa «Comprobar desvío» en tu panel. Si dice «Desvío funcionando», tu línea lo acepta; si dice que no ha saltado el desvío, ya sabes por qué.",
                },
              ]}
            />
          </div>
          <div className="mt-8 grid gap-6">
            <TablaDeCodigos
              titulo="Fijo Vodafone"
              subtitulo="Descuelga y marca el código seguido de la tecla de llamada, sin almohadilla al final. Se quita con doble almohadilla."
              filas={[
                {
                  tipo: "Si no contestas",
                  recomendado: true,
                  activar: "*61*{N}",
                  quitar: "##61#",
                },
                { tipo: "Si comunicas", activar: "*67*{N}", quitar: "##67#" },
                {
                  tipo: "Apagado o sin servicio",
                  activar: "*62*{N}",
                  quitar: "##62#",
                },
                {
                  tipo: "Todas las llamadas",
                  activar: "*21*{N}",
                  quitar: "##21#",
                },
              ]}
              nota="Vodafone es el único operador que publica el desvío por apagado (62) también para el fijo."
            />
          </div>
          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <Texto>
              <p>
                <strong>Lo que cuesta.</strong> Activarlo es gratis; cada
                llamada desviada desde el fijo paga 0,182 € de establecimiento
                más 0,242 € por minuto, IVA incluido. Con esas tarifas, una
                llamada desviada de tres minutos sale por 0,182 € + 3 × 0,242 €,
                unos 0,91 €.
              </p>
              <p>
                <strong>Sin pasar por Mi Vodafone.</strong> Para el fijo, el
                área de cliente solo ofrece identificador, llamada en espera,
                retención y contestador. El desvío del fijo solo se activa con
                los códigos.
              </p>
            </Texto>
            <Nota
              tipo="importante"
              titulo="Quita antes el contestador del fijo"
            >
              El contestador del fijo de Vodafone se activa con{" "}
              <Codigo>*11*</Codigo> y se quita con <Codigo>*110*</Codigo>. Si
              está puesto, coge él las llamadas antes de que salte cualquier
              desvío.
            </Nota>
          </div>
        </Seccion>

        <Seccion id="buzon" titulo="El contestador del móvil, y el del iPhone">
          <div className="grid gap-8 lg:grid-cols-2">
            <Texto>
              <p>
                El contestador del móvil Vodafone se activa con{" "}
                <Codigo>*147#</Codigo> y se quita con <Codigo>#147#</Codigo>.
                Cuando pones tus desvíos hacia Alhabla, son ellos los que mandan
                en esas situaciones; si algún día los quitas con{" "}
                <Codigo>##61#</Codigo>, <Codigo>*147#</Codigo> es tu vuelta al
                contestador. El razonamiento completo está en{" "}
                <Link href="/desvio-de-llamadas#quitar">
                  quitar el desvío sin perder el buzón
                </Link>
                .
              </p>
            </Texto>
            <Texto>
              <p>
                Con un iPhone hay un detalle que Vodafone deja por escrito: el
                Buzón de voz en vivo de Apple «sigue funcionando aunque
                desactives en Vodafone ese servicio». Es del propio teléfono, no
                de la red. Mira{" "}
                <Link href="/desvio-de-llamadas/iphone-y-android">
                  el desvío en iPhone y Android
                </Link>{" "}
                para dejarlo bien configurado.
              </p>
            </Texto>
          </div>
          <div className="mt-8">
            <ListaCheck
              items={[
                "Móvil: marca *#61# para ver a qué número va el desvío si no contestas.",
                "Fijo: Vodafone no publica consulta; «Comprobar desvío» es la prueba.",
                "En los dos casos, deja que suene sin cogerlo mientras dura la comprobación.",
              ]}
            />
          </div>
        </Seccion>

        <Fuentes
          consultadas="2026-10-20"
          fuentes={[
            {
              nombre: "Vodafone: cómo desviar llamadas en tu móvil",
              url: "https://ayudacliente.vodafone.es/particulares/movil/opciones-de-llamada-y-voz/como-desviar-llamadas-en-tu-movil/",
            },
            {
              nombre: "Vodafone: cómo desviar llamadas en tu fijo",
              url: "https://ayudacliente.vodafone.es/particulares/internet-y-fijo/fijo/como-desviar-llamadas-en-tu-fijo/",
            },
            {
              nombre: "Vodafone: desvío de llamadas",
              url: "https://www.vodafone.es/c/mvfes/desvio-llamadas",
            },
            {
              nombre: "Vodafone: gestionar tu contestador móvil",
              url: "https://ayudacliente.vodafone.es/particulares/movil/opciones-de-llamada-y-voz/como-gestionar-tu-contestador-movil/",
            },
            {
              nombre: "Vodafone: opciones de llamada configurables en tu fijo",
              url: "https://ayudacliente.vodafone.es/particulares/internet-y-fijo/fijo/opciones-de-llamada-configurables-en-tu-fijo/",
            },
          ]}
        />
      </ConNumeroDeAlhabla>
    </PaginaGuia>
  );
}
