import axios from "axios";
import type { Comprobacion } from "./types";

/**
 * Los errores que ve el panel llegan en tres formas (contrato de la 1b):
 *
 * - `{ error: string, codigo?, comprobaciones? }`: un fallo de dominio (409,
 *   404, 403…) con el texto escrito para el administrador.
 * - `{ error: [ZodIssue] }`: un 400 de validación.
 * - `{ statusCode, error, message }`: el manejador de Fastify, incluido el
 *   límite de peticiones (429). Ahí `error` es el nombre inglés del estado.
 */

/** Un error de la API ya digerido para una pantalla. */
export type ErrorDeGrowth = {
  /** Estado HTTP; `null` si no hubo respuesta (red caída, sesión caducada). */
  estado: number | null;
  /** Frase que enseñar a la persona. */
  mensaje: string;
  /** `codigo` del cuerpo: `cumplimiento`, `tope_semanal`, `caducada`… */
  codigo: string | null;
  /** Las comprobaciones de un 409 de cumplimiento. */
  comprobaciones: Comprobacion[] | null;
};

/**
 * Error propio del cliente de demostración y de la propia sesión (no hay
 * respuesta HTTP detrás). Lleva la misma forma que un fallo de la API para
 * que las pantallas lo traten igual.
 */
export class ErrorDeCliente extends Error {
  readonly estado: number;
  readonly codigo: string | null;
  readonly comprobaciones: Comprobacion[] | null;

  constructor(
    estado: number,
    mensaje: string,
    extra: { codigo?: string; comprobaciones?: Comprobacion[] } = {}
  ) {
    super(mensaje);
    this.name = "ErrorDeCliente";
    this.estado = estado;
    this.codigo = extra.codigo ?? null;
    this.comprobaciones = extra.comprobaciones ?? null;
  }
}

export const MENSAJE_SIN_CONFIGURAR = "Growth no está configurado.";
export const MENSAJE_SESION_CADUCADA =
  "Tu sesión ha caducado. Vuelve a iniciar sesión.";

/**
 * La petición ni salió: no hay un ID token vigente que mandar. Se rechaza sin
 * tocar la red y sin perder lo que la persona tenía en pantalla.
 */
export class SesionCaducada extends Error {
  constructor() {
    super(MENSAJE_SESION_CADUCADA);
    this.name = "SesionCaducada";
  }
}
const MENSAJE_SIN_ACCESO = "No tienes acceso.";
const MENSAJE_LIMITE =
  "Demasiadas peticiones seguidas. Espera unos segundos y vuelve a intentarlo.";

/** Las frases del backend son cortas; algo más largo es un volcado, no un texto. */
const LARGO_MAXIMO_DE_FRASE = 240;

export function analizarError(error: unknown, respaldo: string): ErrorDeGrowth {
  if (error instanceof ErrorDeCliente) {
    return {
      estado: error.estado,
      mensaje: error.message,
      codigo: error.codigo,
      comprobaciones: error.comprobaciones,
    };
  }
  if (error instanceof SesionCaducada) {
    return {
      estado: 401,
      mensaje: MENSAJE_SESION_CADUCADA,
      codigo: null,
      comprobaciones: null,
    };
  }
  if (!axios.isAxiosError(error)) {
    return {
      estado: null,
      mensaje: respaldo,
      codigo: null,
      comprobaciones: null,
    };
  }

  const estado = error.response?.status ?? null;
  const cuerpo: unknown = error.response?.data;
  const objeto =
    cuerpo !== null && typeof cuerpo === "object"
      ? (cuerpo as Record<string, unknown>)
      : {};
  const codigo = typeof objeto.codigo === "string" ? objeto.codigo : null;
  const comprobaciones = Array.isArray(objeto.comprobaciones)
    ? (objeto.comprobaciones as Comprobacion[])
    : null;
  const resultado = (mensaje: string): ErrorDeGrowth => ({
    estado,
    mensaje,
    codigo,
    comprobaciones,
  });

  // Growth sin GROWTH_GOOGLE_CLIENT_ID o sin GROWTH_ADMIN_EMAILS.
  if (estado === 503) return resultado(MENSAJE_SIN_CONFIGURAR);
  if (estado === 429) return resultado(MENSAJE_LIMITE);
  if (estado === 401) return resultado(MENSAJE_SESION_CADUCADA);
  if (estado !== null && estado >= 500) return resultado(respaldo);
  // La forma estándar de Fastify: `error` es «Bad Request», no un texto.
  if (typeof objeto.statusCode === "number") return resultado(respaldo);

  const texto = objeto.error;
  if (
    typeof texto === "string" &&
    texto.trim() !== "" &&
    texto.length <= LARGO_MAXIMO_DE_FRASE
  ) {
    return resultado(texto);
  }
  if (estado === 403) return resultado(MENSAJE_SIN_ACCESO);
  return resultado(respaldo);
}

/** La frase que enseñar a la persona ante un fallo de la API. */
export function mensajeDeError(error: unknown, respaldo: string): string {
  return analizarError(error, respaldo).mensaje;
}

/** El `codigo` del cuerpo de un fallo (`tope_semanal`, `caducada`…), si hay. */
export function codigoDeError(error: unknown): string | null {
  return analizarError(error, "").codigo;
}

/** ¿El backend ha cortado por el límite de peticiones por minuto? */
export function esLimiteDePeticiones(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 429;
}

/** ¿Growth está sin configurar en el backend (503)? */
export function esGrowthSinConfigurar(error: unknown): boolean {
  return analizarError(error, "").estado === 503;
}
