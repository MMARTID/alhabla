import Link from "next/link";
import { Scale } from "lucide-react";
import { Fuentes, IndiceDePaginas, Nota, PaginaGuia, Seccion, Tabla } from "@/components/pagina-guia";
import {
  CONSULTADAS,
  CUOTAS,
  FUENTES_DEL_RESUMEN,
  MINUTOS_INCLUIDOS,
  RESUMEN_PLATAFORMAS,
} from "@/lib/comparativas";
import { paginasBajo } from "@/lib/paginas";
import { metadataDePagina } from "@/lib/seo";

/**
 * Índice de las comparativas con plataformas de agentes de voz (desde el
 * 2026-10-29). Lo encuentra quien pregunta a una IA cómo automatizar las
 * llamadas de su negocio y le salen esos nombres: la respuesta es que esas
 * plataformas sirven para construir un agente, y Alhabla ya viene hecha.
 * Los datos de la tabla salen de lib/comparativas.ts, con sus fuentes.
 */
const ruta = "/comparativa";
const titulo = "Alhabla frente a plataformas de agentes de voz";
const descripcion =
  "Retell AI, Vapi, Bland AI, Synthflow y ElevenLabs sirven para construir tu propio agente de voz. Alhabla es la recepcionista de IA ya hecha para negocios con cita.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

export default function ComparativasPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      tipo="CollectionPage"
      migas={[{ name: "Comparativas", path: ruta }]}
      etiqueta={{ icono: Scale, texto: "Comparativas" }}
      titulo={titulo}
      descripcion={descripcion}
      ubicacion="comparativas"
      entradilla={
        <>
          <p>
            Si le preguntas a una IA cómo automatizar las llamadas de tu negocio, te nombrará Retell AI, Vapi o
            ElevenLabs. Son plataformas para construir un agente de voz: tú lo montas y pagas cada pieza por minuto.
          </p>
          <p className="text-base">
            Alhabla es otra cosa: una recepcionista de IA ya hecha para negocios con cita, para que no se te escape
            ninguna llamada. La das de alta sin programar y la gestionas por WhatsApp o desde el panel.
          </p>
        </>
      }
      faqs={[
        {
          question: "¿Qué es un agente de voz con IA?",
          answer:
            "Un programa que habla por teléfono: escucha, entiende y contesta. Las plataformas de esta página te dan las piezas para construir uno (la voz, el modelo de IA, la conexión con el teléfono) y tú decides qué dice y qué hace.",
        },
        {
          question: "¿Puedo montarme mi propia recepcionista con una de estas plataformas?",
          answer:
            "Sí, si tienes tiempo o alguien técnico. Tendrás que escribir sus instrucciones, conseguir un número español, conectar tu calendario y montar aparte las confirmaciones por WhatsApp. Cada página explica qué te toca con cada una.",
        },
        {
          question: "¿Por qué no comparáis el precio por minuto?",
          answer: `Porque no se compara lo mismo. Ellas cobran en dólares el minuto de su parte, y el número, el operador, el calendario o WhatsApp van aparte o los pones tú. Alhabla cuesta ${CUOTAS}, con ${MINUTOS_INCLUIDOS} y todo eso dentro.`,
        },
        {
          question: "¿Por qué PolyAI y Voiceflow no tienen página propia?",
          answer:
            "Se venden sobre todo a grandes empresas y equipos de atención al cliente, y no publican precio de plataforma en su web. Están en la tabla para que los tengas ubicados.",
        },
      ]}
      relacionadas={[
        {
          href: "/agenda-por-whatsapp",
          titulo: "Tu asistente por WhatsApp",
          texto: "Lo que ninguna de estas plataformas trae: le escribes y ella cambia tu agenda.",
        },
        {
          href: "/herramientas/calculadora-de-llamadas-perdidas",
          titulo: "Calculadora de llamadas perdidas",
          texto: "Cuánto se va cada mes por las llamadas que no coges.",
        },
        { href: "/planes", titulo: "Planes y precios", texto: "Cuota en euros, minutos incluidos y sin permanencia." },
      ]}
      cierre="Que no se te escape ninguna llamada, sin montar nada."
    >
      <Seccion
        titulo="Montarte un agente o tener la recepcionista hecha"
        entradilla={<p>Lo que una peluquería, una barbería o una clínica tendría que resolver por su cuenta.</p>}
      >
        <Tabla
          cabecera={["", "Con una plataforma de agentes", "Con Alhabla"]}
          destacada={2}
          filas={[
            ["Qué dice al coger", "Lo escribes tú en sus instrucciones", "Viene hecho para tu oficio; tú pones servicios, equipo y horario"],
            ["Número español", "Casi ninguna vende números españoles: lo traes de un operador", "Incluido: desvías tu número de siempre"],
            ["Tu calendario", "Lo conectas tú, con sus integraciones o programando", "Google, Outlook o iCloud, o la agenda de Alhabla"],
            ["WhatsApp con el cliente", "Si lo hay, lo conectas tú: tu cuenta de WhatsApp Business y sus plantillas", "Confirma cada cita y atiende al cliente que escribe"],
            ["Cambios del día a día", "Tocas instrucciones, base de conocimiento y calendario", "Se lo escribes a tu asistente por WhatsApp"],
            ["Precio", "Dólares por minuto, por piezas", CUOTAS],
          ]}
          nota="Resumen de lo que publican las cinco plataformas en su web oficial; el detalle y las fuentes de cada una están en su página."
        />
      </Seccion>

      <Seccion fondo titulo="Las cinco, y dos más, en una tabla">
        <Tabla
          cabecera={["", "Para quién", "Precio publicado", "Número español"]}
          filas={[
            ["Alhabla", "Negocios con cita en España", `${CUOTAS}, con ${MINUTOS_INCLUIDOS}`, "Incluido"],
            ...RESUMEN_PLATAFORMAS.map(({ ruta: enlace, nombre, paraQuien, precio, numero }) => [
              enlace ? (
                <Link key={nombre} href={enlace} className="text-morado-tinta underline underline-offset-4">
                  {nombre}
                </Link>
              ) : (
                nombre
              ),
              paraQuien,
              precio,
              numero,
            ]),
          ]}
          nota={`Datos de la web oficial de cada una, consultada el ${CONSULTADAS.split("-").reverse().join("-")}. Precios en dólares y sin impuestos, como los publican. «No consta» o «no publica» quiere decir que no aparece en su web, no que no exista.`}
        />
      </Seccion>

      <Seccion titulo="Una página por plataforma">
        <IndiceDePaginas paginas={paginasBajo(ruta)} />
        <div className="mt-8 max-w-3xl">
          <Nota titulo="Cómo están hechas">
            Solo con lo que cada plataforma publica en su web, con el enlace a cada dato y la fecha en que lo miramos,
            como pide el artículo 10 de la Ley 3/1991 de Competencia Desleal. Cuando una es mejor que Alhabla para un
            caso, lo decimos.
          </Nota>
        </div>
      </Seccion>

      <Fuentes consultadas={CONSULTADAS} fuentes={FUENTES_DEL_RESUMEN} />
    </PaginaGuia>
  );
}
