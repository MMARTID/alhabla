"use client";

import {
  createContext,
  createElement,
  useContext,
  type ReactNode,
} from "react";
import type {
  Ajustes,
  CambiosDeAjustes,
  Decision,
  DetalleDeBorrador,
  DetalleDeEjecucion,
  DetalleDeOportunidad,
  EdicionDeBorrador,
  FiltrosDeBorradores,
  FiltrosDeDecisiones,
  FiltrosDeEjecuciones,
  FiltrosDeGestiones,
  FiltrosDeOportunidades,
  HistorialDeAfirmacion,
  ListaDeBorradores,
  ListaDeDecisiones,
  ListaDeEjecuciones,
  ListaDeGestiones,
  ListaDeOportunidades,
  NuevaUrl,
  RespuestaDeConocimiento,
  RespuestaDeCompetidores,
  RespuestaDeDecision,
  RespuestaDeEdicion,
  RespuestaDeNuevaUrl,
  Resumen,
  TipoDeAfirmacion,
  Yo,
} from "./types";

/**
 * Todo lo que el panel pide al backend, con los nombres de la API de
 * administración de Growth (`/growth/admin/*`). Las vistas llaman a
 * `useCliente()` y a TanStack Query, nunca a axios: así los tests inyectan un
 * cliente falso y la demostración un cliente con datos de prueba.
 *
 * Todos los métodos rechazan con el error de axios del backend (`mensajeDeError`
 * lo convierte en una frase) o con `ErrorDeCliente` en la demostración.
 */
export interface ClienteGrowth {
  /** GET /yo: quién es la sesión. Distingue 401, 403 y 503 al entrar. */
  yo(): Promise<Yo>;
  /** GET /resumen: contadores de la bandeja, topes, descartes y estado del sistema. */
  resumen(): Promise<Resumen>;

  /** GET /oportunidades */
  listarOportunidades(
    filtros?: FiltrosDeOportunidades
  ): Promise<ListaDeOportunidades>;
  /** POST /oportunidades: «Añadir URL». 201 si es nueva, 200 si ya existía. */
  anadirUrl(nueva: NuevaUrl): Promise<RespuestaDeNuevaUrl>;
  /** GET /oportunidades/:id */
  detalleDeOportunidad(id: string): Promise<DetalleDeOportunidad>;
  /** POST /oportunidades/:id/decision */
  decidir(id: string, decision: Decision): Promise<RespuestaDeDecision>;

  /** GET /borradores */
  listarBorradores(filtros?: FiltrosDeBorradores): Promise<ListaDeBorradores>;
  /** GET /borradores/:id */
  detalleDeBorrador(id: string): Promise<DetalleDeBorrador>;
  /** PATCH /borradores/:id: «Aprobar con ediciones» es esto y luego `decidir`. */
  editarBorrador(
    id: string,
    cambios: EdicionDeBorrador
  ): Promise<RespuestaDeEdicion>;

  /** GET /decisiones: el registro inmutable. */
  listarDecisiones(filtros?: FiltrosDeDecisiones): Promise<ListaDeDecisiones>;
  /** GET /gestiones: lo que hiciste a mano. */
  listarGestiones(filtros?: FiltrosDeGestiones): Promise<ListaDeGestiones>;

  /** GET /conocimiento: afirmaciones vigentes por tipo. */
  conocimiento(tipo?: TipoDeAfirmacion): Promise<RespuestaDeConocimiento>;
  /** GET /conocimiento/:clave/historial */
  historialDeAfirmacion(clave: string): Promise<HistorialDeAfirmacion>;

  /** GET /ejecuciones */
  listarEjecuciones(
    filtros?: FiltrosDeEjecuciones
  ): Promise<ListaDeEjecuciones>;
  /** GET /ejecuciones/:id */
  detalleDeEjecucion(id: string): Promise<DetalleDeEjecucion>;

  /** GET /ajustes */
  ajustes(): Promise<Ajustes>;
  /** PUT /ajustes: devuelve los ajustes ya actualizados. */
  guardarAjustes(cambios: CambiosDeAjustes): Promise<Ajustes>;
  /** GET /competidores (solo lectura en la 1b). */
  competidores(): Promise<RespuestaDeCompetidores>;
}

const ContextoDeCliente = createContext<ClienteGrowth | null>(null);

/** Inyecta el cliente: el HTTP, el de demostración o uno falso en un test. */
export function ClienteProvider({
  valor,
  children,
}: {
  valor: ClienteGrowth;
  children?: ReactNode;
}) {
  return createElement(ContextoDeCliente.Provider, { value: valor }, children);
}

export function useCliente(): ClienteGrowth {
  const cliente = useContext(ContextoDeCliente);
  if (!cliente) {
    throw new Error("useCliente debe usarse dentro de un ClienteProvider.");
  }
  return cliente;
}
