"use client";

import { Check } from "lucide-react";
import type { AgentLanguage, IdiomaDelEquipo } from "@/lib/types";

/**
 * Lo que se explica bajo los idiomas: el castellano no se marca y para qué
 * sirven (backend/src/lib/idiomasDelEquipo.ts).
 */
export const NOTA_DE_IDIOMAS =
  "El castellano se da por hecho. A quien llame en uno de estos idiomas, la recepcionista le da cita primero con quien lo habla.";

/** Marca o desmarca un idioma y devuelve la lista en el orden del catálogo
 * (`opciones`), sin repetidos: la que se manda tal cual en `idiomas`. */
export function alternarIdioma(
  value: AgentLanguage[],
  codigo: AgentLanguage,
  opciones: IdiomaDelEquipo[]
): AgentLanguage[] {
  const marcados = new Set(value);
  if (marcados.has(codigo)) marcados.delete(codigo);
  else marcados.add(codigo);
  return opciones
    .map((opcion) => opcion.codigo)
    .filter((opcion) => marcados.has(opcion));
}

/** «inglés», «catalán e inglés», «francés, alemán y ruso»: los marcados que
 * siguen en `opciones`, en minúscula y con «e» delante de un sonido de i. */
export function idiomasEnPalabras(
  value: AgentLanguage[],
  opciones: IdiomaDelEquipo[]
): string {
  const nombres = opciones
    .filter((opcion) => value.includes(opcion.codigo))
    .map((opcion) => opcion.etiqueta.toLocaleLowerCase("es"));
  if (nombres.length <= 1) return nombres[0] ?? "";
  const ultimo = nombres[nombres.length - 1];
  const conjuncion = /^h?i(?![aeiouáéó])/.test(ultimo) ? "e" : "y";
  return `${nombres.slice(0, -1).join(", ")} ${conjuncion} ${ultimo}`;
}

/**
 * Los idiomas que habla un profesional además del castellano, como
 * pastillas que se marcan (casillas nativas, `peer sr-only`: el teclado
 * funciona como en cualquier grupo de casillas). `onChange` recibe la lista
 * completa en el orden del catálogo.
 */
export function IdiomasDelProfesional({
  opciones,
  value,
  onChange,
  idPrefix,
}: {
  opciones: IdiomaDelEquipo[];
  value: AgentLanguage[];
  onChange: (next: AgentLanguage[]) => void;
  idPrefix: string;
}) {
  if (opciones.length === 0) return null;
  return (
    <div className="space-y-2">
      <div
        role="group"
        aria-label="Idiomas que habla además del castellano"
        className="flex flex-wrap gap-1.5"
      >
        {opciones.map((opcion) => {
          const marcado = value.includes(opcion.codigo);
          const id = `${idPrefix}-idioma-${opcion.codigo}`;
          return (
            <label key={opcion.codigo} htmlFor={id} className="cursor-pointer">
              <input
                id={id}
                type="checkbox"
                className="peer sr-only"
                checked={marcado}
                onChange={() =>
                  onChange(alternarIdioma(value, opcion.codigo, opciones))
                }
              />
              <span className="inline-flex min-h-9 items-center gap-1 rounded-full border border-linea bg-superficie px-3 text-sm font-semibold text-muted transition duration-200 hover:text-tinta peer-checked:border-lavado-borde peer-checked:bg-lavado peer-checked:text-morado-tinta peer-focus-visible:ring-2 peer-focus-visible:ring-morado">
                {marcado ? (
                  <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                ) : null}
                {opcion.etiqueta}
              </span>
            </label>
          );
        })}
      </div>
      <p className="text-xs leading-5 text-muted">{NOTA_DE_IDIOMAS}</p>
    </div>
  );
}
