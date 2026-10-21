import type { ReactNode } from "react";
import Link from "next/link";
import {
  CircleAlert,
  PhoneCall,
  PhoneForwarded,
  PhoneMissed,
  PhoneOff,
  Signal,
  Timer,
  Voicemail,
} from "lucide-react";
import { Codigo } from "@/components/desvio/codigo";
import {
  CampoNumeroDeAlhabla,
  ConNumeroDeAlhabla,
  TablaDeCodigos,
} from "@/components/desvio/codigos-de-desvio";
import {
  Fuentes,
  IndiceDePaginas,
  ListaCheck,
  Nota,
  PaginaGuia,
  Seccion,
  Tabla,
  Tarjetas,
  Texto,
} from "@/components/pagina-guia";
import { paginasBajo } from "@/lib/paginas";
import { metadataDePagina } from "@/lib/seo";

/**
 * Índice y página pilar del desvío de llamadas (2026-10-20). Todo dato de
 * operador sale de su ayuda oficial o de la norma 3GPP, consultadas ese día;
 * las fichas de cada operador cuelgan de aquí (lib/paginas.ts, sección
 * «desvio»). Lo que es común a todas (qué desvío poner, quitarlo sin perder
 * el buzón, «Comprobar desvío») vive solo en esta página y las hijas lo
 * enlazan, para que no se repita texto entre ellas.
 */

const ruta = "/desvio-de-llamadas";
const titulo = "Desvío de llamadas a tu recepcionista de IA, por operador";
const descripcion =
  "Qué desvío poner para que tu recepcionista de IA coja lo que tú no coges, los códigos GSM y lo que cambia en Movistar, Vodafone, Orange, Digi y el resto.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

const op = (slug: string) => `${ruta}/${slug}`;

const faqs = [
  {
    question:
      "¿Qué desvío pongo para que la recepcionista solo coja lo que no cojo yo?",
    answer:
      "El de «si no contesta» (código 61), acompañado del de «si comunica» (67) y el de «apagado o sin cobertura» (62). Así tu teléfono sigue sonando como siempre y solo las llamadas que se te escapan pasan a Alhabla. El de todas (21) déjalo fuera.",
  },
  {
    question: "¿Tengo que cambiar de número o avisar a mis clientes?",
    answer:
      "No. El desvío se activa dentro de tu línea: tus clientes marcan el número de siempre y no notan nada. Lo único que cambia es a dónde va la llamada cuando tú no la coges.",
  },
  {
    question: "¿Cómo sé que el desvío funciona de verdad?",
    answer:
      "Con «Comprobar desvío», en Ajustes › Teléfono de tu panel: Alhabla hace una llamada real a la línea de tu negocio y, si no la coges, mira si el desvío la devuelve a tu recepcionista. Si falla, te dice el motivo: la has cogido, la línea comunicaba o no ha saltado el desvío. No gasta minutos de tu plan y puedes repetirla hasta tres veces por hora.",
  },
  {
    question: "¿Cuánto me cobra el operador por desviar?",
    answer:
      "Activarlo suele ser gratis, pero cada llamada desviada es una llamada que sale de tu línea hacia el número de Alhabla, y se cobra según tu tarifa. Hay excepciones que conviene conocer: el fijo de Movistar cobra 4 € al mes por cada tipo de desvío, y el de Vodafone 0,182 € por llamada desviada más 0,242 € el minuto, IVA incluido.",
  },
  {
    question: "¿Cuántos segundos suena antes de que salte?",
    answer:
      "La norma GSM admite de 5 a 30 segundos, de 5 en 5, añadidos al código con doble asterisco. Lo publican Orange, Simyo, Telecable, Euskaltel y Jazztel; Movistar, Vodafone, O2, Digi, MásMóvil y Lowi no dicen cómo cambiarlo. Marca *#61# y verás el número y los segundos que tienes.",
  },
  {
    question: "¿Puedo activar los tres desvíos con un solo código?",
    answer:
      "La norma tiene uno, **004*número#, que activa a la vez el de no contesta, el de comunica y el de apagado. Ningún operador español lo publica en su ayuda, así que si lo usas, compruébalo después con *#61#, *#67# y *#62#.",
  },
  {
    question: "¿Se desvían también los SMS?",
    answer:
      "No. El desvío solo afecta a las llamadas; Orange y Digi lo dicen expresamente en su ayuda. Los mensajes siguen llegando a tu móvil.",
  },
  {
    question: "¿Y si mi operador no aparece en la lista?",
    answer:
      "Prueba los códigos estándar de esta página, que son los de la norma GSM, y mira si tu área de cliente tiene un apartado de desvíos. Después, «Comprobar desvío» te dice si la llamada llega de verdad a tu recepcionista.",
  },
];

const resumen: {
  operador: ReactNode;
  movil: ReactNode;
  fijo: ReactNode;
  segundos: string;
  ojo: string;
}[] = [
  {
    operador: <Link href={op("movistar")}>Movistar</Link>,
    movil: <Codigo>**61*número#</Codigo>,
    fijo: (
      <>
        <Codigo>*61*número#</Codigo>, contratado antes
      </>
    ),
    segundos: "No publica el código; un artículo de su blog habla de 15 s",
    ojo: "En el fijo, 4 €/mes por cada tipo de desvío. Con MultiSIM solo se puede desviar todo.",
  },
  {
    operador: <Link href={op("vodafone")}>Vodafone</Link>,
    movil: <Codigo>**61*número#</Codigo>,
    fijo: (
      <>
        <Codigo>*61*número</Codigo> y tecla de llamada, sin <Codigo>#</Codigo>
      </>
    ),
    segundos: "No lo publica",
    ojo: "El fijo solo desvía a fijos y móviles de Vodafone o a móviles de otros: un fijo de otro operador, como el de Alhabla, no está en su lista.",
  },
  {
    operador: <Link href={op("orange")}>Orange y Amena</Link>,
    movil: <Codigo>**61*número**segundos#</Codigo>,
    fijo: (
      <>
        <Codigo>*23número</Codigo> (cobertura directa) o{" "}
        <Codigo>*61*número#</Codigo> (indirecta)
      </>
    ),
    segundos: "De 5 a 20 (particulares); de 5 a 30 (empresas)",
    ojo: "Amena ya se gestiona desde Mi Orange.",
  },
  {
    operador: <Link href={op("yoigo")}>Yoigo</Link>,
    movil: (
      <>
        Solo publica el de todas (<Codigo>*21*número#</Codigo>); usa los
        condicionales para su contestador
      </>
    ),
    fijo: <Codigo>*61*número#</Codigo>,
    segundos: "Solo para su contestador (30 s)",
    ojo: "Del fijo a otro fijo, ilimitado.",
  },
  {
    operador: <Link href={op("masmovil")}>MásMóvil</Link>,
    movil: (
      <>
        Solo publica el de todas (<Codigo>*21*número#</Codigo>)
      </>
    ),
    fijo: <Codigo>*61*número#</Codigo>,
    segundos: "No lo publica",
    ojo: "Del fijo a otro fijo, ilimitado; a móviles, 60 o 30 minutos según tarifa.",
  },
  {
    operador: <Link href={op("o2")}>O2</Link>,
    movil: <Codigo>**61*número#</Codigo>,
    fijo: <Codigo>*61*número#</Codigo>,
    segundos: "No lo publica",
    ojo: "Con VoLTE los códigos pueden fallar; con MultiSIM solo se desvía todo.",
  },
  {
    operador: <Link href={op("jazztel")}>Jazztel</Link>,
    movil: <Codigo>**61*número#</Codigo>,
    fijo: (
      <>
        <Codigo>*61</Codigo>, el número y <Codigo>#</Codigo>
      </>
    ),
    segundos: "De 5 a 30, con una sintaxis que no es la estándar",
    ojo: "Su tabla del móvil omite algunas almohadillas finales.",
  },
  {
    operador: <Link href={op("digi")}>Digi</Link>,
    movil: <Codigo>**61*número#</Codigo>,
    fijo: <Codigo>*61*número#</Codigo>,
    segundos: "No lo publica",
    ojo: "Incompatible con la itinerancia. El fijo no tiene desvío «si comunica».",
  },
  {
    operador: <Link href={op("pepephone")}>Pepephone</Link>,
    movil: "Sin códigos: Mi Pepephone › Ajustes de la línea",
    fijo: "No documentado",
    segundos: "Solo para su buzón (30 s)",
    ojo: "Eliges «otro número» para cada situación.",
  },
  {
    operador: <Link href={op("lowi")}>Lowi</Link>,
    movil: <Codigo>**61*número#</Codigo>,
    fijo: "Sin ayuda publicada",
    segundos: "Los menciona sin dar la sintaxis",
    ojo: "Dos páginas de su ayuda dicen cosas distintas sobre el coste.",
  },
  {
    operador: <Link href={op("simyo")}>Simyo</Link>,
    movil: <Codigo>**61*número**segundos#</Codigo>,
    fijo: "No tiene voz fija",
    segundos: "De 5 a 30",
    ojo: "Su lista no incluye el desvío si comunica (67).",
  },
  {
    operador: "Finetwork",
    movil: "Sin códigos: app o área de cliente › ajustes de llamadas",
    fijo: "«TU FIJO» desvía al móvil asociado del titular; a otro número, no documentado",
    segundos: "No lo publica",
    ojo: "El desvío gasta minutos de tu tarifa; sin minutos, se cobra como llamada nacional.",
  },
  {
    operador: <Link href={op("euskaltel")}>Euskaltel</Link>,
    movil: <Codigo>**61*número**segundos#</Codigo>,
    fijo: <Codigo>*61*número#</Codigo>,
    segundos: "De 5 a 30",
    ojo: "Su web muestra los códigos del móvil sin asteriscos. Fijo sin cuota mensual por desviar.",
  },
  {
    operador: <Link href={op("r-galicia")}>R (Galicia)</Link>,
    movil: <Codigo>**61*número#</Codigo>,
    fijo: <Codigo>*61*número#</Codigo>,
    segundos: "No lo publica",
    ojo: "También se configura desde la app de R, para el móvil y para el fijo.",
  },
  {
    operador: <Link href={op("telecable")}>Telecable</Link>,
    movil: <Codigo>**61*número**segundos#</Codigo>,
    fijo: <Codigo>*61*número#</Codigo>,
    segundos: "De 5 a 30",
    ojo: "La línea fija trae 4.000 minutos a otros fijos.",
  },
  {
    operador: "Avatel",
    movil: (
      <>
        <Codigo>*61*número#</Codigo>, con un solo asterisco
      </>
    ),
    fijo: "No publicado",
    segundos: "No lo publica",
    ojo: "Se configura también desde la app Avatel Móvil.",
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
        <>
          <p>
            Para que tu recepcionista de IA coja las llamadas que tú no puedes,
            no hace falta cambiar de número: basta con un desvío condicional en
            tu móvil o en tu fijo. En el móvil se marca <Codigo>**61*</Codigo>,
            el número de Alhabla y <Codigo>#</Codigo>.
          </p>
          <p>
            Aquí tienes qué desvío conviene, los códigos estándar, lo que cambia
            en cada operador según su ayuda oficial y cómo comprobar con una
            llamada real que el desvío funciona.
          </p>
        </>
      }
      descripcion={descripcion}
      ctaSecundario={{ texto: "Ver los códigos", href: "#codigos" }}
      ubicacion="desvio_indice"
      tipo="CollectionPage"
      faqs={faqs}
      tituloFaqs="Dudas habituales sobre el desvío"
      relacionadas={[
        {
          href: "/blog/desvio-de-llamadas-si-no-contesta",
          titulo: "Desvío de llamadas si no contesta: códigos por operador",
          texto: "El artículo del blog con la tabla del 61 en móvil y fijo.",
        },
        {
          href: "/blog/desviar-llamadas-sin-cambiar-de-numero",
          titulo: "Desviar llamadas sin cambiar de número",
          texto:
            "Qué pasa con una llamada desde que no la coges hasta que queda reservada.",
        },
        {
          href: op("iphone-y-android"),
          titulo: "El desvío en iPhone y Android",
          texto:
            "Dónde está el menú en cada marca y el ajuste del iPhone que conviene revisar.",
        },
        {
          href: "/herramientas/mensajes-de-contestador",
          titulo: "Mensajes de contestador",
          texto:
            "Si de momento prefieres un contestador, textos listos por sector.",
        },
        {
          href: "/glosario",
          titulo: "Glosario",
          texto: "Desvío condicional, VoLTE, MultiSIM y otros términos.",
        },
      ]}
      cierre="Tu número de siempre, y ninguna llamada sin contestar."
    >
      <ConNumeroDeAlhabla>
        <Seccion
          id="tipos"
          titulo="Los cuatro desvíos que tiene cualquier línea"
          entradilla={
            <p>
              Todos los operadores españoles usan los mismos cuatro tipos,
              porque vienen de la norma GSM (3GPP TS 22.082). Cambia el nombre
              que les pone cada uno, no lo que hacen.
            </p>
          }
        >
          <Tarjetas
            columnas={2}
            items={[
              {
                icono: PhoneMissed,
                antetitulo: "Código 61",
                titulo: "Si no contesta",
                texto:
                  "Tu teléfono suena durante unos segundos y, si nadie lo coge, la llamada salta al número de destino. Es el que encaja con una recepcionista de IA.",
              },
              {
                icono: PhoneCall,
                antetitulo: "Código 67",
                titulo: "Si comunica o la rechazas",
                texto:
                  "Salta cuando ya estás hablando con otra persona o cuando cuelgas una llamada entrante. Ojo: con la llamada en espera activada no «comunicas»; entonces se aplica el de no contesta.",
              },
              {
                icono: PhoneOff,
                antetitulo: "Código 62",
                titulo: "Apagado o sin cobertura",
                texto:
                  "Para cuando el móvil está apagado, sin batería o en un sótano sin señal. En los fijos casi ningún operador lo ofrece; Vodafone es la excepción.",
              },
              {
                icono: PhoneForwarded,
                antetitulo: "Código 21",
                titulo: "Todas las llamadas",
                texto:
                  "Tu teléfono deja de sonar y cada llamada va directa al destino. Es el único que ofrece el menú de Ajustes del iPhone.",
              },
            ]}
          />
        </Seccion>

        <Seccion
          id="cual"
          fondo
          titulo="Cuál poner con una recepcionista de IA"
          entradilla={
            <p>
              Los tres condicionales a la vez, con el número de Alhabla como
              destino. Así sigues cogiendo las llamadas que puedes, y las demás
              no acaban en el buzón.
            </p>
          }
        >
          <div className="grid gap-8">
            <Texto>
              <p>
                El de <strong>no contesta</strong> cubre lo que pasa en un salón
                o en una clínica: estás con las manos ocupadas, el teléfono
                suena y no llegas. El de <strong>comunica</strong> recoge al
                cliente que llama mientras atiendes a otro, y el de{" "}
                <strong>apagado</strong>, las horas en que el móvil se queda sin
                batería o sin señal.
              </p>
              <p>
                Muchas líneas móviles traen esos tres desvíos apuntando al buzón
                de voz desde fábrica. Si solo cambias el 61, el buzón se sigue
                quedando las llamadas cuando comunicas o estás sin cobertura.
                Por eso conviene activar los tres con el mismo número.
              </p>
              <p>
                El de <strong>todas</strong> no lo pongas, salvo que quieras que
                Alhabla conteste siempre. Y en ese caso hay una opción mejor que
                desviar: publicar el número de Alhabla como principal.
              </p>
            </Texto>
            <Tabla
              cabecera={[
                "",
                "Desvío condicional",
                "Alhabla como número principal",
              ]}
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
          </div>
          <div className="mt-8">
            <Nota
              tipo="importante"
              titulo="El móvil al que te pasan llamadas no puede desviar"
            >
              Si la recepcionista te pasa una llamada al móvil y ese móvil tiene
              un desvío hacia Alhabla, la llamada vuelve a ella. Si usas Alhabla
              como número principal, deja sin desvíos el móvil que pones en
              «Cuándo pasarme llamadas».
            </Nota>
          </div>
        </Seccion>

        <Seccion
          id="codigos"
          titulo="Los códigos GSM estándar"
          entradilla={
            <p>
              Son los de la norma 3GPP TS 22.030 y los que publican la mayoría
              de operadores para el móvil. Se marcan en el teclado de la app
              Teléfono, como una llamada, desde la línea que quieres desviar.
            </p>
          }
        >
          <div className="grid gap-6">
            <CampoNumeroDeAlhabla />
            <TablaDeCodigos
              titulo="Móvil: los cuatro desvíos y los dos de conjunto"
              subtitulo="En un fijo cambian: mira la ficha de tu operador."
              filas={[
                {
                  tipo: "Si no contesta",
                  recomendado: true,
                  activar: "**61*{N}#",
                  quitar: "##61#",
                  consultar: "*#61#",
                  detalle:
                    "La consulta devuelve el número de destino y los segundos de espera.",
                },
                {
                  tipo: "Si no contesta, eligiendo los segundos",
                  activar: "**61*{N}**{T}#",
                  quitar: "##61#",
                  consultar: "*#61#",
                  segundos: { opciones: [5, 10, 15, 20, 25, 30], inicial: 20 },
                  detalle:
                    "La norma admite de 5 a 30, de 5 en 5. No todos los operadores lo aceptan.",
                },
                {
                  tipo: "Si comunica o rechazas",
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
                  tipo: "Todas las llamadas",
                  activar: "**21*{N}#",
                  quitar: "##21#",
                  consultar: "*#21#",
                },
                {
                  tipo: "Los tres condicionales a la vez (004)",
                  activar: "**004*{N}#",
                  quitar: "##004#",
                  detalle:
                    "Está en la norma, pero ningún operador español lo publica: pruébalo y compruébalo.",
                },
                {
                  tipo: "Todos los desvíos (002)",
                  quitar: "##002#",
                  detalle:
                    "Borra también los desvíos al buzón de voz. Para quitar solo el de Alhabla, mejor ##61#.",
                },
              ]}
              nota="Fuentes: 3GPP TS 22.030 (anexo B) y TS 22.082 V19.0.0, § 3."
            />
          </div>
          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <Texto>
              <p>
                <strong>Por qué los segundos llevan doble asterisco.</strong>{" "}
                Cada código tiene la forma{" "}
                <Codigo>*código*número*servicio*segundos#</Codigo>. El hueco del
                medio es el grupo de servicio (voz, datos…), que casi nunca se
                rellena; al dejarlo vacío quedan dos asteriscos seguidos:{" "}
                <Codigo>**61*número**20#</Codigo>. Si no pones segundos, la red
                mantiene los últimos que se configuraron o los que tenga tu
                operador por defecto.
              </p>
            </Texto>
            <Texto>
              <p>
                <strong>Cómo escribir el número.</strong> Los operadores ponen
                sus ejemplos con las 9 cifras seguidas, sin espacios ni guiones.
                La norma considera muy deseable el formato internacional (+34…),
                pero ningún operador español lo documenta para el desvío; con
                las 9 cifras vas por el camino que ellos enseñan.
              </p>
            </Texto>
          </div>
        </Seccion>

        <Seccion
          id="comprobar"
          fondo
          titulo="Comprueba que el desvío funciona"
          entradilla={
            <p>
              Dos pasos: primero preguntas a la red y luego Alhabla hace una
              llamada real a tu línea para ver si el desvío salta.
            </p>
          }
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="panel p-6">
              <h3 className="text-lg font-bold text-tinta">
                1. Pregunta a la red
              </h3>
              <div className="mt-2 text-sm leading-6 text-muted">
                <p>
                  Marca <Codigo>*#61#</Codigo> y pulsa llamar. La pantalla
                  muestra si el desvío si no contesta está activo, a qué número
                  va y con cuántos segundos. Lo mismo con <Codigo>*#67#</Codigo>{" "}
                  y <Codigo>*#62#</Codigo>. Si sale otro número (el del buzón),
                  el tuyo no se guardó.
                </p>
              </div>
            </div>
            <div className="panel p-6">
              <h3 className="text-lg font-bold text-tinta">
                2. «Comprobar desvío» en tu panel
              </h3>
              <div className="mt-2 text-sm leading-6 text-muted">
                <p>
                  En <strong>Ajustes › Teléfono</strong>, pulsa «Comprobar
                  desvío». Alhabla llama de verdad a la línea de tu negocio
                  desde tu número de Alhabla. No la cojas: si el desvío
                  funciona, esa llamada vuelve a entrar por Alhabla y el panel
                  dice «Desvío funcionando». Si no, te dice el motivo: la has
                  cogido tú (o un contestador), la línea comunicaba o no ha
                  saltado el desvío.
                </p>
              </div>
            </div>
          </div>
          <div className="mt-6">
            <ListaCheck
              items={[
                "No gasta minutos de tu plan de Alhabla.",
                "Hasta 3 comprobaciones por hora: cada una es una llamada real.",
                "Funciona con fijos y móviles españoles.",
                "Si a las 24 horas de tener tu número aún no lo has comprobado y no te ha entrado ninguna llamada, Alhabla te lo recuerda por WhatsApp o por correo.",
                "Es la prueba que vale para los casos dudosos de esta guía: el fijo de Vodafone, los códigos que un operador no publica o un iPhone con VoLTE.",
              ]}
            />
          </div>
        </Seccion>

        <Seccion
          id="operadores"
          titulo="El desvío si no contesta en cada operador"
          entradilla={
            <p>
              Lo que publica cada uno en su ayuda, en octubre de 2026. En la
              ficha de tu operador tienes el resto de códigos, el coste y cómo
              no perder el buzón.
            </p>
          }
        >
          <Tabla
            cabecera={[
              "Operador",
              "Móvil",
              "Fijo",
              "Segundos",
              "A tener en cuenta",
            ]}
            filas={resumen.map((f) => [
              f.operador,
              f.movil,
              f.fijo,
              f.segundos,
              f.ojo,
            ])}
            nota="Finetwork y Avatel no tienen ficha propia: su ayuda publica muy poco del desvío y todo está en esta fila."
          />
        </Seccion>

        <Seccion
          id="diferencias"
          fondo
          titulo="Lo que de verdad cambia entre operadores"
          entradilla={
            <p>
              El código del móvil es casi siempre el mismo. Lo que cambia es el
              fijo, el precio, los segundos y lo que pasa con tu buzón.
            </p>
          }
        >
          <Tarjetas
            items={[
              {
                icono: CircleAlert,
                titulo: "El fijo de Vodafone no desvía a cualquiera",
                texto:
                  "Solo a fijos y móviles de Vodafone o a móviles de otros operadores. El número de Alhabla es un fijo de otro operador, así que queda fuera de lo que Vodafone dice admitir.",
              },
              {
                icono: CircleAlert,
                titulo: "El fijo de Movistar hay que contratarlo",
                texto:
                  "4 € al mes por cada tipo de desvío. El «Pack de servicios básicos» solo trae el inmediato, que no es el que necesitas.",
              },
              {
                icono: Signal,
                titulo: "Orange tiene dos juegos de códigos en el fijo",
                texto:
                  "Uno para cobertura directa (*23 y el número) y otro para indirecta (*61*número#). Si tu teléfono va a un microfiltro en la roseta, es indirecta.",
              },
              {
                icono: Timer,
                titulo: "No todos dejan elegir los segundos",
                texto:
                  "Orange (5 a 20 en particulares, 5 a 30 en empresas), Simyo, Telecable, Euskaltel y Jazztel publican cómo. Yoigo y Pepephone solo para su contestador.",
              },
              {
                icono: PhoneForwarded,
                titulo: "Del fijo a un fijo suele salir más barato",
                texto:
                  "Yoigo y MásMóvil no cobran del fijo a otro fijo, Euskaltel y Telecable incluyen 4.000 minutos a fijos y O2 dice que desviar el fijo es gratis. A un móvil, en cambio, gastas minutos.",
              },
              {
                icono: Voicemail,
                titulo: "Cada uno guarda el buzón a su manera",
                texto:
                  "Movistar lo tiene en el 22500, Vodafone en *147#, Yoigo en el 633 y Euskaltel en el 2242. Antes de desviar, apunta cómo volver a él.",
              },
            ]}
          />
          <div className="mt-8">
            <Texto>
              <p>
                Más diferencias que salen en las fichas: con{" "}
                <strong>MultiSIM</strong> (Movistar y O2) solo se puede desviar
                todo; en <strong>Digi</strong> el desvío es incompatible con la
                itinerancia y su fijo no tiene «si comunica»;{" "}
                <strong>Pepephone</strong> y <strong>Finetwork</strong> no usan
                códigos, sino su área de cliente; <strong>Simyo</strong> no
                tiene fijo; y las webs de <strong>Euskaltel</strong> y{" "}
                <strong>R</strong> enseñan los códigos con asteriscos de menos.
                En el móvil, el teléfono también cuenta: mira{" "}
                <Link href={op("iphone-y-android")}>
                  el desvío en iPhone y Android
                </Link>
                .
              </p>
            </Texto>
          </div>
        </Seccion>

        <Seccion
          id="quitar"
          titulo="Quitar el desvío sin perder el buzón de voz"
          entradilla={
            <p>
              Para dejar de desviar a Alhabla, marca <Codigo>##61#</Codigo> (y{" "}
              <Codigo>##67#</Codigo> o <Codigo>##62#</Codigo> si los pusiste).
              No uses <Codigo>##002#</Codigo>.
            </p>
          }
        >
          <div className="grid gap-8">
            <Texto>
              <p>
                <Codigo>##002#</Codigo> borra todos los desvíos de la línea de
                una vez, también los que mandan al buzón las llamadas en las
                situaciones que tú no tocaste. Movistar, Orange y Digi lo avisan
                en su ayuda. Quitar uno a uno solo deshace lo tuyo.
              </p>
              <p>
                Quitar el 61 no devuelve el buzón por sí solo: el desvío que
                tenías al buzón es el mismo hueco que ocupó Alhabla. Si quieres
                que vuelva a coger el buzón, actívalo otra vez con el método de
                tu operador.
              </p>
            </Texto>
            <Tabla
              cabecera={["Operador", "Cómo vuelves al buzón"]}
              filas={[
                [
                  <Link key="m" href={op("movistar")}>
                    Movistar
                  </Link>,
                  "Llamando al 22500 o desde tu área privada",
                ],
                [
                  <Link key="v" href={op("vodafone")}>
                    Vodafone
                  </Link>,
                  <Codigo key="c">*147#</Codigo>,
                ],
                [
                  <Link key="o" href={op("orange")}>
                    Orange
                  </Link>,
                  "Mi Orange › Productos › Llamadas nacionales",
                ],
                [
                  <Link key="y" href={op("yoigo")}>
                    Yoigo
                  </Link>,
                  <Codigo key="c">**61*633#</Codigo>,
                ],
                [
                  <Link key="d" href={op("digi")}>
                    Digi
                  </Link>,
                  "Mi DIGI › Servicios, o llamando al 1200",
                ],
                [
                  <Link key="e" href={op("euskaltel")}>
                    Euskaltel
                  </Link>,
                  <Codigo key="c">**61*2242#</Codigo>,
                ],
                [
                  <Link key="p" href={op("pepephone")}>
                    Pepephone
                  </Link>,
                  "Mi Pepephone › Ajustes de la línea › buzón",
                ],
                [
                  <Link key="l" href={op("lowi")}>
                    Lowi
                  </Link>,
                  "Desde Mi Lowi",
                ],
              ]}
            />
          </div>
        </Seccion>

        <Seccion
          id="por-operador"
          fondo
          titulo="Guías por operador"
          entradilla={
            <p>
              Cada ficha trae los códigos de móvil y fijo de ese operador, su
              coste, su buzón y sus trampas, con el enlace a su ayuda. Si
              quieres el detalle del 61 en móvil y fijo, también está el
              artículo{" "}
              <Link
                className="font-semibold text-morado-tinta underline underline-offset-4"
                href="/blog/desvio-de-llamadas-si-no-contesta"
              >
                desvío de llamadas si no contesta
              </Link>
              ; y para entender qué pasa con la llamada después,{" "}
              <Link
                className="font-semibold text-morado-tinta underline underline-offset-4"
                href="/blog/desviar-llamadas-sin-cambiar-de-numero"
              >
                desviar llamadas sin cambiar de número
              </Link>
              .
            </p>
          }
        >
          <IndiceDePaginas paginas={paginasBajo(ruta)} />
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
