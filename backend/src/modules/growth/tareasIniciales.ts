import type {
  CategoriaDeTarea,
  EstadoDeTarea,
  ResultadoDeTarea,
} from "./esquemas.js";

/**
 * Las tareas a mano con las que arranca el panel (`origen = repo`): destinos
 * que el agente no puede abrir (G2, Capterra… responden 403) o que se hacen
 * mejor a mano. Las siembra `servicioTareas.ts › asegurarTareasIniciales` la
 * primera vez que se piden y, en cada petición, añade solo las que falten
 * (una nueva en esta lista aparece sola tras el siguiente despliegue). Nunca
 * toca una que ya existe: lo que el administrador haya marcado, descartado o
 * editado se queda como está.
 *
 * Las notas dicen lo que se leyó POR BÚSQUEDA y sigue SIN CONFIRMAR: ninguna
 * de estas rutas de alta se ha abierto desde aquí, y el coste de un alta
 * gratuita o de pago lo ve quien la abre.
 */

export type TareaInicial = {
  /** Identidad estable (`growth_tareas.siembra`); nunca se reutiliza ni se renombra. */
  siembra: string;
  titulo: string;
  /** Sin `www.`. */
  dominio: string;
  /** La portada del directorio. */
  url: string;
  categoria: CategoriaDeTarea;
  notas?: string;
  /** Solo la que ya se hizo antes de que existiera el panel. */
  hecha?: {
    resultado: ResultadoDeTarea;
    hechaEn: Date;
    nota: string;
  };
};

/** Genéricos y honestos: no prometen una ruta de alta que no se ha confirmado. */
export const PASOS_GENERICOS_DE_UNA_TAREA: readonly string[] = [
  "Abre la página.",
  "Busca «para proveedores», «añadir producto» o «sugerir herramienta».",
  "Pega la Ficha de Alhabla de esta página, campo a campo.",
  "Anota aquí si el alta es gratuita y si pide verificación.",
];

const TAREAS: readonly TareaInicial[] = [
  {
    siembra: "capterra",
    titulo: "Capterra (también GetApp y Software Advice)",
    dominio: "capterra.com",
    url: "https://www.capterra.com/",
    categoria: "directorio_software",
    notas:
      "Por búsqueda, sin confirmar: una sola alta de proveedor serviría para los tres (digital-markets.gartner.com/capterra-vendor-signup). El agente recibe 403.",
  },
  {
    siembra: "g2",
    titulo: "G2",
    dominio: "g2.com",
    url: "https://www.g2.com/",
    categoria: "directorio_software",
    notas:
      "Por búsqueda, sin confirmar: perfil gratuito en sell.g2.com/create-free-profile. El agente recibe 403.",
  },
  {
    siembra: "sourceforge",
    titulo: "SourceForge",
    dominio: "sourceforge.net",
    url: "https://sourceforge.net/",
    categoria: "directorio_software",
    notas: "Alta en /software/vendors/new; coste no publicado.",
  },
  {
    siembra: "softwaredoit",
    titulo: "SoftwareDoit.es",
    dominio: "softwaredoit.es",
    url: "https://softwaredoit.es/",
    categoria: "directorio_software",
    notas: "Formulario de Notion; coste sin indicar. Es español.",
  },
  {
    siembra: "alternativeto",
    titulo: "AlternativeTo",
    dominio: "alternativeto.net",
    url: "https://alternativeto.net/",
    categoria: "directorio_software",
    notas: "Solo se localizó registro de usuario.",
  },
  {
    siembra: "selecthub",
    titulo: "SelectHub",
    dominio: "selecthub.com",
    url: "https://www.selecthub.com/",
    categoria: "directorio_software",
  },
  {
    siembra: "stork",
    titulo: "Stork",
    dominio: "stork.ai",
    url: "https://www.stork.ai/",
    categoria: "directorio_ia",
  },
  {
    siembra: "aiagentsdirectory",
    titulo: "AI Agents Directory",
    dominio: "aiagentsdirectory.com",
    url: "https://aiagentsdirectory.com/",
    categoria: "directorio_ia",
  },
  {
    siembra: "toolradar",
    titulo: "Toolradar",
    dominio: "toolradar.com",
    url: "https://toolradar.com/",
    categoria: "directorio_ia",
  },
  {
    siembra: "topai-tools",
    titulo: "topai.tools",
    dominio: "topai.tools",
    url: "https://topai.tools/",
    categoria: "directorio_ia",
  },
  {
    siembra: "beautymarket",
    titulo: "Beautymarket",
    dominio: "beautymarket.es",
    url: "https://beautymarket.es/",
    categoria: "sector",
    hecha: {
      resultado: "en_revision",
      // A mediodía UTC: el 31 de octubre en cualquier zona horaria.
      hechaEn: new Date("2026-10-31T12:00:00.000Z"),
      nota: "Ficha enviada por el fundador el 31-10-2026.",
    },
  },
];

export const TAREAS_INICIALES: readonly TareaInicial[] = TAREAS;

/** Separación entre las `orden` de las sembradas: deja hueco para intercalar a mano. */
export const SEPARACION_DE_ORDEN = 10;

/** Lo que se inserta en `growth_tareas` por cada tarea inicial. */
export function filaDeTareaInicial(tarea: TareaInicial, indice: number) {
  const hecha = tarea.hecha;
  const estado: EstadoDeTarea = hecha ? "hecha" : "pendiente";
  return {
    siembra: tarea.siembra,
    titulo: tarea.titulo,
    dominio: tarea.dominio,
    url: tarea.url,
    categoria: tarea.categoria,
    pasos: [...PASOS_GENERICOS_DE_UNA_TAREA],
    notas: tarea.notas ?? null,
    origen: "repo" as const,
    estado,
    resultado: hecha?.resultado ?? null,
    notaDeResultado: hecha?.nota ?? null,
    hechaEn: hecha?.hechaEn ?? null,
    orden: (indice + 1) * SEPARACION_DE_ORDEN,
  };
}
