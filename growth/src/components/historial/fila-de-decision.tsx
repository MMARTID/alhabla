import { Bot, Cog, User } from "lucide-react";
import Link from "next/link";
import { InsigniaDeEstado } from "@/components/insignia";
import {
  ETIQUETA_DE_TIPO_DE_BORRADOR,
  etiquetaDeAccionDelRegistro,
  etiquetaDeAutor,
} from "@/lib/etiquetas";
import { formatearFechaYHora } from "@/lib/formato";
import type { DecisionDelHistorial } from "@/lib/types";

/**
 * Quién hizo algo, en tres formas: un correo (tú), `agente:<nombre>` o
 * `sistema`. El icono es solo un apoyo: el texto dice lo mismo.
 */
function IconoDeAutor({ por }: { por: string }) {
  const Icono =
    por === "sistema" ? Cog : por.startsWith("agente:") ? Bot : User;
  return <Icono className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
}

/**
 * Una fila del registro de decisiones. Todo lo que viene del backend (título,
 * dominio, motivo, autor) es dato de terceros o del agente: se pinta como
 * texto y la única navegación es a la Revisión, dentro del panel.
 */
export function FilaDeDecision({
  decision,
}: {
  decision: DecisionDelHistorial;
}) {
  const { oportunidad, borrador } = decision;
  return (
    <li className="panel p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <p className="min-w-0 text-sm font-semibold text-tinta">
          {etiquetaDeAccionDelRegistro(decision.accion)}
          {borrador ? (
            <span className="font-normal text-muted">
              {" "}
              · Borrador v{borrador.version} (
              {ETIQUETA_DE_TIPO_DE_BORRADOR[borrador.tipo] ?? borrador.tipo})
            </span>
          ) : null}
        </p>
        {oportunidad ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
            <span className="sr-only">Estado actual de la oportunidad: </span>
            <span aria-hidden="true">Ahora</span>
            <InsigniaDeEstado estado={oportunidad.estado} />
          </span>
        ) : null}
      </div>

      <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted">
        <IconoDeAutor por={decision.por} />
        <span className="break-all">{etiquetaDeAutor(decision.por)}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={decision.en}>{formatearFechaYHora(decision.en)}</time>
      </p>

      {oportunidad ? (
        <p className="mt-3 text-sm">
          <Link
            href={`/oportunidad/${encodeURIComponent(oportunidad.id)}`}
            className="rounded-sm font-medium text-tinta underline decoration-linea-fuerte underline-offset-2 hover:decoration-morado focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado"
          >
            {oportunidad.titulo || oportunidad.dominio}
          </Link>
          <span className="text-muted"> · {oportunidad.dominio}</span>
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted">
          No cuelga de ninguna oportunidad.
        </p>
      )}

      {decision.motivo ? (
        <p className="mt-3 whitespace-pre-line break-words border-l-2 border-linea pl-3 text-sm text-tinta-2">
          {decision.motivo}
        </p>
      ) : null}
    </li>
  );
}
