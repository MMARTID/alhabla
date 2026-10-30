"use client";

import { useMemo } from "react";
import { useCompetidores } from "@/lib/consultas";
import type { CompetidorResumen } from "@/lib/types";

/**
 * Los competidores que conoce el panel, para poner nombre a los dominios que
 * una oportunidad menciona. Mientras carga o si falla, las dos salidas van
 * vacías y quien las usa enseña el dominio (la vista no depende de ello).
 */
export function useNombresDeCompetidores(): {
  /** dominio → nombre */
  nombres: ReadonlyMap<string, string>;
  /** Los que ya cuentan como competidor (un `propuesto` aún no puede mencionarse). */
  mencionables: readonly CompetidorResumen[];
} {
  const consulta = useCompetidores();
  const lista = consulta.data?.data;
  return useMemo(() => {
    const todos = lista ?? [];
    return {
      nombres: new Map(todos.map((c) => [c.dominio, c.nombre])),
      mencionables: todos.filter((c) => c.estado !== "propuesto"),
    };
  }, [lista]);
}
