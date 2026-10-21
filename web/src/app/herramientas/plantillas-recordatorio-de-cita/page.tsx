import Link from "next/link";
import { BellRing, CalendarCheck, CalendarClock, MessageSquareText, RefreshCw, Users } from "lucide-react";
import { ExploradorDePlantillas } from "@/components/herramientas/explorador-de-plantillas";
import { Fuentes, ListaCheck, Nota, PaginaGuia, Seccion, Tabla, Tarjetas, Texto } from "@/components/pagina-guia";
import { plans } from "@/lib/plans";
import { metadataDePagina } from "@/lib/seo";

/**
 * Plantillas de recordatorio de cita (2026-10-20). Responde a lo que sale en
 * el autocompletado: «mensaje para confirmar cita de uñas», «mensaje de
 * recordatorio de cita de uñas», «frases de confirmación de citas» y
 * «recordatorio de citas por whatsapp gratis».
 *
 * Lo legal está comprobado en el texto de cada norma (consultado hoy):
 * RGPD art. 6.1.b, LSSI art. 21 y la guía de la AEPD para el sector
 * sanitario (apartados 5 y 7.C). Lo de los SMS (GSM-7, remitente
 * alfanumérico), en la documentación de Twilio. Lo que hace Alhabla sale
 * de backend/src/modules/whatsapp/mensajesCliente.ts: confirmación en todos
 * los planes si el cliente acepta mensajes en la llamada, recordatorio 24 h
 * antes (si la cita está a más de 24 h) con botones Confirmo, Cancelar y
 * Cambiar en los planes que incluyen recordatorios, hueco libre, y cambio o
 * cancelación cuando el dueño lo pide desde el Gestor.
 */
const ruta = "/herramientas/plantillas-recordatorio-de-cita";
const titulo = "Plantillas para confirmar y recordar citas por WhatsApp y SMS";
const descripcion =
  "Mensajes gratis para confirmar, recordar, cambiar y anular citas por WhatsApp y SMS, por sector: peluquería, uñas, estética, fisioterapia y más.";

export const metadata = metadataDePagina({
  ruta,
  titulo: "Mensajes para confirmar y recordar citas: plantillas",
  descripcion,
});

// Los planes que incluyen recordatorios, por su nombre en lib/plans.ts: el
// primero que los nombra y los siguientes, que dicen «Todo lo de …».
const primeroConRecordatorio = plans.findIndex((plan) => plan.features.some((f) => f.startsWith("Recordatorios")));
const planesConRecordatorio = primeroConRecordatorio >= 0 ? plans.slice(primeroConRecordatorio) : [];
const nombresConRecordatorio = planesConRecordatorio.map((plan) => plan.name).join(" y ");

export default function PlantillasRecordatorioPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      migas={[
        { name: "Herramientas", path: "/herramientas" },
        { name: "Plantillas de recordatorio", path: ruta },
      ]}
      etiqueta={{ icono: MessageSquareText, texto: "Herramienta gratis" }}
      titulo={titulo}
      descripcion={descripcion}
      ubicacion="plantillas_recordatorio"
      ctaSecundario={{ texto: "Ir a las plantillas", href: "#plantillas" }}
      entradilla={
        <p>
          Un mensaje para cada momento de una cita: cuando se reserva, uno o dos días antes, si cambia la hora, si se
          anula y cuando se libera un hueco. Para ocho sectores, en versión WhatsApp y en SMS de un solo mensaje. Las
          copias, cambias lo que quieras y las mandas. Sin registrarte.
        </p>
      }
      faqs={[
        {
          question: "¿Necesito el consentimiento del cliente para mandarle un recordatorio?",
          answer:
            "No para avisarle de una cita que ha pedido él: el RGPD permite tratar sus datos cuando es necesario para ejecutar el contrato (art. 6.1.b), y recordarle la hora forma parte de darle el servicio. Lo que sí debes es decirle, al tomar su teléfono, que lo usarás para eso. Si al recordatorio le añades una promoción, la cosa cambia: entra la LSSI.",
        },
        {
          question: "¿Puedo aprovechar el recordatorio para anunciar una oferta?",
          answer:
            "Mejor no. Un descuento convierte el mensaje en comunicación comercial, y el artículo 21 de la LSSI prohíbe enviarla por medios electrónicos sin que el cliente la haya pedido o autorizado. Hay una excepción para clientes que ya te compraron algo parecido, pero exige ofrecer en cada mensaje una forma sencilla y gratuita de darse de baja. Manda las ofertas aparte y deja el recordatorio limpio.",
        },
        {
          question: "¿Cuánto antes envío el recordatorio?",
          answer:
            "Entre 24 y 48 horas antes. Para servicios largos (color, extensiones, rituales de spa) conviene acercarse a las 48 horas, porque si el cliente avisa de que no viene te queda tiempo para ofrecer el hueco. Para un corte de barbería, con 24 horas basta.",
        },
        {
          question: "¿Por qué los SMS no llevan tildes en algunas palabras?",
          answer:
            "Porque un SMS cabe en 160 caracteres solo si todo el texto está en el alfabeto GSM-7, que tiene la é pero no la á, la í, la ó ni la ú. Con una sola de esas, el mensaje se parte en trozos de 70 caracteres y pagas dos o tres SMS. Las plantillas están escritas para no necesitarlas; ojo con «sábado» al rellenar el día.",
        },
        {
          question: "¿Puedo enviarlas gratis desde WhatsApp Business?",
          answer:
            "Sí. Desde la aplicación WhatsApp Business las copias y las envías a mano, una a una. Lo que la aplicación no hace es mandarlas sola en el momento justo, porque no sabe qué citas tienes. Para eso hace falta conectar WhatsApp a tu agenda.",
        },
        {
          question: "¿Y si el cliente no contesta al recordatorio?",
          answer:
            "La cita sigue en pie. No la anules sin que el cliente lo diga: un recordatorio sin respuesta es una señal, no una cancelación. Si es alguien que ya ha faltado otras veces, puedes llamarle el día antes o tener preparado a alguien de la lista de espera.",
        },
        {
          question: "En fisioterapia, ¿puedo poner el nombre del fisioterapeuta?",
          answer:
            "La guía de la AEPD habla de dar la mínima información para identificar la cita: día, hora, centro y unidad. Quién atiende ayuda al paciente y no revela por qué viene; el tratamiento, la zona o el motivo de la consulta sí, y eso no debe aparecer. Por eso las plantillas de fisioterapia no llevan el campo del servicio.",
        },
      ]}
      relacionadas={[
        { href: "/blog/recordatorios-de-citas-por-whatsapp", titulo: "Recordatorios de citas por WhatsApp", texto: "La secuencia de avisos y qué medir cada mes." },
        { href: "/herramientas/politica-de-cancelacion", titulo: "Generador de política de cancelación", texto: "La frase que va al final de la confirmación, con tus plazos." },
        { href: "/blog/lista-de-espera-huecos-libres", titulo: "Lista de espera para huecos libres", texto: "Cómo se llena y quién se queda el hueco." },
        { href: "/blog/whatsapp-business-para-citas", titulo: "WhatsApp Business para citas", texto: "App o plataforma, y cómo dejarla bien configurada." },
        { href: "/integraciones/whatsapp", titulo: "WhatsApp en Alhabla", texto: "Lo que tu recepcionista manda sola a tus clientes." },
      ]}
      cierre="Que los recordatorios salgan solos, a su hora."
    >
      <Seccion
        titulo="Qué tiene que llevar un mensaje de confirmación"
        entradilla={
          <p>
            Una confirmación buena se lee en cinco segundos y no deja dudas. Este es el ejemplo de un salón de uñas,
            desmontado pieza a pieza.
          </p>
        }
      >
        <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-start">
          <figure className="rounded-3xl bg-lavado p-6">
            <p className="text-sm leading-7 text-tinta">
              Hola Laura, tu cita en Nails Studio Ana está confirmada: jueves 23 a las 17:30, manicura semipermanente
              con Marta. Si llevas gel, acrílico o semipermanente de otro salón, avísanos por aquí para reservar tiempo
              de retirada. Para cambiar la cita, responde a este mensaje.
            </p>
            <figcaption className="mt-4 text-xs leading-5 text-muted">
              Ejemplo ilustrativo; el negocio y los nombres son inventados.
            </figcaption>
          </figure>
          <ListaCheck
            items={[
              <>
                <strong>El nombre del cliente</strong> al principio. Así sabe que el mensaje es para él y no un envío
                masivo.
              </>,
              <>
                <strong>Quién escribe.</strong> El nombre del negocio, aunque te tenga guardado: muchos clientes van a
                varios sitios.
              </>,
              <>
                <strong>Día, hora, servicio y profesional</strong>, en ese orden. Es lo que buscará cuando vuelva a
                abrir el chat la víspera.
              </>,
              <>
                <strong>Una pregunta propia del oficio</strong>, si evita un problema el día de la cita: la retirada en
                uñas, venir sin maquillaje en pestañas.
              </>,
              <>
                <strong>Cómo cambiarla</strong>, con una salida fácil. Un cliente que sabe cómo avisar avisa; uno que
                no sabe, simplemente no viene.
              </>,
              <>
                <strong>Nada más.</strong> Ni ofertas, ni enlaces a redes, ni normas en mayúsculas. Lo que pongas de
                más es lo que no se lee.
              </>,
            ]}
          />
        </div>
      </Seccion>

      <Seccion
        id="plantillas"
        fondo
        titulo="Las plantillas, por sector"
        entradilla={
          <>
            <p>
              Lo que va entre llaves se cambia por los datos de cada cita: {"{nombre}"}, {"{día}"}, {"{hora}"},{" "}
              {"{servicio}"}, {"{profesional}"} y {"{negocio}"}. Los SMS llevan además {"{teléfono}"}, porque a
              muchos SMS no se puede responder.
            </p>
            <p>Si escribes arriba el nombre de tu negocio y tu teléfono, se ponen solos en todas.</p>
          </>
        }
      >
        <ExploradorDePlantillas />
      </Seccion>

      <Seccion titulo="Cuándo enviar cada uno">
        <Tabla
          cabecera={["Momento", "Cuándo", "Para qué sirve"]}
          filas={[
            [
              "Confirmación",
              "Nada más cerrar la cita, por teléfono o en el mostrador.",
              "Que el cliente tenga por escrito lo que se acordó. Si apuntó mal la hora, lo verá ahora y no el día de la cita.",
            ],
            [
              "Recordatorio",
              "Entre 24 y 48 horas antes. Más cerca de 48 en servicios largos.",
              "Detectar a tiempo a quien no va a venir. Es el mensaje que más ausencias evita, porque deja margen para dar el hueco.",
            ],
            [
              "Cambio de hora",
              "En cuanto se mueve la cita, la mueva el cliente o la muevas tú.",
              "Que la cita vieja no se quede en la cabeza de nadie. Si el cambio lo pides tú, empieza disculpándote.",
            ],
            [
              "Cancelación",
              "Al anularla, aunque la haya anulado el propio cliente.",
              "Cerrar la conversación sin dudas y dejarle la puerta abierta para reservar otra.",
            ],
            [
              "Hueco libre",
              "Cuando alguien cancela y tienes clientes esperando esa franja.",
              "Llenar el hueco. Dilo claro: el hueco es para quien conteste primero, y no se reserva hasta que diga que sí.",
            ],
          ]}
          nota="Tres mensajes por cita como mucho: confirmación, recordatorio y, si hace falta, el de cambio. Más que eso se vuelve ruido."
        />
      </Seccion>

      <Seccion
        fondo
        titulo="WhatsApp o SMS"
        entradilla={<p>Los dos sirven. Cambia lo que cabe, lo que cuesta y si el cliente puede contestarte.</p>}
      >
        <Texto>
          <p>
            <strong>WhatsApp</strong> es donde ya hablan tus clientes, admite textos largos y el cliente responde en el
            mismo chat. Por eso las versiones de WhatsApp incluyen el detalle del oficio y terminan con «responde a este
            mensaje». Si lo mandas a mano desde la aplicación WhatsApp Business, no cuesta nada; lo que cuesta es el rato
            de enviarlos uno a uno.
          </p>
          <p>
            <strong>El SMS</strong> llega a todos, también a quien no tiene WhatsApp, pero tiene dos trampas. La
            primera, la longitud: cabe en 160 caracteres solo si todo el texto está en el alfabeto GSM-7, que incluye la
            «é», la «ñ», «¿» y «¡», pero no la «á», la «í», la «ó» ni la «ú». Con una sola de ellas el teléfono lo manda
            en trozos de 70, y cada trozo se paga como un SMS. Por eso las plantillas de SMS evitan esas vocales, y por
            eso conviene escribir «sabado» sin tilde al rellenar el día.
          </p>
          <p>
            La segunda trampa es la respuesta. Si mandas los SMS desde una plataforma con el nombre del negocio como
            remitente, en lugar de un número, el cliente no puede contestar: es un envío de una sola dirección. Por eso
            los SMS piden llamar a un teléfono en lugar de «responde a este mensaje».
          </p>
        </Texto>
      </Seccion>

      <Seccion titulo="Lo que dice la ley de estos mensajes">
        <div className="grid gap-4 lg:grid-cols-2">
          <Nota tipo="info" titulo="El recordatorio no necesita consentimiento aparte">
            El RGPD considera lícito el tratamiento necesario «para la ejecución de un contrato en el que el interesado
            es parte» (art. 6.1.b). Avisar de la cita que el cliente ha pedido es parte del servicio. Lo que sí debes
            hacer es decirle, al tomar su teléfono, que lo usarás para avisarle.
          </Nota>
          <Nota tipo="importante" titulo="Sin promociones dentro">
            En cuanto el mensaje anuncia un descuento o un servicio nuevo, es una comunicación comercial, y el artículo
            21 de la LSSI prohíbe enviarla por medios electrónicos si el cliente no la ha pedido o autorizado. La
            excepción para clientes habituales obliga a ofrecer en cada envío una forma sencilla y gratuita de darse de
            baja. Más fácil: el recordatorio, limpio.
          </Nota>
          <Nota tipo="importante" titulo="Fisioterapia: la mínima información">
            La guía de la AEPD para profesionales sanitarios pide facilitar «la mínima información posible para
            identificar la cita (día, hora, centro, unidad)» y no mencionar síntomas, enfermedad ni tratamientos. Por
            eso esas plantillas no llevan el servicio.
          </Nota>
          <Nota tipo="consejo" titulo="WhatsApp en un centro sanitario">
            La misma guía permite usar el teléfono del paciente para recordarle la cita, también por mensajería, siempre
            que el mensaje le llegue solo a él y no a un grupo. Y pide ofrecer siempre otro canal a quien no quiera
            WhatsApp: el SMS o una llamada.
          </Nota>
        </div>
      </Seccion>

      <Seccion
        fondo
        titulo="Lo que manda Alhabla sin que lo escribas tú"
        entradilla={
          <p>
            Si las llamadas las atiende tu <Link href="/" className="font-semibold text-morado-tinta underline underline-offset-4">recepcionista de IA</Link>,
            parte de esta página deja de ser trabajo tuyo. Los mensajes salen por WhatsApp con un texto ya aprobado
            por WhatsApp. Para cambiar o anular la cita, el cliente escribe por WhatsApp a la recepcionista o llama
            desde el número con el que reservó; en los planes {nombresConRecordatorio}, también puede usar los botones
            del recordatorio.
          </p>
        }
      >
        <Tarjetas
          columnas={2}
          items={[
            {
              icono: CalendarCheck,
              antetitulo: "Todos los planes",
              titulo: "Confirmación al reservar",
              texto: "Antes de reservar, la recepcionista pregunta al cliente si le manda la confirmación por WhatsApp. Si acepta, en cuanto cierra la cita le llegan el día, la hora, el servicio y el profesional.",
            },
            {
              icono: BellRing,
              antetitulo: `Planes ${nombresConRecordatorio}`,
              titulo: "Recordatorio 24 horas antes",
              texto: "Si la cita se reservó con más de un día de margen, le llega 24 horas antes con tres botones: Confirmo, Cancelar y Cambiar. Se revisa antes de salir: si la cita ya no existe o ha cambiado, no se manda un aviso que no dice la verdad.",
            },
            {
              icono: RefreshCw,
              antetitulo: "Todos los planes",
              titulo: "Cambio y cancelación",
              texto: "El cliente puede cambiar o anular su cita llamando desde el mismo número o escribiendo a la recepcionista por WhatsApp. Y si la mueves o la anulas tú escribiendo al Gestor, puedes pedir que se le avise con el mensaje de cambio o de cancelación.",
            },
            {
              icono: Users,
              antetitulo: "Todos los planes",
              titulo: "Hueco libre",
              texto: "Si la hora que pide un cliente está ocupada y no le encaja ninguna otra, la recepcionista le ofrece avisarle por WhatsApp si se libera; si alguien la deja libre, le llega el aviso para que la coja.",
            },
          ]}
        />
        <p className="mt-6 flex items-start gap-2 text-sm leading-6 text-muted">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-morado" aria-hidden="true" />
          Las citas que apuntas tú a mano en el calendario no reciben estos mensajes: para esas siguen sirviendo las
          plantillas de arriba.
        </p>
      </Seccion>

      <Fuentes
        consultadas="2026-10-20"
        fuentes={[
          { nombre: "Reglamento General de Protección de Datos, art. 6 (BOE)", url: "https://www.boe.es/buscar/doc.php?id=DOUE-L-2016-80807" },
          { nombre: "Ley 34/2002 (LSSI), art. 21 (BOE)", url: "https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758" },
          { nombre: "AEPD: Guía para profesionales del sector sanitario (PDF)", url: "https://www.aepd.es/guias/guia-profesionales-sector-sanitario.pdf" },
          { nombre: "Twilio: alfabeto GSM-7 y límite de 160 caracteres", url: "https://www.twilio.com/docs/glossary/what-is-gsm-7-character-encoding" },
          { nombre: "Twilio: UCS-2 y mensajes de 70 caracteres", url: "https://www.twilio.com/docs/glossary/what-is-ucs-2-character-encoding" },
          { nombre: "Twilio: los remitentes alfanuméricos no admiten respuesta", url: "https://www.twilio.com/docs/numbers-and-senders/alphanumeric-senders" },
        ]}
      />
    </PaginaGuia>
  );
}
