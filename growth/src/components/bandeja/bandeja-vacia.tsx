import Link from "next/link";
import { Inbox } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import { EstadoVacio } from "@/components/estado-vacio";
import { etiquetaDeCodigoDeDescarte } from "@/lib/etiquetas";
import { formatearDistancia } from "@/lib/formato";
import type { Resumen } from "@/lib/types";

const TEXTO_DE_EJECUCION = {
  en_curso: "sigue en curso",
  ok: "terminó bien",
  parcial: "terminó con módulos a medias",
  error: "terminó con error",
} as const;

/**
 * Lo que dice la Bandeja cuando no hay nada que mirar. Honesta: no es «todo
 * va bien», es «esto es lo que pasó esta semana»: cuántas candidatas se
 * descartaron y por qué, y cuándo corrió el agente por última vez. Si el
 * agente no ha corrido o está en pausa, lo dice en vez de dar a entender que
 * no había nada.
 */
export function BandejaVacia({
  resumen,
}: {
  resumen: UseQueryResult<Resumen, Error>;
}) {
  return (
    <EstadoVacio
      icono={Inbox}
      titulo="Esta semana no hay nada que merezca tu tiempo"
    >
      <DetalleDeLaSemana resumen={resumen} />
    </EstadoVacio>
  );
}

function DetalleDeLaSemana({
  resumen,
}: {
  resumen: UseQueryResult<Resumen, Error>;
}) {
  if (resumen.isPending) return <p>Mirando qué pasó esta semana…</p>;
  if (resumen.isError) {
    return (
      <p>
        No se pudo cargar el recuento de descartes de la semana, así que no
        puedo decirte qué se quedó fuera.
      </p>
    );
  }
  const {
    descartesUltimos7Dias: descartes,
    ultimaEjecucion,
    pausa,
  } = resumen.data;
  return (
    <div className="space-y-3 text-left sm:text-center">
      {pausa ? (
        <p className="font-semibold text-aviso">
          Growth está en pausa: el agente no trabaja hasta que lo reactives en{" "}
          <Link
            href="/ajustes"
            className="underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado"
          >
            Ajustes
          </Link>
          .
        </p>
      ) : null}
      {descartes.total > 0 ? (
        <div>
          <p>
            En los últimos 7 días se descartaron{" "}
            <strong className="font-semibold text-tinta">
              {descartes.total}
            </strong>{" "}
            {descartes.total === 1 ? "candidata" : "candidatas"}:
          </p>
          <ul className="mt-2 inline-block space-y-1 text-left">
            {descartes.porMotivo.map((motivo) => (
              <li key={motivo.codigo}>
                {etiquetaDeCodigoDeDescarte(motivo.codigo)}:{" "}
                <strong className="font-semibold text-tinta">{motivo.n}</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p>En los últimos 7 días no se ha descartado ninguna candidata.</p>
      )}
      <p>
        {ultimaEjecucion
          ? `La última ejecución del agente fue ${formatearDistancia(ultimaEjecucion.inicio)} y ${TEXTO_DE_EJECUCION[ultimaEjecucion.estado]}.`
          : "El agente todavía no ha hecho ninguna ejecución."}
      </p>
    </div>
  );
}
