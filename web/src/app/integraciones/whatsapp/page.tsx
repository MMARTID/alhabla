import { MessageCircle } from "lucide-react";
import { ChatDeWhatsapp } from "@/components/owner-assistant-chat";
import { Fuentes, PaginaGuia, Seccion, Texto } from "@/components/pagina-guia";
import { metadataDePagina } from "@/lib/seo";

/**
 * WhatsApp con los clientes del negocio (2026-10-20; reescrita el
 * 2026-10-29 con el ángulo «tus clientes no se bajan nada»). Tu asistente
 * (dueño ↔ Alhabla) tiene su página, /agenda-por-whatsapp; aquí, lo que
 * vive el cliente. Contrastado con backend/src/modules/whatsapp/:
 * - confirmación en todos los planes y recordatorio 24 h antes en Pro y
 *   Scale (mensajesCliente.ts, lib/plans.ts), con «Confirmo · Cancelar ·
 *   Cambiar» (botonesCliente.ts);
 * - la recepcionista contesta por chat a quien tiene reservas en el negocio
 *   (router.ts → conversarConRecepcionista, tenantDelCliente.ts); a quien
 *   escribe sin ninguna, una respuesta fija que le manda llamar
 *   (mensajes.ts, desconocidoEnClientes);
 * - los mensajes salen del número de clientes de Alhabla, uno para toda la
 *   plataforma, con el nombre del negocio: el número propio del negocio
 *   (PLAN-WHATSAPP-COEXISTENCIA.md) no se promete.
 */
const ruta = "/integraciones/whatsapp";
const titulo = "Citas por WhatsApp: tus clientes no se bajan nada";
const descripcion =
  "Tus clientes reciben la confirmación de su cita por WhatsApp y la cambian o cancelan contestando al mensaje. Sin apps ni webs de reservas.";

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
          Deja de pedirles que se instalen una aplicación o reserven en una web. Llaman como siempre, les llega la
          cita por WhatsApp y, si quieren cambiarla, contestan al mensaje.
        </p>
      }
      pieza={
        <ChatDeWhatsapp
          titulo="Alhabla"
          subtitulo="Mensajes de Peluquería Sol"
          etiqueta="Ejemplo de cambio de cita por WhatsApp"
          burbujas={[
            {
              de: "alhabla",
              texto: "Hola, Lucía. Te recordamos tu cita en Peluquería Sol: mechas mañana, jueves, a las 17:30 con Marta.",
              botones: ["Confirmo", "Cambiar", "Cancelar"],
              pulsado: "Cambiar",
            },
            { de: "yo", texto: "¿Hay algo el viernes por la tarde?" },
            { de: "alhabla", texto: "El viernes Marta tiene hueco a las 16:30. ¿Te la paso a esa hora?" },
            { de: "yo", texto: "Sí, perfecto" },
            { de: "alhabla", texto: "Hecho: mechas el viernes a las 16:30 con Marta.", hecho: true },
          ]}
          pie="Ejemplo; el negocio y los nombres son inventados."
        />
      }
      faqs={[
        {
          question: "¿Y si el cliente no quiere mensajes?",
          answer:
            "La recepcionista le pregunta antes si puede mandarle la confirmación a ese número. Si dice que no, la cita queda igual de reservada y no se envía nada.",
        },
        {
          question: "¿Cuánto cuestan los mensajes?",
          answer:
            "Nada aparte. La confirmación va en todos los planes y el recordatorio en Pro y Scale. Lo que WhatsApp cobra a las empresas lo paga Alhabla.",
        },
        {
          question: "¿Puedo escribir yo a un cliente desde ese chat?",
          answer:
            "No: ese chat es de la recepcionista. Para hablar tú con un cliente, tu WhatsApp de siempre; para cambiar tu agenda, tu asistente.",
        },
        {
          question: "¿Es legal mandar recordatorios por WhatsApp?",
          answer:
            "Sí, mientras sean eso: avisos de una cita que el cliente ha pedido. Si llevaran publicidad serían comunicaciones comerciales y haría falta otro consentimiento.",
        },
      ]}
      relacionadas={[
        {
          href: "/agenda-por-whatsapp",
          titulo: "Tu asistente por WhatsApp",
          texto: "Tu lado: ausencias, cierres y citas escribiendo.",
        },
        {
          href: "/herramientas/plantillas-recordatorio-de-cita",
          titulo: "Plantillas de recordatorio de cita",
          texto: "Si los mandas tú, textos listos para copiar.",
        },
        { href: "/blog/recordatorios-de-citas-por-whatsapp", titulo: "Cuándo enviar los recordatorios" },
      ]}
      cierre="Que tus clientes no tengan que volver a llamar."
    >
      <Seccion titulo="Lo que le llega a tu cliente">
        <dl className="grid gap-8 sm:grid-cols-3 sm:gap-10">
          <div className="border-t border-linea-fuerte pt-5">
            <dt className="text-base font-bold text-tinta">Al colgar</dt>
            <dd className="mt-2 text-base leading-7 text-apagado">
              La confirmación: servicio, día, hora y con quién. En todos los planes.
            </dd>
          </div>
          <div className="border-t border-linea-fuerte pt-5">
            <dt className="text-base font-bold text-tinta">El día antes</dt>
            <dd className="mt-2 text-base leading-7 text-apagado">
              Un recordatorio con «Confirmo», «Cambiar» y «Cancelar». En Pro y Scale.
            </dd>
          </div>
          <div className="border-t border-linea-fuerte pt-5">
            <dt className="text-base font-bold text-tinta">Si se libera su hora</dt>
            <dd className="mt-2 text-base leading-7 text-apagado">
              Si estaba en lista de espera, un aviso para quedársela con un toque.
            </dd>
          </div>
        </dl>
      </Seccion>

      <Seccion fondo titulo="Con tus clientes manda Alhabla.">
        <Texto>
          <p>
            Cuando un cliente contesta para cambiar o cancelar su cita, la recepcionista lo resuelve en el momento, sin
            preguntarte: busca otra hora libre y la cambia en tu agenda. Es lo único que hace sin tu visto bueno. Lo que
            toca tu agenda por tu lado lo decides tú con <a href="/agenda-por-whatsapp">tu asistente</a>.
          </p>
        </Texto>
      </Seccion>

      <Seccion titulo="Lo que todavía no hace">
        <Texto>
          <p>
            Los mensajes salen del número de WhatsApp de Alhabla, con el nombre de tu negocio dentro, no de tu número.
          </p>
          <p>
            Por chat atiende a quien ya ha pedido cita en tu negocio. A alguien que escribe por primera vez le contesta que
            llame, y al teléfono le atiende la recepcionista. Y nunca manda publicidad.
          </p>
        </Texto>
      </Seccion>

      <Fuentes
        consultadas="2026-10-20"
        fuentes={[
          { nombre: "Ley 34/2002 (LSSI), art. 21: comunicaciones comerciales", url: "https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758" },
        ]}
      />
    </PaginaGuia>
  );
}
