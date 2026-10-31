import type {
  CampoDeFicha,
  DatoDeCompetidor,
  FilaDelComparador,
  RespuestaDeFicha,
  RespuestaDelComparador,
  Tarea,
} from "@/lib/types";

/**
 * Fábricas de datos para los tests del comparador, la ficha y las tareas. Todas
 * las fechas son fijas: ningún test de aquí depende del reloj real.
 */

export const CONSULTADO_EN = "2026-10-28T09:00:00.000Z";

export function tarea(cambios: Partial<Tarea> = {}): Tarea {
  return {
    id: "ta-1",
    titulo: "Directorio de ejemplo",
    dominio: "directorio.example",
    url: "https://directorio.example/",
    categoria: "directorio_software",
    pasos: ["Abre la página.", "Rellena el alta."],
    notas: null,
    origen: "manual",
    estado: "pendiente",
    resultado: null,
    notaDeResultado: null,
    hechaEn: null,
    creadoEn: "2026-10-30T09:00:00.000Z",
    orden: 0,
    ...cambios,
  };
}

export function campoDeFicha(
  cambios: Partial<CampoDeFicha> = {}
): CampoDeFicha {
  return {
    clave: "nombre",
    etiqueta: "Nombre del producto",
    texto: "Alhabla",
    afirmaciones: [],
    faltan: [],
    ...cambios,
  };
}

export function fichaDeAlhabla(
  cambios: Partial<RespuestaDeFicha> = {}
): RespuestaDeFicha {
  return {
    campos: [
      campoDeFicha(),
      campoDeFicha({
        clave: "web",
        etiqueta: "Sitio web",
        texto: "https://alhabla.ai/",
      }),
      campoDeFicha({
        clave: "descripcion_corta",
        etiqueta: "Descripción corta",
        texto: "Recepcionista de IA que atiende las llamadas de tu negocio.",
        limite: 160,
        afirmaciones: ["pagina.inicio"],
      }),
    ],
    commit: "1234abcdef",
    sincronizadaEn: "2026-10-28T09:00:00.000Z",
    avisos: [],
    ...cambios,
  };
}

export function datoDeComparador(
  cambios: Partial<DatoDeCompetidor> = {}
): DatoDeCompetidor {
  return {
    tipo: "plan",
    etiqueta: "Plan Pro",
    texto: "300 minutos al mes.",
    valor: { importe: 79, moneda: "EUR", periodo: "mes", ivaIncluido: false },
    urlFuente: "https://rival.example/precios",
    consultadoEn: CONSULTADO_EN,
    ...cambios,
  };
}

export function filaDelComparador(
  cambios: Partial<FilaDelComparador> = {}
): FilaDelComparador {
  return {
    competidorId: "co-1",
    nombre: "Rival",
    dominio: "rival.example",
    url: "https://rival.example/",
    origen: "manual",
    estado: "analizado",
    analisis: {
      id: "an-1",
      version: 1,
      creadoEn: CONSULTADO_EN,
      revisadoEn: null,
      caducado: false,
    },
    datos: [datoDeComparador()],
    ...cambios,
  };
}

export function respuestaDelComparador(
  filas: FilaDelComparador[]
): RespuestaDelComparador {
  return { data: filas, generadoEn: "2026-10-31T09:00:00.000Z" };
}
