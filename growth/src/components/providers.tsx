"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { ClienteProvider, type ClienteGrowth } from "@/lib/cliente";
import { crearCliente } from "@/lib/crear-cliente";
import { TIEMPO_DE_FRESCURA_MS } from "@/lib/consultas";

/**
 * Los mismos valores por defecto que la app (sin reintentos, sin refetch al
 * enfocar la ventana), con la frescura corta que pide el contrato de Growth:
 * los datos cambian por debajo cuando el agente trabaja.
 */
export function crearQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: TIEMPO_DE_FRESCURA_MS,
        refetchOnWindowFocus: false,
        retry: false,
      },
    },
  });
}

function esPromesa(
  valor: ClienteGrowth | Promise<ClienteGrowth>
): valor is Promise<ClienteGrowth> {
  return typeof (valor as Promise<ClienteGrowth>).then === "function";
}

/**
 * Monta el cliente de datos (el HTTP o, solo en desarrollo con la
 * demostración activa, el de datos de prueba) y la caché de consultas.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(crearQueryClient);
  const [inicial] = useState(crearCliente);
  const [cliente, setCliente] = useState<ClienteGrowth | null>(
    esPromesa(inicial) ? null : inicial
  );

  useEffect(() => {
    if (!esPromesa(inicial)) return;
    let vigente = true;
    void inicial.then((listo) => {
      if (vigente) setCliente(listo);
    });
    return () => {
      vigente = false;
    };
  }, [inicial]);

  return (
    <QueryClientProvider client={queryClient}>
      {cliente ? (
        <ClienteProvider valor={cliente}>{children}</ClienteProvider>
      ) : null}
    </QueryClientProvider>
  );
}
