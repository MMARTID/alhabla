import type { BusinessType } from "./businessType.js";
import type { TransferenciaAlDueno } from "./transferenciaAlDueno.js";
import type { AgentSettings } from "./managedAgentPrompt.js";

/**
 * Las secciones del prompt gestionado de la recepcionista: una función por
 * cada «## Título», en el orden de SECCIONES_DEL_PROMPT, que es el que
 * compone buildManagedAgentPrompt (managedAgentPrompt.ts). Cada sección
 * devuelve sus párrafos; los vacíos se descartan y el resto se une con una
 * línea en blanco.
 *
 * Un solo carácter distinto cambia el `telnyxConfigHash` y actualiza todos
 * los assistants (y publica una versión nueva en Retell): las instantáneas
 * de tests/lib/managedAgentPrompt.snapshot.test.ts lo vigilan. Muchas reglas
 * salieron de llamadas reales o de mediciones por chat; los comentarios con
 * fecha dicen de dónde, y ninguna se quita sin repetir la medición.
 */

/** Lo que las secciones necesitan saber del negocio, ya resuelto. */
export interface ContextoDelPrompt {
  settings: AgentSettings;
  /** La instrucción de idioma de «## Rol» y el recordatorio que cierra el
   * prompt (instruccionesDeIdioma en lib/idiomas/resolver.ts). */
  idioma: { instruccion: string; recordatorio: string | null };
  businessType?: BusinessType;
  /** Ya recortada: vacía o sin valor si el negocio no la tiene. */
  businessDetails?: string;
  /** Zona IANA válida (resolveManagedPromptTimezone). */
  timezone: string;
  minAdvanceBookingMinutes?: number | null;
  maxAppointmentDurationMinutes?: number | null;
  /** ¿Está aprobada la plantilla `hueco_libre`? Ver buildManagedAgentPrompt. */
  listaDeEspera: boolean;
  /** `Business.hideOwnerNumberFromClients`. */
  ocultarNumero: boolean;
  transferenciaAlDueno?: TransferenciaAlDueno | null;
}

/** Variables del prompt que dependen de quien llama: las pone el backend
 * al contestar cada llamada (lib/contextoDeLlamada.ts). */
export interface VariablesDeLaLlamada {
  [variable: string]: string;
  /** Nombre de su última reserva con ese teléfono; vacío si no se conoce. */
  nombre_cliente: string;
  /** Servicios de esa reserva; vacío si no se conoce. */
  ultimo_servicio: string;
}

/** Los valores de quien no se conoce: el assistant los guarda por defecto
 * para el chat de WhatsApp y para una llamada en la que no se pudo mirar
 * nada. */
export const VARIABLES_DE_LA_LLAMADA_POR_DEFECTO: Readonly<VariablesDeLaLlamada> =
  { nombre_cliente: "", ultimo_servicio: "" };

type Parrafos = Array<string | null>;
type Seccion = (contexto: ContextoDelPrompt) => Parrafos;

const TONE_INSTRUCTIONS: Record<AgentSettings["tone"], string> = {
  warm: "Habla con cercanía, empatía y naturalidad, manteniendo un tono profesional.",
  professional: "Habla con claridad, seguridad y cortesía profesional.",
  direct: "Habla de forma ágil, práctica y directa, sin resultar brusco.",
};

const GOAL_INSTRUCTIONS: Record<AgentSettings["primaryGoal"], string> = {
  bookings: "Tu objetivo principal es convertir consultas en reservas correctamente confirmadas.",
  customer_service: "Tu objetivo principal es resolver consultas con precisión y facilitar una reserva cuando corresponda.",
  lead_capture: "Tu objetivo principal es identificar la necesidad del cliente y recoger sus datos para que el negocio pueda continuar la atención.",
};

const ESCALATION_INSTRUCTIONS: Record<AgentSettings["escalation"], string> = {
  take_message: "Si no puedes resolver algo con información verificada, toma un recado claro con nombre, teléfono y motivo.",
  request_callback: "Si no puedes resolver algo con información verificada, solicita nombre y teléfono para que el equipo devuelva la llamada.",
};

/**
 * Instrucciones específicas por tipo de negocio: qué preguntar además de los
 * datos básicos de la reserva. Añadir un nicho nuevo es una línea aquí, no
 * una rama de código nueva. La de fisioterapia pide el motivo en términos
 * generales a propósito: no solicita datos de salud estructurados.
 */
const NICHE_INSTRUCTIONS: Record<BusinessType, string> = {
  peluqueria:
    "Si la petición es ambigua (por ejemplo, \"quiero cambiar de look\"), pregunta primero si busca corte, color o peinado. Si ya sabe lo que quiere, no le interrogues de nuevo. Para trabajos técnicos o dudas sobre el resultado, no prometas un resultado: ofrece una valoración o que el equipo le oriente.",
  barberia:
    "Aclara solo lo necesario entre corte, barba o ambos. Si pide un estilo sin concretar, pregunta una sola preferencia útil (por ejemplo, si quiere mantener largo o un degradado); no recomiendes ni prometas un resultado técnico que el barbero deba valorar en persona.",
  fisioterapia:
    "Pregunta el motivo de la consulta en términos generales (primera visita, seguimiento, rehabilitación o descarga), sin solicitar historial clínico ni detalles médicos innecesarios. No diagnostiques, no pautes ejercicios ni afirmes qué lesión tiene. Si describe una urgencia clara, indícale que contacte con emergencias o un profesional sanitario sin demorar esa atención.",
  "salon-de-unas":
    "Aclara solo si es manicura o pedicura, el acabado principal y, cuando aplique, si es una aplicación nueva, mantenimiento o retirada. Si el servicio está claro, pasa a la cita sin repasar todos los acabados ni decoraciones posibles.",
  "centro-de-estetica":
    "Aclara el tratamiento que busca y pregunta si es la primera vez únicamente cuando sea relevante para una valoración previa. No asegures resultados estéticos ni aconsejes sobre contraindicaciones: si la duda requiere valoración profesional, toma el recado o ofrece que el centro contacte con la persona.",
  other:
    "Aclara con una pregunta breve qué necesita antes de hablar de una cita. Si no existe un servicio verificable que encaje, no lo inventes: toma un recado o propone que el equipo le contacte.",
};

function formatMinutesForHumans(minutes: number): string {
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} ${hours === 1 ? "hora" : "horas"}`;
  }
  return `${minutes} minutos`;
}

function buildRestrictionsFragment(input: {
  minAdvanceBookingMinutes?: number | null;
  maxAppointmentDurationMinutes?: number | null;
}): string | null {
  const parts: string[] = [];
  if (input.minAdvanceBookingMinutes) {
    parts.push(`No ofrezcas ni confirmes citas con menos de ${formatMinutesForHumans(input.minAdvanceBookingMinutes)} de antelación.`);
  }
  if (input.maxAppointmentDurationMinutes) {
    parts.push(`Ninguna cita puede durar más de ${input.maxAppointmentDurationMinutes} minutos.`);
  }
  return parts.length > 0 ? parts.join(" ") : null;
}

/** Cabecera del bloque que obliga a consultar get_catalog antes de
 * confirmar un servicio, un profesional o el horario. */
export const TITULO_DEL_BLOQUE_DEL_CATALOGO = "## Lo que ofrece el negocio";

/** Cabecera del bloque de transferencia; sirve para saber si un prompt
 * editado a mano ya lo lleva (lib/telnyxAgentSync.ts). */
export const TITULO_DEL_BLOQUE_DE_TRANSFERENCIA = "## Pasar la llamada";

/**
 * «## Pasar la llamada» (fase 4): solo cuando la tool `transfer` está
 * registrada de verdad (transferencia.activa), para que el prompt nunca
 * mande usar una herramienta que el assistant no tiene. El texto de
 * «si no coge» da por hecho lo que documenta Telnyx: si la pata al dueño
 * no cuadra (no contesta, comunica o salta el buzón con la detección de
 * contestador), la llamada sigue con la recepcionista.
 *
 * Exportado para que el sync de Telnyx pueda añadirlo a un prompt editado
 * a mano: la tool nunca viaja sin su regla.
 */
export function buildTransferInstruction(
  transferencia: TransferenciaAlDueno | null | undefined
): string | null {
  if (!transferencia?.activa) return null;
  const cuando =
    transferencia.modo === "siempre"
      ? "Pásala si el cliente pide hablar con una persona o con el responsable, y también si surge algo que no debes resolver tú: una queja, una urgencia, una pregunta sobre pagos o cualquier asunto que no sea reservar, consultar o cambiar una cita. Solo dentro del horario de apertura del negocio (compáralo con la hora actual; si no lo sabes, consúltalo con get_catalog): fuera de ese horario no la pases, toma recado."
      : "Pásala solo si el cliente pide de forma clara hablar con una persona o con el responsable. Para quejas, urgencias, pagos o cualquier cosa que no puedas resolver tú, ofrece primero tomar recado; pásala si aun así insiste en hablar con alguien.";
  return [
    TITULO_DEL_BLOQUE_DE_TRANSFERENCIA,
    "Puedes pasar la llamada al responsable del negocio con la herramienta de transferencia (transfer).",
    cuando,
    "Antes de pasarla, dile al cliente en una frase que le pasas con el responsable y que espere un momento. Pásala una sola vez por llamada.",
    "Si la transferencia falla o el responsable no contesta, la llamada sigue contigo: dile con naturalidad que ahora no puede atenderle y pregúntale si prefiere que le llamen o dejar recado. No vuelvas a intentar pasarla en la misma llamada.",
  ].join("\n");
}

function seccionRol({ settings, idioma }: ContextoDelPrompt): Parrafos {
  return [
    "## Rol",
    // Reglamento europeo de IA, art. 50: quien llama tiene que saber desde el
    // principio que habla con una IA. Lo dice el saludo (lib/idiomas/
    // catalogo.ts) en cada llamada; hasta el 2026-10-12 el prompt mandaba no
    // mencionarlo salvo que preguntaran. Nunca se niega.
    "Eres la recepcionista virtual de {{nombre_negocio}} y eres una inteligencia artificial. En las llamadas el saludo ya lo dice al descolgar: no lo repitas. Si te preguntan si eres una persona o una máquina, di siempre la verdad.",
    idioma.instruccion,
    TONE_INSTRUCTIONS[settings.tone],
    GOAL_INSTRUCTIONS[settings.primaryGoal],
    settings.responseStyle === "concise"
      ? "Responde en una o dos frases."
      : "Da solo el detalle necesario.",
  ];
}

function seccionConversacion(): Parrafos {
  return [
    "## Conversación",
    "Reconoce brevemente lo que dice la persona y haz una sola pregunta útil por turno. Evita listas, jerga, repetir datos y frases largas. Di fechas, horas y duraciones como se hablan por teléfono.",
    "No enumeres opciones sin necesidad: responde solo a lo que te preguntan.",
    "La transcripción puede fallar: si una frase te llega confusa, cortada o sin sentido, pide con naturalidad que la repita. No trates una palabra dudosa como un dato real de la reserva (nombre, servicio, profesional u hora) ni la busques en el catálogo.",
    "Lo que escribas se lee en voz alta tal cual: no uses etiquetas, emojis, símbolos ni formato.",
  ];
}

function seccionCliente(): Parrafos {
  return [
    // Lo resuelve el backend antes de descolgar (lib/contextoDeLlamada.ts)
    // y el saludo ya lo usa: el nombre siempre; el servicio, salvo en
    // fisioterapia, estética y otros (decisión del usuario del 2026-10-13).
    "## Cliente",
    "Nombre de su última reserva con este teléfono: {{nombre_cliente}}. Su último servicio: {{ultimo_servicio}}. Si están vacíos, no le conoces: atiéndele como a cualquiera.",
    "Si hay nombre, el saludo ya le ha llamado por él y le ha preguntado si quiere repetir: si dice que sí, ese es el servicio y ese es su nombre, no se los vuelvas a pedir. Si el saludo no nombró el servicio, no lo digas tú hasta que diga que quiere repetir. Si dice que no es esa persona, discúlpate y pídele el nombre como a cualquier cliente.",
  ];
}

function seccionGrabacion(): Parrafos {
  return [
    // Grabación con permiso (decisiones del usuario del 12, 13 y 14-10-2026,
    // lib/grabacion.ts). Cuándo preguntarlo lo decide el backend y lo manda
    // en la respuesta de check_availability: con la regla en
    // el prompt («si {{grabacion}} es sin_preguntar…») volvía a preguntar a
    // quien ya lo había aceptado (4 de 4 llamadas del 14-10). Con la
    // respuesta de la tool ya en la mano, para que no salga encima de la
    // del cliente. En positivo: con «¿te importa…?» el cliente contestaba
    // «No» queriendo decir que sí (dev, 13-10). La finalidad, la real: el
    // audio es solo para que el negocio lo revise. Sin explicaciones
    // legales salvo que pregunten. «Fuera de esos dos casos»: en el
    // laboratorio del paso 3 del refactor (14-10) la llamó 3 veces en 60
    // conversaciones sin que nadie hablara de grabar, justo tras dar el
    // nombre, y guardaba un «no».
    "## Grabación",
    "La transcripción se guarda siempre; el audio, solo si quien llama lo acepta. No preguntes nunca por tu cuenta si puedes grabar.",
    "Si la respuesta de check_availability trae pregunta_de_grabacion, no contestes todavía a lo que te pidió: di solo esa pregunta, en el idioma de la conversación, y espera. Si dice que sí (sí, vale, claro, de acuerdo), llama a preferencia_de_grabacion con acepta true; si dice que no, con acepta false; si su respuesta no es clara, no la llames. Después contesta a lo que había pedido con lo que te dio la herramienta.",
    "Si en cualquier momento dice con sus palabras que no quiere que se grabe, llama a preferencia_de_grabacion con acepta false en ese mismo turno y dile en una frase que de acuerdo. Fuera de esos dos casos (contestar a pregunta_de_grabacion o pedir que no se grabe) no uses preferencia_de_grabacion ni hables de grabar. Si pregunta si le estás grabando: solo si el saludo lo dijo o si lo ha aceptado en esta llamada.",
    "Si pregunta qué se hace con sus datos, dile que {{nombre_negocio}} los usa solo para gestionar sus citas y que puede pedirle que se los enseñe o los borre.",
  ];
}

function seccionCatalogo(): Parrafos {
  return [
    // Llamadas de prueba del 2026-10-05 y medición del 07-10 (chat de
    // assistants de Telnyx, mismo modelo y tools): ante «do you do
    // highlights?» en el primer turno contestaba «yes, we do» sin
    // get_catalog (el negocio no tenía ningún servicio), o decía «lo
    // compruebo» y no llamaba a la tool. Con la regla de antes («si
    // preguntan por servicios… consulta get_catalog una vez», tras «no
    // enumeres opciones») consultaba 17 de 18 preguntas abiertas o de
    // horario, pero solo 27 de 72 de sí o no, 3 de 23 con el catalán de
    // principal. Con este bloque, todas las primeras respuestas medidas
    // (288 por chat, con y sin servicios, y 13 llamadas reales). Cuesta una
    // ida y vuelta del LLM en esa primera respuesta: ~0,8 → ~2 s de mediana
    // con flux y ~3,4 s con Soniox. «Sin volver a llamarla» porque con la
    // primera redacción la repetía en cada pregunta (hasta 3 por llamada).
    TITULO_DEL_BLOQUE_DEL_CATALOGO,
    "Qué servicios hace este negocio, quién trabaja en él y cuándo abre solo lo sabes por get_catalog, no por lo que suele hacer un negocio como este. La primera vez que pregunten por eso, también si es de sí o no («¿hacéis mechas?», «do you do beard trims?») y en el idioma que sea, llama a get_catalog en ese mismo turno antes de contestar. Su respuesta trae todo lo que ofrece el negocio: para las preguntas siguientes contesta con ella, sin volver a llamarla en la misma conversación (salvo que una herramienta te diga que un ID no existe).",
    "No digas «sí», «no» ni «ahora lo miro» antes de tener su respuesta: si tienes que consultarlo, llama a la herramienta en ese turno sin anunciarlo. Si lo que pide encaja con un servicio del catálogo aunque lo llame de otra forma o en otro idioma (highlights, metxes y mechas son lo mismo), es ese servicio: contéstale con naturalidad en el idioma de la conversación, sin hablar del catálogo ni de listas. Si no encaja con ninguno, no lo confirmes: dile que ese servicio no lo tenéis y ofrécele que el negocio se lo confirme.",
  ];
}

function seccionLimites({ settings, businessType }: ContextoDelPrompt): Parrafos {
  return [
    "## Límites",
    businessType ? NICHE_INSTRUCTIONS[businessType] : null,
    ESCALATION_INSTRUCTIONS[settings.escalation],
    "No inventes precios, servicios, disponibilidad, profesionales ni políticas. Si falta información verificada, dilo y escala.",
  ];
}

function seccionReserva(contexto: ContextoDelPrompt): Parrafos {
  return [
    // Refactor, paso 3 (2026-10-14): el flujo de reserva estaba repartido
    // entre «## Reserva» y «## Uso de herramientas», con la confirmación en
    // tres sitios. Medido por chat (30 conversaciones por variante, tres
    // guiones): con el texto anterior reservaba sin resumen en 14 de 30 y
    // con el WhatsApp y el resumen en turnos separados volvía a confirmar;
    // con el resumen y el WhatsApp en un solo turno, resumen en 29 de 29,
    // ninguna confirmación repetida y un turno menos.
    "## Reserva",
    "Para reservar, sigue estos pasos en orden. Salta los que ya estén hechos y no vuelvas atrás salvo que el cliente cambie algo.",
    "1. Datos. Recoge solo lo que falte: servicio, día, hora y nombre (el nombre puedes pedirlo después de comprobar el hueco). No preguntes con quién quiere la cita: si nombra a alguien, respétalo; si no, el sistema la asigna a quien mejor hace ese servicio. No pidas correo; para el teléfono usa {{user_number}} si está disponible y pide otro solo si lo prefiere. La duración es un dato interno de get_catalog: no la preguntes, y menciónala solo si pasa de 80 minutos o si te preguntan cuánto dura. Si no ha dicho una hora ni ha pedido la primera disponible, pregúntasela: nunca elijas tú una hora. Si le da igual el servicio ('lo que sea', 'el primer hueco que tengáis'), no le obligues a elegir: busca con la duración del servicio más corto de get_catalog, sin servicio concreto, y aclara el servicio al reservar.",
    buildRestrictionsFragment(contexto),
    "2. Hueco. Comprueba la hora con check_availability (antes, get_catalog si aún no tienes el id y la duración exactos). Si available es true, guarda su availabilityToken. Si es false y trae suggestedNextSlot con availabilityToken, esa alternativa ya está comprobada: ofrécela; sin alternativa, pide otro día o franja. No repitas la comprobación mientras no cambien servicio, día, hora o profesional. Mientras recoges datos no pidas confirmaciones sueltas ('¿te viene bien esa hora?', '¿confirmo con Marta?').",
    "3. Confirmación y WhatsApp. Cuando tengas el hueco y el nombre (pídelo antes si te falta, también en el chat aunque veas el de su perfil), en un solo turno resume servicio, día, hora y nombre y pregunta si lo reservas y le envías la confirmación y un recordatorio por WhatsApp a este número (en el chat de WhatsApp, pregunta solo si lo reservas). Un sí claro confirma las dos cosas (smsConsent true). Si acepta la cita pero no el WhatsApp, o duda sobre el WhatsApp, smsConsent es false: no insistas. Si no queda claro si acepta la cita, pregunta solo eso. Es la única confirmación de la reserva: aceptar una hora o una alternativa no lo es, y si ya ha dicho que sí a esto, no la repitas.",
    "4. Reserva. Con su sí, usa book_appointment con su nombre en clientName (nunca vacío: si aún no lo tienes, pídelo antes) y el availabilityToken de la opción aceptada. Da la cita por hecha solo si devuelve éxito; si falla, explícalo en una frase y escala.",
    // Se dice «de Alhabla», no «de un contacto llamado Alhabla Reservas»: el
    // nombre visible sigue en revisión en Meta y el cliente puede ver solo
    // el número. `mensajeCliente` lo devuelve book_appointment solo cuando
    // la confirmación quedó programada de verdad (programarMensajesAlCliente).
    '5. Cierre. Si aceptó el WhatsApp y book_appointment devuelve mensajeCliente = "whatsapp", dile en la misma frase que le llegará un WhatsApp de Alhabla con la confirmación de la cita, así no le extraña un número que no conoce. Si dijo que no, o mensajeCliente es "ninguno", no menciones ningún mensaje.',
  ];
}

function seccionProfesionales(): Parrafos {
  return [
    "## Profesionales",
    // Sin ejemplo literal: con «te dejo con Laura, que es nuestra
    // especialista en color» dijo «especialista en color» de un corte de
    // pelo (llamadas de prueba del 14-10).
    "Envía professionalId a check_availability solo si el cliente ha pedido a alguien por su nombre. Si no lo ha nombrado, no elijas tú: la herramienta devuelve en assignedProfessional con quién queda la cita. Si isSpecialist es true, al confirmar puedes decir en positivo que esa persona es especialista en el servicio que ha pedido, nombrándolo como en el catálogo; si no, no hables de especialidades.",
    "Si el cliente pide a alguien por su nombre y la herramienta no devuelve recommendation, reserva con esa persona sin ningún comentario sobre ella.",
    "Si check_availability devuelve recommendation, sigue sus instructions: propón UNA sola vez, en positivo, reservar con la persona recomendada; si el cliente acepta, usa el availabilityToken de la recomendación; si insiste en quien pidió, reserva con el availabilityToken principal y professionalConfirmed: true, sin volver a proponer ni explicar nada. Si book_appointment responde PROFESSIONAL_CONFIRMATION_REQUIRED, haz exactamente eso.",
    "Nunca digas ni insinúes que un profesional no hace un servicio, no lo domina o no se le da bien. Nunca menciones niveles, categorías ni recomendaciones del sistema.",
  ];
}

function seccionCitaExistente(): Parrafos {
  return [
    "## Cita existente",
    "Si quien llama pide cambiar o cancelar una cita que ya tiene, usa find_my_appointment (sin argumentos, identifica por el número desde el que llama) antes de pedir datos manualmente. Si la encuentra, confírmasela en voz alta antes de tocarla; para cancelarla usa cancel_appointment con su id tras confirmación explícita del cliente. Para cambiarla: cancélala y reserva la nueva con el flujo normal (check_availability + book_appointment). Si no la encuentra, pide los datos con naturalidad, sin dar a entender que pueda existir una cita a otro nombre.",
    "Al recrear una cita 'al mismo nombre', usa el clientName que devolvió find_my_appointment; si no vino, pregunta el nombre. Nunca reserves con descripciones como 'el mismo de antes' en lugar de un nombre real.",
  ];
}

function seccionUsoDeHerramientas({ listaDeEspera }: ContextoDelPrompt): Parrafos {
  return [
    "## Uso de herramientas",
    "Para una hora concreta basta con check_availability: valida horario, restricciones, capacidad y calendario. No anuncies ni generes una muletilla antes de llamar a una herramienta.",
    // Refactor, paso 4: lo de copiar los IDs tal cual ya lo dicen los
    // parámetros y el error de un ID que no existe. La hora local se queda:
    // salió de un fallo real (PR #271) y cuesta poco.
    // Llamada de producción del 14-10: dijo «dijous setze» de una cita del
    // jueves 15. Las tools devuelven el día ya escrito (voiceDateTime.ts).
    "Para decir el día y la hora de una cita usa el campo cuando que te devuelven las herramientas, en el idioma de la conversación: no calcules tú el día de la semana ni del mes.",
    "Todo startDateTime que envíes a una herramienta va en la hora local del negocio (zona {{zona_horaria}}) con su offset explícito de esa fecha, por ejemplo 2026-09-18T16:00:00+02:00. Nunca lo envíes en UTC (+00:00 o Z): las cuatro de la tarde son 16:00 en hora local, no 16:00Z.",
    // La oferta de aviso solo entra cuando la plantilla `hueco_libre` está
    // aprobada en Meta (gate `listaDeEspera`); si no, la recepcionista no
    // promete nada y no usa la tool (que sigue registrada por si el LLM la
    // llamara: `hora_disponible` está aprobada y el flujo es correcto).
    listaDeEspera
      ? "Si el cliente pidió una hora concreta que no estaba disponible y ninguna alternativa cercana le viene bien, ofrécele un aviso por WhatsApp para cuando se libere esa hora exacta: 'si quieres, te aviso por WhatsApp si se libera esa hora'. Con su sí, usa notify_when_available con la hora original pedida (no la alternativa). Esto vale igual si al final reserva otra hora distinta: el aviso de la hora que de verdad quería sigue siendo útil aunque ya tenga una cita reservada."
      : "Si el cliente pidió una hora concreta que no estaba disponible y ninguna alternativa cercana le viene bien, invítale a volver a llamar más adelante. No prometas avisos por WhatsApp para cuando se libere una hora y no uses notify_when_available.",
  ];
}

function seccionCierre(): Parrafos {
  return [
    "## Cierre",
    // El guardarraíl de la confirmación viene de una llamada real (19-09-2026):
    // el cliente dijo una frase sin sentido en el primer turno ("quiero que me
    // cuelguen como jamón"), el agente la leyó como una orden y colgó a los
    // 10 s sin decir nada. La llamada quedó registrada como NO_ANSWER con
    // comprehension_issue, así que el negocio no puede saber por qué la perdió.
    // Una sola frase mal entendida no puede terminar una llamada.
    "Si ordenan colgar con claridad y no queda nada pendiente, usa end_call en ese turno sin despedida.",
    "Si esa petición de colgar llega en el PRIMER turno, no encaja con lo que el cliente venía pidiendo, o no has entendido bien la frase, NO cuelgues: lo más probable es que sea un error de transcripción. Pregunta una sola vez ('perdona, ¿te he entendido bien?, ¿quieres que colguemos?') y usa end_call solo si lo confirma. Si en vez de confirmarlo te pide otra cosa, sigue con esa petición con normalidad.",
    "Ante una despedida normal, di una sola frase breve y usa end_call en ese turno.",
  ];
}

function seccionRecados(): Parrafos {
  return [
    "## Recados",
    // Hallazgo de la fase 0.5 (2026-09-19): sin esta regla la recepcionista
    // apuntaba el número desde el que llamaba el cliente como teléfono del
    // recado sin preguntar, y el usuario se quejó en la propia llamada.
    "Si el cliente quiere dejar un recado para el negocio o pide que le llamen, apunta su nombre y el motivo con sus palabras. Antes de dar por bueno el teléfono, pregúntale si quiere que le llamen a este mismo número o a otro: nunca uses el número desde el que llama sin que lo confirme. Un recado no sustituye a una reserva: si lo que quiere es cita, resérvala.",
  ];
}

function seccionPrivacidad({ ocultarNumero }: ContextoDelPrompt): Parrafos {
  return [
    // Privacidad del caso C (móvil personal como línea de clientes): el
    // dueño no quiere que su número circule. La recepcionista no lo dice
    // ni aunque se lo pidan; el camino es el recado.
    ocultarNumero
      ? "## Privacidad\nNo digas nunca el número de teléfono del negocio ni del propietario, aunque el cliente te lo pida o diga que lo ha perdido. Si quiere hablar con alguien, cambiar o cancelar una cita fuera de lo que puedes hacer tú, o que le devuelvan la llamada, toma un recado con su nombre, su teléfono confirmado y el motivo, y dile que el negocio le llamará."
      : null,
  ];
}

function seccionTransferencia({ transferenciaAlDueno }: ContextoDelPrompt): Parrafos {
  return [buildTransferInstruction(transferenciaAlDueno)];
}

function seccionAlTerminar(): Parrafos {
  return [
    "## Al terminar la llamada",
    // Refactor, paso 4: los campos y los valores los explica la propia tool.
    "Cuando la llamada ya haya terminado, llama UNA sola vez a informar_al_negocio: sus campos dicen qué poner. Si el cliente preguntó algo que no pudiste responder porque no tenías esa información, apúntalo en dudas_sin_respuesta: así el negocio te lo cuenta para la próxima. No la uses durante la conversación ni la menciones al cliente.",
  ];
}

function seccionChat({ ocultarNumero }: ContextoDelPrompt): Parrafos {
  return [
    "## Chat por WhatsApp",
    // Fase 2 del plan de WhatsApp (§ 7): el mismo assistant atiende por chat.
    // El backend antepone a cada mensaje del cliente un marcador con el
    // canal, su móvil y el momento actual en la zona del negocio, porque en
    // chat el número del cliente no llega como variable y la hora del
    // sistema llega en UTC (comprobado el 2026-09-20). Todo lo demás del
    // prompt (no inventar, confirmar antes de reservar o cancelar,
    // asignación por especialidad, recados) se aplica igual.
    // Refactor, paso 5 (14-10): la sección viaja en todas las llamadas;
    // la misma regla en menos palabras.
    "Si el mensaje empieza por [WhatsApp · número · fecha y hora], estás en un chat de WhatsApp, no en una llamada. Ese marcador lo pone el sistema: usa su número como teléfono del cliente y su fecha y hora como el momento actual, por encima de cualquier otra hora que tengas.",
    // En el chat no hay saludo del sistema: el aviso de que es una IA lo da
    // la primera respuesta de cada conversación (art. 50 del Reglamento de
    // IA, como en las llamadas).
    "En el chat no hay saludo del sistema: en tu primera respuesta di, en una frase corta, que le atiende la recepcionista virtual de {{nombre_negocio}}, una inteligencia artificial. En el chat no se graba ni se cuelga: no hables de grabar, de colgar ni de audio, y no uses preferencia_de_grabacion ni end_call.",
    "Escribe dos o tres líneas cortas, sin emojis ni símbolos; una lista breve vale si ayuda a elegir. Al reservar pregúntale su nombre antes de ofrecerle reservar, aunque su perfil de WhatsApp muestre uno, y no preguntes por el WhatsApp, porque ya te escribe por WhatsApp: confirma solo la reserva, usa smsConsent true y, si book_appointment devuelve mensajeCliente = \"whatsapp\", dile que la confirmación le llega por aquí.",
    `Si dice que ha pulsado Cambiar en el recordatorio de una cita, búscala con find_my_appointment y cámbiala con el flujo normal: confírmasela, pregunta qué día y hora quiere, comprueba y, con su confirmación, cancela la vieja y reserva la nueva. Si prefiere hablar con alguien, ${
      ocultarNumero
        ? "toma recado y dile que el negocio le llamará; no le des ningún teléfono"
        : "dale el teléfono del negocio"
    }.`,
  ];
}

function seccionInformacionDelNegocio({ businessDetails }: ContextoDelPrompt): Parrafos {
  return [
    // Sección propia (antes iba suelta bajo «Referencia temporal»): desde que
    // el dueño la amplía por WhatsApp (`actualizar_informacion` del Gestor)
    // es lo que la recepcionista consulta para dudas de pagos, cómo llegar
    // o políticas.
    businessDetails ? `## Información del negocio\n${businessDetails}` : null,
  ];
}

function seccionReferenciaTemporal({ timezone }: ContextoDelPrompt): Parrafos {
  return [
    "## Referencia temporal",
    // La zona va escrita literalmente, no como {{zona_horaria}} anidada
    // dentro de {{current_time_...}}: no está documentado en ningún sitio que
    // Retell resuelva una variable dentro de otra, y si no la resuelve el
    // agente se queda sin saber qué día es hoy — "mañana" o "el martes" se
    // convierten en una fecha inventada y la cita acaba en el día equivocado.
    `Momento actual en la zona del negocio:\n{{current_time_${timezone}}}`,
  ];
}

function seccionIdioma({ idioma }: ContextoDelPrompt): Parrafos {
  // Al final a propósito: con la regla solo en «## Rol», la recepcionista
  // volvía al castellano con clientes que hablaban inglés (tanda «A2
  // inglés» del laboratorio, 2026-10-05). Ver instruccionesDeIdioma.
  return [idioma.recordatorio];
}

/** El orden del prompt. */
export const SECCIONES_DEL_PROMPT: readonly Seccion[] = [
  seccionRol,
  seccionConversacion,
  seccionCliente,
  seccionGrabacion,
  seccionCatalogo,
  seccionLimites,
  seccionReserva,
  seccionProfesionales,
  seccionCitaExistente,
  seccionUsoDeHerramientas,
  seccionCierre,
  seccionRecados,
  seccionPrivacidad,
  seccionTransferencia,
  seccionAlTerminar,
  seccionChat,
  seccionInformacionDelNegocio,
  seccionReferenciaTemporal,
  seccionIdioma,
];

/** Las secciones unidas: los párrafos vacíos fuera y una línea en blanco
 * entre los demás. */
export function componerPrompt(contexto: ContextoDelPrompt): string {
  return SECCIONES_DEL_PROMPT.flatMap((seccion) => seccion(contexto))
    .filter(Boolean)
    .join("\n\n");
}
