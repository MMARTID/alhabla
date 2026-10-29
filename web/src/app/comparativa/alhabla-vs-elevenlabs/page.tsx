import { Scale } from "lucide-react";
import { Fuentes, ListaCheck, Nota, PaginaGuia, Pasos, Seccion, Tabla } from "@/components/pagina-guia";
import {
  ALHABLA,
  CONSULTADAS,
  CUOTAS,
  FUENTE_LEY,
  MINUTOS_INCLUIDOS,
  notaSobreLaComparativa,
  preguntaDeImparcialidad,
} from "@/lib/comparativas";
import { metadataDePagina } from "@/lib/seo";

/**
 * Alhabla frente a ElevenLabs (2026-10-29), con sus dos productos por
 * separado: ElevenAgents, la plataforma para construir agentes de voz, y
 * Reception, su recepcionista para pequeños negocios (desde el 16-09-2026).
 * Publicidad comparativa del art. 10 de la Ley 3/1991 (reglas en
 * lib/comparativas.ts): cada dato sale de elevenlabs.io o reception.ai, con
 * su URL en Fuentes. Lo que no publican se escribe «No consta en su web».
 * Reception también reparte por profesional y tiene un asistente en su
 * panel: no se presenta nada de eso como exclusivo de Alhabla.
 */
const ruta = "/comparativa/alhabla-vs-elevenlabs";
const marca = "ElevenLabs";
const titulo = "Alhabla vs ElevenLabs: ElevenAgents, Reception y qué te sirve en España";
const descripcion =
  "ElevenLabs vende una plataforma de agentes de voz y una recepcionista para pymes, Reception. Frente a Alhabla: número español, calendarios, WhatsApp e idiomas, con fuentes.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

export default function VsElevenlabsPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      tipo="Article"
      migas={[
        { name: "Comparativas", path: "/comparativa" },
        { name: "Alhabla vs ElevenLabs", path: ruta },
      ]}
      etiqueta={{ icono: Scale, texto: "Comparativa" }}
      titulo={titulo}
      descripcion={descripcion}
      ubicacion="vs_elevenlabs"
      entradilla={
        <>
          <p>
            ElevenLabs tiene dos productos: ElevenAgents, para que un equipo técnico construya su agente de voz, y
            Reception, una recepcionista ya montada que da número al instante solo en EE. UU. y Canadá. Alhabla es la
            recepcionista de IA para negocios con cita en España, con número, WhatsApp y tu asistente dentro.
          </p>
          <p className="text-base">
            Con un desarrollador, ElevenAgents. Si te bastan Google Calendar y avisos por email o SMS, Reception, más
            barata de entrada. Si quieres tus clientes por WhatsApp y cambiar tu agenda desde el móvil, Alhabla.
          </p>
        </>
      }
      faqs={[
        {
          question: "¿Puedo montar con ElevenLabs lo mismo que Alhabla?",
          answer:
            "Con ElevenAgents y alguien técnico, en buena parte: contesta, mira huecos en Google Calendar y habla por WhatsApp. Construyes tú los servicios y quién hace cada uno, el número español, las plantillas de Meta y una forma de cambiar tu agenda escribiendo, que no consta.",
        },
        {
          question: "¿Qué diferencia hay entre Reception y ElevenAgents?",
          answer:
            "ElevenAgents es la plataforma: empiezas en blanco y lo decides todo. Reception, lanzada el 16 de septiembre de 2026, viene hecha para pequeños negocios: lee tu web y trae servicios con duración, reparto por profesional y un asistente en su panel que pide tu aprobación antes de cada cambio.",
        },
        {
          question: "¿ElevenLabs sale más barato?",
          answer: `De entrada, Reception sí: 29 $ al mes con 75 minutos, más impuestos. En ElevenAgents el minuto extra es de 0,08 $, pero el modelo de IA va aparte y el número lo factura tu operador; no publican un precio por minuto con todo incluido. Alhabla cuesta ${CUOTAS}, con ${MINUTOS_INCLUIDOS}.`,
        },
        {
          question: "¿Dónde trata los datos ElevenLabs?",
          answer:
            "Por defecto los aloja en EE. UU.; dejarlos en la UE es exclusivo de Enterprise. La FAQ de Reception no menciona el RGPD. Alhabla también trabaja con proveedores con transferencias fuera del EEE, con garantías: está en nuestra política de privacidad.",
        },
        preguntaDeImparcialidad(marca),
      ]}
      relacionadas={[
        { href: "/comparativa", titulo: "Todas las comparativas", texto: "Retell AI, Vapi, Bland AI y Synthflow." },
        { href: "/agenda-por-whatsapp", titulo: "Tu asistente por WhatsApp", texto: "Una ausencia a mediodía, resuelta escribiendo." },
        { href: "/integraciones", titulo: "Calendarios", texto: "Google, Outlook, iCloud o la agenda de Alhabla." },
      ]}
      cierre="Tu número de siempre contestado en español, y cada cita confirmada por WhatsApp."
    >
      <Seccion titulo="En una tabla">
        <Tabla
          cabecera={["", "Alhabla", "ElevenAgents", "Reception"]}
          destacada={1}
          filas={[
            ["Qué es", ALHABLA.queEs, "Una plataforma de agentes de voz y chat para desarrolladores y empresas", "Una recepcionista de IA ya montada para pequeños negocios, desde septiembre de 2026"],
            ["Quién lo monta", ALHABLA.quienLoMonta, "Tú, desde una plantilla en blanco", "Tú, sin saber de técnica: pegas tu web y saca servicios, personal y horarios"],
            ["Precio publicado", ALHABLA.precio, "De 0 $ (15 minutos) a 990 $ al mes (12.375); el extra, 0,08 $. El modelo de IA y el número, aparte", "29, 79 o 199 $ al mes (75, 275 o 1.000 minutos); el extra, de 0,22 a 0,40 $"],
            ["Número en España", ALHABLA.numero, "No vende números: importas el de un operador o un troncal SIP", "Tras una solicitud regulatoria con documentos del negocio; al alta te da uno de EE. UU."],
            ["Español y lenguas cooficiales", ALHABLA.idiomas, "Voces de España; sus modelos Realtime y v4 incluyen catalán y gallego, no el euskera", "Más de 70 idiomas, sin lista pública: no constan los cooficiales"],
            ["Calendarios", ALHABLA.calendarios, "Google Calendar, Cal.com y Calendly. Outlook, solo en su página comercial; iCloud no consta", "Google Calendar, Calendly o Cal.com, no Google a la vez que los otros. Outlook e iCloud no constan"],
            ["WhatsApp con el cliente", ALHABLA.whatsappCliente, "Sí, con tu cuenta de WhatsApp Business de Meta, que cobra aparte", "No figura: avisa por email y SMS. En España, el SMS pide un número tuyo de otro operador"],
            ["Asistente del dueño por WhatsApp", ALHABLA.asistente, "No consta en su web", "Tiene uno en su panel web, no por WhatsApp, y espera tu aprobación antes de cada cambio"],
          ]}
          nota="Datos de elevenlabs.io y reception.ai, enlazados en Fuentes. Precios con «$» y sin impuestos (Reception dice que son dólares); no consta en su web que facturen en euros. «No consta» quiere decir que no aparece en su web, no que no exista."
        />
      </Seccion>

      <Seccion
        fondo
        titulo="Lo que te toca montar con ElevenAgents"
        entradilla={<p>Para que conteste como la recepcionista de un salón o una clínica en España.</p>}
      >
        <Pasos
          pasos={[
            {
              titulo: "El número",
              texto:
                "No los vende: contratas uno español con un operador, lo importas o lo conectas por troncal SIP, y el operador te lo factura aparte.",
            },
            {
              titulo: "El agente",
              texto:
                "Escribes las instrucciones o dibujas el flujo, y eliges voz castellana y modelo de IA. Su ejemplo reserva reuniones de 15, 30 o 60 minutos: la duración de cada servicio y quién hace qué los defines tú.",
            },
            {
              titulo: "El calendario",
              texto:
                "Google Calendar solo le da los bloques ocupados: lo demás cuenta como libre. Outlook o iCloud no tienen integración documentada.",
            },
            {
              titulo: "WhatsApp",
              texto:
                "Cartera de negocio de Meta, un número fuera de la app WhatsApp Business, plantillas aprobadas y método de pago. Pasar la conversación a una persona, «próximamente».",
            },
          ]}
        />
        <p className="mt-8 max-w-3xl text-base leading-7 text-muted">
          Con Reception, la parte técnica la pone ElevenLabs. En España te queda pedir el número con tus documentos (o
          traer uno de un operador) y conectar otro número si quieres mandar SMS.
        </p>
      </Seccion>

      <Seccion titulo="Cuándo elegir ElevenLabs">
        <ListaCheck
          items={[
            "Tienes un desarrollador y quieres el mismo agente en el teléfono, WhatsApp y otros canales, con API y herramientas propias.",
            "Mueves mucho volumen: en ElevenAgents el minuto extra cuesta 0,08 $, con el modelo de IA aparte.",
            "Quieres probar sin pagar: ElevenAgents tiene un plan gratis de 15 minutos, y Reception, 14 días sin tarjeta.",
            "Te vale Google Calendar y buscas lo más barato para empezar: Reception parte de 29 $ al mes, con reparto por profesional.",
            "Tu empresa exige certificaciones: ElevenLabs declara SOC 2 e ISO 27001, y en Enterprise los datos pueden quedarse en la UE.",
          ]}
        />
      </Seccion>

      <Seccion fondo titulo="Cuándo elegir Alhabla">
        <ListaCheck
          items={[
            "Quieres el número español incluido y desviar a él el tuyo de siempre, sin contratar otro operador.",
            "Tu agenda está en Outlook o iCloud, o no usas ninguna y te sirve la de Alhabla.",
            "Quieres que cada cliente reciba su cita por WhatsApp y conteste ahí para cambiarla.",
            "Prefieres escribir a tu asistente por WhatsApp entre cliente y cliente, sin abrir un panel: le dices quién falta y te ayuda a recolocar sus citas.",
            "Tus clientes hablan catalán, euskera o gallego.",
            `Prefieres pagar en euros: ${CUOTAS}.`,
          ]}
        />
        <div className="mt-8 max-w-3xl">
          <Nota titulo="Sobre esta comparativa">{notaSobreLaComparativa(marca)}</Nota>
        </div>
      </Seccion>

      <Fuentes
        consultadas={CONSULTADAS}
        fuentes={[
          { nombre: "ElevenAgents: qué es", url: "https://elevenlabs.io/docs/eleven-agents/overview" },
          { nombre: "ElevenAgents: primeros pasos", url: "https://elevenlabs.io/docs/eleven-agents/quickstart" },
          { nombre: "ElevenAgents: precios", url: "https://elevenlabs.io/pricing/agents" },
          { nombre: "ElevenAgents: modelos Realtime", url: "https://elevenlabs.io/docs/eleven-agents/customization/realtime-models" },
          { nombre: "ElevenAgents: números de teléfono", url: "https://elevenlabs.io/docs/eleven-agents/api-reference/phone-numbers/create" },
          { nombre: "ElevenAgents: Google Calendar", url: "https://elevenlabs.io/docs/eleven-agents/customization/integrations/google_calendar" },
          { nombre: "ElevenAgents: Cal.com", url: "https://elevenlabs.io/docs/eleven-agents/customization/integrations/calcom" },
          { nombre: "ElevenAgents: Calendly", url: "https://elevenlabs.io/docs/eleven-agents/customization/integrations/calendly" },
          { nombre: "ElevenLabs: agentes para citas", url: "https://elevenlabs.io/agents/ai-appointment-setter" },
          { nombre: "ElevenLabs: voces en español", url: "https://elevenlabs.io/text-to-speech/spanish" },
          { nombre: "ElevenAgents: idiomas", url: "https://elevenlabs.io/docs/eleven-agents/customization/voice/customization/language" },
          { nombre: "ElevenLabs: modelos", url: "https://elevenlabs.io/docs/overview/models" },
          { nombre: "ElevenAgents: WhatsApp", url: "https://elevenlabs.io/docs/eleven-agents/whatsapp" },
          { nombre: "ElevenAgents: WhatsApp, primeros pasos", url: "https://elevenlabs.io/docs/eleven-agents/whatsapp/getting-started" },
          { nombre: "ElevenAgents: WhatsApp, costes", url: "https://elevenlabs.io/docs/eleven-agents/whatsapp/troubleshooting" },
          { nombre: "ElevenLabs: residencia de datos", url: "https://elevenlabs.io/docs/overview/administration/data-residency" },
          { nombre: "ElevenLabs: centro de confianza", url: "https://compliance.elevenlabs.io/" },
          { nombre: "Reception: lanzamiento", url: "https://elevenlabs.io/blog/reception" },
          { nombre: "Reception: portada y preguntas", url: "https://www.reception.ai/es" },
          { nombre: "Reception: planes y prueba", url: "https://elevenlabs.io/docs/reception-ai/billing/plans-and-pricing" },
          { nombre: "Reception: uso y créditos", url: "https://elevenlabs.io/docs/reception-ai/billing/usage-and-limits" },
          { nombre: "Reception: números fuera de EE. UU.", url: "https://elevenlabs.io/docs/reception-ai/phone-numbers/international-numbers" },
          { nombre: "Reception: integraciones", url: "https://elevenlabs.io/docs/reception-ai/integrations/overview" },
          { nombre: "Reception: Google Calendar", url: "https://elevenlabs.io/docs/reception-ai/integrations/google-calendar" },
          { nombre: "Reception: servicios", url: "https://elevenlabs.io/docs/reception-ai/scheduling/services" },
          { nombre: "Reception: avisos", url: "https://elevenlabs.io/docs/reception-ai/features/notifications" },
          { nombre: "Reception: asistente del negocio", url: "https://elevenlabs.io/docs/reception-ai/features/assistant" },
          { nombre: "Reception: voz e idiomas", url: "https://elevenlabs.io/docs/reception-ai/receptionist/voice-and-personality" },
          FUENTE_LEY,
        ]}
      />
    </PaginaGuia>
  );
}
