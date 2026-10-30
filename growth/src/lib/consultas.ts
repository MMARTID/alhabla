"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useCliente } from "./cliente";
import type {
  AltaDeCompetidor,
  CambioDeCompetidor,
  CambiosDeAjustes,
  Decision,
  EdicionDeBorrador,
  FiltrosDeBorradores,
  FiltrosDeDecisiones,
  FiltrosDeEjecuciones,
  FiltrosDeGestiones,
  FiltrosDeOportunidades,
  NuevaUrl,
  RevisionDeAnalisis,
  TipoDeAfirmacion,
} from "./types";

/**
 * Los hooks de datos del panel: TanStack Query sobre `useCliente()`. Las
 * vistas usan estos y no hablan con el cliente a mano, salvo en casos raros.
 *
 * Reglas del contrato de la 1b: nada de `staleTime` largo (los datos cambian
 * por debajo cuando el agente trabaja; 15 s como mucho) y TODA mutación
 * invalida lo que cuelga de `["growth"]`. Sin `refetchInterval` por debajo de
 * 60 s: el límite global es de 100 peticiones por minuto e IP.
 */

export const TIEMPO_DE_FRESCURA_MS = 15_000;

/** Prefijo común de todas las consultas del panel. */
const RAIZ = "growth";

export const claves = {
  todas: [RAIZ] as const,
  yo: (email: string | null) => [RAIZ, "yo", email] as const,
  resumen: () => [RAIZ, "resumen"] as const,
  oportunidades: (filtros: FiltrosDeOportunidades = {}) =>
    [RAIZ, "oportunidades", filtros] as const,
  oportunidad: (id: string) => [RAIZ, "oportunidad", id] as const,
  borradores: (filtros: FiltrosDeBorradores = {}) =>
    [RAIZ, "borradores", filtros] as const,
  borrador: (id: string) => [RAIZ, "borrador", id] as const,
  decisiones: (filtros: FiltrosDeDecisiones = {}) =>
    [RAIZ, "decisiones", filtros] as const,
  gestiones: (filtros: FiltrosDeGestiones = {}) =>
    [RAIZ, "gestiones", filtros] as const,
  conocimiento: (tipo?: TipoDeAfirmacion) =>
    [RAIZ, "conocimiento", tipo ?? null] as const,
  historialDeAfirmacion: (clave: string) =>
    [RAIZ, "historial-de-afirmacion", clave] as const,
  ejecuciones: (filtros: FiltrosDeEjecuciones = {}) =>
    [RAIZ, "ejecuciones", filtros] as const,
  ejecucion: (id: string) => [RAIZ, "ejecucion", id] as const,
  ajustes: () => [RAIZ, "ajustes"] as const,
  competidores: () => [RAIZ, "competidores"] as const,
  competidor: (id: string) => [RAIZ, "competidor", id] as const,
  analisisDeCompetidor: (id: string, analisisId: string) =>
    [RAIZ, "competidor", id, "analisis", analisisId] as const,
};

/**
 * Tras cualquier cambio se refresca todo lo del panel (hay contadores en
 * varias vistas) salvo `yo`, que no cambia con una decisión.
 */
export function invalidarTodoGrowth(
  queryClient: QueryClient,
  /** Consultas que NO se refrescan (la ficha de algo que acaba de borrarse). */
  excluir?: (clave: readonly unknown[]) => boolean
) {
  return queryClient.invalidateQueries({
    predicate: (consulta) =>
      consulta.queryKey[0] === RAIZ &&
      consulta.queryKey[1] !== "yo" &&
      !excluir?.(consulta.queryKey),
  });
}

// --- Lecturas ---------------------------------------------------------------

export function useYo(email: string | null, habilitada = true) {
  const cliente = useCliente();
  return useQuery({
    queryKey: claves.yo(email),
    queryFn: () => cliente.yo(),
    enabled: habilitada,
    staleTime: 5 * 60_000,
  });
}

export function useResumen() {
  const cliente = useCliente();
  return useQuery({
    queryKey: claves.resumen(),
    queryFn: () => cliente.resumen(),
    staleTime: TIEMPO_DE_FRESCURA_MS,
  });
}

export function useOportunidades(filtros: FiltrosDeOportunidades = {}) {
  const cliente = useCliente();
  return useQuery({
    queryKey: claves.oportunidades(filtros),
    queryFn: () => cliente.listarOportunidades(filtros),
    staleTime: TIEMPO_DE_FRESCURA_MS,
    // Al cambiar de página o de filtro se sigue viendo la lista anterior.
    placeholderData: keepPreviousData,
  });
}

export function useDetalleDeOportunidad(id: string) {
  const cliente = useCliente();
  return useQuery({
    queryKey: claves.oportunidad(id),
    queryFn: () => cliente.detalleDeOportunidad(id),
    staleTime: TIEMPO_DE_FRESCURA_MS,
  });
}

export function useBorradores(filtros: FiltrosDeBorradores = {}) {
  const cliente = useCliente();
  return useQuery({
    queryKey: claves.borradores(filtros),
    queryFn: () => cliente.listarBorradores(filtros),
    staleTime: TIEMPO_DE_FRESCURA_MS,
    placeholderData: keepPreviousData,
  });
}

export function useDetalleDeBorrador(id: string) {
  const cliente = useCliente();
  return useQuery({
    queryKey: claves.borrador(id),
    queryFn: () => cliente.detalleDeBorrador(id),
    staleTime: TIEMPO_DE_FRESCURA_MS,
  });
}

export function useDecisiones(filtros: FiltrosDeDecisiones = {}) {
  const cliente = useCliente();
  return useQuery({
    queryKey: claves.decisiones(filtros),
    queryFn: () => cliente.listarDecisiones(filtros),
    staleTime: TIEMPO_DE_FRESCURA_MS,
    placeholderData: keepPreviousData,
  });
}

export function useGestiones(filtros: FiltrosDeGestiones = {}) {
  const cliente = useCliente();
  return useQuery({
    queryKey: claves.gestiones(filtros),
    queryFn: () => cliente.listarGestiones(filtros),
    staleTime: TIEMPO_DE_FRESCURA_MS,
    placeholderData: keepPreviousData,
  });
}

export function useConocimiento(tipo?: TipoDeAfirmacion) {
  const cliente = useCliente();
  return useQuery({
    queryKey: claves.conocimiento(tipo),
    queryFn: () => cliente.conocimiento(tipo),
    staleTime: TIEMPO_DE_FRESCURA_MS,
  });
}

/** El historial de una clave; con `clave` en `null` no pide nada. */
export function useHistorialDeAfirmacion(clave: string | null) {
  const cliente = useCliente();
  return useQuery({
    queryKey: claves.historialDeAfirmacion(clave ?? ""),
    queryFn: () => cliente.historialDeAfirmacion(clave as string),
    enabled: clave !== null,
    staleTime: TIEMPO_DE_FRESCURA_MS,
  });
}

export function useEjecuciones(filtros: FiltrosDeEjecuciones = {}) {
  const cliente = useCliente();
  return useQuery({
    queryKey: claves.ejecuciones(filtros),
    queryFn: () => cliente.listarEjecuciones(filtros),
    staleTime: TIEMPO_DE_FRESCURA_MS,
    placeholderData: keepPreviousData,
  });
}

/** El detalle de una ejecución; con `id` en `null` no pide nada. */
export function useDetalleDeEjecucion(id: string | null) {
  const cliente = useCliente();
  return useQuery({
    queryKey: claves.ejecucion(id ?? ""),
    queryFn: () => cliente.detalleDeEjecucion(id as string),
    enabled: id !== null,
    staleTime: TIEMPO_DE_FRESCURA_MS,
  });
}

export function useAjustes() {
  const cliente = useCliente();
  return useQuery({
    queryKey: claves.ajustes(),
    queryFn: () => cliente.ajustes(),
    staleTime: TIEMPO_DE_FRESCURA_MS,
  });
}

export function useCompetidores() {
  const cliente = useCliente();
  return useQuery({
    queryKey: claves.competidores(),
    queryFn: () => cliente.competidores(),
    staleTime: TIEMPO_DE_FRESCURA_MS,
  });
}

/** La ficha de un competidor con su último análisis y la lista de versiones. */
export function useDetalleDeCompetidor(id: string) {
  const cliente = useCliente();
  return useQuery({
    queryKey: claves.competidor(id),
    queryFn: () => cliente.detalleDeCompetidor(id),
    staleTime: TIEMPO_DE_FRESCURA_MS,
  });
}

/** Una versión concreta del análisis; con `analisisId` en `null` no pide nada. */
export function useAnalisisDeCompetidor(id: string, analisisId: string | null) {
  const cliente = useCliente();
  return useQuery({
    queryKey: claves.analisisDeCompetidor(id, analisisId ?? ""),
    queryFn: () => cliente.analisisDeCompetidor(id, analisisId as string),
    enabled: analisisId !== null,
    staleTime: TIEMPO_DE_FRESCURA_MS,
  });
}

// --- Escrituras -------------------------------------------------------------
//
// Ninguna reintenta sola: si falla, la persona decide (una decisión repetida
// por un reintento silencioso sería peor que un error visible).

export function useDecidir(oportunidadId: string) {
  const cliente = useCliente();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (decision: Decision) =>
      cliente.decidir(oportunidadId, decision),
    onSettled: () => invalidarTodoGrowth(queryClient),
  });
}

export function useAnadirUrl() {
  const cliente = useCliente();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (nueva: NuevaUrl) => cliente.anadirUrl(nueva),
    onSettled: () => invalidarTodoGrowth(queryClient),
  });
}

export function useEditarBorrador(borradorId: string) {
  const cliente = useCliente();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cambios: EdicionDeBorrador) =>
      cliente.editarBorrador(borradorId, cambios),
    onSettled: () => invalidarTodoGrowth(queryClient),
  });
}

export function useGuardarAjustes() {
  const cliente = useCliente();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cambios: CambiosDeAjustes) => cliente.guardarAjustes(cambios),
    onSettled: () => invalidarTodoGrowth(queryClient),
  });
}

// --- Competencia ------------------------------------------------------------

export function useAnadirCompetidor() {
  const cliente = useCliente();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (alta: AltaDeCompetidor) => cliente.anadirCompetidor(alta),
    onSettled: () => invalidarTodoGrowth(queryClient),
  });
}

export function useEditarCompetidor(id: string) {
  const cliente = useCliente();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cambios: CambioDeCompetidor) =>
      cliente.editarCompetidor(id, cambios),
    onSettled: () => invalidarTodoGrowth(queryClient),
  });
}

/**
 * Quitar un competidor o rechazar un propuesto. No refresca su propia ficha:
 * acaba de borrarse y pedirla de nuevo daría un 404 justo antes de salir de
 * la pantalla.
 */
export function useQuitarCompetidor(id: string) {
  const cliente = useCliente();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => cliente.quitarCompetidor(id),
    onSettled: () =>
      invalidarTodoGrowth(
        queryClient,
        (clave) => clave[1] === "competidor" && clave[2] === id
      ),
  });
}

export function useAceptarCompetidor(id: string) {
  const cliente = useCliente();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => cliente.aceptarCompetidor(id),
    onSettled: () => invalidarTodoGrowth(queryClient),
  });
}

export function useReanalizarCompetidor(id: string) {
  const cliente = useCliente();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => cliente.reanalizarCompetidor(id),
    onSettled: () => invalidarTodoGrowth(queryClient),
  });
}

export function useRevisarAnalisis(id: string, analisisId: string) {
  const cliente = useCliente();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (revision: RevisionDeAnalisis) =>
      cliente.revisarAnalisis(id, analisisId, revision),
    onSettled: () => invalidarTodoGrowth(queryClient),
  });
}
