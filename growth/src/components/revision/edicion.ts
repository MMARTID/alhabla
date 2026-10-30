import type {
  BorradorDetallado,
  Comprobacion,
  EdicionDeBorrador,
  Revision,
} from "@/lib/types";
import { esUrlWeb } from "@/lib/url-segura";

/**
 * Lo que se edita a mano de un borrador: asunto, texto, enlace y las claves de
 * afirmación que cita. Estas últimas son la única forma de desbloquear un
 * borrador que cita una clave cerrada o inexistente; el backend las valida
 * igual que las del agente.
 */
export type ValoresEditables = {
  asunto: string;
  texto: string;
  enlaceUrl: string;
  afirmaciones: string[];
};

type CamposDeBorrador = Pick<
  BorradorDetallado,
  "asunto" | "texto" | "enlaceUrl" | "afirmaciones"
>;

/** Los campos que la persona ha tocado: el resto sigue el valor del servidor. */
export type EdicionParcial = Partial<ValoresEditables>;

export const LARGO_MAXIMO_DE_TEXTO = 10_000;
export const LARGO_MAXIMO_DE_ASUNTO = 300;
export const LARGO_MAXIMO_DE_ENLACE = 2_000;
export const LARGO_MAXIMO_DE_CLAVE = 200;
export const MAXIMO_DE_CLAVES = 50;

export type ErroresDeEdicion = Partial<Record<keyof ValoresEditables, string>>;

/** Los valores guardados en el servidor, tal como se enseñan en el formulario. */
export function valoresBase(borrador: CamposDeBorrador): ValoresEditables {
  return {
    asunto: borrador.asunto ?? "",
    texto: borrador.texto,
    enlaceUrl: borrador.enlaceUrl ?? "",
    afirmaciones: borrador.afirmaciones,
  };
}

/** Los valores del formulario: los del servidor con encima lo que se ha tocado. */
export function valoresActuales(
  borrador: CamposDeBorrador,
  parcial: EdicionParcial | undefined
): ValoresEditables {
  return { ...valoresBase(borrador), ...(parcial ?? {}) };
}

const CAMPOS: readonly (keyof ValoresEditables)[] = [
  "asunto",
  "texto",
  "enlaceUrl",
  "afirmaciones",
];

/** Dos valores de un campo son el mismo (las listas, clave a clave y en orden). */
export function mismoValor<K extends keyof ValoresEditables>(
  a: ValoresEditables[K],
  b: ValoresEditables[K]
): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((valor, i) => valor === b[i]);
  }
  return a === b;
}

/** Los campos cuyo valor difiere del guardado. */
export function camposCambiados(
  borrador: CamposDeBorrador,
  parcial: EdicionParcial | undefined
): (keyof ValoresEditables)[] {
  const base = valoresBase(borrador);
  const actual = valoresActuales(borrador, parcial);
  return CAMPOS.filter((campo) => !mismoValor(actual[campo], base[campo]));
}

export function hayCambios(
  borrador: CamposDeBorrador,
  parcial: EdicionParcial | undefined
): boolean {
  return camposCambiados(borrador, parcial).length > 0;
}

/**
 * Lo que se manda en el PATCH: solo los campos que cambiaron (el backend
 * rechaza un cuerpo vacío). Un asunto o un enlace vaciados se mandan como
 * `null`.
 */
export function cambiosParaApi(
  borrador: CamposDeBorrador,
  parcial: EdicionParcial | undefined
): EdicionDeBorrador {
  const actual = valoresActuales(borrador, parcial);
  const cambios: EdicionDeBorrador = {};
  for (const campo of camposCambiados(borrador, parcial)) {
    if (campo === "texto") cambios.texto = actual.texto;
    else if (campo === "asunto")
      cambios.asunto = actual.asunto.trim() === "" ? null : actual.asunto;
    else if (campo === "afirmaciones")
      cambios.afirmaciones = actual.afirmaciones;
    else
      cambios.enlaceUrl =
        actual.enlaceUrl.trim() === "" ? null : actual.enlaceUrl.trim();
  }
  return cambios;
}

/** Los mismos límites que valida el backend: se avisa antes de mandar. */
export function validarEdicion(valores: ValoresEditables): ErroresDeEdicion {
  const errores: ErroresDeEdicion = {};
  if (valores.texto.trim() === "") {
    errores.texto = "El texto no puede quedar vacío.";
  } else if (valores.texto.length > LARGO_MAXIMO_DE_TEXTO) {
    errores.texto = `El texto no puede pasar de ${LARGO_MAXIMO_DE_TEXTO} caracteres.`;
  }
  if (valores.asunto.length > LARGO_MAXIMO_DE_ASUNTO) {
    errores.asunto = `El asunto no puede pasar de ${LARGO_MAXIMO_DE_ASUNTO} caracteres.`;
  }
  const enlace = valores.enlaceUrl.trim();
  if (enlace !== "") {
    if (enlace.length > LARGO_MAXIMO_DE_ENLACE) {
      errores.enlaceUrl = `El enlace no puede pasar de ${LARGO_MAXIMO_DE_ENLACE} caracteres.`;
    } else if (!esUrlWeb(enlace)) {
      errores.enlaceUrl =
        "El enlace tiene que ser una dirección web que empiece por http:// o https://.";
    }
  }
  if (valores.afirmaciones.length > MAXIMO_DE_CLAVES) {
    errores.afirmaciones = `No se pueden citar más de ${MAXIMO_DE_CLAVES} afirmaciones.`;
  } else if (
    valores.afirmaciones.some(
      (clave) => clave.trim() === "" || clave.length > LARGO_MAXIMO_DE_CLAVE
    )
  ) {
    errores.afirmaciones = `Cada clave tiene de 1 a ${LARGO_MAXIMO_DE_CLAVE} caracteres.`;
  }
  return errores;
}

/**
 * Añade una clave a la lista: recortada, sin vacías ni repetidas. Devuelve la
 * misma lista (misma referencia) si no hay nada que añadir.
 */
export function anadirClave(
  claves: readonly string[],
  nueva: string
): readonly string[] {
  const limpia = nueva.trim();
  if (limpia === "" || claves.includes(limpia)) return claves;
  return [...claves, limpia];
}

/**
 * ¿Un enlace válido al que le falta `utm_source`? Sin él las visitas que llegan
 * por este contacto no se pueden atribuir (PLAN-GROWTH.md § 3.2). Es un aviso,
 * no un bloqueo.
 */
export function enlaceSinUtmSource(enlace: string): boolean {
  const limpio = enlace.trim();
  if (limpio === "" || !esUrlWeb(limpio)) return false;
  try {
    return !new URL(limpio).searchParams.has("utm_source");
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Revisiones y comprobaciones
// ---------------------------------------------------------------------------

/** La revisión que manda: la del motor de reglas más reciente (la consultiva no bloquea). */
export function revisionDeReglas(
  borrador: Pick<BorradorDetallado, "revisiones">
): Revision | null {
  return (
    borrador.revisiones.find((r) => r.revisor === "reglas") ??
    borrador.revisiones[0] ??
    null
  );
}

/** Una regla dura que no se cumple: bloquea. */
export function esBloqueo(comprobacion: Comprobacion): boolean {
  return !comprobacion.ok && comprobacion.dura;
}

export function reglasDurasFallidas(
  borrador: Pick<BorradorDetallado, "revisiones">
): Comprobacion[] {
  return (revisionDeReglas(borrador)?.comprobaciones ?? []).filter(esBloqueo);
}

/** Primero lo que bloquea, luego los avisos y al final lo que está bien. */
export function ordenarComprobaciones(
  comprobaciones: readonly Comprobacion[]
): Comprobacion[] {
  const peso = (c: Comprobacion) => (esBloqueo(c) ? 0 : !c.ok ? 1 : 2);
  return comprobaciones
    .map((c, i) => ({ c, i }))
    .sort((a, b) => peso(a.c) - peso(b.c) || a.i - b.i)
    .map(({ c }) => c);
}
