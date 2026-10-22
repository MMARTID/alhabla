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

import type { NombreDeFoto } from "@/lib/fotos";

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
  /** Foto de cabecera de banco (lib/fotos.ts) que pinta PaginaGuia. No va
   * al sitemap: Google solo admite imágenes de otro dominio si verificas
   * ese dominio en Search Console, y Unsplash o Pexels no se pueden. */
  foto?: NombreDeFoto;
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

/** Páginas de guía: ruta, nombre, resumen, sección, fecha de revisión y foto. */
function guias(
  filas: readonly (readonly [string, string, string, SeccionDelSitio, string, NombreDeFoto?])[]
): PaginaIndexable[] {
  return filas.map(([ruta, nombre, resumen, seccion, actualizado, foto]) => ({
    ruta,
    nombre,
    resumen,
    seccion,
    actualizado,
    ...(foto ? { foto } : {}),
  }));
}

export const PAGINAS: readonly PaginaIndexable[] = [
  {
    ruta: "/",
    nombre: "Alhabla",
    resumen: "Recepcionista de IA que contesta las llamadas de tu negocio, reserva en tu calendario y confirma por WhatsApp.",
    seccion: "principal",
    actualizado: "2026-10-20",
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
    actualizado: "2026-10-20",
  },
  // Sectores con landing completa (lib/niche-landings.ts).
  ...(
    [
      ["/peluqueria", "Peluquerías", "Contesta mientras cortas: cortes, color y mechas con su duración y con quien toca."],
      ["/barberia", "Barberías", "Coge el teléfono con las sillas llenas y reserva corte, barba o pack con el barbero que piden."],
      ["/centro-de-estetica", "Centros de estética", "Informa de tratamientos y bonos y reserva con la profesional que toca, sin pasar de las citas que caben a la vez."],
      ["/salon-de-unas", "Salones de uñas", "Da el precio de cada técnica, pregunta por la retirada y reserva manicuras y pedicuras."],
      ["/fisioterapia", "Fisioterapia", "Atiende mientras tratas: primeras visitas, sesiones de seguimiento y bonos."],
    ] as const
  ).map(
    ([ruta, nombre, resumen]): PaginaIndexable => ({
      ruta,
      nombre,
      resumen,
      seccion: "sectores",
      actualizado: "2026-10-20",
    })
  ),
  // Sectores sin datos de salud (2026-10-20): misma recepcionista, página
  // propia con el oficio de cada uno. Los sanitarios (podología, osteopatía)
  // quedan fuera hasta resolver el encargo de datos de salud con Telnyx.
  ...(
    [
      ["/pestanas-y-cejas", "Pestañas y cejas", "Extensiones, lifting, laminado y diseño de cejas con su duración, y los rellenos cada pocas semanas.", "extensionesDePestanas"],
      ["/spa-y-masajes", "Spa y masajes", "Masajes de relajación, rituales y circuitos reservados con el terapeuta que toca, sin sacarte de cabina.", "camillaConPiedras"],
      ["/peluqueria-canina", "Peluquería canina", "Baño, corte y deslanado por tamaño de perro, con la cita confirmada al dueño por WhatsApp.", "perroEnLaPeluqueria"],
    ] as const
  ).map(
    ([ruta, nombre, resumen, foto]): PaginaIndexable => ({
      ruta,
      nombre,
      resumen,
      foto,
      seccion: "sectores",
      actualizado: "2026-10-20",
    })
  ),
  {
    ruta: "/agenda-por-whatsapp",
    nombre: "El Gestor por WhatsApp",
    foto: "peluqueraConElMovil",
    resumen: "Cambia horarios, ausencias, precios y citas escribiendo o con notas de voz a tu Gestor por WhatsApp; nada cambia sin tu «Confirmar».",
    seccion: "funciones",
    actualizado: "2026-10-20",
  },
  {
    ruta: "/recepcionista-ia-en-catalan",
    nombre: "Atención en catalán",
    resumen: "En Cataluña y Baleares entiende y contesta en catalán desde la primera llamada.",
    seccion: "funciones",
    actualizado: "2026-10-20",
  },
  ...guias([
    ["/recepcionista-ia-en-euskera", "Atención en euskera", "En Euskadi entiende y contesta en euskera a quien llama en euskera, sin configurar nada.", "funciones", "2026-10-20", "bilbaoRia"],
    ["/recepcionista-ia-en-gallego", "Atención en gallego", "En Galicia atiende en gallego a quien llama en gallego, y en castellano a quien prefiere el castellano.", "funciones", "2026-10-20", "santiagoCatedral"],
    // Integraciones: solo lo que Alhabla hace de verdad (AGENTS.md § Calendar Integration).
    ["/integraciones", "Integraciones", "Los calendarios y canales con los que trabaja tu recepcionista de IA: Google, Outlook, iCloud y WhatsApp.", "integraciones", "2026-10-20", "calendarioEnPantalla"],
    ["/integraciones/google-calendar", "Google Calendar", "Reserva en tu Google Calendar con permisos mínimos y respeta lo que ya tienes apuntado.", "integraciones", "2026-10-20", "calendarioEnOrdenador"],
    ["/integraciones/outlook", "Outlook", "Conecta tu calendario de Outlook o Microsoft 365 y elige en cuál entran las citas.", "integraciones", "2026-10-20", "portatilEnMesa"],
    ["/integraciones/icloud", "Calendario de Apple (iCloud)", "Con tu Apple ID y una contraseña de aplicación, las citas entran en el calendario de tu iPhone.", "integraciones", "2026-10-20", "calendarioEnMovil"],
    ["/integraciones/whatsapp", "WhatsApp", "Confirmaciones y recordatorios a tus clientes, y el Gestor para cambiar tu agenda escribiendo.", "integraciones", "2026-10-20", "movilEnLaMano"],
    // Desvío por operador: datos de la ayuda oficial de cada uno (consultada el 2026-10-20).
    ["/desvio-de-llamadas", "Desvío de llamadas", "Cómo desviar a tu recepcionista de IA las llamadas que no coges, operador por operador, en móvil y en fijo.", "desvio", "2026-10-20", "hablandoPorTelefono"],
    ["/desvio-de-llamadas/movistar", "Movistar", "Códigos del móvil y del fijo, el alta de 4 €/mes por tipo en el fijo y cómo no perder el buzón.", "desvio", "2026-10-20", "movilEnUso"],
    ["/desvio-de-llamadas/vodafone", "Vodafone", "Códigos del móvil y del fijo, el coste por llamada desviada y a qué destinos deja desviar el fijo.", "desvio", "2026-10-20", "telefonoFijo"],
    ["/desvio-de-llamadas/orange", "Orange y Amena", "Segundos de espera configurables y los dos juegos de códigos del fijo según tu cobertura.", "desvio", "2026-10-20", "movilJuntoAPortatil"],
    ["/desvio-de-llamadas/yoigo", "Yoigo", "Qué publica Yoigo para el móvil y el fijo, el contestador 633 y el aviso 556.", "desvio", "2026-10-20", "telefonoEnElSalon"],
    ["/desvio-de-llamadas/masmovil", "MásMóvil", "Desvío del móvil y del fijo, y por qué desde el fijo a un fijo no gastas minutos.", "desvio", "2026-10-20", "telefonoFijo"],
    ["/desvio-de-llamadas/o2", "O2", "Códigos, la app de O2 para comprobarlo y qué hacer si tienes VoLTE o MultiSIM.", "desvio", "2026-10-20", "movilEnUso"],
    ["/desvio-de-llamadas/jazztel", "Jazztel", "Códigos del móvil y del fijo, los segundos de espera y el contestador del fijo.", "desvio", "2026-10-20", "movilJuntoAPortatil"],
    ["/desvio-de-llamadas/digi", "Digi", "Códigos del móvil y del fijo, y las incompatibilidades: itinerancia y aviso de llamada perdida.", "desvio", "2026-10-20", "hablandoPorTelefono"],
    ["/desvio-de-llamadas/pepephone", "Pepephone", "Pepephone no usa códigos: el desvío condicional se elige en Mi Pepephone.", "desvio", "2026-10-20", "movilEnLaMano"],
    ["/desvio-de-llamadas/lowi", "Lowi", "Códigos del móvil, la gestión en Mi Lowi y lo que su ayuda dice del coste.", "desvio", "2026-10-20", "movilEnUso"],
    ["/desvio-de-llamadas/simyo", "Simyo", "Códigos con segundos de espera de 5 a 30, y por qué Simyo no tiene fijo que desviar.", "desvio", "2026-10-20", "movilJuntoAPortatil"],
    ["/desvio-de-llamadas/euskaltel", "Euskaltel", "Códigos del móvil y del fijo, y qué cuesta el desvío según sus tarifas.", "desvio", "2026-10-20", "telefonoFijo"],
    ["/desvio-de-llamadas/r-galicia", "R (Galicia)", "Códigos y la app de R para desviar el móvil y el fijo a tu recepcionista.", "desvio", "2026-10-20", "telefonoEnElSalon"],
    ["/desvio-de-llamadas/telecable", "Telecable", "Códigos del móvil con segundos de espera y del fijo, y cómo se factura.", "desvio", "2026-10-20", "hablandoPorTelefono"],
    ["/desvio-de-llamadas/iphone-y-android", "En iPhone y Android", "Dónde está el desvío en el iPhone, Samsung, Xiaomi y Huawei, y el ajuste del iPhone que se come llamadas.", "desvio", "2026-10-20", "movilEnLaMano"],
    // Comparativas: datos publicados por cada proveedor, con fecha (Ley 3/1991, art. 10).
    ["/comparativa", "Comparativas", "Recepcionista de IA frente a las alternativas: otras IAs, una persona, una secretaria externa o una centralita.", "comparativas", "2026-10-20", "oficinaConPortatilYTelefono"],
    ["/comparativa/alhabla-vs-heydiga", "Alhabla vs HeyDiga", "Precio por minuto, idiomas, calendarios y WhatsApp, con los datos que publica cada uno.", "comparativas", "2026-10-20", "telefonoEnElSalon"],
    ["/comparativa/alhabla-vs-fonio", "Alhabla vs fonio", "Qué incluye cada uno para un salón o una clínica en España, con los datos que publica cada uno.", "comparativas", "2026-10-20", "movilJuntoAPortatil"],
    ["/comparativa/recepcionista-de-ia-vs-recepcionista-humana", "IA frente a una recepcionista en plantilla", "Coste real de una recepcionista según el convenio, qué hace mejor cada una y cuándo conviene combinar.", "comparativas", "2026-10-20", "mostradorDeRecepcion"],
    ["/comparativa/recepcionista-de-ia-vs-secretaria-telefonica", "IA frente a una secretaria telefónica externa", "Atención por personas desde un centro de llamadas frente a una IA que reserva en tu agenda.", "comparativas", "2026-10-20", "auricularesDeAtencion"],
    ["/comparativa/recepcionista-de-ia-vs-centralita-virtual", "IA frente a una centralita virtual", "El «pulse 1» frente a una conversación que termina en cita: qué resuelve cada uno.", "comparativas", "2026-10-20", "telefonoDeOficina"],
    // Herramientas gratis, sin pedir el email.
    ["/herramientas", "Herramientas gratis", "Calculadora de llamadas perdidas y plantillas para recordatorios, cancelaciones y el teléfono del salón.", "herramientas", "2026-10-20", "telefonoEnElSalon"],
    ["/herramientas/calculadora-de-llamadas-perdidas", "Calculadora de llamadas perdidas", "Cuánto dinero se va cada mes por las llamadas que no coges, con tus cifras y el método explicado.", "herramientas", "2026-10-20", "calculadoraYPapel"],
    ["/herramientas/plantillas-recordatorio-de-cita", "Plantillas de recordatorio de cita", "Mensajes de WhatsApp y SMS para confirmar, recordar y reprogramar citas, por sector, listos para copiar.", "herramientas", "2026-10-20", "mensajeEnElMovil"],
    ["/herramientas/guion-para-atender-el-telefono", "Guion para atender el teléfono", "Qué decir al coger el teléfono del salón, cómo dar un hueco y cómo cerrar la cita sin olvidar nada.", "herramientas", "2026-10-20", "peluqueraConElMovil"],
    ["/herramientas/mensajes-de-contestador", "Mensajes de contestador y de fuera de horario", "Textos para el contestador del negocio y la respuesta automática de WhatsApp Business, por sector.", "herramientas", "2026-10-20", "telefonoDeOficina"],
    ["/herramientas/politica-de-cancelacion", "Política de cancelación", "Generador de una política de cancelación y ausencias para tu negocio, con ejemplos por sector.", "herramientas", "2026-10-20", "sillaVacia"],
    // Guías de fondo.
    ["/guias/ley-y-recepcionista-de-ia", "La ley y la recepcionista de IA", "Aviso de IA, grabación de llamadas, la Ley 10/2025 y los recordatorios por WhatsApp, con el artículo de cada norma.", "guias", "2026-10-20", "documentosYCarpetas"],
    ["/glosario", "Glosario", "Desvío condicional, no-show, contraseña de aplicación y el resto de términos que salen al poner una recepcionista de IA.", "guias", "2026-10-20"],
    // Empresa.
    ["/sobre-alhabla", "Sobre Alhabla", "Quién está detrás, por qué existe Alhabla y lo que nunca hará tu recepcionista.", "empresa", "2026-10-20"],
    ["/prensa", "Prensa", "Datos, logotipos, capturas y contacto para periodistas.", "empresa", "2026-10-20"],
    ["/novedades", "Novedades", "Lo que ha cambiado en Alhabla mes a mes: funciones nuevas, idiomas y precios.", "empresa", "2026-10-20"],
  ]),
  {
    ruta: "/blog",
    nombre: "Blog",
    resumen: "Guías para negocios con cita previa: llamadas perdidas, desvío, recordatorios y agenda.",
    seccion: "principal",
  },
  {
    ruta: "/contacto",
    nombre: "Hablar con nosotros",
    resumen: "Formulario y WhatsApp del equipo para resolver dudas antes de contratar.",
    seccion: "empresa",
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
