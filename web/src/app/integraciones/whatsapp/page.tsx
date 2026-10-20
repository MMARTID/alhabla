import { MessageCircle } from "lucide-react";
import { Conversacion, Fuentes, Nota, PaginaGuia, Seccion, Tabla, Texto } from "@/components/pagina-guia";
import { metadataDePagina } from "@/lib/seo";

/**
 * WhatsApp con los clientes del negocio (2026-10-20). El Gestor (dueño ↔
 * Alhabla) tiene su página, /agenda-por-whatsapp; aquí va lo que reciben los
 * clientes. Hoy los mensajes salen del WhatsApp «Alhabla Reservas»
 * (PLAN-WHATSAPP-COEXISTENCIA.md: el número propio del negocio es una opción
 * en preparación, así que no se promete). Recordatorios solo en Pro y Scale
 * (lib/plans.ts).
 */
const ruta = "/integraciones/whatsapp";
const titulo = "WhatsApp para confirmar y recordar citas";
const descripcion =
  "Cada cita que reserva tu recepcionista de IA se confirma por WhatsApp, se recuerda antes de venir y se cambia respondiendo al mensaje. Cómo funciona.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

export default function WhatsappIntegracionPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      migas={[
        { name: "Integraciones", path: "/integraciones" },
        { name: "WhatsApp", path: ruta },
      ]}
      etiqueta={{ icono: MessageCircle, texto: "WhatsApp" }}
      titulo={titulo}
      descripcion={descripcion}
      ubicacion="integracion_whatsapp"
      entradilla={
        <p>
          En España casi todo el mundo mira WhatsApp antes que el correo. Por eso, cuando la recepcionista cierra una
          cita por teléfono, la confirmación llega por WhatsApp: servicio, día, hora y con quién. Y si el cliente
          necesita moverla, contesta al mensaje en lugar de volver a llamar.
        </p>
      }
      faqs={[
        {
          question: "¿Desde qué número les llegan los mensajes a mis clientes?",
          answer:
            "Desde el WhatsApp de empresa «Alhabla Reservas», con el nombre de tu negocio en el mensaje. Así no tienes que dar de alta tu número en la plataforma de WhatsApp para empresas ni pagar por mensaje.",
        },
        {
          question: "¿Y si el cliente no tiene WhatsApp o no quiere mensajes?",
          answer:
            "Antes de enviar nada, la recepcionista pregunta si puede mandar la confirmación a ese número. Si dice que no, la cita queda igual de reservada en tu calendario y simplemente no se envía.",
        },
        {
          question: "¿Cuánto cuesta enviar los mensajes?",
          answer:
            "Nada aparte. La confirmación va en todos los planes y los recordatorios en Pro y Scale. Los mensajes que WhatsApp cobra a las empresas los paga Alhabla.",
        },
        {
          question: "¿Puedo escribir yo a un cliente desde ahí?",
          answer:
            "No: ese número es de la recepcionista y responde ella. Para hablar tú con un cliente, usa tu WhatsApp de siempre. Para cambiar tu agenda, escríbele al Gestor.",
        },
        {
          question: "¿Es legal mandar recordatorios de cita por WhatsApp?",
          answer:
            "Sí, cuando son eso: avisos sobre una cita que el cliente ha pedido. Lo que no deben llevar es publicidad, porque entonces pasan a ser comunicaciones comerciales y necesitan otro consentimiento. Lo explicamos con detalle en la guía legal.",
        },
      ]}
      relacionadas={[
        { href: "/agenda-por-whatsapp", titulo: "El Gestor por WhatsApp", texto: "Tu lado: cambiar horarios, ausencias y citas escribiendo." },
        { href: "/herramientas/plantillas-recordatorio-de-cita", titulo: "Plantillas de recordatorio de cita", texto: "Si los envías tú, textos listos para copiar." },
        { href: "/blog/recordatorios-de-citas-por-whatsapp", titulo: "Cuándo enviar los recordatorios" },
        { href: "/guias/ley-y-recepcionista-de-ia", titulo: "La ley y la recepcionista de IA" },
      ]}
      cierre="Que tus clientes no tengan que volver a llamar."
    >
      <Seccion titulo="Lo que recibe tu cliente">
        <Tabla
          cabecera={["Momento", "Qué le llega", "Plan"]}
          filas={[
            ["Al colgar", "La confirmación: servicio, día, hora y profesional.", "Todos"],
            ["Antes de la cita", "Un recordatorio con los botones «Cambiar» y «Cancelar».", "Pro y Scale"],
            ["Si responde para cambiarla", "La recepcionista le ofrece otra hora libre y mueve la cita en tu calendario.", "Todos"],
            ["Si cancela", "Confirmación de la anulación; el hueco queda libre para otro cliente.", "Todos"],
            ["Si estaba en lista de espera", "Aviso del hueco libre con «Sí, resérvala» o «Ya no».", "Todos"],
          ]}
        />
      </Seccion>

      <Seccion fondo titulo="Así se ve un cambio de hora por WhatsApp">
        <div className="grid gap-8 lg:grid-cols-2">
          <Texto>
            <p>
              La clienta reservó por teléfono para el jueves y le ha surgido algo. No llama: pulsa «Cambiar» en el recordatorio o responde al mensaje. La
              recepcionista mira tu agenda real, le propone dos horas libres y, cuando elige, mueve la cita en tu
              calendario. Tú no tienes que hacer nada; lo verás en el panel y en tu calendario.
            </p>
            <p>
              Si el cambio no cabe (no hay huecos esa semana con su estilista), se lo dice y le ofrece apuntarse a la
              lista de espera.
            </p>
          </Texto>
          <Conversacion
            etiqueta="Ejemplo de cambio de cita por WhatsApp"
            turnos={[
              { quien: "recepcionista", texto: "Hola, Lucía. Te recordamos tu cita en Peluquería Sol: mechas el jueves a las 17:30 con Marta." },
              { quien: "cliente", texto: "Hola! Me viene fatal el jueves, ¿hay algo el viernes?" },
              { quien: "recepcionista", texto: "El viernes Marta tiene hueco a las 10:00 o a las 16:30. ¿Cuál prefieres?" },
              { quien: "cliente", texto: "A las 16:30 perfecto" },
              { quien: "recepcionista", texto: "Hecho: mechas el viernes a las 16:30 con Marta. ¡Hasta el viernes!" },
            ]}
          />
        </div>
      </Seccion>

      <Seccion titulo="Por qué los mensajes son siempre los mismos" estrecha>
        <Texto>
          <p>
            WhatsApp no deja a las empresas escribir lo que quieran a un cliente que no les ha escrito antes: cada aviso
            que inicia la empresa tiene que ser una plantilla aprobada por Meta. Por eso las confirmaciones y los
            recordatorios tienen siempre la misma forma, con los datos de la cita rellenados. Cuando el cliente
            contesta, se abre una conversación y la recepcionista ya puede responderle con libertad durante 24 horas.
          </p>
          <p>
            Para ti tiene una ventaja: no tienes que redactar nada ni acordarte de enviar los recordatorios. Y si
            prefieres mandarlos tú desde tu WhatsApp Business, en las{" "}
            <a href="/herramientas/plantillas-recordatorio-de-cita">plantillas de recordatorio</a> tienes textos listos.
          </p>
        </Texto>
        <div className="mt-6">
          <Nota tipo="consejo" titulo="Y el dueño, ¿también recibe avisos?">
            Sí, si conectas tu móvil en Ajustes › Teléfono: Alhabla te avisa de las citas nuevas por WhatsApp desde su
            número para negocios, el mismo en el que hablas con el <a className="font-semibold underline" href="/agenda-por-whatsapp">Gestor</a>.
          </Nota>
        </div>
      </Seccion>

      <Fuentes
        consultadas="2026-10-20"
        fuentes={[
          { nombre: "WhatsApp Business: plantillas de mensajes", url: "https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates" },
          { nombre: "Ley 34/2002 (LSSI), art. 21: comunicaciones comerciales", url: "https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758" },
        ]}
      />
    </PaginaGuia>
  );
}
