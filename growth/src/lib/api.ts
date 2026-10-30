import axios, { type InternalAxiosRequestConfig } from "axios";
import { SesionCaducada } from "./api-errors";
import { config } from "./config";
import {
  marcarCaducada,
  marcarSinAcceso,
  tokenGuardado,
  tokenVigente,
} from "./sesion";

/**
 * El cliente HTTP del backend. Las vistas no lo usan directamente: hablan con
 * `useCliente()` (src/lib/cliente.ts), que en los tests y en la demostración
 * es otro.
 *
 * - Cada petición lleva el ID token vigente como `Bearer`, y NADA más: ni en
 *   la URL ni en un parámetro (acabaría en logs). Si no hay token vigente la
 *   petición no sale: se rechaza con `SesionCaducada`.
 * - Un 401 (token rechazado) deja la sesión en «caducada» y un 403 (correo
 *   fuera de la lista) en «sin acceso». Ninguno redirige ni limpia la caché:
 *   la pantalla y lo que la persona estaba escribiendo se quedan.
 * - El 503 («Growth no está configurado.») no toca la sesión: lo cuenta la
 *   pantalla (`mensajeDeError`).
 */

export const api = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: 30_000,
  headers: { Accept: "application/json" },
});

api.interceptors.request.use((peticion) => {
  const token = tokenVigente();
  if (!token) {
    // El reloj ya dio el token por muerto (o nunca lo hubo): sin red.
    marcarCaducada();
    return Promise.reject(new SesionCaducada());
  }
  peticion.headers.set("Authorization", `Bearer ${token}`);
  return peticion;
});

/** El token con el que salió la petición, para no castigar al nuevo. */
function tokenDeLaPeticion(peticion: InternalAxiosRequestConfig | undefined) {
  const cabecera = peticion?.headers?.get("Authorization");
  return typeof cabecera === "string" && cabecera.startsWith("Bearer ")
    ? cabecera.slice("Bearer ".length)
    : null;
}

api.interceptors.response.use(
  (respuesta) => respuesta,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response) {
      const estado = error.response.status;
      // Si ya hay un token distinto del que salió (la persona volvió a iniciar
      // sesión mientras la petición volaba), este fallo es del viejo.
      const esElActual = tokenDeLaPeticion(error.config) === tokenGuardado();
      if (estado === 401 && esElActual) marcarCaducada();
      else if (estado === 403 && esElActual) marcarSinAcceso();
    }
    return Promise.reject(error);
  }
);
