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
 * Alhabla frente a Bland AI (2026-10-29), la plataforma de IA de voz que se
 * vende a empresas de sectores regulados. Publicidad comparativa del art. 10
 * de la Ley 3/1991 (reglas en lib/comparativas.ts): cada dato de Bland AI
 * sale de bland.ai o docs.bland.ai, con su URL en Fuentes. Lo que no publica
 * se escribe «No consta en su web». Donde su propia web se contradice
 * (telefonía incluida o aparte, SMS fuera de Enterprise), se citan las dos
 * páginas o no se publica.
 */
const ruta = "/comparativa/alhabla-vs-bland-ai";
const marca = "Bland AI";
const titulo = "Alhabla vs Bland AI: IA de voz de empresa o recepcionista para tu negocio";
const descripcion =
  "Bland AI es una plataforma de IA de voz para sectores regulados; Alhabla, la recepcionista de IA hecha para negocios con cita en España. Precio, número, calendarios y WhatsApp, con fuentes.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

export default function VsBlandPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      tipo="Article"
      migas={[
        { name: "Comparativas", path: "/comparativa" },
        { name: "Alhabla vs Bland AI", path: ruta },
      ]}
      etiqueta={{ icono: Scale, texto: "Comparativa" }}
      titulo={titulo}
      descripcion={descripcion}
      ubicacion="vs_bland"
      entradilla={
        <>
          <p>
            Bland AI es una plataforma de IA de voz para sectores regulados como la sanidad o los seguros: la
            configuras tú, pagas en dólares por minuto y el número español, la agenda y WhatsApp corren de tu cuenta o
            de su plan Enterprise. Alhabla es la recepcionista de IA ya hecha para negocios con cita, con todo eso dentro.
          </p>
          <p className="text-base">
            Si diriges un centro de llamadas de una aseguradora o de una red sanitaria, con equipo técnico, Bland AI
            encaja mejor. Si tienes un salón o una consulta y quieres el teléfono cogido sin montar nada, Alhabla.
          </p>
        </>
      }
      faqs={[
        {
          question: "¿Puedo montar con Bland AI lo mismo que Alhabla?",
          answer:
            "Una parte: un agente que coge la llamada, mira los huecos de Cal.com o Calendly y reserva. El resto corre de tu cuenta: el número español por troncal SIP, el WhatsApp con el cliente (en Bland AI, solo en Enterprise) y cambiar tu agenda escribiendo, que en su web no consta.",
        },
        {
          question: "¿Cuánto cuesta Bland AI frente a Alhabla?",
          answer: `Start cobra 0,14 $ por minuto sin cuota; Build, 299 $ al mes y 0,12 $ por minuto. Aparte, cada número (15 $ al mes), las transferencias a una persona y Norm. Sobre la telefonía su web se contradice: aparte en la página de precios, incluida en su llms.txt. Alhabla cuesta ${CUOTAS}, con ${MINUTOS_INCLUIDOS} y número, calendario y WhatsApp dentro.`,
        },
        {
          question: "¿Bland AI está pensada para una peluquería o una clínica pequeña?",
          answer:
            "Su portada habla de sanidad, seguros y servicios financieros, y de más de 230 empresas reguladas como clientes; no menciona pequeños negocios. Para quien no programa ofrece Norm, un copiloto al que describes lo que quieres y lo construye, cobrado aparte por tokens.",
        },
        {
          question: "¿Dónde trata los datos Bland AI?",
          answer:
            "Su política de privacidad prevé transferirlos fuera de tu país, entre otros a Estados Unidos, y no menciona el RGPD. Su contrato de tratamiento usa cláusulas tipo de la UE, y fijar los datos en la UE es de Enterprise. Alhabla también trabaja con proveedores con transferencias fuera del EEE, con garantías: está en nuestra política de privacidad.",
        },
        preguntaDeImparcialidad(marca),
      ]}
      relacionadas={[
        { href: "/comparativa", titulo: "Todas las comparativas", texto: "Retell AI, Vapi, Synthflow y ElevenLabs." },
        { href: "/integraciones", titulo: "Integraciones", texto: "Google Calendar, Outlook, iCloud y WhatsApp, sin intermediarios." },
        { href: "/agenda-por-whatsapp", titulo: "Tu asistente por WhatsApp", texto: "Ausencias, horarios y citas, escribiendo." },
      ]}
      cierre="Desvía tu número hoy y deja que la recepcionista coja la próxima llamada."
    >
      <Seccion titulo="En una tabla">
        <Tabla
          cabecera={["", "Alhabla", "Bland AI"]}
          destacada={1}
          filas={[
            ["Qué es", ALHABLA.queEs, "Una plataforma empresarial de IA de voz para crear agentes que llaman y contestan"],
            ["Para quién", ALHABLA.paraQuien, "Se presenta para sectores regulados: sanidad, seguros y servicios financieros. Su plan sin cuota lleva la etiqueta «para desarrolladores»"],
            ["Quién lo monta", ALHABLA.quienLoMonta, "Tú, en su panel web, con su copiloto Norm o por API. El código propio y los pasos de agenda son de Enterprise"],
            ["Precio publicado", ALHABLA.precio, "Start: 0,14 $ por minuto, sin cuota. Build: 299 $ al mes y 0,12 $ por minuto. Enterprise, a medida. En dólares"],
            ["Qué va aparte", ALHABLA.aparte, "Cada número, 15 $ al mes; pasar la llamada a una persona, 0,05 $ o 0,04 $ por minuto; Norm, por tokens; la telefonía, según su página de precios"],
            ["Número en España", ALHABLA.numero, "Por API solo vende números de EE. UU. y Canadá; para otros países remite a su soporte. El tuyo se conecta por troncal SIP"],
            ["Español y otros idiomas", ALHABLA.idiomas, "Anuncia más de 40 idiomas. El español figura como «es» y «es-419» (Latinoamérica), sin variante de España"],
            ["Calendarios", ALHABLA.calendarios, "Cal.com y Calendly, que leen los huecos libres y reservan. Google, Outlook o iCloud directos no constan en su web"],
            ["WhatsApp con el cliente", ALHABLA.whatsappCliente, "Solo dentro de Enterprise, lo activa su ejecutivo de cuenta; precio no publicado"],
            ["El dueño cambia su agenda por WhatsApp", ALHABLA.asistente, "No consta en su web"],
          ]}
          nota="Datos de Bland AI de bland.ai y docs.bland.ai, enlazados en Fuentes. Publica sus precios en dólares, sin mencionar euros ni IVA. «No consta» quiere decir que no aparece en su web, no que no exista."
        />
      </Seccion>

      <Seccion
        fondo
        titulo="Lo que te toca montar con Bland AI"
        entradilla={<p>Para que atienda el teléfono de un negocio con cita en España.</p>}
      >
        <Pasos
          pasos={[
            {
              titulo: "El número",
              texto:
                "Pedirlo a su soporte, que no consta si los da, o traer el tuyo por un troncal SIP propio con TLS, audio cifrado con SRTP y el cortafuegos abierto a sus direcciones.",
            },
            {
              titulo: "El agente",
              texto:
                "Crearlo en su panel o pedírselo a Norm, escribir cómo saluda y qué responde, y probarlo en el navegador. Las voces no tienen catálogo público: se consultan por su API.",
            },
            {
              titulo: "La agenda",
              texto:
                "Abrir una cuenta en Cal.com o Calendly y crear ahí tus servicios. Para otro calendario, Zapier o Make, o su nodo de agenda, de Enterprise, que pide un webhook tuyo que le dé los huecos.",
            },
            {
              titulo: "Los avisos al cliente",
              texto:
                "WhatsApp y, según su tabla de precios, el SMS son de Enterprise. Si no, una automatización propia con un proveedor de WhatsApp Business.",
            },
            {
              titulo: "Los papeles",
              texto:
                "Firmar su contrato de tratamiento, escribir el aviso de que habla una IA y aceptar condiciones bajo la ley de California, con su responsabilidad limitada a 100 $.",
            },
          ]}
        />
      </Seccion>

      <Seccion titulo="Cuándo elegir Bland AI">
        <ListaCheck
          items={[
            "Trabajas en un sector regulado y necesitas papeles: publica SOC 2 Type II, HIPAA con contrato BAA (en Enterprise) y un contrato de tratamiento para el RGPD.",
            "Mueves mucho volumen: Build admite 50 llamadas a la vez y 2.000 al día, con un SLA del 99,9 % en todos los planes.",
            "Tu equipo técnico quiere API, CLI y MCP, guardar los agentes como YAML en un repositorio y volver a una versión anterior.",
            "Necesitas que telefonía, inferencia y grabación se queden en una región, también en la UE: lo ofrece en Enterprise.",
            "Quieres probar sin cuota ni tarjeta: Start cobra solo los minutos, al segundo.",
          ]}
        />
      </Seccion>

      <Seccion fondo titulo="Cuándo elegir Alhabla">
        <ListaCheck
          items={[
            "Nadie en tu negocio programa, y quieres seguir con tu número de siempre sin troncales ni cortafuegos.",
            "Tu agenda vive en Google, Outlook o iCloud, o prefieres la de Alhabla, sin cuentas intermedias.",
            "Quieres que tus clientes reciban la cita por WhatsApp y la cambien contestando, sin plan de empresa.",
            "Quieres escribir a tu asistente que alguien falta mañana y que ella te ayude a recolocar sus citas, sin mover nada hasta tu «Confirmar».",
            "Prefieres pagar en euros, con IVA español y los minutos incluidos claros desde el primer día.",
          ]}
        />
        <div className="mt-8 max-w-3xl">
          <Nota titulo="Sobre esta comparativa">{notaSobreLaComparativa(marca)}</Nota>
        </div>
      </Seccion>

      <Fuentes
        consultadas={CONSULTADAS}
        fuentes={[
          { nombre: "Bland AI: portada", url: "https://www.bland.ai/" },
          { nombre: "Bland AI: precios", url: "https://www.bland.ai/pricing" },
          { nombre: "Bland AI: producto", url: "https://www.bland.ai/product" },
          { nombre: "Bland AI: Norm", url: "https://www.bland.ai/norm" },
          { nombre: "Bland AI: crear tu primer agente", url: "https://docs.bland.ai/build-your-first-agent" },
          { nombre: "Bland AI: facturación", url: "https://docs.bland.ai/platform/billing" },
          { nombre: "Bland AI: llms.txt", url: "https://www.bland.ai/llms.txt" },
          { nombre: "Bland AI: comprar un número", url: "https://docs.bland.ai/api-v1/post/inbound-purchase" },
          { nombre: "Bland AI: integración SIP", url: "https://docs.bland.ai/enterprise-features/SIP-integration" },
          { nombre: "Bland AI: idiomas de la llamada", url: "https://docs.bland.ai/api-v1/post/calls" },
          { nombre: "Bland AI: integraciones", url: "https://www.bland.ai/integrations" },
          { nombre: "Bland AI: Cal.com", url: "https://bland.ai/integrations/calcom" },
          { nombre: "Bland AI: Calendly", url: "https://bland.ai/integrations/calendly" },
          { nombre: "Bland AI: nodo de agenda", url: "https://docs.bland.ai/enterprise-features/scheduling-node" },
          { nombre: "Bland AI: WhatsApp", url: "https://bland.ai/integrations/whatsapp" },
          { nombre: "Bland AI: seguridad", url: "https://www.bland.ai/trust-security" },
          { nombre: "Bland AI: contrato de tratamiento de datos", url: "https://www.bland.ai/legal/dpa" },
          { nombre: "Bland AI: política de privacidad", url: "https://www.bland.ai/legal/privacy" },
          { nombre: "Bland AI: condiciones", url: "https://www.bland.ai/legal/terms" },
          FUENTE_LEY,
        ]}
      />
    </PaginaGuia>
  );
}
