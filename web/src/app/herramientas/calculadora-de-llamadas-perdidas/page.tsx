import Link from "next/link";
import { Calculator } from "lucide-react";
import { CalculadoraLlamadasPerdidas } from "@/components/herramientas/calculadora-llamadas-perdidas";
import { SECTORES_DE_LA_CALCULADORA } from "@/components/herramientas/calculo-de-llamadas-perdidas";
import { ListaCheck, Nota, PaginaGuia, Pasos, Seccion, Tabla, Texto } from "@/components/pagina-guia";
import { plans } from "@/lib/plans";
import { absoluteUrl, metadataDePagina } from "@/lib/seo";

/**
 * Calculadora de llamadas perdidas con URL propia (2026-10-20). La de las
 * landings mide «citas perdidas» a ojo; esta parte de las llamadas sin coger
 * y deja ver cada paso de la cuenta, con sus límites. Las fórmulas viven en
 * components/herramientas/calculadora-llamadas-perdidas.tsx y las vigila
 * tests/components/herramientas-calculadora.test.ts: si cambian, hay que
 * cambiar «El método» de esta página.
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
          Pon cuántas llamadas no coges en una semana, cuántas eran para pedir cita y lo que vale una cita. La
          calculadora te dice cuánto dinero se va al mes y al año, y qué plan de Alhabla lo cubriría. Los valores de
          partida son orientativos: cámbialos por los tuyos.
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
          question: "¿De dónde salen los valores de partida?",
          answer:
            "Son supuestos razonables para que la calculadora no empiece en cero, no estadísticas del sector: no conocemos ningún estudio fiable de llamadas perdidas en pequeños negocios españoles. El ticket es el mismo que usamos en cada página de sector. Lo que vale es la cuenta con tus cifras.",
        },
        {
          question: "¿Por qué multiplica por 4,33 semanas y no por 4?",
          answer:
            "Porque un año tiene 52 semanas y 12 meses: 52 entre 12 son 4,33. Con 4 semanas por mes la cuenta anual se queda corta en un mes entero.",
        },
        {
          question: "¿Las cifras llevan IVA?",
          answer:
            "No. El ticket se pide sin IVA y los planes de Alhabla se publican sin IVA, para comparar lo mismo con lo mismo. Si tu ticket lo tienes con IVA, divídelo entre 1,21.",
        },
        {
          question: "Mi agenda va llena casi todas las semanas. ¿Me sirve?",
          answer:
            "Te sirve, pero con cuidado: si no había hueco, esa llamada no era una cita perdida, era alguien para la lista de espera. En ese caso baja el porcentaje de los que reservan en otro sitio, o fíjate solo en los días flojos.",
        },
        {
          question: "¿Se guarda lo que escribo?",
          answer:
            "No. La cuenta se hace en tu navegador y no se envía a ningún sitio. Si pulsas «Copiar», las cifras van dentro del enlace, para que puedas guardarlo o mandárselo a tu socio.",
        },
        {
          question: "Tengo dos locales. ¿Cómo lo calculo?",
          answer:
            "Uno por uno. Cada local tiene su teléfono, su clientela y su ticket, y mezclarlos esconde justo lo que quieres ver: dónde se escapan más llamadas.",
        },
      ]}
      relacionadas={[
        { href: "/blog/cuantas-llamadas-pierde-una-peluqueria", titulo: "Cuántas llamadas pierde una peluquería", texto: "La cuenta hecha para un salón de dos sillas." },
        { href: "/blog/cuantas-llamadas-pierde-una-barberia", titulo: "Cuántas llamadas pierde una barbería", texto: "Horas punta, sillas llenas y el teléfono sonando." },
        { href: "/herramientas/guion-para-atender-el-telefono", titulo: "Guion para atender el teléfono", texto: "Para las llamadas que sí coges: que acaben en cita." },
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
        titulo="Cómo contar tus llamadas perdidas en una semana"
        entradilla={
          <p>
            La cifra que más pesa es la primera, y casi nadie la sabe. Se saca en una semana con el registro de
            llamadas y una libreta.
          </p>
        }
      >
        <Pasos
          pasos={[
            {
              titulo: "Elige una semana normal",
              texto: "Ni la de Navidad ni la de agosto. Si tu negocio cambia mucho por temporada, repite la cuenta en temporada alta y en baja.",
            },
            {
              titulo: "Apunta cada noche las perdidas del día",
              texto: "Las del móvil y las del fijo. Si el fijo no guarda registro, ten una hoja junto al teléfono y haz una raya cada vez que suene y no llegues.",
            },
            {
              titulo: "Quita las repetidas",
              texto: "Si el mismo número te llamó tres veces seguidas, es una persona que quería algo, no tres. Cuenta una.",
            },
            {
              titulo: "Devuelve unas cuantas y pregunta",
              texto: "Con diez llamadas devueltas ya sabes qué parte eran para pedir cita. Es el segundo dato de la calculadora.",
            },
            {
              titulo: "Mira quién no volvió",
              texto: "De las que eran para cita, cuenta las que en dos días no volvieron a llamar ni a escribir. Es la mejor aproximación que tendrás de las que reservaron en otro sitio.",
            },
          ]}
        />
      </Seccion>

      <Seccion titulo="El método, paso a paso" entradilla={<p>Con los valores de partida de peluquería, para que puedas seguir la cuenta.</p>}>
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
          nota="La última fila solo se suma si marcas la opción: cuenta las visitas siguientes de quien se queda en el otro negocio (aquí, 6 al año menos la primera, que ya está contada)."
        />
        <div className="mt-8">
          <Texto>
            <p>
              <strong>Para elegir plan</strong>, la calculadora multiplica las llamadas sin coger al mes por lo que
              dura una llamada de cita: son los minutos que atendería tu recepcionista si solo le llegan las que tú no
              coges. Luego mira qué plan admite tus profesionales y cuál sale más barato con sus minutos incluidos y,
              si te pasas, con el precio del minuto extra. Con los valores de partida son unos 130 minutos al mes y el
              plan {inicio.name}, de {EUROS.format(inicio.price)} sin IVA, que se paga con {citasParaInicio}{" "}
              {citasParaInicio === 1 ? "cita recuperada" : "citas recuperadas"} al mes.
            </p>
            <p>
              Los tres minutos por llamada son un supuesto: una llamada para pedir hora suele ser corta, pero si tus
              clientes preguntan mucho antes de reservar, súbelo.
            </p>
          </Texto>
        </div>
      </Seccion>

      <Seccion fondo titulo="Lo que esta cuenta no sabe">
        <ListaCheck
          items={[
            <>
              <strong>Si tenías hueco.</strong> Una llamada perdida en una semana llena no es una cita perdida. La
              calculadora da lo que se va cuando hay sitio; si casi nunca lo hay, el problema es otro.
            </>,
            <>
              <strong>Tu margen.</strong> Da lo que dejas de facturar, no lo que dejas de ganar. En servicios con
              mucho producto (color, uñas, tratamientos) la diferencia es grande.
            </>,
            <>
              <strong>Las llamadas que coges mal.</strong> El «llámame luego» con una clienta delante también se
              pierde, y no sale en el registro de perdidas.
            </>,
            <>
              <strong>Que contestar no es reservar.</strong> Aunque alguien coja todas las llamadas, no todas acaban en
              cita: puede que la hora que quería no esté libre. Por eso el resultado es un techo, no una promesa.
            </>,
            <>
              <strong>La temporada.</strong> Diciembre no es febrero. Si tu volumen cambia mucho, haz la cuenta dos
              veces y quédate con la media.
            </>,
          ]}
        />
      </Seccion>

      <Seccion
        titulo="Los valores de partida de cada sector"
        entradilla={
          <p>
            Al elegir sector cambian el ticket y las visitas al año. No son medias de mercado: son números redondos para
            empezar, que deberías sustituir por los de tu caja.
          </p>
        }
      >
        <Tabla
          cabecera={["Sector", "Ticket de partida", "Visitas al año", "Por qué ese número"]}
          filas={SECTORES_DE_LA_CALCULADORA.map(({ id, nombre, ticket, visitas }) => [
            nombre,
            EUROS.format(ticket),
            String(visitas),
            RAZONES[id],
          ])}
          nota="Todos los sectores empiezan con 10 llamadas sin coger a la semana, 60 % para pedir cita, 30 % que reserva fuera, 3 minutos por llamada y 2 profesionales."
        />
        <div className="mt-6">
          <Nota tipo="consejo" titulo="Haz la cuenta con dos supuestos">
            Si no sabes qué porcentaje de llamadas acaba en otro negocio, calcula con 20 % y con 50 %. Si incluso con el
            bajo la cifra te parece grande, ya sabes lo que necesitabas saber.
          </Nota>
        </div>
      </Seccion>

      <Seccion fondo titulo="Y si alguien cogiera esas llamadas">
        <Texto>
          <p>
            Con el desvío condicional, las llamadas que tú no coges pasan a una recepcionista de IA que mira tu agenda,
            ofrece una hora libre y deja la cita apuntada con su confirmación por WhatsApp. Por eso la calculadora cuenta
            solo las perdidas: las que coges tú siguen siendo tuyas. Cómo se activa en cada operador está en la{" "}
            <Link href="/desvio-de-llamadas">guía de desvío de llamadas</Link>, y los minutos de cada plan, en{" "}
            <Link href="/planes">planes y precios</Link>.
          </p>
        </Texto>
      </Seccion>
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
