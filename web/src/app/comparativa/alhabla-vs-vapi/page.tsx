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
 * Alhabla frente a Vapi (2026-10-29), la plataforma de agentes de voz para
 * desarrolladores. Publicidad comparativa del art. 10 de la Ley 3/1991
 * (reglas en lib/comparativas.ts): cada dato de Vapi sale de vapi.ai o de
 * docs.vapi.ai, con su URL en Fuentes. Lo que no publica se escribe «No
 * consta en su web». Los operadores de telefonía no se nombran: «un
 * operador» o «troncal SIP».
 */
const ruta = "/comparativa/alhabla-vs-vapi";
const marca = "Vapi";
const titulo = "Alhabla vs Vapi: un agente de voz por piezas o una recepcionista de IA lista";
const descripcion =
  "Vapi es una plataforma para desarrolladores que cobra su minuto y, aparte, cada pieza del agente; Alhabla, una recepcionista de IA lista para negocios con cita. Número español, idiomas, agenda y WhatsApp, con fuentes.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

export default function VsVapiPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      tipo="Article"
      migas={[
        { name: "Comparativas", path: "/comparativa" },
        { name: "Alhabla vs Vapi", path: ruta },
      ]}
      etiqueta={{ icono: Scale, texto: "Comparativa" }}
      titulo={titulo}
      descripcion={descripcion}
      ubicacion="vs_vapi"
      entradilla={
        <>
          <p>
            Vapi te da las piezas para construir un agente de voz: pagas 0,05 $ por minuto a Vapi y, aparte, cada
            proveedor que conectes. Alhabla es una recepcionista de IA que ya sabe dar citas en un negocio de España,
            con número, agenda y WhatsApp dentro.
          </p>
          <p className="text-base">
            Vapi encaja si eres desarrollador o agencia y quieres construir tu propio producto. Si tienes un salón o
            una clínica y lo que buscas es no perder ninguna llamada sin aprender a programar, Alhabla.
          </p>
        </>
      }
      faqs={[
        {
          question: "¿Puedo montar con Vapi lo mismo que Alhabla?",
          answer:
            "En parte: con su plantilla de citas y Google Calendar tienes un agente que consulta huecos y crea eventos. Lo demás corre de tu cuenta: mover y cancelar, Outlook o iCloud, el número español, una voz de aquí, WhatsApp y cambiar tu agenda escribiendo, que en su web no consta.",
        },
        {
          question: "¿Cuánto cuesta Vapi de verdad?",
          answer: `Vapi cobra 0,05 $ por minuto de plataforma, en prepago, y aparte la transcripción, el modelo de IA, la voz y la telefonía. Su calculadora estima de 82 a 129 $ por 1.000 minutos con su telefonía de EE. UU.; un número español y sus minutos se suman aparte, y Vapi no publica su precio. Alhabla cuesta ${CUOTAS}, con ${MINUTOS_INCLUIDOS}.`,
        },
        {
          question: "¿Me sirve el número gratis de Vapi?",
          answer:
            "Para probar, sí; para tu negocio en España, no. Es de EE. UU., uno por cuenta, y solo recibe llamadas. El español se contrata con un operador y se importa. Y el uso se paga con créditos en dólares comprados por adelantado.",
        },
        {
          question: "¿Dónde guarda los datos Vapi?",
          answer:
            "Tiene una región en la Unión Europea solo con su paquete Premier, que se negocia con ventas. Su página de RGPD reconoce datos que salen de la UE, sobre todo a EE. UU., con cláusulas contractuales tipo. Alhabla también trabaja con proveedores con transferencias fuera del EEE, con garantías: está en nuestra política de privacidad.",
        },
        preguntaDeImparcialidad(marca),
      ]}
      relacionadas={[
        { href: "/comparativa", titulo: "Todas las comparativas", texto: "Retell AI, Bland AI, Synthflow y ElevenLabs." },
        { href: "/comparativa/alhabla-vs-retell-ai", titulo: "Alhabla vs Retell AI", texto: "La otra plataforma de agentes de voz más buscada." },
        { href: "/integraciones", titulo: "Integraciones", texto: "Google, Outlook, iCloud o la agenda de Alhabla." },
      ]}
      cierre="Que tu teléfono conteste esta semana, sin recargar créditos ni escribir código."
    >
      <Seccion titulo="En una tabla">
        <Tabla
          cabecera={["", "Alhabla", "Vapi"]}
          destacada={1}
          filas={[
            ["Qué es", ALHABLA.queEs, "Una plataforma para desarrolladores con la que se construyen agentes de voz que hacen y reciben llamadas"],
            ["Para quién", ALHABLA.paraQuien, "Desarrolladores, según sus preguntas frecuentes; admite marca blanca para quien revende"],
            ["Quién lo monta", ALHABLA.quienLoMonta, "Tú: el primer agente, desde su panel y sin programar; para que use tus sistemas, un servidor propio"],
            ["Precio publicado", ALHABLA.precio, "0,05 $ por minuto de plataforma, en prepago y sin mínimo de minutos. En dólares"],
            ["Qué va aparte", ALHABLA.aparte, "Transcripción, modelo de IA, voz y telefonía, a precio de cada proveedor. Soporte con plazo de respuesta, desde 29 $ al mes. Más de 4 llamadas a la vez, 10 $ al mes por línea"],
            ["Número en España", ALHABLA.numero, "Su número gratis es de EE. UU. y solo recibe llamadas: el español lo contratas a un operador y lo importas"],
            ["Español y lenguas cooficiales", ALHABLA.idiomas, "Sus voces propias hablan español, ninguna con acento de España: esa, de un proveedor externo. Catalán, euskera y gallego no constan en su guía de idiomas"],
            ["Calendarios", ALHABLA.calendarios, "Google Calendar, con crear evento y consultar huecos, y GoHighLevel. Outlook e iCloud no están en su lista de integraciones: con una herramienta propia"],
            ["WhatsApp con el cliente", ALHABLA.whatsappCliente, "Su documentación no menciona WhatsApp. Sus SMS solo funcionan con números de EE. UU."],
            ["El dueño cambia su agenda por WhatsApp", ALHABLA.asistente, "No consta en su web"],
          ]}
          nota="Datos de Vapi de vapi.ai y docs.vapi.ai, enlazados en Fuentes. Vapi publica sus precios en dólares y se paga con créditos por adelantado; no consta en su web si factura con IVA español. «No consta» quiere decir que no aparece en su web, no que no exista."
        />
      </Seccion>

      <Seccion
        fondo
        titulo="Lo que te toca montar con Vapi"
        entradilla={<p>Para que conteste el teléfono de un salón o una clínica de aquí y dé citas.</p>}
      >
        <Pasos
          pasos={[
            {
              titulo: "El número",
              texto:
                "El gratuito es de EE. UU. Uno español se contrata a un operador, se importa o se conecta por troncal SIP, y el número y sus minutos se pagan aparte.",
            },
            {
              titulo: "Las piezas del agente",
              texto:
                "Elegir transcripción, modelo de IA y voz, cada una con su precio. De sus 22 voces propias, ninguna tiene acento de España: hay que buscarla fuera y probarla.",
            },
            {
              titulo: "Las instrucciones",
              texto:
                "Partir de su plantilla de citas y escribir tu horario, servicios y equipo. Composer, su asistente de configuración, está en fase alfa y avisa de que los datos del negocio los pones tú.",
            },
            {
              titulo: "La agenda",
              texto:
                "Su ejemplo oficial, una barbería, usa cuatro herramientas: consultar, reservar, mover y cancelar. Google Calendar trae las dos primeras; las otras, y Outlook o iCloud, las construyes tú.",
            },
            {
              titulo: "Los avisos al cliente",
              texto:
                "Su documentación no menciona WhatsApp y sus SMS solo van entre números de EE. UU.: la confirmación al cliente se monta con otro proveedor.",
            },
            {
              titulo: "El mantenimiento",
              texto:
                "Seguir sus cambios: retiró su constructor de flujos, Workflows, el 18 de agosto de 2026, y los existentes dejaron de funcionar al día siguiente.",
            },
          ]}
        />
      </Seccion>

      <Seccion titulo="Cuándo elegir Vapi">
        <ListaCheck
          items={[
            "Eres desarrollador o agencia y quieres escoger cada pieza, o vender tu propio producto de voz con tu marca: Vapi admite marca blanca y varios clientes en una misma plataforma.",
            "Quieres probar sin cuota fija: da 5 $ de créditos gratis, un número de EE. UU. y cobra solo los minutos que uses.",
            "Mueves muchos minutos y tienes quien lo mantenga: pagas cada pieza a precio de su proveedor, sin margen de Vapi.",
            "Necesitas un idioma que Alhabla no habla: su guía de idiomas cita un proveedor de voces con más de 140.",
          ]}
        />
      </Seccion>

      <Seccion fondo titulo="Cuándo elegir Alhabla">
        <ListaCheck
          items={[
            "No tienes a nadie técnico: das de alta servicios, equipo y horario, desvías tu número de siempre y la recepcionista contesta.",
            "Tus clientes esperan oír a alguien de aquí: habla español de España, y catalán, euskera o gallego según dónde esté tu negocio.",
            "Tu agenda está en Outlook o iCloud, o no usas ninguna: Alhabla se conecta a las dos y a Google, o te da la suya.",
            "Quieres que la cita le llegue al cliente por WhatsApp y que conteste ahí mismo si necesita cambiarla.",
            "Cuando falta alguien del equipo, quieres escribirle a tu asistente y que te ayude a mover sus citas una a una, sin que nada cambie hasta que pulses «Confirmar».",
          ]}
        />
        <div className="mt-8 max-w-3xl">
          <Nota titulo="Sobre esta comparativa">{notaSobreLaComparativa(marca)}</Nota>
        </div>
      </Seccion>

      <Fuentes
        consultadas={CONSULTADAS}
        fuentes={[
          { nombre: "Vapi: qué es", url: "https://docs.vapi.ai/quickstart/introduction" },
          { nombre: "Vapi: preguntas frecuentes", url: "https://docs.vapi.ai/faq" },
          { nombre: "Vapi: precios", url: "https://vapi.ai/pricing" },
          { nombre: "Vapi: paquetes de soporte", url: "https://docs.vapi.ai/billing/pricing-and-success-packages" },
          { nombre: "Vapi: plantillas de asistente", url: "https://docs.vapi.ai/quickstart/phone" },
          { nombre: "Vapi: Composer", url: "https://docs.vapi.ai/composer" },
          { nombre: "Vapi: retirada de Workflows", url: "https://docs.vapi.ai/workflows/legacy-migration" },
          { nombre: "Vapi: números gratuitos", url: "https://docs.vapi.ai/free-telephony" },
          { nombre: "Vapi: sus voces", url: "https://docs.vapi.ai/providers/voice/vapi-voices" },
          { nombre: "Vapi: agentes en varios idiomas", url: "https://docs.vapi.ai/customization/multilingual" },
          { nombre: "Vapi: integraciones", url: "https://docs.vapi.ai/tools/integrations" },
          { nombre: "Vapi: Google Calendar", url: "https://docs.vapi.ai/tools/google-calendar" },
          { nombre: "Vapi: ejemplo de citas", url: "https://docs.vapi.ai/assistants/examples/appointment-scheduling" },
          { nombre: "Vapi: chat por SMS", url: "https://docs.vapi.ai/chat/sms-chat" },
          { nombre: "Vapi: SMS entrantes", url: "https://docs.vapi.ai/phone-numbers/inbound-sms" },
          { nombre: "Vapi: región de la UE", url: "https://docs.vapi.ai/security-and-privacy/eu-region" },
          { nombre: "Vapi: RGPD", url: "https://docs.vapi.ai/security-and-privacy/GDPR" },
          FUENTE_LEY,
        ]}
      />
    </PaginaGuia>
  );
}
