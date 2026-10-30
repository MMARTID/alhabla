"use client";

import { useSearchParams } from "next/navigation";
import { VistaDeBandeja } from "./vista-de-bandeja";

/**
 * La Bandeja con lo que diga la URL: `?menciona=<dominio>` (el enlace de «N
 * menciones» de la Competencia) la abre ya filtrada por ese competidor. La
 * clave remonta la vista si el parámetro cambia, para que el filtro nuevo no
 * quede debajo del que había. Fuera del router (los tests) no hay parámetros.
 */
export function BandejaConUrl() {
  const menciona = useSearchParams()?.get("menciona") ?? undefined;
  return <VistaDeBandeja key={menciona ?? ""} mencionaInicial={menciona} />;
}
