import Link from "next/link";
import { Timer } from "lucide-react";
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
 * Desvío en Simyo (datos del 2026-10-20), con simyo.es (preguntas frecuentes
 * de la línea y detalle de tarifas). Lo propio de Simyo: da la fórmula general
 * `**código*número#` y los segundos de 5 a 30, no menciona el desvío si
 * comunica (67) y su fibra va sin voz fija, así que no hay fijo que desviar.
 */

const ruta = "/desvio-de-llamadas/simyo";
const titulo = "Desviar llamadas en Simyo a tu recepcionista de IA";
const descripcion =
  "Códigos de Simyo con segundos de espera de 5 a 30, el desvío si comunica que su ayuda no menciona y qué hacer si tu fibra de Simyo va sin fijo.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

const faqs = [
  {
    question: "Tengo fibra de Simyo. ¿Puedo desviar el fijo?",
    answer:
      "No hay fijo que desviar: Simyo dice que su fibra va sin servicio de voz fija. Si quieres un fijo para el negocio, el número de Alhabla es un fijo geográfico español que puedes dar como principal.",
  },
  {
    question: "Marco el 61 y el móvil no suena nunca. ¿Por qué?",
    answer:
      "Seguramente tienes activo el desvío de todas. Con él, los condicionales no llegan a entrar en juego. Míralo con *#21# y quítalo con ##21# antes de activar el 61.",
  },
  {
    question: "¿Tengo la llamada en espera y el 67 no salta?",
    answer:
      "Con la llamada en espera activada no «comunicas»: la segunda llamada suena en espera y, si no la coges, se aplica el desvío si no contestas.",
  },
];

export default function DesvioSimyoPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      migas={[
        { name: "Desvío de llamadas", path: "/desvio-de-llamadas" },
        { name: "Simyo", path: ruta },
      ]}
      etiqueta={{ icono: Timer, texto: "Simyo · móvil" }}
      titulo={titulo}
      entradilla={
        <p>
          Simyo da una fórmula sencilla, <Codigo>**código*número#</Codigo>, y
          deja elegir entre 5 y 30 segundos antes de desviar. Le falta una cosa:
          no menciona el desvío cuando comunicas.
        </p>
      }
      descripcion={descripcion}
      ctaSecundario={{ texto: "Elegir los segundos", href: "#codigos" }}
      ubicacion="desvio_simyo"
      faqs={faqs}
      tituloFaqs="Preguntas sobre el desvío en Simyo"
      relacionadas={[
        {
          href: "/desvio-de-llamadas",
          titulo: "Todos los operadores",
          texto: "Desviar o dar el número de Alhabla, y cómo quitarlo.",
        },
        {
          href: "/desvio-de-llamadas/orange",
          titulo: "Desvío en Orange",
          texto: "También publica los segundos, de 5 a 20 en particulares.",
        },
        {
          href: "/desvio-de-llamadas/iphone-y-android",
          titulo: "Desvío en iPhone y Android",
          texto: "Dónde está el menú en cada marca.",
        },
      ]}
      cierre="De 5 a 30 segundos para cogerla tú; después, tu recepcionista."
    >
      <ConNumeroDeAlhabla>
        <Seccion
          id="codigos"
          titulo="En tu móvil Simyo, con los segundos que elijas"
          entradilla={
            <p>
              Elige los segundos y copia el código. Se marca desde el móvil que
              quieres desviar, en el teclado de la app Teléfono.
            </p>
          }
        >
          <div className="grid gap-6">
            <CampoNumeroDeAlhabla />
            <TablaDeCodigos
              titulo="Móvil Simyo"
              filas={[
                {
                  tipo: "Si no contestas",
                  recomendado: true,
                  activar: "**61*{N}**{T}#",
                  quitar: "##61#",
                  consultar: "*#61#",
                  segundos: { opciones: [5, 10, 15, 20, 25, 30], inicial: 20 },
                  detalle:
                    "Con los segundos que elijas, como lo publica Simyo.",
                },
                {
                  tipo: "Apagado o sin cobertura",
                  recomendado: true,
                  activar: "**62*{N}#",
                  quitar: "##62#",
                  consultar: "*#62#",
                },
                {
                  tipo: "Si comunicas (no lo menciona Simyo)",
                  recomendado: true,
                  activar: "**67*{N}#",
                  quitar: "##67#",
                  consultar: "*#67#",
                },
                {
                  tipo: "Todas",
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
                <strong>Cuántos segundos.</strong> Con 5 o 10, casi todo pasa a
                tu recepcionista; con 15 o 20 te da margen para dejar lo que
                estés haciendo; con 25 o 30 solo pasan las que de verdad no
                puedes coger, y el cliente espera más.
              </p>
              <p>
                <strong>Qué pagas.</strong> Según Simyo, lo mismo que si
                hicieses esa llamada desde tu teléfono. El tramo hasta Alhabla
                es una llamada a un fijo nacional: si tu tarifa las incluye, no
                pagas de más.
              </p>
            </Texto>
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Nota tipo="importante" titulo="Falta el desvío si comunicas">
              <p>
                Simyo explica el 61, el 62 y el 21, pero no el 67. Sin él, la
                llamada que entra mientras hablas con otro cliente no llega a tu
                recepcionista. Actívalo igual y marca <Codigo>*#67#</Codigo>:
                si sale el número de Alhabla, la red lo acepta. Si no, piensa
                en{" "}
                <Link
                  href="/desvio-de-llamadas#cual"
                  className="font-semibold underline underline-offset-4"
                >
                  dar el número de Alhabla como principal
                </Link>
                .
              </p>
            </Nota>
            <ComprobarDesvio>
              <p>
                Marca <Codigo>*#61#</Codigo>: la respuesta incluye el número y
                los segundos guardados.
              </p>
            </ComprobarDesvio>
          </div>
        </Seccion>

        <Fuentes
          consultadas="2026-10-20"
          fuentes={[
            {
              nombre: "Simyo: preguntas frecuentes sobre tu línea",
              url: "https://www.simyo.es/preguntas-frecuentes/mi-linea.html",
            },
            {
              nombre: "Simyo: detalle de tarifas",
              url: "https://www.simyo.es/detalle-tarifas.html",
            },
          ]}
        />
      </ConNumeroDeAlhabla>
    </PaginaGuia>
  );
}
