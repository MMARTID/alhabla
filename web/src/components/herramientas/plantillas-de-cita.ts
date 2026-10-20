/**
 * Plantillas de /herramientas/plantillas-recordatorio-de-cita: ocho
 * sectores × cinco momentos × WhatsApp y SMS.
 *
 * Reglas con las que están escritas (las explica la propia página):
 * - Ninguna lleva promoción: un recordatorio con un descuento deja de ser
 *   un aviso del servicio contratado y pasa a ser comunicación comercial
 *   (LSSI, art. 21).
 * - Fisioterapia sin {servicio}: la guía de la AEPD para el sector
 *   sanitario pide la mínima información para identificar la cita (día,
 *   hora, centro) y no mencionar síntomas ni tratamientos.
 * - Los SMS no usan á, í, ó ni ú (sí é, ñ, ¿ y ¡, que están en GSM-7) para
 *   caber en 160 caracteres, y dan {teléfono} en vez de «responde»: con
 *   remitente alfanumérico el cliente no puede contestar. Un test cuenta
 *   cada SMS con los datos de `ejemplo` (ver sms.ts).
 */

export type Momento = "confirmacion" | "recordatorio" | "cambio" | "cancelacion" | "hueco";

export const MOMENTOS: readonly { id: Momento; nombre: string }[] = [
  { id: "confirmacion", nombre: "Confirmación al reservar" },
  { id: "recordatorio", nombre: "Recordatorio 24-48 h antes" },
  { id: "cambio", nombre: "Cambio de hora" },
  { id: "cancelacion", nombre: "Cancelación" },
  { id: "hueco", nombre: "Hueco libre para la lista de espera" },
];

export type PlantillasDeSector = {
  id: string;
  nombre: string;
  /** Lo propio del sector a la hora de avisar: una o dos frases. */
  consejo: string;
  /** Valores de muestra para contar los caracteres de los SMS. */
  ejemplo: Record<string, string>;
  mensajes: Record<Momento, { whatsapp: string; sms: string }>;
};

/** Comunes a todos los sectores; cada uno añade su servicio y su negocio. */
const EJEMPLO_BASE = { nombre: "Laura", día: "jueves 23", hora: "17:30", profesional: "Marta", teléfono: "912 345 678" };

export const PLANTILLAS: readonly PlantillasDeSector[] = [
  {
    id: "peluqueria",
    nombre: "Peluquería",
    consejo:
      "El recordatorio pesa más en los servicios largos (color, mechas, alisados): un hueco de dos horas sin aviso es media tarde perdida. Para esos, mejor 48 horas antes, con margen para recolocarlo.",
    ejemplo: { ...EJEMPLO_BASE, servicio: "corte y color", negocio: "Peluqueria Nerea" },
    mensajes: {
      confirmacion: {
        whatsapp:
          "Hola {nombre}, soy de {negocio}. Tu cita queda reservada para el {día} a las {hora}: {servicio} con {profesional}. Si quieres cambiar de color o de corte, trae una foto de lo que buscas; ayuda mucho. Para mover o anular la cita, responde a este mensaje.",
        sms: "{negocio}: cita reservada el {día} a las {hora}, {servicio} con {profesional}. Para cambiarla llama al {teléfono}.",
      },
      recordatorio: {
        whatsapp:
          "Hola {nombre}, te recordamos tu cita en {negocio} el {día} a las {hora} ({servicio} con {profesional}). Si al final no puedes venir, contéstanos por aquí y te buscamos otra hora: así el hueco lo aprovecha otra persona.",
        sms: "{negocio}: te esperamos el {día} a las {hora} para {servicio}. Si no puedes venir, avisa al {teléfono} y te damos otra hora.",
      },
      cambio: {
        whatsapp:
          "Hola {nombre}, tu cita en {negocio} ha cambiado de hora. Queda así: {día} a las {hora}, {servicio} con {profesional}. Si esta hora no te viene bien, respóndenos y miramos otra.",
        sms: "{negocio}: tu cita cambia al {día} a las {hora} con {profesional}. Si no te viene bien, llama al {teléfono}.",
      },
      cancelacion: {
        whatsapp:
          "Hola {nombre}, hemos anulado tu cita del {día} a las {hora} en {negocio}, como nos pediste. Cuando quieras volver a reservar, escríbenos por aquí o llámanos.",
        sms: "{negocio}: anulada tu cita del {día} a las {hora}. Para pedir otra, llama al {teléfono}.",
      },
      hueco: {
        whatsapp:
          "Hola {nombre}, se ha quedado libre una hora en {negocio}: {día} a las {hora} con {profesional}, para {servicio}. Si la quieres, responde «sí» y te la reservamos. Se la damos a la primera persona que conteste.",
        sms: "{negocio}: hay hueco el {día} a las {hora} para {servicio}. Si lo quieres, llama al {teléfono}. Es para quien llame antes.",
      },
    },
  },
  {
    id: "barberia",
    nombre: "Barbería",
    consejo:
      "Las citas son cortas y la clientela repite cada pocas semanas: con 24 horas de antelación basta. El tuteo y un tono más directo encajan; lo que no cambia es que el mensaje diga quién escribe.",
    ejemplo: { ...EJEMPLO_BASE, nombre: "Javi", profesional: "Dani", servicio: "corte y barba", negocio: "Barberia El Puerto" },
    mensajes: {
      confirmacion: {
        whatsapp:
          "¿Qué tal, {nombre}? Te apuntamos en {negocio} el {día} a las {hora}: {servicio} con {profesional}. Si vas a llegar tarde o te surge algo, contesta a este mensaje y lo reorganizamos.",
        sms: "{negocio}: apuntado el {día} a las {hora}, {servicio} con {profesional}. Si te surge algo, llama al {teléfono}.",
      },
      recordatorio: {
        whatsapp:
          "Hola {nombre}, te esperamos el {día} a las {hora} en {negocio} para {servicio} con {profesional}. Si no llegas, dínoslo por aquí y le damos tu hora a otro cliente.",
        sms: "{negocio}: te esperamos el {día} a las {hora} con {profesional}. Si no puedes venir, avisa al {teléfono}.",
      },
      cambio: {
        whatsapp:
          "{nombre}, te hemos movido la cita en {negocio}: ahora es el {día} a las {hora} con {profesional}. Si no te cuadra, contesta y buscamos otra hora.",
        sms: "{negocio}: tu cita pasa al {día} a las {hora} con {profesional}. Si no te cuadra, llama al {teléfono}.",
      },
      cancelacion: {
        whatsapp:
          "Hecho, {nombre}: quitamos tu cita del {día} a las {hora} en {negocio}. Cuando quieras volver, escríbenos y te damos hora.",
        sms: "{negocio}: cita del {día} a las {hora} anulada. Para volver a reservar, llama al {teléfono}.",
      },
      hueco: {
        whatsapp:
          "{nombre}, se nos ha soltado un hueco en {negocio}: {día} a las {hora} con {profesional}. ¿Te lo guardamos? Responde «sí»; es para el primero que conteste.",
        sms: "{negocio}: hueco libre el {día} a las {hora} con {profesional}. Si lo quieres, llama al {teléfono}. Para el primero que llame.",
      },
    },
  },
  {
    id: "unas",
    nombre: "Salón de uñas",
    consejo:
      "Casi todas las clientas repiten cada pocas semanas, así que la confirmación es el mejor sitio para preguntar si llevan material de otro salón: la retirada cambia lo que dura la cita.",
    ejemplo: { ...EJEMPLO_BASE, servicio: "manicura semipermanente", negocio: "Nails Studio Ana" },
    mensajes: {
      confirmacion: {
        whatsapp:
          "Hola {nombre}, tu cita en {negocio} está confirmada: {día} a las {hora}, {servicio} con {profesional}. Si llevas gel, acrílico o semipermanente de otro salón, avísanos por aquí para reservar tiempo de retirada. Para cambiar la cita, responde a este mensaje.",
        sms: "{negocio}: cita el {día} a las {hora}, {servicio}. Si llevas gel de otro centro, avisa. Cambios: {teléfono}",
      },
      recordatorio: {
        whatsapp:
          "Hola {nombre}, te esperamos el {día} a las {hora} en {negocio} para tu {servicio} con {profesional}. Si no puedes venir, contéstanos y te damos otra hora. Y si has cambiado de idea con el diseño, también puedes decírnoslo por aquí.",
        sms: "{negocio}: recuerda tu cita del {día} a las {hora}, {servicio} con {profesional}. Si no puedes, llama al {teléfono}.",
      },
      cambio: {
        whatsapp:
          "Hola {nombre}, hemos pasado tu {servicio} en {negocio} al {día} a las {hora} con {profesional}. Si te viene mal, respóndenos y lo cambiamos.",
        sms: "{negocio}: tu {servicio} pasa al {día} a las {hora}. Si te viene mal, llama al {teléfono}.",
      },
      cancelacion: {
        whatsapp:
          "Hola {nombre}, tu cita del {día} a las {hora} en {negocio} queda anulada. Si quieres reservar otra fecha para tus uñas, escríbenos por aquí.",
        sms: "{negocio}: anulada tu cita del {día} a las {hora}. Para otra fecha, llama al {teléfono}.",
      },
      hueco: {
        whatsapp:
          "Hola {nombre}, se ha liberado un hueco en {negocio} el {día} a las {hora} con {profesional}, con tiempo para {servicio}. Si lo quieres, responde «sí» y es tuyo. Lo damos por orden de respuesta.",
        sms: "{negocio}: hueco libre el {día} a las {hora} para {servicio}. Llama al {teléfono} si lo quieres; va por orden.",
      },
    },
  },
  {
    id: "estetica",
    nombre: "Centro de estética",
    consejo:
      "Si trabajas por cabinas, dilo en el recordatorio: «la cabina queda libre para otra persona» explica mejor que cualquier norma por qué pides que avisen.",
    ejemplo: { ...EJEMPLO_BASE, servicio: "limpieza facial", negocio: "Estetica Lorena" },
    mensajes: {
      confirmacion: {
        whatsapp:
          "Hola {nombre}, tu cita en {negocio} queda reservada: {día} a las {hora}, {servicio} con {profesional}. Si es tu primera visita, ven cinco minutos antes para hacerte la ficha. Si necesitas cambiarla, respóndenos por aquí.",
        sms: "{negocio}: reservado {servicio} el {día} a las {hora} con {profesional}. Si es tu primera visita, ven 5 min antes. Cambios: {teléfono}",
      },
      recordatorio: {
        whatsapp:
          "Hola {nombre}, te recordamos tu {servicio} en {negocio} el {día} a las {hora} con {profesional}. Si no vas a poder venir, avísanos por aquí: la cabina queda libre para otra persona.",
        sms: "{negocio}: recuerda tu {servicio} el {día} a las {hora}. Si no puedes venir, avisa al {teléfono} y liberamos la cabina.",
      },
      cambio: {
        whatsapp:
          "Hola {nombre}, tu {servicio} en {negocio} cambia de hora: ahora es el {día} a las {hora} con {profesional}. Si te viene mal, dínoslo y te proponemos otra.",
        sms: "{negocio}: tu {servicio} cambia al {día} a las {hora} con {profesional}. Si te viene mal, llama al {teléfono}.",
      },
      cancelacion: {
        whatsapp:
          "Hola {nombre}, hemos anulado tu {servicio} del {día} a las {hora} en {negocio}. Cuando quieras retomarlo, escríbenos por aquí.",
        sms: "{negocio}: anulado tu {servicio} del {día} a las {hora}. Para otra cita, llama al {teléfono}.",
      },
      hueco: {
        whatsapp:
          "Hola {nombre}, se ha liberado la cabina en {negocio} el {día} a las {hora} para {servicio} con {profesional}. Si te interesa, responde «sí» y te la reservamos. Va para quien conteste primero.",
        sms: "{negocio}: cabina libre el {día} a las {hora} para {servicio}. Si la quieres, llama al {teléfono}. Para quien llame primero.",
      },
    },
  },
  {
    id: "fisioterapia",
    nombre: "Fisioterapia",
    consejo:
      "Aquí manda la guía de la AEPD: día, hora y centro, y nada más. Ni el motivo de la consulta ni el tratamiento ni la zona que se trata, porque el móvil lo puede ver otra persona.",
    ejemplo: { ...EJEMPLO_BASE, negocio: "Fisio Centro Sur" },
    mensajes: {
      confirmacion: {
        whatsapp:
          "Hola {nombre}, tu cita en {negocio} queda confirmada para el {día} a las {hora} con {profesional}. Si no puedes venir, responde a este mensaje y te damos otra hora.",
        sms: "{negocio}: cita confirmada el {día} a las {hora}. Si no puedes venir, llama al {teléfono}.",
      },
      recordatorio: {
        whatsapp:
          "Hola {nombre}, te recordamos tu cita en {negocio} el {día} a las {hora}. Si necesitas cambiarla, contéstanos por aquí.",
        sms: "{negocio}: te recordamos tu cita del {día} a las {hora}. Para cambiarla, llama al {teléfono}.",
      },
      cambio: {
        whatsapp:
          "Hola {nombre}, tu cita en {negocio} pasa al {día} a las {hora}. Si no te viene bien, respóndenos y buscamos otro momento.",
        sms: "{negocio}: tu cita pasa al {día} a las {hora}. Si no te viene bien, llama al {teléfono}.",
      },
      cancelacion: {
        whatsapp:
          "Hola {nombre}, tu cita del {día} a las {hora} en {negocio} queda anulada. Si quieres pedir otra, escríbenos por aquí.",
        sms: "{negocio}: anulada tu cita del {día} a las {hora}. Para pedir otra, llama al {teléfono}.",
      },
      hueco: {
        whatsapp:
          "Hola {nombre}, nos ha quedado libre una hora en {negocio}: {día} a las {hora}. Si te viene bien, responde «sí» y te la reservamos; se asigna por orden de respuesta.",
        sms: "{negocio}: hay hora libre el {día} a las {hora}. Si te viene bien, llama al {teléfono}.",
      },
    },
  },
  {
    id: "pestanas",
    nombre: "Pestañas y cejas",
    consejo:
      "Los rellenos tienen fecha natural: si una clienta anula, el mensaje de cancelación es el momento de proponerle otra fecha cercana, antes de que tenga que empezar de cero.",
    ejemplo: { ...EJEMPLO_BASE, servicio: "relleno de extensiones", negocio: "Lash Studio Eva" },
    mensajes: {
      confirmacion: {
        whatsapp:
          "Hola {nombre}, tu cita en {negocio} está reservada: {día} a las {hora}, {servicio} con {profesional}. Ven sin máscara de pestañas ni maquillaje en los ojos, así empezamos antes. Para cambiar la cita, responde a este mensaje.",
        sms: "{negocio}: {servicio} el {día} a las {hora}. Ven sin maquillaje en los ojos. Cambios: {teléfono}",
      },
      recordatorio: {
        whatsapp:
          "Hola {nombre}, te esperamos el {día} a las {hora} en {negocio} para tu {servicio} con {profesional}. Si no puedes venir, avísanos cuanto antes y te buscamos otra hora para que el relleno no se retrase.",
        sms: "{negocio}: recuerda tu {servicio} el {día} a las {hora} con {profesional}. Si no puedes, avisa al {teléfono}.",
      },
      cambio: {
        whatsapp:
          "Hola {nombre}, te hemos cambiado la cita en {negocio}: {servicio} el {día} a las {hora} con {profesional}. Si no te encaja, respóndenos y vemos otra hora.",
        sms: "{negocio}: tu {servicio} pasa al {día} a las {hora}. Si no te encaja, llama al {teléfono}.",
      },
      cancelacion: {
        whatsapp:
          "Hola {nombre}, tu cita del {día} a las {hora} en {negocio} queda anulada. Para que no pase mucho tiempo hasta el próximo relleno, escríbenos cuando quieras otra fecha.",
        sms: "{negocio}: anulada tu cita del {día} a las {hora}. Para otra fecha, llama al {teléfono}.",
      },
      hueco: {
        whatsapp:
          "Hola {nombre}, se ha liberado un hueco en {negocio} el {día} a las {hora} con {profesional}, justo para {servicio}. ¿Lo quieres? Responde «sí» y te lo guardamos; va por orden de respuesta.",
        sms: "{negocio}: hueco el {día} a las {hora} para {servicio}. Si lo quieres, llama al {teléfono}.",
      },
    },
  },
  {
    id: "spa",
    nombre: "Spa y masajes",
    consejo:
      "Muchas reservas son regalos y quien llama no siempre es quien viene. El mensaje va a quien dio su teléfono: pídele que lo reenvíe si la cita es para otra persona.",
    ejemplo: { ...EJEMPLO_BASE, servicio: "masaje relajante de 60 min", negocio: "Spa Agua Clara" },
    mensajes: {
      confirmacion: {
        whatsapp:
          "Hola {nombre}, tu reserva en {negocio} está confirmada: {servicio} el {día} a las {hora} con {profesional}. Te recomendamos llegar diez minutos antes para cambiarte con calma. Si necesitas moverla, responde a este mensaje.",
        sms: "{negocio}: {servicio} el {día} a las {hora}. Llega 10 min antes para cambiarte. Cambios: {teléfono}",
      },
      recordatorio: {
        whatsapp:
          "Hola {nombre}, te esperamos el {día} a las {hora} en {negocio} para tu {servicio} con {profesional}. Si no puedes venir, avísanos por aquí y liberamos la cabina.",
        sms: "{negocio}: tu {servicio} es el {día} a las {hora}. Si no puedes venir, avisa al {teléfono}.",
      },
      cambio: {
        whatsapp:
          "Hola {nombre}, hemos movido tu reserva en {negocio}: {servicio} el {día} a las {hora} con {profesional}. Si te viene mal, dínoslo y te buscamos otra hora.",
        sms: "{negocio}: tu reserva pasa al {día} a las {hora} con {profesional}. Si te viene mal, llama al {teléfono}.",
      },
      cancelacion: {
        whatsapp:
          "Hola {nombre}, tu reserva del {día} a las {hora} en {negocio} queda anulada. Cuando te apetezca volver, escríbenos por aquí.",
        sms: "{negocio}: anulada tu reserva del {día} a las {hora}. Para volver a reservar, llama al {teléfono}.",
      },
      hueco: {
        whatsapp:
          "Hola {nombre}, se ha quedado libre una cabina en {negocio} el {día} a las {hora} para {servicio} con {profesional}. Si la quieres, responde «sí» y es tuya; la damos por orden de respuesta.",
        sms: "{negocio}: cabina libre el {día} a las {hora} para {servicio}. Llama al {teléfono} si la quieres.",
      },
    },
  },
  {
    id: "canina",
    nombre: "Peluquería canina",
    consejo:
      "Escribes a la persona, no al perro: {nombre} es el dueño y {servicio} puede llevar el nombre del perro («baño y corte de Toby»), que es lo que el cliente reconoce al leerlo.",
    ejemplo: { ...EJEMPLO_BASE, servicio: "baño y corte de Toby", negocio: "Guau Peluqueria" },
    mensajes: {
      confirmacion: {
        whatsapp:
          "Hola {nombre}, la cita de tu perro en {negocio} queda reservada: {servicio} el {día} a las {hora} con {profesional}. Si tiene muchos nudos o alguna herida, cuéntanoslo antes para calcular bien el tiempo. Para cambiar la cita, responde a este mensaje.",
        sms: "{negocio}: {servicio} el {día} a las {hora}. Si tiene nudos o heridas, avisa antes. Cambios: {teléfono}",
      },
      recordatorio: {
        whatsapp:
          "Hola {nombre}, os esperamos el {día} a las {hora} en {negocio} para {servicio}. Si no podéis venir, avísanos por aquí y te damos otra hora.",
        sms: "{negocio}: os esperamos el {día} a las {hora} para {servicio}. Si no podéis venir, avisa al {teléfono}.",
      },
      cambio: {
        whatsapp:
          "Hola {nombre}, hemos cambiado la cita de tu perro en {negocio}: {servicio} el {día} a las {hora}. Si os viene mal, respóndenos y buscamos otra hora.",
        sms: "{negocio}: la cita de tu perro pasa al {día} a las {hora}. Si os viene mal, llama al {teléfono}.",
      },
      cancelacion: {
        whatsapp:
          "Hola {nombre}, queda anulada la cita de tu perro del {día} a las {hora} en {negocio}. Cuando quieras otra, escríbenos por aquí.",
        sms: "{negocio}: anulada la cita de tu perro del {día} a las {hora}. Para otra, llama al {teléfono}.",
      },
      hueco: {
        whatsapp:
          "Hola {nombre}, se ha liberado un hueco en {negocio} el {día} a las {hora} para {servicio}. Si os viene bien, responde «sí» y os lo reservamos; va por orden de respuesta.",
        sms: "{negocio}: hueco libre el {día} a las {hora} para {servicio}. Si lo quieres, llama al {teléfono}.",
      },
    },
  },
];
