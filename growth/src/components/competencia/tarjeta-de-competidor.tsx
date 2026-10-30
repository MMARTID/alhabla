import Link from "next/link";
import { Swords } from "lucide-react";
import { Insignia } from "@/components/insignia";
import {
  ETIQUETA_DE_ESTADO_DE_COMPETIDOR,
  ETIQUETA_DE_ORIGEN_DE_COMPETIDOR,
  TONO_DE_ESTADO_DE_COMPETIDOR,
} from "@/lib/etiquetas";
import { formatearDistancia } from "@/lib/formato";
import type { CompetidorResumen } from "@/lib/types";
import { AccionesDePropuesta } from "./acciones-de-propuesta";
import {
  rutaDeCompetidor,
  rutaDeMenciones,
  tieneAnalisisCaducado,
} from "./utilidades";

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

/** Lo que dice la tarjeta del análisis, según en qué punto está. */
function SituacionDelAnalisis({
  competidor,
}: {
  competidor: CompetidorResumen;
}) {
  const { estado, analisis, analisisSolicitadoEn } = competidor;
  if (estado === "propuesto") return null;
  let texto: string;
  if (estado === "por_analizar") {
    texto = analisisSolicitadoEn
      ? `El agente lo analizará en su próxima ejecución · pedido ${formatearDistancia(analisisSolicitadoEn)}.`
      : "El agente lo analizará en su próxima ejecución.";
  } else if (analisis) {
    texto = `Análisis v${analisis.version} · ${plural(analisis.numDatos, "dato", "datos")} · ${formatearDistancia(analisis.creadoEn)}${
      analisis.revisadoEn
        ? ` · revisado ${formatearDistancia(analisis.revisadoEn)}`
        : ""
    }.`;
  } else {
    texto = "Todavía sin análisis.";
  }
  return <p className="mt-2 text-sm text-muted">{texto}</p>;
}

/**
 * Un competidor de la lista. Toda la tarjeta lleva a su ficha (el enlace del
 * nombre se estira sobre ella); las menciones y las acciones de un propuesto
 * quedan por encima. El nombre, el dominio y las notas pueden venir de un
 * modelo que leyó páginas ajenas: se pintan como texto, el dominio nunca como
 * enlace.
 */
export function TarjetaDeCompetidor({
  competidor,
}: {
  competidor: CompetidorResumen;
}) {
  const propuesto = competidor.estado === "propuesto";
  return (
    <li className="panel relative flex gap-4 p-4 transition duration-150 hover:border-linea-fuerte sm:p-5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-lavado text-morado">
        <Swords className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-semibold leading-snug text-tinta [overflow-wrap:anywhere]">
          <Link
            href={rutaDeCompetidor(competidor.id)}
            className="rounded-sm after:absolute after:inset-0 after:rounded-3xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-morado"
          >
            {competidor.nombre}
          </Link>
        </h3>
        <p className="mt-0.5 font-mono text-xs text-muted [overflow-wrap:anywhere]">
          {competidor.dominio}
        </p>
        <p className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <Insignia tono={TONO_DE_ESTADO_DE_COMPETIDOR[competidor.estado]}>
            {ETIQUETA_DE_ESTADO_DE_COMPETIDOR[competidor.estado]}
          </Insignia>
          {!propuesto ? (
            <Insignia>
              {ETIQUETA_DE_ORIGEN_DE_COMPETIDOR[competidor.origen]}
            </Insignia>
          ) : null}
          {tieneAnalisisCaducado(competidor) ? (
            <Insignia tono="aviso">Análisis caducado</Insignia>
          ) : null}
        </p>
        <p className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          <span>
            {plural(competidor.oportunidades, "oportunidad", "oportunidades")}
          </span>
          {competidor.menciones > 0 ? (
            <Link
              href={rutaDeMenciones(competidor.dominio)}
              className="relative z-10 inline-flex min-h-11 items-center font-semibold text-morado-tinta underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado"
            >
              {plural(competidor.menciones, "mención", "menciones")}{" "}
              <span className="sr-only">
                de {competidor.nombre} en la Bandeja
              </span>
            </Link>
          ) : (
            <span>Sin menciones</span>
          )}
        </p>
        <SituacionDelAnalisis competidor={competidor} />
        {propuesto ? (
          <>
            {competidor.notas ? (
              <p className="mt-2 line-clamp-3 whitespace-pre-line rounded-[10px] bg-relleno p-3 text-sm text-tinta-2 [overflow-wrap:anywhere]">
                {competidor.notas}
              </p>
            ) : null}
            <AccionesDePropuesta
              id={competidor.id}
              nombre={competidor.nombre}
              className="relative z-10 mt-3"
            />
          </>
        ) : null}
      </div>
    </li>
  );
}
