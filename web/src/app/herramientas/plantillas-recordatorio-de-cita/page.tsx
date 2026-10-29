import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import { ExploradorDePlantillas } from "@/components/herramientas/explorador-de-plantillas";
import { LoQueHaceAlhabla } from "@/components/herramientas/lo-que-hace-alhabla";
import { Plegado } from "@/components/herramientas/plegado";
import { Fuentes, ListaCheck, Nota, PaginaGuia, Seccion, Tabla, Texto } from "@/components/pagina-guia";
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
 * sanitario (apartados 5 y 7.C). Lo que hace Alhabla sale
 * de backend/src/modules/whatsapp/mensajesCliente.ts: confirmación en todos
 * los planes si el cliente acepta mensajes en la llamada, recordatorio 24 h
 * antes (si la cita está a más de 24 h) con botones Confirmo, Cancelar y
 * Cambiar en los planes que incluyen recordatorios, hueco libre, y cambio o
 * cancelación cuando el dueño lo pide desde tu asistente. Las plantillas
 * van arriba; la explicación (qué lleva, cuándo, WhatsApp o SMS y la ley),
 * plegada debajo.
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
          Un mensaje para cada momento de una cita: al reservarla, uno o dos días antes, si cambia, si se anula y
          cuando se libera la hora que alguien esperaba. Por sector, en WhatsApp y en SMS, para copiar.
        </p>
      }
      faqs={[
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
          question: "¿Puedo aprovechar el recordatorio para anunciar una oferta?",
          answer:
            "Mejor no. Un descuento convierte el mensaje en comunicación comercial, y el artículo 21 de la LSSI prohíbe enviarla por medios electrónicos sin que el cliente la haya pedido o autorizado. La excepción para clientes que ya te compraron algo parecido exige ofrecer en cada mensaje una forma sencilla y gratuita de darse de baja. Manda las ofertas aparte y deja el recordatorio limpio.",
        },
      ]}
      relacionadas={[
        { href: "/blog/recordatorios-de-citas-por-whatsapp", titulo: "Recordatorios de citas por WhatsApp", texto: "La secuencia de avisos y qué medir cada mes." },
        { href: "/herramientas/politica-de-cancelacion", titulo: "Generador de política de cancelación", texto: "La frase que va al final de la confirmación, con tus plazos." },
        { href: "/integraciones/whatsapp", titulo: "WhatsApp en Alhabla", texto: "Lo que tu recepcionista manda sola a tus clientes." },
      ]}
      cierre="Que cada cita quede confirmada por WhatsApp sin escribirla tú."
    >
      <Seccion
        id="plantillas"
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

      <Seccion fondo titulo="Antes de usarlas">
        <div className="grid gap-4">
          <Plegado titulo="Qué tiene que llevar un mensaje de confirmación">
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
          </Plegado>
          <Plegado titulo="Cuándo enviar cada uno">
            <Tabla
              cabecera={["Momento", "Cuándo", "Para qué sirve"]}
              filas={[
                ["Confirmación", "Nada más cerrar la cita.", "Que el cliente tenga por escrito lo que se acordó y vea ahora si apuntó mal la hora."],
                ["Recordatorio", "Entre 24 y 48 horas antes; más cerca de 48 en servicios largos.", "Saber a tiempo quién no va a venir y poder dar su hora a otra persona."],
                ["Cambio de hora", "En cuanto se mueve, la mueva el cliente o la muevas tú.", "Que la cita vieja no se quede en la cabeza de nadie. Si la mueves tú, empieza disculpándote."],
                ["Cancelación", "Al anularla, aunque la anule el propio cliente.", "Cerrar sin dudas y dejar la puerta abierta a otra fecha."],
                ["Hueco libre", "Cuando se libera la hora que un cliente te pidió que le avisaras.", "Avisar a quien lo esperaba. Dilo claro: es para quien conteste primero."],
              ]}
              nota="Tres mensajes por cita como mucho: confirmación, recordatorio y, si hace falta, el de cambio."
            />
          </Plegado>
          <Plegado titulo="WhatsApp o SMS">
            <Texto>
              <p>
                <strong>WhatsApp</strong> es donde ya hablan tus clientes: admite textos largos y te contestan en el
                mismo chat. Desde la aplicación WhatsApp Business no cuesta nada; lo que cuesta es el rato de mandarlos
                uno a uno.
              </p>
              <p>
                <strong>El SMS</strong> llega a todos, pero cabe en 160 caracteres solo si no lleva «á», «í», «ó» ni
                «ú»: con una, se parte en trozos de 70 y pagas cada uno. Por eso las plantillas de SMS evitan esas
                vocales («sabado», sin tilde) y piden llamar en lugar de contestar, porque a muchos SMS no se puede
                responder.
              </p>
            </Texto>
          </Plegado>
          <Plegado titulo="Lo que dice la ley de estos mensajes">
            <div className="grid gap-4 lg:grid-cols-3">
              <Nota tipo="info" titulo="El recordatorio no necesita consentimiento aparte">
                El RGPD considera lícito el tratamiento necesario «para la ejecución de un contrato en el que el
                interesado es parte» (art. 6.1.b). Lo que sí debes es decirle, al tomar su teléfono, que lo usarás para
                avisarle.
              </Nota>
              <Nota tipo="importante" titulo="Fisioterapia: la mínima información">
                La guía de la AEPD para profesionales sanitarios pide «la mínima información posible para identificar
                la cita (día, hora, centro, unidad)». Por eso esas plantillas no llevan el servicio.
              </Nota>
              <Nota tipo="consejo" titulo="WhatsApp en un centro sanitario">
                La misma guía permite recordar la cita por mensajería si le llega solo al paciente, y pide ofrecer otro
                canal a quien no quiera WhatsApp: el SMS o una llamada.
              </Nota>
            </div>
          </Plegado>
        </div>
      </Seccion>

      <LoQueHaceAlhabla titulo="Con Alhabla, estos mensajes salen solos" regla>
        <p>
          La confirmación sale en todos los planes, y el recordatorio 24 horas antes, con botones para confirmar,
          cancelar o cambiar, en {nombresConRecordatorio}. Tus clientes te contestan por WhatsApp; lo que mueves tú
          desde <Link href="/agenda-por-whatsapp">tu asistente</Link>, te lo confirma antes y avisa al cliente si se lo pides.
        </p>
      </LoQueHaceAlhabla>

      <Fuentes
        consultadas="2026-10-20"
        fuentes={[
          { nombre: "Reglamento General de Protección de Datos, art. 6 (BOE)", url: "https://www.boe.es/buscar/doc.php?id=DOUE-L-2016-80807" },
          { nombre: "Ley 34/2002 (LSSI), art. 21 (BOE)", url: "https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758" },
          { nombre: "AEPD: Guía para profesionales del sector sanitario (PDF)", url: "https://www.aepd.es/guias/guia-profesionales-sector-sanitario.pdf" },
        ]}
      />
    </PaginaGuia>
  );
}
