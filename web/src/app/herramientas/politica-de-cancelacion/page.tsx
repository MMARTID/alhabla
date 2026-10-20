import Link from "next/link";
import { CalendarX, Clock, HandCoins, Hourglass, UserX } from "lucide-react";
import { GeneradorPoliticaCancelacion } from "@/components/herramientas/generador-politica-cancelacion";
import { EJEMPLOS_DE_POLITICA, POLITICA_POR_DEFECTO, type Politica } from "@/components/herramientas/politica-de-cancelacion";
import { Fuentes, ListaCheck, Nota, PaginaGuia, Seccion, Tabla, Tarjetas, Texto } from "@/components/pagina-guia";
import { plans } from "@/lib/plans";
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
 * señales ni lleva la cuenta de ausencias; la política se puede pegar en
 * «Información para responder» (frontend, agente › información).
 */
const ruta = "/herramientas/politica-de-cancelacion";
const titulo = "Generador de política de cancelación y ausencias";
const descripcion =
  "Crea la política de cancelación de tu salón o clínica: plazo, señal y ausencias, con textos para el cartel, la web y la confirmación. Gratis.";

export const metadata = metadataDePagina({
  ruta,
  titulo: "Política de cancelación: generador gratis para salones",
  descripcion,
});

// Los planes con recordatorio por WhatsApp, por su nombre en lib/plans.ts,
// como en plantillas-recordatorio-de-cita: el primero que los nombra y los
// siguientes, que dicen «Todo lo de …».
const primeroConRecordatorio = plans.findIndex((plan) => plan.features.some((f) => f.startsWith("Recordatorios")));
const nombresConRecordatorio = (primeroConRecordatorio >= 0 ? plans.slice(primeroConRecordatorio) : [])
  .map((plan) => plan.name)
  .join(" y ");

function describirSenal(v: Politica) {
  if (v.senal === "no") return "Sin señal";
  const cuanto = v.senal === "fija" ? `${v.cantidad} €` : `${v.cantidad} %`;
  const aQue = v.ambito === "largos" ? `en servicios de más de ${v.minutosLargos} min` : v.ambito === "nuevos" ? "en la primera cita" : "en todas";
  return `${cuanto}, ${aQue}`;
}

function describirAusencias(v: Politica) {
  if (v.ausencias === "aviso") return "Recordarle la política";
  if (v.ausencias === "senal") return v.senal !== "no" && v.ambito === "todas" ? "Pierde la señal" : "Señal en la siguiente";
  return `Sin más citas tras ${v.maxAusencias} ausencias`;
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
          Decide con cuánta antelación se puede anular sin coste, si pides señal y qué pasa cuando alguien no viene. El
          generador escribe tres textos con tus decisiones: el del cartel del mostrador, el de tu web y la frase para el
          final del mensaje de confirmación.
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
          question: "¿Puedo cobrar la cita entera a quien no viene?",
          answer:
            "La ley no fija un porcentaje, pero considera abusiva la cláusula que impone al consumidor que no cumple una «indemnización desproporcionadamente alta» (TRLGDCU, art. 85.6), y una cláusula abusiva se tiene por no puesta. Una señal que cubra una parte del precio, conocida antes de reservar, es mucho más fácil de defender que el precio entero.",
        },
        {
          question: "Si el cliente anula a tiempo, ¿tengo que devolverle la señal?",
          answer:
            "Si tu política dice que anular con el plazo no cuesta nada, sí. Puedes ofrecerle dejarla para su próxima cita, pero que lo elija él. Quedarte la señal de quien avisó a tiempo es justo lo que hace que una política parezca una trampa.",
        },
        {
          question: "¿Y si soy yo quien tiene que anular la cita?",
          answer:
            "Devuelve la señal entera. El TRLGDCU tiene por abusiva la retención de lo que pagó el consumidor que renuncia «sin contemplar la indemnización por una cantidad equivalente si renuncia el empresario» (art. 87.2). Por eso el generador propone, por defecto, devolver la señal y compensar con la misma cantidad.",
        },
        {
          question: "¿Basta con tener el cartel en el local?",
          answer:
            "Para quien reserva en el mostrador, casi. Para quien reserva por teléfono o por WhatsApp, no: no ha visto el cartel. La ley pide que el cliente pueda conocer las condiciones antes de contratar (art. 80.1.b), así que dilo al dar la cita y ponlo en la confirmación.",
        },
        {
          question: "¿Puedo dejar de dar cita a quien falta siempre?",
          answer:
            "Es una decisión de tu negocio. Lo importante es que la norma sea igual para todos, que el cliente la conozca y que la apliques sin excepciones de favor. Si tienes dudas sobre un caso concreto, consúltalo con tu asesoría.",
        },
        {
          question: "¿Cómo cobro la señal?",
          answer:
            "Como cobres el resto: transferencia, pago con tarjeta en el local o un enlace de pago de tu banco. Alhabla no cobra señales; si las pides, la gestión del cobro es tuya.",
        },
      ]}
      relacionadas={[
        { href: "/blog/lista-de-espera-huecos-libres", titulo: "Lista de espera para huecos libres", texto: "Qué hacer con el hueco que deja una cancelación." },
        { href: "/blog/recordatorios-de-citas-por-whatsapp", titulo: "Recordatorios de citas por WhatsApp", texto: "El aviso que da margen para anular a tiempo." },
        { href: "/herramientas/plantillas-recordatorio-de-cita", titulo: "Plantillas de recordatorio de cita", texto: "Confirmación, recordatorio y cancelación, por sector." },
        { href: "/herramientas/guion-para-atender-el-telefono", titulo: "Guion para atender el teléfono", texto: "Cómo decir la política al dar la cita, sin sonar a amenaza." },
        { href: "/guias/ley-y-recepcionista-de-ia", titulo: "La ley y la recepcionista de IA", texto: "Aviso de IA, grabación y mensajes, con cada artículo." },
      ]}
      cierre="Menos huecos vacíos, sin perseguir a nadie."
    >
      <Seccion id="generador" titulo="Genera tu política">
        <GeneradorPoliticaCancelacion />
      </Seccion>

      <Seccion
        fondo
        titulo="Las cuatro decisiones, una a una"
        entradilla={<p>No hay una política buena para todos. Hay una buena para lo que dura tu servicio y lo rápido que llenas un hueco.</p>}
      >
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
                "Reduce ausencias, pero también reservas: hay quien no quiere pagar por adelantado. Por eso suele funcionar mejor en lo que más duele perder (servicios largos, primeras visitas) que en todo. Siempre se descuenta del precio.",
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
      </Seccion>

      <Seccion
        titulo="Lo que dice la ley de una política de cancelación"
        entradilla={
          <p>
            Cuando tu cliente es un particular, tu política es una cláusula que no negocias con cada uno, y eso lo regula
            el texto refundido de la Ley General para la Defensa de los Consumidores y Usuarios (TRLGDCU). Cuatro
            artículos explican casi todo.
          </p>
        }
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Nota tipo="importante" titulo="Se conoce antes de reservar (art. 80.1.b)">
            Las cláusulas deben permitir al cliente «el conocimiento previo a la celebración del contrato sobre su
            existencia y contenido». Una señal que aparece por primera vez al cobrarla no vale: dila al dar la cita y
            ponla por escrito.
          </Nota>
          <Nota tipo="importante" titulo="Proporcionada (art. 85.6)">
            Es abusiva la cláusula que suponga «la imposición de una indemnización desproporcionadamente alta» al
            consumidor que no cumple. La ley no da una cifra: se mira lo que pierdes de verdad con el hueco.
          </Nota>
          <Nota tipo="importante" titulo="Recíproca (art. 87.2)">
            Es abusivo quedarse lo pagado por el cliente que renuncia sin prever una indemnización equivalente si quien
            renuncia es el negocio. Si pides señal, escribe qué pasa cuando anulas tú.
          </Nota>
          <Nota tipo="info" titulo="Si es abusiva, no existe (art. 83)">
            Las cláusulas abusivas «serán nulas de pleno derecho y se tendrán por no puestas». Si la tuya lo es, es como
            si no la hubieras escrito, y la señal que te quedaste habría que devolverla.
          </Nota>
        </div>
        <p className="mt-6 max-w-3xl text-sm leading-6 text-muted">
          Esto es una explicación de la norma para que tomes buenas decisiones, no asesoría jurídica. Si vas a cobrar
          señales altas o tienes un caso complicado, revisa el texto con tu asesoría.
        </p>
      </Seccion>

      <Seccion
        fondo
        titulo="Ejemplos por sector"
        entradilla={
          <p>
            Son puntos de partida razonables, no la norma de ningún sector. En el generador puedes cargar cualquiera y
            cambiarlo.
          </p>
        }
      >
        <Tabla
          cabecera={["Sector", "Plazo", "Señal", "Si no viene", "Por qué"]}
          filas={EJEMPLOS_DE_POLITICA.map(({ nombre, valores, porQue }) => {
            const v = { ...POLITICA_POR_DEFECTO, ...valores };
            return [nombre, `${v.antelacion} h`, describirSenal(v), describirAusencias(v), porQue];
          })}
        />
      </Seccion>

      <Seccion titulo="Cómo contarla sin sonar a amenaza">
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
        <div className="mt-6">
          <ListaCheck
            items={[
              "Aplícala igual a todos. Perdonar a unos y cobrar a otros crea más mal ambiente que no tener política.",
              "Si cobras una señal, da un justificante, aunque sea un mensaje con el importe y la fecha.",
              "Cuando alguien avise a tiempo, dale las gracias. Es el comportamiento que quieres que repita.",
              "Revisa la política cada temporada: si ya casi nadie falta, quizá sobra la señal.",
            ]}
          />
        </div>
      </Seccion>

      <Seccion fondo titulo="Qué hace Alhabla con tu política, y qué no">
        <Texto>
          <p>
            Si tus llamadas las atiende Alhabla, pega el texto para la web en <strong>Información para responder</strong>,
            en el panel: la recepcionista la usa para contestar cuando alguien pregunta qué pasa si no puede venir. Tus
            clientes pueden cambiar o anular su cita llamando desde el mismo número con el que reservaron o escribiendo
            por WhatsApp a la recepcionista, y el hueco que dejan queda libre para la{" "}
            <Link href="/blog/lista-de-espera-huecos-libres">lista de espera</Link>. En los planes{" "}
            {nombresConRecordatorio}, además, el recordatorio llega 24 horas antes (si la cita se reservó con más
            margen) con botones para confirmar, cancelar o cambiar, a tiempo de dar el hueco a otra persona.
          </p>
          <p>
            Lo que Alhabla no hace: no cobra señales, no lleva la cuenta de las ausencias de cada cliente y no bloquea a
            nadie. Esas decisiones siguen siendo tuyas, y el mensaje de confirmación de Alhabla tiene un texto fijo: la
            frase del generador es para los mensajes que mandes tú con las{" "}
            <Link href="/herramientas/plantillas-recordatorio-de-cita">plantillas de recordatorio</Link>.
          </p>
        </Texto>
      </Seccion>

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
