import Link from "next/link";
import { Phone } from "lucide-react";
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
  Texto,
} from "@/components/pagina-guia";
import { metadataDePagina } from "@/lib/seo";

/**
 * Desvío en MásMóvil (datos del 2026-10-20), con masmovil.es/ayuda-clientes.
 * Su ayuda del móvil solo trae el desvío de todas y remite a guías por modelo
 * de teléfono para el resto; la del fijo sí trae los condicionales y el
 * precio a móviles. Lo propio de MásMóvil: desde el fijo, desviar a un fijo
 * (el número de Alhabla) entra en lo ilimitado y a un móvil no.
 */

const ruta = "/desvio-de-llamadas/masmovil";
const titulo = "Desviar llamadas en MásMóvil a tu recepcionista de IA";
const descripcion =
  "Desvío del móvil y del fijo de MásMóvil a tu recepcionista de IA, y por qué desde el fijo a un fijo no gastas los minutos a móviles de tu tarifa.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

const faqs = [
  {
    question: "¿Puedo elegir cuántos segundos suena antes de desviar?",
    answer:
      "MásMóvil no lo publica ni para el móvil ni para el fijo. En el móvil puedes probar **61*número**20# y marcar *#61# para ver los segundos que ha guardado la red.",
  },
  {
    question: "¿Se puede poner desde el menú del teléfono?",
    answer:
      "Es lo que propone MásMóvil para el móvil. En un Samsung, por ejemplo, está como «Desviar si no respondes». En un iPhone el menú solo trae el desvío de todas, así que ahí toca el código.",
  },
  {
    question: "Doy el fijo y el móvil. ¿Desvío los dos?",
    answer:
      "Puedes desviar los dos al mismo número de Alhabla. Lo que pagues por cada llamada desviada depende de la tarifa de cada línea: la del móvil o la del fijo.",
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
          En el móvil, los códigos de siempre: <Codigo>**61*</Codigo>, el
          número de tu recepcionista y <Codigo>#</Codigo>. En el fijo,{" "}
          <Codigo>*61*número#</Codigo>, y llevarlo hasta el fijo de Alhabla no
          gasta tus minutos a móviles.
        </p>
      }
      descripcion={descripcion}
      ctaSecundario={{ texto: "Ir al fijo", href: "#fijo" }}
      ubicacion="desvio_masmovil"
      faqs={faqs}
      tituloFaqs="Preguntas sobre el desvío en MásMóvil"
      relacionadas={[
        {
          href: "/desvio-de-llamadas",
          titulo: "Todos los operadores",
          texto: "Desviar o dar el número de Alhabla, y cómo quitarlo.",
        },
        {
          href: "/desvio-de-llamadas/yoigo",
          titulo: "Desvío en Yoigo",
          texto: "Las mismas condiciones del fijo, del mismo grupo.",
        },
        {
          href: "/desvio-de-llamadas/iphone-y-android",
          titulo: "El menú de tu teléfono",
          texto: "Lo que MásMóvil remite a cada modelo, reunido.",
        },
      ]}
      cierre="Desde el fijo del local o desde el móvil: lo que no coges, lo coge ella."
    >
      <ConNumeroDeAlhabla>
        <Seccion
          id="movil"
          titulo="En tu móvil MásMóvil"
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
              titulo="Móvil MásMóvil"
              subtitulo="El de todas es el que publica MásMóvil; los otros tres son los códigos estándar."
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
                <strong>Qué pagas.</strong> MásMóvil dice que el desvío cuesta
                lo que marque tu tarifa. Si tus llamadas a fijos nacionales son
                ilimitadas, el tramo hasta Alhabla entra ahí; si tienes minutos
                contados, los gasta.
              </p>
            </Texto>
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Nota
              tipo="importante"
              titulo="Su ayuda solo trae el desvío de todas"
            >
              <p>
                Para el resto, MásMóvil remite al menú de cada modelo de
                teléfono. Los tres condicionales de la tabla son los mismos que
                publican Movistar, Vodafone u O2, pero MásMóvil no los recoge:
                si los usas, comprueba que han quedado bien. Si el código no
                entra,{" "}
                <Link
                  href="/desvio-de-llamadas/iphone-y-android"
                  className="font-semibold underline underline-offset-4"
                >
                  la ruta del menú en cada marca
                </Link>
                .
              </p>
            </Nota>
            <ComprobarDesvio>
              <p>
                Marca <Codigo>*#61#</Codigo>: si la pantalla enseña el número
                de Alhabla, la red lo ha guardado.
              </p>
            </ComprobarDesvio>
          </div>
        </Seccion>

        <Seccion
          id="fijo"
          fondo
          titulo="El fijo de MásMóvil, sin gastar minutos a móviles"
          entradilla={
            <p>
              Para el fijo, MásMóvil sí publica los tres desvíos: descuelgas,
              marcas el código con el número y cuelgas.
            </p>
          }
        >
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
            nota="MásMóvil no publica códigos de consulta para el fijo ni cómo cambiar los segundos: la prueba es «Comprobar desvío»."
          />
          <div className="mt-8">
            <Texto>
              <p>
                <strong>La cuenta de los minutos.</strong> Según la tarifa, las
                llamadas del fijo a móviles traen 60 o 30 minutos; pasados, cada
                minuto cuesta 0,20 € más 0,30 € de establecimiento. De fijo a
                fijo, sin límite. El tramo desviado es una llamada que sale de
                tu fijo, y el número de Alhabla es un fijo geográfico: entra en
                lo ilimitado. Desviar el fijo a tu móvil, como hace mucha gente,
                no.
              </p>
            </Texto>
          </div>
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
