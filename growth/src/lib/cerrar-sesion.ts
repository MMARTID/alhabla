"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { olvidarCuentaDeGoogle } from "./gis";
import { cerrarSesion } from "./sesion";

/**
 * Cerrar sesión de verdad: que Google no vuelva a entrar solo
 * (`disableAutoSelect`), borrar el token y vaciar la caché de consultas (no
 * debe quedar nada del panel para la siguiente cuenta).
 */
export function useCerrarSesion() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    olvidarCuentaDeGoogle();
    cerrarSesion();
    queryClient.clear();
  }, [queryClient]);
}
