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
 * Alhabla frente a Retell AI (2026-10-29), la plataforma de agentes de voz
 * más buscada. Publicidad comparativa del art. 10 de la Ley 3/1991 (reglas
 * en lib/comparativas.ts): cada dato de Retell AI sale de su web oficial,
 * con su URL en Fuentes. Lo que no publica se escribe «No consta en su
 * web». Es la página modelo de las comparativas con plataformas.
 */
const ruta = "/comparativa/alhabla-vs-retell-ai";
const marca = "Retell AI";
const titulo = "Alhabla vs Retell AI: montarte un agente o tener la recepcionista hecha";
const descripcion =
  "Retell AI es una plataforma para construir agentes de voz; Alhabla, una recepcionista de IA ya hecha para negocios con cita. Precio, número español, calendarios y WhatsApp, con fuentes.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

export default function VsRetellPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      tipo="Article"
      migas={[
        { name: "Comparativas", path: "/comparativa" },
        { name: "Alhabla vs Retell AI", path: ruta },
      ]}
      etiqueta={{ icono: Scale, texto: "Comparativa" }}
      titulo={titulo}
      descripcion={descripcion}
      ubicacion="vs_retell"
      entradilla={
        <>
          <p>
            Retell AI es una caja de herramientas: construyes tu agente, pagas cada pieza por minuto en dólares y el
            número español, la agenda y WhatsApp corren de tu cuenta. Alhabla es la recepcionista ya hecha para tu
            negocio con cita, y la gestionas por WhatsApp o desde el panel.
          </p>
          <p className="text-base">
            Si tienes a alguien técnico y quieres control total, Retell AI te da más margen. Si quieres no perder ni
            una llamada esta semana sin montar nada, Alhabla.
          </p>
        </>
      }
      faqs={[
        {
          question: "¿Puedo montar con Retell AI lo mismo que Alhabla?",
          answer:
            "La parte del teléfono, en gran medida sí: un agente que contesta, consulta huecos en Cal.com y reserva. Lo demás lo construyes tú: el reparto por profesional, con un tipo de evento para cada servicio; las confirmaciones por WhatsApp, fuera de Retell AI; y una forma de cambiar tu agenda escribiendo, que en su web no consta.",
        },
        {
          question: "¿Retell AI sale más barato?",
          answer: `Por minuto puede salir más barato: anuncia de 0,07 a 0,31 $ y su calculadora pone un ejemplo de 0,11 $. A eso se suman el número, el operador español, la base de conocimiento y lo que uses para WhatsApp, además del tiempo de montarlo. Alhabla cuesta ${CUOTAS}, con ${MINUTOS_INCLUIDOS} y lo demás dentro.`,
        },
        {
          question: "¿Retell AI habla español de España, catalán o euskera?",
          answer:
            "Habla español de España y de Latinoamérica, y su lista de idiomas incluye catalán y gallego; el euskera no aparece. Si un agente mezcla idiomas, Retell AI avisa de que entiende peor cada uno y recomienda un agente por idioma.",
        },
        {
          question: "¿Dónde trata los datos Retell AI?",
          answer:
            "Según su política de privacidad, principalmente en Estados Unidos, y su documentación dice que no opera servicios dentro de la Unión Europea. Ofrece un contrato de tratamiento con cláusulas tipo de la UE que firmas tú. Alhabla también trabaja con proveedores que transfieren datos fuera del EEE, con garantías: está en nuestra política de privacidad.",
        },
        preguntaDeImparcialidad(marca),
      ]}
      relacionadas={[
        { href: "/comparativa", titulo: "Todas las comparativas", texto: "Vapi, Bland AI, Synthflow y ElevenLabs." },
        { href: "/agenda-por-whatsapp", titulo: "Tu asistente por WhatsApp", texto: "Cómo cambias tu agenda escribiendo." },
        { href: "/desvio-de-llamadas", titulo: "Desvío de llamadas", texto: "Tu número de siempre, con el código de tu operador." },
      ]}
      cierre="Tu teléfono atendido esta semana, sin escribir ni una instrucción."
    >
      <Seccion titulo="En una tabla">
        <Tabla
          cabecera={["", "Alhabla", "Retell AI"]}
          destacada={1}
          filas={[
            ["Qué es", ALHABLA.queEs, "Una plataforma para construir, probar y desplegar agentes de voz y de chat"],
            ["Para quién", ALHABLA.paraQuien, "Centros de llamadas de empresa; también se anuncia como recepcionista para pequeños negocios"],
            ["Quién lo monta", ALHABLA.quienLoMonta, "Tú: instrucciones o flujo, voz, modelo de IA y herramientas. Que lo monte su equipo es un extra del plan Enterprise"],
            ["Precio publicado", ALHABLA.precio, "De 0,07 a 0,31 $ por minuto según modelo, voz y herramientas, sin mínimos ni contrato. En dólares"],
            ["Qué va aparte", ALHABLA.aparte, "Cada número, 2 $ al mes; la base de conocimiento, 0,005 $ por minuto; más de 20 llamadas a la vez, 8 $ al mes cada una"],
            ["Número en España", ALHABLA.numero, "Solo vende números de EE. UU. y Canadá: el español lo contratas a un operador y lo conectas por SIP"],
            ["Español y lenguas cooficiales", ALHABLA.idiomas, "Español de España y de Latinoamérica; catalán y gallego en su lista; el euskera no aparece"],
            ["Calendarios", ALHABLA.calendarios, "Su documentación lista Calendly, Cal.com y GoHighLevel; Google u Outlook, a través de ellos o con una función propia. iCloud no consta en su web"],
            ["WhatsApp con el cliente", ALHABLA.whatsappCliente, "Sin integración propia: propone conectarlo con Zapier. Su SMS solo funciona con números de EE. UU."],
            ["El dueño cambia su agenda por WhatsApp", ALHABLA.asistente, "No consta en su web"],
          ]}
          nota="Datos de Retell AI de retellai.com y docs.retellai.com, enlazados en Fuentes. Sus precios se publican en dólares; no consta en su web si facturan con IVA español. «No consta» quiere decir que no aparece en su web, no que no exista."
        />
      </Seccion>

      <Seccion
        fondo
        titulo="Lo que te toca montar con Retell AI"
        entradilla={<p>Para que atienda como una recepcionista de un salón o una clínica en España.</p>}
      >
        <Pasos
          pasos={[
            {
              titulo: "Un número español",
              texto:
                "Contratarlo con un operador que admita un troncal SIP, apuntarlo a Retell AI e importarlo en su panel. El operador te lo sigue cobrando aparte.",
            },
            {
              titulo: "El agente",
              texto:
                "Escribir sus instrucciones o dibujar el flujo de la llamada, elegir voz en español de España y modelo de IA, cargar servicios, precios y horario en una base de conocimiento, y probarlo.",
            },
            {
              titulo: "La agenda",
              texto:
                "Abrir una cuenta en Cal.com, conectar ahí tu Google u Outlook y crear un tipo de evento por servicio: cada herramienta de reservar va atada a uno. Para mover una cita, el agente la busca por el email del cliente.",
            },
            {
              titulo: "Las confirmaciones",
              texto:
                "WhatsApp no viene: hay que montar una automatización con Zapier y una cuenta de WhatsApp Business con plantillas aprobadas por Meta, y pagarlas aparte.",
            },
            {
              titulo: "El aviso de IA y los datos",
              texto:
                "Escribir la frase con la que avisa de que es una IA, firmar su contrato de tratamiento de datos y decidir cuánto tiempo se guardan grabaciones y transcripciones.",
            },
            {
              titulo: "El día a día",
              texto:
                "Cambiar un horario, un precio o una ausencia es tocar las instrucciones, la base de conocimiento y Cal.com. Su soporte atiende de 9:00 a 21:00, hora del Pacífico: de 18:00 a 6:00 en la España peninsular.",
            },
          ]}
        />
      </Seccion>

      <Seccion titulo="Cuándo elegir Retell AI">
        <ListaCheck
          items={[
            "Tienes un desarrollador o una agencia y quieres decidir cada detalle: el flujo, el modelo de IA y la voz, con API, SDK, webhooks y MCP.",
            "Recibes muchas llamadas a la vez: trae 20 simultáneas sin coste y puedes ampliar.",
            "Tu volumen es bajo y te vale una configuración sencilla: el ejemplo de su calculadora sale a 0,11 $ por minuto.",
            "Necesitas un idioma que Alhabla no habla: su lista tiene 55.",
          ]}
        />
      </Seccion>

      <Seccion fondo titulo="Cuándo elegir Alhabla">
        <ListaCheck
          items={[
            "Quieres tu teléfono atendido sin programar nada ni contratar otro operador: desvías tu número de siempre.",
            "Tu agenda está en Google, Outlook o iCloud, o no tienes ninguna y te vale la de Alhabla.",
            "Quieres que cada cliente reciba su cita por WhatsApp y pueda escribir para cambiarla.",
            "Quieres decirle a tu asistente por WhatsApp «mañana falta Marta» y que te ayude a recolocar sus citas, avisando a cada cliente solo cuando tú confirmes.",
            "Tu negocio está en Euskadi o Navarra y tus clientes hablan euskera.",
            "Prefieres una cuota en euros y saber de antemano cuánto cuesta el minuto extra.",
          ]}
        />
        <div className="mt-8 max-w-3xl">
          <Nota titulo="Sobre esta comparativa">{notaSobreLaComparativa(marca)}</Nota>
        </div>
      </Seccion>

      <Fuentes
        consultadas={CONSULTADAS}
        fuentes={[
          { nombre: "Retell AI: qué es", url: "https://docs.retellai.com/general/introduction" },
          { nombre: "Retell AI: recepcionistas", url: "https://www.retellai.com/use-cases/receptionists" },
          { nombre: "Retell AI: precios", url: "https://www.retellai.com/pricing" },
          { nombre: "Retell AI: comprar un número", url: "https://docs.retellai.com/deploy/purchase-number" },
          { nombre: "Retell AI: usar tu número con SIP", url: "https://www.retellai.com/learn/how-to-keep-your-existing-phone-number-using-a-sip-connection" },
          { nombre: "Retell AI: idiomas", url: "https://docs.retellai.com/build/language-support" },
          { nombre: "Retell AI: agentes en varios idiomas", url: "https://docs.retellai.com/agent/multilingual" },
          { nombre: "Retell AI: integraciones", url: "https://docs.retellai.com/integrations/overview" },
          { nombre: "Retell AI: herramientas de agenda", url: "https://www.retellai.com/blog/best-ai-scheduling-tools" },
          { nombre: "Retell AI: funciones de Cal.com", url: "https://docs.retellai.com/integrations/cal-com-functions" },
          { nombre: "Retell AI: agentes de chat", url: "https://docs.retellai.com/build/create-chat-agent" },
          { nombre: "Retell AI: WhatsApp", url: "https://www.retellai.com/integrations/whatsapp" },
          { nombre: "Retell AI: SMS", url: "https://docs.retellai.com/deploy/enable-sms" },
          { nombre: "Retell AI: cumplimiento", url: "https://docs.retellai.com/general/compliance" },
          { nombre: "Retell AI: política de privacidad", url: "https://www.retellai.com/legal/privacy-policy" },
          { nombre: "Retell AI: soporte", url: "https://docs.retellai.com/general/support" },
          FUENTE_LEY,
        ]}
      />
    </PaginaGuia>
  );
}
