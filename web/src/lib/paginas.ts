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
  prioridad: number;
  frecuencia: "weekly" | "monthly" | "yearly";
  /**
   * AAAA-MM-DD de la última revisión de fondo (no de una errata). Va al
   * `lastmod` del sitemap; sin él no se publica, porque un `lastmod` que
   * miente («todo cambió hoy» en cada deploy) hace que Google lo ignore.
   */
  actualizado?: string;
  /** Foto de cabecera (lib/fotos.ts): la pinta PaginaGuia y va al sitemap de imágenes. */
  foto?: NombreDeFoto;
  /** Otras imágenes que se ven en la página (ruta bajo public/ o URL absoluta de
   * Unsplash/Pexels), para el sitemap de imágenes. */
  imagenes?: string[];
};

const HOY = "2026-10-20";

/** Páginas de valor nuevas (todas revisadas hoy): ruta, nombre, resumen y sección. */
function guias(filas: readonly (readonly [string, string, string, SeccionDelSitio, NombreDeFoto?])[]): PaginaIndexable[] {
  return filas.map(([ruta, nombre, resumen, seccion, foto]) => ({
    ruta,
    nombre,
    resumen,
    seccion,
    ...(foto ? { foto } : {}),
    // Los índices de sección pesan más que sus hijas.
    prioridad: ruta.split("/").length === 2 ? 0.7 : 0.6,
    frecuencia: "monthly",
    actualizado: HOY,
  }));
}

export const PAGINAS: readonly PaginaIndexable[] = [
  {
    ruta: "/",
    nombre: "Alhabla",
    resumen: "Recepcionista de IA que contesta las llamadas de tu negocio, reserva en tu calendario y confirma por WhatsApp.",
    seccion: "principal",
    prioridad: 1,
    frecuencia: "weekly",
    actualizado: HOY,
    imagenes: ["/heroes/general.jpg"],
  },
  {
    ruta: "/planes",
    nombre: "Planes y precios",
    resumen: "Inicio, Pro y Scale: cuota sin IVA, minutos incluidos, precio del minuto extra y qué cuenta como minuto.",
    seccion: "principal",
    prioridad: 0.9,
    frecuencia: "weekly",
    actualizado: HOY,
  },
  // Sectores con landing completa (lib/niche-landings.ts).
  ...(
    [
      ["/peluqueria", "Peluquerías", "Contesta mientras cortas: cortes, color y mechas con su duración y con quien toca."],
      ["/barberia", "Barberías", "Coge el teléfono con las sillas llenas y reserva corte, barba o pack con el barbero que piden."],
      ["/centro-de-estetica", "Centros de estética", "Informa de tratamientos y bonos y reserva por cabina y profesional sin sacarte de cabina."],
      ["/salon-de-unas", "Salones de uñas", "Da el precio de cada técnica, pregunta por la retirada y reserva manicuras y pedicuras."],
      ["/fisioterapia", "Fisioterapia", "Atiende mientras tratas: primeras visitas, sesiones de seguimiento y bonos."],
    ] as const
  ).map(
    ([ruta, nombre, resumen]): PaginaIndexable => ({
      ruta,
      nombre,
      resumen,
      seccion: "sectores",
      prioridad: 0.85,
      frecuencia: "weekly",
      actualizado: HOY,
      imagenes: [`/heroes${ruta}.jpg`],
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
      prioridad: 0.8,
      frecuencia: "monthly",
      actualizado: HOY,
    })
  ),
  {
    ruta: "/agenda-por-whatsapp",
    nombre: "El Gestor por WhatsApp",
    resumen: "Cambia horarios, ausencias, precios y citas escribiendo a tu recepcionista por WhatsApp.",
    seccion: "funciones",
    prioridad: 0.7,
    frecuencia: "monthly",
    actualizado: HOY,
  },
  {
    ruta: "/recepcionista-ia-en-catalan",
    nombre: "Atención en catalán",
    resumen: "En Cataluña y Baleares entiende y contesta en catalán desde la primera llamada.",
    seccion: "funciones",
    prioridad: 0.7,
    frecuencia: "monthly",
    actualizado: HOY,
  },
  ...guias([
    ["/recepcionista-ia-en-euskera", "Atención en euskera", "En Euskadi entiende y contesta en euskera a quien llama en euskera, sin configurar nada.", "funciones", "bilbaoRia"],
    ["/recepcionista-ia-en-gallego", "Atención en gallego", "En Galicia atiende en gallego a quien llama en gallego, y en castellano a quien prefiere el castellano.", "funciones", "santiagoCatedral"],
    // Integraciones: solo lo que Alhabla hace de verdad (AGENTS.md § Calendar Integration).
    ["/integraciones", "Integraciones", "Los calendarios y canales con los que trabaja tu recepcionista de IA: Google, Outlook, iCloud y WhatsApp.", "integraciones", "calendarioEnPantalla"],
    ["/integraciones/google-calendar", "Google Calendar", "Reserva en tu Google Calendar con permisos mínimos y respeta lo que ya tienes apuntado.", "integraciones", "calendarioEnOrdenador"],
    ["/integraciones/outlook", "Outlook", "Conecta tu calendario de Outlook o Microsoft 365 y elige en cuál entran las citas.", "integraciones", "portatilEnMesa"],
    ["/integraciones/icloud", "Calendario de Apple (iCloud)", "Con tu Apple ID y una contraseña de aplicación, las citas entran en el calendario de tu iPhone.", "integraciones", "calendarioEnMovil"],
    ["/integraciones/whatsapp", "WhatsApp", "Confirmaciones y recordatorios a tus clientes, y el Gestor para cambiar tu agenda escribiendo.", "integraciones", "movilEnLaMano"],
    // Desvío por operador: datos de la ayuda oficial de cada uno (consultada el 2026-10-20).
    ["/desvio-de-llamadas", "Desvío de llamadas", "Cómo desviar a tu recepcionista de IA las llamadas que no coges, operador por operador, en móvil y en fijo.", "desvio", "hablandoPorTelefono"],
    ["/desvio-de-llamadas/movistar", "Movistar", "Códigos del móvil y del fijo, el alta de 4 €/mes por tipo en el fijo y cómo no perder el buzón.", "desvio", "movilEnUso"],
    ["/desvio-de-llamadas/vodafone", "Vodafone", "Códigos del móvil y del fijo, el coste por llamada desviada y a qué destinos deja desviar el fijo.", "desvio", "telefonoFijo"],
    ["/desvio-de-llamadas/orange", "Orange y Amena", "Segundos de espera configurables y los dos juegos de códigos del fijo según tu cobertura.", "desvio", "movilJuntoAPortatil"],
    ["/desvio-de-llamadas/yoigo", "Yoigo", "Qué publica Yoigo para el móvil y el fijo, el contestador 633 y el aviso 556.", "desvio", "telefonoEnElSalon"],
    ["/desvio-de-llamadas/masmovil", "MásMóvil", "Desvío del móvil y del fijo, y por qué desde el fijo a un fijo no gastas minutos.", "desvio", "telefonoFijo"],
    ["/desvio-de-llamadas/o2", "O2", "Códigos, la app de O2 para comprobarlo y qué hacer si tienes VoLTE o MultiSIM.", "desvio", "movilEnUso"],
    ["/desvio-de-llamadas/jazztel", "Jazztel", "Códigos del móvil y del fijo, los segundos de espera y el contestador del fijo.", "desvio", "movilJuntoAPortatil"],
    ["/desvio-de-llamadas/digi", "Digi", "Códigos del móvil y del fijo, y las incompatibilidades: itinerancia y aviso de llamada perdida.", "desvio", "hablandoPorTelefono"],
    ["/desvio-de-llamadas/pepephone", "Pepephone", "Pepephone no usa códigos: el desvío condicional se elige en Mi Pepephone.", "desvio", "movilEnLaMano"],
    ["/desvio-de-llamadas/lowi", "Lowi", "Códigos del móvil, la gestión en Mi Lowi y lo que su ayuda dice del coste.", "desvio", "movilEnUso"],
    ["/desvio-de-llamadas/simyo", "Simyo", "Códigos con segundos de espera de 5 a 30, y por qué Simyo no tiene fijo que desviar.", "desvio", "movilJuntoAPortatil"],
    ["/desvio-de-llamadas/euskaltel", "Euskaltel", "Códigos del móvil y del fijo, y qué cuesta el desvío según sus tarifas.", "desvio", "telefonoFijo"],
    ["/desvio-de-llamadas/r-galicia", "R (Galicia)", "Códigos y la app de R para desviar el móvil y el fijo a tu recepcionista.", "desvio", "telefonoEnElSalon"],
    ["/desvio-de-llamadas/telecable", "Telecable", "Códigos del móvil con segundos de espera y del fijo, y cómo se factura.", "desvio", "hablandoPorTelefono"],
    ["/desvio-de-llamadas/iphone-y-android", "En iPhone y Android", "Dónde está el desvío en el iPhone, Samsung, Xiaomi y Huawei, y el ajuste del iPhone que se come llamadas.", "desvio", "movilEnLaMano"],
    // Comparativas: datos publicados por cada proveedor, con fecha (Ley 3/1991, art. 10).
    ["/comparativa", "Comparativas", "Recepcionista de IA frente a las alternativas: otras IAs, una persona, una secretaria externa o una centralita.", "comparativas", "oficinaConPortatilYTelefono"],
    ["/comparativa/alhabla-vs-heydiga", "Alhabla vs HeyDiga", "Precio por minuto, idiomas, calendarios y WhatsApp, con los datos que publica cada uno.", "comparativas", "telefonoEnElSalon"],
    ["/comparativa/alhabla-vs-fonio", "Alhabla vs fonio", "Qué incluye cada uno para un salón o una clínica en España, con los datos que publica cada uno.", "comparativas", "movilJuntoAPortatil"],
    ["/comparativa/recepcionista-de-ia-vs-recepcionista-humana", "IA frente a una recepcionista en plantilla", "Coste real de una recepcionista según el convenio, qué hace mejor cada una y cuándo conviene combinar.", "comparativas", "mostradorDeRecepcion"],
    ["/comparativa/recepcionista-de-ia-vs-secretaria-telefonica", "IA frente a una secretaria telefónica externa", "Atención por personas desde un centro de llamadas frente a una IA que reserva en tu agenda.", "comparativas", "auricularesDeAtencion"],
    ["/comparativa/recepcionista-de-ia-vs-centralita-virtual", "IA frente a una centralita virtual", "El «pulse 1» frente a una conversación que termina en cita: qué resuelve cada uno.", "comparativas", "telefonoDeOficina"],
    // Herramientas gratis, sin pedir el email.
    ["/herramientas", "Herramientas gratis", "Calculadora de llamadas perdidas y plantillas para recordatorios, cancelaciones y el teléfono del salón.", "herramientas", "telefonoEnElSalon"],
    ["/herramientas/calculadora-de-llamadas-perdidas", "Calculadora de llamadas perdidas", "Cuánto dinero se va cada mes por las llamadas que no coges, con tus cifras y el método explicado.", "herramientas", "calculadoraYPapel"],
    ["/herramientas/plantillas-recordatorio-de-cita", "Plantillas de recordatorio de cita", "Mensajes de WhatsApp y SMS para confirmar, recordar y reprogramar citas, por sector, listos para copiar.", "herramientas", "mensajeEnElMovil"],
    ["/herramientas/guion-para-atender-el-telefono", "Guion para atender el teléfono", "Qué decir al coger el teléfono del salón, cómo dar un hueco y cómo cerrar la cita sin olvidar nada.", "herramientas", "peluqueraConElMovil"],
    ["/herramientas/mensajes-de-contestador", "Mensajes de contestador y de fuera de horario", "Textos para el contestador del negocio y la respuesta automática de WhatsApp Business, por sector.", "herramientas", "telefonoDeOficina"],
    ["/herramientas/politica-de-cancelacion", "Política de cancelación", "Generador de una política de cancelación y ausencias para tu negocio, con ejemplos por sector.", "herramientas", "sillaVacia"],
    // Guías de fondo.
    ["/guias/ley-y-recepcionista-de-ia", "La ley y la recepcionista de IA", "Aviso de IA, grabación de llamadas, la Ley 10/2025 y los recordatorios por WhatsApp, con el artículo de cada norma.", "guias", "documentosYCarpetas"],
    ["/glosario", "Glosario", "Desvío condicional, no-show, contraseña de aplicación y el resto de términos que salen al poner una recepcionista de IA.", "guias"],
    // Empresa.
    ["/sobre-alhabla", "Sobre Alhabla", "Quién está detrás, por qué existe Alhabla y lo que nunca hará tu recepcionista.", "empresa"],
    ["/prensa", "Prensa", "Datos, logotipos, capturas y contacto para periodistas.", "empresa"],
    ["/novedades", "Novedades", "Lo que ha cambiado en Alhabla mes a mes: funciones nuevas, idiomas y precios.", "empresa"],
  ]),
  {
    ruta: "/blog",
    nombre: "Blog",
    resumen: "Guías para negocios con cita previa: llamadas perdidas, desvío, recordatorios y agenda.",
    seccion: "principal",
    prioridad: 0.6,
    frecuencia: "weekly",
  },
  {
    ruta: "/contacto",
    nombre: "Hablar con nosotros",
    resumen: "Formulario y WhatsApp del equipo para resolver dudas antes de contratar.",
    seccion: "empresa",
    prioridad: 0.5,
    frecuencia: "yearly",
  },
  {
    ruta: "/legal/aviso-legal",
    nombre: "Aviso legal",
    resumen: "Titular, condiciones de uso y datos de contacto de alhabla.ai.",
    seccion: "legal",
    prioridad: 0.3,
    frecuencia: "yearly",
  },
  {
    ruta: "/legal/privacidad",
    nombre: "Privacidad",
    resumen: "Qué datos trata Alhabla, con qué proveedores y cómo ejercer tus derechos.",
    seccion: "legal",
    prioridad: 0.3,
    frecuencia: "yearly",
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
