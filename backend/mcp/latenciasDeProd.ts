import { gcloud, type Gcloud } from "./gcloud.js";
import {
  convertirPeticion,
  filtroDePeticiones,
  type OpcionesDePeticiones,
  type Peticion,
} from "./logsDeProd.js";

/**
 * Peticiones de producción agregadas por ruta: cuántas, con qué estados y
 * con qué latencia (p50, p95, máxima). `ver_peticiones_prod` devuelve las
 * peticiones una a una; para saber «cuánto tarda book_appointment» hacía
 * falta leer cientos de filas y calcularlo a ojo.
 *
 * Los ids dentro de la ruta (cuid, UUID, números, ids de Telnyx con «:»)
 * se cambian por `:id` para que `/calls/cmu1…` y `/calls/cmu2…` cuenten
 * juntas, y la query string se quita (puede llevar datos del cliente).
 */

/** Por defecto y máximo de peticiones que se leen de Cloud Logging. */
const LIMITE_POR_DEFECTO = 2_000;
export const LIMITE_MAXIMO = 10_000;

const SEGMENTO_CON_ID = [
  /^c[a-z0-9]{20,30}$/, // cuid de Prisma
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, // UUID
  /^\d+$/, // número
  /^v\d:[\w-]+$/, // call_control_id de Telnyx («v3:…»)
  /^(?=.*\d)[\w-]{24,}$/, // tokens largos con cifras (agentes de Retell, etc.)
];

/** Ruta sin query string y con los ids cambiados por `:id`. */
export function normalizarRuta(ruta: string): string {
  const sinQuery = ruta.split("?")[0] ?? "";
  return sinQuery
    .split("/")
    .map((segmento) => {
      let texto = segmento;
      try {
        texto = decodeURIComponent(segmento);
      } catch {
        // Escape inválido: se compara tal cual.
      }
      return SEGMENTO_CON_ID.some((patron) => patron.test(texto))
        ? ":id"
        : segmento;
    })
    .join("/");
}

/** «0.061101271s» → 61.1 (ms). null si no se puede leer. */
export function latenciaEnMs(latencia: string | undefined): number | null {
  if (!latencia) return null;
  const coincidencia = /^([\d.]+)s$/.exec(latencia.trim());
  if (!coincidencia) return null;
  const segundos = Number(coincidencia[1]);
  return Number.isFinite(segundos) ? Math.round(segundos * 10_000) / 10 : null;
}

/** Percentil por el método del rango más cercano, sobre una lista ordenada. */
function percentil(ordenadas: number[], p: number): number | null {
  if (ordenadas.length === 0) return null;
  const posicion = Math.ceil((p / 100) * ordenadas.length) - 1;
  return ordenadas[Math.min(Math.max(posicion, 0), ordenadas.length - 1)]!;
}

export type GrupoDeLatencia = {
  metodo: string;
  ruta: string;
  revision?: string;
  total: number;
  /** «2xx», «4xx»… → cuántas. Las de estado desconocido van en «?». */
  estados: Record<string, number>;
  latenciaMs: { p50: number | null; p95: number | null; max: number | null };
  primera: string;
  ultima: string;
};

export function agregarPeticiones(
  peticiones: Peticion[],
  { porRevision = false }: { porRevision?: boolean } = {}
): GrupoDeLatencia[] {
  const grupos = new Map<
    string,
    Omit<GrupoDeLatencia, "latenciaMs"> & { latencias: number[] }
  >();
  for (const peticion of peticiones) {
    const ruta = normalizarRuta(peticion.ruta);
    const clave = [peticion.metodo, ruta, porRevision ? peticion.revision : ""].join(
      " "
    );
    let grupo = grupos.get(clave);
    if (!grupo) {
      grupo = {
        metodo: peticion.metodo,
        ruta,
        ...(porRevision ? { revision: peticion.revision } : {}),
        total: 0,
        estados: {},
        latencias: [],
        primera: peticion.hora,
        ultima: peticion.hora,
      };
      grupos.set(clave, grupo);
    }
    grupo.total += 1;
    const familia =
      peticion.estado === null ? "?" : `${Math.floor(peticion.estado / 100)}xx`;
    grupo.estados[familia] = (grupo.estados[familia] ?? 0) + 1;
    const ms = latenciaEnMs(peticion.latencia);
    if (ms !== null) grupo.latencias.push(ms);
    if (peticion.hora < grupo.primera) grupo.primera = peticion.hora;
    if (peticion.hora > grupo.ultima) grupo.ultima = peticion.hora;
  }
  return [...grupos.values()]
    .map(({ latencias, ...grupo }) => {
      const ordenadas = [...latencias].sort((a, b) => a - b);
      return {
        ...grupo,
        latenciaMs: {
          p50: percentil(ordenadas, 50),
          p95: percentil(ordenadas, 95),
          max: ordenadas.at(-1) ?? null,
        },
      };
    })
    .sort((a, b) => b.total - a.total || a.ruta.localeCompare(b.ruta));
}

export type OpcionesDeLatencias = Pick<
  OpcionesDePeticiones,
  "ruta" | "metodo" | "estadoMinimo" | "desde" | "hasta" | "incluirInternas"
> & {
  porRevision?: boolean;
  /** Cuántas peticiones leer como mucho (las más recientes). */
  limitePeticiones?: number;
};

/** Solo los campos que hacen falta: con miles de entradas, el JSON entero
 * de cada una pesa megas. */
const PROYECCION =
  "json(timestamp,httpRequest.requestMethod,httpRequest.requestUrl,httpRequest.status,httpRequest.latency,resource.labels.revision_name)";

export async function leerLatenciasDeProd(
  opciones: OpcionesDeLatencias,
  {
    gcloudFn = gcloud,
    ahora = Date.now(),
  }: { gcloudFn?: Gcloud; ahora?: number } = {}
): Promise<{
  filtro: string;
  peticionesLeidas: number;
  /** true si se llegó al límite: las cifras son de las más recientes. */
  truncado: boolean;
  grupos: GrupoDeLatencia[];
}> {
  const limite = Math.min(
    opciones.limitePeticiones ?? LIMITE_POR_DEFECTO,
    LIMITE_MAXIMO
  );
  const filtro = filtroDePeticiones(
    { ...opciones, desde: opciones.desde ?? "24h" },
    ahora
  );
  const salida = await gcloudFn([
    "logging",
    "read",
    filtro,
    `--limit=${limite}`,
    `--format=${PROYECCION}`,
  ]);
  const peticiones = (
    JSON.parse(salida || "[]") as Parameters<typeof convertirPeticion>[0][]
  ).map(convertirPeticion);
  return {
    filtro,
    peticionesLeidas: peticiones.length,
    truncado: peticiones.length >= limite,
    grupos: agregarPeticiones(peticiones, {
      porRevision: opciones.porRevision,
    }),
  };
}
