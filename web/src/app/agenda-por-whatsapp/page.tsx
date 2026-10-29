import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { OwnerAssistantChatMockup } from "@/components/owner-assistant-chat";
import { PaginaGuia, Seccion } from "@/components/pagina-guia";
import { guionDelGestor } from "@/lib/gestor-guiones";
import { plans } from "@/lib/plans";
import { metadataDePagina } from "@/lib/seo";

/**
 * Tu asistente por WhatsApp (2026-10-29, rehecha corta tras la visión del
 * fundador): la promesa n.º 2, el «flipa». Enseña una ausencia resuelta en
 * el chat, la regla de confianza y cuatro cosas que se le piden. La ruta no
 * puede ser /gestor ni /asistente: next.config.mjs las redirige a la app.
 *
 * Lo que dice sale del código (backend/src/modules/gestor y
 * modules/whatsapp), no de la visión: al marcar una ausencia dice qué citas
 * tenía y pregunta qué hacer con cada una; quien decide a quién pasarlas es
 * el dueño (`buscar_hueco` comprueba dónde caben, no elige al profesional).
 * Cada cambio es una propuesta que solo ejecuta el botón; el aviso al
 * cliente se pregunta tras mover o cancelar. Solo responde al móvil del
 * dueño, no llama a nadie, no reabre un día cerrado (eso, en el panel) y lo
 * que se habla con ella no gasta minutos (durationSecs 0).
 */

const ruta = "/agenda-por-whatsapp";
const titulo = "Tu asistente por WhatsApp, la que trabaja para ti";
const tituloSeo = "Tu asistente por WhatsApp para la agenda de tu negocio";
const descripcion =
  "Si falta alguien, se lo dices por WhatsApp: tu asistente te dice qué citas tenía, busca dónde recolocarlas y avisa a cada cliente cuando tú lo confirmas.";

export const metadata: Metadata = metadataDePagina({ ruta, titulo: tituloSeo, descripcion });

const desde = Math.min(...plans.map((p) => p.price));

/** Lo que le pide el dueño y lo que hace ella (guiones y tools del backend). */
const peticiones = [
  {
    mensaje: "Apunta a Rosa el jueves a las 5, mechas",
    respuesta: "La apunta en tu agenda y te pregunta si le manda a Rosa la confirmación por WhatsApp.",
  },
  {
    mensaje: "El lunes 12 cerramos, es festivo",
    respuesta: "Cierra ese día y la recepcionista deja de dar citas para esa fecha.",
  },
  {
    mensaje: "El corte de caballero sube a 18 €",
    respuesta: "Cambia el precio, y la recepcionista ya lo dice así cuando se lo preguntan.",
  },
  {
    mensaje: "¿Qué te han preguntado que no supiste?",
    respuesta: "Te lo cuenta. Le contestas («Sí, aceptamos Bizum») y a partir de ahí lo sabe.",
  },
] as const;

const faqs = [
  {
    question: "¿Necesito WhatsApp Business?",
    answer:
      "No. Le escribes desde tu WhatsApp de siempre, a un chat con el número de Alhabla. Se activa desde el panel con un mensaje que ya viene escrito.",
  },
  {
    question: "Si falta alguien, ¿reparte ella sus citas?",
    answer:
      "Te dice qué citas tenía y te propone pasar cada una, a la misma hora, a quien mejor hace ese servicio de los que están libres. Si prefieres a otra persona u otra hora, se lo dices. Nada cambia hasta que confirmas, y luego te pregunta si avisa al cliente.",
  },
  {
    question: "¿Se entera el cliente de los cambios?",
    answer:
      "Solo si tú quieres. Tras mover o cancelar una cita te pregunta si le avisa por WhatsApp o prefieres llamarle tú. Si al cliente no le va bien la hora nueva, te llega el recado.",
  },
  {
    question: "¿Puede escribirle alguien de mi equipo?",
    answer: "No. Solo contesta al móvil que vinculaste como dueño o dueña del negocio.",
  },
  {
    question: "¿Hay algo que no haga por WhatsApp?",
    answer:
      "No llama a nadie ni manda promociones: solo avisa al cliente de su cita cuando tú se lo dices. Y un día que ya cerraste se vuelve a abrir desde el panel.",
  },
];

export default function AgendaPorWhatsappPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      migas={[{ name: "Tu asistente por WhatsApp", path: ruta }]}
      etiqueta={{ icono: MessageCircle, texto: "Incluida en todos los planes" }}
      titulo={titulo}
      descripcion={descripcion}
      entradilla={
        <>
          <p>
            Si un día falta alguien, se lo escribes como a una persona: «Marta está de baja hoy». Ella te dice qué
            citas tenía y te propone pasarlas a quien mejor hace cada servicio de los que están libres. Con tu «Confirmar», las mueve y avisa a cada cliente por WhatsApp.
          </p>
          <p className="text-base leading-7">
            Va en todos los planes, desde {desde} € + IVA al mes, y lo que hablas con ella no gasta minutos.
          </p>
        </>
      }
      pieza={
        <OwnerAssistantChatMockup
          escenario={guionDelGestor().escenarios[0]}
          pie="Ejemplo con los mensajes que escribe tu asistente; los nombres son inventados."
        />
      }
      ubicacion="asistente"
      faqs={faqs}
      tituloFaqs="Preguntas sobre tu asistente"
      relacionadas={[
        {
          href: "/blog/baja-de-un-trabajador-reorganizar-agenda",
          titulo: "Baja de un trabajador: qué hacer con sus citas",
          texto: "Cómo recolocarlas y avisar a los clientes, con o sin Alhabla.",
        },
        {
          href: "/integraciones/whatsapp",
          titulo: "WhatsApp con tus clientes",
          texto: "Lo que le llega a cada cliente y cómo cambia su cita contestando.",
        },
        {
          href: "/integraciones",
          titulo: "¿Tengo que cambiar de agenda?",
          texto: "No: Google, Outlook, iCloud o, si no usas ninguna, la agenda de Alhabla.",
        },
      ]}
      cierre="Un imprevisto a mediodía, resuelto en un chat."
    >
      <section id="la-regla" className="scroll-m-20 border-y border-linea bg-relleno py-12 sm:py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="max-w-3xl text-balance text-3xl font-black leading-[1.1] tracking-tight sm:text-4xl">
            Con tus clientes manda Alhabla. Con tu agenda mandas tú.
          </h2>
          <dl className="mt-8 grid gap-8 sm:grid-cols-2 sm:gap-12">
            <div className="border-t border-linea-fuerte pt-5">
              <dt className="text-base font-bold text-tinta">Con tus clientes</dt>
              <dd className="mt-2 max-w-md text-base leading-7 text-apagado">
                Si un cliente llama o escribe para pedir, cambiar o cancelar su cita, la recepcionista lo resuelve en el
                momento, sin molestarte.
              </dd>
            </div>
            <div className="border-t border-linea-fuerte pt-5">
              <dt className="text-base font-bold text-tinta">Con tu agenda</dt>
              <dd className="mt-2 max-w-md text-base leading-7 text-apagado">
                Lo que le pides a tu asistente te lo propone antes, con todo el detalle, y no cambia nada hasta que
                pulsas «Confirmar».
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <Seccion
        id="que-pedirle"
        titulo="Lo que le puedes pedir, como a una persona."
        entradilla={<p>Por escrito o con una nota de voz. Y si prefieres el ordenador, la tienes también en tu panel.</p>}
      >
        <ul className="grid gap-x-12 gap-y-8 sm:grid-cols-2">
          {peticiones.map(({ mensaje, respuesta }) => (
            <li key={mensaje} className="border-t border-linea pt-5">
              <p className="inline-block max-w-full rounded-2xl rounded-br-sm bg-tinta px-3.5 py-2 text-sm font-medium leading-5 text-sobre-tinta">
                {mensaje}
              </p>
              <p className="mt-3 max-w-md text-base leading-7 text-apagado">{respuesta}</p>
            </li>
          ))}
        </ul>
      </Seccion>
    </PaginaGuia>
  );
}
