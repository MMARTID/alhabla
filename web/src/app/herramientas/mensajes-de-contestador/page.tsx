import Link from "next/link";
import { MessageCircle, Voicemail } from "lucide-react";
import { TarjetaDeTexto } from "@/components/herramientas/tarjeta-de-texto";
import {
  RESPUESTAS_DE_WHATSAPP,
  SITUACIONES_DE_CONTESTADOR,
  TEXTOS_DE_CONTESTADOR,
} from "@/components/herramientas/textos-de-contestador";
import { LoQueHaceAlhabla } from "@/components/herramientas/lo-que-hace-alhabla";
import { Plegado } from "@/components/herramientas/plegado";
import { Fuentes, ListaCheck, Nota, PaginaGuia, Pasos, Seccion, Texto } from "@/components/pagina-guia";
import { metadataDePagina } from "@/lib/seo";

/**
 * Mensajes de contestador y de fuera de horario (2026-10-20). Responde a
 * «mensaje fuera de horario whatsapp business» (1.º en «mensaje fuera de
 * horario»), «mensaje para contestador automatico empresa», «contestador
 * automatico para empresas» y «locucion centralita».
 *
 * La ruta de WhatsApp Business (pestaña Herramientas › Mensaje de ausencia,
 * Programar, Destinatarios) y la regla de los 14 días del mensaje de
 * bienvenida salen del servicio de ayuda oficial de WhatsApp, consultado
 * hoy. Del contestador del teléfono no se dan códigos: cambian por operador
 * y su ayuda los publica; aquí se enlaza la guía de desvío.
 */
const ruta = "/herramientas/mensajes-de-contestador";
const titulo = "Mensajes de contestador y de fuera de horario para tu negocio";
const descripcion =
  "Textos para el contestador de tu negocio y el mensaje de ausencia de WhatsApp Business: fuera de horario, vacaciones, festivos y con un cliente.";

export const metadata = metadataDePagina({
  ruta,
  titulo: "Mensaje fuera de horario y de contestador para negocios",
  descripcion,
});

const CAMPOS = ["{negocio}", "{horario}", "{vuelta}", "{festivo}"];

export default function MensajesDeContestadorPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      migas={[
        { name: "Herramientas", path: "/herramientas" },
        { name: "Mensajes de contestador", path: ruta },
      ]}
      etiqueta={{ icono: Voicemail, texto: "Herramienta gratis" }}
      titulo={titulo}
      descripcion={descripcion}
      ubicacion="mensajes_contestador"
      ctaSecundario={{ texto: "Ir a los textos", href: "#textos" }}
      entradilla={
        <p>
          Lo que oye quien te llama cuando no puedes coger, y lo que lee quien te escribe por WhatsApp con el local
          cerrado. Textos por sector, listos para grabar o pegar.
        </p>
      }
      faqs={[
        {
          question: "¿Por qué mis clientas de siempre no reciben el mensaje de ausencia?",
          answer:
            "Porque en Destinatarios está elegido «Los que no están en la libreta de contactos». Si el número es solo del negocio y guardas a tus clientes como contactos, elige «Todos».",
        },
        {
          question: "¿Qué digo en el mensaje de vacaciones?",
          answer:
            "La fecha exacta de vuelta, no «a finales de mes», y qué pasará con el recado: «te llamamos el primer día». Y quítalo el día que abres: un mensaje de vacaciones en septiembre hace pensar que has cerrado.",
        },
        {
          question: "¿Sirven para la locución de una centralita?",
          answer:
            "El saludo con el horario, sí: es lo que suena antes del menú o de la espera. Si tu centralita tiene menú, deja pocas opciones; cada «pulse uno» de más es un cliente que cuelga.",
        },
      ]}
      relacionadas={[
        { href: "/blog/contestador-automatico-vs-recepcionista-virtual", titulo: "Contestador automático o recepcionista de IA", texto: "Qué cambia cuando alguien resuelve la llamada en lugar de apuntar el recado." },
        { href: "/blog/reservas-fuera-de-horario", titulo: "Reservas fuera de horario", texto: "Las llamadas de la noche y del domingo, y qué hacer con ellas." },
        { href: "/herramientas/guion-para-atender-el-telefono", titulo: "Guion para atender el teléfono", texto: "Para las llamadas que sí coges." },
      ]}
      cierre="Teléfono y WhatsApp atendidos, también con el local cerrado."
    >
      <Seccion
        id="textos"
        titulo="Los textos, por sector"
        entradilla={
          <p>
            Cambia lo que va entre llaves: {CAMPOS.join(", ")}. El horario, como lo dirías en voz alta; la vuelta y el
            festivo, con el día concreto («el martes 1 de septiembre», «el 12 de octubre»).
          </p>
        }
      >
        <div className="space-y-3">
          {TEXTOS_DE_CONTESTADOR.map((sector, i) => (
            <details
              key={sector.id}
              id={`contestador-${sector.id}`}
              open={i === 0}
              className="group scroll-m-24 rounded-3xl border border-linea bg-superficie"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 marker:content-none sm:p-6">
                <h3 className="text-lg font-bold text-tinta">Textos para {sector.nombre.toLowerCase()}</h3>
                <span className="text-xl leading-none text-morado transition group-open:rotate-45" aria-hidden="true">
                  +
                </span>
              </summary>
              <div className="grid gap-6 border-t border-linea px-5 pb-6 pt-5 sm:px-6 lg:grid-cols-[1.3fr_1fr]">
                <div>
                  <h4 className="flex items-center gap-2 text-sm font-bold text-tinta">
                    <Voicemail className="h-4 w-4 text-morado" aria-hidden="true" />
                    Contestador del teléfono
                  </h4>
                  <div className="mt-3 grid gap-3">
                    {SITUACIONES_DE_CONTESTADOR.map(({ id, nombre }) => (
                      <TarjetaDeTexto
                        key={id}
                        titulo={nombre}
                        texto={sector.contestador[id]}
                        etiquetaCopiar={`el mensaje de contestador «${nombre.toLowerCase()}», ${sector.nombre}`}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="flex items-center gap-2 text-sm font-bold text-tinta">
                    <MessageCircle className="h-4 w-4 text-morado" aria-hidden="true" />
                    Respuestas automáticas de WhatsApp Business
                  </h4>
                  <div className="mt-3 grid gap-3">
                    {RESPUESTAS_DE_WHATSAPP.map(({ id, nombre }) => (
                      <TarjetaDeTexto
                        key={id}
                        destacada
                        titulo={nombre}
                        texto={sector.whatsapp[id]}
                        etiquetaCopiar={`el ${nombre.toLowerCase()} de WhatsApp, ${sector.nombre}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </details>
          ))}
        </div>
      </Seccion>

      <Seccion fondo titulo="Antes de usarlos">
        <div className="grid gap-4">
          <Plegado titulo="Siete reglas para grabar el contestador">
            <ListaCheck
              items={[
                <>
                  <strong>El nombre del negocio, lo primero.</strong> Quien llama tiene que saber en un segundo que ha
                  marcado bien.
                </>,
                <>
                  <strong>Veinte segundos como mucho.</strong> Unas cincuenta palabras dichas con calma. Si no caben, sobra
                  algo.
                </>,
                <>
                  <strong>Una sola petición.</strong> Nombre y teléfono. Si pides también el servicio, el día y la hora,
                  nadie se acuerda de todo al oír la señal.
                </>,
                <>
                  <strong>El horario dicho como se habla.</strong> «De martes a sábado, de diez a dos y de cinco a ocho».
                </>,
                <>
                  <strong>Sin precios.</strong> Cambian, y un mensaje viejo con un precio viejo es una discusión el día de
                  la cita.
                </>,
                <>
                  <strong>Una promesa que vayas a cumplir.</strong> «Te llamamos hoy mismo» solo si de verdad devuelves las
                  llamadas el mismo día.
                </>,
                <>
                  <strong>Grábalo en silencio, despacio y de pie.</strong> Sin secador de fondo. De pie la voz sale con más
                  aire; despacio, se entiende el número.
                </>,
              ]}
            />
            <Nota tipo="consejo" titulo="Escucha tu propio contestador">
              Llama a tu negocio desde otro móvil un domingo. Si el mensaje es de hace dos veranos, o no se entiende el
              número, lo sabrás antes que tus clientes.
            </Nota>
          </Plegado>
          <Plegado titulo="Dónde se pone el mensaje de ausencia en WhatsApp Business">
            <Pasos
              pasos={[
                { titulo: "Abre la pestaña Herramientas", texto: <>Y toca <strong>Mensaje de ausencia</strong>.</> },
                { titulo: "Actívalo", texto: <>Enciende <strong>Enviar mensaje de ausencia</strong> y toca el mensaje para pegar tu texto.</> },
                {
                  titulo: "Elige cuándo sale, en Programar",
                  texto: (
                    <>
                      <strong>Enviar siempre</strong>, <strong>Horario personalizado</strong> (para unas vacaciones) o{" "}
                      <strong>Fuera del horario comercial</strong>. Esta última solo aparece si tienes el horario puesto en el
                      perfil de empresa: rellénalo antes.
                    </>
                  ),
                },
                {
                  titulo: "Elige a quién, en Destinatarios",
                  texto: (
                    <>
                      Todos, los que no están en la libreta de contactos, todos excepto algunos o solo algunos. Después,{" "}
                      <strong>Guardar</strong>.
                    </>
                  ),
                },
              ]}
            />
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <Nota tipo="info" titulo="El de bienvenida está al lado">
                En la misma pestaña Herramientas, <strong>Mensaje de bienvenida</strong>. Sale la primera vez que alguien te
                escribe o cuando vuelve tras 14 días sin escribirte; a quien te escribió ayer no le llega.
              </Nota>
              <Nota tipo="importante" titulo="El móvil tiene que tener conexión">
                La ayuda de WhatsApp avisa de que el dispositivo necesita conexión a internet para enviar estos mensajes. Si
                apagas el móvil del negocio en vacaciones, el mensaje de ausencia no sale.
              </Nota>
            </div>
          </Plegado>
          <Plegado titulo="Y el contestador del teléfono, ¿dónde se graba?">
            <Texto>
              <p>
                Depende de la línea. En un móvil, el buzón de voz suele ser un servicio de tu operador, y el saludo se graba
                llamando a su número de buzón; en un fijo, puede ser el del operador, el de tu teléfono o el de la centralita si tienes
                una. Cada operador lo explica en su ayuda, y como cambia de uno a otro, aquí no te damos códigos que puedan
                estar viejos.
              </p>
              <p>
                Una cosa sí conviene saber antes de tocarlo: en muchas líneas, el buzón es en realidad un desvío «si no
                contesta» hacia el número del buzón. Si un día desvías esas llamadas a otro número, ese desvío ocupa su
                sitio. Lo explicamos operador por operador en la <Link href="/desvio-de-llamadas">guía de desvío de
                llamadas</Link>.
              </p>
            </Texto>
          </Plegado>
        </div>
      </Seccion>

      <LoQueHaceAlhabla titulo="Un contestador apunta recados">
        <p>
          La recepcionista de IA contesta y da la cita, por teléfono y por WhatsApp, también a las once de la noche.
          Tus clientes no se bajan nada, y tú lo ves por WhatsApp o en el panel.
        </p>
      </LoQueHaceAlhabla>

      <Fuentes
        consultadas="2026-10-20"
        fuentes={[
          { nombre: "WhatsApp: cómo usar los mensajes de ausencia", url: "https://faq.whatsapp.com/2565868990219715/?locale=es_ES" },
          { nombre: "WhatsApp: cómo usar los mensajes de bienvenida", url: "https://faq.whatsapp.com/501866148528310/?locale=es_ES" },
        ]}
      />
    </PaginaGuia>
  );
}
