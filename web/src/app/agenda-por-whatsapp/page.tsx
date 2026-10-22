import type { Metadata } from "next";
import Link from "next/link";
import {
  BellRing,
  CalendarClock,
  Check,
  Lightbulb,
  MessageCircle,
  Mic,
  Scissors,
  ShieldCheck,
  Users,
} from "lucide-react";
import { OwnerAssistantChatMockup } from "@/components/owner-assistant-chat";
import { Nota, PaginaGuia, Pasos, Seccion, Tabla, Tarjetas, Texto } from "@/components/pagina-guia";
import { nicheLinks } from "@/lib/niche-landings";
import { GUIONES_GESTOR } from "@/lib/gestor-guiones";
import { plans } from "@/lib/plans";
import { metadataDePagina } from "@/lib/seo";

/**
 * El Gestor por WhatsApp (2026-10-20, rehecha sobre `PaginaGuia`): el
 * asistente del dueño. Ya no se vende como «lo que nadie tiene» — mims
 * (mims.studio) publica un asistente por WhatsApp para el dueño desde 79 € —,
 * sino por lo que de verdad no publica nadie: la ausencia de punta a punta
 * con el aviso a cada cliente, cada cambio con su «Confirmar», y que va en
 * todos los planes. La ruta no puede ser /gestor: next.config.mjs la
 * redirige a la app.
 *
 * Todo sale del código (backend/src/modules/gestor y modules/whatsapp):
 * - acciones (siempre propuesta + «Confirmar», una a la vez, caducan a las
 *   24 h; el texto de lo que se va a hacer lo escribe el sistema): añadir,
 *   mover y cancelar citas, avisar al cliente, marcar ausencias (hasta 62
 *   días), bloquear un tramo, cerrar días (hasta 31 seguidos), horario,
 *   servicios, profesionales y su especialidad, e «información del negocio»
 *   (actualizar_informacion);
 * - consultas: contexto_negocio, listar_agenda (citas, no huecos),
 *   resumen_llamadas, buscar_hueco (una hora concreta o la más cercana),
 *   buscar_cliente, dudas_sin_respuesta;
 * - AGENDA / HOY / MAÑANA (router.ts) y los avisos de avisosNegocio.ts y
 *   alertas.ts, con sus botones reales;
 * - las notas de voz se transcriben (webhooks.ts); idioma de respuesta en
 *   lib/gestorPayload.ts; las citas del Gestor no gastan minutos
 *   (durationSecs 0).
 * Lo que NO hace se dice: reabrir un día cerrado (panel), llamar a nadie.
 */

const ruta = "/agenda-por-whatsapp";
const titulo = "Gestiona tu agenda por WhatsApp con IA";
const descripcion =
  "Escríbele o mándale una nota de voz a tu Gestor: marca una baja, mueve sus citas y avisa a cada cliente, cambia un precio o cierra un día. Cada cambio espera tu «Confirmar».";

export const metadata: Metadata = metadataDePagina({ ruta, titulo, descripcion });

const desde = Math.min(...plans.map((p) => p.price));

const grupos = [
  {
    titulo: "Tu agenda",
    icono: CalendarClock,
    ejemplos: [
      "«¿Qué tengo mañana?»",
      "«¿Hay hueco el jueves a las 5 para un tinte?»: si no, te da la hora libre más cercana",
      "«Apúntame a Carmen el viernes a las 17:00 para corte»",
      "«Mueve la cita de las 5 al sábado» o «cancela la de Pablo»",
      "«¿Cuándo vino Carmen la última vez?»",
    ],
  },
  {
    titulo: "Tu equipo",
    icono: Users,
    ejemplos: [
      "«Marta no viene mañana»: te dice qué citas tenía",
      "«Irene no está el jueves de 9 a 12, tiene formación»",
      "«Laura es la especialista en color»",
      "«Ha entrado Pablo, hace cortes de caballero»",
    ],
  },
  {
    titulo: "Horario y servicios",
    icono: Scissors,
    ejemplos: [
      "«Cerramos el sábado por la tarde»",
      "«Vacaciones del 1 al 15 de agosto»",
      "«Los martes abrimos a las 10»",
      "«El corte de caballero pasa a 18 €» o «ya no hacemos alisado»",
    ],
  },
  {
    titulo: "Lo que tu recepcionista no supo",
    icono: Lightbulb,
    ejemplos: [
      "«¿Qué te han preguntado que no supiste?»",
      "«Sí, aceptamos Bizum»: y a partir de ahí lo contesta ella",
      "«¿Cuántas llamadas hubo esta semana y cuántas acabaron en cita?»",
    ],
  },
] as const;

const faqs = [
  {
    question: "¿Necesito WhatsApp Business?",
    answer:
      "No. Hablas con tu Gestor desde tu WhatsApp de siempre: es un chat más, con el número de Alhabla. Lo activas en Ajustes › Teléfono › Tu móvil enviando un mensaje que ya viene escrito.",
  },
  {
    question: "¿Puede cambiar algo sin que yo lo sepa?",
    answer:
      "No. Cada cambio llega como una propuesta con lo que va a hacer, y solo se hace cuando pulsas «Confirmar». Si no confirmas, no toca nada, y la propuesta caduca a las 24 horas.",
  },
  {
    question: "Si falta alguien, ¿mueve sus citas solo?",
    answer:
      "No, y es a propósito. Primero confirmas la ausencia; luego le dices qué hacer con cada cita y confirmas cada cambio; y al final decides si avisa al cliente o le llamas tú. Así nunca se mueve una cita que no querías mover.",
  },
  {
    question: "¿Se entera el cliente de los cambios?",
    answer:
      "Solo si tú quieres. Después de mover o cancelar una cita, el Gestor te pregunta si le avisa por WhatsApp, con su móvil a la vista por si prefieres llamarle. El cliente puede contestar «Vale» o «No me va bien», y eso último te llega como recado.",
  },
  {
    question: "¿Le puedo hablar en vez de escribir?",
    answer: "Sí. Le mandas una nota de voz como a cualquier contacto y la entiende igual que un mensaje escrito.",
  },
  {
    question: "¿Y si prefiero hacerlo desde el ordenador?",
    answer:
      "El mismo Gestor está en tu panel web, con la agenda al lado y el registro de los cambios que ha hecho. Lo que hagas en un sitio se ve en el otro.",
  },
  {
    question: "¿Puede escribirle alguien de mi equipo?",
    answer:
      "No. Solo responde al móvil que vinculaste como dueño. Tu equipo puede seguir mirando la agenda en el calendario de siempre.",
  },
  {
    question: "¿Cuánto cuesta?",
    answer: `Va incluido en todos los planes, también en el de ${desde} € + IVA al mes, y lo que hablas con él no gasta minutos de tu plan.`,
  },
  {
    question: "¿Hay algo que no pueda hacer por WhatsApp?",
    answer:
      "Reabrir un día que ya cerraste se hace desde el panel. Y el Gestor no llama a nadie ni manda promociones: solo avisa al cliente de su cita cuando tú se lo dices.",
  },
  {
    question: "¿Funciona sin calendario conectado?",
    answer:
      "Para apuntar o mover citas necesita leer tu calendario, igual que la recepcionista: así nunca reserva encima de algo que ya tenías. El horario, los servicios y el equipo los cambias igual.",
  },
  {
    question: "¿En qué idioma me contesta?",
    answer:
      "En castellano, o en catalán, gallego, euskera o inglés si le escribes en ese idioma. Los avisos automáticos van en castellano.",
  },
];

export default function AgendaPorWhatsappPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      migas={[{ name: "Agenda por WhatsApp", path: ruta }]}
      etiqueta={{ icono: MessageCircle, texto: "Tu Gestor · incluido en todos los planes" }}
      titulo={titulo}
      descripcion={descripcion}
      entradilla={
        <>
          <p>
            Tu recepcionista de IA atiende a tus clientes. El Gestor te atiende a ti: le escribes o le mandas una nota de
            voz por WhatsApp lo que ha cambiado —una baja, un cierre, la cita que te piden en caja, un precio nuevo—, te
            propone el cambio y lo hace cuando pulsas «Confirmar».
          </p>
          <p>Va en todos los planes, desde {desde} € + IVA al mes, y hablar con él no gasta minutos.</p>
        </>
      }
      ctaSecundario={{ texto: "Ver cómo resuelve una baja", href: "#una-baja" }}
      ubicacion="gestor"
      faqs={faqs}
      tituloFaqs="Preguntas sobre el Gestor"
      relacionadas={[
        { href: "/blog/baja-de-un-trabajador-reorganizar-agenda", titulo: "Baja de un trabajador: reorganizar la agenda", texto: "Qué hacer con sus citas y cómo avisar a los clientes afectados." },
        { href: "/integraciones/whatsapp", titulo: "WhatsApp para tus clientes", texto: "Lo que le llega a cada cliente: confirmación, recordatorio y lista de espera." },
        { href: "/blog/cambiar-cita-por-whatsapp-peluqueria", titulo: "Cambiar una cita por WhatsApp", texto: "Cómo mueve o anula su cita el cliente sin llamarte." },
        { href: "/integraciones", titulo: "Calendarios que conecta", texto: "Google Calendar, Outlook e iCloud: lo que mueve el Gestor se mueve en tu calendario." },
        { href: "/comparativa/alhabla-vs-heydiga", titulo: "Alhabla frente a HeyDiga", texto: "Precio, WhatsApp y gestión de la agenda, con los datos que publica cada uno." },
        { href: "/glosario", titulo: "Glosario", texto: "Desvío, lista de espera, reparto por especialidad y el resto de términos." },
      ]}
      cierre="Tu agenda, en el mismo sitio que tus mensajes."
    >
      <Seccion
        id="una-baja"
        titulo="«Mañana falta Marta», resuelto desde el chat."
        entradilla={
          <p>
            Es lo que pasa cada semana en un negocio con equipo, y lo que más tiempo quita: alguien no viene y hay que
            bloquear su agenda, recolocar sus citas y avisar a cada cliente. Con el Gestor son tres pasos, cada uno con su
            «Confirmar».
          </p>
        }
      >
        <div className="grid items-start gap-8 lg:grid-cols-[1fr_1.05fr]">
          <Pasos
            pasos={[
              {
                titulo: "Marcas la ausencia",
                texto:
                  "«Marta está de baja hoy», «no viene el jueves» o «está de vacaciones hasta el 30». Al confirmar, la recepcionista deja de darle citas en ese tramo (un día, unas horas o hasta dos meses) y el Gestor te dice cuántas tenía: «dime si las movemos o las cancelamos».",
              },
              {
                titulo: "Recolocas cada cita",
                texto:
                  "Le dices a quién pasar cada una o a qué hora moverla. El Gestor comprueba el hueco en tu agenda real, con quien lo hace y sin pisar otra cita, y al confirmar la cambia también en tu calendario. Si prefieres cancelarla, el hueco se ofrece a quien esperaba esa hora en la lista de espera.",
              },
              {
                titulo: "Decides si avisa al cliente",
                texto:
                  "Tras cada cambio te pregunta «¿Le aviso por WhatsApp de la nueva hora?», con su móvil a la vista: «Sí, avísale» o «Le llamo yo». El cliente recibe el aviso y contesta «Vale» o «No me va bien»; si no le va bien, te llega como recado.",
              },
            ]}
          />
          <div>
            <OwnerAssistantChatMockup escenario={GUIONES_GESTOR.peluqueria.escenarios[0]} />
            <p className="mt-3 px-1 text-xs leading-5 text-tenue">
              Ejemplo con los mensajes que escribe el Gestor; los nombres son inventados.
            </p>
          </div>
        </div>
        <div className="mt-8">
          <Nota titulo="¿Por qué no lo hace todo de golpe?">
            Porque quien sabe si Rosa prefiere a Laura o cambiar de día eres tú. El Gestor hace el trabajo pesado —mirar
            huecos, cambiar el calendario, escribir al cliente— y tú decides en cada paso con un toque.
          </Nota>
        </div>
      </Seccion>

      <Seccion
        id="que-pedirle"
        fondo
        titulo="Lo que le puedes pedir, como a una persona."
        entradilla={
          <p>
            Sin menús ni formularios: le hablas como le hablarías a quien lleva tu mostrador. Estos son ejemplos de lo que
            entiende hoy.
          </p>
        }
      >
        <ul className="grid gap-4 sm:grid-cols-2">
          {grupos.map(({ titulo: tituloGrupo, icono: Icono, ejemplos }) => (
            <li key={tituloGrupo} className="panel p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-lavado text-morado">
                <Icono className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-lg font-bold text-tinta">{tituloGrupo}</h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-muted">
                {ejemplos.map((ejemplo) => (
                  <li key={ejemplo} className="flex items-start gap-2">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-morado" aria-hidden="true" />
                    {ejemplo}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm leading-6 text-muted">
          ¿Solo quieres ver el día? Escribe <strong className="font-semibold text-tinta">HOY</strong>,{" "}
          <strong className="font-semibold text-tinta">MAÑANA</strong> o{" "}
          <strong className="font-semibold text-tinta">AGENDA</strong> y te llega la lista de citas al momento.
        </p>
      </Seccion>

      <Seccion
        titulo="Y te avisa de lo que importa, con un botón para resolverlo."
        entradilla={
          <p>
            Al mismo WhatsApp te llegan los avisos del día a día. Cada uno trae los botones para resolverlo sin abrir el
            panel.
          </p>
        }
      >
        <Tabla
          cabecera={["Cuando…", "Te llega", "Lo resuelves con"]}
          filas={[
            ["La recepcionista reserva una cita", "Quién, qué, cuándo y con quién", "«Vale» · «Ver agenda de hoy»"],
            [
              "Una cita no ha podido entrar en tu calendario",
              "El motivo; la cita queda pendiente y se reintenta cada 6 horas durante dos días",
              "«La apunté yo» · «Reintentar» · «Reconectar»",
            ],
            ["Un cliente cancela", "Qué cita se ha liberado", "«Avisar lista espera»"],
            ["Alguien deja un recado", "Su nombre, su teléfono y lo que quería", "«Atendido» · «Recuérdamelo mañana»"],
            ["Tu calendario se desconecta", "Qué calendario y qué hacer", "«Ir a Ajustes»"],
            ["Llevas el 80 % de tus minutos", "Cuántos te quedan este mes", "«Ir a Ajustes»"],
          ]}
          nota="Si no quieres el aviso de cada cita nueva, se apaga en Ajustes. Los demás llegan siempre: son los que evitan que una cita se pierda."
        />
      </Seccion>

      <Seccion fondo titulo="Seguro por diseño.">
        <Tarjetas
          items={[
            {
              icono: ShieldCheck,
              titulo: "Nada cambia sin tu «Confirmar»",
              texto:
                "La IA solo puede proponer. Lo que se va a hacer lo escribe el sistema, con los datos reales, y la propuesta caduca a las 24 horas si no la confirmas.",
            },
            {
              icono: Users,
              titulo: "Solo tu número",
              texto: "Responde al móvil que vinculaste como dueño. Una propuesta a la vez, y dos toques seguidos no hacen el cambio dos veces.",
            },
            {
              icono: BellRing,
              titulo: "El cliente, solo si tú quieres",
              texto: "No escribe a nadie por su cuenta, y nunca a quien pidió no recibir mensajes.",
            },
            {
              icono: Mic,
              titulo: "Con las manos ocupadas",
              texto: "Le mandas una nota de voz entre clienta y clienta y la entiende igual que un mensaje escrito.",
            },
          ]}
          columnas={2}
        />
      </Seccion>

      <Seccion titulo="Cómo trabaja en tu sector">
        <Texto>
          <p>
            Cada página de sector cuenta las bajas, los cierres y los cambios con los servicios de ese oficio: unas mechas
            que pasan a otra estilista, un facial a otra esteticista, el baño de un perro a otro día.
          </p>
        </Texto>
        <ul className="mt-6 flex flex-wrap gap-2">
          {nicheLinks.map(({ href, label }) => (
            <li key={href}>
              <Link href={href} className="btn-secondary h-10 px-4 text-sm">
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </Seccion>
    </PaginaGuia>
  );
}
