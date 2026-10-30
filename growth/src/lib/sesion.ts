"use client";

import { useSyncExternalStore } from "react";

/**
 * La sesión del administrador: el ID token de Google, tal cual, como `Bearer`
 * (no hay sesión propia en el backend). Dura una hora y no hay refresh token,
 * así que la renovación (src/lib/gis.ts) es de mejor esfuerzo y la caducidad
 * real se resuelve con un diálogo que no desmonta la pantalla.
 *
 * Dónde vive el token:
 * - `sessionStorage` (muere con la pestaña): nunca `localStorage` ni cookies,
 *   y nunca en una URL ni en un log.
 * - Una copia en memoria, que es la que se lee. Si `sessionStorage` lanza
 *   (navegación privada, almacenamiento bloqueado), el panel sigue
 *   funcionando hasta que se recargue.
 *
 * El token se descifra aquí SOLO para pintar el correo y programar la
 * renovación. Quién tiene acceso lo decide el backend, no esta lectura.
 */

export const CLAVE_DE_SESION = "alhabla-growth:id-token";

/** Un token se da por muerto un minuto antes de que expire. */
export const MARGEN_DE_CADUCIDAD_MS = 60_000;

export type EstadoDeSesion =
  | { estado: "cargando" }
  | { estado: "sin_sesion" }
  | { estado: "activa"; email: string; exp: number }
  | { estado: "caducada"; email: string | null }
  | { estado: "sin_acceso"; email: string | null };

export type DatosDelToken = {
  email: string;
  /** Segundos desde la época, como en el JWT. */
  exp: number;
  name?: string;
};

/** Lo que ve el servidor y la primera pasada de hidratación. */
const ESTADO_DEL_SERVIDOR: EstadoDeSesion = { estado: "cargando" };

let token: string | null = null;
let estadoActual: EstadoDeSesion | null = null;
const oyentes = new Set<() => void>();

// ---------------------------------------------------------------------------
// Almacenamiento (a prueba de navegación privada)
// ---------------------------------------------------------------------------

function leerAlmacen(): string | null {
  try {
    return window.sessionStorage.getItem(CLAVE_DE_SESION);
  } catch {
    return null;
  }
}

function escribirAlmacen(valor: string | null) {
  try {
    if (valor === null) window.sessionStorage.removeItem(CLAVE_DE_SESION);
    else window.sessionStorage.setItem(CLAVE_DE_SESION, valor);
  } catch {
    // Sin almacenamiento: el token vive solo en memoria.
  }
}

// ---------------------------------------------------------------------------
// El JWT
// ---------------------------------------------------------------------------

/**
 * Lee el cuerpo de un ID token SIN verificar la firma. Devuelve `null` si no
 * es un JWT legible o no trae correo y caducidad. Sirve para pintar y para
 * programar la renovación, nunca para decidir un acceso.
 */
export function decodificarIdToken(jwt: string): DatosDelToken | null {
  try {
    const partes = jwt.split(".");
    if (partes.length !== 3) return null;
    const base64 = partes[1].replace(/-/g, "+").replace(/_/g, "/");
    const relleno = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const binario = atob(relleno);
    const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
    const cuerpo: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (cuerpo === null || typeof cuerpo !== "object") return null;
    const { email, exp, name } = cuerpo as Record<string, unknown>;
    if (typeof email !== "string" || email === "") return null;
    if (typeof exp !== "number" || !Number.isFinite(exp)) return null;
    return {
      email,
      exp,
      ...(typeof name === "string" ? { name } : {}),
    };
  } catch {
    return null;
  }
}

function estaVigente(
  datos: DatosDelToken,
  ahora: number,
  margenMs: number
): boolean {
  return datos.exp * 1000 - margenMs > ahora;
}

// ---------------------------------------------------------------------------
// El estado
// ---------------------------------------------------------------------------

function emitir(nuevo: EstadoDeSesion) {
  estadoActual = nuevo;
  oyentes.forEach((oyente) => oyente());
}

/** Se calcula la primera vez que se pregunta, ya en el navegador. */
function inicializar(): EstadoDeSesion {
  const guardado = leerAlmacen();
  if (guardado) {
    const datos = decodificarIdToken(guardado);
    if (datos && estaVigente(datos, Date.now(), MARGEN_DE_CADUCIDAD_MS)) {
      token = guardado;
      return { estado: "activa", email: datos.email, exp: datos.exp };
    }
    escribirAlmacen(null);
  }
  token = null;
  return { estado: "sin_sesion" };
}

export function obtenerEstadoDeSesion(): EstadoDeSesion {
  if (typeof window === "undefined") return ESTADO_DEL_SERVIDOR;
  if (estadoActual === null) estadoActual = inicializar();
  return estadoActual;
}

function correoActual(): string | null {
  const actual = estadoActual;
  if (!actual) return null;
  if (
    actual.estado === "activa" ||
    actual.estado === "caducada" ||
    actual.estado === "sin_acceso"
  ) {
    return actual.email;
  }
  return null;
}

/**
 * Recoge la credencial que entrega Google. Devuelve `false` (y no cambia nada)
 * si no es un JWT legible o ya está caducado.
 */
export function guardarCredencial(jwt: string): boolean {
  const datos = decodificarIdToken(jwt);
  if (!datos || !estaVigente(datos, Date.now(), MARGEN_DE_CADUCIDAD_MS)) {
    return false;
  }
  token = jwt;
  escribirAlmacen(jwt);
  emitir({ estado: "activa", email: datos.email, exp: datos.exp });
  return true;
}

/**
 * El token para mandar en la cabecera, o `null` si no hay o expira dentro del
 * margen (un minuto por defecto).
 */
export function tokenVigente(
  ahora: number = Date.now(),
  margenMs: number = MARGEN_DE_CADUCIDAD_MS
): string | null {
  obtenerEstadoDeSesion();
  if (!token) return null;
  const datos = decodificarIdToken(token);
  return datos && estaVigente(datos, ahora, margenMs) ? token : null;
}

/** El token guardado, vigente o no. Solo para comparar qué token usó una petición. */
export function tokenGuardado(): string | null {
  obtenerEstadoDeSesion();
  return token;
}

/** Cierra la sesión: borra el token y vuelve a pedir inicio de sesión. */
export function cerrarSesion() {
  token = null;
  escribirAlmacen(null);
  emitir({ estado: "sin_sesion" });
}

/**
 * El backend (o el reloj) dice que el token ya no vale. Solo afecta a una
 * sesión activa: sin sesión no hay nada que caducar. El borrador que la
 * persona tenía en pantalla NO se toca: lo resuelve un diálogo, no una
 * redirección.
 */
export function marcarCaducada() {
  const actual = obtenerEstadoDeSesion();
  if (actual.estado !== "activa") return;
  const email = correoActual();
  token = null;
  escribirAlmacen(null);
  emitir({ estado: "caducada", email });
}

/** El token es válido pero ese correo no está en la lista de administradores. */
export function marcarSinAcceso() {
  const actual = obtenerEstadoDeSesion();
  if (actual.estado !== "activa" && actual.estado !== "caducada") return;
  const email = correoActual();
  token = null;
  escribirAlmacen(null);
  emitir({ estado: "sin_acceso", email });
}

export function suscribirseASesion(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

export function useSesion(): EstadoDeSesion {
  return useSyncExternalStore(
    suscribirseASesion,
    obtenerEstadoDeSesion,
    () => ESTADO_DEL_SERVIDOR
  );
}

/** Solo para los tests: deja el módulo como recién cargado. */
export function reiniciarSesionParaPruebas() {
  token = null;
  estadoActual = null;
  oyentes.clear();
}
