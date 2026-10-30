import { GitCommitHorizontal, RefreshCw, TriangleAlert } from "lucide-react";
import { commitCorto, formatearDistancia } from "@/lib/formato";
import type { Snapshot } from "@/lib/types";
import {
  DIAS_PARA_DAR_POR_OBSOLETO,
  HORAS_PARA_DAR_POR_OBSOLETO,
} from "./utilidades";

/** ¿Hace más de 8 días que no se sincroniza? Se fía de la marca del backend y de la edad. */
export function snapshotObsoleto(snapshot: NonNullable<Snapshot>): boolean {
  return (
    snapshot.obsoleto || snapshot.antiguedadHoras > HORAS_PARA_DAR_POR_OBSOLETO
  );
}

/**
 * Cuándo se sincronizó el conocimiento por última vez y desde qué commit, con
 * un aviso en ámbar si lleva más de 8 días sin hacerlo: un precio o una
 * función pueden haber cambiado en la web y el agente seguiría citando lo
 * viejo.
 */
export function BarraDeSnapshot({
  snapshot,
  vigentes,
  truncado,
}: {
  snapshot: Snapshot;
  /** Afirmaciones vigentes que enseña la vista. */
  vigentes: number;
  /** Hay más de 1.000 vigentes: la lista está recortada. */
  truncado: boolean;
}) {
  if (snapshot === null) {
    return (
      <p className="mb-5 flex items-start gap-2 text-sm text-muted">
        <RefreshCw
          className="mt-0.5 h-4 w-4 shrink-0 text-tenue"
          aria-hidden="true"
        />
        Sin fecha de sincronización: estas afirmaciones no vienen de una
        sincronización registrada.
      </p>
    );
  }
  const obsoleto = snapshotObsoleto(snapshot);
  const dias = Math.floor(snapshot.antiguedadHoras / 24);
  return (
    <div className="mb-5 space-y-3">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
        <RefreshCw className="h-4 w-4 shrink-0 text-tenue" aria-hidden="true" />
        <span>
          Sincronizado{" "}
          <time dateTime={snapshot.sincronizadoEn} className="text-tinta">
            {formatearDistancia(snapshot.sincronizadoEn)}
          </time>
        </span>
        <span aria-hidden="true">·</span>
        <span className="inline-flex items-center gap-1">
          <GitCommitHorizontal className="h-4 w-4" aria-hidden="true" />
          commit{" "}
          <code className="font-mono text-tinta">
            {commitCorto(snapshot.commitSha)}
          </code>
        </span>
        <span aria-hidden="true">·</span>
        <span>
          {vigentes}{" "}
          {vigentes === 1 ? "afirmación vigente" : "afirmaciones vigentes"}
        </span>
      </p>

      {obsoleto ? (
        <div className="flex items-start gap-3 rounded-[10px] border border-aviso-borde bg-aviso-fondo p-4">
          <TriangleAlert
            className="mt-0.5 h-5 w-5 shrink-0 text-aviso"
            aria-hidden="true"
          />
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-aviso">
              El conocimiento está desactualizado
            </p>
            <p className="mt-1 text-tinta-2">
              Hace {dias} {dias === 1 ? "día" : "días"} que no se sincroniza (el
              límite son {DIAS_PARA_DAR_POR_OBSOLETO}). Lo que el agente sepa de
              precios, funciones y límites puede haber cambiado en la web.
              Sincroniza antes de la próxima ejecución con la herramienta{" "}
              <code className="font-mono">sincronizar_conocimiento</code> del
              MCP alhabla-growth.
            </p>
          </div>
        </div>
      ) : null}

      {truncado ? (
        <p className="text-sm text-muted">
          Hay más de 1.000 afirmaciones vigentes: la lista está recortada y no
          enseña todas.
        </p>
      ) : null}
    </div>
  );
}
