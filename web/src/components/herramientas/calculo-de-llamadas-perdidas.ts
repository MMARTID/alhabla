import { plans, type Plan } from "@/lib/plans";
import type { SectorSlug } from "@/lib/sectores/tipos";

/**
 * La cuenta de /herramientas/calculadora-de-llamadas-perdidas, sin React:
 * la usan el componente de cliente, la página (tabla de valores de partida,
 * de servidor), la calculadora compacta de la portada y las landings
 * (calculadora-compacta.tsx) y los tests. Va aparte del componente porque lo
 * que exporta un fichero "use client" no se puede leer desde un componente
 * de servidor.
 */

export type IdSector = "peluqueria" | "barberia" | "unas" | "estetica" | "fisioterapia" | "pestanas" | "spa" | "canina";

/** El sector de la calculadora de cada landing: aquí los ids son más cortos
 * que los slugs de las páginas (y van en la URL de la versión completa). */
export const ID_DE_LA_CALCULADORA: Record<SectorSlug, IdSector> = {
  peluqueria: "peluqueria",
  barberia: "barberia",
  "centro-de-estetica": "estetica",
  "salon-de-unas": "unas",
  fisioterapia: "fisioterapia",
  "pestanas-y-cejas": "pestanas",
  "spa-y-masajes": "spa",
  "peluqueria-canina": "canina",
};

/**
 * «¿Cuántos sois?» de la calculadora compacta: cada tramo pone un número de
 * profesionales que cae dentro del límite de un plan (3 en Inicio y 10 en
 * Pro, leídos de lib/plans.ts), para que el plan que propone quepa de verdad.
 */
export const TAMANOS_DE_EQUIPO = [
  { etiqueta: "1–3", nombre: "De 1 a 3", profesionales: "2" },
  { etiqueta: "4–10", nombre: "De 4 a 10", profesionales: "6" },
  { etiqueta: "Más de 10", nombre: "Más de 10", profesionales: "11" },
] as const;

/** Valores de partida: orientativos, no estadísticas. */
export const SECTORES_DE_LA_CALCULADORA: readonly { id: IdSector; nombre: string; ticket: number; visitas: number }[] = [
  { id: "peluqueria", nombre: "Peluquería", ticket: 45, visitas: 6 },
  { id: "barberia", nombre: "Barbería", ticket: 25, visitas: 12 },
  { id: "unas", nombre: "Salón de uñas", ticket: 30, visitas: 12 },
  { id: "estetica", nombre: "Centro de estética", ticket: 80, visitas: 4 },
  { id: "fisioterapia", nombre: "Fisioterapia", ticket: 45, visitas: 6 },
  { id: "pestanas", nombre: "Pestañas y cejas", ticket: 50, visitas: 10 },
  { id: "spa", nombre: "Spa y masajes", ticket: 60, visitas: 4 },
  { id: "canina", nombre: "Peluquería canina", ticket: 40, visitas: 6 },
];

export type Campo = "llamadas" | "cita" | "otro" | "ticket" | "visitas" | "novuelve" | "duracion" | "profesionales";
export type Estado = { sector: IdSector; recurrencia: boolean } & Record<Campo, string>;

export const LIMITES: Record<Campo, { min: number; max: number; paso: number }> = {
  llamadas: { min: 0, max: 500, paso: 1 },
  cita: { min: 0, max: 100, paso: 5 },
  otro: { min: 0, max: 100, paso: 5 },
  ticket: { min: 1, max: 1000, paso: 1 },
  visitas: { min: 1, max: 52, paso: 1 },
  novuelve: { min: 0, max: 100, paso: 5 },
  duracion: { min: 1, max: 30, paso: 0.5 },
  profesionales: { min: 1, max: 100, paso: 1 },
};

/** 52 semanas entre 12 meses: 4,33, no 4 (con 4 se pierde un mes al año). */
export const SEMANAS_POR_MES = 52 / 12;

export function estadoInicial(sector: IdSector = "peluqueria"): Estado {
  const s = SECTORES_DE_LA_CALCULADORA.find((x) => x.id === sector) ?? SECTORES_DE_LA_CALCULADORA[0];
  return {
    sector: s.id,
    recurrencia: false,
    llamadas: "10",
    cita: "60",
    otro: "30",
    ticket: String(s.ticket),
    visitas: String(s.visitas),
    novuelve: "25",
    duracion: "3",
    profesionales: "2",
  };
}

function numero(estado: Estado, campo: Campo) {
  const { min, max } = LIMITES[campo];
  const n = Number(estado[campo].replace(",", "."));
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(n, min), max);
}

export function leerDeLaUrl(busqueda: string): Estado | null {
  const p = new URLSearchParams(busqueda);
  if (![...p.keys()].some((k) => k in LIMITES || k === "sector")) return null;
  const sector = SECTORES_DE_LA_CALCULADORA.some((s) => s.id === p.get("sector")) ? (p.get("sector") as IdSector) : "peluqueria";
  const estado = estadoInicial(sector);
  for (const campo of Object.keys(LIMITES) as Campo[]) {
    const valor = p.get(campo);
    if (valor !== null && valor !== "" && Number.isFinite(Number(valor))) estado[campo] = valor;
  }
  estado.recurrencia = p.get("recurrencia") === "1";
  return estado;
}

export function aParametros(estado: Estado) {
  const p = new URLSearchParams({ sector: estado.sector });
  for (const campo of Object.keys(LIMITES) as Campo[]) p.set(campo, estado[campo]);
  if (estado.recurrencia) p.set("recurrencia", "1");
  return p.toString();
}

/** Límite de profesionales de cada plan, leído de su resumen en lib/plans.ts
 * («3 profesionales · …»); el que no lo dice no tiene límite. */
function limiteDeProfesionales(plan: Plan) {
  const m = plan.summary.match(/^(\d+) profesionales/);
  return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
}

export function calcular(estado: Estado) {
  const llamadasAlMes = numero(estado, "llamadas") * SEMANAS_POR_MES;
  const citasAlMes = llamadasAlMes * (numero(estado, "cita") / 100) * (numero(estado, "otro") / 100);
  const ticket = numero(estado, "ticket");
  const perdidaAlMes = citasAlMes * ticket;
  const perdidaAlAno = perdidaAlMes * 12;
  // Las visitas siguientes solo de quien se queda en el otro sitio: la
  // primera ya está contada en la pérdida directa.
  const visitasQueNoVuelven = citasAlMes * 12 * (numero(estado, "novuelve") / 100) * (numero(estado, "visitas") - 1);
  const perdidaConRecurrencia = perdidaAlAno + visitasQueNoVuelven * ticket;

  const minutosAlMes = llamadasAlMes * numero(estado, "duracion");
  const profesionales = numero(estado, "profesionales");
  const opciones = plans
    .filter((plan) => profesionales <= limiteDeProfesionales(plan))
    .map((plan) => {
      const minutosExtra = Math.max(0, Math.ceil(minutosAlMes - plan.minutes));
      return { plan, minutosExtra, coste: plan.price + minutosExtra * plan.extraPerMinute };
    })
    .sort((a, b) => a.coste - b.coste);
  const recomendado = opciones[0] ?? null;
  const citasParaCubrirlo = recomendado ? Math.ceil(recomendado.coste / ticket) : null;

  return {
    llamadasAlMes,
    citasAlMes,
    perdidaAlMes,
    perdidaAlAno,
    perdidaConRecurrencia,
    minutosAlMes,
    recomendado,
    citasParaCubrirlo,
  };
}
