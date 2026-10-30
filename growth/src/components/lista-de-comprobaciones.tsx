import { CircleCheck, CircleX, TriangleAlert } from "lucide-react";
import { etiquetaDeRegla } from "@/lib/etiquetas";
import type { Comprobacion } from "@/lib/types";

/**
 * Las comprobaciones de cumplimiento de una revisión: las reglas duras que
 * fallan en rojo (bloquean), las blandas en ámbar (avisan) y las correctas en
 * verde. El `detalle` es texto del backend y se pinta como texto.
 */
export function ListaDeComprobaciones({
  comprobaciones,
  soloFallidas = false,
}: {
  comprobaciones: readonly Comprobacion[];
  soloFallidas?: boolean;
}) {
  const visibles = soloFallidas
    ? comprobaciones.filter((c) => !c.ok)
    : comprobaciones;
  if (visibles.length === 0) return null;
  return (
    <ul className="space-y-2.5">
      {visibles.map((c, i) => {
        const bloquea = !c.ok && c.dura;
        const avisa = !c.ok && !c.dura;
        const Icono = bloquea ? CircleX : avisa ? TriangleAlert : CircleCheck;
        const color = bloquea
          ? "text-error"
          : avisa
            ? "text-aviso"
            : "text-exito";
        const estado = bloquea ? "Bloquea" : avisa ? "Aviso" : "Correcta";
        return (
          <li key={`${c.regla}-${i}`} className="flex items-start gap-2.5">
            <Icono
              className={`mt-0.5 h-4 w-4 shrink-0 ${color}`}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p
                className={`text-sm font-semibold ${bloquea || avisa ? color : "text-tinta"}`}
              >
                {etiquetaDeRegla(c.regla)}
                <span className="sr-only"> — {estado}</span>
              </p>
              <p className="text-sm text-muted">{c.detalle}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
