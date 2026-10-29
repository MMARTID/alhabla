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
 * Desvío en Telecable (datos del 2026-10-20), con telecable.es/ayuda-clientes
 * (móvil, fijo y restricción de llamadas del fijo). Lo propio de Telecable:
 * los datos estructurados de su ayuda del móvil traen los códigos completos
 * con los segundos de 5 a 30 (el texto visible pierde asteriscos), y en el
 * fijo el tramo desviado se factura con la tarifa, que trae 4.000 minutos a
 * fijos. Lo de Big Pyme viene de un extracto, igual que en Orange.
 */

const ruta = "/desvio-de-llamadas/telecable";
const titulo = "Desviar llamadas en Telecable a tu recepcionista de IA";
const descripcion =
  "Códigos de Telecable para el móvil con segundos de 5 a 30 y para el fijo, y cómo se factura el desvío: 4.000 minutos a fijos, móviles aparte.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

const faqs = [
  {
    question: "Doy el fijo y el móvil. ¿Desvío los dos?",
    answer:
      "Puedes desviar las dos líneas al mismo número de Alhabla. «Comprobar desvío» llama a la línea de clientes que tengas en tu panel; la otra, llámala desde otro teléfono y no la cojas: si te atiende tu recepcionista, está bien puesta.",
  },
  {
    question: "¿Cuánto cuesta desviar el móvil?",
    answer:
      "La ayuda del móvil de Telecable no lo dice. Depende de lo que incluya tu tarifa móvil.",
  },
  {
    question: "Mi empresa tiene centralita Big Pyme. ¿Valen estos códigos?",
    answer:
      "No. Según su ayuda, Big Pyme usa la misma familia de códigos que en Orange (*92 y el número para no contesta, *93 para quitarlo…). Pídeselos a Telecable.",
  },
];

export default function DesvioTelecablePage() {
  return (
    <PaginaGuia
      ruta={ruta}
      migas={[
        { name: "Desvío de llamadas", path: "/desvio-de-llamadas" },
        { name: "Telecable", path: ruta },
      ]}
      etiqueta={{ icono: Phone, texto: "Telecable · móvil y fijo" }}
      titulo={titulo}
      entradilla={
        <p>
          Telecable publica el desvío del móvil con los segundos de espera, de 5
          a 30, y el del fijo con los tres códigos de siempre. Desde el fijo,
          desviar a tu recepcionista gasta minutos a fijos, que la tarifa trae
          de sobra.
        </p>
      }
      descripcion={descripcion}
      ctaSecundario={{ texto: "Ir al fijo", href: "#fijo" }}
      ubicacion="desvio_telecable"
      faqs={faqs}
      tituloFaqs="Preguntas sobre el desvío en Telecable"
      relacionadas={[
        {
          href: "/desvio-de-llamadas",
          titulo: "Todos los operadores",
          texto: "Desviar o dar el número de Alhabla, y cómo quitarlo.",
        },
        {
          href: "/desvio-de-llamadas/euskaltel",
          titulo: "Desvío en Euskaltel",
          texto: "Del mismo grupo: también con 4.000 minutos a fijos.",
        },
        {
          href: "/desvio-de-llamadas/r-galicia",
          titulo: "Desvío en R",
          texto: "La app de R hace el desvío del fijo sin códigos.",
        },
      ]}
      cierre="Tu Telecable sigue sonando; si no llegas, contesta ella."
    >
      <ConNumeroDeAlhabla>
        <Seccion
          id="movil"
          titulo="En tu móvil Telecable, con segundos de espera"
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
              titulo="Móvil Telecable"
              filas={[
                {
                  tipo: "Si no contestas",
                  recomendado: true,
                  activar: "**61*{N}**{T}#",
                  quitar: "##61#",
                  consultar: "*#61#",
                  segundos: { opciones: [5, 10, 15, 20, 25, 30], inicial: 15 },
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
                  tipo: "Todas",
                  activar: "**21*{N}#",
                  quitar: "##21#",
                  consultar: "*#21#",
                },
              ]}
            />
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Nota tipo="importante" titulo="En su web se ven con asteriscos de menos">
              <p>
                En la ayuda de Telecable, los códigos del móvil pierden
                asteriscos al mostrarse. Los completos son los de la tabla, con
                los segundos al final: <Codigo>**61*número**segundos#</Codigo>.
                Si copias el de su web, puede que no haga lo que esperas.
              </p>
            </Nota>
            <ComprobarDesvio>
              <p>
                Marca <Codigo>*#61#</Codigo>: verás el número y la espera que
                ha guardado la red. Si no sale el tiempo que elegiste, vuelve a
                marcar el código.
              </p>
            </ComprobarDesvio>
          </div>
        </Seccion>

        <Seccion
          id="fijo"
          fondo
          titulo="El fijo de Telecable, con 4.000 minutos a fijos"
          entradilla={
            <p>
              Tres códigos, con su asterisco y su almohadilla. Descuelga, marca
              y cuelga.
            </p>
          }
        >
          <TablaDeCodigos
            titulo="Fijo Telecable"
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
            nota="Telecable no publica cómo elegir los segundos ni código de consulta en el fijo: la prueba es «Comprobar desvío»."
          />
          <div className="mt-8">
            <Texto>
              <p>
                <strong>Qué pagas.</strong> El tramo desviado se factura con tu
                tarifa. La línea fija trae 4.000 minutos a otros fijos, y el
                número de Alhabla es un fijo: sale de ahí. Desviar el fijo a tu
                móvil, en cambio, se paga como llamada a móvil, salvo que tengas
                un bono.
              </p>
            </Texto>
          </div>
        </Seccion>

        <Fuentes
          consultadas="2026-10-20"
          fuentes={[
            {
              nombre: "Telecable: desvío de llamadas en el móvil",
              url: "https://telecable.es/ayuda-clientes/desvio-llamadas-movil",
            },
            {
              nombre: "Telecable: desviar llamadas del fijo",
              url: "https://telecable.es/ayuda-clientes/desviar-llamadas-fijo",
            },
            {
              nombre: "Telecable: restricción de llamadas salientes del fijo",
              url: "https://telecable.es/ayuda-clientes/restriccion-llamadas-salientes-fijo",
            },
          ]}
        />
      </ConNumeroDeAlhabla>
    </PaginaGuia>
  );
}
