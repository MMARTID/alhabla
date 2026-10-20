/**
 * Textos de /herramientas/mensajes-de-contestador: cinco para el contestador
 * del teléfono y dos para las respuestas automáticas de WhatsApp Business,
 * en ocho sectores.
 *
 * Escritos para leerse en voz alta en unos 20 segundos (unas 50 palabras):
 * el nombre del negocio primero, una sola petición (nombre y teléfono) y
 * nada de precios. En fisioterapia piden «sin más detalles» y remiten al
 * 112 en las urgencias, porque un buzón no es sitio para datos de salud.
 */

export type SituacionDeContestador = "horario" | "fuera" | "vacaciones" | "festivo" | "ocupado";
export type RespuestaDeWhatsapp = "ausencia" | "bienvenida";

export const SITUACIONES_DE_CONTESTADOR: readonly { id: SituacionDeContestador; nombre: string }[] = [
  { id: "horario", nombre: "Saludo con el horario" },
  { id: "fuera", nombre: "Fuera de horario" },
  { id: "vacaciones", nombre: "Vacaciones" },
  { id: "festivo", nombre: "Festivo" },
  { id: "ocupado", nombre: "Cuando estás con un cliente" },
];

export const RESPUESTAS_DE_WHATSAPP: readonly { id: RespuestaDeWhatsapp; nombre: string }[] = [
  { id: "ausencia", nombre: "Mensaje de ausencia" },
  { id: "bienvenida", nombre: "Mensaje de bienvenida" },
];

export type TextosDeSector = {
  id: string;
  nombre: string;
  contestador: Record<SituacionDeContestador, string>;
  whatsapp: Record<RespuestaDeWhatsapp, string>;
};

export const TEXTOS_DE_CONTESTADOR: readonly TextosDeSector[] = [
  {
    id: "peluqueria",
    nombre: "Peluquería",
    contestador: {
      horario:
        "Hola, has llamado a {negocio}. Nuestro horario es {horario}. Si no podemos cogerte, deja tu nombre y tu teléfono después de la señal y te llamamos hoy mismo.",
      fuera:
        "Has llamado a {negocio}. Ahora estamos cerrados; abrimos {horario}. Deja tu nombre, tu teléfono y qué te quieres hacer, y mañana a primera hora te llamamos para darte cita.",
      vacaciones:
        "Hola, has llamado a {negocio}. Estamos de vacaciones y volvemos {vuelta}. Si quieres cita para la vuelta, deja tu nombre y tu teléfono y te llamamos el primer día.",
      festivo:
        "Has llamado a {negocio}. Hoy, {festivo}, cerramos por festivo, y mañana volvemos en nuestro horario de siempre. Deja tu nombre y tu teléfono y te llamamos.",
      ocupado:
        "Hola, has llamado a {negocio}. Estamos con las manos ocupadas atendiendo. Deja tu nombre y tu teléfono y te devolvemos la llamada en cuanto terminemos.",
    },
    whatsapp: {
      ausencia:
        "Gracias por escribir a {negocio}. Ahora mismo estamos cerrados; abrimos {horario}. Si quieres cita, cuéntanos qué te quieres hacer, qué día te viene bien y si prefieres a alguien, y te contestamos al abrir.",
      bienvenida:
        "¡Hola! Gracias por escribir a {negocio}. Para pedir cita, dinos el servicio (corte, color, mechas…), el día que prefieres y si quieres a alguien en concreto. Te contestamos lo antes posible.",
    },
  },
  {
    id: "barberia",
    nombre: "Barbería",
    contestador: {
      horario:
        "Has llamado a {negocio}. Abrimos {horario}. Si no lo cogemos es que estamos con la máquina en la mano: deja tu nombre y tu teléfono y te llamamos.",
      fuera:
        "Has llamado a {negocio}. Ya hemos cerrado; abrimos {horario}. Deja tu nombre y a qué hora te vendría bien, y te llamamos al abrir.",
      vacaciones:
        "{negocio} está de vacaciones hasta {vuelta}. Deja tu nombre y tu teléfono y te llamamos el primer día para darte hora.",
      festivo:
        "Hoy, {festivo}, {negocio} está cerrado. Mañana abrimos a la hora de siempre. Deja tu mensaje y te llamamos.",
      ocupado:
        "{negocio}, estamos cortando y no podemos cogerte. Deja tu nombre y tu teléfono y te llamamos entre cliente y cliente.",
    },
    whatsapp: {
      ausencia:
        "Gracias por escribir a {negocio}. Estamos cerrados; abrimos {horario}. Dinos si es corte, barba o los dos, qué día y con quién, y te damos hora al abrir.",
      bienvenida:
        "¡Buenas! Esto es {negocio}. Para pedir hora, dinos qué te hacemos (corte, barba o los dos), qué día y con quién sueles venir.",
    },
  },
  {
    id: "unas",
    nombre: "Salón de uñas",
    contestador: {
      horario:
        "Hola, has llamado a {negocio}. Nuestro horario es {horario}. Si no podemos atenderte, deja tu nombre, tu teléfono y qué quieres hacerte, manos, pies o retirada, y te llamamos.",
      fuera:
        "Has llamado a {negocio}. Ahora el salón está cerrado; abrimos {horario}. Deja tu nombre y tu teléfono y te llamamos para darte cita.",
      vacaciones:
        "{negocio} cierra por vacaciones y volvemos {vuelta}. Si te toca retirar o rellenar a la vuelta, deja tu nombre y tu teléfono y te llamamos el primer día.",
      festivo:
        "Hoy, {festivo}, el salón está cerrado. Mañana volvemos con el horario habitual. Deja tu nombre y tu teléfono y te llamamos.",
      ocupado:
        "Hola, has llamado a {negocio}. Estamos con una clienta y con las manos ocupadas, literalmente. Deja tu nombre y tu teléfono y te llamamos al terminar.",
    },
    whatsapp: {
      ausencia:
        "Gracias por escribir a {negocio}. Ahora estamos cerrados; abrimos {horario}. Para darte cita, dinos si es manos, pies o las dos, qué técnica quieres y si llevas algo puesto que haya que retirar.",
      bienvenida:
        "¡Hola! Te damos la bienvenida a {negocio}. Para pedir cita, cuéntanos qué quieres hacerte y qué días te vienen bien. Si tienes una foto del diseño, mándala.",
    },
  },
  {
    id: "estetica",
    nombre: "Centro de estética",
    contestador: {
      horario:
        "Hola, has llamado a {negocio}. Atendemos {horario}. Si estamos en cabina y no podemos cogerte, deja tu nombre y tu teléfono y te llamamos en cuanto salgamos.",
      fuera:
        "Has llamado a {negocio}. El centro está cerrado; abrimos {horario}. Deja tu nombre, tu teléfono y el tratamiento que te interesa, y te llamamos.",
      vacaciones:
        "{negocio} está cerrado por vacaciones hasta {vuelta}. Si quieres cita para la vuelta, deja tu nombre y tu teléfono y te llamamos el primer día.",
      festivo:
        "Hoy, {festivo}, el centro está cerrado. Mañana volvemos en nuestro horario. Deja tu mensaje y te llamamos.",
      ocupado:
        "Hola, has llamado a {negocio}. Estamos en cabina con un tratamiento. Deja tu nombre y tu teléfono y te devolvemos la llamada al terminar.",
    },
    whatsapp: {
      ausencia:
        "Gracias por escribir a {negocio}. Ahora estamos cerrados; abrimos {horario}. Si quieres cita, dinos qué tratamiento te interesa y si es la primera vez, y te contestamos al abrir.",
      bienvenida:
        "Hola, gracias por escribir a {negocio}. Para reservar, cuéntanos el tratamiento y los días que te vienen bien. Si dudas entre dos, pregúntanos.",
    },
  },
  {
    id: "fisioterapia",
    nombre: "Fisioterapia",
    contestador: {
      horario:
        "Has llamado a {negocio}. Atendemos {horario}. Si no podemos cogerte porque estamos en consulta, deja tu nombre y tu teléfono y te llamamos.",
      fuera:
        "Has llamado a {negocio}. La clínica está cerrada; abrimos {horario}. Deja tu nombre y tu teléfono y te llamamos para darte cita. Si es una urgencia, llama al 112.",
      vacaciones:
        "{negocio} está cerrada por vacaciones hasta {vuelta}. Deja tu nombre y tu teléfono y te llamamos a la vuelta. Si es una urgencia, llama al 112.",
      festivo:
        "Hoy, {festivo}, la clínica está cerrada. Mañana volvemos en el horario habitual. Deja tu nombre y tu teléfono y te llamamos.",
      ocupado:
        "Has llamado a {negocio}. Estamos atendiendo a un paciente. Deja tu nombre y tu teléfono, sin más detalles, y te devolvemos la llamada en cuanto podamos.",
    },
    whatsapp: {
      ausencia:
        "Gracias por escribir a {negocio}. Ahora estamos cerrados; abrimos {horario}. Para pedir cita basta con tu nombre y si es primera visita o seguimiento: no hace falta que nos cuentes aquí detalles de salud.",
      bienvenida:
        "Hola, gracias por escribir a {negocio}. Para pedir cita, dinos tu nombre, si es primera visita o seguimiento y qué días te vienen bien.",
    },
  },
  {
    id: "pestanas",
    nombre: "Pestañas y cejas",
    contestador: {
      horario:
        "Hola, has llamado a {negocio}. Nuestro horario es {horario}. Si estamos con una clienta no podemos soltar las pinzas: deja tu nombre y tu teléfono y te llamamos.",
      fuera:
        "Has llamado a {negocio}. Ahora está cerrado; abrimos {horario}. Deja tu nombre, tu teléfono y si es juego completo o relleno, y te llamamos.",
      vacaciones:
        "{negocio} está de vacaciones hasta {vuelta}. Si te toca relleno estos días, deja tu nombre y tu teléfono y te damos hueco en cuanto volvamos.",
      festivo:
        "Hoy, {festivo}, estamos cerrados. Mañana volvemos con el horario de siempre. Deja tu nombre y tu teléfono y te llamamos.",
      ocupado:
        "Hola, has llamado a {negocio}. Estamos poniendo extensiones y no podemos cogerte. Deja tu nombre y tu teléfono y te llamamos al terminar.",
    },
    whatsapp: {
      ausencia:
        "Gracias por escribir a {negocio}. Ahora estamos cerrados; abrimos {horario}. Dinos si es juego completo, relleno o cejas, y cuándo te hiciste el último, y te damos cita al abrir.",
      bienvenida:
        "¡Hola! Gracias por escribir a {negocio}. Para reservar, dinos qué servicio quieres (extensiones, lifting, cejas…) y qué días te vienen bien.",
    },
  },
  {
    id: "spa",
    nombre: "Spa y masajes",
    contestador: {
      horario:
        "Hola, has llamado a {negocio}. Atendemos reservas {horario}. Si no podemos cogerte, deja tu nombre, tu teléfono y el tratamiento o circuito que te interesa, y te llamamos.",
      fuera:
        "Has llamado a {negocio}. Ahora estamos cerrados; abrimos {horario}. Si quieres reservar o regalar una sesión, deja tu nombre y tu teléfono y te llamamos.",
      vacaciones:
        "{negocio} cierra por vacaciones hasta {vuelta}. Deja tu nombre y tu teléfono y te llamamos a la vuelta para reservar.",
      festivo:
        "Hoy, {festivo}, abrimos con horario de festivo: {horario}. Si no podemos atenderte, deja tu nombre y tu teléfono y te llamamos.",
      ocupado:
        "Hola, has llamado a {negocio}. Estamos en cabina y no podemos cogerte. Deja tu nombre y tu teléfono y te llamamos en cuanto terminemos.",
    },
    whatsapp: {
      ausencia:
        "Gracias por escribir a {negocio}. Ahora estamos cerrados; abrimos {horario}. Para reservar, dinos el tratamiento, el día, cuántas personas venís y si es un regalo.",
      bienvenida:
        "Hola, gracias por escribir a {negocio}. Cuéntanos qué te apetece (masaje, ritual o circuito), para cuántas personas y qué día, y te decimos qué tenemos libre.",
    },
  },
  {
    id: "canina",
    nombre: "Peluquería canina",
    contestador: {
      horario:
        "Hola, has llamado a {negocio}. Abrimos {horario}. Si no lo cogemos es que estamos bañando a alguien: deja tu nombre, tu teléfono y la raza de tu perro, y te llamamos.",
      fuera:
        "Has llamado a {negocio}. Ahora estamos cerrados; abrimos {horario}. Deja tu nombre, tu teléfono y el tamaño de tu perro, y te llamamos para darte cita.",
      vacaciones:
        "{negocio} está de vacaciones hasta {vuelta}. Deja tu nombre y tu teléfono y te llamamos el primer día para darle cita a tu perro.",
      festivo:
        "Hoy, {festivo}, estamos cerrados. Mañana volvemos en nuestro horario. Deja tu mensaje y te llamamos.",
      ocupado:
        "Hola, has llamado a {negocio}. Tenemos las manos en la bañera. Deja tu nombre y tu teléfono y te devolvemos la llamada en cuanto terminemos.",
    },
    whatsapp: {
      ausencia:
        "Gracias por escribir a {negocio}. Ahora estamos cerrados; abrimos {horario}. Para darte cita, dinos raza y tamaño de tu perro, qué le hacemos (baño, corte, deslanado) y qué día te viene bien.",
      bienvenida:
        "¡Hola! Gracias por escribir a {negocio}. Para pedir cita, cuéntanos cómo se llama tu perro, su raza o tamaño y qué servicio quieres.",
    },
  },
];
