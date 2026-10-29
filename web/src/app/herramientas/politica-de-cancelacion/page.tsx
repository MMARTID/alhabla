import { CalendarX, Clock, HandCoins, Hourglass, UserX } from "lucide-react";
import { GeneradorPoliticaCancelacion } from "@/components/herramientas/generador-politica-cancelacion";
import { EJEMPLOS_DE_POLITICA, POLITICA_POR_DEFECTO, type Politica } from "@/components/herramientas/politica-de-cancelacion";
import { LoQueHaceAlhabla } from "@/components/herramientas/lo-que-hace-alhabla";
import { Plegado } from "@/components/herramientas/plegado";
import { Fuentes, ListaCheck, PaginaGuia, Seccion, Tabla, Tarjetas, Texto } from "@/components/pagina-guia";
import { absoluteUrl, metadataDePagina } from "@/lib/seo";

/**
 * Generador de política de cancelación (2026-10-20). «política de
 * cancelación peluquería» no tiene sugerencias propias en el autocompletado:
 * esta página es para convertir y para enlazar desde las plantillas y el
 * blog (lista de espera, recordatorios).
 *
 * Lo legal sale del texto consolidado del TRLGDCU en el BOE, leído hoy:
 * art. 80.1.b (conocimiento previo), 82.1 (desequilibrio importante), 83
 * (nulidad), 85.6 (indemnización desproporcionadamente alta) y 87.2
 * (reciprocidad de lo pagado). Lo que Alhabla hace y no hace: no cobra
 * señales ni lleva la cuenta de quién no viene; la política se puede pegar en
 * «Información para responder» (frontend, agente › información).
 */
const ruta = "/herramientas/politica-de-cancelacion";
const titulo = "Generador de política de cancelación";
const descripcion =
  "Crea la política de cancelación de tu salón o clínica: plazo, señal y qué pasa cuando no vienen, con textos para el cartel, la web y la confirmación.";

export const metadata = metadataDePagina({
  ruta,
  titulo: "Política de cancelación: generador gratis para salones",
  descripcion,
});

function describirSenal(v: Politica) {
  if (v.senal === "no") return "Sin señal";
  const cuanto = v.senal === "fija" ? `${v.cantidad} €` : `${v.cantidad} %`;
  const aQue = v.ambito === "largos" ? `en servicios de más de ${v.minutosLargos} min` : v.ambito === "nuevos" ? "en la primera cita" : "en todas";
  return `${cuanto}, ${aQue}`;
}

function describirSiNoViene(v: Politica) {
  if (v.ausencias === "aviso") return "Recordarle la política";
  if (v.ausencias === "senal") return v.senal !== "no" && v.ambito === "todas" ? "Pierde la señal" : "Señal en la siguiente";
  return `Sin más citas tras ${v.maxAusencias} veces sin venir`;
}

export default function PoliticaDeCancelacionPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      migas={[
        { name: "Herramientas", path: "/herramientas" },
        { name: "Política de cancelación", path: ruta },
      ]}
      etiqueta={{ icono: CalendarX, texto: "Herramienta gratis" }}
      titulo={titulo}
      descripcion={descripcion}
      ubicacion="politica_cancelacion"
      ctaSecundario={{ texto: "Ir al generador", href: "#generador" }}
      entradilla={
        <p>
          Decide el plazo para anular, si pides señal y qué pasa cuando alguien no viene. El generador escribe el cartel
          del mostrador, el texto de tu web y la frase para la confirmación.
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
          question: "Si el cliente anula a tiempo, ¿tengo que devolverle la señal?",
          answer:
            "Si tu política dice que anular con el plazo no cuesta nada, sí. Puedes ofrecerle dejarla para su próxima cita, pero que lo elija él. Quedarte la señal de quien avisó a tiempo es justo lo que hace que una política parezca una trampa.",
        },
        {
          question: "¿Puedo dejar de dar cita a quien falta siempre?",
          answer:
            "Es una decisión de tu negocio. Lo importante es que la norma sea igual para todos, que el cliente la conozca y que la apliques sin excepciones de favor. Si tienes dudas sobre un caso concreto, consúltalo con tu asesoría.",
        },
        {
          question: "¿Cómo cobro la señal?",
          answer:
            "Como cobres el resto: transferencia, pago con tarjeta en el local o un enlace de pago de tu banco. Da siempre un justificante, aunque sea un mensaje con el importe y la fecha.",
        },
      ]}
      relacionadas={[
        { href: "/blog/lista-de-espera-huecos-libres", titulo: "Lista de espera para huecos libres", texto: "Qué hacer con el hueco que deja una cancelación." },
        { href: "/herramientas/plantillas-recordatorio-de-cita", titulo: "Plantillas de recordatorio de cita", texto: "Confirmación, recordatorio y cancelación, por sector." },
        { href: "/herramientas/guion-para-atender-el-telefono", titulo: "Guion para atender el teléfono", texto: "Cómo decir la política al dar la cita." },
      ]}
      cierre="Menos huecos vacíos, sin perseguir a nadie."
    >
      <Seccion id="generador" titulo="Genera tu política">
        <GeneradorPoliticaCancelacion />
      </Seccion>

      <Seccion
        fondo
        titulo="Lo que dice la ley, en cuatro líneas"
        entradilla={
          <p>
            Si tu cliente es un particular, tu política la regula la ley de consumidores (TRLGDCU). Esto es una
            explicación para decidir bien, no asesoría jurídica.
          </p>
        }
      >
        <ListaCheck
          items={[
            <>
              <strong>Se conoce antes de reservar</strong> (art. 80.1.b): dila al dar la cita y ponla por escrito.
            </>,
            <>
              <strong>Proporcionada</strong> (art. 85.6): nada de una «indemnización desproporcionadamente alta»; una
              señal que cubra parte del precio se defiende mejor que el precio entero.
            </>,
            <>
              <strong>Recíproca</strong> (art. 87.2): si anulas tú, devuelves la señal y compensas con lo mismo.
            </>,
            <>
              <strong>Si es abusiva, no existe</strong> (art. 83): se tiene por no puesta y la señal se devuelve.
            </>,
          ]}
        />
      </Seccion>

      <Seccion titulo="Para decidir con calma">
        <div className="grid gap-4">
          <Plegado titulo="Las cuatro decisiones, una a una">
            <Tarjetas
              columnas={2}
              items={[
                {
                  icono: Clock,
                  titulo: "El plazo para anular",
                  texto:
                    "Piensa en cuánto tardas en llenar un hueco. Un corte de media hora se recoloca en una tarde; un juego de extensiones de tres horas, no. Cuanto más largo el servicio, más plazo pides. Un plazo que nadie puede cumplir no se respeta: se ignora.",
                },
                {
                  icono: HandCoins,
                  titulo: "La señal",
                  texto:
                    "Reduce las citas a las que no vienen, pero también las reservas: hay quien no quiere pagar por adelantado. Por eso suele funcionar mejor en lo que más duele perder (servicios largos, primeras visitas) que en todo. Siempre se descuenta del precio.",
                },
                {
                  icono: UserX,
                  titulo: "Lo que pasa si no vienen",
                  texto:
                    "Escalonado funciona mejor que duro: la primera vez, un aviso; si se repite, señal; y solo después, dejar de dar cita. La clienta de diez años que falla una vez no es el cliente que falla cada mes.",
                },
                {
                  icono: Hourglass,
                  titulo: "Los retrasos",
                  texto:
                    "Un margen de cortesía, diez o quince minutos, y qué pasa después: acortar el servicio o dar otra hora. Escribirlo evita la discusión en el mostrador con quien viene detrás esperando.",
                },
              ]}
            />
          </Plegado>
          <Plegado titulo="Ejemplos por sector">
            <Tabla
              cabecera={["Sector", "Plazo", "Señal", "Si no viene", "Por qué"]}
              filas={EJEMPLOS_DE_POLITICA.map(({ nombre, valores, porQue }) => {
                const v = { ...POLITICA_POR_DEFECTO, ...valores };
                return [nombre, `${v.antelacion} h`, describirSenal(v), describirSiNoViene(v), porQue];
              })}
            />
          </Plegado>
          <Plegado titulo="Cómo contarla sin sonar a amenaza">
            <Texto>
              <p>
                Una política se cumple cuando el cliente la entiende y le parece justa. El tono importa tanto como el plazo:
                «si no puedes venir, avísanos con 24 horas y le damos tu hora a otra persona» se acepta; «las cancelaciones
                con menos de 24 horas se cobrarán» suena a multa, aunque diga casi lo mismo.
              </p>
              <p>
                Por teléfono, basta una frase al final, cuando ya está todo apuntado. En el mostrador, el cartel a la vista
                de la caja, no en la puerta del baño. En la web, junto al botón o el teléfono de reservas. Y en el mensaje de
                confirmación, la frase corta que da el generador.
              </p>
            </Texto>
            <ListaCheck
              items={[
                "Aplícala igual a todos. Perdonar a unos y cobrar a otros crea más mal ambiente que no tener política.",
                "Cuando alguien avise a tiempo, dale las gracias. Es el comportamiento que quieres que repita.",
                "Revisa la política cada temporada: si ya casi nadie falta, quizá sobra la señal.",
              ]}
            />
          </Plegado>
        </div>
      </Seccion>

      <LoQueHaceAlhabla titulo="Qué hace Alhabla con tu política, y qué no" regla>
        <p>
          La recepcionista se la explica a quien pregunta (la pegas en <strong>Información para responder</strong>) y tus
          clientes cambian o anulan su cita por teléfono o por WhatsApp. No cobra señales ni bloquea a nadie.
        </p>
      </LoQueHaceAlhabla>

      <Fuentes
        consultadas="2026-10-20"
        fuentes={[
          {
            nombre: "Real Decreto Legislativo 1/2007 (TRLGDCU), arts. 80, 82, 83, 85 y 87 (BOE)",
            url: "https://www.boe.es/buscar/act.php?id=BOE-A-2007-20555",
          },
        ]}
      />
    </PaginaGuia>
  );
}
