import type {
  Afirmacion,
  Ajustes,
  CompetidorResumen,
  DecisionDelHistorial,
  DetalleDeEjecucion,
  EjecucionResumen,
  GestionDelHistorial,
  ListaDeDecisiones,
  ListaDeEjecuciones,
  ListaDeGestiones,
  RespuestaDeConocimiento,
  Snapshot,
  TipoDeAfirmacion,
} from "@/lib/types";
import { TIPOS_DE_AFIRMACION } from "@/lib/types";

/**
 * Datos de prueba de las vistas de Historial, Conocimiento, Ejecuciones y
 * Ajustes, con la forma exacta de la API. Cada fábrica acepta cambios.
 */

const HORA = 3_600_000;

/** Una fecha ISO de hace `horas` horas. */
export function hace(horas: number): string {
  return new Date(Date.now() - horas * HORA).toISOString();
}

// --- Historial ---------------------------------------------------------------

export function decision(
  cambios: Partial<DecisionDelHistorial> = {}
): DecisionDelHistorial {
  return {
    id: "d1",
    accion: "aprobar",
    motivo: null,
    por: "ana@alhabla.ai",
    en: hace(2),
    oportunidad: {
      id: "op-1",
      titulo: "Listado de recepcionistas de IA",
      dominio: "revista-pymes.example",
      url: "https://revista-pymes.example/listado",
      estado: "aprobada",
    },
    borrador: { id: "bo-1", version: 2, tipo: "email" },
    ...cambios,
  };
}

export function listaDeDecisiones(
  data: DecisionDelHistorial[],
  extra: Partial<ListaDeDecisiones> = {}
): ListaDeDecisiones {
  return {
    data,
    total: data.length,
    pagina: 1,
    limite: 20,
    conteos: { porAccion: { aprobar: 3, devolver: 1, ajustes: 2 } },
    ...extra,
  };
}

export function gestion(
  cambios: Partial<GestionDelHistorial> = {}
): GestionDelHistorial {
  return {
    id: "g1",
    canal: "email",
    dominio: "revista-pymes.example",
    hechaEn: hace(30),
    respuestaEn: null,
    resultado: "pendiente",
    urlConseguida: null,
    notas: null,
    borrador: {
      id: "bo-1",
      version: 2,
      tipo: "email",
      asunto: "Una recepcionista de IA para vuestro listado",
      textoFinal: null,
      editadoPorHumano: false,
    },
    oportunidad: {
      id: "op-1",
      titulo: "Listado de recepcionistas de IA",
      url: "https://revista-pymes.example/listado",
      estado: "gestionada",
      objetivoPrincipal: "BACKLINKS",
    },
    ...cambios,
  };
}

export function listaDeGestiones(
  data: GestionDelHistorial[],
  extra: Partial<ListaDeGestiones> = {}
): ListaDeGestiones {
  return {
    data,
    total: data.length,
    pagina: 1,
    limite: 20,
    conteos: {
      porResultado: {
        pendiente: 2,
        aceptado: 3,
        rechazado: 1,
        sin_respuesta: 4,
      },
    },
    ...extra,
  };
}

// --- Conocimiento --------------------------------------------------------------

export function afirmacion(cambios: Partial<Afirmacion> = {}): Afirmacion {
  return {
    id: "a1",
    clave: "precio.plan.pro",
    tipo: "precio",
    texto: "El plan Pro cuesta 139 € al mes más IVA.",
    valor: { precio: 139 },
    fuente: "web/src/lib/plans.ts#pro",
    commitSha: "abc1234def5678",
    nichoSlug: null,
    vigenteDesde: hace(24 * 20),
    ...cambios,
  };
}

export function snapshot(
  cambios: Partial<NonNullable<Snapshot>> = {}
): Snapshot {
  return {
    commitSha: "9f8e7d6c5b4a3210",
    sincronizadoEn: hace(2),
    antiguedadHoras: 2,
    obsoleto: false,
    vigentes: 5,
    porTipo: {
      precio: 1,
      funcion: 1,
      limite: 1,
      sector: 1,
      comparativa: 0,
      pagina: 0,
      prohibida: 1,
    },
    ...cambios,
  };
}

/** Una base pequeña que cubre los tipos más importantes. */
export function conocimiento(
  cambios: Partial<RespuestaDeConocimiento> = {}
): RespuestaDeConocimiento {
  const porTipo = Object.fromEntries(
    TIPOS_DE_AFIRMACION.map((tipo) => [tipo, [] as Afirmacion[]])
  ) as Record<TipoDeAfirmacion, Afirmacion[]>;
  porTipo.precio = [afirmacion()];
  porTipo.funcion = [
    afirmacion({
      id: "a2",
      clave: "funcion.agenda_propia",
      tipo: "funcion",
      texto: "Alhabla reserva en el calendario del negocio o en su agenda.",
      valor: null,
      fuente: "PRODUCT.md#capacidades",
    }),
  ];
  porTipo.limite = [
    afirmacion({
      id: "a3",
      clave: "limite.profesionales_inicio",
      tipo: "limite",
      texto: "El plan Inicio admite hasta 3 profesionales en la agenda.",
      valor: { profesionales: 3 },
      fuente: "web/src/lib/plans.ts#inicio",
    }),
  ];
  porTipo.sector = [
    afirmacion({
      id: "a4",
      clave: "sector.peluqueria",
      tipo: "sector",
      texto: "Alhabla atiende llamadas y reserva citas en peluquerías.",
      valor: null,
      fuente: "web/src/lib/sectores/peluqueria.ts#intro",
      nichoSlug: "peluqueria",
    }),
  ];
  porTipo.prohibida = [
    afirmacion({
      id: "a5",
      clave: "prohibida.promesas_absolutas",
      tipo: "prohibida",
      texto: "No se prometen resultados absolutos.",
      valor: {
        terminos: ["100 % garantizado", "sin límites"],
        palabrasEnteras: true,
      },
      fuente: "growth/agentes/reglas/afirmaciones-prohibidas.md#promesas",
    }),
  ];
  const conteos = Object.fromEntries(
    TIPOS_DE_AFIRMACION.map((tipo) => [tipo, porTipo[tipo].length])
  ) as Record<TipoDeAfirmacion, number>;
  return {
    snapshot: snapshot(),
    conteos,
    porTipo,
    cambiosRecientes: [],
    truncado: false,
    ...cambios,
  };
}

// --- Ejecuciones -----------------------------------------------------------------

export function ejecucion(
  cambios: Partial<EjecucionResumen> = {}
): EjecucionResumen {
  return {
    id: "ej-1",
    disparador: "programada",
    inicio: hace(26),
    fin: hace(25),
    estado: "ok",
    resumen: {
      candidatas: 23,
      calificadas: 6,
      descartadas: 17,
      borradores: 4,
      bloqueadas: 1,
    },
    modulos: null,
    versionPrompts: "9f8e7d6",
    error: null,
    duracionSegundos: 3600,
    oportunidades: 23,
    ...cambios,
  };
}

export function listaDeEjecuciones(
  data: EjecucionResumen[],
  extra: Partial<ListaDeEjecuciones> = {}
): ListaDeEjecuciones {
  return { data, total: data.length, pagina: 1, limite: 20, ...extra };
}

export function detalleDeEjecucion(
  cambios: Partial<DetalleDeEjecucion> = {}
): DetalleDeEjecucion {
  return {
    ...ejecucion(),
    modulos: {
      discovery: { estado: "ok" },
      investigacion: {
        estado: "parcial",
        notas: "Dos páginas no cargaron.",
        inicio: "2026-10-29T10:00:00.000Z",
        fin: "2026-10-29T10:05:30.000Z",
      },
      cumplimiento: { estado: "error", error: "El revisor no respondió." },
    },
    oportunidadesPorEstado: { descartada: 17, pendiente_aprobacion: 5 },
    descartesPorMotivo: [
      { codigo: "irrelevante", n: 10 },
      { codigo: "bajo_umbral", n: 5 },
      { codigo: "idioma", n: 2 },
    ],
    oportunidades: [
      {
        id: "op-9",
        titulo: "Directorio de negocios locales",
        dominio: "directorio.example",
        estado: "pendiente_aprobacion",
        objetivoPrincipal: "BACKLINKS",
        codigoDescarte: null,
      },
      {
        id: "op-10",
        titulo: "Foro de bricolaje",
        dominio: "bricolaje.example",
        estado: "descartada",
        objetivoPrincipal: "LEADS",
        codigoDescarte: "irrelevante",
      },
    ],
    ...cambios,
  };
}

// --- Ajustes ----------------------------------------------------------------------

export function ajustes(cambios: Partial<Ajustes> = {}): Ajustes {
  return {
    valores: {
      topeSemanal: 5,
      umbralDeSimilitud: 0.6,
      umbralesPorObjetivo: { TRAFICO_MARCA: 60, LEADS: 60, BACKLINKS: 60 },
      pausa: false,
    },
    porDefecto: {
      topeSemanal: 5,
      umbralDeSimilitud: 0.6,
      umbralesPorObjetivo: { TRAFICO_MARCA: 60, LEADS: 60, BACKLINKS: 60 },
      pausa: false,
    },
    actualizadoEn: {
      topeSemanal: null,
      umbralDeSimilitud: null,
      umbralesPorObjetivo: null,
      pausa: null,
    },
    limites: {
      topeSemanal: [0, 20],
      umbralDeSimilitud: [0.4, 0.9],
      umbralesPorObjetivo: [0, 100],
    },
    soloLectura: { retencionDias: 180, diasEntreContactosAlMismoDominio: 90 },
    ...cambios,
  };
}

export function competidor(
  cambios: Partial<CompetidorResumen> = {}
): CompetidorResumen {
  return {
    id: "co-1",
    nombre: "Competidor ficticio",
    dominio: "competidor-ficticio.example",
    url: null,
    notas: null,
    origen: "repo",
    estado: "por_analizar",
    creadoEn: "2026-10-01T09:00:00.000Z",
    analisisSolicitadoEn: null,
    oportunidades: 2,
    menciones: 0,
    analisis: null,
    ...cambios,
  };
}
