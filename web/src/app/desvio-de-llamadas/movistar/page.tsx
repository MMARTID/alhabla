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
 * Desvío en Movistar (datos del 2026-10-20). Fuentes: las páginas de
 * servicios de móvil y de fijo de movistar.es, su blog y la Comunidad
 * Movistar. Lo propio de Movistar: el fijo se contrata (4 €/mes por tipo), el
 * buzón ocupa por defecto los tres condicionales y MultiSIM solo deja el
 * desvío inmediato.
 */

const ruta = "/desvio-de-llamadas/movistar";
const titulo = "Desviar llamadas en Movistar a tu recepcionista de IA";
const descripcion =
  "Códigos de Movistar para el móvil y el fijo, el alta de 4 €/mes por tipo en el fijo, el buzón del 22500 y cómo quitar el desvío sin borrar nada más.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

const faqs = [
  {
    question: "¿Se puede activar desde Mi Movistar, sin códigos?",
    answer:
      "La Comunidad Movistar describe el camino en la web de Mi Movistar: Gestiones de Línea Móvil › Desvío de llamadas, escribes el número y pulsas Guardar. El área de cliente cambia a menudo; si no lo encuentras así, el código del teclado hace lo mismo.",
  },
  {
    question: "¿A qué números no deja desviar Movistar?",
    answer:
      "A los que empiezan por 90X u 80X ni a numeraciones especiales: solo a números nacionales. El de Alhabla es un fijo geográfico español, así que entra.",
  },
  {
    question: "He marcado ##002# y no pasa nada. ¿Por qué?",
    answer:
      "Si tu línea tiene MultiSIM, ese código no funciona. La Comunidad Movistar indica que en ese caso hay que llamar al 1004 para que te quiten los desvíos.",
  },
];

export default function DesvioMovistarPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      migas={[
        { name: "Desvío de llamadas", path: "/desvio-de-llamadas" },
        { name: "Movistar", path: ruta },
      ]}
      etiqueta={{ icono: Smartphone, texto: "Movistar · móvil y fijo" }}
      titulo={titulo}
      entradilla={
        <p>
          En un móvil Movistar, activar el desvío cuesta 0 € y se marca{" "}
          <Codigo>**61*</Codigo>, el número de tu recepcionista y{" "}
          <Codigo>#</Codigo>. En el fijo, cada tipo de desvío se contrata
          antes, a 4 € al mes.
        </p>
      }
      descripcion={descripcion}
      ctaSecundario={{ texto: "Ir al fijo", href: "#fijo" }}
      ubicacion="desvio_movistar"
      faqs={faqs}
      tituloFaqs="Preguntas sobre el desvío en Movistar"
      relacionadas={[
        {
          href: "/desvio-de-llamadas",
          titulo: "Todos los operadores",
          texto: "Desviar o dar el número de Alhabla, y lo que cambia en cada uno.",
        },
        {
          href: "/desvio-de-llamadas/iphone-y-android",
          titulo: "Desvío en iPhone y Android",
          texto: "Si el código no entra, dónde está el menú en tu teléfono.",
        },
        {
          href: "/desvio-de-llamadas/o2",
          titulo: "Desvío en O2",
          texto: "Otra línea donde MultiSIM obliga a desviar todo.",
        },
      ]}
      cierre="Tu Movistar sigue sonando; lo que no coges, lo atiende ella."
    >
      <ConNumeroDeAlhabla>
        <Seccion
          id="movil"
          titulo="En tu móvil Movistar"
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
              titulo="Móvil Movistar"
              subtitulo="Con los nombres que usa Movistar en su página de servicios de móvil."
              filas={[
                {
                  tipo: "Si no respondes",
                  recomendado: true,
                  activar: "**61*{N}#",
                  quitar: "##61#",
                  consultar: "*#61#",
                },
                {
                  tipo: "Si comunicas o rechazas",
                  recomendado: true,
                  activar: "**67*{N}#",
                  quitar: "##67#",
                  consultar: "*#67#",
                },
                {
                  tipo: "Apagado o fuera de cobertura",
                  recomendado: true,
                  activar: "**62*{N}#",
                  quitar: "##62#",
                  consultar: "*#62#",
                },
                {
                  tipo: "Inmediato (todas)",
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
                <strong>Qué pagas.</strong> Activarlo, nada. Cada llamada
                desviada cuenta como una llamada desde tu línea hasta el número
                de Alhabla: entra en tus llamadas ilimitadas o en tu bono de
                minutos, y en prepago necesitas saldo.
              </p>
              <p>
                <strong>Los segundos.</strong> Movistar no publica cómo
                cambiarlos; su blog habla de 15 segundos. Si pruebas{" "}
                <Codigo>**61*número**20#</Codigo>, mira después con{" "}
                <Codigo>*#61#</Codigo> qué ha guardado.
              </p>
            </Texto>
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Nota
              tipo="importante"
              titulo="Tu buzón ya usa esos tres desvíos"
            >
              <p>
                Movistar los trae activados de serie hacia el buzón. Si solo
                pones el 61, las llamadas que entren mientras comunicas o sin
                cobertura seguirán acabando en él: pon los tres con el mismo
                número. Para volver al buzón algún día, quita los tuyos uno a
                uno y llama al 22500 o entra en tu área privada.
              </p>
              <p className="mt-3">
                <strong>Con MultiSIM</strong> solo hay desvío inmediato: tu
                móvil dejaría de sonar. Si no quieres eso,{" "}
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
                Marca <Codigo>*#61#</Codigo>: la respuesta enseña el número y
                los segundos guardados.
              </p>
            </ComprobarDesvio>
          </div>
        </Seccion>

        <Seccion
          id="fijo"
          fondo
          titulo="El fijo de Movistar: primero se contrata"
          entradilla={
            <p>
              Aquí el código no basta: cada tipo de desvío es un servicio de 4 €
              al mes que hay que dar de alta antes de marcar nada.
            </p>
          }
        >
          <div className="grid gap-6">
            <Tabla
              cabecera={["Lo que contratas", "Cuota", "Para una recepcionista"]}
              filas={[
                ["Desvío si no contestas", "4 €/mes", "El que necesitas"],
                [
                  "Desvío si comunicas",
                  "4 €/mes",
                  "Recomendable si el fijo comunica a menudo",
                ],
                [
                  "Desvío inmediato",
                  "4 €/mes",
                  "Solo si quieres que el fijo no suene nunca",
                ],
                [
                  "Pack de servicios básicos",
                  "4 €/mes",
                  "Solo trae el inmediato: no te sirve",
                ],
              ]}
              nota="Además de la cuota, cada llamada desviada se paga al precio de llamadas de tu línea. En el fijo no existe desvío por apagado."
            />
            <TablaDeCodigos
              titulo="Fijo Movistar"
              subtitulo="Descuelga, espera el tono, marca el código y cuelga cuando oigas el tono continuo de confirmación."
              filas={[
                {
                  tipo: "Si no contestas",
                  recomendado: true,
                  activar: "*61*{N}#",
                  quitar: "#61#",
                },
                { tipo: "Si comunicas", activar: "*67*{N}#", quitar: "#67#" },
                { tipo: "Inmediato", activar: "*21*{N}#", quitar: "#21#" },
              ]}
              nota="Movistar no publica códigos de consulta para el fijo: la prueba es «Comprobar desvío»."
            />
          </div>
          <div className="mt-8">
            <Texto>
              <p>
                <strong>El contestador del fijo se adelanta.</strong> Si tienes
                puesto el de no contestas (<Codigo>*10#</Codigo>) o el de
                comunicando (<Codigo>*9998</Codigo>), cogerá él las llamadas.
                Se quitan con <Codigo>#9998</Codigo> y <Codigo>#10#</Codigo>.
              </p>
              <p>
                <strong>Antes de pagar 8 € al mes</strong> por los dos desvíos,
                piensa a qué número te llaman. Si es sobre todo al móvil,
                desviar el móvil no tiene cuota; si el fijo es el que conoce
                todo el mundo, puedes{" "}
                <Link href="/desvio-de-llamadas#cual">
                  publicar el número de Alhabla como principal
                </Link>
                , sin desvío y sin cuota.
              </p>
            </Texto>
          </div>
        </Seccion>

        <Fuentes
          consultadas="2026-10-20"
          fuentes={[
            {
              nombre: "Movistar: servicios de móvil",
              url: "https://www.movistar.es/mas-servicios/servicios-de-movil",
            },
            {
              nombre: "Movistar: servicios de fijo",
              url: "https://www.movistar.es/mas-servicios/servicios-de-fijo",
            },
            {
              nombre: "Blog de Movistar: cómo desviar llamadas (2022)",
              url: "https://www.movistar.es/blog/mi-movistar/desviar-llamadas-movistar/",
            },
            {
              nombre: "Comunidad Movistar: activar el desvío del móvil",
              url: "https://comunidad.movistar.es/kb/Gestiones/%C2%BFc%C3%B3mo-puedo-activar-desv%C3%ADo-de-llamadas-de-mi-m%C3%B3vil-movistar/3864076",
            },
            {
              nombre: "Comunidad Movistar: desviar llamadas de fijo a móvil",
              url: "https://comunidad.movistar.es/kb/Gestiones/c%C3%B3mo-desviar-llamadas-de-fijo-a-m%C3%B3vil/3932892",
            },
            {
              nombre: "Comunidad Movistar: quitar el desvío del móvil",
              url: "https://comunidad.movistar.es/kb/soporte_movil/%C2%BFc%C3%B3mo-puedo-quitar-el-desv%C3%ADo-de-llamadas-en-mi-m%C3%B3vil-movistar/4650195",
            },
            {
              nombre: "Comunidad Movistar: tipos de desvío condicional",
              url: "https://comunidad.movistar.es/discussions/ayuda_tecnica_movil/desv%C3%ADos-de-llamadas-condicionales-qu%C3%A9-tipos-hay-y-c%C3%B3mo-gestionarlos/3466908",
            },
          ]}
        />
      </ConNumeroDeAlhabla>
    </PaginaGuia>
  );
}
