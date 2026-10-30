/**
 * El MAPA del extractor de conocimiento: qué bullet de PRODUCT.md, qué
 * texto de plans.ts y qué función de planFeatures.ts da qué afirmación, y con
 * qué texto revisado.
 *
 * Es la parte que decide una persona, y por eso es explícito: un bullet de
 * PRODUCT.md o un texto de un plan que NO tenga entrada aquí hace fallar la
 * extracción (`--comprobar` lo corre en CI), en vez de ignorarse o de
 * copiarse tal cual. Cada bullet nuevo obliga a decidir qué se puede decir de
 * él y con qué clave. A la inversa, una entrada cuyo bullet ya no existe
 * también falla: el mapa no se queda con restos de lo que se retiró.
 *
 * Los textos de aquí están revisados a mano: sin identificadores de código
 * (`warm`, `/agente`, `es-ES`), sin jerga («WebRTC», «CalDAV») y sin el nombre
 * de ningún proveedor. Cada texto lleva la `huella` del bullet que se revisó:
 * si el bullet cambia después, la extracción FALLA (`--comprobar`, también en
 * CI) hasta que alguien relea el bullet, ajuste el texto si hace falta y
 * regenere las huellas con `--actualizar-huellas`. Sin eso, un cambio de
 * «5–480 min» a «10–480 min» en PRODUCT.md dejaría la base repitiendo lo viejo.
 * El `valor.huellaOrigen` de cada fila sigue ahí: hace que la afirmación se
 * reemplace (y los borradores que la citan se bloqueen) cuando cambia el
 * bullet.
 */

export const SECCION_CAPACIDADES = "Capabilities and Constraints";
export const SECCION_MARCA = "Brand Commitments";
export const SECCION_EVIDENCIA = "Evidence on Hand";

export const GRUPO_CAPACIDADES = "Capacidades confirmadas";
export const GRUPO_TERMINOLOGIA = "Terminología del producto";
export const GRUPO_RESTRICCIONES = "Restricciones duras";
export const GRUPO_DECISIONES_ABIERTAS =
  "Decisiones abiertas — no inventar una respuesta";
export const GRUPO_EXISTE = "Lo que existe y es real";
export const GRUPO_AUSENCIAS =
  "Ausencias que ningún trabajo futuro debe rellenar inventando";

export type Destino = {
  tipo: "funcion" | "limite";
  clave: string;
  /**
   * Huella (12 hex) del bullet de PRODUCT.md, o de la frase que contiene la
   * limitación, tal como estaba cuando una persona revisó `texto`. Si hoy es
   * otra, el origen cambió después de la revisión y la extracción falla (que
   * `texto` siga diciendo lo de siempre no prueba que siga siendo cierto):
   * revisa el texto y regenera las huellas con
   * `npm run growth:conocimiento -- --actualizar-huellas`.
   */
  huella: string;
  /** Texto revisado: es lo que lee quien redacta. */
  texto: string;
  /** Campos extra de `valor` (además de `huellaOrigen`). */
  valor?: Record<string, unknown>;
};

export type EntradaDelMapa = {
  seccion: string;
  grupo: string | null;
  /** Casa con el principio del bullet (o del párrafo). Debe casar con UNO. */
  empiezaPor: RegExp;
} & ({ ignorar: string } | { destino: Destino });

/** Los bullets (y párrafos) de PRODUCT.md que se leen. */
export const MAPA_DE_PRODUCT: readonly EntradaDelMapa[] = [
  // ── Capacidades confirmadas ──
  {
    seccion: SECCION_CAPACIDADES,
    grupo: GRUPO_CAPACIDADES,
    empiezaPor: /^Recepcionista de cada negocio con tono/,
    destino: {
      tipo: "funcion",
      clave: "funcion.configuracion_de_la_recepcionista",
      huella: "d58c0685f012",
      texto:
        "Cada negocio configura el tono de su recepcionista (cálido, profesional o directo), su objetivo (reservar citas, atención al cliente o captar contactos), el estilo de respuesta (conciso o equilibrado) y cómo escala lo que no puede resolver (tomar un recado o pedir una llamada de vuelta).",
    },
  },
  {
    seccion: SECCION_CAPACIDADES,
    grupo: GRUPO_CAPACIDADES,
    empiezaPor: /^Idioma principal y voz del agente/,
    ignorar:
      "Lo dicen funcion.idiomas y funcion.elegir_voz (plans.ts); el bullet trae latencias, voces concretas y detalle interno.",
  },
  {
    seccion: SECCION_CAPACIDADES,
    grupo: GRUPO_CAPACIDADES,
    empiezaPor: /^Número de España/,
    destino: {
      tipo: "funcion",
      clave: "funcion.numero_de_espana",
      huella: "6a1e04c13821",
      // El bullet nombra al proveedor entre paréntesis: no se dice.
      texto: "Número de España aprovisionado automáticamente tras el checkout.",
    },
  },
  {
    seccion: SECCION_CAPACIDADES,
    grupo: GRUPO_CAPACIDADES,
    empiezaPor: /^Registro de llamadas/,
    destino: {
      tipo: "funcion",
      clave: "funcion.registro_de_llamadas",
      huella: "ff70217d7913",
      // La grabación es opcional: solo se hace si quien llama lo permite
      // (PRODUCT.md, Operating Context: «solo si el cliente la permite»; la
      // recepcionista se lo pregunta y guarda su permiso).
      texto:
        "Registro de llamadas con transcripción, grabación (si quien llama lo permite) y clasificación de resultado.",
    },
  },
  {
    seccion: SECCION_CAPACIDADES,
    grupo: GRUPO_CAPACIDADES,
    empiezaPor: /^Horario de negocio/,
    destino: {
      tipo: "funcion",
      clave: "funcion.horario_servicios_y_equipo",
      huella: "f6e3c86f9185",
      texto:
        "Horario de negocio, catálogo de servicios, profesionales y capacidad de reserva.",
    },
  },
  {
    seccion: SECCION_CAPACIDADES,
    grupo: GRUPO_CAPACIDADES,
    empiezaPor: /^Integración de calendario/,
    ignorar:
      "Lo dice funcion.calendarios (plans.ts); el bullet habla del protocolo de iCloud y de caducidad de credenciales.",
  },
  {
    seccion: SECCION_CAPACIDADES,
    grupo: GRUPO_CAPACIDADES,
    empiezaPor: /^Reparto de citas por especialidad/,
    destino: {
      tipo: "funcion",
      clave: "funcion.reparto_por_especialidad",
      huella: "3134b1bac81a",
      texto:
        "Reparto de citas por especialidad: cada profesional tiene un nivel por servicio (especialista, lo hace o no sugerir) que la recepcionista usa para recomendar una vez, sin descartar al resto.",
    },
  },
  {
    seccion: SECCION_CAPACIDADES,
    grupo: GRUPO_CAPACIDADES,
    empiezaPor: /^Tu asistente:/,
    destino: {
      tipo: "funcion",
      clave: "funcion.asistente_por_whatsapp",
      huella: "1e243e91e281",
      texto:
        "Tu asistente por WhatsApp: el dueño administra servicios y precios, horario, cierres de un día, tramos bloqueados, profesionales, ausencias de una persona del equipo y reservas (añadir, mover, cancelar), y le pregunta por la agenda y las llamadas. Propone y el dueño confirma: nunca ejecuta nada sin que pulse «Confirmar». Está en todos los planes.",
    },
  },
  {
    seccion: SECCION_CAPACIDADES,
    grupo: GRUPO_CAPACIDADES,
    empiezaPor: /^Confirmación y recordatorio de cita/,
    ignorar:
      "Dice que el recordatorio es de todos los planes, y plans.ts y planFeatures.ts lo limitan a Pro y Scale; la confirmación la dice funcion.confirmacion_por_whatsapp y la lista de espera no se emite (pendiente de decidir).",
  },
  {
    seccion: SECCION_CAPACIDADES,
    grupo: GRUPO_CAPACIDADES,
    empiezaPor: /^Número de teléfono principal/,
    ignorar: "Un ajuste interno, no un argumento.",
  },
  {
    seccion: SECCION_CAPACIDADES,
    grupo: GRUPO_CAPACIDADES,
    empiezaPor: /^Facturación:/,
    ignorar: "Un ajuste interno, no un argumento.",
  },

  // ── Terminología (se lee aparte, para la lista de términos que no se dicen) ──
  {
    seccion: SECCION_CAPACIDADES,
    grupo: GRUPO_TERMINOLOGIA,
    empiezaPor: /^Se dice «recepcionista»/,
    ignorar:
      "Es la lista de términos: la lee reglasProhibidas.ts para comprobar que afirmaciones-prohibidas.md los cubre todos.",
  },

  // ── Restricciones duras ──
  {
    seccion: SECCION_CAPACIDADES,
    grupo: GRUPO_RESTRICCIONES,
    empiezaPor: /^Idioma del agente/,
    ignorar: "Identificadores de código (idioma y zona horaria por defecto).",
  },
  {
    seccion: SECCION_CAPACIDADES,
    grupo: GRUPO_RESTRICCIONES,
    empiezaPor: /^Sin roles ni acceso multiusuario/,
    destino: {
      tipo: "limite",
      clave: "limite.sin_multiusuario",
      huella: "9da9ffee13b7",
      texto: "Sin roles ni acceso multiusuario por negocio.",
      // Además, PRODUCT.md dice que no hay decisión tomada (ver la entrada de abajo).
      valor: { estado: "sin_decidir" },
    },
  },
  {
    seccion: SECCION_CAPACIDADES,
    grupo: GRUPO_RESTRICCIONES,
    empiezaPor: /^Duración de servicios/,
    destino: {
      tipo: "limite",
      clave: "limite.duracion_y_capacidad",
      huella: "9f7d74f49016",
      // El tope de profesionales va en limite.plan.<plan>.profesionales.
      texto:
        "La duración de los servicios va de 5 a 480 minutos y la capacidad de reserva, de 1 a 50.",
    },
  },
  {
    seccion: SECCION_CAPACIDADES,
    grupo: GRUPO_RESTRICCIONES,
    empiezaPor: /^Horario: 7 días/,
    destino: {
      tipo: "limite",
      clave: "limite.horario_maximo_tres_intervalos",
      huella: "a3442685fcbe",
      texto:
        "El horario cubre los 7 días de la semana, con un máximo de 3 intervalos que no se solapen por día.",
    },
  },
  {
    seccion: SECCION_CAPACIDADES,
    grupo: GRUPO_RESTRICCIONES,
    empiezaPor: /^La completitud del onboarding/,
    ignorar: "Detalle interno del alta.",
  },
  {
    seccion: SECCION_CAPACIDADES,
    grupo: GRUPO_RESTRICCIONES,
    empiezaPor: /^La demo de voz necesita/,
    destino: {
      tipo: "limite",
      clave: "limite.demo_requiere_microfono",
      huella: "e1d11d311d9b",
      texto:
        "La demo de voz necesita un navegador moderno y permiso de micrófono; no hay alternativa sin audio.",
    },
  },

  // ── Decisiones abiertas ──
  {
    seccion: SECCION_CAPACIDADES,
    grupo: GRUPO_DECISIONES_ABIERTAS,
    empiezaPor: /^No hay objetivos numéricos de rendimiento/,
    destino: {
      tipo: "limite",
      clave: "limite.sin_objetivos_de_rendimiento",
      huella: "bc14f7f6f446",
      texto:
        "No hay objetivos numéricos de rendimiento ni una lista de navegadores soportados definidos.",
      valor: { estado: "sin_decidir" },
    },
  },
  {
    seccion: SECCION_CAPACIDADES,
    grupo: GRUPO_DECISIONES_ABIERTAS,
    empiezaPor: /^No hay decisión sobre multiusuario/,
    ignorar:
      "Se funde con limite.sin_multiusuario (valor.estado = sin_decidir): si este bullet desaparece hay que revisar esa entrada.",
  },

  // ── Compromisos de marca ──
  ...[
    "Nombre",
    "Idioma",
    "Registro",
    "Concreto sobre abstracto",
    "Enfocado al dolor",
    "IA sin complejos",
    "Vender enseñando",
    "Errores",
    "Estética comprometida",
  ].map((etiqueta): EntradaDelMapa => ({
    seccion: SECCION_MARCA,
    grupo: null,
    empiezaPor: new RegExp(`^\\*\\*${etiqueta}`),
    ignorar:
      "Compromiso de estilo de la marca (voz-de-marca.md), no una afirmación sobre el producto.",
  })),
  {
    seccion: SECCION_MARCA,
    grupo: null,
    empiezaPor: /^\*\*Voz del agente telefónico/,
    destino: {
      tipo: "funcion",
      clave: "funcion.aviso_de_ia",
      huella: "e4e45ac2f303",
      texto:
        "La recepcionista avisa de que es una inteligencia artificial al empezar la llamada, y ese aviso (artículo 50 del Reglamento de IA) no se puede quitar.",
    },
  },

  // ── Evidencia ──
  {
    seccion: SECCION_EVIDENCIA,
    grupo: GRUPO_EXISTE,
    empiezaPor: /^Más de quince estadísticas de sector/,
    destino: {
      tipo: "limite",
      clave: "limite.estadisticas_de_sector_no_son_de_alhabla",
      huella: "2aea1ef6130f",
      texto:
        "Las estadísticas de sector que se citan hablan del problema, no de Alhabla: no son testimonios de clientes y no deben presentarse como tales.",
    },
  },
  {
    seccion: SECCION_EVIDENCIA,
    grupo: GRUPO_EXISTE,
    empiezaPor: /^Producto funcional y demostrable/,
    destino: {
      tipo: "funcion",
      clave: "funcion.demo_de_voz",
      huella: "8908da64696c",
      texto:
        "Hay una demo de voz pública en el navegador para probar la recepcionista.",
    },
  },
  {
    seccion: SECCION_EVIDENCIA,
    grupo: GRUPO_AUSENCIAS,
    empiezaPor: /^Alhabla está en \*\*prelanzamiento/,
    destino: {
      tipo: "limite",
      clave: "limite.prelanzamiento",
      huella: "f05ad767f1f4",
      texto: "Alhabla está en prelanzamiento: todavía no hay clientes de pago.",
    },
  },
  {
    seccion: SECCION_EVIDENCIA,
    grupo: GRUPO_AUSENCIAS,
    empiezaPor: /^testimonios ni casos de éxito/,
    destino: {
      tipo: "limite",
      clave: "limite.sin_prueba_social.testimonios",
      huella: "2086c0bb4358",
      texto: "No existen testimonios ni casos de éxito de clientes de Alhabla.",
    },
  },
  {
    seccion: SECCION_EVIDENCIA,
    grupo: GRUPO_AUSENCIAS,
    empiezaPor: /^logos de clientes/,
    destino: {
      tipo: "limite",
      clave: "limite.sin_prueba_social.clientes",
      huella: "f48a5bf6438d",
      texto:
        "No existen logos de clientes ni recuentos del tipo «X negocios ya confían».",
    },
  },
  {
    seccion: SECCION_EVIDENCIA,
    grupo: GRUPO_AUSENCIAS,
    empiezaPor: /^métricas propias del producto/,
    destino: {
      tipo: "limite",
      clave: "limite.sin_prueba_social.metricas",
      huella: "a38fe712efe3",
      texto:
        "No existen métricas propias del producto (llamadas gestionadas, citas recuperadas, tasa de acierto, valoraciones).",
    },
  },
  {
    seccion: SECCION_EVIDENCIA,
    grupo: GRUPO_AUSENCIAS,
    empiezaPor: /^premios, apariciones en prensa/,
    destino: {
      tipo: "limite",
      clave: "limite.sin_prueba_social.premios_y_prensa",
      huella: "abc772f1facd",
      texto:
        "No existen premios, apariciones en prensa sobre Alhabla ni cifras de facturación.",
    },
  },
  {
    seccion: SECCION_EVIDENCIA,
    grupo: GRUPO_AUSENCIAS,
    empiezaPor: /^Toda cifra publicada debe llevar una fuente/,
    ignorar:
      "Es una consigna para quien redacta (voz-de-marca.md), no un hecho sobre el producto.",
  },
];

/**
 * Limitaciones que viven DENTRO de un bullet de capacidades como una frase.
 * Si la frase deja de estar en el bullet (el límite ya no existe), la
 * afirmación no se emite y la sincronización la cierra: es lo correcto, y el
 * `--dry-run` lo muestra antes de aplicar.
 */
export const FRASES_DECLARADAS: readonly {
  /** El bullet que la contiene (casa con su principio). */
  dentroDe: RegExp;
  grupo: string;
  frase: RegExp;
  destino: Destino & { tipo: "limite" };
}[] = [
  {
    dentroDe: /^Tu asistente:/,
    grupo: GRUPO_CAPACIDADES,
    frase: /Reabrir un día ya cerrado no está aún en WhatsApp/,
    destino: {
      tipo: "limite",
      clave: "limite.asistente.reabrir_dia_cerrado",
      huella: "400be2c28a58",
      texto:
        "Reabrir un día que ya se cerró todavía no se puede hacer por WhatsApp: requiere el panel.",
    },
  },
];

// ── plans.ts y planFeatures.ts ─────────────────────────────────────────────

/**
 * Cada texto de `features` de un plan de plans.ts tiene que estar aquí: o
 * da una afirmación, o se ignora con motivo. Un texto nuevo en la web hace
 * fallar la extracción.
 */
export type EntradaDeFeatureDePlan = {
  plan: "inicio" | "pro" | "scale";
  empiezaPor: RegExp;
} & (
  | { ignorar: string }
  | {
      /** Afirmación para todos los planes (el texto de plans.ts tal cual). */
      clave: string;
    }
  | {
      /** Una función de planFeatures.ts: el plan sale de PLAN_FEATURES. */
      feature: string;
      clave: string;
    }
);

export const MAPA_DE_FEATURES_DE_PLANES: readonly EntradaDeFeatureDePlan[] = [
  {
    plan: "inicio",
    empiezaPor: /^Contesta tus llamadas a cualquier hora/,
    clave: "funcion.atiende_a_cualquier_hora",
  },
  {
    plan: "inicio",
    empiezaPor: /^Habla español y/,
    clave: "funcion.idiomas",
  },
  {
    plan: "inicio",
    empiezaPor: /^Reservas en tu calendario/,
    clave: "funcion.calendarios",
  },
  {
    plan: "inicio",
    empiezaPor: /^Tu asistente por WhatsApp/,
    ignorar:
      "Lo dice funcion.asistente_por_whatsapp (PRODUCT.md), con su límite.",
  },
  {
    plan: "inicio",
    empiezaPor: /^Hasta \d+ profesionales/,
    ignorar:
      "Lo dice limite.plan.<plan>.profesionales, que sale de planFeatures.ts y se contrasta con este texto.",
  },
  {
    plan: "inicio",
    empiezaPor: /^Confirmación de cita por WhatsApp/,
    clave: "funcion.confirmacion_por_whatsapp",
  },
  {
    plan: "inicio",
    empiezaPor: /^[\d.]+ minutos de llamadas incluidos/,
    ignorar: "Lo dice precio.plan.<plan>.",
  },
  {
    plan: "pro",
    empiezaPor: /^Todo lo de Inicio/,
    ignorar: "Remite al plan anterior.",
  },
  {
    plan: "pro",
    empiezaPor: /^Hasta \d+ profesionales/,
    ignorar: "Lo dice limite.plan.<plan>.profesionales.",
  },
  {
    plan: "pro",
    empiezaPor: /^Recordatorios de cita/,
    feature: "recordatorios_cita",
    clave: "funcion.recordatorios_cita",
  },
  {
    plan: "pro",
    empiezaPor: /^Resumen semanal/,
    feature: "resumen_semanal",
    clave: "funcion.resumen_semanal",
  },
  {
    plan: "pro",
    empiezaPor: /^Elige entre todas las voces/,
    feature: "elegir_voz",
    clave: "funcion.elegir_voz",
  },
  {
    plan: "pro",
    empiezaPor: /^[\d.]+ minutos de llamadas incluidos/,
    ignorar: "Lo dice precio.plan.<plan>.",
  },
  {
    plan: "scale",
    empiezaPor: /^Todo lo de Pro/,
    ignorar: "Remite al plan anterior.",
  },
  {
    plan: "scale",
    empiezaPor: /^Profesionales sin límite/,
    ignorar: "Lo dice limite.plan.<plan>.profesionales.",
  },
  {
    plan: "scale",
    empiezaPor: /^Analítica avanzada/,
    feature: "analitica_avanzada",
    clave: "funcion.analitica_avanzada",
  },
  {
    plan: "scale",
    empiezaPor: /^[\d.]+ minutos de llamadas incluidos/,
    ignorar: "Lo dice precio.plan.<plan>.",
  },
];

/**
 * Funciones de PLAN_FEATURES que NO se afirman. `multi_sede` figura en la tabla
 * de Scale pero ningún código la usa y la web dice que no promete un panel
 * multi-sede (web/src/app/contacto): afirmarlo sería prometer lo que no hay.
 */
export const FEATURES_EXCLUIDAS: Record<string, string> = {
  multi_sede:
    "Está en PLAN_FEATURES.scale sin copy en plans.ts ni código que la use; la web no promete panel multi-sede.",
};

/**
 * Competidores que NO salen de comparativas.ts pero que la regla dura 3
 * (`comparativa_con_fuente`) debe conocer: HeyDiga y fonio son los
 * competidores españoles de producto que nombra PRODUCT.md y desde el
 * 29-10-2026 la web no se compara con ellos, así que no tienen
 * `comparativa.*`. Sembrados en `growth_competidores`, cualquier borrador que
 * los nombre se bloquea mientras no cite un dato verificable de cada uno
 * (art. 10 Ley 3/1991); afirmaciones-prohibidas.md los da por existentes.
 *
 * PENDIENTE DE CONFIRMAR POR EL FUNDADOR: que esta lista sea esa y no otra.
 * Solo se dan de alta (nunca se tocan ni se borran los que ya hay).
 */
export const COMPETIDORES_ADICIONALES: readonly {
  nombre: string;
  dominio: string;
}[] = [
  { nombre: "HeyDiga", dominio: "heydiga.ai" },
  { nombre: "fonio", dominio: "fonio.ai" },
];

/** Cómo se nombra cada función cuando un plan NO la incluye. */
export const SINTAGMA_DE_FEATURE: Record<string, string> = {
  recordatorios_cita: "recordatorios de cita por WhatsApp",
  resumen_semanal: "el resumen semanal por email",
  elegir_voz: "elegir entre todas las voces de la recepcionista",
  analitica_avanzada: "la analítica avanzada",
};

/** Cómo llama la web a cada plan. */
export const NOMBRE_DE_PLAN: Record<string, string> = {
  inicio: "Inicio",
  pro: "Pro",
  scale: "Scale",
};
