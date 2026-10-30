import type {
  AfirmacionDetallada,
  BorradorDetallado,
  BorradorResumen,
  Comprobacion,
  DetalleDeOportunidad,
  EstadoDeOportunidad,
  ListaDeBorradores,
  ListaDeOportunidades,
  OportunidadResumen,
  Resumen,
  Revision,
} from "@/lib/types";
import { ESTADOS_DE_OPORTUNIDAD } from "@/lib/types";

/**
 * Fábricas de datos para los tests de Bandeja, Revisión y Borradores. Cada una
 * da un caso «normal» y deja cambiar lo que importa en el test; nada de aquí
 * usa `Date.now()` salvo `ahoraMas`, para que los plazos sean legibles.
 */

const DIA = 24 * 60 * 60 * 1000;

/** Una fecha ISO a `dias` días de ahora (negativo = pasado). */
export function ahoraMas(dias: number): string {
  return new Date(Date.now() + dias * DIA).toISOString();
}

export function comprobacion(
  parcial: Partial<Comprobacion> = {}
): Comprobacion {
  return {
    regla: "identificacion",
    ok: true,
    dura: true,
    detalle: "Dice quién escribe y de parte de quién.",
    ...parcial,
  };
}

export const REGLAS_LIMPIAS: Comprobacion[] = [
  comprobacion({ regla: "afirmaciones_vigentes", detalle: "Todas vigentes." }),
  comprobacion({ regla: "sin_terminos_prohibidos", detalle: "Ninguno." }),
  comprobacion({ regla: "identificacion" }),
];

export const REGLA_DURA_ROTA: Comprobacion = comprobacion({
  regla: "sin_terminos_prohibidos",
  ok: false,
  dura: true,
  detalle: "Usa el término prohibido «número 1».",
});

export const AVISO_DE_PARECIDO: Comprobacion = comprobacion({
  regla: "similitud_con_version_anterior",
  ok: false,
  dura: false,
  detalle: "Se parece un 38 % a la versión anterior.",
});

export function revision(parcial: Partial<Revision> = {}): Revision {
  const comprobaciones = parcial.comprobaciones ?? REGLAS_LIMPIAS;
  return {
    id: "re-1",
    borradorId: "bo-1",
    resultado: comprobaciones.some((c) => !c.ok && c.dura)
      ? "bloquea"
      : comprobaciones.some((c) => !c.ok)
        ? "aviso"
        : "pasa",
    comprobaciones,
    revisor: "reglas",
    creadaEn: ahoraMas(-1),
    ...parcial,
  };
}

export function afirmacion(
  parcial: Partial<AfirmacionDetallada> = {}
): AfirmacionDetallada {
  return {
    clave: "precio.plan.pro",
    existe: true,
    tipo: "precio",
    texto: "El plan Pro cuesta 139 € al mes más IVA.",
    valor: null,
    fuente: "web/src/lib/plans.ts#pro",
    commitSha: "abcdef1234567890",
    vigente: true,
    vigenteDesde: ahoraMas(-30),
    vigenteHasta: null,
    ...parcial,
  };
}

export function borrador(
  parcial: Partial<BorradorDetallado> = {}
): BorradorDetallado {
  return {
    id: "bo-1",
    oportunidadId: "op-1",
    version: 1,
    tipo: "email",
    objetivo: "BACKLINKS",
    asunto: "Una recepcionista de IA para vuestro listado",
    texto: "Hola:\n\nSomos Alhabla.\n\nUn saludo.",
    enlaceUrl: "https://alhabla.ai/?utm_source=revista&utm_medium=referral",
    utm: null,
    afirmaciones: ["precio.plan.pro"],
    estado: "pendiente_aprobacion",
    textoFinal: null,
    editadoPorHumano: false,
    creadoEn: ahoraMas(-2),
    afirmacionesDetalle: [afirmacion()],
    similitudConVersionAnterior: null,
    revisiones: [revision()],
    gestion: null,
    ...parcial,
  };
}

export function detalle(
  parcial: Partial<DetalleDeOportunidad> = {}
): DetalleDeOportunidad {
  const borradores = parcial.borradores ?? [borrador()];
  return {
    id: "op-1",
    claveExterna: "revista.example/listado",
    fuenteId: "fuente_web",
    nichoId: null,
    url: "https://revista.example/listado",
    dominio: "revista.example",
    titulo: "Recepcionistas de IA en España",
    extracto: "Un listado con las recepcionistas de IA.",
    idioma: "es",
    detectadaEn: ahoraMas(-6),
    objetivoPrincipal: "BACKLINKS",
    puntTrafico: 62,
    puntLeads: 58,
    puntBacklinks: 84,
    estado: "pendiente_aprobacion",
    motivoDescarte: null,
    datos: { tipoDestino: "comparativa", dificultad: "media" },
    codigoDescarte: null,
    expiraEn: ahoraMas(25),
    retencionHasta: ahoraMas(170),
    ejecucionId: null,
    puntuacion: 84,
    puntuaciones: { TRAFICO_MARCA: 62, LEADS: 58, BACKLINKS: 84 },
    extractoPurgado: false,
    diasParaCaducar: 25,
    fuente: { id: "fuente_web", tipo: "web", nombre: "Búsqueda web" },
    nicho: null,
    ejecucion: null,
    investigacion: {
      oportunidadId: "op-1",
      resumen: "Revista digital. La redacción actualiza el listado.",
      quienEdita: "Medio digital",
      viaDeContacto: "formulario",
      competidoresEnlazados: ["competidor.example"],
      contexto: { urlContacto: "https://revista.example/contacto" },
      creadaEn: ahoraMas(-5),
    },
    borradores,
    decisiones: [],
    borradorEditableId:
      borradores.find(
        (b) => b.estado === "pendiente_aprobacion" || b.estado === "bloqueado"
      )?.id ?? null,
    acciones: [
      { accion: "aprobar", habilitada: true },
      { accion: "devolver", habilitada: true },
      { accion: "descartar", habilitada: true },
    ],
    contacto: {
      dominioEnEnfriamientoHasta: null,
      contactosEstaSemana: 2,
      topeSemanal: 5,
    },
    ...parcial,
  };
}

export function oportunidad(
  parcial: Partial<OportunidadResumen> = {}
): OportunidadResumen {
  return {
    id: "op-1",
    url: "https://revista.example/listado",
    dominio: "revista.example",
    titulo: "Recepcionistas de IA en España",
    extracto: "Un listado con las recepcionistas de IA.",
    extractoPurgado: false,
    idioma: "es",
    objetivoPrincipal: "BACKLINKS",
    estado: "pendiente_aprobacion",
    puntuacion: 84,
    puntuaciones: { TRAFICO_MARCA: 62, LEADS: 58, BACKLINKS: 84 },
    datos: null,
    detectadaEn: ahoraMas(-3),
    expiraEn: ahoraMas(25),
    diasParaCaducar: 25,
    motivoDescarte: null,
    codigoDescarte: null,
    ejecucionId: null,
    fuente: { id: "fuente_web", tipo: "web", nombre: "Búsqueda web" },
    nicho: null,
    borradorActual: null,
    ...parcial,
  };
}

export function conteosVacios(): Record<EstadoDeOportunidad, number> {
  return Object.fromEntries(
    ESTADOS_DE_OPORTUNIDAD.map((e) => [e, 0])
  ) as Record<EstadoDeOportunidad, number>;
}

export function lista(
  data: OportunidadResumen[],
  parcial: Partial<ListaDeOportunidades> = {}
): ListaDeOportunidades {
  return {
    data,
    total: data.length,
    pagina: 1,
    limite: 20,
    conteos: { porEstado: conteosVacios() },
    ...parcial,
  };
}

export function resumenDeSemana(parcial: Partial<Resumen> = {}): Resumen {
  return {
    pausa: false,
    ajustes: {
      topeSemanal: 5,
      umbralDeSimilitud: 0.6,
      umbralesPorObjetivo: { TRAFICO_MARCA: 60, LEADS: 60, BACKLINKS: 60 },
      pausa: false,
    },
    porEstado: conteosVacios(),
    paraRevisar: 3,
    aprobadasSinGestionar: 1,
    bloqueadas: 2,
    devueltas: 0,
    porCaducar: [],
    contactos: { estaSemana: 2, hechas: 1, aprobadasSinGestionar: 1, tope: 5 },
    descartesUltimos7Dias: { total: 0, porMotivo: [] },
    ultimaEjecucion: {
      id: "ej-1",
      disparador: "programada",
      estado: "ok",
      inicio: ahoraMas(-1),
      fin: ahoraMas(-1),
    },
    conocimiento: null,
    tokens: { activos: 1, ultimoUso: null },
    ...parcial,
  };
}

export function borradorResumen(
  parcial: Partial<BorradorResumen> = {}
): BorradorResumen {
  return {
    id: "bo-1",
    oportunidadId: "op-1",
    version: 2,
    tipo: "email",
    objetivo: "BACKLINKS",
    asunto: "Una recepcionista de IA para vuestro listado",
    textoPreview: "Hola: somos Alhabla, una recepcionista de IA…",
    longitud: 412,
    enlaceUrl: null,
    afirmaciones: [],
    estado: "pendiente_aprobacion",
    editadoPorHumano: false,
    creadoEn: ahoraMas(-1),
    resultado: "pasa",
    reglasFallidas: [],
    oportunidad: {
      id: "op-1",
      titulo: "Recepcionistas de IA en España",
      dominio: "revista.example",
      url: "https://revista.example/listado",
      estado: "pendiente_aprobacion",
      objetivoPrincipal: "BACKLINKS",
      expiraEn: ahoraMas(20),
      diasParaCaducar: 20,
    },
    gestion: null,
    ...parcial,
  };
}

export function listaDeBorradores(
  data: BorradorResumen[],
  parcial: Partial<ListaDeBorradores> = {}
): ListaDeBorradores {
  return {
    data,
    total: data.length,
    pagina: 1,
    limite: 20,
    conteos: {
      bloqueados: 1,
      pendientes: 2,
      aprobados: 1,
      gestionados: 0,
      caducados: 0,
      descartados: 3,
    },
    ...parcial,
  };
}
