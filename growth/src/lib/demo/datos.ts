import { CORREO_DE_DEMOSTRACION } from "../modo-demo";
import { mencionaPrecio, similitudDeTextos } from "./reglas-demo";
import type {
  Afirmacion,
  AnalisisDeCompetidor,
  Comprobacion,
  DatosDeOportunidad,
  EjecucionBase,
  EstadoDeOportunidad,
  Gestion,
  Investigacion,
  Objetivo,
  RegistroDeDecision,
  Resultado,
  Revision,
  TipoDeBorrador,
  ValoresDeAjustes,
  BorradorDetallado,
  CodigoDescarte,
  FuenteTipo,
  OrigenDeCompetidor,
  EstadoDeCompetidor,
  Tarea,
  TipoDeAfirmacion,
} from "../types";

/**
 * Los datos de prueba del modo demostración (`npm run dev:demo`). NADA de esto
 * es real: ni los dominios (todos `.example`), ni las citas, ni las fechas
 * (se calculan respecto a «ahora» para que los plazos siempre estén vivos).
 *
 * Este fichero es el ÚNICO que contiene la sentinela. Si algún día aparece en
 * `.next/static` o `.next/server` de un build de producción, el modo
 * demostración se ha colado y el job de CI falla a propósito.
 */
export const DEMO_ALHABLA_GROWTH_SENTINELA = "DEMO_ALHABLA_GROWTH_SENTINELA";

// ---------------------------------------------------------------------------
// Forma del almacén (lo que en producción serían las tablas)
// ---------------------------------------------------------------------------

export type RegistroDeOportunidad = {
  id: string;
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
  datos: (DatosDeOportunidad & { codigoDescarte?: CodigoDescarte }) | null;
  expiraEn: string | null;
  ejecucionId: string | null;
  fuenteId: string;
  nichoSlug: string | null;
};

export type RegistroDeBorrador = Omit<
  BorradorDetallado,
  "afirmacionesDetalle" | "revisiones" | "gestion"
>;

export type RegistroDeRevision = Revision & { borradorId: string };
export type RegistroDeGestion = Gestion & { borradorId: string };
export type RegistroDeDecisionDemo = RegistroDeDecision & {
  oportunidadId: string | null;
};
export type RegistroDeAfirmacion = Afirmacion & { vigenteHasta: string | null };

/** Una tarea a mano con su identidad de siembra (`null` en las manuales); la API no la manda. */
export type RegistroDeTarea = Tarea & { siembra: string | null };

/** Un competidor con todas las versiones de su análisis (de la 1 en adelante). */
export type RegistroDeCompetidor = {
  id: string;
  nombre: string;
  dominio: string;
  url: string | null;
  notas: string | null;
  origen: OrigenDeCompetidor;
  estado: EstadoDeCompetidor;
  creadoEn: string;
  analisisSolicitadoEn: string | null;
  /** Orden ascendente de versión. */
  analisis: AnalisisDeCompetidor[];
};

export type AlmacenDeDemostracion = {
  /** La sentinela: no se pinta, pero viaja con los datos. */
  origen: string;
  oportunidades: RegistroDeOportunidad[];
  investigaciones: Investigacion[];
  borradores: RegistroDeBorrador[];
  revisiones: RegistroDeRevision[];
  decisiones: RegistroDeDecisionDemo[];
  gestiones: RegistroDeGestion[];
  afirmaciones: RegistroDeAfirmacion[];
  ejecuciones: EjecucionBase[];
  fuentes: Array<{ id: string; tipo: FuenteTipo; nombre: string }>;
  nichos: Array<{ id: string; slug: string; nombre: string }>;
  competidores: RegistroDeCompetidor[];
  /**
   * Las tareas a mano. Empiezan con unas pocas que ya tocó el fundador; las
   * iniciales (`TAREAS_INICIALES`) se siembran al pedir la lista, como en el
   * backend, sin pisar las que ya estén.
   */
  tareas: RegistroDeTarea[];
  ajustes: {
    valores: ValoresDeAjustes;
    actualizadoEn: Record<string, string | null>;
  };
  snapshot: { commitSha: string; sincronizadoEn: string };
};

export const AJUSTES_POR_DEFECTO: ValoresDeAjustes = {
  topeSemanal: 5,
  umbralDeSimilitud: 0.6,
  umbralesPorObjetivo: { TRAFICO_MARCA: 60, LEADS: 60, BACKLINKS: 60 },
  pausa: false,
};

/** Copia profunda: todo el almacén es JSON, y nadie debe mutar el original. */
export function copiar<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T;
}

const DIA = 24 * 60 * 60 * 1000;
const HORA = 60 * 60 * 1000;
const COMMIT_ACTUAL = "1234abc";
const COMMIT_ANTIGUO = "5678def";

type Opciones = { ahora?: Date; vacio?: boolean };

// ---------------------------------------------------------------------------
// La semilla
// ---------------------------------------------------------------------------

export function crearAlmacenDeDemostracion(
  opciones: Opciones = {}
): AlmacenDeDemostracion {
  const ahora = (opciones.ahora ?? new Date()).getTime();
  const hace = (dias: number, horas = 0) =>
    new Date(ahora - dias * DIA - horas * HORA).toISOString();
  const en = (dias: number, horas = 0) =>
    new Date(ahora + dias * DIA + horas * HORA).toISOString();

  const fuentes: AlmacenDeDemostracion["fuentes"] = [
    { id: "fuente_web", tipo: "web", nombre: "Búsqueda web" },
    { id: "fuente_directorio", tipo: "directorio", nombre: "Directorios" },
    { id: "fuente_manual", tipo: "manual", nombre: "Entrada manual" },
  ];

  const nichos: AlmacenDeDemostracion["nichos"] = [
    { id: "nicho_peluqueria", slug: "peluqueria", nombre: "Peluquería" },
    { id: "nicho_barberia", slug: "barberia", nombre: "Barbería" },
    {
      id: "nicho_centro-de-estetica",
      slug: "centro-de-estetica",
      nombre: "Centro de estética",
    },
    {
      id: "nicho_salon-de-unas",
      slug: "salon-de-unas",
      nombre: "Salón de uñas",
    },
    { id: "nicho_fisioterapia", slug: "fisioterapia", nombre: "Fisioterapia" },
    {
      id: "nicho_peluqueria-canina",
      slug: "peluqueria-canina",
      nombre: "Peluquería canina",
    },
    {
      id: "nicho_pestanas-y-cejas",
      slug: "pestanas-y-cejas",
      nombre: "Pestañas y cejas",
    },
    {
      id: "nicho_spa-y-masajes",
      slug: "spa-y-masajes",
      nombre: "Spa y masajes",
    },
  ];

  const ejecuciones: EjecucionBase[] = [
    {
      id: "demo-ej-03",
      disparador: "programada",
      inicio: hace(1, 3),
      fin: hace(1, 2),
      estado: "ok",
      resumen: {
        candidatas: 23,
        calificadas: 6,
        descartadas: 17,
        descartesPorMotivo: {
          irrelevante: 7,
          idioma: 4,
          bajo_umbral: 4,
          duplicada: 2,
        },
        borradores: 4,
        bloqueadas: 1,
        notas: "Ejecución de ejemplo.",
      },
      modulos: {
        discovery: { estado: "ok" },
        calificacion: { estado: "ok" },
        investigacion: { estado: "ok" },
        redaccion: { estado: "ok" },
        cumplimiento: { estado: "ok" },
      },
      versionPrompts: "9f8e7d6",
      error: null,
    },
    {
      id: "demo-ej-02",
      disparador: "manual",
      inicio: hace(8, 1),
      fin: hace(8),
      estado: "parcial",
      resumen: {
        candidatas: 11,
        calificadas: 3,
        descartadas: 8,
        descartesPorMotivo: { irrelevante: 5, no_viva: 3 },
        borradores: 2,
        bloqueadas: 0,
      },
      modulos: {
        discovery: { estado: "ok" },
        calificacion: { estado: "ok" },
        investigacion: { estado: "parcial", notas: "Dos páginas no cargaron." },
        redaccion: { estado: "ok" },
        cumplimiento: { estado: "omitido" },
      },
      versionPrompts: "9f8e7d6",
      error: null,
    },
    {
      id: "demo-ej-01",
      disparador: "programada",
      inicio: hace(15, 2),
      fin: hace(15, 1),
      estado: "error",
      resumen: null,
      modulos: {
        discovery: { estado: "error", error: "El buscador devolvió un error." },
      },
      versionPrompts: "4c3b2a1",
      error: "Falló el módulo de descubrimiento (error de ejemplo).",
    },
  ];

  const ficha = (
    id: string,
    parcial: Partial<RegistroDeOportunidad> &
      Pick<RegistroDeOportunidad, "url" | "dominio" | "titulo" | "estado">
  ): RegistroDeOportunidad => ({
    id,
    extracto: "",
    idioma: "es",
    detectadaEn: hace(3),
    objetivoPrincipal: "BACKLINKS",
    puntTrafico: 0,
    puntLeads: 0,
    puntBacklinks: 0,
    motivoDescarte: null,
    datos: null,
    expiraEn: null,
    ejecucionId: "demo-ej-03",
    fuenteId: "fuente_web",
    nichoSlug: null,
    ...parcial,
  });

  const oportunidades: RegistroDeOportunidad[] = [
    // 1. Una URL añadida a mano, todavía sin calificar.
    ficha("demo-op-01", {
      url: "https://asociacion-de-estetica.example/directorio",
      dominio: "asociacion-de-estetica.example",
      titulo: "asociacion-de-estetica.example",
      estado: "detectada",
      fuenteId: "fuente_manual",
      detectadaEn: hace(0, 2),
      ejecucionId: null,
      nichoSlug: "centro-de-estetica",
      datos: {
        nota: "Me la pasó una clienta: mirar si admiten altas de empresas.",
      },
    }),
    // 2. Calificada.
    ficha("demo-op-02", {
      url: "https://guia-de-pymes.example/herramientas-para-peluquerias",
      dominio: "guia-de-pymes.example",
      titulo: "Las mejores herramientas para peluquerías en 2026",
      extracto:
        "Comparamos programas de agenda, cobro y atención telefónica para peluquerías pequeñas, con precios y opiniones.",
      estado: "calificada",
      puntBacklinks: 78,
      puntTrafico: 55,
      puntLeads: 40,
      nichoSlug: "peluqueria",
      detectadaEn: hace(1),
      expiraEn: en(25),
      datos: {
        tipoDestino: "comparativa",
        enlaceEsperado: "dofollow",
        dificultad: "media",
        competidoresMencionados: [
          "competidor-ficticio.example",
          "recepcion-express.example",
        ],
      },
    }),
    // 3. Investigada, sin borrador aún.
    ficha("demo-op-03", {
      url: "https://directorio-estetica.example/software",
      dominio: "directorio-estetica.example",
      titulo: "Directorio de software para centros de estética",
      extracto:
        "Listado de programas de gestión para cabinas y centros de belleza.",
      estado: "investigada",
      objetivoPrincipal: "TRAFICO_MARCA",
      puntTrafico: 71,
      puntLeads: 45,
      puntBacklinks: 52,
      fuenteId: "fuente_directorio",
      nichoSlug: "centro-de-estetica",
      detectadaEn: hace(2),
      expiraEn: en(30),
      datos: {
        tipoDestino: "directorio",
        enlaceEsperado: "nofollow",
        dificultad: "baja",
        competidoresMencionados: ["competidor-ficticio.example"],
      },
    }),
    // 4. Con borrador: el paso entre redactar y evaluar las reglas.
    ficha("demo-op-04", {
      url: "https://noticias-pyme.example/recepcionistas-virtuales",
      dominio: "noticias-pyme.example",
      titulo: "Recepcionistas virtuales para pymes: qué hay en el mercado",
      extracto:
        "Repaso a las opciones de atención telefónica automática para pequeños negocios.",
      estado: "con_borrador",
      puntBacklinks: 66,
      puntTrafico: 50,
      puntLeads: 48,
      detectadaEn: hace(2),
      expiraEn: en(18),
      datos: {
        tipoDestino: "prensa",
        enlaceEsperado: "desconocido",
        dificultad: "alta",
      },
    }),
    // 5. Por revisar, con un aviso de parecido con la versión anterior.
    ficha("demo-op-05", {
      url: "https://revista-pymes.example/recepcionistas-de-ia-en-espana",
      dominio: "revista-pymes.example",
      titulo: "Recepcionistas de IA en España: listado actualizado",
      extracto:
        "Un listado con las recepcionistas de IA que atienden llamadas de negocios en España, sus funciones y sus planes.",
      estado: "pendiente_aprobacion",
      puntBacklinks: 84,
      puntTrafico: 62,
      puntLeads: 58,
      nichoSlug: "peluqueria",
      detectadaEn: hace(6),
      expiraEn: en(12),
      datos: {
        tipoDestino: "comparativa",
        enlaceEsperado: "dofollow",
        dificultad: "media",
        nota: "Actualizan el listado cada trimestre.",
        competidoresMencionados: [
          "competidor-ficticio.example",
          "otra-recepcionista.example",
          "recepcion-express.example",
        ],
      },
    }),
    // 6. Por revisar, limpia y a punto de caducar.
    ficha("demo-op-06", {
      url: "https://negocios-locales.example/alta",
      dominio: "negocios-locales.example",
      titulo: "Alta de empresas en el directorio de negocios locales",
      extracto:
        "Formulario de alta gratuita para empresas de servicios de proximidad.",
      estado: "pendiente_aprobacion",
      objetivoPrincipal: "TRAFICO_MARCA",
      puntTrafico: 69,
      puntLeads: 44,
      puntBacklinks: 57,
      fuenteId: "fuente_directorio",
      nichoSlug: "barberia",
      detectadaEn: hace(5),
      expiraEn: en(2, 6),
      datos: {
        tipoDestino: "directorio",
        enlaceEsperado: "nofollow",
        dificultad: "baja",
      },
    }),
    // 7. Bloqueada por las reglas duras.
    ficha("demo-op-07", {
      url: "https://comparador-de-asistentes.example/telefonicos",
      dominio: "comparador-de-asistentes.example",
      titulo: "Comparativa de asistentes telefónicos para negocios",
      extracto:
        "Tabla comparativa con precios, minutos incluidos y funciones de cada servicio.",
      estado: "bloqueada",
      puntBacklinks: 72,
      puntTrafico: 49,
      puntLeads: 51,
      detectadaEn: hace(4),
      expiraEn: en(9),
      datos: {
        tipoDestino: "comparativa",
        enlaceEsperado: "dofollow",
        dificultad: "media",
        competidoresMencionados: ["otra-recepcionista.example"],
      },
    }),
    // 8. Devuelta con una nota.
    ficha("demo-op-08", {
      url: "https://asociacion-peluqueros.example/colaboradores",
      dominio: "asociacion-peluqueros.example",
      titulo: "Colaboradores de la Asociación de Peluqueros (ejemplo)",
      extracto:
        "Página de empresas colaboradoras que ofrecen ventajas a los asociados.",
      estado: "devuelta",
      objetivoPrincipal: "LEADS",
      puntLeads: 64,
      puntTrafico: 47,
      puntBacklinks: 59,
      nichoSlug: "peluqueria",
      detectadaEn: hace(7),
      expiraEn: en(14),
      datos: {
        tipoDestino: "asociacion",
        enlaceEsperado: "nofollow",
        dificultad: "media",
      },
    }),
    // 9. Aprobada, sin gestionar.
    ficha("demo-op-09", {
      url: "https://blog-autonomos.example/herramientas-para-citas",
      dominio: "blog-autonomos.example",
      titulo: "Herramientas para gestionar citas si eres autónomo",
      extracto:
        "Artículo con recomendaciones de herramientas de agenda para autónomos con cita previa.",
      estado: "aprobada",
      puntBacklinks: 81,
      puntTrafico: 58,
      puntLeads: 60,
      detectadaEn: hace(9),
      expiraEn: en(20),
      datos: {
        tipoDestino: "otro",
        enlaceEsperado: "dofollow",
        dificultad: "media",
      },
    }),
    // 10. Gestionada: ya enviaste el formulario.
    ficha("demo-op-10", {
      url: "https://directorio-unas.example/software",
      dominio: "directorio-unas.example",
      titulo: "Directorio de salones de uñas y proveedores",
      extracto:
        "Directorio con proveedores y herramientas para salones de uñas.",
      estado: "gestionada",
      objetivoPrincipal: "TRAFICO_MARCA",
      puntTrafico: 74,
      puntLeads: 42,
      puntBacklinks: 55,
      fuenteId: "fuente_directorio",
      nichoSlug: "salon-de-unas",
      detectadaEn: hace(14),
      datos: {
        tipoDestino: "directorio",
        enlaceEsperado: "nofollow",
        dificultad: "baja",
      },
    }),
    // 11. Conseguida: el enlace está publicado.
    ficha("demo-op-11", {
      url: "https://listado-belleza.example/proveedores",
      dominio: "listado-belleza.example",
      titulo: "Proveedores del sector belleza",
      extracto: "Listado de proveedores de tecnología para el sector belleza.",
      estado: "conseguida",
      puntBacklinks: 88,
      puntTrafico: 66,
      puntLeads: 50,
      nichoSlug: "centro-de-estetica",
      detectadaEn: hace(30),
      datos: {
        tipoDestino: "directorio",
        enlaceEsperado: "dofollow",
        dificultad: "media",
      },
    }),
    // 12. Cerrada sin éxito: el destino dijo que no.
    ficha("demo-op-12", {
      url: "https://academia-peluqueria.example/colabora",
      dominio: "academia-peluqueria.example",
      titulo: "Colabora con la academia de peluquería (ejemplo)",
      extracto:
        "Página para empresas que quieren patrocinar o colaborar con la academia.",
      estado: "sin_respuesta",
      objetivoPrincipal: "LEADS",
      puntLeads: 67,
      puntTrafico: 52,
      puntBacklinks: 61,
      nichoSlug: "peluqueria",
      detectadaEn: hace(25),
      datos: {
        tipoDestino: "asociacion",
        enlaceEsperado: "nofollow",
        dificultad: "alta",
      },
    }),
    // 13. Descartada por ti.
    ficha("demo-op-13", {
      url: "https://foro-bricolaje.example/hilo/12345",
      dominio: "foro-bricolaje.example",
      titulo: "Hilo: ¿qué taladro comprar?",
      extracto: "Conversación sobre taladros y herramientas de bricolaje.",
      estado: "descartada",
      puntBacklinks: 12,
      detectadaEn: hace(6),
      motivoDescarte:
        "Es un foro de bricolaje: nada que ver con negocios con cita.",
      datos: { codigoDescarte: "irrelevante" },
    }),
    // 14. Caducada: nadie la gestionó a tiempo.
    ficha("demo-op-14", {
      url: "https://concurso-pymes.example/2026",
      dominio: "concurso-pymes.example",
      titulo: "Concurso de herramientas digitales para pymes 2026",
      extracto:
        "Convocatoria para que las empresas presenten su solución digital.",
      estado: "caducada",
      puntBacklinks: 70,
      puntTrafico: 53,
      puntLeads: 49,
      detectadaEn: hace(40),
      expiraEn: hace(3),
      datos: {
        tipoDestino: "otro",
        enlaceEsperado: "desconocido",
        dificultad: "alta",
      },
    }),
    // 15 y 16. Descartes automáticos de la última semana (para el estado vacío).
    ficha("demo-op-15", {
      url: "https://competidor-ficticio.example/blog/novedades",
      dominio: "competidor-ficticio.example",
      titulo: "Novedades del producto (competidor ficticio)",
      extracto: "Entrada del blog de un competidor ficticio.",
      estado: "descartada",
      detectadaEn: hace(2),
      motivoDescarte: "Es la web de un competidor.",
      datos: { codigoDescarte: "competidor" },
    }),
    ficha("demo-op-16", {
      url: "https://portal-de-negocios.example/en/tools",
      dominio: "portal-de-negocios.example",
      titulo: "Business tools directory",
      extracto: "Directory of tools for small businesses (in English).",
      estado: "descartada",
      detectadaEn: hace(4),
      motivoDescarte: "Página en inglés para otro mercado.",
      datos: { codigoDescarte: "idioma" },
    }),
  ];

  const investigaciones: Investigacion[] = [
    {
      oportunidadId: "demo-op-03",
      resumen:
        "Directorio mantenido por una asociación del sector. Las altas son gratuitas y se piden con un formulario público; no consta una revisión editorial.",
      quienEdita: "Asociación del sector",
      viaDeContacto: "formulario",
      competidoresEnlazados: ["competidor-ficticio.example"],
      contexto: { urlContacto: "https://directorio-estetica.example/alta" },
      creadaEn: hace(1, 5),
    },
    {
      oportunidadId: "demo-op-05",
      resumen:
        "Revista digital de negocios. El listado lo actualiza la redacción cada trimestre y lo componen empresas que lo piden por el formulario editorial. Enlaza hoy a varios servicios de atención telefónica.",
      quienEdita: "Medio digital",
      viaDeContacto: "formulario",
      competidoresEnlazados: [
        "competidor-ficticio.example",
        "otra-recepcionista.example",
      ],
      contexto: {
        urlContacto: "https://revista-pymes.example/contacto-editorial",
      },
      creadaEn: hace(5),
    },
    {
      oportunidadId: "demo-op-06",
      resumen:
        "Directorio de negocios de proximidad con alta gratuita mediante formulario.",
      quienEdita: "Directorio",
      viaDeContacto: "alta_directorio",
      competidoresEnlazados: [],
      contexto: { urlContacto: "https://negocios-locales.example/alta" },
      creadaEn: hace(4),
    },
    {
      oportunidadId: "demo-op-07",
      resumen:
        "Comparador independiente. Tiene una tabla de precios por proveedor y acepta propuestas de inclusión por correo editorial.",
      quienEdita: "Medio digital",
      viaDeContacto: "email_editorial",
      competidoresEnlazados: ["competidor-ficticio.example"],
      contexto: {
        urlContacto: "https://comparador-de-asistentes.example/contacto",
      },
      creadaEn: hace(3),
    },
    {
      oportunidadId: "demo-op-08",
      resumen:
        "Asociación profesional. Su página de colaboradores se actualiza a petición.",
      quienEdita: "Asociación",
      viaDeContacto: "formulario",
      competidoresEnlazados: [],
      contexto: {
        urlContacto: "https://asociacion-peluqueros.example/contacto",
      },
      creadaEn: hace(6),
    },
    {
      oportunidadId: "demo-op-09",
      resumen:
        "Blog de un asesor para autónomos. Acepta menciones de herramientas útiles.",
      quienEdita: "Blog personal",
      viaDeContacto: "email_editorial",
      competidoresEnlazados: ["otra-recepcionista.example"],
      contexto: { urlContacto: "https://blog-autonomos.example/contacto" },
      creadaEn: hace(8),
    },
    {
      oportunidadId: "demo-op-10",
      resumen: "Directorio con alta mediante formulario y revisión previa.",
      quienEdita: "Directorio",
      viaDeContacto: "formulario",
      competidoresEnlazados: [],
      contexto: { urlContacto: "https://directorio-unas.example/alta" },
      creadaEn: hace(13),
    },
  ];

  const borradores: RegistroDeBorrador[] = [];
  const revisiones: RegistroDeRevision[] = [];
  const gestiones: RegistroDeGestion[] = [];

  const borrador = (
    id: string,
    parcial: Pick<
      RegistroDeBorrador,
      "oportunidadId" | "version" | "texto" | "estado" | "creadoEn"
    > &
      Partial<RegistroDeBorrador> & { tipo: TipoDeBorrador; objetivo: Objetivo }
  ) => {
    borradores.push({
      id,
      asunto: null,
      enlaceUrl: null,
      utm: null,
      afirmaciones: [],
      textoFinal: null,
      editadoPorHumano: false,
      similitudConVersionAnterior: null,
      ...parcial,
    });
  };

  const revision = (
    id: string,
    borradorId: string,
    resultado: Resultado,
    comprobaciones: Comprobacion[],
    creadaEn: string,
    revisor: "reglas" | "llm" = "reglas"
  ) => {
    revisiones.push({
      id,
      borradorId,
      resultado,
      comprobaciones,
      revisor,
      creadaEn,
    });
  };

  const bien = (regla: string, detalle: string, dura = true): Comprobacion => ({
    regla,
    ok: true,
    dura,
    detalle,
  });

  // Las 12 reglas duras y las 5 blandas del backend, todas en verde (salvo el
  // aviso de la versión anterior, si se da), con los mensajes reales y
  // calculadas sobre el propio borrador.
  const reglasLimpias = (
    borradorId: string,
    versionAnterior: number | null = null
  ): Comprobacion[] => {
    const b = borradores.find((x) => x.id === borradorId);
    if (!b)
      throw new Error(`Borrador de demostración sin sembrar: ${borradorId}`);
    const firma = b.tipo !== "ficha_directorio";
    const hablaDePrecio = mencionaPrecio(`${b.asunto ?? ""}\n${b.texto}`);
    const porcentaje = Math.round((versionAnterior ?? 0) * 100);
    const umbral = AJUSTES_POR_DEFECTO.umbralDeSimilitud;
    const seRepite = versionAnterior !== null && versionAnterior >= umbral;
    return [
      bien(
        "afirmaciones_vigentes",
        "Todas las afirmaciones citadas están vigentes."
      ),
      bien(
        "precio_trazable",
        hablaDePrecio
          ? "El precio que menciona cita una afirmación `precio.*`."
          : "No menciona precios ni minutos."
      ),
      bien("sin_terminos_prohibidos", "No usa ningún término prohibido."),
      bien("comparativa_con_fuente", "No nombra a ningún competidor."),
      bien(
        "identificacion",
        firma
          ? "Se identifica como parte de Alhabla."
          : "Una ficha no necesita firma."
      ),
      bien(
        "sin_esquemas_de_enlaces",
        "No propone intercambios ni enlaces de pago."
      ),
      bien("enlace_a_alhabla", "El enlace, si lo hay, apunta a alhabla.ai."),
      bien(
        "un_contacto_por_dominio",
        "No hay contactos con este dominio en los últimos 90 días."
      ),
      bien("tope_semanal", "Van 2 de 5 contactos esta semana."),
      bien("sin_plantilla_repetida", "Parecido máximo con lo anterior: 9 %."),
      bien(
        "sin_datos_personales",
        "No incluye correos ni teléfonos de terceros."
      ),
      bien(
        "tipo_acorde_con_objetivo",
        `Un borrador de tipo ${b.tipo} encaja con el objetivo ${b.objetivo}.`
      ),
      bien("similitud_alta", "Poco parecido con lo anterior.", false),
      {
        regla: "similitud_con_version_anterior",
        ok: !seRepite,
        dura: false,
        detalle: seRepite
          ? `Se parece un ${porcentaje} % a una versión anterior de esta misma oportunidad: apenas ha cambiado.`
          : versionAnterior === null
            ? "No hay una versión anterior con la que comparar."
            : `Parecido con la versión anterior: ${porcentaje} %.`,
      },
      bien("pocos_enlaces", "No abusa de los enlaces.", false),
      bien(
        "enlace_con_utm",
        b.enlaceUrl ? "El enlace lleva UTM." : "No lleva enlace.",
        false
      ),
      bien(
        "longitud_razonable",
        `Longitud de ${b.texto.trim().length} caracteres.`,
        false
      ),
    ];
  };

  // --- demo-op-04: con borrador, aún sin evaluar --------------------------
  borrador("demo-bo-04-1", {
    oportunidadId: "demo-op-04",
    version: 1,
    tipo: "email",
    objetivo: "BACKLINKS",
    asunto: "Una opción más para vuestro repaso de recepcionistas virtuales",
    texto:
      "Hola:\n\nAcabo de leer vuestro repaso de recepcionistas virtuales para pymes. Os escribo en nombre de Alhabla, una recepcionista de IA que contesta las llamadas de negocios con cita previa y reserva en su calendario.\n\nSi os encaja, estaríamos encantados de aparecer en la próxima actualización.\n\nUn saludo,\nEl equipo de Alhabla",
    afirmaciones: ["funcion.agenda_propia"],
    estado: "borrador",
    creadoEn: hace(0, 5),
  });

  // --- demo-op-05: dos versiones, la segunda por revisar -------------------
  borrador("demo-bo-05-1", {
    oportunidadId: "demo-op-05",
    version: 1,
    tipo: "email",
    objetivo: "BACKLINKS",
    asunto: "Alhabla para vuestro listado de recepcionistas de IA",
    texto:
      "Hola:\n\nOs escribo en nombre de Alhabla, una recepcionista de IA que contesta las llamadas de peluquerías, barberías y centros de estética y reserva la cita en su calendario. Vuestro listado «Recepcionistas de IA en España» no nos incluye y creemos que encajaría. El plan Pro cuesta 139 € al mes más IVA.\n\nSi os parece bien, os paso una ficha corta.\n\nUn saludo,\nEl equipo de Alhabla",
    afirmaciones: ["precio.plan.pro", "funcion.agenda_propia"],
    estado: "descartado",
    creadoEn: hace(5, 2),
  });
  revision(
    "demo-re-05-1",
    "demo-bo-05-1",
    "pasa",
    reglasLimpias("demo-bo-05-1"),
    hace(5, 2)
  );
  // La v2 sale de la nota «quita el precio»: casi lo mismo que la v1. El
  // parecido se calcula con el mismo algoritmo del backend.
  const textoV1 = borradores.find((b) => b.id === "demo-bo-05-1")!.texto;
  const textoV2 =
    "Hola:\n\nOs escribo en nombre de Alhabla, una recepcionista de IA que contesta las llamadas de peluquerías, barberías y centros de estética y reserva la cita en su calendario. Vuestro listado «Recepcionistas de IA en España» no nos incluye y creemos que encajaría.\n\nSi os parece bien, os paso una ficha corta.\n\nUn saludo,\nEl equipo de Alhabla";
  const parecidoV2 =
    Math.round(similitudDeTextos(textoV1, textoV2) * 100) / 100;
  borrador("demo-bo-05-2", {
    oportunidadId: "demo-op-05",
    version: 2,
    tipo: "email",
    objetivo: "BACKLINKS",
    asunto: "Alhabla para vuestro listado de recepcionistas de IA",
    texto: textoV2,
    enlaceUrl:
      "https://alhabla.ai/?utm_source=revista-pymes&utm_medium=referral&utm_campaign=backlinks",
    utm: {
      utm_source: "revista-pymes",
      utm_medium: "referral",
      utm_campaign: "backlinks",
    },
    afirmaciones: ["funcion.agenda_propia", "sector.peluqueria"],
    estado: "pendiente_aprobacion",
    similitudConVersionAnterior: parecidoV2,
    creadoEn: hace(2),
  });
  revision(
    "demo-re-05-2",
    "demo-bo-05-2",
    parecidoV2 >= AJUSTES_POR_DEFECTO.umbralDeSimilitud ? "aviso" : "pasa",
    reglasLimpias("demo-bo-05-2", parecidoV2),
    hace(2)
  );
  revision(
    "demo-re-05-2b",
    "demo-bo-05-2",
    "pasa",
    [
      {
        regla: "tono_y_claridad",
        ok: true,
        dura: false,
        detalle:
          "El texto es claro y no promete nada que no conste en las afirmaciones.",
      },
    ],
    hace(2),
    "llm"
  );

  // --- demo-op-06: limpia y a punto de caducar -----------------------------
  borrador("demo-bo-06-1", {
    oportunidadId: "demo-op-06",
    version: 1,
    tipo: "ficha_directorio",
    objetivo: "TRAFICO_MARCA",
    asunto: "Alta de Alhabla en el directorio",
    texto:
      "Alhabla coge el teléfono de tu negocio con cita previa, responde a las dudas de horarios y servicios y deja la cita reservada en tu calendario. Habla español y otros idiomas, también catalán, euskera y gallego.",
    enlaceUrl:
      "https://alhabla.ai/?utm_source=negocios-locales&utm_medium=directorio&utm_campaign=marca",
    utm: {
      utm_source: "negocios-locales",
      utm_medium: "directorio",
      utm_campaign: "marca",
    },
    afirmaciones: ["funcion.idiomas", "sector.barberia"],
    estado: "pendiente_aprobacion",
    creadoEn: hace(3),
  });
  revision(
    "demo-re-06-1",
    "demo-bo-06-1",
    "pasa",
    reglasLimpias("demo-bo-06-1"),
    hace(3)
  );

  // --- demo-op-07: bloqueada ----------------------------------------------
  borrador("demo-bo-07-1", {
    oportunidadId: "demo-op-07",
    version: 1,
    tipo: "email",
    objetivo: "BACKLINKS",
    asunto: "Incluid a Alhabla en vuestra comparativa",
    texto:
      "Hola:\n\nOs escribo en nombre de Alhabla. Somos más baratos que cualquier otra recepcionista, con resultados 100 % garantizado, y el plan Básico cuesta 29 € al mes. Nos encantaría estar en vuestra comparativa de asistentes telefónicos.\n\nUn saludo,\nEl equipo de Alhabla",
    afirmaciones: ["precio.plan.basico_antiguo"],
    estado: "bloqueado",
    creadoEn: hace(3),
  });
  revision(
    "demo-re-07-1",
    "demo-bo-07-1",
    "bloquea",
    reglasLimpias("demo-bo-07-1").map((c) =>
      c.regla === "afirmaciones_vigentes"
        ? {
            ...c,
            ok: false,
            detalle:
              "Afirmaciones que no existen o ya no valen: precio.plan.basico_antiguo.",
          }
        : c.regla === "sin_terminos_prohibidos"
          ? {
              ...c,
              ok: false,
              detalle: "Usa términos prohibidos: 100 % garantizado.",
            }
          : c
    ),
    hace(3)
  );

  // --- demo-op-08: devuelta con nota ---------------------------------------
  borrador("demo-bo-08-1", {
    oportunidadId: "demo-op-08",
    version: 1,
    tipo: "formulario",
    objetivo: "LEADS",
    asunto: null,
    texto:
      "Hola: somos el equipo de Alhabla, una recepcionista de IA para peluquerías. Nos gustaría saber cómo colaborar con la asociación y si hay alguna ventaja para los asociados. El plan Inicio cuesta 59 € al mes más IVA.",
    afirmaciones: ["precio.plan.inicio", "sector.peluqueria"],
    estado: "descartado",
    creadoEn: hace(6),
  });
  revision(
    "demo-re-08-1",
    "demo-bo-08-1",
    "pasa",
    reglasLimpias("demo-bo-08-1"),
    hace(6)
  );

  // --- demo-op-09: aprobada ------------------------------------------------
  borrador("demo-bo-09-1", {
    oportunidadId: "demo-op-09",
    version: 1,
    tipo: "email",
    objetivo: "BACKLINKS",
    asunto: "Una herramienta de citas por teléfono para vuestros lectores",
    texto:
      "Hola:\n\nHe leído vuestro artículo sobre herramientas para gestionar citas. Os escribo en nombre de Alhabla, una recepcionista de IA que contesta las llamadas de negocios con cita previa y reserva en el calendario de Google, Outlook o iCloud, o en su propia agenda.\n\nSi os parece útil para vuestros lectores, podéis mencionarla en el artículo; os pasamos los datos que necesitéis.\n\nUn saludo,\nEl equipo de Alhabla",
    enlaceUrl:
      "https://alhabla.ai/?utm_source=blog-autonomos&utm_medium=referral&utm_campaign=backlinks",
    utm: {
      utm_source: "blog-autonomos",
      utm_medium: "referral",
      utm_campaign: "backlinks",
    },
    afirmaciones: ["funcion.agenda_propia"],
    estado: "aprobado",
    creadoEn: hace(7),
  });
  revision(
    "demo-re-09-1",
    "demo-bo-09-1",
    "pasa",
    reglasLimpias("demo-bo-09-1"),
    hace(7)
  );

  // --- demo-op-10: gestionada (con el texto que de verdad se envió) --------
  borrador("demo-bo-10-1", {
    oportunidadId: "demo-op-10",
    version: 1,
    tipo: "ficha_directorio",
    objetivo: "TRAFICO_MARCA",
    asunto: "Alta de Alhabla",
    texto:
      "Alhabla es una recepcionista de IA para negocios con cita previa: contesta las llamadas y reserva la cita en el calendario del negocio.",
    enlaceUrl:
      "https://alhabla.ai/?utm_source=directorio-unas&utm_medium=directorio&utm_campaign=marca",
    afirmaciones: ["funcion.agenda_propia", "sector.salon-de-unas"],
    estado: "gestionado",
    textoFinal:
      "Alhabla es una recepcionista de IA para salones de uñas y otros negocios con cita previa: contesta las llamadas y reserva la cita en el calendario del negocio.",
    editadoPorHumano: true,
    creadoEn: hace(12),
  });
  revision(
    "demo-re-10-1",
    "demo-bo-10-1",
    "pasa",
    reglasLimpias("demo-bo-10-1"),
    hace(12)
  );
  gestiones.push({
    id: "demo-ge-10",
    borradorId: "demo-bo-10-1",
    canal: "formulario",
    dominio: "directorio-unas.example",
    hechaEn: hace(5),
    respuestaEn: null,
    resultado: "pendiente",
    urlConseguida: null,
    notas: "Rellené el formulario de alta; dicen que tardan una semana.",
  });

  // --- demo-op-11: conseguida ----------------------------------------------
  borrador("demo-bo-11-1", {
    oportunidadId: "demo-op-11",
    version: 1,
    tipo: "email",
    objetivo: "BACKLINKS",
    asunto: "Alhabla para vuestro listado de proveedores",
    texto:
      "Hola:\n\nOs escribo en nombre de Alhabla, una recepcionista de IA para negocios con cita previa. Nos gustaría figurar en vuestro listado de proveedores del sector belleza.\n\nUn saludo,\nEl equipo de Alhabla",
    enlaceUrl:
      "https://alhabla.ai/?utm_source=listado-belleza&utm_medium=referral&utm_campaign=backlinks",
    afirmaciones: ["sector.centro-de-estetica"],
    estado: "gestionado",
    creadoEn: hace(28),
  });
  revision(
    "demo-re-11-1",
    "demo-bo-11-1",
    "pasa",
    reglasLimpias("demo-bo-11-1"),
    hace(28)
  );
  gestiones.push({
    id: "demo-ge-11",
    borradorId: "demo-bo-11-1",
    canal: "email",
    dominio: "listado-belleza.example",
    hechaEn: hace(24),
    respuestaEn: hace(17),
    resultado: "aceptado",
    urlConseguida: "https://listado-belleza.example/proveedores/alhabla",
    notas: null,
  });

  // --- demo-op-12: el destino dijo que no ----------------------------------
  borrador("demo-bo-12-1", {
    oportunidadId: "demo-op-12",
    version: 1,
    tipo: "formulario",
    objetivo: "LEADS",
    texto:
      "Hola: somos el equipo de Alhabla, una recepcionista de IA para peluquerías. Nos gustaría colaborar con la academia y conocer a sus alumnos.",
    afirmaciones: ["sector.peluqueria"],
    estado: "gestionado",
    creadoEn: hace(23),
  });
  revision(
    "demo-re-12-1",
    "demo-bo-12-1",
    "pasa",
    reglasLimpias("demo-bo-12-1"),
    hace(23)
  );
  gestiones.push({
    id: "demo-ge-12",
    borradorId: "demo-bo-12-1",
    canal: "formulario",
    dominio: "academia-peluqueria.example",
    hechaEn: hace(20),
    respuestaEn: hace(12),
    resultado: "rechazado",
    urlConseguida: null,
    notas: "Contestaron que no aceptan patrocinadores este año.",
  });

  // --- demo-op-14: caducada. El job de caducidad descarta sus borradores abiertos;
  // aun así «Caducados» se define por la oportunidad, no por el estado del borrador.
  borrador("demo-bo-14-1", {
    oportunidadId: "demo-op-14",
    version: 1,
    tipo: "formulario",
    objetivo: "BACKLINKS",
    texto:
      "Hola: somos el equipo de Alhabla y presentamos nuestra recepcionista de IA al concurso de herramientas digitales para pymes.",
    afirmaciones: ["funcion.agenda_propia"],
    estado: "descartado",
    creadoEn: hace(35),
  });
  revision(
    "demo-re-14-1",
    "demo-bo-14-1",
    "pasa",
    reglasLimpias("demo-bo-14-1"),
    hace(35)
  );

  const fuente = (clave: string, ancla: string) => `${clave}#${ancla}`;
  const afirmacion = (
    clave: string,
    tipo: TipoDeAfirmacion,
    texto: string,
    origen: string,
    extra: Partial<RegistroDeAfirmacion> = {}
  ): RegistroDeAfirmacion => ({
    id: `demo-af-${clave}`,
    clave,
    tipo,
    texto,
    valor: null,
    fuente: origen,
    commitSha: COMMIT_ACTUAL,
    nichoSlug: null,
    vigenteDesde: hace(20),
    vigenteHasta: null,
    ...extra,
  });

  const afirmaciones: RegistroDeAfirmacion[] = [
    afirmacion(
      "precio.plan.inicio",
      "precio",
      "El plan Inicio cuesta 59 € al mes más IVA e incluye 200 minutos de llamadas.",
      fuente("demo/plans.ts", "inicio"),
      {
        valor: {
          plan: "inicio",
          cuotaEur: 59,
          minutosIncluidos: 200,
          minutoExtraEur: 0.3,
          ivaIncluido: false,
        },
      }
    ),
    afirmacion(
      "precio.plan.pro",
      "precio",
      "El plan Pro cuesta 139 € al mes más IVA e incluye 600 minutos de llamadas.",
      fuente("demo/plans.ts", "pro"),
      {
        valor: {
          plan: "pro",
          cuotaEur: 139,
          minutosIncluidos: 600,
          minutoExtraEur: 0.25,
          ivaIncluido: false,
        },
      }
    ),
    afirmacion(
      "precio.plan.scale",
      "precio",
      "El plan Scale cuesta 269 € al mes más IVA e incluye 1.500 minutos de llamadas.",
      fuente("demo/plans.ts", "scale"),
      {
        valor: {
          plan: "scale",
          cuotaEur: 269,
          minutosIncluidos: 1500,
          minutoExtraEur: 0.2,
          ivaIncluido: false,
        },
      }
    ),
    afirmacion(
      "funcion.agenda_propia",
      "funcion",
      "Alhabla reserva en el calendario de Google, Outlook o iCloud del negocio, o en su propia agenda si no usa ninguno.",
      fuente("demo/producto.md", "capacidades")
    ),
    afirmacion(
      "funcion.idiomas",
      "funcion",
      "Alhabla habla español y otros idiomas, y el catalán, euskera o gallego de la zona.",
      fuente("demo/producto.md", "idiomas")
    ),
    // Las que componen la «Ficha de Alhabla» (descripciones, precios, prueba).
    afirmacion(
      "pagina.inicio",
      "pagina",
      "Alhabla: Recepcionista de IA que atiende las llamadas de tu negocio y reserva las citas en su calendario.",
      fuente("demo/paginas.ts", "inicio")
    ),
    afirmacion(
      "funcion.atiende_a_cualquier_hora",
      "funcion",
      "Atiende las llamadas a cualquier hora, también fuera del horario del negocio.",
      fuente("demo/producto.md", "disponibilidad")
    ),
    afirmacion(
      "funcion.calendarios",
      "funcion",
      "Se conecta con Google Calendar, Outlook e iCloud, o usa la agenda de Alhabla.",
      fuente("demo/plans.ts", "calendarios")
    ),
    afirmacion(
      "funcion.confirmacion_por_whatsapp",
      "funcion",
      "Confirma la cita al cliente por WhatsApp.",
      fuente("demo/plans.ts", "confirmacion")
    ),
    afirmacion(
      "funcion.numero_de_espana",
      "funcion",
      "Da al negocio un número de teléfono de España.",
      fuente("demo/producto.md", "numero")
    ),
    afirmacion(
      "funcion.registro_de_llamadas",
      "funcion",
      "Guarda un registro de las llamadas con su transcripción.",
      fuente("demo/producto.md", "registro")
    ),
    afirmacion(
      "funcion.horario_servicios_y_equipo",
      "funcion",
      "Conoce el horario, los servicios y el equipo del negocio.",
      fuente("demo/producto.md", "negocio")
    ),
    afirmacion(
      "funcion.asistente_por_whatsapp",
      "funcion",
      "El dueño habla con su asistente por WhatsApp: avisos y consultas de la agenda.",
      fuente("demo/producto.md", "asistente")
    ),
    afirmacion(
      "precio.desde",
      "precio",
      "Los planes de Alhabla empiezan en 59 € + IVA al mes.",
      fuente("demo/plans.ts", "PRECIO_DESDE"),
      { valor: { cuotaEur: 59 } }
    ),
    afirmacion(
      "precio.iva",
      "precio",
      "Los precios se publican sin IVA; se añade el 21 %.",
      fuente("demo/plans.ts", "IVA_PORCENTAJE"),
      { valor: { ivaPorcentaje: 21 } }
    ),
    afirmacion(
      "precio.prueba",
      "precio",
      "14 días de prueba. Sin permanencia. Cancela cuando quieras.",
      fuente("demo/plans.ts", "TRIAL_REASSURANCE"),
      { valor: { diasDePrueba: 14, permanencia: false } }
    ),
    afirmacion(
      "limite.profesionales_inicio",
      "limite",
      "El plan Inicio admite hasta 3 profesionales en la agenda.",
      fuente("demo/plans.ts", "inicio"),
      { valor: { profesionales: 3 } }
    ),
    afirmacion(
      "limite.profesionales_pro",
      "limite",
      "El plan Pro admite hasta 10 profesionales en la agenda.",
      fuente("demo/plans.ts", "pro"),
      { valor: { profesionales: 10 } }
    ),
    afirmacion(
      "sector.peluqueria",
      "sector",
      "Alhabla atiende llamadas y reserva citas en peluquerías.",
      fuente("demo/sectores/peluqueria.ts", "intro"),
      { nichoSlug: "peluqueria" }
    ),
    afirmacion(
      "sector.barberia",
      "sector",
      "Alhabla atiende llamadas y reserva citas en barberías.",
      fuente("demo/sectores/barberia.ts", "intro"),
      { nichoSlug: "barberia" }
    ),
    afirmacion(
      "sector.centro-de-estetica",
      "sector",
      "Alhabla atiende llamadas y reserva citas en centros de estética.",
      fuente("demo/sectores/centro-de-estetica.ts", "intro"),
      { nichoSlug: "centro-de-estetica" }
    ),
    afirmacion(
      "sector.salon-de-unas",
      "sector",
      "Alhabla atiende llamadas y reserva citas en salones de uñas.",
      fuente("demo/sectores/salon-de-unas.ts", "intro"),
      { nichoSlug: "salon-de-unas" }
    ),
    afirmacion(
      "comparativa.competidor-ficticio",
      "comparativa",
      "Datos de ejemplo de un competidor ficticio, consultados en su web el día de la sincronización.",
      fuente("demo/comparativas.ts", "competidor-ficticio"),
      { valor: { competidorDominio: "competidor-ficticio.example" } }
    ),
    afirmacion(
      "pagina.planes",
      "pagina",
      "La página de planes y precios es /planes.",
      fuente("demo/paginas.ts", "planes")
    ),
    afirmacion(
      "prohibida.promesas_absolutas",
      "prohibida",
      "No se prometen resultados absolutos ni garantías que no consten en las condiciones.",
      fuente("demo/reglas/afirmaciones-prohibidas.md", "promesas"),
      {
        valor: {
          terminos: ["100 % garantizado", "sin límites", "el mejor del mundo"],
        },
      }
    ),
    afirmacion(
      "prohibida.proveedores",
      "prohibida",
      "No se nombra a los proveedores de infraestructura en textos de cara al público.",
      fuente("demo/reglas/afirmaciones-prohibidas.md", "proveedores"),
      { valor: { terminos: ["proveedor-ficticio"] } }
    ),
    // Una afirmación cerrada hace dos semanas: sale en «cambios recientes».
    afirmacion(
      "precio.plan.basico_antiguo",
      "precio",
      "El plan Básico cuesta 29 € al mes (tabla de precios anterior).",
      fuente("demo/plans.ts", "basico"),
      {
        commitSha: COMMIT_ANTIGUO,
        vigenteDesde: hace(90),
        vigenteHasta: hace(14),
      }
    ),
  ];

  const decisiones: RegistroDeDecisionDemo[] = [];
  let numeroDeDecision = 0;
  const decision = (
    oportunidadId: string | null,
    borradorId: string | null,
    accion: string,
    motivo: string | null,
    por: string,
    en: string
  ) => {
    numeroDeDecision += 1;
    decisiones.push({
      id: `demo-de-${String(numeroDeDecision).padStart(3, "0")}`,
      oportunidadId,
      borradorId,
      accion,
      motivo,
      por,
      en,
    });
  };
  const yo = CORREO_DE_DEMOSTRACION;
  const agente = "agente:orquestador";

  decision("demo-op-01", null, "anadir_url", null, yo, hace(0, 2));
  decision(
    null,
    null,
    "conocimiento_sincronizado",
    `commit ${COMMIT_ACTUAL}: +2 ~1 -1`,
    agente,
    hace(2)
  );
  decision(
    "demo-op-05",
    "demo-bo-05-1",
    "devolver",
    "Quita el precio del primer correo y no prometas más de lo que consta en las afirmaciones.",
    yo,
    hace(4)
  );
  decision("demo-op-05", null, "investigar", null, agente, hace(5));
  decision(
    "demo-op-07",
    "demo-bo-07-1",
    "bloquear_por_reglas",
    "afirmaciones_vigentes, sin_terminos_prohibidos",
    "sistema",
    hace(3)
  );
  decision(
    "demo-op-08",
    "demo-bo-08-1",
    "devolver",
    "Menciona un precio que prefiero no dar en un primer contacto con una asociación.",
    yo,
    hace(5)
  );
  decision("demo-op-09", "demo-bo-09-1", "aprobar", null, yo, hace(6));
  decision("demo-op-10", "demo-bo-10-1", "aprobar", null, yo, hace(11));
  decision(
    "demo-op-10",
    "demo-bo-10-1",
    "marcar_gestionado",
    null,
    yo,
    hace(5)
  );
  decision("demo-op-11", "demo-bo-11-1", "aprobar", null, yo, hace(27));
  decision(
    "demo-op-11",
    "demo-bo-11-1",
    "marcar_gestionado",
    null,
    yo,
    hace(24)
  );
  decision("demo-op-11", "demo-bo-11-1", "conseguido", null, yo, hace(17));
  decision("demo-op-12", "demo-bo-12-1", "aprobar", null, yo, hace(22));
  decision(
    "demo-op-12",
    "demo-bo-12-1",
    "marcar_gestionado",
    null,
    yo,
    hace(20)
  );
  decision("demo-op-12", "demo-bo-12-1", "rechazado", null, yo, hace(12));
  decision(
    "demo-op-13",
    null,
    "descartar",
    "Es un foro de bricolaje: nada que ver con negocios con cita.",
    yo,
    hace(6)
  );
  decision(
    "demo-op-15",
    null,
    "descartar",
    "Es la web de un competidor.",
    agente,
    hace(2)
  );
  decision(
    "demo-op-16",
    null,
    "descartar",
    "Página en inglés para otro mercado.",
    agente,
    hace(4)
  );
  decision("demo-op-14", "demo-bo-14-1", "aprobar", null, yo, hace(33));
  decision(
    "demo-op-14",
    "demo-bo-14-1",
    "caducar",
    `Venció el ${hace(3).slice(0, 10)} sin gestionarse`,
    "sistema",
    hace(3)
  );

  const almacen: AlmacenDeDemostracion = {
    origen: DEMO_ALHABLA_GROWTH_SENTINELA,
    oportunidades,
    investigaciones,
    borradores,
    revisiones,
    decisiones,
    gestiones,
    afirmaciones,
    ejecuciones,
    fuentes,
    nichos,
    competidores: competidoresDeEjemplo(hace),
    tareas: tareasDeEjemplo(hace),
    ajustes: {
      valores: copiar(AJUSTES_POR_DEFECTO),
      actualizadoEn: {
        topeSemanal: hace(10),
        umbralDeSimilitud: null,
        umbralesPorObjetivo: hace(10),
        pausa: null,
      },
    },
    snapshot: { commitSha: COMMIT_ACTUAL, sincronizadoEn: hace(2) },
  };

  return opciones.vacio ? vaciarLaBandeja(almacen) : almacen;
}

/**
 * Cuatro competidores que cubren los cuatro estados: uno del repositorio
 * revisado (con el análisis ya caducado), otro del repositorio por analizar,
 * uno añadido a mano con dos versiones (la última, con precios, por revisar)
 * y uno propuesto por el agente. Todo inventado, con dominios `.example`.
 */
function competidoresDeEjemplo(
  hace: (dias: number, horas?: number) => string
): RegistroDeCompetidor[] {
  return [
    {
      id: "demo-co-1",
      nombre: "Competidor ficticio",
      dominio: "competidor-ficticio.example",
      url: "https://competidor-ficticio.example/precios",
      notas: "Solo para la demostración.",
      origen: "repo",
      estado: "revisado",
      creadoEn: hace(120),
      analisisSolicitadoEn: null,
      analisis: [
        {
          id: "demo-an-1-1",
          version: 1,
          resumen:
            "Recepcionista de IA genérica para pymes: atiende llamadas y toma recados. Planes por minutos, sin agenda propia.",
          datos: [
            {
              tipo: "producto",
              etiqueta: "Recepcionista telefónica",
              texto:
                "Atiende las llamadas del negocio 24 horas y envía un resumen por correo.",
              urlFuente: "https://competidor-ficticio.example/producto",
              consultadoEn: hace(95),
            },
            {
              tipo: "plan",
              etiqueta: "Plan Básico",
              texto: "Hasta 100 minutos al mes incluidos.",
              valor: {
                importe: 49,
                moneda: "EUR",
                periodo: "mes",
                ivaIncluido: false,
              },
              urlFuente: "https://competidor-ficticio.example/precios",
              consultadoEn: hace(95),
            },
            {
              tipo: "integracion",
              etiqueta: "Google Calendar",
              texto: "Reserva citas en Google Calendar.",
              urlFuente: "https://competidor-ficticio.example/integraciones",
              consultadoEn: hace(95),
            },
          ],
          creadoEn: hace(95),
          creadoPor: "agente-de-ejemplo",
          revisadoEn: hace(94),
          notaDeRevision: "Datos correctos. Repetir en tres meses.",
        },
      ],
    },
    {
      id: "demo-co-2",
      nombre: "Otra recepcionista (ejemplo)",
      dominio: "otra-recepcionista.example",
      url: null,
      notas: null,
      origen: "repo",
      estado: "por_analizar",
      creadoEn: hace(120),
      analisisSolicitadoEn: hace(0, 5),
      analisis: [],
    },
    {
      id: "demo-co-3",
      nombre: "Recepción Express (ejemplo)",
      dominio: "recepcion-express.example",
      url: "https://recepcion-express.example/",
      notas: "Lo vi en un directorio de software para estética.",
      origen: "manual",
      estado: "analizado",
      creadoEn: hace(20),
      analisisSolicitadoEn: null,
      analisis: [
        {
          id: "demo-an-3-1",
          version: 1,
          resumen:
            "Asistente telefónico para clínicas y centros de estética. Primera lectura de la web.",
          datos: [
            {
              tipo: "servicio",
              etiqueta: "Atención de llamadas",
              texto: "Contesta llamadas y reserva citas en su propia agenda.",
              urlFuente: "https://recepcion-express.example/servicio",
              consultadoEn: hace(15),
            },
          ],
          creadoEn: hace(15),
          creadoPor: "agente-de-ejemplo",
          revisadoEn: hace(14),
          notaDeRevision: null,
        },
        {
          id: "demo-an-3-2",
          version: 2,
          resumen:
            "Recepcionista de IA para clínicas y centros de estética con agenda propia. Cobra por plan mensual más un extra por minuto; ofrece pago anual con descuento. Atiende en castellano y catalán y avisa por WhatsApp.",
          datos: [
            {
              tipo: "producto",
              etiqueta: "Recepcionista con agenda propia",
              texto:
                "Contesta llamadas y gestiona una agenda propia que sustituye al calendario del negocio.",
              urlFuente: "https://recepcion-express.example/producto",
              consultadoEn: hace(2),
            },
            {
              tipo: "servicio",
              etiqueta: "Atención las 24 horas",
              texto: "Contesta de lunes a domingo, también fuera de horario.",
              urlFuente: "https://recepcion-express.example/servicio",
              consultadoEn: hace(2),
            },
            {
              tipo: "plan",
              etiqueta: "Plan Pro",
              texto: "300 minutos al mes y hasta 5 profesionales.",
              valor: {
                importe: 79,
                moneda: "EUR",
                periodo: "mes",
                ivaIncluido: false,
              },
              urlFuente: "https://recepcion-express.example/precios",
              consultadoEn: hace(2),
            },
            {
              tipo: "plan",
              etiqueta: "Plan Pro anual",
              texto: "El mismo plan Pro pagado por adelantado un año.",
              valor: {
                importe: 790,
                moneda: "EUR",
                periodo: "anio",
                ivaIncluido: true,
              },
              urlFuente: "https://recepcion-express.example/precios",
              consultadoEn: hace(2),
            },
            {
              tipo: "precio",
              etiqueta: "Minutos extra",
              texto: "Cada minuto por encima del plan.",
              valor: {
                importe: 0.12,
                moneda: "EUR",
                periodo: "uso",
                unidad: "minuto",
                ivaIncluido: false,
              },
              urlFuente: "https://recepcion-express.example/precios",
              consultadoEn: hace(2),
            },
            {
              tipo: "integracion",
              etiqueta: "WhatsApp",
              texto: "Avisa al dueño por WhatsApp cuando entra una cita.",
              urlFuente: "https://recepcion-express.example/integraciones",
              consultadoEn: hace(2),
            },
            {
              tipo: "idioma",
              etiqueta: "Castellano y catalán",
              texto: "Atiende en dos idiomas.",
              urlFuente: "https://recepcion-express.example/producto",
              consultadoEn: hace(2),
            },
            {
              tipo: "limite",
              etiqueta: "Sin calendarios externos",
              texto:
                "No se conecta a Google Calendar ni a Outlook: solo su agenda.",
              urlFuente: "https://recepcion-express.example/preguntas",
              consultadoEn: hace(2),
            },
            {
              tipo: "diferencia",
              etiqueta: "Agenda propia obligatoria",
              texto:
                "Hay que usar su agenda; Alhabla trabaja con el calendario que el negocio ya usa.",
              urlFuente: "https://recepcion-express.example/producto",
              consultadoEn: hace(2),
            },
          ],
          creadoEn: hace(2),
          creadoPor: "agente-de-ejemplo",
          revisadoEn: null,
          notaDeRevision: null,
        },
      ],
    },
    {
      id: "demo-co-4",
      nombre: "Atiende24 (ejemplo)",
      dominio: "atiende24.example",
      url: "https://atiende24.example/",
      notas:
        "Propuesto por el agente: sale en tres listas de «alternativas a» recepcionistas de IA. Visto en https://guia-de-pymes.example/herramientas-para-peluquerias.",
      origen: "agente",
      estado: "propuesto",
      creadoEn: hace(1),
      analisisSolicitadoEn: null,
      analisis: [],
    },
  ];
}

/**
 * Las tareas que ya tocó el fundador en la demostración: una descartada de las
 * del repositorio (AlternativeTo, que solo tiene registro de usuario) y una
 * añadida a mano ya hecha. Las iniciales que faltan las siembra la propia
 * demostración al pedir la lista (`tareas-demo.ts`).
 */
function tareasDeEjemplo(
  hace: (dias: number, horas?: number) => string
): RegistroDeTarea[] {
  return [
    {
      id: "demo-ta-alternativeto",
      siembra: "alternativeto",
      titulo: "AlternativeTo",
      dominio: "alternativeto.net",
      url: "https://alternativeto.net/",
      categoria: "directorio_software",
      pasos: [
        "Abre la página.",
        "Busca «para proveedores», «añadir producto» o «sugerir herramienta».",
      ],
      notas: "Solo se localizó registro de usuario.",
      origen: "repo",
      estado: "descartada",
      resultado: null,
      notaDeResultado:
        "Solo deja sugerir alternativas con una cuenta de usuario.",
      hechaEn: null,
      creadoEn: hace(30),
      orden: 5,
    },
    {
      id: "demo-ta-guia-de-pymes",
      siembra: null,
      titulo: "Guía de herramientas para pymes (ejemplo)",
      dominio: "guia-de-pymes.example",
      url: "https://guia-de-pymes.example/herramientas",
      categoria: "otro",
      pasos: [
        "Abre la página.",
        "Rellena el formulario de «Sugerir una herramienta» con la Ficha de Alhabla.",
      ],
      notas: "Añadida a mano desde un artículo de comparativas.",
      origen: "manual",
      estado: "hecha",
      resultado: "alta_creada",
      notaDeResultado: "Publicada con el enlace a la página de planes.",
      hechaEn: hace(6),
      creadoEn: hace(9),
      orden: 0,
    },
  ];
}

/**
 * `?vacio=1`: ve el panel como si el agente no hubiera dejado nada pendiente.
 * Se quitan las oportunidades que viven en la Bandeja (con sus borradores,
 * revisiones y decisiones); el historial y los descartes de la semana se
 * quedan, que es justo lo que enseña el estado vacío honesto.
 */
function vaciarLaBandeja(
  almacen: AlmacenDeDemostracion
): AlmacenDeDemostracion {
  const enLaBandeja: ReadonlySet<EstadoDeOportunidad> = new Set([
    "detectada",
    "calificada",
    "investigada",
    "con_borrador",
    "pendiente_aprobacion",
    "aprobada",
    "bloqueada",
    "devuelta",
  ]);
  const fuera = new Set(
    almacen.oportunidades
      .filter((o) => enLaBandeja.has(o.estado))
      .map((o) => o.id)
  );
  const borradoresFuera = new Set(
    almacen.borradores
      .filter((b) => fuera.has(b.oportunidadId))
      .map((b) => b.id)
  );
  return {
    ...almacen,
    oportunidades: almacen.oportunidades.filter((o) => !fuera.has(o.id)),
    investigaciones: almacen.investigaciones.filter(
      (i) => !fuera.has(i.oportunidadId)
    ),
    borradores: almacen.borradores.filter((b) => !fuera.has(b.oportunidadId)),
    revisiones: almacen.revisiones.filter(
      (r) => !borradoresFuera.has(r.borradorId)
    ),
    decisiones: almacen.decisiones.filter(
      (d) => d.oportunidadId === null || !fuera.has(d.oportunidadId)
    ),
  };
}
