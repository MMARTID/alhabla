import {
  OBJETIVOS,
  type Ajustes,
  type CambiosDeAjustes,
  type Objetivo,
  type ValoresDeAjustes,
} from "@/lib/types";

/**
 * Lo que escribe la persona en el formulario de Ajustes, como texto, y las
 * mismas reglas de rango que aplica el backend (`PUT /growth/admin/ajustes`):
 * los límites salen de la propia respuesta de la API. El backend vuelve a
 * validar; esto solo evita ir y volver para un número fuera de rango.
 *
 * El umbral de similitud se escribe en porcentaje (60) y viaja en proporción
 * (0,6), como lo guarda el backend.
 */

export type CamposDeAjustes = {
  topeSemanal: string;
  /** En porcentaje: «60». */
  umbralDeSimilitud: string;
} & Record<Objetivo, string>;

export type ClaveDeCampo = keyof CamposDeAjustes;

export type ErroresDeAjustes = Partial<Record<ClaveDeCampo, string>>;

/** 0,6 → «60»; 0,655 → «65,5». */
export function textoDePorcentaje(proporcion: number): string {
  const porcentaje = Math.round(proporcion * 10_000) / 100;
  return String(porcentaje).replace(".", ",");
}

/** Los valores guardados, como los enseñan los campos. */
export function camposDe(valores: ValoresDeAjustes): CamposDeAjustes {
  return {
    topeSemanal: String(valores.topeSemanal),
    umbralDeSimilitud: textoDePorcentaje(valores.umbralDeSimilitud),
    TRAFICO_MARCA: String(valores.umbralesPorObjetivo.TRAFICO_MARCA),
    LEADS: String(valores.umbralesPorObjetivo.LEADS),
    BACKLINKS: String(valores.umbralesPorObjetivo.BACKLINKS),
  };
}

/** Un entero sin signo ni decimales («7»), o `null`. */
export function leerEntero(texto: string): number | null {
  const limpio = texto.trim();
  return /^\d{1,9}$/.test(limpio) ? Number(limpio) : null;
}

/**
 * Un porcentaje con hasta dos decimales, con coma o punto y con o sin «%»
 * («62,5», «60 %»), devuelto como proporción: 62,5 → 0,625. `null` si no lo es.
 */
export function leerPorcentaje(texto: string): number | null {
  const limpio = texto.trim().replace(/\s*%$/, "");
  if (!/^\d{1,3}([.,]\d{1,2})?$/.test(limpio)) return null;
  return Math.round(Number(limpio.replace(",", ".")) * 100) / 10_000;
}

/** Margen para no fallar por el redondeo de coma flotante en los extremos. */
const MARGEN = 1e-9;

function textoDeRango(minimo: number, maximo: number, unidad = ""): string {
  const formato = (n: number) => String(n).replace(".", ",");
  return `Entre ${formato(minimo)} y ${formato(maximo)}${unidad}.`;
}

/** Los errores de cada campo; vacío si todo vale. */
export function validarCampos(
  campos: CamposDeAjustes,
  limites: Ajustes["limites"]
): ErroresDeAjustes {
  const errores: ErroresDeAjustes = {};

  const [minimoTope, maximoTope] = limites.topeSemanal;
  const tope = leerEntero(campos.topeSemanal);
  if (campos.topeSemanal.trim() === "") {
    errores.topeSemanal = "Escribe cuántos contactos por semana.";
  } else if (tope === null) {
    errores.topeSemanal = "Debe ser un número entero, sin decimales.";
  } else if (tope < minimoTope || tope > maximoTope) {
    errores.topeSemanal = textoDeRango(minimoTope, maximoTope);
  }

  const [minimoSimilitud, maximoSimilitud] = limites.umbralDeSimilitud;
  const similitud = leerPorcentaje(campos.umbralDeSimilitud);
  if (campos.umbralDeSimilitud.trim() === "") {
    errores.umbralDeSimilitud = "Escribe un porcentaje, por ejemplo 60.";
  } else if (similitud === null) {
    errores.umbralDeSimilitud = "Debe ser un porcentaje, por ejemplo 60.";
  } else if (
    similitud < minimoSimilitud - MARGEN ||
    similitud > maximoSimilitud + MARGEN
  ) {
    errores.umbralDeSimilitud = textoDeRango(
      Math.round(minimoSimilitud * 100),
      Math.round(maximoSimilitud * 100),
      " %"
    );
  }

  const [minimoUmbral, maximoUmbral] = limites.umbralesPorObjetivo;
  for (const objetivo of OBJETIVOS) {
    const texto = campos[objetivo];
    const valor = leerEntero(texto);
    if (texto.trim() === "") {
      errores[objetivo] = "Escribe una puntuación mínima.";
    } else if (valor === null) {
      errores[objetivo] = "Debe ser un número entero, sin decimales.";
    } else if (valor < minimoUmbral || valor > maximoUmbral) {
      errores[objetivo] = textoDeRango(minimoUmbral, maximoUmbral);
    }
  }

  return errores;
}

/**
 * Lo que hay que mandar al backend: solo los ajustes que cambian de verdad
 * (comparados como números, no como texto: «060» es lo mismo que «60») y, si
 * cambia un umbral por objetivo, los tres a la vez, como exige la API. Nunca
 * incluye la pausa ni claves `sistema.*`: esas no salen de este formulario.
 * Un campo inválido no entra: antes hay que corregirlo.
 */
export function cambiosDe(
  valores: ValoresDeAjustes,
  campos: CamposDeAjustes
): CambiosDeAjustes {
  const cambios: CambiosDeAjustes = {};

  const tope = leerEntero(campos.topeSemanal);
  if (tope !== null && tope !== valores.topeSemanal) {
    cambios.topeSemanal = tope;
  }

  const similitud = leerPorcentaje(campos.umbralDeSimilitud);
  if (similitud !== null && similitud !== valores.umbralDeSimilitud) {
    cambios.umbralDeSimilitud = similitud;
  }

  const umbrales = {} as Record<Objetivo, number>;
  let cambianUmbrales = false;
  let umbralesValidos = true;
  for (const objetivo of OBJETIVOS) {
    const valor = leerEntero(campos[objetivo]);
    if (valor === null) {
      umbralesValidos = false;
      continue;
    }
    umbrales[objetivo] = valor;
    if (valor !== valores.umbralesPorObjetivo[objetivo]) cambianUmbrales = true;
  }
  if (cambianUmbrales && umbralesValidos) {
    cambios.umbralesPorObjetivo = umbrales;
  }

  return cambios;
}

/** ¿Algún campo es distinto de lo guardado, aunque sea solo en el texto? */
export function hayEdiciones(
  originales: CamposDeAjustes,
  actuales: CamposDeAjustes
): boolean {
  return (Object.keys(originales) as ClaveDeCampo[]).some(
    (clave) => originales[clave] !== actuales[clave]
  );
}
