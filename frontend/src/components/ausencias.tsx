"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarOff } from "lucide-react";
import { getAusencias, quitarAusencia } from "@/lib/api";
import { textoDeAusencia } from "@/lib/ausencias";
import type { AusenciaDelEquipo } from "@/lib/types";
import { Dialogo } from "@/components/escritorio/dialogo";

/** Ausencias del equipo que se solapan con [desde, hasta) (instantes ISO). */
export function useAusencias(desde: string, hasta: string) {
  return useQuery({
    queryKey: ["ausencias", desde, hasta],
    queryFn: () => getAusencias(desde, hasta),
    staleTime: 30_000,
  });
}

/** Quitar una ausencia: la recepcionista vuelve a ofrecer ese tramo en la
 * siguiente llamada (el backend lee la tabla en cada consulta). */
export function useQuitarAusencia(avisar: (texto: string, tipo?: "error") => void, alQuitar?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ausencia: AusenciaDelEquipo) => quitarAusencia(ausencia.id),
    onSuccess: async (_, ausencia) => {
      await queryClient.invalidateQueries({ queryKey: ["ausencias"] });
      avisar(`Ausencia de ${ausencia.professionalName} quitada. La recepcionista vuelve a ofrecer ese tramo.`);
      alQuitar?.();
    },
    onError: async () => {
      // Puede que ya no exista (la quitó el Gestor): se refresca la lista.
      await queryClient.invalidateQueries({ queryKey: ["ausencias"] });
      avisar("No se pudo quitar la ausencia. Prueba de nuevo.", "error");
      alQuitar?.();
    },
  });
}

/** Confirmación antes de quitar: reabre el tramo para nuevas reservas. */
export function DialogoQuitarAusencia({
  ausencia,
  timeZone,
  quitando,
  onCerrar,
  onConfirmar,
}: {
  ausencia: AusenciaDelEquipo | null;
  timeZone: string;
  quitando: boolean;
  onCerrar: () => void;
  onConfirmar: (ausencia: AusenciaDelEquipo) => void;
}) {
  return (
    <Dialogo
      abierto={ausencia !== null}
      onCerrar={onCerrar}
      titulo={`¿Quitar la ausencia de ${ausencia?.professionalName ?? "esta persona"}?`}
      descripcion={
        ausencia
          ? `${ausencia.professionalName} ${textoDeAusencia(ausencia, timeZone)}${ausencia.reason ? ` (${ausencia.reason})` : ""}. La recepcionista volverá a reservarle citas en ese tramo.`
          : undefined
      }
      pie={
        <>
          <button type="button" onClick={onCerrar} disabled={quitando} className="btn-secondary h-10 px-4">
            Dejarla
          </button>
          <button
            type="button"
            onClick={() => ausencia && onConfirmar(ausencia)}
            disabled={quitando}
            className="btn-primary h-10 px-4"
          >
            {quitando ? "Quitando…" : "Quitar ausencia"}
          </button>
        </>
      }
    />
  );
}

/** Las ausencias por venir de una persona, cada una con su «Quitar». */
export function AusenciasDeLaPersona({
  ausencias,
  timeZone,
  onQuitar,
}: {
  ausencias: AusenciaDelEquipo[];
  timeZone: string;
  onQuitar: (ausencia: AusenciaDelEquipo) => void;
}) {
  if (ausencias.length === 0) return null;
  return (
    <ul className="space-y-1.5" aria-label="Ausencias por venir">
      {ausencias.map((ausencia) => (
        <li
          key={ausencia.id}
          className="flex items-center gap-2.5 rounded-xl border border-lavado-borde bg-lavado px-3 py-2 text-sm text-tinta-2"
        >
          <CalendarOff className="h-4 w-4 shrink-0 text-morado" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="font-semibold">Ausente {textoDeAusencia(ausencia, timeZone)}</span>
            {ausencia.reason ? <span className="text-muted"> · {ausencia.reason}</span> : null}
          </span>
          <button
            type="button"
            onClick={() => onQuitar(ausencia)}
            aria-label={`Quitar la ausencia de ${ausencia.professionalName} (${textoDeAusencia(ausencia, timeZone)})`}
            className="h-8 shrink-0 rounded-[10px] px-2.5 text-sm font-semibold text-morado-tinta transition hover:bg-superficie focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado"
          >
            Quitar
          </button>
        </li>
      ))}
    </ul>
  );
}
