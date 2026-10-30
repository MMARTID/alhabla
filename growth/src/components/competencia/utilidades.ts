import { analizarError } from "@/lib/api-errors";
import { ayudaDeCodigo } from "@/components/comunes/d1-aviso-de-error";
import { GRUPOS_DE_DATOS_DE_COMPETIDOR } from "@/lib/etiquetas";
import {
  ESTADOS_DE_COMPETIDOR,
  LARGO_MAXIMO_DE_NOMBRE_DE_COMPETIDOR,
  LARGO_MAXIMO_DE_NOTAS_DE_COMPETIDOR,
  LARGO_MAXIMO_DE_URL_DE_COMPETIDOR,
  type CompetidorResumen,
  type DatoDeCompetidor,
  type EstadoDeCompetidor,
  type PeriodoDePrecio,
  type ValorDePrecio,
} from "@/lib/types";
import { esUrlWeb } from "@/lib/url-segura";

// ---------------------------------------------------------------------------
// Precios
// ---------------------------------------------------------------------------

const TEXTO_DE_PERIODO: Record<PeriodoDePrecio, string> = {
  mes: "al mes",
  anio: "al año",
  uso: "por uso",
  unico: "pago único",
};

/**
 * Un precio como se lee en España: «79 € al mes · IVA no incluido»,
 * «0,12 € por minuto», «790 € al año · IVA incluido». La cantidad y la moneda
 * salen de `Intl` en `es-ES` (coma decimal, símbolo detrás, espacio fino sin
 * salto). Un `ivaIncluido` ausente no se inventa: no se dice nada del IVA.
 */
export function formatearPrecio(valor: ValorDePrecio): string {
  const importe = new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: valor.moneda,
    minimumFractionDigits: Number.isInteger(valor.importe) ? 0 : 2,
    maximumFractionDigits: 4,
  }).format(valor.importe);
  const periodo =
    valor.periodo === "uso"
      ? `por ${valor.unidad ?? "uso"}`
      : `${TEXTO_DE_PERIODO[valor.periodo]}${valor.unidad ? ` por ${valor.unidad}` : ""}`;
  const iva =
    valor.ivaIncluido === true
      ? " · IVA incluido"
      : valor.ivaIncluido === false
        ? " · IVA no incluido"
        : "";
  return `${importe} ${periodo}${iva}`;
}

// ---------------------------------------------------------------------------
// Datos de un análisis
// ---------------------------------------------------------------------------

export type GrupoDeDatos = {
  clave: string;
  titulo: string;
  datos: DatoDeCompetidor[];
};

/**
 * Los datos de un análisis agrupados por tipo en el orden de lectura
 * (`GRUPOS_DE_DATOS_DE_COMPETIDOR`). Precios y planes van juntos; un grupo sin
 * datos no existe. Dentro de cada grupo se respeta el orden del agente.
 */
export function agruparDatos(
  datos: readonly DatoDeCompetidor[]
): GrupoDeDatos[] {
  const grupos: GrupoDeDatos[] = [];
  for (const grupo of GRUPOS_DE_DATOS_DE_COMPETIDOR) {
    const suyos = datos.filter((d) => grupo.tipos.includes(d.tipo));
    if (suyos.length > 0) {
      grupos.push({ clave: grupo.clave, titulo: grupo.titulo, datos: suyos });
    }
  }
  return grupos;
}

/**
 * La fuente de un dato para leerla de un vistazo: sin el esquema ni la barra
 * final («recepcion-express.example/precios»). Si la cadena no se entiende
 * como URL se devuelve tal cual (siempre como texto).
 */
export function fuenteLegible(url: string): string {
  try {
    const u = new URL(url);
    // Solo se abrevia lo que es una web: de `javascript:` o `data:` no se
    // quita el esquema, para que se lea tal cual es.
    if (u.protocol !== "http:" && u.protocol !== "https:") return url;
    const ruta = u.pathname === "/" ? "" : u.pathname.replace(/\/+$/, "");
    return `${u.host}${ruta}${u.search}`;
  } catch {
    return url;
  }
}

// ---------------------------------------------------------------------------
// La lista
// ---------------------------------------------------------------------------

export type GrupoDeCompetidores = {
  estado: EstadoDeCompetidor;
  competidores: CompetidorResumen[];
};

/**
 * Los competidores agrupados por estado, en el orden en que piden tu
 * atención (propuestos, por analizar, pendientes de revisión, revisados).
 * Respeta el orden de entrada (la API los manda por nombre) y no devuelve
 * grupos vacíos.
 */
export function agruparCompetidores(
  lista: readonly CompetidorResumen[]
): GrupoDeCompetidores[] {
  return ESTADOS_DE_COMPETIDOR.map((estado) => ({
    estado,
    competidores: lista.filter((c) => c.estado === estado),
  })).filter((g) => g.competidores.length > 0);
}

/** ¿Hay que enseñar «Análisis caducado»? Solo con un análisis de más de 90 días. */
export function tieneAnalisisCaducado(c: CompetidorResumen): boolean {
  return c.analisis?.caducado === true;
}

/** El enlace a las oportunidades que mencionan a un competidor. */
export function rutaDeMenciones(dominio: string): string {
  return `/bandeja?menciona=${encodeURIComponent(dominio)}`;
}

/** La ficha de un competidor. */
export function rutaDeCompetidor(id: string): string {
  return `/competencia/${encodeURIComponent(id)}`;
}

/**
 * «HeyDiga», «HeyDiga y fonio», «HeyDiga, fonio y 2 más»: a quién menciona una
 * página. `nombres` traduce dominio a nombre; un dominio que no se conoce
 * sale tal cual, siempre como texto.
 */
export function textoDeMenciones(
  dominios: readonly string[],
  nombres: ReadonlyMap<string, string>,
  maximo = 2
): string {
  const etiquetas = dominios.map((d) => nombres.get(d) ?? d);
  if (etiquetas.length <= maximo + 1) {
    return etiquetas.length <= 1
      ? (etiquetas[0] ?? "")
      : `${etiquetas.slice(0, -1).join(", ")} y ${etiquetas[etiquetas.length - 1]}`;
  }
  const vistos = etiquetas.slice(0, maximo);
  const resto = etiquetas.length - maximo;
  return `${vistos.join(", ")} y ${resto} más`;
}

// ---------------------------------------------------------------------------
// Formularios
// ---------------------------------------------------------------------------

export const MENSAJE_DE_URL_DE_COMPETIDOR_INVALIDA =
  "Escribe una dirección web completa, que empiece por http:// o https://.";

export type ErroresDeCompetidor = {
  url?: string;
  nombre?: string;
  notas?: string;
};

/** El dominio de una URL como lo guarda el backend, o `null` si no se entiende. */
export function dominioDeUrl(url: string): string | null {
  try {
    return new URL(url.trim()).hostname
      .toLowerCase()
      .replace(/^www\./, "")
      .replace(/\.$/, "");
  } catch {
    return null;
  }
}

function errorDeUrl(valor: string, obligatoria: boolean): string | undefined {
  const url = valor.trim();
  if (url === "") return obligatoria ? "Escribe la dirección web." : undefined;
  if (url.length > LARGO_MAXIMO_DE_URL_DE_COMPETIDOR) {
    return `La dirección no puede pasar de ${LARGO_MAXIMO_DE_URL_DE_COMPETIDOR} caracteres.`;
  }
  if (!esUrlWeb(url)) return MENSAJE_DE_URL_DE_COMPETIDOR_INVALIDA;
  const { username, password } = new URL(url);
  if (username !== "" || password !== "") {
    return "Quita el usuario y la contraseña de la dirección.";
  }
  return undefined;
}

/** Valida «Añadir competidor» (vacío = todo bien). */
export function validarAltaDeCompetidor(
  url: string,
  nombre: string,
  notas: string
): ErroresDeCompetidor {
  const errores: ErroresDeCompetidor = {};
  const deUrl = errorDeUrl(url, true);
  if (deUrl) errores.url = deUrl;
  if (nombre.trim().length > LARGO_MAXIMO_DE_NOMBRE_DE_COMPETIDOR) {
    errores.nombre = `El nombre no puede pasar de ${LARGO_MAXIMO_DE_NOMBRE_DE_COMPETIDOR} caracteres.`;
  }
  if (notas.trim().length > LARGO_MAXIMO_DE_NOTAS_DE_COMPETIDOR) {
    errores.notas = `Las notas no pueden pasar de ${LARGO_MAXIMO_DE_NOTAS_DE_COMPETIDOR} caracteres.`;
  }
  return errores;
}

/**
 * Valida la edición: el nombre no puede quedar vacío, la URL es opcional pero
 * tiene que ser del mismo dominio que el competidor (el dominio no se cambia).
 */
export function validarEdicionDeCompetidor(
  valores: { nombre: string; url: string; notas: string },
  dominio: string
): ErroresDeCompetidor {
  const errores: ErroresDeCompetidor = {};
  const nombre = valores.nombre.trim();
  if (nombre === "") errores.nombre = "Escribe un nombre.";
  else if (nombre.length > LARGO_MAXIMO_DE_NOMBRE_DE_COMPETIDOR) {
    errores.nombre = `El nombre no puede pasar de ${LARGO_MAXIMO_DE_NOMBRE_DE_COMPETIDOR} caracteres.`;
  }
  const deUrl = errorDeUrl(valores.url, false);
  if (deUrl) errores.url = deUrl;
  else if (valores.url.trim() !== "" && dominioDeUrl(valores.url) !== dominio) {
    errores.url = `La dirección tiene que ser de ${dominio}: el dominio no se cambia.`;
  }
  if (valores.notas.trim().length > LARGO_MAXIMO_DE_NOTAS_DE_COMPETIDOR) {
    errores.notas = `Las notas no pueden pasar de ${LARGO_MAXIMO_DE_NOTAS_DE_COMPETIDOR} caracteres.`;
  }
  return errores;
}

// ---------------------------------------------------------------------------
// Errores
// ---------------------------------------------------------------------------

/**
 * El fallo de una acción sobre un competidor en una sola cadena (para los
 * diálogos de confirmación, que solo admiten texto): lo que dijo el backend y,
 * si el `codigo` es conocido, qué hacer ahora.
 */
export function textoDeErrorDeCompetencia(
  error: unknown,
  respaldo: string
): string {
  const { mensaje, codigo } = analizarError(error, respaldo);
  const ayuda = ayudaDeCodigo(codigo);
  return ayuda ? `${mensaje} ${ayuda}` : mensaje;
}
