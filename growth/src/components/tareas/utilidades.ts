import { ayudaDeCodigo } from "@/components/comunes/d1-aviso-de-error";
import { analizarError } from "@/lib/api-errors";
import {
  LARGO_MAXIMO_DE_NOTAS_DE_TAREA,
  LARGO_MAXIMO_DE_NOTA_DE_RESULTADO_DE_TAREA,
  LARGO_MAXIMO_DE_PASO_DE_TAREA,
  LARGO_MAXIMO_DE_TITULO_DE_TAREA,
  LARGO_MAXIMO_DE_URL_DE_TAREA,
  MAXIMO_DE_PASOS_DE_TAREA,
  type CampoDeFicha,
  type EstadoDeTarea,
  type Tarea,
} from "@/lib/types";
import { esUrlWeb } from "@/lib/url-segura";

// ---------------------------------------------------------------------------
// Ficha de Alhabla
// ---------------------------------------------------------------------------

/** Los caracteres como los cuenta quien pega: una letra con tilde es una. */
export function contarCaracteres(texto: string): number {
  return [...texto].length;
}

/**
 * Lo que copia «Copiar todo»: cada campo con su etiqueta, tal cual se ve en
 * pantalla, separados por una línea en blanco. Los campos que no se han podido
 * componer no entran (no hay nada que pegar).
 */
export function textoDeLaFichaCompleta(
  campos: readonly CampoDeFicha[]
): string {
  return campos
    .filter((c): c is CampoDeFicha & { texto: string } => c.texto !== null)
    .map((c) => `${c.etiqueta}\n${c.texto}`)
    .join("\n\n");
}

/** Cuántos caracteres se pasa un texto de su límite orientativo (0 si no se pasa). */
export function excesoSobreElLimite(campo: CampoDeFicha): number {
  if (campo.texto === null || campo.limite === undefined) return 0;
  return Math.max(0, contarCaracteres(campo.texto) - campo.limite);
}

// ---------------------------------------------------------------------------
// Tareas
// ---------------------------------------------------------------------------

export type GrupoDeTareas = { estado: EstadoDeTarea; tareas: Tarea[] };

/**
 * Las tareas por estado: primero lo que queda por hacer. Respeta el orden de
 * entrada, salvo las hechas, que van de la más reciente a la más antigua.
 */
export function agruparTareas(lista: readonly Tarea[]): GrupoDeTareas[] {
  const estados: readonly EstadoDeTarea[] = [
    "pendiente",
    "hecha",
    "descartada",
  ];
  const fecha = (t: Tarea) => (t.hechaEn ? Date.parse(t.hechaEn) : 0);
  return estados.map((estado) => {
    const suyas = lista.filter((t) => t.estado === estado);
    return {
      estado,
      // `sort` es estable: a igual fecha, el orden de entrada.
      tareas:
        estado === "hecha"
          ? [...suyas].sort((a, b) => fecha(b) - fecha(a))
          : suyas,
    };
  });
}

/** Un paso por línea: las líneas en blanco sobran. */
export function pasosDeTexto(texto: string): string[] {
  return texto
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter((linea) => linea !== "");
}

export function textoDePasos(pasos: readonly string[]): string {
  return pasos.join("\n");
}

export type ValoresDeTarea = {
  titulo: string;
  url: string;
  categoria: string;
  pasos: string;
  notas: string;
};

export type ErroresDeTarea = {
  titulo?: string;
  url?: string;
  pasos?: string;
  notas?: string;
};

export const MENSAJE_DE_URL_DE_TAREA_INVALIDA =
  "Escribe una dirección web completa, que empiece por http:// o https://.";

/** Valida «Añadir tarea» y «Editar tarea» (vacío = todo bien). */
export function validarTarea(valores: ValoresDeTarea): ErroresDeTarea {
  const errores: ErroresDeTarea = {};
  const titulo = valores.titulo.trim();
  if (titulo === "") errores.titulo = "Escribe un título.";
  else if (titulo.length > LARGO_MAXIMO_DE_TITULO_DE_TAREA) {
    errores.titulo = `El título no puede pasar de ${LARGO_MAXIMO_DE_TITULO_DE_TAREA} caracteres.`;
  }

  const url = valores.url.trim();
  if (url === "") errores.url = "Escribe la dirección web.";
  else if (url.length > LARGO_MAXIMO_DE_URL_DE_TAREA) {
    errores.url = `La dirección no puede pasar de ${LARGO_MAXIMO_DE_URL_DE_TAREA} caracteres.`;
  } else if (!esUrlWeb(url)) {
    errores.url = MENSAJE_DE_URL_DE_TAREA_INVALIDA;
  } else {
    const { username, password } = new URL(url);
    if (username !== "" || password !== "") {
      errores.url = "Quita el usuario y la contraseña de la dirección.";
    }
  }

  const pasos = pasosDeTexto(valores.pasos);
  if (pasos.length > MAXIMO_DE_PASOS_DE_TAREA) {
    errores.pasos = `Como mucho ${MAXIMO_DE_PASOS_DE_TAREA} pasos (tienes ${pasos.length}).`;
  } else if (pasos.some((p) => p.length > LARGO_MAXIMO_DE_PASO_DE_TAREA)) {
    errores.pasos = `Cada paso puede tener hasta ${LARGO_MAXIMO_DE_PASO_DE_TAREA} caracteres.`;
  }

  if (valores.notas.trim().length > LARGO_MAXIMO_DE_NOTAS_DE_TAREA) {
    errores.notas = `Las notas no pueden pasar de ${LARGO_MAXIMO_DE_NOTAS_DE_TAREA} caracteres.`;
  }
  return errores;
}

/** Valida la nota de «Marcar hecha» y de «Descartar». */
export function errorDeNotaDeResultado(nota: string): string | null {
  return nota.trim().length > LARGO_MAXIMO_DE_NOTA_DE_RESULTADO_DE_TAREA
    ? `La nota no puede pasar de ${LARGO_MAXIMO_DE_NOTA_DE_RESULTADO_DE_TAREA} caracteres.`
    : null;
}

/**
 * El fallo de una acción sobre una tarea en una sola cadena (para los
 * diálogos de confirmación, que solo admiten texto): lo que dijo el backend
 * y, si el `codigo` es conocido, qué hacer ahora.
 */
export function textoDeErrorDeTarea(error: unknown, respaldo: string): string {
  const { mensaje, codigo } = analizarError(error, respaldo);
  const ayuda = ayudaDeCodigo(codigo);
  return ayuda ? `${mensaje} ${ayuda}` : mensaje;
}
