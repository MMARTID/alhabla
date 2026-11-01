/**
 * Los tipos de la API de administración de Growth (`/growth/admin/*`), tal
 * como los fija el contrato de la Fase 1b. Las fechas llegan como cadenas ISO.
 * Un cambio aquí es un cambio de contrato: se hace a la vez en el backend.
 */

// ---------------------------------------------------------------------------
// Vocabulario
// ---------------------------------------------------------------------------

export const OBJETIVOS = ["TRAFICO_MARCA", "LEADS", "BACKLINKS"] as const;
export type Objetivo = (typeof OBJETIVOS)[number];

export const ESTADOS_DE_OPORTUNIDAD = [
  "detectada",
  "calificada",
  "investigada",
  "con_borrador",
  "pendiente_aprobacion",
  "aprobada",
  "gestionada",
  "conseguida",
  "sin_respuesta",
  "devuelta",
  "bloqueada",
  "descartada",
  "caducada",
] as const;
export type EstadoDeOportunidad = (typeof ESTADOS_DE_OPORTUNIDAD)[number];

export const ESTADOS_DE_BORRADOR = [
  "borrador",
  "bloqueado",
  "pendiente_aprobacion",
  "aprobado",
  "gestionado",
  "descartado",
] as const;
export type EstadoDeBorrador = (typeof ESTADOS_DE_BORRADOR)[number];

export const TIPOS_DE_BORRADOR = [
  "email",
  "formulario",
  "ficha_directorio",
  "texto_invitado",
] as const;
export type TipoDeBorrador = (typeof TIPOS_DE_BORRADOR)[number];

export type Resultado = "pasa" | "aviso" | "bloquea";

export type Comprobacion = {
  regla: string;
  ok: boolean;
  /** Dura = bloquea; blanda = avisa. */
  dura: boolean;
  detalle: string;
};

export const CODIGOS_DE_DESCARTE = [
  "no_viva",
  "idioma",
  "irrelevante",
  "competidor",
  "dominio_propio",
  "baja_calidad",
  "contenido_ilegal",
  "duplicada",
  "bajo_umbral",
  "dominio_en_enfriamiento",
  "manual",
  "otro",
] as const;
export type CodigoDescarte = (typeof CODIGOS_DE_DESCARTE)[number];

export const TIPOS_DE_AFIRMACION = [
  "precio",
  "funcion",
  "limite",
  "sector",
  "comparativa",
  "pagina",
  "prohibida",
] as const;
export type TipoDeAfirmacion = (typeof TIPOS_DE_AFIRMACION)[number];

export const TIPOS_DE_DESTINO = [
  "comparativa",
  "directorio",
  "prensa",
  "asociacion",
  "mencion_sin_enlace",
  "otro",
] as const;
export type TipoDeDestino = (typeof TIPOS_DE_DESTINO)[number];

export type EnlaceEsperado =
  "dofollow" | "nofollow" | "ugc" | "sponsored" | "desconocido";

export type Dificultad = "baja" | "media" | "alta";

/** Lo que pueden escribir el agente y el administrador en `datos`. */
export type DatosDeOportunidad = {
  tipoDestino?: TipoDeDestino;
  enlaceEsperado?: EnlaceEsperado;
  dificultad?: Dificultad;
  /** Hasta 500 caracteres. */
  nota?: string;
  /**
   * Dominios de los competidores que la página menciona o lista (por ejemplo,
   * un «mejores recepcionistas de IA» que cita a uno). Los normaliza el
   * backend y solo admite competidores que no sean `propuesto`.
   */
  competidoresMencionados?: string[];
};

export type FuenteTipo = "web" | "directorio" | "manual";

export type Canal = "email" | "formulario" | "alta_directorio" | "otro";
export const CANALES: readonly Canal[] = [
  "email",
  "formulario",
  "alta_directorio",
  "otro",
];

export type ResultadoDeGestion =
  "pendiente" | "aceptado" | "rechazado" | "sin_respuesta";

// ---------------------------------------------------------------------------
// Forma común de las listas
// ---------------------------------------------------------------------------

/** Página con total (no cursor): un solo usuario y volúmenes pequeños. */
export type Pagina<T> = {
  data: T[];
  total: number;
  pagina: number;
  limite: number;
};

/** Fotografía de la última sincronización de conocimiento. */
export type Snapshot = {
  commitSha: string;
  sincronizadoEn: string;
  antiguedadHoras: number;
  /** Más de 8 días sin sincronizar. */
  obsoleto: boolean;
  vigentes: number;
  porTipo: Record<TipoDeAfirmacion, number>;
} | null;

// ---------------------------------------------------------------------------
// Sesión
// ---------------------------------------------------------------------------

/** GET /growth/admin/yo */
export type Yo = { email: string };

// ---------------------------------------------------------------------------
// Resumen
// ---------------------------------------------------------------------------

export type EstadoDeEjecucion = "en_curso" | "ok" | "parcial" | "error";
export type DisparadorDeEjecucion = "programada" | "manual";

/** GET /growth/admin/resumen */
export type Resumen = {
  pausa: boolean;
  /** Los ajustes vigentes (los mismos de `GET /ajustes › valores`). */
  ajustes: ValoresDeAjustes;
  porEstado: Record<EstadoDeOportunidad, number>;
  /** Oportunidades en `pendiente_aprobacion`. */
  paraRevisar: number;
  /** Oportunidades en `aprobada`. */
  aprobadasSinGestionar: number;
  bloqueadas: number;
  devueltas: number;
  /** Aprobadas o pendientes que caducan en 7 días (máximo 5). */
  porCaducar: Array<{
    id: string;
    titulo: string;
    dominio: string;
    estado: EstadoDeOportunidad;
    expiraEn: string;
    diasParaCaducar: number;
  }>;
  contactos: {
    /** Gestiones hechas en los últimos 7 días más `aprobadasSinGestionar`. */
    estaSemana: number;
    /** Solo las gestiones ya hechas esta semana. */
    hechas: number;
    aprobadasSinGestionar: number;
    tope: number;
  };
  descartesUltimos7Dias: {
    total: number;
    porMotivo: Array<{ codigo: string; n: number }>;
  };
  ultimaEjecucion: {
    id: string;
    disparador: DisparadorDeEjecucion;
    estado: EstadoDeEjecucion;
    inicio: string;
    fin: string | null;
  } | null;
  conocimiento: Snapshot;
  tokens: { activos: number; ultimoUso: string | null };
};

// ---------------------------------------------------------------------------
// Oportunidades
// ---------------------------------------------------------------------------

export type Puntuaciones = Record<Objetivo, number>;

export type BorradorActual = {
  id: string;
  version: number;
  tipo: TipoDeBorrador;
  estado: EstadoDeBorrador;
  editadoPorHumano: boolean;
  resultado: Resultado | null;
  reglasFallidas: Comprobacion[];
};

export type OportunidadResumen = {
  id: string;
  url: string;
  dominio: string;
  titulo: string;
  extracto: string;
  /** El extracto está vacío porque la retención lo purgó. */
  extractoPurgado: boolean;
  idioma: string;
  objetivoPrincipal: Objetivo;
  estado: EstadoDeOportunidad;
  /** La del objetivo principal. */
  puntuacion: number;
  puntuaciones: Puntuaciones;
  datos: DatosDeOportunidad | null;
  detectadaEn: string;
  expiraEn: string | null;
  diasParaCaducar: number | null;
  motivoDescarte: string | null;
  codigoDescarte: CodigoDescarte | null;
  ejecucionId: string | null;
  fuente: { id: string; tipo: FuenteTipo; nombre: string };
  nicho: { id: string; slug: string; nombre: string } | null;
  borradorActual: BorradorActual | null;
};

export type OrdenDeOportunidades = "puntuacion" | "recientes" | "caducan";

/** Filtros de GET /growth/admin/oportunidades. */
export type FiltrosDeOportunidades = {
  /** Se manda como lista separada por comas. */
  estado?: readonly EstadoDeOportunidad[];
  objetivo?: Objetivo;
  /** Slug del nicho. */
  nicho?: string;
  tipoDestino?: TipoDeDestino;
  fuente?: FuenteTipo;
  ejecucionId?: string;
  dominio?: string;
  /** Dominio de un competidor: solo las oportunidades que lo mencionan. */
  menciona?: string;
  /** De 1 a 100 caracteres: título, dominio y URL. */
  q?: string;
  orden?: OrdenDeOportunidades;
  pagina?: number;
  limite?: number;
};

export type ListaDeOportunidades = Pagina<OportunidadResumen> & {
  /** Con los mismos filtros salvo `estado`, para las pestañas. */
  conteos: { porEstado: Record<EstadoDeOportunidad, number> };
};

/** Cuerpo de POST /growth/admin/oportunidades (Añadir URL). */
export type NuevaUrl = {
  url: string;
  /** Por defecto BACKLINKS. */
  objetivoPrincipal?: Objetivo;
  titulo?: string;
  nota?: string;
  nichoSlug?: string;
  expiraEn?: string;
};

export type RespuestaDeNuevaUrl =
  | { creada: true; id: string; estado: "detectada" }
  | {
      creada: false;
      id: string;
      estado: EstadoDeOportunidad;
      motivoDescarte: string | null;
    };

// ---------------------------------------------------------------------------
// Detalle de una oportunidad (Revisión)
// ---------------------------------------------------------------------------

export type AfirmacionDetallada = {
  clave: string;
  /** La clave existe en la base de conocimiento. */
  existe: boolean;
  tipo: TipoDeAfirmacion | null;
  texto: string | null;
  valor: unknown;
  fuente: string | null;
  commitSha: string | null;
  /** Sigue vigente (sin `vigenteHasta`). */
  vigente: boolean;
  vigenteDesde: string | null;
  vigenteHasta: string | null;
};

export type Revision = {
  id: string;
  borradorId: string;
  resultado: Resultado;
  comprobaciones: Comprobacion[];
  /** `reglas` = el motor determinista; `llm` = revisión consultiva. */
  revisor: "reglas" | "llm";
  creadaEn: string;
};

export type Gestion = {
  id: string;
  borradorId: string;
  canal: Canal;
  dominio: string;
  hechaEn: string;
  respuestaEn: string | null;
  resultado: ResultadoDeGestion;
  urlConseguida: string | null;
  notas: string | null;
};

export type BorradorDetallado = {
  id: string;
  oportunidadId: string;
  version: number;
  tipo: TipoDeBorrador;
  objetivo: Objetivo;
  asunto: string | null;
  texto: string;
  enlaceUrl: string | null;
  utm: Record<string, unknown> | null;
  afirmaciones: string[];
  estado: EstadoDeBorrador;
  textoFinal: string | null;
  editadoPorHumano: boolean;
  creadoEn: string;
  afirmacionesDetalle: AfirmacionDetallada[];
  /** De 0 a 1; null si es la primera versión. */
  similitudConVersionAnterior: number | null;
  /** La más reciente primero. */
  revisiones: Revision[];
  gestion: Gestion | null;
};

export type ViaDeContacto =
  "formulario" | "email_editorial" | "alta_directorio";

export type Investigacion = {
  oportunidadId: string;
  resumen: string;
  quienEdita: string | null;
  viaDeContacto: ViaDeContacto | null;
  competidoresEnlazados: string[] | null;
  /** En la 1b solo se guarda `urlContacto` (URL http/https). */
  contexto: ({ urlContacto?: string } & Record<string, unknown>) | null;
  creadaEn: string;
};

export type RegistroDeDecision = {
  id: string;
  borradorId: string | null;
  accion: string;
  motivo: string | null;
  /** Correo del administrador, `agente:<token>` o `sistema`. */
  por: string;
  en: string;
};

export type AccionDeDecision =
  | "aprobar"
  | "devolver"
  | "descartar"
  | "marcar_gestionado"
  | "conseguido"
  | "sin_respuesta"
  | "rechazado";

/**
 * Una acción que la Revisión ofrece desde el estado actual. El backend manda
 * SOLO las alcanzables desde ese estado (un estado final manda una lista
 * vacía). `habilitada: false` significa que lo impide una regla (aprobar con
 * una regla dura fallida, marcar como gestionado sin borrador aprobado…) y
 * entonces `motivo` dice por qué, en español.
 */
export type AccionDisponible = {
  accion: AccionDeDecision;
  habilitada: boolean;
  /** Por qué no está habilitada. */
  motivo?: string;
};

/** GET /growth/admin/oportunidades/:id */
export type DetalleDeOportunidad = {
  // Columnas de GrowthOportunidad.
  id: string;
  claveExterna: string;
  fuenteId: string;
  nichoId: string | null;
  url: string;
  dominio: string;
  titulo: string;
  extracto: string;
  idioma: string;
  detectadaEn: string;
  objetivoPrincipal: Objetivo;
  puntTrafico: number;
  puntLeads: number;
  puntBacklinks: number;
  estado: EstadoDeOportunidad;
  motivoDescarte: string | null;
  /** Sin `codigoDescarte`: el código va aparte, en `codigoDescarte`. */
  datos: DatosDeOportunidad | null;
  /** Por qué se descartó, si se descartó (no viene dentro de `datos`). */
  codigoDescarte: CodigoDescarte | null;
  expiraEn: string | null;
  retencionHasta: string;
  ejecucionId: string | null;
  // Calculados.
  puntuacion: number;
  puntuaciones: Puntuaciones;
  extractoPurgado: boolean;
  diasParaCaducar: number | null;
  fuente: { id: string; tipo: FuenteTipo; nombre: string };
  nicho: { id: string; slug: string; nombre: string } | null;
  ejecucion: {
    id: string;
    disparador: DisparadorDeEjecucion;
    estado: EstadoDeEjecucion;
    inicio: string;
  } | null;
  investigacion: Investigacion | null;
  /** La versión más reciente primero. */
  borradores: BorradorDetallado[];
  /** La más reciente primero. */
  decisiones: RegistroDeDecision[];
  /** Borrador que se puede editar ahora, si lo hay. */
  borradorEditableId: string | null;
  /** Solo las alcanzables desde el estado actual (ver `AccionDisponible`). */
  acciones: AccionDisponible[];
  contacto: {
    dominioEnEnfriamientoHasta: string | null;
    contactosEstaSemana: number;
    topeSemanal: number;
  };
};

/** Cuerpo de POST /growth/admin/oportunidades/:id/decision. */
export type Decision =
  | { accion: "aprobar"; borradorId: string }
  | { accion: "devolver"; motivo: string }
  | { accion: "descartar"; motivo: string; codigo?: CodigoDescarte }
  | {
      accion: "marcar_gestionado";
      canal: Canal;
      /** Entre hoy - 30 días y ahora + 5 min. */
      hechaEn?: string;
      notas?: string;
      /** Lo que de verdad enviaste, si difiere del texto aprobado. */
      textoFinal?: string;
    }
  | { accion: "conseguido"; urlConseguida: string }
  | { accion: "sin_respuesta"; notas?: string }
  /** Que el destino diga que no: la oportunidad pasa a `sin_respuesta`. */
  | { accion: "rechazado"; notas?: string };

export type RespuestaDeDecision = { id: string; estado: EstadoDeOportunidad };

// ---------------------------------------------------------------------------
// Borradores
// ---------------------------------------------------------------------------

export const GRUPOS_DE_BORRADORES = [
  "bloqueados",
  "pendientes",
  "aprobados",
  "gestionados",
  "caducados",
  "descartados",
] as const;
export type GrupoDeBorradores = (typeof GRUPOS_DE_BORRADORES)[number];

export type FiltrosDeBorradores = {
  /** Por defecto `pendientes`. */
  grupo?: GrupoDeBorradores;
  objetivo?: Objetivo;
  tipo?: TipoDeBorrador;
  q?: string;
  orden?: "recientes" | "caducan";
  pagina?: number;
  limite?: number;
};

export type BorradorResumen = {
  id: string;
  oportunidadId: string;
  version: number;
  tipo: TipoDeBorrador;
  objetivo: Objetivo;
  asunto: string | null;
  /** Los primeros 200 caracteres. */
  textoPreview: string;
  longitud: number;
  enlaceUrl: string | null;
  afirmaciones: string[];
  estado: EstadoDeBorrador;
  editadoPorHumano: boolean;
  creadoEn: string;
  resultado: Resultado | null;
  /** Las comprobaciones que fallan en la última revisión. */
  reglasFallidas: Comprobacion[];
  oportunidad: {
    id: string;
    titulo: string;
    dominio: string;
    url: string;
    estado: EstadoDeOportunidad;
    objetivoPrincipal: Objetivo;
    expiraEn: string | null;
    diasParaCaducar: number | null;
  };
  gestion: {
    canal: Canal;
    hechaEn: string;
    resultado: ResultadoDeGestion;
  } | null;
};

export type ListaDeBorradores = Pagina<BorradorResumen> & {
  conteos: Record<GrupoDeBorradores, number>;
};

/** GET /growth/admin/borradores/:id */
export type DetalleDeBorrador = BorradorDetallado & {
  oportunidad: {
    id: string;
    titulo: string;
    dominio: string;
    url: string;
    estado: EstadoDeOportunidad;
    objetivoPrincipal: Objetivo;
    expiraEn: string | null;
  };
  /** Bloqueado o pendiente, última versión y oportunidad en esos estados. */
  esEditable: boolean;
};

/** Cuerpo de PATCH /growth/admin/borradores/:id (al menos un campo). */
export type EdicionDeBorrador = {
  asunto?: string | null;
  texto?: string;
  enlaceUrl?: string | null;
  afirmaciones?: string[];
  nota?: string;
};

export type RespuestaDeEdicion = {
  borrador: Pick<
    BorradorDetallado,
    | "id"
    | "oportunidadId"
    | "version"
    | "tipo"
    | "objetivo"
    | "asunto"
    | "texto"
    | "enlaceUrl"
    | "utm"
    | "afirmaciones"
    | "estado"
    | "textoFinal"
    | "editadoPorHumano"
    | "creadoEn"
  >;
  resultado: Resultado;
  comprobaciones: Comprobacion[];
  oportunidad: { id: string; estado: EstadoDeOportunidad };
};

// ---------------------------------------------------------------------------
// Historial: decisiones y gestiones
// ---------------------------------------------------------------------------

export type FiltrosDeDecisiones = {
  accion?: string;
  oportunidadId?: string;
  borradorId?: string;
  por?: string;
  /** Decisiones sin oportunidad: ajustes, sincronizaciones, nichos. */
  soloSistema?: boolean;
  fechaDesde?: string;
  fechaHasta?: string;
  pagina?: number;
  limite?: number;
};

export type DecisionDelHistorial = {
  id: string;
  accion: string;
  motivo: string | null;
  por: string;
  en: string;
  oportunidad: {
    id: string;
    titulo: string;
    dominio: string;
    url: string;
    estado: EstadoDeOportunidad;
  } | null;
  borrador: { id: string; version: number; tipo: TipoDeBorrador } | null;
};

export type ListaDeDecisiones = Pagina<DecisionDelHistorial> & {
  conteos: { porAccion: Record<string, number> };
};

export type FiltrosDeGestiones = {
  resultado?: ResultadoDeGestion;
  canal?: Canal;
  dominio?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  pagina?: number;
  limite?: number;
};

export type GestionDelHistorial = {
  id: string;
  canal: Canal;
  dominio: string;
  hechaEn: string;
  respuestaEn: string | null;
  resultado: ResultadoDeGestion;
  urlConseguida: string | null;
  notas: string | null;
  borrador: {
    id: string;
    version: number;
    tipo: TipoDeBorrador;
    asunto: string | null;
    textoFinal: string | null;
    editadoPorHumano: boolean;
  };
  oportunidad: {
    id: string;
    titulo: string;
    url: string;
    estado: EstadoDeOportunidad;
    objetivoPrincipal: Objetivo;
  };
};

export type ListaDeGestiones = Pagina<GestionDelHistorial> & {
  conteos: { porResultado: Record<string, number> };
};

// ---------------------------------------------------------------------------
// Conocimiento
// ---------------------------------------------------------------------------

/** Una afirmación vigente de la base de conocimiento. */
export type Afirmacion = {
  id: string;
  clave: string;
  tipo: TipoDeAfirmacion;
  texto: string;
  valor: unknown;
  /** `ruta#ancla`. */
  fuente: string;
  commitSha: string;
  nichoSlug: string | null;
  vigenteDesde: string;
};

/** GET /growth/admin/conocimiento */
export type RespuestaDeConocimiento = {
  snapshot: Snapshot;
  conteos: Record<TipoDeAfirmacion, number>;
  porTipo: Record<TipoDeAfirmacion, Afirmacion[]>;
  /** Últimos 30 días, máximo 50. */
  cambiosRecientes: Array<{
    clave: string;
    tipo: TipoDeAfirmacion;
    cambio: "alta" | "cierre";
    en: string;
    commitSha: string;
  }>;
  /** Más de 1000 filas: la lista está recortada. */
  truncado: boolean;
};

export type VersionDeAfirmacion = {
  id: string;
  tipo: TipoDeAfirmacion;
  texto: string;
  valor: unknown;
  fuente: string;
  commitSha: string;
  vigenteDesde: string;
  vigenteHasta: string | null;
};

/** GET /growth/admin/conocimiento/:clave/historial */
export type HistorialDeAfirmacion = {
  clave: string;
  /** La más reciente primero. */
  versiones: VersionDeAfirmacion[];
};

// ---------------------------------------------------------------------------
// Ejecuciones
// ---------------------------------------------------------------------------

export type ResumenDeEjecucion = {
  candidatas?: number;
  calificadas?: number;
  descartadas?: number;
  descartesPorMotivo?: Partial<Record<CodigoDescarte, number>>;
  borradores?: number;
  bloqueadas?: number;
  notas?: string;
  /**
   * Lo que declaró el agente al cerrar, por si difiere de lo que midió el
   * servidor (los números de arriba los calcula el servidor). Es JSON del
   * agente: se lee siempre con `leerResumen`, nunca campo a campo.
   */
  declaradoPorElAgente?: DeclaradoPorElAgente;
};

/** Lo que el agente cuenta de su propia ejecución, con la forma que de verdad llega. */
export type DeclaradoPorElAgente = {
  candidatas?: number;
  calificadas?: number;
  descartadas?: number;
  borradores?: number;
  bloqueadas?: number;
  /** Anidado, no un número: un conteo por código de descarte. */
  descartesPorMotivo?: Partial<Record<CodigoDescarte, number>>;
};

export type ModuloDeEjecucion = {
  /**
   * El agente escribe `en_curso` mientras el módulo corre. Un valor que no
   * esté aquí (el agente es libre) se enseña como «Sin estado».
   */
  estado: "en_curso" | "ok" | "parcial" | "error" | "omitido";
  inicio?: string;
  fin?: string;
  error?: string;
  notas?: string;
};

export type EjecucionBase = {
  id: string;
  disparador: DisparadorDeEjecucion;
  inicio: string;
  fin: string | null;
  estado: EstadoDeEjecucion;
  /** Resumen guardado al cerrar: los recuentos los calcula el servidor. */
  resumen: ResumenDeEjecucion | null;
  modulos: Record<string, ModuloDeEjecucion> | null;
  versionPrompts: string | null;
  error: string | null;
};

export type FiltrosDeEjecuciones = {
  estado?: EstadoDeEjecucion;
  disparador?: DisparadorDeEjecucion;
  pagina?: number;
  limite?: number;
};

export type EjecucionResumen = EjecucionBase & {
  duracionSegundos: number | null;
  oportunidades: number;
};

export type ListaDeEjecuciones = Pagina<EjecucionResumen>;

/** GET /growth/admin/ejecuciones/:id */
export type DetalleDeEjecucion = EjecucionBase & {
  duracionSegundos?: number | null;
  /** Borradores de las oportunidades de esa ejecución. */
  borradores?: number;
  /** Contadores calculados por el servidor, no por el agente. */
  oportunidadesPorEstado: Partial<Record<EstadoDeOportunidad, number>>;
  descartesPorMotivo: Array<{ codigo: string; n: number }>;
  /** Hasta 200. */
  oportunidades: Array<{
    id: string;
    titulo: string;
    dominio: string;
    estado: EstadoDeOportunidad;
    objetivoPrincipal: Objetivo;
    codigoDescarte: CodigoDescarte | null;
  }>;
};

// ---------------------------------------------------------------------------
// Ajustes y competidores
// ---------------------------------------------------------------------------

export type ValoresDeAjustes = {
  /** Contactos por semana: de 0 a 20. */
  topeSemanal: number;
  /** De 0,4 a 0,9. */
  umbralDeSimilitud: number;
  /** Puntuación mínima por objetivo: de 0 a 100. */
  umbralesPorObjetivo: Record<Objetivo, number>;
  pausa: boolean;
};

/** GET y PUT /growth/admin/ajustes */
export type Ajustes = {
  valores: ValoresDeAjustes;
  porDefecto: ValoresDeAjustes;
  actualizadoEn: Record<string, string | null>;
  limites: {
    topeSemanal: [number, number];
    umbralDeSimilitud: [number, number];
    umbralesPorObjetivo: [number, number];
  };
  soloLectura: {
    retencionDias: number;
    diasEntreContactosAlMismoDominio: number;
  };
};

/** Cuerpo de PUT /growth/admin/ajustes (al menos una clave). */
export type CambiosDeAjustes = Partial<ValoresDeAjustes>;

// ---------------------------------------------------------------------------
// Competencia
// ---------------------------------------------------------------------------

/**
 * `propuesto`: lo sugirió el agente y NO aplica ninguna regla hasta que lo
 * aceptas. `por_analizar`: confirmado, el agente aún no lo ha leído (o pediste
 * repetirlo). `analizado`: hay un análisis esperando tu revisión. `revisado`:
 * lo diste por bueno.
 */
export const ESTADOS_DE_COMPETIDOR = [
  "propuesto",
  "por_analizar",
  "analizado",
  "revisado",
] as const;
export type EstadoDeCompetidor = (typeof ESTADOS_DE_COMPETIDOR)[number];

/** Quién lo dio de alta. Solo se quitan los que no son `repo`. */
export const ORIGENES_DE_COMPETIDOR = ["repo", "manual", "agente"] as const;
export type OrigenDeCompetidor = (typeof ORIGENES_DE_COMPETIDOR)[number];

export const TIPOS_DE_DATO_DE_COMPETIDOR = [
  "producto",
  "servicio",
  "precio",
  "plan",
  "integracion",
  "sector",
  "idioma",
  "canal",
  "limite",
  "diferencia",
  "otro",
] as const;
export type TipoDeDatoDeCompetidor =
  (typeof TIPOS_DE_DATO_DE_COMPETIDOR)[number];

export const MONEDAS_DE_PRECIO = ["EUR", "USD", "GBP"] as const;
export type MonedaDePrecio = (typeof MONEDAS_DE_PRECIO)[number];

export const PERIODOS_DE_PRECIO = ["mes", "anio", "uso", "unico"] as const;
export type PeriodoDePrecio = (typeof PERIODOS_DE_PRECIO)[number];

/** Pasado este tiempo un análisis cuenta como caducado y el agente lo repite. */
export const DIAS_PARA_CADUCAR_UN_ANALISIS = 90;

/** Los topes del backend (`CambioDeCompetidorBody`, `AltaDeCompetidorBody`). */
export const LARGO_MAXIMO_DE_NOMBRE_DE_COMPETIDOR = 120;
export const LARGO_MAXIMO_DE_NOTAS_DE_COMPETIDOR = 500;
export const LARGO_MAXIMO_DE_URL_DE_COMPETIDOR = 2000;

/** Un precio estructurado; solo lo llevan los datos de tipo `precio` y `plan`. */
export type ValorDePrecio = {
  importe: number;
  moneda: MonedaDePrecio;
  periodo: PeriodoDePrecio;
  ivaIncluido?: boolean;
  /** «minuto», «usuario»…: lo que se cobra por unidad. */
  unidad?: string;
};

/**
 * Un hecho público sobre un competidor, con la página de la que sale y el día
 * que el agente la leyó. Texto de un tercero (lo escribió un modelo que leyó
 * páginas ajenas): se pinta siempre como texto.
 */
export type DatoDeCompetidor = {
  tipo: TipoDeDatoDeCompetidor;
  etiqueta: string;
  texto: string;
  valor?: ValorDePrecio;
  urlFuente: string;
  consultadoEn: string;
};

/** Un competidor en la lista: el último análisis, resumido. */
export type CompetidorResumen = {
  id: string;
  nombre: string;
  /** Sin `www.`, en minúsculas. Nunca se pinta como enlace. */
  dominio: string;
  /** La página de partida del análisis. */
  url: string | null;
  notas: string | null;
  origen: OrigenDeCompetidor;
  estado: EstadoDeCompetidor;
  creadoEn: string;
  /** Cuándo pediste (o se pidió) que el agente lo leyera; `null` si no. */
  analisisSolicitadoEn: string | null;
  /** Oportunidades en su dominio o en sus subdominios. */
  oportunidades: number;
  /** Oportunidades cuyos `competidoresMencionados` incluyen su dominio. */
  menciones: number;
  /** El último análisis. */
  analisis: {
    id: string;
    version: number;
    creadoEn: string;
    revisadoEn: string | null;
    numDatos: number;
    /** Tiene más de 90 días: el agente lo repetirá solo. */
    caducado: boolean;
  } | null;
};

/** GET /growth/admin/competidores */
export type RespuestaDeCompetidores = { data: CompetidorResumen[] };

export type AnalisisDeCompetidor = {
  id: string;
  version: number;
  resumen: string;
  datos: DatoDeCompetidor[];
  creadoEn: string;
  /** El nombre del token del agente que lo guardó. */
  creadoPor: string;
  revisadoEn: string | null;
  notaDeRevision: string | null;
};

export type VersionDeAnalisis = {
  id: string;
  version: number;
  creadoEn: string;
  revisadoEn: string | null;
  numDatos: number;
};

/** GET /growth/admin/competidores/:id */
export type CompetidorDetalle = CompetidorResumen & {
  ultimoAnalisis: AnalisisDeCompetidor | null;
  /** De la más nueva a la más vieja. */
  versiones: VersionDeAnalisis[];
};

/** Cuerpo de POST /growth/admin/competidores (Añadir competidor). */
export type AltaDeCompetidor = {
  url: string;
  nombre?: string;
  notas?: string;
};

/** Cuerpo de PATCH /growth/admin/competidores/:id (al menos un campo). */
export type CambioDeCompetidor = {
  nombre?: string;
  notas?: string | null;
  /** Si es de otro dominio, hace falta `cambiarDominio` y el dominio pasa a ser el de la URL. */
  url?: string | null;
  cambiarDominio?: boolean;
};

/** Cuerpo de POST …/analisis/:analisisId/revisar. */
export type RevisionDeAnalisis = { nota?: string };

// ---------------------------------------------------------------------------
// Comparador de precios
// ---------------------------------------------------------------------------

/** Los tipos de dato que entran en el comparador (los demás se quedan en la ficha). */
export const TIPOS_DE_DATO_DEL_COMPARADOR = [
  "precio",
  "plan",
  "integracion",
  "idioma",
  "canal",
  "limite",
] as const;
export type TipoDeDatoDelComparador =
  (typeof TIPOS_DE_DATO_DEL_COMPARADOR)[number];

/** Un competidor en el comparador, con los datos de su ÚLTIMO análisis. */
export type FilaDelComparador = {
  competidorId: string;
  nombre: string;
  /** Sin `www.`. Nunca se pinta como enlace. */
  dominio: string;
  url: string | null;
  origen: OrigenDeCompetidor;
  /** Los `propuesto` no salen. */
  estado: "por_analizar" | "analizado" | "revisado";
  analisis: {
    id: string;
    version: number;
    creadoEn: string;
    revisadoEn: string | null;
    /** Tiene más de 90 días. */
    caducado: boolean;
  } | null;
  /** Solo tipos precio, plan, integracion, idioma, canal y limite. */
  datos: DatoDeCompetidor[];
};

/** GET /growth/admin/competidores/comparador */
export type RespuestaDelComparador = {
  /** Por nombre. */
  data: FilaDelComparador[];
  generadoEn: string;
};

// ---------------------------------------------------------------------------
// Ficha de Alhabla
// ---------------------------------------------------------------------------

/** Un campo de la ficha de producto, compuesto en el servidor con afirmaciones vigentes. */
export type CampoDeFicha = {
  /** `nombre`, `web`, `descripcion_corta`, `descripcion_larga`, `precios`, `prueba`, `idiomas`, `categorias`. */
  clave: string;
  /** «Nombre del producto», «Descripción corta»… */
  etiqueta: string;
  /** `null` si faltan afirmaciones para componerlo. */
  texto: string | null;
  /** Caracteres orientativos (160 y 1.000 en las descripciones). */
  limite?: number;
  /** Las claves de afirmación que usa (`precio.plan.pro`…). */
  afirmaciones: string[];
  /** Las que se esperaban y no están vigentes. */
  faltan: string[];
};

/** GET /growth/admin/ficha-de-alhabla */
export type RespuestaDeFicha = {
  campos: CampoDeFicha[];
  /** Del snapshot de conocimiento; `null` si nunca se sincronizó. */
  commit: string | null;
  sincronizadaEn: string | null;
  /** «campo X contiene …»: términos prohibidos que salen en un texto. */
  avisos: string[];
};

// ---------------------------------------------------------------------------
// Tareas a mano
// ---------------------------------------------------------------------------

export const CATEGORIAS_DE_TAREA = [
  "directorio_software",
  "directorio_ia",
  "sector",
  "asociacion",
  "otro",
] as const;
export type CategoriaDeTarea = (typeof CATEGORIAS_DE_TAREA)[number];

/** `repo`: la sembró el sistema (se descarta, no se borra). `manual`: la añadiste tú. */
export const ORIGENES_DE_TAREA = ["repo", "manual"] as const;
export type OrigenDeTarea = (typeof ORIGENES_DE_TAREA)[number];

export const ESTADOS_DE_TAREA = ["pendiente", "hecha", "descartada"] as const;
export type EstadoDeTarea = (typeof ESTADOS_DE_TAREA)[number];

export const RESULTADOS_DE_TAREA = [
  "alta_creada",
  "en_revision",
  "rechazada",
  "sin_alta_gratuita",
  "otro",
] as const;
export type ResultadoDeTarea = (typeof RESULTADOS_DE_TAREA)[number];

/** Los topes del backend (cuerpos de `/growth/admin/tareas`). */
export const LARGO_MAXIMO_DE_TITULO_DE_TAREA = 200;
export const LARGO_MAXIMO_DE_URL_DE_TAREA = 2000;
export const MAXIMO_DE_PASOS_DE_TAREA = 12;
export const LARGO_MAXIMO_DE_PASO_DE_TAREA = 300;
export const LARGO_MAXIMO_DE_NOTAS_DE_TAREA = 1000;
export const LARGO_MAXIMO_DE_NOTA_DE_RESULTADO_DE_TAREA = 500;

/** Una tarea a mano: un destino que el agente no puede abrir o que se hace mejor tú. */
export type Tarea = {
  id: string;
  titulo: string;
  /** Sin `www.`; `null` si no se sabe. Nunca se pinta como enlace. */
  dominio: string | null;
  url: string;
  categoria: CategoriaDeTarea;
  pasos: string[];
  notas: string | null;
  origen: OrigenDeTarea;
  estado: EstadoDeTarea;
  resultado: ResultadoDeTarea | null;
  notaDeResultado: string | null;
  hechaEn: string | null;
  creadoEn: string;
  orden: number;
};

/** GET /growth/admin/tareas */
export type RespuestaDeTareas = { data: Tarea[] };

/**
 * Cuerpo de POST /growth/admin/tareas (Añadir tarea). Sin `dominio`, el
 * backend lo saca de la URL; el panel no lo manda.
 */
export type AltaDeTarea = {
  titulo: string;
  url: string;
  categoria?: CategoriaDeTarea;
  dominio?: string | null;
  pasos?: string[];
  notas?: string | null;
};

/**
 * Cuerpo de PATCH /growth/admin/tareas/:id (al menos un campo). `notas: null`
 * las borra. Una URL de otro sitio sin `dominio` recalcula el dominio.
 */
export type CambioDeTarea = {
  titulo?: string;
  url?: string;
  categoria?: CategoriaDeTarea;
  dominio?: string | null;
  pasos?: string[];
  notas?: string | null;
};

/** Cuerpo de POST /growth/admin/tareas/:id/hecha. */
export type MarcaDeTareaHecha = {
  resultado?: ResultadoDeTarea | null;
  nota?: string | null;
};

/** Cuerpo de POST /growth/admin/tareas/:id/descartar. */
export type DescarteDeTarea = { nota?: string | null };
