import Link from "next/link";
import { CircleAlert, PhoneCall, Smartphone, Store } from "lucide-react";
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
  Tarjetas,
  Texto,
} from "@/components/pagina-guia";
import { metadataDePagina } from "@/lib/seo";

/**
 * Desvío en Vodafone (datos del 2026-10-20), con la ayuda oficial de
 * ayudacliente.vodafone.es y vodafone.es. Lo que no hay en ninguna otra
 * ficha: el fijo de Vodafone solo dice desviar a fijos y móviles de Vodafone
 * o a móviles de otros operadores. El número de Alhabla es un fijo geográfico
 * de otro operador, así que queda fuera de lo que Vodafone dice admitir; no
 * está probado en una línea real y la página lo dice claro, con tres salidas.
 */

const ruta = "/desvio-de-llamadas/vodafone";
const titulo = "Desviar llamadas en Vodafone a tu recepcionista de IA";
const descripcion =
  "Códigos de Vodafone para móvil y fijo, los 0,182 € por llamada desviada y por qué el fijo de Vodafone puede no desviar al número de tu recepcionista.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

const faqs = [
  {
    question: "¿Se puede activar desde Mi Vodafone?",
    answer:
      "El del móvil, sí: Mis productos › Móvil, fibra y TV › tu línea › Mi tarifa › Ajustes de línea › Opciones de llamada › Desvíos de llamada › Gestiona tus desvíos. El del fijo, no: para el fijo, Mi Vodafone solo deja configurar el identificador, la llamada en espera, la retención y el contestador, y el desvío se activa con los códigos.",
  },
  {
    question: "¿Qué no se puede tener a la vez que el desvío?",
    answer:
      "Según Vodafone, el control de consumo en la línea desviada, la restricción de llamadas en el destino y la multiconferencia. Tampoco se puede desviar a números internacionales, abreviados (como el 22123), cortos de Vodafone, 118xx, 803, 806, 807, 905 ni 907, y cita «4 desvíos en cadena» entre las incompatibilidades.",
  },
  {
    question: "¿Puedo desviar el fijo a mi móvil y el móvil a Alhabla?",
    answer:
      "El primer salto, del fijo a tu móvil, sí entra en lo que Vodafone admite. El segundo es otro desvío encadenado y Vodafone no documenta cómo se comporta. Pagarías además los dos tramos. Si lo intentas, no lo des por bueno hasta que «Comprobar desvío» diga que funciona.",
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
        <p>
          En un móvil Vodafone, el desvío a tu recepcionista se marca con{" "}
          <Codigo>**61*número#</Codigo> y la tecla de llamada. Activarlo es
          gratis; cada llamada desviada tiene coste de establecimiento. Con el
          fijo, cuidado: puede que no desvíe al número de Alhabla.
        </p>
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
            "La alternativa al desvío, y cuándo te pasa llamadas al móvil.",
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
      ]}
      cierre="Desvía tu móvil Vodafone, y lo que no coges lo atiende ella."
    >
      <ConNumeroDeAlhabla>
        <Seccion
          id="movil"
          titulo="En el móvil Vodafone"
          entradilla={
            <p>
              Desde el móvil que quieres desviar, en el teclado de la app
              Teléfono: el código, el número y la tecla de llamada.
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
          <div className="mt-8">
            <Texto>
              <p>
                <strong>El coste.</strong> Activarlo no se cobra, pero Vodafone
                avisa de que el desvío «tiene coste de establecimiento de
                llamada Vodafone (0,182 € IVA incluido) + el precio por minuto».
                No aclara si una tarifa con llamadas ilimitadas cubre ese tramo:
                pregúntalo o mira la primera factura con el desvío puesto.
              </p>
              <p>
                <strong>Los segundos.</strong> Vodafone no publica cómo cambiar
                cuánto suena antes de desviar. El plazo que se elige en Mi
                Vodafone es el de su contestador, no el del desvío.
              </p>
              <p>
                <strong>El contestador.</strong> Se activa con{" "}
                <Codigo>*147#</Codigo> y se quita con <Codigo>#147#</Codigo>: es
                tu vuelta a él si algún día quitas el desvío. En un iPhone, el
                Buzón de voz en vivo de Apple sigue aunque quites el de
                Vodafone; mira{" "}
                <Link href="/desvio-de-llamadas/iphone-y-android">
                  el desvío en iPhone y Android
                </Link>
                .
              </p>
            </Texto>
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Nota
              tipo="importante"
              titulo="El fijo de Vodafone puede no desviar a Alhabla"
            >
              Vodafone dice que el fijo se desvía a sus propios números y a
              móviles de otros operadores. El de Alhabla es un fijo de otro
              operador. No lo des por hecho:{" "}
              <a
                href="#fijo"
                className="font-semibold underline underline-offset-4"
              >
                tienes tres salidas
              </a>
              .
            </Nota>
            <ComprobarDesvio>
              <p>
                En el móvil, marca <Codigo>*#61#</Codigo> para ver a qué número
                va el desvío. En el fijo no hay consulta publicada.
              </p>
            </ComprobarDesvio>
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
              otros operadores, como el de Alhabla, no dice nada. Puede que la
              red lo acepte o puede que no: no está probado en una línea real
              de Vodafone, así que no te decimos que funcione.
            </p>
          }
        >
          <Tarjetas
            items={[
              {
                icono: Smartphone,
                titulo: "Desvía el móvil",
                texto:
                  "Si tus clientes te llaman sobre todo al móvil, el desvío del móvil no tiene esa limitación. Es lo más sencillo.",
              },
              {
                icono: Store,
                titulo: "Da el número de Alhabla",
                texto: (
                  <>
                    Lo publicas en Google, tu web y tus tarjetas: no hay desvío,
                    ni límite de destinos ni coste por llamada desviada.{" "}
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
                titulo: "Pruébalo antes",
                texto:
                  "Marca el código del fijo y pulsa «Comprobar desvío» en tu panel. Si dice «Desvío funcionando», tu línea lo acepta.",
              },
            ]}
          />
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
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Texto>
              <p>
                <strong>Lo que cuesta.</strong> Activarlo es gratis; cada
                llamada desviada desde el fijo paga 0,182 € de establecimiento
                más 0,242 € por minuto, IVA incluido. Una de tres minutos sale
                por unos 0,91 €.
              </p>
            </Texto>
            <Nota
              tipo="importante"
              titulo="Quita antes el contestador del fijo"
            >
              Se activa con <Codigo>*11*</Codigo> y se quita con{" "}
              <Codigo>*110*</Codigo>. Si está puesto, coge él las llamadas antes
              de que salte cualquier desvío.
            </Nota>
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
