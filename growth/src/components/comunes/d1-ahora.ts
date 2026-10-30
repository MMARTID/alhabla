"use client";

import { useEffect, useState } from "react";

/**
 * El instante actual en milisegundos, fijado al montar y refrescado cada
 * minuto. Sirve para calcular plazos («vencida», «caduca en 3 d») sin llamar a
 * `Date.now()` mientras se pinta, y para que una pantalla abierta mucho rato
 * no siga enseñando como vigente algo que ya venció.
 */
export function useAhora(intervaloMs = 60_000): number {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const temporizador = setInterval(() => setAhora(Date.now()), intervaloMs);
    return () => clearInterval(temporizador);
  }, [intervaloMs]);
  return ahora;
}
