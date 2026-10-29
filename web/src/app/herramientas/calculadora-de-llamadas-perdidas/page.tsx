import Link from "next/link";
import { Calculator } from "lucide-react";
import { CalculadoraLlamadasPerdidas } from "@/components/herramientas/calculadora-llamadas-perdidas";
import { SECTORES_DE_LA_CALCULADORA } from "@/components/herramientas/calculo-de-llamadas-perdidas";
import { LoQueHaceAlhabla } from "@/components/herramientas/lo-que-hace-alhabla";
import { Plegado } from "@/components/herramientas/plegado";
import { ListaCheck, Nota, PaginaGuia, Pasos, Seccion, Tabla, Texto } from "@/components/pagina-guia";
import { plans } from "@/lib/plans";
import { absoluteUrl, metadataDePagina } from "@/lib/seo";

/**
 * Calculadora de llamadas perdidas con URL propia (2026-10-20). La de las
 * landings mide «citas perdidas» a ojo; esta parte de las llamadas sin coger
 * y deja ver cada paso de la cuenta, con sus límites. Las fórmulas viven en
 * components/herramientas/calculadora-llamadas-perdidas.tsx y las vigila
 * tests/components/herramientas-calculadora.test.ts: si cambian, hay que
 * cambiar «El método» de esta página. La herramienta va arriba y la
 * explicación (cómo contar, el método, sus límites y los valores de partida)
 * plegada debajo.
 *
 * No cita estadísticas de terceros a propósito: no hay ninguna fiable para
 * pequeños negocios en España, así que los valores de partida se presentan
 * como lo que son, supuestos para editar.
 */
const ruta = "/herramientas/calculadora-de-llamadas-perdidas";
const titulo = "Calculadora de llamadas perdidas";
const descripcion =
  "Calcula cuánto pierde tu negocio por las llamadas que no coges: con tus cifras, al mes y al año, el plan que lo cubriría y el método explicado.";

export const metadata = metadataDePagina({
  ruta,
  titulo: "Calculadora de llamadas perdidas: lo que te cuestan",
  descripcion,
});

const EUROS = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export default function CalculadoraDeLlamadasPerdidasPage() {
  const [inicio] = plans;
  // Con el ticket de partida de peluquería (45 €), el del ejemplo de la tabla.
  const citasParaInicio = Math.ceil(inicio.price / 45);
  return (
    <PaginaGuia
      ruta={ruta}
      migas={[
        { name: "Herramientas", path: "/herramientas" },
        { name: "Calculadora de llamadas perdidas", path: ruta },
      ]}
      etiqueta={{ icono: Calculator, texto: "Herramienta gratis" }}
      titulo={titulo}
      descripcion={descripcion}
      ubicacion="calculadora_llamadas"
      ctaSecundario={{ texto: "Hacer la cuenta", href: "#calculadora" }}
      entradilla={
        <p>
          Pon cuántas llamadas no coges en una semana y lo que vale una cita: te dice cuánto dinero se va al mes y al
          año. Los valores de partida son orientativos; cámbialos por los tuyos.
        </p>
      }
      grafo={[
        {
          "@type": "WebApplication",
          name: titulo,
          url: absoluteUrl(ruta),
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          isAccessibleForFree: true,
          inLanguage: "es-ES",
          offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
        },
      ]}
      faqs={[
        {
          question: "¿Por qué multiplica por 4,33 semanas y no por 4?",
          answer:
            "Porque un año tiene 52 semanas y 12 meses: 52 entre 12 son 4,33. Con 4 semanas por mes la cuenta anual se queda corta en un mes entero.",
        },
        {
          question: "Mi agenda va llena casi todas las semanas. ¿Me sirve?",
          answer:
            "Te sirve, pero con cuidado: si no había hueco, esa llamada no era una cita perdida, era alguien para la lista de espera. En ese caso baja el porcentaje de los que reservan en otro sitio, o fíjate solo en los días flojos.",
        },
        {
          question: "Tengo dos locales. ¿Cómo lo calculo?",
          answer:
            "Uno por uno. Cada local tiene su teléfono, su clientela y su ticket, y mezclarlos esconde justo lo que quieres ver: dónde se escapan más llamadas.",
        },
      ]}
      relacionadas={[
        { href: "/blog/cuantas-llamadas-pierde-una-peluqueria", titulo: "Cuántas llamadas pierde una peluquería", texto: "La cuenta hecha para un salón de dos sillas." },
        { href: "/desvio-de-llamadas", titulo: "Desvío de llamadas por operador", texto: "Cómo hacer que las que no coges lleguen a alguien." },
        { href: "/planes", titulo: "Planes y precios", texto: "Minutos incluidos y precio del minuto extra." },
      ]}
      cierre="Que ninguna de esas llamadas se quede sonando."
    >
      <Seccion id="calculadora" titulo="Haz la cuenta con tus cifras">
        <CalculadoraLlamadasPerdidas />
      </Seccion>

      <Seccion
        fondo
        titulo="Cómo se calcula"
        entradilla={<p>El método, sus límites y de dónde sale cada valor de partida, por si quieres revisar la cuenta.</p>}
      >
        <div className="grid gap-4">
          <Plegado titulo="Cómo contar tus llamadas perdidas en una semana">
            <Pasos
              pasos={[
                {
                  titulo: "Elige una semana normal",
                  texto: "Ni la de Navidad ni la de agosto. Si tu negocio cambia mucho por temporada, repite la cuenta en temporada alta y en baja.",
                },
                {
                  titulo: "Apunta cada noche las perdidas del día",
                  texto: "Las del móvil y las del fijo, y quita las repetidas: tres llamadas seguidas del mismo número son una persona.",
                },
                {
                  titulo: "Devuelve unas cuantas y pregunta",
                  texto: "Con diez llamadas devueltas ya sabes qué parte eran para pedir cita. De esas, las que en dos días no volvieron son las que reservaron en otro sitio.",
                },
              ]}
            />
          </Plegado>

          <Plegado titulo="El método, paso a paso">
            <Tabla
              cabecera={["Paso", "Cuenta", "Resultado"]}
              filas={[
                ["Llamadas sin coger al mes", "10 a la semana × 4,33 semanas", "43,3"],
                ["Eran para pedir cita", "43,3 × 60 %", "26"],
                ["Acabaron reservando en otro sitio", "26 × 30 %", "7,8 citas"],
                ["Lo que dejas de facturar al mes", "7,8 × 45 €", "351 €"],
                ["Al año", "351 € × 12", "4212 €"],
                [
                  "Con las visitas que no vuelven",
                  "7,8 × 12 citas × 25 % que no vuelve × 5 visitas más × 45 €, sumado a lo anterior",
                  "9477 €",
                ],
              ]}
              nota="Con los valores de partida de peluquería. La última fila solo se suma si marcas la opción: cuenta las visitas siguientes de quien se queda en el otro negocio (aquí, 6 al año menos la primera, que ya está contada)."
            />
            <Texto>
              <p>
                <strong>Para elegir plan</strong>, multiplica las llamadas sin coger al mes por lo que dura una llamada
                de cita (3 minutos de partida): son los minutos que atendería tu recepcionista. Luego mira qué plan admite
                tus profesionales y cuál sale más barato con sus minutos incluidos. Con los valores de partida son unos
                130 minutos y el plan {inicio.name}, de {EUROS.format(inicio.price)} sin IVA, que se paga con{" "}
                {citasParaInicio} {citasParaInicio === 1 ? "cita recuperada" : "citas recuperadas"} al mes.
              </p>
            </Texto>
          </Plegado>

          <Plegado titulo="Lo que esta cuenta no sabe">
            <ListaCheck
              items={[
                <>
                  <strong>Si tenías hueco.</strong> Una llamada perdida en una semana llena no es una cita perdida.
                </>,
                <>
                  <strong>Tu margen.</strong> Da lo que dejas de facturar, no lo que dejas de ganar.
                </>,
                <>
                  <strong>Las llamadas que coges mal.</strong> El «llámame luego» con una clienta delante también se
                  pierde, y no sale en el registro.
                </>,
                <>
                  <strong>Que contestar no es reservar.</strong> Puede que la hora que querían no esté libre: el
                  resultado es un techo, no una promesa.
                </>,
              ]}
            />
          </Plegado>

          <Plegado titulo="Los valores de partida de cada sector">
            <Tabla
              cabecera={["Sector", "Ticket de partida", "Visitas al año", "Por qué ese número"]}
              filas={SECTORES_DE_LA_CALCULADORA.map(({ id, nombre, ticket, visitas }) => [
                nombre,
                EUROS.format(ticket),
                String(visitas),
                RAZONES[id],
              ])}
              nota="No son medias de mercado: son números redondos para empezar. Todos los sectores parten de 10 llamadas sin coger a la semana, 60 % para pedir cita, 30 % que reserva fuera, 3 minutos por llamada y 2 profesionales."
            />
            <Nota tipo="consejo" titulo="Haz la cuenta con dos supuestos">
              Si no sabes qué porcentaje de llamadas acaba en otro negocio, calcula con 20 % y con 50 %. Si incluso con
              el bajo la cifra te parece grande, ya sabes lo que necesitabas saber.
            </Nota>
          </Plegado>
        </div>
      </Seccion>

      <LoQueHaceAlhabla titulo="Y si alguien cogiera esas llamadas">
        <p>
          Con el <Link href="/desvio-de-llamadas">desvío</Link>, lo que tú no coges lo atiende la recepcionista de IA:
          da la cita en tu agenda y se la confirma a la clienta por WhatsApp. Tú lo llevas por WhatsApp o desde el panel.
        </p>
      </LoQueHaceAlhabla>
    </PaginaGuia>
  );
}

/** Una línea por sector para la tabla de valores de partida. */
const RAZONES: Record<(typeof SECTORES_DE_LA_CALCULADORA)[number]["id"], string> = {
  peluqueria: "Entre un corte y un color; la clientela fiel viene cada dos meses.",
  barberia: "Servicio corto y barato, pero de cada tres o cuatro semanas.",
  unas: "El semipermanente se renueva cada pocas semanas.",
  estetica: "Tratamientos más caros y menos frecuentes que en peluquería.",
  fisioterapia: "Una sesión suelta; los tratamientos van por rachas, no todo el año.",
  pestanas: "Los rellenos marcan el ritmo: casi una visita al mes.",
  spa: "Ticket alto y visitas espaciadas; muchas son regalos.",
  canina: "Baño y corte de un perro mediano cada dos meses.",
};
