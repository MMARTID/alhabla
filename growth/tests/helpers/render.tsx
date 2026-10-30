import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderResult } from "@testing-library/react";
import type { ReactElement } from "react";
import { ClienteProvider, type ClienteGrowth } from "@/lib/cliente";

/** Una caché nueva por test, sin reintentos ni frescura que oculte un fallo. */
export function crearQueryClientDePrueba() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

/** Pinta con caché de consultas y cliente de datos inyectado. */
export function renderConCliente(
  ui: ReactElement,
  cliente: ClienteGrowth,
  queryClient: QueryClient = crearQueryClientDePrueba()
): RenderResult & { queryClient: QueryClient } {
  const resultado = render(
    <QueryClientProvider client={queryClient}>
      <ClienteProvider valor={cliente}>{ui}</ClienteProvider>
    </QueryClientProvider>
  );
  return Object.assign(resultado, { queryClient });
}
