import Link from "next/link";
import { Hash, Phone, Smartphone } from "lucide-react";
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
 * Desvío en MásMóvil (2026-10-20), con masmovil.es/ayuda-clientes. Su ayuda
 * del móvil solo trae el desvío de todas y remite a guías por modelo de
 * teléfono para el resto; la del fijo sí trae los condicionales y el precio
 * a móviles. Lo que hace única esta ficha es el cálculo de minutos: desde el
 * fijo, desviar a un fijo (el número de Alhabla) es ilimitado y a un móvil no.
 */

const ruta = "/desvio-de-llamadas/masmovil";
const titulo = "Desviar llamadas en MásMóvil a tu recepcionista de IA";
const descripcion =
  "Desvío del móvil y del fijo de MásMóvil a tu recepcionista de IA, y por qué desde el fijo a un fijo no gastas los minutos a móviles de tu tarifa.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

const faqs = [
  {
    question: "¿MásMóvil tiene desvío si no contesto en el móvil?",
    answer:
      "Su ayuda solo publica el código del desvío de todas (*21*número#) y, para los demás, remite a las guías de cada modelo de teléfono. Los condicionales del estándar (**61*, **67*, **62*) no los menciona: si los usas, compruébalo después.",
  },
  {
    question: "¿Cuánto cuesta desviar el móvil?",
    answer:
      "MásMóvil dice que cuesta lo que marque tu tarifa. Si tus llamadas a fijos nacionales son ilimitadas, el tramo hasta Alhabla entra ahí; si tienes minutos contados, los gasta.",
  },
  {
    question: "¿Y desviar el fijo a Alhabla?",
    answer:
      "Del fijo a otro fijo, como el de Alhabla, MásMóvil no pone límite. Lo que sí está limitado es del fijo a móviles: 60 o 30 minutos según la tarifa, y después 0,20 € el minuto más 0,30 € de establecimiento.",
  },
  {
    question: "¿Puedo elegir cuántos segundos suena antes de desviar?",
    answer:
      "MásMóvil no lo publica ni para el móvil ni para el fijo. La norma GSM admite **61*número**20#; si lo pruebas en el móvil, marca *#61# para ver los segundos que ha guardado la red.",
  },
  {
    question: "¿El fijo de MásMóvil tiene desvío cuando comunica?",
    answer:
      "Sí: *67*número# lo activa y #67# lo quita. Es útil si en el local se habla mucho por teléfono.",
  },
  {
    question: "¿Cómo quito el desvío del fijo?",
    answer:
      "Descuelga y marca #61# para el de no contestas, #67# para el de comunicas o #21# para el de todas. Cada código quita solo el suyo.",
  },
];

export default function DesvioMasMovilPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      migas={[
        { name: "Desvío de llamadas", path: "/desvio-de-llamadas" },
        { name: "MásMóvil", path: ruta },
      ]}
      etiqueta={{ icono: Phone, texto: "MásMóvil · móvil y fijo" }}
      titulo={titulo}
      entradilla={
        <p>
          En el fijo de MásMóvil, el desvío si no contestas es{" "}
          <Codigo>*61*número#</Codigo>, y llevarlo hasta el fijo de Alhabla no
          gasta tus minutos a móviles. En el móvil, MásMóvil solo publica el
          desvío de todas.
        </p>
      }
      descripcion={descripcion}
      ctaSecundario={{ texto: "Ir al fijo", href: "#fijo" }}
      ubicacion="desvio_masmovil"
      faqs={faqs}
      tituloFaqs="Preguntas sobre el desvío en MásMóvil"
      relacionadas={[
        {
          href: "/desvio-de-llamadas/yoigo",
          titulo: "Desvío en Yoigo",
          texto:
            "Las mismas condiciones del fijo, y un contestador que da la pista del móvil.",
        },
        {
          href: "/desvio-de-llamadas/iphone-y-android",
          titulo: "El menú de desvío de tu teléfono",
          texto: "Lo que MásMóvil remite a cada modelo, reunido.",
        },
        {
          href: "/desvio-de-llamadas",
          titulo: "Desvío por operador",
          texto: "Qué desvío conviene y cómo comprobarlo.",
        },
        {
          href: "/herramientas/calculadora-de-llamadas-perdidas",
          titulo: "Calculadora de llamadas perdidas",
          texto: "Cuánto se va cada mes por las llamadas que no coges.",
        },
      ]}
      cierre="Del fijo al fijo de tu recepcionista, sin gastar minutos."
    >
      <ConNumeroDeAlhabla>
        <Seccion
          id="fijo"
          titulo="El fijo de MásMóvil"
          entradilla={
            <p>
              Para el fijo, MásMóvil sí publica los tres desvíos: descuelgas,
              marcas el código con el número y cuelgas.
            </p>
          }
        >
          <div className="grid gap-6">
            <CampoNumeroDeAlhabla />
            <TablaDeCodigos
              titulo="Fijo MásMóvil"
              filas={[
                {
                  tipo: "Si no contestas",
                  recomendado: true,
                  activar: "*61*{N}#",
                  quitar: "#61#",
                },
                {
                  tipo: "Si comunicas",
                  recomendado: true,
                  activar: "*67*{N}#",
                  quitar: "#67#",
                },
                { tipo: "Todas", activar: "*21*{N}#", quitar: "#21#" },
              ]}
              nota="MásMóvil no publica códigos de consulta para el fijo ni cómo cambiar los segundos."
            />
          </div>
          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <Texto>
              <p>
                <strong>La cuenta de los minutos.</strong> La ayuda del fijo
                dice que las llamadas a móviles, según la tarifa, «solo incluye
                60 o 30 minutos»; pasados, cada minuto cuesta 0,20 € más 0,30 €
                de establecimiento. De fijo a fijo, sin límite. Cuando desvías,
                el tramo desviado es una llamada que sale de tu fijo: si va a un
                móvil, cuenta para esos 60 o 30 minutos; si va a un fijo, no.
              </p>
              <p>
                El número de Alhabla es un fijo geográfico. Así que desviar el
                fijo del local a tu recepcionista entra en lo ilimitado, y
                desviarlo a tu móvil, como hace mucha gente, no.
              </p>
            </Texto>
            <Nota tipo="consejo" titulo="Ejemplo para hacerte una idea">
              Treinta llamadas desviadas al mes de tres minutos cada una son 90
              minutos. Hacia un móvil, eso ya pasa de los 60 que trae la tarifa.
              Hacia el fijo de Alhabla, esos 90 minutos no cuentan. Ejemplo
              ilustrativo: tus cifras serán otras.
            </Nota>
          </div>
        </Seccion>

        <Seccion
          id="movil"
          fondo
          titulo="El móvil MásMóvil: dos caminos"
          entradilla={
            <p>
              La ayuda de MásMóvil para el móvil explica{" "}
              <Codigo>*21*número#</Codigo> (todas las llamadas) y{" "}
              <Codigo>#21#</Codigo> para quitarlo, dice que cuesta según tu
              tarifa y, para los demás desvíos, enlaza a guías por modelo de
              teléfono.
            </p>
          }
        >
          <Tarjetas
            columnas={2}
            items={[
              {
                icono: Smartphone,
                titulo: "El menú de tu teléfono",
                texto: (
                  <>
                    Es lo que propone MásMóvil. En un Samsung, por ejemplo, está
                    como «Desviar si no respondes». En un iPhone el menú solo
                    trae el desvío de todas, así que ahí toca el código.{" "}
                    <Link
                      href="/desvio-de-llamadas/iphone-y-android"
                      className="font-semibold text-morado-tinta underline underline-offset-4"
                    >
                      Ruta en cada marca
                    </Link>
                  </>
                ),
              },
              {
                icono: Hash,
                titulo: "Los códigos de la norma",
                texto:
                  "Los mismos que publican Movistar, Vodafone u O2 para sus móviles. MásMóvil no los recoge en su ayuda, así que, si los usas, comprueba que han quedado bien.",
              },
            ]}
          />
          <div className="mt-8">
            <TablaDeCodigos
              titulo="Móvil MásMóvil"
              subtitulo="El de todas es el que publica MásMóvil; los condicionales son los de la norma GSM."
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
                {
                  tipo: "Todas (publicado)",
                  activar: "*21*{N}#",
                  quitar: "#21#",
                },
              ]}
            />
          </div>
          <div className="mt-8">
            <Texto>
              <p>
                Después de activarlos, marca <Codigo>*#61#</Codigo>: si la
                pantalla enseña el número de Alhabla, la red lo ha guardado. Y
                para saber si una llamada de verdad llega a tu recepcionista,
                usa{" "}
                <Link href="/desvio-de-llamadas#comprobar">
                  «Comprobar desvío»
                </Link>{" "}
                desde el panel.
              </p>
            </Texto>
          </div>
        </Seccion>

        <Seccion id="cual" titulo="¿Fijo o móvil? Depende del número que das">
          <Texto>
            <p>
              Desvía la línea a la que te llaman tus clientes. Si es el fijo del
              local, el cálculo de arriba juega a tu favor. Si tu número de cara
              al público es el móvil, desvía el móvil: lo que pagues por cada
              llamada desviada dependerá de tu tarifa móvil, no de la del fijo.
            </p>
            <p>
              Si das los dos, puedes desviar los dos al mismo número de Alhabla.
              Y si prefieres que la recepcionista conteste siempre primero, la
              alternativa es publicar su número como principal; lo explicamos en{" "}
              <Link href="/desvio-de-llamadas#cual">
                cuál poner con una recepcionista de IA
              </Link>
              .
            </p>
          </Texto>
        </Seccion>

        <Fuentes
          consultadas="2026-10-20"
          fuentes={[
            {
              nombre: "MásMóvil: cómo activo el desvío de llamadas",
              url: "https://www.masmovil.es/ayuda-clientes/como-activo-el-desvio-de-llamadas",
            },
            {
              nombre: "MásMóvil: desviar llamadas desde el número fijo",
              url: "https://www.masmovil.es/ayuda-clientes/como-desviar-llamadas-desde-numero-fijo",
            },
          ]}
        />
      </ConNumeroDeAlhabla>
    </PaginaGuia>
  );
}
