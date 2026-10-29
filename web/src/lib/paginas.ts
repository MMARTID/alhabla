/**
 * Registro único de las páginas indexables de alhabla.ai que no son
 * artículos del blog (esos salen de `content/blog`, ver lib/blog.ts).
 *
 * De aquí leen el sitemap (app/sitemap.ts), los índices de cada sección
 * (/integraciones, /desvio-de-llamadas, /comparativa, /herramientas), el
 * pie, /llms.txt y los tests. Una página nueva se da de alta aquí y en su
 * carpeta de `app/`; un test comprueba que cada ruta del registro tiene su
 * `page.tsx` y que ninguna página indexable se queda fuera.
 *
 * Por qué existe (2026-10-20): Google indexó 2 de las 30 páginas sector ×
 * ciudad porque se parecían más de un 50 %. Cada entrada de este registro
 * debe tener contenido propio que no esté en ninguna otra; lo vigila
 * `npm run seo:similitud` sobre el build (scripts/auditar-similitud.mjs).
 */

export type SeccionDelSitio =
  | "principal"
  | "sectores"
  | "funciones"
  | "integraciones"
  | "desvio"
  | "comparativas"
  | "herramientas"
  | "guias"
  | "empresa"
  | "legal";

export type PaginaIndexable = {
  ruta: string;
  /** Nombre corto: enlaces, migas y tarjetas de los índices. */
  nombre: string;
  /** Una frase para la tarjeta del índice de su sección y para /llms.txt. */
  resumen: string;
  seccion: SeccionDelSitio;
  /**
   * AAAA-MM-DD de la última revisión de fondo de ESTA página: lo que dice,
   * sus datos o sus enlaces. No se sube por una errata, por cambiar una
   * palabra ni por tocar algo común a todas (el pie). Va al `lastmod` del
   * sitemap, al `dateModified` y al «Actualizado el…» de PaginaGuia; Google
   * solo usa el `lastmod` si es «consistently and verifiably accurate», y
   * Bing dice que el error típico es que todas las fechas sean iguales. Por
   * eso cada entrada lleva la suya y no hay una constante común.
   *
   * Sin `priority` ni `changefreq` (2026-10-22): Google y Bing los ignoran.
   */
  actualizado?: string;
  /** Imágenes propias (rutas bajo public/) que se ven en la página, para el
   * sitemap de imágenes. Solo las que salen de verdad en su HTML. */
  imagenes?: string[];
};

/*
 * Tope del registro (regla nuestra, no de Google; 2026-10-22): entre 75 y
 * 85 páginas hasta que más de la mitad estén indexadas. Con poca autoridad,
 * Google rastrea poco y cada página nueva le quita rastreo a las demás. Las
 * nuevas, de una en una, con contenido propio y pasando `seo:similitud`.
 */

/** Páginas de guía: ruta, nombre, resumen, sección y fecha de revisión. */
function guias(
  filas: readonly (readonly [string, string, string, SeccionDelSitio, string])[]
): PaginaIndexable[] {
  return filas.map(([ruta, nombre, resumen, seccion, actualizado]) => ({
    ruta,
    nombre,
    resumen,
    seccion,
    actualizado,
  }));
}

export const PAGINAS: readonly PaginaIndexable[] = [
  {
    ruta: "/",
    nombre: "Alhabla",
    resumen: "Recepcionista de IA que atiende las llamadas de tu negocio para que no pierdas ninguna; tú lo gestionas por WhatsApp o desde el panel.",
    seccion: "principal",
    actualizado: "2026-10-29",
    // Las fotos de los sectores que se ven en la portada (main-landing.tsx).
    // general.jpg no: solo la usa la imagen para compartir.
    imagenes: ["peluqueria", "barberia", "salon-de-unas", "centro-de-estetica", "fisioterapia"].map(
      (sector) => `/heroes/${sector}.jpg`
    ),
  },
  {
    ruta: "/planes",
    nombre: "Planes y precios",
    resumen: "Inicio, Pro y Scale: cuota sin IVA, minutos incluidos, precio del minuto extra y qué cuenta como minuto.",
    seccion: "principal",
    actualizado: "2026-10-29",
  },
  // Sectores: la plantilla «Las preguntas de la dueña» (components/site-landing.tsx)
  // con los textos de cada oficio en lib/sectores/. Los sanitarios
  // (podología, osteopatía) quedan fuera hasta resolver el encargo de datos
  // de salud con el proveedor de telefonía.
  ...(
    [
      ["/peluqueria", "Peluquerías", "Contesta mientras cortas, reserva corte y color con la estilista que toca y, si falta alguien, tu asistente recoloca sus citas."],
      ["/barberia", "Barberías", "Coge el teléfono con las sillas llenas, da hora para hoy con el barbero que piden y la confirma por WhatsApp."],
      ["/centro-de-estetica", "Centros de estética", "Explica tus tratamientos con lo que le escribes, reserva con la esteticista que toca y no opina sobre salud."],
      ["/salon-de-unas", "Salones de uñas", "Pregunta si hay retirada, guarda el tiempo justo de cada técnica y manda la cita por WhatsApp."],
      ["/fisioterapia", "Fisioterapia", "Atiende mientras tratas: primeras visitas y seguimientos con su fisio, sin pedir el historial clínico."],
      ["/pestanas-y-cejas", "Pestañas y cejas", "Aplica tu regla de rellenos, reserva cada juego con su duración y con la técnica que toca."],
      ["/spa-y-masajes", "Spa y masajes", "Atiende mientras estás en cabina: masajes y rituales con quien toca, confirmados por WhatsApp."],
      ["/peluqueria-canina", "Peluquería canina", "Pregunta qué perro es, reserva el servicio de su tamaño y confirma la cita al dueño por WhatsApp."],
    ] as const
  ).map(
    ([ruta, nombre, resumen]): PaginaIndexable => ({
      ruta,
      nombre,
      resumen,
      seccion: "sectores",
      actualizado: "2026-10-29",
    })
  ),
  {
    ruta: "/agenda-por-whatsapp",
    nombre: "Tu asistente por WhatsApp",
    resumen: "Si falta alguien, se lo dices por WhatsApp: te dice qué citas tenía, comprueba dónde caben y avisa a cada cliente cuando tú confirmas.",
    seccion: "funciones",
    actualizado: "2026-10-29",
  },
  {
    ruta: "/recepcionista-ia-en-catalan",
    nombre: "Atención en catalán",
    resumen: "Entiende y contesta en catalán y se adapta al valenciano y al balear; en Cataluña y Baleares se activa sola.",
    seccion: "funciones",
    actualizado: "2026-10-29",
  },
  ...guias([
    ["/recepcionista-ia-en-euskera", "Atención en euskera", "Atiende en euskera batua o en castellano, según hable quien llama; en Euskadi se activa sola y en Navarra la eliges tú.", "funciones", "2026-10-29"],
    ["/recepcionista-ia-en-gallego", "Atención en gallego", "En Galicia atiende en gallego a quien llama en gallego, y en castellano a quien prefiere el castellano.", "funciones", "2026-10-29"],
    // Integraciones: solo lo que Alhabla hace de verdad (AGENTS.md § Calendar Integration).
    ["/integraciones", "Integraciones", "No tienes que cambiar de agenda: Google Calendar, Outlook o iCloud, o la agenda de Alhabla si no usas ninguno.", "integraciones", "2026-10-29"],
    ["/integraciones/google-calendar", "Google Calendar", "Reserva en tu Google Calendar con permisos mínimos y respeta lo que ya tienes apuntado.", "integraciones", "2026-10-29"],
    ["/integraciones/outlook", "Outlook", "Conecta tu calendario de Outlook o Microsoft 365 y elige en cuál entran las citas.", "integraciones", "2026-10-29"],
    ["/integraciones/icloud", "Calendario de Apple (iCloud)", "Con tu Apple ID y una contraseña de aplicación, las citas entran en el calendario de tu iPhone.", "integraciones", "2026-10-29"],
    ["/integraciones/whatsapp", "WhatsApp", "Confirmaciones y recordatorios por WhatsApp; tus clientes cambian o cancelan su cita contestando, sin bajarse nada.", "integraciones", "2026-10-29"],
    // Desvío por operador: datos de la ayuda oficial de cada uno (consultada el 2026-10-20).
    ["/desvio-de-llamadas", "Desvío de llamadas", "Cómo desviar a tu recepcionista de IA las llamadas que no coges, operador por operador, en móvil y en fijo.", "desvio", "2026-10-29"],
    ["/desvio-de-llamadas/movistar", "Movistar", "Códigos del móvil y del fijo, el alta de 4 €/mes por tipo en el fijo y cómo no perder el buzón.", "desvio", "2026-10-29"],
    ["/desvio-de-llamadas/vodafone", "Vodafone", "Códigos del móvil y del fijo, el coste por llamada desviada y a qué destinos deja desviar el fijo.", "desvio", "2026-10-29"],
    ["/desvio-de-llamadas/orange", "Orange y Amena", "Segundos de espera configurables y los dos juegos de códigos del fijo según tu cobertura.", "desvio", "2026-10-29"],
    ["/desvio-de-llamadas/yoigo", "Yoigo", "Qué publica Yoigo para el móvil y el fijo, el contestador 633 y el aviso 556.", "desvio", "2026-10-29"],
    ["/desvio-de-llamadas/masmovil", "MásMóvil", "Desvío del móvil y del fijo, y por qué desde el fijo a un fijo no gastas minutos.", "desvio", "2026-10-29"],
    ["/desvio-de-llamadas/o2", "O2", "Códigos, la app de O2 para comprobarlo y qué hacer si tienes VoLTE o MultiSIM.", "desvio", "2026-10-29"],
    ["/desvio-de-llamadas/jazztel", "Jazztel", "Códigos del móvil y del fijo, los segundos de espera y el contestador del fijo.", "desvio", "2026-10-29"],
    ["/desvio-de-llamadas/digi", "Digi", "Códigos del móvil y del fijo, y las incompatibilidades: itinerancia y aviso de llamada perdida.", "desvio", "2026-10-29"],
    ["/desvio-de-llamadas/pepephone", "Pepephone", "Pepephone no usa códigos: el desvío condicional se elige en Mi Pepephone.", "desvio", "2026-10-29"],
    ["/desvio-de-llamadas/lowi", "Lowi", "Códigos del móvil, la gestión en Mi Lowi y lo que su ayuda dice del coste.", "desvio", "2026-10-29"],
    ["/desvio-de-llamadas/simyo", "Simyo", "Códigos con segundos de espera de 5 a 30, y por qué Simyo no tiene fijo que desviar.", "desvio", "2026-10-29"],
    ["/desvio-de-llamadas/euskaltel", "Euskaltel", "Códigos del móvil y del fijo, y qué cuesta el desvío según sus tarifas.", "desvio", "2026-10-29"],
    ["/desvio-de-llamadas/r-galicia", "R (Galicia)", "Códigos y la app de R para desviar el móvil y el fijo a tu recepcionista.", "desvio", "2026-10-29"],
    ["/desvio-de-llamadas/telecable", "Telecable", "Códigos del móvil con segundos de espera y del fijo, y cómo se factura.", "desvio", "2026-10-29"],
    ["/desvio-de-llamadas/iphone-y-android", "En iPhone y Android", "Dónde está el desvío en el iPhone, Samsung, Xiaomi y Huawei, y el ajuste del iPhone que se come llamadas.", "desvio", "2026-10-29"],
    // Comparativas con plataformas para montar tu propio agente de voz: datos
    // publicados por cada una, con fecha (Ley 3/1991, art. 10; lib/comparativas.ts).
    ["/comparativa", "Comparativas", "Alhabla frente a Retell AI, Vapi, Bland AI, Synthflow y ElevenLabs: montar tu agente o tener la recepcionista hecha.", "comparativas", "2026-10-29"],
    ["/comparativa/alhabla-vs-retell-ai", "Alhabla vs Retell AI", "Retell AI es para construir tu agente; Alhabla, la recepcionista ya hecha. Precio, número español, calendarios y WhatsApp.", "comparativas", "2026-10-29"],
    ["/comparativa/alhabla-vs-vapi", "Alhabla vs Vapi", "Vapi es para desarrolladores que montan su agente pieza a pieza; Alhabla, la recepcionista ya hecha para tu negocio.", "comparativas", "2026-10-29"],
    ["/comparativa/alhabla-vs-bland-ai", "Alhabla vs Bland AI", "Bland AI se presenta a empresas de sectores regulados; Alhabla, a negocios con cita que quieren no perder llamadas.", "comparativas", "2026-10-29"],
    ["/comparativa/alhabla-vs-synthflow", "Alhabla vs Synthflow", "Synthflow solo se contrata como empresa, desde 30.000 $ al año; Alhabla, mes a mes y sin permanencia.", "comparativas", "2026-10-29"],
    ["/comparativa/alhabla-vs-elevenlabs", "Alhabla vs ElevenLabs", "ElevenAgents y su recepcionista Reception frente a Alhabla: número español, calendarios, WhatsApp y tu asistente.", "comparativas", "2026-10-29"],
    // Herramientas gratis, sin pedir el email.
    ["/herramientas", "Herramientas gratis", "Calculadora de llamadas perdidas y plantillas para recordatorios, cancelaciones y el teléfono del salón.", "herramientas", "2026-10-29"],
    ["/herramientas/calculadora-de-llamadas-perdidas", "Calculadora de llamadas perdidas", "Cuánto dinero se va cada mes por las llamadas que no coges, con tus cifras y el método explicado.", "herramientas", "2026-10-29"],
    ["/herramientas/plantillas-recordatorio-de-cita", "Plantillas de recordatorio de cita", "Mensajes de WhatsApp y SMS para confirmar, recordar y reprogramar citas, por sector, listos para copiar.", "herramientas", "2026-10-29"],
    ["/herramientas/guion-para-atender-el-telefono", "Guion para atender el teléfono", "Qué decir al coger el teléfono del salón, cómo dar un hueco y cómo cerrar la cita sin olvidar nada.", "herramientas", "2026-10-29"],
    ["/herramientas/mensajes-de-contestador", "Mensajes de contestador y de fuera de horario", "Textos para el contestador del negocio y la respuesta automática de WhatsApp Business, por sector.", "herramientas", "2026-10-29"],
    ["/herramientas/politica-de-cancelacion", "Política de cancelación", "Generador de tu política de cancelación: plazo, señal y qué pasa cuando no vienen, con ejemplos por sector.", "herramientas", "2026-10-29"],
    // Guías de fondo.
    ["/guias/ley-y-recepcionista-de-ia", "La ley y la recepcionista de IA", "Aviso de IA, grabación de llamadas, la Ley 10/2025, los mensajes por WhatsApp y tu asistente, con el artículo de cada norma.", "guias", "2026-10-29"],
    ["/glosario", "Glosario", "Desvío condicional, no-show, contraseña de aplicación y el resto de términos que salen al poner una recepcionista de IA.", "guias", "2026-10-29"],
    // Empresa.
    ["/sobre-alhabla", "Sobre Alhabla", "Quién está detrás, por qué existe Alhabla y su regla: con tus clientes manda Alhabla; con tu agenda mandas tú.", "empresa", "2026-10-29"],
    ["/prensa", "Prensa", "Datos, logotipos, capturas y contacto para periodistas.", "empresa", "2026-10-29"],
    ["/novedades", "Novedades", "Lo que ha cambiado en Alhabla mes a mes: la agenda de Alhabla, tu asistente, idiomas y precios.", "empresa", "2026-10-29"],
  ]),
  {
    ruta: "/blog",
    nombre: "Blog",
    resumen: "Guías para negocios con cita previa: llamadas perdidas, desvío, recordatorios y agenda.",
    seccion: "principal",
  },
  {
    ruta: "/contacto",
    nombre: "Contacto",
    resumen: "Formulario y WhatsApp del equipo para resolver dudas antes de contratar.",
    seccion: "empresa",
    actualizado: "2026-10-29",
  },
  {
    ruta: "/legal/aviso-legal",
    nombre: "Aviso legal",
    resumen: "Titular, condiciones de uso y datos de contacto de alhabla.ai.",
    seccion: "legal",
    // La misma fecha que enseña la página (updatedAt de legal/*/page.tsx).
    actualizado: "2026-10-20",
  },
  {
    ruta: "/legal/privacidad",
    nombre: "Privacidad",
    resumen: "Qué datos trata Alhabla, con qué proveedores y cómo ejercer tus derechos.",
    seccion: "legal",
    // La misma fecha que enseña la página (updatedAt de legal/*/page.tsx).
    actualizado: "2026-10-20",
  },
];

export function paginaDe(ruta: string): PaginaIndexable {
  const pagina = PAGINAS.find((p) => p.ruta === ruta);
  if (!pagina) {
    throw new Error(`[Paginas] ${ruta} no está en el registro de lib/paginas.ts`);
  }
  return pagina;
}

export function paginasDeLaSeccion(seccion: SeccionDelSitio): PaginaIndexable[] {
  return PAGINAS.filter((p) => p.seccion === seccion);
}

/** Las páginas hijas de un índice (`/integraciones` → `/integraciones/…`). */
export function paginasBajo(prefijo: string): PaginaIndexable[] {
  return PAGINAS.filter((p) => p.ruta.startsWith(`${prefijo}/`));
}
