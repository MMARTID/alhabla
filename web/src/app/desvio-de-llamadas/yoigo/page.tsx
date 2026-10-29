import { Voicemail } from "lucide-react";
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
 * Desvío en Yoigo (datos del 2026-10-20), con yoigo.com/ayuda. Yoigo solo
 * publica el desvío de todas para el móvil; los condicionales salen
 * únicamente en la guía de su contestador (633) y del aviso de llamadas
 * perdidas (556). Que el estándar `**61*número#` funcione hacia Alhabla es una
 * deducción razonable a partir de eso, y la página la marca como tal.
 */

const ruta = "/desvio-de-llamadas/yoigo";
const titulo = "Desviar llamadas en Yoigo a tu recepcionista de IA";
const descripcion =
  "Lo que Yoigo publica del desvío en móvil y fijo, por qué su contestador 633 te da la pista del código y qué pasa con el aviso de llamadas del 556.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

const faqs = [
  {
    question: "¿Y el 556?",
    answer:
      "Es el aviso de llamadas perdidas. Cuando quitas el contestador, Yoigo propone dejar los condicionales apuntando al 556 (*61*556#, *67*556#, *62*556#, con un solo asterisco al principio) para recibir el aviso. Si pones Alhabla, sustituye a ese aviso.",
  },
  {
    question: "¿Puedo elegir cuántos segundos suena antes de desviar?",
    answer:
      "Para su contestador sí: **61*633**30# hace que salte a los 30 segundos. Para otro número no lo publica. Puedes probar **61*número**20# y mirar con *#61# si la red lo ha guardado. En el fijo, Yoigo dice que no se pueden alargar los tonos del contestador.",
  },
  {
    question: "¿Cómo vuelvo a mi contestador si quito el desvío?",
    answer:
      "Yoigo quita el contestador con #002# y pide desactivar todos los desvíos antes de activarlo. Quita los tuyos y vuelve a marcar **61*633#, **67*633# y **62*633#.",
  },
];

export default function DesvioYoigoPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      migas={[
        { name: "Desvío de llamadas", path: "/desvio-de-llamadas" },
        { name: "Yoigo", path: ruta },
      ]}
      etiqueta={{ icono: Voicemail, texto: "Yoigo · móvil y fijo" }}
      titulo={titulo}
      entradilla={
        <p>
          Para el móvil, Yoigo solo publica el desvío de todas. Los
          condicionales, los que interesan para una recepcionista, los usa en
          la guía de su contestador con el 633: con el número de Alhabla
          deberían valer igual.
        </p>
      }
      descripcion={descripcion}
      ctaSecundario={{ texto: "Ir al fijo", href: "#fijo" }}
      ubicacion="desvio_yoigo"
      faqs={faqs}
      tituloFaqs="Preguntas sobre el desvío en Yoigo"
      relacionadas={[
        {
          href: "/desvio-de-llamadas/masmovil",
          titulo: "Desvío en MásMóvil",
          texto:
            "Mismas condiciones del fijo que Yoigo, otra forma de publicar el móvil.",
        },
        {
          href: "/desvio-de-llamadas",
          titulo: "Guía de desvío por operador",
          texto: "Desviar o dar el número de Alhabla, y cómo comprobarlo.",
        },
        {
          href: "/desvio-de-llamadas/iphone-y-android",
          titulo: "Desvío desde los ajustes del móvil",
          texto: "Samsung, Xiaomi, Huawei y el caso del iPhone.",
        },
      ]}
      cierre="Que ninguna llamada a tu Yoigo acabe en el 633."
    >
      <ConNumeroDeAlhabla>
        <Seccion
          id="movil"
          titulo="En el móvil Yoigo"
          entradilla={
            <p>
              Desde el móvil que quieres desviar, en el teclado de la app
              Teléfono. El de todas (<Codigo>*21*número#</Codigo>) deja de
              hacer sonar tu móvil: no es el que quieres.
            </p>
          }
        >
          <div className="grid gap-6">
            <CampoNumeroDeAlhabla />
            <TablaDeCodigos
              titulo="Móvil Yoigo"
              subtitulo="Los tres primeros, deducidos de su guía del contestador; el último, como lo publica Yoigo."
              filas={[
                {
                  tipo: "Si no coges",
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
                  tipo: "Todas (publicado por Yoigo)",
                  activar: "*21*{N}#",
                  quitar: "#21#",
                },
              ]}
              nota="Los códigos de quitar y consultar de los condicionales son los de la norma; Yoigo no los publica para un número que no sea el suyo."
            />
          </div>
          <div className="mt-8">
            <Texto>
              <p>
                <strong>El coste.</strong> Lo de tu tarifa, «como si estuvieras
                llamando a ese número». Con llamadas ilimitadas a fijos y
                móviles nacionales, entra en ellas; si tu tarifa tiene minutos
                contados, cada llamada desviada los gasta.
              </p>
            </Texto>
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Nota
              tipo="importante"
              titulo="Esos tres desvíos ya apuntan al 633 o al 556"
            >
              Antes de poner a tu recepcionista, cada situación (no coges,
              comunicas, apagado) mandaba al contestador o al aviso de llamadas
              perdidas, y solo puede ir a un destino a la vez. Al marcar los
              tres con el número de Alhabla, los sustituyes: no dejes ninguno
              apuntando al 633.
            </Nota>
            <ComprobarDesvio>
              <p>
                Los condicionales son una deducción a partir de la guía del
                contestador, no algo que Yoigo diga: confírmalo. Marca{" "}
                <Codigo>*#61#</Codigo> para ver qué número ha guardado.
              </p>
            </ComprobarDesvio>
          </div>
        </Seccion>

        <Seccion
          id="fijo"
          fondo
          titulo="El fijo de Yoigo"
          entradilla={
            <p>
              Aquí Yoigo sí publica los condicionales. Descuelga, marca y pulsa
              la tecla de llamada.
            </p>
          }
        >
          <TablaDeCodigos
            titulo="Fijo Yoigo"
            filas={[
              {
                tipo: "Si no contestas",
                recomendado: true,
                activar: "*61*{N}#",
                quitar: "#61#",
              },
              { tipo: "Si comunicas", activar: "*67*{N}#", quitar: "#67#" },
              { tipo: "Todas", activar: "*21*{N}#", quitar: "#21#" },
            ]}
          />
          <div className="mt-8">
            <Texto>
              <p>
                <strong>Al fijo de Alhabla te sale a cuenta.</strong> De fijo a
                fijo es ilimitado, y el número de Alhabla es un fijo. Desviarlo
                a tu móvil, en cambio, gasta los 60 minutos a móviles de la
                tarifa; pasados, cada minuto cuesta 0,20 € más 0,30 € de
                establecimiento, impuestos incluidos.
              </p>
            </Texto>
          </div>
        </Seccion>

        <Fuentes
          consultadas="2026-10-20"
          fuentes={[
            {
              nombre: "Yoigo: desvío de llamadas en el móvil",
              url: "https://www.yoigo.com/ayuda/desvio-de-llamadas-en-el-movil",
            },
            {
              nombre: "Yoigo: desviar llamadas del fijo",
              url: "https://www.yoigo.com/ayuda/como-puedo-desviar-llamadas-de-fijo-a-movil",
            },
            {
              nombre: "Yoigo: guía rápida del contestador del móvil",
              url: "https://www.yoigo.com/ayuda/guia-rapida-de-uso-del-contestador-de-mi-movil",
            },
          ]}
        />
      </ConNumeroDeAlhabla>
    </PaginaGuia>
  );
}
