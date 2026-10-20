import Link from "next/link";
import { Smartphone } from "lucide-react";
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
  Tabla,
  Texto,
} from "@/components/pagina-guia";
import { metadataDePagina } from "@/lib/seo";

/**
 * Desvío en Movistar (2026-10-20). Fuentes: las páginas de servicios de móvil
 * y de fijo de movistar.es (oficiales), su blog y la Comunidad Movistar
 * (respuestas de moderadores, semioficial: se dice cuando un dato viene de
 * ahí). Lo propio de Movistar: el fijo se contrata (4 €/mes por tipo), el
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
    question: "¿Cuánto cuesta desviar mi móvil Movistar a Alhabla?",
    answer:
      "Activarlo, 0 €. Cada llamada desviada cuenta como una llamada desde tu línea hasta el número de Alhabla: si tu tarifa tiene llamadas ilimitadas o un bono de minutos, entra ahí; si es de prepago, necesitas saldo.",
  },
  {
    question: "¿Y si lo que quiero desviar es el fijo del local?",
    answer:
      "En el fijo, Movistar cobra 4 € al mes por cada tipo de desvío, que hay que contratar antes de marcar el código. Las llamadas desviadas se pagan además al precio de llamadas de tu línea.",
  },
  {
    question: "Tengo el Pack de servicios básicos. ¿Ya incluye el desvío?",
    answer:
      "Solo el inmediato, el que desvía todas las llamadas y deja de sonar el fijo. El de «si no contestas», que es el que interesa para una recepcionista, se contrata aparte.",
  },
  {
    question: "He marcado ##002# y no pasa nada. ¿Por qué?",
    answer:
      "Si tu línea tiene MultiSIM, ese código no funciona. La Comunidad Movistar indica que en ese caso hay que llamar al 1004 para que te quiten los desvíos.",
  },
  {
    question: "¿Cómo vuelvo a tener buzón de voz cuando quite el desvío?",
    answer:
      "Quita solo el tuyo con ##61# (y ##67# o ##62# si los pusiste) y vuelve a activar el buzón llamando al 22500 o desde tu área privada de Mi Movistar.",
  },
  {
    question: "¿Puedo desviar el fijo cuando está apagado?",
    answer:
      "No. En el fijo, Movistar ofrece el desvío inmediato, el de no contestas y el de comunicando; el de apagado o sin cobertura solo existe en el móvil.",
  },
  {
    question: "¿A qué números no deja desviar Movistar?",
    answer:
      "A los que empiezan por 90X u 80X ni a numeraciones especiales: solo a números nacionales. El de Alhabla es un fijo geográfico español, así que entra.",
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
          <Codigo>#</Codigo>. En el fijo es otra historia: cada tipo de desvío
          se contrata antes, a 4 € al mes.
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
          texto: "Qué desvío conviene y la tabla de los demás.",
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
        {
          href: "/blog/desvio-de-llamadas-si-no-contesta",
          titulo: "Desvío si no contesta, operador por operador",
          texto: "El artículo con la tabla del 61 en móvil y fijo.",
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
              Movistar publica los cuatro códigos del estándar. Se marcan desde
              el móvil que quieres desviar, en el teclado de la app Teléfono, y
              se pulsa llamar.
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
                <strong>Qué pagas.</strong> Activarlo no cuesta nada. Lo que se
                cobra es el tramo que va desde tu línea hasta el número de
                Alhabla, que Movistar trata como «una llamada desde tu línea»:
                si tu tarifa trae llamadas ilimitadas o una franquicia de
                minutos, ese tramo entra en ella; en prepago, necesitas saldo
                para que el desvío funcione.
              </p>
              <p>
                <strong>A dónde puedes desviar.</strong> Solo a números
                nacionales; nada de 90X, 80X ni numeraciones especiales. El
                número de Alhabla es un fijo geográfico español, así que es un
                destino válido.
              </p>
              <p>
                <strong>Los segundos.</strong> Movistar no publica ni el código
                ni el margen para cambiar cuánto suena antes de desviar. Un
                artículo de su blog de 2022 dice que la llamada se desvía si
                tardas 15 segundos en responder, pero en una lista general que
                no distingue el fijo del móvil. La norma GSM admite{" "}
                <Codigo>**61*número**20#</Codigo> para fijar 20 segundos;
                Movistar no dice si lo acepta, así que, si lo pruebas, marca
                después <Codigo>*#61#</Codigo>: la respuesta enseña el número y
                los segundos guardados.
              </p>
            </Texto>
          </div>
        </Seccion>

        <Seccion
          id="buzon"
          fondo
          titulo="Tu buzón ya está usando esos tres desvíos"
          entradilla={
            <p>
              En la Comunidad Movistar, un moderador explica que los desvíos por
              no contestar, por comunicar y por apagado suelen venir activados
              de serie hacia el buzón de voz.
            </p>
          }
        >
          <Texto>
            <p>
              Eso explica lo que le pasa a mucha gente: marca el 61 con el
              número de su recepcionista, prueba a no coger y todo va bien, pero
              luego descubre mensajes en el buzón. Eran llamadas que llegaron
              mientras hablaba con otro cliente o con el móvil sin cobertura,
              que seguían apuntando al buzón. Para que no se quede ninguna,
              activa también el 67 y el 62 con el mismo número.
            </p>
            <p>
              El buzón de Movistar se gestiona llamando al 22500 o desde tu área
              privada. Apunta eso antes de desviar: es el camino para
              recuperarlo si un día quitas a Alhabla.
            </p>
            <p>
              <strong>Para quitar el desvío sin perder nada más</strong>, marca{" "}
              <Codigo>##61#</Codigo>, <Codigo>##67#</Codigo> y{" "}
              <Codigo>##62#</Codigo>, uno a uno. Movistar avisa de que{" "}
              <Codigo>##002#</Codigo> quita todos los desvíos «así como el buzón
              de voz». Y con MultiSIM ese código ni siquiera funciona: la
              Comunidad Movistar remite al 1004. Tienes el porqué en{" "}
              <Link href="/desvio-de-llamadas#quitar">
                quitar el desvío sin perder el buzón
              </Link>
              .
            </p>
          </Texto>
        </Seccion>

        <Seccion
          id="gestion"
          titulo="Desde Mi Movistar, y el problema del MultiSIM"
        >
          <div className="grid gap-8 lg:grid-cols-2">
            <Texto>
              <p>
                Si prefieres no marcar códigos, la Comunidad Movistar describe
                el camino en la web de Mi Movistar:{" "}
                <strong>Gestiones de Línea Móvil › Desvío de llamadas</strong>,
                escribes el número y pulsas <strong>Guardar</strong>. Es una
                explicación de 2022 y el área de cliente cambia a menudo; si no
                lo encuentras así, el código del teclado hace lo mismo.
              </p>
            </Texto>
            <Nota
              tipo="importante"
              titulo="Con MultiSIM solo hay desvío inmediato"
            >
              Según la misma fuente, una línea con MultiSIM solo admite el
              desvío incondicional: todas las llamadas van al destino y tu móvil
              no suena. Si no quieres renunciar a coger tú las llamadas, la
              salida es{" "}
              <Link
                href="/desvio-de-llamadas#cual"
                className="font-semibold underline underline-offset-4"
              >
                usar Alhabla como número principal
              </Link>{" "}
              y que te pase las que quieras al móvil.
            </Nota>
          </div>
        </Seccion>

        <Seccion
          id="fijo"
          fondo
          titulo="El fijo de Movistar: primero se contrata"
          entradilla={
            <p>
              Aquí el código no basta. Movistar cobra el desvío del fijo como un
              servicio: 4 € al mes por cada tipo, y hay que darlo de alta antes
              de marcar nada.
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
              nota="Movistar no publica códigos de consulta para el fijo."
            />
          </div>
          <div className="mt-8">
            <Texto>
              <p>
                <strong>Antes de pagar 8 € al mes</strong> por el de no
                contestas y el de comunicas, piensa a qué número te llaman de
                verdad. Si la mayoría de tus clientes marcan tu móvil, desviar
                el móvil no tiene cuota. Y si el fijo es el número que conoce
                todo el mundo, otra opción es{" "}
                <Link href="/desvio-de-llamadas#cual">
                  publicar el número de Alhabla como principal
                </Link>
                : no hay desvío, así que no hay cuota de desvío.
              </p>
              <p>
                <strong>El contestador del fijo se adelanta.</strong> El
                contestador de Movistar en el fijo se activa con{" "}
                <Codigo>*10#</Codigo> para cuando no contestas y con{" "}
                <Codigo>*9998</Codigo> para cuando comunicas. Si tienes alguno
                de los dos puesto, cogerá él las llamadas. Se quitan marcando{" "}
                <Codigo>#9998</Codigo> y después <Codigo>#10#</Codigo>.
              </p>
              <p>
                <strong>Cómo saber si ha quedado bien.</strong> En el fijo no
                hay código de consulta publicado, así que la prueba es{" "}
                <Link href="/desvio-de-llamadas#comprobar">
                  «Comprobar desvío»
                </Link>
                : Alhabla llama a tu fijo, no lo coges, y el panel te dice si la
                llamada ha vuelto a entrar por tu recepcionista.
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
