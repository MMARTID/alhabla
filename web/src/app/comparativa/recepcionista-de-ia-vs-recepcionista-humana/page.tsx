import { UserRound } from "lucide-react";
import { Fuentes, ListaCheck, Nota, PaginaGuia, Seccion, Tabla, Tarjetas, Texto } from "@/components/pagina-guia";
import { plans } from "@/lib/plans";
import { metadataDePagina } from "@/lib/seo";

/**
 * Recepcionista de IA frente a una persona en plantilla (2026-10-20).
 * Búsquedas reales: «cuánto cobra una recepcionista» (1.ª), «… en España»,
 * «… de peluquería», «sueldo recepcionista peluqueria». El coste sale del
 * Convenio colectivo de peluquerías, institutos de belleza y gimnasios
 * (BOE-A-2024-21671): grupo I (telefonista, recepcionista) 1.250 €/mes en 14
 * pagas para 2026; cotización de empresa de 2026: 23,60 % contingencias
 * comunes + 5,50 % desempleo indefinido + 0,20 % FOGASA + 0,60 % formación +
 * 0,75 % MEI = 30,65 %, sin el seguro de accidentes, que va por actividad.
 */
const ruta = "/comparativa/recepcionista-de-ia-vs-recepcionista-humana";
const titulo = "Cuánto cuesta una recepcionista frente a una IA";
const descripcion =
  "Sueldo de una recepcionista de peluquería según el convenio de 2026, coste real para la empresa y qué hace mejor una persona y qué una recepcionista de IA.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

const SALARIO_MES = 1250;
const PAGAS = 14;
const COTIZACION = 0.3065;
const salarioAnual = SALARIO_MES * PAGAS;
const cotizacionAnual = Math.round(salarioAnual * COTIZACION);
const costeAnual = salarioAnual + cotizacionAnual;
const miles = (n: number) => new Intl.NumberFormat("es-ES").format(n);
const pro = plans[1];

export default function VsHumanaPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      tipo="Article"
      migas={[
        { name: "Comparativas", path: "/comparativa" },
        { name: "IA frente a una recepcionista", path: ruta },
      ]}
      etiqueta={{ icono: UserRound, texto: "Coste de una recepcionista" }}
      titulo={titulo}
      descripcion={descripcion}
      ubicacion="vs_humana"
      entradilla={
        <p>
          Contratar a alguien solo para coger el teléfono es lo primero que piensa un salón que pierde llamadas, y lo
          último que se puede permitir. Aquí tienes el sueldo que marca el convenio en 2026, lo que le cuesta de verdad a
          la empresa y en qué es mejor cada opción. Adelanto: casi nunca es una cosa o la otra.
        </p>
      }
      faqs={[
        {
          question: "¿Cuánto cobra una recepcionista de peluquería en España?",
          answer: `El convenio estatal de peluquerías, institutos de belleza y gimnasios fija para 2026 un salario base de ${miles(SALARIO_MES)} € al mes en 14 pagas (${miles(salarioAnual)} € al año) para el grupo de telefonista y recepcionista, a jornada completa. Algunas provincias tienen convenio propio con cifras distintas, y la empresa puede pagar más.`,
        },
        {
          question: "¿Y cuánto le cuesta a la empresa?",
          answer: `Hay que sumar las cotizaciones a la Seguridad Social a cargo de la empresa: en 2026, un 30,65 % sobre el salario más el seguro de accidentes, que depende de la actividad. En total, unos ${miles(costeAnual)} € al año sin contar ese seguro.`,
        },
        {
          question: "¿Puede una IA sustituir a la recepcionista?",
          answer:
            "No del todo, ni debería. Una IA no cobra en caja, no recibe a la gente ni vende un champú. Lo que sí hace es coger las llamadas que nadie puede coger y reservar en la agenda. En un salón sin recepción, eso es casi todo lo que hacía falta.",
        },
        {
          question: "Ya tengo recepcionista. ¿Para qué quiero una IA?",
          answer:
            "Para lo que no llega: cuando está atendiendo en el mostrador, en su descanso, a última hora, los domingos o en vacaciones. Con el desvío «si no contesta» o «si comunica», la IA solo coge lo que tu recepcionista no puede.",
        },
        {
          question: "¿Y una recepcionista a media jornada?",
          answer:
            "Cuesta la mitad, más o menos, y cubre la mitad de las horas. Las llamadas siguen llegando en la otra mitad, y suelen concentrarse cuando más trabajo hay.",
        },
      ]}
      relacionadas={[
        { href: "/blog/cuanto-cuesta-una-recepcionista-de-ia", titulo: "Cuánto cuesta una recepcionista de IA" },
        { href: "/herramientas/calculadora-de-llamadas-perdidas", titulo: "Calculadora de llamadas perdidas", texto: "Pon tus cifras y mira cuánto se va cada mes." },
        { href: "/comparativa/recepcionista-de-ia-vs-secretaria-telefonica", titulo: "IA frente a una secretaria telefónica externa" },
        { href: "/planes", titulo: "Planes y precios de Alhabla" },
      ]}
      cierre="Que tu equipo atienda a quien tiene delante."
    >
      <Seccion titulo="El coste real de una recepcionista en 2026" entradilla={<p>Jornada completa, según el convenio estatal del sector.</p>}>
        <Tabla
          cabecera={["Concepto", "Al año", "Al mes (12 meses)"]}
          filas={[
            [`Salario base del convenio (${miles(SALARIO_MES)} € × ${PAGAS} pagas)`, `${miles(salarioAnual)} €`, `${miles(Math.round(salarioAnual / 12))} €`],
            ["Cotización de empresa a la Seguridad Social (30,65 %)", `${miles(cotizacionAnual)} €`, `${miles(Math.round(cotizacionAnual / 12))} €`],
            ["Total sin el seguro de accidentes de trabajo", `${miles(costeAnual)} €`, `${miles(Math.round(costeAnual / 12))} €`],
            [`Alhabla ${pro.name}, para comparar`, `${miles(pro.price * 12)} € + IVA`, `${pro.price} € + IVA`],
          ]}
          nota="Grupo I (telefonista, recepcionista) del Convenio colectivo de peluquerías, institutos de belleza y gimnasios, tabla de 2026. Cotización de empresa 2026: contingencias comunes 23,60 %, desempleo (contrato indefinido) 5,50 %, FOGASA 0,20 %, formación profesional 0,60 % y mecanismo de equidad intergeneracional 0,75 %. No incluye antigüedad, pluses, vacaciones cubiertas por otra persona ni bajas."
        />
      </Seccion>

      <Seccion fondo titulo="Lo que no sale en la nómina" estrecha>
        <Texto>
          <p>
            Una persona a jornada completa trabaja unas 40 horas a la semana y tiene 30 días de vacaciones al año. Un salón
            que abre de 9:00 a 20:00 de lunes a sábado está abierto 66 horas: aun con una recepcionista, hay franjas sin
            nadie al teléfono. Y las llamadas no se paran cuando cierras: muchas reservas se intentan por la noche o el
            domingo, cuando el cliente tiene un momento.
          </p>
          <p>
            Hay también un coste de gestión: buscar a alguien, formarle en tus servicios y precios, cubrir sus vacaciones y
            sus bajas. Nada de eso es un problema si además de coger el teléfono recibe, cobra y vende. Es un problema si
            lo contratas solo por el teléfono.
          </p>
        </Texto>
      </Seccion>

      <Seccion titulo="Qué hace mejor cada una">
        <Tarjetas
          columnas={2}
          items={[
            {
              titulo: "Una persona en recepción",
              texto: (
                <ListaCheck
                  items={[
                    "Recibe al cliente, cobra y vende producto.",
                    "Calma a un cliente enfadado cara a cara.",
                    "Resuelve lo que no está en ningún guion.",
                    "Conoce a los habituales de toda la vida.",
                  ]}
                />
              ),
            },
            {
              titulo: "Una recepcionista de IA",
              texto: (
                <ListaCheck
                  items={[
                    "Coge el teléfono a cualquier hora, también en festivos.",
                    "No deja llamadas en espera aunque haya cola en el mostrador.",
                    "Mira la agenda real y reserva con quien toca, sin errores de apunte.",
                    "Habla catalán, euskera, gallego y ocho idiomas más.",
                  ]}
                />
              ),
            },
          ]}
        />
      </Seccion>

      <Seccion fondo titulo="La combinación que funciona" estrecha>
        <Texto>
          <p>
            En un salón pequeño sin recepción, la recepcionista de IA cubre el teléfono y el equipo se queda con el
            cliente que tiene delante. En un centro con recepcionista, la IA cubre lo que se escapa: el desvío «si no
            contesta» hace que la llamada pase a la IA solo cuando nadie la coge, y fuera de horario lo atiende todo. Tu
            recepcionista no pierde trabajo; pierde interrupciones.
          </p>
        </Texto>
        <div className="mt-6">
          <Nota tipo="consejo" titulo="Haz la cuenta con tus números">
            Cuántas llamadas no coges a la semana, cuántas eran para pedir cita y cuánto vale una cita media: la{" "}
            <a className="font-semibold underline" href="/herramientas/calculadora-de-llamadas-perdidas">calculadora de llamadas perdidas</a> te dice
            cuánto se va cada mes.
          </Nota>
        </div>
      </Seccion>

      <Fuentes
        consultadas="2026-10-20"
        fuentes={[
          { nombre: "BOE: Convenio colectivo de peluquerías, institutos de belleza y gimnasios (BOE-A-2024-21671)", url: "https://www.boe.es/diario_boe/txt.php?id=BOE-A-2024-21671" },
          { nombre: "Seguridad Social: bases y tipos de cotización", url: "https://www.seg-social.es/wps/portal/wss/internet/Trabajadores/CotizacionRecaudacionTrabajadores/10721/10957/9932/4315" },
          { nombre: "Seguridad Social: Boletín RED 05/2026 (MEI 2026)", url: "https://www.seg-social.es/wps/wcm/connect/wss/61f4db39-8366-4d8f-863b-34332b1d527a/BNR+5_2026.pdf?MOD=AJPERES" },
        ]}
      />
    </PaginaGuia>
  );
}
