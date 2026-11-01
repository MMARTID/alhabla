import type {
  AccionDeDecision,
  CategoriaDeTarea,
  Canal,
  CodigoDescarte,
  EstadoDeBorrador,
  EstadoDeCompetidor,
  EstadoDeEjecucion,
  EstadoDeOportunidad,
  EstadoDeTarea,
  GrupoDeBorradores,
  Objetivo,
  OrigenDeCompetidor,
  OrigenDeTarea,
  Resultado,
  ResultadoDeGestion,
  ResultadoDeTarea,
  TipoDeAfirmacion,
  TipoDeBorrador,
  TipoDeDatoDeCompetidor,
  TipoDeDestino,
} from "./types";

/**
 * Los textos de interfaz del vocabulario de Growth, en un solo sitio. El
 * código y la API usan los identificadores (`pendiente_aprobacion`); la
 * persona lee estas etiquetas.
 */

/** El color de una insignia: cada tono es una familia de tokens. */
export type Tono = "neutro" | "morado" | "exito" | "aviso" | "error";

// --- Oportunidades --------------------------------------------------------

export const ETIQUETA_DE_ESTADO: Record<EstadoDeOportunidad, string> = {
  detectada: "Detectada",
  calificada: "Calificada",
  investigada: "Investigada",
  con_borrador: "Con borrador",
  pendiente_aprobacion: "Por revisar",
  aprobada: "Aprobada",
  gestionada: "Gestionada",
  conseguida: "Conseguida",
  // Que el destino diga que no también acaba aquí (decisión 6 de la 1b).
  sin_respuesta: "Cerrada sin éxito",
  devuelta: "Devuelta",
  bloqueada: "Bloqueada",
  descartada: "Descartada",
  caducada: "Caducada",
};

export const TONO_DE_ESTADO: Record<EstadoDeOportunidad, Tono> = {
  detectada: "neutro",
  calificada: "neutro",
  investigada: "neutro",
  con_borrador: "morado",
  pendiente_aprobacion: "morado",
  aprobada: "exito",
  gestionada: "exito",
  conseguida: "exito",
  sin_respuesta: "neutro",
  devuelta: "aviso",
  bloqueada: "error",
  descartada: "neutro",
  caducada: "aviso",
};

/** Las que merecen tu tiempo: el filtro por defecto de la Bandeja. */
export const ESTADOS_DE_LA_BANDEJA: readonly EstadoDeOportunidad[] = [
  "calificada",
  "investigada",
  "pendiente_aprobacion",
  "bloqueada",
  "devuelta",
  "aprobada",
];

// --- Objetivos ------------------------------------------------------------

export const ETIQUETA_DE_OBJETIVO: Record<Objetivo, string> = {
  TRAFICO_MARCA: "Tráfico y marca",
  LEADS: "Clientes potenciales",
  BACKLINKS: "Backlinks",
};

/** La letra con la que PLAN-GROWTH.md § 2 nombra cada objetivo. */
export const LETRA_DE_OBJETIVO: Record<Objetivo, string> = {
  TRAFICO_MARCA: "A",
  LEADS: "B",
  BACKLINKS: "C",
};

export function etiquetaCortaDeObjetivo(objetivo: Objetivo): string {
  return `${LETRA_DE_OBJETIVO[objetivo]} · ${ETIQUETA_DE_OBJETIVO[objetivo]}`;
}

// --- Borradores -----------------------------------------------------------

export const ETIQUETA_DE_ESTADO_DE_BORRADOR: Record<EstadoDeBorrador, string> =
  {
    borrador: "Borrador",
    bloqueado: "Bloqueado",
    pendiente_aprobacion: "Por revisar",
    aprobado: "Aprobado",
    gestionado: "Gestionado",
    descartado: "Descartado",
  };

export const TONO_DE_ESTADO_DE_BORRADOR: Record<EstadoDeBorrador, Tono> = {
  borrador: "neutro",
  bloqueado: "error",
  pendiente_aprobacion: "morado",
  aprobado: "exito",
  gestionado: "exito",
  descartado: "neutro",
};

export const ETIQUETA_DE_TIPO_DE_BORRADOR: Record<TipoDeBorrador, string> = {
  email: "Correo",
  formulario: "Formulario",
  ficha_directorio: "Ficha de directorio",
  texto_invitado: "Texto invitado",
};

export const ETIQUETA_DE_GRUPO_DE_BORRADORES: Record<
  GrupoDeBorradores,
  string
> = {
  bloqueados: "Bloqueados",
  pendientes: "Por revisar",
  aprobados: "Aprobados",
  gestionados: "Gestionados",
  caducados: "Caducados",
  descartados: "Descartados",
};

export const ETIQUETA_DE_RESULTADO: Record<Resultado, string> = {
  pasa: "Cumple",
  aviso: "Con avisos",
  bloquea: "Bloqueado",
};

export const TONO_DE_RESULTADO: Record<Resultado, Tono> = {
  pasa: "exito",
  aviso: "aviso",
  bloquea: "error",
};

// --- Reglas de cumplimiento ----------------------------------------------

const ETIQUETA_DE_REGLA: Record<string, string> = {
  afirmaciones_vigentes: "Afirmaciones con clave vigente",
  precio_trazable: "Precios con su fuente",
  sin_terminos_prohibidos: "Sin términos prohibidos",
  comparativa_con_fuente: "Comparativas con fuente",
  identificacion: "Se identifica quien escribe",
  sin_esquemas_de_enlaces: "Sin esquemas de enlaces",
  enlace_a_alhabla: "Enlaces a Alhabla",
  un_contacto_por_dominio: "Un contacto por dominio cada 90 días",
  tope_semanal: "Tope semanal de contactos",
  sin_plantilla_repetida: "Sin plantilla repetida",
  sin_datos_personales: "Sin datos personales",
  tipo_acorde_con_objetivo: "Tipo de borrador acorde con el objetivo",
  similitud_alta: "Parecido con otros textos",
  similitud_con_version_anterior: "Parecido con la versión anterior",
  pocos_enlaces: "Pocos enlaces",
  enlace_con_utm: "Enlace con UTM",
  longitud_razonable: "Longitud razonable",
};

/** El nombre legible de una regla; las desconocidas salen sin guiones bajos. */
export function etiquetaDeRegla(regla: string): string {
  return ETIQUETA_DE_REGLA[regla] ?? regla.replace(/_/g, " ");
}

// --- Descartes ------------------------------------------------------------

export const ETIQUETA_DE_CODIGO_DE_DESCARTE: Record<CodigoDescarte, string> = {
  no_viva: "Página caída",
  idioma: "Otro idioma",
  irrelevante: "Irrelevante",
  competidor: "Es un competidor",
  dominio_propio: "Es nuestro dominio",
  baja_calidad: "Baja calidad",
  contenido_ilegal: "Contenido ilegal",
  duplicada: "Duplicada",
  bajo_umbral: "Bajo el umbral de puntuación",
  dominio_en_enfriamiento: "Dominio contactado hace poco",
  manual: "Descartada por ti",
  otro: "Otro motivo",
};

/** Etiqueta de un código de descarte; si el backend añade uno nuevo, sale tal cual. */
export function etiquetaDeCodigoDeDescarte(codigo: string): string {
  return (
    (ETIQUETA_DE_CODIGO_DE_DESCARTE as Record<string, string>)[codigo] ??
    codigo.replace(/_/g, " ")
  );
}

// --- Destinos y gestiones -------------------------------------------------

export const ETIQUETA_DE_TIPO_DE_DESTINO: Record<TipoDeDestino, string> = {
  comparativa: "Comparativa",
  directorio: "Directorio",
  prensa: "Prensa",
  asociacion: "Asociación",
  mencion_sin_enlace: "Mención sin enlace",
  otro: "Otro",
};

export const ETIQUETA_DE_CANAL: Record<Canal, string> = {
  email: "Correo",
  formulario: "Formulario",
  alta_directorio: "Alta en directorio",
  otro: "Otro",
};

export const ETIQUETA_DE_RESULTADO_DE_GESTION: Record<
  ResultadoDeGestion,
  string
> = {
  pendiente: "Pendiente",
  aceptado: "Aceptado",
  rechazado: "Rechazado",
  sin_respuesta: "Sin respuesta",
};

// --- Decisiones -----------------------------------------------------------

export const ETIQUETA_DE_ACCION: Record<AccionDeDecision, string> = {
  aprobar: "Aprobar",
  devolver: "Devolver con nota",
  descartar: "Descartar",
  marcar_gestionado: "Marcar como gestionado",
  conseguido: "Enlace conseguido",
  sin_respuesta: "Sin respuesta",
  rechazado: "Rechazado por el destino",
};

/** Cómo se ve en el Historial cada `accion` del registro de decisiones. */
const ETIQUETA_DE_ACCION_DEL_REGISTRO: Record<string, string> = {
  aprobar: "Aprobada",
  editar: "Borrador editado",
  devolver: "Devuelta",
  descartar: "Descartada",
  marcar_gestionado: "Marcada como gestionada",
  conseguido: "Enlace conseguido",
  sin_respuesta: "Cerrada sin respuesta",
  rechazado: "Rechazada por el destino",
  anadir_url: "URL añadida",
  calificar: "Calificada",
  investigar: "Investigada",
  bloquear_por_reglas: "Bloqueada por las reglas",
  bloquear_por_conocimiento: "Bloqueada por un cambio de conocimiento",
  redactar: "Borrador redactado",
  caducar: "Caducada sin gestionarse",
  conocimiento_sincronizado: "Conocimiento sincronizado",
  ajustes: "Ajustes cambiados",
  nicho_activo: "Nicho activado",
  nicho_descartado: "Nicho descartado",
  revocar_token: "Token revocado",
  competidor_alta: "Competidor añadido",
  competidor_baja: "Competidor quitado",
  fuente_activar: "Fuente activada",
  fuente_desactivar: "Fuente desactivada",
};

export function etiquetaDeAccionDelRegistro(accion: string): string {
  return ETIQUETA_DE_ACCION_DEL_REGISTRO[accion] ?? accion.replace(/_/g, " ");
}

/** Quién hizo algo: tú, el agente o el propio sistema. */
export function etiquetaDeAutor(por: string): string {
  if (por === "sistema") return "Sistema";
  if (por.startsWith("agente:"))
    return `Agente (${por.slice("agente:".length)})`;
  return por;
}

// --- Conocimiento y ejecuciones -------------------------------------------

export const ETIQUETA_DE_TIPO_DE_AFIRMACION: Record<TipoDeAfirmacion, string> =
  {
    precio: "Precios",
    funcion: "Funciones",
    limite: "Limitaciones",
    sector: "Sectores",
    comparativa: "Comparativas",
    pagina: "Páginas",
    prohibida: "Prohibido decir",
  };

export const ETIQUETA_DE_ESTADO_DE_EJECUCION: Record<
  EstadoDeEjecucion,
  string
> = {
  en_curso: "En curso",
  ok: "Correcta",
  parcial: "Parcial",
  error: "Con error",
};

export const TONO_DE_ESTADO_DE_EJECUCION: Record<EstadoDeEjecucion, Tono> = {
  en_curso: "morado",
  ok: "exito",
  parcial: "aviso",
  error: "error",
};

// --- Competencia ----------------------------------------------------------

export const ETIQUETA_DE_ESTADO_DE_COMPETIDOR: Record<
  EstadoDeCompetidor,
  string
> = {
  propuesto: "Propuesto por el agente",
  por_analizar: "Por analizar",
  analizado: "Pendiente de revisión",
  revisado: "Revisado",
};

export const TONO_DE_ESTADO_DE_COMPETIDOR: Record<EstadoDeCompetidor, Tono> = {
  propuesto: "aviso",
  por_analizar: "neutro",
  analizado: "morado",
  revisado: "exito",
};

export const ETIQUETA_DE_ORIGEN_DE_COMPETIDOR: Record<
  OrigenDeCompetidor,
  string
> = {
  repo: "Del repositorio",
  manual: "Añadido por ti",
  agente: "Propuesto por el agente",
};

/**
 * Cómo se agrupan los datos de un análisis al enseñarlos: precios y planes
 * juntos, el resto por tipo. El orden es el de lectura: primero qué es y qué
 * hace, luego cuánto cuesta y con qué se conecta.
 */
export const GRUPOS_DE_DATOS_DE_COMPETIDOR: ReadonlyArray<{
  clave: string;
  titulo: string;
  tipos: readonly TipoDeDatoDeCompetidor[];
}> = [
  { clave: "producto", titulo: "Producto", tipos: ["producto"] },
  { clave: "servicio", titulo: "Servicio", tipos: ["servicio"] },
  { clave: "precios", titulo: "Precios y planes", tipos: ["precio", "plan"] },
  { clave: "integraciones", titulo: "Integraciones", tipos: ["integracion"] },
  { clave: "sectores", titulo: "Sectores", tipos: ["sector"] },
  { clave: "idiomas", titulo: "Idiomas", tipos: ["idioma"] },
  { clave: "canales", titulo: "Canales", tipos: ["canal"] },
  { clave: "limites", titulo: "Límites", tipos: ["limite"] },
  {
    clave: "diferencias",
    titulo: "Diferencias con Alhabla",
    tipos: ["diferencia"],
  },
  { clave: "otros", titulo: "Otros datos", tipos: ["otro"] },
];

// --- Tareas a mano --------------------------------------------------------

export const ETIQUETA_DE_CATEGORIA_DE_TAREA: Record<CategoriaDeTarea, string> =
  {
    directorio_software: "Directorio de software",
    directorio_ia: "Directorio de IA",
    sector: "Sector",
    asociacion: "Asociación",
    otro: "Otro",
  };

export const ETIQUETA_DE_ESTADO_DE_TAREA: Record<EstadoDeTarea, string> = {
  pendiente: "Pendiente",
  hecha: "Hecha",
  descartada: "Descartada",
};

export const ETIQUETA_DE_ORIGEN_DE_TAREA: Record<OrigenDeTarea, string> = {
  repo: "Del repositorio",
  manual: "Añadida por ti",
};

export const ETIQUETA_DE_RESULTADO_DE_TAREA: Record<ResultadoDeTarea, string> =
  {
    alta_creada: "Alta creada",
    en_revision: "En revisión",
    rechazada: "Rechazada",
    sin_alta_gratuita: "Sin alta gratuita",
    otro: "Otro",
  };

export const TONO_DE_RESULTADO_DE_TAREA: Record<ResultadoDeTarea, Tono> = {
  alta_creada: "exito",
  en_revision: "morado",
  rechazada: "error",
  sin_alta_gratuita: "aviso",
  otro: "neutro",
};
