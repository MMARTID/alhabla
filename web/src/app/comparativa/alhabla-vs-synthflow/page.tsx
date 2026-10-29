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
import { TRIAL_DAYS } from "@/lib/plans";
import { metadataDePagina } from "@/lib/seo";

/**
 * Alhabla frente a Synthflow (2026-10-29). Synthflow solo se vende hoy con
 * contrato Enterprise anual, así que el eje de esta página es el tipo de
 * cliente y de contrato, no el precio por minuto (que no publica).
 * Publicidad comparativa del art. 10 de la Ley 3/1991 (reglas en
 * lib/comparativas.ts): cada dato de Synthflow sale de synthflow.ai o
 * docs.synthflow.ai, con su URL en Fuentes. Lo que no publica se escribe
 * «No consta en su web». Su web se contradice sobre si aún se puede empezar
 * gratis: se cuenta tal cual, sin dar por buena ninguna de las dos.
 */
const ruta = "/comparativa/alhabla-vs-synthflow";
const marca = "Synthflow";
const titulo = "Alhabla vs Synthflow: contrato de gran empresa o recepcionista para tu negocio";
const descripcion =
  "Synthflow vende agentes de voz a grandes empresas con contrato anual; Alhabla es una recepcionista de IA para negocios con cita, mes a mes. Número, agenda y WhatsApp, con fuentes.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

export default function VsSynthflowPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      tipo="Article"
      migas={[
        { name: "Comparativas", path: "/comparativa" },
        { name: "Alhabla vs Synthflow", path: ruta },
      ]}
      etiqueta={{ icono: Scale, texto: "Comparativa" }}
      titulo={titulo}
      descripcion={descripcion}
      ubicacion="vs_synthflow"
      entradilla={
        <>
          <p>
            Synthflow, una empresa de Berlín, vende agentes de voz a centros de llamadas y grandes empresas: un contrato
            anual desde 30.000 $ que se negocia con su equipo de ventas. Alhabla es la recepcionista de IA ya hecha para
            negocios con cita en España, con una cuota mensual en euros.
          </p>
          <p className="text-base">
            Si diriges un centro de llamadas y necesitas flujos a medida, Synthflow juega en tu liga. Si tienes un salón
            o una clínica y quieres que ninguna llamada se quede sin respuesta, Alhabla.
          </p>
        </>
      }
      faqs={[
        {
          question: "¿Puedo montar con Synthflow lo mismo que Alhabla?",
          answer:
            "La llamada, en buena parte: su editor tiene un paso que reserva en Cal.com. Lo demás es tuyo: el número español por SIP, tu agenda dentro de Cal.com, los WhatsApp con un proveedor externo y algo para cambiar tu agenda escribiendo, que en su web no consta.",
        },
        {
          question: "¿Puede contratar Synthflow un negocio pequeño?",
          answer:
            "Su página de precios solo ofrece Enterprise, por ventas, y su antigua página de pago por uso redirige ahí. Aun así, las preguntas frecuentes de su portada dicen que se puede empezar gratis. No consta en su web si hoy se puede dar de alta sin hablar con ventas.",
        },
        {
          question: "¿Cuánto cuesta Synthflow al mes?",
          answer: `Desde 30.000 $ al año, unos 2.500 $ al mes de media, según volumen, llamadas simultáneas, telefonía e integraciones. No consta qué minutos entran, y la tarifa del exceso solo la ve cada cliente en su panel. El operador español va aparte. Alhabla cuesta ${CUOTAS}, con ${MINUTOS_INCLUIDOS}.`,
        },
        {
          question: "¿Dónde trata los datos Synthflow?",
          answer:
            "Puedes elegir su clúster de la UE al crear el espacio de trabajo, y no se cambia después. Los mensajes de WhatsApp y los SMS solo funcionan en la región de EE. UU. El contrato de tratamiento de datos se pide aparte. Alhabla trabaja con proveedores que transfieren datos fuera del EEE, con garantías: está en nuestra política de privacidad.",
        },
        preguntaDeImparcialidad(marca),
      ]}
      relacionadas={[
        { href: "/comparativa", titulo: "Todas las comparativas", texto: "Retell AI, Vapi, Bland AI y ElevenLabs." },
        { href: "/planes", titulo: "Planes y precios", texto: "Cuota mensual en euros, sin contrato anual." },
        { href: "/integraciones", titulo: "Integraciones", texto: "Google, Outlook, iCloud y WhatsApp, conectados a tu recepcionista." },
      ]}
      cierre={`Pruébala ${TRIAL_DAYS} días con tu número de siempre, sin pasar por ventas.`}
    >
      <Seccion titulo="En una tabla">
        <Tabla
          cabecera={["", "Alhabla", "Synthflow"]}
          destacada={1}
          filas={[
            ["Qué es", ALHABLA.queEs, "Una plataforma alemana para construir agentes de voz con IA que atienden y hacen llamadas"],
            ["Para quién", ALHABLA.paraQuien, "Grandes empresas: centros de llamadas, seguros, sanidad, comercio o software. Su portada no habla de pequeños negocios"],
            ["Quién lo monta", ALHABLA.quienLoMonta, "Tú, con un prompt o en su editor de nodos, o sus ingenieros, dentro del contrato Enterprise"],
            ["Precio publicado", ALHABLA.precio, "Un solo plan, Enterprise: desde 30.000 $ al año, con el precio final negociado. No publica precio por minuto"],
            ["Contrato", `${TRIAL_DAYS} días de prueba, mes a mes y sin permanencia`, "Acuerdo anual con ventas; el compromiso, la renovación y la cancelación dependen de cada contrato"],
            ["Número en España", ALHABLA.numero, "Solo vende de EE. UU., Canadá y Australia, para pruebas. El español lo importas de tu operador por SIP, una función de Enterprise"],
            ["Español y lenguas cooficiales", ALHABLA.idiomas, "«Spanish», sin separar España de Latinoamérica; catalán en su lista; euskera y gallego no aparecen"],
            ["Calendarios", ALHABLA.calendarios, "Reserva en directo con Cal.com o GoHighLevel. Google, Outlook e iCloud no figuran en sus integraciones"],
            ["WhatsApp con el cliente", ALHABLA.whatsappCliente, "Con tu cuenta en un proveedor externo y plantillas aprobadas, y solo en espacios de la región de EE. UU., no en la UE"],
            ["El dueño cambia su agenda por WhatsApp", ALHABLA.asistente, "No consta en su web"],
          ]}
          nota="Datos de Synthflow de synthflow.ai y docs.synthflow.ai, enlazados en Fuentes. Su precio lleva el símbolo $ sin nombrar la moneda, y no consta en su web si factura con IVA español. «No consta» quiere decir que no aparece en su web, no que no exista."
        />
      </Seccion>

      <Seccion
        fondo
        titulo="Lo que te toca montar con Synthflow"
        entradilla={<p>Para que coja el teléfono de una peluquería o una clínica de fisioterapia en España.</p>}
      >
        <Pasos
          pasos={[
            {
              titulo: "El contrato",
              texto:
                "Pedir una demo y negociar con ventas un acuerdo anual, con el precio ajustado a tu volumen y a lo que necesites conectar.",
            },
            {
              titulo: "Un número español",
              texto:
                "Los suyos son de EE. UU., Canadá o Australia, y para probar. El español lo contratas con tu operador y lo conectas por troncal SIP.",
            },
            {
              titulo: "La conversación",
              texto:
                "Elegir prompt único o diagrama de nodos, que no se mezclan, y escribir las instrucciones de cada paso. Su documentación no habla de voces con acento de España.",
            },
            {
              titulo: "La agenda en Cal.com",
              texto:
                "Abrir una cuenta, conectar ahí los calendarios del equipo y publicar un tipo de evento con su disponibilidad. Para mover o anular, el cliente usa los enlaces de sus emails, o montas otro flujo.",
            },
            {
              titulo: "Los mensajes al cliente",
              texto:
                "WhatsApp y SMS piden tu cuenta en un proveedor externo, plantillas aprobadas y un espacio en la región de EE. UU.",
            },
            {
              titulo: "El aviso de IA y los datos",
              texto:
                "Configurar el aviso de que habla una IA, que según Synthflow te toca a ti, y pedir el contrato de tratamiento de datos.",
            },
          ]}
        />
      </Seccion>

      <Seccion titulo="Cuándo elegir Synthflow">
        <ListaCheck
          items={[
            "Eres una empresa grande con presupuesto para un contrato anual y quieres que sus ingenieros lo implanten y formen a tu equipo.",
            "Necesitas flujos complejos: ramas, subflujos, transferencias y llamadas a tus propios sistemas desde un editor visual.",
            "Quieres los datos dentro de la UE: ofrece un clúster europeo, salvo para WhatsApp y SMS.",
            "Tu empresa exige certificaciones: Synthflow dice tener SOC 2, HIPAA, PCI DSS y RGPD, y muestra ISO 27001.",
            "Atiendes en idiomas que Alhabla no habla: su lista tiene 33.",
          ]}
        />
      </Seccion>

      <Seccion fondo titulo="Cuándo elegir Alhabla">
        <ListaCheck
          items={[
            `Tienes un negocio con cita y prefieres pagar ${CUOTAS}, sin contrato anual ni reunión de ventas.`,
            "Quieres mantener tu número de siempre: lo desvías al número español que viene incluido.",
            "Tus citas están en Google, Outlook o iCloud y no quieres Cal.com en medio; o no usas ninguno y te vale la agenda de Alhabla.",
            "Quieres que el cliente reciba su cita por WhatsApp y conteste ahí mismo para moverla o anularla.",
            "Si alguien del equipo falta, se lo escribes a tu asistente; te enseña sus citas, te ayuda a recolocarlas y avisa a cada cliente cuando tú confirmas.",
            "Tus clientes hablan euskera o gallego.",
          ]}
        />
        <div className="mt-8 max-w-3xl">
          <Nota titulo="Sobre esta comparativa">{notaSobreLaComparativa(marca)}</Nota>
        </div>
      </Seccion>

      <Fuentes
        consultadas={CONSULTADAS}
        fuentes={[
          { nombre: "Synthflow: portada", url: "https://synthflow.ai/" },
          { nombre: "Synthflow: precios", url: "https://synthflow.ai/pricing" },
          { nombre: "Synthflow: plan Enterprise", url: "https://docs.synthflow.ai/enterprise" },
          { nombre: "Synthflow: facturación", url: "https://docs.synthflow.ai/billing" },
          { nombre: "Synthflow: crear un agente", url: "https://docs.synthflow.ai/create-an-agent" },
          { nombre: "Synthflow: Flow Designer", url: "https://docs.synthflow.ai/flow-designer" },
          { nombre: "Synthflow: voces", url: "https://docs.synthflow.ai/voice-configuration" },
          { nombre: "Synthflow: idiomas", url: "https://docs.synthflow.ai/about-supported-languages" },
          { nombre: "Synthflow: números de teléfono", url: "https://docs.synthflow.ai/phone-numbers" },
          { nombre: "Synthflow: reserva en tiempo real", url: "https://docs.synthflow.ai/create-a-real-time-booking-action" },
          { nombre: "Synthflow: integraciones", url: "https://docs.synthflow.ai/about-integrations" },
          { nombre: "Synthflow: Cal.com", url: "https://docs.synthflow.ai/calcom" },
          { nombre: "Synthflow: WhatsApp y SMS", url: "https://docs.synthflow.ai/chat" },
          { nombre: "Synthflow: región de datos", url: "https://docs.synthflow.ai/customer-region" },
          { nombre: "Synthflow: transparencia de IA", url: "https://docs.synthflow.ai/ai-transparency" },
          { nombre: "Synthflow: condiciones Enterprise (DACH)", url: "https://docs.synthflow.ai/gtc-direct-dach" },
          FUENTE_LEY,
        ]}
      />
    </PaginaGuia>
  );
}
